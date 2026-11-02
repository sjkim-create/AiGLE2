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
import RequiredProgramModal, { isConnectDownloaded, markConnectDownloaded } from './RequiredProgramModal'; // [SCR-07] AiGLE Connect 실행 확인
import appLogger from './appLogger';
import { recordGradingSession } from './lib/penRawStore'; // [BRD-16] 펜 원본 진단 파일 (이용불편 접수 zip 첨부용)
import { openPdf, renderPages, splitErrorReason } from './lib/pdfSplit';
import CapacityHelpTip, { CapacityBlinkStyle } from './CapacityHelpTip';
import CradleImage from './CradleImage'; // 크래들 · 펜 실물 이미지 (채점 관리 크래들 일괄 채점과 같은 그림) // [SCR-07 v4.32] 저장 잔량 ? 툴팁

/* ─────────────── 공통 목 데이터 ─────────────── */
const BASE_TASK = { team: '미래혁신융합인재육성 프로젝트팀', title: '[국어] 작품의 주제와 인물의 심리 변화 분석하기', group: '1학년 1반', groupShort: '1-1반' };
const QUESTIONS = [
  { id: 1, title: '문항 1', sheets: 2 },
  { id: 2, title: '문항 2', sheets: 1 },
  { id: 3, title: '문항 3', sheets: 1 },
];
const NAMES = ['김민지', '이서준', '박하은', '최도윤', '정서연', '강지호', '조유나', '윤시우', '장하린', '임준서', '한지아', '오건우', '서예린', '신도현'];
/* 그룹 명단(GROUP)과 채점 대상(ROSTER)을 나눈다 — 교사는 미채점 탭에서 그룹을 고르고 학생을 선택해 들어온다.
 *   시연: 서예린(1-1-13)은 선택하지 않은 학생 → 그 학생의 답안은 「채점 목록에서 선택하지 않은 학생」(판정 #8)으로 미분류 */
const GROUP = NAMES.map((name, i) => ({ id: `s${i + 1}`, name, no: `1-1-${i + 1}`, grade: `1학년 1반 ${i + 1}번`, hasAnswer: i === 10 || i === 11 }));
/* 시연 학생 — 한 학생에 한 경우만 둔다 (2026-10-27)
 *   최도윤(3) 펜을 OCR이 정서연으로 잘못 읽음 → 정서연 중복 (최도윤은 다른 답안 없음)
 *   한지아(10) 학생 제출 + 펜 → 펜 답안으로 교체 · 오건우(11) 학생 제출만, 펜 없음 → 학생 제출로 채점 */
/* 채점 관리형 목록에서 들어오면 거기서 고른 학생이 ROSTER가 된다(컴포넌트 안에서 다시 정의). 아래는 단독 실행 기본값 */
const DEFAULT_ROSTER = GROUP.filter((s) => s.id !== 's13');
/** 목록 화면(GradingManagement unified)에 쓰는 학생 행 — 같은 목 명단을 그대로 공유한다 */
export const UNIFIED_GROUP_STUDENTS = GROUP.map((s) => ({ id: s.id, name: s.name, grade: s.grade, submitType: s.hasAnswer ? 'ocr' : 'pen', aiGrade: '-', teacherGrade: '-', status: '미채점', round: 1, history: [], aiCount: { 1: 0, 2: 0 }, sheetNo: `A-${String(GROUP.indexOf(s) + 1).padStart(4, '0')}` }));
const studentById = (id) => GROUP.find((s) => s.id === id);

const IDENT_UNREAD = '학생 미매칭 — 답안지 학생정보를 읽을 수 없습니다';
const NOT_IN_ROSTER = (read) => `학생 미매칭 — 답안지 학생정보의 학생이 명단에 없습니다 [읽음: ${read}]`;
const NOT_SELECTED = '학생 미매칭 — 채점 목록에서 선택하지 않은 학생입니다'; // 판정 #8
// [SCR-08 v1.62 · v1.63] 선택한 학생만 채점 — 셀렉트에는 선택한 학생만. OCR이 선택하지 않은 학생으로 읽은 펜도 선택한 학생에게는 매칭할 수 있다(오인식 대비)
const OTHER_TASK_PEN = '학생 미매칭 — 이 과제 데이터가 아닙니다';        // 판정 #3
const REPLACED = '학생 제출 답안 — 스캔본이 자리를 대신하고 있습니다';
/* 스캔 답안지 코드 — 과제당 1개가 아니라 장마다 1개 (SCR-05 v4.4) */
const SHEET_CODES = (() => { let n = 594; return QUESTIONS.flatMap((q) => Array.from({ length: q.sheets }, (_, i) => ({ q: q.id, page: i + 1, code: String(n++).padStart(8, '0') }))); })();
/* AiGLE Connect 실행 여부 — 한 번 확인되면 이 창을 다시 열어도 확인 창을 띄우지 않는다 (세션 기억) */
let connectorSessionReady = false;

const BADGE = {
  ok: { label: '정상', bg: '#F0FDF4', border: '#86EFAC', color: '#166534', dot: '#22C55E' },
  check: { label: '확인 필요', bg: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C', dot: '#EF4444' },
  answer: { label: '학생 제출', bg: '#ECFEFF', border: '#A5F3FC', color: '#0E7490', dot: '#06B6D4' },
  none: { label: '제외', bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B', dot: '#CBD5E1' },
  submitted: { label: '학생 제출', bg: '#ECFEFF', border: '#A5F3FC', color: '#0E7490', dot: '#06B6D4' }, // [SCR-08 v1.19] 펜은 없지만 학생이 낸 답안
};

const STEPS = [
  { key: 'import', cradle: '펜 연결', scan: '파일 업로드', icon: { cradle: '🔌', scan: '📁' } }, // [SCR-08 v1.20] 크래들 · USB 펜 모두
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
/* [SCR-08 v1.19] USB 펜 1자루 — 크래들 없이 USB로 연결한 펜은 가상 슬롯 0 */
const USB_SLOT = 0;
const slotShort = (slot) => (slot === USB_SLOT ? 'USB' : `${cradleOf(slot)}-${slotIn(slot)}`);
const fullPages = () => ({ 1: 2, 2: 1, 3: 1 });

/** 펜 재고 — 교실에서 실제로 겪는 경우를 섞는다 (SCR-07 판정 규칙의 조건들) */
const buildPens = () => {
  const pens = [];
  const add = (p) => pens.push({
    id: `PEN-${String(pens.length + 1).padStart(3, '0')}`, slot: pens.length + 1,
    battery: [92, 85, 74, 61, 88, 57, 96, 43, 79, 68][pens.length % 10],
    firmware: pens.length === 2 ? '2.0.5' : '2.1.0', needsUpdate: pens.length === 2,
    flaky: pens.length === 16, pages: {}, // [SCR-08 v1.46] 인식 실패 시연 = 빈 펜(슬롯 2-7) — 장하린 「답안 없음」 펜과 겹치지 않게
    /* [SCR-07 v4.23] 저장 잔량(%) — 20% 미만 주의 · 10% 미만 위험. 채점 성공으로 데이터가 지워지면 회복 */
    capacity: Math.min(96, [88, 62, 36, 79, 17, 53, 7, 29, 45, 70][pens.length % 10] + (pens.length >= 10 ? 15 : 0)),
    extraBooks: [], ...p,
  });
  /* 한 펜에는 1~5반 답안이 함께 들어 있다 — 비정상 펜은 다른 반 답안까지 열람한다(매칭은 못 함) */
  const otherClasses = [{ label: '1학년 3반', owner: '1학년 3반 6번 김서준', pages: 2 }, { label: '1학년 4반', owner: '1학년 4반 3번 이도윤', pages: 1 }];
  GROUP.forEach((s, i) => {
    if (i === 5) return;                                                      // 결석 — 펜 없음
    if (i === 11) return;                                                     // 펜 없음 — 학생 제출(키보드 · 파일)로 이미 냄
    if (i === 1) return add({ scenario: 'no_ident', owner: s.id, pages: fullPages(), extraBooks: otherClasses });
    if (i === 3) return add({ scenario: 'ok', owner: s.id, identSid: GROUP[4].id, pages: fullPages() }); // 답안지엔 최도윤 — OCR이 정서연으로 잘못 읽음 → 중복
    if (i === 8) return add({ scenario: 'no_answer', owner: s.id, identSid: s.id, pages: {} });
    return add({ scenario: 'ok', owner: s.id, identSid: s.id, pages: fullPages() });
  });
  add({ scenario: 'other_group', pages: fullPages(), detected: '1-2반', ownerLabel: '1학년 2반 4번 한서윤', extraBooks: otherClasses });
  add({ scenario: 'other_task', pages: fullPages(), ownerLabel: '1학년 1반 7번 조유나' });   // 판정 #3 — 다른 과제에 쓴 펜
  add({ scenario: 'not_in_roster', pages: fullPages(), read: '1학년 1반 31번 오세훈' });
  add({ scenario: 'empty', pages: {} });
  add({ scenario: 'empty', pages: {} });
  return pens;
};
const PEN_POOL = buildPens();
/* [SCR-08 v1.63 · v1.64] 채점이 정상 완료돼 데이터를 지운 펜(펜 답안으로 채점한 펜 + 학생 제출로 되돌려 쓰지 않은 그 학생의 펜) { penId: 채점된 학생 id } — 화면을 나갔다 다시 들어와도 남는다(실제로는 펜 안이 비어 있다).
 *   다시 꽂으면 미분류로 답안을 보여 주지 않고 「데이터 삭제」로 둔다 */
const ERASED_PENS = new Map(); // [SCR-08 v1.65 · 판정 규칙 v2.3] 채점 기록 = 펜 식별번호 → 채점한 학생 (시연 과제 하나라 과제 구분 생략)
const eraseGraded = (list) => list.forEach((x) => { if (x.penId) ERASED_PENS.set(x.penId, x.sid); });
/** [SCR-08 v1.20] 미채점 목록의 「상태」 — 학생 제출(학생이 낸 답안) · 데이터 있음(펜 필기가 있음) · 데이터 없음 */
export const UNIFIED_DATA_STATE = Object.fromEntries(GROUP.map((s) => [s.id,
  s.hasAnswer ? '학생 제출' : PEN_POOL.some((p) => p.owner === s.id && Object.values(p.pages).some((n) => n > 0)) ? '데이터 있음' : '데이터 없음']));
const penPageCount = (p) => Object.values(p.pages).reduce((a, n) => a + n, 0);
const capTone = (pct) => (pct < 10 ? { color: '#991B1B', bar: '#DC2626' } : pct < 20 ? { color: '#B45309', bar: '#F59E0B' } : { color: '#166534', bar: '#10B981' });

/* ─────────────── 스캔 목 데이터 ─────────────── */
const buildScanPlan = () => {
  const plan = [];
  GROUP.forEach((s, i) => {
    if (i === 5 || i === 8) return;                // 결석생(강지호) · 답안 없음(장하린) — 한 장도 없음 → 채점 제외 (미채점 「데이터 없음」과 같게)
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
const CradleStrip = ({ compact, docked, dotOf, labelOf, selectedSlots = [], onSlot, pool }) => {
  const wellH = compact ? 34 : 110;
  const penH = compact ? 42 : 150;
  const slotW = compact ? 18 : 28; // 3대가 노트북 폭에서 한 줄에 들어가게
  return (
    <div style={{ display: 'flex', columnGap: compact ? 10 : 14, rowGap: compact ? 10 : 80, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center', paddingBottom: compact ? 14 : 56 }}>
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
                  {/* [SCR-07 v4.23] 슬롯 아래 라벨 — 1단계는 연결 중 → 저장 잔량 % */}
                  {pen && labelOf && (() => { const lb = labelOf(pen); return lb ? (
                    <div className={lb.blink ? 'cap-blink' : undefined} style={{ position: 'absolute', left: '50%', top: wellH + 50, transform: 'translateX(-50%)', whiteSpace: 'nowrap', padding: '1px 6px', borderRadius: 999, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: lb.bg, color: lb.color }}>{lb.text}</div>
                  ) : null; })()}
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
/* 쓴 사람마다 답안 내용과 글씨가 다르다 — 같은 이름이 적힌 답안지(중복)도 내용·글씨로 가려낼 수 있게 */
const ANSWER_SETS = [
  ['작품 속 인물은 처음에 현실을 받아들이지 못하지만', '사건을 겪으며 태도가 점점 달라진다.', '이 변화가 작품의 주제를 드러낸다고 생각한다.', '특히 마지막 장면의 선택이 가장 중요하다.'],
  ['주인공은 가족을 지키려고 끝까지 버틴다.', '처음엔 두려워하지만 점점 용기를 낸다.', '나라면 그렇게 하지 못했을 것 같다.', '작가는 희생의 의미를 말하고 싶었던 것 같다.'],
  ['인물의 심리는 세 단계로 변한다.', '① 부정 ② 갈등 ③ 수용', '갈등 단계에서 친구와의 대화가 전환점이다.', '따라서 주제는 「관계 속의 성장」이다.'],
  ['이 소설은 결국 선택에 대한 이야기다.', '인물은 쉬운 길 대신 어려운 길을 고른다.', '그 이유는 자존심 때문이라고 본다.', '마지막 문장이 여운을 남긴다.'],
  ['처음 부분의 배경 묘사가 분위기를 만든다.', '비 오는 장면은 인물의 슬픔을 나타낸다.', '후반부에 날씨가 맑아지는 것도 의미가 있다.', '심리 변화를 날씨로 보여준 점이 좋았다.'],
];
const HAND_STYLES = [
  { transform: 'skewX(-6deg)', color: '#1E293B', letterSpacing: 0 },
  { transform: 'skewX(8deg)', color: '#1E3A8A', letterSpacing: '1.5px', fontWeight: 700 },
  { transform: 'rotate(-1deg)', color: '#334155', letterSpacing: '-0.5px' },
  { transform: 'skewX(-12deg)', color: '#0F172A', letterSpacing: '2px' },
  { transform: 'none', color: '#1E40AF', letterSpacing: '0.5px', fontWeight: 600 },
];
const SheetMock = ({ studentLabel, question, sheetNo, small, answer, writer = 0 }) => {
  const lines = ANSWER_SETS[writer % ANSWER_SETS.length];
  const hand = HAND_STYLES[writer % HAND_STYLES.length];
  return (
  <div style={{ background: 'white', borderRadius: 6, padding: small ? '8px 8px' : '18px 20px', boxShadow: small ? 'none' : '0 4px 12px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: small ? 3 : 8, height: small ? '100%' : 'auto', minHeight: small ? 0 : '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
    <div style={{ fontSize: small ? 9 : 14, fontWeight: 900, color: '#1E3A8A' }}>AiGLE</div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: small ? 8 : 12 }}>
      <tbody>
        <tr><td style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', padding: small ? 1 : '4px 6px', fontWeight: 700 }}>학생</td><td style={{ border: '1px solid #CBD5E1', padding: small ? 1 : '4px 6px', color: '#1E3A8A', fontFamily: '"Nanum Pen Script", "Gaegu", cursive', fontSize: small ? 8 : 18 }}><span style={{ display: 'inline-block', ...hand }}>{studentLabel || '(   )학년 (   )반 (   )번'}</span></td></tr>
        <tr><td style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', padding: small ? 1 : '4px 6px', fontWeight: 700 }}>문항</td><td style={{ border: '1px solid #CBD5E1', padding: small ? 1 : '4px 6px' }}>{question ? `${question} · ${sheetNo}장` : '__'}</td></tr>
      </tbody>
    </table>
    {Array.from({ length: small ? 5 : 12 }, (_, i) => (
      <div key={i} style={{ borderBottom: '1px dashed #CBD5E1', height: small ? 6 : 32, flex: 'none', display: 'flex', alignItems: 'flex-end', paddingLeft: 8, overflow: 'hidden' }}>
        {answer && !small && i < lines.length && <span style={{ fontFamily: '"Nanum Pen Script", "Gaegu", cursive', fontSize: 19, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '100%', ...hand }}>{lines[(i + (sheetNo || 0) - 1 + lines.length) % lines.length]}</span>}
      </div>
    ))}
  </div>
  );
};

/* ════════════════════════════════════════════════════════════
 * 본 화면
 * ════════════════════════════════════════════════════════════ */
// onRosterChange — 채점 대상(ROSTER)이 바뀌면 알린다(목록 화면 왼쪽 열의 「채점 대상 학생」)
const BatchGradingUnified = ({ initialSource = 'cradle', targetIds, task, onExit, onCompleted, onRosterChange } = {}) => {
  const TASK = task ? { ...BASE_TASK, ...task } : BASE_TASK; // 목록에서 고른 과제명을 그대로 쓴다
  /* 채점 관리와 같은 목록에서 [크래들 일괄 채점]/[스캔 채점] 버튼으로 들어온다 — 고른 학생만 대상 */
  /* [SCR-08 v1.62] 선택한 학생만 채점한다 — 매핑 중 선택하지 않은 학생을 채점 대상에 더하지 않는다(舊 v1.3 「매칭하면 채점 대상에 추가」 폐기) */
  const ROSTER = React.useMemo(() => (targetIds ? GROUP.filter((s) => targetIds.includes(s.id)) : DEFAULT_ROSTER), [targetIds]);
  const addTarget = () => {}; // 채점 대상은 목록에서 고른 학생으로 고정
  useEffect(() => { onRosterChange?.(ROSTER.map((s) => s.id)); }, [ROSTER]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 학생 선택 목록 — 미채점 목록에서 선택한 학생만 [SCR-08 v1.62] */
  const studentOptions = () => ROSTER.map((s) => <option key={s.id} value={s.id}>{s.no} {s.name}</option>);
  const isTarget = (sid) => ROSTER.some((s) => s.id === sid);
  const fromList = !!onExit;
  const [source, setSource] = useState(initialSource); // 'cradle' | 'scan'
  const [step, setStep] = useState('import');
  const [reading, setReading] = useState(false);
  const [readTick, setReadTick] = useState(0);
  const [sel, setSel] = useState(null);         // { type: 'student' | 'unc', id }
  const [tab, setTab] = useState('all');
  const [pageIdx, setPageIdx] = useState(0);    // 우측 큰 미리보기의 장 번호 — 선택이 바뀌면 0
  /* 미리보기는 장을 세로로 잇는다 — 장 번호가 바뀌면 그 장으로 스크롤 */
  const pvTargetRef = useRef(null);
  useEffect(() => {
    const id = pvTargetRef.current;
    const el = id && document.getElementById(id);
    // 페이지 전체가 튀지 않게 미리보기 상자 안에서만 스크롤한다
    if (el?.parentElement) el.parentElement.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
  }, [pageIdx, sel]);
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
  const [link, setLink] = useState('cradle');    // [SCR-08 v1.19] 연결 방식 — 'cradle' | 'usb'(펜 1자루)
  const [useSubmitted, setUseSubmitted] = useState([]); // [SCR-08 v1.40] 펜 답안 대신 학생 제출 답안으로 채점할 학생(되돌리기)
  const [usbIdx, setUsbIdx] = useState(0);       // 시연 — 지금 USB에 꽂을 펜(PEN_POOL 순서). 누구 펜인지는 매핑 뒤에 안다
  const [usbFail, setUsbFail] = useState(false); // USB 인식 실패 — 케이블을 다시 꽂아야 한다
  const [unrecognized, setUnrecognized] = useState([]);
  const failedDock = useRef(new Set());
  const [judged, setJudged] = useState([]);      // 마지막 판정에 들어간 펜 id
  const [manual, setManual] = useState({});      // { penId: sid } 직접 매칭
  const [dupPick, setDupPick] = useState({});    // { sid: penId } 중복 해소 — 고른 펜
  const [assignPick, setAssignPick] = useState({});
  const [changePen, setChangePen] = useState(null); // 정상 펜 「학생 변경」 펼침
  const [fwDone, setFwDone] = useState({});
  const [fwProg, setFwProg] = useState({});      // 펌웨어 업데이트 진행률 { penId: % }
  const [deletedPens, setDeletedPens] = useState([]); // 채점 성공으로 데이터가 지워진 펜 — 배지 「데이터 삭제」 · 잔량 회복
  // AiGLE Connect — 'checking' | 'ready' | 'blocked'
  const [connector, setConnector] = useState(connectorSessionReady ? 'ready' : 'checking');
  const [programOpen, setProgramOpen] = useState(false);
  // 채점 대상 스냅숏 — 채점 중·완료 목록용 { sid, slot?, penId? }
  const [gradedList, setGradedList] = useState([]);
  // 확인창 — { kind: 'switch' | 'replace' | 'overwrite', next? }
  const [confirm, setConfirm] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);  // 스캔 — 펼친 장 메뉴(행 id)
  const [showCodes, setShowCodes] = useState(false);

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

  useEffect(() => {
    if (source !== 'cradle' || step !== 'import' || connector !== 'checking') return undefined;
    const t = setTimeout(() => {
      if (connectorSessionReady) { setConnector('ready'); return; }
      setConnector('blocked'); setProgramOpen(true);
      appLogger.warn('aigle-connect-socket', 'AiGLE Connect 미실행 — 필수 프로그램 확인 창');
    }, 1200);
    return () => clearTimeout(t);
  }, [source, step, connector]);

  /* [확인] — 목록에서 들어왔으면 채점된 학생을 「채점 확인」으로 넘기고 목록으로 돌아간다 */
  /* 채점 완료 = 실패하지 않은 학생 (스캔은 전 문항이 채점된 학생만) */
  const doneSids = source === 'scan'
    ? gradedList.filter((g) => g.full && !failedIds.includes(g.sid)).map((g) => g.sid)
    : gradedIds.filter((id) => !failedIds.includes(id));
  const finishDone = () => {
    if (!fromList) { resetAll(source); return; }
    onCompleted?.(doneSids);
    onExit();
  };

  const resetAll = (nextSource = source) => {
    setSource(nextSource); setStep('import'); setReading(false); setSel(null); setTab('all');
    setProgress(0); setGradingDone(false); setGradedIds([]); setFailedIds([]); setRetrying(false); failedOnce.current = false;
    setDocked({}); setUnrecognized([]); failedDock.current = new Set(); setJudged([]); setManual({}); setDupPick({}); setAssignPick({}); setFwDone({}); setFwProg({}); setDeletedPens([]);
    setGradedList([]); setConfirm(null); setRowMenu(null); setShowCodes(false); setUseSubmitted([]);
    if (nextSource === 'cradle' && !connectorSessionReady) setConnector('checking');
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
  /* [SCR-08 v1.19] USB 펜 1자루 — 한 번에 한 자루. 다른 펜을 연결하면 바꿔 끼운 것으로 본다(다시 매칭 필요) */
  const usbPen = docked[USB_SLOT] || null;
  /* 펜을 꽂는 순간에는 누구의 펜인지 모른다 — 펜 번호(기기)만 보이고, 학생은 [데이터 매핑 시작] 뒤 답안지 학생정보로 안다 */
  const connectUsb = (idx = usbIdx) => {
    const base = PEN_POOL[idx % PEN_POOL.length];
    const willFail = base.flaky && !failedDock.current.has(base.id); // 처음 한 번은 인식 실패(케이블 접촉) — 다시 꽂으면 된다
    if (willFail) failedDock.current.add(base.id);
    setUsbFail(false);
    setDocked({ [USB_SLOT]: { ...base, slot: USB_SLOT, usb: true, link: 'linking' } });
    setTimeout(() => {
      if (willFail) { setDocked({}); setUsbFail(true); return; }
      setDocked((prev) => (prev[USB_SLOT] ? { [USB_SLOT]: { ...prev[USB_SLOT], link: 'connected' } } : prev));
    }, 700);
  };
  /* 케이블을 빼면 다음에 꽂는 펜은 다른 펜이다(시연 — 펜 순서대로). 인식 실패 뒤 다시 꽂으면 같은 펜 */
  const unplugUsb = () => { undockPen(USB_SLOT); setUsbFail(false); setUsbIdx((i) => (i + 1) % PEN_POOL.length); };
  /** USB 에뮬레이터 — PC · 케이블 · 펜. LED 노랑 깜박임 = 연결 중 · 초록 = 정상 · 빨강 = 데이터 없음 / 배터리 부족 / 저장 잔량 부족 · 인식 실패 */
  const renderUsbEmulator = (compact = false) => {
    const pen = usbPen;
    const linking = pen && pen.link === 'linking';
    const cap = pen ? capacityOf(pen) : 100;
    const redWhy = pen && !linking ? [!penPageCount(pen) && '데이터 없음', pen.battery < 30 && `배터리 부족 ${pen.battery}%`, cap < 20 && `저장 잔량 부족 ${cap}%`].filter(Boolean) : [];
    const led = usbFail ? '#EF4444' : !pen ? '#CBD5E1' : linking ? '#FBBF24' : redWhy.length ? '#EF4444' : '#22C55E';
    const plugged = !!pen;
    const s = compact ? 0.6 : 1;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: compact ? '2px 0' : '12px 0' }}>
        <style>{'@keyframes usbBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }'}</style>
        {/* PC */}
        <div style={{ width: 92 * s, height: 62 * s, borderRadius: 8 * s, background: '#1E293B', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11 * s, fontWeight: 800, position: 'relative', flex: 'none' }}>
          <span style={{ fontSize: 20 * s }}>💻</span>이 PC
          <span style={{ position: 'absolute', right: -4 * s, top: '50%', transform: 'translateY(-50%)', width: 8 * s, height: 14 * s, background: '#64748B', borderRadius: 2 }} />
        </div>
        {/* 케이블 */}
        <div style={{ width: (compact ? 70 : 150) * s, height: 4 * s, background: plugged ? '#334155' : 'transparent', borderTop: plugged ? 'none' : `${3 * s}px dashed #CBD5E1`, flex: 'none' }} />
        {/* 펜 */}
        <button type="button" onClick={() => (plugged ? unplugUsb() : connectUsb())}
          title={plugged ? `펜 ${pen.id} — 누르면 케이블을 뺍니다. 다시 누르면 다른 펜을 꽂습니다(시연)` : '누르면 펜을 USB 케이블에 꽂습니다(에뮬레이터)'}
          aria-label={plugged ? `USB 펜 ${pen.id} 연결 해제` : 'USB 펜 꽂기'}
          style={{ display: 'flex', alignItems: 'center', gap: 6 * s, height: 30 * s, padding: `0 ${12 * s}px 0 ${6 * s}px`, borderRadius: `${4 * s}px ${16 * s}px ${16 * s}px ${4 * s}px`, border: `2px ${plugged ? 'solid' : 'dashed'} ${plugged ? '#0F172A' : '#CBD5E1'}`, background: plugged ? '#334155' : 'white', color: plugged ? 'white' : '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 * s, fontWeight: 800, flex: 'none' }}>
          <span style={{ width: 10 * s, height: 10 * s, borderRadius: '50%', background: led, boxShadow: led !== '#CBD5E1' ? `0 0 ${6 * s}px ${led}` : 'none', animation: linking || usbFail ? 'usbBlink 0.8s ease-in-out infinite' : 'none' }} />
          {plugged ? `펜 ${pen.id}` : '펜을 꽂으세요'}
          <span style={{ width: 26 * s, height: 3 * s, background: plugged ? '#94A3B8' : '#E2E8F0', borderRadius: 2 }} />
        </button>
      </div>
    );
  };
  const switchLink = (k) => {
    if (k === link) return;
    setLink(k); setDocked({}); setUnrecognized([]); setJudged([]); setManual({}); setDupPick({}); setSel(null);
  };
  const connected = Object.values(docked).filter((p) => p.link === 'connected').sort((a, b) => a.slot - b.slot);
  const capacityOf = (p) => (deletedPens.includes(p.id) || ERASED_PENS.has(p.id) ? 99 : p.capacity);
  /* 펌웨어 업데이트 — 진행 막대. 채점의 필수 요건은 아니다 */
  const runFirmware = (penId) => {
    if (fwProg[penId] != null || fwDone[penId]) return;
    let v = 0;
    setFwProg((x) => ({ ...x, [penId]: 0 }));
    const iv = setInterval(() => {
      v += 10;
      setFwProg((x) => ({ ...x, [penId]: v }));
      if (v >= 100) { clearInterval(iv); setFwProg((x) => { const n = { ...x }; delete n[penId]; return n; }); setFwDone((x) => ({ ...x, [penId]: true })); }
    }, 120);
  };

  /* ════════════ 크래들 — 판정 모델 ════════════ */
  const cradleModel = useMemo(() => {
    if (source !== 'cradle') return null;
    const unread = connected.filter((p) => !judged.includes(p.id));
    const read = connected.filter((p) => judged.includes(p.id));
    const bySid = {};
    const unc = [];
    const empty = [];
    const erased = [];
    read.forEach((p) => {
      if (ERASED_PENS.has(p.id)) { erased.push(p); return; } // [SCR-08 v1.63] 채점 완료로 지운 펜 — 답안 데이터 없음
      const m = manual[p.id];
      if (m) { (bySid[m] = bySid[m] || []).push({ pen: p, manual: true }); return; }
      if (p.scenario === 'empty') { empty.push(p); return; }
      if (p.scenario === 'other_group') { unc.push({ id: p.id, pen: p, reason: `그룹 불일치 [감지: ${p.detected} → 선택: ${TASK.groupShort}]`, noAssign: `${p.detected} 답안지입니다. ${TASK.group} 학생에게는 매칭할 수 없습니다 — 그 반 채점 때 처리됩니다. 우리 반 학생이면 ${TASK.group} 답안지에 다시 쓰게 해 주세요.` }); return; }
      if (p.scenario === 'other_task') { unc.push({ id: p.id, pen: p, reason: OTHER_TASK_PEN, noAssign: '다른 과제에 쓴 데이터라 이 과제에 매칭할 수 없습니다. 해당 과제에서 채점하세요.' }); return; }
      if (p.scenario === 'no_ident') { unc.push({ id: p.id, pen: p, reason: IDENT_UNREAD }); return; }
      if (p.scenario === 'not_in_roster') { unc.push({ id: p.id, pen: p, reason: NOT_IN_ROSTER(p.read) }); return; }
      if (!isTarget(p.identSid)) { unc.push({ id: p.id, pen: p, reason: NOT_SELECTED }); return; } // 판정 #8
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
      /* [SCR-08 v1.19] 펜이 없어도 학생이 이미 낸 답안(키보드 · 파일)이 있으면 그 답안으로 채점한다 */
      if (list.length === 0 && s.hasAnswer) return { ...s, badge: 'submitted', detail: '학생 제출 — 학생이 낸 답안으로 채점합니다', pens: [], submitted: true };
      if (list.length === 0) return { ...s, badge: 'none', detail: '채점 제외 — 거치된 펜에서 이 학생의 답안을 찾지 못했습니다', pens: [] };
      if (list.length >= 2) return { ...s, badge: 'check', detail: `중복 데이터 — 슬롯 ${list.map((x) => slotShort(x.pen.slot)).join(' · ')}`, pens: list, dup: true };
      const { pen, manual: mm } = list[0];
      /* [SCR-08 v1.40] 학생 제출 답안이 있는 학생 — 스캔과 같은 규칙: 새 데이터(펜) 우선, 학생 제출 답안은 [↩ 되돌리기]로 언제든 */
      if (!penPageCount(pen) && s.hasAnswer) { empty.push(pen); return { ...s, badge: 'submitted', detail: '학생 제출 — 펜에 필기가 없어 학생이 낸 답안으로 채점합니다', pens: [], submitted: true }; }
      if (!penPageCount(pen)) return { ...s, badge: 'none', detail: '답안 없음 — 답안지 미작성', pens: list };
      if (s.hasAnswer && useSubmitted.includes(s.id)) {
        unc.push({ id: pen.id, pen, reason: `학생 제출 답안으로 채점 — ${s.name}의 이 펜 답안은 쓰지 않습니다` });
        return { ...s, badge: 'submitted', detail: '학생 제출 — 펜 답안 대신 학생이 낸 답안으로 채점합니다', pens: [], submitted: true, restored: true, restoredPenId: pen.id }; // [SCR-08 v1.64] 채점이 끝나면 이 펜도 지운다
      }
      return { ...s, badge: 'ok', detail: `펜 연결 · 슬롯 ${slotShort(pen.slot)}${mm ? ' · 직접 매칭' : ''}${s.hasAnswer ? ' · 학생 제출 답안 교체' : ''}`, pens: list, replacedSubmitted: !!s.hasAnswer };
    });
    const gradable = students.filter((s) => s.badge === 'ok' || s.badge === 'submitted');
    const dups = students.filter((s) => s.dup);
    const blocked = !!unread.length ? false : (dups.length > 0 || gradable.length === 0);
    const blockReason = dups.length ? `⚠ 중복 데이터 ${dups.length}건을 먼저 풀어 주세요. 답안을 보고 이 학생의 답안을 고르면 풀립니다.`
      : '⚠ 채점할 수 있는 펜이 없습니다. 펜을 거치한 뒤 [다시 매칭]을 누르거나, 미분류 답안을 학생에게 직접 매칭해 주세요.';
    const excluded = students.filter((s) => s.badge === 'none').length;
    /* [v2] 목록이 펜(슬롯) 단위라 펜마다 상태를 둔다 — 중복은 두 행, 미분류는 자기 크래들 자리에 보인다 */
    const penInfo = {};
    unread.forEach((p) => { penInfo[p.id] = { kind: 'unread' }; });
    empty.forEach((p) => { penInfo[p.id] = { kind: 'empty' }; });
    erased.forEach((p) => { penInfo[p.id] = { kind: 'erased', gradedSid: ERASED_PENS.get(p.id) }; });
    unc.forEach((u) => { penInfo[u.id] = { kind: 'unc', reason: u.reason, noAssign: u.noAssign }; });
    students.forEach((s) => s.pens.forEach((x) => { penInfo[x.pen.id] = { kind: s.dup ? 'dup' : s.badge === 'none' ? 'noans' : 'ok', sid: s.id, manual: !!x.manual }; }));
    const absent = students.filter((s) => s.pens.length === 0 && !s.submitted);
    const submitted = students.filter((s) => s.submitted);
    return { students, unc, empty, erased, unread, gradable, penInfo, absent, submitted, blocked: blocked || unread.length > 0, blockReason: unread.length ? `⚠ 아직 읽지 않은 펜 ${unread.length}자루가 있습니다 — 자동으로 읽는 중입니다.` : blockReason,
      note: excluded ? `⚠ 학생 ${excluded}명이 채점 대상에서 제외됩니다 — 거치된 펜에서 이 학생들의 답안을 찾지 못했거나 답안이 없습니다.` : '',
      manifest: `채점을 시작하면 채점 대상 ${gradable.length}명의 답안만 서버로 올라갑니다. 나머지 펜은 올리지 않고 펜 데이터도 지우지 않습니다.` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, docked, judged, manual, dupPick, deletedPens, ROSTER, useSubmitted]);

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
        return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason, noAssign: p.fault === 'other_task' };
      }
      if (!isTarget(p.sid)) return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason: NOT_SELECTED, readAs: p.sid };
      taken.add(`${p.sid}:${p.q}`);
      return { id: `r${f.id}`, fid: f.id, name: f.name, sid: p.sid, q: p.q, sheet: p.page, conf: (i === 3 || i === 30) ? 'medium' : 'high' }; // AI가 문항을 추정한 답안지 2장 (시연)
    });
    const existing = ROSTER.filter((s) => s.hasAnswer).flatMap((s) => QUESTIONS.map((q) => {
      const attach = !taken.has(`${s.id}:${q.id}`);
      return { id: `e${s.id}${q.id}`, name: `${s.name} 학생 제출 답안 · ${q.title}`, origin: 'existing', home: { sid: s.id, q: q.id }, sid: attach ? s.id : null, q: attach ? q.id : null, conf: 'high', reason: attach ? null : '학생 제출 답안 — 스캔본이 자리를 대신하고 있습니다' };
    }));
    setRows([...out, ...existing]);
    // [SCR-05 v4.12] 판별 직후 교체 의사 1회 확인 — 전체 스캔으로 학생 제출 답안이 밀려났을 때
    if (existing.some((r) => r.sid == null)) setConfirm({ kind: 'replace' });
    appLogger.info('scan-ocr', '답안지 판별 완료', { files: out.length, unassigned: out.filter((r) => r.sid == null).length });
  };
  /* ── [SCR-09 v1.30] 매핑 중 파일 추가 — 펜의 [↻ 다시 매칭]처럼, 이전 화면으로 돌아가지 않고 파일을 더 올린다.
   *    새로 올린 파일만 판별해 목록에 더하고, 이미 정한 매칭 · 교사 지정은 그대로 둔다.
   *    여러 쪽 PDF는 쪽을 나눠(빈 쪽 제외) 바로 넣는다. 새 스캔본이 학생 제출 답안 자리를 차지하면 학생 제출 답안은 미분류로(되돌리기 가능) */
  const mapFileRef = useRef(null);
  const [pendingJudge, setPendingJudge] = useState(false);
  const judgeNewFiles = () => {
    const seen = new Set(rows.filter((r) => r.fid != null).map((r) => r.fid));
    const fresh = files.filter((f) => !seen.has(f.id));
    if (!fresh.length) return 0;
    const added = fresh.map((f) => {
      const pl = f.plan;
      if (!pl) return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason: IDENT_UNREAD, added: true };
      if (pl.fault) {
        const reason = pl.fault === 'other_task' ? '학생 미매칭 — 이 과제 답안지가 아닙니다' : pl.fault === 'not_in_roster' ? NOT_IN_ROSTER('1학년 1반 31번 오세훈') : IDENT_UNREAD;
        return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason, noAssign: pl.fault === 'other_task', added: true };
      }
      if (!isTarget(pl.sid)) return { id: `r${f.id}`, fid: f.id, name: f.name, sid: null, q: null, sheet: null, conf: 'low', reason: NOT_SELECTED, readAs: pl.sid, added: true };
      return { id: `r${f.id}`, fid: f.id, name: f.name, sid: pl.sid, q: pl.q, sheet: pl.page, conf: 'high', added: true };
    });
    const taken = new Set(added.filter((r) => r.sid).map((r) => `${r.sid}:${r.q}`));
    setRows((prev) => [...prev.map((x) => (x.origin === 'existing' && x.sid && taken.has(`${x.sid}:${x.q}`) ? { ...x, sid: null, q: null, sheet: null, reason: REPLACED } : x)), ...added]);
    return added.length;
  };
  useEffect(() => {
    if (!pendingJudge || source !== 'scan' || step !== 'mapping') return undefined;
    if (splitJobs.some((j) => j.status === 'splitting')) return undefined;          // PDF 쪽 나누기가 끝날 때까지
    const ready = splitJobs.filter((j) => j.status === 'done');
    if (ready.length) { ready.forEach((j) => { j.pages.forEach((pg) => { if (pg.blank) pg.selected = false; }); commitSplit(j); }); return undefined; }
    setReading(true);
    const t = setTimeout(() => {
      const n = judgeNewFiles();
      setReading(false); setPendingJudge(false);
      setToast(n ? `파일 ${n}개를 판별해 목록에 더했습니다 — 이미 정한 매칭은 그대로입니다.` : '새로 판별할 파일이 없습니다.');
      appLogger.info('scan-ocr', '매핑 중 파일 추가 판별', { added: n });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJudge, files, splitJobs, step, source]);
  const addInMapping = (fileList) => { if (!fileList?.length) return; addFiles(fileList); setPendingJudge(true); };
  /** 🧪 시연 — 빠진 답안지(장수 부족 · 결석생)를 스캔해 추가한 것으로 */
  const demoAddMissing = () => {
    if (!scanModel) return;
    const plans = scanModel.students.flatMap((st) => st.qs.flatMap((x) => {
      const need = x.q.sheets - x.list.length;
      return need > 0 && !x.hasExisting ? Array.from({ length: need }, (_, k) => ({ sid: st.id, q: x.q.id, page: x.list.length + k + 1 })) : [];
    }));
    if (!plans.length) { setToast('빠진 답안지가 없습니다.'); return; }
    appendFiles(plans.map((pl, i) => ({ name: `추가스캔_${String(i + 1).padStart(3, '0')}.jpg`, size: 950_000 + i * 20_000, kind: 'mock', plan: pl })));
    setPendingJudge(true);
  };
  /* 스캔 — 자리 조작 (SCR-05 §4.4): 맞교환 · 새 파일로 교체 · 빈 자리에 업로드 · 옮기기 · 삭제 */
  const swapRow = (oldR, newId) => setRows((prev) => prev.map((x) => {
    if (x.id === newId) return { ...x, sid: oldR.sid, q: oldR.q, sheet: oldR.sheet, conf: 'high', reason: null };
    if (x.id === oldR.id) return { ...x, sid: null, q: null, sheet: null, conf: 'low', reason: x.origin === 'existing' ? REPLACED : '미연결 — 맞교환으로 자리에서 내려온 답안지입니다' };
    return x;
  }));
  const uploadIntoSlot = (fileList, { sid, q, sheet, replaceRow }) => {
    const f = fileList && fileList[0];
    if (!f) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) { setToast('PDF · PNG · JPG만 올릴 수 있습니다.'); return; }
    const fid = Math.max(0, ...files.map((x) => x.id)) + 1;
    const isPdf = /\.pdf$/i.test(f.name);
    setFiles((prev) => [...prev.filter((x) => !(replaceRow && replaceRow.origin !== 'existing' && x.id === replaceRow.fid)), { id: fid, name: f.name, size: f.size, kind: isPdf ? 'pdf' : 'image', url: isPdf ? null : URL.createObjectURL(f) }]);
    setRows((prev) => [
      ...prev.flatMap((x) => {
        if (!replaceRow || x.id !== replaceRow.id) return [x];
        return x.origin === 'existing' ? [{ ...x, sid: null, q: null, sheet: null, reason: REPLACED }] : []; // 밀려난 스캔본은 목록에서 제거, 학생 제출 답안은 미분류로
      }),
      { id: `r${fid}`, fid, name: f.name, sid, q, sheet, conf: 'high', manual: true },
    ]);
    setToast(`${f.name}을(를) ${studentById(sid).name} · 문항 ${q} 자리에 붙였습니다.`);
  };
  const moveRow = (r, sid, q) => {
    const n = rows.filter((x) => x.sid === sid && x.q === q).length;
    patchRow(r.id, { sid, q, sheet: n + 1, conf: 'high', reason: null });
    setToast(`${r.name}을(를) ${studentById(sid).name} · 문항 ${q}(으)로 옮겼습니다.`);
  };
  const deleteRow = (r) => {
    const f = files.find((x) => x.id === r.fid);
    if (f?.url) URL.revokeObjectURL(f.url);
    setFiles((prev) => prev.filter((x) => x.id !== r.fid));
    setRows((prev) => prev.filter((x) => x.id !== r.id));
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
        return { ...s, badge: 'answer', detail: replaced ? '학생 제출 답안 교체 — 스캔본으로 채점됩니다' : '학생 제출 답안으로 채점', qs };
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
  }, [source, rows, ROSTER]);
  const patchRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const unlinkRow = (r) => patchRow(r.id, { sid: null, q: null, sheet: null, conf: 'low', reason: r.origin === 'existing' ? '학생 제출 답안 — 스캔본이 자리를 대신하고 있습니다' : '미연결 — 연결을 해제한 답안지입니다' });
  const restoreExisting = (r) => setRows((prev) => prev.map((x) => {
    if (x.id === r.id) return { ...x, sid: r.home.sid, q: r.home.q, reason: null };
    if (x.origin !== 'existing' && x.sid === r.home.sid && x.q === r.home.q) return { ...x, sid: null, q: null, sheet: null, conf: 'low', reason: '미연결 — 학생 제출 답안을 되돌리면서 자리에서 내려온 스캔입니다' };
    return x;
  }));

  const model = source === 'cradle' ? cradleModel : scanModel;

  /* ════════════ 공통 흐름 ════════════ */
  const startReading = () => {
    appLogger.info(source === 'cradle' ? 'usePenDataBatchUploadModalController' : 'scan-ocr', source === 'cradle' ? '펜 데이터 읽기 시작' : '답안지 판별 시작', { count: source === 'cradle' ? connected.length : files.length });
    setStep('mapping'); setReading(true); setSel(null);
    setTimeout(() => {
      if (source === 'cradle') setJudged(Object.values(docked).filter((p) => p.link === 'connected').map((p) => p.id));
      else readScan();
      setReading(false);
    }, 2200);
  };
  const reread = () => { setReading(true); setTimeout(() => { setJudged(connected.map((p) => p.id)); setReading(false); }, 1400); };
  /** [SCR-08 v1.48] [↰ 다시 매칭] — 펜 연결로 가지 않고 이 화면에서 처음부터 다시 매칭. 교사가 고친 매칭은 모두 초기화 */
  const rematchAll = () => {
    setConfirm(null);
    setManual({}); setDupPick({}); setUseSubmitted([]); setAssignPick({}); setSel(null); setChangePen(null);
    appLogger.info('usePenDataBatchUploadModalController', '다시 매칭 — 교사 매칭 초기화', { pens: connected.length });
    reread();
  };
  /** [SCR-09 v1.35] 스캔 [↰ 다시 매칭] — 파일 업로드로 가지 않고 올린 파일 전체를 이 화면에서 다시 판별. 교사가 고친 매칭은 모두 초기화 */
  const rematchScan = () => {
    setConfirm(null);
    setAssignPick({}); setSel(null); setRowMenu(null);
    setReading(true);
    setTimeout(() => { readScan(); setReading(false); }, 1400);
    appLogger.info('scan-ocr', '다시 매칭 — 교사 매칭 초기화', { files: files.length });
  };
  // [SCR-08 v1.45] 매핑 중 새로 연결된 펜(USB 바꿔 꽂기)은 자동으로 다시 읽는다 — [↻ 다시 매칭] 버튼 삭제
  useEffect(() => {
    if (source !== 'cradle' || step !== 'mapping' || reading || !cradleModel?.unread.length) return;
    reread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, step, reading, cradleModel?.unread.length]);

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

  /** 채점 시작 — 스캔은 학생 제출 답안을 교체하는 건이 있으면 한 번 더 확인 (SCR-05 S11) */
  const requestGrading = () => {
    if (replacedSlots().length) { setConfirm({ kind: 'overwrite' }); return; } // [SCR-08 v1.40] 펜 · 스캔 공통
    startGrading();
  };
  const replacedSlots = () => (source === 'cradle' ? (cradleModel ? cradleModel.students.filter((s) => s.replacedSubmitted).map((s) => s.name) : []) : scanModel ? scanModel.students.flatMap((s) => (s.hasAnswer ? s.qs.filter((x) => !x.hasExisting && x.list.length).map((x) => `${s.name} ${x.q.title}`) : [])) : []);
  const startGrading = () => {
    setConfirm(null);
    const ids = model.gradable.map((s) => s.id);
    const list = model.gradable.map((s) => (source === 'cradle' ? (s.submitted ? { sid: s.id, submitted: true, penId: s.restoredPenId } : { sid: s.id, slot: s.pens[0].pen.slot, penId: s.pens[0].pen.id }) : { sid: s.id, sheets: s.qs.reduce((a, x) => a + x.list.length, 0), full: s.qs.every((x) => x.list.length) }));
    setGradedList(list);
    if (source === 'cradle') {
      recordGradingSession({ source: '스마트 펜 채점(통합)', task: TASK.title, group: TASK.group, pens: connected.map((p) => ({ mac: p.id, books: [{ code: '334212', pages: penPageCount(p) }] })) });
    }
    appLogger.info('useBatchUploadPipeline', '일괄 업로드 시작', { source, collectedCount: ids.length });
    setGradedIds(ids); setFailedIds([]); setProgress(0); setGradingDone(false); setElapsed(0); setStep('grading');
    const failId = !failedOnce.current && ids.length >= 2 ? ids[ids.length - 1] : null;
    let v = 0;
    const iv = setInterval(() => {
      v += 2; setProgress(Math.min(100, v));
      if (v >= 100) {
        clearInterval(iv);
        if (failId) { failedOnce.current = true; setFailedIds([failId]); appLogger.error('useBatchUploadPipeline', 'AI 채점 실패', { studentId: failId, error: { message: 'context length exceeded', code: 'E-AI-TOKEN-LIMIT' } }); }
        // 채점이 정상 완료된 펜만 데이터를 지운다 (SCR-07 §4.6) — 실패 펜은 남겨 다시 채점
        if (source === 'cradle') { const ok = list.filter((x) => x.sid !== failId); setDeletedPens(ok.map((x) => x.penId)); eraseGraded(ok); }
        setGradingDone(true);
        setTimeout(() => setStep('done'), 500);
      }
    }, 120);
  };
  const retry = () => { setRetrying(true); setTimeout(() => { if (source === 'cradle') { const ok = gradedList.filter((x) => failedIds.includes(x.sid)); setDeletedPens((d) => [...d, ...ok.map((x) => x.penId)]); eraseGraded(ok); } setFailedIds([]); setRetrying(false); setToast(source === 'cradle' ? '실패했던 답안의 채점이 완료되었습니다. 해당 펜의 데이터도 삭제되었습니다.' : '실패했던 답안의 채점이 완료되었습니다.'); }, 2000); };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const canStartMapping = source === 'cradle' ? connector === 'ready' && connected.length > 0 : files.length > 0 && !pendingSplit.length;
  /** 입력 방식 전환 — 진행한 작업이 있으면 확인 (SCR-05·07 「매핑을 취소하고 닫을까요?」) */
  const requestSwitch = (next) => {
    if (next === source) return;
    const dirty = step === 'mapping' || (step === 'import' && (files.length || splitJobs.length || Object.keys(docked).length));
    if (dirty) { setConfirm({ kind: 'switch', next }); return; }
    resetAll(next);
  };

  /* ════════════ 렌더 조각 ════════════ */
  const renderCradleImport = () => {
    const needFw = connected.filter((p) => p.needsUpdate && !fwDone[p.id]);
    const lowCap = connected.filter((p) => capacityOf(p) < 20);
    if (connector === 'checking') {
      return (
        <div style={{ ...card, padding: '40px 24px', textAlign: 'center' }}>
          <style>{'@keyframes bguSpin { to { transform: rotate(360deg); } }'}</style>
          <div style={{ width: 36, height: 36, margin: '0 auto 12px', border: '4px solid #DBEAFE', borderTopColor: '#2A75F3', borderRadius: '50%', animation: 'bguSpin 1s linear infinite' }} />
          <div style={{ fontWeight: 800 }}>AiGLE Connect 실행 상태를 확인하는 중입니다.</div>
          <div style={{ color: '#64748B', fontSize: 'var(--neo-font-size-sm)', marginTop: 4 }}>잠시만 기다려 주세요.</div>
        </div>
      );
    }
    if (connector === 'blocked') {
      return (
        <div style={{ ...card, padding: '32px 24px', textAlign: 'center', background: '#FEF2F2', borderColor: '#FCA5A5' }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div style={{ fontWeight: 800, color: '#991B1B' }}>AiGLE Connect가 준비되지 않았습니다.</div>
          <div style={{ color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', margin: '6px 0 14px' }}>크래들의 펜 데이터를 읽으려면 <strong>AiGLE Connect</strong>가 설치되어 있고 실행 중이어야 합니다.</div>
          <button type="button" style={primaryBtn(true)} onClick={() => setProgramOpen(true)}>필수 프로그램 확인</button>
        </div>
      );
    }
    const linkToggle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569' }}>연결 방식</span>
        <span role="radiogroup" aria-label="펜 연결 방식" style={{ display: 'flex', gap: 6 }}>
          {[['cradle', '🗄 크래들'], ['usb', '🔌 USB 연결(펜 1개)']].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={link === k} onClick={() => switchLink(k)}
              style={{ padding: '6px 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${link === k ? '#2A75F3' : '#E2E8F0'}`, background: link === k ? '#EFF6FF' : 'white', color: link === k ? '#1D4ED8' : '#475569' }}>{l}</button>
          ))}
        </span>
      </div>
    );
    if (link === 'usb') {
      const cap = usbPen ? capacityOf(usbPen) : 0;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {linkToggle}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>🔌 USB 연결(펜 1개) — 크래들 없이 펜 1개를 읽습니다</div>
            <div style={{ color: '#64748B', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6 }}>
              펜을 USB 케이블로 이 PC에 연결하세요. 한 번에 한 자루씩 읽습니다.<br />
              누구의 펜인지는 [데이터 매핑 시작] 뒤 답안지의 학생정보로 확인합니다. 다른 펜은 그림의 펜을 눌러 케이블을 뺐다가 다시 꽂으면 데이터 매핑 화면에서 자동으로 다시 읽습니다.
            </div>
            {renderUsbEmulator()}
            {usbFail && (
              <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', textAlign: 'center' }}>
                ⚠ 펜을 인식하지 못했습니다 <span style={{ fontWeight: 600, color: '#B45309' }}>— 케이블을 뺐다가 다시 꽂아 주세요. 계속 안 되면 [🚨 이용불편 접수]로 알려 주세요.</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!usbPen && <button type="button" onClick={() => connectUsb()} style={primaryBtn(true)}>{usbFail ? '🔌 다시 꽂기' : '🔌 USB 펜 꽂기'}</button>}
            </div>
            {usbPen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: usbPen.link === 'connected' ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${usbPen.link === 'connected' ? '#86EFAC' : '#FCD34D'}`, fontSize: 'var(--neo-font-size-sm)' }}>
                <strong>{usbPen.link === 'connected' ? '● 연결됨' : '연결 중…'}</strong>
                <span>펜 {usbPen.id}</span>
                <span style={{ color: '#94A3B8' }}>학생 — 매핑 후 확인</span>
                {usbPen.link === 'connected' && <>
                  <span style={{ color: usbPen.battery < 50 ? '#DC2626' : '#475569' }}>배터리 {usbPen.battery}%</span>
                  <span>저장 잔량 <CapacityHelpTip /> <b style={{ color: capTone(cap).color }}>{cap}%</b></span>
                  <span style={{ color: usbPen.needsUpdate && !fwDone[usbPen.id] ? '#DC2626' : '#94A3B8' }}>펌웨어 {usbPen.needsUpdate && !fwDone[usbPen.id] ? usbPen.firmware : '2.1.0'}</span>
                  {!penPageCount(usbPen) && <span style={{ color: '#DC2626', fontWeight: 700 }}>필기 데이터 없음</span>}
                </>}
              </div>
            )}
          </div>
        </div>
      );
    }
    /* [SCR-08 v1.41] 크래들 에뮬레이터(실물 그림) 삭제 → 크래들별 목록 — 슬롯 1~10 · 배터리 · 펌웨어. 빈 슬롯은 「-」.
       펌웨어가 오래되면 빨간 버전 + [업데이트], 아래 [펌웨어 일괄 업데이트]. 시연: 행을 누르면 거치/빼기, [🧪 전체 거치] */
    const cell = { padding: '10px 12px', borderTop: '1px solid #E5E7EB', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' };
    const head = { padding: '10px 12px', background: '#DCE3EE', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#334155', textAlign: 'left' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {linkToggle}
        {unrecognized.length > 0 && (
          <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>
            ⚠ 펜이 목록에 표시되지 않는 경우
            <span style={{ fontWeight: 600, color: '#B45309' }}> — 펜을 다시 뺐다가 꽂아주세요. 계속 표시되지 않으면 [🚨 이용불편 접수]로 알려 주세요.</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)' }}>
          <strong>연결된 펜 <span style={{ color: '#2A75F3' }}>{connected.length}</span>자루</strong>
          {unrecognized.length > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>· 인식 안 됨 {unrecognized.length}</span>}
          {needFw.length > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>· 펌웨어 업데이트 {needFw.length}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" style={{ ...ghostBtn, padding: '4px 10px', color: '#7C3AED', borderColor: '#DDD6FE' }} title="시연 — 크래들에 펜을 모두 꽂은 것으로 합니다" onClick={() => PEN_POOL.forEach((p) => !docked[p.slot] && dockPen(p.slot))}>🧪 전체 거치</button>
            <button type="button" style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => { setDocked({}); setUnrecognized([]); }}>전체 제거</button>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {Array.from({ length: CRADLES }, (_, i) => i + 1).map((cn) => (
            <div key={cn}>
              <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', marginBottom: 6 }}>크래들{cn}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead><tr><th style={{ ...head, width: 56 }}>슬롯</th><th style={head}>배터리</th><th style={head}>펌웨어</th></tr></thead>
                <tbody>
                  {Array.from({ length: SLOTS }, (_, k) => (cn - 1) * SLOTS + k + 1).map((slot) => {
                    const pen = docked[slot];
                    const avail = PEN_POOL.some((x) => x.slot === slot);
                    const linking = pen && pen.link === 'linking';
                    const old = pen && !linking && pen.needsUpdate && !fwDone[pen.id];
                    return (
                      <tr key={slot} onClick={() => (pen ? undockPen(slot) : avail && dockPen(slot))}
                        title={pen ? `${slotShort(slot)} — 누르면 펜을 뺍니다(시연)` : avail ? `${slotShort(slot)} — 누르면 펜을 꽂습니다(시연)` : `${slotShort(slot)} — 빈 슬롯`}
                        style={{ cursor: avail || pen ? 'pointer' : 'default' }}>
                        <td style={cell}>{slotIn(slot)}</td>
                        <td style={{ ...cell, color: pen && !linking && pen.battery < 30 ? '#DC2626' : cell.color }}>{linking ? <span style={{ color: '#B45309' }}>연결 중…</span> : unrecognized.includes(slot) ? <span style={{ color: '#DC2626' }}>인식 안 됨</span> : pen ? `${pen.battery}%` : '-'}</td>
                        <td style={cell}>
                          {!pen || linking ? '-' : fwProg[pen.id] != null
                            ? <span style={{ display: 'inline-block', width: 64, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', verticalAlign: 'middle' }}><span style={{ display: 'block', width: `${fwProg[pen.id]}%`, height: '100%', background: '#2A75F3' }} /></span>
                            : old
                              ? <><span style={{ color: '#DC2626' }}>{pen.firmware}</span> <button type="button" onClick={(e) => { e.stopPropagation(); runFirmware(pen.id); }} style={{ marginLeft: 6, background: '#EF4444', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>업데이트</button></>
                              : '2.1.0 (최신)'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div>
          <button type="button" disabled={!needFw.length} title="펌웨어 업데이트는 채점의 필수 요건이 아닙니다." onClick={() => needFw.forEach((x) => runFirmware(x.id))}
            style={{ ...ghostBtn, padding: '6px 12px', opacity: needFw.length ? 1 : 0.45 }}>펌웨어 일괄 업데이트</button>
        </div>
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
        {/* [SCR-09] 권장 입력 — 학생정보 OCR 인식률 때문에 스캐너 PDF를 권장한다. 막지는 않고 안내만 */}
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', fontWeight: 700 }}>📠 스캐너로 스캔한 PDF를 권장합니다 — 휴대폰 사진은 학생정보 인식이 잘 안 돼 미분류가 늘어납니다.</div>
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
          {files.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', padding: '4px 8px', background: '#F8FAFC', borderRadius: 6, minWidth: 0 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.kind === 'pdf' ? '📕' : '🖼'} {f.name}</span>
              <button type="button" title="이 파일을 목록에서 뺍니다" aria-label={`${f.name} 삭제`} onClick={() => { if (f.url) URL.revokeObjectURL(f.url); setFiles((prev) => prev.filter((x) => x.id !== f.id)); }}
                style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {/* [SCR-05 v4.12] 답안 있음 학생 고지 — 선택 컨트롤 없이 알리기만 */}
      {ROSTER.some((st) => st.hasAnswer) && (
        <div style={{ ...card, padding: '12px 16px', borderColor: '#FDBA74', background: '#FFF7ED' }}>
          <div style={{ fontWeight: 800, color: '#9A3412' }}>📄 이미 답안이 있는 학생 {ROSTER.filter((st) => st.hasAnswer).length}명이 포함되어 있습니다</div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', lineHeight: 1.6, margin: '4px 0 8px' }}>스캔본이 있으면 스캔본으로 채점하고, 학생 제출 답안은 미분류에 남아 채점 전까지 되돌릴 수 있습니다. 교체한 건에 한해 채점 시작 시 한 번 더 확인하며, 학생 제출 답안은 이력에 보관됩니다.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ROSTER.filter((st) => st.hasAnswer).map((st) => <span key={st.id} style={{ padding: '3px 10px', borderRadius: 8, background: 'white', border: '1px solid #FED7AA', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>{st.name} <span style={{ color: '#94A3B8' }}>{st.no}</span></span>)}</div>
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
    const counts = {
      ok: model.gradable.length,
      check: source === 'cradle' ? Object.values(cradleModel.penInfo).filter((x) => x.kind === 'dup' || x.kind === 'unc').length : model.students.filter((s) => s.badge === 'check').length + model.unc.filter((r) => r.origin !== 'existing').length,
      none: model.students.filter((s) => s.badge === 'none').length,
      unc: model.unc.length,
    };
    return (
      <div style={{ ...card, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
        <span style={{ color: '#166534' }}>🟢 채점 대상 {counts.ok}명</span>
        <span style={{ color: '#B91C1C' }}>확인 필요 {counts.check}{source === 'cradle' ? '자루' : '건'}</span>
        <span style={{ color: '#94A3B8' }}>채점 제외 {counts.none}명</span>
        <span style={{ color: '#C2410C' }}>미분류 {counts.unc}{source === 'scan' ? '장' : '자루'}</span>
        {source === 'cradle' && cradleModel.erased.length > 0 && <span style={{ color: '#94A3B8' }}>데이터 삭제 {cradleModel.erased.length}자루</span>}
        {source === 'cradle' && cradleModel.empty.length > 0 && <span style={{ color: '#94A3B8' }} title="학생과 연결되지 않은 필기 없는 펜 — 채점과 무관해 목록에 넣지 않습니다">빈 펜 {cradleModel.empty.length}자루</span>}
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 500, flex: 1, minWidth: 200 }}>{model.manifest}</span>
        {/* [SCR-08 v1.8] [↻ 다시 매칭]은 슬롯 그림(미니맵) 위로 옮겼다 */}
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
    erased: { ...BADGE.none, label: '데이터 삭제' }, // [SCR-08 v1.63]
    unread: { label: '읽지 않음', bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', dot: '#60A5FA' },
  };
  const penText = (info) => ({
    ok: info.manual ? '펜 연결 · 직접 매칭' : '펜 연결',
    dup: '중복 데이터 — 같은 학생에 펜이 2자루 이상',
    unc: info.reason,
    noans: '답안 없음 — 답안지 미작성',
    empty: '필기 데이터가 없습니다',
    erased: '채점 완료 — 펜 데이터를 지웠습니다',
    unread: '아직 읽지 않음 — 읽는 중',
  }[info.kind]);
  const penTab = (info) => (info.kind === 'dup' || info.kind === 'unc' ? 'check' : info.kind === 'ok' ? 'ok' : info.kind === 'erased' ? 'erased' : 'none'); // erased는 전체에서만

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
            title={pen ? `${slotShort(slot)} · ${k ? `${k.label} — ${penText(info)}` : '연결 중'} · 저장 잔량 ${capacityOf(pen)}%` : avail ? `${slotShort(slot)} — 빈 슬롯 (눌러서 거치)` : `${slotShort(slot)} — 빈 슬롯`}
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
    const st = info.sid ? studentById(info.sid) : info.gradedSid ? studentById(info.gradedSid) : null;
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
  const renderMinimap = () => {
    return (
    <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* [SCR-08 v1.12] 맨 위 한 줄 — 펜 오류 안내 + [↻ 다시 매칭].
          펜을 다시 꽂거나 빼서 구성이 바뀌면 버튼을 주황으로 강조하고 읽지 않은 펜 수를 붙인다 */}
      {/* [SCR-08 v1.45] 목록 위 [↻ 다시 매칭] 삭제 — 펜을 더 꽂거나 바꾸려면 아래 [↰ 다시 매칭](① 펜 연결). USB에서 펜을 바꿔 꽂으면 자동으로 다시 읽는다 */}
      <div style={{ fontSize: 10, color: '#B45309', lineHeight: 1.4, marginBottom: 4 }}>{link === 'usb' ? '※ 펜을 바꿔 꽂으면 자동으로 다시 읽습니다.' : '※ 오류가 난 펜은 목록에 나오지 않습니다 — 펜을 더 꽂거나 바꾸려면 아래 [↰ 다시 매칭]을 누르세요.'}</div>
      {link === 'usb' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-xs)' }}>
          <div style={{ flex: '1 1 100%' }}>{renderUsbEmulator(true)}</div>
          {usbFail && <span style={{ flex: '1 1 100%', textAlign: 'center', color: '#B91C1C', fontWeight: 700 }}>⚠ 펜을 인식하지 못했습니다 — 다시 꽂아 주세요.</span>}
          <span style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'center', gap: 6 }}>
            {!usbPen && <button type="button" onClick={() => connectUsb()} style={{ ...ghostBtn, padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)' }}>🔌 펜 꽂기</button>}
          </span>
        </div>
      )}
      {/* [SCR-08 v1.41] 매핑 화면의 크래들 그림(미니맵) 삭제 — 펜 위치는 목록의 슬롯 번호 · 상세의 위치 줄로 */}
      {/* [SCR-08 v1.9] 크래들 제목은 그림 아래 한 줄 — LED 색 범례는 뺀다(색의 뜻은 펜 목록 배지가 말한다) */}
    </div>
    );
  };

  /** 위치 줄 — 고른 펜이 실물 크래들 어디에 있는지. 그림은 좌측 미니맵이 맡고, 여기는 말과 조치만 */
  const renderLocationCard = (pen) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
      <span title={pen.usb ? 'USB 케이블로 연결한 펜입니다' : '실물 크래들에서 이 펜이 꽂힌 자리입니다'} style={{ flex: 1, minWidth: 0, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B' }}>{pen.usb ? '🔌 USB로 연결한 펜' : `📍 실물 위치 — 크래들 ${cradleOf(pen.slot)} · ${slotIn(pen.slot)}번 자리`}</span>
      {pen.usb && <button type="button" style={{ ...ghostBtn, padding: '4px 10px', flex: 'none' }} title={pen.usb ? 'USB 연결을 해제합니다. 다른 펜은 위의 [펜 바꿔 연결]로 연결하세요.' : '크래들에서 이 펜을 뺍니다 (에뮬레이터). 다시 꽂으려면 ① 펜 연결 목록에서 슬롯을 누르세요.'} onClick={() => { undockPen(pen.slot); setSel(null); }}>⏏ 연결 해제</button>}{/* [SCR-08 v1.44] 크래들 [⏏ 펜 빼기] 삭제 — USB [⏏ 연결 해제]만 */}
    </div>
  );

  const renderPenList = () => {
    const infos = cradleModel.penInfo;
    // [SCR-08 v1.47] 학생과 연결되지 않은 빈 펜(필기 없음)은 목록에서 빼고 요약에 「빈 펜 N자루」로만 — 채점 제외 = 채점되지 않는 학생만
    // [SCR-08 v1.50] 크래들 슬롯 순이 아니라 학생 이름 가나다 순(채점 대상 학생 목록처럼). 행의 번호 칸 = 그 학생 펜이 꽂힌 자리.
    //   학생이 정해지지 않은 펜(미분류 · 학생 미지정)은 맨 뒤에 슬롯 순
    const nameOf = (p) => { const sid = infos[p.id]?.sid; return sid ? studentById(sid)?.name || '' : ''; };
    const pens = connected.filter((p) => infos[p.id]?.kind !== 'empty').slice().sort((a, b) => {
      const na = nameOf(a); const nb = nameOf(b);
      if (na && nb) return na.localeCompare(nb, 'ko') || a.slot - b.slot;
      if (na) return -1; if (nb) return 1;
      return a.slot - b.slot;
    });
    const nCheck = pens.filter((p) => infos[p.id] && penTab(infos[p.id]) === 'check').length;
    const nNone = pens.filter((p) => infos[p.id] && penTab(infos[p.id]) === 'none').length + cradleModel.absent.length;
    const show = (p) => tab === 'all' || (infos[p.id] && penTab(infos[p.id]) === tab);
    const nOk = pens.filter((p) => infos[p.id] && penTab(infos[p.id]) === 'ok').length + cradleModel.submitted.length;
    // [SCR-08 v1.51] 필터 = 셀렉트 박스 — 전체 · 답안 있음(채점 대상: 정상 펜 + 학생 제출) · 확인 필요 · 채점 제외
    const FILTERS = [['all', '전체', pens.length + cradleModel.submitted.length + cradleModel.absent.length], ['ok', '답안 있음', nOk], ['check', '확인 필요', nCheck], ['none', '채점 제외', nNone]];
    return (
      <div style={{ ...card, flex: '0 0 28%', minWidth: 280, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{/* [v1.10] 목록 폭 = 매핑 열 폭 · [v1.13] 두 열을 약 10% 줄이고(28%) 남는 폭을 답안 미리보기에 */}
        {renderMinimap()}
        {/* [SCR-08 v1.8] 필터는 미니맵 아래 — 아래 목록을 거르는 버튼이라 목록과 한 묶음 */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
          <select value={tab} onChange={(e) => setTab(e.target.value)} aria-label="목록 필터"
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#334155', minWidth: 150 }}>
            {FILTERS.map(([k, l, n]) => <option key={k} value={k}>{l} ({n})</option>)}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* 목록은 한 줄로 이어진다(스캔 목록과 같은 모양). 슬롯 순서 */}
          {pens.filter(show).map(penRow)}
          {(tab === 'all' || tab === 'ok') && cradleModel.submitted.length > 0 && (
            <div>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#ECFEFF', borderBottom: '1px solid #A5F3FC', padding: '8px 12px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#0E7490' }}>
                학생 제출 · 채점 대상 {cradleModel.submitted.length}명
              </div>
              {cradleModel.submitted.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => {
                const on = sel?.type === 'submitted' && sel.sid === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => { setSel({ type: 'submitted', sid: s.id }); setPageIdx(0); }}
                    style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: '1px solid #F1F5F9', background: on ? '#EFF6FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ flex: 'none', width: 34, textAlign: 'center', color: '#0E7490', fontWeight: 800 }}>📄</span>
                    <strong style={{ fontSize: 'var(--neo-font-size-sm)' }}>{s.name}</strong>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{s.no}</span>
                    <span style={{ marginLeft: 'auto', ...pill(BADGE.submitted) }}>학생 제출</span>
                  </button>
                );
              })}
            </div>
          )}
          {(tab === 'all' || tab === 'none') && cradleModel.absent.length > 0 && (
            <div>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '8px 12px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                펜 없음 · 채점 제외 {cradleModel.absent.length}명
              </div>
              {cradleModel.absent.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => {
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
    const list = model.students.filter((s) => tab === 'all' || s.badge === tab || (tab === 'ok' && s.badge === 'answer'));
    const uncScans = model.unc.filter((r) => r.origin !== 'existing'); // [SCR-09 v1.33] 학생을 찾지 못한 답안지 — 펜의 미분류 펜처럼 확인 필요에 센다
    // [SCR-09 v1.37] 필터 = 셀렉트 박스 — 전체 · 답안 있음(정상 + 학생 제출) · 확인 필요 · 채점 제외
    const FILTERS = [['all', '전체', model.students.length], ['ok', '답안 있음', model.students.filter((s) => s.badge === 'ok' || s.badge === 'answer').length], ['check', '확인 필요', model.students.filter((s) => s.badge === 'check').length + uncScans.length],
      /* [SCR-09 v1.36] 학생 제출은 탭 없이 상태 배지로만 */ ['none', '채점 제외', model.students.filter((s) => s.badge === 'none').length]];
    return (
      <div style={{ ...card, flex: '0 0 28%', minWidth: 280, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{/* [v1.10] 목록 폭 = 매핑 열 폭 · [v1.13] 두 열을 약 10% 줄이고(28%) 남는 폭을 답안 미리보기에 */}
        {/* [SCR-09 v1.30] 목록 맨 위 — 파일 추가(펜의 [↻ 다시 매칭] 자리와 같은 곳). 이전 화면으로 돌아가지 않는다 */}
        <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: '#B45309', lineHeight: 1.4 }}>※ 빠진 답안지는 파일을 추가하세요 — 새 파일만 판별해 목록에 더하고, 이미 정한 매칭은 그대로입니다.</span>
            <button type="button" onClick={() => mapFileRef.current?.click()} disabled={pendingJudge}
              title="스캔 파일(PDF · PNG · JPG)을 더 올립니다. 여러 쪽 PDF는 쪽을 나눠 넣습니다."
              style={{ ...ghostBtn, flex: 'none', padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap', background: '#2A75F3', color: 'white', border: 'none', opacity: pendingJudge ? 0.5 : 1 }}>
              📁 파일 추가
            </button>
            <input ref={mapFileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" aria-label="스캔 파일 추가" style={{ display: 'none' }}
              onChange={(e) => { addInMapping(e.target.files); e.target.value = ''; }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
            <span>올린 파일 {files.length}개</span>
            <button type="button" onClick={demoAddMissing} disabled={pendingJudge} style={{ ...ghostBtn, marginLeft: 'auto', padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)', color: '#7C3AED', borderColor: '#DDD6FE' }}>🧪 빠진 답안지 추가(시연)</button>
          </div>
          {uploadErrors.length > 0 && (
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ 파일 {uploadErrors.length}개를 올리지 못했습니다 — {uploadErrors.join(' · ')}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 10, flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
          <select value={tab} onChange={(e) => setTab(e.target.value)} aria-label="목록 필터"
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#334155', minWidth: 150 }}>
            {FILTERS.map(([k, l, n]) => <option key={k} value={k}>{l} ({n})</option>)}
          </select>
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
                  <span style={{ marginLeft: 'auto', ...pill(b) }}>{s.badge === 'answer' ? (s.detail.startsWith('학생 제출 답안 교체') ? '교체됨' : '학생 제출') : b.label}</span>
                </div>
                <div style={{ marginTop: 3, fontSize: 'var(--neo-font-size-xs)', color: s.badge === 'ok' ? '#166534' : b.color, lineHeight: 1.5 }}>{s.detail}</div>
              </button>
            );
          })}
        </div>
        {tab === 'check' && uncScans.length > 0 && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid #FDBA74', background: '#FFF7ED', fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', fontWeight: 700 }}>
            미분류 답안지 {uncScans.length}장도 확인이 필요합니다 — 아래 [미분류 파일]에서 학생 · 문항을 골라 [매칭]하세요.
          </div>
        )}
        <button type="button" onClick={() => { setSel({ type: 'unc' }); setPageIdx(0); }}
          style={{ padding: '12px 14px', border: 'none', background: sel?.type === 'unc' ? '#1E293B' : '#475569', color: 'white', display: 'flex', justifyContent: 'space-between', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>
          <span>미분류 파일</span><span>{model.unc.length}장 ›</span>
        </button>
      </div>
    );
  };

  /* ── 우측: 매핑(조치) 영역 — 입력 방식별 ── */
  // [SCR-08 v1.61] 학생 선택 카드는 셀렉트 · [매칭]만 — 「이 답안을 … 의 답안으로」 문장 없음 (미분류 · 학생 변경 · 중복 공통)
  // dupSid — [SCR-08 v1.60] 중복 데이터 펜: 중복된 그 학생을 고르면 이 펜을 그 학생의 답안으로 고른다(舊 [이 펜이 {학생}의 답안입니다])
  const assignRow = (penId, noAssign, dupSid) => {
    if (noAssign) return <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{noAssign}</div>;
    const pick = assignPick[penId] || '';
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)' }}>
        <select value={pick} onChange={(e) => setAssignPick((p) => ({ ...p, [penId]: e.target.value }))} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', minWidth: 170 }}>
          <option value="">학생 선택</option>
          {studentOptions()}
        </select>
        <button type="button" disabled={!pick} style={{ ...primaryBtn(!!pick), padding: '5px 14px' }}
          onClick={() => {
            if (dupSid && pick === dupSid) { setDupPick((d) => ({ ...d, [pick]: penId })); setAssignPick((p) => ({ ...p, [penId]: '' })); return; }
            addTarget(pick); setChangePen(null); setManual((m) => ({ ...m, [penId]: pick })); setDupPick((d) => { const n = { ...d }; delete n[pick]; return n; }); setAssignPick((p) => ({ ...p, [penId]: '' })); }}>매칭</button>
      </div>
    );
  };

  const renderCradleAction = () => {
    if (sel?.type === 'submitted') {
      const s = studentById(sel.sid);
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{s.name}</span><span style={{ color: '#94A3B8' }}>{s.grade}</span><span style={pill(BADGE.submitted)}>학생 제출</span></div>
          {useSubmitted.includes(s.id) ? (
            <>
              <div style={noteBox('ok')}>✓ 펜 답안 대신 학생이 이미 제출한 답안으로 채점합니다. 이 학생의 펜 답안은 미분류로 내려갔습니다.</div>
              <div><button type="button" style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => setUseSubmitted((u) => u.filter((x) => x !== s.id))}>🖊 펜 답안으로 채점</button></div>
            </>
          ) : (
            <>
              <div style={noteBox('ok')}>✓ 펜 데이터는 없지만 학생이 이미 제출한 답안이 있어 그 답안으로 채점합니다.</div>
              <div style={noteBox('muted')}>펜 답안으로 채점하려면 미분류 펜을 이 학생에게 매칭하세요 — 펜 답안이 있으면 펜 답안으로 채점합니다.</div>
            </>
          )}
        </>
      );
    }
    if (sel?.type === 'absent') {
      const s = studentById(sel.sid);
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{s.name}</span><span style={{ color: '#94A3B8' }}>{s.grade}</span><span style={pill(BADGE.none)}>제외</span></div>
          <div style={noteBox('muted')}>거치된 펜에서 이 학생의 답안을 찾지 못해 채점에서 제외됩니다(미채점에 남습니다). 펜을 찾았다면 아래 [↰ 다시 매칭]으로 돌아가 크래들에 꽂거나, 미분류 펜을 이 학생에게 매칭하세요.</div>
        </>
      );
    }
    const pen = connected.find((p) => p.id === sel?.penId);
    if (!pen) return <div style={{ color: '#94A3B8' }}>왼쪽 목록이나 크래들 슬롯에서 펜을 선택하세요.</div>;
    const info = cradleModel.penInfo[pen.id] || { kind: 'unread' };
    const k = PEN_KIND[info.kind];
    const st = info.sid ? studentById(info.sid) : info.gradedSid ? studentById(info.gradedSid) : null;
    return (
      <>
        {renderLocationCard(pen)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#1E293B', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>슬롯 {slotShort(pen.slot)}</span>
          <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{st ? st.name : '학생 미지정'}</span>
          {st && <span style={{ color: '#94A3B8' }}>{st.grade}</span>}
          <span style={pill(k)}>{k.label}{info.kind === 'dup' ? ' — 중복 데이터' : ''}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {/* 정상 펜도 학생을 바꿀 수 있다 — OCR이 맞게 읽었다고 판단해도 실제로는 다른 학생일 수 있다 */}
            {info.kind === 'ok' && <button type="button" aria-expanded={changePen === pen.id} style={{ ...ghostBtn, padding: '4px 10px', ...(changePen === pen.id ? { background: '#EFF6FF', borderColor: '#2A75F3', color: '#1D4ED8' } : {}) }} onClick={() => setChangePen(changePen === pen.id ? null : pen.id)}>학생 변경</button>}
            {info.manual && <button type="button" style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => setManual((m) => { const n = { ...m }; delete n[pen.id]; return n; })}>매칭 해제</button>}
          </span>
        </div>
        {info.kind === 'dup' && (
          <div style={{ ...noteBox('warn'), display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* [SCR-08 v1.14] 긴 설명문 삭제 — 상태 배지(확인 필요 — 중복 데이터)와 버튼만 */}
            {/* [SCR-08 v1.60] 셀렉트 · [매칭]만 — [이 펜이 {학생}의 답안입니다] · 「또는」 · 「이 답안을 … 의 답안으로」 삭제 */}
            {assignRow(pen.id, null, info.sid)}
          </div>
        )}
        {info.kind === 'unc' && (
          <div style={{ ...noteBox(info.noAssign ? 'muted' : 'warn'), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>⚠ {info.reason}</strong></div>
            {assignRow(pen.id, info.noAssign)}
          </div>
        )}
        {info.kind === 'noans' && <div style={noteBox('muted')}>답안지 학생정보는 읽혔지만 답안이 없습니다. 채점에서 제외됩니다.</div>}
        {info.kind === 'empty' && <div style={noteBox('muted')}>이 펜에는 필기가 없습니다. 채점 대상이 아닙니다.</div>}
        {/* [SCR-08 v1.63] 채점이 끝나 지운 펜 — 답안을 보여 주지 않고 이유만 */}
        {info.kind === 'erased' && <div style={noteBox('muted')}>{st ? `${st.name}의 ` : ''}답안은 채점이 끝나 펜에서 지웠습니다. 채점 결과는 「채점 확인」에서 볼 수 있습니다.</div>}
        {info.kind === 'unread' && <div style={noteBox('info')}>판정 이후에 꽂은 펜이라 지금 읽고 있습니다.</div>}
        {info.kind === 'ok' && <div style={noteBox('ok')}>✓ {st.name}의 답안으로 채점됩니다.{info.manual ? ' (직접 매칭)' : ''}</div>}
        {info.kind === 'ok' && st?.hasAnswer && (
          <div style={noteBox('info')}>
            🔄 학생이 이미 낸 답안 대신 펜 답안으로 채점됩니다. 학생 제출 답안으로 채점하려면 되돌리세요.
            <div style={{ marginTop: 6 }}><button type="button" style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => { setUseSubmitted((u) => (u.includes(st.id) ? u : [...u, st.id])); setSel({ type: 'submitted', sid: st.id }); }}>↩ 학생 제출 답안으로 되돌리기</button></div>
          </div>
        )}
        {info.kind === 'ok' && changePen === pen.id && (
          <div style={{ ...noteBox('info'), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>미리보기의 답안이 <strong>{st.name}</strong>의 것이 아니면 실제 학생을 골라 바로잡으세요. {st.name}에게 다른 펜이 없으면 {st.name}은(는) 채점에서 제외됩니다.</div>
            {assignRow(pen.id)}
          </div>
        )}
      </>
    );
  };

  /** 미리보기의 특정 장으로 이동 — 매핑 열의 행을 누르면 호출 */
  const gotoPage = (pageId) => {
    const idx = previewPages().findIndex((p) => p.id === pageId);
    if (idx >= 0) setPageIdx(idx);
  };

  /** 미분류 스캔을 파일 쪽에서 바로 지정 — 학생 · 문항을 고르면 그 문항의 다음 장 자리에 붙는다 */
  const assignUncRow = (r) => {
    const sid = assignPick[`${r.id}:s`]; const q = Number(assignPick[`${r.id}:q`]);
    if (!sid || !q) return;
    addTarget(sid);
    const n = rows.filter((x) => x.sid === sid && x.q === q).length;
    patchRow(r.id, { sid, q, sheet: n + 1, conf: 'high', reason: null });
    setAssignPick((p) => ({ ...p, [`${r.id}:s`]: '', [`${r.id}:q`]: '' }));
    setToast(`${r.name}을(를) ${studentById(sid).name} · 문항 ${q}에 매칭했습니다.`);
  };

  const renderScanAction = () => {
    const smallBtn = { ...ghostBtn, padding: '3px 10px', fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap', flex: 'none' };
    if (sel?.type === 'unc') {
      const scans = scanModel.unc.filter((r) => r.origin !== 'existing');
      const ex = scanModel.unc.filter((r) => r.origin === 'existing');
      const curId = previewPages()[pageIdx]?.id;
      const fileHead = (r) => (
        <button type="button" onClick={() => gotoPage(r.id)} title="미리보기에서 보기"
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.origin === 'existing' ? '📄 ' : '🖼 '}{r.name}
        </button>
      );
      return (
        <>
          <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>미분류 <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{scanModel.unc.length}장</span></div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.6 }}>
            학생을 찾지 못한 답안지입니다. 미리보기에서 답안을 보고 <strong>학생과 문항을 고른 뒤 [매칭]</strong>하세요. 매칭하지 않은 답안지는 채점하지 않습니다.
          </div>
          {scans.length > 0 && <div style={{ fontWeight: 800, color: '#991B1B', fontSize: 'var(--neo-font-size-sm)' }}>학생 미매칭 {scans.length}장</div>}
          {scans.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${curId === r.id ? '#2A75F3' : '#E2E8F0'}`, borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: curId === r.id ? '#F8FBFF' : 'white' }}>
              {fileHead(r)}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', lineHeight: 1.5 }}>⚠ {r.reason}</div>
                <button type="button" title="이 파일을 지웁니다 — 채점에 쓰지 않을 답안지" onClick={() => deleteRow(r)} style={{ ...smallBtn, color: '#DC2626', borderColor: '#FCA5A5' }}>🗑 삭제</button>
              </div>
              {/* 다른 과제 답안지는 이 과제에 붙이지 않는다 — 크래들의 「그룹 불일치」와 같은 취급 */}
              {r.noAssign ? (
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{typeof r.noAssign === 'string' ? r.noAssign : '다른 과제의 답안지라 이 과제에 지정할 수 없습니다. 해당 과제에서 채점하세요.'}</div>
              ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
                {/* [SCR-09 v1.31] 펜과 같은 결 — 고른 뒤 [매칭]으로 확정 · [SCR-09 v1.43] 문장 없이 셀렉트 · [매칭]만 */}
                <select value={assignPick[`${r.id}:s`] || ''} onChange={(e) => setAssignPick((p) => ({ ...p, [`${r.id}:s`]: e.target.value }))}
                  style={{ flex: '1 1 140px', padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)' }}>
                  <option value="">학생 선택</option>
                  {studentOptions()}
                </select>
                <select value={assignPick[`${r.id}:q`] || ''} onChange={(e) => setAssignPick((p) => ({ ...p, [`${r.id}:q`]: e.target.value }))}
                  style={{ flex: '0 1 100px', padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)' }}>
                  <option value="">문항</option>
                  {QUESTIONS.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
                <button type="button" disabled={!assignPick[`${r.id}:s`] || !assignPick[`${r.id}:q`]} onClick={() => assignUncRow(r)}
                  style={{ ...primaryBtn(!!(assignPick[`${r.id}:s`] && assignPick[`${r.id}:q`])), padding: '5px 14px', flex: 'none' }}>매칭</button>
              </div>
              )}
            </div>
          ))}
          {ex.length > 0 && <div style={{ fontWeight: 800, color: '#0E7490', fontSize: 'var(--neo-font-size-sm)', marginTop: 4 }}>교체된 학생 제출 답안 {ex.length}건</div>}
          {ex.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${curId === r.id ? '#2A75F3' : '#E2E8F0'}`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>{fileHead(r)}<div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#0E7490', marginTop: 3 }}>스캔본이 자리를 대신하고 있습니다</div></div>
              <button type="button" style={{ ...smallBtn, color: '#2A75F3', borderColor: '#2A75F3' }} title="원래 문항으로 되돌립니다 — 그 자리의 스캔본은 미분류로 내려갑니다" onClick={() => restoreExisting(r)}>↩ 되돌리기</button>
            </div>
          ))}
          {!scanModel.unc.length && <div style={noteBox('muted')}>미분류 답안지가 없습니다.</div>}
        </>
      );
    }
    const s = scanModel.students.find((x) => x.id === sel?.id);
    if (!s) return <div style={{ color: '#94A3B8' }}>왼쪽에서 학생을 선택하세요.</div>;
    const pool = scanModel.unc.filter((r) => r.origin !== 'existing' && !r.noAssign);
    const curId = previewPages()[pageIdx]?.id;
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{s.name}</span>
          <span style={{ color: '#94A3B8' }}>{s.grade}</span><span style={pill(BADGE[s.badge])}>{BADGE[s.badge].label}</span>
        </div>
        {s.badge === 'none' && <div style={noteBox('muted')}>채점에서 제외됩니다 — 올린 파일에서 답안지를 한 장도 찾지 못했습니다. 채점하려면 빈 자리에서 미분류 답안지를 지정하세요.</div>}
        {s.badge === 'check' && <div style={noteBox('warn')}>⚠ {s.detail}. 부족한 자리는 [답안지 선택]으로 채우고, 초과한 장(빨간 줄)은 [연결 해제]로 내려 주세요. 확인이 필요한 장(노란 줄)은 미리보기를 보고 [확인]을 눌러 주세요.</div>}
        {s.badge === 'answer' && s.detail.startsWith('학생 제출 답안 교체') && <div style={noteBox('info')}>🔄 학생이 이미 낸 답안 대신 스캔본으로 채점됩니다. 학생 제출 답안으로 채점하려면 [미분류 파일]에서 [↩ 되돌리기]를 누르세요.</div>}
        {/* 문항 카드 — 장마다 한 줄: 장 번호 | 파일명 | (AI 추정 확인) | 연결 해제. 버튼끼리 띄워 오조작을 막는다 */}
        {s.qs.map((x) => {
          const empties = x.hasExisting ? 0 : Math.max(0, x.q.sheets - x.list.length);
          const bad = !s.absent && x.st !== 'ok';
          return (
            <div key={x.q.id} style={{ border: `1px solid ${bad ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: bad ? '#FEF2F2' : '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <strong style={{ fontSize: 'var(--neo-font-size-sm)' }}>{x.q.title}</strong>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: bad ? '#B91C1C' : '#94A3B8', fontWeight: 700 }}>
                  {x.hasExisting ? '학생 제출 답안' : `${x.list.length}/${x.q.sheets}장`}
                  {bad && x.st === 'over' && ` · ${x.list.length - x.q.sheets}장 초과`}
                  {bad && x.st === 'short' && ` · ${x.q.sheets - x.list.length}장 부족`}
                </span>
              </div>
              {x.list.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid #F1F5F9' : 'none', background: curId === r.id ? '#EFF6FF' : i >= x.q.sheets && !x.hasExisting ? '#FEF2F2' : r.conf === 'medium' ? '#FFFBEB' : 'white', boxShadow: i >= x.q.sheets && !x.hasExisting ? 'inset 3px 0 0 #EF4444' : r.conf === 'medium' ? 'inset 3px 0 0 #F59E0B' : 'none' }}>
                  <span style={{ flex: 'none', width: 34, textAlign: 'center', padding: '1px 0', borderRadius: 5, background: i >= x.q.sheets ? '#FEE2E2' : '#F1F5F9', color: i >= x.q.sheets ? '#B91C1C' : '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                    {r.origin === 'existing' ? '기존' : `${x.q.id}-${i + 1}`}
                  </span>
                  <button type="button" onClick={() => gotoPage(r.id)} title="미리보기에서 보기"
                    style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</button>
                  {/* 장 상태별 버튼 하나 — 초과: [연결 해제](경고색) · 확인 필요: [확인] · 정상: ⋯ 메뉴만 */}
                  {i >= x.q.sheets && !x.hasExisting ? (
                    <button type="button" title="기준 장수를 넘은 장입니다 — 미분류로 내립니다" onClick={() => unlinkRow(r)}
                      style={{ ...smallBtn, color: '#B91C1C', borderColor: '#FCA5A5', background: 'white' }}>연결 해제</button>
                  ) : r.conf === 'medium' ? (
                    <button type="button" title="문항 번호를 읽지 못해 AI가 내용으로 추정했습니다. 미리보기를 보고 맞으면 누르세요"
                      onClick={() => patchRow(r.id, { conf: 'high' })}
                      style={{ ...smallBtn, background: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}>확인</button>
                  ) : null}
                  <button type="button" title="연결 해제 · 맞교환 · 새 파일로 교체 · 다른 자리로 옮기기" aria-expanded={rowMenu === r.id} onClick={() => setRowMenu(rowMenu === r.id ? null : r.id)}
                    style={{ ...smallBtn, padding: '3px 8px', background: rowMenu === r.id ? '#EFF6FF' : 'white' }}>⋯</button>
                </div>
              )).flatMap((el, i) => {
                const r = x.list[i];
                if (rowMenu !== r.id) return [el];
                const pick = (k) => assignPick[`${r.id}:${k}`] || '';
                const setPick = (k, v) => setAssignPick((prev) => ({ ...prev, [`${r.id}:${k}`]: v }));
                return [el, (
                  <div key={`${r.id}-menu`} style={{ padding: '10px 12px 12px 56px', background: '#F8FAFC', borderTop: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--neo-font-size-xs)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 92, fontWeight: 800, color: '#475569' }}>연결 해제</span>
                      <button type="button" onClick={() => { unlinkRow(r); setRowMenu(null); }} style={{ ...smallBtn, color: '#64748B' }}>미분류로 내리기</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 92, fontWeight: 800, color: '#475569' }}>미분류와 맞교환</span>
                      <select value={pick('sw')} disabled={!pool.length} onChange={(e) => setPick('sw', e.target.value)}
                        style={{ flex: 1, minWidth: 140, padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        <option value="">{pool.length ? '미분류 답안지 선택 — 이 장은 미분류로' : '미분류 답안지 없음'}</option>
                        {pool.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <button type="button" disabled={!pick('sw')} onClick={() => { swapRow(r, pick('sw')); setPick('sw', ''); setRowMenu(null); }}
                        style={{ ...primaryBtn(!!pick('sw')), padding: '4px 12px' }}>맞교환</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 92, fontWeight: 800, color: '#475569' }}>새 파일로 교체</span>
                      <label style={{ ...smallBtn, cursor: 'pointer' }}>⬆ 파일 선택
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { uploadIntoSlot(e.target.files, { sid: s.id, q: x.q.id, sheet: r.sheet, replaceRow: r }); e.target.value = ''; setRowMenu(null); }} />
                      </label>
                      <span style={{ color: '#94A3B8' }}>{r.origin === 'existing' ? '학생 제출 답안은 미분류로 내려갑니다' : '밀려난 스캔본은 목록에서 빠집니다'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 92, fontWeight: 800, color: '#475569' }}>다른 자리로</span>
                      <select value={pick('ms')} onChange={(e) => setPick('ms', e.target.value)} style={{ flex: '1 1 120px', padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        <option value="">학생</option>{studentOptions()}
                      </select>
                      <select value={pick('mq')} onChange={(e) => setPick('mq', e.target.value)} style={{ flex: '0 1 90px', padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        <option value="">문항</option>{QUESTIONS.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                      <button type="button" disabled={!pick('ms') || !pick('mq') || r.origin === 'existing'} title={r.origin === 'existing' ? '학생 제출 답안은 제 자리로만 돌아갑니다' : undefined}
                        onClick={() => { addTarget(pick('ms')); moveRow(r, pick('ms'), Number(pick('mq'))); setRowMenu(null); }} style={{ ...primaryBtn(!!(pick('ms') && pick('mq')) && r.origin !== 'existing'), padding: '4px 12px' }}>옮기기</button>
                    </div>
                  </div>
                )];
              })}
              {Array.from({ length: empties }, (_, i) => (
                <div key={`e${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: (x.list.length || i) ? '1px solid #F1F5F9' : 'none', background: '#FFFBFB' }}>
                  <span style={{ flex: 'none', width: 34, textAlign: 'center', padding: '1px 0', borderRadius: 5, border: '1px dashed #F87171', color: '#B91C1C', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>{x.q.id}-{x.list.length + i + 1}</span>
                  <span style={{ flex: 1, fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C' }}>빈 자리 — 답안지 없음</span>
                  {/* 부족: [답안지 선택] 하나 — 미분류 답안지 또는 새 파일 업로드(OCR 없이 교사 직접 지정) */}
                  {/* [SCR-09 v1.31] 펜과 같은 결 — 미분류 답안지는 고른 뒤 [매칭]으로 확정. 새 파일 올리기는 파일을 고르는 것이 곧 확정 */}
                  <select value={assignPick[`slot:${s.id}:${x.q.id}:${i}`] || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__upload') { document.getElementById(`up-${s.id}-${x.q.id}-${i}`)?.click(); return; }
                      setAssignPick((ap) => ({ ...ap, [`slot:${s.id}:${x.q.id}:${i}`]: v }));
                    }}
                    style={{ flex: 'none', padding: '4px 8px', borderRadius: 6, border: '1px solid #93C5FD', background: '#EFF6FF', color: '#1D4ED8', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, maxWidth: 170 }}>
                    <option value="">＋ 답안지 선택</option>
                    {pool.length > 0 && <optgroup label="미분류 답안지">{pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                    <option value="__upload">⬆ 새 파일 올리기…</option>
                  </select>
                  {assignPick[`slot:${s.id}:${x.q.id}:${i}`] && (
                    <button type="button" style={{ ...primaryBtn(true), padding: '4px 12px', flex: 'none' }}
                      onClick={() => {
                        const k = `slot:${s.id}:${x.q.id}:${i}`; const r = pool.find((pp) => pp.id === assignPick[k]);
                        if (r) { patchRow(r.id, { sid: s.id, q: x.q.id, sheet: x.list.length + i + 1, conf: 'high', reason: null }); setToast(`${r.name}을(를) ${s.name} · ${x.q.title}에 매칭했습니다.`); }
                        setAssignPick((ap) => ({ ...ap, [k]: '' }));
                      }}>매칭</button>
                  )}
                  <input id={`up-${s.id}-${x.q.id}-${i}`} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { uploadIntoSlot(e.target.files, { sid: s.id, q: x.q.id, sheet: x.list.length + i + 1 }); e.target.value = ''; }} />
                </div>
              ))}
            </div>
          );
        })}
      </>
    );
  };

  /* ── 미리보기 페이지 목록 — 선택에 따라 ── */
  const previewPages = () => {
    if (!model || !sel) return [];
    if (source === 'cradle') {
      if (sel.type === 'submitted') {
        const s = studentById(sel.sid);
        return QUESTIONS.map((q) => ({ id: `sub-${s.id}-${q.id}`, label: `${q.title} · 학생 제출`, sub: '학생 제출 답안', studentLabel: `${s.grade} ${s.name}`, question: q.title, sheetNo: 1, kind: 'ok', writer: GROUP.findIndex((g) => g.id === s.id) }));
      }
      const pen = sel.type === 'pen' ? connected.find((p) => p.id === sel.penId) : null;
      if (!pen) return [];
      const info = cradleModel.penInfo[pen.id] || {};
      if (info.kind === 'erased') return []; // [SCR-08 v1.63] 지운 데이터 — 답안 · 다른 반 답안 모두 볼 수 없다
      const handLabel = pen.scenario === 'no_ident' ? '' : (pen.scenario === 'other_group' || pen.scenario === 'other_task') ? pen.ownerLabel : pen.scenario === 'not_in_roster' ? pen.read
        /* 답안지에는 실제로 쓴 학생(owner)이 적혀 있다 — OCR이 다른 학생으로 잘못 읽으면(identSid ≠ owner) 중복이 생긴다 */
        : (() => { const s = studentById(pen.owner || pen.identSid); return s ? `${s.grade} ${s.name}` : ''; })();
      const own = QUESTIONS.flatMap((q) => Array.from({ length: pen.pages[q.id] || 0 }, (_, i) => ({
        id: `${pen.id}-${q.id}-${i}`, label: `${q.title}-${i + 1}`, sub: `슬롯 ${slotShort(pen.slot)}`, studentLabel: handLabel, question: q.title, sheetNo: i + 1, kind: info.kind,
        writer: pen.owner ? GROUP.findIndex((g) => g.id === pen.owner) : pen.slot, // 실제로 쓴 사람 — 답안지에 적힌 이름과 다를 수 있다
        warn: pen.scenario === 'other_task' ? '다른 과제 데이터' : pen.scenario === 'other_group' ? `${pen.detected} 답안지` : null,
      })));
      /* [SCR-08 v1.59] 답안 없음 — 답안 칸 필기는 없지만 학생정보는 썼다. 빈 답안지에 학생정보 필기만 얹어 보여 준다(채점 제외는 그대로) */
      if (info.kind === 'noans' && !own.length) {
        QUESTIONS.forEach((q) => { for (let i = 0; i < (q.sheets || 1); i += 1) own.push({
          id: `${pen.id}-${q.id}-blank-${i}`, label: `${q.title}-${i + 1}`, sub: `슬롯 ${slotShort(pen.slot)}`, studentLabel: handLabel, question: q.title, sheetNo: i + 1, kind: info.kind,
          writer: GROUP.findIndex((g) => g.id === pen.owner), blankAnswer: true, warn: '답안 미작성',
        }); });
      }
      /* [SCR-07 v2.0] 비정상 펜은 이 과제의 다른 반 답안까지 열람한다(매칭은 불가) — 정상 펜은 선택 그룹 답안만 */
      const extra = info.kind !== 'ok' ? pen.extraBooks.flatMap((b) => Array.from({ length: b.pages }, (_, i) => ({
        id: `${pen.id}-${b.label}-${i}`, label: `${b.label} 답안 ${i + 1}`, sub: `슬롯 ${slotShort(pen.slot)}`, studentLabel: b.owner, question: '문항 1', sheetNo: i + 1, warn: '다른 반 답안지 — 열람만',
      }))) : [];
      return [...own, ...extra];
    }
    if (sel.type === 'unc') return scanModel.unc.map((r) => ({ id: r.id, label: r.origin === 'existing' ? '학생 제출 답안' : '미분류', sub: r.name, url: files.find((f) => f.id === r.fid)?.url, studentLabel: r.origin === 'existing' ? `${studentById(r.home.sid).grade} ${studentById(r.home.sid).name}` : '', existing: r.origin === 'existing', warn: r.origin === 'existing' ? null : r.reason }));
    const s = scanModel.students.find((x) => x.id === sel.id);
    if (!s) return [];
    return s.qs.flatMap((x) => x.list.map((r, i) => ({ id: r.id, label: r.origin === 'existing' ? `${x.q.title} · 학생 제출 답안` : `${x.q.title}-${i + 1}`, sub: r.name, url: files.find((f) => f.id === r.fid)?.url,
      studentLabel: `${s.grade} ${s.name}`, question: x.q.title, sheetNo: i + 1, existing: r.origin === 'existing', writer: GROUP.findIndex((g) => g.id === (r.home?.sid || r.sid)),
      warn: i >= x.q.sheets && !x.hasExisting ? `${x.q.title} 기준 ${x.q.sheets}장 초과` : r.conf === 'medium' ? 'AI가 문항을 추정한 장' : null })));
  };

  /** 미리보기 — 한 학생(한 펜)의 답안지를 **여러 장 세로로 이어서** 보여 준다. 크래들·스캔 공통.
   *  장마다 머리에 문항·장 번호가 붙어 「이 학생에게 무엇이 붙었는지」를 한 번에 훑는다. ◀ ▶는 장 사이 이동 */
  const renderPreviewPane = () => {
    const pages = previewPages();
    const i = Math.min(pageIdx, Math.max(0, pages.length - 1));
    const pg = pages[i];
    pvTargetRef.current = pg ? `pv-${pg.id}` : null;
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)' }}>
          <strong>{source === 'scan' ? '답안지 미리보기' : '답안 미리보기'}</strong>
          {pages.length > 0 && <span style={{ color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>전체 {pages.length}장</span>}
          {pages.length > 1 && (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
              <button type="button" disabled={i === 0} onClick={() => setPageIdx(i - 1)} style={{ ...ghostBtn, padding: '2px 10px', opacity: i === 0 ? 0.4 : 1 }}>◀</button>
              <strong style={{ fontSize: 'var(--neo-font-size-xs)' }}>{i + 1} / {pages.length}</strong>
              <button type="button" disabled={i >= pages.length - 1} onClick={() => setPageIdx(i + 1)} style={{ ...ghostBtn, padding: '2px 10px', opacity: i >= pages.length - 1 ? 0.4 : 1 }}>▶</button>
            </span>
          )}
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', background: '#E2E8F0', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {!pages.length && <div style={{ margin: 'auto', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>{!sel ? '왼쪽에서 선택하면 답안을 크게 볼 수 있습니다.' : sel.type === 'pen' && cradleModel?.penInfo[sel.penId]?.kind === 'erased' ? '채점이 끝나 지운 데이터라 답안을 볼 수 없습니다.' : '미리볼 답안이 없습니다.'}</div>}
          {pages.map((p, k) => (
            <div key={p.id} id={`pv-${p.id}`} onClick={() => setPageIdx(k)} style={{ width: '100%', maxWidth: 720, flex: 'none', cursor: 'pointer' }}>
              {/* 장 머리 — 문항·장 번호 + 주의 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 'var(--neo-font-size-xs)' }}>
                <span style={{ flex: 'none', whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: 999, background: k === i ? '#2A75F3' : '#475569', color: 'white', fontWeight: 800 }}>{p.label}</span>
                <span style={{ flex: '1 1 auto', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 40 }}>{p.sub}</span>
                {p.warn && <span title={p.warn} style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '1px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 800 }}>⚠ {p.warn}</span>}
              </div>
              <div style={{ borderRadius: 8, outline: k === i ? '3px solid #60A5FA' : 'none', outlineOffset: 2 }}>
                {p.url
                  ? <img src={p.url} alt={p.label} style={{ display: 'block', width: '100%', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: 'white' }} />
                  : <SheetMock studentLabel={p.studentLabel} question={p.question} sheetNo={p.sheetNo} answer={!p.existing && !p.blankAnswer} writer={Math.max(0, p.writer ?? 0)} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ════════════ 렌더 ════════════ */
  const T = { cradle: '🖊 스마트 펜 채점', scan: '📷 스캔 채점' }[source]; // [SCR-08 v1.20] 크래들 일괄 · 펜 개별(USB)을 「스마트 펜 채점」 하나로
  return (
    /* main-wrapper가 overflow: hidden이라 본문이 직접 스크롤해야 한다 — 안 그러면 아래 푸터(다음 단계 버튼)가 잘린다 */
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
      {/* 헤더 — 공통 */}
      <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {fromList && (
          <button type="button" onClick={() => (step === 'grading' ? setToast('채점 중에는 목록으로 나갈 수 없습니다.') : onExit())} style={{ ...ghostBtn, padding: '6px 12px' }} title="미채점 목록으로 돌아갑니다 — 진행 중인 매핑은 지워집니다">← 목록</button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{T}</h2>
            <span style={{ padding: '1px 8px', borderRadius: 999, background: '#F5F3FF', color: '#6D28D9', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>통합 구조 시안</span>
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{TASK.team} / {TASK.title} · 그룹 <strong>{TASK.group}</strong> · 대상 학생 <strong>{ROSTER.length}명</strong> <span style={{ color: '#94A3B8' }}>(미채점 목록에서 선택)</span></span>
            {source === 'scan' && (
              <span style={{ position: 'relative' }}>
                <button type="button" onClick={() => setShowCodes((v) => !v)} style={{ padding: '1px 8px', borderRadius: 999, border: `1px solid ${showCodes ? '#2A75F3' : '#CBD5E1'}`, background: showCodes ? '#EFF6FF' : 'white', color: showCodes ? '#1D4ED8' : '#64748B', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🏷 답안지 코드 {SHEET_CODES.length}개</button>
                {showCodes && (
                  <span style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20, background: 'white', border: '1px solid #CBD5E1', borderRadius: 10, boxShadow: '0 8px 20px rgba(15,23,42,0.18)', padding: '10px 12px', minWidth: 260, display: 'block' }}>
                    <span style={{ display: 'block', marginBottom: 6 }}>답안지 <strong style={{ color: '#1E293B' }}>1장마다 코드 1개</strong>가 부여됩니다.</span>
                    {QUESTIONS.map((q) => (
                      <span key={q.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
                        <strong style={{ width: 50, color: '#475569' }}>{q.title}</strong>
                        {SHEET_CODES.filter((c) => c.q === q.id).map((c) => <span key={c.code} style={{ padding: '1px 6px', borderRadius: 5, background: '#F1F5F9', fontFamily: 'monospace', color: '#1E293B' }}>{c.code}<span style={{ color: '#94A3B8' }}>({c.page}/{q.sheets})</span></span>)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        {/* 입력 방식 — 바꾸면 처음부터 */}
        {!fromList && <div role="tablist" style={{ marginLeft: 'auto', display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
          {[['cradle', '🖊 스마트 펜'], ['scan', '📷 스캔']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={source === k} type="button" onClick={() => requestSwitch(k)} disabled={step === 'grading'} title={step === 'grading' ? '채점 중에는 바꿀 수 없습니다' : undefined}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: source === k ? 'white' : 'transparent', boxShadow: source === k ? '0 1px 3px rgba(15,23,42,0.15)' : 'none', fontWeight: 800, color: source === k ? '#1E293B' : '#64748B', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>{l}</button>
          ))}
        </div>}
        <button type="button" onClick={() => setIncidentOpen(true)} style={{ ...ghostBtn, ...(fromList ? { marginLeft: 'auto' } : {}), color: '#B91C1C', borderColor: '#FCA5A5' }}>🚨 이용불편 접수</button>
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
            <div style={{ height: 'max(480px, calc(100vh - 400px))', display: 'flex', gap: 10 }}>
              {source === 'cradle' ? renderPenList() : renderStudentList()}
              <div style={{ ...card, flex: '0 0 28%', minWidth: 280, boxSizing: 'border-box', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                {source === 'cradle' ? renderCradleAction() : renderScanAction()}
              </div>
              <div style={{ ...card, flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                <button type="button" onClick={() => setToast('실제 화면에서는 창이 최소화되고 채점은 계속 진행됩니다. 끝나면 하단 알림으로 다시 열 수 있습니다.')}
                  style={{ ...primaryBtn(true), marginLeft: 10, padding: '5px 12px' }}>창 닫고 다른 작업 하기</button>
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div style={{ ...card, padding: '36px 24px', textAlign: 'center', background: '#F0FDF4', borderColor: '#86EFAC' }}>
            <div style={{ fontSize: '2.2rem' }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-lg)', color: '#065F46' }}>완료</div>
            <div style={{ color: '#047857', margin: '8px 0 14px' }}>
              {/* 완료 화면은 숫자만 — 학생별 목록은 두지 않는다 */}
              채점 완료 문항 <strong>{doneSids.length * QUESTIONS.length}건</strong> · 학생 <strong>{doneSids.length}명</strong>
            </div>
            {(failedIds.length > 0 || retrying) && (
              <div style={{ maxWidth: 620, margin: '0 auto 14px', textAlign: 'left', ...noteBox('warn'), fontSize: 'var(--neo-font-size-sm)' }}>
                {retrying ? '⏳ 실패한 답안을 다시 채점하고 있습니다…' : (
                  <>
                    <div><strong>⚠ {failedIds.length}명은 AI 채점에 실패했습니다.</strong> 답안 분량이 커서 <strong>토큰 용량을 초과</strong>했습니다(서버 응답 지연). 나머지 학생의 채점 결과는 정상 반영됐습니다.</div>
                    {/* 남는 것은 입력 방식마다 다르다 — 크래들은 펜 데이터, 스캔은 올린 답안지 */}
                    <div style={{ marginTop: 6, color: '#475569' }}>실패한 {failedIds.length}명은 <strong>미채점</strong>으로 자동 되돌려집니다. {source === 'cradle' ? '해당 펜의 데이터는 지우지 않았으니 같은 펜을 다시 거치해 이어서 채점할 수 있습니다.' : '올린 답안지는 그대로 보관되어 있어 파일을 다시 올리지 않고 이어서 채점할 수 있습니다.'}</div>
                    <div style={{ marginTop: 4, color: '#B45309' }}>잠시 후 [다시 시도]를 누르거나, 계속 실패하면 서비스팀에 문의해 주세요.</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={retry} style={{ ...primaryBtn(true), background: '#DC2626' }}>↻ 다시 시도</button>
                      <button type="button" onClick={() => setToast('서비스팀 문의: 1544-0000 · support@neolab.net')} style={ghostBtn}>서비스팀 문의</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* 스캔 — 일부 문항만 채점된 학생은 미채점에 남는다 (SCR-05 S14) */}
            {source === 'scan' && gradedList.some((g) => !g.full) && (
              <div style={{ maxWidth: 620, margin: '0 auto 10px', ...noteBox('warn'), background: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A', fontSize: 'var(--neo-font-size-sm)' }}>
                ⚠ <strong>{gradedList.filter((g) => !g.full).length}명</strong>은 일부 문항만 채점되어 <strong>미채점에 남습니다.</strong> 빠진 답안지를 스캔해 다시 실행하면 이어서 채점됩니다.
              </div>
            )}
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#065F46' }}>
              [확인]을 누르면 채점이 완료된 학생 <strong>{doneSids.length}명</strong>이 「채점 확인」 단계로 이동합니다.
            </div>

          </div>
        )}
      </div>

      {/* 푸터 — 공통. 왼쪽 버튼(되돌아가기)만 입력 방식별 */}
      {/* 다음 단계 버튼은 늘 보이도록 아래에 붙인다 */}
      <div style={{ ...card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0, zIndex: 15, marginBottom: 16, boxShadow: '0 -6px 16px rgba(15,23,42,0.08)' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--neo-font-size-sm)', color: '#B45309' }}>
          {step === 'import' && source === 'cradle' && !connected.length && <span style={{ color: '#94A3B8' }}>{link === 'usb' ? 'USB로 펜을 연결해야 다음 단계로 넘어갑니다.' : '크래들에 펜을 1자루 이상 거치해야 다음 단계로 넘어갑니다.'}</span>}
          {step === 'import' && source === 'scan' && pendingSplit.length > 0 && <>⚠ 페이지 분리한 PDF {pendingSplit.length}개를 아직 목록에 넣지 않았습니다 — [업로드 목록에 추가] 또는 [버리기]를 눌러 주세요.</>}
          {step === 'import' && source === 'scan' && !pendingSplit.length && !files.length && <span style={{ color: '#94A3B8' }}>스캔 파일을 1개 이상 올려야 다음 단계로 넘어갑니다.</span>}
          {step === 'mapping' && !reading && model && (model.blocked ? model.blockReason : model.note)}
        </div>
        {step === 'import' && <button type="button" disabled={!canStartMapping} onClick={startReading} style={primaryBtn(canStartMapping)}>🔗 데이터 매핑 시작</button>}
        {step === 'mapping' && !reading && (
          <>
            {/* [SCR-08 v1.41] 크래들 그림을 없앴으므로 펜을 더 꽂거나 바꾸려면 ① 펜 연결로 돌아간다(매칭 기록 유지 → 돌아와서 [↻ 다시 매칭]) */}
            {source === 'cradle' && link === 'cradle' && (
              <button type="button" style={ghostBtn} title="이 화면에서 펜 데이터를 처음부터 다시 매칭합니다" onClick={() => setConfirm({ kind: 'rematch' })}>↰ 다시 매칭</button>
            )}
            {source === 'scan' && (
              <button type="button" style={ghostBtn} title="이 화면에서 올린 파일을 처음부터 다시 매칭합니다" onClick={() => setConfirm({ kind: 'rematch' })}>↰ 다시 매칭</button>
            )}
            <button type="button" disabled={model?.blocked} onClick={requestGrading} style={primaryBtn(!model?.blocked)}>🤖 {model?.gradable.length || 0}명 AI 채점 시작</button>
          </>
        )}
        {step === 'done' && <button type="button" onClick={finishDone} style={{ ...primaryBtn(true), background: '#10B981' }}>✓ 확인</button>}
      </div>

      {confirm && (() => {
        const replacedNames = [...new Set(rows.filter((r) => r.origin === 'existing' && r.sid == null).map((r) => studentById(r.home.sid).name))];
        const box = (title, body, actions) => (
          <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '20px 22px', width: 480, maxWidth: '94vw', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>{title}</h3>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>{body}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{actions}</div>
            </div>
          </div>
        );
        if (confirm.kind === 'switch') {
          return box('매핑을 취소하고 나갈까요?',
            source === 'cradle'
              ? <>읽어온 펜 데이터 판정 결과와 직접 연결한 내용이 모두 사라집니다. <strong>펜에 저장된 필기 데이터는 삭제되지 않습니다.</strong></>
              : <>답안지 판별 결과와 직접 지정한 내용이 모두 사라집니다. <strong>다시 채점하려면 스캔 파일을 다시 올려야 합니다.</strong></>,
            <><button type="button" style={ghostBtn} onClick={() => setConfirm(null)}>계속 매핑하기</button>
              <button type="button" style={{ ...primaryBtn(true), background: '#EF4444' }} onClick={() => resetAll(confirm.next)}>나가기</button></>);
        }
        if (confirm.kind === 'rematch') {
          return box('↰ 다시 매칭할까요?',
            <>직접 고친 매칭이 <strong style={{ color: '#C2410C' }}>모두 초기화</strong>됩니다.
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, color: '#1E40AF' }}>
                💡 지금 매칭으로 먼저 <strong>[AI 채점 시작]</strong>하고, 빠진 학생은 나중에 다시 채점하는 것을 권장합니다.
              </div></>,
            <><button type="button" style={ghostBtn} onClick={() => setConfirm(null)}>취소</button>
              <button type="button" style={{ ...primaryBtn(true), background: '#EA580C' }} onClick={source === 'scan' ? rematchScan : rematchAll}>초기화하고 다시 매칭</button></>);
        }
        if (confirm.kind === 'replace') {
          return box('🔄 이미 답안이 있는 학생이 있습니다',
            <>스캔본 내용 중 <strong style={{ color: '#C2410C' }}>{replacedNames.length}명</strong>의 학생이 이미 제출한 답안파일이 있습니다.
              <div style={{ margin: '8px 0', padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, color: '#9A3412' }}>대상 : {replacedNames.join(', ')}</div>
              어느 쪽을 선택해도 나머지 답안은 <strong>미분류로 남아</strong> 채점 전까지 변경할 수 있습니다.</>,
            <><button type="button" style={ghostBtn} onClick={() => { rows.filter((r) => r.origin === 'existing' && r.sid == null).forEach(restoreExisting); setConfirm(null); }}>학생 제출 답안으로 채점</button>
              <button type="button" style={{ ...primaryBtn(true), background: '#EA580C' }} onClick={() => setConfirm(null)}>스캔파일로 교체</button></>);
        }
        return box('🔄 학생 제출 답안을 교체합니다',
          <>학생이 제출한 답안 <strong style={{ color: '#C2410C' }}>{replacedSlots().length}건</strong>이 {source === 'cradle' ? '펜 답안' : '스캔본'}으로 교체됩니다. 학생 제출 답안은 이력에 보관되며 복원할 수 있습니다. 계속하시겠습니까?
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, color: '#9A3412', fontSize: 'var(--neo-font-size-xs)' }}>교체 대상: {replacedSlots().join(', ')}</div></>,
          <><button type="button" style={ghostBtn} onClick={() => setConfirm(null)}>취소</button>
            <button type="button" style={{ ...primaryBtn(true), background: '#EA580C' }} onClick={startGrading}>덮어쓰고 채점 시작</button></>);
      })()}
      {/* [POP-30] 필수 프로그램 확인 — 크래들 채점은 AiGLE Connect만 요구한다 */}
      <RequiredProgramModal open={programOpen} onClose={() => setProgramOpen(false)}
        programs={[
          { key: 'connect', name: 'AiGLE Connect', desc: 'USB·블루투스 펜 연결 · 스마트 펜 채점 · 백그라운드 자동 실행', required: true, installed: isConnectDownloaded() },
          { key: 'printDoctor', name: 'Ncode Print Doctor', desc: 'N-code 인쇄 최적 상태 지원 · 프린터 인쇄 적합성 진단', required: false },
        ]}
        onInstalled={(key) => { if (key === 'connect') markConnectDownloaded(); }}
        onAllReady={() => { markConnectDownloaded(); connectorSessionReady = true; setConnector('ready'); }} />
      {toast && <div style={{ position: 'fixed', left: '50%', bottom: 40, transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 50 }}>{toast}</div>}
      <IncidentReportDialog open={incidentOpen} onClose={() => setIncidentOpen(false)} onSubmitted={(r) => setToast(`이용불편 접수가 완료되었습니다 — ${r.id}`)}
        context={{ source: source === 'cradle' ? '스마트 펜 채점(통합)' : '스캔 채점(통합)', school: '공주 고등학교', teacher: '김 b', teacherId: 'tch20261zim', teacherEmail: 'tch20261zim@gjhs.kr', task: TASK.title, group: TASK.group, studentCount: ROSTER.length }} />
    </div>
  );
};

export default BatchGradingUnified;
