/**
 * Dashboard.jsx
 * 대시보드 화면 컴포넌트입니다.
 * 과제관리, 채점현황, 학생분포 등 주요 지표를 시각화하여 보여줍니다.
 */
import React, { useState, useRef, useMemo } from 'react';
import DashboardGuide from './DashboardGuide';

const Dashboard = ({ onNavigate }) => {
  // [v3.9] 학년도 단일화 — servicePeriod / regionYear / signupYear 모두 globalYear 단일 state로 통합.
  // 헤더 드롭다운만 학년도 제어, 모든 분석 섹션은 globalYear 자동 sync.
  const [globalYear, setGlobalYear] = useState('2026');
  // [v4.16] 활용 가이드 모달 — 메뉴별 활용·해석 가이드 통합
  const [guideOpen, setGuideOpen] = useState(false);
  const [tokenChartView, setTokenChartView] = useState('monthly'); // monthly | feature | model | topSchools | subject
  // [v3.10] 월별 추세 탭 학년도 = 헤더 globalYear 자동 참조 (selectedTrendYear 폐기)
  // [v3.10] 학년도 비교 탭 다중 선택 — 기본: globalYear만 체크 (고정·해제 불가), 추가 선택은 사용자가 진행
  // 추가 선택 학년도 Set만 보관 (globalYear는 effectiveYearCompare에서 자동 합산)
  const [yearCompareExtras, setYearCompareExtras] = useState(() => new Set());
  const effectiveYearCompare = useMemo(() => {
    const s = new Set(yearCompareExtras);
    s.add(globalYear);
    return s;
  }, [yearCompareExtras, globalYear]);
  const toggleYearCompareExtra = (year) => {
    if (year === globalYear) return; // 고정 entry — 토글 불가
    setYearCompareExtras(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };
  const [selectedDailyMonth, setSelectedDailyMonth] = useState('4월'); // 일별 추이 월 선택
  const [accessView, setAccessView] = useState('schools');     // 교사 접속률
  const [schoolTaskView, setSchoolTaskView] = useState('levelActivity'); // 학교급별 과제 활동 — v4.10 비중·활용률 단일 막대 차트로 통합
  const [schoolTaskMetric, setSchoolTaskMetric] = useState('creation'); // 'creation' (과제 생성=저장) | 'grading' (채점 활동=결과 발송+채점 완료)
  const [schoolTaskTier, setSchoolTaskTier] = useState('all'); // 'all' | 'paid' | 'free' (교사 등급별 활동)
  const [subjectAiView, setSubjectAiView] = useState('trend'); // 교과별 AI 채점 — 도넛 탭은 v2.46 삭제, default trend
  const [subjectAiTier, setSubjectAiTier] = useState('all'); // 교과별 AI 채점 월별 추세 — 교사 등급 sub-filter (시계열 전용)
  const [subjectAiEvalType, setSubjectAiEvalType] = useState('all'); // [v4.3] 교과별 AI 채점 — 평가유형 sub-filter (전체/등급/과정), 모든 3개 탭 공통 적용
  const [mapMetric, setMapMetric] = useState('schools'); // 교육청별 가입 현황 — 'schools' | 'teachers' | 'students'
  const [paidFilter, setPaidFilter] = useState('all'); // 'all' | 'paid' | 'free' (학교/교사 메트릭 sub-filter)
  const [accessOffice, setAccessOffice] = useState('all'); // 교사 접속률 — 학교별 추세 교육청 필터
  const [accessSearch, setAccessSearch] = useState(''); // 교사 접속률 — 학교명 검색어
  const [accessSelected, setAccessSelected] = useState(null); // 교사 접속률 — 선택한 학교명 Set (null이면 mock 첫 4개 자동 선택)
  const [hoveredOffice, setHoveredOffice] = useState(null); // 교육청 그리드 hover 시 학교 목록 popover (office id)
  const [signupHoverIdx, setSignupHoverIdx] = useState(null); // 신규 가입 추이 stacked bar hover (현재 단위 인덱스)
  const [distLevel, setDistLevel] = useState('초등학교'); // [v4.5] 학교급·교과 분포 탭 — 선택된 학교급
  const [convSchoolPopover, setConvSchoolPopover] = useState(null); // 'converted' | 'freeSignup' | null — 전환 학교 명단 popover
  const [conversionChartPopover, setConversionChartPopover] = useState(null); // { monthIdx, x, y } — 월별 전환 차트 점 클릭 popover
  const [signupPeriod, setSignupPeriod] = useState('month'); // 'day' | 'week' | 'month' — 신규 가입 추이 시간 단위 (v2.51)
  // [v3.9] signupYear / regionYear 폐기 — globalYear 단일 참조
  const signupYear = globalYear;
  const regionYear = globalYear;
  const [signupDailyMonth, setSignupDailyMonth] = useState('5월'); // [v2.53] 일별 단위 시 월 셀렉트
  const [signupWeekOffset, setSignupWeekOffset] = useState(0); // [v2.53] 주별 단위 좌우 스크롤 (0=최근 12주, 양수=과거)
  const signupCloseTimerRef = useRef(null); // hover 닫기 지연 (popover 진입 시간 확보)
  const openSignupHover = (i) => {
    if (signupCloseTimerRef.current) { clearTimeout(signupCloseTimerRef.current); signupCloseTimerRef.current = null; }
    setSignupHoverIdx(i);
  };
  const scheduleCloseSignupHover = () => {
    if (signupCloseTimerRef.current) clearTimeout(signupCloseTimerRef.current);
    signupCloseTimerRef.current = setTimeout(() => setSignupHoverIdx(null), 150);
  };
  const cancelCloseSignupHover = () => {
    if (signupCloseTimerRef.current) { clearTimeout(signupCloseTimerRef.current); signupCloseTimerRef.current = null; }
  };

  // 임시 데이터
  const stats = [
    { title: '과제 관리', icon: '📂', mainLabel: '등록된 과제', mainValue: '10개', subLabel: '배포 완료', subValue: '10개', color: '#10B981' },
    { title: '채점 관리', icon: '📝', mainLabel: '미채점', mainValue: '134건', subLabel: '채점완료', subValue: '230건', color: '#2A75F3' },
    { title: '학생 관리', icon: '👥', mainLabel: '관리 학생수', mainValue: '150명', subLabel: '관리 그룹수', subValue: '5개', color: '#FB923C' },
  ];

  const notices = [
    { id: 1, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23', rate: '75%', type: '공지' },
    { id: 2, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23', rate: '0%', type: '공지' },
    { id: 3, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23', rate: '75%', type: '일반' },
    { id: 4, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23', rate: '75%', type: '일반' },
  ];

  const faqs = [
    { id: 1, question: '과제 배포 후 학생이 답안을 제출하지 못하는 경우 어떻게 하나요?', date: '2025. 10. 23', status: '답변완료' },
    { id: 2, question: 'AI 채점 결과를 수정할 수 있나요?', date: '2025. 10. 23', status: '답변완료' },
    { id: 3, question: '여러 그룹에 동시에 과제를 배포할 수 있나요?', date: '2025. 10. 23', status: '답변대기' },
    { id: 4, question: '여러 그룹에 동시에 과제를 배포할 수 있나요?', date: '2025. 10. 23', status: '답변대기' },
  ];

  // ── AI 토큰 사용량 (Mock) ──
  // 입력/출력 토큰 + 기능별(문장다듬기/OCR/채점) + 학교/교과별 분포 모두 포함
  const tokenUsage = {
    // 모든 시간 범위 카드는 입력/출력 토큰 분리 데이터를 보유 (production: 서버가 매 요청마다 in/out 분리 기록)
    today:     { value: 0,         input: 0,          output: 0 },
    thisWeek:  { value: 4820000,   input: 3378000,    output: 1442000 },
    thisMonth: { value: 16266629,  input: 11400000,   output: 4866629 },  // = 4월 (현재 월)
    total:     { value: 19854636,  input: 13910000,   output: 5944636 },  // = 월별 합계
    // [v3.11] 옵션 B (호출 시점 기준) — production에선 각 api_calls row의 cost_usd / cost_krw / pricing_date를 직접 합산
    // pricing 객체는 mock 표기용 (현재 적용 단가·환율 안내문 표시 + mock cost 추정 계산). 실제 단가·환율은 매일 KST 00:05 cron이 pricing_history 테이블에 적재
    pricing: { input: 0.50, output: 3.00, krwRate: 1446.24, effectiveDate: '2026-05-08', source: 'mock' }, // USD per 1M tokens, 환율 KRW/USD
    monthly: [
      { month: '3월',  input: 2510000,  output: 1078007,  polish: 1075000, ocr: 1200000, grading: 1313007 },
      { month: '4월',  input: 11400000, output: 4866629,  polish: 4880000, ocr: 5400000, grading: 5986629 },
      { month: '5월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '6월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '7월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '8월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '9월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '10월', input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '11월', input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '12월', input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '1월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
      { month: '2월',  input: 0, output: 0, polish: 0, ocr: 0, grading: 0 },
    ],
    schoolTop: [
      { name: '아산고등학교',           value: 8500000 },
      { name: '미림마이스터고등학교',    value: 5200000 },
      { name: '서울대사범대부설고',      value: 2800000 },
      { name: '경기북과학고',           value: 1500000 },
      { name: '대전외국어고',           value: 980000 },
      { name: '광주여자고',             value: 520000 },
      { name: '부산국제고',             value: 280000 },
      { name: '제주중앙고',             value: 60000 },
      { name: '울산미래학교',           value: 10000 },
      { name: '인천예술중',             value: 4636 },
    ],
    subjects: [
      { name: '국어', value: 12500000, color: '#2A75F3' },
      { name: '수학', value: 4500000,  color: '#F59E0B' },
      { name: '영어', value: 1800000,  color: '#10B981' },
      { name: '사회', value: 800000,   color: '#8B5CF6' },
      { name: '과학', value: 254636,   color: '#EF4444' },
    ],
    // Tier 2 — 학교급별 (초/중/고)
    schoolLevels: [
      { name: '초등학교', value: 5400000,  color: '#10B981' },
      { name: '중학교',   value: 8200000,  color: '#2A75F3' },
      { name: '고등학교', value: 6254636,  color: '#8B5CF6' },
    ],
    // [v4.5] 학교급별 교과 토큰 분포 — 학교급마다 교과 list 다름
    subjectsByLevel: {
      '초등학교': [
        { name: '국어', value: 2350000, color: '#2A75F3' },
        { name: '수학', value: 1300000, color: '#F59E0B' },
        { name: '사회', value:  850000, color: '#8B5CF6' },
        { name: '과학', value:  620000, color: '#EF4444' },
        { name: '도덕', value:  280000, color: '#94A3B8' },
      ],
      '중학교': [
        { name: '국어', value: 2900000, color: '#2A75F3' },
        { name: '수학', value: 1850000, color: '#F59E0B' },
        { name: '영어', value: 1100000, color: '#10B981' },
        { name: '사회', value:  830000, color: '#8B5CF6' },
        { name: '과학', value:  720000, color: '#EF4444' },
        { name: '역사', value:  540000, color: '#0EA5E9' },
        { name: '도덕', value:  260000, color: '#94A3B8' },
      ],
      '고등학교': [
        { name: '국어',       value: 1820000, color: '#2A75F3' },
        { name: '수학',       value:  950000, color: '#F59E0B' },
        { name: '영어',       value:  720000, color: '#10B981' },
        { name: '한국사',     value:  680000, color: '#0EA5E9' },
        { name: '통합사회',   value:  790000, color: '#8B5CF6' },
        { name: '통합과학',   value:  610000, color: '#EF4444' },
        { name: '윤리와사상', value:  340000, color: '#94A3B8' },
        { name: '한국지리',   value:  344636, color: '#EC4899' },
      ],
    },
    // Tier 3 — 월별 일별 사용량 (선택 가능)
    dailyByMonth: {
      '3월': [
        // 학년도 시작 전 22일까지는 0, 23~31일에 사용량 분산
        0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,
        350000, 420000, 480000, 520000, 580000, 620000, 198007,  // 23~31일 (sum ≈ 3.6M)
      ],
      '4월': [
        580000, 720000, 650000, 480000, 200000, 180000, 510000,  // 1~7일
        680000, 750000, 620000, 580000, 660000, 250000, 220000,  // 8~14일
        720000, 700000, 680000, 750000, 690000, 280000, 240000,  // 15~21일
        710000, 680000, 720000, 690000, 700000, 260000, 230000,  // 22~28일
        736629, 270000,                                          // 29~30일 (sum ≈ 16.27M)
      ],
      '5월':  Array(31).fill(0),
      '6월':  Array(30).fill(0),
      '7월':  Array(31).fill(0),
      '8월':  Array(31).fill(0),
      '9월':  Array(30).fill(0),
      '10월': Array(31).fill(0),
      '11월': Array(30).fill(0),
      '12월': Array(31).fill(0),
      '1월':  Array(31).fill(0),
      '2월':  Array(28).fill(0),
    },
    // [v3.10] Tier 3 — 학년도별 월별 데이터 (월별 추세는 헤더 globalYear sync, 학년도 비교는 체크박스 다중 선택)
    // 데이터 셋 = 서비스 시작(2024학년도) ~ 현재(2026학년도)
    monthlyByYear: {
      // 2026학년도 — 진행 중 (기준일 2026-05-08): 3·4월 완료, 5월 부분, 이후 0
      '2026': [
        { month: '3월',  input: 4200000,  output: 1800000 },     // 6.0M (성장 1.5x)
        { month: '4월',  input: 16800000, output: 7200000 },     // 24M (성장 1.5x)
        { month: '5월',  input: 5600000,  output: 2400000 },     // 8M (5월 부분 — 8일 진행)
        { month: '6월',  input: 0, output: 0 }, { month: '7월',  input: 0, output: 0 },
        { month: '8월',  input: 0, output: 0 }, { month: '9월',  input: 0, output: 0 },
        { month: '10월', input: 0, output: 0 }, { month: '11월', input: 0, output: 0 },
        { month: '12월', input: 0, output: 0 }, { month: '1월',  input: 0, output: 0 },
        { month: '2월',  input: 0, output: 0 },
      ],
      '2025': [
        { month: '3월',  input: 2510000,  output: 1078007 },
        { month: '4월',  input: 11400000, output: 4866629 },
        { month: '5월',  input: 0, output: 0 }, { month: '6월',  input: 0, output: 0 },
        { month: '7월',  input: 0, output: 0 }, { month: '8월',  input: 0, output: 0 },
        { month: '9월',  input: 0, output: 0 }, { month: '10월', input: 0, output: 0 },
        { month: '11월', input: 0, output: 0 }, { month: '12월', input: 0, output: 0 },
        { month: '1월',  input: 0, output: 0 }, { month: '2월',  input: 0, output: 0 },
      ],
      '2024': [
        // 70/30 ratio로 input/output 분배 (yearCompare.y2024 기반)
        { month: '3월',  input: 840000,   output: 360000 },     // 1.2M
        { month: '4월',  input: 3150000,  output: 1350000 },    // 4.5M
        { month: '5월',  input: 5460000,  output: 2340000 },    // 7.8M
        { month: '6월',  input: 4340000,  output: 1860000 },    // 6.2M
        { month: '7월',  input: 3780000,  output: 1620000 },    // 5.4M
        { month: '8월',  input: 1260000,  output: 540000 },     // 1.8M
        { month: '9월',  input: 3430000,  output: 1470000 },    // 4.9M
        { month: '10월', input: 5040000,  output: 2160000 },    // 7.2M
        { month: '11월', input: 4760000,  output: 2040000 },    // 6.8M
        { month: '12월', input: 2940000,  output: 1260000 },    // 4.2M
        { month: '1월',  input: 1470000,  output: 630000 },     // 2.1M
        { month: '2월',  input: 1050000,  output: 450000 },     // 1.5M
      ],
    },
    // Tier 3 — 요일×시간 히트맵 (7행 일~토 × 24열 0~23시) [v4.5 정책]
    // 측정: 그 시간대에 시작된 AI 요청의 토큰 사용량 합산 (input + output)
    // 시작 시점(started_at) 한 시간대에만 토큰량 일괄 가산 (split count 폐기)
    // 기준: 서비스 기간(2025-03-01 ~ 2026-02-28) 전체 누적
    // 평일 학교 시간(9-12, 13-17)에 peak, 새벽/심야/주말은 0~낮음
    hourlyHeatmap: (() => {
      const grid = [];
      for (let day = 0; day < 7; day++) {
        const row = [];
        const isWeekend = day === 0 || day === 6;
        for (let hour = 0; hour < 24; hour++) {
          let v = 0; // 그 시간대에 시작된 요청의 토큰량 합
          if (isWeekend) {
            // 주말 — 가벼운 사용
            if (hour >= 10 && hour < 16) v = Math.round(250000 + (hour - 10) * 40000);     // 250K → 450K
            else if (hour >= 16 && hour < 22) v = Math.round(120000 + (22 - hour) * 20000); // 120K → 220K
          } else {
            // 평일 오전 peak (9-12시) — 학교 1교시~3교시
            if (hour >= 9 && hour < 12) v = Math.round(1500000 + (hour - 9) * 200000);   // 1.5M → 1.9M
            // 평일 오후 highest peak (13-17시) — 채점 집중
            else if (hour >= 13 && hour < 17) v = Math.round(2200000 + (16 - hour) * 150000); // 2.2M → 2.65M
            // 평일 이른 아침 (7-9시)
            else if (hour >= 7 && hour < 9) v = Math.round(350000 + (hour - 7) * 150000); // 350K → 500K
            // 평일 저녁 (17-20시)
            else if (hour >= 17 && hour < 20) v = Math.round(700000 - (hour - 17) * 150000); // 700K → 400K
            // 평일 야간 (20-23시)
            else if (hour >= 20 && hour < 23) v = Math.round(250000 - (hour - 20) * 70000); // 250K → 110K
          }
          row.push(v);
        }
        grid.push(row);
      }
      return grid;
    })(),
    // [v3.10] yearCompare는 monthlyByYear 단일 source로 통합 (total = input + output)
  };

  // ── 교사 접속률 mock ──
  const accessData = {
    months: ['3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'],
    // 학교별 접속율 (%) — 월별. 실제 운영에선 100+ 학교 가능 → 교육청/검색/선택 필터 필요
    // 모든 등록 학교 = 유료 (학교는 무료 등급 없음, 가입 = 영업 계약). [v4.9] paidRatio = 그 학교의 활성 교사 중 유료 교사 비중(%)
    schools: [
      { name: '미림마이스터고등학교',     office: 'seoul',    paidRatio: 78, values: [68, 92, 75, 80, 85, 70, 78, 82, 85, 76, 70, 65] },
      { name: '아산고등학교',             office: 'chungnam', paidRatio: 65, values: [72, 88, 70, 78, 82, 65, 75, 80, 83, 72, 68, 60] },
      { name: '서울대사범대부설고등학교', office: 'seoul',    paidRatio: 82, values: [60, 80, 85, 88, 90, 75, 82, 87, 90, 80, 72, 68] },
      { name: '경기북과학고등학교',       office: 'gyeonggi', paidRatio: 55, values: [65, 75, 70, 72, 78, 60, 70, 76, 79, 70, 62, 55] },
      { name: '대전외국어고등학교',       office: 'daejeon',  paidRatio: 42, values: [55, 70, 78, 82, 85, 65, 75, 80, 82, 75, 68, 60] },
      { name: '광주여자고등학교',         office: 'gwangju',  paidRatio: 38, values: [50, 65, 72, 75, 78, 60, 70, 75, 78, 70, 62, 55] },
      { name: '부산국제고등학교',         office: 'busan',    paidRatio: 70, values: [70, 85, 80, 82, 88, 72, 80, 85, 88, 80, 72, 65] },
      { name: '제주중앙고등학교',         office: 'jeju',     paidRatio: 35, values: [45, 60, 65, 70, 75, 55, 65, 72, 75, 68, 60, 50] },
      { name: '울산미래학교',             office: 'ulsan',    paidRatio: 28, values: [40, 55, 60, 65, 70, 50, 60, 68, 70, 62, 55, 45] },
      { name: '인천예술중학교',           office: 'incheon',  paidRatio: 60, values: [62, 78, 70, 75, 80, 65, 72, 78, 82, 72, 65, 58] },
      { name: '강원외국어고등학교',       office: 'gangwon',  paidRatio: 48, values: [50, 65, 70, 75, 78, 62, 72, 78, 80, 72, 65, 55] },
      { name: '세종과학예술영재학교',     office: 'sejong',   paidRatio: 88, values: [75, 90, 82, 85, 90, 78, 85, 88, 92, 82, 75, 68] },
      { name: '청주대성고등학교',         office: 'chungbuk', paidRatio: 52, values: [58, 72, 70, 73, 78, 62, 70, 75, 78, 70, 62, 55] },
      { name: '전주한일고등학교',         office: 'jeonbuk',  paidRatio: 45, values: [55, 70, 68, 72, 76, 60, 68, 74, 76, 68, 60, 52] },
      { name: '순천공업고등학교',         office: 'jeonnam',  paidRatio: 32, values: [48, 62, 65, 68, 72, 55, 65, 72, 75, 65, 58, 48] },
      { name: '대구과학고등학교',         office: 'daegu',    paidRatio: 75, values: [70, 85, 80, 82, 86, 70, 78, 82, 85, 78, 70, 62] },
      { name: '안동고등학교',             office: 'gyeongbuk', paidRatio: 40, values: [52, 68, 65, 70, 74, 58, 66, 72, 75, 67, 60, 50] },
      { name: '창원남고등학교',           office: 'gyeongnam', paidRatio: 50, values: [56, 70, 68, 72, 76, 60, 68, 74, 76, 70, 62, 54] },
      { name: '서울국제고등학교',         office: 'seoul',    paidRatio: 92, values: [78, 92, 85, 88, 90, 78, 85, 88, 92, 84, 76, 70] },
      { name: '서울외국어고등학교',       office: 'seoul',    paidRatio: 72, values: [65, 80, 78, 82, 85, 70, 78, 82, 85, 76, 68, 60] },
      { name: '서울예술고등학교',         office: 'seoul',    paidRatio: 58, values: [55, 70, 72, 75, 78, 62, 72, 78, 80, 70, 62, 55] },
      { name: '경기과학고등학교',         office: 'gyeonggi', paidRatio: 80, values: [72, 88, 80, 82, 88, 72, 80, 85, 88, 78, 70, 62] },
      { name: '경기여자고등학교',         office: 'gyeonggi', paidRatio: 62, values: [60, 75, 72, 76, 80, 65, 72, 78, 82, 72, 65, 58] },
      { name: '수원하이텍고등학교',       office: 'gyeonggi', paidRatio: 44, values: [50, 65, 68, 72, 76, 58, 68, 74, 76, 68, 60, 52] },
      { name: '부산과학고등학교',         office: 'busan',    paidRatio: 76, values: [68, 82, 78, 80, 85, 70, 78, 82, 85, 76, 68, 60] },
      { name: '인천국제고등학교',         office: 'incheon',  paidRatio: 56, values: [58, 72, 70, 74, 78, 62, 70, 76, 78, 70, 62, 55] },
      { name: '대전과학고등학교',         office: 'daejeon',  paidRatio: 74, values: [70, 85, 80, 82, 86, 70, 78, 82, 85, 78, 70, 62] },
      { name: '광주과학고등학교',         office: 'gwangju',  paidRatio: 64, values: [62, 76, 73, 76, 80, 65, 73, 78, 80, 72, 65, 56] },
      { name: '대구외국어고등학교',       office: 'daegu',    paidRatio: 47, values: [55, 70, 68, 72, 76, 60, 68, 74, 76, 68, 60, 52] },
      { name: '울산과학고등학교',         office: 'ulsan',    paidRatio: 51, values: [50, 65, 65, 70, 74, 58, 66, 72, 74, 65, 58, 50] },
      // [v2.60] 5월 신규 가입 3개교 — accessData.schools 단일 source 정합 (3월·4월 0, 5월부터 데이터)
      { name: '천안중앙고등학교',           office: 'chungnam',  paidRatio: 25, values: [0, 0, 45, 60, 68, 55, 65, 70, 72, 65, 58, 50] },
      { name: '포항제철고등학교',           office: 'gyeongbuk', paidRatio: 30, values: [0, 0, 50, 65, 72, 58, 68, 73, 76, 68, 60, 52] },
      { name: '춘천교육대학교부설초등학교', office: 'gangwon',   paidRatio: 22, values: [0, 0, 42, 58, 65, 52, 62, 68, 70, 62, 55, 48] },
    ],
    // [v4.5] 유료 vs 무료 교사 접속률 (중복 제거 로그인 교사 / 활성 등록 교사 × 100)
    // 단위: % (정수). 같은 교사 여러 번 로그인해도 분자에서 1명으로 중복 제거
    // 현재 월(가정: 5월 진행 중)은 NOW()까지 실시간 — 분자가 누적되면서 % 증가
    paidFree: [
      { month: '3월', paid: 78, free: 35, isCurrent: false }, // 3월 종료, 고정
      { month: '4월', paid: 85, free: 42, isCurrent: false }, // 4월 종료, 고정
      { month: '5월', paid: 52, free: 28, isCurrent: true  }, // 5월 진행 중, 오늘까지 실시간
      { month: '6월', paid: 0,  free: 0,  isCurrent: false },
      { month: '7월', paid: 0,  free: 0,  isCurrent: false },
      { month: '8월', paid: 0,  free: 0,  isCurrent: false },
      { month: '9월', paid: 0,  free: 0,  isCurrent: false },
      { month: '10월',paid: 0,  free: 0,  isCurrent: false },
      { month: '11월',paid: 0,  free: 0,  isCurrent: false },
      { month: '12월',paid: 0,  free: 0,  isCurrent: false },
      { month: '1월', paid: 0,  free: 0,  isCurrent: false },
      { month: '2월', paid: 0,  free: 0,  isCurrent: false },
    ],
    // 첫 접속 vs 재접속 (월별 활성 교사)
    // newT  = 해당 월 "첫 접속"한 교사 (가입 시점은 더 이전일 수도 있음)
    // returnT = 해당 월에 재접속한 교사 (이전에 한 번 이상 접속 경험 있음)
    // newT + returnT = 그 월 활성 교사 수 (MAU)
    // 신규 가입(signup) 데이터는 "교육청별 가입 현황 → 신규 가입 추이"로 이전됨 (v2.31)
    newReturn: [
      { month: '3월', newT: 32, returnT: 8 },
      { month: '4월', newT: 18, returnT: 38 },
      { month: '5월', newT: 0,  returnT: 0 },
      { month: '6월', newT: 0,  returnT: 0 },
      { month: '7월', newT: 0,  returnT: 0 },
      { month: '8월', newT: 0,  returnT: 0 },
      { month: '9월', newT: 0,  returnT: 0 },
      { month: '10월',newT: 0,  returnT: 0 },
      { month: '11월',newT: 0,  returnT: 0 },
      { month: '12월',newT: 0,  returnT: 0 },
      { month: '1월', newT: 0,  returnT: 0 },
      { month: '2월', newT: 0,  returnT: 0 },
    ],
    // 요일×시간 접속 패턴 (7×24)
    hourlyHeatmap: (() => {
      const grid = [];
      for (let day = 0; day < 7; day++) {
        const row = [];
        const isWeekend = day === 0 || day === 6;
        for (let hour = 0; hour < 24; hour++) {
          let v = 0;
          if (isWeekend) {
            if (hour >= 10 && hour < 16) v = 5 + (hour - 10);
            else if (hour >= 16 && hour < 22) v = 3;
          } else {
            if (hour >= 9 && hour < 17) v = 30 + Math.round(Math.sin((hour - 9) / 8 * Math.PI) * 20);
            else if (hour >= 7 && hour < 9) v = 8 + (hour - 7) * 5;
            else if (hour >= 17 && hour < 21) v = 22 - (hour - 17) * 4;
          }
          row.push(v);
        }
        grid.push(row);
      }
      return grid;
    })(),
    // 무료 → 유료 전환은 「교육청별 가입 현황 → 무료→유료 전환 추이」로 통합 (v2.38)
    // 비즈니스 룰: 교사 전환은 학교 영업 결과 일괄 발생 — 개인 funnel 모델에 부적합
  };

  // ── 학교급별 과제 활동 mock ──
  // metric:
  //   creation = 과제 생성 (작성중 + 배포됨 + 채점 진행 + 채점 완료 = ID가 만들어진 모든 과제)
  //   grading  = 채점 활동 (결과 발송 단계 + 교사 채점 완료 단계의 과제만)
  // tier: 교사 등급별 활동 (all / paid / free)
  // 관계: creation ≥ grading (모든 채점 활동 과제는 먼저 생성됨)
  // 관계: all = paid + free (각 메트릭 내)
  const schoolTaskData = {
    months: ['3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'],
    polarColors: ['#10B981', '#2A75F3', '#8B5CF6'], // 초/중/고
    // Polar area — 학교급별 누적 [초, 중, 고]
    polar: {
      creation: { all: [28, 45, 62], paid: [12, 22, 35], free: [16, 23, 27] },
      grading:  { all: [22, 32, 51], paid: [10, 18, 30], free: [12, 14, 21] },
    },
    // 학교급 × 교과 매트릭스 (행: 학교급, 열: 교과)
    levelSubject: {
      levels: ['초등학교', '중학교', '고등학교'],
      subjects: ['국어', '수학', '영어', '사회', '과학'],
      creation: {
        all:  [[12, 8, 4, 2, 2], [18, 14, 8, 3, 2], [25, 18, 10, 5, 4]],
        paid: [[5, 3, 2, 1, 1], [9, 7, 4, 1, 1], [14, 10, 6, 3, 2]],
        free: [[7, 5, 2, 1, 1], [9, 7, 4, 2, 1], [11, 8, 4, 2, 2]],
      },
      grading: {
        all:  [[10, 6, 3, 2, 1], [13, 10, 6, 2, 1], [21, 15, 8, 4, 3]],
        paid: [[5, 3, 2, 1, 1], [8, 6, 3, 1, 0], [12, 9, 5, 2, 2]],
        free: [[5, 3, 1, 1, 0], [5, 4, 3, 1, 1], [9,  6, 3, 2, 1]],
      },
    },
    // 학교급 × 시간 — 월별 멀티 라인 [초, 중, 고]
    levelTime: {
      creation: {
        all:  [{ month: '3월', 초등: 6, 중학: 9, 고등: 13 }, { month: '4월', 초등: 22, 중학: 36, 고등: 49 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
        paid: [{ month: '3월', 초등: 3, 중학: 5, 고등: 7 }, { month: '4월', 초등: 9, 중학: 17, 고등: 28 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
        free: [{ month: '3월', 초등: 3, 중학: 4, 고등: 6 }, { month: '4월', 초등: 13, 중학: 19, 고등: 21 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
      },
      grading: {
        all:  [{ month: '3월', 초등: 4, 중학: 6, 고등: 10 }, { month: '4월', 초등: 18, 중학: 26, 고등: 41 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
        paid: [{ month: '3월', 초등: 3, 중학: 4, 고등: 6 }, { month: '4월', 초등: 7, 중학: 14, 고등: 24 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
        free: [{ month: '3월', 초등: 1, 중학: 2, 고등: 4 }, { month: '4월', 초등: 11, 중학: 12, 고등: 17 }, { month: '5월', 초등: 0, 중학: 0, 고등: 0 }, { month: '6월', 초등: 0, 중학: 0, 고등: 0 }, { month: '7월', 초등: 0, 중학: 0, 고등: 0 }, { month: '8월', 초등: 0, 중학: 0, 고등: 0 }, { month: '9월', 초등: 0, 중학: 0, 고등: 0 }, { month: '10월', 초등: 0, 중학: 0, 고등: 0 }, { month: '11월', 초등: 0, 중학: 0, 고등: 0 }, { month: '12월', 초등: 0, 중학: 0, 고등: 0 }, { month: '1월', 초등: 0, 중학: 0, 고등: 0 }, { month: '2월', 초등: 0, 중학: 0, 고등: 0 }],
      },
    },
    // 평균 채점 lag (생성일~채점일, 단위: 일) — tier별
    // 같은 월의 생성 vs 채점이 다른 cohort임을 정량화 (사용자에게 시차 정보 제공)
    gradingLag: {
      all: 4.5,
      paid: 3.2,
      free: 6.1,
    },
    // 학교급별 채점 활동 비율 (= grading / creation × 100, tier별)
    completionRate: {
      all: [
        { level: '초등학교', created: 28, graded: 22, rate: 78.6 },
        { level: '중학교',   created: 45, graded: 32, rate: 71.1 },
        { level: '고등학교', created: 62, graded: 51, rate: 82.3 },
      ],
      paid: [
        { level: '초등학교', created: 12, graded: 10, rate: 83.3 },
        { level: '중학교',   created: 22, graded: 18, rate: 81.8 },
        { level: '고등학교', created: 35, graded: 30, rate: 85.7 },
      ],
      free: [
        { level: '초등학교', created: 16, graded: 12, rate: 75.0 },
        { level: '중학교',   created: 23, graded: 14, rate: 60.9 },
        { level: '고등학교', created: 27, graded: 21, rate: 77.8 },
      ],
    },
    // [v4.11.2] 누적 보유 과제 — 학교급별·과목별 (학년도 무관 영구 자산 + 올해 신규 분리)
    cumulative: {
      total: 1247,
      gradedAnswers: 1668,  // [DSH-01] 누적 답안(채점건) 수 = 학생×문항 단위
      // [v4.12] 「문항당 원가」 분모 — 생성 문항 = 등록된 문항 누적 unique 수 / 채점 문항 = 한 번이라도 채점된 문항 unique 수
      //   가정: 평균 2.5문항/과제, 채점 도달률 80%
      questionsCreated: 3118,   // 1247 과제 × 2.5문항/과제
      questionsGraded:  2494,   // 생성 문항 중 채점 도달 80%
      newThisYear: 89,    // 올해 신규 등록 합계
      carryOver: 1158,    // 작년 말까지 누적
      byLevel: [
        { name: '초등학교', icon: '🟢', total: 350, newThisYear: 25, color: '#10B981' },
        { name: '중학교',   icon: '🔵', total: 480, newThisYear: 35, color: '#2A75F3' },
        { name: '고등학교', icon: '🟣', total: 417, newThisYear: 29, color: '#8B5CF6' },
      ],
      bySubject: [
        { name: '국어', icon: '📘', total: 458, newThisYear: 32, color: '#2A75F3' },
        { name: '수학', icon: '🔢', total: 320, newThisYear: 22, color: '#F59E0B' },
        { name: '영어', icon: '🌏', total: 198, newThisYear: 13, color: '#10B981' },
        { name: '사회', icon: '🏛', total: 145, newThisYear: 12, color: '#8B5CF6' },
        { name: '과학', icon: '🔬', total: 126, newThisYear: 10, color: '#EF4444' },
      ],
    },
  };

  // ── 교육청별 가입 현황 mock (전국 17개 시·도교육청) ──
  // viewBox 0 0 700 850 기준 — 각진 다각형(angular polygon) 스타일로 한반도 모양 표현
  // path: SVG path data (M, L, Z), labelX/Y: 라벨 중심 좌표
  const regionMapData = [
    // 북동: 강원특별자치도교육청 (대형 다각형)
    {
      id: 'gangwon', name: '강원특별자치도교육청', shortName: '강원', category: '특별자치도', schools: 2, teachers: 150, teachersPaid: 5, teachersFree: 145, students: 3200,
      path: 'M 305 80 L 360 65 L 410 65 L 460 75 L 500 95 L 525 115 L 535 145 L 540 180 L 535 215 L 525 245 L 510 270 L 485 285 L 450 295 L 405 295 L 360 285 L 325 270 L 305 250 L 295 220 L 290 180 L 292 130 Z',
      labelX: 415, labelY: 195,
    },
    // 수도권
    {
      id: 'gyeonggi', name: '경기도교육청', shortName: '경기', category: '도', schools: 4, teachers: 420, teachersPaid: 25, teachersFree: 395, students: 9800,
      path: 'M 125 145 L 155 110 L 200 95 L 245 95 L 280 105 L 295 130 L 295 160 L 175 160 L 175 230 L 270 230 L 295 230 L 295 270 L 280 285 L 245 290 L 200 285 L 165 275 L 135 260 L 115 235 L 100 200 L 105 165 Z',
      labelX: 240, labelY: 270,
    },
    {
      id: 'seoul', name: '서울특별시교육청', shortName: '서울', category: '특별시', schools: 5, teachers: 580, teachersPaid: 32, teachersFree: 548, students: 12500,
      path: 'M 175 165 L 195 158 L 220 155 L 245 160 L 260 170 L 265 190 L 260 210 L 245 220 L 220 225 L 195 225 L 178 218 L 170 200 L 170 180 Z',
      labelX: 215, labelY: 192,
    },
    {
      id: 'incheon', name: '인천광역시교육청', shortName: '인천', category: '광역시', schools: 2, teachers: 220, teachersPaid: 8, teachersFree: 212, students: 5200,
      path: 'M 60 195 L 80 180 L 110 180 L 135 185 L 145 205 L 145 230 L 135 250 L 115 260 L 90 260 L 70 250 L 55 230 L 50 215 Z',
      labelX: 95, labelY: 220,
    },
    // 충청권
    {
      id: 'chungbuk', name: '충청북도교육청', shortName: '충북', category: '도', schools: 1, teachers: 180, teachersPaid: 4, teachersFree: 176, students: 3600,
      path: 'M 290 280 L 330 270 L 380 270 L 410 285 L 420 320 L 420 365 L 405 390 L 365 395 L 320 390 L 290 380 L 285 345 L 285 310 Z',
      labelX: 355, labelY: 335,
    },
    {
      id: 'chungnam', name: '충청남도교육청', shortName: '충남', category: '도', schools: 2, teachers: 200, teachersPaid: 5, teachersFree: 195, students: 4100,
      path: 'M 130 270 L 175 265 L 220 270 L 260 275 L 285 285 L 290 320 L 290 365 L 280 395 L 250 410 L 215 410 L 175 405 L 140 395 L 105 380 L 80 355 L 70 320 L 80 290 L 105 275 Z',
      labelX: 195, labelY: 335,
    },
    {
      id: 'sejong', name: '세종특별자치시교육청', shortName: '세종', category: '특별자치시', schools: 1, teachers: 65, teachersPaid: 2, teachersFree: 63, students: 1200,
      path: 'M 230 335 L 250 330 L 275 332 L 290 340 L 290 358 L 280 367 L 260 370 L 240 367 L 225 358 L 222 348 Z',
      labelX: 258, labelY: 350,
    },
    {
      id: 'daejeon', name: '대전광역시교육청', shortName: '대전', category: '광역시', schools: 2, teachers: 140, teachersPaid: 4, teachersFree: 136, students: 2800,
      path: 'M 235 372 L 260 368 L 290 370 L 295 385 L 295 410 L 285 420 L 260 422 L 240 418 L 225 405 L 225 388 Z',
      labelX: 262, labelY: 395,
    },
    // 영남권 (경상도)
    {
      id: 'gyeongbuk', name: '경상북도교육청', shortName: '경북', category: '도', schools: 2, teachers: 280, teachersPaid: 6, teachersFree: 274, students: 5800,
      path: 'M 415 285 L 460 270 L 510 270 L 540 290 L 555 305 L 560 335 L 560 380 L 565 425 L 555 460 L 535 480 L 500 488 L 460 488 L 425 480 L 410 465 L 405 425 L 405 380 L 405 335 Z',
      labelX: 485, labelY: 380,
    },
    {
      id: 'daegu', name: '대구광역시교육청', shortName: '대구', category: '광역시', schools: 2, teachers: 240, teachersPaid: 7, teachersFree: 233, students: 4900,
      path: 'M 450 395 L 480 388 L 510 392 L 525 405 L 528 425 L 525 450 L 510 463 L 480 465 L 455 460 L 442 445 L 440 420 Z',
      labelX: 485, labelY: 425,
    },
    {
      id: 'ulsan', name: '울산광역시교육청', shortName: '울산', category: '광역시', schools: 2, teachers: 110, teachersPaid: 3, teachersFree: 107, students: 2200,
      path: 'M 540 462 L 558 458 L 580 462 L 590 478 L 590 505 L 580 525 L 560 530 L 540 525 L 530 510 L 530 485 Z',
      labelX: 560, labelY: 495,
    },
    {
      id: 'busan', name: '부산광역시교육청', shortName: '부산', category: '광역시', schools: 2, teachers: 260, teachersPaid: 8, teachersFree: 252, students: 5400,
      path: 'M 470 528 L 510 522 L 545 525 L 575 532 L 590 545 L 588 575 L 575 595 L 545 605 L 510 608 L 478 600 L 460 580 L 460 555 Z',
      labelX: 525, labelY: 565,
    },
    {
      id: 'gyeongnam', name: '경상남도교육청', shortName: '경남', category: '도', schools: 1, teachers: 210, teachersPaid: 5, teachersFree: 205, students: 4300,
      path: 'M 295 470 L 340 462 L 390 462 L 430 470 L 460 480 L 470 510 L 470 545 L 460 575 L 430 595 L 390 605 L 345 605 L 310 595 L 290 580 L 285 555 L 285 520 Z',
      labelX: 375, labelY: 535,
    },
    // 호남권 (전라도)
    {
      id: 'jeonbuk', name: '전북특별자치도교육청', shortName: '전북', category: '특별자치도', schools: 1, teachers: 165, teachersPaid: 4, teachersFree: 161, students: 3300,
      path: 'M 125 400 L 170 395 L 215 398 L 260 402 L 290 408 L 295 435 L 290 465 L 270 488 L 235 495 L 195 495 L 160 488 L 130 478 L 110 460 L 105 435 L 110 415 Z',
      labelX: 200, labelY: 445,
    },
    {
      id: 'jeonnam', name: '전라남도교육청', shortName: '전남', category: '도', schools: 1, teachers: 190, teachersPaid: 5, teachersFree: 185, students: 3900,
      path: 'M 65 500 L 105 492 L 150 485 L 200 488 L 250 488 L 285 490 L 295 515 L 290 550 L 280 580 L 260 605 L 225 625 L 185 638 L 145 640 L 110 632 L 80 615 L 60 590 L 50 555 L 55 525 Z',
      labelX: 175, labelY: 575,
    },
    {
      id: 'gwangju', name: '광주광역시교육청', shortName: '광주', category: '광역시', schools: 2, teachers: 165, teachersPaid: 4, teachersFree: 161, students: 3300,
      path: 'M 175 535 L 200 528 L 230 532 L 248 545 L 250 565 L 240 580 L 215 588 L 190 585 L 170 575 L 165 555 Z',
      labelX: 207, labelY: 558,
    },
    // 제주도 (남해 별도 섬)
    {
      id: 'jeju', name: '제주특별자치도교육청', shortName: '제주', category: '특별자치도', schools: 1, teachers: 75, teachersPaid: 2, teachersFree: 73, students: 1500,
      path: 'M 125 685 L 160 678 L 200 675 L 240 678 L 270 690 L 280 710 L 270 730 L 240 740 L 200 745 L 160 740 L 125 730 L 105 715 L 105 700 Z',
      labelX: 195, labelY: 712,
    },
  ];

  // ── 가입 현황 — 월별 신규 가입 + 무료→유료 전환 ──
  // 정책: 모든 상태 변경 이력 저장 후 조회 시점·기간 기준으로 카운트. 신규 가입 ≠ 첫 접속.
  // 학교: 운영자가 등급/가입일 자유 변경 가능. 모든 변경 이력 보관
  // 교사: 무→유→무 자유 전환 가능. 이력 기반 카운트
  //   - 신규 가입 추이 [무료]: 조회 기간에 신규 가입한 교사
  //   - 신규 가입 추이 [유료]: 조회 기간에 시작/종료일 겹치는 1회 이상 유료 이력 교사
  //   - 교육청별 가입 현황: 조회 학년도 마지막 날짜 기준 마지막 이력
  //   - 무료→유료 전환 추이: 조회 기간 유료 전환된 교사 (같은 교사 1회만 카운트)
  const monthlySignup = [
    {
      month: '3월',
      schoolsNew: 15,
      teacherPaid: 18, teacherFree: 60,
      schoolsNewNames: [
        '미림마이스터고등학교', '아산고등학교', '서울대사범대부설고등학교', '경기북과학고등학교',
        '대전외국어고등학교', '광주여자고등학교', '부산국제고등학교',
        '제주중앙고등학교', '울산미래학교', '인천예술중학교',
        '강원외국어고등학교', '청주대성고등학교', '전주한일고등학교',
        '순천공업고등학교', '대구과학고등학교',
      ],
    },
    {
      month: '4월',
      schoolsNew: 15,
      teacherPaid: 14, teacherFree: 48,
      schoolsNewNames: [
        '세종과학예술영재학교', '안동고등학교', '창원남고등학교', '서울국제고등학교', '서울외국어고등학교',
        '서울예술고등학교', '경기과학고등학교', '경기여자고등학교', '수원하이텍고등학교',
        '부산과학고등학교', '인천국제고등학교', '대전과학고등학교', '광주과학고등학교',
        '대구외국어고등학교', '울산과학고등학교',
      ],
    },
    {
      // [v2.58] 운영 KPI 카드 ②·③의 "이번 달 +3 / MAU 3"과 정합 — schools.contract_at 단일 source
      month: '5월',
      schoolsNew: 3,
      teacherPaid: 8,
      teacherFree: 4,
      schoolsNewNames: ['천안중앙고등학교', '포항제철고등학교', '춘천교육대학교부설초등학교'],
    },
    { month: '6월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '7월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '8월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '9월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '10월', schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '11월', schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '12월', schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '1월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
    { month: '2월',  schoolsNew: 0, teacherPaid: 0, teacherFree: 0, schoolsNewNames: [] },
  ];

  // [v2.51] 일별 신규 가입 (최근 30일, 5/6 기준) — 평일 peak / 주말 dip
  // 결정론적 mock (i 기반) — 매 렌더 동일 값 보장
  const dailySignup = (() => {
    const arr = [];
    const schoolPool = [
      ...(monthlySignup[0]?.schoolsNewNames || []),
      ...(monthlySignup[1]?.schoolsNewNames || []),
    ];
    let poolIdx = 0;
    const refDate = new Date(2026, 4, 6); // 5월 6일 (수)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(refDate.getDate() - i);
      const dow = d.getDay(); // 0=일, 6=토
      const isWeekend = dow === 0 || dow === 6;
      // 결정론 패턴
      const schools = isWeekend ? 0 : (i % 4 === 0 ? 1 : i % 9 === 0 ? 2 : 0);
      const tPaid = isWeekend ? 0 : (i % 3 === 0 ? 2 : i % 5 === 0 ? 1 : 0);
      const tFree = isWeekend ? (i % 4 === 0 ? 1 : 0) : (i % 2 === 0 ? 3 : 1);
      const names = [];
      for (let k = 0; k < schools; k++) {
        if (schoolPool.length > 0) names.push(schoolPool[poolIdx++ % schoolPool.length]);
      }
      arr.push({
        key: `${d.getMonth() + 1}/${d.getDate()}`, // '5/6'
        sublabel: ['일','월','화','수','목','금','토'][dow],
        schoolsNew: schools,
        teacherPaid: tPaid,
        teacherFree: tFree,
        schoolsNewNames: names,
        isWeekend,
      });
    }
    return arr;
  })();

  // [v2.51] 주별 신규 가입 (최근 12주, ISO 월요일 시작)
  const weeklySignup = (() => {
    const arr = [];
    const schoolPool = [
      ...(monthlySignup[0]?.schoolsNewNames || []),
      ...(monthlySignup[1]?.schoolsNewNames || []),
    ];
    let poolIdx = 0;
    const refDate = new Date(2026, 4, 6);
    const dow = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - ((dow + 6) % 7));
    for (let i = 11; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      // 결정론 패턴 — 최근 주에 가까울수록 가입 ↑
      const schools = i < 8 ? Math.max(0, 4 - Math.floor(i / 2)) : 0;
      const tPaid = i < 8 ? Math.max(0, 6 - i) : 0;
      const tFree = i < 8 ? Math.max(0, 12 - i * 2) : 0;
      const names = [];
      for (let k = 0; k < schools; k++) {
        if (schoolPool.length > 0) names.push(schoolPool[poolIdx++ % schoolPool.length]);
      }
      arr.push({
        key: `${start.getMonth() + 1}/${start.getDate()}~${end.getDate()}`, // '5/4~10'
        sublabel: `${i === 0 ? '이번 주' : i + '주 전'}`,
        schoolsNew: schools,
        teacherPaid: tPaid,
        teacherFree: tFree,
        schoolsNewNames: names,
      });
    }
    return arr;
  })();

  // 월별 무료→유료 전환 인원 + 학교 명단 (교사만)
  const monthlyConversion = [
    { month: '3월',  teacher: 0, schools: [] },
    { month: '4월',  teacher: 5, schools: [
      { name: '서울예술중', region: '서울 중구',   teachers: 2 },
      { name: '신촌고',     region: '서울 마포구', teachers: 2 },
      { name: '대구남부중', region: '대구 남구',   teachers: 1 },
    ]},
    { month: '5월',  teacher: 0, schools: [] },
    { month: '6월',  teacher: 0, schools: [] },
    { month: '7월',  teacher: 0, schools: [] },
    { month: '8월',  teacher: 0, schools: [] },
    { month: '9월',  teacher: 0, schools: [] },
    { month: '10월', teacher: 0, schools: [] },
    { month: '11월', teacher: 0, schools: [] },
    { month: '12월', teacher: 0, schools: [] },
    { month: '1월',  teacher: 0, schools: [] },
    { month: '2월',  teacher: 0, schools: [] },
  ];

  // 가입·전환 KPI — 교사 단위 (학교 정보는 부가 컨텍스트로 표시)
  // [정책] 학교: 무료 개념 없음. 가입 = 유료. 교사: 학교 종속, B2C 차단. 모든 상태 변경 이력 영구 보존
  const conversionKpi = {
    // 교사 단위 — 조회 기간 무→유 전환 (같은 교사 1회만 카운트)
    teacher: {
      totalFreeSignups: 108,     // 누적 무료 가입 (조회 기간 신규 가입한 전체 교사)
      totalConverted: 5,         // 조회 기간 유료 전환 교사 (같은 교사 1회만)
      conversionRate: 4.6,       // 누적 전환율 = totalConverted / totalFreeSignups × 100
      avgDaysToConvert: 18.4,    // 평균 전환 소요 일수
      // 학교 수 부가 정보 — 교사 수가 어느 정도 학교에 분포되어 있는지 파악용
      convertedSchools: 3,       // totalConverted 교사가 출신인 고유 학교 수
      freeSignupSchools: 45,     // totalFreeSignups 교사가 출신인 고유 학교 수
      // 「누적 전환율」 카드의 「N개교」 클릭 시 popover에 노출
      convertedSchoolList: [
        { name: '서울예술중', region: '서울 중구',   convertedAt: '2025.04.02', teachers: 2 },
        { name: '신촌고',     region: '서울 마포구', convertedAt: '2025.04.15', teachers: 2 },
        { name: '대구남부중', region: '대구 남구',   convertedAt: '2025.04.20', teachers: 1 },
      ],
    },
  };

  // ── 교과별 AI 채점 활용 mock ──
  // [v4.3] 평가유형 sub-filter 적용 — trend / levelSubject / aiVsTeacher 모두 {all|grade|process} 분리
  // 비율 (등급평가 ~70% / 과정 분석 ~30%)로 split
  const splitByEvalType = (val) => ({ grade: Math.round(val * 0.7), process: Math.round(val * 0.3) });
  const subjectAiData = {
    months: ['3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'],
    subjectColors: { 국어: '#2A75F3', 수학: '#F59E0B', 영어: '#10B981', 사회: '#8B5CF6', 과학: '#EF4444' },
    // [v4.3] 월별 추세 — 교사 등급 × 평가유형 2D sub-filter
    trend: (() => {
      const baseAll = [
        { month: '3월',  국어: 8,  수학: 5,  영어: 3,  사회: 1, 과학: 1 },
        { month: '4월',  국어: 30, 수학: 22, 영어: 15, 사회: 9, 과학: 6 },
      ];
      const basePaid = [
        { month: '3월',  국어: 5,  수학: 4,  영어: 2,  사회: 1, 과학: 1 },
        { month: '4월',  국어: 18, 수학: 14, 영어: 10, 사회: 6, 과학: 4 },
      ];
      const baseFree = [
        { month: '3월',  국어: 3,  수학: 1,  영어: 1,  사회: 0, 과학: 0 },
        { month: '4월',  국어: 12, 수학: 8,  영어: 5,  사회: 3, 과학: 2 },
      ];
      const padZeros = (active) => {
        const zeroMonths = ['5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'];
        return [...active, ...zeroMonths.map(m => ({ month: m, 국어: 0, 수학: 0, 영어: 0, 사회: 0, 과학: 0 }))];
      };
      const splitMonth = (m, type) => ({
        month: m.month,
        국어: type === 'all' ? m.국어 : splitByEvalType(m.국어)[type],
        수학: type === 'all' ? m.수학 : splitByEvalType(m.수학)[type],
        영어: type === 'all' ? m.영어 : splitByEvalType(m.영어)[type],
        사회: type === 'all' ? m.사회 : splitByEvalType(m.사회)[type],
        과학: type === 'all' ? m.과학 : splitByEvalType(m.과학)[type],
      });
      const buildTier = (base) => ({
        all:     padZeros(base.map(m => splitMonth(m, 'all'))),
        grade:   padZeros(base.map(m => splitMonth(m, 'grade'))),
        process: padZeros(base.map(m => splitMonth(m, 'process'))),
      });
      return {
        all:  buildTier(baseAll),
        paid: buildTier(basePaid),
        free: buildTier(baseFree),
      };
    })(),
    // [v4.3] 학교급 × 교과 매트릭스 — 채점 건수 (활용률 % 폐기) + 평가유형 sub-filter
    levelSubject: {
      levels: ['초등학교', '중학교', '고등학교'],
      subjects: ['국어', '수학', '영어', '사회', '과학'],
      grid: (() => {
        // 채점 건수 (단위: 건)
        const allGrid = [
          [550, 350, 200, 80,  50],
          [420, 380, 250, 120, 80],
          [350, 280, 180, 120, 70],
        ];
        const split = (g, type) => g.map(row => row.map(v => type === 'all' ? v : splitByEvalType(v)[type]));
        return {
          all:     split(allGrid, 'all'),
          grade:   split(allGrid, 'grade'),
          process: split(allGrid, 'process'),
        };
      })(),
    },
    // [v4.3] AI vs 교사 재검토 — 평가유형 sub-filter 적용. 분자/분모 정의는 PRD §3 참조
    aiVsTeacher: {
      all: [
        { subject: '국어', aiOnly: 62, teacherReview: 38 },
        { subject: '수학', aiOnly: 78, teacherReview: 22 },
        { subject: '영어', aiOnly: 70, teacherReview: 30 },
        { subject: '사회', aiOnly: 55, teacherReview: 45 },
        { subject: '과학', aiOnly: 65, teacherReview: 35 },
      ],
      grade: [
        // 등급평가는 명확한 정답 채점이라 AI 단독 채택률 ↑
        { subject: '국어', aiOnly: 68, teacherReview: 32 },
        { subject: '수학', aiOnly: 85, teacherReview: 15 },
        { subject: '영어', aiOnly: 75, teacherReview: 25 },
        { subject: '사회', aiOnly: 60, teacherReview: 40 },
        { subject: '과학', aiOnly: 72, teacherReview: 28 },
      ],
      process: [
        // 과정 분석는 주관적 해석 비중 ↑ → 교사 재검토율 ↑
        { subject: '국어', aiOnly: 50, teacherReview: 50 },
        { subject: '수학', aiOnly: 65, teacherReview: 35 },
        { subject: '영어', aiOnly: 58, teacherReview: 42 },
        { subject: '사회', aiOnly: 45, teacherReview: 55 },
        { subject: '과학', aiOnly: 52, teacherReview: 48 },
      ],
    },
  };

  // 월별 데이터에 합계·모델 분류 파생값 추가 (문장다듬기=Gemini 2.0 / OCR+채점=Gemini 3.0 Flash)
  const tokenMonthly = tokenUsage.monthly.map(m => ({
    ...m,
    value: m.input + m.output,
    gemini20: m.polish,
    gemini30Flash: m.ocr + m.grading,
  }));

  // 합계 (서비스 기간 전체)
  const tokenTotals = tokenMonthly.reduce(
    (acc, m) => ({
      input: acc.input + m.input,
      output: acc.output + m.output,
      polish: acc.polish + m.polish,
      ocr: acc.ocr + m.ocr,
      grading: acc.grading + m.grading,
    }),
    { input: 0, output: 0, polish: 0, ocr: 0, grading: 0 }
  );
  tokenTotals.gemini20 = tokenTotals.polish;
  tokenTotals.gemini30Flash = tokenTotals.ocr + tokenTotals.grading;

  // 누적 비용(KRW): (inputM × $0.50 + outputM × $3.00) × 환율
  const tokenCostUSD =
    (tokenTotals.input / 1_000_000) * tokenUsage.pricing.input +
    (tokenTotals.output / 1_000_000) * tokenUsage.pricing.output;
  const tokenCostKRW = Math.round(tokenCostUSD * tokenUsage.pricing.krwRate);

  // 비용 계산 헬퍼
  const inputCostKRW = (inputTokens) =>
    Math.round((inputTokens / 1_000_000) * tokenUsage.pricing.input * tokenUsage.pricing.krwRate);
  const outputCostKRW = (outputTokens) =>
    Math.round((outputTokens / 1_000_000) * tokenUsage.pricing.output * tokenUsage.pricing.krwRate);
  const totalCostKRW = (inputTokens, outputTokens) =>
    inputCostKRW(inputTokens) + outputCostKRW(outputTokens);

  // 카테고리별 분해(학교/교과/기능/모델)에는 입출력 분리 정보가 없으므로
  // 전체 평균 비율을 사용해 추정 비용 계산
  const tokenAllSum = tokenTotals.input + tokenTotals.output;
  const globalInputRatio = tokenAllSum > 0 ? tokenTotals.input / tokenAllSum : 0.7;
  const globalOutputRatio = tokenAllSum > 0 ? tokenTotals.output / tokenAllSum : 0.3;
  const estimateCostKRW = (tokens) =>
    totalCostKRW(tokens * globalInputRatio, tokens * globalOutputRatio);

  // [v3.12] Tooltip 통일 정책 — 모든 탭에서 사용량을 입/출 분리 표시
  // 월별(정확): row의 input/output 직접 사용
  const tooltipMonthExact = (m) => (
    `${m.month}\n` +
    `사용량 ${formatTokenShort(m.value)} (입 ${formatTokenShort(m.input)} / 출 ${formatTokenShort(m.output)})\n` +
    `비용 ${totalCostKRW(m.input, m.output).toLocaleString()}원`
  );

  // 카테고리(분리 데이터 없음): globalInputRatio로 추정 분배. production에선 api_calls를 카테고리별 GROUP BY 후 직접 input/output 합산
  const tooltipEstimate = (label, tokens) => {
    const estIn = tokens * globalInputRatio;
    const estOut = tokens * globalOutputRatio;
    return (
      `${label}\n` +
      `사용량 ${formatTokenShort(tokens)} (입 ${formatTokenShort(estIn)} / 출 ${formatTokenShort(estOut)})\n` +
      `비용 ${estimateCostKRW(tokens).toLocaleString()}원`
    );
  };

  // 도넛(라벨 + 비중% 포함)
  const tooltipDonut = (label, tokens, percent) => {
    const estIn = tokens * globalInputRatio;
    const estOut = tokens * globalOutputRatio;
    return (
      `${label} (${percent.toFixed(1)}%)\n` +
      `사용량 ${formatTokenShort(tokens)} (입 ${formatTokenShort(estIn)} / 출 ${formatTokenShort(estOut)})\n` +
      `비용 ${estimateCostKRW(tokens).toLocaleString()}원`
    );
  };

  // Y축 최고값을 자릿수 magnitude로 올림 → 자연스러운 10단계 라벨
  const niceCeiling = (n) => {
    if (n <= 0) return 1_000_000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
    return Math.ceil(n / magnitude) * magnitude;
  };

  const formatTokenShort = (n) => {
    if (n === 0) return '0';
    if (n < 1_000_000) return Math.round(n / 1000) + 'K';
    const m = n / 1_000_000;
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M';
  };

  // SVG 차트 공통 좌표
  const tokenChartW = 1120;
  const tokenChartH = 270;
  const tokenChartLeft = 60;
  const tokenChartTop = 20;
  const tokenChartBottom = 290;

  // [Tab 1: 월별 추세] — 라인 차트 좌표
  const tokenLineMax = niceCeiling(Math.max(...tokenMonthly.map(m => m.value)));
  const tokenLineYStep = tokenLineMax / 10;
  const tokenLineYLabels = Array.from({ length: 11 }, (_, i) => tokenLineMax - tokenLineYStep * i);
  const tokenLinePoints = tokenMonthly.map((m, i) => ({
    x: tokenChartLeft + (i * tokenChartW / (tokenMonthly.length - 1)),
    y: tokenChartBottom - (m.value / tokenLineMax) * tokenChartH,
  }));
  const tokenLinePath = tokenLinePoints.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
  const tokenAreaPath = tokenLinePath + ` L ${tokenLinePoints[tokenLinePoints.length - 1].x},${tokenChartBottom} L ${tokenLinePoints[0].x},${tokenChartBottom} Z`;

  // [Tab 4: 기능별 도넛] — 4 세그먼트 (v4.4: 모델별 폐기, 기능별로 교체)
  // AI 요청 발생 패턴:
  //  - 과제 생성 시: 문장다듬기 1회
  //  - 채점 (학생당): 등급평가 초기 + 재채점 = 최대 2회
  //  - 채점 (학생당): 과정 분석 1회 추가
  // 즉 한 과제 = 문장다듬기 1 + (채점 1~2 + 과정 분석 1) × 학생 수
  const _totalForFeature = tokenTotals.polish + tokenTotals.ocr + tokenTotals.grading;
  const tokenFeatureData = [
    { name: '문장다듬기', value: Math.round(_totalForFeature * 0.20), color: '#8B5CF6' },  // 과제 생성 시 1회
    { name: '채점',       value: Math.round(_totalForFeature * 0.45), color: '#2A75F3' },  // 학생당 초기 채점
    { name: '재채점',     value: Math.round(_totalForFeature * 0.15), color: '#F59E0B' },  // 학생당 재채점 (선택)
    { name: '과정 분석',   value: Math.round(_totalForFeature * 0.20), color: '#10B981' },  // 학생당 과정 분석 1회
  ];

  // [Tab 6: 교과별 도넛] data 그대로 사용
  // 도넛 helper: 데이터 → SVG arcs (cx=170, cy=140, r=80)
  const buildDonut = (data, cx, cy, r, strokeWidth = 24) => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let cumulativeAngle = -Math.PI / 2; // 12시 방향 시작
    return data.map((d) => {
      const angle = (d.value / total) * Math.PI * 2;
      const startA = cumulativeAngle;
      const endA = cumulativeAngle + angle;
      const x1 = cx + r * Math.cos(startA);
      const y1 = cy + r * Math.sin(startA);
      const x2 = cx + r * Math.cos(endA);
      const y2 = cy + r * Math.sin(endA);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
      cumulativeAngle = endA;
      return {
        path,
        color: d.color,
        name: d.name,
        value: d.value,
        percent: (d.value / total) * 100,
      };
    });
  };

  return (
    <div className="dashboard-content" style={{ padding: '2rem', background: '#F4F7FB', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900 }}>대시보드</h1>
      </div>

      {/* Main Banner Card */}
      <div style={{
        background: 'linear-gradient(135deg, #4299E1 0%, #3182CE 100%)',
        borderRadius: '24px',
        padding: '2.5rem',
        color: 'white',
        marginBottom: '1.5rem',
        position: 'relative',
        boxShadow: '0 10px 25px rgba(49, 130, 206, 0.2)'
      }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>2026년 4월 30일</h2>
        <p style={{ fontSize: 'var(--neo-font-size-lg)', opacity: 0.9, marginBottom: '2rem' }}> 회원 가입, 실시간 접속률, AI토큰 사용량 등을 한눈에 확인하세요.</p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* [v3.9] 학년도 단일 글로벌 컨트롤 — 모든 분석 섹션이 자동 sync */}
            <span style={{ fontSize: 'var(--neo-font-size-sm)' }}>학년도 : </span>
            <select
              value={globalYear}
              onChange={(e) => { setGlobalYear(e.target.value); setSignupHoverIdx(null); setSignupWeekOffset(0); }}
              style={{ background: 'none', border: 'none', color: 'white', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
            >
              <option value="2026">2026 학년도 (26.03 ~ 27.02)</option>
              <option value="2025">2025 학년도 (25.03 ~ 26.02)</option>
              <option value="2024">2024 학년도 (24.03 ~ 25.02)</option>
            </select>
          </div>
          {/* [v4.16] 활용 가이드 버튼 — 메뉴별 분석·해석 가이드 모달 */}
          <button onClick={() => setGuideOpen(true)}
            style={{ background: 'rgba(255,255,255,0.95)', color: '#1D4ED8', border: 'none', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(15,23,42,0.18)' }}>
            <span>📖</span> 활용 가이드
          </button>
        </div>

        {/* 우측 상단: 승인 대기 학교/교사 카드 */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '12px' }}>
          {[
            { label: '승인 대기 학교', sub: '유효 회원 신청 대기', value: 0, unit: '개', target: 'schoolMgmt' },
            { label: '승인 대기 교사', sub: '유료 전환 신청 대기', value: 0, unit: '개', target: 'teacherMgmt' },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.95)',
                color: '#1E2225',
                borderRadius: '14px',
                padding: '14px 18px',
                minWidth: '210px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: '0 6px 18px -4px rgba(15,23,42,0.18)',
              }}
              title={`${c.label} 상세보기`}
            >
              <div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700, marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{c.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225' }}>{c.value}</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600 }}>{c.unit}</span>
                <span style={{ color: '#94A3B8', marginLeft: '4px', fontSize: 'var(--neo-font-size-base)' }}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* [v2.49] 운영 KPI — 실시간 접속자 / 계약자 / 회원가입 DAU·WAU·MAU  */}
      {/* 회원=교사(유료/무료), 계약자=학교(유료 단일 등급), 실시간=접속 중인 교사 */}
      {/* ════════════════════════════════════════════════════════════ */}
      {(() => {
        // mock 운영 지표 — 숫자 중심 (그래프 제거, v2.52)
        const realtime = { total: 184, paid: 142, free: 42 };       // 현재 접속 중 교사
        // [v2.60] 활성 계약 학교 = accessData.schools.length 단일 source (33 = 3월 15 + 4월 15 + 5월 3)
        const contracts = { total: 33, thisMonth: 3, pending: 0 };
        // 기준일자 (mock today = 2026-05-06 수)
        const todayDate = new Date(2026, 4, 6);
        const todayDow = todayDate.getDay(); // 0=일, 3=수
        const weekStart = new Date(todayDate);
        weekStart.setDate(todayDate.getDate() - ((todayDow + 6) % 7)); // 월요일 (5/4)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // 일요일 (5/10)
        const fmtMD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
        const fmtFull = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // 회원가입 = 신규 계약 학교 (학교 단위, paid 단일)
        const schoolSignup = {
          DAU: { value: 0, desc: '오늘 신규 계약', period: fmtFull(todayDate),                                  short: '오늘' },
          WAU: { value: 2, desc: '이번 주 신규 계약', period: `${fmtMD(weekStart)} ~ ${fmtMD(weekEnd)} (월~일)`, short: '이번 주' },
          MAU: { value: contracts.thisMonth, desc: '이번 달 신규 계약', period: `${todayDate.getFullYear()}년 ${todayDate.getMonth() + 1}월`, short: '이번 달' },
        };

        return (
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0, color: '#1E2225' }}>📊 운영 KPI</h3>
                <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', margin: '2px 0 0' }}>
                  실시간 접속자 · 계약 학교 · 신규 계약 학교 활동성 — DAU/WAU/MAU
                </p>
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                최근 갱신 · <span style={{ color: '#475569', fontWeight: 700 }}>1분 전</span><span style={{ color: '#CBD5E1' }}>(5분 주기)</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {/* ① 실시간 접속자 — 숫자 중심 */}
              <div style={{ background: 'white', padding: '20px 22px', borderRadius: '16px', boxShadow: 'var(--shadow)', borderTop: '4px solid #10B981' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>🟢 실시간 접속자</div>
                  <span title="최근 5분 이내 활동 교사 (last-activity 기준) — 산출식: last_action_at >= now - 5min · 시간대별 트래픽 패턴 파악 목적이라 5분 windowing이 충분하며 활동 로그를 재활용해 별도 polling 부하 0" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#10B981', background: '#D1FAE5', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 6, height: 6, background: '#10B981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.4s infinite' }}></span>LIVE
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#10B981', lineHeight: 1 }}>{realtime.total.toLocaleString()}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#475569', fontWeight: 700 }}>명</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '8px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#FB923C', fontWeight: 700, marginBottom: '2px' }}>💎 유료</div>
                    <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#FB923C', lineHeight: 1.1 }}>{realtime.paid}<span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: '3px' }}>명</span></div>
                  </div>
                  <div style={{ padding: '8px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', fontWeight: 700, marginBottom: '2px' }}>● 무료</div>
                    <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#2A75F3', lineHeight: 1.1 }}>{realtime.free}<span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: '3px' }}>명</span></div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>* 최근 5분 이내 활동 교사 — last-activity 기준 (last_action_at ≥ now − 5min)</div>
              </div>

              {/* ② 계약자 — 숫자 중심 */}
              <div style={{ background: 'white', padding: '20px 22px', borderRadius: '16px', boxShadow: 'var(--shadow)', borderTop: '4px solid #2A75F3' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>🏫 계약자 (학교)</div>
                  <span title="계약 단위는 학교. 학교는 유료 단일 등급이며 회원(교사)과 별개 개념입니다." style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, cursor: 'help' }}>유료 단일</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#2A75F3', lineHeight: 1 }}>{contracts.total.toLocaleString()}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#475569', fontWeight: 700 }}>개교</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '8px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#10B981', fontWeight: 700, marginBottom: '2px' }}>이번 달 신규</div>
                    <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#10B981', lineHeight: 1.1 }}>+{contracts.thisMonth}<span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: '3px' }}>개교</span></div>
                  </div>
                  <div style={{ padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '2px' }}>승인 대기</div>
                    <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: contracts.pending > 0 ? '#F59E0B' : '#94A3B8', lineHeight: 1.1 }}>{contracts.pending}<span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: '3px' }}>건</span></div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>* 학교 단위 계약 — 가입 시점부터 유료</div>
              </div>

              {/* ③ 회원가입 (학교 단위) DAU/WAU/MAU */}
              <div style={{ background: 'white', padding: '20px 22px', borderRadius: '16px', boxShadow: 'var(--shadow)', borderTop: '4px solid #FB923C' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>👥 회원가입 (학교)</div>
                  <span title="신규 계약 학교 단위 — 학교는 유료 단일 등급" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#FB923C', background: '#FFF7ED', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, cursor: 'help' }}>유료 단일</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                  {[
                    { label: 'DAU', v: schoolSignup.DAU, color: '#94A3B8', bg: '#F8FAFC',  border: '#E2E8F0' },
                    { label: 'WAU', v: schoolSignup.WAU, color: '#FB923C', bg: '#FFF7ED',  border: '#FED7AA' },
                    { label: 'MAU', v: schoolSignup.MAU, color: '#FB923C', bg: '#FFFBEB',  border: '#FED7AA' },
                  ].map((row, i) => (
                    <div key={i} title={`${row.v.desc} · ${row.v.period}`} style={{ padding: '10px 8px', background: row.bg, border: `1px solid ${row.border}`, borderRadius: '10px', textAlign: 'center', cursor: 'help' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 800, marginBottom: '2px' }}>{row.label}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>{row.v.short}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: row.color, lineHeight: 1 }}>{row.v.value}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginTop: '3px' }}>개교</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginTop: '4px', borderTop: '1px dashed #E2E8F0', paddingTop: '3px' }}>{row.v.period}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>* 신규 계약 학교 — 기준 일자: {fmtFull(todayDate)} ({['일','월','화','수','목','금','토'][todayDow]})</div>
              </div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          </section>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Quick Nav — 섹션 바로가기 (sticky)                              */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'sticky',
        top: '-2rem',
        zIndex: 50,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid #94A3B8',
        borderRadius: '14px',
        padding: '8px 12px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        boxShadow: '0 6px 18px -8px rgba(15,23,42,0.18)',
      }}>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 700, marginRight: '4px' }}>바로가기</span>
        {[
          { id: 'sec-region',      label: '🗺️ 교육청별 가입' },
          { id: 'sec-notice',      label: '📢 공지/Q&A' },
          { id: 'sec-token',       label: '💰 AI 토큰 사용량' },
          { id: 'sec-access',      label: '👨‍🏫 교사 접속률' },
          { id: 'sec-school-task', label: '📂 학교급별 활동' },
          { id: 'sec-subject-ai',  label: '📚 교과별 AI 채점' },
        ].map(nav => (
          <button
            key={nav.id}
            onClick={() => {
              const el = document.getElementById(nav.id);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              background: 'white',
              color: '#1E2225',
              fontSize: 'var(--neo-font-size-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EFF6FF';
              e.currentTarget.style.borderColor = '#2A75F3';
              e.currentTarget.style.color = '#2A75F3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.color = '#1E2225';
            }}
          >
            {nav.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* 교육청별 가입 현황 — Stats Cards 자리 대체                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="sec-region" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginBottom: '1.5rem', scrollMarginTop: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
          <div>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>
              교육청별 가입 현황
              <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#FB923C', background: '#FFF7ED', border: '1px solid #FED7AA', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, verticalAlign: 'middle' }}>{regionYear} 학년도</span>
            </h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>전국 17개 시·도교육청 단위로 학년도별 학교/등록 교사/등록 학생 분포를 한눈에 확인합니다.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {/* [v3.9] 섹션별 학년도 셀렉트 폐기 — 헤더 글로벌 학년도 컨트롤로 통일. 정보는 헤딩의 chip으로 노출 */}
            <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '4px', gap: '2px' }}>
              {[
                { id: 'schools',  label: '🏫 학교', unit: '개' },
                { id: 'teachers', label: '👨‍🏫 교사', unit: '명' },
                { id: 'students', label: '🎓 학생', unit: '명' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMapMetric(m.id)}
                  style={{
                    padding: '8px 16px', border: 'none', borderRadius: '8px',
                    background: mapMetric === m.id ? 'white' : 'transparent',
                    color: mapMetric === m.id ? '#2A75F3' : '#64748B',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: mapMetric === m.id ? 800 : 700,
                    cursor: 'pointer',
                    boxShadow: mapMetric === m.id ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >{m.label}</button>
              ))}
            </div>
            {/* 교사 메트릭 sub-filter — 조회 학년도 마지막 날짜 기준 마지막 이력 */}
            {mapMetric === 'teachers' && (
              <div
                style={{ display: 'inline-flex', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '3px', gap: '2px' }}
                title="조회 학년도 마지막 날짜에 시작/종료일 겹치는 이력 중 가장 마지막 이력 기준. 무→유→무는 무료로 카운트"
              >
                {[
                  { id: 'all',  label: '전체' },
                  { id: 'paid', label: '💎 유료' },
                  { id: 'free', label: '무료' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPaidFilter(f.id)}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: '6px',
                      background: paidFilter === f.id ? '#FB923C' : 'transparent',
                      color: paidFilter === f.id ? 'white' : '#9A3412',
                      fontSize: 'var(--neo-font-size-sm)',
                      fontWeight: paidFilter === f.id ? 800 : 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{f.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {(() => {
          // [v2.53] 학년도별 multiplier — 2026=현재(1.0), 2025=종료된 학년도(0.85), 2024=오래된 학년도(0.6)
          const yearMul = regionYear === '2024' ? 0.6 : regionYear === '2025' ? 0.85 : 1.0;
          // 메트릭별 값 추출 — 학교는 무료 등급 없음 (sub-filter는 교사에만 적용)
          const getValue = (r) => {
            const base =
              mapMetric === 'schools' ? r.schools :
              mapMetric === 'teachers'
                ? (paidFilter === 'paid' ? r.teachersPaid : paidFilter === 'free' ? r.teachersFree : r.teachers)
                : r[mapMetric];
            return Math.round(base * yearMul);
          };
          const getMetricLabel = () => {
            if (mapMetric === 'schools') return { label: '학교', unit: '개', accent: '#2A75F3' };
            if (mapMetric === 'teachers') {
              if (paidFilter === 'paid') return { label: '유료 교사', unit: '명', accent: '#FB923C' };
              if (paidFilter === 'free') return { label: '무료 교사', unit: '명', accent: '#2A75F3' };
              return { label: '교사', unit: '명', accent: '#2A75F3' };
            }
            return { label: '학생', unit: '명', accent: '#2A75F3' };
          };
          const cur = getMetricLabel();
          const values = regionMapData.map(getValue);
          const max = Math.max(...values, 1);
          const total = values.reduce((s, v) => s + v, 0);
          // Top 3 — 값이 0인 항목은 제외 (3위가 없는 경우 빈 슬롯 처리)
          const top3Source = [...regionMapData]
            .map(r => ({ ...r, _v: getValue(r) }))
            .filter(r => r._v > 0)
            .sort((a, b) => b._v - a._v);
          const top3 = [0, 1, 2].map(i => top3Source[i] || null);
          // 분포 강도 — 5단계 밴드 (max 대비 %)
          // v=0 → 회색, 0<v≤20% → α0.18, ~40% → α0.36, ~60% → α0.54, ~80% → α0.72, ~100% → α1.00
          const intensityBands = [
            { maxRatio: 0.20, alpha: 0.18, label: '~20%' },
            { maxRatio: 0.40, alpha: 0.36, label: '~40%' },
            { maxRatio: 0.60, alpha: 0.54, label: '~60%' },
            { maxRatio: 0.80, alpha: 0.72, label: '~80%' },
            { maxRatio: 1.01, alpha: 1.00, label: '~100%' },
          ];
          const colorScale = (v) => {
            if (v === 0) return '#F1F5F9';
            const intensity = v / max; // 0~1
            const band = intensityBands.find(b => intensity <= b.maxRatio) || intensityBands[intensityBands.length - 1];
            const rgb = cur.accent === '#FB923C' ? '251, 146, 60' : '42, 117, 243';
            return `rgba(${rgb}, ${band.alpha})`;
          };
          const small = ['seoul', 'incheon', 'sejong', 'daejeon', 'daegu', 'ulsan', 'busan', 'gwangju'];
          const sorted = [...regionMapData].sort((a, b) => {
            const aSmall = small.includes(a.id) ? 1 : 0;
            const bSmall = small.includes(b.id) ? 1 : 0;
            return aSmall - bSmall;
          });
          return (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1행 — 전국 누적 + Top 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '14px' }}>
                {/* 전국 누적 */}
                <div style={{ background: cur.accent === '#FB923C' ? 'linear-gradient(135deg, #FB923C, #EA580C)' : 'linear-gradient(135deg, #2A75F3, #1D4ED8)', borderRadius: '14px', padding: '1.5rem 1.25rem', color: 'white' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', opacity: 0.9, fontWeight: 700, marginBottom: '6px' }}>전국 누적 {cur.label}</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1.1 }}>
                    {total.toLocaleString()}<span style={{ fontSize: 'var(--neo-font-size-lg)', marginLeft: '4px', opacity: 0.85 }}>{cur.unit}</span>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', opacity: 0.8, marginTop: '6px' }}>전국 17개 시·도교육청 합계</div>
                </div>
                {/* Top 3 — null 슬롯은 "데이터 없음" 플레이스홀더 */}
                {top3.map((r, i) => {
                  const medalColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#CD7F32';
                  const medalLabel = i === 0 ? '🥇 1위' : i === 1 ? '🥈 2위' : '🥉 3위';
                  if (!r) {
                    return (
                      <div key={`empty-${i}`} style={{
                        background: '#FAFBFC',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '14px',
                        padding: '1.5rem 1.25rem',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                      }}>
                        <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: medalColor, opacity: 0.5 }}>
                          {medalLabel}
                        </div>
                        <div style={{ fontSize: '1.6rem', marginBottom: '4px', opacity: 0.4 }}>—</div>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 700 }}>데이터 없음</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#CBD5E1', marginTop: '4px' }}>{cur.label} 가입 지역 부족</div>
                      </div>
                    );
                  }
                  const pct = total > 0 ? (r._v / total * 100).toFixed(1) : 0;
                  return (
                    <div key={r.id} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.5rem 1.25rem', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: medalColor }}>
                        {medalLabel}
                      </div>
                      <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{r.name}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225', lineHeight: 1.2 }}>
                        {r._v.toLocaleString()}<span style={{ fontSize: 'var(--neo-font-size-sm)', marginLeft: '3px', color: '#64748B', fontWeight: 600 }}>{cur.unit}</span>
                      </div>
                      <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginTop: '4px' }}>전체의 {pct}%</div>
                    </div>
                  );
                })}
              </div>

              {/* 2행 — 전체 17개 교육청 그리드 */}
              <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', fontWeight: 800 }}>{cur.label} 보유 교육청 ({regionMapData.filter(r => getValue(r) > 0).length}개) — {cur.label} 가입현황</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }} title="max 대비 % 구간 (max는 17개 교육청 중 최대값)">
                    <span style={{ fontWeight: 700 }}>분포 강도 (max 대비)</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 10, background: '#F1F5F9', borderRadius: 2, border: '1px solid #E2E8F0' }}></span>
                      <span style={{ fontSize: 'var(--neo-font-size-xs)' }}>0</span>
                    </span>
                    {intensityBands.map((b, i) => {
                      const rgb = cur.accent === '#FB923C' ? '251, 146, 60' : '42, 117, 243';
                      const lo = i === 0 ? 1 : Math.round(intensityBands[i - 1].maxRatio * 100);
                      const hi = Math.round(Math.min(b.maxRatio, 1) * 100);
                      return (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{ display: 'inline-block', width: 16, height: 10, background: `rgba(${rgb}, ${b.alpha})`, borderRadius: 2 }}></span>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)' }}>{lo}–{hi}%</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {/* [v2.62] 17개 시·도 카드 위치 고정 — 교육청 정식 명칭 가나다순(Korean Collator).
                      메트릭 토글 시 위치는 그대로, 카드 안 숫자·비중%·색상 강도만 변경. 같은 교육청을 항상 같은 위치에서 찾을 수 있도록 학습 안정성 확보.
                      필터는 Top 3와 통일 (현재 메트릭 값 > 0). 정렬·강조 역할은 Top 3 메달 카드가 담당. */}
                  {[...regionMapData]
                    .filter(r => getValue(r) > 0)
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                    .map((r, idx) => {
                    const v = getValue(r);
                    const pct = total > 0 ? (v / total * 100) : 0;
                    // 카드 배경 = 분포 강도 밴드 색상 / intensity ≥ 0.6 (α≥0.54) 일 때 흰 텍스트로 가독성 확보
                    const bg = colorScale(v);
                    const intensity = max > 0 ? v / max : 0;
                    const isDark = v > 0 && intensity > 0.40; // α 0.54 이상 → 어두운 배경
                    const textPrimary = isDark ? 'white' : '#1E2225';
                    const textSecondary = isDark ? 'rgba(255,255,255,0.78)' : '#64748B';
                    const textMuted = isDark ? 'rgba(255,255,255,0.6)' : '#94A3B8';
                    // 해당 교육청의 등록 학교 목록 (현재는 accessData.schools 기반 — production은 별도 학교 등록 API)
                    const officeSchools = accessData.schools.filter(s => s.office === r.id);
                    const isHovered = hoveredOffice === r.id;
                    return (
                      <div
                        key={r.id}
                        title={r.name}
                        onMouseEnter={() => setHoveredOffice(r.id)}
                        onMouseLeave={() => setHoveredOffice(null)}
                        style={{
                          background: bg,
                          border: v === 0 ? '1px dashed #CBD5E1' : '1px solid rgba(15,23,42,0.06)',
                          borderRadius: '10px',
                          padding: '14px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          position: 'relative',
                          minHeight: '108px',
                          cursor: 'pointer',
                          transition: 'transform 0.12s, box-shadow 0.12s',
                          transform: isHovered ? 'translateY(-2px)' : 'none',
                          boxShadow: isHovered ? '0 8px 20px -6px rgba(15,23,42,0.18)' : 'none',
                          zIndex: isHovered ? 20 : 1,
                        }}
                      >
                        {/* 헤더: 순위 + 정식 교육청명 (자동 줄바꿈 최대 2줄) */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ color: textMuted, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, lineHeight: '1.3', flexShrink: 0 }}>{idx + 1}</span>
                          <span style={{
                            fontSize: 'var(--neo-font-size-sm)',
                            color: textPrimary,
                            fontWeight: 800,
                            lineHeight: '1.2',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'keep-all',
                            flex: 1,
                          }}>{r.name}</span>
                        </div>
                        {/* 메인: 큰 % (좌) + 값/단위 (우, 보조) */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px', marginTop: 'auto' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                            <span style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: textPrimary, lineHeight: 1, letterSpacing: '-0.02em' }}>
                              {pct.toFixed(1)}
                            </span>
                            <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: textSecondary }}>%</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: textSecondary, fontWeight: 700 }}>
                              {v.toLocaleString()}<span style={{ fontSize: 'var(--neo-font-size-xs)', marginLeft: '1px', opacity: 0.8 }}>{cur.unit}</span>
                            </span>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: textMuted }}>전국 대비</span>
                          </div>
                        </div>

                        {/* Hover popover — 등록 학교 목록 */}
                        {isHovered && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            boxShadow: '0 10px 24px -6px rgba(15,23,42,0.22)',
                            padding: '10px 12px',
                            zIndex: 30,
                            cursor: 'default',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>{r.name}</span>
                              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>등록 {officeSchools.length}개교</span>
                            </div>
                            {officeSchools.length === 0 ? (
                              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', padding: '6px 0' }}>
                                등록 학교 정보 없음
                              </div>
                            ) : (
                              <ul style={{
                                listStyle: 'none',
                                margin: 0, padding: 0,
                                maxHeight: '180px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              }}>
                                {officeSchools.map(s => (
                                  <li key={s.name} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', padding: '3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    · {s.name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════ */}
              {/* 3행 — 신규 가입 추이 (Stacked Bar)                              */}
              {/* ════════════════════════════════════════════════════════════ */}
              {mapMetric === 'students' ? (
                <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '20px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>
                  학생은 학교 단위로 등록되어 신규 가입 추이가 의미 없습니다. 학교/교사 메트릭을 선택해 보세요.
                </div>
              ) : (() => {
                // 학교: 단일 막대 (모든 학교 = 유료, 무료 등급 없음)
                // 교사: stacked bar (가입 시점 paid/free 스냅샷)
                const isSchool = mapMetric === 'schools';
                // [v2.53] 학년도(3월~다음해 2월) 단위 + 일별 월 셀렉트 + 주별 좌우 스크롤
                const academicMonths = ['3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'];
                const yearMul = signupYear === '2025' ? 0.7 : 1.0;
                // 월별 데이터 (학년도별)
                const periodSrcMonth = signupYear === '2026'
                  ? monthlySignup
                  : academicMonths.map((m, i) => {
                      const f = [0.5, 1.0, 1.2, 0.9, 0.6, 0.4, 0.7, 1.1, 1.0, 0.5, 0.4, 0.3][i];
                      return {
                        month: m,
                        schoolsNew: Math.round(8 * f),
                        teacherPaid: Math.round(10 * f),
                        teacherFree: Math.round(30 * f),
                        schoolsNewNames: [],
                      };
                    });
                // 일별 데이터 (학년도+월)
                const getDailyForMonth = (yr, monthLabel) => {
                  const monthIdx = academicMonths.indexOf(monthLabel);
                  if (monthIdx < 0) return [];
                  const mul = yr === '2025' ? 0.7 : 1.0;
                  // 활성 월(3,4월)인지 — 다른 월은 거의 0으로 (mock)
                  const monthActive = yr === '2026' ? (monthIdx <= 1 ? 1.0 : 0.0) : ([0.5,1.0,1.2,0.9,0.6,0.4,0.7,1.1,1.0,0.5,0.4,0.3][monthIdx]);
                  const days = [31,30,31,30,31,31,30,31,30,31,31,28][monthIdx];
                  const arr = [];
                  // 시작 요일 시뮬: monthIdx별 다름
                  const startDow = (monthIdx * 3 + 5) % 7;
                  for (let d = 1; d <= days; d++) {
                    const dow = (startDow + d - 1) % 7;
                    const isWeekend = dow === 0 || dow === 6;
                    const f = monthActive * mul;
                    const schools = isWeekend ? 0 : (d % 4 === 0 ? Math.round(2 * f) : d % 7 === 0 ? Math.round(1 * f) : 0);
                    const tPaid = isWeekend ? 0 : (d % 3 === 0 ? Math.round(3 * f) : d % 5 === 0 ? Math.round(1 * f) : 0);
                    const tFree = isWeekend ? (d % 4 === 0 ? Math.round(1 * f) : 0) : (d % 2 === 0 ? Math.round(4 * f) : Math.round(1 * f));
                    arr.push({
                      key: `${monthLabel} ${d}일`,
                      sublabel: ['일','월','화','수','목','금','토'][dow],
                      schoolsNew: schools,
                      teacherPaid: tPaid,
                      teacherFree: tFree,
                      schoolsNewNames: [],
                      isWeekend,
                    });
                  }
                  return arr;
                };
                // 주별 데이터 (학년도 ~52주) — [v2.61] monthly와 정합 (학년도 누적 동일)
                const getWeeklyForYear = (yr) => {
                  const march1 = new Date(parseInt(yr), 2, 1);
                  const dow = march1.getDay();
                  const offsetToMonday = dow === 1 ? 0 : (8 - dow) % 7;
                  const startMonday = new Date(march1);
                  startMonday.setDate(march1.getDate() + offsetToMonday);
                  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
                  // 주별 mock — monthly 합계와 정합 (단일 source 원칙)
                  // 2026: 1~10주차만 데이터 (현재 5/6 시점), 누적 학교 33 = monthly 3+4+5월 합
                  // 2025: 종료된 학년도, 학년도 전체 분포 (학교 약 23, 교사 paid·free 동일)
                  let weekData;
                  if (yr === '2026') {
                    weekData = [
                      // 1~4주차 (3월) — 학교 합 15, paid 18, free 60
                      { s: 4, p: 5, f: 15 }, { s: 4, p: 5, f: 15 }, { s: 4, p: 4, f: 15 }, { s: 3, p: 4, f: 15 },
                      // 5~8주차 (4월) — 학교 합 15, paid 14, free 48
                      { s: 4, p: 4, f: 12 }, { s: 4, p: 4, f: 12 }, { s: 4, p: 3, f: 12 }, { s: 3, p: 3, f: 12 },
                      // 9~10주차 (5월 6일까지) — 학교 합 3, paid 8, free 4
                      { s: 2, p: 4, f: 2 }, { s: 1, p: 4, f: 2 },
                    ];
                    while (weekData.length < 52) weekData.push({ s: 0, p: 0, f: 0 }); // 미래 0
                  } else {
                    // 2025학년도 (종료): 학교 합 ≈ 23 (monthly 합계), paid·free도 비례 정합
                    // 월별 multiplier [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]
                    const monthMul = [0.5, 1.0, 1.2, 0.9, 0.6, 0.4, 0.7, 1.1, 1.0, 0.5, 0.4, 0.3];
                    weekData = [];
                    monthMul.forEach((mul) => {
                      const monthS = Math.round(8 * mul * 0.7);
                      const monthP = Math.round(10 * mul * 0.7);
                      const monthF = Math.round(30 * mul * 0.7);
                      // 각 월 = 4주차 분배 (반올림 잔여는 앞 주차에 +1)
                      for (let wi = 0; wi < 4; wi++) {
                        weekData.push({
                          s: Math.floor(monthS / 4) + (wi < monthS % 4 ? 1 : 0),
                          p: Math.floor(monthP / 4) + (wi < monthP % 4 ? 1 : 0),
                          f: Math.floor(monthF / 4) + (wi < monthF % 4 ? 1 : 0),
                        });
                      }
                    });
                    while (weekData.length < 52) weekData.push({ s: 0, p: 0, f: 0 });
                  }
                  const arr = [];
                  for (let w = 1; w <= 52; w++) {
                    const wStart = new Date(startMonday);
                    wStart.setDate(startMonday.getDate() + (w - 1) * 7);
                    const wEnd = new Date(wStart);
                    wEnd.setDate(wStart.getDate() + 6);
                    const dateRange = `${fmt(wStart)}~${fmt(wEnd)}`;
                    const wd = weekData[w - 1];
                    arr.push({
                      key: `${w}주차`,
                      dateRange,
                      sublabel: w <= 16 ? '1학기' : w <= 26 ? '여름방학' : w <= 42 ? '2학기' : '겨울방학',
                      schoolsNew: wd.s,
                      teacherPaid: wd.p,
                      teacherFree: wd.f,
                      schoolsNewNames: [],
                    });
                  }
                  return arr;
                };
                // 단위별 데이터 결정
                let periodSrc;
                let weeklyAll = null;
                let weeklyPageStart = 0;
                if (signupPeriod === 'month') {
                  periodSrc = periodSrcMonth;
                } else if (signupPeriod === 'day') {
                  periodSrc = getDailyForMonth(signupYear, signupDailyMonth);
                } else {
                  weeklyAll = getWeeklyForYear(signupYear);
                  weeklyPageStart = Math.max(0, Math.min(weeklyAll.length - 12, signupWeekOffset));
                  periodSrc = weeklyAll.slice(weeklyPageStart, weeklyPageStart + 12);
                }
                const data = periodSrc.map(d => {
                  const key = d.key || d.month;
                  return isSchool
                    ? { key, sublabel: d.sublabel || '', dateRange: d.dateRange || '', total: d.schoolsNew, paid: 0, free: 0, names: d.schoolsNewNames || [], isWeekend: d.isWeekend }
                    : { key, sublabel: d.sublabel || '', dateRange: d.dateRange || '', total: d.teacherPaid + d.teacherFree, paid: d.teacherPaid, free: d.teacherFree, names: [], isWeekend: d.isWeekend };
                });
                const unit = isSchool ? '개' : '명';
                const colCount = data.length;
                const colW = 1120 / colCount;
                const barW = colW * (signupPeriod === 'day' ? 0.7 : 0.55);
                const maxStack = Math.max(...data.map(d => d.total), 5);
                const yLabels = Array.from({ length: 6 }, (_, i) => Math.round(maxStack * (1 - i / 5)));
                // [v2.61] 누적은 항상 학년도 전체 (페이지 무관). 주별은 weeklyAll 사용
                const yearTotalSrc =
                  signupPeriod === 'week' && weeklyAll
                    ? weeklyAll
                    : signupPeriod === 'day'
                      // 일별: 학년도 12개월의 일별 합계 = monthly와 동일하므로 monthly src 사용
                      ? periodSrcMonth
                      : periodSrcMonth;
                const totalAll = yearTotalSrc.reduce(
                  (s, d) => s + (isSchool ? (d.schoolsNew ?? d.s ?? 0) : ((d.teacherPaid ?? d.p ?? 0) + (d.teacherFree ?? d.f ?? 0))),
                  0
                );
                const totalPaid = yearTotalSrc.reduce((s, d) => s + (d.teacherPaid ?? d.p ?? 0), 0);
                const totalFree = yearTotalSrc.reduce((s, d) => s + (d.teacherFree ?? d.f ?? 0), 0);
                const hovered = signupHoverIdx !== null ? data[signupHoverIdx] : null;
                const hoveredCx = signupHoverIdx !== null ? 60 + (signupHoverIdx + 0.5) * colW : 0;
                const hoveredLeftPct = (hoveredCx / 1200) * 100;
                const labelStride = signupPeriod === 'day' ? 5 : 1;
                const periodLabel =
                  signupPeriod === 'day'  ? `${signupYear}학년도 ${signupDailyMonth} 일별` :
                  signupPeriod === 'week' ? `${signupYear}학년도 ${weeklyPageStart + 1}~${weeklyPageStart + 12}주차` :
                                            `${signupYear}학년도 월별 12개월`;
                const cohortText = signupPeriod === 'day' ? '오늘' : signupPeriod === 'week' ? '이번 주' : '이번 달';
                return (
                  <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', fontWeight: 800 }}>신규 가입 추이 ({isSchool ? '학교' : '교사'})</div>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#FB923C', background: '#FFF7ED', border: '1px solid #FED7AA', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{periodLabel}</span>
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>
                          {isSchool
                            ? '학교는 그 ' + (signupPeriod === 'day' ? '일' : signupPeriod === 'week' ? '주' : '월') + '에 신규 가입한 학교. 막대 호버 시 학교명 표시'
                            : '무료 신규 = 조회 기간에 신규 가입한 교사 · 유료 신규 = 조회 기간에 시작/종료일 겹치는 1회 이상 유료 이력 교사'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        {/* [v2.53] 학년도 + 일별 월 셀렉트 */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* [v3.9] 섹션별 학년도 셀렉트 폐기 — 헤더 글로벌 컨트롤 사용. chip으로 정보 표시 */}
                          <span style={{ padding: '4px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#FB923C' }}>
                            {signupYear} 학년도
                          </span>
                          {signupPeriod === 'day' && (
                            <select
                              value={signupDailyMonth}
                              onChange={(e) => { setSignupDailyMonth(e.target.value); setSignupHoverIdx(null); }}
                              style={{ padding: '5px 8px', border: '1px solid #FED7AA', borderRadius: '6px', background: '#FFF7ED', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#9A3412', cursor: 'pointer' }}
                            >
                              {academicMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                        </div>
                        {/* [v2.51] 단위 토글 */}
                        <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                          {[
                            { id: 'day',   label: '📅 일' },
                            { id: 'week',  label: '📆 주' },
                            { id: 'month', label: '🗓 월' },
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSignupPeriod(p.id); setSignupHoverIdx(null); setSignupWeekOffset(0); }}
                              style={{
                                padding: '5px 12px', border: 'none', borderRadius: '6px',
                                background: signupPeriod === p.id ? 'white' : 'transparent',
                                color: signupPeriod === p.id ? '#FB923C' : '#64748B',
                                fontSize: 'var(--neo-font-size-xs)',
                                fontWeight: signupPeriod === p.id ? 800 : 700,
                                cursor: 'pointer',
                                boxShadow: signupPeriod === p.id ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                                transition: 'all 0.15s',
                              }}
                            >{p.label}</button>
                          ))}
                        </div>
                        {/* [v2.53] 주별 좌우 스크롤 페이지네이션 */}
                        {signupPeriod === 'week' && weeklyAll && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569' }}>
                            <button
                              onClick={() => setSignupWeekOffset(Math.min(weeklyAll.length - 12, signupWeekOffset + 12))}
                              disabled={weeklyPageStart >= weeklyAll.length - 12}
                              style={{
                                padding: '3px 10px', border: '1px solid #E2E8F0', borderRadius: '6px',
                                background: weeklyPageStart >= weeklyAll.length - 12 ? '#F8FAFC' : 'white',
                                color: weeklyPageStart >= weeklyAll.length - 12 ? '#CBD5E1' : '#475569',
                                fontSize: 'var(--neo-font-size-xs)', fontWeight: 700,
                                cursor: weeklyPageStart >= weeklyAll.length - 12 ? 'not-allowed' : 'pointer',
                              }}
                            >← 이전</button>
                            <span style={{ padding: '0 6px', whiteSpace: 'nowrap' }}>{weeklyPageStart + 1}~{Math.min(weeklyPageStart + 12, weeklyAll.length)}주차 / 전체 {weeklyAll.length}주</span>
                            <button
                              onClick={() => setSignupWeekOffset(Math.max(0, signupWeekOffset - 12))}
                              disabled={weeklyPageStart === 0}
                              style={{
                                padding: '3px 10px', border: '1px solid #E2E8F0', borderRadius: '6px',
                                background: weeklyPageStart === 0 ? '#F8FAFC' : 'white',
                                color: weeklyPageStart === 0 ? '#CBD5E1' : '#475569',
                                fontSize: 'var(--neo-font-size-xs)', fontWeight: 700,
                                cursor: weeklyPageStart === 0 ? 'not-allowed' : 'pointer',
                              }}
                            >다음 →</button>
                          </div>
                        )}
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 700 }}>
                          {isSchool
                            ? <>{signupYear}학년도 누적 {totalAll.toLocaleString()}{unit}</>
                            : <>{signupYear}학년도 누적 {totalAll.toLocaleString()}{unit} (유료 {totalPaid.toLocaleString()} · 무료 {totalFree.toLocaleString()})</>
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <svg viewBox="0 0 1200 320" style={{ width: '100%', height: 'auto', display: 'block' }}>
                        {yLabels.map((label, i) => {
                          const y = 20 + (i * 240 / 5);
                          return (
                            <g key={i}>
                              <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                              <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}{unit}</text>
                            </g>
                          );
                        })}
                        <line x1="60" y1="260" x2="1180" y2="260" stroke="#CBD5E1" strokeWidth="1" />
                        {/* [v2.63] 학교 메트릭: 도트 + 점선 연결 (값 있는 도트만 연결, opacity 0.4 점선) */}
                        {isSchool && (() => {
                          const opacityLine = signupHoverIdx === null ? 0.4 : 0.2;
                          const points = data
                            .map((d, i) => ({
                              x: 60 + (i + 0.5) * colW,
                              y: 260 - (d.total / maxStack) * 240,
                              hasData: d.total > 0,
                            }))
                            .filter(p => p.hasData);
                          if (points.length < 2) return null;
                          const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
                          return (
                            <path d={path} fill="none" stroke="#2A75F3" strokeWidth="1.5"
                              strokeDasharray="4 4" opacity={opacityLine} />
                          );
                        })()}
                        {data.map((d, i) => {
                          const cx = 60 + (i + 0.5) * colW;
                          const x = cx - barW / 2;
                          const freeH = (d.free / maxStack) * 240;
                          const paidH = (d.paid / maxStack) * 240;
                          const totalH = (d.total / maxStack) * 240;
                          const cy = 260 - totalH; // 학교 도트 y 좌표
                          const isHovered = signupHoverIdx === i;
                          const opacity = signupHoverIdx === null || isHovered ? 1 : 0.5;
                          return (
                            <g
                              key={i}
                              onMouseEnter={() => openSignupHover(i)}
                              onMouseLeave={scheduleCloseSignupHover}
                              style={{ cursor: d.total > 0 ? 'pointer' : 'default' }}
                            >
                              {/* 호버 캡처용 투명 column rect */}
                              <rect x={cx - colW / 2} y={20} width={colW} height={240} fill="transparent" />
                              {isSchool ? (
                                /* [v2.63] 학교: 도트 그래프 (단일 색상 #2A75F3, r=6, hover 시 r=8 강조 + 값 라벨) */
                                d.total > 0 && (
                                  <>
                                    <circle cx={cx} cy={cy} r={isHovered ? 8 : 6}
                                      fill="white" stroke="#2A75F3" strokeWidth={isHovered ? 3 : 2.5}
                                      opacity={opacity} />
                                    {(isHovered || d.total >= 3) && (
                                      <text x={cx} y={cy - 12} textAnchor="middle"
                                        fontSize="11" fontWeight={isHovered ? 800 : 700}
                                        fill={isHovered ? '#1E2225' : '#2A75F3'}
                                        opacity={opacity}>
                                        {d.total}
                                      </text>
                                    )}
                                  </>
                                )
                              ) : (
                                /* 교사: stacked (무료 하단 + 유료 상단) */
                                <>
                                  {freeH > 0 && (
                                    <rect x={x} y={260 - freeH} width={barW} height={freeH} fill="#2A75F3" opacity={opacity} />
                                  )}
                                  {paidH > 0 && (
                                    <rect x={x} y={260 - freeH - paidH} width={barW} height={paidH} fill="#FB923C" opacity={opacity} />
                                  )}
                                </>
                              )}
                              {/* [v2.63] 라벨 표시 조건: 5의 배수 reference point + 마지막 + hover + 데이터 있는 날 (d.total > 0)
                                  데이터가 있는 날은 어떤 날인지 항상 식별 가능하도록 라벨 강제 표시 */}
                              {(i % labelStride === 0 || i === data.length - 1 || isHovered || d.total > 0) && (
                                <text x={cx} y="282" textAnchor="middle" fontSize={signupPeriod === 'day' ? 9 : 11} fill={isHovered ? '#1E2225' : (d.total > 0 ? '#1E2225' : (d.isWeekend ? '#CBD5E1' : '#64748B'))} fontWeight={isHovered ? 800 : (d.total > 0 ? 700 : (signupPeriod === 'week' ? 600 : 400))}>{d.key}</text>
                              )}
                              {signupPeriod === 'day' && d.sublabel && (i % labelStride === 0 || isHovered || d.total > 0) && (
                                <text x={cx} y="296" textAnchor="middle" fontSize="8" fill={d.isWeekend ? '#FCA5A5' : '#94A3B8'} fontWeight={600}>{d.sublabel}</text>
                              )}
                              {/* [v2.59] 주별 단위: 주차 라벨 아래에 실제 기간 표시 */}
                              {signupPeriod === 'week' && d.dateRange && (
                                <text x={cx} y="296" textAnchor="middle" fontSize="9" fill={isHovered ? '#475569' : '#94A3B8'} fontWeight={isHovered ? 700 : 600}>{d.dateRange}</text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      {/* Hover popover — 스크롤 가능 */}
                      {hovered && hovered.total > 0 && (
                        <div
                          onMouseEnter={cancelCloseSignupHover}
                          onMouseLeave={scheduleCloseSignupHover}
                          style={{
                            position: 'absolute',
                            left: `${hoveredLeftPct}%`,
                            top: '8px',
                            transform: 'translateX(-50%)',
                            minWidth: '260px',
                            maxWidth: '340px',
                            maxHeight: 'calc(100% - 16px)',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            boxShadow: '0 12px 28px -8px rgba(15,23,42,0.25)',
                            padding: '10px 12px',
                            zIndex: 30,
                            fontSize: 'var(--neo-font-size-sm)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                            <span style={{ fontWeight: 800, color: '#1E2225' }}>
                              {hovered.key}
                              {hovered.dateRange && <span style={{ color: '#475569', fontWeight: 700, marginLeft: '4px', fontSize: 'var(--neo-font-size-xs)' }}>({hovered.dateRange})</span>}
                              {hovered.sublabel ? <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: '4px', fontSize: 'var(--neo-font-size-xs)' }}>{hovered.dateRange ? '· ' : '('}{hovered.sublabel}{hovered.dateRange ? '' : ')'}</span> : null}
                              {' '}신규 가입
                            </span>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{hovered.total}{unit}</span>
                          </div>
                          {/* 스크롤 영역 */}
                          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                            {isSchool ? (
                              /* 학교: 단일 학교명 list */
                              hovered.names.length > 0 && (
                                <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 0 4px' }}>
                                  {hovered.names.map(n => (
                                    <li key={n} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      <span style={{ color: '#2A75F3', marginRight: '4px' }}>·</span>{n}
                                    </li>
                                  ))}
                                </ul>
                              )
                            ) : (
                              /* 교사: 유료/무료 분리 카운트 */
                              <>
                                {hovered.paid > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, background: '#FB923C', borderRadius: 2 }}></span>
                                    <span style={{ fontWeight: 700, color: '#C2410C', fontSize: 'var(--neo-font-size-xs)' }}>유료 {hovered.paid}{unit}</span>
                                  </div>
                                )}
                                {hovered.free > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, background: '#2A75F3', borderRadius: 2 }}></span>
                                    <span style={{ fontWeight: 700, color: '#1D4ED8', fontSize: 'var(--neo-font-size-xs)' }}>무료 {hovered.free}{unit}</span>
                                  </div>
                                )}
                                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '6px' }}>교사 명세는 회원관리에서 조회 가능</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 범례 — [v2.63] 학교 메트릭은 도트 그래프 swatch */}
                    {isSchool ? (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', fontSize: 'var(--neo-font-size-sm)', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, background: 'white', border: '2.5px solid #2A75F3', borderRadius: '50%', marginRight: 6 }}></span>
                          신규 가입 학교 (도트)
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#94A3B8' }}>
                          <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #2A75F3', opacity: 0.5, marginRight: 6 }}></span>
                          시간 흐름 연결선
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '4px', fontSize: 'var(--neo-font-size-sm)' }}>
                        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#FB923C', borderRadius: 2, marginRight: 6 }}></span>유료 신규</span>
                        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2A75F3', borderRadius: 2, marginRight: 6 }}></span>무료 신규 (14일 trial)</span>
                      </div>
                    )}
                    {/* 마케팅/영업 해석 가이드 */}
                    <div style={{ marginTop: '14px', padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 800, color: '#1E2225', marginBottom: '6px', fontSize: 'var(--neo-font-size-sm)' }}>📊 해석 가이드 (마케팅·영업)</div>
                      {isSchool ? (
                        <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                          <li><strong style={{ color: '#1E2225' }}>이 차트는 영업팀의 신규 학교 영업 성과 직접 지표</strong>입니다 (학교 가입 = 영업 계약 체결)</li>
                          <li>월별 신규 가입 학교 수가 <strong>감소 추세</strong>이면 영업 활동·리드 풀 점검 필요</li>
                          <li>막대 호버 시 가입 학교명 확인 가능</li>
                        </ul>
                      ) : (
                        <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                          <li><strong style={{ color: '#C2410C' }}>유료 신규</strong> = 가입 시점에 학교가 이미 유료인 경우 (<strong>영업 1차 효과</strong>: 학교 영업 후 그 학교의 신규 등록 교사)</li>
                          <li><strong style={{ color: '#1D4ED8' }}>무료 신규</strong> = 14일 trial 시작 (<strong>마케팅·인지도 효과</strong>: 학교 미가입 상태에서 자발적 가입한 잠재 사용자)</li>
                          <li>무료 신규 비중이 높을수록 → 영업 → 학교 단위 유료 전환 잠재력 큼. <strong>「전환 추이」</strong>와 함께 보세요</li>
                          <li>무료/유료 비율이 급변하면 → 캠페인·영업 활동 변경 신호 (시점 별 마케팅 ROI 측정)</li>
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* 4행 — 무료 → 유료 전환 추이 (교사만 표시)                       */}
              {/* ════════════════════════════════════════════════════════════ */}
              {mapMetric === 'schools' && (
                <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>
                  <span style={{ fontSize: '1.4rem' }}>ℹ️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#1E2225', marginBottom: '2px' }}>학교는 무료 → 유료 전환 사건이 없습니다</div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                      학교는 가입 시점에 유료/무료가 결정되어 영원히 고정됩니다.
                      <strong style={{ color: '#1E2225' }}> 무료 → 유료 전환 추이 라인 차트 + KPI 3종</strong>
                      (누적 전환율 / 평균 전환 소요 일수 / 누적 무료 가입)은
                      이 섹션 상단의 메트릭 토글에서 <strong style={{ color: '#FB923C' }}>[👨‍🏫 교사]</strong>를 선택하면 표시됩니다.
                    </div>
                  </div>
                  <button
                    onClick={() => setMapMetric('teachers')}
                    style={{
                      flexShrink: 0,
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '10px',
                      background: '#FB923C',
                      color: 'white',
                      fontSize: 'var(--neo-font-size-sm)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px -2px rgba(251,146,60,0.4)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F97316'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FB923C'}
                  >
                    👨‍🏫 교사 메트릭으로 전환 →
                  </button>
                </div>
              )}
              {mapMetric === 'teachers' && (() => {
                const kpi = conversionKpi.teacher;
                const data = monthlyConversion.map(d => ({ month: d.month, value: d.teacher, schools: d.schools }));
                const unit = '명';
                const colW = 1120 / 12;
                const maxV = Math.max(...data.map(d => d.value), 5);
                const yLabels = Array.from({ length: 6 }, (_, i) => Math.round(maxV * (1 - i / 5)));
                const path = data.map((d, i) => {
                  const cx = 60 + (i + 0.5) * colW;
                  const cy = 260 - (d.value / maxV) * 240;
                  return (i === 0 ? 'M' : 'L') + cx + ',' + cy;
                }).join(' ');
                return (
                  <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', fontWeight: 800 }}>가입·전환 분석 (학교 + 교사)</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>학교: 무료 개념 없음 (가입 = 유료). 교사: 학교 종속, B2C 차단. 모든 상태 변경 이력 영구 보존</div>
                      </div>
                    </div>

                    {/* === 교사 단위 카드 3종 (무료 → 유료 전환) === */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px', position: 'relative' }}>
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px 14px', position: 'relative' }} title={`누적 전환율 = 조회 기간 유료 전환 교사 / 누적 무료 가입 × 100. 같은 교사 여러 번 전환해도 1회만 카운트\n전환 교사 ${kpi.totalConverted}명은 ${kpi.convertedSchools}개교 출신`}>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', fontWeight: 700 }}>누적 전환율</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: '#C2410C', lineHeight: 1.1, marginTop: '2px' }}>
                          {kpi.totalConverted === 0 ? '—' : `${kpi.conversionRate.toFixed(1)}%`}
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', marginTop: '2px' }}>
                          {kpi.totalConverted}{unit} (
                          <button
                            onClick={() => setConvSchoolPopover(convSchoolPopover === 'converted' ? null : 'converted')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '0 4px', border: 'none', background: 'transparent', color: '#C2410C', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                            title="클릭하여 전환 학교 명단 보기"
                          >
                            {kpi.convertedSchools}개교 📋
                          </button>
                          ) 전환 / {kpi.totalFreeSignups}{unit} 무료 가입
                        </div>
                        {/* [신규] 전환 학교 명단 popover */}
                        {convSchoolPopover === 'converted' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'absolute', top: 'calc(100% + 8px)', left: '0', background: 'white', border: '1px solid #FED7AA', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.15)', padding: '12px 14px', minWidth: '300px', zIndex: 100 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#9A3412' }}>📋 전환 학교 명단 ({kpi.convertedSchools}개교 · {kpi.totalConverted}명)</div>
                              <button onClick={() => setConvSchoolPopover(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>✕</button>
                            </div>
                            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {kpi.convertedSchoolList.map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#FFFBF5', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)' }}>
                                  <div>
                                    <div style={{ fontWeight: 800, color: '#1E2225' }}>{s.name}</div>
                                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '1px' }}>{s.region} · {s.convertedAt}</div>
                                  </div>
                                  <div style={{ fontWeight: 800, color: '#C2410C' }}>{s.teachers}명</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 14px' }} title="전환된 교사의 (가입일 → 첫 유료 전환일) 평균 일수">
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#1E40AF', fontWeight: 700 }}>평균 전환 소요 일수</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: '#1D4ED8', lineHeight: 1.1, marginTop: '2px' }}>
                          {kpi.avgDaysToConvert === null ? '—' : `${kpi.avgDaysToConvert.toFixed(1)}`}
                          {kpi.avgDaysToConvert !== null && <span style={{ fontSize: 'var(--neo-font-size-sm)', marginLeft: '3px', fontWeight: 700, color: '#3B82F6' }}>일</span>}
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#1E40AF', marginTop: '2px' }}>가입일 → 첫 유료 전환일 평균</div>
                      </div>
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 14px' }} title={`조회 기간에 신규 가입한 전체 교사 수 (전환율 분모)\n무료 가입 ${kpi.totalFreeSignups}명은 ${kpi.freeSignupSchools}개교 출신`}>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#065F46', fontWeight: 700 }}>누적 무료 가입</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: '#047857', lineHeight: 1.1, marginTop: '2px' }}>
                          {kpi.totalFreeSignups.toLocaleString()}<span style={{ fontSize: 'var(--neo-font-size-sm)', marginLeft: '3px', fontWeight: 700, color: '#10B981' }}>{unit}</span>
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#065F46', marginTop: '2px' }}>
                          {kpi.freeSignupSchools}개교 출신 (조회 기간 신규 가입)
                        </div>
                      </div>
                    </div>
                    {/* 차트 */}
                    <svg viewBox="0 0 1200 320" style={{ width: '100%', height: 'auto' }}>
                      {yLabels.map((label, i) => {
                        const y = 20 + (i * 240 / 5);
                        return (
                          <g key={i}>
                            <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                            <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}{unit}</text>
                          </g>
                        );
                      })}
                      <line x1="60" y1="260" x2="1180" y2="260" stroke="#CBD5E1" strokeWidth="1" />
                      <path d={path} fill="none" stroke="#FB923C" strokeWidth="2" />
                      {data.map((d, i) => {
                        const cx = 60 + (i + 0.5) * colW;
                        const cy = 260 - (d.value / maxV) * 240;
                        if (d.value === 0) return (
                          <g key={i}>
                            <text x={cx} y="282" textAnchor="middle" fontSize="12" fill="#CBD5E1">{d.month}</text>
                          </g>
                        );
                        const isSelected = conversionChartPopover?.monthIdx === i;
                        return (
                          <g key={i} style={{ cursor: 'pointer' }} onClick={() => setConversionChartPopover(isSelected ? null : { monthIdx: i, cx, cy })}>
                            <circle cx={cx} cy={cy} r={isSelected ? 7 : 4} fill={isSelected ? '#FB923C' : 'white'} stroke="#FB923C" strokeWidth="2">
                              <title>{`${d.month} · 전환 ${d.value}${unit} (클릭하여 학교 명단 보기)`}</title>
                            </circle>
                            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="11" fill="#C2410C" fontWeight="700" style={{ pointerEvents: 'none' }}>{d.value}</text>
                            <text x={cx} y="282" textAnchor="middle" fontSize="12" fill="#64748B" style={{ pointerEvents: 'none' }}>{d.month}</text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* [신규] 월별 전환 차트 점 클릭 popover */}
                    {conversionChartPopover && (() => {
                      const d = data[conversionChartPopover.monthIdx];
                      if (!d || !d.schools || d.schools.length === 0) return null;
                      // SVG 좌표를 % 위치로 변환 (viewBox 0 0 1200 320 기준)
                      const leftPct = (conversionChartPopover.cx / 1200) * 100;
                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            left: `calc(${leftPct}% - 140px)`,
                            marginTop: '-180px',
                            background: 'white',
                            border: '1px solid #FED7AA',
                            borderRadius: '10px',
                            boxShadow: '0 8px 24px rgba(15,23,42,0.15)',
                            padding: '12px 14px',
                            minWidth: '280px',
                            maxWidth: '320px',
                            zIndex: 100,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#9A3412' }}>📋 {d.month} 전환 학교 ({d.schools.length}개교 · {d.value}{unit})</div>
                            <button onClick={() => setConversionChartPopover(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>✕</button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {d.schools.map((s, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#FFFBF5', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)' }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: '#1E2225' }}>{s.name}</div>
                                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '1px' }}>{s.region}</div>
                                </div>
                                <div style={{ fontWeight: 800, color: '#C2410C' }}>{s.teachers}명</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {/* 마케팅/영업 해석 가이드 */}
                    <div style={{ marginTop: '14px', padding: '12px 14px', background: '#FFFBF5', border: '1px solid #FED7AA', borderRadius: '10px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.55 }}>
                      <div style={{ fontWeight: 800, color: '#9A3412', marginBottom: '6px', fontSize: 'var(--neo-font-size-sm)' }}>📊 해석 가이드</div>
                      <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                        <li><strong style={{ color: '#0F766E' }}>📝 가입 신청 학교</strong> = 운영자가 검토할 신청. 오래 누적되면 승인 SLA 점검 필요</li>
                        <li><strong style={{ color: '#10B981' }}>✅ 승인 학교</strong> = 매출 직결. 조회 학년도 마지막 날짜까지 가입한 학교 수</li>
                        <li><strong style={{ color: '#DC2626' }}>📉 학교 갱신 거부율</strong> = 재계약 안 한 학교 비율. 업계 B2B 기준 연 5~10% 미만이면 양호</li>
                        <li><strong style={{ color: '#C2410C' }}>누적 전환율</strong> = 영업이 무료 교사를 학교 가입으로 얼마나 끌어왔는가. 벤치마크 5~10% 이상이면 우수</li>
                        <li><strong style={{ color: '#1D4ED8' }}>평균 전환 소요 일수</strong> = 가입일에서 유료 전환까지 평균 일수. 짧을수록 영업력 강함. 30일 초과 시 trial 만료 후 비활성 위험</li>
                        <li><strong style={{ color: '#047857' }}>누적 무료 가입</strong> = 조회 기간 신규 가입한 전체 교사 (전환율 분모)</li>
                        <li><strong>「신규 가입 추이」와 별개 사건</strong>입니다. 신규 유료 가입자와 전환자는 다른 그룹입니다</li>
                      </ul>
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}
      </section>

      {/* Bottom Grid */}
      <div id="sec-notice" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', scrollMarginTop: '80px' }}>
        {/* Notice Section */}
        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>공지사항 ›</h3>
            <button style={{ padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#4A5568', fontWeight: 600 }}>+ 새 공지</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notices.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.id === 1 && <span style={{ background: '#FF4D4D', color: 'white', fontSize: 'var(--neo-font-size-xs)', padding: '2px 4px', borderRadius: '4px', fontWeight: 800 }}>중요</span>}
                  <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', fontWeight: 500 }}>{item.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{item.date}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#3182CE', fontWeight: 700, width: '40px', textAlign: 'right' }}>{item.rate}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Q&A Section */}
        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>Q&A (FAQ) ›</h3>
            <button style={{ padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#4A5568', fontWeight: 600 }}>+ 새 질문</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', fontWeight: 500 }}>{item.question}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{item.date}</span>
                </div>
                <span style={{ 
                  fontSize: 'var(--neo-font-size-xs)', 
                  padding: '4px 8px', 
                  borderRadius: '12px', 
                  fontWeight: 700,
                  backgroundColor: item.status === '답변완료' ? '#F0FDF4' : '#FFF1F2',
                  color: item.status === '답변완료' ? '#16A34A' : '#E11D48',
                  border: `1px solid ${item.status === '답변완료' ? '#BBF7D0' : '#FECACA'}`
                }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* AI 토큰 사용량 */}
      <section id="sec-token" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginTop: '1.5rem', scrollMarginTop: '80px' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>AI 토큰 사용량</h3>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1.5rem' }}>월별 AI 토큰 사용량 추이를 확인하여 리소스 사용 현황을 파악할 수 있습니다.</p>

        {/* 요약 카드 6종 — 4개 기간 카드 + 2개 문항당 원가 카드(생성/채점) [v4.12 답안당 평균 → 문항당 원가 분리] */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: '오늘',   data: tokenUsage.today,     range: '2026-04-30 (당일 00:00 ~ 현재)' },
            { label: '이번주', data: tokenUsage.thisWeek,  range: '2026-04-27 (월) ~ 2026-05-03 (일)' },
            { label: '이번달', data: tokenUsage.thisMonth, range: '2026-04-01 ~ 2026-04-30' },
            { label: '전체',   data: tokenUsage.total,     range: '서비스 기간 전체 (2025-03-01 ~ 2026-02-28)', highlight: true },
          ].map((item, i) => {
            const cost = totalCostKRW(item.data.input, item.data.output);
            return (
              <div
                key={i}
                style={{
                  background: item.highlight ? '#EBF2FF' : '#F8FAFC',
                  border: `1px solid ${item.highlight ? '#BFDBFE' : '#E2E8F0'}`,
                  borderRadius: '12px',
                  padding: '1.25rem 1rem',
                  textAlign: 'center',
                }}
                title={`[기간] ${item.range}`}
              >
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '0.5rem', fontWeight: 700 }}>
                  {item.label}
                  <span style={{ marginLeft: '4px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', cursor: 'help' }} aria-label="기간">ⓘ</span>
                </div>
                {/* 토큰 사용량 — M/K 단위 단독 */}
                <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225' }}>
                  {formatTokenShort(item.data.value)}
                </div>
                {/* 누적 비용 */}
                <div style={{
                  fontSize: 'var(--neo-font-size-base)',
                  fontWeight: 700,
                  color: item.highlight ? '#1D4ED8' : '#475569',
                  marginTop: '6px',
                  paddingTop: '6px',
                  borderTop: `1px dashed ${item.highlight ? '#BFDBFE' : '#E2E8F0'}`,
                }}>
                  {cost.toLocaleString()}원
                </div>
              </div>
            );
          })}
          {/* [v4.12 / 재정의 v4.13 B안] 문항당 원가 카드 2종 — 재무 요금제 설계용 지표
              - 생성 문항당 원가: 서비스 기간 과제 생성(polish) 누적 토큰·비용 ÷ 생성 누적 문항 수 (polish는 문항 1개당 1회이므로 문항 수 = 실행 수)
              - 채점 문항당 원가: 서비스 기간 채점 계열(OCR+채점+재채점+과정 분석) 누적 토큰·비용 ÷ 누적 채점 실행 수 (인스턴스 카운트, B안)
                · 채점·재채점·과정 분석가 모두 수행되면 실행 3건으로 카운트
                · 분자·분모 함께 증가 → 값은 기능별 단가의 가중평균에 수렴 (안정적)
              비용은 토큰 합계 × 평균 단가(전체 비용/전체 토큰)로 환산 — mock 단순화 */}
          {(() => {
            // monthly 합계에서 polish/ocr/grading 분리
            //   [v4.13 B안] monthly[*].grading은 채점 계열 통합(등급평가·재채점·과정 분석) 토큰으로 취급.
            //              실서비스 연동 시 monthly[*].regrading, monthly[*].processEval 별도 필드로 분해되면 합산 로직 갱신.
            const totalPolish  = tokenUsage.monthly.reduce((s, m) => s + (m.polish  || 0), 0); // 생성 = polish (과제 만들 때 문장 다듬기)
            const totalOcr     = tokenUsage.monthly.reduce((s, m) => s + (m.ocr     || 0), 0); // 채점 전 OCR
            const totalGrading = tokenUsage.monthly.reduce((s, m) => s + (m.grading || 0), 0); // 채점 계열 통합 (등급평가 + 재채점 + 과정 분석)
            const totalCreationTokens = totalPolish;
            const totalGradingTokens  = totalOcr + totalGrading; // = 채점 계열 (OCR + 등급평가 + 재채점 + 과정 분석)
            // 비용 환산 — 평균 단가 (전체 비용 ÷ 전체 토큰) × 카테고리 토큰
            const totalCost = totalCostKRW(tokenUsage.total.input, tokenUsage.total.output);
            const costPerToken = tokenUsage.total.value > 0 ? totalCost / tokenUsage.total.value : 0;
            const totalCreationCost = Math.round(totalCreationTokens * costPerToken);
            const totalGradingCost  = Math.round(totalGradingTokens  * costPerToken);
            // 분모: 생성 문항 수 / 누적 채점 실행 수 (인스턴스 카운트 - B안)
            //   [v4.13 B안] questionsGraded 필드를 「누적 채점 실행 수」로 재해석. 실서비스 연동 시 gradingExecutions로 리네이밍 예정.
            const qCreated = schoolTaskData.cumulative.questionsCreated;
            const qGraded  = schoolTaskData.cumulative.questionsGraded; // 실체: 누적 채점 실행 수 (B안)
            const avgTokenCreation = qCreated > 0 ? Math.round(totalCreationTokens / qCreated) : 0;
            const avgCostCreation  = qCreated > 0 ? Math.round(totalCreationCost  / qCreated) : 0;
            const avgTokenGrading  = qGraded  > 0 ? Math.round(totalGradingTokens / qGraded)  : 0;
            const avgCostGrading   = qGraded  > 0 ? Math.round(totalGradingCost  / qGraded)  : 0;

            return (
              <>
                {/* 생성 문항당 원가 */}
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '12px',
                    padding: '1.25rem 1rem',
                    textAlign: 'center',
                  }}
                  title={`생성 문항당 원가 = 과제 생성(polish) 누적 토큰(${formatTokenShort(totalCreationTokens)}) ÷ 생성 누적 문항 수(${qCreated.toLocaleString()}개)\n과제 만들 때 발생하는 문장 다듬기·자동 생성 등에 사용된 토큰의 문항당 평균.`}
                >
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#065F46', marginBottom: '0.5rem', fontWeight: 700 }}>
                    ✍️ 생성 문항당 원가
                    <span style={{ marginLeft: '4px', fontSize: 'var(--neo-font-size-sm)', color: '#10B981', cursor: 'help' }} aria-label="기준">ⓘ</span>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#047857' }}>
                    {formatTokenShort(avgTokenCreation)}
                  </div>
                  <div style={{
                    fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#047857',
                    marginTop: '6px', paddingTop: '6px',
                    borderTop: '1px dashed #A7F3D0',
                  }}>
                    {avgCostCreation.toLocaleString()}원
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#065F46', marginTop: '4px', fontWeight: 600 }}>
                    {qCreated.toLocaleString()}개 생성 문항 평균
                  </div>
                </div>

                {/* 채점 문항당 원가 */}
                <div
                  style={{
                    background: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    borderRadius: '12px',
                    padding: '1.25rem 1rem',
                    textAlign: 'center',
                  }}
                  title={`채점 문항당 원가 = 채점 계열(OCR + 채점 + 재채점 + 과정 분석) 누적 토큰(${formatTokenShort(totalGradingTokens)}) ÷ 누적 채점 실행 수(${qGraded.toLocaleString()}회)\nAI 채점 호출 1건당 평균 발생한 토큰·비용.\n※ 하나의 문항에 채점·재채점·과정 분석가 모두 수행되면 실행 3건으로 카운트됩니다. 기능별(OCR·채점·재채점·과정 분석) 세부 단가는 하단 「기능별 원가 도넛 차트」 참조.`}
                >
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', marginBottom: '0.5rem', fontWeight: 700 }}>
                    📝 채점 문항당 원가
                    <span style={{ marginLeft: '4px', fontSize: 'var(--neo-font-size-sm)', color: '#FB923C', cursor: 'help' }} aria-label="기준">ⓘ</span>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#C2410C' }}>
                    {formatTokenShort(avgTokenGrading)}
                  </div>
                  <div style={{
                    fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#C2410C',
                    marginTop: '6px', paddingTop: '6px',
                    borderTop: '1px dashed #FED7AA',
                  }}>
                    {avgCostGrading.toLocaleString()}원
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', marginTop: '4px', fontWeight: 600 }}>
                    {qGraded.toLocaleString()}회 채점 실행 평균
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* 비용 산출 공통 안내 */}
        <div style={{
          background: '#F8FAFC',
          border: '1px dashed #CBD5E1',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '1.25rem',
          fontSize: 'var(--neo-font-size-sm)',
          color: '#475569',
          lineHeight: 1.6,
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0, color: '#94A3B8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>ⓘ</span>
          <div>
            모든 비용은 Gemini API 단가(입력 <strong>${tokenUsage.pricing.input.toFixed(2)}/M</strong>, 출력 <strong>${tokenUsage.pricing.output.toFixed(2)}/M</strong>) × 환율(<strong>{tokenUsage.pricing.krwRate.toLocaleString()} KRW/USD</strong>) 기준 산출이며, 히스토리 추적 시점의 시세가 반영되어 있습니다.
            실제 청구는 캐싱·세금·환율 변동에 따라 차이날 수 있습니다.
          </div>
        </div>

        {/* 탭 바 (6종) */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'monthly',     label: '📈 월별 추세' },
            { id: 'daily',       label: '📅 일별 추이' },
            { id: 'yearCompare', label: '📊 학년도 비교' },
            { id: 'hourly',      label: '🕐 요일×시간' },
            { id: 'feature',     label: '🛠 기능별' },
            { id: 'topSchools',  label: '🏫 학교 Top 10' },
            { id: 'distribution',label: '📊 학교급·교과 분포' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTokenChartView(tab.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: tokenChartView === tab.id ? '2px solid #2A75F3' : '2px solid transparent',
                color: tokenChartView === tab.id ? '#2A75F3' : '#64748B',
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: tokenChartView === tab.id ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div style={{ width: '100%' }}>

          {/* ① 월별 추세 (라인) — [v3.10] 헤더 globalYear sync */}
          {tokenChartView === 'monthly' && (() => {
            const yearData = tokenUsage.monthlyByYear[globalYear] || [];
            const trendMonthly = yearData.map(m => ({ ...m, value: m.input + m.output }));
            const max = niceCeiling(Math.max(...trendMonthly.map(m => m.value), 1_000_000));
            const yLabels = Array.from({ length: 11 }, (_, i) => max - (max / 10) * i);
            const points = trendMonthly.map((m, i) => ({
              x: tokenChartLeft + (i * tokenChartW / (trendMonthly.length - 1)),
              y: tokenChartBottom - (m.value / max) * tokenChartH,
            }));
            const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
            const areaPath = linePath + ` L ${points[points.length - 1].x},${tokenChartBottom} L ${points[0].x},${tokenChartBottom} Z`;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600 }}>
                    📈 월별 추세 — {globalYear}학년도
                  </div>
                  <span style={{ padding: '4px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#FB923C' }}>
                    {globalYear} 학년도
                  </span>
                </div>
                <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                  <defs>
                    <linearGradient id="tokenAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2A75F3" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2A75F3" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {yLabels.map((label, i) => {
                    const y = tokenChartTop + (i * tokenChartH / 10);
                    return (
                      <g key={i}>
                        <line x1={tokenChartLeft} y1={y} x2={tokenChartLeft + tokenChartW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={tokenChartLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{formatTokenShort(label)}</text>
                      </g>
                    );
                  })}
                  <line x1={tokenChartLeft} y1={tokenChartBottom} x2={tokenChartLeft + tokenChartW} y2={tokenChartBottom} stroke="#CBD5E1" strokeWidth="1" />
                  <path d={areaPath} fill="url(#tokenAreaGradient)" />
                  <path d={linePath} fill="none" stroke="#2A75F3" strokeWidth="2" strokeLinejoin="round" />
                  {trendMonthly.map((m, i) => m.value === 0 ? null : (
                    <circle key={i} cx={points[i].x} cy={points[i].y} r="3.5" fill="white" stroke="#2A75F3" strokeWidth="2">
                      <title>{tooltipMonthExact(m)}</title>
                    </circle>
                  ))}
                  {trendMonthly.map((m, i) => (
                    <text key={i} x={points[i].x} y={tokenChartBottom + 22} textAnchor="middle" fontSize="12" fill="#64748B" fontWeight="500">{m.month}</text>
                  ))}
                </svg>
              </>
            );
          })()}

          {/* ③ 기능별 (도넛) — v4.4 모델별 폐기, 4 카테고리 기능별로 교체 */}
          {tokenChartView === 'feature' && (() => {
            const arcs = buildDonut(tokenFeatureData, 200, 175, 110);
            const totalFeatureTokens = tokenFeatureData.reduce((s, d) => s + d.value, 0);
            return (
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                <svg viewBox="0 0 400 350" style={{ width: '380px', height: 'auto' }}>
                  {arcs.map((a, i) => (
                    <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth="50">
                      <title>{tooltipDonut(a.name, a.value, a.percent)}</title>
                    </path>
                  ))}
                  <text x="200" y="170" textAnchor="middle" fontSize="14" fill="#64748B">총 사용량</text>
                  <text x="200" y="195" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1E2225">{formatTokenShort(totalFeatureTokens)}</text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '260px' }}>
                  {arcs.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px' }}>
                      <span style={{ width: 14, height: 14, background: a.color, borderRadius: 3, flexShrink: 0 }}></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225' }}>{a.name}</div>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{formatTokenShort(a.value)} ({a.percent.toFixed(1)}%)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ④ 학교 Top 10 (가로 막대) — v4.4 부제 추가 */}
          {tokenChartView === 'topSchools' && (() => {
            const barMax = niceCeiling(Math.max(...tokenUsage.schoolTop.map(s => s.value)));
            const rowH = 32;
            const labelW = 200;
            const valueW = 110;
            const barAreaW = tokenChartW - labelW - valueW - 20;
            const totalH = tokenUsage.schoolTop.length * rowH + 20;
            return (
              <>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '12px', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  📅 <strong style={{ color: '#1E2225' }}>서비스 기간 내 현재 기준 누적 사용량</strong> 상위 10개 학교 — 청구·영업 follow-up 우선 대상
                </div>
                <svg viewBox={`0 0 1200 ${totalH}`} style={{ width: '100%', height: 'auto' }}>
                  {tokenUsage.schoolTop.map((s, i) => {
                    const y = i * rowH + 10;
                    const w = (s.value / barMax) * barAreaW;
                    return (
                      <g key={i}>
                        <text x={tokenChartLeft + labelW - 10} y={y + rowH / 2 + 4} textAnchor="end" fontSize="13" fill="#1E2225" fontWeight="600">{i + 1}. {s.name}</text>
                        <rect x={tokenChartLeft + labelW} y={y + 6} width={w} height={rowH - 12} fill="#2A75F3" rx="4">
                          <title>{tooltipEstimate(`${i + 1}. ${s.name}`, s.value)}</title>
                        </rect>
                        <text x={tokenChartLeft + labelW + w + 10} y={y + rowH / 2 + 4} fontSize="12" fill="#64748B" fontWeight="700">{formatTokenShort(s.value)}</text>
                      </g>
                    );
                  })}
                </svg>
              </>
            );
          })()}

          {/* ⑤ 학교급·교과 분포 — v4.5 학교급 sub-filter + 교과별 가로 막대 (학교급마다 교과 list 다름) */}
          {tokenChartView === 'distribution' && (() => {
            const levels = tokenUsage.schoolLevels;
            // [v4.5] 교과는 항상 사용량 desc 정렬 (순위별)
            const subjectsForLevel = [...(tokenUsage.subjectsByLevel[distLevel] || [])].sort((a, b) => b.value - a.value);
            const levelTotal = subjectsForLevel.reduce((s, x) => s + x.value, 0);
            const maxVal = Math.max(...subjectsForLevel.map(s => s.value), 1);
            return (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '12px', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  📊 <strong style={{ color: '#1E2225' }}>학교급별 교과 사용량 분포</strong> — 학교급마다 교과 list가 다르므로 학교급을 선택해서 확인 (확장성 ↑)
                </div>

                {/* 학교급 sub-filter (3 토글) */}
                <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '4px', gap: '2px', marginBottom: '16px' }}>
                  {levels.map(lvl => {
                    const isActive = distLevel === lvl.name;
                    return (
                      <button key={lvl.name}
                        onClick={() => setDistLevel(lvl.name)}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '8px',
                          background: isActive ? 'white' : 'transparent',
                          color: isActive ? '#2A75F3' : '#64748B',
                          fontSize: 'var(--neo-font-size-sm)',
                          fontWeight: isActive ? 800 : 700,
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                        }}>
                        {lvl.name} <span style={{ marginLeft: '4px', color: '#94A3B8', fontWeight: 600 }}>{formatTokenShort(lvl.value)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 교과별 가로 막대 — 사용량 desc 정렬 (순위별) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {subjectsForLevel.map((sub, i) => {
                    const ratio = (sub.value / maxVal) * 100;
                    const pct = ((sub.value / levelTotal) * 100).toFixed(1);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                        title={`${i + 1}위 ${distLevel} ${sub.name}: ${sub.value.toLocaleString()} (학교급 내 ${pct}%)`}>
                        <div style={{ width: '24px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#94A3B8', textAlign: 'right' }}>{i + 1}.</div>
                        <div style={{ width: '110px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 10, height: 10, background: sub.color, borderRadius: 2, flexShrink: 0 }}></span>
                          {sub.name}
                        </div>
                        <div style={{ flex: 1, height: '24px', background: '#F1F5F9', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${ratio}%`,
                            height: '100%',
                            background: sub.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            color: 'white',
                            fontSize: 'var(--neo-font-size-xs)',
                            fontWeight: 800,
                          }}>
                            {ratio > 25 ? formatTokenShort(sub.value) : ''}
                          </div>
                        </div>
                        <div style={{ width: '90px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', textAlign: 'right' }}>
                          {ratio <= 25 ? `${formatTokenShort(sub.value)}` : ''}
                          <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: '4px' }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '14px', padding: '8px 12px', background: '#EFF6FF', borderRadius: '6px', border: '1px solid #BFDBFE', fontSize: 'var(--neo-font-size-sm)', color: '#1D4ED8' }}>
                  <strong>{distLevel} 총 사용량</strong>: {formatTokenShort(levelTotal)} ({subjectsForLevel.length}개 교과)
                </div>
              </div>
            );
          })()}


          {/* ⑦ 일별 추이 (선택한 월의 day-by-day Line) — Tier 3 */}
          {tokenChartView === 'daily' && (() => {
            const days = tokenUsage.dailyByMonth[selectedDailyMonth] || [];
            const max = niceCeiling(Math.max(...days, 1_000_000));
            const yLabels = Array.from({ length: 11 }, (_, i) => max - (max / 10) * i);
            const points = days.map((v, i) => ({
              x: tokenChartLeft + (i * tokenChartW / Math.max(1, days.length - 1)),
              y: tokenChartBottom - (v / max) * tokenChartH,
              value: v,
              day: i + 1,
            }));
            const linePath = points.length > 0 ? points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ') : '';
            const areaPath = points.length > 0 ? linePath + ` L ${points[points.length - 1].x},${tokenChartBottom} L ${points[0].x},${tokenChartBottom} Z` : '';
            const monthOrder = ['3월','4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월'];
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600 }}>
                    📅 일별 추이 — {globalYear}학년도 {selectedDailyMonth} 월간 사용량을 일별로 분해
                  </div>
                  {/* [v3.10] 월 셀렉트 위에 학년도 chip — 헤더 globalYear 자동 sync */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ padding: '4px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#FB923C' }}>
                      {globalYear} 학년도
                    </span>
                    <select
                      value={selectedDailyMonth}
                      onChange={e => setSelectedDailyMonth(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: 'var(--neo-font-size-sm)',
                        background: 'white',
                        color: '#1E2225',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {monthOrder.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                  <defs>
                    <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {yLabels.map((label, i) => {
                    const y = tokenChartTop + (i * tokenChartH / 10);
                    return (
                      <g key={i}>
                        <line x1={tokenChartLeft} y1={y} x2={tokenChartLeft + tokenChartW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={tokenChartLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{formatTokenShort(label)}</text>
                      </g>
                    );
                  })}
                  <line x1={tokenChartLeft} y1={tokenChartBottom} x2={tokenChartLeft + tokenChartW} y2={tokenChartBottom} stroke="#CBD5E1" strokeWidth="1" />
                  <path d={areaPath} fill="url(#dailyGradient)" />
                  <path d={linePath} fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#10B981" strokeWidth="2">
                      <title>{tooltipEstimate(`${globalYear}학년도 ${selectedDailyMonth} ${p.day}일`, p.value)}</title>
                    </circle>
                  ))}
                  {/* X축 라벨 — 5일 간격으로만 표시 */}
                  {points.map((p, i) => (i % 5 === 0 || i === points.length - 1) ? (
                    <text key={i} x={p.x} y={tokenChartBottom + 22} textAnchor="middle" fontSize="11" fill="#64748B">{p.day}일</text>
                  ) : null)}
                </svg>
              </>
            );
          })()}

          {/* ⑨ 학년도 비교 (Multi-line) — [v3.10] 체크박스 다중 선택 */}
          {tokenChartView === 'yearCompare' && (() => {
            // 데이터셋 = 서비스 시작(2024학년도) ~ 현재(globalYear)
            const allYears = Object.keys(tokenUsage.monthlyByYear).sort(); // ['2024','2025','2026']
            // 학년도별 고정 색상 매핑
            const yearColor = { '2024': '#FB923C', '2025': '#94A3B8', '2026': '#2A75F3' };
            const months = (tokenUsage.monthlyByYear[globalYear] || []).map(m => m.month);
            const xs = months.map((_, i) => tokenChartLeft + (i * tokenChartW / (months.length - 1)));
            // 선택된 학년도들의 데이터셋
            const selectedYears = allYears.filter(y => effectiveYearCompare.has(y));
            const seriesByYear = {};
            selectedYears.forEach(y => {
              const yd = tokenUsage.monthlyByYear[y] || [];
              seriesByYear[y] = yd.map((m, i) => ({ x: xs[i], value: m.input + m.output, input: m.input, output: m.output, month: m.month }));
            });
            const allValues = selectedYears.flatMap(y => seriesByYear[y].map(p => p.value));
            const max = niceCeiling(Math.max(...allValues, 1_000_000));
            const yLabels = Array.from({ length: 11 }, (_, i) => max - (max / 10) * i);
            // y 좌표 계산
            selectedYears.forEach(y => {
              seriesByYear[y] = seriesByYear[y].map(p => ({ ...p, y: tokenChartBottom - (p.value / max) * tokenChartH }));
            });
            return (
              <>
                {/* 체크박스 컨트롤 — 학년도 선택 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600 }}>
                    📊 학년도 비교 — {selectedYears.map(y => `${y}학년도`).join(' vs ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>비교할 학년도</span>
                    {allYears.map(y => {
                      const isFixed = y === globalYear;
                      const isChecked = effectiveYearCompare.has(y);
                      return (
                        <label key={y} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--neo-font-size-sm)', cursor: isFixed ? 'not-allowed' : 'pointer', opacity: isFixed ? 0.85 : 1, color: isChecked ? yearColor[y] : '#64748B', fontWeight: isChecked ? 700 : 500 }}
                          title={isFixed ? '현재 학년도(헤더 학년도)는 항상 표시되며 해제할 수 없습니다.' : undefined}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isFixed}
                            onChange={() => toggleYearCompareExtra(y)}
                            style={{ accentColor: yearColor[y], cursor: isFixed ? 'not-allowed' : 'pointer' }}
                          />
                          <span>{y}학년도{isFixed ? ' (현재)' : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                  {yLabels.map((label, i) => {
                    const y = tokenChartTop + (i * tokenChartH / 10);
                    return (
                      <g key={i}>
                        <line x1={tokenChartLeft} y1={y} x2={tokenChartLeft + tokenChartW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={tokenChartLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{formatTokenShort(label)}</text>
                      </g>
                    );
                  })}
                  <line x1={tokenChartLeft} y1={tokenChartBottom} x2={tokenChartLeft + tokenChartW} y2={tokenChartBottom} stroke="#CBD5E1" strokeWidth="1" />
                  {/* 학년도별 라인 — 모두 점선, 현재(globalYear)는 primary + opacity 1.0, 그 외는 opacity 0.4 */}
                  {selectedYears.map(y => {
                    const isFixed = y === globalYear;
                    const path = seriesByYear[y].map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
                    return (
                      <path
                        key={`line-${y}`}
                        d={path}
                        fill="none"
                        stroke={yearColor[y]}
                        strokeWidth={isFixed ? 2.5 : 2}
                        strokeDasharray="6 4"
                        opacity={isFixed ? 1.0 : 0.4}
                      />
                    );
                  })}
                  {/* 데이터 포인트 마커 */}
                  {selectedYears.map(y => {
                    const isFixed = y === globalYear;
                    return seriesByYear[y].map((p, i) => p.value === 0 ? null : (
                      <circle
                        key={`pt-${y}-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={isFixed ? 3.5 : 3}
                        fill="white"
                        stroke={yearColor[y]}
                        strokeWidth="2"
                        opacity={isFixed ? 1.0 : 0.55}
                      >
                        <title>{tooltipMonthExact({ month: `${p.month} (${y}학년도)`, value: p.value, input: p.input, output: p.output })}</title>
                      </circle>
                    ));
                  })}
                  {months.map((m, i) => (
                    <text key={i} x={xs[i]} y={tokenChartBottom + 22} textAnchor="middle" fontSize="12" fill="#64748B" fontWeight="500">{m}</text>
                  ))}
                </svg>
                {/* 범례 */}
                <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px', fontSize: 'var(--neo-font-size-sm)', flexWrap: 'wrap' }}>
                  {selectedYears.map(y => {
                    const isFixed = y === globalYear;
                    return (
                      <span key={`legend-${y}`} style={{ opacity: isFixed ? 1.0 : 0.55, fontWeight: isFixed ? 700 : 500 }}>
                        <svg width="20" height="6" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                          <line x1="0" y1="3" x2="20" y2="3" stroke={yearColor[y]} strokeWidth={isFixed ? 2.5 : 2} strokeDasharray="6 4" />
                        </svg>
                        {y}학년도{isFixed ? ' (현재)' : ''}
                      </span>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* ⑩ 요일×시간 히트맵 (Heatmap Grid) — Tier 3 [v4.5 정책: 시작 시점 토큰량 가산] */}
          {tokenChartView === 'hourly' && (() => {
            const grid = tokenUsage.hourlyHeatmap;
            const max = Math.max(1, ...grid.flat());
            const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
            const cellW = 1100 / 24;
            const cellH = 32;
            const offsetX = 60;
            const offsetY = 30;
            const totalH = offsetY + 7 * cellH + 30;
            return (
              <>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '8px', fontWeight: 600 }}>
                  🕐 요일·시간대별 AI 토큰 사용량 — <span style={{ color: '#94A3B8', fontWeight: 500 }}>기준: 서비스 기간 전체(2025-03-01 ~ 2026-02-28) 누적 (시작 시점 가산)</span>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginBottom: '12px', padding: '6px 10px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '6px' }}>
                  ⓘ 측정: 그 시간대에 <strong>시작된</strong> AI 요청의 토큰 사용량 합산 (input + output). 다른 시계열 차트와 동일하게 시작 시점(started_at) 기준 — 응답이 다른 시간대에 와도 시작 시점 시간대에 가산
                </div>
                <svg viewBox={`0 0 1200 ${totalH}`} style={{ width: '100%', height: 'auto' }}>
                  {/* 시간 라벨 (X축, 4시간 간격) */}
                  {Array.from({ length: 24 }, (_, h) => (h % 4 === 0) ? (
                    <text key={h} x={offsetX + h * cellW + cellW / 2} y={offsetY - 8} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="600">{h}시</text>
                  ) : null)}
                  {/* 셀 */}
                  {grid.map((row, day) => row.map((value, hour) => {
                    const intensity = max > 0 ? value / max : 0;
                    const fill = intensity === 0
                      ? '#F8FAFC'
                      : `rgba(42, 117, 243, ${0.15 + intensity * 0.85})`;
                    return (
                      <rect
                        key={`${day}-${hour}`}
                        x={offsetX + hour * cellW + 1}
                        y={offsetY + day * cellH + 1}
                        width={cellW - 2}
                        height={cellH - 2}
                        fill={fill}
                        rx="2"
                      >
                        <title>{`${dayLabels[day]} ${hour}시: ${formatTokenShort(value)} (${value.toLocaleString()} tokens)`}</title>
                      </rect>
                    );
                  }))}
                  {/* 요일 라벨 (Y축) */}
                  {dayLabels.map((d, i) => (
                    <text key={i} x={offsetX - 10} y={offsetY + i * cellH + cellH / 2 + 4} textAnchor="end" fontSize="12" fill="#475569" fontWeight="600">{d}</text>
                  ))}
                </svg>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', marginTop: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                  <span>누적 토큰 사용량</span>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}></span>
                  <span>0</span>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: 'rgba(42, 117, 243, 0.3)', borderRadius: 2 }}></span>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: 'rgba(42, 117, 243, 0.6)', borderRadius: 2 }}></span>
                  <span style={{ display: 'inline-block', width: 16, height: 16, background: 'rgba(42, 117, 243, 1)', borderRadius: 2 }}></span>
                  <span>최고 ({formatTokenShort(max)})</span>
                </div>
              </>
            );
          })()}

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* 교사 접속률                                                    */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="sec-access" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginTop: '1.5rem', scrollMarginTop: '80px' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>교사 접속률</h3>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1.5rem' }}>학교의 월별 접속률 추이를 확인하여 서비스의 활용도와 교사 업무의 기여도를 유추할 수 있습니다.</p>

        {/* 탭 바 */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'schools',    label: '🏫 학교별 추세' },
            { id: 'paidFree',   label: '💰 유료 vs 무료' },
            { id: 'newReturn',  label: '🆕 첫 접속 vs 재접속' },
            { id: 'hourly',     label: '🕐 요일×시간' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAccessView(tab.id)}
              style={{
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: accessView === tab.id ? '2px solid #2A75F3' : '2px solid transparent',
                color: accessView === tab.id ? '#2A75F3' : '#64748B',
                fontSize: 'var(--neo-font-size-sm)', fontWeight: accessView === tab.id ? 800 : 600,
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px',
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* ① 학교별 추세 (Multi-line) — 교육청 필터 + 검색 + 등록학교 다중선택 */}
        {accessView === 'schools' && (() => {
          const palette = ['#2A75F3', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6', '#A855F7', '#F97316', '#0EA5E9'];
          // 기본 선택: 처음 4개
          const defaultSelected = accessData.schools.slice(0, 4).map(s => s.name);
          const selectedSet = accessSelected === null
            ? new Set(defaultSelected)
            : new Set(accessSelected);
          // 후보 학교 (교육청 + 검색어 필터)
          const candidates = accessData.schools.filter(s => {
            if (accessOffice !== 'all' && s.office !== accessOffice) return false;
            if (accessSearch && !s.name.includes(accessSearch.trim())) return false;
            return true;
          });
          const toggleSchool = (name) => {
            const next = new Set(selectedSet);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            setAccessSelected([...next]);
          };
          const selectAllCandidates = () => {
            const next = new Set(selectedSet);
            candidates.forEach(s => next.add(s.name));
            setAccessSelected([...next]);
          };
          const clearSelection = () => setAccessSelected([]);
          // 차트에 그릴 학교 (선택된 + 등록 데이터 존재)
          const charted = accessData.schools.filter(s => selectedSet.has(s.name));
          const officeNameMap = Object.fromEntries(regionMapData.map(r => [r.id, r.shortName || r.name]));
          const max = 100;
          const yLabels = Array.from({ length: 6 }, (_, i) => 100 - i * 20);
          const xs = accessData.months.map((_, i) => 60 + (i * 1120 / 11));
          return (
            <>
              {/* 필터 바 1행 — 교육청 select + 학교명 검색 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>🏛 교육청</label>
                <select
                  value={accessOffice}
                  onChange={(e) => setAccessOffice(e.target.value)}
                  style={{
                    padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px',
                    background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#1E2225', cursor: 'pointer',
                    minWidth: '180px',
                  }}
                >
                  <option value="all">전체 ({accessData.schools.length}개교)</option>
                  {regionMapData.map(r => {
                    const cnt = accessData.schools.filter(s => s.office === r.id).length;
                    if (cnt === 0) return null;
                    return <option key={r.id} value={r.id}>{r.name} ({cnt}개교)</option>;
                  })}
                </select>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>🔍</span>
                  <input
                    type="text"
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
                    placeholder="학교명 검색"
                    style={{
                      width: '100%', padding: '8px 12px 8px 34px',
                      border: '1px solid #E2E8F0', borderRadius: '8px',
                      fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                  전체 <strong style={{ color: '#1E2225' }}>{candidates.length}</strong>개교 / 선택 <strong style={{ color: '#2A75F3' }}>{selectedSet.size}</strong>개교
                </span>
                <button
                  onClick={selectAllCandidates}
                  style={{ padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', cursor: 'pointer' }}
                >전체 선택</button>
                <button
                  onClick={clearSelection}
                  style={{ padding: '6px 10px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FEF2F2', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}
                >전체 해제</button>
              </div>

              {/* 필터 바 2행 — 등록학교 chip 리스트 (좌우 스크롤) */}
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                padding: '8px 4px',
                marginBottom: '14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
              }}>
                {candidates.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
                    조건에 맞는 학교가 없습니다.
                  </div>
                ) : candidates.map(school => {
                  const checked = selectedSet.has(school.name);
                  // [v4.9] paidRatio ≥ 50% → 「유료 회원 우세 학교」 (영업 follow-up 우선) / < 50% → 「무료 회원 우세 학교」
                  const paidRatio = school.paidRatio || 0;
                  const freeRatio = 100 - paidRatio;
                  const isHighPaid = paidRatio >= 50;
                  // 색상 분기 — checked × isHighPaid 4가지 조합
                  const styleConfig = checked && isHighPaid
                    ? { border: '1.5px solid #F59E0B', background: '#FFF7ED', color: '#9A3412', checkBg: '#F59E0B', checkBorder: '#F59E0B', officeColor: '#FB923C' }
                    : checked
                    ? { border: '1px solid #2A75F3', background: '#EFF6FF', color: '#1D4ED8', checkBg: '#2A75F3', checkBorder: '#2A75F3', officeColor: '#60A5FA' }
                    : isHighPaid
                    ? { border: '1px solid #FED7AA', background: 'white', color: '#9A3412', checkBg: 'white', checkBorder: '#FED7AA', officeColor: '#FB923C' }
                    : { border: '1px solid #E2E8F0', background: 'white', color: '#475569', checkBg: 'white', checkBorder: '#CBD5E1', officeColor: '#94A3B8' };
                  return (
                    <button
                      key={school.name}
                      onClick={() => toggleSchool(school.name)}
                      style={{
                        flex: '0 0 auto',
                        padding: '6px 12px',
                        border: styleConfig.border,
                        borderRadius: '20px',
                        background: styleConfig.background,
                        color: styleConfig.color,
                        fontSize: 'var(--neo-font-size-sm)',
                        fontWeight: checked ? 700 : 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span style={{
                        display: 'inline-block', width: 14, height: 14, borderRadius: '4px',
                        border: `1px solid ${styleConfig.checkBorder}`,
                        background: styleConfig.checkBg,
                        // 14px 박스 안 체크 글리프. 舊 10px → xs(12px), 박스 높이는 그대로 수용된다
                        color: 'white', fontSize: 'var(--neo-font-size-xs)', lineHeight: '14px', textAlign: 'center', fontWeight: 900,
                      }}>{checked ? '✓' : ''}</span>
                      {isHighPaid && <span style={{ fontSize: 'var(--neo-font-size-sm)' }}>💎</span>}
                      {school.name}
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: styleConfig.officeColor }}>
                        {officeNameMap[school.office] || ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 차트 */}
              {charted.length === 0 ? (
                <div style={{
                  height: '300px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: '#FAFBFC', border: '1px dashed #CBD5E1', borderRadius: '12px',
                  color: '#94A3B8', fontSize: 'var(--neo-font-size-base)',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>📊</div>
                  <div style={{ fontWeight: 700, color: '#64748B' }}>표시할 학교를 선택하세요</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', marginTop: '4px' }}>위의 등록학교 목록에서 학교를 클릭하면 추세선이 추가됩니다.</div>
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                    {yLabels.map((label, i) => {
                      const y = 20 + (i * 270 / 5);
                      return (
                        <g key={i}>
                          <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                          <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}%</text>
                        </g>
                      );
                    })}
                    <line x1="60" y1="290" x2="1180" y2="290" stroke="#CBD5E1" strokeWidth="1" />
                    {charted.map((school, si) => {
                      const color = palette[si % palette.length];
                      const path = school.values.map((v, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (290 - (v / max) * 270)).join(' ');
                      return (
                        <g key={school.name}>
                          <path d={path} fill="none" stroke={color} strokeWidth="2" />
                          {school.values.map((v, i) => (
                            <circle key={i} cx={xs[i]} cy={290 - (v / max) * 270} r="3" fill="white" stroke={color} strokeWidth="2">
                              <title>{`${school.name} · ${accessData.months[i]}\n접속률 ${v}%`}</title>
                            </circle>
                          ))}
                        </g>
                      );
                    })}
                    {accessData.months.map((m, i) => (
                      <text key={i} x={xs[i]} y="312" textAnchor="middle" fontSize="12" fill="#64748B" fontWeight="500">{m}</text>
                    ))}
                  </svg>
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '12px', fontSize: 'var(--neo-font-size-sm)', flexWrap: 'wrap' }}>
                    {charted.map((s, i) => (
                      <span key={s.name} style={{ color: '#1E2225' }}>
                        <span style={{ display: 'inline-block', width: 16, height: 3, background: palette[i % palette.length], verticalAlign: 'middle', marginRight: 6 }}></span>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* ② 유료 vs 무료 — [v4.5] 접속률 % (중복 제거 로그인 / 활성 등록). 현재 월은 실시간 */}
        {accessView === 'paidFree' && (() => {
          const xs = accessData.paidFree.map((_, i) => 60 + (i * 1120 / 11));
          const yLabels = Array.from({ length: 6 }, (_, i) => 100 - i * 20);
          const paidPath = accessData.paidFree.map((d, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (290 - (d.paid / 100) * 270)).join(' ');
          const freePath = accessData.paidFree.map((d, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (290 - (d.free / 100) * 270)).join(' ');
          return (
            <>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '10px', lineHeight: 1.45 }}>
                <strong style={{ color: '#1E2225' }}>정의 — </strong>
                <span style={{ color: '#2A75F3', fontWeight: 700 }}>유료</span> / <span style={{ color: '#94A3B8', fontWeight: 700 }}>무료</span> 교사 월별 <strong>접속률 %</strong> = (그 월 1회 이상 로그인 한 교사 수 ÷ 활성 등록 교사 수) × 100. <strong>중복 제거</strong> (같은 교사 여러 번 로그인해도 1명).
                {' '}<span style={{ color: '#DC2626', fontWeight: 700 }}>🔴 Live</span> 표시 월은 현재 시점까지 실시간 (말일 도달 시 최종 확정).
              </div>
              <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                {yLabels.map((label, i) => {
                  const y = 20 + (i * 270 / 5);
                  return (
                    <g key={i}>
                      <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}%</text>
                    </g>
                  );
                })}
                <line x1="60" y1="290" x2="1180" y2="290" stroke="#CBD5E1" strokeWidth="1" />
                <path d={paidPath} fill="none" stroke="#2A75F3" strokeWidth="2.5" />
                <path d={freePath} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />
                {accessData.paidFree.map((d, i) => (
                  <g key={i}>
                    {d.paid > 0 && (
                      <circle cx={xs[i]} cy={290 - (d.paid / 100) * 270} r={d.isCurrent ? 5 : 3.5} fill={d.isCurrent ? '#DC2626' : 'white'} stroke="#2A75F3" strokeWidth="2">
                        <title>{`${d.month}${d.isCurrent ? ' (🔴 Live · 현재 시점까지)' : ''} · 유료 교사 접속률\n${d.paid}%`}</title>
                      </circle>
                    )}
                    {d.free > 0 && (
                      <circle cx={xs[i]} cy={290 - (d.free / 100) * 270} r={d.isCurrent ? 4.5 : 3} fill={d.isCurrent ? '#DC2626' : 'white'} stroke="#94A3B8" strokeWidth="2">
                        <title>{`${d.month}${d.isCurrent ? ' (🔴 Live · 현재 시점까지)' : ''} · 무료 교사 접속률\n${d.free}%`}</title>
                      </circle>
                    )}
                    <text x={xs[i]} y="312" textAnchor="middle" fontSize="12" fill={d.isCurrent ? '#DC2626' : '#64748B'} fontWeight={d.isCurrent ? 800 : 500}>{d.isCurrent ? `🔴 ${d.month}` : d.month}</text>
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px', fontSize: 'var(--neo-font-size-sm)' }}>
                <span><span style={{ display: 'inline-block', width: 16, height: 3, background: '#2A75F3', verticalAlign: 'middle', marginRight: 6 }}></span>유료 교사 접속률</span>
                <span><span style={{ display: 'inline-block', width: 16, height: 3, background: '#94A3B8', verticalAlign: 'middle', marginRight: 6 }}></span>무료 교사 접속률</span>
                <span style={{ color: '#DC2626', fontWeight: 700 }}>🔴 현재 월은 실시간 누적</span>
              </div>
            </>
          );
        })()}

        {/* ③ 첫 접속 vs 재접속 (Stacked Bar) — MAU = newT + returnT */}
        {accessView === 'newReturn' && (() => {
          const colW = 1120 / 12;
          const barW = colW * 0.55;
          // Y축 max: 월별 합계 최댓값을 5명 단위로 다음 구간 올림 (예: 50→55, 55→60). 최소 55명 보장
          const rawMax = Math.max(...accessData.newReturn.map(d => d.newT + d.returnT), 50);
          const max = (Math.floor(rawMax / 5) + 1) * 5;
          const yLabels = Array.from({ length: 6 }, (_, i) => Math.round(max * (1 - i / 5)));
          return (
            <>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 10px', lineHeight: 1.45 }}>
                <strong style={{ color: '#1E2225' }}>정의 — </strong>
                <span style={{ color: '#10B981', fontWeight: 700 }}>첫 접속</span>: 해당 월에 처음으로 로그인한 교사 (가입 시점은 그 이전일 수 있음) ·{' '}
                <span style={{ color: '#2A75F3', fontWeight: 700 }}>재접속</span>: 이전에 로그인 경험이 있고 해당 월에 다시 로그인한 교사. 신규 회원가입 추이는 「교육청별 가입 현황 → 신규 가입 추이」 차트 참고.
              </p>
              <svg viewBox="0 0 1200 350" style={{ width: '100%', height: 'auto' }}>
                {yLabels.map((label, i) => {
                  const y = 20 + (i * 270 / 5);
                  return (
                    <g key={i}>
                      <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}명</text>
                    </g>
                  );
                })}
                <line x1="60" y1="290" x2="1180" y2="290" stroke="#CBD5E1" strokeWidth="1" />
                {accessData.newReturn.map((d, i) => {
                  const cx = 60 + (i + 0.5) * colW;
                  const x = cx - barW / 2;
                  const newH = (d.newT / max) * 270;
                  const retH = (d.returnT / max) * 270;
                  const active = d.newT + d.returnT;
                  // [v4.5] 통합 tooltip — 어느 segment에 hover해도 동일하게 전체·첫접속·재접속 함께 노출
                  const combinedTitle = `${d.month}\n전체: ${active}명\n첫 접속: ${d.newT}명\n재접속: ${d.returnT}명`;
                  return (
                    <g key={i}>
                      {retH > 0 && <rect x={x} y={290 - retH} width={barW} height={retH} fill="#2A75F3"><title>{combinedTitle}</title></rect>}
                      {newH > 0 && <rect x={x} y={290 - retH - newH} width={barW} height={newH} fill="#10B981"><title>{combinedTitle}</title></rect>}
                      <text x={cx} y="312" textAnchor="middle" fontSize="12" fill="#64748B">{d.month}</text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px', fontSize: 'var(--neo-font-size-sm)', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', borderRadius: 2, marginRight: 6 }}></span>첫 접속</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2A75F3', borderRadius: 2, marginRight: 6 }}></span>재접속</span>
              </div>
            </>
          );
        })()}

        {/* ④ 요일×시간 (Heatmap, 접속률 % 대신 접속 회수) */}
        {accessView === 'hourly' && (() => {
          const grid = accessData.hourlyHeatmap;
          const max = Math.max(1, ...grid.flat());
          const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
          const cellW = 1100 / 24;
          const cellH = 32;
          return (
            <>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '10px', fontWeight: 600 }}>
                🕐 요일·시간대별 교사 로그인 빈도 — <span style={{ color: '#94A3B8', fontWeight: 500 }}>서비스 기간 누적 (1일 1회 기준)</span>
              </div>
              <svg viewBox={`0 0 1200 ${30 + 7 * cellH + 30}`} style={{ width: '100%', height: 'auto' }}>
                {Array.from({ length: 24 }, (_, h) => h % 4 === 0 ? <text key={h} x={60 + h * cellW + cellW / 2} y="22" textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="600">{h}시</text> : null)}
                {grid.map((row, day) => row.map((value, hour) => {
                  const intensity = value / max;
                  const fill = intensity === 0 ? '#F8FAFC' : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`;
                  return (
                    <rect key={`${day}-${hour}`} x={60 + hour * cellW + 1} y={30 + day * cellH + 1} width={cellW - 2} height={cellH - 2} fill={fill} rx="2">
                      <title>{`${dayLabels[day]} ${hour}시\n접속 ${value}건`}</title>
                    </rect>
                  );
                }))}
                {dayLabels.map((d, i) => (
                  <text key={i} x="50" y={30 + i * cellH + cellH / 2 + 4} textAnchor="end" fontSize="12" fill="#475569" fontWeight="600">{d}</text>
                ))}
              </svg>
            </>
          );
        })()}

      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* 학교급별 과제 활동 (생성/채점 × 전체/유료/무료)                   */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="sec-school-task" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginTop: '1.5rem', scrollMarginTop: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>학교급별 과제 활동</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>
              {schoolTaskView === 'levelTime' && schoolTaskMetric === 'creation' && '과제 생성 = 학년도 단위 신규 등록 (월별 변동 시각화). 누적 보유 과제는 「📚 누적 보유 과제」 탭에서 확인'}
              {schoolTaskView === 'levelTime' && schoolTaskMetric === 'grading' && '채점 활동 = 그 학년도에 교사가 검토 완료한 채점 건 (학년 reset 영향)'}
              {schoolTaskView === 'levelActivity' && '학교급별 과제 활동·활용률 — 생성·채점 누적 비중과 활용률을 한 차트에서 확인 (v4.10 비중·활동률 통합)'}
              {schoolTaskView !== 'levelTime' && schoolTaskView !== 'levelActivity' && '학교급별 과제 활동 분석 (생성·채점·활용률 비교)'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {/* 메트릭 토글: 생성 / 채점 — levelTime 탭에서만 노출 (다른 탭은 둘 다 동시 렌더 또는 비율 차트) */}
            {schoolTaskView === 'levelTime' && (
              <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '4px', gap: '2px' }}>
                {[
                  { id: 'creation', label: '📝 과제 생성' },
                  { id: 'grading',  label: '✓ 채점 활동' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSchoolTaskMetric(m.id)}
                    style={{
                      padding: '8px 16px', border: 'none', borderRadius: '8px',
                      background: schoolTaskMetric === m.id ? 'white' : 'transparent',
                      color: schoolTaskMetric === m.id ? '#2A75F3' : '#64748B',
                      fontSize: 'var(--neo-font-size-sm)',
                      fontWeight: schoolTaskMetric === m.id ? 800 : 700,
                      cursor: 'pointer',
                      boxShadow: schoolTaskMetric === m.id ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >{m.label}</button>
                ))}
              </div>
            )}
            {/* 교사 등급 sub-filter */}
            <div style={{ display: 'inline-flex', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              {[
                { id: 'all',  label: '전체 교사' },
                { id: 'paid', label: '💎 유료' },
                { id: 'free', label: '무료' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSchoolTaskTier(f.id)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: '6px',
                    background: schoolTaskTier === f.id ? '#FB923C' : 'transparent',
                    color: schoolTaskTier === f.id ? 'white' : '#9A3412',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: schoolTaskTier === f.id ? 800 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'levelActivity',  label: '📊 학교급별 활동·활용률' },
            { id: 'levelSubject',   label: '🔥 학교급 × 교과 매트릭스' },
            { id: 'levelTime',      label: '📈 학교급별 월별 추세' },
            { id: 'cumulative',     label: '📚 누적 보유 과제' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSchoolTaskView(tab.id)}
              style={{
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: schoolTaskView === tab.id ? '2px solid #2A75F3' : '2px solid transparent',
                color: schoolTaskView === tab.id ? '#2A75F3' : '#64748B',
                fontSize: 'var(--neo-font-size-sm)', fontWeight: schoolTaskView === tab.id ? 800 : 600,
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px',
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* [v4.14] 탭 content 영역 고정 높이 — 메뉴 전환 시 화면 흔들림 방지 */}
        <div style={{ minHeight: '720px' }}>

        {/* ① [v4.10] 학교급별 활동·활용률 — 「학교급별 비중」 + 「채점 활동률」 단일 막대 차트로 통합 */}
        {schoolTaskView === 'levelActivity' && (() => {
          const levelNames = ['초등학교', '중학교', '고등학교'];
          const colors = schoolTaskData.polarColors;
          const creationVals = schoolTaskData.polar.creation[schoolTaskTier];
          const gradingVals  = schoolTaskData.polar.grading[schoolTaskTier];
          const data = levelNames.map((name, i) => ({
            name,
            creation: creationVals[i],
            grading: gradingVals[i],
            color: colors[i],
            rate: creationVals[i] > 0 ? (gradingVals[i] / creationVals[i]) * 100 : 0,
          }));
          const totalCreation = creationVals.reduce((s, v) => s + v, 0);
          const maxScale = Math.max(...creationVals, 1);
          const barAreaW = 560; // 가로 막대 max 길이 (px)
          return (
            <div style={{ padding: '8px 0' }}>
              {/* 범례 삭제 (v4.12) — 행 라벨에 「과제 생성」/「과제 채점」 직접 표기되어 범례 중복 */}
              {/* 학교급별 그룹 막대 (3 학교급 × 2 막대) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {data.map((d, i) => {
                  const wCreation = (d.creation / maxScale) * barAreaW;
                  const wGrading  = (d.grading  / maxScale) * barAreaW;
                  const sharePct = totalCreation > 0 ? (d.creation / totalCreation) * 100 : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* 학교급 라벨 */}
                      <div style={{ minWidth: '110px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-block', width: 12, height: 12, background: d.color, borderRadius: 3 }}></span>
                        <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>{d.name}</span>
                      </div>
                      {/* 막대 2개 (생성 + 채점) */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: `${barAreaW}px` }}>
                        {/* 생성 막대 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, minWidth: '54px' }}>과제 생성</span>
                          <div style={{ position: 'relative', flex: 1, height: '22px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              title={`${d.name} · 과제 생성 ${d.creation}건 (전체 ${sharePct.toFixed(1)}%)`}
                              style={{
                                width: `${(d.creation / maxScale) * 100}%`,
                                height: '100%',
                                background: d.color,
                                opacity: 0.28,
                                border: `1px dashed ${d.color}`,
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', minWidth: '46px', textAlign: 'right' }}>{d.creation}건</span>
                        </div>
                        {/* 채점 막대 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, minWidth: '54px' }}>과제 채점</span>
                          <div style={{ position: 'relative', flex: 1, height: '22px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              title={`${d.name} · 채점 활동 ${d.grading}건`}
                              style={{
                                width: `${(d.grading / maxScale) * 100}%`,
                                height: '100%',
                                background: d.color,
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: d.color, minWidth: '46px', textAlign: 'right' }}>{d.grading}건</span>
                        </div>
                      </div>
                      {/* 우측: 활용률 + 비중 */}
                      <div style={{ minWidth: '110px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', padding: '6px 12px', background: '#F8FAFC', borderRadius: '8px', border: `1.5px solid ${d.color}33` }}>
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>활용률</span>
                        <span style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: d.color, lineHeight: 1 }}>{d.rate.toFixed(0)}%</span>
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 600 }}>비중 {sharePct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 하단 안내 */}
              <div style={{ marginTop: '14px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
                ※ 막대 길이는 학교급 간 <strong style={{ color: '#475569' }}>비중(volume) 비교</strong>, 우측 활용률은 <strong style={{ color: '#475569' }}>채점 ÷ 생성</strong> — 두 시각을 한 차트에서 동시 확인
              </div>
            </div>
          );
        })()}

        {/* ② 학교급 × 교과 Heatmap — dual-display (생성 + 채점 + 활용률, 좌우 스크롤) */}
        {schoolTaskView === 'levelSubject' && (() => {
          const { levels, subjects } = schoolTaskData.levelSubject;
          const creationGrid = schoolTaskData.levelSubject.creation[schoolTaskTier];
          const gradingGrid  = schoolTaskData.levelSubject.grading[schoolTaskTier];
          // 색상 강도는 생성 volume 기준 (어디서 활동이 집중되었나)
          const max = Math.max(...creationGrid.flat(), 1);
          const cellW = 120, cellH = 70;
          const offsetX = 110, offsetY = 50;
          const chartWidth = offsetX + subjects.length * cellW + 20;
          const chartHeight = offsetY + levels.length * cellH + 30;
          return (
            <>
              {/* [v4.2] 차트 부제 — 「교과별 AI 채점 활용 → 학교급 × 교과」와 차별화 */}
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                📊 학교급 × 교과별 활동 분포 — 과제 생성·채점·활용률 통합 (등급별 분기)
              </div>
              {/* [v4.13] 셀 비율 분석 설명 박스 — 교과별 AI 채점 매트릭스와 동일 패턴 */}
              {(() => {
                // 채점 건수 기반 3종 비율 산출
                const overallRow = subjects.map((_, hi) => levels.reduce((s, _, di) => s + gradingGrid[di][hi], 0));
                const overallCol = gradingGrid.map(row => row.reduce((s, v) => s + v, 0));
                const cornerSum = gradingGrid.flat().reduce((s, v) => s + v, 0);
                const tierLabel = schoolTaskTier === 'all' ? '전체' : schoolTaskTier === 'paid' ? '유료' : '무료';
                // 예시 셀: 좌상단 일반 셀 (초등학교 × 국어)
                const exLevel = levels[0];
                const exSubject = subjects[0];
                const exVal = gradingGrid[0][0];
                const exRowSum = overallCol[0]; // 그 학교급의 모든 교과 합
                const exColSum = overallRow[0]; // 그 교과의 모든 학교급 합
                const exOverallPct = cornerSum > 0 ? (exVal / cornerSum) * 100 : 0;
                const exRowPct = exRowSum > 0 ? (exVal / exRowSum) * 100 : 0;
                const exColPct = exColSum > 0 ? (exVal / exColSum) * 100 : 0;
                return (
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: '12px', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 800, color: '#1E2225', marginBottom: '6px' }}>📊 셀 비율 분석 — 3가지 관점 (채점 건수 기준)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <span style={{ color: '#1D4ED8', fontWeight: 800 }}>★ 전체 대비</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>{tierLabel} 매트릭스 전체(3 × 5 = 15셀 합)</strong> × 100</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontWeight: 700 }}>학교급 내 비율</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>그 학교급의 전체 합(행 합계)</strong> × 100 — 한 학교급 내 교과 비중</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontWeight: 700 }}>교과 내 비율</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>그 교과의 전체 합(열 합계)</strong> × 100 — 한 교과 내 학교급 비중</span>
                      </div>
                    </div>
                    {/* 예시 계산 (좌상단 셀 기준 실제 mock 값) */}
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: 'white', border: '1px dashed #CBD5E1', borderRadius: '6px' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>💡 예시 계산 — <strong style={{ color: '#1E2225' }}>{exLevel} · {exSubject}</strong> 셀 (채점 {exVal.toLocaleString()}건)</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace' }}>
                        <div><span style={{ color: '#1D4ED8', fontWeight: 800 }}>★ 전체 대비</span> &nbsp;&nbsp;= {exVal.toLocaleString()} ÷ {cornerSum.toLocaleString()} × 100 = <strong style={{ color: '#1D4ED8' }}>{exOverallPct.toFixed(1)}%</strong></div>
                        <div><span style={{ color: '#64748B', fontWeight: 700 }}>학교급 내 비율</span> = {exVal.toLocaleString()} ÷ {exRowSum.toLocaleString()} × 100 = <strong style={{ color: '#1E2225' }}>{exRowPct.toFixed(1)}%</strong></div>
                        <div><span style={{ color: '#64748B', fontWeight: 700 }}>교과 내 비율</span> &nbsp;&nbsp;= {exVal.toLocaleString()} ÷ {exColSum.toLocaleString()} × 100 = <strong style={{ color: '#1E2225' }}>{exColPct.toFixed(1)}%</strong></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: 'block' }}>
                  <rect x="0" y="0" width={offsetX} height={chartHeight} fill="white" />
                  {subjects.map((s, i) => (
                    <text key={i} x={offsetX + i * cellW + cellW / 2} y={offsetY - 12} textAnchor="middle" fontSize="12" fill="#475569" fontWeight="700">{s}</text>
                  ))}
                  {levels.map((l, di) => (
                    <g key={di}>
                      <text x={offsetX - 10} y={offsetY + di * cellH + cellH / 2 + 4} textAnchor="end" fontSize="13" fill="#475569" fontWeight="700">{l}</text>
                      {creationGrid[di].map((c, hi) => {
                        const g = gradingGrid[di][hi];
                        const rate = c > 0 ? (g / c) * 100 : 0;
                        const intensity = c / max;
                        const fill = `rgba(42, 117, 243, ${0.1 + intensity * 0.85})`;
                        const textColor = intensity > 0.5 ? 'white' : '#1E2225';
                        const subColor = intensity > 0.5 ? 'rgba(255,255,255,0.85)' : '#475569';
                        return (
                          <g key={hi}>
                            <rect x={offsetX + hi * cellW + 2} y={offsetY + di * cellH + 2} width={cellW - 4} height={cellH - 4} fill={fill} rx="4">
                              <title>{`${l} · ${subjects[hi]}\n생성 ${c}건\n채점 ${g}건\n활용률 ${rate.toFixed(1)}%`}</title>
                            </rect>
                            <text x={offsetX + hi * cellW + cellW / 2} y={offsetY + di * cellH + cellH / 2 - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill={textColor}>{c}</text>
                            <text x={offsetX + hi * cellW + cellW / 2} y={offsetY + di * cellH + cellH / 2 + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill={subColor}>채점 {g} · {rate.toFixed(0)}%</text>
                          </g>
                        );
                      })}
                    </g>
                  ))}
                </svg>
              </div>
            </>
          );
        })()}

        {/* ③ 학교급 × 시간 멀티라인 — [v4.11.1] 학년도 단위 그대로 (월별 추세 본질 회복). 누적 보유 과제는 신규 탭 「📚 누적 보유 과제」로 분리 */}
        {schoolTaskView === 'levelTime' && (() => {
          const data = schoolTaskData.levelTime[schoolTaskMetric][schoolTaskTier];
          const metricLabel = schoolTaskMetric === 'creation' ? '과제 생성' : '채점 활동';
          const max = Math.max(50, ...data.flatMap(d => [d.초등, d.중학, d.고등]));
          const xs = data.map((_, i) => 60 + (i * 1120 / 11));
          const yLabels = Array.from({ length: 6 }, (_, i) => Math.round(max * (1 - i / 5)));
          const seriesNames = ['초등', '중학', '고등'];
          const colors = ['#10B981', '#2A75F3', '#8B5CF6'];
          return (
            <>
              <svg viewBox="0 0 1200 350" style={{ width: '100%' }}>
                {yLabels.map((label, i) => {
                  const y = 20 + (i * 270 / 5);
                  return (
                    <g key={i}>
                      <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" />
                      <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}건</text>
                    </g>
                  );
                })}
                <line x1="60" y1="290" x2="1180" y2="290" stroke="#CBD5E1" />
                {seriesNames.map((name, si) => {
                  const key = name;
                  const path = data.map((d, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (290 - (d[key] / max) * 270)).join(' ');
                  return (
                    <g key={si}>
                      <path d={path} fill="none" stroke={colors[si]} strokeWidth="2" />
                      {data.map((d, i) => d[key] === 0 ? null : (
                        <circle key={i} cx={xs[i]} cy={290 - (d[key] / max) * 270} r="3" fill="white" stroke={colors[si]} strokeWidth="2">
                          <title>{`${name}학교 · ${d.month}\n${metricLabel} ${d[key]}건`}</title>
                        </circle>
                      ))}
                    </g>
                  );
                })}
                {data.map((d, i) => (
                  <text key={i} x={xs[i]} y="312" textAnchor="middle" fontSize="12" fill="#64748B">{d.month}</text>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px', fontSize: 'var(--neo-font-size-sm)' }}>
                {seriesNames.map((n, i) => (
                  <span key={i}><span style={{ display: 'inline-block', width: 16, height: 3, background: colors[i], verticalAlign: 'middle', marginRight: 6 }}></span>{n}학교</span>
                ))}
              </div>
              <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', textAlign: 'center' }}>
                생성과 채점 누적 비교·활용률은 <strong style={{ color: '#1E2225' }}>「📊 학교급별 활동·활용률」</strong> 탭에서 확인하세요 (cohort 시차가 평탄화된 누적 비교에 적합)
              </div>
            </>
          );
        })()}

        {/* ④ [v4.10] 학교급별 채점 활동률 탭 삭제 — 「📊 학교급별 활동·활용률」 탭에 통합 (생성·채점 막대 + 활용률 % 단일 차트) */}

        {/* ⑤ [v4.11.2] 누적 보유 과제 — 메트릭 카드 그리드 (누적 + 올해 신규 dual-display) */}
        {schoolTaskView === 'cumulative' && (() => {
          const cum = schoolTaskData.cumulative;
          // 메트릭 카드 — 학교급/과목 공통 디자인
          const MetricCard = ({ icon, name, total, newThisYear, color }) => (
            <div style={{
              background: 'white',
              border: `1.5px solid ${color}33`,
              borderTop: `4px solid ${color}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(15,23,42,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(15,23,42,0.04)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-lg)' }}>{icon}</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>{name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>현재까지 누적</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color }}>{total.toLocaleString()}</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>개</span>
              </div>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#047857', fontWeight: 700 }}>+ 올해 신규</span>
                <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#10B981' }}>{newThisYear.toLocaleString()}개</span>
              </div>
            </div>
          );
          return (
            <div style={{ padding: '8px 0' }}>
              {/* 헤더 카드 — 전체 보유 과제 총량 */}
              <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700, marginBottom: '6px' }}>📚 전체 보유 과제 (학년도 무관 영구 보존)</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>현재까지 누적</span>
                    <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#1D4ED8' }}>{cum.total.toLocaleString()}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 700, color: '#475569' }}>개</span>
                  </div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#047857', fontWeight: 700, marginBottom: '2px' }}>+ 올해 신규 등록</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: '#10B981' }}>{cum.newThisYear.toLocaleString()}<span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, marginLeft: '4px' }}>개</span></div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', textAlign: 'center', marginBottom: '16px' }}>
                ※ 과제는 학년 reset 영향 없이 영구 보존되어 매년 재활용 가능합니다. 학생·채점 데이터만 학년 종료 시 초기화됩니다.
              </div>

              {/* 학교급별 카드 그리드 (3개) */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: '12px' }}>🏛 학교급별</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {cum.byLevel.map((l, i) => (
                    <MetricCard key={i} icon={l.icon} name={l.name} total={l.total} newThisYear={l.newThisYear} color={l.color} />
                  ))}
                </div>
              </div>

              {/* [v4.16] 교과별 카드 그리드 (5개) — 항목명 「과목별」 → 「교과별」 정정 */}
              <div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: '12px' }}>📚 교과별</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
                  {cum.bySubject.map((s, i) => (
                    <MetricCard key={i} icon={s.icon} name={s.name} total={s.total} newThisYear={s.newThisYear} color={s.color} />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        </div>{/* /[v4.14] 탭 content 고정 높이 wrapper */}
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* 교과별 AI 채점 활용                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="sec-subject-ai" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginTop: '1.5rem', scrollMarginTop: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>교과별 AI 채점 활용</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>교과별 채점 비율을 파악하여 서비스 대상을 좁힐 수 있습니다.</p>
          </div>
          {/* 월별 추세 탭에서만 등급 sub-filter 노출 */}
          {subjectAiView === 'trend' && (
            <div style={{ display: 'inline-flex', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              {[
                { id: 'all',  label: '전체 교사' },
                { id: 'paid', label: '💎 유료' },
                { id: 'free', label: '무료' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSubjectAiTier(f.id)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: '6px',
                    background: subjectAiTier === f.id ? '#FB923C' : 'transparent',
                    color: subjectAiTier === f.id ? 'white' : '#9A3412',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: subjectAiTier === f.id ? 800 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >{f.label}</button>
              ))}
            </div>
          )}
          {/* [v4.5] 평가유형 sub-filter — 시계열·매트릭스만. AI vs 교사 재검토 탭은 등급평가 한정이라 sub-filter 비노출 */}
          {subjectAiView !== 'aiVsTeacher' && (
            <div style={{ display: 'inline-flex', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '3px', gap: '2px', marginLeft: subjectAiView === 'trend' ? '8px' : 0 }}>
              {[
                { id: 'all',     label: '전체' },
                { id: 'grade',   label: '📋 등급평가' },
                { id: 'process', label: '🔍 과정 분석' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSubjectAiEvalType(f.id)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: '6px',
                    background: subjectAiEvalType === f.id ? '#2A75F3' : 'transparent',
                    color: subjectAiEvalType === f.id ? 'white' : '#1D4ED8',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: subjectAiEvalType === f.id ? 800 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >{f.label}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'trend',         label: '📈 월별 추세' },
            { id: 'levelSubject',  label: '🔥 학교급 × 교과' },
            { id: 'aiVsTeacher',   label: '🤝 AI vs 교사 재검토' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubjectAiView(tab.id)}
              style={{
                padding: '10px 16px', background: 'transparent', border: 'none',
                borderBottom: subjectAiView === tab.id ? '2px solid #2A75F3' : '2px solid transparent',
                color: subjectAiView === tab.id ? '#2A75F3' : '#64748B',
                fontSize: 'var(--neo-font-size-sm)', fontWeight: subjectAiView === tab.id ? 800 : 600,
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px',
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* ① 월별 추세 (교과별 멀티라인 + 교사 등급 + 평가유형 sub-filter) */}
        {subjectAiView === 'trend' && (() => {
          const data = subjectAiData.trend[subjectAiTier][subjectAiEvalType];
          const max = Math.max(40, ...data.flatMap(d => [d.국어, d.수학, d.영어, d.사회, d.과학]));
          const xs = data.map((_, i) => 60 + (i * 1120 / 11));
          const yLabels = Array.from({ length: 6 }, (_, i) => Math.round(max * (1 - i / 5)));
          const seriesKeys = ['국어', '수학', '영어', '사회', '과학'];
          const colors = ['#2A75F3', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'];
          return (
            <>
              <svg viewBox="0 0 1200 350" style={{ width: '100%' }}>
                {yLabels.map((label, i) => {
                  const y = 20 + (i * 270 / 5);
                  return (
                    <g key={i}>
                      <line x1="60" y1={y} x2="1180" y2={y} stroke="#F1F5F9" />
                      <text x="52" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{label}건</text>
                    </g>
                  );
                })}
                <line x1="60" y1="290" x2="1180" y2="290" stroke="#CBD5E1" />
                {seriesKeys.map((key, si) => {
                  const path = data.map((d, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (290 - (d[key] / max) * 270)).join(' ');
                  return (
                    <g key={si}>
                      <path d={path} fill="none" stroke={colors[si]} strokeWidth="2" />
                      {data.map((d, i) => d[key] === 0 ? null : (
                        <circle key={i} cx={xs[i]} cy={290 - (d[key] / max) * 270} r="3" fill="white" stroke={colors[si]} strokeWidth="2">
                          <title>{`${key} · ${d.month}\n${d[key]}건`}</title>
                        </circle>
                      ))}
                    </g>
                  );
                })}
                {data.map((d, i) => (
                  <text key={i} x={xs[i]} y="312" textAnchor="middle" fontSize="12" fill="#64748B">{d.month}</text>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '8px', fontSize: 'var(--neo-font-size-sm)', flexWrap: 'wrap' }}>
                {seriesKeys.map((k, i) => (
                  <span key={i}><span style={{ display: 'inline-block', width: 16, height: 3, background: colors[i], verticalAlign: 'middle', marginRight: 6 }}></span>{k}</span>
                ))}
              </div>
            </>
          );
        })()}

        {/* ② 학교급 × 교과 매트릭스 (채점 건수) — 좌우 스크롤 + 「전체」 행 + 「전체」 컬럼 */}
        {/* [v4.5] PRD §3 「🔥 학교급 × 교과 — 계산식 — 셀별 산출 정의」 표 참조 — 비즈니스 항목 기준 산출식 */}
        {subjectAiView === 'levelSubject' && (() => {
          const { levels, subjects, grid: gridByEvalType } = subjectAiData.levelSubject;
          const grid = gridByEvalType[subjectAiEvalType];

          // ── 셀 값 산출식 (PRD v4.5 표) ──
          // 「전체」 행 = 그 교과의 모든 학교급 채점 건수 합계 (초등 + 중학 + 고등)
          const overallRow = subjects.map((_, hi) => levels.reduce((s, _, di) => s + grid[di][hi], 0));
          // 「전체」 컬럼 = 그 학교급의 모든 교과 채점 건수 합계 (국 + 수 + 영 + 사 + 과)
          const overallCol = grid.map(row => row.reduce((s, v) => s + v, 0));
          // 우하단 corner = 매트릭스 전체 누적 채점 건수 (3 × 5 = 15셀 합) — 분석율의 분모
          const cornerSum = grid.flat().reduce((s, v) => s + v, 0);

          // ── 정합성 검증 룰 (PRD v4.5) — dev mode 시 console.assert로 인지 ──
          if (process.env.NODE_ENV !== 'production') {
            // 룰 1: 매트릭스 전체 누적 = 「전체」 행 모든 값의 합 = 「전체」 컬럼 모든 값의 합
            const sumRow = overallRow.reduce((s, v) => s + v, 0);
            const sumCol = overallCol.reduce((s, v) => s + v, 0);
            console.assert(sumRow === cornerSum, `[v4.5] 매트릭스 전체 누적(${cornerSum}) ≠ 「전체」 행 합(${sumRow})`);
            console.assert(sumCol === cornerSum, `[v4.5] 매트릭스 전체 누적(${cornerSum}) ≠ 「전체」 컬럼 합(${sumCol})`);
            // 룰 2: 모든 일반 셀의 분석율 합 = 100% (반올림 차분 ±0.1%p 허용)
            if (cornerSum > 0) {
              const ratioSum = grid.flat().reduce((s, v) => s + (v / cornerSum) * 100, 0);
              console.assert(Math.abs(ratioSum - 100) < 0.1, `[v4.5] 분석율 합 100% 위반: ${ratioSum.toFixed(2)}%`);
            }
          }

          const totalLevels = [...levels, '전체'];
          const totalSubjects = [...subjects, '전체'];
          // 통합 매트릭스 (4행 × 6열): 일반 셀 + 「전체」 행/컬럼 + 우하단 corner
          const totalGrid = totalLevels.map((l, di) => {
            const isLevelTotal = l === '전체';
            return totalSubjects.map((s, hi) => {
              const isSubjectTotal = s === '전체';
              if (isLevelTotal && isSubjectTotal) return cornerSum;          // 우하단 corner = 전체 누적
              if (isLevelTotal) return overallRow[hi];                       // 「전체」 행 = 그 교과의 학교급 합계
              if (isSubjectTotal) return overallCol[di];                     // 「전체」 컬럼 = 그 학교급의 교과 합계
              return grid[di][hi];                                           // 일반 셀 = 그 학교급·교과 채점 건수
            });
          });
          const max = Math.max(...grid.flat());
          // 분석율 = 이 셀 ÷ cornerSum × 100 (분자: 셀 값 / 분모: 매트릭스 전체 누적)
          const evalTypeLabel = subjectAiEvalType === 'all' ? '전체' : subjectAiEvalType === 'grade' ? '등급평가' : '과정 분석';
          const cellW = 120, cellH = 60;
          const offsetX = 110, offsetY = 50;
          const chartWidth = offsetX + totalSubjects.length * cellW + 20;
          const chartHeight = offsetY + totalLevels.length * cellH + 30;
          return (
            <>
              {/* [v4.6] 차트 부제 — 비율의 의미(매트릭스 전체 대비)를 부제에서 강조 */}
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600, marginBottom: '4px' }}>
                📊 학교급 × 교과별 AI 채점 분포 — 채점 건수 + <span style={{ color: '#1D4ED8', fontWeight: 800 }}>매트릭스 전체 대비 비율</span> (평가유형별 분기)
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginBottom: '8px' }}>
                ※ 셀의 비율(%)은 학교급 내 비율이나 교과 내 비율이 아닌, <strong style={{ color: '#475569' }}>15셀(3 × 5) 전체 채점 중 그 셀이 차지하는 비중</strong>입니다.
              </div>
              {/* [v4.9] 호버 분석 내용을 설명에 통합 — 셀별 비율 해석 가이드 */}
              {(() => {
                // 예시 셀: 좌상단 일반 셀(초등학교 × 국어) 기준으로 실제 mock 값 표시
                const exLevel = levels[0];
                const exSubject = subjects[0];
                const exVal = grid[0][0];
                const exRowSum = overallCol[0];
                const exColSum = overallRow[0];
                const exOverallPct = cornerSum > 0 ? (exVal / cornerSum) * 100 : 0;
                const exRowPct = exRowSum > 0 ? (exVal / exRowSum) * 100 : 0;
                const exColPct = exColSum > 0 ? (exVal / exColSum) * 100 : 0;
                return (
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: '12px', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 800, color: '#1E2225', marginBottom: '6px' }}>📊 셀 비율 분석 — 3가지 관점</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        <span style={{ color: '#1D4ED8', fontWeight: 800 }}>★ 전체 대비</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>{evalTypeLabel} 매트릭스 전체(15셀 합)</strong> × 100 — <span style={{ color: '#1D4ED8', fontWeight: 700 }}>화면 셀에 표시되는 % 값</span></span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontWeight: 700 }}>학교급 내 비율</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>그 학교급의 전체 합(행 합계)</strong> × 100 — 한 학교급 내 교과 비중</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', fontWeight: 700 }}>교과 내 비율</span>
                        <span style={{ color: '#94A3B8', margin: '0 6px' }}>=</span>
                        <span>셀 채점 건수 ÷ <strong style={{ color: '#475569' }}>그 교과의 전체 합(열 합계)</strong> × 100 — 한 교과 내 학교급 비중</span>
                      </div>
                    </div>
                    {/* 예시 계산 (좌상단 셀 기준 실제 mock 값) */}
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: 'white', border: '1px dashed #CBD5E1', borderRadius: '6px' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>💡 예시 계산 — <strong style={{ color: '#1E2225' }}>{exLevel} · {exSubject}</strong> 셀 ({exVal.toLocaleString()}건)</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace' }}>
                        <div><span style={{ color: '#1D4ED8', fontWeight: 800 }}>★ 전체 대비</span> &nbsp;&nbsp;= {exVal.toLocaleString()} ÷ {cornerSum.toLocaleString()} × 100 = <strong style={{ color: '#1D4ED8' }}>{exOverallPct.toFixed(1)}%</strong></div>
                        <div><span style={{ color: '#64748B', fontWeight: 700 }}>학교급 내 비율</span> = {exVal.toLocaleString()} ÷ {exRowSum.toLocaleString()} × 100 = <strong style={{ color: '#1E2225' }}>{exRowPct.toFixed(1)}%</strong></div>
                        <div><span style={{ color: '#64748B', fontWeight: 700 }}>교과 내 비율</span> &nbsp;&nbsp;= {exVal.toLocaleString()} ÷ {exColSum.toLocaleString()} × 100 = <strong style={{ color: '#1E2225' }}>{exColPct.toFixed(1)}%</strong></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: 'block' }}>
                  <rect x="0" y="0" width={offsetX} height={chartHeight} fill="white" />
                  {totalSubjects.map((s, i) => {
                    const isSubjectTotal = s === '전체';
                    return (
                      <text key={i} x={offsetX + i * cellW + cellW / 2} y={offsetY - 12} textAnchor="middle" fontSize="12" fill={isSubjectTotal ? '#1E2225' : '#475569'} fontWeight={isSubjectTotal ? 800 : 700}>{s}</text>
                    );
                  })}
                {totalLevels.map((l, di) => {
                  const isLevelTotal = l === '전체';
                  return (
                    <g key={di}>
                      {isLevelTotal && (
                        <line x1={offsetX} y1={offsetY + di * cellH} x2={offsetX + totalSubjects.length * cellW} y2={offsetY + di * cellH} stroke="#1E2225" strokeWidth="1.5" />
                      )}
                      <text x={offsetX - 10} y={offsetY + di * cellH + cellH / 2 + 4} textAnchor="end" fontSize="13" fill={isLevelTotal ? '#1E2225' : '#475569'} fontWeight={isLevelTotal ? 800 : 700}>{l}</text>
                      {totalGrid[di].map((v, hi) => {
                        const isSubjectTotal = totalSubjects[hi] === '전체';
                        const isTotal = isLevelTotal || isSubjectTotal;
                        const intensity = max > 0 ? v / max : 0;
                        const fill = `rgba(139, 92, 246, ${0.1 + intensity * 0.85})`;
                        // [v4.7] 3종 정규화 비율 — 일반 셀만 모두 노출, 「전체」 셀은 단순 표기
                        const ratioOverall = cornerSum > 0 ? (v / cornerSum) * 100 : 0;
                        const ratioOverallLabel = ratioOverall.toFixed(1) + '%';
                        // 학교급 내 비율(행 정규화), 교과 내 비율(열 정규화) — 일반 셀만 의미 있음
                        const rowSum = !isLevelTotal ? overallCol[di] : 0;
                        const colSum = !isSubjectTotal ? overallRow[hi] : 0;
                        const ratioRow = rowSum > 0 ? (v / rowSum) * 100 : 0;
                        const ratioCol = colSum > 0 ? (v / colSum) * 100 : 0;
                        // [v4.9] 호버 분석 내용은 설명 블록으로 이동 — 호버는 셀 값만 간단히
                        const buildTooltip = () => {
                          const header = `${l} · ${totalSubjects[hi]}${isLevelTotal && isSubjectTotal ? ' (전체 누적)' : isLevelTotal ? ' (3개 학교급 합계)' : isSubjectTotal ? ' (모든 교과 합계)' : ''}`;
                          return `${header}\n채점 ${v.toLocaleString()}건 · 전체 대비 ${ratioOverallLabel}`;
                        };
                        return (
                          <g key={hi}>
                            {/* subject total 컬럼 시각 강조 (좌측 vertical 분리선) */}
                            {isSubjectTotal && di === 0 && (
                              <line x1={offsetX + hi * cellW} y1={offsetY} x2={offsetX + hi * cellW} y2={offsetY + totalLevels.length * cellH} stroke="#1E2225" strokeWidth="1.5" />
                            )}
                            <rect x={offsetX + hi * cellW + 2} y={offsetY + di * cellH + 2} width={cellW - 4} height={cellH - 4} fill={fill} rx="4" stroke={isTotal ? '#1E2225' : 'transparent'} strokeWidth={isTotal ? '1.5' : '0'}>
                              <title>{buildTooltip()}</title>
                            </rect>
                            {/* 큰 글씨: 건수 */}
                            <text x={offsetX + hi * cellW + cellW / 2} y={offsetY + di * cellH + cellH / 2 - 4} textAnchor="middle" fontSize="14" fontWeight={isTotal ? 800 : 700} fill={intensity > 0.5 ? 'white' : '#1E2225'}>{v.toLocaleString()}</text>
                            {/* 작은 글씨: 분석율 (전체 대비 %) */}
                            <text x={offsetX + hi * cellW + cellW / 2} y={offsetY + di * cellH + cellH / 2 + 12} textAnchor="middle" fontSize="10" fontWeight="600" fill={intensity > 0.5 ? 'rgba(255,255,255,0.85)' : '#64748B'}>{ratioOverallLabel}</text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                </svg>
              </div>
            </>
          );
        })()}

        {/* ④ AI vs 교사 재검토 비율 (v4.5 — 등급평가 한정. 평가유형 sub-filter 미적용) */}
        {subjectAiView === 'aiVsTeacher' && (() => {
          // [v4.5] 등급평가 채점만 카운트 — 과정 분석는 등급 비교 의미 자체가 다른 평가 모드라 측정 대상에서 제외
          const data = subjectAiData.aiVsTeacher.grade;
          return (
            <div style={{ padding: '20px 0' }}>
              {/* [v4.5] 차트 부제 — 등급평가 한정 명시 */}
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                🤝 AI vs 교사 재검토 — <span style={{ color: '#1D4ED8', fontWeight: 800, background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>📋 등급평가 채점만 반영</span> · 과정 분석 제외 (등급 비교 의미 다름)
              </div>
              <p style={{ textAlign: 'center', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: '20px' }}>
                AI가 매긴 등급을 교사가 그대로 수용한 비율(AI 단독) vs 교사가 다른 등급으로 변경한 비율 — AI 모델 정확도 지표
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
                {data.map((d, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>{d.subject}</span>
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                        <span style={{ color: '#10B981', fontWeight: 700 }}>AI 단독 {d.aiOnly}%</span>
                        <span style={{ margin: '0 6px', color: '#94A3B8' }}>·</span>
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>교사 재검토 {d.teacherReview}%</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', height: '32px', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${d.aiOnly}%`, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>{d.aiOnly}%</div>
                      <div style={{ width: `${d.teacherReview}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>{d.teacherReview}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '20px', fontSize: 'var(--neo-font-size-sm)' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', borderRadius: 2, marginRight: 6 }}></span>AI 채점 단독 적용</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#F59E0B', borderRadius: 2, marginRight: 6 }}></span>교사 재검토</span>
              </div>
            </div>
          );
        })()}
      </section>

      {/* [v4.16] 활용 가이드 모달 — 헤더 「📖 활용 가이드」 버튼 클릭으로 노출 */}
      <DashboardGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};

export default Dashboard;
