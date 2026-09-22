/**
 * incidentStore.js
 * [BRD-16] 장애 신고 — 교사 화면(크래들 일괄 채점 · 환경설정)에서 접수한 신고를
 * 시스템 관리자 > 게시판 > 장애신고 에서 관리한다.
 *
 * 저장소: Firestore (v2.0 — 舊 localStorage 폐기)
 *   · 컬렉션 incidents/{INC-id}            — 신고 본문. 목록·상세 화면이 onSnapshot 으로 실시간 구독
 *   · 서브컬렉션 incidents/{id}/attachments/log — 진단 로그 본문(큰 텍스트). 상세에서 내려받을 때만 읽는다
 *   · 펜 데이터는 파일 목록만 본문에 담는다 (실파일은 Storage — Blaze 전환 후)
 *   · Jira 자동 등록·개발자 댓글 수신은 서버(Functions + Jira Webhook) 연동 예정 — 지금은 시뮬레이션(버튼)
 *
 * 화면 코드는 동기 API(listIncidents/getIncident/openCount)를 그대로 쓴다 — 내부 캐시가 onSnapshot 으로 채워진다.
 * 쓰기는 캐시에 먼저 반영(낙관적)하고 Firestore 에 기록한다. 실패하면 다음 스냅샷이 캐시를 되돌린다.
 *
 * 상태 흐름 (v1.2 — 3단계)
 *   장애 접수(게시판 등록 + Jira 자동 등록) → 개발자 확인 완료(Jira 댓글 수신) → 메일 발송(운영팀 답변 발송)
 */
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { buildLogText, logFileName, info as logInfo, error as logError } from '../appLogger';
import { relayEnabled, createJiraIssue, addJiraComment, fetchJiraIssue } from './jiraRelay'; // [v2.1] Vercel 서버리스 중계로 실제 Jira(AGI) 등록

const COL = 'incidents';
const LOG_MAX_CHARS = 200_000; // Firestore 문서 1MiB 제한 — 로그는 뒤쪽(최근) 20만 자만 보관
const listeners = new Set();

export const INCIDENT_STATUS = ['장애 접수', '개발자 확인 완료', '메일 발송'];
// [v1.1] 오류 종류 — 번호표 관련 항목 폐기. 발생 지점별로 구분한다
export const SYMPTOMS = [
  { key: 'connect',  label: 'AiGLE Connect 설치·실행 오류', desc: '프로그램이 없거나 실행 중인데도 준비되지 않음' },
  { key: 'pen',      label: '크래들·펜 연결 실패',           desc: '펜을 꽂아도 연결 중에서 멈추거나 실패로 표시' },
  { key: 'mapping',  label: '펜 데이터 읽기·학생 매핑 오류', desc: '데이터 없음 · 학생을 찾지 못함 · 중복 데이터' },
  { key: 'grading',  label: 'AI 채점 실패·결과 오류',        desc: '채점 실패 · 점수/등급이 이상함 · 결과가 반영되지 않음' },
  { key: 'print',    label: '답안지 인쇄·스캔 OCR 오류',      desc: '인쇄 실패 · 스캔 채점에서 학생·문항을 못 읽음' },
  { key: 'etc',      label: '화면·기타 오류',                desc: '위에 없는 문제 — 상세에 적어 주세요' },
];

// [v1.5] 운영팀 답변 메일 = 인사말 + 본문(개발자 답변) + 맺음말. 인사말·맺음말은 기본 문장을 제시하고 운영팀이 고친다
export const DEFAULT_GREETING = (r) =>
  `안녕하세요, ${r.teacher} 선생님. AiGLE 운영팀입니다.\n${r.createdAt}에 신고해 주신 「${r.symptom}」 건을 확인하여 결과를 안내드립니다.`;
export const DEFAULT_CLOSING = () =>
  `이용에 불편을 드려 죄송합니다. 추가로 궁금한 점이 있으면 이 메일에 회신해 주세요.\n감사합니다.\nAiGLE 운영팀 드림`;
export const replyPartsOf = (r) => ({
  greeting: r.replyParts?.greeting ?? DEFAULT_GREETING(r),
  body: r.replyParts?.body ?? (r.devComment || ''),
  closing: r.replyParts?.closing ?? DEFAULT_CLOSING(r),
});
export const composeReply = (parts) => [parts.greeting, parts.body, parts.closing].map((t) => (t || '').trim()).filter(Boolean).join('\n\n');

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// [v1.2] 舊 4단계 상태(접수 / Jira 등록 / 답변 임시저장) → 3단계로 정규화. 저장된 데이터가 옛 상태를 갖고 있어도 목록 필터와 같은 값으로 보인다
const LEGACY_STATUS = { '접수': '장애 접수', 'Jira 등록': '장애 접수', '답변 임시저장': '개발자 확인 완료', '개발자 확인완료': '개발자 확인 완료', '메일발송': '메일 발송' };
const normalizeStatus = (r) => {
  const status = INCIDENT_STATUS.includes(r.status) ? r.status : (LEGACY_STATUS[r.status] || (r.mail ? '메일 발송' : r.devComment ? '개발자 확인 완료' : '장애 접수'));
  return status === r.status ? r : { ...r, status };
};

/* ── 캐시 + 실시간 구독 ─────────────────────────────────── */
let cache = [];
let started = false;
const notify = () => listeners.forEach((fn) => fn(cache));
// 첫 접근 때 한 번만 onSnapshot 을 연다. 앱이 살아 있는 동안 유지 (구독 해제는 화면 단위가 아니라 스토어 단위)
const start = () => {
  if (started) return;
  started = true;
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    cache = snap.docs.map((d) => normalizeStatus({ id: d.id, ...d.data() }));
    notify();
  }, (err) => {
    logError('incidentStore', 'Firestore 구독 실패', { code: err.code, message: err.message });
  });
};

export const listIncidents = () => { start(); return cache.slice(); };
export const getIncident = (id) => { start(); return cache.find((r) => r.id === id) || null; };
export const subscribeIncidents = (fn) => { start(); listeners.add(fn); return () => listeners.delete(fn); };
export const openCount = () => { start(); return cache.filter((r) => r.status !== '메일 발송').length; };

// INC-YYMMDD-NNN — 같은 날짜의 마지막 번호 + 1 (캐시 기준. 동시 접수 충돌은 프로토타입에서 무시)
const nextId = () => {
  const d = new Date();
  const prefix = `INC-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-`;
  const last = cache.filter((r) => r.id.startsWith(prefix)).reduce((m, r) => Math.max(m, Number(r.id.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(3, '0')}`;
};
// Jira 자동 등록 — [서버 연동 예정] 지금은 키를 만들어 붙이는 시뮬레이션
const simulateJira = () => {
  const n = 1040 + cache.length;
  return { key: `AIGLE-${n}`, registeredAt: stamp(), url: `https://neolab.atlassian.net/browse/AIGLE-${n}`, simulated: true };
};

const writeFail = (what, id) => (err) => logError('incidentStore', `${what} 저장 실패`, { id, code: err.code, message: err.message });

/** 교사 화면에서 신고 접수. 진단 로그 본문은 서브문서에, 펜 데이터는 파일 목록만 담는다 */
// [v1.1] 진단 로그·펜 데이터는 항상 첨부한다 (교사가 고르지 않음). logDate = 'all' 또는 'YYYY-MM-DD'
export const addIncident = ({ source, school, teacher, teacherId, teacherEmail, task, group, studentCount, symptom, detail, penFiles = [], penRaw = null, logDate = 'all' }) => {
  start();
  const date = logDate && logDate !== 'all' ? logDate : null;
  const logName = logFileName(teacherId, date);
  const logText = buildLogText({ teacherId, date });
  const report = {
    id: nextId(), createdAt: stamp(), source,
    school, teacher, teacherId, teacherEmail, task: task || '-', group: group || '-', studentCount: studentCount ?? null,
    symptom, detail: detail || '', logDate: date || '전체 기간',
    // [v1.7] penRaw = 채점 시 로컬에 쌓인 펜 원본 폴더(최근 5회)를 zip 으로 묶은 것. penData 목록은 zip 안 파일 경로 (게시판 표시는 종전과 동일)
    attachments: { log: { name: logName, chars: logText.length }, penData: penFiles, penRaw },
    status: '장애 접수', jira: null, devComment: '', replyParts: null, replyDraft: '', mail: null,
  };
  // 게시판 등록과 동시에 Jira 자동 등록. 상태는 「장애 접수」 그대로
  //   [v2.1] 중계(VITE_JIRA_RELAY_URL)가 있으면 실제 AGI 이슈를 만들고 키를 채운다(비동기). 없으면 종전 시뮬레이션
  report.jira = relayEnabled() ? { key: '등록 중…', registeredAt: stamp(), url: '', pending: true } : simulateJira();
  cache = [report, ...cache];
  notify();
  const { id, ...body } = report;
  setDoc(doc(db, COL, id), body)
    .then(() => setDoc(doc(db, COL, id, 'attachments', 'log'), { name: logName, text: logText.slice(-LOG_MAX_CHARS), truncated: logText.length > LOG_MAX_CHARS }))
    .catch(writeFail('신고 접수', id));
  if (relayEnabled()) {
    createJiraIssue(report)
      .then((r) => updateIncident(id, { jira: { key: r.key, url: r.url, registeredAt: stamp(), pending: false } }))
      .catch((e) => updateIncident(id, { jira: { key: '등록 실패', url: '', registeredAt: stamp(), pending: false, error: e.message } }));
  }
  logInfo('incidentStore', '장애 신고 접수', { id, source, task: report.task, group: report.group, jira: report.jira.key });
  return report;
};

export const updateIncident = (id, patch) => {
  start();
  cache = cache.map((r) => (r.id === id ? { ...r, ...patch } : r));
  notify();
  updateDoc(doc(db, COL, id), patch).catch(writeFail('신고 수정', id));
  return getIncident(id);
};

/** 진단 로그 본문 — 상세에서 내려받을 때만 읽는다 (없으면 null) */
export const fetchIncidentLog = async (id) => {
  const snap = await getDoc(doc(db, COL, id, 'attachments', 'log'));
  return snap.exists() ? snap.data() : null;
};

/** 실제 Jira 이슈가 연결된 신고인가 (시뮬레이션·등록 중·실패 제외) */
export const hasRealJira = (r) => !!(r?.jira?.key && !r.jira.simulated && !r.jira.pending && !r.jira.error && relayEnabled());

/* 운영팀이 메일 발송 기록으로 남긴 댓글은 개발자 답변에서 뺀다 */
const MAIL_COMMENT_PREFIX = '[AiGLE 운영팀 답변 메일';
const isDevComment = (c) => !String(c.text || '').startsWith(MAIL_COMMENT_PREFIX);

/**
 * [v2.2] Jira 에서 상태·댓글을 읽어 게시판에 반영한다.
 *   · 개발자 댓글(메일 기록 댓글 제외) → 개발자 답변(devComment = 최신 댓글) · 메일 본문 칸이 비어 있으면 채움
 *   · 개발자 댓글이 있고 아직 「장애 접수」면 → 「개발자 확인 완료」 (「메일 발송」은 게시판이 정하는 상태라 Jira 로 되돌리지 않는다)
 *   · Jira 상태명·카테고리는 표시용으로 함께 저장 (jiraStatus · jiraStatusCategory)
 * 반환: 갱신된 신고 (변화 없으면 그대로), 실패: null
 */
export const syncFromJira = async (id) => {
  const r = getIncident(id);
  if (!hasRealJira(r)) return r;
  try {
    const issue = await fetchJiraIssue(r.jira.key);
    if (!issue) return r;
    const devComments = (issue.comments || []).filter(isDevComment);
    const latest = devComments[devComments.length - 1];
    const patch = {
      jiraStatus: issue.status || null, jiraStatusCategory: issue.statusCategory || null, jiraSyncedAt: stamp(),
      jiraComments: devComments.map((c) => ({ id: c.id, author: c.author, created: c.created, text: c.text })),
    };
    if (latest && latest.text !== r.devComment) {
      const parts = replyPartsOf(r);
      patch.devComment = latest.text;
      patch.replyParts = { ...parts, body: parts.body?.trim() ? parts.body : latest.text };
      if (r.status === '장애 접수') patch.status = '개발자 확인 완료';
    }
    const changed = Object.keys(patch).some((k) => JSON.stringify(patch[k]) !== JSON.stringify(r[k]));
    logInfo('incidentStore', 'Jira 동기화', { id, key: r.jira.key, status: issue.status, devComments: devComments.length, changed });
    return changed ? updateIncident(id, patch) : r;
  } catch (e) {
    logError('incidentStore', 'Jira 동기화 실패', { id, key: r.jira?.key, error: e });
    // Jira 쪽에서 이슈가 지워진 경우 — 실패가 아니라 상태로 보여 준다
    if (/404/.test(e.message)) return updateIncident(id, { jiraStatus: 'Jira에 없음 (삭제됨)', jiraStatusCategory: null, jiraSyncedAt: stamp() });
    return null;
  }
};

/** 실제 Jira 가 연결된 신고 전부 동기화 — 목록 [↻ Jira 동기화] */
export const syncAllFromJira = async () => {
  const targets = cache.filter(hasRealJira);
  const results = await Promise.all(targets.map((r) => syncFromJira(r.id)));
  return { total: targets.length, failed: results.filter((x) => x === null).length };
};

/** 개발자가 Jira에 댓글을 달면 개발자 답변으로 들어오고 메일 본문에 채워지며 상태가 「개발자 확인 완료」가 된다 (시뮬레이션 — 실제 연동 신고는 syncFromJira) */
export const receiveJiraComment = (id, comment) => {
  const r = getIncident(id);
  const parts = replyPartsOf(r || {});
  return updateIncident(id, { devComment: comment, replyParts: { ...parts, body: parts.body?.trim() ? parts.body : comment }, status: '개발자 확인 완료' });
};

/** 운영팀 답변 임시저장(인사말·본문·맺음말) — 상태는 바꾸지 않는다 */
export const saveReplyDraft = (id, parts) => updateIncident(id, { replyParts: parts, replyDraft: composeReply(parts) });

export const sendReplyMail = (id, { to, parts }) => {
  // [v1.9] 재발송 — 이미 보낸 메일이 있으면 이전 발송을 mailHistory 에 남기고 최신 발송으로 덮는다
  const prev = getIncident(id);
  const mailHistory = prev?.mail ? [...(prev.mailHistory || []), { ...prev.mail, body: prev.replyDraft || '' }] : (prev?.mailHistory || []);
  const next = updateIncident(id, { replyParts: parts, replyDraft: composeReply(parts), mail: { sentAt: stamp(), to }, mailHistory, status: '메일 발송' });
  // [v2.1] Jira 이슈에 발송 기록을 댓글로 남긴다 (중계 미설정이면 no-op)
  if (next?.jira?.key && !next.jira.pending && !next.jira.error && !next.jira.simulated) {
    addJiraComment(next.jira.key, `[AiGLE 운영팀 답변 메일 ${mailHistory.length ? '재발송' : '발송'}] ${stamp()} → ${to}

${composeReply(parts)}`);
  }
  return next;
};

/** 첨부 파일 다운로드 (브라우저 Blob) */
export const downloadText = (name, text) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
