/**
 * CradleGradingModal.jsx
 * [SCR-07] 크래들 일괄 채점 워크플로우 모달
 *
 * 목적: 크래들에 거치된 스마트펜의 오프라인 필기 데이터를 읽어 → 선택한 그룹의 학생과 매핑 →
 *       AI 일괄 채점 → 채점 확인 단계로 전환한다. SCR-05 스캔 일괄 채점과 같은 Step 구조를 쓴다.
 *
 * 4-Step Workflow:
 *   1) connect  — 크래들 연결 확인. 거치된 펜의 **연결 상태만** 본다 (에뮬레이터)
 *   2) mapping  — 펜 데이터 판별 + 그룹 학생 매핑. 미매칭 펜은 펜 속 데이터를 열람해 수동 연결
 *   3) grading  — AI 일괄 채점 진행
 *   4) completed— 완료 요약 + [확인] → 상위 콜백
 *
 * ─────────────────────────────────────────────────────────────────────────
 * [SCR-07 v1.0] Step 1이 「그룹 매칭」을 하지 않는 이유
 *
 *   한 펜에는 여러 반(1~5반)의 필기가 함께 들어 있다. 북코드 = 과제 1개 + 그룹 1개(1:1)이므로
 *   펜 하나가 북코드 여러 개를 갖는 것이 정상이다. 따라서 **「이 펜이 이 그룹의 펜인가」는
 *   펜 단위로 판정할 수 없다** — 판정 단위는 펜이 아니라 펜 안의 북코드/필기다.
 *
 *   Step 1에서 그룹 매칭까지 보여주면 실제로는 매칭 가능한 펜을 「불일치」로 오인시키거나
 *   그 반대가 된다. 그래서 Step을 이렇게 가른다:
 *     · Step 1 = **장비 상태** — 거치 · 연결 · 배터리 · 펌웨어 (그룹과 무관)
 *     · Step 2 = **데이터 판정** — 북코드 대조 · 번호표 판독 · 중복 검사 (그룹이 여기서 처음 개입)
 *   SCR-05의 `파일 업로드`(재료 확보) → `OCR 판별`(내용 판정) 구조와 정확히 대응한다.
 *
 * [SCR-07 v1.0] 판정 규칙 — POP-28 「일괄 채점 펜 상태 판정 규칙」 정본을 따른다
 *   1단계 북코드 대조 → 2단계 내용(번호표) 판정 → 3단계 중복 검사.
 *   위 단계에서 걸리면 아래 단계는 보지 않는다(사유가 서로 덮이지 않게).
 *
 * [SCR-07 v1.0] 미매칭 해소 — 펜 데이터 열람
 *   번호표를 잘못 체크했거나 아예 체크하지 않은 펜은 「누구의 답안인지」를 시스템이 모른다.
 *   이때 교사는 그 펜에 담긴 **모든 북코드의 모든 페이지**를 넘겨보며 답안 내용·이름으로
 *   주인을 찾아 대상 학생에게 직접 연결한다. 이것이 이 화면의 핵심 기능이다.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RequiredProgramModal from './RequiredProgramModal';
import appLogger from './appLogger';
import LogDownloadDialog from './LogDownloadDialog';
import PenDataDownloadDialog, { PEN_DATA_DIR } from './PenDataDownloadDialog';

const STEPS = [
  /* [SCR-07 v2.7] 단계 안내는 타이틀 호버 툴팁으로 — 본문 안내 카드를 없애 크래들이 바로 보이게 한다 */
  { key: 'connect', label: '크래들 연결', icon: '🔌', hint: '크래들에 펜을 거치해 주세요. 여기서는 펜 연결만 확인하고, 누구의 답안인지는 다음 단계에서 판별합니다.' },
  { key: 'mapping', label: '데이터 매핑', icon: '🔗' },
  { key: 'grading', label: 'AI 일괄 채점', icon: '🤖' },
  { key: 'completed', label: '완료', icon: '✓' },
];

/* [SCR-07 v1.5] 크래들 구성 — NEO SMARTPEN 10구 크래들 **3대** = 30자루.
 *   슬롯 번호는 1~30 통번호로 두고, 크래들 번호는 슬롯에서 계산한다(1~10 → 크래들 1, …).
 *   펜 ID·판정·목록은 슬롯 통번호만 알면 되므로 크래들 경계는 렌더에서만 의미가 있다. */
const CRADLE_COUNT = 3;
const SLOTS_PER_CRADLE = 10;
const SLOT_COUNT = CRADLE_COUNT * SLOTS_PER_CRADLE;
/** 슬롯 통번호 → 크래들 번호(1-base) */
const cradleOf = (slot) => Math.ceil(slot / SLOTS_PER_CRADLE);
/* [SCR-07 v2.3] 화면에 보이는 슬롯 번호는 **크래들 안 번호(1~10)** 다. 실물 크래들에 11~30이 찍혀 있지 않기 때문이다.
 *   통번호(1~30)는 내부 키로만 쓴다. */
const slotInCradle = (slot) => ((slot - 1) % SLOTS_PER_CRADLE) + 1;
const slotLabel = (slot) => `크래들 ${cradleOf(slot)} · ${slotInCradle(slot)}번`;

/** [SCR-07 v2.1] 학생 표기 — 「학년-반-번호 이름」 (예: 1-1-12 김민지). grade가 서식에 안 맞으면 이름만 */
const studentTag = (st) => {
  if (!st) return '—';
  const m = (st.grade || '').match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${st.name}` : st.name;
};

/* [SCR-07 v1.6] 답안지 미리보기 이미지 — 펜 필기를 답안지 서식 위에 렌더한 결과(프로토타입은 샘플 1장 고정).
 *   실제 서비스에서는 펜별·장별 렌더 이미지 URL이 들어온다. 파일이 없으면 舊 텍스트 목으로 대체한다. */
const ANSWER_SHEET_IMG = `${import.meta.env.BASE_URL}images/answer-sheet-sample.png`;

/* [SCR-07 v1.1] 배지 5종 — POP-28 §5. **신규 배지를 만들지 않는다.**
 *   사유는 배지가 아니라 「채점 진행」 칸이 말한다(같은 문구가 두 칸에 중복되지 않게).
 *   그래서 배지는 상태의 «종류»만, 진행 칸은 «무슨 일이 일어났는지»를 맡는다. */
const BADGE = {
  normal:     { label: '정상',        bg: '#F0FDF4', border: '#86EFAC', color: '#166534', dot: '🟢' },
  loading:    { label: '로딩중',      bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', dot: '🔵' },
  nodata:     { label: '데이터 없음',  bg: '#F8FAFC', border: '#E2E8F0', color: '#64748B', dot: '⚪' },
  deleted:    { label: '데이터 삭제',  bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9', dot: '🟣' },
  /* [SCR-07 v1.6] 동기화 불가는 **빨강** — 「데이터 없음(회색)」과 한눈에 갈라지도록. 사유는 채점 진행 칸이 말한다 */
  unsyncable: { label: '동기화 불가',  bg: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C', dot: '🔴' },
};

/* [SCR-07 v1.1] 중복은 **배지가 따로 있지 않다** — POP-28 §4 #9는 「정상(빨강)」이다.
 *   데이터 자체는 멀쩡히 읽혔고(정상), 다만 같은 학생에 둘이 붙어 못 올릴 뿐이라
 *   실패 배지를 주면 「펜이 잘못됐다」로 오독된다. 색만 빨강으로 뒤집는다. */
const DUPLICATE_TONE = { bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B', dot: '🔴' };

/** 판정 코드 → { badge, progress } (POP-28 §4). progress = 「채점 진행」 칸 문구 */
const VERDICT_SPEC = {
  // 1단계 · 북코드 대조
  empty:          { badge: 'nodata',     progress: '학생 미매칭 — 번호표 체크와 필기 데이터가 모두 없습니다' },
  other_group:    { badge: 'unsyncable', progress: null /* POP-28 #2 — 「그룹 불일치 [감지: 1-2반 → 선택: 1-1반]」 런타임 생성 */ },
  other_task:     { badge: 'unsyncable', progress: '학생 미매칭 — 이 과제 데이터가 아닙니다' },
  // 2단계 · 내용 판정
  roster_loading: { badge: 'loading',    progress: '' /* POP-28 #4 — 문구 없음 */ },
  no_tag:         { badge: 'unsyncable', progress: '학생 미매칭 — 번호표를 체크하지 않았습니다' },
  bad_tag:        { badge: 'unsyncable', progress: '학생 미매칭 — 번호표 체크 위치를 읽을 수 없습니다' },
  not_in_roster:  { badge: 'unsyncable', progress: '학생 미매칭 — 명단에 없는 학생입니다' },
  not_selected:   { badge: 'unsyncable', progress: '학생 미매칭 — 채점 목록에서 선택하지 않은 학생입니다' },
  // 3단계 · 중복 검사
  duplicate:      { badge: 'normal',     progress: '중복 데이터' },
  // 통과 이후
  /* [SCR-07 v2.2] POP-28 #10 문구 개정 — 舊 「펜 연결」은 #11 정상 흐름의 첫 상태와 같아 「데이터가 없는데 연결됐다?」로 읽혔다.
   *   학생은 번호표로 찾았고 답안만 없다는 사실을 진행 칸이 말한다. 배지는 「데이터 없음」 그대로. */
  no_answer:      { badge: 'nodata',     progress: '답안 없음 — 답안지 미작성' },
  ok:             { badge: 'normal',     progress: '펜 연결' },
  grading:        { badge: 'normal',     progress: 'AI 채점중' },
  graded:         { badge: 'normal',     progress: 'AI 채점 완료' },
  uploaded:       { badge: 'deleted',    progress: 'AI 채점 완료' },
  /* [SCR-07 v2.9] AI 채점 실패 — 서버 응답 지연(사고력 문항의 긴 답안 → 토큰 용량 초과). 데이터는 멀쩡하므로 배지는 「정상」에 빨강 톤(중복과 같은 표현).
   *   판정 규칙 정본(POP-28)에 없는 조건 — 문서 개정 필요 */
  grade_failed:   { badge: 'normal',     progress: 'AI 채점 실패 — 토큰 용량 초과' },
};

/** 판정 코드로 배지 토큰을 만든다. 중복만 「정상」 배지에 빨강 톤을 입힌다 */
const badgeOf = (code) => {
  const spec = VERDICT_SPEC[code] || VERDICT_SPEC.empty;
  const base = BADGE[spec.badge];
  return (code === 'duplicate' || code === 'grade_failed') ? { ...base, ...DUPLICATE_TONE } : base;
};

/* [SCR-07 v1.1] 판정 3단계 — POP-28 §1.
 *   1단계에서 걸리면 2단계로 가지 않는다. 그래서 1·2단계 사유가 서로 덮지 않는다.
 *   1단계는 파일 «이름만» 보므로 대상 아닌 펜은 다운로드 자체를 건너뛴다. */
const JUDGE_PHASES = [
  { key: 'books', label: '북코드 대조', desc: '펜 파일 이름만 보고 채점 대상인지 판정', call: 'GetOfflineFileNames', cost: '저렴' },
  { key: 'content', label: '내용 판정', desc: '1단계를 통과한 펜만 읽어 번호표/답안 분리', call: 'ReadOfflineStrokesByBases', cost: '다운로드' },
  { key: 'duplicate', label: '중복 검사', desc: '2단계를 통과한 펜끼리 학생 중복 확인', call: '—', cost: '—' },
];

/** 펜 연결(거치) 상태 */
const LINK_TOKEN = {
  /* [SCR-07 v2.3] 슬롯 폭이 좁아 두 글자로 — 연결 중 / 연결 / 실패 */
  linking:   { label: '연결 중', color: '#B45309', bg: '#FEF3C7' },
  connected: { label: '연결',    color: '#166534', bg: '#DCFCE7' },
  failed:    { label: '실패',    color: '#991B1B', bg: '#FEE2E2' },
};

/* 번호표 격자 — 10행 × 4열, 페이지당 샘플 1칸 제외, 3페이지 (POP-28 §3) */
const TAG_ROWS = 10;
const TAG_COLS = 4;
const TAG_PAGES = 3;
/** 번호표 정원 = (40칸 − 샘플 1칸) × 3페이지 = 117명. 하드코딩이 아니라 계산값 (POP-28 §6) */
const TAG_CAPACITY = (TAG_ROWS * TAG_COLS - 1) * TAG_PAGES;

/* ────────────────────────────────────────────────────────────
 * 에뮬레이터 목 데이터 생성
 *   선택된 학생 명단을 그대로 재료로 써서 「고른 그룹에 맞는 펜」을 만들고,
 *   뒤에 교사가 실제로 겪는 오류 케이스(번호표 미체크 · 그룹 불일치 · 중복 · 빈 펜)를 붙인다.
 * ──────────────────────────────────────────────────────────── */

const pad = (n, w = 3) => String(n).padStart(w, '0');

/** 명단 순번(0-base) → 번호표 격자 좌표. 페이지당 샘플 1칸(0,0)을 건너뛴다 */
const seqToCell = (seq) => {
  const perPage = TAG_ROWS * TAG_COLS - 1;
  const page = Math.floor(seq / perPage);
  const inPage = (seq % perPage) + 1; // 샘플칸(index 0) 건너뜀
  return { page: page + 1, row: Math.floor(inPage / TAG_COLS), col: inPage % TAG_COLS };
};

/** 답안 목 텍스트 — 문항별로 조금씩 다르게 만들어 페이지를 넘길 이유를 준다 */
const mockAnswer = (questionTitle, page) => {
  const lines = [
    `${questionTitle}에 대한 제 생각은 다음과 같습니다.`,
    `작품 속 인물은 처음에는 상황을 받아들이지 못하지만, 사건을 겪으며 태도가 달라집니다.`,
    `이 변화를 통해 글쓴이가 말하려는 주제가 분명해진다고 보았습니다.`,
    `그래서 저는 이 장면이 작품 전체에서 가장 중요한 부분이라고 생각합니다.`,
  ];
  return lines.slice(0, page === 1 ? 4 : 2).join('\n');
};

/**
 * 펜 1자루를 만든다.
 *  scenario:
 *    'ok'          내 북코드 + 번호표 정상 + 답안 있음
 *    'no_tag'      내 북코드 + 답안 있음, **번호표 미체크** → 미매칭 (수동 연결 대상)
 *    'bad_tag'     격자 밖·칸 경계·샘플칸에 찍어 위치를 읽을 수 없음 (POP-28 #6)
 *    'not_in_roster' 명단에 없는 빈자리에 체크 (POP-28 #7)
 *    'other_group' 같은 과제 다른 그룹 북코드만 → 그룹 불일치
 *    'no_answer'   번호표만 찍고 답안 없음
 *    'duplicate'   이미 다른 펜이 매칭된 학생의 번호표가 또 찍혀 있음 → 3단계 중복 검사에 걸린다
 *    'empty'       아무 필기 없음
 */
const buildPen = ({ slot, scenario, student, roster, myBook, siblingBook, taskTitle, questions, extraBooks = [], tagSeqOverride }) => {
  const books = [];

  const makeBook = ({ code, groupLabel, isMine, tagSeq, hasAnswer, ownerName, ownerGrade, tagFlaw }) => {
    const tagPages = Array.from({ length: TAG_PAGES }, (_, i) => ({ no: i + 1, checked: null }));
    /* [POP-28 #6] 격자 밖·칸 경계·샘플칸 체크 — 좌표는 읽혔지만 칸으로 환산할 수 없다.
     * 「체크가 없다(#5)」와 구분되는 별개 실패라 별도 플래그로 표현한다. */
    if (tagFlaw) {
      tagPages[0].checked = { row: 0, col: 0, seq: null, flaw: tagFlaw };
    } else if (tagSeq != null) {
      const cell = seqToCell(tagSeq);
      const tp = tagPages.find((p) => p.no === cell.page) || tagPages[0];
      tp.checked = { row: cell.row, col: cell.col, seq: tagSeq };
    }
    const answerPages = hasAnswer
      ? questions.flatMap((q) =>
          Array.from({ length: q.sheets || 1 }, (_, i) => ({
            no: 0, // 아래에서 통째로 재번호
            questionId: q.id,
            questionTitle: q.title,
            sheetNo: i + 1,
            sheetTotal: q.sheets || 1,
            text: mockAnswer(q.title, i + 1),
          }))
        )
      : [];
    /* [SCR-07 v1.2] `ownerName`/`ownerGrade` = **답안지에 학생이 손으로 적은 기재란**.
     * 번호표 판독 결과와 별개의 출처이고, 둘이 어긋날 때 진짜 주인을 말해 주는 쪽이 이것이다. */
    return { code, groupLabel, isMine, taskTitle, tagPages, answerPages, ownerName, ownerGrade };
  };

  if (scenario === 'empty') {
    // 아무 인쇄물에도 쓴 기록이 없다
  } else if (scenario === 'other_group') {
    books.push(makeBook({
      code: siblingBook.code, groupLabel: siblingBook.groupLabel, isMine: false,
      tagSeq: 3, hasAnswer: true, ownerName: siblingBook.ownerName, ownerGrade: siblingBook.ownerGrade,
    }));
  } else {
    /* 번호표가 가리키는 자리와 답안지 주인이 **다를 수 있다**.
     *   tagSeqOverride — 다른 학생 칸을 잘못 체크한 경우 (#9 중복의 실제 원인)
     *   not_in_roster  — 명단 인원을 넘는 빈자리에 체크한 경우 (#7) */
    const ownSeq = roster.findIndex((s) => s.id === student.id);
    const seatSeq = scenario === 'not_in_roster' ? roster.length + 2
      : tagSeqOverride != null ? tagSeqOverride : ownSeq;
    books.push(makeBook({
      code: myBook.code, groupLabel: myBook.groupLabel, isMine: true,
      tagSeq: scenario === 'no_tag' ? null : seatSeq,
      tagFlaw: scenario === 'bad_tag' ? '샘플칸' : null,
      hasAnswer: scenario !== 'no_answer',
      ownerName: student?.name, ownerGrade: student?.grade,
    }));
  }

  // 「한 펜에 1~5반 답안이 함께 들어 있다」 — 다른 반 북코드를 덧붙여 실제와 같은 상태로 만든다
  extraBooks.forEach((b) => books.push(makeBook({ ...b, isMine: false, hasAnswer: true })));

  // 전체 페이지 통합 번호 부여 (뷰어가 한 줄로 넘길 수 있게)
  let seq = 0;
  books.forEach((b) => {
    b.tagPages.forEach((p) => { p.no = ++seq; });
    b.answerPages.forEach((p) => { p.no = ++seq; });
  });

  return {
    id: `PEN-${pad(slot)}`,
    slot,
    mac: `9C:7B:D2:${pad(slot * 7 % 100, 2)}:${pad(slot * 13 % 100, 2)}:${pad(slot * 3 % 100, 2)}`,
    battery: [92, 85, 74, 61, 88, 57, 96, 43, 79, 68][(slot - 1) % 10] - ((slot - 1) % 7) * 2,
    firmware: slot === 3 ? '2.0.5' : '2.1.0',
    needsUpdate: slot === 3,
    /* [SCR-07 v2.3] 접촉 불량 에뮬레이션 — 처음 꽂을 때 한 번 「연결 실패」가 나고, 뺐다 다시 꽂으면 연결된다 */
    flaky: slot === 8 || slot === 19,
    books,
    scenario,
  };
};

/** 크래들 전체 목 구성 — 선택 학생 수에 따라 자동으로 늘고 준다 */
const buildCradleFixture = (students, groupLabel, taskTitle, questions) => {
  const roster = students; // 인쇄 순서 = 선택 순서로 간주 (프로토타입)
  const myBook = { code: '334212', groupLabel };
  const siblingBook = { code: '334213', groupLabel: '1학년 2반', ownerName: '한서윤', ownerGrade: '1학년 2반 4번' };
  const otherClassBooks = [
    { code: '334214', groupLabel: '1학년 3반', ownerName: '김서준', ownerGrade: '1학년 3반 6번', tagSeq: 5 },
    { code: '334215', groupLabel: '1학년 4반', ownerName: '이도윤', ownerGrade: '1학년 4반 3번', tagSeq: 2 },
    { code: '334216', groupLabel: '1학년 5반', ownerName: '정하은', ownerGrade: '1학년 5반 1번', tagSeq: 0 },
  ];

  /* [SCR-07 v1.2] 교실에서 실제로 벌어지는 구성으로 줄였다.
   *   정상 3 · 번호표 미체크 1 · **중복 1** · 그룹 불일치 1 · 빈 펜 1 = 7자루.
   *   판정 로직은 POP-28 12개 조건을 모두 다루지만, 화면을 읽기 어렵게 만드는
   *   드문 케이스(#6 체크 위치 오류 · #7 명단 밖 · #10 답안 미작성)는 기본 배치에서 뺐다. */
  const pens = [];
  const push = (scenario, student, extra = {}) => {
    if (pens.length >= SLOT_COUNT) return;
    pens.push(buildPen({ slot: pens.length + 1, scenario, student, roster, myBook, siblingBook, taskTitle, questions, ...extra }));
  };

  roster.forEach((student, i) => {
    if (i === 1) {
      // #5 번호표 미체크 — 답안은 썼는데 번호표를 안 찍었다. 다른 반 북코드도 함께 들어 있다
      push('no_tag', student, { extraBooks: otherClassBooks });
    } else if (i === 2) {
      /* #6 번호표 체크 위치 판독 불가 — 우리 반 답안지에 썼는데 번호표를 샘플칸에 찍었다.
       * 같은 그룹 답안지이므로 교사가 기재란 글씨를 보고 직접 매칭할 수 있다. */
      push('bad_tag', student);
    } else if (i === 3) {
      /* #9 중복의 실제 원인 — 이 학생이 번호표에서 **다른 학생 칸**을 체크했다.
       * 그래서 그 학생의 정상 펜과 이 펜이 같은 사람을 가리키게 된다.
       * 답안지 기재란에 이 펜의 진짜 주인 이름이 손글씨로 적혀 있어, 교사가 미리보기에서 보고 가려낸다. */
      push('ok', student, { tagSeqOverride: 4 });
    } else {
      push('ok', student);
    }
  });

  push('other_group', null, { extraBooks: otherClassBooks }); // ① 우리 반 학생이 결석 — 2~5반 답안만 남은 공용 펜
  push('empty');                                         // #1  아무 필기 없음
  /* [SCR-07 v1.5] 크래들 3대(30슬롯)를 다 채운다 — 학급 공용 펜 세트에서 쓰지 않은 펜은
   * 필기 없이 꽂혀 있는 것이 실제 모습이라, 나머지는 모두 「아무 필기 없음」으로 둔다. */
  while (pens.length < SLOT_COUNT) push('empty');
  return pens;
};

/* ────────────────────────────────────────────────────────────
 * 컴포넌트
 * ──────────────────────────────────────────────────────────── */

const CradleGradingModal = ({
  open, onClose, onMinimize, onGradingStarted, onGradingFinished, onCompleted,
  selectedStudents = [], groupLabel = '그룹1', taskTitle = '과제', questions = [],
  /** AiGLE Connect가 설치되어 있고 실행 중인가 — 상위(환경설정)가 기억한다 */
  connectorReady = false, connectorInstalled = false, onConnectorReady, onConnectorInstall,
}) => {
  const [step, setStep] = useState('connect');

  // ── Step 1: 크래들 에뮬레이터 상태 ──
  // connectorState: 'checking' | 'ready' | 'blocked'(AiGLE Connect 미실행)
  const [connectorState, setConnectorState] = useState('checking');
  // [POP-30] 필수 프로그램 확인 모달
  const [programModalOpen, setProgramModalOpen] = useState(false);
  /** 슬롯별 거치 펜 — { [slot]: { ...pen, link: 'linking'|'connected' } }. 비어 있으면 미거치 */
  const [docked, setDocked] = useState({});
  const [fwUpdating, setFwUpdating] = useState({}); // { [penId]: percent }

  // ── Step 2: 매핑 상태 ──
  const [reading, setReading] = useState(false);
  /* [POP-28 §1] 판정 3단계 진행 — 'books' → 'content' → 'duplicate' → null(완료).
   * 각 단계가 어떤 브릿지 호출을 쓰고 얼마나 비싼지를 화면에서 드러낸다. */
  const [judgePhase, setJudgePhase] = useState(null);
  /* [SCR-07 v1.8] 읽는 중 화면의 타이틀 순환 — 북코드 대조 → 내용 판정 → 중복 검사 를 일정 간격으로 돌린다.
   *   실제 판정 단계(judgePhase)와 묶지 않는다. 「이런 일을 처리하고 있다」만 보여 주면 되고,
   *   단계가 넘어가는 느낌을 주면 교사가 각 단계의 길이를 읽으려 들기 때문이다. */
  const [readTick, setReadTick] = useState(0);
  useEffect(() => {
    if (!reading) return undefined;
    setReadTick(0);
    const iv = setInterval(() => setReadTick((t) => t + 1), 650);
    return () => clearInterval(iv);
  }, [reading]);
  /* [POP-28 #4] 그룹 명단 도착 여부 — 안 왔으면 2단계 판정을 미루고 「로딩중」 배지를 준다.
   * 명단이 늦었다는 이유로 멀쩡한 행을 오류색으로 물들이지 않기 위한 상태다. */
  const [rosterReady, setRosterReady] = useState(false);
  /** [POP-28 #11·#12] 채점 중인 펜 / 업로드가 끝나 펜 파일이 삭제된 펜 */
  const [gradingPenIds, setGradingPenIds] = useState([]);
  const [uploadedPenIds, setUploadedPenIds] = useState([]);
  /* [SCR-07 v2.0] 직접 매칭 — { [penId]: { studentId, bookCode } }.
   *   舊 「번호표 재체크 후 재거치」(v1.2~1.4) 폐기. 교사가 답안(기재란 손글씨)을 보고 학생을 고르면 그 자리에서 매칭된다.
   *   매칭 단위는 페이지가 아니라 **반(북코드) 답안 묶음** — 한 북코드 안의 이 과제 답안 페이지는 서식상 고정된 묶음이라
   *   교사가 장을 고를 필요가 없다. [v2.1] 매칭은 **선택 그룹 북코드 묶음에서만** 된다(다른 반 답안지는 열람만).
   *   매칭 결과는 업로드에 함께 기록되고 채점 후 펜 파일이 지워지므로
   *   「다시 읽으면 되살아난다」는 걱정은 없다. 채점 전 [다시 읽기]에도 이 기록은 유지된다. */
  const [manualMatch, setManualMatch] = useState({});
  /** 직접 매칭 드롭다운의 임시 선택 — { [penId]: 명단 순번 문자열 } */
  const [matchPick, setMatchPick] = useState({});
  /** 우측 뷰어에서 보고 있는 반(북코드) — 비정상 펜만 탭이 생긴다 */
  const [viewBookCode, setViewBookCode] = useState(null);
  /** 답안지 샘플 이미지를 못 불러오면 텍스트 목으로 되돌린다 */
  const [answerImgFailed, setAnswerImgFailed] = useState(false);
  const [selectedPenId, setSelectedPenId] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  /* [SCR-07 v1.3] 마지막 판정에 포함된 펜 목록.
   *   2단계에서 펜을 빼거나 새로 꽂으면 그 펜은 아직 읽지 않은 상태다.
   *   판정(2단계)은 다운로드를 동반해 비싸므로 자동으로 다시 돌리지 않고,
   *   교사가 여러 자루를 다 고친 뒤 [다시 읽기]를 누를 때 한 번만 돈다. */
  const [judgedPenIds, setJudgedPenIds] = useState([]);
  const dockedRef = React.useRef({});
  /** 첫 거치에서 연결 실패를 이미 낸 펜 — 다시 꽂으면 연결된다 */
  const failedOnceRef = React.useRef(new Set());

  // ── Step 3·4: 채점 상태 ──
  const [progress, setProgress] = useState(0);
  const [gradingFinished, setGradingFinished] = useState(false);
  const [gradedIds, setGradedIds] = useState([]);
  /* [SCR-07 v2.9] 채점 중 「다른 일 하셔도 됩니다」 안내 — 시작 후 일정 시간이 지나면 시간차로 띄운다.
   *   푸터 한 줄만으로는 교사가 로딩 화면을 계속 바라본다(현장 관찰). */
  const [gradingElapsed, setGradingElapsed] = useState(0);
  useEffect(() => {
    if (step !== 'grading' || gradingFinished) return undefined;
    const t0 = Date.now();
    const iv = setInterval(() => setGradingElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [step, gradingFinished]);
  /* [SCR-07 v2.9] AI 채점 실패 펜 — { [penId]: true }. 에뮬레이터는 첫 시도에서 마지막 펜 1자루를 실패시키고, [다시 시도]에서 성공시킨다 */
  const [failedPenIds, setFailedPenIds] = useState([]);
  const [retrying, setRetrying] = useState(false);
  const failedOnceGradeRef = React.useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  /* [SCR-07 v2.5] 진단 로그 — 헤더 ⋯ 메뉴의 [로그 다운로드] + 장애 반복 시 인라인 안내.
   *   실제 장애 로그(2026-09-07)에서 교사는 브릿지 끊김 뒤 80분간 재시도만 반복했다. 그 순간 「로그를 보내라」는
   *   신호가 화면 어디에도 없었다. 연결 실패·읽기 실패가 한 세션에서 2회 이상이면 같은 다운로드 버튼을 그 자리에 밀어 넣는다. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [troubleCount, setTroubleCount] = useState(0);
  const teacherId = 'tch20261zim';
  const [toast, setToast] = useState('');
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [penDataDialogOpen, setPenDataDialogOpen] = useState(false);
  const handleDownloadLog = () => { setMenuOpen(false); setLogDialogOpen(true); };
  const doDownloadLog = (date) => { const name = appLogger.downloadLog({ teacherId, date }); setLogDialogOpen(false); setToast(`진단 로그를 내려받았습니다 — ${name}`); };
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const noteTrouble = () => setTroubleCount((n) => n + 1);
  /* [SCR-07 v2.6] 장애 반복 시 배너는 사실만 말하고, 다운로드 경로는 헤더 ⋯ 옆 **자동 툴팁**이 가리킨다.
   *   배너에 버튼을 두면 같은 기능이 두 군데 생겨 헷갈린다. 툴팁은 ⋯ 메뉴를 한 번 열면 사라진다. */
  const [hintDismissed, setHintDismissed] = useState(false);
  const [hoverStep, setHoverStep] = useState(null);
  /* [SCR-07 v2.8] 구성 변경 안내는 배너 대신 [↻ 다시 읽기] 위 툴팁 — 구성이 바뀌는 순간 자동으로 뜨고, 호버해도 뜬다.
   *   자동 툴팁은 ✕로 닫거나 다시 읽기를 누르면 사라지며, 다음 구성 변경 때 다시 뜬다. */
  const [rereadHover, setRereadHover] = useState(false);
  const [rereadHintClosed, setRereadHintClosed] = useState(false);
  const showLogHint = troubleCount >= 2 && !hintDismissed && !menuOpen;

  // 과제 문항 — 비어 있으면 1문항으로 가정
  const questionList = useMemo(
    () => (questions.length ? questions : [{ id: 1, title: '문항 1', sheets: 1 }]),
    [questions]
  );

  /** 에뮬레이터가 쓸 펜 재고 — 대상 학생·과제가 바뀌면 다시 만든다 */
  const penPool = useMemo(
    () => buildCradleFixture(selectedStudents, groupLabel, taskTitle, questionList),
    [selectedStudents, groupLabel, taskTitle, questionList]
  );

  /* [SCR-07 v1.1] AiGLE Connect 실행 확인 — **모달을 열 때 1회만** 돈다.
   *   舊 「NeoStudio2Lite」 명칭 폐기. 크래들 일괄 채점이 요구하는 프로그램은 **AiGLE Connect**다.
   *   `connectorReady`를 의존성에 넣으면 프로그램을 실행한 순간 확인 스피너가 다시 도는
   *   뒷걸음질이 생기므로, 실행 직후 상태는 POP-30 모달의 콜백이 직접 올린다. */
  const readyRef = React.useRef(connectorReady);
  readyRef.current = connectorReady;
  useEffect(() => {
    if (!open) return;
    setConnectorState('checking');
    const t = setTimeout(() => {
      const ok = readyRef.current;
      setConnectorState(ok ? 'ready' : 'blocked');
      // 실행 중이 아니면 필수 프로그램 확인 창을 바로 띄운다 — 교사가 할 일이 그것 하나뿐이다
      if (!ok) setProgramModalOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [open]);

  /* [SCR-07 v1.0] `open === false`(최소화)일 때도 **훅은 전부 돈다**.
   * 여기서 early return 하면 아래 useMemo/useCallback이 건너뛰어져 최소화하는 순간
   * React가 「Rendered fewer hooks than expected」로 죽는다. 렌더만 마지막에 막는다. */

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const dockedPens = Object.values(docked).sort((a, b) => a.slot - b.slot);
  // 판정 종료 시점의 거치 상태를 읽기 위한 참조 (setTimeout 클로저가 낡은 값을 보지 않게)
  dockedRef.current = docked;
  const connectedPens = dockedPens.filter((p) => p.link === 'connected');

  /* ── Step 1 조작 ── */
  const dockPen = (slot) => {
    const pen = penPool.find((p) => p.slot === slot);
    if (!pen) return;
    /* [SCR-07 v1.3] 다시 꽂힌 펜은 «아직 안 읽은» 상태로 되돌린다.
     * 빼는 사이에 번호표를 다시 찍었을 수 있으므로, 이전 판정을 그대로 믿으면 안 된다. */
    setJudgedPenIds((prev) => prev.filter((id) => id !== pen.id));
    setDocked((prev) => ({ ...prev, [slot]: { ...pen, link: 'linking' } }));
    /* [SCR-07 v2.3] 연결 실패 — 접촉 불량 등으로 크래들이 펜을 못 잡는 경우. 첫 거치에서 한 번만 실패시켜
     * 「빼서 다시 꽂으면 정상」 흐름을 보여 준다. 실패한 펜은 연결 완료·판정 대상에 들어가지 않는다. */
    const willFail = pen.flaky && !failedOnceRef.current.has(pen.id);
    if (willFail) failedOnceRef.current.add(pen.id);
    appLogger.info('usb-pen-monitor', '펜 거치 감지', { mac: pen.mac, penId: pen.id, cradle: cradleOf(slot), slot: slotInCradle(slot) });
    setTimeout(() => {
      setDocked((prev) => (prev[slot] ? { ...prev, [slot]: { ...prev[slot], link: willFail ? 'failed' : 'connected' } } : prev));
      if (willFail) {
        appLogger.error('usb-pen-monitor', '펜 연결 실패', { mac: pen.mac, penId: pen.id, error: { message: 'USB handshake timeout', code: 'E-PEN-LINK-TIMEOUT' } });
        noteTrouble();
      } else {
        appLogger.info('usb-pen-monitor', '펜 연결 완료', { mac: pen.mac, penId: pen.id, firmware: pen.firmware, battery: pen.battery });
      }
    }, 700);
  };
  const undockPen = (slot) => {
    appLogger.info('usb-pen-monitor', '펜 제거 감지', { cradle: cradleOf(slot), slot: slotInCradle(slot) });
    setDocked((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };
  const toggleSlot = (slot) => (docked[slot] ? undockPen(slot) : dockPen(slot));
  const dockAll = () => penPool.forEach((p) => { if (!docked[p.slot]) dockPen(p.slot); });
  const undockAll = () => setDocked({});

  const runFirmwareUpdate = (penId) => {
    let v = 0;
    setFwUpdating((prev) => ({ ...prev, [penId]: 0 }));
    const iv = setInterval(() => {
      v += 10;
      setFwUpdating((prev) => ({ ...prev, [penId]: v }));
      if (v >= 100) {
        clearInterval(iv);
        setFwUpdating((prev) => { const n = { ...prev }; delete n[penId]; return n; });
        setDocked((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (next[k].id === penId) next[k] = { ...next[k], firmware: '2.1.0', needsUpdate: false };
          });
          return next;
        });
      }
    }, 120);
  };
  const updateAllFirmware = () => connectedPens.filter((p) => p.needsUpdate).forEach((p) => runFirmwareUpdate(p.id));

  /* ────────────────────────────────────────────────────────────
   * Step 2 판정 — POP-28 1단계(북코드) → 2단계(번호표) → 3단계(중복)
   * ──────────────────────────────────────────────────────────── */
  const myBookCode = '334212';
  const siblingCodes = ['334213', '334214', '334215', '334216']; // 같은 과제의 2~5반 북코드
  const targetIds = selectedStudents.map((s) => s.id);

  /** 판정 코드 하나를 { type, badge, progress } 결과로 만든다 */
  const verdictOf = (type, extra = {}) => ({
    type,
    stage: ['empty', 'other_group', 'other_task'].includes(type) ? 1
      : ['roster_loading', 'no_tag', 'bad_tag', 'not_in_roster', 'not_selected'].includes(type) ? 2
        : type === 'duplicate' ? 3 : 4,
    progress: VERDICT_SPEC[type]?.progress ?? '',
    studentId: null,
    ...extra,
  });

  /* 펜 1자루의 1·2단계 판정 (중복 검사는 아래에서 전체를 놓고 한 번에).
   * POP-28 §1: **1단계에서 걸리면 2단계로 가지 않는다** — 그래서 1·2단계 사유가 서로 덮지 않는다. */
  const judgeOne = useCallback((pen) => {
    /* [SCR-07 v2.0] 직접 매칭이 있으면 판정보다 우선한다 — 교사가 답안을 보고 내린 결정이 번호표 판독보다 확실하다.
     * 매칭한 북코드의 답안 묶음이 아직 펜에 있어야 한다(펜을 바꿔 꽂았으면 무효). */
    const mm = manualMatch[pen.id];
    if (mm && targetIds.includes(mm.studentId)) {
      const book = pen.books.find((b) => b.code === mm.bookCode && b.answerPages.length);
      if (book) return verdictOf('ok', { studentId: mm.studentId, manual: true, bookCode: mm.bookCode, progress: '펜 연결 · 직접 매칭' });
    }

    // ── 1단계 · 북코드 대조 (파일 이름만 본다) ──
    if (!pen.books.length) return verdictOf('empty');            // #1
    const mine = pen.books.find((b) => b.code === myBookCode);
    if (!mine) {
      const sibs = pen.books.filter((b) => siblingCodes.includes(b.code));
      if (sibs.length) {                                         // #2
        /* POP-28 #2 문구 — 「그룹 불일치 [감지: 1-2반 → 선택: 1-1반]」. 반이 여럿이면 감지 쪽에 나열한다 */
        const short = (label) => label.replace(/(\d+)학년\s*(\d+)반/, '$1-$2반');
        return verdictOf('other_group', {
          progress: `그룹 불일치 [감지: ${sibs.map((b) => short(b.groupLabel)).join('·')} → 선택: ${short(groupLabel)}]`,
          detectedGroups: sibs.map((b) => b.groupLabel),
        });
      }
      return verdictOf('other_task');                            // #3
    }

    // ── 2단계 · 내용 판정 (여기부터는 내 북코드가 있는 펜만) ──
    if (!rosterReady) return verdictOf('roster_loading');        // #4
    // 번호표를 여러 번 찍었으면 **가장 나중에 찍은 것 1개**만 쓴다 (POP-28 §2)
    const tag = [...mine.tagPages].reverse().find((p) => p.checked);
    if (!tag) return verdictOf('no_tag');                        // #5
    if (tag.checked.flaw) return verdictOf('bad_tag', { flaw: tag.checked.flaw }); // #6
    const student = selectedStudents[tag.checked.seq];
    if (!student) return verdictOf('not_in_roster', { seq: tag.checked.seq }); // #7
    if (!targetIds.includes(student.id)) return verdictOf('not_selected', { name: student.name }); // #8

    // ── 통과 이후 ──
    if (!mine.answerPages.length) return verdictOf('no_answer', { studentId: student.id }); // #10
    return verdictOf('ok', { studentId: student.id, bookCode: myBookCode }); // #11
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMatch, selectedStudents, groupLabel, rosterReady]);

  /** 전 펜 판정 + 3단계 중복 검사 */
  const verdicts = useMemo(() => {
    const base = {};
    /* [SCR-07 v1.3] 마지막 판정에 포함되지 않은 펜(새로 꽂힘)은 **아직 읽지 않은** 상태다.
     * POP-28 §5의 「로딩중 = 조회 중」에 해당한다. [다시 읽기]를 눌러야 판정이 붙는다. */
    connectedPens.forEach((p) => {
      base[p.id] = judgedPenIds.includes(p.id) ? judgeOne(p) : verdictOf('roster_loading');
    });

    // 3단계 — 같은 학생이 두 펜에 매칭되면 둘 다 중복
    const byStudent = {};
    Object.entries(base).forEach(([penId, v]) => {
      if (v.type !== 'ok') return;
      (byStudent[v.studentId] = byStudent[v.studentId] || []).push(penId);
    });
    /* [POP-28 #9] 같은 학생을 가리키는 펜이 둘 이상이면 **양쪽 모두** 중복이다.
     * 해소는 교사가 답안을 보고 잘못 붙은 펜을 진짜 주인에게 **직접 매칭**하는 것이다(v2.0). */
    Object.entries(byStudent).forEach(([studentId, penIds]) => {
      if (penIds.length < 2) return;
      penIds.forEach((penId) => {
        base[penId] = {
          ...base[penId], type: 'duplicate', stage: 3,
          progress: VERDICT_SPEC.duplicate.progress,
          rivalIds: penIds.filter((x) => x !== penId),
        };
      });
    });

    /* [POP-28 #12] 업로드가 끝나면 펜에서 파일이 지워진다 — 배지만 「데이터 삭제」로 바뀌고
     * 채점 진행 칸은 「AI 채점 완료」 그대로다. 채점 중에는 진행 칸이 「AI 채점중」이 된다. */
    Object.entries(base).forEach(([penId, v]) => {
      if (v.type !== 'ok') return;
      if (failedPenIds.includes(penId)) base[penId] = { ...v, type: 'grade_failed', progress: VERDICT_SPEC.grade_failed.progress };
      else if (uploadedPenIds.includes(penId)) base[penId] = { ...v, type: 'uploaded', progress: VERDICT_SPEC.uploaded.progress };
      else if (gradingPenIds.includes(penId)) base[penId] = { ...v, type: 'grading', progress: VERDICT_SPEC.grading.progress };
    });
    return base;
  }, [connectedPens, judgeOne, judgedPenIds, gradingPenIds, uploadedPenIds, failedPenIds]);

  const gradableStudentIds = useMemo(
    () => Object.values(verdicts).filter((v) => ['ok', 'grading', 'uploaded'].includes(v.type)).map((v) => v.studentId),
    [verdicts]
  );
  /** 채점에 못 올라간 펜 — 1·2단계 실패 + 3단계 중복. 조치가 필요한 대상이다 */
  const attentionPens = useMemo(
    () => connectedPens.filter((p) => !['ok', 'grading', 'uploaded'].includes(verdicts[p.id]?.type)),
    [connectedPens, verdicts]
  );
  const duplicatePens = useMemo(
    () => connectedPens.filter((p) => verdicts[p.id]?.type === 'duplicate'),
    [connectedPens, verdicts]
  );
  /* 목록 정렬 — 확인이 필요한 펜을 맨 위로(POP-28 #9), 나머지는 슬롯 순서.
   * 교사가 할 일이 목록 아래에 묻히지 않게 하는 것이 유일한 정렬 기준이다.
   * [SCR-07 v1.5] 크래들 3대(30자루)가 되면서 「아무 필기 없음」·「다른 그룹」처럼 1단계에서
   * 걸린 펜이 수십 자루 생긴다. 이들은 번호표 재체크로 풀 수 없어 교사가 할 일이 없으므로
   * 조치 가능한 펜(중복·2단계) → 정상 → 1단계 순으로 내린다. */
  /* [SCR-07 v2.4] 정렬은 **판정이 끝난 시점에 한 번만** 고정한다.
   *   직접 매칭으로 상태가 바뀔 때마다 다시 정렬하면 방금 만진 행이 아래로 튀어 교사가 눈으로 따라가지 못한다.
   *   그 자리에서 배지·문구만 바뀌고, 순서는 [다시 읽기]로 판정을 다시 돌릴 때만 새로 잡는다. */
  const [listOrder, setListOrder] = useState([]);
  useEffect(() => {
    if (reading || step !== 'mapping') return;
    const rank = (p) => {
      const v = verdicts[p.id];
      if (['ok', 'grading', 'uploaded'].includes(v?.type)) return 1;
      return v?.stage === 1 ? 2 : 0;
    };
    setListOrder([...connectedPens].sort((x, y) => rank(x) - rank(y) || x.slot - y.slot).map((p) => p.id));
    // 판정 종료(reading false) 시점에만 순서를 잡는다 — 판정 결과(verdicts)는 그 렌더에서 이미 새 값이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, step]);
  const listedPens = useMemo(() => {
    const pos = new Map(listOrder.map((id, i) => [id, i]));
    // 판정 이후 새로 꽂힌 펜(순서에 없음)은 맨 아래에 슬롯 순으로 붙는다
    return [...connectedPens].sort((x, y) => (pos.has(x.id) ? pos.get(x.id) : 1e6 + x.slot) - (pos.has(y.id) ? pos.get(y.id) : 1e6 + y.slot));
  }, [connectedPens, listOrder]);
  /* [SCR-07 v1.3] 마지막 판정 이후 크래들 구성이 바뀌었는가 —
   *   새로 꽂힌 펜(아직 안 읽음) 또는 빠진 펜(판정이 남아 있으나 이제 없음). */
  const unreadPens = useMemo(
    () => connectedPens.filter((p) => !judgedPenIds.includes(p.id)),
    [connectedPens, judgedPenIds]
  );
  const dockChanged = unreadPens.length > 0
    || judgedPenIds.some((id) => !connectedPens.find((p) => p.id === id));
  useEffect(() => { if (!dockChanged) setRereadHintClosed(false); }, [dockChanged]);
  /* [SCR-07 v2.4] 카운트는 **배지 색**과 같은 기준으로 센다 —
   *   확인 필요 = 빨강(동기화 불가 · 중복), 대상 아님 = 회색(데이터 없음: 빈 펜 · 답안 미작성).
   *   舊 「1단계 탈락 = 대상 아님」 기준은 그룹 불일치(빨간 배지)를 대상 아님에 넣어 숫자가 배지와 어긋났다. */
  const needsCheckCount = useMemo(
    () => connectedPens.filter((p) => { const t = verdicts[p.id]?.type; return t === 'duplicate' || VERDICT_SPEC[t]?.badge === 'unsyncable'; }).length,
    [connectedPens, verdicts]
  );
  const notTargetCount = useMemo(
    () => connectedPens.filter((p) => { const t = verdicts[p.id]?.type; return VERDICT_SPEC[t]?.badge === 'nodata'; }).length,
    [connectedPens, verdicts]
  );
  const unmappedStudents = useMemo(
    () => selectedStudents.filter((s) => !gradableStudentIds.includes(s.id)),
    [selectedStudents, gradableStudentIds]
  );

  /* [SCR-07 v1.0] 채점 시작 차단 조건
   *   중복만 차단한다. 같은 학생에 두 펜이 붙은 채로는 어느 답안이 채점될지 정해지지 않기 때문이다.
   *   미매칭 펜·미연결 학생은 **차단하지 않는다** — 크래들에 없는 학생은 자연 제외이고,
   *   미매칭 펜은 애초에 이 그룹 데이터가 아닐 수 있어 교사에게 강제할 근거가 없다.
   *   대신 완료 요약과 푸터에서 몇 명이 빠지는지 고지한다. */
  const startBlocked = duplicatePens.length > 0 || gradableStudentIds.length === 0;
  const startBlockReason = duplicatePens.length > 0
    ? `중복 데이터 ${duplicatePens.length}개를 먼저 풀어 주세요. 답안을 보고 잘못 붙은 펜을 진짜 주인에게 직접 매칭하면 풀립니다.`
    : '채점할 수 있는 펜이 없습니다. 펜을 거치한 뒤 [다시 읽기]를 누르거나, 답안을 보고 학생을 직접 매칭해 주세요.';

  /* ── 단계 이동 ── */
  /* [POP-28 §1] 판정을 3단계로 나눠 순서대로 밟는다.
   *   1단계는 파일 이름만 보므로 빠르고, 2단계에서야 실제 다운로드가 일어난다.
   *   그래서 「지금 무엇을 하느라 기다리는지」를 단계 이름과 브릿지 호출로 밝힌다.
   *   그룹 명단(#4)은 2단계에 들어갈 때 도착한 것으로 본다. */
  const runJudge = (fast = false) => {
    const t = fast ? 0.7 : 1;
    appLogger.info('usePenDataBatchUploadModalController', fast ? '펜 재검색 시작' : '펜 데이터 읽기 시작', { penCount: connectedPens.length, bookCode: myBookCode });
    connectedPens.forEach((p) => appLogger.debug('offline-strokes-api', `[GetOfflineFileNames] mac=${p.mac}`, { count: p.books.length * 3, fileNames: p.books.flatMap((b) => [`${b.code}c`, `${b.code}t`, `${b.code}o`]) }));
    setReading(true);
    setRosterReady(false);
    setJudgePhase('books');
    setTimeout(() => setJudgePhase('content'), 700 * t);
    setTimeout(() => setRosterReady(true), 1500 * t);
    setTimeout(() => setJudgePhase('duplicate'), 1900 * t);
    setTimeout(() => {
      // 이번 판정이 실제로 읽은 펜을 확정한다 (그 사이 꽂힌 펜은 다음 판정 몫)
      // 연결 실패 펜은 판정 대상이 아니므로 「읽은 펜」에도 넣지 않는다 — 넣으면 곧바로 「구성이 바뀌었다」로 오판한다
      setJudgedPenIds(Object.values(dockedRef.current).filter((p) => p.link === 'connected').map((p) => p.id));
      setJudgePhase(null);
      setReading(false);
      appLogger.info('usePenDataBatchUploadModalController', '펜 데이터 읽기 완료', { penCount: Object.keys(dockedRef.current).length });
    }, 2400 * t);
  };
  const goMapping = () => { setStep('mapping'); runJudge(); };

  const startGrading = () => {
    const ids = [...new Set(gradableStudentIds)];
    appLogger.info('useBatchUploadPipeline', '일괄 업로드 시작', { collectedCount: ids.length, excludedCount: attentionPens.length });
    const penIds = Object.entries(verdicts).filter(([, v]) => v.type === 'ok').map(([penId]) => penId);
    setGradedIds(ids);
    // [POP-28 #11] 펜 연결 → AI 채점중
    setGradingPenIds(penIds);
    setUploadedPenIds([]);
    setFailedPenIds([]);
    setGradingElapsed(0);
    onGradingStarted?.(ids);
    setStep('grading');
    setProgress(0);
    /* 에뮬레이터 — 첫 시도에서는 마지막 펜 1자루가 「토큰 용량 초과」로 실패한다(서버 응답 지연 재현). 재시도에서는 성공 */
    const failPenId = (!failedOnceGradeRef.current && penIds.length >= 2) ? penIds[penIds.length - 1] : null;
    let v = 0;
    const iv = setInterval(() => {
      v += 1;
      setProgress(Math.min(100, v));
      /* [POP-28 #12] 업로드가 끝난 펜부터 순서대로 파일이 지워진다 —
       * 「데이터 삭제」는 실패가 아니라 정상 완료의 흔적이다. 진행률에 맞춰 앞에서부터 옮긴다. */
      const doneCount = Math.floor((v / 100) * penIds.length);
      setUploadedPenIds(penIds.slice(0, doneCount).filter((id) => id !== failPenId));
      if (v >= 100) {
        clearInterval(iv);
        setUploadedPenIds(penIds.filter((id) => id !== failPenId));
        setGradingPenIds([]);
        if (failPenId) {
          failedOnceGradeRef.current = true;
          setFailedPenIds([failPenId]);
          appLogger.error('useBatchUploadPipeline', 'AI 채점 실패', { penId: failPenId, error: { message: 'context length exceeded', code: 'E-AI-TOKEN-LIMIT' } });
        }
        setGradingFinished(true);
        onGradingFinished?.();
        setTimeout(() => setStep('completed'), 500);
      }
    }, 200);
  };

  /* [SCR-07 v2.9] 실패한 펜만 다시 채점 — 정상 펜의 결과는 그대로 둔다 */
  const retryFailed = () => {
    const targets = [...failedPenIds];
    if (!targets.length) return;
    setRetrying(true);
    setFailedPenIds([]);
    setGradingPenIds(targets);
    appLogger.info('useBatchUploadPipeline', 'AI 채점 재시도', { penIds: targets });
    setTimeout(() => {
      setGradingPenIds([]);
      setUploadedPenIds((prev) => [...prev, ...targets]);
      setRetrying(false);
      setToast('실패했던 답안의 채점이 완료되었습니다.');
    }, 2500);
  };

  /* [SCR-07 v1.0] 닫기 정책 — SCR-05와 동일
   *   connect            → 즉시 종료 (진행한 작업 없음)
   *   mapping            → 확인 다이얼로그 (판정·수동 연결 결과 폐기)
   *   grading · completed→ 최소화. 채점은 계속 진행되고 FAB로 다시 열 수 있다 */
  const handleCloseAttempt = () => {
    if (step === 'grading' || step === 'completed') {
      onMinimize?.({ finished: step === 'completed' || gradingFinished });
      return;
    }
    if (step === 'connect') { onClose?.(); return; }
    setConfirmClose(true);
  };

  const selectedPen = selectedPenId ? connectedPens.find((p) => p.id === selectedPenId) : null;
  const selectedVerdict = selectedPen ? verdicts[selectedPen.id] : null;
  const isFine = (t) => ['ok', 'grading', 'uploaded'].includes(t);
  /* [SCR-07 v2.0] 뷰어가 보여 줄 답안 묶음(반 단위).
   *   정상 펜        → 선택 그룹 답안만 (다른 반 데이터는 각 반 채점 때 보이면 된다)
   *   직접 매칭 펜   → 매칭한 반의 답안
   *   비정상 펜      → 이 과제의 모든 반 답안을 **반 탭**으로. 페이지를 섞어 넘기지 않으므로 헷갈리지 않는다.
   *   다른 과제 데이터는 어떤 경우에도 보이지 않는다(1단계에서 이미 걸러짐). */
  const viewableBooks = (() => {
    if (!selectedPen) return [];
    const withAnswer = selectedPen.books.filter((b) => b.answerPages.length);
    if (selectedVerdict?.manual) return withAnswer.filter((b) => b.code === selectedVerdict.bookCode);
    if (isFine(selectedVerdict?.type)) return withAnswer.filter((b) => b.isMine);
    return [...withAnswer].sort((a, b) => (b.isMine ? 1 : 0) - (a.isMine ? 1 : 0));
  })();
  const curBook = viewableBooks.find((b) => b.code === viewBookCode) || viewableBooks[0] || null;
  const flatPages = curBook ? curBook.answerPages.map((p) => ({ ...p, kind: 'answer', book: curBook })) : [];
  const curPage = flatPages[Math.min(pageIdx, Math.max(0, flatPages.length - 1))];

  // 훅을 모두 실행한 뒤에야 렌더를 막는다 (최소화 시 mount 유지 — 채점은 계속 진행된다)
  if (!open) return null;

  const pickPen = (penId) => { setSelectedPenId(penId); setPageIdx(0); setViewBookCode(null); setAnswerImgFailed(false); };

  /* [SCR-07 v2.0] 직접 매칭 / 해제 — 판정은 manualMatch 의존으로 곧바로 다시 계산된다([다시 읽기] 불필요) */
  const matchPen = (penId, studentId, bookCode) => {
    appLogger.info('usePenDataBatchUploadModalController', '직접 매칭', { penId, studentId, bookCode });
    setManualMatch((prev) => ({ ...prev, [penId]: { studentId, bookCode } }));
    setMatchPick((prev) => { const n = { ...prev }; delete n[penId]; return n; });
  };
  const unmatchPen = (penId) => setManualMatch((prev) => { const n = { ...prev }; delete n[penId]; return n; });

  /** 다시 읽기 — 지금 거치된 펜을 기준으로 판정을 처음부터 다시 돌린다 */
  const reread = () => runJudge(true);

  /* ── 공용 스타일 ── */
  const sectionCard = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' };
  const ghostBtn = { padding: '9px 18px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' };
  const primaryBtn = (enabled) => ({ padding: '9px 18px', borderRadius: 8, background: enabled ? '#2A75F3' : '#CBD5E1', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit' });

  /* ────────────────────────────────────────────────────────────
   * 크래들 렌더 — 첨부 이미지(NEO SMARTPEN 10구 크래들) 형태
   * ──────────────────────────────────────────────────────────── */
  /* [SCR-07 v1.5] 크래들 3대를 나란히 그린다. 폭이 모자라면 줄바꿈해 2+1로 내려간다.
   *   슬롯 폭은 10구 1대 기준(52px)보다 좁혀 1600px 화면에서 3대가 한 줄에 들어가게 했다. */
  const renderCradle = ({ compact = false } = {}) => {
    /* compact(2단계 왼쪽 열) — 3대가 열 폭 절반(~640px) 안에 들어가도록 슬롯 16px */
    const wellH = compact ? 40 : 136;
    const penH = compact ? 50 : 190;
    const slotW = compact ? 16 : 36;
    const dockedIn = (c) => dockedPens.filter((p) => cradleOf(p.slot) === c).length;

    /* 펜은 크래들 본체보다 길어 아래로 튀어나온다(실물과 동일). 슬롯 상태 라벨은
       그 펜 끝보다 더 아래에 두어야 겹치지 않으므로 컨테이너 하단 여백을 크게 잡는다. */
    return (
      <div style={{ display: 'flex', justifyContent: compact ? 'flex-start' : 'center', flexWrap: 'wrap', gap: compact ? 6 : 14, paddingBottom: compact ? 30 : 120 }}>
        {Array.from({ length: CRADLE_COUNT }, (_, ci) => ci + 1).map((cradleNo) => (
        <div key={cradleNo} style={{
          position: 'relative',
          background: 'linear-gradient(180deg, #7A8085 0%, #5C6267 55%, #4C5257 100%)',
          borderRadius: compact ? 10 : 16,
          padding: compact ? '6px 8px 0' : '20px 16px 0',
          boxShadow: '0 10px 24px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}>
          {!compact && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, color: 'rgba(255,255,255,0.72)' }}>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, letterSpacing: 1 }}>◈ NEO SMARTPEN <span style={{ opacity: 0.7, letterSpacing: 0, marginLeft: 6 }}>크래들 {cradleNo}</span></span>
              <span style={{ fontSize: 'var(--neo-font-size-xs)' }}>
                {connectorState === 'ready'
                  ? <span style={{ color: '#86EFAC', fontWeight: 700 }}>● 연결됨 · {dockedIn(cradleNo)}/{SLOTS_PER_CRADLE}</span>
                  : <span style={{ color: '#FCD34D', fontWeight: 700 }}>● 확인 중</span>}
              </span>
            </div>
          )}
          {compact && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: 800, marginBottom: 2, letterSpacing: 1 }}>크래들 {cradleNo}</div>
          )}

          <div style={{ display: 'flex', gap: compact ? 3 : 6 }}>
            {Array.from({ length: SLOTS_PER_CRADLE }, (_, i) => (cradleNo - 1) * SLOTS_PER_CRADLE + i + 1).map((slot) => {
              const pen = docked[slot];
              const available = penPool.some((p) => p.slot === slot);
              const v = pen ? verdicts[pen.id] : null;
              const vt = v ? badgeOf(v.type) : null;
              const isPicked = pen && selectedPenId === pen.id;
              return (
                <div key={slot} style={{ width: slotW, position: 'relative' }}>
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: compact ? 8 : 'var(--neo-font-size-xs)', fontWeight: 700, marginBottom: compact ? 2 : 4 }}>{slotInCradle(slot)}</div>
                  <button
                    type="button"
                    /* [SCR-07 v1.3] 거치/제거는 단계와 무관한 하드웨어 동작이라 2단계에서도 열어 둔다.
                       번호표를 다시 체크하려면 펜을 빼야 하고, 다 찍으면 다시 꽂아야 하기 때문이다.
                       다만 2단계에서 «거치된 펜»을 누르면 제거가 아니라 데이터 열람이 자연스럽다. */
                    onClick={() => (pen
                      ? (step === 'connect' ? undockPen(slot) : pickPen(pen.id))
                      : (available ? dockPen(slot) : null))}
                    disabled={!pen && !available}
                    aria-label={`${slotLabel(slot)}${pen ? ` — ${pen.id}` : ' — 비어 있음'}`}
                    title={pen
                      ? (step === 'connect' ? `${slotLabel(slot)} — 펜 제거` : `${pen.id} 답안 확인`)
                      : (available ? `${slotLabel(slot)} — 펜 거치` : '이 슬롯에 거치할 펜이 없습니다')}
                    style={{
                      width: '100%', height: wellH, padding: 0, cursor: (step === 'connect' ? available : !!pen) ? 'pointer' : 'default',
                      background: 'linear-gradient(180deg, #33383C 0%, #3E4448 100%)',
                      border: isPicked ? '2px solid #60A5FA' : '1px solid rgba(0,0,0,0.35)',
                      borderRadius: `${compact ? 5 : 7}px ${compact ? 5 : 7}px 0 0`,
                      boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5)',
                      position: 'relative', overflow: 'visible', display: 'block',
                    }}
                  >
                    {pen && (
                      <div style={{
                        position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: compact ? 4 : 8,
                        width: compact ? 8 : 18, height: penH, borderRadius: compact ? 4 : 9,
                        background: 'linear-gradient(90deg, #121417 0%, #2B3035 40%, #16191C 100%)',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: compact ? 3 : 8,
                      }}>
                        {/* 펜 LED — 연결 상태 색 */}
                        <span style={{
                          width: compact ? 3 : 6, height: compact ? 3 : 6, borderRadius: 1,
                          background: pen.link === 'connected' ? '#4ADE80' : '#FBBF24',
                          boxShadow: `0 0 6px ${pen.link === 'connected' ? '#4ADE80' : '#FBBF24'}`,
                        }} />
                        {!compact && (
                          <span style={{ marginTop: 12, writingMode: 'vertical-rl', color: 'rgba(255,255,255,0.35)', fontSize: 7, letterSpacing: 1 }}>
                            NEO SMARTPEN
                          </span>
                        )}
                      </div>
                    )}
                    {!pen && (
                      <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,0.22)', fontSize: compact ? 10 : 'var(--neo-font-size-xs)' }}>
                        {available ? '＋' : ''}
                      </span>
                    )}
                  </button>

                  {/* 슬롯 하단 상태 — 연결 단계는 배터리/펌웨어, 매핑 단계는 판정 배지 */}
                  <div style={{ position: 'absolute', top: wellH + (compact ? 24 : 86), left: '50%', transform: 'translateX(-50%)', width: compact ? 20 : 60, textAlign: 'center' }}>
                    {/* [SCR-07 v2.3] 슬롯 아래는 연결 상태(연결 중 / 연결됨 / 연결 실패)만. 배터리·펌웨어는 아래 목록이 맡는다 */}
                    {pen && step === 'connect' && (
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '1px 6px', borderRadius: 999, display: 'inline-block', whiteSpace: 'nowrap',
                        background: LINK_TOKEN[pen.link].bg, color: LINK_TOKEN[pen.link].color }}>{LINK_TOKEN[pen.link].label}</div>
                    )}
                    {/* 매핑 단계의 미니 크래들은 판정 배지를 「점」으로만 찍는다.
                        슬롯 폭이 34px라 `동기화 불가` 같은 라벨은 이웃 슬롯을 침범한다.
                        사유 전문은 툴팁과 좌측 트레이·우측 상세가 말한다. */}
                    {pen && step !== 'connect' && vt && (
                      <div title={`${vt.label}${v.progress ? ` — ${v.progress}` : ''}`} style={{ fontSize: 10, lineHeight: 1 }}>{vt.dot}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        ))}
      </div>
    );
  };

  /* ────────────────────────────────────────────────────────────
   * 렌더
   * ──────────────────────────────────────────────────────────── */
  return createPortal(
    <div onClick={handleCloseAttempt} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={(e) => { e.stopPropagation(); if (menuOpen) setMenuOpen(false); }} style={{ position: 'relative', background: '#F8FAFC', borderRadius: 16, width: '92vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{ padding: '18px 24px 12px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>🖊 크래들 일괄 채점</h2>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 4 }}>
              그룹 <strong style={{ color: '#1E293B' }}>{groupLabel}</strong> · 과제 <strong style={{ color: '#1E293B' }}>{taskTitle}</strong> · 대상 학생 <strong style={{ color: '#1E293B' }}>{selectedStudents.length}명</strong>

            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
            {/* [SCR-07 v2.5] ⋯ 메뉴 — [로그 다운로드]. 환경설정의 같은 버튼과 같은 파일을 만든다 (2단계 한가운데서 전화한 교사가 창을 닫지 않고 뽑는 경로) */}
            <button type="button" onClick={() => { setMenuOpen((x) => !x); setHintDismissed(true); }} aria-label="더 보기" title="더 보기"
              style={{ background: 'none', border: showLogHint ? '2px solid #2A75F3' : 'none', borderRadius: 8, fontSize: '1.3rem', cursor: 'pointer', color: showLogHint ? '#2A75F3' : '#64748B', padding: '0 6px', lineHeight: 1 }}>⋯</button>
            {showLogHint && (
              <div role="tooltip" onClick={() => { setMenuOpen(true); setHintDismissed(true); }}
                style={{ position: 'absolute', top: 34, right: 36, background: '#1E293B', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(15,23,42,0.3)', cursor: 'pointer', zIndex: 5 }}>
                <span style={{ position: 'absolute', top: -6, right: 14, width: 12, height: 12, background: '#1E293B', transform: 'rotate(45deg)' }} />
                연결 실패 {troubleCount}회 — 반복되면 여기서 진단 로그를 내려받아 고객센터에 보내 주세요 ↗
                <button type="button" aria-label="닫기" onClick={(e) => { e.stopPropagation(); setHintDismissed(true); }}
                  style={{ marginLeft: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', padding: 0 }}>✕</button>
              </div>
            )}
            {menuOpen && (
              <div style={{ position: 'absolute', top: 30, right: 36, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.15)', padding: 6, minWidth: 200, zIndex: 5 }}>
                <button type="button" onClick={handleDownloadLog}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', cursor: 'pointer' }}>
                  ⬇ 로그 다운로드
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setPenDataDialogOpen(true); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', cursor: 'pointer' }}>
                  ⬇ 펜 데이터 다운로드
                </button>
              </div>
            )}
            <button onClick={handleCloseAttempt} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
          </div>
        </div>
        {toast && (
          <div style={{ position: 'absolute', left: '50%', bottom: 84, transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 16px', borderRadius: 10, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, boxShadow: '0 8px 24px rgba(15,23,42,0.3)', zIndex: 6, whiteSpace: 'nowrap' }}>
            ✓ {toast}
          </div>
        )}

        {/* 스텝 프로그레스 */}
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
                {/* 안내가 있다는 표시 — 호버하면 아래 툴팁이 뜬다 */}
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
        <div style={{ flex: 1, minHeight: 0, padding: '20px 24px', ...(step === 'mapping' ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' } : { overflowY: 'auto' }) }}>

          {/* ── Step 1: 크래들 연결 ── */}
          {step === 'connect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {connectorState === 'checking' && (
                <div style={{ ...sectionCard, textAlign: 'center', padding: '28px 24px' }}>
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  <div style={{ width: 40, height: 40, margin: '0 auto 12px', border: '4px solid #DBEAFE', borderTopColor: '#2A75F3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>AiGLE Connect 실행 상태를 확인하는 중입니다.</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 4 }}>잠시만 기다려 주세요.</div>
                </div>
              )}

              {/* [POP-30] AiGLE Connect가 준비되지 않은 상태 —
                  「설치가 안 됐다」로 단정하지 않는다. 깔려 있는데 꺼진 경우가 더 흔하고,
                  둘을 가르는 일은 필수 프로그램 확인 창이 맡는다. */}
              {connectorState === 'blocked' && (
                <div style={{ ...sectionCard, borderColor: '#FCA5A5', background: '#FEF2F2', textAlign: 'center', padding: '28px 24px' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>⚠️</div>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#991B1B' }}>AiGLE Connect가 준비되지 않았습니다.</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#B91C1C', margin: '6px 0 14px', lineHeight: 1.7 }}>
                    크래들의 펜 데이터를 읽으려면 <strong>AiGLE Connect</strong>가 설치되어 있고 실행 중이어야 합니다.
                  </div>
                  <button onClick={() => setProgramModalOpen(true)} style={{ ...primaryBtn(true), padding: '10px 22px' }}>
                    필수 프로그램 확인
                  </button>
                </div>
              )}

              {connectorState === 'ready' && (
                <>
                  {/* [SCR-07 v2.7] 안내 카드 없음 — 단계 안내는 타이틀 호버, 장애 반복 안내는 ⋯ 툴팁이 맡는다. 실패 안내만 텍스트로 */}
                  {dockedPens.some((p) => p.link === 'failed') && (
                    <div style={{ color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', padding: '0 4px' }}>⚠ 연결 실패한 펜은 뺐다가 다시 꽂아 주세요.</div>
                  )}

                  {renderCradle()}

                  <div style={{ ...sectionCard, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>
                      거치 <span style={{ color: '#2A75F3' }}>{dockedPens.length}</span> / {SLOT_COUNT}개
                      <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                      연결 완료 <span style={{ color: '#10B981' }}>{connectedPens.length}개</span>
                      {dockedPens.some((p) => p.link === 'failed') && (
                        <>
                          <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                          연결 실패 <span style={{ color: '#DC2626' }}>{dockedPens.filter((p) => p.link === 'failed').length}개</span>
                        </>
                      )}
                      {connectedPens.some((p) => p.needsUpdate) && (
                        <>
                          <span style={{ color: '#94A3B8', fontWeight: 400, margin: '0 8px' }}>·</span>
                          펌웨어 업데이트 <span style={{ color: '#DC2626' }}>{connectedPens.filter((p) => p.needsUpdate).length}개</span>
                        </>
                      )}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={dockAll} style={{ ...ghostBtn, padding: '7px 14px' }}>🧪 전체 거치</button>
                      <button onClick={undockAll} style={{ ...ghostBtn, padding: '7px 14px' }}>전체 제거</button>
                      <button
                        onClick={updateAllFirmware}
                        disabled={!connectedPens.some((p) => p.needsUpdate)}
                        title="펌웨어 업데이트는 채점의 필수 요건이 아닙니다."
                        style={{ ...ghostBtn, padding: '7px 14px', background: '#EBF2FF', border: 'none', color: '#2A75F3',
                          opacity: connectedPens.some((p) => p.needsUpdate) ? 1 : 0.45,
                          cursor: connectedPens.some((p) => p.needsUpdate) ? 'pointer' : 'not-allowed' }}>
                        ↺ 펌웨어 일괄 업데이트 <span style={{ fontWeight: 400, opacity: 0.7 }}>(선택)</span>
                      </button>
                    </div>
                  </div>

                  {/* 연결된 펜 목록 — 장비 정보만. 학생·그룹 열은 이 단계에 없다 */}
                  <div style={sectionCard}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>
                      연결된 펜 <span style={{ color: '#2A75F3' }}>{connectedPens.length}개</span>
                    </h3>
                    {dockedPens.length === 0 ? (
                      <div style={{ padding: '20px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>
                        거치된 펜이 없습니다. 위 크래들의 슬롯을 클릭해 펜을 거치해 주세요.
                      </div>
                    ) : (
                      /* [SCR-07 v2.3] 크래들 1·2·3 세 열 — 실물 배치 그대로. 슬롯은 크래들 안 번호(1~10). MAC 열은 뺐다(교사가 볼 일이 없다) */
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CRADLE_COUNT}, minmax(0, 1fr))`, gap: 12 }}>
                        {Array.from({ length: CRADLE_COUNT }, (_, i) => i + 1).map((cradleNo) => {
                          const pens = dockedPens.filter((p) => cradleOf(p.slot) === cradleNo);
                          return (
                            <div key={cradleNo} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ padding: '8px 12px', background: '#F1F5F9', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', display: 'flex', justifyContent: 'space-between' }}>
                                <span>크래들 {cradleNo}</span>
                                <span style={{ color: '#64748B', fontWeight: 700 }}>{pens.length}/{SLOTS_PER_CRADLE}</span>
                              </div>
                              {pens.length === 0 ? (
                                <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>거치된 펜 없음</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                                  <thead>
                                    <tr style={{ background: '#F8FAFC', color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>
                                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700 }}>슬롯</th>
                                      <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700 }}>펜 ID</th>
                                      <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>연결</th>
                                      <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>배터리</th>
                                      <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700 }}>펌웨어</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pens.map((pen) => (
                                      <tr key={pen.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '7px 10px', fontWeight: 800, color: '#1E293B' }}>{slotInCradle(pen.slot)}</td>
                                        <td style={{ padding: '7px 10px', color: '#1E293B', whiteSpace: 'nowrap' }}>{pen.id}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                          <span style={{ padding: '2px 8px', borderRadius: 999, fontWeight: 800, fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap',
                                            background: LINK_TOKEN[pen.link].bg, color: LINK_TOKEN[pen.link].color }}>{LINK_TOKEN[pen.link].label}</span>
                                        </td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: pen.battery < 30 ? '#DC2626' : '#475569' }}>{pen.battery}%</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                          <span style={{ color: pen.needsUpdate ? '#DC2626' : '#94A3B8' }}>{pen.firmware}</span>
                                          {pen.needsUpdate && fwUpdating[pen.id] == null && (
                                            <button onClick={() => runFirmwareUpdate(pen.id)}
                                              style={{ marginLeft: 6, background: '#FF4D4D', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>업데이트</button>
                                          )}
                                          {fwUpdating[pen.id] != null && (
                                            <span style={{ display: 'inline-block', width: 48, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginLeft: 6, verticalAlign: 'middle' }}>
                                              <span style={{ display: 'block', width: `${fwUpdating[pen.id]}%`, background: '#2A75F3', height: '100%' }} />
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: 데이터 매핑 ── */}
          {step === 'mapping' && (
            reading ? (
              /* [SCR-07 v1.8] 읽는 중 — 프로그레스 바 하나와 순환 타이틀.
                 舊 3단계 카드 목록(단계별 ✓/●/○ 전환)은 뺐다. 판정 3단계는 POP-28 정본이 말하고,
                 화면은 「북코드 대조·내용 판정·중복 검사를 처리하고 있다」는 사실만 보인다. */
              <div style={{ ...sectionCard, padding: '48px 24px' }}>
                <style>{`@keyframes cradleReadSlide { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
                <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>펜 데이터를 읽고 있습니다.</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 6 }}>
                    거치된 <strong>{connectedPens.length}자루</strong>의 필기를 확인합니다.
                  </div>
                  {/* 프로그레스 바 — 길이를 셀 수 없는 작업이라 무한 슬라이드 */}
                  <div style={{ position: 'relative', height: 8, margin: '22px 0 12px', borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 999,
                      background: 'linear-gradient(90deg, rgba(42,117,243,0.15), #2A75F3, rgba(42,117,243,0.15))',
                      animation: 'cradleReadSlide 1.3s ease-in-out infinite' }} />
                  </div>
                  {/* 순환 타이틀 — 세 작업 이름만 번갈아 보인다 */}
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1D4ED8', minHeight: 22 }}>
                    {JUDGE_PHASES[readTick % JUDGE_PHASES.length].label}
                    <span style={{ color: '#94A3B8', fontWeight: 400 }}> 처리 중…</span>
                  </div>
                </div>
              </div>
            ) : (
              /* [SCR-07 v1.7] 좌우 2열이 화면 전체 높이를 나눈다.
                 왼쪽 = 미니 크래들 + 상태 카운트 + 펜 목록, 오른쪽 = 답안 뷰어(맨 위부터 맨 아래까지).
                 舊 「요약 바」가 두 열 위에 가로로 놓여 뷰어 높이를 잡아먹던 것을 왼쪽 열 안으로 넣었다. */
              <div style={{ display: 'flex', gap: 12, minHeight: 0, flex: 1 }}>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 미니 크래들 3대 + [다시 읽기] + 상태 카운트(크래들 아래) */}
                <div style={{ ...sectionCard, padding: '8px 12px 8px' }}>
                  {renderCradle({ compact: true })}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                    <span style={{ color: '#166534' }}>🟢 채점 대상 {gradableStudentIds.length}</span>
                    {/* [SCR-07 v1.5] 30자루 중 빈 펜·다른 그룹 펜(1단계)은 교사가 손댈 것이 없으므로 「확인 필요」에서 갈라 센다 */}
                    <span style={{ color: '#B91C1C' }} title="동기화 불가 · 중복 데이터 — 답안을 보고 학생을 매칭하거나 재작성이 필요한 펜">확인 필요 {needsCheckCount}</span>
                    <span style={{ color: '#94A3B8' }} title="데이터 없음 — 필기가 없거나 답안을 쓰지 않은 펜. 채점에서 자연 제외됩니다">대상 아님 {notTargetCount}</span>
                    <span style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}
                      onMouseEnter={() => setRereadHover(true)} onMouseLeave={() => setRereadHover(false)}>
                      <button onClick={() => { setRereadHintClosed(true); reread(); }}
                        style={{ padding: '5px 12px', borderRadius: 8, fontFamily: 'inherit',
                          fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                          border: dockChanged ? 'none' : '1px solid #E2E8F0',
                          background: dockChanged ? '#F97316' : 'white', color: dockChanged ? 'white' : '#475569' }}>
                        ↻ 다시 읽기
                      </button>
                      {/* 자동(구성 변경 · 닫기 전) 또는 호버 시 노출 */}
                      {((dockChanged && !rereadHintClosed) || rereadHover) && (
                        <div role="tooltip" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#1E293B', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, lineHeight: 1.6, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(15,23,42,0.3)', zIndex: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ position: 'absolute', top: -6, right: 18, width: 12, height: 12, background: '#1E293B', transform: 'rotate(45deg)' }} />
                          <span>
                            {dockChanged
                              ? <>🔄 크래들 구성이 바뀌었습니다{unreadPens.length > 0 && <> — 아직 읽지 않은 펜 <strong>{unreadPens.length}자루</strong></>}. 펜을 다시 거치했다면 [↻ 다시 읽기]를 눌러 주세요.</>
                              : <>판정을 처음부터 다시 돌립니다. 직접 매칭 기록은 유지됩니다.</>}
                          </span>
                          {dockChanged && !rereadHintClosed && (
                            <button type="button" aria-label="닫기" onClick={(e) => { e.stopPropagation(); setRereadHintClosed(true); }}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', padding: 0 }}>✕</button>
                          )}
                        </div>
                      )}
                    </span>
                  </div>
                </div>


                  {/* 펜 목록. POP-28 판정표를 그대로 옮긴 한 장이다.
                      [SCR-07 v1.6] 좌·우는 처음부터 **50:50 고정**. 펜을 골라도 폭이 바뀌지 않아 시선이 흔들리지 않는다. */}
                  <div style={{ ...sectionCard, flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                      <span style={{ width: 118 }}>펜</span>
                      <span style={{ width: 124 }}>학생</span>
                      <span style={{ width: 88 }}>배지</span>
                      <span style={{ flex: 1 }}>채점 진행</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {listedPens.map((p) => {
                        const v = verdicts[p.id];
                        const vt = badgeOf(v?.type || 'empty');
                        const st = selectedStudents.find((x) => x.id === v?.studentId);
                        const needs = !['ok', 'grading', 'uploaded'].includes(v?.type);
                        const picked = selectedPenId === p.id;
                        return (
                          /* 행은 div+role — 안에 [⏏] 버튼이 들어가므로 button 중첩을 피한다 */
                          <div key={p.id} role="button" tabIndex={0}
                            onClick={() => pickPen(p.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickPen(p.id); } }}
                            style={{
                              display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', gap: 0, boxSizing: 'border-box',
                              padding: '9px 12px 9px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontFamily: 'inherit',
                              /* [SCR-07 v1.6] 행 전체를 물들이지 않는다 — 상태는 배지 색(회색·빨강·초록)만으로 읽는다 */
                              background: picked ? '#EFF6FF' : 'white',
                              boxShadow: picked ? 'inset 3px 0 0 #2A75F3' : 'none',
                            }}>
                            <span style={{ width: 118, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap' }}>
                              {p.id}<span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>{slotLabel(p.slot)}</span>
                            </span>
                            {/* [POP-28 #9] 중복이면 학생 이름도 빨강 */}
                            <span style={{ width: 124, fontSize: 'var(--neo-font-size-sm)', color: v?.type === 'duplicate' ? '#991B1B' : '#475569', fontWeight: v?.type === 'duplicate' ? 800 : 400, whiteSpace: 'nowrap' }}>
                              {studentTag(st)}
                            </span>
                            <span style={{ width: 88 }}>
                              <span style={{ padding: '1px 8px', borderRadius: 999, background: vt.bg, border: `1px solid ${vt.border}`, color: vt.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>{vt.label}</span>
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--neo-font-size-xs)', color: needs ? vt.color : '#166534', lineHeight: 1.5 }}>
                              {v?.progress || '—'}

                            </span>
                            {/* [SCR-07 v1.9] 펜 제거 — **선택된 행에만** 보인다(B안).
                                30행 전부에 아이콘을 두면 노이즈·오클릭이 늘고, 「왼쪽에서 고른 펜에 액션」 원칙과도 어긋난다.
                                실제로는 교사가 크래들에서 펜을 뽑는 물리 동작이고 여기서는 그 결과만 흉내 낸다(에뮬레이터).
                                빼고 나면 행이 사라지고 [↻ 다시 읽기]가 주황으로 바뀌어 구성 변경을 알린다. */}
                            <span style={{ width: 30, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                              {picked && (
                                <button type="button"
                                  onClick={(e) => { e.stopPropagation(); undockPen(p.slot); setSelectedPenId(null); }}
                                  title="크래들에서 이 펜을 뺍니다. 다시 꽂으려면 1단계에서 빈 슬롯을 누르세요. (에뮬레이터)"
                                  aria-label={`${p.id} 펜 빼기`}
                                  style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #CBD5E1', background: 'white', color: '#475569',
                                    fontSize: 'var(--neo-font-size-sm)', lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>⏏</button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

              </div>

                  {/* 우 — 답안 뷰어. 「누구 답안인가」는 교사가 답안(기재란 손글씨)을 직접 보고 가린다.
                      [SCR-07 v1.4] 舊 「답안지 기재란 ↔ 번호표 판독」 OCR 대조 카드 폐기 — 처음부터 미리보기를 크게.
                      [SCR-07 v2.0] 비정상 펜은 반 탭으로 이 과제의 다른 반 답안까지 보고, 「이 답안을 ○○의 답안으로 채점」 한 번으로 직접 매칭.
                                    [SCR-07 v2.3] 舊 「펜 없는 학생 → 답안 찾기」 모드 폐기 — 매칭이 선택 그룹 안으로 좁혀져 펜 목록에서 바로 고르면 된다. */}
                  <div style={{ ...sectionCard, flex: '1 1 0', minWidth: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {(() => {
                      /* 공용 — 답안지 이미지 + 기재란 손글씨 오버레이(학생이 손으로 쓴 이름·번호. 읽어 해석하지 않고 보여만 준다) */
                      const sheetImage = (page, book) => (
                        <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#0F172A' }}>
                          {!answerImgFailed ? (
                            <div style={{ position: 'relative', width: '100%' }}>
                              <img
                                src={ANSWER_SHEET_IMG}
                                alt={`${page.questionTitle} ${page.sheetNo}/${page.sheetTotal}장`}
                                onError={() => setAnswerImgFailed(true)}
                                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                              />
                              {/* 기재란 — 서식(TSK-05)의 학년/반/번호·이름 칸 위치에 맞춘 손글씨 */}
                              {(() => {
                                const m = (book.ownerGrade || '').match(/(\d+)학년\s*(\d+)반\s*(\d+)번/);
                                const ink = { position: 'absolute', color: '#1E3A8A', fontWeight: 700, fontSize: 'clamp(11px, 1.9vw, 20px)', transform: 'rotate(-1.5deg)', pointerEvents: 'none', fontFamily: '"Nanum Pen Script", "Gaegu", cursive, inherit', whiteSpace: 'nowrap' };
                                return (
                                  <>
                                    {m && <span style={{ ...ink, left: '21%', top: '14.5%' }}>{m[1]}</span>}
                                    {m && <span style={{ ...ink, left: '39.5%', top: '14.5%' }}>{m[2]}</span>}
                                    {m && <span style={{ ...ink, left: '45%', top: '14.5%' }}>{m[3]}</span>}
                                    {book.ownerName && <span style={{ ...ink, left: '69%', top: '14.3%' }}>{book.ownerName}</span>}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div style={{ background: 'white', borderRadius: 8, padding: '24px 28px', minHeight: '100%', boxSizing: 'border-box' }}>
                              <div style={{ border: '2px dashed #FBBF24', background: 'rgba(251,191,36,0.1)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, display: 'flex', gap: 18, fontSize: 'var(--neo-font-size-sm)' }}>
                                <span><strong style={{ color: '#78350F' }}>학년/반/번호</strong> {book.ownerGrade || '—'}</span>
                                <span><strong style={{ color: '#78350F' }}>이름</strong> {book.ownerName || '—'}</span>
                              </div>
                              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 10 }}>{page.questionTitle}</div>
                              <div style={{ border: '1px solid #E2E8F0', borderRadius: 6, padding: '16px 18px', background: '#FCFCFD', minHeight: 320, fontSize: 'var(--neo-font-size-lg)', color: '#1E293B', lineHeight: 2.2, whiteSpace: 'pre-wrap' }}>{page.text}</div>
                            </div>
                          )}
                        </div>
                      );
                      const pager = (pages, page) => (
                        <div style={{ padding: '6px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC' }}>
                          <button onClick={() => setPageIdx((i) => Math.max(0, i - 1))} disabled={pageIdx === 0}
                            style={{ ...ghostBtn, padding: '4px 10px', opacity: pageIdx === 0 ? 0.4 : 1 }}>◀</button>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1E293B' }}>{Math.min(pageIdx, pages.length - 1) + 1} / {pages.length}</span>
                          <button onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))} disabled={pageIdx >= pages.length - 1}
                            style={{ ...ghostBtn, padding: '4px 10px', opacity: pageIdx >= pages.length - 1 ? 0.4 : 1 }}>▶</button>
                          <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
                            {page.questionTitle} · {page.sheetNo}/{page.sheetTotal}장
                          </span>
                        </div>
                      );
                      /* 직접 매칭 액션 — 「이 답안을 [학생 ▾]의 답안으로 채점」. 학생이 정해져 있으면(답안 찾기) 버튼 하나.
                       * [SCR-07 v2.1] **선택 그룹 북코드 답안 묶음에서만** 매칭된다. 학생 식별의 근거는 번호표 체크 위치이고,
                       *   번호표를 잘못 찍은 휴먼 에러(중복·미체크·판독 불가)를 같은 그룹 답안지를 보고 바로잡는 것이 이 기능이다.
                       *   다른 반 북코드 답안지는 이 그룹에 매핑할 수 없다 — 열람만 허용하고 버튼은 비활성화한다. */
                      const matchAction = (pen, book, fixedStudent) => {
                        if (!book.isMine) {
                          return (
                            <div style={{ color: '#64748B' }}>
                              <strong>{book.groupLabel}</strong> 답안지입니다. <strong>{groupLabel}</strong> 학생에게는 매칭할 수 없습니다 — 다른 반 답안은 그 반 채점 때 처리됩니다.
                              <button type="button" disabled
                                style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#CBD5E1', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' }}>
                                ✓ 매칭
                              </button>
                            </div>
                          );
                        }
                        const pick = matchPick[pen.id];
                        const chosen = fixedStudent || (pick != null && pick !== '' ? selectedStudents[Number(pick)] : null);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>이 답안을</span>
                            {fixedStudent ? (
                              <strong style={{ color: '#1E293B' }}>{studentTag(fixedStudent)}</strong>
                            ) : (
                              <select value={pick ?? ''} onChange={(e) => setMatchPick((prev) => ({ ...prev, [pen.id]: e.target.value }))}
                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: 'white', fontSize: 'var(--neo-font-size-xs)', fontFamily: 'inherit', color: '#1E293B' }}>
                                <option value="">학생 선택</option>
                                {selectedStudents.map((st, i) => <option key={st.id} value={i}>{studentTag(st)}</option>)}
                              </select>
                            )}
                            <span>의 답안으로 채점</span>
                            <button type="button" disabled={!chosen}
                              onClick={() => { if (!chosen) return; matchPen(pen.id, chosen.id, book.code); setSelectedPenId(pen.id); setViewBookCode(book.code); setPageIdx(0); }}
                              style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: chosen ? '#2A75F3' : '#CBD5E1', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: chosen ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                              ✓ 매칭
                            </button>
                          </div>
                        );
                      };
                      const noteBox = (tone, children) => {
                        const t = { warn: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' }, ok: { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' }, muted: { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' }, info: { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' } }[tone];
                        return <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg, color: t.color, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.7 }}>{children}</div>;
                      };

                      /* ── 펜 미선택 ── */
                      if (!selectedPen) {
                        return (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', padding: 24, textAlign: 'center', lineHeight: 1.8 }}>
                            왼쪽에서 펜을 선택하면<br />그 펜에 담긴 답안을 크게 볼 수 있습니다.
                          </div>
                        );
                      }

                      /* ── 선택한 펜 ── */
                      const v = selectedVerdict;
                      const matchedStudent = v?.manual ? selectedStudents.find((x) => x.id === v.studentId) : null;
                      const guidance = (() => {
                        if (v?.manual) {
                          return noteBox('ok', (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span>✓ 직접 매칭 — <strong>{studentTag(matchedStudent)}</strong>의 답안으로 채점됩니다 ({curBook?.groupLabel} 답안지)</span>
                              <button type="button" onClick={() => unmatchPen(selectedPen.id)} style={{ ...ghostBtn, marginLeft: 'auto', padding: '3px 10px', fontSize: 'var(--neo-font-size-xs)' }}>매칭 해제</button>
                            </div>
                          ));
                        }
                        if (isFine(v?.type)) return null;
                        if (v?.type === 'duplicate') {
                          return noteBox('warn', (<><div>같은 학생에 두 펜이 붙었습니다. 답안을 확인하고, 학생을 고르세요.</div>{curBook && matchAction(selectedPen, curBook)}</>));
                        }
                        if (v?.stage === 2) {
                          return noteBox('warn', (<><div>번호표로 학생을 찾지 못했습니다. 답안을 확인하고, 학생을 고르세요.</div>{curBook && matchAction(selectedPen, curBook)}</>));
                        }
                        if (v?.type === 'other_group') {
                          return noteBox('muted', (
                            <>
                              <div><strong>{groupLabel} 답안지가 아닙니다.</strong> 다른 반 답안지에 쓴 답안이라 이 그룹에서는 채점할 수 없습니다.</div>
                              <div style={{ marginTop: 4, color: '#64748B' }}>어느 반 답안지인지 아래에서 확인하세요. 우리 반 학생이면 {groupLabel} 답안지에 다시 쓰게 해 주세요.</div>
                            </>
                          ));
                        }
                        if (v?.type === 'empty') return noteBox('muted', '이 펜에는 필기가 없습니다.');
                        return null;
                      })();

                      return (
                        <>
                          {guidance}
                          {/* 반 탭 — 비정상 펜에서 이 과제의 다른 반 답안 묶음이 둘 이상일 때만 */}
                          {viewableBooks.length > 1 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px', borderBottom: '1px solid #E2E8F0', background: 'white' }}>
                              {viewableBooks.map((b) => (
                                <button key={b.code} type="button" onClick={() => { setViewBookCode(b.code); setPageIdx(0); }}
                                  style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${curBook?.code === b.code ? '#2A75F3' : '#E2E8F0'}`, background: curBook?.code === b.code ? '#EFF6FF' : 'white', color: curBook?.code === b.code ? '#1D4ED8' : '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {b.groupLabel} 답안 {b.answerPages.length}장{b.isMine ? ' · 선택 그룹' : ''}
                                </button>
                              ))}
                            </div>
                          )}
                          {flatPages.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', padding: 20, textAlign: 'center', lineHeight: 1.8 }}>
                              이 펜에는 이 과제에 쓴 답안이 없습니다.
                            </div>
                          ) : (
                            <>
                              {pager(flatPages, curPage)}
                              {sheetImage(curPage, curBook)}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
              </div>
            )
          )}

          {/* ── Step 3: 채점 ── */}
          {step === 'grading' && (
            <div style={{ ...sectionCard, textAlign: 'center', padding: '48px 24px' }}>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 56, height: 56, margin: '0 auto 16px', border: '5px solid #DBEAFE', borderTopColor: '#2A75F3', borderRadius: '50%', animation: gradingFinished ? 'none' : 'spin 1s linear infinite', background: gradingFinished ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {gradingFinished && <span style={{ color: 'white', fontSize: 24, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 6 }}>
                {gradingFinished ? '채점이 완료되었습니다.' : 'AI가 채점하고 있어요.'}
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 18 }}>
                학생 <strong style={{ color: '#2A75F3' }}>{gradedIds.length}명</strong> · 문항 <strong style={{ color: '#2A75F3' }}>{gradedIds.length * questionList.length}건</strong>을 채점 중입니다.
              </div>
              <div style={{ width: '80%', margin: '0 auto', height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#2A75F3', transition: 'width 0.2s' }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{progress}%</div>

              {/* [SCR-07 v2.9] 시간차 안내 — 6초가 지나도 채점 중이면 「다른 일을 하셔도 됩니다」를 크게 띄운다.
                  교사가 이 화면을 계속 바라보며 기다리는 일이 많았다. 푸터 한 줄은 눈에 들어오지 않는다. */}
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

              {/* [POP-28 #11·#12] 펜별 상태 전이 — 펜 연결 → AI 채점중 → AI 채점 완료.
                  업로드가 끝난 펜은 파일이 지워져 배지가 「데이터 삭제」로 바뀐다. 실패가 아니라 정상 완료의 흔적이다. */}
              <div style={{ maxWidth: 720, margin: '22px auto 0', textAlign: 'left', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', padding: '8px 14px', background: '#F8FAFC', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>
                  <span style={{ width: 150 }}>펜</span>
                  <span style={{ width: 120 }}>학생</span>
                  <span style={{ width: 110 }}>배지</span>
                  <span style={{ flex: 1 }}>채점 진행</span>
                </div>
                <div style={{ maxHeight: 210, overflowY: 'auto' }}>
                  {connectedPens.filter((p) => ['grading', 'uploaded', 'ok', 'grade_failed'].includes(verdicts[p.id]?.type)).map((p) => {
                    const v = verdicts[p.id];
                    const vt = badgeOf(v.type);
                    const st = selectedStudents.find((x) => x.id === v.studentId);
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid #F1F5F9', fontSize: 'var(--neo-font-size-sm)' }}>
                        <span style={{ width: 150, color: '#1E293B', fontWeight: 700 }}>{p.id} <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 'var(--neo-font-size-xs)' }}>{slotLabel(p.slot)}</span></span>
                        <span style={{ width: 150, color: '#475569' }}>{studentTag(st)}</span>
                        <span style={{ width: 110 }}>
                          <span style={{ padding: '1px 8px', borderRadius: 999, background: vt.bg, border: `1px solid ${vt.border}`, color: vt.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>{vt.label}</span>
                        </span>
                        <span style={{ flex: 1, color: v.type === 'uploaded' ? '#047857' : v.type === 'grade_failed' ? '#B91C1C' : '#1D4ED8', fontWeight: 700 }}>{v.progress}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: 완료 ── */}
          {step === 'completed' && (
            <div style={{ ...sectionCard, background: '#F0FDF4', borderColor: '#86EFAC', textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎉</div>
              {/* [SCR-07 v2.4] 완료 화면은 세 줄만 — 완료 · 요약 · 다음 행동. 미연결 학생·잔류 펜 고지는 뺐다 */}
              <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#065F46', marginBottom: 8 }}>완료</div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#047857', marginBottom: 14 }}>
                채점 문항 <strong>{(gradedIds.length - failedPenIds.length) * questionList.length}건</strong> · 학생 <strong>{gradedIds.length - failedPenIds.length}명</strong>
                {failedPenIds.length > 0 && <span style={{ color: '#B91C1C' }}> · 실패 <strong>{failedPenIds.length}명</strong></span>}
              </div>
              {/* [SCR-07 v2.9] AI 채점 실패 — 원인(토큰 용량 초과)과 할 일(잠시 후 재시도 / 서비스팀 문의)을 함께 말한다 */}
              {(failedPenIds.length > 0 || retrying) && (
                <div style={{ maxWidth: 620, margin: '0 auto 14px', padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7, textAlign: 'left' }}>
                  {retrying ? (
                    <div>⏳ 실패한 답안을 다시 채점하고 있습니다…</div>
                  ) : (
                    <>
                      <div><strong>⚠ {failedPenIds.length}명은 AI 채점에 실패했습니다.</strong> 답안 분량이 커서 <strong>토큰 용량을 초과</strong>했습니다(서버 응답 지연). 나머지 학생의 채점 결과는 정상 반영됐습니다.</div>
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
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#065F46', background: 'white', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', display: 'inline-block' }}>
                [확인]을 누르면 「채점 확인」 단계로 이동합니다.
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '14px 24px', background: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', minWidth: 0 }}>
            {step === 'grading' && '💡 창을 닫아도 채점은 계속 진행되며, 하단 알림으로 다시 열 수 있습니다.'}
            {step === 'connect' && connectorState === 'ready' && dockedPens.length === 0 && '크래들에 펜을 1자루 이상 거치해야 다음 단계로 넘어갑니다.'}
            {step === 'mapping' && !reading && startBlocked && <span style={{ color: '#B45309' }}>⚠ {startBlockReason}</span>}
            {step === 'mapping' && !reading && !startBlocked && unmappedStudents.length > 0 && (
              <span style={{ color: '#B45309' }}>⚠ 펜이 연결되지 않은 {unmappedStudents.length}명은 채점 대상에서 제외됩니다.</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {step === 'connect' && (
              <>
                <button onClick={() => onClose?.()} style={ghostBtn}>취소</button>
                <button onClick={goMapping} disabled={connectorState !== 'ready' || connectedPens.length === 0}
                  style={primaryBtn(connectorState === 'ready' && connectedPens.length > 0)}>
                  🔗 데이터 매핑 시작
                </button>
              </>
            )}
            {step === 'mapping' && !reading && (
              <>
                <button onClick={() => { setSelectedPenId(null); setStep('connect'); }}
                  title="크래들 연결 단계로 돌아갑니다. 판정 결과와 수동 연결은 유지됩니다."
                  style={ghostBtn}>← 펜 다시 거치</button>
                <button onClick={startGrading} disabled={startBlocked} title={startBlocked ? startBlockReason : undefined}
                  style={primaryBtn(!startBlocked)}>🤖 채점 시작</button>
              </>
            )}
            {step === 'completed' && (
              <button onClick={() => {
                  /* [SCR-07 v2.9] 실패한 펜의 학생은 채점 확인으로 넘기지 않는다 — 미채점에 남아 다음 시도에서 이어간다 */
                  const failedStudentIds = failedPenIds.map((id) => verdicts[id]?.studentId).filter(Boolean);
                  onCompleted?.(gradedIds.filter((id) => !failedStudentIds.includes(id)));
                }}
                style={{ padding: '9px 22px', borderRadius: 8, background: '#10B981', border: 'none', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer', fontFamily: 'inherit' }}>✓ 확인</button>
            )}
          </div>
        </div>
      </div>

      {/* [POP-30] 필수 프로그램 확인 — 크래들 채점은 AiGLE Connect만 요구한다.
          Ncode Print Doctor는 목록에 남기되 흐리게 두어 「지금 할 일」이 하나로 보이게 한다. */}
      <LogDownloadDialog open={logDialogOpen} onClose={() => setLogDialogOpen(false)} onDownload={doDownloadLog} />
      <PenDataDownloadDialog open={penDataDialogOpen} penCount={connectedPens.length}
        onClose={(r) => { setPenDataDialogOpen(false); if (r === 'started') setToast(`펜 데이터 ${connectedPens.length}개를 다운로드\\${PEN_DATA_DIR} 폴더에 저장하고 있습니다.`); }} />
      <RequiredProgramModal
        open={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        programs={[
          { key: 'connect', name: 'AiGLE Connect', desc: 'USB·블루투스 펜 연결 · 크래들 일괄 채점 · 백그라운드 자동 실행', required: true, installed: connectorInstalled },
          { key: 'printDoctor', name: 'Ncode Print Doctor', desc: 'N-code 인쇄 최적 상태 지원 · 프린터 인쇄 적합성 진단', required: false },
        ]}
        onInstalled={(key) => { if (key === 'connect') onConnectorInstall?.(); }}
        onAllReady={() => { onConnectorReady?.(); setConnectorState('ready'); }}
      />

      {/* 닫기 확인 — 매핑 단계에서만 */}
      {confirmClose && (
        <div onClick={(e) => { e.stopPropagation(); setConfirmClose(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 460, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>매핑을 취소하고 닫을까요?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.7 }}>
              읽어온 펜 데이터 판정 결과와 직접 연결한 내용이 모두 사라집니다.
              <strong style={{ color: '#1E2225' }}> 펜에 저장된 필기 데이터는 삭제되지 않습니다.</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClose(false)} style={ghostBtn}>계속 매핑하기</button>
              <button onClick={() => { setConfirmClose(false); onClose?.(); }}
                style={{ ...primaryBtn(true), background: '#EF4444' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CradleGradingModal;
