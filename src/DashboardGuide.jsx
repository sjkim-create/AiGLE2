/**
 * DashboardGuide.jsx
 * DSH-01 (대시보드) 메뉴별 활용 가이드 — 독립 브라우저 윈도우
 *
 * 처음부터 별도 브라우저 창(window.open)으로 띄워서 사용자가
 * 본 대시보드와 가이드를 동시에 보면서 모니터를 자유롭게 배치할 수 있습니다.
 * 본 페이지에는 아무런 UI도 렌더되지 않습니다.
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SECTIONS = [
  {
    id: 'kpi',
    icon: '📊',
    title: '운영 KPI',
    subtitle: '실시간 접속자 · 계약 학교 · 신규 계약',
    purpose: '오늘 서비스가 잘 돌아가고 있는지 한눈에 확인하는 첫 줄 카드 3개입니다. 매일 아침 제일 먼저 보는 자리예요.',
    data: [
      { label: '🟢 실시간 접속자', detail: '지금 이 순간 접속해 있는 선생님 수. 5분마다 자동으로 새 숫자가 들어옵니다. 유료/무료 선생님으로 나눠서 표시됩니다.' },
      { label: '🏫 계약 학교', detail: '현재 우리 서비스를 쓰고 있는 학교 총 수입니다. 「이번 달 새로 들어온 학교」와 「승인 기다리는 학교」는 화면 오른쪽 위 카드에 따로 표시됩니다.' },
      { label: '👥 회원가입 (신규 계약 학교 활동성)', detail: '새로 들어온 학교가 얼마나 활발한지를 「오늘 / 이번 주(월~일) / 이번 달」 세 가지로 보여줍니다. 학년도 드롭다운을 바꾸면 그 학년도 기준으로 숫자가 다시 계산됩니다.' },
    ],
    interpret: [
      '실시간 접속자가 평소보다 확 줄었다면 → 서비스에 문제가 있는지, 아니면 시험·휴교 같은 학교 일정이 있는지 확인해보세요.',
      '계약 학교가 33개인데 동시 접속이 184명이면 → 학교 한 곳당 평균 5~6명이 동시에 쓰고 있다는 뜻입니다.',
      '「이번 주」 숫자가 「이번 달 ÷ 4」 보다 크면 → 이번 주가 평소보다 더 활발하다는 신호 (이벤트나 새 학기 효과를 의심해볼 만함).',
    ],
    actions: [
      '실시간 접속자 카드 클릭 → 누가 접속 중인지 「교사 관리」 화면에서 바로 확인',
      '승인 기다리는 학교·선생님이 있으면 오른쪽 위 카드에서 바로 승인 처리',
      '주간 보고서에 KPI 카드 3개 캡처해서 그대로 넣기',
    ],
  },
  {
    id: 'region',
    icon: '🏛️',
    title: '교육청별 핵심 지표',
    subtitle: '17개 시·도별 분포',
    purpose: '서비스가 전국 어느 지역에서 많이 쓰이는지, 어느 지역은 잘 안 쓰이는지를 지도처럼 한 번에 보는 영역입니다. 영업이나 CS 담당자가 어디부터 챙길지 정할 때 씁니다.',
    data: [
      { label: '메트릭 선택', detail: '학교 단위 / 선생님 단위 / 학생 단위로 보고 싶은 기준을 고를 수 있습니다. 어떤 기준을 고르든 모든 시·도 카드와 Top 3 카드가 같이 바뀝니다.' },
      { label: '학년도 마지막 날짜 기준 시점 카운트', detail: '여기는 「학년도 드롭다운으로 고른 학년도의 마지막 날짜」를 한 시점으로 잡고, 그 순간의 사진을 찍어서 셉니다. 별도 「기간 검색」은 없어요. 학년도가 진행 중이면 「오늘」이 그 시점이 됩니다. 무→유→무로 바뀌었으면 그 시점의 마지막 상태로 카운트합니다. ※ 「학기 중 가입한 학교」 같은 기간 누적 보기는 §3 신규 가입/무료→유료 전환에서 확인하세요.' },
      { label: '가나다순 고정 정렬', detail: '시·도 카드는 항상 가나다순(강원→경기→경남→...)으로 고정되어 있어요. 기준을 바꿔도 카드 위치는 그대로라서 비교하기 편합니다.' },
    ],
    interpret: [
      '한 시·도 카드 색이 진하다 = 그 지역에 사용이 많이 몰려 있다는 뜻',
      'Top 3 카드는 1·2·3등 지역. 메트릭(학교/선생님/학생)을 바꿔보면 지역별 격차가 드러납니다.',
      '「계약 학교는 많은데 활동 선생님이 적은」 지역 = 휴면 학교가 많다는 신호입니다 (정식 진단은 §6 교사 접속률에서). 이런 지역은 영업이 아니라 CS·온보딩 우선 대상이에요.',
      '「잠재 학교(공교육 전체) 대비 계약 학교 비율이 낮은」 지역 = 시장 침투가 약한 신규 영업 기회입니다.',
      '한 학교가 「유료 → 무료 → 다시 유료」로 바뀌어도 이력이 다 기록되어 있어서 「현재 유료」와 「한 번이라도 유료였던」을 따로 셀 수 있습니다.',
    ],
    actions: [
      'CS·온보딩 우선 지역 정하기 — 계약 학교는 많은데 활동률 낮은 지역 (휴면 다수 신호)',
      '신규 영업 우선 지역 정하기 — 잠재 학교 풀 대비 계약이 적은 지역 (시장 침투 약)',
      'CS 우선순위 — 색이 진한 지역부터 챙기기',
      '월말 보고서에 「지역별 분포 + Top 3」 캡처해서 임원 보고용으로 사용',
    ],
  },
  {
    id: 'signup',
    icon: '📈',
    title: '신규 가입 / 무료→유료 전환',
    subtitle: '교사 단위 시간 추이',
    purpose: '선생님이 얼마나 새로 들어오는지, 그리고 무료 사용자가 유료로 얼마나 잘 바뀌는지를 시간 순서대로 보는 곳입니다. 마케팅이나 영업 캠페인이 효과가 있었는지 확인할 때 씁니다.',
    data: [
      { label: '신규 가입 추이', detail: '학년도·시간 단위(일·주·월)·페이지를 골라서 볼 수 있습니다. 그래프 위에 마우스를 올리면 그날의 자세한 정보가 작은 팝업으로 뜹니다.' },
      { label: '무료→유료 전환 추이', detail: '「가입」 · 「유료로 바뀜」 · 「떠남」 세 가지 사건을 따로 표시합니다. 사람이 가입한 시점과 유료로 바뀐 시점이 다를 수 있어서 따로 그립니다.' },
      { label: '마케팅·영업 해석 박스', detail: '차트 아래에 「지금 추이를 어떻게 봐야 하는지」 자동 코멘트가 뜹니다 (예: 「전환율이 평소보다 10% 높습니다」). 보고서에 그대로 넣어도 됩니다.' },
    ],
    interpret: [
      '신규 가입은 늘었는데 유료 전환은 그대로면 → 무료 체험 후 「왜 유료를 안 결제하지?」를 점검할 시점',
      '학년도 비교 탭에서 작년 같은 시기와 비교 → 올해가 더 가파르게 늘었는지 확인',
      '색이 진한 주(週)는 「가입이 많이 몰린 주」 → 그 주에 어떤 이벤트가 있었는지 돌아보세요.',
    ],
    actions: [
      '캠페인 효과 확인 — 캠페인 시작 전후 가입·전환 숫자 비교',
      '학년도 비교 탭으로 작년 대비 성장률 계산',
      '하단 「마케팅·영업 해석」 코멘트를 그대로 주간 보고서에 복붙',
    ],
  },
  {
    id: 'notice',
    icon: '🔔',
    title: '공지사항 / Q&A',
    subtitle: '운영 메시지 · CS 문의',
    purpose: '최근 공지와 선생님 문의 상태를 첫 화면에서 바로 확인하는 영역입니다. 답해야 할 문의가 쌓여있는지 빠르게 보세요.',
    data: [
      { label: '공지사항', detail: '최근에 올린 공지를 시간순으로 보여줍니다. 카드를 클릭하면 자세한 내용으로 들어갈 수 있어요.' },
      { label: 'Q&A (FAQ)', detail: '최근 문의·자주 묻는 질문을 모은 영역입니다. 위쪽에 「아직 답하지 않은 문의 수」가 숫자로 표시됩니다.' },
    ],
    interpret: [
      '답 안 한 문의 수가 평소보다 많아지면 → CS 담당자 늘리거나 FAQ를 보완해야 할 신호',
      '비슷한 문의가 계속 올라오면 → 공지를 새로 올리거나 가이드를 보강할 시점',
    ],
    actions: [
      '미답변 문의 클릭 → 바로 답변 처리 화면으로',
      '오래된 공지면 새 공지 등록 시점',
      '자주 묻는 질문 패턴은 「FAQ 후보」로 모아두기',
    ],
  },
  {
    id: 'token',
    icon: '🤖',
    title: 'AI 토큰 사용량',
    subtitle: '비용 · 캐파 · 효율',
    purpose: 'AI 채점과 생성에 들어간 토큰(=비용)을 다양한 각도로 봅니다. 「얼마 썼는지」, 「어디서 많이 썼는지」, 「과제 한 건당 평균 얼마인지」를 확인합니다.',
    data: [
      { label: '8가지 보기 탭', detail: '월별 추세(기본) / 일별 / 학년도 비교 / 기능별 / 모델별 / 사용 많은 학교 Top / 교과별 등. 탭을 누르면 같은 데이터를 다른 각도에서 봅니다.' },
      { label: '과제 1건당 평균 토큰', detail: '서비스 시작부터 지금까지 쓴 토큰을 누적 과제 수로 나눈 값입니다. 「과제 하나에 평균 얼마가 들었나」를 알 수 있어요.' },
      { label: '학년도 비교 탭', detail: '학년도마다 다른 색으로 표시되고, 체크박스로 비교할 학년도를 더하거나 뺄 수 있습니다.' },
    ],
    interpret: [
      '월별 추세가 갑자기 가파르게 올라가면 → 사용량이 늘었거나 비싼 모델로 바뀌었을 수 있음. 모델별 탭에서 원인을 찾아보세요.',
      '사용 많은 학교 Top 탭에서 한 학교가 압도적으로 많이 쓴다면 → 잘 쓰고 있는 건지, 오용인지 확인 필요',
      '교과별 탭에서 어느 교과가 토큰을 적게 쓰면서도 효과가 좋은지 비교 → 프롬프트 개선 우선순위 결정',
    ],
    actions: [
      '월말 정산 보고서 — 월별 추세 + 학년도 비교 캡처',
      'Top 학교 탭에서 이상하게 많이 쓰는 학교 찾으면 영업·CS에 전달',
      '모델별 탭으로 비싼 모델 비중 모니터링',
    ],
  },
  {
    id: 'access',
    icon: '👥',
    title: '교사 접속률',
    subtitle: '계약 vs 실제 사용 비율',
    purpose: '계약은 했는데 실제로 안 쓰는 「휴면 학교」를 찾는 영역입니다. 비싸게 계약한 학교가 실제로 안 쓴다면 큰 손해입니다.',
    data: [
      { label: '접속률 계산법', detail: '일정 기간 동안 한 번이라도 로그인한 선생님 수 ÷ 계약된 전체 선생님 수. 일간·주간·월간 단위로 볼 수 있어요.' },
      { label: '학년도 단위 단절', detail: '학년이 새로 시작하면 학생·채점 데이터는 비워집니다 (개인정보 보호). 선생님 계약은 학년도와 무관하게 그대로 유지됩니다.' },
    ],
    interpret: [
      '접속률 50% 미만이면 → 계약은 했지만 안 쓰는 학교가 많다는 뜻. CS·온보딩(사용법 안내) 시점',
      '특정 학교의 선생님 접속률이 0%에 가까우면 → 그 학교는 휴면 상태. 영업이 다시 접촉해야 할 대상',
      '월별 추이가 학기 시작·중간·말 패턴과 일치하는지 확인 → 정상 사이클인지 판단',
    ],
    actions: [
      '휴면 학교 리스트 뽑아서 CS팀에 전달',
      '온보딩 캠페인 효과 확인 (캠페인 전후 접속률 비교)',
      '학기말 보고서에 「학기 누적 접속률」 캡처',
    ],
  },
  {
    id: 'schoolTask',
    icon: '🏫',
    title: '학교급별 과제 활동 (5개 탭)',
    subtitle: '초·중·고 활동 분석',
    purpose: '초등·중학교·고등학교별로 과제가 얼마나 만들어지고 채점되는지를 5가지 각도에서 봅니다. 탭마다 답하는 질문이 다릅니다.',
    data: [
      { label: '📊 학교급별 활동·활용률', detail: '학교급별로 「생성·채점」 막대 + 활용률(=채점÷생성) %를 한 차트에 표시. 막대 길이는 학교급 사이 비중을, 우측 %는 「만든 것 중 얼마나 채점까지 갔는지」 보여줍니다.' },
      { label: '🔥 학교급 × 교과 매트릭스', detail: '히트맵 형태로 학교급과 교과의 모든 조합(셀)에 「생성/채점/활용률」 3가지 정보를 함께 표시. 셀 비율을 「전체 대비」 · 「학교급 안에서」 · 「교과 안에서」 3가지로 보는 정의 박스도 자동으로 나옵니다.' },
      { label: '📈 학교급별 월별 추세', detail: '초/중/고 3개 라인으로 12개월 변화 추이. 이 탭에서만 「과제 생성 / 채점 활동」 중 하나를 골라볼 수 있는 토글이 나옵니다.' },
      { label: '📚 누적 보유 과제', detail: '학년이 바뀌어도 사라지지 않는 「우리가 가진 전체 과제 수」 + 「올해 새로 만들어진 과제 수」를 따로 표시. 다른 탭과 달리 학년도 드롭다운 영향을 받지 않습니다 (과제는 영구 자산이라서).' },
      { label: '교사 등급 sub-filter', detail: '「전체 / 💎 유료 / 무료」 — 모든 탭에서 항상 보입니다. 유료/무료 선생님으로 나눠서 분석할 수 있어요.' },
    ],
    interpret: [
      '같은 4월의 「생성 100건」과 「채점 80건」은 사실 다른 과제 모음입니다. 4월에 채점한 것 중에는 3월에 만들어진 과제도 섞여 있어요. 그래서 「80% 활용했다」고 단순 비교하면 틀립니다. 학년도 전체 누적으로 봐야 안전합니다.',
      '활용률 % 한 줄로 「고등은 만들기만 하고 채점은 따라오지 않네」 같은 패턴을 한눈에 발견',
      '「📚 누적 보유 과제」 탭은 학년이 바뀌어도 사라지지 않는 시스템 자산 규모 — 영구 가치를 보여줍니다',
      '히트맵에서 빈 셀이 많은 학교급은 → 그 교과의 콘텐츠를 보강할 우선순위',
    ],
    actions: [
      '학기 회고 — 학교급별 활동·활용률 탭 캡처해서 학기 성과 보고',
      '히트맵 탭으로 콘텐츠 보강 우선순위 결정 (활용률 낮은 셀)',
      '월별 추세에서 평소보다 떨어진 학교급 발견 → 영업이 다시 접촉',
      '「누적 보유 과제」 숫자는 IR·투자 자료의 「우리 시스템 자산 규모」로 활용',
    ],
  },
  {
    id: 'subjectAi',
    icon: '📚',
    title: '교과별 AI 채점 활용',
    subtitle: '교과 단위 자동/자율 비교',
    purpose: '국어·수학·영어 같은 교과별로 AI 채점이 얼마나 쓰이는지 봅니다. 「학교급별 과제 활동」과는 보는 각도가 다릅니다 (학교급 × 교과 → 교과 단일).',
    data: [
      { label: '교과 단일 집계', detail: '국어·수학·영어·사회·과학 등 교과별로 채점 건수와 활용률을 한 줄로 보여줍니다.' },
      { label: '평가유형 sub-filter', detail: '「전체 / 🤖 자동평가 / ✍️ 자율평가」 — 평가 모드별로 나눠서 분석할 수 있어요.' },
      { label: '학교급별 과제 활동과의 차이', detail: '학교급별 과제 활동은 「학교급 × 교과」 두 축으로 보고, 이 영역은 「교과」 한 축으로만 봅니다. 같은 데이터를 다른 각도에서 보는 거예요.' },
    ],
    interpret: [
      '자동평가·자율평가 비중을 sub-filter로 나눠보면 → 선생님들이 어느 모드를 더 많이 쓰는지 알 수 있음',
      '국어·영어처럼 서술형이 많은 교과의 활용률이 낮으면 → 프롬프트나 OCR(글자 인식) 품질을 점검해볼 시점',
      '「학교급별 과제 활동 → 교과별 AI 채점 활용」 순서로 보면 「학교급 × 교과」 → 「교과」로 시야를 좁혀가는 자연스러운 분석 흐름',
    ],
    actions: [
      '자동 vs 자율 활용률 격차 분석',
      '교과 단위로 프롬프트 개선 우선순위 결정',
      '교과별 AI 채점 활용도 보고서 — 학기말 정성 평가 자료',
    ],
  },
];

const GLOBAL_TIPS = [
  '🗓 학년도 드롭다운을 바꾸면 모든 영역의 숫자가 그 학년도 기준으로 함께 바뀝니다. 단 「📚 누적 보유 과제」 탭만 예외 — 과제는 학년이 바뀌어도 사라지지 않는 자산이라서 학년도와 무관하게 전체 누적을 보여줍니다.',
  '⏱ 데이터는 페이지 새로고침(F5) 때 한 번에 다시 가져옵니다. 운영 KPI 카드 3개만 5분에 한 번씩 자동으로 새 숫자가 들어와요.',
  // [v4.17] 데이터 집계 기준 — 구조화 노드 (사용자 피드백 반영)
  (
    <div>
      <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#78350F', lineHeight: 1.7, fontWeight: 700, marginBottom: 6 }}>
        📐 데이터 집계 기준은 <strong>「조회 시점」</strong>과 <strong>「조회 기간」</strong>에 따라 다음과 같이 구분됩니다.
      </div>
      <ul style={{ paddingLeft: 18, fontSize: 'var(--neo-font-size-sm)', color: '#78350F', lineHeight: 1.7, margin: 0 }}>
        <li style={{ marginBottom: 4 }}><strong>현재 N개 (시점 기준)</strong>: 지금 이 순간을 기준으로 집계한 실시간 현황</li>
        <li style={{ marginBottom: 4 }}><strong>기간 동안 N개 (이력 기준)</strong>: 해당 기간 내 한 번이라도 조건에 만족했던 모든 누적 현황</li>
      </ul>
      <div style={{ marginTop: 10, padding: '10px 12px', background: 'white', border: '1px dashed #FCD34D', borderRadius: 8 }}>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#92400E', marginBottom: 4 }}>💡 참고 사례</div>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#78350F', lineHeight: 1.65 }}>
          어떤 학교가 <strong>유료 ➔ 무료 ➔ 유료</strong> 과정을 거쳤다면, <strong>「현재 유료 학교 수」</strong>와 <strong>「올해 누적 유료 학교 수」</strong>는 다르게 측정될 수 있습니다. 이는 데이터 집계 기준의 차이일 뿐 둘 다 정확한 수치입니다.
        </div>
      </div>
    </div>
  ),
  '🔍 차트 위에 마우스를 올리거나 클릭하면 그 시점의 상세 정보가 작은 팝업으로 뜹니다. 클릭한 팝업은 다시 클릭하기 전까지 그대로 남아요.',
];

// 메인 컴포넌트 — open=true이면 즉시 외부 윈도우 열기, 본 페이지에는 아무 UI 안 그림
const DashboardGuide = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <ExternalWindow onClose={onClose}>
      <GuideShell />
    </ExternalWindow>
  );
};

// 외부 창 안에서 표시되는 전체 화면 — 헤더 + nav + 본문 + 푸터
const GuideShell = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = SECTIONS[activeIdx];
  const total = SECTIONS.length;
  const goPrev = () => setActiveIdx((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIdx((i) => (i + 1) % total);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'white', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #4A90E2, #357ABD)', color: 'white', flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📖</span><span>대시보드 활용 가이드</span>
        </div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', opacity: 0.9, marginTop: 4 }}>
          메뉴별 목적·계산 방법·해석·활용 방법을 정리했습니다. 본 창은 독립 윈도우라서 모니터 옆에 두고 대시보드와 같이 보세요.
        </div>
      </div>

      {/* 섹션 선택 행 */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={goPrev} title="이전 섹션" style={navBtn}>←</button>
        <select value={activeIdx} onChange={(e) => setActiveIdx(Number(e.target.value))}
          style={{ flex: 1, padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', background: 'white', cursor: 'pointer' }}>
          {SECTIONS.map((s, i) => (
            <option key={s.id} value={i}>{i + 1}. {s.icon} {s.title}</option>
          ))}
        </select>
        <button onClick={goNext} title="다음 섹션" style={navBtn}>→</button>
      </div>

      {/* 본문 — 스크롤 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{active.icon}</span><span>{active.title}</span>
        </div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: 16 }}>{active.subtitle}</div>

        <Section color="#2A75F3" icon="🎯" label="이 영역이 보여주는 것">
          <p style={p}>{active.purpose}</p>
        </Section>
        <Section color="#2A75F3" icon="📊" label="무엇을 어떻게 계산">
          <ul style={ul}>
            {active.data.map((d, i) => (
              <li key={i} style={li}>
                <strong style={{ color: '#1E293B' }}>{d.label}</strong> — {d.detail}
              </li>
            ))}
          </ul>
        </Section>
        <Section color="#10B981" icon="🔍" label="이렇게 읽으세요">
          <ul style={ul}>
            {active.interpret.map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
        </Section>
        <Section color="#F59E0B" icon="💼" label="이렇게 활용하세요">
          <ul style={ul}>
            {active.actions.map((t, i) => <li key={i} style={li}>{t}</li>)}
          </ul>
        </Section>

        {/* 전역 팁 — 모든 섹션 하단에 고정 */}
        <div style={{ marginTop: 22, padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 900, color: '#92400E', marginBottom: 8 }}>💡 모든 영역에 적용되는 공통 팁</div>
          {GLOBAL_TIPS.map((t, i) => (
            <div key={i} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#78350F', lineHeight: 1.65, marginBottom: 8 }}>{t}</div>
          ))}
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ padding: '8px 14px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', flexShrink: 0, textAlign: 'center' }}>
        {activeIdx + 1} / {total} · 창을 닫으면 가이드가 종료됩니다
      </div>
    </div>
  );
};

// 보조 컴포넌트 — 섹션 카드
const Section = ({ color, icon, label, children }) => (
  <section style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{icon}</span><span>{label}</span>
    </div>
    {children}
  </section>
);

// 외부 윈도우 portal — window.open으로 띄운 별도 브라우저 창에 React 컨텐츠 렌더
const ExternalWindow = ({ onClose, children }) => {
  const [container, setContainer] = useState(null);
  const winRef = useRef(null);

  useEffect(() => {
    const win = window.open('', 'aigle-guide', 'width=520,height=720,scrollbars=yes,resizable=yes');
    if (!win) {
      alert('팝업이 차단되었습니다. 브라우저 주소창 옆 팝업 차단 해제 후 다시 시도해주세요.');
      onClose();
      return;
    }
    win.document.title = '대시보드 활용 가이드';
    // 외부 창에 기본 스타일 주입
    const styleEl = win.document.createElement('style');
    styleEl.textContent = `
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; height: 100%; font-family: system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
      button { font-family: inherit; }
      ul { margin: 0; }
      #aigle-guide-root { height: 100%; }
    `;
    win.document.head.appendChild(styleEl);
    const div = win.document.createElement('div');
    div.id = 'aigle-guide-root';
    win.document.body.appendChild(div);
    setContainer(div);
    winRef.current = win;

    const onUnload = () => onClose();
    win.addEventListener('beforeunload', onUnload);
    return () => {
      try { win.removeEventListener('beforeunload', onUnload); } catch (e) { /* ignore */ }
      try { win.close(); } catch (e) { /* ignore */ }
      winRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};

const navBtn = {
  background: 'white', border: '1px solid #CBD5E1', borderRadius: 6,
  width: 32, height: 32, fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#475569', cursor: 'pointer',
};
const p = { fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.75, margin: 0 };
const ul = { paddingLeft: 18, fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.75, margin: 0 };
const li = { marginBottom: 6 };

export default DashboardGuide;
