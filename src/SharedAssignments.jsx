/**
 * SharedAssignments.jsx
 * [TSK-11 v1.0] 공유된 과제 목록
 *
 * 다른 교사가 공유 카탈로그(전체 공개)에 등록한 과제를 보고 본인 목록으로 복사한다.
 * - 공유 모델: Model B (Fork). 복사 = 독립 사본 생성. 사본 수정은 원본에 영향 없음
 * - 원작자 메타데이터(이름·학교) 강제 노출
 * - 원본에 누적 카운터: 복사 N회 (인기 지표)
 * - 학생 응시 데이터·통계는 사본에 포함되지 않음
 *
 * 진입: 좌측 메뉴 [과제 관리 > 공유된 과제] ([v4.7] 메뉴 분리)
 */
import React, { useMemo, useState } from 'react';
import './index.css';

// ─────────────────────────────────────────────
// Mock 데이터 (실제 운영 시 GET /api/shared-assignments)
// ─────────────────────────────────────────────
const MOCK_SHARED = [
  {
    id: 'sa-001',
    title: '환경 보호 논술',
    schoolLevel: '중학교', grade: '1~3학년', subject: '국어', subSubject: '국어',
    totalScore: 100, standardsCount: 3, rubricMode: 'manual',
    competencies: ['비판적·창의적 사고'],
    evalAreas: ['쓰기'],
    achievementStandards: [
      '[9국어02-03] 글에 드러난 글쓴이의 관점이나 의도를 비판적으로 평가하며 읽는다.',
      '[9국어03-05] 자신의 주장이나 의견을 효과적으로 표현하는 글을 쓴다.',
      '[9국어03-09] 사회·환경 문제에 대한 자신의 의견을 논리적으로 서술한다.',
    ],
    passage:
      '오늘날 지구는 기후 변화, 미세 플라스틱, 생물 다양성 감소 등 여러 환경 문제에 직면해 있다. 일회용 컵 한 개가 분해되는 데 100년이 넘게 걸린다는 사실은 우리 일상의 작은 선택이 얼마나 오래 지구에 흔적을 남기는지 보여준다. 한편 어떤 사람들은 “나 한 사람의 행동이 세상을 바꾸겠는가”라며 환경 보호에 회의적인 태도를 보인다. 그러나 작은 행동들이 모일 때, 사회는 분명히 변화한다.',
    questions: [
      { id: 1, title: '문항 1', content: '윗글의 글쓴이가 강조하는 핵심 주장을 한 문장으로 요약하시오.' },
      { id: 2, title: '문항 2', content: '환경 보호를 위해 개인이 실천할 수 있는 행동 두 가지를 제시하고, 그 행동이 사회 변화에 기여하는 이유를 논리적으로 서술하시오. (300자 내외)' },
    ],
    originalAuthorId: 'tch-kim-1',
    originalAuthorName: '김순정',
    originalSchool: '서울중학교',
    sharedAt: '2026-04-12',
    copyCount: 47,
  },
  {
    id: 'sa-002',
    title: '일차함수 응용 문제',
    schoolLevel: '고등학교', grade: '1~3학년', subject: '수학', subSubject: '공통수학1',
    totalScore: 80, standardsCount: 2, rubricMode: 'auto',
    competencies: ['지식·정보 처리'],
    evalAreas: ['문제 해결'],
    achievementStandards: [
      '[10수학01-05] 일차함수를 활용하여 실생활 문제를 해결한다.',
      '[10수학01-07] 그래프와 식을 연계하여 함수의 변화를 해석한다.',
    ],
    passage:
      '어떤 휴대전화 요금제는 기본요금 12,000원에 통화 1분당 80원이 추가된다. 또 다른 요금제는 기본요금 18,000원에 통화 1분당 50원이 추가된다.',
    questions: [
      { id: 1, title: '문항 1', content: '두 요금제의 월 요금을 통화 시간 x(분)에 대한 일차함수 식으로 각각 표현하시오.' },
      { id: 2, title: '문항 2', content: '어느 통화 시간 이상부터 두 번째 요금제가 더 이득인지 구하시오.' },
    ],
    originalAuthorId: 'tch-lee-1',
    originalAuthorName: '이지훈',
    originalSchool: '부산고등학교',
    sharedAt: '2026-04-21',
    copyCount: 23,
  },
  {
    id: 'sa-003',
    title: '일상 영어 서술 표현',
    schoolLevel: '중학교', grade: '1~3학년', subject: '영어', subSubject: '영어',
    totalScore: 100, standardsCount: 4, rubricMode: 'manual',
    competencies: ['의사소통', '공동체·대인관계'],
    evalAreas: ['쓰기', '말하기'],
    achievementStandards: [
      '[9영어03-02] 일상 주제에 관해 자신의 의견을 영어로 쓸 수 있다.',
      '[9영어03-04] 간단한 묘사·설명을 일관성 있게 작성할 수 있다.',
      '[9영어04-01] 일상생활의 사건을 영어로 표현할 수 있다.',
      '[9영어04-05] 자신의 경험을 영어로 묘사할 수 있다.',
    ],
    passage:
      '아래 그림은 어느 학생의 주말 일과를 시간 순으로 나타낸 것이다. (지문 이미지 첨부)\nMorning: jogging → breakfast / Afternoon: study → meet friend at cafe / Evening: dinner with family.',
    questions: [
      { id: 1, title: '문항 1', content: '위 그림을 참고하여, 주말 하루 일과를 영어 5문장 이상으로 서술하시오. (과거시제 사용)', image: 'https://placehold.co/600x280/EFF6FF/2A75F3?text=Weekend+Schedule+%28Morning+%E2%86%92+Afternoon+%E2%86%92+Evening%29' },
      { id: 2, title: '문항 2', content: 'Which activity did you enjoy the most and why? 답변을 영어 3문장 이상으로 서술하시오.' },
    ],
    originalAuthorId: 'tch-park-1',
    originalAuthorName: '박민지',
    originalSchool: '대구중학교',
    sharedAt: '2026-03-30',
    copyCount: 89,
  },
  {
    id: 'sa-004',
    title: '민주주의 발전 과정 분석',
    schoolLevel: '고등학교', grade: '2~3학년', subject: '사회', subSubject: '통합사회',
    totalScore: 120, standardsCount: 3, rubricMode: 'manual',
    competencies: ['비판적·창의적 사고', '공동체·대인관계'],
    evalAreas: ['분석·평가'],
    achievementStandards: [
      '[10통사03-02] 민주주의의 의미와 발전 과정을 이해한다.',
      '[10통사03-04] 현대 민주주의의 과제를 분석한다.',
      '[10통사03-05] 시민 참여의 의의와 방법을 평가한다.',
    ],
    passage:
      '대한민국의 민주주의는 4·19 혁명, 6월 항쟁, 그리고 이후의 여러 시민운동을 거치면서 점진적으로 발전해 왔다. 시민들은 직접 선거, 평화 시위, 청원 등 다양한 방법으로 민주주의 발전에 참여해 왔다.',
    questions: [
      { id: 1, title: '문항 1', content: '4·19 혁명과 6월 항쟁의 공통점과 차이점을 비교하시오.' },
      { id: 2, title: '문항 2', content: '오늘날 시민이 민주주의 발전에 기여할 수 있는 방안을 두 가지 제시하고 그 이유를 서술하시오. (400자 내외)' },
    ],
    originalAuthorId: 'tch-jung-1',
    originalAuthorName: '정현우',
    originalSchool: '인천고등학교',
    sharedAt: '2026-05-01',
    copyCount: 15,
  },
  {
    id: 'sa-005',
    title: '물질의 상태 변화 실험 보고서',
    schoolLevel: '중학교', grade: '1~3학년', subject: '과학', subSubject: '과학',
    totalScore: 100, standardsCount: 2, rubricMode: 'auto',
    competencies: ['지식·정보 처리', '자기 성찰·계발'],
    evalAreas: ['탐구·실험'],
    achievementStandards: [
      '[9과학04-01] 물질의 상태 변화를 입자 모형으로 설명한다.',
      '[9과학04-03] 상태 변화 시 출입하는 열에너지를 이해한다.',
    ],
    passage:
      '얼음을 비커에 담고 일정한 세기의 열을 가하면서 시간에 따른 온도 변화를 측정하였다. 측정 결과 0℃ 부근과 100℃ 부근에서 일정 시간 동안 온도가 변하지 않는 구간이 관찰되었다.',
    questions: [
      { id: 1, title: '문항 1', content: '0℃와 100℃ 부근에서 온도가 일정한 까닭을 입자 모형으로 설명하시오.' },
      { id: 2, title: '문항 2', content: '실험 과정에서 측정 오차를 줄이기 위한 방법 두 가지를 서술하시오.' },
    ],
    originalAuthorId: 'tch-choi-1',
    originalAuthorName: '최서연',
    originalSchool: '광주중학교',
    sharedAt: '2026-04-05',
    copyCount: 31,
  },
  {
    id: 'sa-006',
    title: '시 감상 서술 — 윤동주의 「서시」',
    schoolLevel: '초등학교', grade: '5~6학년', subject: '국어', subSubject: '국어',
    totalScore: 60, standardsCount: 2, rubricMode: 'manual',
    competencies: ['심미적 감성', '의사소통'],
    evalAreas: ['읽기'],
    achievementStandards: [
      '[6국어05-02] 시에 드러난 화자의 정서와 태도를 이해한다.',
      '[6국어05-04] 시를 감상하고 자신의 느낌을 글로 표현한다.',
    ],
    passage:
      '죽는 날까지 하늘을 우러러 / 한 점 부끄럼이 없기를, / 잎새에 이는 바람에도 / 나는 괴로워했다. // 별을 노래하는 마음으로 / 모든 죽어 가는 것을 사랑해야지 / 그리고 나한테 주어진 길을 / 걸어가야겠다. // 오늘 밤에도 별이 바람에 스치운다.',
    questions: [
      { id: 1, title: '문항 1', content: '이 시의 화자가 가지고 있는 삶의 태도를 자신의 말로 정리하시오.' },
      { id: 2, title: '문항 2', content: '이 시에서 가장 인상 깊었던 구절을 골라 그 이유와 함께 서술하시오.' },
    ],
    originalAuthorId: 'tch-yoon-1',
    originalAuthorName: '윤지혜',
    originalSchool: '대전초등학교',
    sharedAt: '2026-02-18',
    copyCount: 156,
  },
  {
    id: 'sa-007',
    title: '이차방정식 활용 사례',
    schoolLevel: '중학교', grade: '1~3학년', subject: '수학', subSubject: '수학',
    totalScore: 100, standardsCount: 2, rubricMode: 'auto',
    competencies: ['지식·정보 처리'],
    evalAreas: ['문제 해결'],
    achievementStandards: [
      '[9수학03-04] 이차방정식을 풀고 실생활 문제를 해결한다.',
      '[9수학03-05] 이차방정식의 근의 공식을 이해한다.',
    ],
    passage:
      '둘레의 길이가 60m인 직사각형 모양의 화단을 만들려고 한다. 화단의 가로의 길이를 x(m)라 하자.',
    questions: [
      { id: 1, title: '문항 1', content: '화단의 넓이가 200㎡일 때, 가로의 길이 x를 구하시오. (이차방정식을 세워 풀이 과정을 모두 보일 것)', image: 'https://placehold.co/520x260/F3F4F6/1E2225?text=Rectangle+Flower+Bed+%28perimeter+60m%29' },
      { id: 2, title: '문항 2', content: '화단의 넓이를 최대로 하려면 가로의 길이를 얼마로 해야 하는지 구하고, 그 이유를 설명하시오.' },
    ],
    originalAuthorId: 'tch-kang-1',
    originalAuthorName: '강태민',
    originalSchool: '울산중학교',
    sharedAt: '2026-05-09',
    copyCount: 8,
  },
  {
    id: 'sa-008',
    title: '수능형 어휘 추론 — 빈칸 채우기',
    schoolLevel: '고등학교', grade: '2~3학년', subject: '영어', subSubject: '영어 독해와 작문',
    totalScore: 100, standardsCount: 3, rubricMode: 'manual',
    competencies: ['지식·정보 처리', '의사소통'],
    evalAreas: ['읽기'],
    achievementStandards: [
      '[12영독01-02] 글의 문맥에서 단어의 의미를 추론한다.',
      '[12영독01-03] 글의 논리적 흐름을 파악한다.',
      '[12영독01-05] 글의 주제와 요지를 종합한다.',
    ],
    passage:
      'Although technology has made our lives more convenient, it has also created new problems. For example, social media often _____ rather than connects people, leaving many feeling isolated despite being constantly online.',
    questions: [
      { id: 1, title: '문항 1', content: '윗글의 빈칸에 들어갈 가장 적절한 단어를 영어로 쓰고, 그 단어를 선택한 이유를 서술하시오.' },
      { id: 2, title: '문항 2', content: '윗글의 주제를 한 문장의 영어로 서술하시오.' },
    ],
    originalAuthorId: 'tch-han-1',
    originalAuthorName: '한소영',
    originalSchool: '수원고등학교',
    sharedAt: '2026-03-12',
    copyCount: 64,
  },
  {
    id: 'sa-009',
    title: '고전 시가 분석 — 「청산별곡」',
    schoolLevel: '고등학교', grade: '2~3학년', subject: '국어', subSubject: '문학',
    totalScore: 80, standardsCount: 2, rubricMode: 'manual',
    competencies: ['심미적 감성'],
    evalAreas: ['읽기'],
    achievementStandards: [
      '[10문학03-02] 고전 시가의 갈래와 특성을 이해한다.',
      '[10문학03-04] 작품에 드러난 화자의 정서를 분석한다.',
    ],
    passage:
      '살어리 살어리랏다 / 청산(靑山)애 살어리랏다. / 멀위랑 다래랑 먹고 / 청산애 살어리랏다. // 우러라 우러라 새여 / 자고 니러 우러라 새여. / 널라와 시름 한 나도 / 자고 니러 우니노라.',
    questions: [
      { id: 1, title: '문항 1', content: '이 작품에 나타난 화자의 정서를 두 가지 이상 분석하시오.' },
      { id: 2, title: '문항 2', content: '「청산별곡」의 운율적 특징을 갈래(고려가요)의 관점에서 서술하시오.' },
    ],
    originalAuthorId: 'tch-im-1',
    originalAuthorName: '임도현',
    originalSchool: '춘천고등학교',
    sharedAt: '2026-04-28',
    copyCount: 12,
  },
];

const SUBJECT_OPTIONS = ['전체', '국어', '수학', '영어', '사회', '과학'];
const SCHOOL_LEVEL_OPTIONS = ['전체', '초등학교', '중학교', '고등학교'];

// [v2.1] 학교급별 허용 학년군 — PRD §6.2 「학년 표기 정책」과 동일 (단일 학년 표기 금지)
// 중·고가 모두 `1~3학년`을 가지므로 학교급 없이는 의미가 확정되지 않는다 → 학교급 미선택 시 학년 필터 비활성화
const GRADE_OPTIONS_BY_LEVEL = {
  '초등학교': ['1~2학년', '3~4학년', '5~6학년'],
  '중학교': ['1~3학년'],
  '고등학교': ['1~3학년', '2~3학년'],
};

// [v2.1] 교과별 세부 과목 — 운영 시 교과 선택 시 API 로드(TSK-02와 동일 방식).
// 프로토타입은 카탈로그에서 도출해 결과 0건인 死 옵션이 생기지 않도록 한다.
const getSubSubjectOptions = (items, subject) => {
  if (subject === '전체') return [];
  return [...new Set(
    items.filter(it => it.subject === subject && it.subSubject).map(it => it.subSubject)
  )].sort((a, b) => a.localeCompare(b, 'ko'));
};

// 필터 바 셀렉트 공통 스타일 (5개 셀렉트 공유)
const FILTER_SELECT_STYLE = {
  padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px',
  background: 'white', fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', cursor: 'pointer',
};
const FILTER_SELECT_DISABLED_STYLE = {
  ...FILTER_SELECT_STYLE, background: '#F1F5F9', color: '#94A3B8', cursor: 'not-allowed',
};

// 🔥 인기 배지 산정 임계값 (PRD §3.3.1 — 운영 시 환경 변수로 분리 권장)
const HOT_MIN_COPIES = 10;
const HOT_TOP_PERCENT = 0.20;

// 카탈로그 전체 기준으로 인기 후보 ID Set 계산 (필터·검색과 무관, 라벨 일관성)
const computeHotIds = (items) => {
  if (!items || items.length === 0) return new Set();
  const sorted = [...items].sort((a, b) => b.copyCount - a.copyCount);
  const topCount = Math.max(1, Math.ceil(sorted.length * HOT_TOP_PERCENT));
  return new Set(
    sorted.slice(0, topCount)
      .filter(it => it.copyCount >= HOT_MIN_COPIES)
      .map(it => it.id)
  );
};
const SORT_OPTIONS = [
  { value: 'recent', label: '최근 공유순' },
  { value: 'popular', label: '인기순 (복사 많은 순)' },
];

// ─────────────────────────────────────────────
// 작은 토스트
// ─────────────────────────────────────────────
const Toast = ({ message }) => message ? (
  <div style={{
    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
    background: '#1E2225', color: 'white', padding: '0.75rem 1.5rem',
    borderRadius: '8px', fontSize: 'var(--neo-font-size-base)', fontWeight: 600,
    boxShadow: '0 8px 24px rgba(15,23,42,0.18)', zIndex: 9999,
  }}>
    {message}
  </div>
) : null;

// ─────────────────────────────────────────────
// 카드 컴포넌트
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 목록 보기 (테이블) — TKS-01 패턴 계승
// ─────────────────────────────────────────────
const ListView = ({ items, onPreview, onCopy, copiedSharedIds, hotIds }) => {
  const thStyle = {
    padding: '10px 12px', textAlign: 'left',
    fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569',
    background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
    whiteSpace: 'nowrap',
  };
  const tdStyle = {
    padding: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#1E2225',
    borderBottom: '1px solid #F1F5F9', verticalAlign: 'top',
  };
  const iconBtnStyle = (primary) => ({
    padding: '5px 9px',
    background: primary ? '#2A75F3' : 'white',
    color: primary ? 'white' : '#475569',
    border: primary ? 'none' : '1px solid #E2E8F0',
    borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800,
    cursor: 'pointer',
  });
  return (
    <section style={{
      background: 'white', border: '1px solid #E2E8F0',
      borderRadius: '14px', overflow: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>과제명</th>
            <th style={{ ...thStyle, width: '140px' }}>원작자</th>
            <th style={{ ...thStyle, width: '120px' }}>학교급</th>
            <th style={{ ...thStyle, width: '160px' }}>교과/과목</th>
            <th style={{ ...thStyle, width: '140px', textAlign: 'right' }}>배점/문항수</th>
            <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>평가</th>
            <th style={{ ...thStyle, width: '110px' }}>공유일</th>
            <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>복사</th>
            <th style={{ ...thStyle, width: '96px' }}>상태</th>
            <th style={{ ...thStyle, width: '120px', textAlign: 'right' }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const rubricLabel = it.rubricMode === 'auto' ? '자동 평가' : '자율 평가';
            const subjectLabel = it.subSubject && it.subSubject !== it.subject
              ? `${it.subject} / ${it.subSubject}`
              : it.subject;
            // 과제명 아래 # chips는 핵심역량(competencies)만 노출 — 핵심평가영역은 별도 영역에서 다룸
            const chipsTooltip = (it.competencies || []).map(c => `#${c}`).join(' ');
            const isCopied = copiedSharedIds.has(it.id);
            const isHot = hotIds.has(it.id);
            return (
              <tr
                key={it.id}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={tdStyle}>
                  <div style={{ fontWeight: 700, color: '#1E2225', marginBottom: '4px' }}>{it.title}</div>
                  <div
                    title={chipsTooltip}
                    style={{
                      fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '420px',
                    }}
                  >{chipsTooltip || '—'}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225' }}>{it.originalAuthorName}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>{it.originalSchool}</div>
                </td>
                <td style={{ ...tdStyle, color: '#475569' }}>{it.schoolLevel} · {it.grade}</td>
                <td style={{ ...tdStyle, color: '#475569' }}>{subjectLabel}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>
                  {it.totalScore}점 · {it.standardsCount}개
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#475569' }}>{rubricLabel}</td>
                <td style={{ ...tdStyle, color: '#475569' }}>{it.sharedAt}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#92400E', fontWeight: 700 }}>
                  📋 {it.copyCount.toLocaleString()}회
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {isHot && (
                      <span
                        title="인기 — 많이 복사된 과제"
                        style={{
                          display: 'inline-block', background: '#FEF3C7', color: '#92400E',
                          padding: '2px 8px', borderRadius: '999px',
                          fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, width: 'fit-content',
                        }}
                      >🔥 인기</span>
                    )}
                    {isCopied && (
                      <span
                        title="이미 내 과제 목록으로 복사한 과제입니다"
                        style={{
                          display: 'inline-block', background: '#DCFCE7', color: '#166534',
                          padding: '2px 8px', borderRadius: '999px',
                          fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
                          border: '1px solid #BBF7D0', width: 'fit-content',
                        }}
                      >✅ 복사함</span>
                    )}
                    {!isHot && !isCopied && (
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#CBD5E1' }}>—</span>
                    )}
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button type="button" title="미리보기" onClick={() => onPreview(it)} style={iconBtnStyle(false)}>👁</button>
                    <button type="button" title="복사하기" onClick={() => onCopy(it)} style={iconBtnStyle(true)}>📋</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

const Card = ({ item, onCopy, onPreview, isCopied, isHot }) => {
  const rubricLabel = item.rubricMode === 'auto' ? '자동 평가' : '자율 평가';
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: '14px',
      padding: '1.1rem 1.2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      position: 'relative',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      {isHot && (
        <span style={{
          position: 'absolute', top: '12px', right: '12px',
          background: '#FEF3C7', color: '#92400E',
          padding: '2px 8px', borderRadius: '999px',
          fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
        }}>🔥 인기</span>
      )}

      {/* 과목 배지 + (조건부) 복사함 배지 + 제목 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{
            display: 'inline-block', padding: '2px 8px',
            background: '#EFF6FF', color: '#2A75F3',
            borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
          }}>
            [{item.subject}] {item.schoolLevel} · {item.grade}
          </span>
          {isCopied && (
            <span
              title="이미 내 과제 목록으로 복사한 과제입니다"
              style={{
                display: 'inline-block', padding: '2px 8px',
                background: '#DCFCE7', color: '#166534',
                borderRadius: '999px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
                border: '1px solid #BBF7D0',
              }}
            >✅ 복사함</span>
          )}
        </div>
        <h3 style={{
          fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225',
          margin: 0, lineHeight: 1.35,
        }}>{item.title}</h3>
      </div>

      {/* 원작자 메타 (강제 표시) */}
      <div style={{
        fontSize: 'var(--neo-font-size-sm)', color: '#475569',
        background: '#F8FAFC', padding: '6px 10px',
        borderRadius: '6px', border: '1px solid #F1F5F9',
      }}>
        원작 ⓒ <strong style={{ color: '#1E2225' }}>{item.originalAuthorName}</strong>
        <span style={{ color: '#94A3B8' }}> · {item.originalSchool}</span>
      </div>

      {/* 스펙 요약 */}
      <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7 }}>
        <div>📊 총 <strong>{item.totalScore}</strong>점 · 성취기준 {item.standardsCount}개 · {rubricLabel}</div>
        <div style={{ color: '#64748B' }}>
          🕒 공유일 {item.sharedAt}
        </div>
      </div>

      {/* chip — 핵심평가영역 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {item.evalAreas.map(a => (
          <span key={a} style={{
            fontSize: 'var(--neo-font-size-xs)', color: '#475569',
            background: '#F1F5F9', padding: '2px 8px', borderRadius: '999px',
          }}>#{a}</span>
        ))}
        {item.competencies.map(c => (
          <span key={c} style={{
            fontSize: 'var(--neo-font-size-xs)', color: '#1E40AF',
            background: '#EFF6FF', padding: '2px 8px', borderRadius: '999px',
          }}>#{c}</span>
        ))}
      </div>

      {/* 복사 카운트 (인기 지표) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: 'var(--neo-font-size-sm)', color: '#92400E',
        marginTop: '2px',
      }}>
        📋 <strong style={{ color: '#1E2225' }}>{item.copyCount.toLocaleString()}</strong>회 복사됨
      </div>

      {/* 액션 */}
      <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
        <button
          onClick={() => onPreview(item)}
          style={{
            flex: 1, padding: '8px 10px',
            background: 'white', border: '1px solid #E2E8F0',
            borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700,
            color: '#475569', cursor: 'pointer',
          }}
        >👁 미리보기</button>
        <button
          onClick={() => onCopy(item)}
          style={{
            flex: 1, padding: '8px 10px',
            background: '#2A75F3', border: 'none',
            borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800,
            color: 'white', cursor: 'pointer',
          }}
        >📋 복사하기</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 미리보기 모달 (큰 모달 — 과제 내용 노출)
// 노출 항목: 과제명 / 학교급·학년·교과·과목 / 핵심 역량 / 핵심평가영역 /
//            성취기준 / 지문 / 문항 내용
// 비노출 (정책): 모범 답안 / 채점 기준 — 복사 후 확인
// ─────────────────────────────────────────────
const Section = ({ title, children }) => (
  <section style={{
    border: '1px solid #E2E8F0', borderRadius: '10px',
    padding: '0.95rem 1.1rem', background: 'white',
  }}>
    <h3 style={{
      fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#2A75F3',
      letterSpacing: '0.02em', margin: '0 0 0.6rem',
      textTransform: 'uppercase',
    }}>{title}</h3>
    {children}
  </section>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7 }}>
    <span style={{ minWidth: '64px', color: '#64748B', fontWeight: 700 }}>{label}</span>
    <span style={{ color: '#1E2225', fontWeight: 600 }}>{value}</span>
  </div>
);

const ChipList = ({ items, color = 'gray' }) => {
  if (!items || items.length === 0) {
    return <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>선택 없음</span>;
  }
  const palette = color === 'blue'
    ? { bg: '#EFF6FF', fg: '#1E40AF' }
    : { bg: '#F1F5F9', fg: '#475569' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {items.map(it => (
        <span key={it} style={{
          fontSize: 'var(--neo-font-size-sm)', color: palette.fg, background: palette.bg,
          padding: '3px 10px', borderRadius: '999px', fontWeight: 600,
        }}>#{it}</span>
      ))}
    </div>
  );
};

const PreviewModal = ({ item, onClose, onCopy }) => {
  if (!item) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
        padding: '2rem 1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#F8FAFC', borderRadius: '14px',
          width: '880px', maxWidth: '96vw',
          height: '85vh', maxHeight: '85vh',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <header style={{
          padding: '1.1rem 1.5rem',
          background: 'white',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
              과제 미리보기
            </div>
            <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, color: '#1E2225', margin: 0 }}>
              {item.title}
            </h2>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: '4px' }}>
              원작 ⓒ <strong style={{ color: '#1E2225' }}>{item.originalAuthorName}</strong>
              <span> · {item.originalSchool}</span>
              <span style={{ marginLeft: '10px', color: '#94A3B8' }}>📋 {item.copyCount.toLocaleString()}회 복사됨</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#94A3B8', lineHeight: 1, padding: '4px 8px' }}
          >×</button>
        </header>

        {/* 본문 (스크롤) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* 기본 정보 */}
            <Section title="기본 정보">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px' }}>
                <InfoRow label="과제명" value={item.title} />
                <InfoRow label="학교급" value={item.schoolLevel} />
                <InfoRow label="학년" value={item.grade} />
                <InfoRow label="교과/과목" value={`${item.subject}/${item.subSubject || item.subject}`} />
              </div>
            </Section>

            {/* 핵심 역량 + 핵심평가영역 — 한 행 2열 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
              <Section title="핵심 역량">
                <ChipList items={item.competencies} color="blue" />
              </Section>
              <Section title="핵심평가영역">
                <ChipList items={item.evalAreas} color="gray" />
              </Section>
            </div>

            {/* 성취기준 */}
            <Section title={`성취기준 (${item.achievementStandards?.length || 0}개)`}>
              {item.achievementStandards && item.achievementStandards.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {item.achievementStandards.map((std, i) => (
                    <li key={i} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', lineHeight: 1.65 }}>
                      {std}
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>등록된 성취기준이 없습니다</span>
              )}
            </Section>

            {/* 지문 */}
            <Section title="지문">
              {item.passage ? (
                <div style={{
                  fontSize: 'var(--neo-font-size-base)', color: '#1E2225', lineHeight: 1.85,
                  background: '#F8FAFC', borderLeft: '3px solid #2A75F3',
                  padding: '0.85rem 1.1rem', borderRadius: '6px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {item.passage}
                </div>
              ) : (
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>지문 없음</span>
              )}
            </Section>

            {/* 문항 내용 */}
            <Section title={`문항 (${item.questions?.length || 0}개)`}>
              {item.questions && item.questions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {item.questions.map((q, i) => (
                    <div key={q.id} style={{
                      background: '#F8FAFC', borderRadius: '8px',
                      padding: '0.75rem 1rem', border: '1px solid #F1F5F9',
                    }}>
                      <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#2A75F3', marginBottom: '4px' }}>
                        {q.title || `문항 ${i + 1}`}
                      </div>
                      <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                        {q.content}
                      </div>
                      {q.image && (
                        <div style={{ marginTop: '8px' }}>
                          <img
                            src={q.image}
                            alt={`${q.title || `문항 ${i + 1}`} 첨부 이미지`}
                            style={{
                              maxWidth: '100%', height: 'auto',
                              borderRadius: '6px', border: '1px solid #E2E8F0',
                              display: 'block',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>등록된 문항이 없습니다</span>
              )}
            </Section>

            {/* 비노출 항목 안내 */}
            <div style={{
              padding: '0.75rem 1rem', background: '#FFFBEB',
              border: '1px solid #FDE68A', borderRadius: '8px',
              fontSize: 'var(--neo-font-size-sm)', color: '#92400E', lineHeight: 1.65,
            }}>
              🔒 <strong>모범 답안과 채점 기준은 미리보기에서 표시되지 않습니다.</strong> 복사 후 본인 과제 화면에서 확인할 수 있습니다.
            </div>

          </div>
        </div>

        {/* 푸터 */}
        <footer style={{
          padding: '0.9rem 1.5rem', borderTop: '1px solid #E2E8F0',
          background: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
            📋 복사 시 사본은 자유롭게 수정 가능합니다. 원작자 정보는 자동 표시.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 18px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
            >닫기</button>
            <button
              onClick={() => onCopy(item)}
              style={{ padding: '10px 20px', background: '#2A75F3', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
            >📋 복사하기</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 복사 확인 모달
// ─────────────────────────────────────────────
const CopyConfirmModal = ({ item, onClose, onConfirm }) => {
  if (!item) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '14px',
          width: '440px', maxWidth: '92vw', padding: '1.5rem 1.75rem',
          boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
        }}
      >
        <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.75rem' }}>
          이 과제를 복사하시겠습니까?
        </h2>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, marginBottom: '1rem' }}>
          <strong style={{ color: '#1E2225' }}>{item.title}</strong><br />
          <span style={{ color: '#64748B' }}>원작 ⓒ {item.originalAuthorName} ({item.originalSchool})</span>
        </div>

        <ul style={{
          fontSize: 'var(--neo-font-size-sm)', color: '#475569',
          background: '#F8FAFC', borderRadius: '8px',
          padding: '0.75rem 1rem 0.75rem 1.75rem',
          margin: '0 0 1.25rem', lineHeight: 1.7,
          border: '1px solid #F1F5F9',
        }}>
          <li>본인 과제 목록에 새 사본이 생성됩니다.</li>
          <li>사본은 자유롭게 수정·재공유 할 수 있습니다.</li>
          <li>원작자 정보는 사본에도 자동 표시됩니다 (변경 불가).</li>
          <li>학생 응시 데이터·통계는 복사되지 않습니다.</li>
        </ul>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
          >취소</button>
          <button
            onClick={() => onConfirm(item)}
            style={{ padding: '9px 18px', background: '#2A75F3', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
          >📋 복사하기</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
const SharedAssignments = ({ onNavigateToTaskManagement, onCopyTask, copiedSharedIds = new Set() }) => {
  const [items, setItems] = useState(MOCK_SHARED);
  const [query, setQuery] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('전체');
  const [grade, setGrade] = useState('전체');
  const [subject, setSubject] = useState('전체');
  const [subSubject, setSubSubject] = useState('전체');
  const [sortKey, setSortKey] = useState('recent');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'list' — TKS-01 패턴 계승

  const [previewItem, setPreviewItem] = useState(null);
  const [copyItem, setCopyItem] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // 필터 + 정렬
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.filter(it => {
      if (schoolLevel !== '전체' && it.schoolLevel !== schoolLevel) return false;
      if (grade !== '전체' && it.grade !== grade) return false;
      if (subject !== '전체' && it.subject !== subject) return false;
      if (subSubject !== '전체' && it.subSubject !== subSubject) return false;
      if (q) {
        const hay = `${it.title} ${it.originalAuthorName} ${it.originalSchool} ${it.competencies.join(' ')} ${it.evalAreas.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    arr = arr.sort((a, b) => {
      if (sortKey === 'popular') return b.copyCount - a.copyCount;
      return b.sharedAt.localeCompare(a.sharedAt);
    });
    return arr;
  }, [items, query, schoolLevel, grade, subject, subSubject, sortKey]);

  const latestSharedAt = useMemo(() => {
    if (items.length === 0) return '-';
    return items.map(i => i.sharedAt).sort().reverse()[0];
  }, [items]);

  // 🔥 인기 후보 ID Set — 카탈로그 전체 기준 (필터·검색 무관, 라벨 일관성)
  const hotIds = useMemo(() => computeHotIds(items), [items]);

  // [v2.1] 종속 필터 — 상위 필터 값에 따라 옵션이 결정된다 (PRD §3)
  const gradeOptions = GRADE_OPTIONS_BY_LEVEL[schoolLevel] || [];
  const subSubjectOptions = useMemo(() => getSubSubjectOptions(items, subject), [items, subject]);
  const isGradeDisabled = schoolLevel === '전체';
  const isSubSubjectDisabled = subject === '전체' || subSubjectOptions.length === 0;

  // 상위 필터를 바꾸면 하위 필터는 「전체」로 초기화 — 이전 선택이 남아 0건이 되는 상황을 막는다
  const handleSchoolLevelChange = (v) => { setSchoolLevel(v); setGrade('전체'); };
  const handleSubjectChange = (v) => { setSubject(v); setSubSubject('전체'); };

  const handlePreview = (item) => setPreviewItem(item);

  const handleCopyClick = (item) => {
    setPreviewItem(null);
    setCopyItem(item);
  };

  const handleConfirmCopy = (item) => {
    // 원본의 복사 카운트 +1 (인기 지표 반영)
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, copyCount: it.copyCount + 1 } : it));
    // 사본을 과제 관리 목록(TKS-01)에 추가
    if (onCopyTask) onCopyTask(item);
    setCopyItem(null);
    showToast(`「${item.title}」 이(가) 내 과제 목록에 복사되었습니다.`);
  };

  const isEmpty = filtered.length === 0;

  return (
    <div style={{ padding: '2rem 2.5rem', height: '100%', overflowY: 'auto', background: '#F8FAFC' }}>
      {/* Header */}
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225', margin: 0 }}>📂 공유된 과제 목록</h1>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0.4rem 0 0' }}>
              다른 교사가 공유한 과제를 살펴보고, 내 과제 목록으로 복사하여 자유롭게 활용할 수 있습니다.
            </p>
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', textAlign: 'right' }}>
            <div>
              <strong style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-base)' }}>{items.length.toLocaleString()}</strong>
              <span style={{ marginLeft: '6px' }}>개의 공유된 과제</span>
            </div>
            <div style={{ color: '#94A3B8', marginTop: '2px' }}>최근 공유일 {latestSharedAt}</div>
          </div>
        </div>
      </header>

      {/* 공유 현황 — 필터 바 (좌: 학교급/학년/교과/과목/정렬, 우: 검색 + 결과 카운트) */}
      <section style={{
        background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px',
        padding: '1rem 1.25rem', marginBottom: '1.25rem',
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <select
          value={schoolLevel}
          onChange={(e) => handleSchoolLevelChange(e.target.value)}
          aria-label="학교급 필터"
          style={FILTER_SELECT_STYLE}
        >
          {SCHOOL_LEVEL_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt === '전체' ? '학교급 전체' : opt}</option>
          ))}
        </select>

        {/* [v2.1] 학년 — 학교급 종속. 학교급 미선택 시 비활성화 (§6.2 학년군 표기가 중·고 중복) */}
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          disabled={isGradeDisabled}
          aria-label="학년 필터"
          title={isGradeDisabled ? '학교급을 먼저 선택해 주세요' : undefined}
          style={isGradeDisabled ? FILTER_SELECT_DISABLED_STYLE : FILTER_SELECT_STYLE}
        >
          <option value="전체">학년 전체</option>
          {gradeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          aria-label="교과 필터"
          style={FILTER_SELECT_STYLE}
        >
          {SUBJECT_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt === '전체' ? '교과 전체' : opt}</option>
          ))}
        </select>

        {/* [v2.1] 과목 — 교과 종속. 교과 미선택 시 비활성화 */}
        <select
          value={subSubject}
          onChange={(e) => setSubSubject(e.target.value)}
          disabled={isSubSubjectDisabled}
          aria-label="과목 필터"
          title={isSubSubjectDisabled ? '교과를 먼저 선택해 주세요' : undefined}
          style={isSubSubjectDisabled ? FILTER_SELECT_DISABLED_STYLE : FILTER_SELECT_STYLE}
        >
          <option value="전체">과목 전체</option>
          {subSubjectOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          aria-label="정렬"
          style={FILTER_SELECT_STYLE}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: '2 1 240px', minWidth: '220px', marginLeft: 'auto' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>🔍</span>
          <input
            type="text"
            placeholder="과제명·원작자·태그로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              border: '1px solid #E2E8F0', borderRadius: '8px',
              fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', outline: 'none',
              boxSizing: 'border-box', background: '#F8FAFC',
            }}
          />
        </div>
      </section>

      {/* 결과 카운트 + 뷰 토글 (필터 바 아래) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '0 0 0.75rem 0.25rem',
      }}>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
          결과 <strong style={{ color: '#1E2225' }}>{filtered.length}</strong>건
        </div>
        <div
          role="group"
          aria-label="보기 방식 전환"
          style={{
            display: 'inline-flex', background: '#F1F5F9',
            borderRadius: '8px', padding: '2px', gap: '2px',
          }}
        >
          {[
            { value: 'card', icon: '▦', label: '카드' },
            { value: 'list', icon: '≡', label: '목록' },
          ].map(opt => {
            const active = viewMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setViewMode(opt.value)}
                title={`${opt.label} 보기`}
                style={{
                  padding: '6px 12px',
                  background: active ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: 'var(--neo-font-size-sm)', fontWeight: 700,
                  color: active ? '#1E2225' : '#64748B',
                  boxShadow: active ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <span aria-hidden="true">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 카드 그리드 / 목록 / 빈 상태 */}
      {isEmpty ? (
        <section style={{
          background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px',
          padding: '4rem 2rem', textAlign: 'center', color: '#64748B',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📂</div>
          <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.5rem' }}>
            {items.length === 0 ? '공유된 과제가 없습니다' : '검색 결과가 없습니다'}
          </h2>
          <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#64748B', margin: '0 0 1.5rem' }}>
            {items.length === 0
              ? '과제 화면에서 공유를 허용하면 목록이 여기에 표시됩니다.'
              : '다른 검색어나 필터로 다시 시도해 주세요.'}
          </p>
          {onNavigateToTaskManagement && (
            <button
              onClick={onNavigateToTaskManagement}
              style={{
                padding: '10px 18px', background: '#2A75F3',
                border: 'none', borderRadius: '8px',
                color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
              }}
            >전체 과제 살펴보기</button>
          )}
        </section>
      ) : viewMode === 'card' ? (
        <section style={{
          display: 'grid', gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}>
          {filtered.map(it => (
            <Card key={it.id} item={it} onCopy={handleCopyClick} onPreview={handlePreview} isCopied={copiedSharedIds.has(it.id)} isHot={hotIds.has(it.id)} />
          ))}
        </section>
      ) : (
        <ListView
          items={filtered}
          onPreview={handlePreview}
          onCopy={handleCopyClick}
          copiedSharedIds={copiedSharedIds}
          hotIds={hotIds}
        />
      )}

      <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onCopy={handleCopyClick} />
      <CopyConfirmModal item={copyItem} onClose={() => setCopyItem(null)} onConfirm={handleConfirmCopy} />
      <Toast message={toastMsg} />
    </div>
  );
};

export default SharedAssignments;
