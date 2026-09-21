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
export const addIncident = ({ source, school, teacher, teacherId, teacherEmail, task, group, studentCount, symptom, detail, penFiles = [], logDate = 'all' }) => {
  start();
  const date = logDate && logDate !== 'all' ? logDate : null;
  const logName = logFileName(teacherId, date);
  const logText = buildLogText({ teacherId, date });
  const report = {
    id: nextId(), createdAt: stamp(), source,
    school, teacher, teacherId, teacherEmail, task: task || '-', group: group || '-', studentCount: studentCount ?? null,
    symptom, detail: detail || '', logDate: date || '전체 기간',
    attachments: { log: { name: logName, chars: logText.length }, penData: penFiles },
    status: '장애 접수', jira: null, devComment: '', replyParts: null, replyDraft: '', mail: null,
  };
  // 게시판 등록과 동시에 Jira 자동 등록 (서버 연동 예정 — 시뮬레이션). 상태는 「장애 접수」 그대로
  report.jira = simulateJira();
  cache = [report, ...cache];
  notify();
  const { id, ...body } = report;
  setDoc(doc(db, COL, id), body)
    .then(() => setDoc(doc(db, COL, id, 'attachments', 'log'), { name: logName, text: logText.slice(-LOG_MAX_CHARS), truncated: logText.length > LOG_MAX_CHARS }))
    .catch(writeFail('신고 접수', id));
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

/** 개발자가 Jira에 댓글을 달면 개발자 답변으로 들어오고 메일 본문에 채워지며 상태가 「개발자 확인 완료」가 된다 (서버 연동 예정 — 시뮬레이션) */
export const receiveJiraComment = (id, comment) => {
  const r = getIncident(id);
  const parts = replyPartsOf(r || {});
  return updateIncident(id, { devComment: comment, replyParts: { ...parts, body: parts.body?.trim() ? parts.body : comment }, status: '개발자 확인 완료' });
};

/** 운영팀 답변 임시저장(인사말·본문·맺음말) — 상태는 바꾸지 않는다 */
export const saveReplyDraft = (id, parts) => updateIncident(id, { replyParts: parts, replyDraft: composeReply(parts) });

export const sendReplyMail = (id, { to, parts }) =>
  updateIncident(id, { replyParts: parts, replyDraft: composeReply(parts), mail: { sentAt: stamp(), to }, status: '메일 발송' });

/** 첨부 파일 다운로드 (브라우저 Blob) */
export const downloadText = (name, text) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
