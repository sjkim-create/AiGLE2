/**
 * BatchGradingUnified.jsx
 * [채점 관리 › 일괄 채점 통합] 크래들 · 스캔 일괄 채점을 **한 화면 구조**로 묶은 시안
 *
 * 목적: 개발 요청 — 「크래들과 스캔은 데이터를 가져오는 1단계만 다르고, 데이터 매핑부터는 같은 구조로 가자」.
 *   · 공통 틀   : 헤더 · 단계 표시 · 읽는 중 화면 · 매핑 3단(학생 목록 / 상세 / 미리보기) · 채점 중 · 완료 · 실패 재시도
 *   · 입력 방식별: 1단계 화면(크래들 거치·펌웨어 ↔ 파일 업로드·PDF 페이지 분리)
 *                 매핑 상단 띠(크래들 = **미니 크래들 에뮬레이터** ↔ 스캔 = 업로드 요약)
 *                 상세 패널 조작 · 오류 규칙(그룹 불일치 · 중복 · 장수 부족/초과 …)은 각자의 특색을 유지한다
 *
 * 기존 SCR-05(ScanGradingModal) · SCR-07(CradleGradingModal)은 건드리지 않는다. 이 화면은 비교·검토용 별도 메뉴다.
 * 판정 문구는 SCR-05 v4.13 · SCR-07 판정 규칙과 같은 말을 쓴다.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import IncidentReportDialog from './IncidentReportDialog';
import { openPdf, renderPages, splitErrorReason } from './lib/pdfSplit';

/* ─────────────── 공통 목 데이터 ─────────────── */
const TASK = { team: '미래혁신융합인재육성 프로젝트팀', title: '[국어] 작품의 주제와 인물의 심리 변화 분석하기', group: '1학년 1반', groupShort: '1-1반' };
const QUESTIONS = [
  { id: 1, title: '문항 1', sheets: 2 },
  { id: 2, title: '문항 2', sheets: 1 },
  { id: 3, title: '문항 3', sheets: 1 },
];
const NAMES = ['김민지', '이서준', '박하은', '최도윤', '정서연', '강지호', '조유나', '윤시우', '장하린', '임준서', '한지아', '오건우', '서예린', '신도현'];
const ROSTER = NAMES.map((name, i) => ({ id: `s${i + 1}`, name, no: `1-1-${i + 1}`, grade: `1학년 1반 ${i + 1}번`, hasAnswer: i === 3 || i === 10 }));
const studentById = (id) => ROSTER.find((s) => s.id === id);

const IDENT_UNREAD = '학생 미매칭 — 답안지 학생정보를 읽을 수 없습니다';
const NOT_IN_ROSTER = (read) => `학생 미매칭 — 답안지 학생정보의 학생이 명단에 없습니다 [읽음: ${read}]`;

const BADGE = {
  ok: { label: '정상', bg: '#F0FDF4', border: '#86EFAC', color: '#166534', dot: '#22C55E' },
  check: { label: '확인 필요', bg: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C', dot: '#EF4444' },
  answer: { label: '기존 답안', bg: '#ECFEFF', border: '#A5F3FC', color: '#0E7490', dot: '#06B6D4' },
  none: { label: '제외', bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B', dot: '#CBD5E1' },
};

const STEPS = [
  { key: 'import', cradle: '크래들 연결', scan: '파일 업로드', icon: { cradle: '🔌', scan: '📁' } },
  { key: 'mapping', cradle: '데이터 매핑', scan: '데이터 매핑', icon: { cradle: '🔗', scan: '🔗' } },
  { key: 'grading', cradle: 'AI 일괄 채점', scan: 'AI 일괄 채점', icon: { cradle: '🤖', scan: '🤖' } },
  { key: 'done', cradle: '완료', scan: '완료', icon: { cradle: '✓', scan: '✓' } },
];
const READ_PHASES = {
  cradle: ['북코드 대조', '학생정보 판독', '중복 검사'],
  scan: ['답안지 코드 대조', '학생정보 판독', '문항 번호 판독', '장수 검사'],
};

/* ─────────────── 크래들 목 데이터 ─────────────── */
const CRADLES = 3;
const SLOTS = 10;
const cradleOf = (slot) => Math.ceil(slot / SLOTS);
const slotIn = (slot) => ((slot - 1) % SLOTS) + 1;
const slotShort = (slot) => `${cradleOf(slot)}-${slotIn(slot)}`;
const fullPages = () => ({ 1: 2, 2: 1, 3: 1 });

/** 펜 재고 — 교실에서 실제로 겪는 경우를 섞는다 (SCR-07 판정 규칙의 조건들) */
const buildPens = () => {
  const pens = [];
  const add = (p) => pens.push({
    id: `PEN-${String(pens.length + 1).padStart(3, '0')}`, slot: pens.length + 1,
    battery: [92, 85, 74, 61, 88, 57, 96, 43, 79, 68][pens.length % 10],
    firmware: pens.length === 2 ? '2.0.5' : '2.1.0', needsUpdate: pens.length === 2,
    flaky: pens.length === 7, pages: {}, ...p,
  });
  ROSTER.forEach((s, i) => {
    if (i === 5) return;                                                      // 결석 — 펜 없음
    if (i === 1) return add({ scenario: 'no_ident', owner: s.id, pages: fullPages() });
    if (i === 3) return add({ scenario: 'ok', owner: s.id, identSid: ROSTER[4].id, pages: fullPages() }); // 친구 답안지에 씀 → 중복
    if (i === 8) return add({ scenario: 'no_answer', owner: s.id, identSid: s.id, pages: {} });
    return add({ scenario: 'ok', owner: s.id, identSid: s.id, pages: fullPages() });
  });
  add({ scenario: 'other_group', pages: fullPages(), detected: '1-2반', ownerLabel: '1학년 2반 4번 한서윤' });
  add({ scenario: 'not_in_roster', pages: fullPages(), read: '1학년 1반 31번 오세훈' });
  add({ scenario: 'empty', pages: {} });
  add({ scenario: 'empty', pages: {} });
  return pens;
};
const PEN_POOL = buildPens();
const penPageCount = (p) => Object.values(p.pages).reduce((a, n) => a + n, 0);

/* ─────────────── 스캔 목 데이터 ─────────────── */
const buildScanPlan = () => {
  const plan = [];
  ROSTER.forEach((s, i) => {
    if (i === 5) return;                           // 결석생 — 한 장도 없음 → 제외
    QUESTIONS.forEach((q) => {
      let need = q.sheets;
      if (i === 0 && q.id === 2) need += 1;        // 답안지 초과(중복 스캔)
      if (i === 1 && q.id === 1) need -= 1;        // 답안지 부족
      for (let p = 1; p <= need; p += 1) plan.push({ sid: s.id, q: q.id, page: p });
    });
  });
  plan.push({ fault: 'unread' }, { fault: 'other_task' }, { fault: 'not_in_roster' });
  return plan;
};

/* ─────────────── 공용 스타일 ─────────────── */
const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12 };
const ghostBtn = { padding: '8px 16px', borderRadius: 8, background: 'white', border: '1px solid #CBD5E1', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn = (on) => ({ padding: '9px 18px', borderRadius: 8, background: on ? '#2A75F3' : '#CBD5E1', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: on ? 'pointer' : 'not-allowed', fontFamily: 'inherit' });
const pill = (b) => ({ padding: '1px 8px', borderRadius: 999, background: b.bg, border: `1px solid ${b.border}`, color: b.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' });
const noteBox = (tone) => {
  const t = { warn: ['#FEF2F2', '#991B1B', '#FECACA'], ok: ['#F0FDF4', '#166534', '#BBF7D0'], muted: ['#F8FAFC', '#475569', '#E2E8F0'], info: ['#ECFEFF', '#0E7490', '#A5F3FC'] }[tone];
  return { padding: '10px 14px', borderRadius: 8, background: t[0], color: t[1], border: `1px solid ${t[2]}`, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.7 };
};

/* ════════════════════════════════════════════════════════════
 * 미니·대형 크래들 — 1단계(대형)와 데이터 매핑 상단(미니 에뮬레이터)이 같은 컴포넌트를 쓴다
 * ════════════════════════════════════════════════════════════ */
const CradleStrip = ({ compact, docked, dotOf, selectedSlots = [], onSlot, pool }) => {
  const wellH = compact ? 34 : 110;
  const penH = compact ? 42 : 150;
  const slotW = compact ? 18 : 34;
  return (
    <div style={{ display: 'flex', gap: compact ? 10 : 16, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center', paddingBottom: compact ? 14 : 48 }}>
      {Array.from({ length: CRADLES }, (_, ci) => ci + 1).map((cn) => (
        <div key={cn} style={{ background: 'linear-gradient(180deg,#7A8085 0%,#5C6267 55%,#4C5257 100%)', borderRadius: compact ? 9 : 14, padding: compact ? '4px 8px 0' : '14px 14px 0', boxShadow: '0 8px 18px rgba(15,23,42,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)', fontSize: compact ? 9 : 'var(--neo-font-size-xs)', fontWeight: 800, marginBottom: compact ? 2 : 10, letterSpacing: 0.5 }}>
            <span>크래들 {cn}</span>
            <span>{Object.values(docked).filter((p) => cradleOf(p.slot) === cn).length}/{SLOTS}</span>
          </div>
          <div style={{ display: 'flex', gap: compact ? 3 : 6 }}>
            {Array.from({ length: SLOTS }, (_, i) => (cn - 1) * SLOTS + i + 1).map((slot) => {
              const pen = docked[slot];
              const avail = pool.some((p) => p.slot === slot);
              const dot = pen ? dotOf(pen) : null;
              const picked = selectedSlots.includes(slot);
              return (
                <div key={slot} style={{ width: slotW, position: 'relative' }}>
                  {!compact && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, marginBottom: 3 }}>{slotIn(slot)}</div>}
                  <button type="button" onClick={() => onSlot(slot)} disabled={!pen && !avail}
                    title={pen ? `${slotShort(slot)} · ${dot?.label || ''}` : avail ? `${slotShort(slot)} — 펜 거치` : '거치할 펜 없음'}
                    aria-label={`슬롯 ${slotShort(slot)}${pen ? '' : ' 비어 있음'}`}
                    style={{ width: '100%', height: wellH, padding: 0, position: 'relative', overflow: 'visible', display: 'block', cursor: (pen || avail) ? 'pointer' : 'default',
                      background: 'linear-gradient(180deg,#33383C,#3E4448)', border: picked ? '2px solid #60A5FA' : '1px solid rgba(0,0,0,0.35)', borderRadius: '5px 5px 0 0', boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5)' }}>
                    {pen && (
                      <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: compact ? 3 : 8, width: compact ? 9 : 16, height: penH, borderRadius: 8,
                        background: 'linear-gradient(90deg,#121417,#2B3035 40%,#16191C)', display: 'flex', justifyContent: 'center', paddingTop: compact ? 3 : 8 }}>
                        <span style={{ width: compact ? 4 : 6, height: compact ? 4 : 6, borderRadius: 2, background: pen.link === 'linking' ? '#FBBF24' : '#4ADE80', boxShadow: `0 0 6px ${pen.link === 'linking' ? '#FBBF24' : '#4ADE80'}` }} />
                      </span>
                    )}
                    {!pen && avail && <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,0.25)', fontSize: compact ? 9 : 12 }}>＋</span>}
                  </button>
                  {/* 슬롯 아래 상태 점 — 사유 전문은 목록·상세가 말한다 */}
                  {dot && (
                    <span style={{ position: 'absolute', left: '50%', top: wellH + (compact ? 16 : 52), transform: 'translateX(-50%)', width: compact ? 7 : 10, height: compact ? 7 : 10, borderRadius: '50%', background: dot.color, border: '1.5px solid white' }} />
                  )}
                  {compact && <div style={{ position: 'absolute', left: 0, right: 0, top: wellH + 26, textAlign: 'center', fontSize: 8, color: '#94A3B8', fontWeight: 700 }}>{slotIn(slot)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* 답안지 목(mock) — 미리보기·썸네일 공용 */
const ANSWER_LINES = ['작품 속 인물은 처음에 현실을 받아들이지 못하지만', '사건을 겪으며 태도가 점점 달라진다.', '이 변화가 작품의 주제를 드러낸다고 생각한다.', '특히 마지막 장면의 선택이 가장 중요하다.'];
const SheetMock = ({ studentLabel, question, sheetNo, small, answer }) => (
  <div style={{ background: 'white', borderRadius: 6, padding: small ? '8px 8px' : '18px 20px', boxShadow: small ? 'none' : '0 4px 12px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: small ? 3 : 8, height: small ? '100%' : 'auto', minHeight: small ? 0 : '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
    <div style={{ fontSize: small ? 9 : 14, fontWeight: 900, color: '#1E3A8A' }}>AiGLE</div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: small ? 8 : 12 }}>
      <tbody>
        <tr><td style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', padding: small ? 1 : '4px 6px', fontWeight: 700 }}>학생</td><td style={{ border: '1px solid #CBD5E1', padding: small ? 1 : '4px 6px', color: '#1E3A8A', fontFamily: '"Nanum Pen Script", "Gaegu", cursive', fontSize: small ? 8 : 18 }}>{studentLabel || '(   )학년 (   )반 (   )번'}</td></tr>
        <tr><td style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', padding: small ? 1 : '4px 6px', fontWeight: 700 }}>문항</td><td style={{ border: '1px solid #CBD5E1', padding: small ? 1 : '4px 6px' }}>{question ? `${question} · ${sheetNo}장` : '__'}</td></tr>
      </tbody>
    </table>
    {Array.from({ length: small ? 5 : 12 }, (_, i) => (
      <div key={i} style={{ borderBottom: '1px dashed #CBD5E1', height: small ? 6 : 32, flex: 'none', display: 'flex', alignItems: 'flex-end', paddingLeft: 8, overflow: 'hidden' }}>
        {answer && !small && i < ANSWER_LINES.length && <span style={{ fontFamily: '"Nanum Pen Script", "Gaegu", cursive', fontSize: 19, color: '#1E293B', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ANSWER_LINES[(i + (sheetNo || 0)) % ANSWER_LINES.length]}</span>}
      </div>
    ))}
  </div>
);

/* ════════════════════════════════════════════════════════════
 * 본 화면
 * ════════════════════════════════════════════════════════════ */
const BatchGradingUnified = () => {
  const [source, setSource] = useState('cradle'); // 'cradle' | 'scan'
  const [step, setStep] = useState('import');
  const [reading, setReading] = useState(false);
  const [readTick, setReadTick] = useState(0);
  const [sel, setSel] = useState(null);         // { type: 'student' | 'unc', id }
  const [tab, setTab] = useState('all');
  const [pageIdx, setPageIdx] = useState(0);    // 우측 큰 미리보기의 장 번호 — 선택이 바뀌면 0
  const [toast, setToast] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  // 채점
  const [progress, setProgress] = useState(0);
  const [gradingDone, setGradingDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gradedIds, setGradedIds] = useState([]);
  const [failedIds, setFailedIds] = useState([]);
  const [retrying, setRetrying] = useState(false);
  const failedOnce = useRef(false);

  /* ── 크래들 상태 ── */
  const [docked, setDocked] = useState({});      // { [slot]: pen + link }
  const [unrecognized, setUnrecognized] = useState([]);
  const failedDock = useRef(new Set());
  const [judged, setJudged] = useState([]);      // 마지막 판정에 들어간 펜 id
  const [manual, setManual] = useState({});      // { penId: sid } 직접 매칭
  const [dupPick, setDupPick] = useState({});    // { sid: penId } 중복 해소 — 고른 펜
  const [assignPick, setAssignPick] = useState({});
  const [fwDone, setFwDone] = useState({});

  /* ── 스캔 상태 ── */
  const [files, setFiles] = useState([]);        // { id, name, size, kind, url, plan }
  const [splitJobs, setSplitJobs] = useState([]);
  const splitSeq = useRef(0);
  const splitCancel = useRef(new Set());
  const [uploadErrors, setUploadErrors] = useState([]);
  const [rows, setRows] = useState([]);          // 판별 결과 { id, fid, name, sid, q, sheet, conf, reason, origin, home }

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!reading) return undefined;
    setReadTick(0);
    const iv = setInterval(() => setReadTick((t) => t + 1), 650);
    return () => clearInterval(iv);
  }, [reading]);
  useEffect(() => {
    if (step !== 'grading' || gradingDone) return undefined;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [step, gradingDone]);

  const resetAll = (nextSource = source) => {
    setSource(nextSource); setStep('import'); setReading(false); setSel(null); setTab('all');
    setProgress(0); setGradingDone(false); setGradedIds([]); setFailedIds([]); setRetrying(false); failedOnce.current = false;
    setDocked({}); setUnrecognized([]); failedDock.current = new Set(); setJudged([]); setManual({}); setDupPick({}); setAssignPick({}); setFwDone({});
    files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    splitJobs.forEach((j) => { splitCancel.current.add(j.id); j.pages.forEach((p) => p.url && URL.revokeObjectURL(p.url)); });
    setFiles([]); setSplitJobs([]); setUploadErrors([]); setRows([]);
  };

  /* ════════════ 크래들 — 1단계 · 에뮬레이터 조작 ════════════ */
  const dockPen = (slot) => {
    const pen = PEN_POOL.find((p) => p.slot === slot);
    if (!pen) return;
    setJudged((prev) => prev.filter((id) => id !== pen.id)); // 다시 꽂은 펜은 아직 안 읽은 상태
    setUnrecognized((prev) => prev.filter((s) => s !== slot));
    setDocked((prev) => ({ ...prev, [slot]: { ...pen, link: 'linking' } }));
    const willFail = pen.flaky && !failedDock.current.has(pen.id);
    if (willFail) failedDock.current.add(pen.id);
    setTimeout(() => {
      if (willFail) {
        setDocked((prev) => { const n = { ...prev }; delete n[slot]; return n; });
        setUnrecognized((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
      } else {
        setDocked((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot], link: 'connected' } } : prev));
      }
    }, 600);
  };
  const undockPen = (slot) => setDocked((prev) => { const n = { ...prev }; delete n[slot]; return n; });
  const connected = Object.values(docked).filter((p) => p.link === 'connected').sort((a, b) => a.slot - b.slot);

  /* ════════════ 크래들 — 판정 모델 ════════════ */
  const cradleModel = useMemo(() => {
    if (source !== 'cradle') return null;
    const unread = connected.filter((p) => !judged.includes(p.id));
    const read = connected.filter((p) => judged.includes(p.id));
    const bySid = {};
    const unc = [];
    const empty = [];
    read.forEach((p) => {
      const m = manual[p.id];
      if (m) { (bySid[m] = bySid[m] || []).push({ pen: p, manual: true }); return; }
      if (p.scenario === 'empty') { empty.push(p); return; }
      if (p.scenario === 'other_group') { unc.push({ id: p.id, pen: p, reason: `그룹 불일치 [감지: ${p.detected} → 선택: ${TASK.groupShort}]`, noAssign: true }); return; }
      if (p.scenario === 'no_ident') { unc.push({ id: p.id, pen: p, reason: IDENT_UNREAD }); return; }
      if (p.scenario === 'not_in_roster') { unc.push({ id: p.id, pen: p, reason: NOT_IN_ROSTER(p.read) }); return; }
      (bySid[p.identSid] = bySid[p.identSid] || []).push({ pen: p });
    });
    // 중복 해소 — 교사가 고른 펜만 남기고 나머지는 미분류로
    Object.entries(dupPick).forEach(([sid, penId]) => {
      const list = bySid[sid];
      if (!list || list.length < 2 || !list.some((x) => x.pen.id === penId)) return;
      list.filter((x) => x.pen.id !== penId).forEach((x) => unc.push({ id: x.pen.id, pen: x.pen, reason: `중복 답안에서 제외 — ${studentById(sid).name}의 답안으로 다른 펜을 선택했습니다` }));
      bySid[sid] = list.filter((x) => x.pen.id === penId);
    });
    const students = ROSTER.map((s) => {
      const list = bySid[s.id] || [];
      if (list.length === 0) return { ...s, badge: 'none', detail: '채점 제외 — 거치된 펜에서 이 학생의 답안을 찾지 못했습니다', pens: [] };
      if (list.length >= 2) return { ...s, badge: 'check', detail: `중복 데이터 — 슬롯 ${list.map((x) => slotShort(x.pen.slot)).join(' · ')}`, pens: list, dup: true };
      const { pen, manual: mm } = list[0];
      if (!penPageCount(pen)) return { ...s, badge: 'none', detail: '답안 없음 — 답안지 미작성', pens: list };
      return { ...s, badge: 'ok', detail: `펜 연결 · 슬롯 ${slotShort(pen.slot)}${mm ? ' · 직접 매칭' : ''}`, pens: list };
    });
    const gradable = students.filter((s) => s.badge === 'ok');
    const dups = students.filter((s) => s.dup);
    const blocked = !!unread.length ? false : (dups.length > 0 || gradable.length === 0);
    const blockReason = dups.length ? `⚠ 중복 데이터 ${dups.length}건을 먼저 풀어 주세요. 답안을 보고 이 학생의 답안을 고르면 풀립니다.`
      : '⚠ 채점할 수 있는 펜이 없습니다. 펜을 거치한 뒤 [다시 매칭]을 누르거나, 미분류 답안을 학생에게 직접 매칭해 주세요.';
    const excluded = students.filter((s) => s.badge === 'none').length;
    /* [v2] 목록이 펜(슬롯) 단위라 펜마다 상태를 둔다 — 중복은 두 행, 미분류는 자기 크래들 자리에 보인다 */
    const penInfo = {};
    unread.forEach((p) => { penInfo[p.id] = { kind: 'unread' }; });
    empty.forEach((p) => { penInfo[p.id] = { kind: 'empty' }; });
    unc.forEach((u) => { penInfo[u.id] = { kind: 'unc', reason: u.reason, noAssign: u.noAssign }; });
    students.forEach((s) => s.pens.forEach((x) => { penInfo[x.pen.id] = { kind: s.dup ? 'dup' : s.badge === 'none' ? 'noans' : 'ok', sid: s.id, manual: !!x.manual }; }));
    const absent = students.filter((s) => s.pens.length === 0);
    return { students, unc, empty, unread, gradable, penInfo, absent, blocked: blocked || unread.length > 0, blockReason: unread.length ? `⚠ 아직 읽지 않은 펜 ${unread.length}자루가 있습니다 — [↻ 다시 매칭]을 눌러 주세요.` : blockReason,
      note: excluded ? `⚠ 학생 ${excluded}명이 채점 대상에서 제외됩니다 — 거치된 펜에서 이 학생들의 답안을 찾지 못했거나 답안이 없습니다.` : '',
      manifest: `채점을 시작하면 채점 대상 ${gradable.length}명의 답안만 서버로 올라갑니다. 나머지 펜은 올리지 않고 펜 데이터도 지우지 않습니다.` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, docked, judged, manual, dupPick]);

  /* ════════════ 스캔 — 1단계 업로드 · 페이지 분리 ════════════ */
  const appendFiles = (entries) => setFiles((prev) => {
    let id = prev.length ? Math.max(...prev.map((f) => f.id)) + 1 : 1;
    return [...prev, ...entries.map((e) => ({ ...e, id: id++ }))];
  });
  const addFiles = (fileList) => {
    const rejected = []; const imgs = []; const pdfs = [];
    const known = new Set(files.map((f) => `${f.name}:${f.size}`));
    Array.from(fileList).forEach((f) => {
      if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) { rejected.push(`${f.name} — 지원하지 않는 형식입니다 (PDF · PNG · JPG만 가능)`); return; }
      const isPdf = /\.pdf$/i.test(f.name); const lim = isPdf ? 200 : 20;
      if (f.size > lim * 1024 * 1024) { rejected.push(`${f.name} — ${lim}MB를 넘습니다 — 해상도를 낮춰 다시 스캔해 주세요`); return; }
      if (known.has(`${f.name}:${f.size}`)) { rejected.push(`${f.name} — 이미 올린 파일입니다`); return; }
      known.add(`${f.name}:${f.size}`);
      (isPdf ? pdfs : imgs).push(f);
    });
    setUploadErrors(rejected);
    appendFiles(imgs.map((f) => ({ name: f.name, size: f.size, kind: 'image', url: URL.createObjectURL(f) })));
    pdfs.forEach(async (file) => {
      splitSeq.current += 1; const jid = splitSeq.current;
      const patch = (fn) => setSplitJobs((prev) => prev.map((j) => (j.id === jid ? fn(j) : j)));
      setSplitJobs((prev) => [...prev, { id: jid, name: file.name, size: file.size, status: 'splitting', total: 0, done: 0, pages: [] }]);
      try {
        const doc = await openPdf(file);
        if (doc.numPages === 1) { setSplitJobs((prev) => prev.filter((j) => j.id !== jid)); appendFiles([{ name: file.name, size: file.size, kind: 'pdf' }]); return; }
        patch((j) => ({ ...j, total: doc.numPages }));
        const ok = await renderPages(doc, file.name.replace(/\.pdf$/i, ''), (pg) => patch((j) => ({ ...j, done: pg.no, pages: [...j.pages, { ...pg, selected: !pg.blank }] })), () => splitCancel.current.has(jid));
        if (ok) patch((j) => ({ ...j, status: 'done' }));
      } catch (err) {
        patch((j) => ({ ...j, status: 'failed', error: splitErrorReason(err) }));
      }
    });
  };
  const demoScanFiles = (asPdf) => {
    const plan = buildScanPlan();
    if (!asPdf) {
      appendFiles(plan.map((p, i) => ({ name: `scan_${String(files.length + i + 1).padStart(4, '0')}.jpg`, size: 1_000_000 + i * 30_000, kind: 'mock', plan: p })));
      return;
    }
    // 일괄 스캔 PDF 1개 — 답안지 사이에 빈 뒷면 2쪽
    splitSeq.current += 1; const jid = splitSeq.current;
    const seq = []; plan.forEach((p, i) => { seq.push({ plan: p }); if (i === 9 || i === plan.length - 1) seq.push({ blank: true }); });
    setSplitJobs((prev) => [...prev, { id: jid, name: '일괄스캔_20260929.pdf', size: 38_400_000, status: 'splitting', total: seq.length, done: 0, pages: [], demo: true }]);
    let n = 0;
    const iv = setInterval(() => {
      if (splitCancel.current.has(jid) || n >= seq.length) { clearInterval(iv); if (!splitCancel.current.has(jid)) setSplitJobs((prev) => prev.map((j) => (j.id === jid ? { ...j, status: 'done' } : j))); return; }
      const it = seq[n]; n += 1; const no = n;
      setSplitJobs((prev) => prev.map((j) => (j.id === jid ? { ...j, done: no, pages: [...j.pages, { no, name: `일괄스캔_20260929_p${String(no).padStart(2, '0')}.jpg`, size: 900_000, plan: it.plan, blank: !!it.blank, selected: !it.blank }] } : j)));
    }, 60);
  };
  const commitSplit = (job) => {
    const picked = job.pages.filter((p) => p.selected);
    appendFiles(picked.map((p) => (p.plan ? { name: p.name, size: p.size, kind: 'mock', plan: p.plan } : { name: p.name, size: p.size, kind: 'image', url: p.url })));
    job.pages.filter((p) => !p.selected && p.url).forEach((p) => URL.revokeObjectURL(p.url));
    splitCancel.current.add(job.id);
    setSplitJobs((prev) => prev.filter((j) => j.id !== job.id));
  };
  const dropSplit = (job) => { splitCancel.current.add(job.id); job.pages.forEach((p) => p.url && URL.revokeObjectURL(p.url)); setSplitJobs((prev) => prev.filter((j) => j.id !== job.id)); };
  const pendingSplit = splitJobs.filter((j) => j.status !== 'failed');

  /* ════════════ 스캔 — 판별 · 모델 ════════════ */
  const readScan = () => {
    const taken = new Set();
    const out = files.map((f, i) => {
      const p = f.plan || { sid: ROSTER[i % ROSTER.length].id, q: QUESTIONS[i % QUESTIONS.length].id, page: 1 };
      if (p.fault) {
        const reason = p.fault === 'other_task' ? '학생 미매칭 — 이 과제 답안지가 아닙니다' : p.fault === 'not_in_roster' ? NOT_IN_ROSTER('1학년 1반 31번 오세훈') : IDENT_UNREAD;
        return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason };
      }
      taken.add(`${p.sid}:${p.q}`);
      return { id: `r${f.id}`, fid: f.id, name: f.name, sid: p.sid, q: p.q, sheet: p.page, conf: (i === 3 || i === 30) ? 'medium' : 'high' }; // AI가 문항을 추정한 답안지 2장 (시연)
    });
    const existing = ROSTER.filter((s) => s.hasAnswer).flatMap((s) => QUESTIONS.map((q) => {
      const attach = !taken.has(`${s.id}:${q.id}`);
      return { id: `e${s.id}${q.id}`, name: `${s.name} 기존 답안 · ${q.title}`, origin: 'existing', home: { sid: s.id, q: q.id }, sid: attach ? s.id : null, q: attach ? q.id : null, conf: 'high', reason: attach ? null : '기존 답안 — 스캔본이 자리를 대신하고 있습니다' };
    }));
    setRows([...out, ...existing]);
  };
  const scanModel = useMemo(() => {
    if (source !== 'scan') return null;
    const slot = (sid, q) => rows.filter((r) => r.sid === sid && r.q === q).sort((a, b) => (a.sheet || 9) - (b.sheet || 9));
    const unc = rows.filter((r) => r.sid == null);
    const students = ROSTER.map((s) => {
      const qs = QUESTIONS.map((q) => {
        const list = slot(s.id, q.id);
        const hasExisting = list.some((r) => r.origin === 'existing');
        const st = hasExisting ? 'ok' : list.length < q.sheets ? 'short' : list.length > q.sheets ? 'over' : 'ok';
        return { q, list, st, hasExisting };
      });
      const absent = qs.every((x) => x.list.length === 0);
      if (absent) return { ...s, badge: 'none', detail: '채점 제외 — 올린 파일에서 이 학생의 답안지를 찾지 못했습니다', qs, absent: true };
      const issues = [];
      qs.forEach((x) => {
        if (x.st === 'over') issues.push(`답안지 초과 — ${x.q.title} ${x.list.length}/${x.q.sheets}장 · 중복 스캔 의심`);
        if (x.st === 'short') issues.push(`답안지 부족 — ${x.q.title} ${x.list.length}/${x.q.sheets}장`);
      });
      const pending = qs.reduce((a, x) => a + x.list.filter((r) => r.conf === 'medium').length, 0);
      if (pending) issues.push(`문항 확인 필요 — 문항 번호를 AI가 추정한 답안지 ${pending}장`);
      if (issues.length) return { ...s, badge: 'check', detail: issues[0] + (issues.length > 1 ? ` 외 ${issues.length - 1}건` : ''), qs };
      if (s.hasAnswer) {
        const replaced = qs.some((x) => !x.hasExisting && x.list.length);
        return { ...s, badge: 'answer', detail: replaced ? '기존 답안 교체 — 스캔본으로 채점됩니다' : '기존 답안으로 채점', qs };
      }
      return { ...s, badge: 'ok', detail: '답안지 연결', qs };
    });
    const gradable = students.filter((s) => s.badge === 'ok' || s.badge === 'answer');
    const checks = students.filter((s) => s.badge === 'check');
    const blocked = checks.length > 0 || gradable.length === 0;
    const nOver = students.flatMap((s) => (s.absent ? [] : s.qs)).filter((x) => x.st === 'over').length;
    const nShort = students.flatMap((s) => (s.absent ? [] : s.qs)).filter((x) => x.st === 'short').length;
    const nMed = rows.filter((r) => r.sid && r.conf === 'medium').length;
    const parts = [nOver && `답안지 초과 ${nOver}건`, nShort && `답안지 부족 ${nShort}건`, nMed && `확인 필요 ${nMed}장`].filter(Boolean);
    const excluded = students.filter((s) => s.badge === 'none').length;
    return { students, unc, gradable, blocked,
      blockReason: gradable.length === 0 ? '⚠ 채점할 수 있는 답안지가 없습니다. 스캔 파일을 다시 올리거나, 미분류 답안지를 학생·문항에 직접 지정해 주세요.'
        : `⚠ ${parts.join(' · ')}을(를) 먼저 정리해 주세요. 모든 문항이 기준 장수를 채우고 확인이 끝나야 채점을 시작할 수 있습니다.`,
      note: excluded ? `⚠ 학생 ${excluded}명이 채점 대상에서 제외됩니다 — 올린 파일에서 이 학생들의 답안지를 찾지 못했습니다.` : '',
      manifest: `채점을 시작하면 채점 대상 ${gradable.length}명의 답안지만 서버로 올라갑니다.${unc.length ? ` 미분류 ${unc.length}장은 올리지 않습니다.` : ''}` };
  }, [source, rows]);
  const patchRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const unlinkRow = (r) => patchRow(r.id, { sid: null, q: null, sheet: null, conf: 'low', reason: r.origin === 'existing' ? '기존 답안 — 스캔본이 자리를 대신하고 있습니다' : '미연결 — 연결을 해제한 답안지입니다' });
  const restoreExisting = (r) => setRows((prev) => prev.map((x) => {
    if (x.id === r.id) return { ...x, sid: r.home.sid, q: r.home.q, reason: null };
    if (x.origin !== 'existing' && x.sid === r.home.sid && x.q === r.home.q) return { ...x, sid: null, q: null, sheet: null, conf: 'low', reason: '미연결 — 기존 답안을 되돌리면서 자리에서 내려온 스캔입니다' };
    return x;
  }));

  const model = source === 'cradle' ? cradleModel : scanModel;

  /* ════════════ 공통 흐름 ════════════ */
  const startReading = () => {
    setStep('mapping'); setReading(true); setSel(null);
    setTimeout(() => {
      if (source === 'cradle') setJudged(Object.values(docked).filter((p) => p.link === 'connected').map((p) => p.id));
      else readScan();
      setReading(false);
    }, 2200);
  };
  const reread = () => { setReading(true); setTimeout(() => { setJudged(connected.map((p) => p.id)); setReading(false); }, 1400); };

  // 기본 선택 — 확인 필요 학생 → 미분류 → 첫 학생
  useEffect(() => {
    if (step !== 'mapping' || reading || !model || sel) return;
    if (source === 'cradle') {
      const pens = connected.filter((p) => cradleModel.penInfo[p.id]);
      const first = pens.find((p) => ['dup', 'unc'].includes(cradleModel.penInfo[p.id].kind)) || pens[0];
      if (first) setSel({ type: 'pen', penId: first.id });
      return;
    }
    const first = model.students.find((s) => s.badge === 'check');
    setSel(first ? { type: 'student', id: first.id } : model.unc.length ? { type: 'unc' } : { type: 'student', id: model.students[0].id });
  }, [step, reading, model, sel]);

  const startGrading = () => {
    const ids = model.gradable.map((s) => s.id);
    setGradedIds(ids); setFailedIds([]); setProgress(0); setGradingDone(false); setElapsed(0); setStep('grading');
    const failId = !failedOnce.current && ids.length >= 2 ? ids[ids.length - 1] : null;
    let v = 0;
    const iv = setInterval(() => {
      v += 2; setProgress(Math.min(100, v));
      if (v >= 100) {
        clearInterval(iv);
        if (failId) { failedOnce.current = true; setFailedIds([failId]); }
        setGradingDone(true);
        setTimeout(() => setStep('done'), 500);
      }
    }, 120);
  };
  const retry = () => { setRetrying(true); setTimeout(() => { setFailedIds([]); setRetrying(false); setToast(source === 'cradle' ? '실패했던 답안의 채점이 완료되었습니다. 해당 펜의 데이터도 삭제되었습니다.' : '실패했던 답안의 채점이 완료되었습니다.'); }, 2000); };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const canStartMapping = source === 'cradle' ? connected.length > 0 : files.length > 0 && !pendingSplit.length;

  /* ════════════ 렌더 조각 ════════════ */
  const renderCradleImport = () => {
    const needFw = connected.filter((p) => p.needsUpdate && !fwDone[p.id]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {unrecognized.length > 0 && (
          <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>
            ⚠ 펜 {unrecognized.length}자루가 크래들에 표시되지 않습니다 — 펜 오류로 인식되지 않은 상태입니다.
            <span style={{ fontWeight: 600, color: '#B45309' }}> 꽂혀 있는데 빈 자리로 보이는 펜을 뺐다가 다시 꽂아 주세요.</span>
          </div>
        )}
        <div style={{ ...card, padding: '18px 16px 0' }}>
          <CradleStrip docked={docked} pool={PEN_POOL} dotOf={() => null} onSlot={(slot) => (docked[slot] ? undockPen(slot) : dockPen(slot))} />
        </div>
        <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>연결된 펜 <span style={{ color: '#2A75F3' }}>{connected.length}</span>자루</strong>
          {unrecognized.length > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>· 인식 안 됨 {unrecognized.length}</span>}
          {needFw.length > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>· 펌웨어 업데이트 {needFw.length}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" style={ghostBtn} onClick={() => PEN_POOL.forEach((p) => !docked[p.slot] && dockPen(p.slot))}>🧪 전체 거치</button>
            <button type="button" style={ghostBtn} onClick={() => { setDocked({}); setUnrecognized([]); }}>전체 제거</button>
            <button type="button" disabled={!needFw.length} onClick={() => setFwDone((p) => ({ ...p, ...Object.fromEntries(needFw.map((x) => [x.id, true])) }))}
              style={{ ...ghostBtn, background: '#EBF2FF', border: 'none', color: '#2A75F3', opacity: needFw.length ? 1 : 0.45 }}>↺ 펌웨어 일괄 업데이트 (선택)</button>
          </span>
        </div>
        {connected.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
            {Array.from({ length: CRADLES }, (_, i) => i + 1).map((cn) => (
              <div key={cn} style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#F1F5F9', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>크래들 {cn}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                  <thead><tr style={{ color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}><th style={{ textAlign: 'left', padding: '6px 10px' }}>슬롯</th><th>연결</th><th>배터리</th><th>펌웨어</th></tr></thead>
                  <tbody>
                    {connected.filter((p) => cradleOf(p.slot) === cn).map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 800 }}>{slotIn(p.slot)}번</td>
                        <td style={{ textAlign: 'center' }}><span style={pill(BADGE.ok)}>연결됨</span></td>
                        <td style={{ textAlign: 'center', color: p.battery < 50 ? '#DC2626' : '#475569' }}>{p.battery}%</td>
                        <td style={{ textAlign: 'center' }}>
                          {p.needsUpdate && !fwDone[p.id]
                            ? <><span style={{ color: '#DC2626' }}>{p.firmware}</span> <button type="button" onClick={() => setFwDone((x) => ({ ...x, [p.id]: true }))} style={{ marginLeft: 4, background: '#EF4444', color: 'white', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer' }}>업데이트</button></>
                            : <span style={{ color: '#94A3B8' }}>2.1.0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderScanImport = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {uploadErrors.length > 0 && (
        <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>
          ⚠ 파일 {uploadErrors.length}개를 올리지 못했습니다. <span style={{ fontWeight: 600, color: '#B45309' }}>아래 사유를 확인하고 다시 올려 주세요.</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontWeight: 600, fontSize: 'var(--neo-font-size-xs)' }}>{uploadErrors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div style={{ ...card, borderStyle: 'dashed', borderColor: '#93C5FD', background: '#F0F9FF', padding: '26px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <div style={{ fontSize: '1.8rem' }}>📁</div>
        <div style={{ fontWeight: 800, color: '#1E3A8A' }}>스캔 파일을 끌어놓거나 선택하세요</div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>PDF · PNG · JPG · 낱장 20MB 이하 · 파일명·순서 무관</div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#1D4ED8', fontWeight: 700 }}>📑 여러 쪽 PDF(자동 급지 일괄 스캔)는 쪽마다 나눈 뒤 올립니다 · 200MB 이하</div>
        <label style={{ ...primaryBtn(true), marginTop: 4, display: 'inline-block' }}>파일 선택
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {splitJobs.map((job) => {
        const selN = job.pages.filter((p) => p.selected).length;
        const blanks = job.pages.filter((p) => p.blank).length;
        return (
          <div key={job.id} style={{ ...card, padding: 14, borderColor: job.status === 'failed' ? '#FCA5A5' : '#BFDBFE', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <strong>📑 {job.name}</strong><span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>페이지 분리</span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: job.status === 'failed' ? '#B91C1C' : job.status === 'done' ? '#166534' : '#1D4ED8' }}>
                {job.status === 'failed' ? '분리 실패' : job.status === 'done' ? `${job.total}쪽 → 선택 ${selN}장` : `${job.done}/${job.total || '?'}쪽 나누는 중…`}
              </span>
            </div>
            {job.status === 'failed' && <div style={{ color: '#B91C1C', fontWeight: 700 }}>⚠ {job.error} <button type="button" style={{ ...ghostBtn, marginLeft: 8 }} onClick={() => dropSplit(job)}>닫기</button></div>}
            {job.status === 'done' && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>쪽마다 답안지 1장이 됩니다. 답안지가 아닌 쪽은 눌러서 빼 주세요.{blanks > 0 && <strong style={{ color: '#B45309' }}> 빈 페이지로 보이는 {blanks}쪽은 미리 뺐습니다.</strong>}</div>}
            {job.pages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px,1fr))', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                {job.pages.map((p) => (
                  <button key={p.no} type="button" disabled={job.status !== 'done'} aria-pressed={p.selected}
                    onClick={() => setSplitJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, pages: j.pages.map((x) => (x.no === p.no ? { ...x, selected: !x.selected } : x)) } : j)))}
                    style={{ position: 'relative', padding: 0, aspectRatio: '1 / 1.414', border: p.selected ? '2px solid #2A75F3' : '2px dashed #CBD5E1', borderRadius: 6, overflow: 'hidden', background: 'white', cursor: 'pointer', opacity: p.selected ? 1 : 0.45 }}>
                    {p.url ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.blank ? null : <SheetMock small studentLabel={p.plan?.sid ? `${studentById(p.plan.sid).no} ${studentById(p.plan.sid).name}` : ''} question={p.plan?.q ? `문항 ${p.plan.q}` : ''} sheetNo={p.plan?.page} />}
                    <span style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(15,23,42,0.75)', color: 'white', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '0 5px' }}>{p.no}</span>
                    {p.blank && <span style={{ position: 'absolute', left: 3, right: 3, bottom: 3, background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 800, borderRadius: 4 }}>빈 페이지</span>}
                  </button>
                ))}
              </div>
            )}
            {job.status !== 'failed' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" style={ghostBtn} onClick={() => dropSplit(job)}>{job.status === 'done' ? '버리기' : '분리 취소'}</button>
                {job.status === 'done' && <button type="button" disabled={!selN} style={primaryBtn(selN > 0)} onClick={() => commitSplit(job)}>선택한 {selN}장 업로드 목록에 추가</button>}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ ...card, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>업로드 <span style={{ color: '#2A75F3' }}>{files.length}</span>개</strong>
        {pendingSplit.length > 0 && <span style={{ color: '#2A75F3', fontWeight: 700 }}>· 분리 대기 PDF {pendingSplit.length}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" style={ghostBtn} onClick={() => demoScanFiles(false)}>🧪 데모 낱장</button>
          <button type="button" style={ghostBtn} onClick={() => demoScanFiles(true)}>🧪 데모 일괄 스캔 PDF</button>
          <button type="button" style={ghostBtn} onClick={() => resetAll('scan')}>전체 삭제</button>
        </span>
      </div>
      {files.length > 0 && (
        <div style={{ ...card, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {files.map((f) => <div key={f.id} style={{ fontSize: 'var(--neo-font-size-xs)', padding: '4px 8px', background: '#F8FAFC', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.kind === 'pdf' ? '📕' : '🖼'} {f.name}</div>)}
        </div>
      )}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
   * 데이터 매핑 — 2단 구조 (v2)
   *   좌: 목록 — 크래들은 **크래들별 묶음 + 묶음 머리의 10구 슬롯 띠(에뮬레이터)**, 스캔은 학생 목록
   *   우: 매핑(조치) + **큰 미리보기**
   *   舊 v1: 상단 가로 띠(에뮬레이터) + 3단(목록/상세/미리보기) — 노트북에서 세로 공간을 잡아먹고,
   *          에뮬레이터가 목록과 떨어져 슬롯↔학생을 눈으로 이어야 했다
   * ════════════════════════════════════════════════════════════ */

  /** 한 줄 요약 — 카운트 · 업로드 범위 · (크래들) 다시 매칭 */
  const renderSummaryBar = () => {
    const changed = source === 'cradle' && (cradleModel?.unread.length > 0 || judged.some((id) => !connected.some((p) => p.id === id)));
    const counts = {
      ok: model.gradable.length,
      check: source === 'cradle' ? Object.values(cradleModel.penInfo).filter((x) => x.kind === 'dup' || x.kind === 'unc').length : model.students.filter((s) => s.badge === 'check').length,
      none: model.students.filter((s) => s.badge === 'none').length,
      unc: model.unc.length,
    };
    return (
      <div style={{ ...card, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
        <span style={{ color: '#166534' }}>🟢 채점 대상 {counts.ok}명</span>
        <span style={{ color: '#B91C1C' }}>확인 필요 {counts.check}{source === 'cradle' ? '자루' : '명'}</span>
        <span style={{ color: '#94A3B8' }}>제외 {counts.none}명</span>
        <span style={{ color: '#C2410C' }}>미분류 {counts.unc}{source === 'scan' ? '장' : '자루'}</span>
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 500, flex: 1, minWidth: 200 }}>{model.manifest}</span>
        {source === 'cradle' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {changed && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#C2410C' }}>🔄 크래들 구성이 바뀌었습니다{cradleModel.unread.length > 0 && ` — 읽지 않은 펜 ${cradleModel.unread.length}자루`}</span>}
            <button type="button" onClick={reread} title="판정을 다시 돌립니다. 직접 매칭 기록은 유지됩니다. 읽은 펜 수만큼 AI OCR이 차감됩니다."
              style={{ ...ghostBtn, padding: '5px 12px', background: changed ? '#F97316' : 'white', color: changed ? 'white' : '#475569', border: changed ? 'none' : '1px solid #CBD5E1' }}>↻ 다시 매칭</button>
          </span>
        )}
      </div>
    );
  };

  /* ── 크래들 펜 한 자루의 상태 → 배지·문구 ── */
  const PEN_KIND = {
    ok: { ...BADGE.ok, label: '정상' },
    dup: { ...BADGE.check, label: '확인 필요' },
    unc: { label: '미분류', bg: '#FFF7ED', border: '#FDBA74', color: '#C2410C', dot: '#F97316' },
    noans: { ...BADGE.none, label: '답안 없음' },
    empty: { ...BADGE.none, label: '필기 없음' },
    unread: { label: '읽지 않음', bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', dot: '#60A5FA' },
  };
  const penText = (info) => ({
    ok: info.manual ? '펜 연결 · 직접 매칭' : '펜 연결',
    dup: '중복 데이터 — 같은 학생에 펜이 2자루 이상',
    unc: info.reason,
    noans: '답안 없음 — 답안지 미작성',
    empty: '필기 데이터가 없습니다',
    unread: '아직 읽지 않음 — [↻ 다시 매칭] 필요',
  }[info.kind]);
  const penTab = (info) => (info.kind === 'dup' || info.kind === 'unc' ? 'check' : info.kind === 'ok' ? 'ok' : 'none');

  /** 크래들 1대의 10구 띠 — 목록 묶음 머리에 붙는 에뮬레이터 */
  /** 크래들 1대 — 검은 본체에 펜을 꽂은 모양. 점 한 줄 높이(20px)로 줄여 미니맵에 3대를 쌓는다.
   *  펜 머리의 LED 색 = 상태. 빈 슬롯은 비어 있고, 거치할 펜이 있으면 ＋ */
  const renderRail = (cn) => (
    <div style={{ flex: 1, display: 'flex', gap: 2, background: 'linear-gradient(180deg,#6B7176,#4C5257)', borderRadius: 5, padding: '3px 4px' }}>
      {Array.from({ length: SLOTS }, (_, i) => (cn - 1) * SLOTS + i + 1).map((slot) => {
        const pen = docked[slot];
        const avail = PEN_POOL.some((p) => p.slot === slot);
        const info = pen && pen.link === 'connected' ? cradleModel.penInfo[pen.id] : null;
        const k = info ? PEN_KIND[info.kind] : null;
        const selInfo = sel?.type === 'pen' ? cradleModel.penInfo[sel.penId] : null;
        const picked = pen && sel?.type === 'pen' && (sel.penId === pen.id || (selInfo?.kind === 'dup' && info?.kind === 'dup' && selInfo.sid === info.sid));
        const led = pen ? (k ? k.dot : '#FBBF24') : null;
        return (
          <button key={slot} type="button" disabled={!pen && !avail} onClick={() => onSlotClick(slot)}
            title={pen ? `${slotShort(slot)} · ${k ? `${k.label} — ${penText(info)}` : '연결 중'}` : avail ? `${slotShort(slot)} — 빈 슬롯 (눌러서 거치)` : `${slotShort(slot)} — 빈 슬롯`}
            aria-label={`슬롯 ${slotShort(slot)}${pen ? '' : ' 비어 있음'}`}
            style={{ flex: 1, minWidth: 0, height: 20, padding: 0, position: 'relative', borderRadius: 3, cursor: (pen || avail) ? 'pointer' : 'default',
              background: '#2F3438', border: picked ? '2px solid #60A5FA' : '1px solid rgba(0,0,0,0.45)', boxShadow: picked ? '0 0 0 2px rgba(96,165,250,0.4)' : 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
            {pen && (
              <span style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, transform: 'translateX(-50%)', width: 9, borderRadius: 3, background: 'linear-gradient(90deg,#121417,#2B3035 45%,#16191C)', display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: led, boxShadow: `0 0 5px ${led}` }} />
              </span>
            )}
            {!pen && avail && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, lineHeight: 1 }}>＋</span>}
          </button>
        );
      })}
    </div>
  );

  /** 크래들 — 좌측 목록: 크래들별 묶음(머리 = 10구 띠) + 펜 행. 펜 없는 학생은 맨 아래 */
  /** 펜 한 자루 = 한 행 — 묶음형·미니맵형이 같이 쓴다 */
  const penRow = (p) => {
    const infos = cradleModel.penInfo;
    const info = infos[p.id] || { kind: 'unread' };
    const k = PEN_KIND[info.kind];
    const st = info.sid ? studentById(info.sid) : null;
    const on = sel?.type === 'pen' && sel.penId === p.id;
    return (
      <button key={p.id} id={`pen-row-${p.id}`} type="button" onClick={() => { setSel({ type: 'pen', penId: p.id }); setPageIdx(0); }}
        style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: '1px solid #F1F5F9', background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ flex: 'none', width: 34, padding: '2px 0', textAlign: 'center', borderRadius: 6, background: '#1E293B', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>{slotShort(p.slot)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontSize: 'var(--neo-font-size-sm)', color: st ? '#1E293B' : '#94A3B8' }}>{st ? st.name : '학생 미지정'}</strong>
            {st && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{st.no}</span>}
            <span style={{ marginLeft: 'auto', ...pill(k) }}>{k.label}</span>
          </span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--neo-font-size-xs)', color: info.kind === 'ok' ? '#166534' : k.color, lineHeight: 1.45 }}>{penText(info)}</span>
        </span>
      </button>
    );
  };

  /** 슬롯 클릭 — 미니맵·묶음 띠·위치 카드 공통. 빈 칸은 거치, 펜은 선택 */
  const onSlotClick = (slot) => {
    const pen = docked[slot];
    if (!pen) { dockPen(slot); return; }
    if (pen.link !== 'connected') return;
    setSel({ type: 'pen', penId: pen.id }); setPageIdx(0);
    document.getElementById(`pen-row-${pen.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /** 미니맵 — 검은 크래들 3대를 점 한 줄 높이로. 목록 맨 위에 고정 (약 90px) */
  const renderMinimap = () => (
    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: CRADLES }, (_, i) => i + 1).map((cn) => (
        <div key={cn} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, fontSize: 10, fontWeight: 800, color: '#64748B', textAlign: 'right' }}>{cn}</span>
          {renderRail(cn)}
          <span style={{ width: 30, fontSize: 10, color: '#94A3B8', textAlign: 'right' }}>{Object.values(docked).filter((x) => cradleOf(x.slot) === cn).length}/{SLOTS}</span>
        </div>
      ))}
      {/* 범례 — 펜 머리 LED 색의 뜻 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2, paddingLeft: 20, fontSize: 10, color: '#64748B' }}>
        {[['ok', '정상'], ['dup', '확인 필요'], ['unc', '미분류'], ['unread', '읽지 않음'], ['empty', '대상 아님']].map(([kk, l]) => (
          <span key={kk} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: PEN_KIND[kk].dot }} />{l}</span>
        ))}
        <span>＋ 빈 슬롯(눌러서 거치)</span>
      </div>
    </div>
  );

  /** 위치 줄 — 고른 펜이 실물 크래들 어디에 있는지. 그림은 좌측 미니맵이 맡고, 여기는 말과 조치만 */
  const renderLocationCard = (pen) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
      <span title="좌측 미니맵에 파랗게 표시된 자리입니다" style={{ flex: 1, minWidth: 0, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B' }}>📍 실물 위치 — 크래들 {cradleOf(pen.slot)} · {slotIn(pen.slot)}번 자리</span>
      <button type="button" style={{ ...ghostBtn, padding: '4px 10px', flex: 'none' }} title="크래들에서 이 펜을 뺍니다 (에뮬레이터). 다시 꽂으려면 미니맵의 빈 슬롯을 누르세요." onClick={() => { undockPen(pen.slot); setSel(null); }}>⏏ 펜 빼기</button>
    </div>
  );

  const renderPenList = () => {
    const infos = cradleModel.penInfo;
    const pens = connected;
    const nCheck = pens.filter((p) => infos[p.id] && penTab(infos[p.id]) === 'check').length;
    const nNone = pens.filter((p) => infos[p.id] && penTab(infos[p.id]) === 'none').length + cradleModel.absent.length;
    const show = (p) => tab === 'all' || (infos[p.id] && penTab(infos[p.id]) === tab);
    return (
      <div style={{ ...card, width: 320, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #F1F5F9' }}>
          {[['all', '전체', pens.length], ['check', '확인 필요', nCheck], ['none', '제외', nNone]].map(([k, l, n]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${tab === k ? '#2A75F3' : '#E2E8F0'}`, background: tab === k ? '#2A75F3' : 'white', color: tab === k ? 'white' : '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l} ({n})</button>
          ))}
        </div>
        {renderMinimap()}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* 목록은 한 줄로 이어진다(스캔 목록과 같은 모양). 슬롯 순서 */}
          {pens.filter(show).map(penRow)}
          {(tab === 'all' || tab === 'none') && cradleModel.absent.length > 0 && (
            <div>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '8px 12px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                펜 없음 · 채점 제외 {cradleModel.absent.length}명
              </div>
              {cradleModel.absent.map((s) => {
                const on = sel?.type === 'absent' && sel.sid === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setSel({ type: 'absent', sid: s.id })}
                    style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: '1px solid #F1F5F9', background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ flex: 'none', width: 34, textAlign: 'center', color: '#CBD5E1', fontWeight: 800 }}>—</span>
                    <strong style={{ fontSize: 'var(--neo-font-size-sm)' }}>{s.name}</strong>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{s.no}</span>
                    <span style={{ marginLeft: 'auto', ...pill(BADGE.none) }}>제외</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /** 스캔 — 좌측 학생 목록 (+ 미분류 바) */
  const renderStudentList = () => {
    const list = model.students.filter((s) => tab === 'all' || s.badge === tab);
    const tabs = [['all', '전체', model.students.length], ['check', '확인 필요', model.students.filter((s) => s.badge === 'check').length],
      ['answer', '답안 있음', model.students.filter((s) => s.badge === 'answer').length], ['none', '제외', model.students.filter((s) => s.badge === 'none').length]];
    return (
      <div style={{ ...card, width: 320, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, padding: 10, flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
          {tabs.map(([k, l, n]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${tab === k ? '#2A75F3' : '#E2E8F0'}`, background: tab === k ? '#2A75F3' : 'white', color: tab === k ? 'white' : '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l} ({n})</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.map((s) => {
            const on = sel?.type === 'student' && sel.id === s.id;
            const b = BADGE[s.badge];
            return (
              <button key={s.id} type="button" onClick={() => { setSel({ type: 'student', id: s.id }); setPageIdx(0); }}
                style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #F1F5F9', background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>{s.name}</strong>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{s.no}</span>
                  <span style={{ marginLeft: 'auto', ...pill(b) }}>{s.badge === 'answer' ? (s.detail.startsWith('기존 답안 교체') ? '교체됨' : '기존 답안') : b.label}</span>
                </div>
                <div style={{ marginTop: 3, fontSize: 'var(--neo-font-size-xs)', color: s.badge === 'ok' ? '#166534' : b.color, lineHeight: 1.5 }}>{s.detail}</div>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => { setSel({ type: 'unc' }); setPageIdx(0); }}
          style={{ padding: '12px 14px', border: 'none', background: sel?.type === 'unc' ? '#1E293B' : '#475569', color: 'white', display: 'flex', justifyContent: 'space-between', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>
          <span>미분류 파일</span><span>{model.unc.length}장 ›</span>
        </button>
      </div>
    );
  };

  /* ── 우측: 매핑(조치) 영역 — 입력 방식별 ── */
  const assignRow = (penId, noAssign, detected) => {
    if (noAssign) return <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{detected} 답안지입니다. {TASK.group} 학생에게는 매칭할 수 없습니다 — 그 반 채점 때 처리됩니다. 우리 반 학생이면 {TASK.group} 답안지에 다시 쓰게 해 주세요.</div>;
    const pick = assignPick[penId] || '';
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)' }}>
        이 답안을
        <select value={pick} onChange={(e) => setAssignPick((p) => ({ ...p, [penId]: e.target.value }))} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', minWidth: 170 }}>
          <option value="">학생 선택</option>
          {ROSTER.map((s) => <option key={s.id} value={s.id}>{s.no} {s.name}</option>)}
        </select>
        의 답안으로
        <button type="button" disabled={!pick} style={{ ...primaryBtn(!!pick), padding: '5px 14px' }}
          onClick={() => { setManual((m) => ({ ...m, [penId]: pick })); setDupPick((d) => { const n = { ...d }; delete n[pick]; return n; }); setAssignPick((p) => ({ ...p, [penId]: '' })); }}>매칭</button>
      </div>
    );
  };

  const renderCradleAction = () => {
    if (sel?.type === 'absent') {
      const s = studentById(sel.sid);
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{s.name}</span><span style={{ color: '#94A3B8' }}>{s.grade}</span><span style={pill(BADGE.none)}>제외</span></div>
          <div style={noteBox('muted')}>거치된 펜에서 이 학생의 답안을 찾지 못해 채점에서 제외됩니다(미채점에 남습니다). 펜을 찾았다면 크래들에 꽂고 [↻ 다시 매칭]을 누르거나, 미분류 펜을 이 학생에게 매칭하세요.</div>
        </>
      );
    }
    const pen = connected.find((p) => p.id === sel?.penId);
    if (!pen) return <div style={{ color: '#94A3B8' }}>왼쪽 목록이나 크래들 슬롯에서 펜을 선택하세요.</div>;
    const info = cradleModel.penInfo[pen.id] || { kind: 'unread' };
    const k = PEN_KIND[info.kind];
    const st = info.sid ? studentById(info.sid) : null;
    const rivals = info.kind === 'dup' ? connected.filter((p) => p.id !== pen.id && cradleModel.penInfo[p.id]?.sid === info.sid && cradleModel.penInfo[p.id]?.kind === 'dup') : [];
    return (
      <>
        {renderLocationCard(pen)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#1E293B', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>슬롯 {slotShort(pen.slot)}</span>
          <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{st ? st.name : '학생 미지정'}</span>
          {st && <span style={{ color: '#94A3B8' }}>{st.grade}</span>}
          <span style={pill(k)}>{k.label}{info.kind === 'dup' ? ' — 중복 데이터' : ''}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {info.manual && <button type="button" style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => setManual((m) => { const n = { ...m }; delete n[pen.id]; return n; })}>매칭 해제</button>}
          </span>
        </div>
        {info.kind === 'dup' && (
          <div style={{ ...noteBox('warn'), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>⚠ 같은 학생에 두 펜이 붙었습니다.</strong> 이 펜과 슬롯 {rivals.map((r) => slotShort(r.slot)).join(' · ')} 펜이 모두 {st.name}(으)로 읽혔습니다. 아래 답안을 보고 정해 주세요.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={{ ...primaryBtn(true), padding: '5px 14px' }} onClick={() => setDupPick((d) => ({ ...d, [info.sid]: pen.id }))}>이 펜이 {st.name}의 답안입니다</button>
              <span style={{ color: '#94A3B8' }}>또는</span>
              {assignRow(pen.id)}
            </div>
          </div>
        )}
        {info.kind === 'unc' && (
          <div style={{ ...noteBox(info.noAssign ? 'muted' : 'warn'), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>⚠ {info.reason}</strong></div>
            {assignRow(pen.id, info.noAssign, pen.detected)}
          </div>
        )}
        {info.kind === 'noans' && <div style={noteBox('muted')}>답안지 학생정보는 읽혔지만 답안이 없습니다. 채점에서 제외됩니다.</div>}
        {info.kind === 'empty' && <div style={noteBox('muted')}>이 펜에는 필기가 없습니다. 채점 대상이 아닙니다.</div>}
        {info.kind === 'unread' && <div style={noteBox('info')}>판정 이후에 꽂은 펜이라 아직 읽지 않았습니다. 위의 [↻ 다시 매칭]을 눌러 주세요.</div>}
        {info.kind === 'ok' && <div style={noteBox('ok')}>✓ {st.name}의 답안으로 채점됩니다.{info.manual ? ' (직접 매칭)' : ''}</div>}
      </>
    );
  };

  const renderScanAction = () => {
    if (sel?.type === 'unc') {
      const scans = scanModel.unc.filter((r) => r.origin !== 'existing');
      const ex = scanModel.unc.filter((r) => r.origin === 'existing');
      const row = (r, i) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: '1px solid #F1F5F9', fontSize: 'var(--neo-font-size-xs)', background: previewPages()[pageIdx]?.id === r.id ? '#EFF6FF' : 'white' }}>
          <button type="button" onClick={() => setPageIdx(i)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.origin === 'existing' ? '📄 ' : '🖼 '}{r.name}</button>
          <span style={{ color: '#B91C1C', flex: 1.3 }}>{r.reason}</span>
          {r.origin === 'existing' && <button type="button" style={{ ...ghostBtn, padding: '2px 8px', color: '#2A75F3', borderColor: '#2A75F3' }} title="원래 문항으로 되돌립니다 — 그 자리의 스캔본은 미분류로 내려갑니다" onClick={() => restoreExisting(r)}>↩ 되돌리기</button>}
        </div>
      );
      return (
        <>
          <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>미분류 <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{scanModel.unc.length}장</span></div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>어느 문항에도 붙지 않아 채점되지 않습니다. 파일을 눌러 아래에서 확인한 뒤, 학생의 빈 자리에서 [답안지 선택]으로 지정하세요.</div>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 190, overflowY: 'auto' }}>
            {scans.length > 0 && <div style={{ padding: '6px 10px', fontWeight: 800, color: '#991B1B', fontSize: 'var(--neo-font-size-xs)' }}>미연결 스캔 {scans.length}장</div>}
            {scans.map((r) => row(r, scanModel.unc.indexOf(r)))}
            {ex.length > 0 && <div style={{ padding: '6px 10px', fontWeight: 800, color: '#0E7490', fontSize: 'var(--neo-font-size-xs)', borderTop: '1px solid #E2E8F0' }}>교체된 기존 답안 {ex.length}건</div>}
            {ex.map((r) => row(r, scanModel.unc.indexOf(r)))}
            {!scanModel.unc.length && <div style={{ padding: 10, color: '#94A3B8' }}>미분류 파일이 없습니다.</div>}
          </div>
        </>
      );
    }
    const s = scanModel.students.find((x) => x.id === sel?.id);
    if (!s) return <div style={{ color: '#94A3B8' }}>왼쪽에서 학생을 선택하세요.</div>;
    const pool = scanModel.unc.filter((r) => r.origin !== 'existing');
    const flat = s.qs.flatMap((x) => x.list);
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{s.name}</span>
          <span style={{ color: '#94A3B8' }}>{s.grade}</span><span style={pill(BADGE[s.badge])}>{s.badge === 'answer' ? '답안 있음' : BADGE[s.badge].label}</span>
        </div>
        {s.badge === 'none' && <div style={noteBox('muted')}>채점에서 제외됩니다 — 올린 파일에서 답안지를 한 장도 찾지 못했습니다. 채점하려면 빈 자리에서 미분류 답안지를 지정하세요.</div>}
        {s.badge === 'check' && <div style={noteBox('warn')}>⚠ {s.detail}. 빈 자리는 [답안지 선택]으로 채우고, 남는 장은 [✕]로 내려 주세요. AI가 문항을 추정한 장은 [확인]을 눌러 주세요.</div>}
        {s.badge === 'answer' && s.detail.startsWith('기존 답안 교체') && <div style={noteBox('info')}>🔄 학생이 이미 낸 답안 대신 스캔본으로 채점됩니다. 기존 답안으로 채점하려면 [미분류 파일]에서 [↩ 되돌리기]를 누르세요.</div>}
        {/* 문항 칩 — 한 줄로 압축. 누르면 아래 미리보기가 그 장으로 간다 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.qs.map((x) => {
            const empties = x.hasExisting ? 0 : Math.max(0, x.q.sheets - x.list.length);
            const bad = !s.absent && x.st !== 'ok';
            return (
              <div key={x.q.id} style={{ border: `1px solid ${bad ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: bad ? '#FEF2F2' : '#F8FAFC' }}>
                <strong style={{ fontSize: 'var(--neo-font-size-xs)' }}>{x.q.title}</strong>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: bad ? '#B91C1C' : '#94A3B8', fontWeight: 700 }}>{x.hasExisting ? '기존 답안' : `${x.list.length}/${x.q.sheets}장`}</span>
                {x.list.map((r, i) => (
                  <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 4px 1px 6px', borderRadius: 6, background: previewPages()[pageIdx]?.id === r.id ? '#DBEAFE' : 'white', border: `1px solid ${i >= x.q.sheets ? '#FCA5A5' : '#CBD5E1'}` }}>
                    <button type="button" onClick={() => setPageIdx(flat.indexOf(r))} title={r.name} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', padding: 0 }}>{r.origin === 'existing' ? '📄' : `${x.q.id}-${i + 1}`}</button>
                    {r.conf === 'medium' && <button type="button" title="AI가 문항을 추정했습니다. 확인했으면 누르세요" onClick={() => patchRow(r.id, { conf: 'high' })} style={{ border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 800, padding: '0 4px' }}>확인</button>}
                    <button type="button" title="연결 해제 — 미분류로 내립니다" onClick={() => unlinkRow(r)} style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✕</button>
                  </span>
                ))}
                {Array.from({ length: empties }, (_, i) => (
                  <select key={`e${i}`} value="" disabled={!pool.length}
                    onChange={(e) => { const r = pool.find((p) => p.id === e.target.value); if (r) patchRow(r.id, { sid: s.id, q: x.q.id, sheet: x.list.length + i + 1, conf: 'high', reason: null }); }}
                    style={{ padding: '1px 4px', borderRadius: 6, border: '1px dashed #F87171', background: 'white', color: '#B91C1C', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', maxWidth: 120 }}>
                    <option value="">＋ 답안지 선택</option>
                    {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ── 미리보기 페이지 목록 — 선택에 따라 ── */
  const previewPages = () => {
    if (!model || !sel) return [];
    if (source === 'cradle') {
      const pen = sel.type === 'pen' ? connected.find((p) => p.id === sel.penId) : null;
      if (!pen) return [];
      const info = cradleModel.penInfo[pen.id] || {};
      const handLabel = pen.scenario === 'no_ident' ? '' : pen.scenario === 'other_group' ? pen.ownerLabel : pen.scenario === 'not_in_roster' ? pen.read
        : (() => { const s = studentById(pen.identSid || pen.owner); return s ? `${s.grade} ${s.name}` : ''; })();
      return QUESTIONS.flatMap((q) => Array.from({ length: pen.pages[q.id] || 0 }, (_, i) => ({
        id: `${pen.id}-${q.id}-${i}`, label: `${q.title}-${i + 1}`, sub: `슬롯 ${slotShort(pen.slot)}`, studentLabel: handLabel, question: q.title, sheetNo: i + 1, kind: info.kind,
      })));
    }
    if (sel.type === 'unc') return scanModel.unc.map((r) => ({ id: r.id, label: r.name, sub: '미분류', url: files.find((f) => f.id === r.fid)?.url, studentLabel: r.origin === 'existing' ? `${studentById(r.home.sid).grade} ${studentById(r.home.sid).name}` : '', existing: r.origin === 'existing' }));
    const s = scanModel.students.find((x) => x.id === sel.id);
    if (!s) return [];
    return s.qs.flatMap((x) => x.list.map((r, i) => ({ id: r.id, label: r.origin === 'existing' ? `${x.q.title} · 기존 답안` : `${x.q.title}-${i + 1}`, sub: r.name, url: files.find((f) => f.id === r.fid)?.url,
      studentLabel: `${s.grade} ${s.name}`, question: x.q.title, sheetNo: i + 1, existing: r.origin === 'existing' })));
  };

  /** 큰 미리보기 — 매핑 영역 바로 아래. 선택하면 첫 장이 바로 뜬다 */
  const renderPreviewPane = () => {
    const pages = previewPages();
    const i = Math.min(pageIdx, Math.max(0, pages.length - 1));
    const pg = pages[i];
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)' }}>
          <strong>{source === 'scan' ? '파일 미리보기' : '답안 미리보기'}</strong>
          {pg && <span style={{ color: '#64748B', fontSize: 'var(--neo-font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{pg.label} · {pg.sub}</span>}
          {pages.length > 1 && (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
              <button type="button" disabled={i === 0} onClick={() => setPageIdx(i - 1)} style={{ ...ghostBtn, padding: '2px 10px', opacity: i === 0 ? 0.4 : 1 }}>◀</button>
              <strong style={{ fontSize: 'var(--neo-font-size-xs)' }}>{i + 1} / {pages.length}</strong>
              <button type="button" disabled={i >= pages.length - 1} onClick={() => setPageIdx(i + 1)} style={{ ...ghostBtn, padding: '2px 10px', opacity: i >= pages.length - 1 ? 0.4 : 1 }}>▶</button>
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#E2E8F0', padding: 16, display: 'flex', justifyContent: 'center' }}>
          {!pg && <div style={{ alignSelf: 'center', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>{sel ? '미리볼 답안이 없습니다.' : '왼쪽에서 선택하면 답안을 크게 볼 수 있습니다.'}</div>}
          {pg && (pg.url
            ? <img src={pg.url} alt={pg.label} style={{ maxWidth: '100%', alignSelf: 'flex-start', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'white' }} />
            : <div style={{ width: '100%', maxWidth: 720, alignSelf: 'flex-start' }}><SheetMock studentLabel={pg.studentLabel} question={pg.question} sheetNo={pg.sheetNo} answer={!pg.existing} /></div>)}
        </div>
      </div>
    );
  };

  /* ════════════ 렌더 ════════════ */
  const T = { cradle: '🖊 크래들 일괄 채점', scan: '📷 스캔 일괄 채점' }[source];
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
      {/* 헤더 — 공통 */}
      <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{T}</h2>
            <span style={{ padding: '1px 8px', borderRadius: 999, background: '#F5F3FF', color: '#6D28D9', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>통합 구조 시안</span>
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 4 }}>{TASK.team} / {TASK.title} · 그룹 <strong>{TASK.group}</strong> · 대상 학생 <strong>{ROSTER.length}명</strong></div>
        </div>
        {/* 입력 방식 — 바꾸면 처음부터 */}
        <div role="tablist" style={{ marginLeft: 'auto', display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
          {[['cradle', '🖊 크래들'], ['scan', '📷 스캔']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={source === k} type="button" onClick={() => source !== k && resetAll(k)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: source === k ? 'white' : 'transparent', boxShadow: source === k ? '0 1px 3px rgba(15,23,42,0.15)' : 'none', fontWeight: 800, color: source === k ? '#1E293B' : '#64748B', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => setIncidentOpen(true)} style={{ ...ghostBtn, color: '#B91C1C', borderColor: '#FCA5A5' }}>🚨 이용불편 접수</button>
      </div>

      {/* 단계 — 공통. 1단계 이름만 입력 방식에 따라 다르다 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
            background: i === stepIdx ? '#EFF6FF' : i < stepIdx ? '#F0FDF4' : 'white', color: i === stepIdx ? '#1D4ED8' : i < stepIdx ? '#047857' : '#94A3B8', border: '1px solid #E2E8F0' }}>
            {i < stepIdx ? '✓' : s.icon[source]} {i + 1}. {s[source]}
            {i === 0 && <span style={{ fontWeight: 500, fontSize: 'var(--neo-font-size-xs)', marginLeft: 6, opacity: 0.8 }}>(입력 방식별)</span>}
            {i === 1 && <span style={{ fontWeight: 500, fontSize: 'var(--neo-font-size-xs)', marginLeft: 6, opacity: 0.8 }}>(공통 구조)</span>}
          </div>
        ))}
      </div>

      {/* 본문 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {step === 'import' && (source === 'cradle' ? renderCradleImport() : renderScanImport())}

        {step === 'mapping' && reading && (
          <div style={{ ...card, padding: '56px 24px', textAlign: 'center' }}>
            <style>{'@keyframes bguSlide { 0% { left: -40%; } 100% { left: 100%; } }'}</style>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>{source === 'cradle' ? '펜 데이터를 읽고 있습니다.' : '답안지를 읽고 있습니다.'}</div>
            <div style={{ color: '#64748B', fontSize: 'var(--neo-font-size-sm)', marginTop: 6 }}>{source === 'cradle' ? `거치된 ${connected.length}자루의 필기를 확인합니다.` : `올린 ${files.length}개 파일의 답안지를 확인합니다.`}</div>
            <div style={{ position: 'relative', height: 8, maxWidth: 520, margin: '20px auto 10px', borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999, background: 'linear-gradient(90deg, rgba(42,117,243,0.15), #2A75F3, rgba(42,117,243,0.15))', animation: 'bguSlide 1.3s ease-in-out infinite' }} />
            </div>
            <div style={{ color: '#1D4ED8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>{READ_PHASES[source][readTick % READ_PHASES[source].length]} <span style={{ color: '#94A3B8', fontWeight: 400 }}>처리 중…</span></div>
          </div>
        )}

        {step === 'mapping' && !reading && model && (
          <>
            {renderSummaryBar()}
            {/* 3단 — 목록(크래들은 맨 위 미니맵) | 매핑(조치) | 미리보기. 각 열이 따로 스크롤한다 */}
            <div style={{ height: 'max(600px, calc(100vh - 300px))', display: 'flex', gap: 10 }}>
              {source === 'cradle' ? renderPenList() : renderStudentList()}
              <div style={{ ...card, flex: '1 1 0', minWidth: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                {source === 'cradle' ? renderCradleAction() : renderScanAction()}
              </div>
              <div style={{ ...card, flex: '1.15 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {renderPreviewPane()}
              </div>
            </div>
          </>
        )}

        {step === 'grading' && (
          <div style={{ ...card, padding: '44px 24px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>{gradingDone ? '채점이 완료되었습니다.' : 'AI가 채점하고 있어요.'}</div>
            <div style={{ color: '#64748B', fontSize: 'var(--neo-font-size-sm)', margin: '6px 0 16px' }}>학생 <strong style={{ color: '#2A75F3' }}>{gradedIds.length}명</strong> · 문항 <strong style={{ color: '#2A75F3' }}>{gradedIds.length * QUESTIONS.length}건</strong>을 채점 중입니다.</div>
            <div style={{ height: 8, maxWidth: 640, margin: '0 auto', background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: '#2A75F3' }} /></div>
            <div style={{ marginTop: 6, color: '#94A3B8' }}>{progress}%</div>
            {!gradingDone && elapsed >= 6 && (
              <div style={{ maxWidth: 560, margin: '16px auto 0', ...noteBox('info'), background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE', fontSize: 'var(--neo-font-size-sm)' }}>
                ☕ <strong>기다리지 않으셔도 됩니다.</strong> 창을 닫아도 채점은 계속 진행되고, 끝나면 하단 알림으로 알려 드립니다.
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div style={{ ...card, padding: '36px 24px', textAlign: 'center', background: '#F0FDF4', borderColor: '#86EFAC' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-lg)', color: '#065F46' }}>완료</div>
            <div style={{ color: '#047857', margin: '8px 0 14px' }}>
              채점 문항 <strong>{(gradedIds.length - failedIds.length) * QUESTIONS.length}건</strong> · 학생 <strong>{gradedIds.length - failedIds.length}명</strong>
              {failedIds.length > 0 && <span style={{ color: '#B91C1C' }}> · 실패 <strong>{failedIds.length}명</strong></span>}
            </div>
            {(failedIds.length > 0 || retrying) && (
              <div style={{ maxWidth: 620, margin: '0 auto 14px', textAlign: 'left', ...noteBox('warn'), fontSize: 'var(--neo-font-size-sm)' }}>
                {retrying ? '⏳ 실패한 답안을 다시 채점하고 있습니다…' : (
                  <>
                    <div><strong>⚠ {failedIds.length}명은 AI 채점에 실패했습니다.</strong> 답안 분량이 커서 <strong>토큰 용량을 초과</strong>했습니다(서버 응답 지연). 나머지 학생의 채점 결과는 정상 반영됐습니다.</div>
                    {/* 남는 것은 입력 방식마다 다르다 — 크래들은 펜 데이터, 스캔은 올린 답안지 */}
                    <div style={{ marginTop: 6, color: '#475569' }}>실패한 {failedIds.length}명은 <strong>미채점</strong>으로 자동 되돌려집니다. {source === 'cradle' ? '해당 펜의 데이터는 지우지 않았으니 같은 펜을 다시 거치해 이어서 채점할 수 있습니다.' : '올린 답안지는 그대로 보관되어 있어 파일을 다시 올리지 않고 이어서 채점할 수 있습니다.'}</div>
                    <button type="button" onClick={retry} style={{ ...primaryBtn(true), background: '#DC2626', marginTop: 8 }}>↻ 다시 시도</button>
                  </>
                )}
              </div>
            )}
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#065F46' }}>[확인]을 누르면 「채점 확인」 단계로 이동합니다.</div>
          </div>
        )}
      </div>

      {/* 푸터 — 공통. 왼쪽 버튼(되돌아가기)만 입력 방식별 */}
      <div style={{ ...card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--neo-font-size-sm)', color: '#B45309' }}>
          {step === 'import' && source === 'cradle' && !connected.length && <span style={{ color: '#94A3B8' }}>크래들에 펜을 1자루 이상 거치해야 다음 단계로 넘어갑니다.</span>}
          {step === 'import' && source === 'scan' && pendingSplit.length > 0 && <>⚠ 페이지 분리한 PDF {pendingSplit.length}개를 아직 목록에 넣지 않았습니다 — [업로드 목록에 추가] 또는 [버리기]를 눌러 주세요.</>}
          {step === 'import' && source === 'scan' && !pendingSplit.length && !files.length && <span style={{ color: '#94A3B8' }}>스캔 파일을 1개 이상 올려야 다음 단계로 넘어갑니다.</span>}
          {step === 'mapping' && !reading && model && (model.blocked ? model.blockReason : model.note)}
        </div>
        {step === 'import' && <button type="button" disabled={!canStartMapping} onClick={startReading} style={primaryBtn(canStartMapping)}>🔗 데이터 매핑 시작</button>}
        {step === 'mapping' && !reading && (
          <>
            <button type="button" style={ghostBtn} onClick={() => { setStep('import'); setSel(null); if (source === 'scan') { setRows([]); } }}>
              {source === 'cradle' ? '← 펜 다시 거치' : '↰ 파일 다시 선택'}
            </button>
            <button type="button" disabled={model?.blocked} onClick={startGrading} style={primaryBtn(!model?.blocked)}>🤖 {model?.gradable.length || 0}명 AI 채점 시작</button>
          </>
        )}
        {step === 'done' && <button type="button" onClick={() => resetAll(source)} style={{ ...primaryBtn(true), background: '#10B981' }}>✓ 확인</button>}
      </div>

      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 40, transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 50 }}>{toast}</div>}
      <IncidentReportDialog open={incidentOpen} onClose={() => setIncidentOpen(false)} onSubmitted={(r) => setToast(`이용불편 접수가 완료되었습니다 — ${r.id}`)}
        context={{ source: source === 'cradle' ? '크래들 일괄 채점(통합)' : '스캔 일괄 채점(통합)', school: '공주 고등학교', teacher: '김 b', teacherId: 'tch20261zim', teacherEmail: 'tch20261zim@gjhs.kr', task: TASK.title, group: TASK.group, studentCount: ROSTER.length }} />
    </div>
  );
};

export default BatchGradingUnified;
