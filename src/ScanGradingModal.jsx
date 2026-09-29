/**
 * ScanGradingModal.jsx
 * [SCR-05] 스캔 일괄 채점 워크플로우 모달
 *
 * 목적: 스캔 파일을 순서·이름 정렬 없이 업로드 → 답안지 기재 내용을 OCR로 읽어
 *       학생·과제·문항을 판별 → 슬롯(학생 × 문항)에 연결 → AI 일괄 채점 → 채점 확인 단계로 전환
 *
 * 4-Step Workflow — [SCR-05 v4.8] SCR-07 크래들 일괄 채점과 같은 결로 맞췄다
 *   1) upload      — 다중 스캔 파일 업로드 (PDF/PNG/JPG). 형식·용량·중복은 여기서 거른다
 *   2) mapping     — 데이터 매핑. 읽는 중(OCR 판별) → 결과 검토가 **한 단계**다
 *                    (舊 `matching`·`review` 2단계 → 크래들의 「데이터 매핑」과 같은 1단계로 통합)
 *   3) grading     — AI 일괄 채점 진행 (채점 대상 슬롯만). 실패 학생은 [다시 시도]
 *   4) completed   — 완료 요약 + [확인] 시 상위 콜백 호출 → 학생 상태 전환
 *
 *   크래들과 다른 점은 **데이터를 가져오는 방법(펜 거치 ↔ 파일 업로드)** 과
 *   매핑 단위(펜 1자루 ↔ 학생 × 문항 슬롯)뿐이다. 헤더·단계 안내·읽는 중 화면·요약 카운트·
 *   「상세 내용」 문구·채점 중 안내·실패 재시도·닫기 확인은 크래들과 같은 규칙을 쓴다.
 *
 * [SCR-05 v4.9] 결석생(전 문항 0장)은 SCR-07처럼 채점 대상에서 **자연 제외**하고 채점 시작을 막지 않는다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * [SCR-05 v4.0] OCR 매핑(A안) — 파일명 규칙·QR 없이 답안지 기재 내용만으로 판별
 *
 *   연결 단위가 「학생」에서 **「슬롯 = 학생 × 문항」**으로 바뀐다.
 *   한 슬롯에는 1장 이상의 답안지가 붙을 수 있다 (문항 하나를 여러 장에 이어 쓰는 경우).
 *
 *   판별 출처 (TSK-05 v3.5 답안지 서식):
 *     · 과제코드   — 시스템 인쇄값(활자). 타 과제 답안지 혼입 검출
 *     · 학년/반/번호 + 이름 — 학생 손글씨. **명단이라는 닫힌 집합과 대조**하므로
 *                            자유 텍스트 OCR이 아니라 후보 선택 문제가 된다
 *     · 문항 번호  — 학생 손글씨 숫자 1자리. 미기재·인식 실패 시 미분류로 안전하게 빠진다
 *
 *   QR 미채택 근거: QR은 「인쇄 시점의 진실」이고 OCR은 「작성 시점의 진실」이다.
 *   학생이 여분 답안지를 집어 쓰면 QR이 거짓을 말하고 그 오류는 조용히 잘못 채점된다.
 *   OCR 실패는 미분류로 빠져 교사에게 확인을 요구하는 안전한 실패다.
 *
 *   신뢰도 3단계 — 교사가 전부 확인하지 않고 애매한 것만 확인하도록 분류한다:
 *     · high   자동 확정   학생 2필드 이상 일치 + 과제코드 일치 + 문항 번호 인식
 *     · medium 확인 필요   일부 필드만 일치, 또는 문항을 AI가 내용으로 추론
 *     · low    미분류      판별 실패 → 미분류 트레이에서 수동 지정
 *
 *   슬롯 상태 (기준 장수 = TSK-02 「답안지 출력 장수 설정」):
 *     · ok       장수 == 기준
 *     · over     장수 >  기준 — 중복 스캔 의심
 *     · short    장수 <  기준 — 답안지가 덜 붙었다. **0장도 여기 포함**한다 `[v4.6]`
 *                (舊 `missing`(0장)은 차단·빈 장 자리·해소 방법이 short와 같아 흡수했다)
 *                [v4.9] 단, **전 문항이 0장인 학생(결석생)은 차단하지 않고 제외**한다
 *   덮어쓰기(overwrite)는 상태가 아니라 **플래그**다 (답안 있음 학생 + 장수 ≥ 1).
 *
 * [SCR-01 v3.24] 답안 기제출(`답안 있음`) 학생 처리 — 3단 게이트 (슬롯 단위로 승계)
 *   1단 (upload)  — `답안 있음` 학생은 대상에서 기본 제외
 *   [v4.2] 1단·2단 폐기 — `답안 있음` 학생도 전원 판별 대상이고, 연결된 슬롯은 즉시 채점 대상이다
 *   실행 직전 — 교체 슬롯이 1건 이상이면 확인 다이얼로그 1회 (**유일한 방어선**)
 *
 * [SCR-05 v4.0] 부분 제출 처리 — 누락 감지 시 3지선다
 *   · 있는 답안으로 계속 채점 (권장)  · 누락 학생 제외하고 채점  · 취소하고 파일 추가
 *   「계속 채점」에서도 답안지가 한 장도 없는 문항은 채점 대상이 아니다. 한 장이라도 붙은
 *   문항은 기준 장수가 어디까지나 **예상값**이므로 있는 장만으로 채점한다.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import appLogger from './appLogger';
import IncidentReportDialog from './IncidentReportDialog'; // [BRD-16] 크래들과 같은 [🚨 이용불편 접수]

const STEPS = [
  /* [v4.8] 단계 안내는 타이틀 호버 툴팁 — SCR-07 v2.7과 같은 방식 */
  { key: 'upload', label: '파일 업로드', icon: '📁', hint: '스캔 파일을 올려 주세요. 파일명·순서는 상관없고, 누구의 몇 번 문항인지는 다음 단계에서 판별합니다.' },
  { key: 'mapping', label: '데이터 매핑', icon: '🔗' },
  { key: 'grading', label: 'AI 일괄 채점', icon: '🤖' },
  { key: 'completed', label: '완료', icon: '✓' },
];

/* [v4.8] 업로드 제한 — 걸린 파일은 목록에 넣지 않고 사유만 안내한다 */
const MAX_FILE_MB = 20;
const ACCEPT_RE = /\.(pdf|png|jpe?g)$/i;

/* [v4.8] 읽는 중 순환 타이틀 — SCR-07 v1.8과 같이 실제 단계와 묶지 않고 「하는 일」만 보인다 */
const JUDGE_PHASES = [
  { key: 'code', label: '답안지 코드 대조' },
  { key: 'ident', label: '학생정보 판독' },
  { key: 'question', label: '문항 번호 판독' },
  { key: 'count', label: '장수 검사' },
];

/* [v4.8] 「상세 내용」 문구 — SCR-07 VERDICT_SPEC와 같은 말투(「종류 — 사유」)를 쓴다.
 *   학생정보를 못 읽은 경우는 크래들과 **같은 문구**다. 교사가 할 일(답안을 보고 직접 지정)이 같기 때문이다. */
const IDENT_UNREAD = '학생 미매칭 — 답안지 학생정보를 읽을 수 없습니다';
const SCAN_REASON = {
  unread:        IDENT_UNREAD,
  not_in_roster: null /* 런타임 생성 — 「학생 미매칭 — 답안지 학생정보의 학생이 명단에 없습니다 [읽음: …]」 */,
  other_task:    '학생 미매칭 — 이 과제 답안지가 아닙니다',
  unlinked:      '미연결 — 연결을 해제한 답안지입니다',
  replaced:      '기존 답안 — 스캔본이 자리를 대신하고 있습니다',
};

/* [v4.8] 학생 표기 — 크래들과 같은 「학년-반-번호」 */
const studentNo = (st) => {
  if (!st) return '—';
  const m = (st.grade || '').match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '—';
};

/* [v4.8] 학생 행 상태 배지 — 크래들 BADGE와 같은 색 규칙(정상 초록 · 확인 필요 빨강) */
const ROW_BADGE = {
  normal: { label: '정상', bg: '#F0FDF4', border: '#86EFAC', color: '#166534' },
  check:  { label: '확인 필요', bg: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C' },
  /* [v4.9] 결석생 — 크래들 「데이터 없음」과 같은 회색. 채점에서 자연 제외된다 */
  excluded: { label: '제외', bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B' },
};

// [v4.0] 슬롯 상태 토큰 — 기준 장수 대비 실제 장수로 판정
const SLOT_TOKEN = {
  ok: { label: '연결', bg: '#F0FDF4', border: '#86EFAC', color: '#166534' },
  over: { label: '답안지 초과', bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
  /* [v4.6] 舊 `missing`(0장) 폐기 — `short`에 흡수. 0장도 차단 대상이므로
   * 중립 회색이 아니라 주의 노랑으로 보이는 편이 실제 의미와 맞다. */
  short: { label: '답안지 부족', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
};

/* [v4.6] 좌측 학생 × 문항 매트릭스의 문항 칸 폭.
 * 상태 라벨이 `초과`/`부족` → `답안지 초과`/`답안지 부족`으로 길어져 66px로는 넘쳤다.
 * 좌측 패널 폭(352 → 392)도 같은 양만큼 늘려 학생 이름 칸이 줄지 않게 했다. */
const SLOT_CELL_W = 78;
/* [v4.8] 좌측 목록 폭 — 이름(+번호) · 문항 칩 · 상태 배지를 한 줄에 두고, 상세 내용은 아랫줄로 */
const NAME_W = 118;

// [v4.0] OCR 신뢰도 3단계
const CONFIDENCE_TOKEN = {
  high: { label: '자동 확정', bg: '#DCFCE7', color: '#166534', dot: '🟢' },
  medium: { label: '확인 필요', bg: '#FEF3C7', color: '#92400E', dot: '🟡' },
  low: { label: '미분류', bg: '#FEE2E2', color: '#991B1B', dot: '🔴' },
};

const ScanGradingModal = ({
  open, onClose, selectedStudents = [], onCompleted, onMinimize, onGradingFinished,
  groupLabel = '그룹1', taskTitle = '과제',
  questions = [], taskCode = '00000594',
}) => {
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]); // { id, name, size, source, kind, previewUrl }
  const [matchResults, setMatchResults] = useState([]); // 파일별 OCR 판별 + 확정 연결
  const [gradingProgress, setGradingProgress] = useState(0);
  const [gradingFinished, setGradingFinished] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [previewFileId, setPreviewFileId] = useState(null);
  // [v3.24] 3단 게이트 — 채점 직전 덮어쓰기 확인 다이얼로그
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  // [v4.7] 판별 직후 교체 의사를 한 번 묻는 창 (전체 스캔으로 기존 답안이 밀려난 경우)
  const [confirmReplace, setConfirmReplace] = useState(false);
  // [v4.2] 리뷰 — 좌측 학생 목록에서 고른 대상. 학생 id 또는 'unassigned'(미분류 트레이)
  const [selectedKey, setSelectedKey] = useState(null);
  // [v4.10] 답안지 작업 팝오버 — 열린 메뉴와 그 버튼의 화면 좌표.
  // 카드/열이 overflow:hidden이라 팝오버를 그 안에 그리면 잘린다. body로 포털해 fixed로 띄운다.
  const [openMenu, setOpenMenu] = useState(null); // { key, top, left, right }
  // [v4.4] 답안지 코드 — 평소엔 숨기고 클릭했을 때만 보여준다
  const [showCodeList, setShowCodeList] = useState(false);   // 헤더: 문항별 전체 목록

  /* ── [v4.8] SCR-07과 같은 결 ── */
  // 데이터 매핑 단계의 「읽는 중」 — 舊 별도 단계(`matching`)였다
  const [reading, setReading] = useState(false);
  const [readTick, setReadTick] = useState(0);
  useEffect(() => {
    if (!reading) return undefined;
    setReadTick(0);
    const iv = setInterval(() => setReadTick((t) => t + 1), 650);
    return () => clearInterval(iv);
  }, [reading]);
  // 업로드에서 걸러진 파일 — { name, reason }. 목록에 넣지 않고 사유만 보여 준다
  const [uploadErrors, setUploadErrors] = useState([]);
  const [hoverStep, setHoverStep] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const [incidentOpen, setIncidentOpen] = useState(false);
  // 채점 중 「다른 일 하셔도 됩니다」 시간차 안내 (SCR-07 v2.9)
  const [gradingElapsed, setGradingElapsed] = useState(0);
  useEffect(() => {
    if (step !== 'grading' || gradingFinished) return undefined;
    const t0 = Date.now();
    const iv = setInterval(() => setGradingElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [step, gradingFinished]);
  // 이번 채점에 올린 학생 / AI 채점 실패 학생 — 에뮬레이터는 첫 시도에서 마지막 학생 1명을 실패시킨다
  const [gradedStudentIds, setGradedStudentIds] = useState([]);
  const [failedStudentIds, setFailedStudentIds] = useState([]);
  const [retrying, setRetrying] = useState(false);
  const failedOnceGradeRef = useRef(false);

  useEffect(() => {
    return () => { files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const seqRef = files.length ? Math.max(...files.map((f) => f.id)) + 1 : 1;
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  // 문항 목록 — sheets = TSK-02 「답안지 출력 장수 설정」(문항별 기준 장수, 미설정 시 1)
  const questionList = (questions.length ? questions : [{ id: 1, title: '문항 1' }])
    .map((q) => ({ ...q, sheets: q.sheets || 1 }));

  // [v4.8] 좌측 목록 폭 = 좌우 여백 + 이름 + 문항 칩 + 배지 + 스크롤바
  const LIST_W = 28 + NAME_W + questionList.length * (SLOT_CELL_W + 4) + 12 + 80 + 16;

  // ─── [v3.24] 답안 기제출 학생 판별 ───
  const isAnswerStudent = (s) => s?.submitType === 'ocr';
  const answerStudents = selectedStudents.filter(isAnswerStudent);
  const answerIdSet = new Set(answerStudents.map((s) => s.id));
  // [v4.2] `답안 있음` 학생도 제외하지 않는다 — 선택된 학생 전원이 OCR 판별·채점 대상
  const targetStudents = selectedStudents;

  const slotKey = (studentId, questionNo) => `${studentId}:${questionNo}`;

  /* [v4.4] 기존 답안 행 — 판별 직후 슬롯에 올릴 때와, 교체를 되돌릴 때 **같은 함수**로 만든다.
   * 한쪽만 바뀌면 「되돌렸는데 다른 카드가 올라온다」가 되므로 생성 지점을 하나로 묶는다.
   *
   * [v4.7] `home{StudentId,QuestionNo}` — 이 답안이 원래 어느 자리의 것인지 항상 들고 다닌다.
   * 스캔본에 밀려 미분류로 내려가도 제자리를 알고 있어야 [↩ 되돌리기]가 가능하다.
   * `attach`가 false면 미분류로 만든다 (전체 스캔에서 그 자리를 스캔본이 이미 차지한 경우). */
  const buildExistingRow = (st, q, attach = true) => ({
    fileId: `exist-${st.id}-${q.id}`,
    fileName: `${st.name} 기존 답안 · ${q.title}`,   // [v4.7] 문항까지 적어야 여러 건을 구분한다
    origin: 'existing',
    homeStudentId: st.id,
    homeQuestionNo: q.id,
    submitPath: st.id % 2 === 0 ? '키보드 입력' : '파일 업로드',
    submittedAt: '2026-08-30 14:12',
    ocrSheetCode: null, ocrStudentText: '', ocrNameText: '', ocrQuestionNo: null, ocrPageNo: null,
    studentId: attach ? st.id : null,
    questionNo: attach ? q.id : null,
    sheetNo: null,
    studentInput: `${st.name} (${st.grade || ''})`.replace(' ()', ''),
    confidence: 'high',
    inferred: false,
  });

  // [v4.5] 문항 셀렉트 값 — 다장 문항은 `1-2`(문항1의 2장째)까지 고를 수 있어야
  // 부족한 장을 정확히 채울 수 있다. 한 장짜리 문항은 장 번호를 두지 않는다.
  const questionValueOf = (r) => (r.questionNo == null ? '' : (r.sheetNo != null ? `${r.questionNo}-${r.sheetNo}` : String(r.questionNo)));
  const parseQuestionValue = (v) => {
    if (!v) return { questionNo: null, sheetNo: null };
    const [qs, ps] = String(v).split('-');
    return { questionNo: Number(qs), sheetNo: ps ? Number(ps) : null };
  };
  const questionOptions = () => questionList.flatMap((q) => (q.sheets > 1
    ? Array.from({ length: q.sheets }, (_, i) => ({ value: `${q.id}-${i + 1}`, label: `${q.title}-${i + 1}` }))
    : [{ value: String(q.id), label: q.title }]));

  /**
   * [v4.4] 답안지 코드 — **과제당 1개가 아니라 「장」마다 1개**다.
   * 코드 개수 = 문항별 기준 장수의 합 (문항당 최대 10장).
   * 여기서는 taskCode를 시작값으로 문항 순서 → 장 순서대로 1씩 올려 mock 생성한다.
   * 실제 서비스에서는 답안지 출력 시점에 발급된 코드 목록을 그대로 받아야 한다.
   */
  const sheetCodeList = (() => {
    const width = String(taskCode).length || 8;
    let seq = parseInt(taskCode, 10);
    if (Number.isNaN(seq)) seq = 0;
    const out = [];
    questionList.forEach((q) => {
      for (let page = 1; page <= Math.min(q.sheets, 10); page += 1) {
        out.push({ questionId: q.id, question: q, page, code: String(seq).padStart(width, '0') });
        seq += 1;
      }
    });
    return out;
  })();
  const sheetCodeOf = (questionId, page) => {
    const hit = sheetCodeList.find((x) => x.questionId === questionId && x.page === page);
    return hit ? hit.code : null;
  };
  const sheetCodeSet = new Set(sheetCodeList.map((x) => x.code));

  // [v4.1] 문항 순번 — 「문항 1」만 보면 과제에 문항이 몇 개인지 알 수 없다.
  // 표기 규칙: 단위 없는 `n/m`은 **페이지(장)** 를 뜻하므로, 문항 순번은 `N번째`로 적어 구분한다.
  const questionOrder = (q) => questionList.findIndex((x) => x.id === q.id) + 1;

  // [v4.2] 학생 표기 — 콤보박스 입력값과 datalist 후보에 동일하게 쓴다
  const studentLabel = (s) => (s ? `${s.name} (${s.grade || ''})`.replace(' ()', '') : '');

  // [v4.2] OCR이 읽은 문항 표기 — 기준 장수가 2장 이상인 문항은 `문항 1-1`처럼
  // 「문항번호-장번호」로 적는다. 한 장짜리 문항은 그냥 `문항 3`.
  const ocrQuestionLabel = (r) => {
    if (r.ocrQuestionNo == null) return '(미기재)';
    const q = questionList.find((x) => x.id === r.ocrQuestionNo);
    return (q && q.sheets > 1 && r.ocrPageNo) ? `문항 ${r.ocrQuestionNo}-${r.ocrPageNo}` : `문항 ${r.ocrQuestionNo}`;
  };


  /* [v4.8] 업로드 검사 — 형식 · 용량 · 같은 파일 중복.
   *   걸린 파일은 목록에 넣지 않는다. 넣어 두고 판별 단계에서 실패시키면 교사가 원인을 두 번 찾게 된다. */
  const handleFilesAdd = (fileList) => {
    const rejected = [];
    const known = new Set(files.map((f) => `${f.name}:${f.size}`));
    const accepted = [];
    Array.from(fileList).forEach((f) => {
      const name = f.name || 'scan.jpg';
      if (!ACCEPT_RE.test(name)) { rejected.push({ name, reason: '지원하지 않는 형식입니다 (PDF · PNG · JPG만 가능)' }); return; }
      if ((f.size || 0) > MAX_FILE_MB * 1024 * 1024) { rejected.push({ name, reason: `${MAX_FILE_MB}MB를 넘습니다 — 해상도를 낮춰 다시 스캔해 주세요` }); return; }
      const sig = `${name}:${f.size || 0}`;
      if (known.has(sig)) { rejected.push({ name, reason: '이미 올린 파일입니다' }); return; }
      known.add(sig);
      accepted.push(f);
    });
    const next = accepted.map((f, i) => {
      const isImage = (f.type || '').startsWith('image/') || /\.(png|jpe?g)$/i.test(f.name || '');
      const isPdf = (f.type || '') === 'application/pdf' || /\.pdf$/i.test(f.name || '');
      return {
        id: seqRef + i,
        name: f.name || `scan_${i}.jpg`,
        size: f.size || 1_200_000,
        source: 'user',
        kind: isImage ? 'image' : isPdf ? 'pdf' : 'unknown',
        previewUrl: isImage ? URL.createObjectURL(f) : null,
      };
    });
    setUploadErrors(rejected);
    if (rejected.length) appLogger.error('scan-upload', '업로드 제외', { rejected });
    setFiles((prev) => [...prev, ...next]);
  };

  const handleRemoveFile = (id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
    setMatchResults((prev) => prev.filter((r) => r.fileId !== id));
  };

  /* [v4.6] 업로드 초기화 — [전체 삭제]와 [← 파일 다시 선택]이 같은 동작을 쓴다.
   * 「파일 다시 선택」은 말 그대로 처음부터 다시 고르는 것이므로 이전 업로드와
   * 판별 결과를 남기지 않는다. 미리보기 URL도 함께 해제해야 파일을 여러 번
   * 갈아 끼울 때 메모리에 쌓이지 않는다. */
  const resetUploads = () => {
    files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setFiles([]);
    setMatchResults([]);
    setUploadErrors([]);
    setSelectedKey(null);
    setOpenMenu(null);
    setPreviewFileId(null);
  };

  // mock 파일 — 학생 × 문항 × 기준 장수만큼 생성하되, 일부러 상태를 흩뜨려
  // 연결 결과 확인(Step 3)의 상태 그룹이 모두 채워지도록 만든다
  const injectMockFiles = () => {
    const seed = files.length + 1;
    const plan = [];
    // [v4.9] 결석생 시연 대상 — 초과·부족 시연(앞 2명)과 `답안 있음` 학생(기존 답안이 자리를 채움)을 피해 뒤에서부터 고른다
    const absentDemoId = [...targetStudents].reverse().find((s) => targetStudents.indexOf(s) >= 2 && !isAnswerStudent(s))?.id;
    targetStudents.forEach((s, si) => {
      /* [v4.7] `답안 있음` 학생도 스캔을 만든다 — 舊 v4.4의 「만들지 않는다」 폐기.
       * 실제 운영에서 교사는 답안 유무를 가리지 않고 반 전체를 통째로 스캔하므로,
       * 데모도 그 상황(= 교체 발생)을 그대로 재현해야 화면을 검증할 수 있다. */
      questionList.forEach((q, qi) => {
        // 시연용 결손: 3번째 학생의 마지막 문항은 통째로 누락
        if (si === 2 && qi === questionList.length - 1) return;  // 0장 → `부족 0/N장`
        if (s.id === absentDemoId) return;  // [v4.9] 결석생 시연 — 전 문항 0장 → 채점 제외(차단하지 않음)
        let need = q.sheets;
        if (si === 1 && qi === 0 && q.sheets > 1) need = q.sheets - 1; // 부족(short)
        if (si === 0 && qi === 1) need = q.sheets + 1;                 // 초과(over) — 중복 스캔 시연
        for (let p = 0; p < need; p += 1) plan.push({ s, q, page: p + 1 });
      });
    });
    // 판별 실패 1건(미분류 시연)은 상한에 잘리지 않도록 자른 뒤에 붙인다
    const capped = plan.slice(0, 23);
    /* [v4.8] 미분류 사유 3종을 모두 재현한다 — 크래들 판정(#3 다른 과제 · #5 판독 불가 · #7 명단 밖)과 같은 짝 */
    capped.push({ s: null, q: null, page: 1, fault: 'unread' });
    capped.push({ s: null, q: null, page: 1, fault: 'other_task' });
    capped.push({ s: null, q: null, page: 1, fault: 'not_in_roster' });
    const mock = capped.map((it, i) => ({
      id: seed + i,
      name: `scan_${String(seed + i).padStart(4, '0')}.jpg`,
      size: 1_000_000 + i * 40_000,
      source: 'mock',
      kind: 'mock',
      previewUrl: null,
      _plan: it,
    }));
    setFiles((prev) => [...prev, ...mock]);
  };

  /**
   * Step 2: OCR 판별 (mock)
   * 실제 서비스에서는 OCR API가 파일별로 아래 필드를 돌려준다:
   *   { taskCode, gradeClassNo, name, questionNo } + 각 필드 신뢰도
   * 여기서는 mock 파일에 심어둔 _plan을 그대로 읽되, 일부를 medium/low로 떨어뜨려
   * 신뢰도 3단계 흐름(자동 확정 / 확인 필요 / 미분류)을 재현한다.
   */
  const startMatching = () => {
    if (!files.length) return;
    // [v4.8] 舊 `matching` 단계 → 데이터 매핑 단계 안의 「읽는 중」 (SCR-07과 같은 구성)
    setStep('mapping');
    setReading(true);
    appLogger.info('scan-ocr', '답안지 판별 시작', { fileCount: files.length });
    setTimeout(() => {
      const rows = files.map((f, i) => {
        const plan = f._plan;
        const s = plan?.s || targetStudents[i % Math.max(targetStudents.length, 1)] || null;
        const q = plan?.q || questionList[i % questionList.length];
        const noPlanStudent = plan ? !plan.s : false;

        /* 판별 실패 (미분류) — [v4.8] 사유를 3종으로 가른다.
         *   other_task    답안지 코드가 이 과제 코드 목록에 없다 (다른 과제 답안지 혼입)
         *   not_in_roster 학생정보는 읽혔으나 선택 그룹 명단에 없다
         *   unread        학생정보를 비웠거나 읽지 못했다 */
        if (noPlanStudent) {
          const base = {
            fileId: f.id, fileName: f.name,
            ocrSheetCode: null, ocrStudentText: '(인식 실패)', ocrNameText: '', ocrQuestionNo: null, ocrPageNo: null,
            studentId: null, questionNo: null, sheetNo: null, confidence: 'low', inferred: false, reason: 'unread',
          };
          if (plan.fault === 'other_task') {
            return { ...base, ocrSheetCode: '00000871', ocrStudentText: targetStudents[0]?.grade || '', ocrNameText: targetStudents[0]?.name || '', ocrQuestionNo: 1, reason: 'other_task' };
          }
          if (plan.fault === 'not_in_roster') {
            return { ...base, ocrSheetCode: sheetCodeOf(questionList[0].id, 1), ocrStudentText: '1학년 1반 31번', ocrNameText: '오세훈', ocrQuestionNo: 1, reason: 'not_in_roster',
              reasonText: '학생 미매칭 — 답안지 학생정보의 학생이 명단에 없습니다 [읽음: 1학년 1반 31번 오세훈]' };
          }
          return base;
        }
        // 매 4번째 파일은 문항 번호 미기재 → AI 내용 추론 → medium
        const questionMissed = i % 4 === 3;
        return {
          fileId: f.id, fileName: f.name,
          // 답안지 코드는 인쇄값이라 학생 필기와 무관하게 읽힌다 (장 = 코드 1개)
          ocrSheetCode: sheetCodeOf(q.id, plan?.page ?? 1),
          ocrStudentText: s ? s.grade : '',
          ocrNameText: s ? s.name : '',
          ocrQuestionNo: questionMissed ? null : q.id,
          ocrPageNo: questionMissed ? null : (plan?.page ?? null), // 다장 문항의 「문항 1-2」 표기용
          studentId: s ? s.id : null,
          questionNo: q.id,
          sheetNo: q.sheets > 1 ? (plan?.page ?? null) : null,
          confidence: questionMissed ? 'medium' : 'high',
          inferred: questionMissed,
        };
      });
      /* [v4.4] `답안 있음` 학생의 기존 답안을 **슬롯에 붙은 카드**로 함께 올린다.
       * 기존 답안은 「장」이 아니라 「제출 1건」이므로 기준 장수와 비교하지 않는다(§4.5).
       *
       * [v4.7] 전체 스캔 대응 — 교사는 보통 답안 유무를 가리지 않고 **반 전체를 통째로** 스캔한다.
       * 그러면 `답안 있음` 학생 자리에도 스캔본이 붙는다. 이때 한 슬롯에 두 답안을 겹쳐 두면
       * 「무엇으로 채점되는지」가 화면에도 코드에도 드러나지 않으므로, **스캔본을 자리에 두고
       * 기존 답안은 미분류로 내린다.** 사라지지 않으므로 채점 전까지 언제든 되돌릴 수 있다. */
      const taken = new Set(rows.filter((r) => r.studentId != null && r.questionNo != null)
        .map((r) => slotKey(r.studentId, r.questionNo)));
      const existingRows = answerStudents.flatMap((st) => questionList.map(
        (q) => buildExistingRow(st, q, !taken.has(slotKey(st.id, q.id)))));
      setMatchResults([...rows, ...existingRows]);
      setReading(false);
      appLogger.info('scan-ocr', '답안지 판별 완료', { fileCount: rows.length, unassigned: rows.filter((r) => r.studentId == null).length });
      // 교체가 발생하면 **판별 결과를 보여준 뒤** 교체 의사를 한 번 묻는다 (판별 전에 묻지 않는다)
      if (existingRows.some((r) => r.studentId == null)) setConfirmReplace(true);
    }, 2400);
  };

  /** [v4.8] 미분류 사유 문구 — 연결되지 않은 행만 갖는다 */
  const reasonOf = (r) => {
    if (r.studentId != null && r.questionNo != null) return null;
    if (r.origin === 'existing') return SCAN_REASON.replaced;
    return r.reasonText || SCAN_REASON[r.reason] || SCAN_REASON.unlinked;
  };

  // 파일의 학생/문항 확정값 변경 — 교사가 직접 지정하면 신뢰도는 high로 승격
  const updateAssign = (fileId, patch) => {
    const before = matchResults.find((r) => r.fileId === fileId);
    setMatchResults((prev) => {
      const next = prev.map((r) => {
        if (r.fileId !== fileId) return r;
        const nx = { ...r, ...patch };
        nx.confidence = (nx.studentId != null && nx.questionNo != null) ? 'high' : 'low';
        nx.inferred = false;
        // [v4.8] 연결을 풀면 사유는 「미연결」, 붙이면 사유가 없어진다
        nx.reason = nx.confidence === 'low' ? 'unlinked' : null;
        nx.reasonText = null;
        return nx;
      });
      /* [v4.7] 舊 자동 복원 폐기 — 기존 답안은 교체돼도 사라지지 않고 **미분류에 실체로 남는다.**
       * 여기서 다시 만들어 붙이면 같은 답안이 둘이 된다. 복원은 교사가 [↩ 되돌리기]로 한다. */
      return next;
    });
  };

  /* [v4.7] 교체 되돌리기 — 미분류에 내려온 기존 답안을 원래 자리로 올리고,
   * 그 자리를 차지하고 있던 스캔본을 미분류로 내린다. 자리는 언제나 한쪽만 차지한다. */
  const restoreExisting = (row) => {
    const sid = row.homeStudentId; const qid = row.homeQuestionNo;
    setMatchResults((prev) => prev.map((r) => {
      if (r.fileId === row.fileId) return { ...r, studentId: sid, questionNo: qid };
      if (r.origin !== 'existing' && r.studentId === sid && r.questionNo === qid) {
        return { ...r, studentId: null, questionNo: null, sheetNo: null, studentInput: '', confidence: 'low', inferred: false, reason: 'unlinked', reasonText: null };
      }
      return r;
    }));
  };

  const confirmFile = (fileId) => {
    setMatchResults((prev) => prev.map((r) => (r.fileId === fileId ? { ...r, confidence: 'high', inferred: false } : r)));
  };

  // ─── 슬롯(학생 × 문항) 파생 ───
  const assigned = matchResults.filter((r) => r.studentId != null && r.questionNo != null);
  const unassigned = matchResults.filter((r) => r.studentId == null || r.questionNo == null);
  /* [v4.7] 미분류 트레이는 성격이 다른 둘을 담는다 — 섞어 놓으면 「판별 실패」로 오해한다.
   *  · unassignedScans   어느 자리에도 없는 스캔(판별 실패 + 되돌리기로 내려온 것). 채점되지 않는다
   *  · replacedExistings 스캔본에 자리를 내준 기존 답안. 이상이 아니라 **교체의 결과**다 */
  const unassignedScans = unassigned.filter((r) => r.origin !== 'existing');
  const replacedExistings = unassigned.filter((r) => r.origin === 'existing');
  // [v4.7] 교체 대상 **학생** 이름 — 한 학생이 여러 문항을 갖더라도 한 번만 적는다
  const replacedStudentNames = [...new Set(replacedExistings.map((r) => r.homeStudentId))]
    .map((id) => targetStudents.find((x) => x.id === id)?.name)
    .filter(Boolean);
  // 모두 되돌리기 — 교체 의사 확인창의 [기존 답안으로 채점]이 쓴다
  const restoreAllExisting = () => replacedExistings.forEach(restoreExisting);

  const slots = [];
  const slotIndex = {};
  targetStudents.forEach((s) => {
    questionList.forEach((q) => {
      const slot = { key: slotKey(s.id, q.id), student: s, question: q, files: [] };
      slots.push(slot);
      slotIndex[slot.key] = slot;
    });
  });
  assigned.forEach((r) => {
    const slot = slotIndex[slotKey(r.studentId, r.questionNo)];
    if (slot) slot.files.push(r);
  });
  // 지정된 장 번호 순서대로. 번호가 없는 것(한 장 문항·수동 지정)은 뒤로
  slots.forEach((sl) => sl.files.sort((a, b) => (a.sheetNo ?? 99) - (b.sheetNo ?? 99)));

  // [v4.5] 이 문항에 교사 확인이 필요한 답안지가 있나 (AI 추정 등 medium)
  const slotNeedsCheck = (sl) => sl.files.some((f) => f.confidence === 'medium');

  const slotStatus = (slot) => {
    if (slotHasExisting(slot)) return 'ok';
    const n = slot.files.length;
    const need = slot.question.sheets;
    if (n < need) return 'short';   // [v4.6] 0장도 `부족`. 舊 `missing` 분기 폐기
    if (n > need) return 'over';
    return 'ok';
  };
  /* [v4.4] 기존 답안이 붙은 슬롯은 「제출 1건」으로 채워진 것으로 보고 기준 장수와 비교하지 않는다.
   * 기존 답안은 파일이 아니라 학생이 이미 낸 제출물이라 「몇 장」이라는 개념 자체가 없다. */
  const slotHasExisting = (slot) => slot.files.some((f) => f.origin === 'existing');
  /* 교체 판정 — 원래 기존 답안이 있던 슬롯인데 지금은 없다면 스캔본으로 갈아끼운 것이다.
   * 별도 state 없이 현재 구성만으로 도출되므로 되돌리거나 다시 교체해도 항상 일치한다. */
  const slotReplacedExisting = (slot) => answerIdSet.has(slot.student.id) && !slotHasExisting(slot) && slot.files.length > 0;

  // 채점 대상 슬롯 판정
  const isGradableSlot = (sl) => {
    // [v4.2] 답안지가 붙은 슬롯은 전부 채점 대상. 누락 슬롯은 조용히 빠지고 별도 안내를 띄우지 않는다
    if (sl.files.length === 0) return false;
    return true;
  };
  const gradableSlots = slots.filter(isGradableSlot);
  const gradableStudentIds = [...new Set(gradableSlots.map((sl) => sl.student.id))];
  const replacedSlots = slots.filter(slotReplacedExisting);
  // 실제로 기존 답안을 교체하게 되는 슬롯 수 (= 채점 대상이면서 `답안 있음` 학생)
  const replacedCount = gradableSlots.filter(slotReplacedExisting).length;
  // 기준 장수에 못 미치는 채로 채점된 문항 — 교사가 완료 후 인지해야 하므로 별도 카운트
  const shortGradedCount = gradableSlots.filter((sl) => slotStatus(sl) === 'short').length;

  /* ─── [v4.3] 채점 시작 차단 조건 ───
   * 미분류 파일은 **무시**한다 (어느 슬롯에도 붙지 않아 채점에 관여하지 않음).
   * 슬롯이 하나라도 `초과`·`부족`이거나, 연결된 답안지에 `확인 필요`가 남아 있으면 막는다.
   * 舊 v4.2는 이 상황들을 통과시키고 완료 요약에서 고지만 했으나,
   * 「데이터가 덜 갖춰진 채로 채점이 확정된다」는 문제가 커서 사전 차단으로 전환했다. */
  /* [v4.9] 결석생 — 모든 문항이 0장인 학생. SCR-07처럼 **채점 대상에서 자연 제외**하고 차단하지 않는다.
   *   舊 v4.6은 0장 문항도 `부족`으로 보고 막아, 결석생 한 명 때문에 반 전체 채점이 멈췄다.
   *   한 문항이라도 답안지가 붙으면 결석생이 아니므로 나머지 빈 문항은 그대로 `부족`(차단)이다. */
  const isAbsent = (s) => questionList.every((q) => slotIndex[slotKey(s.id, q.id)].files.length === 0);
  const absentStudents = targetStudents.filter(isAbsent);
  const absentIdSet = new Set(absentStudents.map((s) => s.id));
  const abnormalSlots = slots.filter((sl) => !absentIdSet.has(sl.student.id) && slotStatus(sl) !== 'ok');
  const pendingCheckFiles = assigned.filter((r) => r.confidence === 'medium');
  const startBlocked = gradableSlots.length === 0 || abnormalSlots.length > 0 || pendingCheckFiles.length > 0;
  // 무엇 때문에 막혔는지 교사에게 그대로 알려준다 — 「비활성인데 이유를 모르겠다」가 가장 나쁜 상태다
  const startBlockReason = (() => {
    // [v4.8] SCR-07과 같은 말투 — 무엇이 없는지 + 무엇을 하면 되는지
    if (gradableSlots.length === 0) return '채점할 수 있는 답안지가 없습니다. 스캔 파일을 다시 올리거나, 미분류 답안지를 학생·문항에 직접 지정해 주세요.';
    const parts = [];
    const n = (st) => abnormalSlots.filter((sl) => slotStatus(sl) === st).length;
    if (n('over')) parts.push(`답안지 초과 ${n('over')}건`);
    if (n('short')) parts.push(`답안지 부족 ${n('short')}건`);
    if (pendingCheckFiles.length) parts.push(`확인 필요 ${pendingCheckFiles.length}장`);
    return `${parts.join(' · ')}을(를) 먼저 정리해 주세요. 모든 문항이 기준 장수를 채우고 확인이 끝나야 채점을 시작할 수 있습니다.`;
  })();

  // 전 문항이 채점된 학생만 `채점 확인`으로 전환. 일부만 채점된 학생은 미채점에 남는다
  const fullyGradedStudentIds = targetStudents
    .filter((s) => questionList.every((q) => {
      const sl = slotIndex[slotKey(s.id, q.id)];
      return sl && isGradableSlot(sl);
    }))
    .map((s) => s.id);
  const partiallyGradedCount = gradableStudentIds.length - fullyGradedStudentIds.length;

  /* [v4.8] 학생 행의 「상태 배지 · 상세 내용」 — SCR-07 펜 목록의 두 열과 같은 역할.
   *   배지는 상태의 «종류»(정상 / 확인 필요)만, 상세 내용은 «무슨 일이 일어났는지»를 말한다.
   *   한 학생에게 사유가 여럿이면 가장 급한 것 하나 + 「외 n건」. */
  const studentDetail = (s) => {
    const sls = questionList.map((q) => slotIndex[slotKey(s.id, q.id)]);
    // [v4.9] 결석생은 확인 대상이 아니라 제외 대상 — 배지 「제외」(회색), 채점 시작을 막지 않는다
    if (absentIdSet.has(s.id)) return { badge: 'excluded', text: '채점 제외 — 올린 파일에서 이 학생의 답안지를 찾지 못했습니다', issues: [] };
    const issues = [];
    sls.forEach((sl) => {
      const st = slotStatus(sl);
      if (st === 'over') issues.push(`답안지 초과 — ${sl.question.title} ${sl.files.length}/${sl.question.sheets}장 · 중복 스캔 의심`);
      if (st === 'short') issues.push(`답안지 부족 — ${sl.question.title} ${sl.files.length}/${sl.question.sheets}장`);
    });
    const pending = sls.reduce((a, sl) => a + sl.files.filter((f) => f.confidence === 'medium').length, 0);
    if (pending) issues.push(`문항 확인 필요 — 문항 번호를 AI가 추정한 답안지 ${pending}장`);
    if (issues.length) return { badge: 'check', text: issues[0] + (issues.length > 1 ? ` 외 ${issues.length - 1}건` : ''), issues };
    if (sls.some(slotReplacedExisting)) return { badge: 'normal', text: '기존 답안 교체 — 스캔본으로 채점됩니다', issues };
    if (sls.every(slotHasExisting)) return { badge: 'normal', text: '기존 답안으로 채점', issues };
    return { badge: 'normal', text: '답안지 연결', issues };
  };
  const needsCheckStudents = targetStudents.filter((s) => studentDetail(s).badge === 'check');


  // 미분류 파일을 특정 슬롯으로 바로 지정 (부족 슬롯의 빈 장 자리에서 호출)
  const assignFileToSlot = (fileId, sl, sheetNo = null) => updateAssign(fileId, {
    studentId: sl.student.id, questionNo: sl.question.id, sheetNo,
  });

  /**
   * [v4.7] 이미 붙어 있는 장을 **다른 파일로 교체**한다.
   *  · swapSlotFile   — 미분류 파일과 자리를 맞바꾼다 (기존 파일은 미분류로 내려간다)
   *  · replaceByUpload — 새로 올린 파일을 그 자리에 붙이고 기존 파일은 목록에서 뺀다
   */
  const swapSlotFile = (oldRow, newFileId) => {
    const owner = targetStudents.find((x) => x.id === oldRow.studentId);
    setMatchResults((prev) => prev.flatMap((row) => {
      if (row.fileId === oldRow.fileId) {
        /* [v4.7] 기존 답안도 **미분류로 내려간다** (舊 v4.4의 「목록에서 사라진다」 폐기).
         * 사라지면 잘못 교체한 순간 복구 수단이 없고, 교사가 채점 전까지 무엇을 밀어냈는지
         * 확인할 방법도 없다. 미분류에 남겨 두면 [↩ 되돌리기] 한 번으로 제자리로 간다. */
        return [{ ...row, studentId: null, questionNo: null, sheetNo: null, studentInput: '', confidence: 'low', inferred: false, reason: 'unlinked', reasonText: null }];
      }
      if (row.fileId === newFileId) {
        return {
          ...row,
          studentId: oldRow.studentId,
          questionNo: oldRow.questionNo,
          sheetNo: oldRow.sheetNo,
          studentInput: studentLabel(owner),
          confidence: 'high',
          inferred: false,
        };
      }
      return row;
    }));
  };

  const replaceByUpload = (fileList, oldRow) => {
    const picked = Array.from(fileList || [])[0];
    if (!picked) return;
    const isImage = (picked.type || '').startsWith('image/') || /\.(png|jpe?g)$/i.test(picked.name || '');
    const isPdf = (picked.type || '') === 'application/pdf' || /\.pdf$/i.test(picked.name || '');
    const entry = {
      id: seqRef,
      name: picked.name || 'scan.jpg',
      size: picked.size || 0,
      source: 'user',
      kind: isImage ? 'image' : isPdf ? 'pdf' : 'unknown',
      previewUrl: isImage ? URL.createObjectURL(picked) : null,
    };
    const owner = targetStudents.find((x) => x.id === oldRow.studentId);
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === oldRow.fileId);
      if (gone && gone.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return [...prev.filter((f) => f.id !== oldRow.fileId), entry];
    });
    /* [v4.7] 밀려나는 쪽 처리 — 기존 답안은 **지우지 않고 미분류로 내린다.**
     * 여기서 지우면 [⋯ → 파일 업로드]로 교체한 순간 학생 답안이 화면에서 사라져 되돌릴 수 없다. */
    setMatchResults((prev) => [
      ...prev.flatMap((x) => {
        if (x.fileId !== oldRow.fileId) return [x];
        if (x.origin !== 'existing') return [];
        return [{ ...x, studentId: null, questionNo: null }];
      }),
      {
      fileId: entry.id,
      fileName: entry.name,
      ocrSheetCode: sheetCodeOf(oldRow.questionNo, oldRow.sheetNo ?? 1),
      ocrStudentText: '', ocrNameText: '', ocrQuestionNo: null, ocrPageNo: null,
      studentId: oldRow.studentId,
      questionNo: oldRow.questionNo,
      sheetNo: oldRow.sheetNo,
      studentInput: studentLabel(owner),
      confidence: 'high',
      inferred: false,
      manual: true,
      },
    ]);
  };

  /**
   * [v4.6] 빈 장 자리에서 바로 업로드 — 파일을 추가하면서 그 자리(학생 × 문항 × 장)에 곧장 붙인다.
   * OCR을 거치지 않고 교사가 자리를 지정한 것이므로 신뢰도는 high(직접 지정)로 둔다.
   * OCR 판독 칸에는 판독값 대신 「직접 추가」임을 밝혀 자동 판별분과 구분되게 한다.
   */
  const addFileToSlot = (fileList, sl, sheetNo = null) => {
    const picked = Array.from(fileList || [])[0];
    if (!picked) return;
    const isImage = (picked.type || '').startsWith('image/') || /\.(png|jpe?g)$/i.test(picked.name || '');
    const isPdf = (picked.type || '') === 'application/pdf' || /\.pdf$/i.test(picked.name || '');
    const entry = {
      id: seqRef,
      name: picked.name || 'scan.jpg',
      size: picked.size || 0,
      source: 'user',
      kind: isImage ? 'image' : isPdf ? 'pdf' : 'unknown',
      previewUrl: isImage ? URL.createObjectURL(picked) : null,
    };
    setFiles((prev) => [...prev, entry]);
    setMatchResults((prev) => [...prev, {
      fileId: entry.id,
      fileName: entry.name,
      ocrSheetCode: sheetCodeOf(sl.question.id, sheetNo ?? 1),
      ocrStudentText: '', ocrNameText: '', ocrQuestionNo: null, ocrPageNo: null,
      studentId: sl.student.id,
      questionNo: sl.question.id,
      sheetNo,
      studentInput: studentLabel(sl.student),
      confidence: 'high',
      inferred: false,
      manual: true,
    }]);
  };

  // ─── 채점 시작 게이트 ───
  // [v4.2] 누락 안내(舊 3지선다) 폐기 — 매핑된 답안만으로 즉시 채점을 시작한다
  const requestGrading = () => {
    // 유일한 덮어쓰기 방어선 — 여기서 취소하면 기존 답안은 그대로 유지된다
    if (replacedCount > 0) { setConfirmOverwrite(true); return; }
    startGrading();
  };

  const startGrading = () => {
    setConfirmOverwrite(false);
    setStep('grading');
    setGradingProgress(0);
    setGradingFinished(false);
    setGradingElapsed(0);
    setFailedStudentIds([]);
    setGradedStudentIds(gradableStudentIds);
    appLogger.info('useBatchUploadPipeline', '일괄 업로드 시작', { source: 'scan', collectedCount: gradableStudentIds.length, slotCount: gradableSlots.length, unassigned: unassigned.length });
    /* [v4.8] 에뮬레이터 — 첫 시도에서 마지막 학생 1명이 「토큰 용량 초과」로 실패한다(SCR-07 v2.9와 같은 재현). 재시도에서는 성공 */
    const failId = (!failedOnceGradeRef.current && gradableStudentIds.length >= 2) ? gradableStudentIds[gradableStudentIds.length - 1] : null;
    const startAt = Date.now();
    const tick = () => {
      const pct = Math.min(100, Math.round(((Date.now() - startAt) / 5000) * 100));
      setGradingProgress(pct);
      if (pct >= 100) {
        if (failId) {
          failedOnceGradeRef.current = true;
          setFailedStudentIds([failId]);
          appLogger.error('useBatchUploadPipeline', 'AI 채점 실패', { studentId: failId, error: { message: 'context length exceeded', code: 'E-AI-TOKEN-LIMIT' } });
        }
        setGradingFinished(true);
        onGradingFinished?.();   // [v4.2] 최소화 상태여도 FAB를 「채점 완료」로 전환
        setTimeout(() => setStep('completed'), 500);
        return;
      }
      setTimeout(tick, 180);
    };
    tick();
  };

  /* [v4.8] 실패한 학생만 다시 채점 — 정상 학생의 결과는 그대로 둔다 (SCR-07 v2.9) */
  const retryFailed = () => {
    const targets = [...failedStudentIds];
    if (!targets.length) return;
    setRetrying(true);
    appLogger.info('useBatchUploadPipeline', 'AI 채점 재시도', { studentIds: targets });
    setTimeout(() => {
      setFailedStudentIds([]);
      setRetrying(false);
      setToast('실패했던 답안의 채점이 완료되었습니다.');
    }, 2500);
  };

  const handleConfirmComplete = () => {
    // [v4.8] 실패한 학생은 채점 확인으로 넘기지 않는다 — 미채점에 남아 다음 시도에서 이어간다
    if (typeof onCompleted === 'function') onCompleted(fullyGradedStudentIds.filter((id) => !failedStudentIds.includes(id)));
  };

  // [v4.2 · v4.8] 닫기 정책 — SCR-07과 동일
  //   upload            → 즉시 종료(진행한 작업 없음)
  //   mapping           → 확인 다이얼로그 후 종료(판별 결과 폐기)
  //   grading · completed → **최소화**. 채점은 계속 진행되고 FAB로 다시 열 수 있다
  const handleCloseAttempt = () => {
    if (step === 'grading' || step === 'completed') {
      onMinimize?.({ finished: step === 'completed' || gradingFinished });
      return;
    }
    if (step === 'upload') { onClose?.(); return; }
    setConfirmClose(true);
  };
  const forceClose = () => { setConfirmClose(false); onClose?.(); };

  // ─────────── UI ───────────
  /* ── 공용 스타일 — SCR-07과 같은 값 ── */
  const sectionCard = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' };
  const ghostBtn = { padding: '9px 18px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' };
  const primaryBtn = (enabled) => ({ padding: '9px 18px', borderRadius: 8, background: enabled ? '#2A75F3' : '#CBD5E1', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit' });
  const handleIncidentSubmitted = (report) => { setToast(`이용불편 접수가 완료되었습니다 — ${report.id} (Jira ${report.jira?.key})`); };
  const kindCount = (k) => files.filter((f) => f.kind === k || (k === 'image' && f.kind === 'mock')).length;

  /* [v4.8] SCR-07과 같이 body로 포털한다 */
  return createPortal(
    <div onClick={handleCloseAttempt} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', background: '#F8FAFC', borderRadius: 16, width: '92vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* 헤더 — 그룹 · 과제 · 대상 학생 + [🚨 이용불편 접수] (SCR-07과 같은 구성) */}
        <div style={{ padding: '18px 24px 12px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>📷 스캔 일괄 채점</h2>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 4 }}>
              그룹 <strong style={{ color: '#1E293B' }}>{groupLabel}</strong> · 과제 <strong style={{ color: '#1E293B' }}>{taskTitle}</strong> · 대상 학생 <strong style={{ color: '#1E293B' }}>{targetStudents.length}명</strong>
              {' · '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <button onClick={() => setShowCodeList((v) => !v)}
                  style={{ padding: '1px 8px', borderRadius: 999, border: `1px solid ${showCodeList ? '#2A75F3' : '#CBD5E1'}`, background: showCodeList ? '#EFF6FF' : 'white', color: showCodeList ? '#1D4ED8' : '#64748B', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🏷 답안지 코드 {sheetCodeList.length}개
                </button>
                {showCodeList && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20, background: 'white', border: '1px solid #CBD5E1', borderRadius: 10, boxShadow: '0 8px 20px rgba(15,23,42,0.18)', padding: '10px 12px', minWidth: 260, maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 6 }}>
                      답안지 <strong style={{ color: '#1E293B' }}>1장마다 코드 1개</strong>가 부여됩니다.
                    </div>
                    {questionList.map((q) => {
                      const codes = sheetCodeList.filter((x) => x.questionId === q.id);
                      return (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '3px 0', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', minWidth: 54 }}>{q.title}</span>
                          {codes.map((x) => (
                            <span key={x.code} style={{ padding: '1px 6px', borderRadius: 5, background: '#F1F5F9', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 'var(--neo-font-size-xs)', color: '#1E293B' }}>
                              {x.code}<span style={{ color: '#94A3B8' }}>({x.page}/{codes.length})</span>
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={() => setIncidentOpen(true)} title="학교·교사·과제·그룹 정보와 진단 로그를 함께 시스템 관리자에게 접수합니다."
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              🚨 이용불편 접수
            </button>
            <button onClick={handleCloseAttempt} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
          </div>
        </div>
        {toast && (
          <div style={{ position: 'absolute', left: '50%', bottom: 84, transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 16px', borderRadius: 10, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, boxShadow: '0 8px 24px rgba(15,23,42,0.3)', zIndex: 6, whiteSpace: 'nowrap' }}>
            ✓ {toast}
          </div>
        )}

        {/* 스텝 프로그레스 — 안내가 있는 단계는 호버 툴팁 (SCR-07 v2.7) */}
        <div style={{ display: 'flex', padding: '12px 24px', gap: 4, background: 'white', borderBottom: '1px solid #E2E8F0' }}>
          {STEPS.map((s, i) => {
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div key={s.key}
                onMouseEnter={() => s.hint && setHoverStep(s.key)} onMouseLeave={() => setHoverStep(null)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, position: 'relative', cursor: s.hint ? 'help' : 'default', background: isActive ? '#EFF6FF' : isDone ? '#F0FDF4' : 'transparent', color: isActive ? '#1D4ED8' : isDone ? '#047857' : '#94A3B8', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                <span>{isDone ? '✓' : s.icon}</span>
                <span>{i + 1}. {s.label}</span>
                {s.hint && (
                  <span aria-label="안내 보기" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: '1.5px solid currentColor', fontSize: 10, fontWeight: 800, lineHeight: 1, opacity: 0.8 }}>i</span>
                )}
                {s.hint && hoverStep === s.key && (
                  <div role="tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#1E293B', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, lineHeight: 1.6, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(15,23,42,0.3)', zIndex: 6 }}>
                    {s.hint}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, minHeight: 0, padding: '20px 24px', ...(step === 'mapping' && !reading
          ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          : { overflowY: 'auto' }) }}>
          {/* ── Step 1: 파일 업로드 ── 구성은 SCR-07 Step 1과 같다: 경고 줄 → 입력(크래들 ↔ 드롭존) → 요약 카드 → 목록 */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* [v4.8] 업로드에서 걸러진 파일 — 크래들 「인식 안 됨」 안내와 같은 자리·같은 말투 */}
              {uploadErrors.length > 0 && (
                <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', padding: '0 4px', lineHeight: 1.7 }}>
                  ⚠ 파일 {uploadErrors.length}개를 올리지 못했습니다.
                  <span style={{ fontWeight: 600, color: '#B45309' }}> 아래 사유를 확인하고 다시 올려 주세요.</span>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontWeight: 600, color: '#B91C1C', fontSize: 'var(--neo-font-size-xs)' }}>
                    {uploadErrors.map((er, i) => (<li key={`${er.name}-${i}`}><strong>{er.name}</strong> — {er.reason}</li>))}
                  </ul>
                </div>
              )}

              {/* 드롭존 */}
              <div style={{ ...sectionCard, borderStyle: 'dashed', borderColor: '#93C5FD', background: '#F0F9FF', padding: '28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFilesAdd(e.dataTransfer.files); }}>
                <span style={{ fontSize: '2rem' }}>📁</span>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E3A8A' }}>스캔 파일을 끌어놓거나 선택하세요</div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
                  PDF · PNG · JPG · {MAX_FILE_MB}MB 이하 · <strong>파일명·순서 무관</strong>
                </div>
                <label style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
                  파일 선택
                  <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
                    /* [v4.6] 초기화 후 같은 파일을 다시 골라도 onChange가 뜨도록 값을 비운다 */
                    onChange={(e) => { handleFilesAdd(e.target.files); e.target.value = ''; }} />
                </label>
              </div>

              {/* 요약 카드 — SCR-07 「거치 n/30 · 연결 완료 n」 자리 */}
              <div style={{ ...sectionCard, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>
                  업로드 <span style={{ color: '#2A75F3' }}>{files.length}개</span>
                  {files.length > 0 && (
                    <>
                      <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                      이미지 <span style={{ color: '#10B981' }}>{kindCount('image')}</span>
                      <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                      PDF <span style={{ color: '#10B981' }}>{kindCount('pdf')}</span>
                    </>
                  )}
                  {uploadErrors.length > 0 && (
                    <>
                      <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                      올리지 못함 <span style={{ color: '#DC2626' }}>{uploadErrors.length}개</span>
                    </>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={injectMockFiles} style={{ ...ghostBtn, padding: '7px 14px' }}>🧪 데모 파일</button>
                  <button onClick={resetUploads} disabled={!files.length}
                    style={{ ...ghostBtn, padding: '7px 14px', opacity: files.length ? 1 : 0.45, cursor: files.length ? 'pointer' : 'not-allowed' }}>전체 삭제</button>
                </div>
              </div>

              <div style={sectionCard}>
                <h3 style={{ margin: '0 0 10px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>
                  업로드된 파일 <span style={{ color: '#2A75F3' }}>{files.length}개</span>
                </h3>
                {files.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>
                    올린 파일이 없습니다. 위에서 스캔 파일을 선택해 주세요.
                  </div>
                ) : (
                  /* [v4.3] 한 줄에 하나씩 쌓지 않고 그리드로 흘린다 */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {files.map((f) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 7, fontSize: 'var(--neo-font-size-xs)', minWidth: 0 }}>
                        <span>{f.kind === 'image' ? '🖼' : f.kind === 'pdf' ? '📕' : '📄'}</span>
                        <span style={{ fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }} title={`${f.name} · ${(f.size / 1024).toFixed(0)} KB`}>{f.name}</span>
                        <button onClick={() => setPreviewFileId(f.id)} title="미리보기" style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', padding: 0, fontSize: 'var(--neo-font-size-xs)' }}>👁</button>
                        <button onClick={() => handleRemoveFile(f.id)} title="삭제" style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, fontSize: 'var(--neo-font-size-xs)' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* [v4.2] 舊 1단 게이트(대상 학생 확인) 폐기 — 사전 선택 없이 전원 판별, 고지만 남긴다 */}
              {answerStudents.length > 0 && (
                <div style={{ ...sectionCard, borderColor: '#FDBA74', background: '#FFF7ED' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#9A3412' }}>
                    📄 이미 답안이 있는 학생 {answerStudents.length}명이 포함되어 있습니다
                  </h3>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', lineHeight: 1.6, marginBottom: 8 }}>
                    스캔본이 있으면 스캔본으로 채점하고, 기존 답안은 미분류에 남아 채점 전까지 되돌릴 수 있습니다.
                    교체한 건에 한해 채점 시작 시 한 번 더 확인하며, 기존 답안은 이력에 보관됩니다.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {answerStudents.map((s) => (
                      <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'white', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)' }}>
                        <span style={{ fontWeight: 700, color: '#1E293B' }}>{s.name}</span>
                        <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>{s.grade || s.class || ''}</span>
                        <span style={{ padding: '1px 8px', borderRadius: 999, background: '#EBF2FF', color: '#2A75F3', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>답안 있음</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: 데이터 매핑 · 읽는 중 ── SCR-07 v1.8과 같은 무한 프로그레스 + 순환 타이틀 */}
          {step === 'mapping' && reading && (
            <div style={{ ...sectionCard, padding: '48px 24px' }}>
              <style>{`@keyframes scanReadSlide { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
              <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>답안지를 읽고 있습니다.</div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 6 }}>
                  올린 <strong>{files.length}개</strong> 파일의 답안지를 확인합니다.
                </div>
                <div style={{ position: 'relative', height: 8, margin: '22px 0 12px', borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999,
                    background: 'linear-gradient(90deg, rgba(42,117,243,0.15), #2A75F3, rgba(42,117,243,0.15))',
                    animation: 'scanReadSlide 1.3s ease-in-out infinite' }} />
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1D4ED8', minHeight: 22 }}>
                  {JUDGE_PHASES[readTick % JUDGE_PHASES.length].label}
                  <span style={{ color: '#94A3B8', fontWeight: 400 }}> 처리 중…</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: 데이터 매핑 · 결과 ── */}
          {/* [v4.2] 「학생 × 문항」 마스터/디테일.
              [v4.8] SCR-07과 같은 배치 — 왼쪽 = 요약 카운트 + 목록(상태 배지 · 상세 내용), 오른쪽 = 고른 학생의 답안지.
                     舊 두 열 위의 가로 요약 바는 왼쪽 열 안으로 넣었다(오른쪽 높이를 잡아먹지 않게).
              상세 카드는 「OCR이 읽은 값(회색·수정 불가)」과 「연결 결과(파랑)」를 나눠 놓는다. */}
          {step === 'mapping' && !reading && (() => {
            const trayKey = 'unassigned';
            // 기본 선택 — 조치가 필요한 곳부터. 미분류 > 문제 있는 학생 > 첫 학생
            // [v4.9] 결석생(제외)은 조치 대상이 아니므로 기본 선택에서 뺀다
            const firstBad = needsCheckStudents[0];
            const activeKey = selectedKey
              ?? (unassigned.length > 0 ? trayKey : (firstBad?.id ?? targetStudents[0]?.id ?? null));
            const activeStudent = activeKey === trayKey ? null : targetStudents.find((s) => s.id === activeKey);

            // 한 파일의 편집 카드 — 좌: OCR 읽은 값 / 우: 연결 지정
            /**
             * [v4.10] 답안지 작업 공통 메뉴.
             * 구역 순서는 ① 파일 업로드 ② 연결 해제 ③ 미분류 파일 — 자주 쓰는 두 동작을 위로 올리고,
             * 길이가 들쭉날쭉한 미분류 목록을 맨 아래로 내려 버튼 위치가 흔들리지 않게 한다.
             * 팝오버는 **body로 포털**한다. 문항 카드·우측 패널이 overflow를 자르기 때문에
             * 카드 안에 그리면 내용이 잘려 보인다.
             */
            const slotMenu = ({ menuKey, label, row, sl, sheetNo, width, align }) => {
              const inputId = `scan-file-${menuKey}`;
              /* [v4.7] 기존 답안은 **제 자리로만** 돌아간다 — 다른 학생·문항에 붙일 수 있으면
               * 「A 학생의 기존 답안이 B 학생 답안으로 채점되는」 사고가 난다. 목록에서 뺀다.
               * 되돌리기는 미분류 트레이 카드의 [↩ 되돌리기]가 전담한다. */
              const pool = unassigned.filter((u) => u.origin !== 'existing' && (!row || u.fileId !== row.fileId));
              const open = openMenu && openMenu.key === menuKey;
              const close = () => setOpenMenu(null);
              const itemStyle = {
                display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6,
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--neo-font-size-xs)', color: '#1E293B',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              };
              const dashed = { borderTop: '1px dashed #CBD5E1', margin: '6px 2px' };
              return (
                <span style={{ position: 'relative', display: 'inline-block', width: width || '100%' }}>
                  <button
                    onClick={(e) => {
                      if (open) { close(); return; }
                      const b = e.currentTarget.getBoundingClientRect();
                      setOpenMenu({
                        key: menuKey,
                        top: b.bottom + 4,
                        left: b.left,
                        right: window.innerWidth - b.right,
                      });
                    }}
                    aria-label={row ? `${row.fileName} 답안지 작업` : `${sl.student.name} ${sl.question.title} 답안지 지정`}
                    style={{
                      width: '100%', height: row ? 22 : 26, padding: row ? 0 : '0 8px',
                      textAlign: row ? 'center' : 'left',
                      border: `1px solid ${row ? '#E2E8F0' : '#F59E0B'}`, borderRadius: 6,
                      background: open ? '#F1F5F9' : 'white',
                      color: row ? '#64748B' : '#92400E',
                      fontSize: 'var(--neo-font-size-xs)', fontWeight: row ? 800 : 700, cursor: 'pointer',
                    }}>
                    {label}
                  </button>

                  {open && createPortal(
                    <>
                      {/* 바깥을 누르면 닫힌다 */}
                      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9710 }} />
                      <div style={{
                        position: 'fixed', top: openMenu.top,
                        ...(align === 'left' ? { left: openMenu.left } : { right: openMenu.right }),
                        zIndex: 9720, width: 220, maxHeight: '46vh', overflowY: 'auto',
                        background: 'white', border: '1px solid #CBD5E1', borderRadius: 10, padding: 6,
                        boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
                      }}>
                        {/* ① 파일 업로드 */}
                        <button onClick={() => { const el = document.getElementById(inputId); if (el) el.click(); close(); }}
                          style={{ ...itemStyle, background: '#F59E0B', color: 'white', fontWeight: 800, textAlign: 'center' }}>
                          ⬆ 파일 업로드
                        </button>

                        {/* ② 연결 해제 — [v4.7] 기존 답안도 미분류로 내려갈 수 있다.
                            내려가도 사라지지 않고 트레이에서 [↩ 되돌리기]로 제자리에 돌아온다. */}
                        {row && (
                          <>
                            <div style={dashed} />
                            <button onClick={() => { updateAssign(row.fileId, { studentId: null, questionNo: null, sheetNo: null, studentInput: '' }); close(); }}
                              title={row.origin === 'existing' ? '기존 답안을 미분류로 내립니다 — 채점에서 빠지며, 트레이에서 되돌릴 수 있습니다' : undefined}
                              style={{ ...itemStyle, textAlign: 'center', border: '1px solid #FCA5A5', color: '#B91C1C', fontWeight: 800 }}>
                              ✕ 연결 해제
                            </button>
                          </>
                        )}

                        <div style={dashed} />

                        {/* ③ 미분류 파일 */}
                        <div style={{ padding: '0 8px 3px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8' }}>
                          미분류 파일 {pool.length}장
                        </div>
                        {pool.length === 0 ? (
                          <div style={{ padding: '3px 8px', fontSize: 'var(--neo-font-size-xs)', color: '#CBD5E1' }}>없음</div>
                        ) : (
                          pool.map((u) => (
                            <button key={u.fileId} title={u.fileName}
                              onClick={() => { if (row) swapSlotFile(row, u.fileId); else assignFileToSlot(u.fileId, sl, sheetNo); close(); }}
                              style={itemStyle}>
                              {u.fileName}
                            </button>
                          ))
                        )}
                      </div>
                    </>,
                    document.body,
                  )}

                  <input id={inputId} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
                    aria-label={row ? `${row.fileName} 교체 파일 선택` : `${sl.student.name} ${sl.question.title} 답안지 파일 선택`}
                    onChange={(e) => {
                      if (row) replaceByUpload(e.target.files, row);
                      else addFileToSlot(e.target.files, sl, sheetNo);
                      e.target.value = '';
                    }} />
                </span>
              );
            };
            const fileCard = (r, idx, arr) => {
              const isExisting = r.origin === 'existing';
              const multi = !isExisting && Array.isArray(arr) && arr.length > 1;
              const t = CONFIDENCE_TOKEN[r.confidence] || CONFIDENCE_TOKEN.low;
              const wrongTask = !!r.ocrSheetCode && !sheetCodeSet.has(r.ocrSheetCode);
              const picked = r.studentId != null ? targetStudents.find((s) => s.id === r.studentId) : null;
              const nameText = r.studentInput ?? studentLabel(picked);
              return (
                <div key={r.fileId} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid #F1F5F9', background: multi ? '#EFF6FF' : 'white' }}>
                    {/* 한 문항에 답안지가 여러 장이면 몇 장째인지 앞에 못박는다 */}
                    {multi && (
                      <span style={{ flex: '0 0 auto', padding: '2px 7px', borderRadius: 6, background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 900 }}>
                        {idx + 1}/{arr.length}장
                      </span>
                    )}
                    {/* [v4.4] 기존 답안은 스캔 파일이 아니라 미리보기 대상이 없다 */}
                    {!isExisting && (
                      <button onClick={() => setPreviewFileId(r.fileId)} title="답안지 미리보기" style={{ background: 'white', border: '1px solid #CBD5E1', color: '#1D4ED8', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>👁</button>
                    )}
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }} title={r.fileName}>{r.fileName}</span>
                    {/* [v4.4] 기존 답안은 판별을 거치지 않았으므로 신뢰도 배지 대신 출처를 밝힌다 */}
                    {isExisting ? (
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: '#EBF2FF', color: '#2A75F3', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, whiteSpace: 'nowrap' }}>📄 기존 답안</span>
                    ) : r.confidence === 'medium' ? (
                      <label title="확인했으면 체크하세요 — 자동 확정으로 바뀝니다"
                        style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: t.bg, border: `1px solid ${t.color}55`, color: t.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={false} onChange={() => confirmFile(r.fileId)}
                          aria-label={`${r.fileName} 확인 완료`} style={{ margin: 0, cursor: 'pointer' }} />
                        {t.dot} {t.label}
                      </label>
                    ) : (
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: t.bg, color: t.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>{t.dot} {t.label}</span>
                    )}
                    {/* 붙어 있는 장은 공통 메뉴(⋯) — 기존 답안도 같은 메뉴로 스캔본 교체가 된다 [v4.4] */}
                    {r.studentId != null && r.questionNo != null
                      ? slotMenu({ menuKey: `card-${r.fileId}`, label: '⋯', row: r, width: 26 })
                      : isExisting ? (
                        /* [v4.7] 기존 답안은 파일이 아니라 삭제 대상이 아니다. 제자리로 돌리는 것만 가능하다 */
                        <button onClick={() => restoreExisting(r)}
                          title={`${r.fileName}을 원래 문항으로 되돌립니다 — 그 자리의 스캔본은 미분류로 내려갑니다`}
                          style={{ background: 'white', border: '1px solid #2A75F3', color: '#2A75F3', borderRadius: 6, padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ↩ 되돌리기
                        </button>
                      ) : (
                        <button onClick={() => handleRemoveFile(r.fileId)} title="파일 삭제" style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>🗑</button>
                      )}
                  </div>

                  {/* [v4.3] OCR 값과 연결 값을 **같은 행에 좌우로** 놓는다.
                      각 열 안에서 이름 → 문항 순서로 세로 배치하므로, 같은 높이에 있는 것끼리
                      바로 대조된다 (왼쪽 이름 ↔ 오른쪽 이름, 왼쪽 문항 ↔ 오른쪽 문항).
                      항목명(학생·/문항·)은 열 제목으로 갈음하고 값에서는 뺐다. */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div style={{ padding: '6px 8px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>{isExisting ? '📄 제출 정보' : '🔍 OCR 판독'}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 26, display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={isExisting ? `학생이 ${r.submitPath}로 제출한 답안입니다` : (r.manual ? '교사가 직접 올린 답안지입니다 (OCR 미실행)' : `${r.ocrStudentText || ''} ${r.ocrNameText || ''}`)}>
                          {isExisting
                            ? <span style={{ color: '#1D4ED8', fontWeight: 700 }}>{r.submitPath}</span>
                            : r.manual ? <span style={{ color: '#94A3B8' }}>직접 추가 · OCR 미실행</span> : <>{r.ocrStudentText || '(인식 실패)'} {r.ocrNameText}</>}
                        </div>
                        <div style={{ height: 26, display: 'flex', alignItems: 'center' }}>
                          {isExisting
                            ? <span style={{ color: '#64748B' }}>{r.submittedAt} 제출</span>
                            : r.manual ? <span style={{ color: '#94A3B8' }}>—</span> : <>{ocrQuestionLabel(r)}{r.inferred && <span style={{ color: '#92400E', fontWeight: 700 }}> (AI 추정)</span>}</>}
                        </div>
                      </div>
                      {/* [v4.8] 미분류 사유 — 크래들 「상세 내용」과 같은 문구 */}
                      {reasonOf(r) && !isExisting
                        ? <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#DC2626', fontWeight: 800, marginTop: 3, lineHeight: 1.5 }}>⚠ {reasonOf(r)}</div>
                        : wrongTask && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#DC2626', fontWeight: 800, marginTop: 3 }}>⚠ {SCAN_REASON.other_task}</div>}
                    </div>

                    {/* [v4.2] 학생·문항 수동 지정 폐기 — 확정된 연결을 데이터로만 표시한다.
                        보정이 필요하면 공통 메뉴(⋯)의 [연결 해제] · [미분류 파일] · [파일 업로드]를 쓴다. */}
                    <div style={{ padding: '6px 8px', background: '#F5F9FF', borderLeft: '2px solid #2A75F3' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', marginBottom: 4 }}>🔗 연결 결과</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 26, display: 'flex', alignItems: 'center', fontSize: 'var(--neo-font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nameText}>
                          {picked
                            ? <span style={{ color: '#1E293B', fontWeight: 700 }}>{studentLabel(picked)}</span>
                            : isExisting
                              /* [v4.7] 교체로 내려온 것이라 「판별 실패」와 구분해 적는다 */
                              ? <span style={{ color: '#9A3412', fontWeight: 700 }}>스캔본으로 교체됨</span>
                              : <span style={{ color: '#991B1B', fontWeight: 700 }}>미분류 · 채점 제외</span>}
                        </div>
                        <div style={{ height: 26, display: 'flex', alignItems: 'center', fontSize: 'var(--neo-font-size-xs)' }}>
                          {r.questionNo != null
                            ? <span style={{ color: '#1E293B', fontWeight: 700 }}>
                                {questionOptions().find((op) => op.value === questionValueOf(r))?.label
                                  || questionList.find((q) => q.id === r.questionNo)?.title}
                              </span>
                            : isExisting
                              ? <span style={{ color: '#9A3412' }}>원래 자리 · {questionList.find((q) => q.id === r.homeQuestionNo)?.title}</span>
                              : <span style={{ color: '#94A3B8' }}>(미지정)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
                {/* 학생 이름 직접 입력 후보 (전 행 공용) */}
                <datalist id="scan-student-options">
                  {targetStudents.map((s) => (<option key={s.id} value={studentLabel(s)} />))}
                </datalist>

                {/* [v4.8] 좌우 2열이 화면 전체 높이를 나눈다 (SCR-07 v1.7). 폭은 **고정**이라 학생을 골라도 흔들리지 않는다.
                    크래들은 50:50이지만, 스캔은 우측에 문항 카드가 가로로 놓이므로 좌측을 목록 폭만큼만 잡는다. */}
                <div style={{ display: 'flex', gap: 12, minHeight: 0, flex: 1 }}>
                  <div style={{ flex: `0 0 ${LIST_W}px`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* 상태 카운트 + 업로드 매니페스트 — SCR-07 미니 크래들 아래 줄과 같은 구성 */}
                    <div style={{ ...sectionCard, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                        <span style={{ color: '#166534' }}>🟢 채점 대상 {gradableStudentIds.length}</span>
                        <span style={{ color: '#B91C1C' }} title="답안지 부족·초과 또는 문항 확인이 남은 학생 — 정리해야 채점을 시작할 수 있습니다">확인 필요 {needsCheckStudents.length}</span>
                        {/* [v4.9] 결석생 — SCR-07 「대상 아님」과 같은 회색 카운트 */}
                        <span style={{ color: '#94A3B8' }} title="올린 파일에서 답안지를 한 장도 찾지 못한 학생 — 채점에서 자연 제외됩니다">제외 {absentStudents.length}</span>
                        <span style={{ color: '#94A3B8' }} title="어느 학생·문항에도 붙지 않은 답안지 — 채점에서 제외됩니다">미분류 {unassigned.length}장</span>
                        <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 600 }}>
                          기준 {questionList.map((q) => `${q.title} ${q.sheets}장`).join(' · ')}
                        </span>
                      </div>
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 6, marginTop: 8, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.6 }}>
                        채점을 시작하면 <strong style={{ color: '#166534' }}>채점 대상 {gradableStudentIds.length}명(문항 {gradableSlots.length}건)</strong>의 답안지만 서버로 올라갑니다.
                        {unassigned.length > 0 && <> 미분류 {unassigned.length}장은 올리지 않습니다.</>}
                      </div>
                    </div>

                    {/* 학생 목록 — SCR-07 펜 목록과 같은 열 규칙: 식별 → 상태 배지 → 상세 내용 */}
                    <div style={{ ...sectionCard, flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                        <span style={{ width: NAME_W }}>학생</span>
                        <span style={{ display: 'flex', gap: 4, marginRight: 12 }}>
                          {questionList.map((q) => (
                            <span key={q.id} style={{ width: SLOT_CELL_W, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {q.title.replace(/\s+/g, '')}<span style={{ color: '#2A75F3' }}>({q.sheets}장)</span>
                            </span>
                          ))}
                        </span>
                        <span style={{ width: 80 }}>데이터 상태</span>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* 미분류 트레이 */}
                        {unassigned.length > 0 && (() => {
                          const on = activeKey === trayKey;
                          const detail = ['채점 제외 —',
                            [unassignedScans.length ? `미연결 스캔 ${unassignedScans.length}장` : null,
                              replacedExistings.length ? `교체된 기존 답안 ${replacedExistings.length}건` : null].filter(Boolean).join(' · ')].join(' ');
                          return (
                            <div role="button" tabIndex={0} onClick={() => setSelectedKey(trayKey)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(trayKey); } }}
                              style={{ padding: '9px 12px 9px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                                background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ width: NAME_W, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#991B1B', whiteSpace: 'nowrap' }}>🔴 미분류</span>
                              <span style={{ display: 'flex', gap: 4, marginRight: 12 }}>
                                <span style={{ width: questionList.length * SLOT_CELL_W + (questionList.length - 1) * 4, padding: '2px 0', textAlign: 'center', borderRadius: 5,
                                  fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                                  {unassigned.length}장
                                </span>
                              </span>
                              <span style={{ width: 80 }}>
                                <span style={{ padding: '1px 8px', borderRadius: 999, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>미분류</span>
                              </span>
                              </div>
                              <div style={{ marginTop: 3, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.5 }}>{detail}</div>
                            </div>
                          );
                        })()}

                        {targetStudents.map((s) => {
                          const on = activeKey === s.id;
                          const d = studentDetail(s);
                          const bt = ROW_BADGE[d.badge];
                          return (
                            <div key={s.id} role="button" tabIndex={0} onClick={() => setSelectedKey(s.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(s.id); } }}
                              title={d.issues.length > 1 ? d.issues.join('\n') : undefined}
                              style={{ padding: '9px 12px 9px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                                /* SCR-07 v1.6 — 행 전체를 물들이지 않는다. 상태는 배지·칩 색으로만 읽는다 */
                                background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                              {/* 이름 + 학년-반-번호 (SCR-07 표기 1-1-12) */}
                              <span style={{ width: NAME_W, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B' }}>{s.name}</span>
                                <span style={{ marginLeft: 6, fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>{studentNo(s)}</span>
                              </span>
                              <span style={{ display: 'flex', gap: 4, marginRight: 12 }}>
                                {questionList.map((q) => {
                                  const sl = slotIndex[slotKey(s.id, q.id)];
                                  const st = slotStatus(sl);
                                  const tok = SLOT_TOKEN[st];
                                  const ow = slotReplacedExisting(sl);
                                  const check = slotNeedsCheck(sl) || st !== 'ok';
                                  // [v4.9] 결석생은 칩을 강조하지 않고 「—」로 조용히 둔다 (제외 대상이지 조치 대상이 아니다)
                                  if (absentIdSet.has(s.id)) {
                                    return (
                                      <span key={q.id} style={{ width: SLOT_CELL_W, padding: '2px 0', textAlign: 'center', borderRadius: 5, boxSizing: 'border-box',
                                        fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#CBD5E1' }}>—</span>
                                    );
                                  }
                                  // 정상은 ✓로 조용히, 이상(답안지 초과·부족)만 글자로 드러낸다
                                  return (
                                    <span key={q.id}
                                      style={{
                                        width: SLOT_CELL_W, padding: '2px 0', textAlign: 'center', borderRadius: 5, boxSizing: 'border-box',
                                        fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
                                        background: st === 'ok' ? (ow ? '#FFF7ED' : '#F8FAFC') : tok.bg,
                                        border: check ? '2px solid #F59E0B' : `1px solid ${st === 'ok' ? (ow ? '#FDBA74' : '#E2E8F0') : tok.border}`,
                                        color: st === 'ok' ? (ow ? '#9A3412' : '#94A3B8') : tok.color,
                                      }}>
                                      {st === 'ok' ? (ow ? '🔄' : '✓') : tok.label}
                                    </span>
                                  );
                                })}
                              </span>
                              <span style={{ width: 80 }}>
                                <span style={{ padding: '1px 8px', borderRadius: 999, background: bt.bg, border: `1px solid ${bt.border}`, color: bt.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>{bt.label}</span>
                              </span>
                              </div>
                              {/* 상세 내용 — SCR-07 「상세 내용」 열. 열이 많아 행 아랫줄에 둔다 */}
                              <div style={{ marginTop: 3, fontSize: 'var(--neo-font-size-xs)', color: d.badge === 'normal' ? '#166534' : bt.color, lineHeight: 1.5 }}>{d.text}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── 우: 상세 ── */}
                  <div style={{ flex: '1 1 0', background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    {activeKey === trayKey ? (
                      <>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', background: '#FEF2F2' }}>
                          <strong style={{ fontSize: 'var(--neo-font-size-base)', color: '#991B1B' }}>🔴 미분류 {unassigned.length}건</strong>
                          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#991B1B', marginTop: 2 }}>
                            어느 문항에도 붙어 있지 않아 <strong>채점되지 않습니다.</strong> 아래 두 묶음은 성격이 다릅니다.
                          </div>
                        </div>
                        {/* [v4.7] 문항 상세와 같은 열 수·같은 카드 크기로 깔되, **성격이 다른 두 묶음**을 나눠 놓는다.
                            섞어 두면 교체된 기존 답안이 「판별 실패」로 읽혀 교사가 잘못 지정한다. */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {[
                            { key: 'scan', rows: unassignedScans, title: `🔴 미연결 스캔 ${unassignedScans.length}장`, color: '#991B1B',
                              desc: '학생·문항을 판별하지 못했거나, 기존 답안을 되돌리면서 자리에서 내려온 스캔입니다. [👁]로 확인한 뒤 해당 문항의 빈 자리에서 지정해 주세요.' },
                            { key: 'exist', rows: replacedExistings, title: `📄 교체된 기존 답안 ${replacedExistings.length}건`, color: '#9A3412',
                              desc: '스캔본이 그 자리를 대신하고 있습니다. 학생이 낸 답안으로 채점하려면 [↩ 되돌리기]를 누르세요 — 그 자리의 스캔본이 대신 여기로 내려옵니다.' },
                          ].filter((g) => g.rows.length > 0).map((g) => (
                            <div key={g.key}>
                              <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: g.color }}>{g.title}</div>
                              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '2px 0 8px', lineHeight: 1.6 }}>{g.desc}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(questionList.length, 3)}, minmax(0, 1fr))`, gap: 10, alignItems: 'start' }}>
                                {g.rows.map(fileCard)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : activeStudent ? (
                      <>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B' }}>{activeStudent.name}</strong>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{activeStudent.grade || ''}</span>
                          {isAnswerStudent(activeStudent) && (
                            <span style={{ padding: '1px 8px', borderRadius: 999, background: '#EBF2FF', color: '#2A75F3', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>답안 있음</span>
                          )}
                        </div>
                        {/* [v4.8] 할 일 안내 — SCR-07 우측 뷰어 상단 안내(noteBox)와 같은 자리·같은 말투 */}
                        {(() => {
                          const d = studentDetail(activeStudent);
                          const sls = questionList.map((q) => slotIndex[slotKey(activeStudent.id, q.id)]);
                          const box = (tone, text) => {
                            const t = { muted: { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' }, warn: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' }, info: { bg: '#FFF7ED', color: '#9A3412', border: '#FDBA74' } }[tone];
                            return <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg, color: t.color, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.7 }}>{text}</div>;
                          };
                          // [v4.9] 결석생 — 막지 않고 제외된다는 사실과, 채점하려면 무엇을 하면 되는지만 알린다
                          if (absentIdSet.has(activeStudent.id)) return box('muted', '이 학생은 채점에서 제외됩니다 — 올린 파일에서 답안지를 한 장도 찾지 못했습니다. 채점하려면 왼쪽 [🔴 미분류]에서 이 학생의 답안지를 지정하거나, 아래 빈 자리에서 파일을 올려 주세요. 한 장이라도 붙이면 나머지 문항도 채워야 채점을 시작할 수 있습니다.');
                          const lines = [];
                          if (sls.some((sl) => slotStatus(sl) !== 'ok')) lines.push('답안지 장수가 기준과 맞지 않습니다. 빈 자리의 [＋ 답안지 지정…]으로 답안지를 붙이고, 남는 장은 [⋯ → 연결 해제]로 내려 주세요.');
                          if (sls.some(slotNeedsCheck)) lines.push('문항 번호를 읽지 못해 AI가 내용으로 추정한 답안지가 있습니다. [👁]로 확인하고 [🟡 확인 필요]를 체크해 주세요.');
                          if (lines.length) return box('warn', lines.map((l) => <div key={l}>{l}</div>));
                          if (d.text.startsWith('기존 답안 교체')) return box('info', '🔄 학생이 이미 낸 답안 대신 스캔본으로 채점됩니다. 기존 답안으로 채점하려면 왼쪽 [🔴 미분류]에서 [↩ 되돌리기]를 누르세요.');
                          return null;
                        })()}

                        {/* [v4.2] 문항을 **가로로** 나란히 놓는다. 문항은 보통 3개 이하이므로
                            폭을 n등분하면 한 학생의 전 문항을 스크롤 없이 한눈에 비교할 수 있다.
                            4개 이상이면 3열을 유지한 채 다음 줄로 넘어간다. */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(questionList.length, 3)}, minmax(0, 1fr))`, gap: 10, alignItems: 'start' }}>
                          {questionList.map((q) => {
                            const sl = slotIndex[slotKey(activeStudent.id, q.id)];
                            const st = slotStatus(sl);
                            const tok = SLOT_TOKEN[st];
                            const ow = slotReplacedExisting(sl);
                            const check = !absentIdSet.has(activeStudent.id) && (slotNeedsCheck(sl) || st !== 'ok'); // [v4.9] 결석생은 강조하지 않는다
                            // 비어 있는 장 번호 — 이미 붙은 장을 빼고 앞에서부터, 모자란 수만큼만
                            const taken = new Set(sl.files.map((f) => f.sheetNo).filter((n) => n != null));
                            const emptySheets = [];
                            // [v4.4] 기존 답안은 「장」 개념이 없으므로 빈 장 자리를 만들지 않는다
                            if (!slotHasExisting(sl)) {
                              for (let pg = 1; pg <= q.sheets && emptySheets.length < q.sheets - sl.files.length; pg += 1) {
                                if (!taken.has(pg)) emptySheets.push(pg);
                              }
                            }
                            return (
                              <div key={q.id} style={{ border: check ? '2px solid #F59E0B' : '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#FCFDFF' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>{q.title}</strong>
                                  {/* 정상이면 배지를 달지 않는다 — 손볼 곳만 눈에 띄게 */}
                                  {st !== 'ok' && (
                                    <span style={{ padding: '1px 8px', borderRadius: 999, background: tok.bg, border: `1px solid ${tok.border}`, color: tok.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                                      {/* [v4.6] 0장도 `부족 0/2장`으로 장수를 밝힌다 —
                                          舊 `미지정`은 배지만 달고 기준 장수를 숨겼다 */}
                                      {tok.label} {sl.files.length}/{q.sheets}장
                                    </span>
                                  )}
                                  {/* [v4.4] 舊 `기존 답안 교체` 칩 폐기 — 기존 답안이 카드로 직접 보이므로
                                      상태는 카드가 말한다. 여기서는 **교체가 끝난 뒤에만** 결과를 알린다. */}
                                  {ow && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, background: '#FFF7ED', border: '1px solid #FDBA74', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#C2410C' }}
                                      title="기존 답안을 스캔본으로 교체했습니다. 채점 시작 시 한 번 더 확인합니다.">
                                      🔄 교체됨
                                    </span>
                                  )}
                                </div>

                                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {sl.files.map(fileCard)}
                                  {/* 기준 장수에 못 미치면 비어 있는 장을 카드 자리로 남겨 둔다.
                                      「몇 장째가 비었나」가 눈에 보이고, 그 자리에서 바로 미분류를 끌어올 수 있다.
                                      0장은 이 빈칸이 기준 장수만큼 생기는 경우일 뿐이다. */}
                                  {emptySheets.map((page) => (
                                    <div key={`empty-${page}`} style={{ padding: '10px', border: '1px dashed #F59E0B', borderRadius: 10, background: '#FFFBEB' }}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={(e) => { e.preventDefault(); addFileToSlot(e.dataTransfer.files, sl, q.sheets > 1 ? page : null); }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        {q.sheets > 1 && (
                                          <span style={{ padding: '2px 7px', borderRadius: 6, background: '#FDE68A', color: '#92400E', fontSize: 'var(--neo-font-size-xs)', fontWeight: 900 }}>
                                            {page}/{q.sheets}장
                                          </span>
                                        )}
                                        <span style={{ padding: '1px 8px', borderRadius: 999, background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                                          확인 필요
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#92400E', marginBottom: 6 }}>
                                        답안지 없음 · 채점 대상 제외
                                      </div>
                                      {/* 붙은 장과 같은 공통 메뉴 — 파일 업로드 / 미분류 파일 구역이 나뉘어 보인다 */}
                                      {slotMenu({
                                        menuKey: `empty-${sl.key}-${page}`,
                                        label: '＋ 답안지 지정…',
                                        align: 'left',
                                        sl,
                                        sheetNo: q.sheets > 1 ? page : null,
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>
                        왼쪽에서 학생을 선택하면<br />그 학생의 답안지를 문항별로 볼 수 있습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* [v4.8] 舊 하단 「덮어쓰기 안내」 배너 폐기 — 교체 사실은 학생 행 상세 내용 · 우측 안내 · 채점 직전 확인 창이 말한다
                    (SCR-07 v2.8이 배너를 툴팁으로 옮긴 것과 같은 이유: 오른쪽 답안지 높이를 잡아먹지 않게) */}
              </div>
            );
          })()}

          {/* ── Step 3: 채점 ── SCR-07과 같은 구성 */}
          {step === 'grading' && (
            <div style={{ ...sectionCard, textAlign: 'center', padding: '48px 24px' }}>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 56, height: 56, margin: '0 auto 16px', border: '5px solid #DBEAFE', borderTopColor: '#2A75F3', borderRadius: '50%', animation: gradingFinished ? 'none' : 'spin 1s linear infinite', background: gradingFinished ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {gradingFinished && <span style={{ color: 'white', fontSize: 24, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 6 }}>{gradingFinished ? '채점이 완료되었습니다.' : 'AI가 채점하고 있어요.'}</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 18 }}>
                학생 <strong style={{ color: '#2A75F3' }}>{gradedStudentIds.length}명</strong> · 문항 <strong style={{ color: '#2A75F3' }}>{gradableSlots.length}건</strong>을 채점 중입니다.
                {replacedCount > 0 && <> (기존 답안 교체 <strong style={{ color: '#C2410C' }}>{replacedCount}건</strong> 포함)</>}
              </div>
              <div style={{ width: '80%', margin: '0 auto', height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${gradingProgress}%`, height: '100%', background: '#2A75F3', transition: 'width 0.2s' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{gradingProgress}%</div>

              {/* [v4.8] 시간차 안내 — SCR-07 v2.9와 같은 문구 */}
              {!gradingFinished && gradingElapsed >= 6 && (
                <div style={{ maxWidth: 560, margin: '18px auto 0', padding: '12px 16px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <span style={{ fontSize: '1.4rem' }}>☕</span>
                  <span style={{ flex: 1 }}>
                    <strong>기다리지 않으셔도 됩니다.</strong> 창을 닫아도 채점은 계속 진행되고, 끝나면 하단 알림으로 알려 드립니다.
                  </span>
                  <button type="button" onClick={() => onMinimize?.({ finished: false })}
                    style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    창 닫고 다른 작업 하기
                  </button>
                </div>
              )}

              {/* [v4.8] 학생별 진행 — SCR-07 펜별 상태 전이(AI 채점중 → AI 채점 완료 / 실패)와 같은 표 */}
              <div style={{ maxWidth: 720, margin: '22px auto 0', textAlign: 'left', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', padding: '8px 14px', background: '#F8FAFC', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                  <span style={{ width: 150 }}>학생</span>
                  <span style={{ width: 110 }}>문항</span>
                  <span style={{ flex: 1 }}>상세 내용</span>
                </div>
                <div style={{ maxHeight: 210, overflowY: 'auto' }}>
                  {gradedStudentIds.map((id) => {
                    const st = targetStudents.find((x) => x.id === id);
                    const n = gradableSlots.filter((sl) => sl.student.id === id).length;
                    const failed = failedStudentIds.includes(id);
                    const text = !gradingFinished ? 'AI 채점중' : failed ? 'AI 채점 실패 — 토큰 용량 초과' : 'AI 채점 완료';
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid #F1F5F9', fontSize: 'var(--neo-font-size-sm)' }}>
                        <span style={{ width: 150, color: '#475569' }}>{studentNo(st) === '—' ? st?.name : `${studentNo(st)} ${st?.name}`}</span>
                        <span style={{ width: 110, color: '#475569' }}>{n}/{questionList.length}문항</span>
                        <span style={{ flex: 1, color: !gradingFinished ? '#1D4ED8' : failed ? '#B91C1C' : '#047857', fontWeight: 700 }}>{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: 완료 ── SCR-07 v2.4와 같이 세 줄 — 완료 · 요약 · 다음 행동 (+ 실패 시 실패 박스) */}
          {step === 'completed' && (() => {
            const okStudents = gradedStudentIds.length - failedStudentIds.length;
            const okSlots = gradableSlots.filter((sl) => !failedStudentIds.includes(sl.student.id)).length;
            const confirmCount = fullyGradedStudentIds.filter((id) => !failedStudentIds.includes(id)).length;
            return (
              <div style={{ ...sectionCard, background: '#F0FDF4', borderColor: '#86EFAC', textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#065F46', marginBottom: 8 }}>완료</div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#047857', marginBottom: 14 }}>
                  채점 문항 <strong>{okSlots}건</strong> · 학생 <strong>{okStudents}명</strong>
                  {failedStudentIds.length > 0 && <span style={{ color: '#B91C1C' }}> · 실패 <strong>{failedStudentIds.length}명</strong></span>}
                  {replacedCount > 0 && <> (기존 답안 교체 <strong>{replacedCount}건</strong> 포함)</>}
                </div>
                {/* AI 채점 실패 — SCR-07 v2.9 · v4.22와 같은 구성(원인 · 남는 것 · 할 일) */}
                {(failedStudentIds.length > 0 || retrying) && (
                  <div style={{ maxWidth: 620, margin: '0 auto 14px', padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7, textAlign: 'left' }}>
                    {retrying ? (
                      <div>⏳ 실패한 답안을 다시 채점하고 있습니다…</div>
                    ) : (
                      <>
                        <div><strong>⚠ {failedStudentIds.length}명은 AI 채점에 실패했습니다.</strong> 답안 분량이 커서 <strong>토큰 용량을 초과</strong>했습니다(서버 응답 지연). 나머지 학생의 채점 결과는 정상 반영됐습니다.</div>
                        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'white', border: '1px solid #FECACA', color: '#475569', lineHeight: 1.7 }}>
                          실패한 <strong>{failedStudentIds.length}명</strong>은 <strong>미채점</strong>으로 자동 되돌려집니다.
                          올린 답안지는 <strong>그대로 보관</strong>되어 있어 파일을 다시 올리지 않고 이어서 채점할 수 있습니다.
                        </div>
                        <div style={{ marginTop: 4, color: '#B45309' }}>잠시 후 [다시 시도]를 누르거나, 계속 실패하면 서비스팀에 문의해 주세요.</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button type="button" onClick={retryFailed}
                            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>↻ 다시 시도</button>
                          <button type="button" onClick={() => setToast('서비스팀 문의: 1544-0000 · support@neolab.net')}
                            style={{ ...ghostBtn, padding: '6px 14px' }}>서비스팀 문의</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {partiallyGradedCount > 0 && (
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', maxWidth: 620, margin: '0 auto 10px', lineHeight: 1.6 }}>
                    ⚠ <strong>{partiallyGradedCount}명</strong>은 일부 문항만 채점되어 <strong>미채점에 남습니다.</strong> 빠진 답안지를 스캔해 다시 실행하면 이어서 채점됩니다.
                  </div>
                )}
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#065F46', background: 'white', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', display: 'inline-block' }}>
                  [확인]을 누르면 <strong>전 문항이 채점된 {confirmCount}명</strong>이 「채점 확인」 단계로 이동합니다.
                </div>
              </div>
            );
          })()}
        </div>

        {/* 푸터 — SCR-07과 같은 규칙: 왼쪽 = 지금 막힌 이유 / 오른쪽 = 이전 · 다음 */}
        <div style={{ padding: '14px 24px', background: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', minWidth: 0 }}>
            {step === 'grading' && '💡 창을 닫아도 채점은 계속 진행되며, 하단 알림으로 다시 열 수 있습니다.'}
            {step === 'upload' && files.length === 0 && '스캔 파일을 1개 이상 올려야 다음 단계로 넘어갑니다.'}
            {step === 'upload' && files.length > 0 && <span title="답안지 학생정보·문항 번호 판독에 AI OCR을 사용합니다">💡 데이터 매핑을 시작하면 올린 답안지 수만큼 <strong>AI OCR</strong>이 차감됩니다.</span>}
            {step === 'mapping' && !reading && startBlocked && <span style={{ color: '#B45309' }}>⚠ {startBlockReason}</span>}
            {/* [v4.9] 결석생 제외 고지 — SCR-07 「학생 {n}명이 채점 대상에서 제외됩니다」와 같은 문구 */}
            {step === 'mapping' && !reading && !startBlocked && absentStudents.length > 0 && (
              <span style={{ color: '#B45309' }}>⚠ 학생 {absentStudents.length}명이 채점 대상에서 제외됩니다 — 올린 파일에서 이 학생들의 답안지를 찾지 못했습니다.{unassignedScans.length > 0 && ` 미분류 답안지 ${unassignedScans.length}장도 제외됩니다.`}</span>
            )}
            {step === 'mapping' && !reading && !startBlocked && absentStudents.length === 0 && unassignedScans.length > 0 && (
              <span style={{ color: '#B45309' }}>⚠ 미분류 답안지 {unassignedScans.length}장은 채점에서 제외됩니다 — 누구의 답안인지 확인해 직접 지정해 주세요.</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {step === 'upload' && (
              <>
                <button onClick={() => onClose?.()} style={ghostBtn}>취소</button>
                <button onClick={startMatching} disabled={!files.length} style={primaryBtn(files.length > 0)}>
                  🔗 데이터 매핑 시작
                </button>
              </>
            )}
            {step === 'mapping' && !reading && (
              <>
                <button onClick={() => { resetUploads(); setStep('upload'); }}
                  title="업로드한 파일과 판별 결과를 모두 비우고 처음부터 다시 선택합니다."
                  style={ghostBtn}>← 파일 다시 선택</button>
                <button onClick={requestGrading} disabled={startBlocked} title={startBlocked ? startBlockReason : undefined}
                  style={primaryBtn(!startBlocked)}>🤖 채점 시작</button>
              </>
            )}
            {step === 'completed' && (
              <button onClick={handleConfirmComplete} style={{ padding: '9px 22px', borderRadius: 8, background: '#10B981', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer', fontFamily: 'inherit' }}>✓ 확인</button>
            )}
          </div>
        </div>
      </div>

      {/* [BRD-16] 이용불편 접수 — SCR-07과 같은 다이얼로그 */}
      <IncidentReportDialog open={incidentOpen} onClose={() => setIncidentOpen(false)} onSubmitted={handleIncidentSubmitted}
        context={{ source: '스캔 일괄 채점', school: '공주 고등학교', teacher: '김 b', teacherId: 'tch20261zim', teacherEmail: 'tch20261zim@gjhs.kr',
          task: taskTitle, group: groupLabel, studentCount: selectedStudents.length }} />

      {/* 파일 미리보기 모달 */}
      {previewFileId != null && (() => {
        const f = files.find((x) => x.id === previewFileId);
        if (!f) return null;
        const r = matchResults.find((x) => x.fileId === previewFileId);
        const t = r ? (CONFIDENCE_TOKEN[r.confidence] || CONFIDENCE_TOKEN.low) : null;
        return (
          <div onClick={(e) => { e.stopPropagation(); setPreviewFileId(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 9750, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 960, maxWidth: '94vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: '1.2rem' }}>{f.kind === 'image' ? '🖼' : f.kind === 'pdf' ? '📕' : '📄'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{(f.size / 1024).toFixed(0)} KB</span>
                      {r && <span style={{ fontFamily: 'monospace' }}>코드 {r.ocrSheetCode || '—'}</span>}
                      {r && <span>{r.ocrStudentText} {r.ocrNameText}</span>}
                      {r && <span>문항 {r.ocrQuestionNo ?? '(미기재)'}</span>}
                      {t && <span style={{ padding: '1px 8px', borderRadius: 999, background: t.bg, color: t.color, fontWeight: 700 }}>{t.dot} {t.label}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setPreviewFileId(null)} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#0F172A', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                {f.kind === 'image' && f.previewUrl && (
                  <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '74vh' }}>
                    <img src={f.previewUrl} alt={f.name} style={{ display: 'block', maxWidth: '100%', maxHeight: '74vh', borderRadius: 6 }} />
                    <div title="OCR 판독 영역 (정보 테이블)"
                      style={{ position: 'absolute', top: '6%', left: '4%', right: '4%', height: '18%', border: '2px dashed #FBBF24', background: 'rgba(251, 191, 36, 0.12)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#78350F', background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>OCR 판독 영역 (과제코드 · 학년/반/번호 · 이름 · 문항)</span>
                    </div>
                  </div>
                )}

                {f.kind === 'mock' && (
                  <div style={{ width: 620, maxWidth: '100%', background: 'white', borderRadius: 8, padding: '24px 28px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E3A8A', marginBottom: 12 }}>QiGLE</div>
                    <div style={{ border: '2px dashed #FBBF24', background: 'rgba(251, 191, 36, 0.1)', borderRadius: 4, padding: 8, marginBottom: 12 }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#78350F', fontWeight: 700, marginBottom: 6 }}>OCR 판독 영역</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-xs)' }}>
                        <tbody>
                          <tr>
                            <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700, width: 100 }}>교과/과제명</td>
                            <td colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '4px 8px' }}>{taskTitle}</td>
                            <td style={{ border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 800, color: '#1D4ED8' }}>문항 {r?.ocrQuestionNo ?? '__'} 번</td>
                          </tr>
                          <tr>
                            <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700 }}>그룹명</td>
                            <td style={{ border: '1px solid #CBD5E1', padding: '4px 8px' }}>{groupLabel}</td>
                            <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700 }}>답안지코드</td>
                            <td style={{ border: '1px solid #CBD5E1', padding: '4px 8px', fontFamily: 'monospace' }}>{r?.ocrSheetCode || taskCode}</td>
                          </tr>
                          <tr>
                            <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700 }}>학년/반/번호</td>
                            <td style={{ border: '1px solid #CBD5E1', padding: '4px 8px' }}>{r?.ocrStudentText || '(   )학년 (   )반 (   )번'}</td>
                            <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700 }}>이름</td>
                            <td style={{ border: '1px solid #CBD5E1', padding: '4px 8px' }}>{r?.ocrNameText || ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ border: '1px solid #CBD5E1', padding: '14px 12px', minHeight: 240 }}>
                      {Array.from({ length: 10 }, (_, i) => (<div key={i} style={{ height: 22, borderBottom: '1px solid #CBD5E1' }} />))}
                    </div>
                    <div style={{ marginTop: 12, textAlign: 'center', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                      · 데모 파일 mock 프리뷰. 실제 스캔본은 이미지·PDF로 렌더됩니다.
                    </div>
                  </div>
                )}

                {f.kind === 'pdf' && (
                  <div style={{ background: 'white', borderRadius: 8, padding: '48px 32px', textAlign: 'center', maxWidth: 400 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📕</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 6 }}>PDF 미리보기</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.6 }}>
                      PDF 페이지 렌더링은 <strong>준비 중</strong>입니다. 파일 자체는 채점 대상에 정상 포함됩니다.
                    </div>
                  </div>
                )}

                {!['image', 'mock', 'pdf'].includes(f.kind) && (
                  <div style={{ background: 'white', borderRadius: 8, padding: '48px 32px', textAlign: 'center', maxWidth: 400 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>❓</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>미지원 형식</div>
                  </div>
                )}
              </div>

              {/* 리뷰 단계에서는 팝업에서 바로 학생·문항 지정 */}
              {step === 'mapping' && !reading && r && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>이 답안지의 학생·문항</span>
                  <select value={r.studentId ?? ''} onChange={(e) => updateAssign(r.fileId, { studentId: e.target.value ? Number(e.target.value) : null })}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', background: 'white', minWidth: 200 }}>
                    <option value="">학생 선택</option>
                    {targetStudents.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.grade || ''})</option>))}
                  </select>
                  <select value={r.questionNo ?? ''} onChange={(e) => updateAssign(r.fileId, { questionNo: e.target.value ? Number(e.target.value) : null })}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', background: 'white', minWidth: 120 }}>
                    <option value="">문항 선택</option>
                    {questionList.map((q) => (<option key={q.id} value={q.id}>{q.title} ({questionOrder(q)}/{questionList.length}번째)</option>))}
                  </select>
                  <button onClick={() => setPreviewFileId(null)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, background: '#2A75F3', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>적용 후 닫기</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* [v4.7] 판별 직후 교체 의사 확인 — 전체 스캔으로 기존 답안이 밀려났을 때 1회.
          판별 **결과를 보여준 뒤** 묻는다. 차단이 아니라 기본값(스캔본)을 그대로 둘지 묻는 것이고,
          여기서 못 정해도 미분류 트레이에서 건별로 언제든 되돌릴 수 있다. */}
      {confirmReplace && replacedExistings.length > 0 && (
        <div onClick={(e) => { e.stopPropagation(); setConfirmReplace(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 520, maxWidth: '94vw', padding: '20px 22px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#9A3412' }}>🔄 이미 답안이 있는 학생이 있습니다</h3>
            {/* 건수가 아니라 **학생 수**로 센다 — 교사가 판단하는 단위는 「누구의 답안을 바꾸나」다 */}
            <p style={{ margin: '0 0 12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7 }}>
              스캔본 내용 중 <strong style={{ color: '#C2410C' }}>{replacedStudentNames.length}명</strong>의 학생이 이미 제출한 답안파일이 있습니다.
            </p>
            <div style={{ padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', marginBottom: 14, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
              대상 : {replacedStudentNames.join(', ')}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7 }}>
              어느 쪽을 선택해도 나머지 답안은 <strong>미분류로 남아</strong> 채점 전까지 변경할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => { restoreAllExisting(); setConfirmReplace(false); }}
                style={{ padding: '9px 16px', borderRadius: 8, background: 'white', border: '1px solid #CBD5E1', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                기존 답안으로 채점
              </button>
              <button onClick={() => setConfirmReplace(false)}
                style={{ padding: '9px 16px', borderRadius: 8, background: '#EA580C', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                스캔파일로 교체
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v4.4] 실행 직전 게이트 — 교체한 건에 대해서만 확인 */}
      {confirmOverwrite && (
        <div onClick={(e) => { e.stopPropagation(); setConfirmOverwrite(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '94vw', padding: '20px 22px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#9A3412' }}>🔄 기존 답안을 교체합니다</h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7 }}>
              학생이 제출한 답안 <strong style={{ color: '#C2410C' }}>{replacedCount}건</strong>이 스캔본으로 교체됩니다.<br />
              기존 답안은 이력에 보관되며 복원할 수 있습니다.<br />
              계속하시겠습니까?
            </p>
            <div style={{ padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', marginBottom: 14, lineHeight: 1.6 }}>
              교체 대상: {gradableSlots.filter(slotReplacedExisting).map((sl) => `${sl.student.name} ${sl.question.title}`).join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmOverwrite(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>취소</button>
              <button onClick={startGrading} style={{ padding: '8px 18px', borderRadius: 8, background: '#EA580C', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>덮어쓰고 채점 시작</button>
            </div>
          </div>
        </div>
      )}

      {/* 닫기 확인 — 매핑 단계에서만. [v4.8] SCR-07과 같은 제목·버튼 */}
      {confirmClose && (
        <div onClick={(e) => { e.stopPropagation(); setConfirmClose(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 460, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>매핑을 취소하고 닫을까요?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.7 }}>
              답안지 판별 결과와 직접 지정한 내용이 모두 사라집니다.
              <strong style={{ color: '#1E2225' }}> 다시 채점하려면 스캔 파일을 다시 올려야 합니다.</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClose(false)} style={ghostBtn}>계속 매핑하기</button>
              <button onClick={forceClose} style={{ ...primaryBtn(true), background: '#EF4444' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default ScanGradingModal;
