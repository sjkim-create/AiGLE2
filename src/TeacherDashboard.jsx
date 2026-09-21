/**
 * TeacherDashboard.jsx
 * 교사 대시보드 — DSH-02
 *
 * DSH-01(시스템 관리자)와 별개로, 교사 운영 관점의 대시보드:
 *  - 기본: KPI 카드 + 공지/Q&A + 단계별 진행 + 그룹 점수 분포 (기존 화면 동등)
 *  - 신규: 학습 추이 분석(개인/그룹/학년) + 강·약점 분석 + 인사이트 카드
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import SmartpenMonitor from './SmartpenMonitor';

const TeacherDashboard = ({ onNavigate }) => {
  // 스마트펜 모니터링 풀 오버레이 모달 — 교사 대시보드 헤더에서만 진입
  const [showSmartpenModal, setShowSmartpenModal] = useState(false);
  // [v2.1] 본인 계약 기간 + 데이터 학년 분리 — MY-01 「내 정보」 계약 일자와 동일 source
  const myInfo = {
    tier: 'paid',                  // 'free' | 'paid'
    createdAt: '2026.04.10',       // 회원가입 신청 시점 (무료회원 표기용)
    contractAt: '2026.03.15',      // 학교 계약일 (학교유료회원 표기용)
  };
  const computeServicePeriod = () => {
    if (myInfo.tier === 'paid') {
      const [y, m, d] = myInfo.contractAt.split('.').map(Number);
      const end = new Date(y + 1, m - 1, d - 1);
      const ey = end.getFullYear(), em = String(end.getMonth() + 1).padStart(2, '0'), ed = String(end.getDate()).padStart(2, '0');
      return { start: myInfo.contractAt, end: `${ey}.${em}.${ed}`, label: `${myInfo.contractAt} ~ ${ey}.${em}.${ed} (1년 계약)`, daysLeft: null };
    }
    // 무료회원 14일 trial — 만료 D-N 계산
    const [y, m, d] = myInfo.createdAt.split('.').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 13); // 14일 (시작일 포함)
    const today = new Date(2026, 4, 6); // mock 오늘 날짜 (2026-05-06)
    const daysLeft = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
    const ey = end.getFullYear(), em = String(end.getMonth() + 1).padStart(2, '0'), ed = String(end.getDate()).padStart(2, '0');
    return { start: myInfo.createdAt, end: `${ey}.${em}.${ed}`, label: `${myInfo.createdAt} ~ ${ey}.${em}.${ed} (14일 trial · 만료 D-${daysLeft})`, daysLeft };
  };
  const servicePeriodInfo = computeServicePeriod();
  const dataYear = '2026학년도'; // 데이터 학년 (셀렉트 X, 명시 전용)
  const dataYearRange = '2026.03 ~ 2027.02';
  // v2.0 학습 추이 분석 통합: 학년·그룹·학생 단일 화면에서 필터로 구분
  const [selectedStudentId, setSelectedStudentId] = useState(null); // null = 학생 미선택 (그룹 평균 모드)
  const [selectedClass, setSelectedClass] = useState('all'); // 'all' = 학년 멀티라인 (그 학년 모든 그룹)
  const [selectedTrendGrade, setSelectedTrendGrade] = useState(3); // v1.8 학습 추이 분석 학년 필터
  // [v2.5] weakUnit 토글 제거 — 강·약점은 그룹 단위만 노출
  const [distTooltip, setDistTooltip] = useState(null); // { className, level, x, y } | null
  const [expandedInsight, setExpandedInsight] = useState(null); // [v3.19] 인사이트 카드 click 시 학생 명단 popover idx (위로 펼침)
  const [selectedTaskId, setSelectedTaskId] = useState(3); // 점수 분포 대상 과제
  const [areaFilter, setAreaFilter] = useState('all'); // 학습 추이 분석 핵심평가영역 필터: 'all' | area string
  // [v2.5] reportStudent 모달 제거 — 학생 개인 모드 폐지에 따라 진입 경로 없음
  const [selectedSubject, setSelectedSubject] = useState('수학'); // [v2.5] 교과 셀렉트 (중고등 통상 1개, 초등 다교과)
  const [selectedCourse, setSelectedCourse] = useState('전체'); // [v2.7] 교과 하위 과목 셀렉트 (기본값 '전체')
  // 추이 차트 가로 스크롤 ref — 최근 과제(오른쪽)가 보이도록 자동 우측 정렬
  const trendScrollRef = useRef(null);
  useEffect(() => {
    const el = trendScrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth; // 최근 과제(우측) 중심으로 자동 스크롤
  }, [selectedStudentId, selectedClass, selectedTrendGrade, selectedSubject, selectedCourse]);
  // [v3.43] 개인 추이 분석 — 차트 점 툴팁: hover 또는 click으로 노출 (click 시 pinned 상태)
  const [pointTooltip, setPointTooltip] = useState(null); // { idx, pinned } | null
  // [v3.43] 그룹 추이 분석 — 단일 그룹 점 툴팁
  const [classOneTooltip, setClassOneTooltip] = useState(null); // { idx, pinned } | null
  // [v3.43] 그룹 추이 분석 — 멀티 그룹 점 툴팁 (그룹명 + 과제idx)
  const [classMultiTooltip, setClassMultiTooltip] = useState(null); // { clsName, ptIdx, pinned } | null
  // [v3.43] 멀티 그룹 모드 — 범례 클릭으로 단일 그룹 포커스 (라인 겹침 해결)
  const [focusedClass, setFocusedClass] = useState(null); // null = 모든 그룹 동시 표시
  // [v3.44] 학년 평균 reference — 동일학교는 기본으로 항상 노출. 전국 핵심평가영역 기준은 추가 토글
  const [showNationalRef, setShowNationalRef] = useState(false);

  // [v3.57] pinned 툴팁 외부 클릭 해제 — 카드 바깥(차트 배경·페이지 영역)을 클릭하면 해제
  useEffect(() => {
    const anyPinned = pointTooltip?.pinned || classOneTooltip?.pinned || classMultiTooltip?.pinned;
    if (!anyPinned) return;
    const onDocClick = (e) => {
      if (e.target.closest && e.target.closest('[data-tooltip-card="true"]')) return;
      setPointTooltip(p => (p?.pinned ? null : p));
      setClassOneTooltip(p => (p?.pinned ? null : p));
      setClassMultiTooltip(p => (p?.pinned ? null : p));
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [pointTooltip?.pinned, classOneTooltip?.pinned, classMultiTooltip?.pinned]);

  // [v2.7] 교육과정 데이터 구조: 학교급 > 학년 > 교과 > 과목 > 핵심평가영역(내용체계)
  //   예) 고등 · 1~3학년 · 수학(교과) · 공통수학1(과목) · [다항식, 방정식과 부등식, 경우의 수, 행렬]
  //   핵심평가영역은 교과 단위로 두면 최대 16개까지 늘어나므로 과목(course) 단위로 묶어 선택한다.
  //   courses(과목): 해당 과목이 포함하는 핵심평가영역 묶음 (mock — 실제 교육과정 표준으로 교체 가능)
  const subjectCatalog = {
    '국어': {
      courses: {
        '공통국어1': ['듣기·말하기', '읽기', '쓰기', '문법', '문학'],
        '문학': ['문학'],
        '독서': ['읽기'],
      },
      areas: ['듣기·말하기', '읽기', '쓰기', '문법', '문학'],
      achievements: {
        '듣기·말하기': [
          { code: '[10공국1-01-01]', summary: '대화의 원리를 고려하여 대화하기' },
          { code: '[10공국1-01-02]', summary: '담화 상황에 맞게 표현하기' },
        ],
        '읽기': [
          { code: '[10공국1-02-01]', summary: '글의 주제·내용 파악' },
          { code: '[10공국1-02-02]', summary: '추론적 읽기' },
        ],
        '쓰기':   [{ code: '[10공국1-03-01]', summary: '글의 짜임에 맞게 쓰기' }],
        '문법':   [{ code: '[10공국1-04-01]', summary: '문장 성분 이해' }],
        '문학':   [{ code: '[10공국1-05-01]', summary: '작품의 시·공간적 배경 이해' }],
      },
    },
    '수학': {
      // 고등 공통수학1 핵심평가영역 (스크린샷 기준 구조)
      courses: {
        '공통수학1': ['다항식', '방정식과 부등식', '경우의 수', '행렬'],
        '공통수학2': ['도형의 방정식', '집합과 명제', '함수와 그래프'],
      },
      areas: ['다항식', '방정식과 부등식', '경우의 수', '행렬'],
      achievements: {
        '다항식':         [{ code: '[10공수1-01-01]', summary: '다항식의 연산' }],
        '방정식과 부등식': [{ code: '[10공수1-02-01]', summary: '이차방정식과 이차부등식' }],
        '경우의 수':      [{ code: '[10공수1-03-01]', summary: '순열과 조합' }],
        '행렬':           [{ code: '[10공수1-04-01]', summary: '행렬의 뜻과 연산' }],
      },
    },
  };
  // [v2.6] 선택 과목(selectedCourse)의 영역 묶음 → 없으면 교과 전체 영역
  const courseAreas = (subj, course) =>
    subjectCatalog[subj]?.courses?.[course] || subjectCatalog[subj]?.areas || [];
  const currentAreas = courseAreas(selectedSubject, selectedCourse);

  // ── 임시 데이터 (DSH-02 mock) ──
  // 크레딧 사용량 (학교 단위 공용 풀, 소속 교사 모두 동일값)
  // 시연 케이스: remaining 변경하여 4단계 상태 확인 가능
  //   정상(38% 사용) 620 / 주의(68% 사용) 320 / 경고(90.5% 사용) 95 / 소진(100% 사용) 0
  const schoolCredit = { total: 1000, remaining: 620 };
  const creditUsed = schoolCredit.total - schoolCredit.remaining;
  const creditUsedRatio = schoolCredit.total > 0 ? (creditUsed / schoolCredit.total) * 100 : 0;
  const creditState =
    schoolCredit.remaining === 0 ? 'depleted' :
    creditUsedRatio > 80 ? 'critical' :
    creditUsedRatio > 50 ? 'warning' : 'normal';
  const creditColor =
    creditState === 'normal' ? '#0EA5E9' :
    creditState === 'warning' ? '#F59E0B' : '#EF4444';
  const creditMessage =
    creditState === 'depleted' ? '🚨 소진 — AI 호출이 차단되었습니다. 관리자에게 추가 충전을 요청하세요' :
    creditState === 'critical' ? '🚨 잔량 부족 — 채점·과제 등록이 곧 제한됩니다' :
    null;
  const creditPillLabel =
    creditState === 'normal' ? '여유' :
    creditState === 'warning' ? '주의' :
    creditState === 'critical' ? '위급' :
    creditState === 'depleted' ? '소진' : '';
  const creditPillBg =
    creditState === 'normal' ? '#D1FAE5' :
    creditState === 'warning' ? '#FEF3C7' : '#FEE2E2';
  const creditPillFg =
    creditState === 'normal' ? '#10B981' :
    creditState === 'warning' ? '#F59E0B' : '#EF4444';
  const creditUsedRatioLabel =
    creditUsedRatio === 0 || creditUsedRatio === 100
      ? creditUsedRatio.toString()
      : creditUsedRatio < 10
      ? creditUsedRatio.toFixed(1)
      : Math.round(creditUsedRatio).toString();
  // 충전 예정일 = 계약 만료일 (학교유료회원만, 무료회원은 표기 생략)
  const creditRefillDate = myInfo.tier === 'paid' ? servicePeriodInfo?.end : null;
  const creditTooltip = '학교 전체에 해당되는 정보이며 소속 교사 모두 동일한 내용을 봅니다. AI 호출(과제 생성·채점·재채점·과정 분석) 시 차감됩니다.';

  // [v3.40] KPI metrics 구조 — 첫 항목(emphasis) 메인 강조, 나머지 보조. 채점 관리는 단계별 진행(미채점/채점 확인/결과 발송 완료)과 동일 단위
  const stats = [
    { title: '과제 관리', icon: '📂', color: '#10B981', target: 'TaskManagement', metrics: [
      { label: '등록한 과제', value: '20개', emphasis: true },
      { label: '배포 완료', value: '19개' },
    ] },
    { title: '채점 관리', icon: '📝', color: '#2A75F3', target: 'GradingManagement', metrics: [
      { label: '미채점', value: '90건', emphasis: true },
      { label: '채점 확인', value: '0건' },
      { label: '결과 발송 완료', value: '100건' },
    ] },
    { title: '학생 관리', icon: '👥', color: '#FB923C', target: 'StudentManagement', metrics: [
      { label: '관리 학생수', value: '30명', emphasis: true },
      { label: '관리 그룹수', value: '3개' },
    ] },
  ];

  const notices = [];
  const faqs = [
    { id: 1, question: '학생들이 작성한 답안을 pdf로 저장하고 싶습니다.', date: '26.04.28', status: '답변완료' },
    { id: 2, question: '오류가 났습니다.', date: '26.04.28', status: '답변완료' },
    { id: 3, question: '문항이 길어지면 잘림현상 발생합니다.', date: '26.04.24', status: '답변완료' },
    { id: 4, question: '빠른 메일 확인 및 회신 부탁드립니다.', date: '26.04.09', status: '답변완료' },
  ];

  // 단계별 진행 현황
  const progressData = [
    { name: '미채점', value: 90, color: '#FB923C' },
    { name: '채점 확인', value: 0, color: '#F59E0B' },
    { name: '결과 발송 완료', value: 100, color: '#10B981' },
  ];

  // [v2.8] 등급 체계 registry — 과제마다 3/4/5등급 등 native 체계 적용
  // 각 등급은 점수 desc 정렬 + minScore (해당 등급의 하한, 포함). 점수→등급 매핑은 scoreToLevel(...) 사용
  const gradeScales = {
    // [v3.30] 등급 cutoff 정정 — 한국 학사 평가 체계 표준화
    //  · 3등급: 우수(≥80) / 보통(≥60) / 노력(<60)
    //  · 4등급: 매우 우수(≥95) / 우수(≥85) / 보통(≥70) / 노력(<70)  ← 5등급의 「매우 노력」 대신 「매우 우수」 포함 (top-4)
    //  · 5등급: 매우 우수(≥90) / 우수(≥80) / 보통(≥70) / 노력(≥60) / 매우 노력(<60)
    3: {
      label: '3등급',
      levels: [
        { name: '우수', color: '#2A75F3', minScore: 80 },
        { name: '보통', color: '#94A3B8', minScore: 60 },
        { name: '노력', color: '#EF4444', minScore: 0  },
      ],
    },
    4: {
      label: '4등급',
      levels: [
        { name: '매우 우수', color: '#10B981', minScore: 95 },
        { name: '우수',     color: '#2A75F3', minScore: 85 },
        { name: '보통',     color: '#94A3B8', minScore: 70 },
        { name: '노력',     color: '#EF4444', minScore: 0  },
      ],
    },
    5: {
      label: '5등급',
      levels: [
        { name: '매우 우수', color: '#10B981', minScore: 90 },
        { name: '우수',     color: '#2A75F3', minScore: 80 },
        { name: '보통',     color: '#94A3B8', minScore: 70 },
        { name: '노력',     color: '#F59E0B', minScore: 60 },
        { name: '매우 노력', color: '#EF4444', minScore: 0  },
      ],
    },
  };
  // [v3.31] scoreToLevel·scoreToPoint·scoreToYIndex·scoreToNativeLevel — Phase 6 폐기
  // mock이 완전히 등급 기반이므로 UI에서 점수→등급 변환 헬퍼 불필요

  // 분포표 대상 과제 list (좌우 스크롤 chip)
  // [v1.5] 각 과제는 평가 영역(area) 1종에 매핑 — popover 영역 추이의 키
  // [v2.8] gradeScale 필드 추가 (3/4/5) — 과제별 native 등급 체계 명시
  const tasks = [
    { id: 1, name: '단원1 평가',     date: '26.03.15', subject: '국어', area: '문법',   gradeScale: 5 },
    { id: 2, name: '중간고사 대비',  date: '26.04.05', subject: '국어', area: '독해',   gradeScale: 5 },
    { id: 3, name: '단원3 평가',     date: '26.05.06', subject: '수학', area: '경우의 수',   gradeScale: 5 },
    { id: 4, name: '비례식 평가',    date: '26.04.18', subject: '수학', area: '다항식', gradeScale: 3 },
    { id: 5, name: '단원2 평가',     date: '26.04.12', subject: '국어', area: '독해',   gradeScale: 4 },
    { id: 6, name: '도형 단원 평가', date: '26.04.28', subject: '수학', area: '방정식과 부등식',   gradeScale: 4 },
    { id: 7, name: '함수 단원 평가', date: '26.05.02', subject: '수학', area: '경우의 수',   gradeScale: 3 },
    { id: 8, name: '서술형 모의고사',date: '26.04.30', subject: '국어', area: '서술',   gradeScale: 5 },
    // [v3.14] 국어 3등급·4등급 sample task 추가 — 김민수 국어 모드에서 3/4등급 표시 검증용
    { id: 9, name: '문학 단원 평가', date: '26.04.10', subject: '국어', area: '문학',   gradeScale: 3 },
    { id: 10,name: '문법 종합 평가', date: '26.04.25', subject: '국어', area: '문법',   gradeScale: 4 },
  ];
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  // [v2.8] 선택 과제의 등급 체계 (등급 list + 색상 매핑)
  const selectedScale = gradeScales[selectedTask?.gradeScale || 5];
  const selectedScaleLevels = selectedScale.levels;

  // 학생 list (이번 그룹 과제 점수 + 등급 포함)
  const students = [
    { id: 1, name: '김민수', className: '3-1반', grade: 3, level: '우수',     trend: '↑', recentTask: '단원3 평가' },
    { id: 2, name: '이영희', className: '3-1반', grade: 3, level: '노력',     trend: '↓', recentTask: '단원3 평가' },
    { id: 3, name: '박지훈', className: '3-1반', grade: 3, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 4, name: '최서연', className: '3-1반', grade: 3, level: '노력',     trend: '–', recentTask: '단원3 평가' },
    { id: 5, name: '장나오', className: '3-1반', grade: 3, level: '매우 노력', trend: '↓', recentTask: '단원3 평가' },
    { id: 6, name: '안다솔', className: '3-1반', grade: 3, level: '매우 노력', trend: '↓', recentTask: '단원3 평가' },
    { id: 7, name: '윤하늘', className: '3-2반', grade: 3, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 8, name: '정수아', className: '3-2반', grade: 3, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 9, name: '강민재', className: '3-2반', grade: 3, level: '우수',     trend: '↑', recentTask: '단원3 평가' },
    { id: 10,name: '서지원', className: '3-2반', grade: 3, level: '우수',     trend: '–', recentTask: '단원3 평가' },
    { id: 11,name: '한가람', className: '3-2반', grade: 3, level: '우수',     trend: '↑', recentTask: '단원3 평가' },
    { id: 12,name: '오지율', className: '3-2반', grade: 3, level: '보통',     trend: '–', recentTask: '단원3 평가' },
    { id: 13,name: '임도윤', className: '3-3반', grade: 3, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 14,name: '권우진', className: '3-3반', grade: 3, level: '우수',     trend: '–', recentTask: '단원3 평가' },
    { id: 15,name: '신유찬', className: '3-3반', grade: 3, level: '우수',     trend: '↑', recentTask: '단원3 평가' },
    { id: 16,name: '조나린', className: '3-3반', grade: 3, level: '보통',     trend: '–', recentTask: '단원3 평가' },
    { id: 17,name: '홍서아', className: '3-3반', grade: 3, level: '보통',     trend: '↓', recentTask: '단원3 평가' },
    { id: 18,name: '문은채', className: '3-3반', grade: 3, level: '노력',     trend: '↓', recentTask: '단원3 평가' },
    // [v1.8] 4학년 학생 mock — 다학년 검증용
    { id: 19,name: '백지호', className: '4-1반', grade: 4, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 20,name: '오시현', className: '4-1반', grade: 4, level: '우수',     trend: '↑', recentTask: '단원3 평가' },
    { id: 21,name: '강예린', className: '4-1반', grade: 4, level: '보통',     trend: '–', recentTask: '단원3 평가' },
    { id: 22,name: '이도현', className: '4-2반', grade: 4, level: '매우 우수', trend: '↑', recentTask: '단원3 평가' },
    { id: 23,name: '진소은', className: '4-2반', grade: 4, level: '보통',     trend: '↓', recentTask: '단원3 평가' },
    { id: 24,name: '한지안', className: '4-2반', grade: 4, level: '노력',     trend: '↓', recentTask: '단원3 평가' },
  ];

  // 학생별 시계열 (mock)
  // [v3.41] 집계 기준: 학습 추이 분석은 「결과 발송이 완료된 과제와 학생의 값」만 노출한다.
  //   - 과제 단위: 결과 발송 완료 과제만 추이 회차로 노출 (미배포·채점 진행 중 제외)
  //   - 학생 단위: 그 과제에서 결과 발송 완료된 학생만 집계 (미응시·발송 전 제외)
  //   - 미채점 / 채점 확인 단계 답안은 제외 (교사 미확정 등급)
  //   - 사용 등급은 AI 채점 결과가 아니라 교사가 최종 검토·확정하여 발송한 등급 (nativeLevel)
  //   - studentTrend / areaTrend / classStats.trend / areaBreakdown / distribution 전부 동일 기준
  // [v3.30] 등급 cutoff 정정에 따른 mock 재변환
  const studentTrend = {
    1: [
      { taskName: '단원1 평가',  date: '26.03.15', area: '다항식', scale: 5, nativeLevel: '보통', yIdx: 3.2,  classAvgYIdx: 3.6,  classAvgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '다항식', nativeLevel: '우수' }, { no: 2, area: '다항식', nativeLevel: '보통' }, { no: 3, area: '방정식과 부등식', nativeLevel: '노력' }] },
      { taskName: '단원2 평가',  date: '26.04.12', area: '방정식과 부등식',   scale: 4, nativeLevel: '보통', yIdx: 3.53, classAvgYIdx: 3.33, classAvgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '방정식과 부등식', nativeLevel: '보통' }, { no: 2, area: '방정식과 부등식', nativeLevel: '우수' }, { no: 3, area: '경우의 수', nativeLevel: '노력' }] },
      { taskName: '비례식 평가', date: '26.04.18', area: '다항식', scale: 3, nativeLevel: '우수', yIdx: 4,    classAvgYIdx: 3.9,  classAvgNativeLevel: '보통', gradeAvgYIdx: 3.85, gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '다항식', nativeLevel: '우수' }, { no: 2, area: '다항식', nativeLevel: '우수' }] },
      { taskName: '단원3 평가',  date: '26.05.06', area: '경우의 수',   scale: 5, nativeLevel: '우수', yIdx: 4.5,  classAvgYIdx: 4,    classAvgNativeLevel: '우수', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '경우의 수', nativeLevel: '우수' }, { no: 2, area: '경우의 수', nativeLevel: '매우 우수' }, { no: 3, area: '행렬', nativeLevel: '보통' }] },
    ],
    2: [
      { taskName: '단원1 평가', date: '26.03.15', area: '다항식', scale: 5, nativeLevel: '노력', yIdx: 2.5,  classAvgYIdx: 3.6,  classAvgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '다항식', nativeLevel: '보통' }, { no: 2, area: '다항식', nativeLevel: '노력' }, { no: 3, area: '방정식과 부등식', nativeLevel: '노력' }] },
      { taskName: '단원2 평가', date: '26.04.12', area: '방정식과 부등식',   scale: 4, nativeLevel: '노력', yIdx: 2.89, classAvgYIdx: 3.33, classAvgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '방정식과 부등식', nativeLevel: '노력' }, { no: 2, area: '방정식과 부등식', nativeLevel: '보통' }, { no: 3, area: '경우의 수', nativeLevel: '매우 노력' }] },
      { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수',   scale: 5, nativeLevel: '노력', yIdx: 2,    classAvgYIdx: 4,    classAvgNativeLevel: '우수', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '경우의 수', nativeLevel: '노력' }, { no: 2, area: '경우의 수', nativeLevel: '노력' }, { no: 3, area: '행렬', nativeLevel: '보통' }] },
    ],
    3: [
      { taskName: '단원1 평가', date: '26.03.15', area: '다항식', scale: 5, nativeLevel: '우수',    yIdx: 4.8, classAvgYIdx: 3.6,  classAvgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '다항식', nativeLevel: '매우 우수' }, { no: 2, area: '다항식', nativeLevel: '우수' }, { no: 3, area: '방정식과 부등식', nativeLevel: '우수' }] },
      { taskName: '단원2 평가', date: '26.04.12', area: '방정식과 부등식',   scale: 4, nativeLevel: '우수',    yIdx: 4.5, classAvgYIdx: 3.33, classAvgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '방정식과 부등식', nativeLevel: '우수' }, { no: 2, area: '방정식과 부등식', nativeLevel: '매우 우수' }] },
      { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수',   scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4,    classAvgNativeLevel: '우수', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통',
        items: [{ no: 1, area: '경우의 수', nativeLevel: '매우 우수' }, { no: 2, area: '경우의 수', nativeLevel: '매우 우수' }, { no: 3, area: '행렬', nativeLevel: '우수' }] },
    ],
  };

  // [v3.30] areaTrend — 신 cutoff 재변환
  const areaTrend = {
    1: {
      '경우의 수': [
        { taskName: '함수 진단',  date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '보통', yIdx: 3.8, classAvgYIdx: 3.6, classAvgNativeLevel: '보통',
          items: [{ no: 1, area: '경우의 수', nativeLevel: '보통' }] },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4.5, classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '단원2 평가',    date: '26.04.12', area: '방정식과 부등식', scale: 4, nativeLevel: '보통', yIdx: 3.53, classAvgYIdx: 3.33, classAvgNativeLevel: '보통' },
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '보통', yIdx: 3.8,  classAvgYIdx: 3.53, classAvgNativeLevel: '보통' },
      ],
      '읽기': [
        { taskName: '읽기 진단 평가',     date: '26.03.05', area: '읽기', scale: 5, nativeLevel: '보통', yIdx: 3.8, classAvgYIdx: 3.5, classAvgNativeLevel: '보통' },
        { taskName: '비문학 독해 평가',   date: '26.04.02', area: '읽기', scale: 5, nativeLevel: '우수', yIdx: 4.2, classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
        { taskName: '문학 작품 분석 평가', date: '26.05.10', area: '읽기', scale: 5, nativeLevel: '우수', yIdx: 4.6, classAvgYIdx: 3.8, classAvgNativeLevel: '보통' },
      ],
      '쓰기': [
        { taskName: '논술 진단 평가',   date: '26.03.20', area: '쓰기', scale: 5, nativeLevel: '보통', yIdx: 3,   classAvgYIdx: 3.2, classAvgNativeLevel: '보통' },
        { taskName: '서술형 쓰기 평가', date: '26.04.20', area: '쓰기', scale: 5, nativeLevel: '보통', yIdx: 3.6, classAvgYIdx: 3.4, classAvgNativeLevel: '보통' },
      ],
      '문법': [
        { taskName: '문법 단원 평가', date: '26.04.25', area: '문법', scale: 5, nativeLevel: '우수', yIdx: 4,    classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
        { taskName: '문법 종합 평가', date: '26.04.25', area: '문법', scale: 4, nativeLevel: '보통', yIdx: 3.53, classAvgYIdx: 3.4, classAvgNativeLevel: '보통' },
      ],
      '듣기·말하기': [
        { taskName: '발표·토론 평가', date: '26.03.28', area: '듣기·말하기', scale: 5, nativeLevel: '보통', yIdx: 3.5, classAvgYIdx: 3.4, classAvgNativeLevel: '보통' },
        { taskName: '대화 상황 평가', date: '26.05.02', area: '듣기·말하기', scale: 5, nativeLevel: '보통', yIdx: 3.9, classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
      ],
      '문학': [
        { taskName: '문학 단원 평가', date: '26.04.10', area: '문학', scale: 3, nativeLevel: '우수', yIdx: 4, classAvgYIdx: 3.75, classAvgNativeLevel: '보통' },
      ],
    },
    3: {
      '경우의 수': [
        { taskName: '함수 1차',   date: '26.03.15', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.6, classAvgYIdx: 3.5, classAvgNativeLevel: '보통' },
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.9, classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '도형 진단',     date: '26.03.20', area: '방정식과 부등식', scale: 5, nativeLevel: '우수', yIdx: 4.4, classAvgYIdx: 3.2,  classAvgNativeLevel: '보통' },
        { taskName: '단원2 평가',    date: '26.04.12', area: '방정식과 부등식', scale: 4, nativeLevel: '우수', yIdx: 4.3, classAvgYIdx: 3.33, classAvgNativeLevel: '보통' },
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '우수', yIdx: 4.6, classAvgYIdx: 3.53, classAvgNativeLevel: '보통' },
      ],
      '다항식': [
        { taskName: '진단 평가',   date: '26.03.10', area: '다항식', scale: 5, nativeLevel: '우수', yIdx: 4.2, classAvgYIdx: 3,   classAvgNativeLevel: '보통' },
        { taskName: '단원1 평가',  date: '26.03.15', area: '다항식', scale: 5, nativeLevel: '우수', yIdx: 4.8, classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
        { taskName: '비례식 평가', date: '26.04.18', area: '다항식', scale: 3, nativeLevel: '우수', yIdx: 4,   classAvgYIdx: 3.9, classAvgNativeLevel: '보통' },
      ],
    },
    7: {
      '경우의 수': [
        { taskName: '함수 1차',   date: '26.03.15', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.8, classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4.2, classAvgNativeLevel: '우수' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4.8, classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '도형 진단',     date: '26.03.20', area: '방정식과 부등식', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 3.8,  classAvgNativeLevel: '보통' },
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '우수',    yIdx: 4.9, classAvgYIdx: 3.93, classAvgNativeLevel: '보통' },
      ],
      '다항식': [
        { taskName: '단원1 평가',  date: '26.03.15', area: '다항식', scale: 5, nativeLevel: '매우 우수', yIdx: 5, classAvgYIdx: 4, classAvgNativeLevel: '우수' },
        { taskName: '비례식 평가', date: '26.04.18', area: '다항식', scale: 3, nativeLevel: '우수',    yIdx: 4, classAvgYIdx: 4, classAvgNativeLevel: '우수' },
      ],
    },
    8: {
      '경우의 수': [
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.5, classAvgYIdx: 4.2, classAvgNativeLevel: '우수' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4.8, classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '우수', yIdx: 4.2, classAvgYIdx: 3.93, classAvgNativeLevel: '보통' },
      ],
    },
    9: {
      '경우의 수': [
        { taskName: '함수 1차',   date: '26.03.15', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4,   classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4.6, classAvgYIdx: 4.8, classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '보통', yIdx: 3.93, classAvgYIdx: 3.93, classAvgNativeLevel: '보통' },
      ],
    },
    10: {
      '경우의 수': [
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4.2, classAvgYIdx: 4.8, classAvgNativeLevel: '우수' },
      ],
    },
    11: {
      '경우의 수': [
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '보통', yIdx: 3.8, classAvgYIdx: 4.2, classAvgNativeLevel: '우수' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4,   classAvgYIdx: 4.8, classAvgNativeLevel: '우수' },
      ],
    },
    13: {
      '경우의 수': [
        { taskName: '함수 1차',   date: '26.03.15', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.6, classAvgYIdx: 3.6, classAvgNativeLevel: '보통' },
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '우수',    yIdx: 4.8, classAvgYIdx: 3.8, classAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '매우 우수', yIdx: 5,   classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
      ],
      '방정식과 부등식': [
        { taskName: '도형 단원 평가', date: '26.04.28', area: '방정식과 부등식', scale: 4, nativeLevel: '우수', yIdx: 4.3, classAvgYIdx: 3.4, classAvgNativeLevel: '보통' },
      ],
    },
    14: {
      '경우의 수': [
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4.4, classAvgYIdx: 4, classAvgNativeLevel: '우수' },
      ],
    },
    15: {
      '경우의 수': [
        { taskName: '함수 2차',   date: '26.04.18', area: '경우의 수', scale: 5, nativeLevel: '보통', yIdx: 3.6, classAvgYIdx: 3.8, classAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', area: '경우의 수', scale: 5, nativeLevel: '우수', yIdx: 4,   classAvgYIdx: 4,   classAvgNativeLevel: '우수' },
      ],
    },
  };

  // 그룹 통계 [v3.29] trend도 등급 일원화 (avg/gradeAvg 점수 폐기, *YIdx + nativeLevel 저장)
  const classStats = {
    '3-1반': {
      grade: 3,
      studentCount: 6,
      trend: [
        { taskName: '단원1 평가', date: '26.03.15', scale: 5, avgYIdx: 3.6,  avgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통' },
        { taskName: '단원2 평가', date: '26.04.12', scale: 4, avgYIdx: 3.33, avgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', scale: 5, avgYIdx: 3,    avgNativeLevel: '보통', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통' },
      ],
      // [v3.30] areaBreakdown 신 cutoff 재산출
      // [v3.57] 본 yIdx 값은 §5단계 정규화(컷오프 overlap 가중) 정책으로 산출된 5단계 base (1~5) 가정.
      //   production: backend가 영역별 평균 산출 시 각 과제의 native 등급을 overlap 가중 환산한 뒤 평균하여 저장.
      //   mock 한계: 본 예시 값은 임의 평균이며 환산 전·후 구분 없이 동일 의미로 사용.
      areaBreakdown: [
        { area: '다항식', classAvgYIdx: 2.5, gradeAvgYIdx: 3.5 },
        { area: '방정식과 부등식',   classAvgYIdx: 3.0, gradeAvgYIdx: 3.4 },
        { area: '경우의 수',   classAvgYIdx: 3.8, gradeAvgYIdx: 4.0 },
        { area: '행렬',   classAvgYIdx: 4.2, gradeAvgYIdx: 3.8 },
      ],
      // 3-1반 학생: 박지훈(매우 우수), 김민수(우수), 이영희·최서연(노력), 장나오·안다솔(매우 노력)
      distribution: { '매우 우수': 1, '우수': 1, '보통': 0, '노력': 2, '매우 노력': 2 },
    },
    '3-2반': {
      grade: 3,
      studentCount: 6,
      trend: [
        { taskName: '단원1 평가', date: '26.03.15', scale: 5, avgYIdx: 3.8,  avgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통' },
        { taskName: '단원2 평가', date: '26.04.12', scale: 4, avgYIdx: 3.67, avgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', scale: 5, avgYIdx: 4.8,  avgNativeLevel: '우수', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통' },
      ],
      areaBreakdown: [
        { area: '다항식', classAvgYIdx: 4.0, gradeAvgYIdx: 3.5 },
        { area: '방정식과 부등식',   classAvgYIdx: 3.8, gradeAvgYIdx: 3.4 },
        { area: '경우의 수',   classAvgYIdx: 4.2, gradeAvgYIdx: 4.0 },
        { area: '행렬',   classAvgYIdx: 3.6, gradeAvgYIdx: 3.8 },
      ],
      // 3-2반 학생: 윤하늘·정수아(매우 우수), 강민재·서지원·한가람(우수), 오지율(보통)
      distribution: { '매우 우수': 2, '우수': 3, '보통': 1, '노력': 0, '매우 노력': 0 },
    },
    '3-3반': {
      grade: 3,
      studentCount: 6,
      trend: [
        { taskName: '단원1 평가', date: '26.03.15', scale: 5, avgYIdx: 3.2,  avgNativeLevel: '보통', gradeAvgYIdx: 3.5,  gradeAvgNativeLevel: '보통' },
        { taskName: '단원2 평가', date: '26.04.12', scale: 4, avgYIdx: 3.27, avgNativeLevel: '보통', gradeAvgYIdx: 3.27, gradeAvgNativeLevel: '보통' },
        { taskName: '단원3 평가', date: '26.05.06', scale: 5, avgYIdx: 3.6,  avgNativeLevel: '보통', gradeAvgYIdx: 3.8,  gradeAvgNativeLevel: '보통' },
      ],
      areaBreakdown: [
        { area: '다항식', classAvgYIdx: 3.8, gradeAvgYIdx: 3.5 },
        { area: '방정식과 부등식',   classAvgYIdx: 3.2, gradeAvgYIdx: 3.4 },
        { area: '경우의 수',   classAvgYIdx: 4.0, gradeAvgYIdx: 4.0 },
        { area: '행렬',   classAvgYIdx: 3.5, gradeAvgYIdx: 3.8 },
      ],
      // 3-3반 학생: 임도윤(매우 우수), 권우진·신유찬(우수), 조나린·홍서아(보통), 문은채(노력)
      distribution: { '매우 우수': 1, '우수': 2, '보통': 2, '노력': 1, '매우 노력': 0 },
    },
    // [v1.8] 4학년 그룹
    '4-1반': {
      grade: 4,
      studentCount: 3,
      trend: [
        { taskName: '단원1 평가',  date: '26.03.15', scale: 5, avgYIdx: 3.8, avgNativeLevel: '보통', gradeAvgYIdx: 3.7, gradeAvgNativeLevel: '보통' },
        { taskName: '비례식 평가', date: '26.04.18', scale: 3, avgYIdx: 4,   avgNativeLevel: '우수', gradeAvgYIdx: 3.9, gradeAvgNativeLevel: '보통' },
        { taskName: '단원3 평가',  date: '26.05.06', scale: 5, avgYIdx: 4,   avgNativeLevel: '우수', gradeAvgYIdx: 3.9, gradeAvgNativeLevel: '보통' },
      ],
      areaBreakdown: [
        { area: '다항식', classAvgYIdx: 4.2, gradeAvgYIdx: 3.8 },
        { area: '방정식과 부등식',   classAvgYIdx: 3.6, gradeAvgYIdx: 3.7 },
        { area: '경우의 수',   classAvgYIdx: 4.0, gradeAvgYIdx: 4.0 },
      ],
      distribution: { '매우 우수': 1, '우수': 1, '보통': 1, '노력': 0, '매우 노력': 0 },
    },
    '4-2반': {
      grade: 4,
      studentCount: 3,
      trend: [
        { taskName: '단원1 평가',  date: '26.03.15', scale: 5, avgYIdx: 3.6, avgNativeLevel: '보통', gradeAvgYIdx: 3.7, gradeAvgNativeLevel: '보통' },
        { taskName: '비례식 평가', date: '26.04.18', scale: 3, avgYIdx: 3.8, avgNativeLevel: '보통', gradeAvgYIdx: 3.9, gradeAvgNativeLevel: '보통' },
        { taskName: '단원3 평가',  date: '26.05.06', scale: 5, avgYIdx: 3.8, avgNativeLevel: '보통', gradeAvgYIdx: 3.9, gradeAvgNativeLevel: '보통' },
      ],
      areaBreakdown: [
        { area: '다항식', classAvgYIdx: 3.4, gradeAvgYIdx: 3.8 },
        { area: '방정식과 부등식',   classAvgYIdx: 3.8, gradeAvgYIdx: 3.7 },
        { area: '경우의 수',   classAvgYIdx: 4.0, gradeAvgYIdx: 4.0 },
      ],
      distribution: { '매우 우수': 1, '우수': 0, '보통': 1, '노력': 1, '매우 노력': 0 },
    },
  };

  // [v3.1] 강·약점 분석 + 학습 추이 분석 — 등급 평균 단위 (5등급 기준)
  // 점수(0~100) 폐기 / 전국 평균 비교 폐기 / 표준편차 폐기
  // 등급 점수화: 매우 우수=5, 우수=4, 보통=3, 노력=2, 매우 노력=1
  const LEVEL_NAMES = ['매우 노력', '노력', '보통', '우수', '매우 우수']; // index = round(point) - 1
  const LEVEL_COLORS = { '매우 우수': '#10B981', '우수': '#2A75F3', '보통': '#94A3B8', '노력': '#F59E0B', '매우 노력': '#EF4444' };
  const pointToLevelName = (point) => {
    const idx = Math.max(1, Math.min(5, Math.round(point)));
    return LEVEL_NAMES[idx - 1];
  };
  // [v3.55] 과제 점 클릭 시 문항별 drill-down — 한 과제의 문항별 등급
  //   실제 데이터(trend entry의 items: 과제 → 문항[] 구조)가 있으면 그대로, 없으면 과제 등급 주변으로 합성(fallback)
  const getTaskItems = (t) => {
    if (!t) return [];
    if (Array.isArray(t.items) && t.items.length > 0) {
      return t.items.map((it) => ({ label: `${it.no}번 문항`, level: it.nativeLevel, area: it.area, real: true }));
    }
    const deltas = [0.5, 0, -0.5, 0.25, -0.25];
    const count = 2 + (Math.round(t.yIdx ?? 3) % 3); // 2~4문항 (deterministic)
    return Array.from({ length: count }, (_, j) => {
      const y = Math.max(1, Math.min(5, (t.yIdx ?? 3) + (deltas[j % deltas.length] || 0)));
      return { label: `${j + 1}번 문항`, level: pointToLevelName(y), area: t.area, real: false };
    });
  };
  // [v3.31] scoreToPoint 폐기 — mock이 등급 기반, UI는 학생 분포에서 distAvgPoint로 산출

  // [v3.19] 그룹/학년 등급 평균 — distribution 가중 평균 (1~5 소수점)
  // 점수 평균을 5등급 cutoff로 binning하던 v3.18까지의 방식은 동일 cutoff 구간 안의 그룹 차이를 무시.
  // 대안: 학생 distribution(매우 우수~매우 노력 N명)을 등급 포인트로 가중 평균하여 그룹별 차별화 확보.
  const distAvgPoint = (dist) => {
    if (!dist) return 0;
    const total = Object.values(dist).reduce((s, n) => s + n, 0);
    if (total === 0) return 0;
    const sum = 5 * (dist['매우 우수'] || 0)
              + 4 * (dist['우수']     || 0)
              + 3 * (dist['보통']     || 0)
              + 2 * (dist['노력']     || 0)
              + 1 * (dist['매우 노력'] || 0);
    return sum / total;
  };
  // 학년 평균 등급 포인트 — 해당 학년 모든 그룹의 distribution 합산 후 가중 평균
  const gradeAvgPointFor = (grade) => {
    const cls = Object.values(classStats).filter(c => c.grade === grade);
    if (cls.length === 0) return 0;
    const merged = {};
    cls.forEach(c => {
      Object.entries(c.distribution || {}).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + v;
      });
    });
    return distAvgPoint(merged);
  };

  // [v3.31] scoreToNativeLevel 폐기 — mock이 nativeLevel 직접 저장

  // taskName으로 task의 gradeScale 조회 (기본 5)
  const getTaskGradeScale = (taskName) => {
    const t = tasks.find(x => x.name === taskName);
    return t?.gradeScale || 5;
  };
  // [v3.15] native 등급명 → Y축 base idx (5등급 Y축 라벨과 정렬)
  // 동일 등급명은 동일 base Y 위치 (예: 3등급 「보통」, 4등급 「보통」, 5등급 「보통」 모두 base Y=3)
  const LEVEL_TO_Y = { '매우 노력': 1, '노력': 2, '보통': 3, '우수': 4, '매우 우수': 5 };
  // [v3.31] scoreToYIndex 폐기 — mock이 yIdx 직접 저장 (production server가 산출한 결과)

  // [v3.42] 5단계 기준 정규화 — Method 3: 컷오프 overlap 가중 (학생 점수 미사용)
  // 각 native 등급의 점수 구간이 5단계의 어느 구간들과 얼마만큼 겹치는지로 5단계 Y를 도출.
  // 3·4단계 과제도 5단계 1~5 풀 스케일을 사용 가능 → 그룹/학년 평균 비교 시 inflate/deflate 완화.
  const NATIVE_CUTOFFS = {
    3: [
      { name: '우수',     min: 80, max: 100 },
      { name: '보통',     min: 60, max: 80  },
      { name: '노력',     min: 0,  max: 60  },
    ],
    4: [
      { name: '매우 우수', min: 95, max: 100 },
      { name: '우수',     min: 85, max: 95  },
      { name: '보통',     min: 70, max: 85  },
      { name: '노력',     min: 0,  max: 70  },
    ],
    5: [
      { name: '매우 우수', min: 90, max: 100 },
      { name: '우수',     min: 80, max: 90  },
      { name: '보통',     min: 70, max: 80  },
      { name: '노력',     min: 60, max: 70  },
      { name: '매우 노력', min: 0,  max: 60  },
    ],
  };
  const FIVE_BUCKETS = [
    { name: '매우 노력', y: 1, min: 0,  max: 60 },
    { name: '노력',     y: 2, min: 60, max: 70 },
    { name: '보통',     y: 3, min: 70, max: 80 },
    { name: '우수',     y: 4, min: 80, max: 90 },
    { name: '매우 우수', y: 5, min: 90, max: 100 },
  ];
  // native 등급명+scale → 5단계 Y (overlap 가중) — 점수 미사용
  const nativeToFiveY = (nativeLevel, scale) => {
    const buckets = NATIVE_CUTOFFS[scale] || NATIVE_CUTOFFS[5];
    const native = buckets.find(b => b.name === nativeLevel);
    if (!native) return LEVEL_TO_Y[nativeLevel] ?? 3;
    const span = native.max - native.min;
    if (span <= 0) return LEVEL_TO_Y[nativeLevel] ?? 3;
    let y = 0;
    FIVE_BUCKETS.forEach(five => {
      const overlap = Math.max(0, Math.min(native.max, five.max) - Math.max(native.min, five.min));
      if (overlap > 0) y += (overlap / span) * five.y;
    });
    return y;
  };
  // 기존 yIdx의 라벨-내 변동(±)을 보존하면서 base만 5단계로 재앵커링
  //   - scale 5 → 그대로 (이미 5단계 기준)
  //   - scale 3/4 → newBase + (oldYIdx - oldBase)
  const normalizeYIdxTo5 = (yIdx, nativeLevel, scale) => {
    if (yIdx == null || !nativeLevel) return yIdx;
    if (scale === 5 || !scale) return yIdx;
    const oldBase = LEVEL_TO_Y[nativeLevel];
    if (oldBase == null) return yIdx;
    const newBase = nativeToFiveY(nativeLevel, scale);
    const delta = yIdx - oldBase;
    return Math.max(1, Math.min(5, newBase + delta));
  };
  // [v3.44] 전국 핵심평가영역 평균 mock (학년+교과+영역별 5단계 정규화 yIdx + 메타정보)
  // production: nationalAreaAvg[grade][subject][area] SCD-2 ledger 조회 (학기/학년 cohort 단위 누적)
  // mock: 영역별 일정 값 + 응시자 수·참여 학교 수 메타. 표본 < MIN_SAMPLE이면 산출 거부 (왜곡 방지)
  const NATIONAL_MIN_SAMPLE = 100;
  const nationalAreaAvgByGrade = {
    3: {
      '수학': {
        '다항식': { yIdx: 3.45, level: '보통', sampleSize: 12500, schools: 320 },
        '방정식과 부등식':   { yIdx: 3.62, level: '보통', sampleSize: 12300, schools: 318 },
        '경우의 수':   { yIdx: 3.81, level: '보통', sampleSize: 11800, schools: 305 },
        '행렬':   { yIdx: 3.55, level: '보통', sampleSize: 11000, schools: 290 },
      },
      '국어': {
        '독해':         { yIdx: 3.72, level: '보통', sampleSize: 13200, schools: 340 },
        '문법':         { yIdx: 3.50, level: '보통', sampleSize: 12800, schools: 330 },
        '서술':         { yIdx: 3.40, level: '보통', sampleSize: 11500, schools: 295 },
        '읽기':         { yIdx: 3.68, level: '보통', sampleSize: 12900, schools: 335 },
        '쓰기':         { yIdx: 3.42, level: '보통', sampleSize: 12200, schools: 325 },
        '듣기·말하기':  { yIdx: 3.85, level: '우수', sampleSize: 12700, schools: 332 },
        '문학':         { yIdx: 3.95, level: '우수', sampleSize: 12000, schools: 310 },
      },
    },
    4: {
      '수학': {
        '다항식': { yIdx: 3.78, level: '보통', sampleSize: 11200, schools: 298 },
        '방정식과 부등식':   { yIdx: 3.85, level: '우수', sampleSize: 11500, schools: 302 },
        '경우의 수':   { yIdx: 4.05, level: '우수', sampleSize: 11000, schools: 290 },
      },
      '국어': {
        '독해':         { yIdx: 3.92, level: '우수', sampleSize: 12100, schools: 315 },
        '문법':         { yIdx: 3.70, level: '보통', sampleSize: 11800, schools: 308 },
        '읽기':         { yIdx: 3.88, level: '우수', sampleSize: 12000, schools: 312 },
        '쓰기':         { yIdx: 3.65, level: '보통', sampleSize: 11500, schools: 300 },
      },
    },
  };
  // 전국 영역 평균 조회 — 표본 부족 시 null 반환 (UI에서 fallback 또는 안내 처리)
  // [v3.54] selectedSubject에 mock 영역이 없으면 같은 학년의 다른 교과 mock에서 같은 영역명을 찾아 fallback.
  //   mock 한계 보완: classStats.areaBreakdown은 selectedSubject와 무관하게 수학 영역으로 정의되어 있어
  //   학년·단일 그룹 모드에서 보라 마커가 노출되지 않던 문제 해결. production에서는 교과별로 영역이 분기되므로 fallback 미사용.
  const getNationalAreaRef = (grade, subject, area) => {
    let row = nationalAreaAvgByGrade?.[grade]?.[subject]?.[area];
    if (!row) {
      const yearMock = nationalAreaAvgByGrade?.[grade] || {};
      for (const sub of Object.keys(yearMock)) {
        if (sub !== subject && yearMock[sub]?.[area]) {
          row = yearMock[sub][area];
          break;
        }
      }
    }
    if (!row) return null;
    if (row.sampleSize < NATIONAL_MIN_SAMPLE) return null;
    return row;
  };
  // entry에 area가 없으면 taskName으로 tasks[]에서 area 조회 (classStats.trend는 area 미포함)
  const resolveArea = (entry) => entry?.area || tasks.find(x => x.name === entry?.taskName)?.area || null;
  // [v3.44] 전국 영역 평균 yIdx — 표본 충분·영역 매핑 성공 시 반환, 아니면 null
  const nationalRefY = (entry, grade) => {
    const a = resolveArea(entry);
    if (!a) return null;
    const r = getNationalAreaRef(grade, selectedSubject, a);
    return r?.yIdx ?? null;
  };
  // 전국 영역 평균 메타 (sampleSize, schools, area 등) — UI 안내·툴팁용
  const nationalRefMeta = (entry, grade) => {
    const a = resolveArea(entry);
    if (!a) return null;
    const r = getNationalAreaRef(grade, selectedSubject, a);
    return r ? { ...r, area: a } : null;
  };

  // trend 엔트리({ yIdx, nativeLevel, scale, classAvg*, gradeAvg*, avg* })에서 5단계 정규화 Y들을 추출
  const normalizeTrendEntry = (e) => {
    if (!e) return e;
    const s = e.scale;
    return {
      ...e,
      yIdx: normalizeYIdxTo5(e.yIdx, e.nativeLevel, s),
      classAvgYIdx: normalizeYIdxTo5(e.classAvgYIdx, e.classAvgNativeLevel, s),
      gradeAvgYIdx: normalizeYIdxTo5(e.gradeAvgYIdx, e.gradeAvgNativeLevel, s),
      avgYIdx: normalizeYIdxTo5(e.avgYIdx, e.avgNativeLevel, s),
    };
  };

  // [v3.32] distRangeYIdx (최저/최고 범위 모델) 폐기 — 학년 평균 reference + 그룹 평균 target 모델로 일원화
  // 그룹의 학년 내 ranking (distAvgPoint 기준, 동률은 동순위)
  const classRankingInGrade = (className, grade) => {
    const cls = Object.entries(classStats).filter(([, c]) => c.grade === grade);
    if (cls.length === 0) return { rank: 0, total: 0 };
    const scored = cls.map(([n, c]) => ({ n, p: distAvgPoint(c.distribution) }));
    scored.sort((a, b) => b.p - a.p);
    const rank = scored.findIndex(s => s.n === className) + 1;
    return { rank, total: scored.length };
  };
  // [v3.32] 5단계 스펙트럼 위에 학년 평균(reference 점선) + 그룹/본인 평균(target dot) 표시
  // 소수점 텍스트 폐기 — 마커 위치로 정밀도 시각, 라벨은 등급명 round만
  // - referenceYIdx: 학년 평균 (검정 점선, 텍스트 없음)
  // - targetYIdx: 그룹/본인 평균 (target 컬러 dot)
  // - 둘 다 optional. 학년 모드에서는 reference만, 그룹 모드에서는 둘 다, 학년 비교에서는 둘 다
  const GradeAvgBar = ({ targetYIdx, referenceYIdx, secondaryReferenceYIdx, secondaryReferenceLabel, targetLabel, height = 18, showRailLabels = true }) => {
    const order = ['매우 노력', '노력', '보통', '우수', '매우 우수'];
    // [v3.33] 5개 칸 구분 — 각 칸(0~4)은 등급 중심(yIdx=1..5)을 가운데에 두고 폭은 20%씩
    // 칸 경계 yIdx: 1.5, 2.5, 3.5, 4.5 → pct: 12.5, 37.5, 62.5, 87.5 (yIdx 기준)
    // 칸 중심 pct: 10, 30, 50, 70, 90 (5개 칸을 가로 균등 분할)
    const cellLeft = (i) => i * 20;     // 칸 i의 왼쪽 pct
    const cellCenter = (i) => i * 20 + 10; // 칸 i의 중심 pct
    // yIdx → 5칸 가로 좌표 변환 (yIdx 1 → 10%, yIdx 5 → 90%, 칸 중심)
    const yIdxToCellPct = (y) => Math.max(0, Math.min(100, cellCenter(Math.max(0, Math.min(4, Math.round(y) - 1)))
      + ((y - Math.round(y)) * 20))); // 칸 안에서의 미세 위치 (소수점)
    const targetPct = targetYIdx != null ? yIdxToCellPct(targetYIdx) : null;
    const refPct = referenceYIdx != null ? yIdxToCellPct(referenceYIdx) : null;
    const secondaryPct = secondaryReferenceYIdx != null ? yIdxToCellPct(secondaryReferenceYIdx) : null;
    const targetLevel = targetYIdx != null ? order[Math.max(0, Math.round(targetYIdx) - 1)] : null;
    const CELL_BG = ['#EF444422', '#F59E0B22', '#94A3B822', '#2A75F322', '#10B98122'];
    return (
      <div style={{ position: 'relative' }}>
        {/* [v3.52] 전국 평균 위쪽 dot 마커 + 「전국」 chip — bar 외부에 배치하여 가시성 보장 */}
        {secondaryPct != null && (
          <>
            <div title={secondaryReferenceLabel || '전국 핵심평가영역 평균'} style={{
              position: 'absolute', left: `calc(${secondaryPct}% - 6px)`, top: -8,
              width: 12, height: 12, borderRadius: '50%',
              background: '#7C3AED',
              border: '2px solid white',
              boxShadow: '0 0 0 1.5px #6D28D9',
              pointerEvents: 'none',
              zIndex: 5,
            }} />
            <div title={secondaryReferenceLabel || '전국 핵심평가영역 평균'} style={{
              position: 'absolute', left: `${secondaryPct}%`, top: -22,
              transform: 'translateX(-50%)',
              fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: 'white',
              background: '#7C3AED', border: '1px solid #6D28D9',
              padding: '1px 6px', borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 5, whiteSpace: 'nowrap',
              lineHeight: 1.2,
              boxShadow: '0 1px 3px rgba(124,58,237,0.3)',
            }}>전국</div>
          </>
        )}
        <div style={{ position: 'relative', height, marginBottom: showRailLabels ? '4px' : 0,
          marginTop: secondaryPct != null ? 14 : 0,
          border: '1px solid #CBD5E1', borderRadius: 4, overflow: 'hidden', display: 'flex',
        }}>
          {/* 5개 칸 segment 배경 + 구분선 */}
          {order.map((lv, i) => (
            <div key={lv} title={lv} style={{
              flex: 1, position: 'relative',
              background: CELL_BG[i],
              borderRight: i < 4 ? '1px solid #94A3B8' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B',
              letterSpacing: '-0.02em',
            }}>
              {showRailLabels ? '' : lv.replace(' ', '')}
            </div>
          ))}
          {/* 학년 평균 reference (검정 점선 — 칸 위에 overlay) */}
          {refPct != null && (
            <div title="학년 평균 (동일학교)" style={{
              position: 'absolute', left: `${refPct}%`, top: -2, bottom: -2,
              borderLeft: '2px dashed #1E2225',
              transform: 'translateX(-1px)',
              pointerEvents: 'none',
            }} />
          )}
          {/* [v3.52] 전국 평균 라인 본체 — 굵은 점선. 위쪽 dot/chip은 bar 외부에 배치 (잘림 방지) */}
          {secondaryPct != null && (
            <div title={secondaryReferenceLabel || '전국 핵심평가영역 평균'} style={{
              position: 'absolute', left: `${secondaryPct}%`, top: 0, bottom: 0,
              borderLeft: '3px dashed #6D28D9',
              transform: 'translateX(-1.5px)',
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          )}
          {/* 그룹/본인 평균 (target dot) */}
          {targetPct != null && (
            <div title={targetLabel ? `${targetLabel}: ${targetLevel}` : targetLevel} style={{
              position: 'absolute', left: `calc(${targetPct}% - 7px)`, top: '50%',
              width: 14, height: 14, borderRadius: '50%',
              background: LEVEL_COLORS[targetLevel] || '#2A75F3',
              transform: 'translateY(-50%)',
              border: '2.5px solid white',
              boxShadow: '0 0 0 1px #475569',
              pointerEvents: 'none',
            }} />
          )}
        </div>
        {showRailLabels && (
          <div style={{ display: 'flex', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginTop: 2 }}>
            {order.map((lv, i) => (
              <div key={lv} style={{ flex: 1, textAlign: 'center', borderRight: i < 4 ? '1px dashed #E2E8F0' : 'none' }}>
                {lv}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // [v3.32] 등급 평균 시각화 정책 — GradeAvgBar로 일원화 (이전: Stacked 막대 v3.25 → GradeRangeBar v3.26 폐기)
  // 「보통 (2.5/5)」 소수점 표기·범위 모델 폐기. 마커 위치로 정밀도 시각, 라벨은 정수 등급명만.
  // 학년 모드용 — 학년 전체 그룹 distribution 합산
  const gradeMergedDistribution = (grade) => {
    const cls = Object.values(classStats).filter(c => c.grade === grade);
    const merged = {};
    cls.forEach(c => {
      Object.entries(c.distribution || {}).forEach(([k, v]) => {
        merged[k] = (merged[k] || 0) + v;
      });
    });
    return merged;
  };
  // Stacked 막대 렌더 (5등급 좌→우 매우 우수→매우 노력)
  const renderDistBar = (distribution, opts = {}) => {
    const order = ['매우 우수', '우수', '보통', '노력', '매우 노력'];
    const total = Object.values(distribution || {}).reduce((s, n) => s + n, 0);
    const height = opts.height ?? 16;
    if (total === 0) {
      return <div style={{ height, background: '#F1F5F9', borderRadius: 4, fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>응시 0명</div>;
    }
    return (
      <div style={{ display: 'flex', height, borderRadius: 4, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
        {order.map((level) => {
          const cnt = distribution[level] || 0;
          if (cnt === 0) return null;
          const pct = (cnt / total) * 100;
          return (
            <div key={level} title={`${level}: ${cnt}명 (${pct.toFixed(0)}%)`}
                 style={{ width: `${pct}%`, background: LEVEL_COLORS[level] || '#CBD5E1' }} />
          );
        })}
      </div>
    );
  };

  // [v3.27] 등급 기반 일원화 — 영역별 Y idx는 mock에 사전 산출되어 저장됨 (areaBreakdown.*YIdx)
  // 종전 areaAvgYIdx(점수→Y) 헬퍼는 제거. UI는 a.classAvgYIdx / a.gradeAvgYIdx를 직접 사용
  // 등급명 → Y idx 매핑 (cross-scale 통일)
  const levelToYIndex = (level) => LEVEL_TO_Y[level] ?? 3;

  // [v3.42] 학습 추이 분석은 5단계 기준으로 정규화 (Method 3: 컷오프 overlap 가중)
  // - 3·4단계 과제도 1~5 풀 스케일을 사용 → 그룹/학년 평균 비교 시 inflate/deflate 완화
  // - mock의 yIdx에 포함된 sub-rubric 변동(±)은 보존 (base만 5단계로 재앵커링)
  const enrichTrendItem = (raw) => normalizeTrendEntry(raw);
  const enrichClassTrendItem = (raw) => normalizeTrendEntry(raw);

  // [v3.56] 과제 → 문항 구성 (출제 단위, 학생/그룹 공통). 학생 grade는 studentTrend.items에, 그룹은 areaBreakdown으로 값 산출
  const TASK_ITEMS = {
    '단원1 평가': [{ no: 1, area: '다항식' }, { no: 2, area: '다항식' }, { no: 3, area: '방정식과 부등식' }],
    '단원2 평가': [{ no: 1, area: '방정식과 부등식' }, { no: 2, area: '방정식과 부등식' }, { no: 3, area: '경우의 수' }],
    '단원3 평가': [{ no: 1, area: '경우의 수' }, { no: 2, area: '경우의 수' }, { no: 3, area: '행렬' }],
    '비례식 평가': [{ no: 1, area: '다항식' }, { no: 2, area: '다항식' }],
  };
  const taskItemsOf = (taskName) => TASK_ITEMS[taskName] || [{ no: 1, area: null }];
  // 그룹(class)의 과제 trend를 문항 단위로 확장 — 문항 값 = 그 영역의 그룹/학년 평균(areaBreakdown), 없으면 과제 평균 inherit
  //   선택 과목(currentAreas)에 속한 영역의 문항만 포함 → 과목 선택 시 그룹 차트/평균이 해당 과목으로 필터됨 ('전체'면 교과 전체 영역)
  const expandClassItems = (cs) => {
    if (!cs) return [];
    const abMap = {};
    (cs.areaBreakdown || []).forEach((a) => { abMap[a.area] = a; });
    return (cs.trend || []).map(enrichClassTrendItem).flatMap((t, ti) => {
      const items = taskItemsOf(t.taskName); // 추이/그룹 평균은 교과 기준 (과목 필터 없음)
      return items.map((it, ii) => {
        const ab = it.area ? abMap[it.area] : null;
        return {
          ...t,
          taskSeq: ti + 1, itemNo: it.no, itemLabel: `${ti + 1}-${ii + 1}`, area: it.area,
          isFirstOfTask: ii === 0, itemCount: items.length,
          avgYIdx: ab ? ab.classAvgYIdx : t.avgYIdx,
          gradeAvgYIdx: ab ? ab.gradeAvgYIdx : t.gradeAvgYIdx,
        };
      });
    });
  };

  // 자동 생성 인사이트 (mock) — v3.17: 액션 버튼 모두 삭제, 일부 인사이트에 학생 명단 추가 (클릭 expand)
  const insights = [
    { type: 'class_weak',      color: '#2A75F3', label: '그룹 약점',  message: '3-1반은 [비례식] 영역에서 학교 학년 등급 평균 대비 -1등급입니다.' },
    {
      type: 'student_decline', color: '#FB923C', label: '학생 하락',
      message: '지난 3회 연속 그룹 등급 평균 이하 학생 3명 — 보충 지도 권장.',
      students: [
        { name: '이영희', className: '3-1반', recentDelta: '−1등급', detail: '3회 연속 그룹 평균 이하 (보통 → 노력 → 노력)' },
        { name: '최서연', className: '3-1반', recentDelta: '−1등급', detail: '3회 연속 그룹 평균 이하 (보통 → 노력 → 노력)' },
        { name: '한지안', className: '4-2반', recentDelta: '−1등급', detail: '3회 연속 그룹 평균 이하 (보통 → 노력 → 노력)' },
      ],
    },
    {
      type: 'student_improve', color: '#10B981', label: '학생 향상',
      message: '지난 과제 대비 1등급 향상 학생 2명 — 칭찬·강화 추천.',
      students: [
        { name: '김민수', className: '3-1반', recentDelta: '+1등급', detail: '보통 → 우수 (단원2 → 단원3)' },
        { name: '오시현', className: '4-1반', recentDelta: '+1등급', detail: '보통 → 우수 (비례식 평가 → 단원3)' },
      ],
    },
    { type: 'class_excellent', color: '#2A75F3', label: '우수 그룹',  message: '3-2반은 동일 학년 등급 평균 대비 +1등급 우수합니다.' },
    { type: 'area_weak',       color: '#8B5CF6', label: '단원 약점',  message: '이번 학년도 [도형] 영역 등급 평균이 「보통」으로 가장 낮습니다.' },
  ];

  // ── 헬퍼 ──
  const buildLinePath = (points, max, x0, y0, w, h) => {
    if (points.length === 0) return '';
    const xs = points.map((_, i) => x0 + (i * w / Math.max(1, points.length - 1)));
    return points.map((v, i) => (i === 0 ? 'M' : 'L') + xs[i] + ',' + (y0 + h - (v / max) * h)).join(' ');
  };

  const buildDonut = (data, cx, cy, r) => {
    const total = data.reduce((s, x) => s + x.value, 0);
    let cur = 0;
    return data.map(d => {
      const startA = (cur / total) * Math.PI * 2 - Math.PI / 2;
      cur += d.value;
      const endA = (cur / total) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + r * Math.cos(startA);
      const y1 = cy + r * Math.sin(startA);
      const x2 = cx + r * Math.cos(endA);
      const y2 = cy + r * Math.sin(endA);
      const large = endA - startA > Math.PI ? 1 : 0;
      return {
        ...d,
        path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        percent: total > 0 ? (d.value / total) * 100 : 0,
      };
    });
  };

  // 색상 코딩 (영역별 등급 평균 차이 — v3.0 등급 단위)
  const diffColor = (diff) => {
    if (diff <= -1.0) return '#EF4444'; // 빨강 — 약점 (1등급 이상 낮음)
    if (diff <= -0.5) return '#F59E0B'; // 노랑 — 주의
    if (diff >= 0.5)  return '#10B981'; // 초록 — 강점
    return '#94A3B8';                   // 회색 — 보통
  };
  const diffLabel = (diff) => {
    if (diff <= -10) return '🔴 약점';
    if (diff <= -5)  return '🟡 주의';
    if (diff >= 5)   return '🟢 강점';
    return '⚪ 보통';
  };

  // [v1.8] 학년 list 도출 — 그룹/학생 데이터에서 unique 학년
  const availableGrades = useMemo(() => {
    const fromClass = Object.values(classStats).map(c => c.grade);
    const fromStudent = students.map(s => s.grade);
    return Array.from(new Set([...fromClass, ...fromStudent])).sort((a, b) => a - b);
  }, []);
  const showGradeSelector = availableGrades.length >= 2;
  // 현재 학년에 속한 그룹 list
  // [정책] 학습 추이 분석은 단일 학년 그룹만 대상. classStats[그룹].grade는 단일 학년 값이며,
  //   학년이 혼합된 그룹(production에서 grade가 단일하지 않은 그룹)은 selectedTrendGrade 매칭에서
  //   자연히 제외된다 (학년 기준 평균·ranking 비교가 성립하지 않으므로). 혼합 그룹은 추이 분석 미노출.
  const classesInGrade = useMemo(() =>
    Object.entries(classStats).filter(([, c]) => c.grade === selectedTrendGrade).map(([n]) => n)
  , [selectedTrendGrade]);

  // ── 학생 개인 추이 데이터 ──
  // [v3.4] 영역 필터 폐기 — 교과(selectedSubject) 단위로만 필터링
  // studentTrend + areaTrend 합쳐 선택 교과의 영역에 속한 과제만 시간순 노출
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const trend = useMemo(() => {
    const subjectAreas = subjectCatalog[selectedSubject]?.areas || []; // 추이는 교과 기준 (과목 무관)
    const base = studentTrend[selectedStudentId] || [];
    const at = areaTrend[selectedStudentId];
    const fromArea = at
      ? Object.entries(at).flatMap(([area, arr]) => arr.map(p => ({ ...p, area })))
      : [];
    const merged = [...base, ...fromArea];
    // (taskName + date) 중복 제거
    const seen = new Set();
    const dedup = merged.filter(t => {
      const key = `${t.taskName || ''}|${t.date || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // 교과 영역 필터 + 시간순 정렬 + 등급 일원화 enrich (v3.28)
    const enriched = dedup
      .filter(t => !t.area || subjectAreas.length === 0 || subjectAreas.includes(t.area))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(enrichTrendItem);
    // [v3.39] 학년 평균 fallback — areaTrend mock에 gradeAvgYIdx가 없는 경우 학생 그룹의 영역별 gradeAvgYIdx 채움
    const stu = students.find(s => s.id === selectedStudentId);
    const classAreaMap = stu && classStats[stu.className]?.areaBreakdown
      ? classStats[stu.className].areaBreakdown.reduce((m, a) => { m[a.area] = a.gradeAvgYIdx; return m; }, {})
      : {};
    const LEVEL_NAMES_LOCAL = ['매우 노력', '노력', '보통', '우수', '매우 우수'];
    const toLevel = (y) => LEVEL_NAMES_LOCAL[Math.max(0, Math.min(4, Math.round(y) - 1))];
    return enriched.map(t => {
      const fallbackG = classAreaMap[t.area] ?? t.classAvgYIdx;
      return {
        ...t,
        gradeAvgYIdx: t.gradeAvgYIdx ?? fallbackG,
        gradeAvgNativeLevel: t.gradeAvgNativeLevel ?? toLevel(fallbackG),
      };
    });
  }, [selectedStudentId, selectedSubject]);

  // [v3.56] 문항 단위 X축 — 과제를 문항으로 펼쳐 나열 (과제1-1, 1-2, 2-1 …)
  //   그룹/학년 평균은 문항별 데이터가 없어 과제 값 inherit, 날짜는 과제(마지막 완료) 1개 표시
  const itemTrend = useMemo(() => {
    return trend.flatMap((t, ti) => {
      const items = getTaskItems(t); // 추이는 교과 기준 (과목 필터 없음)
      return items.map((it, ii) => ({
        taskSeq: ti + 1,
        taskName: t.taskName,
        date: t.date,
        area: it.area,
        itemNo: ii + 1,
        itemLabel: `${ti + 1}-${ii + 1}`,
        nativeLevel: it.level,
        yIdx: LEVEL_TO_Y[it.level] ?? 3,
        classAvgYIdx: t.classAvgYIdx,
        gradeAvgYIdx: t.gradeAvgYIdx,
        classAvgNativeLevel: t.classAvgNativeLevel,
        gradeAvgNativeLevel: t.gradeAvgNativeLevel,
        scale: t.scale,
        real: it.real,
        isFirstOfTask: ii === 0,
        itemCount: items.length,
      }));
    });
  }, [trend]);
  // 핵심평가영역별 점 색상 — 선택 과목 영역(currentAreas) 기준 (학생/그룹 모드 공통)
  const AREA_COLORS = ['#2A75F3', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
  const areaColorMap = {};
  currentAreas.forEach((a, i) => { areaColorMap[a] = AREA_COLORS[i % AREA_COLORS.length]; });

  return (
    <div className="dashboard-content" style={{ padding: '2rem', background: '#F4F7FB', height: '100%', overflowY: 'auto' }}>
      {/* 스마트펜 모니터링 풀 오버레이 모달 — 사이드바·메인 위에 떠 있음 */}
      {showSmartpenModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }}>
          <div style={{ position: 'relative', flex: 1, margin: '20px', background: 'white', borderRadius: '20px', boxShadow: '0 30px 80px -20px rgba(15,23,42,0.45)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={() => setShowSmartpenModal(false)}
              aria-label="닫기"
              style={{ position: 'absolute', top: '12px', right: '14px', zIndex: 10, width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#475569', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}
            >×</button>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SmartpenMonitor />
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900 }}>대시보드</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowSmartpenModal(true)}
            style={{
              background: '#1E293B', color: 'white', border: 'none',
              padding: '8px 14px', borderRadius: '10px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}
          >📡 스마트펜 모니터링</button>
          <button style={{ background: 'none', border: 'none', color: '#8A94A1', fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🖊️ 펜 데이터 초기화
          </button>
        </div>
      </div>

      {/* Main Banner Card — [v2.1] 「내 서비스 기간」 + 「데이터 학년」 분리 */}
      <div style={{ background: 'linear-gradient(135deg, #4299E1 0%, #3182CE 100%)', borderRadius: '24px', padding: '2.5rem', color: 'white', marginBottom: '1.5rem', position: 'relative', boxShadow: '0 10px 25px rgba(49, 130, 206, 0.2)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>2026년 5월 6일</h2>
        <p style={{ fontSize: 'var(--neo-font-size-lg)', opacity: 0.9, marginBottom: '1.5rem' }}>과제관리, 채점현황, 통계분석을 한눈에 확인하세요.</p>

        {/* 내 서비스 기간 + 학교 크레딧 chip */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)' }}>📅 내 구독 기간 : </span>
            <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>{servicePeriodInfo.label}</span>
            {servicePeriodInfo.daysLeft !== null && servicePeriodInfo.daysLeft <= 7 && (
              <span style={{ background: '#F59E0B', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, marginLeft: '6px' }}>
                ⚠️ 만료 임박
              </span>
            )}
          </div>

          {/* 크레딧 사용량 chip — 4줄 구조: 라벨+pill / 잔량 메인 / 진행 바 / 사용% + 충전일 */}
          <div
            title={creditTooltip}
            style={{
              background: creditState === 'normal' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.96)',
              color: creditState === 'normal' ? 'white' : creditColor,
              padding: '0.7rem 1rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '300px',
              border: creditState !== 'normal' ? `1.5px solid ${creditColor}` : 'none',
              boxShadow: creditState !== 'normal' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {/* 줄 1: 라벨 + 상태 pill (+ 위급·소진 메시지) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>💰 크레딧</span>
              <span style={{
                background: creditPillBg,
                color: creditPillFg,
                fontSize: 'var(--neo-font-size-xs)',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}>
                {creditPillLabel}
              </span>
              {creditMessage && (
                <span style={{ fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>
                  · {creditMessage}
                </span>
              )}
            </div>
            {/* 줄 2: 잔량 / 전체 (큰 글씨, 메인 강조) + "남음" 작게 */}
            <div style={{
              fontWeight: 900,
              fontSize: 'var(--neo-font-size-lg)',
              lineHeight: 1.2,
              marginTop: '2px',
            }}>
              {schoolCredit.remaining.toLocaleString()} / {schoolCredit.total.toLocaleString()}
              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, marginLeft: '6px', opacity: 0.75 }}>남음</span>
            </div>
            {/* 줄 3: 진행 바 */}
            <div style={{
              height: '6px',
              borderRadius: '999px',
              background: creditState === 'normal' ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
              overflow: 'hidden',
              marginTop: '4px',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, creditUsedRatio))}%`,
                background: creditState === 'normal' ? 'white' : creditColor,
                borderRadius: '999px',
                transition: 'width 0.2s, background 0.2s',
              }} />
            </div>
            {/* 줄 4: 사용 %  ↔  충전 예정일 (양쪽 정렬) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              fontSize: 'var(--neo-font-size-xs)',
              fontWeight: 600,
              opacity: creditState === 'normal' ? 0.85 : 0.7,
              marginTop: '2px',
            }}>
              <span>{creditUsedRatioLabel}% 사용</span>
              {creditRefillDate && (
                <span>🔄 충전 예정 {creditRefillDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* 데이터 학년 안내 박스 — 노란 톤 강조, 셀렉트 X */}
        <div style={{ background: 'rgba(254, 243, 199, 0.95)', border: '1.5px solid #FBBF24', borderRadius: '12px', padding: '12px 16px', color: '#78350F', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: 'var(--neo-font-size-lg)', flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.55 }}>
              <strong style={{ fontWeight: 800, marginRight: '6px' }}>데이터 기준 학년도: {dataYear}</strong>
              <span style={{ fontWeight: 600, color: '#92400E' }}>({dataYearRange})</span>
              <div style={{ marginTop: '4px', fontWeight: 500 }}>
                본 대시보드의 학생·채점 데이터는 {dataYear}만 반영됩니다. 학년 종료 시 학생·채점 데이터는 자동 초기화되며, 과제는 영구 보존되어 다음 학년도에도 재활용됩니다.
              </div>
            </div>
          </div>
        </div>

        {/* 우상단 액션 버튼 */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '12px' }}>
          <button onClick={() => onNavigate && onNavigate('과제 등록')}
            style={{ background: 'white', color: '#1E2225', border: 'none', borderRadius: '14px', padding: '14px 24px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 18px -4px rgba(15,23,42,0.18)' }}>
            <span style={{ color: '#2A75F3' }}>＋</span> 과제등록
          </button>
          <button onClick={() => onNavigate && onNavigate('채점 관리')}
            style={{ background: 'white', color: '#1E2225', border: 'none', borderRadius: '14px', padding: '14px 24px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 18px -4px rgba(15,23,42,0.18)' }}>
            🤝 채점관리
          </button>
        </div>
      </div>

      {/* KPI 카드 3종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {stats.map((s, i) => (
          <div key={i} onClick={() => onNavigate && onNavigate(s.target)}
            style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: s.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              {s.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: '4px' }}>{s.title}</div>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                {s.metrics.map((m, mi) => (
                  <div key={mi}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{m.label}</div>
                    <div style={{ fontSize: m.emphasis ? 'var(--neo-font-size-xl)' : 'var(--neo-font-size-lg)', fontWeight: m.emphasis ? 900 : 800, color: m.emphasis ? s.color : '#1E2225' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 공지사항 + Q&A */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>공지사항 ›</h3>
            <button style={{ padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#4A5568', fontWeight: 600 }}>+ 새 공지</button>
          </div>
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>
            현재 등록된 공지사항이 없습니다.
          </div>
        </section>

        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>Q&A (FAQ) ›</h3>
            <button style={{ padding: '4px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#4A5568', fontWeight: 600 }}>+ 새 질문</button>
          </div>
          {faqs.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', fontWeight: 500 }}>{item.question}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{item.date}</span>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: item.status === '답변완료' ? '#10B981' : '#F59E0B', background: item.status === '답변완료' ? '#D1FAE5' : '#FEF3C7', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{item.status}</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* 단계별 진행 + 그룹 점수 분포 (이전 화면 동일 — 단순화) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '0.25rem' }}>단계별 진행 현황</h3>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginBottom: '1rem' }}>전 단계의 진행 현황의 통계를 확인할 수 있습니다.</p>
          <svg viewBox="0 0 400 280" style={{ width: '100%', height: 'auto' }}>
            {buildDonut(progressData, 200, 130, 90).map((a, i) => (
              <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth="40">
                <title>{`${a.name} ${a.value}건 (${a.percent.toFixed(0)}%)`}</title>
              </path>
            ))}
            <text x="200" y="130" textAnchor="middle" fontSize="13" fill="#64748B">총 진행</text>
            <text x="200" y="155" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1E2225">{progressData.reduce((s, x) => s + x.value, 0)}건</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginTop: '8px' }}>
            {progressData.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: d.color, borderRadius: 2, marginRight: 6 }}></span>{d.name}</span>
                <span style={{ fontWeight: 700 }}>{d.value}건 ({progressData.reduce((s, x) => s + x.value, 0) > 0 ? Math.round(d.value / progressData.reduce((s, x) => s + x.value, 0) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '0.25rem' }}>그룹 과제 개인 점수 분포표</h3>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginBottom: '0.75rem' }}>과제를 선택하고 셀을 클릭하면 학생 정보가 표시됩니다.</p>

          {/* 과제 목록 — 좌우 스크롤 chip list */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '6px 2px 10px',
            marginBottom: '12px',
            borderBottom: '1px solid #F1F5F9',
          }}>
            {tasks.map(t => {
              const isSelected = t.id === selectedTaskId;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTaskId(t.id); setDistTooltip(null); }}
                  style={{
                    flex: '0 0 auto',
                    padding: '6px 12px',
                    border: isSelected ? '1px solid #2A75F3' : '1px solid #E2E8F0',
                    borderRadius: '20px',
                    background: isSelected ? '#EFF6FF' : 'white',
                    color: isSelected ? '#1D4ED8' : '#475569',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.12s',
                  }}
                  title={`${t.subject} · ${t.date} · 평가 영역 ${t.area} · ${gradeScales[t.gradeScale]?.label || '5등급'}`}
                >
                  {isSelected && <span style={{ color: '#2A75F3' }}>✓</span>}
                  {t.name}
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: isSelected ? '#60A5FA' : '#94A3B8' }}>
                    {t.subject}
                  </span>
                  {/* [v2.8] 등급 체계 배지 */}
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: '8px', background: isSelected ? '#DBEAFE' : '#F1F5F9', color: isSelected ? '#1D4ED8' : '#64748B' }}>
                    {gradeScales[t.gradeScale]?.label || '5등급'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* [v3.15] 선택 과제 정보 안내 — native binning + 5등급 컬럼 매핑 정책 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '6px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#1D4ED8' }}>
            <span style={{ fontWeight: 800 }}>📋 {selectedTask?.name}</span>
            <span style={{ color: '#94A3B8' }}>·</span>
            <span style={{ color: '#475569', fontWeight: 600 }}>채점 체계: <strong style={{ color: '#1E2225' }}>{selectedScale.label}</strong> ({selectedScaleLevels.map(l => l.name).join(' · ')})</span>
            <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>※ 본 과제 체계에 없는 등급 컬럼은 <strong style={{ color: '#475569' }}>N/A</strong>로 표시 (학습추이 분석과 시선 매핑 유지)</span>
          </div>
          <div style={{ overflowX: 'auto', position: 'relative' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, color: '#475569' }}>그룹 그룹</th>
                  {gradeScales[5].levels.map(lv => {
                    const inNative = selectedScaleLevels.some(nl => nl.name === lv.name);
                    return (
                      <th
                        key={lv.name}
                        title={inNative ? '' : `본 과제는 ${selectedScale.label} 체계로 「${lv.name}」 등급이 없습니다.`}
                        style={{
                          textAlign: 'center', padding: '8px 12px',
                          borderBottom: `2px solid ${inNative ? lv.color : '#CBD5E1'}`,
                          fontWeight: 700,
                          color: inNative ? lv.color : '#94A3B8',
                          opacity: inNative ? 1 : 0.65,
                          textDecoration: inNative ? 'none' : 'line-through',
                          textDecorationColor: '#CBD5E1',
                        }}
                      >{lv.name}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(classStats).map(([clsName, cs]) => {
                  // [v3.15] native binning — 선택 과제 scale 기준으로 학생 등급 산출, 5등급 컬럼에 매핑
                  // 동일 이름 컬럼만 카운트됨. native에 없는 등급(예: 3등급의 「매우 우수」)은 항상 0 → N/A 표시
                  const classStudents = students.filter(s => s.className === clsName);
                  const dynamicDist = {};
                  classStudents.forEach(s => {
                    // [v3.31] 학생 level 직접 사용 (legacyScore 폐기) — 5등급 기준 일반 등급 분포
                    // production: student × selectedTask의 nativeLevel ledger 도입 시 task별 정확한 분포로 교체 가능
                    dynamicDist[s.level] = (dynamicDist[s.level] || 0) + 1;
                  });
                  const total = classStudents.length;
                  return (
                    <tr key={clsName} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1E2225' }}>{clsName}</td>
                      {gradeScales[5].levels.map(lv => {
                        const level = lv.name;
                        // [v3.15] 본 과제의 native scale에 이 등급이 존재하는가?
                        const inNative = selectedScaleLevels.some(nl => nl.name === level);
                        if (!inNative) {
                          return (
                            <td
                              key={level}
                              title={`본 과제는 ${selectedScale.label} 체계로 「${level}」 등급이 없습니다.`}
                              style={{
                                padding: '10px 12px',
                                textAlign: 'center',
                                background: 'repeating-linear-gradient(45deg, #F8FAFC, #F8FAFC 4px, #E2E8F0 4px, #E2E8F0 8px)',
                                color: '#94A3B8',
                                fontWeight: 600,
                                fontSize: 'var(--neo-font-size-sm)',
                                cursor: 'not-allowed',
                                userSelect: 'none',
                              }}
                            >N/A</td>
                          );
                        }
                        const cnt = dynamicDist[level] || 0;
                        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                        const intensity = pct / 100;
                        const clickable = cnt > 0;
                        const isActive = distTooltip && distTooltip.className === clsName && distTooltip.level === level;
                        return (
                          <td
                            key={level}
                            onClick={(e) => {
                              if (!clickable) return;
                              if (isActive) { setDistTooltip(null); return; } // toggle close
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDistTooltip({
                                className: clsName,
                                level,
                                x: rect.left + rect.width / 2,
                                y: rect.bottom + 8,
                              });
                            }}
                            title={clickable ? '클릭하면 학생 정보가 표시됩니다' : ''}
                            style={{
                              padding: '10px 12px',
                              textAlign: 'center',
                              background: pct > 0 ? `rgba(42, 117, 243, ${0.1 + intensity * 0.55})` : 'transparent',
                              color: pct > 50 ? 'white' : '#1E2225',
                              fontWeight: 600,
                              cursor: clickable ? 'pointer' : 'default',
                              transition: 'all 0.12s',
                              userSelect: 'none',
                              outline: isActive ? '2px solid #2A75F3' : 'none',
                              outlineOffset: isActive ? '-2px' : 0,
                            }}
                            onMouseEnter={(e) => { if (clickable && !isActive) e.currentTarget.style.outline = '2px solid #BFDBFE'; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.outline = 'none'; }}
                          >
                            {pct}% ({cnt}명)
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* [NEW] 학습 추이 분석                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="trend-analysis" style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginBottom: '1.5rem', scrollMarginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>📈 학습 추이 분석</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>학년 평균은 <strong style={{ color: '#1D4ED8' }}>동일학교 · 동일 교과</strong> 전체 교사가 채점한 등급을 합산해 산출합니다. (차트 범례에서 <strong>전국 핵심평가영역 기준</strong>으로 전환 가능)</span>
              <br />
              <span style={{ color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>※ <strong style={{ color: '#1D4ED8' }}>결과 발송이 완료된 과제</strong>의 교사 확정 등급만 분석에 반영됩니다 (채점 진행 중 과제 제외).</span>
              <br />
              <span style={{ color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>※ 학년 평균·그룹 비교는 <strong style={{ color: '#1D4ED8' }}>단일 학년 그룹</strong>만 대상으로 합니다. 학년이 혼합된 그룹은 학년 기준 비교가 불가하여 추이 분석에서 제외됩니다.</span>
              <br />
              <span style={{ color: '#7C3AED', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>※ Y축 위치는 5등급 base로 정규화한 시각 비교용. 점 라벨·툴팁의 등급명은 그 과제의 원본 채점 체계(3/4/5등급)로 표기됩니다.</span>
            </p>
          </div>
        </div>

        {/* v2.0 통합 추이: 학년/그룹/학생 필터로 단일 화면 구성 */}
        {(() => {
          // [v3.2] Y축을 점수(0~100)에서 등급(1~5)으로 전환
          const max = 5;
          // [v3.38] X축 시점당 폭 200 (라벨 겹침 방지). 차트 wrapper는 부모 컨테이너 width 100%.
          // svg minWidth가 wrapper width보다 크면 좌우 스크롤 자연 발생 (모니터 폭에 따라 가변)
          const TICK_WIDTH = 200;
          const BASE_W = 1100;
          const TASK_NAME_MAX = 15; // 과제명 최대 15자(말줄임 … 포함). 초과 시 14자+…, 전체는 hover title로 노출
          const truncateName = (s) => (s && s.length > TASK_NAME_MAX ? s.slice(0, 14) + '…' : s || '');
          const h = 240;
          const x0 = 80, y0 = 30; // 등급명 라벨 너비 확보
          // v2.0 — 통합 분기: hasStudent / isAllClassMode / 단일 그룹
          const hasStudent = !!selectedStudentId;
          const classes = Object.entries(classStats).filter(([, c]) => c.grade === selectedTrendGrade);
          const isAllClassMode = selectedClass === 'all' || !classStats[selectedClass] || classStats[selectedClass].grade !== selectedTrendGrade;
          const cMulti = ['#2A75F3', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
          // 현재 plot할 시점 수 — 학생/그룹/전체 그룹 모드 모두 동일 산출
          const activeTrendLen =
            hasStudent ? (trend?.length || 0)
            : isAllClassMode ? (classes[0]?.[1]?.trend?.length || 0)
            : (classStats[selectedClass]?.trend?.length || 0);
          const w = Math.max(BASE_W, activeTrendLen * TICK_WIDTH);
          // [v3.56] 문항 단위 X축 폭 (문항당 90px) — 학생/그룹 모드 공통
          const ITEM_TICK = 150;
          // [v3.5] 학년 평균 산출 정의: 동일학교·선택 교과(selectedSubject) 전체 교사가 채점한 등급의 시점별 평균
          // production: gradeAvgBySubject[subject][grade][monthIndex] 형태 SCD-2 ledger 조회
          // mock: 단일 source로 그룹 평균 합산 사용 (selectedSubject 변경 시 같은 값 반환 — 한계)
          // [v3.28] 학년 평균 trend도 Y idx 단위로 산출 (점수 평균 미사용)
          const gradeAvgTrend = classes.length > 0
            ? classes[0][1].trend.map((_, i) => {
                const yIdxs = classes.map(([, cs2]) => enrichClassTrendItem(cs2.trend[i]).avgYIdx);
                return +(yIdxs.reduce((s, y) => s + y, 0) / yIdxs.length).toFixed(2);
              })
            : [];
          // [v3.44] 전국 영역 평균 trend — 전국 토글 ON 시 추가 라인. 영역 매핑 실패·표본 부족 점은 학교 평균으로 자연 fallback
          const nationalAvgTrend = classes.length > 0
            ? classes[0][1].trend.map((entry, i) => nationalRefY(entry, selectedTrendGrade) ?? gradeAvgTrend[i])
            : [];
          const csOne = !isAllClassMode ? classStats[selectedClass] : null;
          // [v3.56] 모드별 문항 단위 축 — 전체 그룹: classes[0] 기준 / 단일 그룹: csOne 기준 / 학생: itemTrend
          const groupRefItems = hasStudent ? [] : (isAllClassMode ? (classes[0] ? expandClassItems(classes[0][1]) : []) : expandClassItems(csOne));
          const activeItemLen = hasStudent ? itemTrend.length : groupRefItems.length;
          const itemW = Math.max(BASE_W, (activeItemLen || 1) * ITEM_TICK);
          // 전체 그룹 모드 — 문항별 학년 평균(영역 기반) 라인
          const gradeAvgItems = groupRefItems.map((it) => it.gradeAvgYIdx);

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '20px' }}>
              {/* v2.0 — 학년/그룹/학생 통합 필터 사이드바 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* [v2.5] 교과 필터 — 본 교사 출제 교과 list */}
                <div>
                  <label style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>교과</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      const sub = e.target.value;
                      setSelectedSubject(sub);
                      setSelectedCourse('전체'); // 교과 변경 시 과목 '전체'로 리셋
                      setAreaFilter('all');
                    }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}
                  >
                    {Object.keys(subjectCatalog).map(s => <option key={s} value={s}>📚 {s}</option>)}
                  </select>
                </div>
                {/* [v2.6] 과목 필터 — 선택 교과 하위 과목 list */}
                <div>
                  <label style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>과목</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => { setSelectedCourse(e.target.value); setAreaFilter('all'); }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}
                  >
                    <option value="전체">📚 전체 (과목 미선택)</option>
                    {Object.keys(subjectCatalog[selectedSubject]?.courses || {}).map(c => <option key={c} value={c}>📖 {c}</option>)}
                  </select>
                  {selectedCourse === '전체' && (
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '3px', lineHeight: 1.4 }}>
                      ※ 핵심평가영역별 분석은 과목을 선택해야 활성화됩니다.
                    </div>
                  )}
                </div>
                {/* 학년 필터 */}
                {showGradeSelector && (
                  <div>
                    <label style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>학년</label>
                    <select
                      value={selectedTrendGrade}
                      onChange={(e) => {
                        setSelectedTrendGrade(Number(e.target.value));
                        setSelectedClass('all');
                        setSelectedStudentId(null);
                      }}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}
                    >
                      {availableGrades.map(g => <option key={g} value={g}>{g}학년</option>)}
                    </select>
                  </div>
                )}
                {/* 그룹 필터 */}
                <div>
                  <label style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '2px' }}>그룹</label>
                  <select value={isAllClassMode ? 'all' : selectedClass}
                    onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(null); }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                    <option value="all">전체 그룹 ({selectedTrendGrade}학년)</option>
                    {classesInGrade.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '3px', lineHeight: 1.4 }}>
                    ※ 단일 학년 그룹만 표시됩니다. 학년이 섞인 그룹은 학년 기준 비교가 불가하여 분석에서 제외됩니다.
                  </div>
                </div>
                {/* 학생 — 미선택(그룹 평균 모드) 옵션 + list */}
                <div style={{ marginTop: '4px' }}>
                  <label style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '4px' }}>학생</label>
                  <button
                    onClick={() => setSelectedStudentId(null)}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid',
                      borderColor: !selectedStudentId ? '#2A75F3' : '#E2E8F0',
                      borderRadius: '10px',
                      background: !selectedStudentId ? '#EFF6FF' : 'white',
                      color: !selectedStudentId ? '#1D4ED8' : '#64748B',
                      fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', textAlign: 'left',
                      marginBottom: '6px',
                    }}
                  >
                    📊 학생 미선택 (그룹/학년 평균 모드)
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                  {students
                    .filter(s => s.grade === selectedTrendGrade)
                    .filter(s => isAllClassMode || s.className === selectedClass)
                    .map(s => (
                      <button key={s.id} onClick={() => setSelectedStudentId(s.id)}
                        style={{ padding: '10px 12px', border: '1px solid', borderColor: selectedStudentId === s.id ? '#2A75F3' : '#E2E8F0', borderRadius: '10px', background: selectedStudentId === s.id ? '#EFF6FF' : 'white', textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: selectedStudentId === s.id ? '#1D4ED8' : '#1E2225' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{s.className}</div>
                      </button>
                    ))}
                </div>
              </div>

              {/* 차트 + 통계 */}
              <div>
              {hasStudent ? (
              <>
                {/* [v3.57] 컨텍스트 표시 — 학년/그룹/학생 + 교과/문항별 성취 컨텍스트 통합 (이전 2줄 분리 → 1박스) */}
                <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', fontWeight: 700 }}>
                  📌 <strong style={{ color: '#1D4ED8' }}>{selectedStudent?.name}</strong> ({selectedTrendGrade}학년 {selectedStudent?.className}) · {selectedSubject} 교과 · 문항별 성취
                  <span style={{ marginLeft: '8px', color: '#94A3B8', fontWeight: 500, fontSize: 'var(--neo-font-size-xs)' }}>· 과제를 문항(과제N-M) 단위로 펼쳐 표시 · 점 색 = 핵심평가영역 · 학년 평균은 동일학교·동일 교과 전체 교사 채점 합산</span>
                </div>

                {/* 데이터 부족 안내 (교과 trend < 2회) */}
                {itemTrend.length < 2 ? (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '20px', fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', textAlign: 'center' }}>
                    {selectedSubject} 교과 응시 데이터가 부족합니다. 같은 교과 추가 과제가 채점되면 추이가 표시됩니다 (현재 문항 {itemTrend.length}개).
                  </div>
                ) : (
                  <>
                    {/* [v3.20] 범례 — 차트 위로 이동 (X축 라벨과 시각 충돌 방지). v3.39: 학년 평균 범례 추가 */}
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'flex-end', fontSize: 'var(--neo-font-size-sm)', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#2A75F3', verticalAlign: 'middle', marginRight: 6 }}></span>{selectedStudent?.name} 등급</span>
                      <span><span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #94A3B8', verticalAlign: 'middle', marginRight: 6 }}></span>그룹 등급 평균</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '3px dashed #1E2225', verticalAlign: 'middle' }} />
                        {selectedTrendGrade}학년 등급 평균 (동일학교·동일 교과 합산)
                      </span>
                      {/* [v3.53] 전국 핵심평가영역 평균 토글은 「핵심평가영역(내용체계)별 학년 평균」 헤더로 이동됨 */}
                    </div>
                    {/* 시계열 라인 — v3.38: 시점당 200px + truncate 14자, wrapper width 100% (부모 폭 전체). v3.39: 안내를 wrapper 안 sticky로 차트 묶음. v3.57: Y축 sticky 고정 — 가로 스크롤 시 좌측 등급명 라벨 고정 */}
                    <div ref={trendScrollRef} style={{ position: 'relative', display: 'flex', overflowX: 'auto', overflowY: 'hidden', width: '100%', borderRadius: '6px' }}>
                    {/* [v3.57] 좌측 Y축 sticky overlay — 가로 스크롤 시에도 등급명 라벨 고정 */}
                    <div style={{ position: 'sticky', left: 0, flexShrink: 0, width: `${x0}px`, height: `${h + y0 + 44}px`, background: 'white', zIndex: 2, pointerEvents: 'none' }}>
                      <svg width={x0} height={h + y0 + 44} viewBox={`0 0 ${x0} ${h + y0 + 44}`} style={{ display: 'block' }}>
                        {[1, 2, 3, 4, 5].map((gradePoint, i) => {
                          const y = y0 + h - (gradePoint / max) * h;
                          return (
                            <text key={i} x={x0 - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{pointToLevelName(gradePoint)}</text>
                          );
                        })}
                      </svg>
                    </div>
                    <svg viewBox={`0 0 ${itemW + x0 + 60} ${h + y0 + 44}`} style={{ flexShrink: 0, width: `${itemW + x0 + 60}px`, height: `${h + y0 + 44}px`, marginLeft: `-${x0}px`, display: 'block' }}>
                      {[1, 2, 3, 4, 5].map((gradePoint, i) => {
                        const y = y0 + h - (gradePoint / max) * h;
                        return (
                          <line key={i} x1={x0} y1={y} x2={x0 + itemW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        );
                      })}
                      {/* [v3.28] 등급 일원화 — enriched yIdx 직접 사용 (score 미사용) */}
                      {/* 학년 등급 평균(동일학교, 검정 점선) — 기본으로 항상 표시 */}
                      <path d={buildLinePath(itemTrend.map(t => t.gradeAvgYIdx), max, x0, y0, itemW, h)} fill="none" stroke="#1E2225" strokeWidth="2.5" strokeDasharray="8 4" />
                      {/* [v3.52] 학습추이 차트는 본인·그룹·학교 학년 평균에 집중. 전국 평균 라인은 폐기 (아래 영역별 학년 평균 비교에서 노출) */}
                      {/* 그룹 등급 평균 (회색 점선) */}
                      <path d={buildLinePath(itemTrend.map(t => t.classAvgYIdx), max, x0, y0, itemW, h)} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />
                      {/* 본인 등급 (문항 단위) */}
                      <path d={buildLinePath(itemTrend.map(t => t.yIdx), max, x0, y0, itemW, h)} fill="none" stroke="#2A75F3" strokeWidth="3" />
                      {/* 과제 그룹 구분선 + 과제명·날짜 (문항 묶음의 가운데) */}
                      {itemTrend.map((t, i) => {
                        if (!t.isFirstOfTask) return null;
                        const denom = Math.max(1, itemTrend.length - 1);
                        const groupCx = x0 + ((i + (t.itemCount - 1) / 2) * itemW / denom);
                        const sepX = x0 + ((i - 0.5) * itemW / denom);
                        return (
                          <g key={`grp-${i}`} style={{ pointerEvents: 'none' }}>
                            {i > 0 && <line x1={sepX} y1={y0} x2={sepX} y2={y0 + h + 6} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />}
                          </g>
                        );
                      })}
                      {itemTrend.map((t, i) => {
                        const myYIdx = t.yIdx;
                        const myNormLevel = pointToLevelName(myYIdx);
                        const cx = x0 + (i * itemW / Math.max(1, itemTrend.length - 1));
                        const cy = y0 + h - (myYIdx / max) * h;
                        const dotColor = areaColorMap[t.area] || '#2A75F3';
                        return (
                          <g key={i}>
                            {/* 클릭 영역 확장용 투명 큰 원 */}
                            <circle cx={cx} cy={cy} r="14" fill="transparent" style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setPointTooltip(p => p?.pinned ? p : { idx: i })}
                              onMouseLeave={() => setPointTooltip(p => p?.pinned ? p : null)}
                              onClick={(e) => { e.stopPropagation(); setPointTooltip(p => (p?.idx === i && p.pinned) ? null : { idx: i, pinned: true }); }} />
                            <circle cx={cx} cy={cy} r="5" fill={dotColor} stroke="white" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1E2225" style={{ pointerEvents: 'none' }}>{myNormLevel}</text>
                            <text x={cx} y={y0 + h + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{truncateName(t.taskName)}-{t.itemNo}<title>{t.taskName}</title></text>
                            <text x={cx} y={y0 + h + 34} textAnchor="middle" fontSize="9" fill="#94A3B8">({t.date})</text>
                          </g>
                        );
                      })}
                      {/* [v3.43] 차트 점 툴팁 — hover 또는 click 시 노출 (click 시 pinned, 닫기 ✕ 표시) */}
                      {pointTooltip && (() => {
                        const t = itemTrend[pointTooltip.idx];
                        if (!t) return null;
                        const tCx = x0 + (pointTooltip.idx * itemW / Math.max(1, itemTrend.length - 1));
                        const tCy = y0 + h - (t.yIdx / max) * h;
                        const scaleKey = t.scale;
                        const myNativeLevel = t.nativeLevel;
                        const myNormLevel = pointToLevelName(t.yIdx);
                        const clsNativeLevel = t.classAvgNativeLevel;
                        const clsNormLevel = pointToLevelName(t.classAvgYIdx);
                        const gradeNativeLevel = t.gradeAvgNativeLevel;
                        const gradeNormLevel = t.gradeAvgYIdx != null ? pointToLevelName(t.gradeAvgYIdx) : null;
                        const tipW = 320;
                        const tipH = 115;
                        const isLeft = tCx < x0 + itemW / 2;
                        const tipX = Math.max(x0, Math.min(x0 + itemW - tipW, tCx + (isLeft ? 14 : -tipW - 14)));
                        const tipY = Math.max(y0 + 4, tCy - tipH / 2);
                        return (
                          <g data-tooltip-card="true" pointerEvents={pointTooltip.pinned ? 'auto' : 'none'}>
                            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="8" fill="#1E293B" stroke="#2A75F3" strokeWidth="1.5" />
                            <text x={tipX + 12} y={tipY + 20} fill="#F1F5F9" fontSize="12" fontWeight="800">{t.taskName}-{t.itemNo}</text>
                            <text x={tipX + 12} y={tipY + 38} fill="#94A3B8" fontSize="10">📅 {t.date} · {t.itemNo}번 문항 · {t.area}</text>
                            <text x={tipX + 12} y={tipY + 60} fill="#E2E8F0" fontSize="11" fontWeight="700">본인 등급</text>
                            <text x={tipX + 92} y={tipY + 60} fill="#10B981" fontSize="11" fontWeight="800">{myNativeLevel} ({scaleKey}단계)<tspan fill="#94A3B8" fontSize="10" fontWeight="700"> / {myNormLevel} (5단계)</tspan></text>
                            <text x={tipX + 12} y={tipY + 80} fill="#E2E8F0" fontSize="11" fontWeight="700">그룹 평균</text>
                            <text x={tipX + 92} y={tipY + 80} fill="#CBD5E1" fontSize="11" fontWeight="700">{clsNativeLevel} ({scaleKey}단계)<tspan fill="#94A3B8" fontSize="10" fontWeight="700"> / {clsNormLevel} (5단계)</tspan></text>
                            {gradeNormLevel && (
                              <>
                                <text x={tipX + 12} y={tipY + 100} fill="#E2E8F0" fontSize="11" fontWeight="700">학년 평균</text>
                                <text x={tipX + 92} y={tipY + 100} fill="#CBD5E1" fontSize="11" fontWeight="700">{gradeNativeLevel} ({scaleKey}단계)<tspan fill="#94A3B8" fontSize="10" fontWeight="700"> / {gradeNormLevel} (5단계)</tspan></text>
                              </>
                            )}
                            {pointTooltip.pinned && (
                              <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setPointTooltip(null); }}>
                                <circle cx={tipX + tipW - 12} cy={tipY + 12} r="9" fill="#334155" />
                                <text x={tipX + tipW - 12} y={tipY + 16} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">✕</text>
                              </g>
                            )}
                          </g>
                        );
                      })()}
                      <line x1={x0} y1={y0 + h} x2={x0 + itemW} y2={y0 + h} stroke="#CBD5E1" strokeWidth="1" />
                    </svg>
                    </div>
                    {itemTrend.length * ITEM_TICK > BASE_W && (
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#7C3AED', fontWeight: 700, textAlign: 'center', padding: '6px 8px', background: '#F5F3FF', borderTop: '1px solid #E2E8F0', borderRadius: '0 0 6px 6px' }}>
                        ← 좌우 스크롤로 모든 문항 확인 →
                      </div>
                    )}

                    {/* [v3.32] 누적 통계 카드 3종 — 학년/그룹 평균 reference + 본인 marker, 소수점 폐기 */}
                    {trend.length > 0 && (() => {
                      const currentTask = trend[trend.length - 1]; // 최근 응시 = 현재 위치
                      const avgClassYIdx = trend.reduce((s, t) => s + t.classAvgYIdx, 0) / trend.length;
                      const lastDeltaInt = trend.length >= 2
                        ? Math.round(trend[trend.length - 1].yIdx) - Math.round(trend[trend.length - 2].yIdx)
                        : 0;
                      const weakest = [...trend].sort((a, b) => (a.yIdx - a.classAvgYIdx) - (b.yIdx - b.classAvgYIdx))[0];
                      const weakestDiffInt = weakest ? Math.round(weakest.yIdx - weakest.classAvgYIdx) : 0;
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
                          {/* 카드 1: 본인 등급 평균 (그룹 평균 reference) */}
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>본인 등급 (그룹 평균 대비)</div>
                            <GradeAvgBar targetYIdx={currentTask.yIdx} referenceYIdx={avgClassYIdx} targetLabel="현재" />
                            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', fontWeight: 800, marginTop: '6px' }}
                              title={`기본 등급: ${currentTask.nativeLevel} (${currentTask.scale}단계) · 정규화 등급: ${pointToLevelName(currentTask.yIdx)} (5단계)`}>
                              현재: {pointToLevelName(currentTask.yIdx)}
                              <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 'var(--neo-font-size-xs)', marginLeft: '6px' }}>({currentTask.taskName})</span>
                            </div>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>┃ 그룹 평균</div>
                          </div>
                          {/* 카드 2: 직전 대비 (정수) */}
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>직전 대비</div>
                            <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: lastDeltaInt > 0 ? '#10B981' : lastDeltaInt < 0 ? '#EF4444' : '#94A3B8', lineHeight: 1.1 }}>
                              {lastDeltaInt === 0 ? '동등' : `${lastDeltaInt >= 0 ? '+' : ''}${lastDeltaInt}등급`}
                            </div>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>
                              {lastDeltaInt > 0 ? '↑ 향상' : lastDeltaInt < 0 ? '↓ 하락' : '동일 등급'}
                            </div>
                          </div>
                          {/* 카드 3: 가장 낮은 영역 */}
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>그룹 평균 대비 가장 낮은 핵심평가영역(내용체계)</div>
                            <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: '#FB923C', lineHeight: 1.1 }}>{weakest?.area || '-'}</div>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>
                              {weakest ? `그룹 대비 ${weakestDiffInt >= 0 ? '+' : ''}${weakestDiffInt}등급` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 시점별 등급 표 (문항 단위) — 10개 초과 시 세로 스크롤(헤더 고정) */}
                    {itemTrend.length >= 2 && (() => {
                      const th = { padding: '10px 12px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, color: '#475569', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 };
                      return (
                      <div style={{ marginTop: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'hidden', overflowY: 'auto', maxHeight: '420px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                          <thead>
                            <tr>
                              <th style={{ ...th, textAlign: 'left'  }}>순서·일자</th>
                              <th style={{ ...th, textAlign: 'left'  }}>과제·문항</th>
                              <th style={{ ...th, textAlign: 'right' }}>본인 등급</th>
                              <th style={{ ...th, textAlign: 'right' }}>그룹 등급 평균</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemTrend.map((t, i) => {
                              const scaleKey = t.scale;
                              const myNativeLevel = t.nativeLevel;
                              const clsNativeLevel = t.classAvgNativeLevel;
                              const myNormLevel = pointToLevelName(t.yIdx);
                              const clsNormLevel = pointToLevelName(t.classAvgYIdx);
                              const myColor = LEVEL_COLORS[myNormLevel] || '#1E2225';
                              const myTitle = `기본 등급: ${myNativeLevel} (${scaleKey}단계) · 정규화 등급: ${myNormLevel} (5단계)`;
                              const clsTitle = `기본 등급: ${clsNativeLevel} (${scaleKey}단계) · 정규화 등급: ${clsNormLevel} (5단계)`;
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{i + 1} · {t.date}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1E2225' }}>{t.taskName}-{t.itemNo}</td>
                                  <td title={myTitle} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: myColor, cursor: 'help' }}>{myNormLevel}</td>
                                  <td title={clsTitle} style={{ padding: '10px 12px', textAlign: 'right', color: '#64748B', cursor: 'help' }}>{clsNormLevel}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      );
                    })()}

                    {/* [v3.37] 학생 모드 — 학생 영역별 평균 vs 그룹 평균 */}
                    {/* [v3.43] 각 task 엔트리에 enrichTrendItem(=normalizeTrendEntry) 적용 후 평균 → 3·4단계 과제도 5단계로 정규화 */}
                    {(() => {
                      if (selectedCourse === '전체') return (
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px dashed #E2E8F0' }}>
                          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '18px', fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', textAlign: 'center', lineHeight: 1.6 }}>
                            🎯 핵심평가영역(내용체계)별 분석은 <strong>과목을 선택해야 활성화</strong>됩니다.<br />
                            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#C2410C' }}>상단 「과목」에서 특정 과목(예: 공통수학1)을 선택하면 해당 과목의 핵심평가영역별 분석이 표시됩니다.</span>
                          </div>
                        </div>
                      );
                      const at = areaTrend[selectedStudentId];
                      if (!at) return null;
                      const subjectAreas = currentAreas; // 핵심평가영역은 선택 과목 기준
                      const rows = subjectAreas
                        .map(area => {
                          const rawArr = at[area];
                          if (!rawArr || rawArr.length === 0) return null;
                          const arr = rawArr.map(enrichTrendItem); // ← 5단계 정규화 적용
                          const stuYIdx = arr.reduce((s, t) => s + t.yIdx, 0) / arr.length;
                          const clsYIdx = arr.reduce((s, t) => s + t.classAvgYIdx, 0) / arr.length;
                          return { area, stuYIdx, clsYIdx, n: arr.length };
                        })
                        .filter(Boolean);
                      // [v3.55] 학생 모드에 학교 학년 평균 추가 — 본인 vs 그룹만 비교하던 한계 보완
                      //   학교 학년 평균은 학생이 속한 그룹의 classStats.areaBreakdown.gradeAvgYIdx에서 영역별로 조회
                      const _className = selectedStudent?.className;
                      const _cs = _className ? classStats[_className] : null;
                      const areaGradeAvgMap = _cs?.areaBreakdown
                        ? _cs.areaBreakdown.reduce((m, a) => { m[a.area] = a.gradeAvgYIdx; return m; }, {})
                        : {};
                      // [영역 순서 고정] subjectCatalog.areas(교육과정) 순서 유지 — 학생 전환 시에도 위치 동일
                      if (rows.length === 0) return null;
                      return (
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px dashed #E2E8F0' }}>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0 }}>🎯 핵심평가영역(내용체계)별 그룹 평균 대비 분석</h4>
                              {/* [v3.57] 전국 평균 토글 — 학생 모드에도 추가 (그룹 모드와 동일) */}
                              <button onClick={() => setShowNationalRef(v => !v)}
                                title={showNationalRef ? '전국 핵심평가영역 평균 마커 숨기기' : '아래 비교 막대에 전국 평균을 보라 마커 「전국」으로 추가 표시. 표본 부족·영역 매핑 실패 시 해당 영역만 미노출'}
                                style={{ padding: '4px 12px', borderRadius: 999, border: showNationalRef ? '1.5px solid #7C3AED' : '1px dashed #CBD5E1',
                                  background: showNationalRef ? '#F5F3FF' : 'white',
                                  color: showNationalRef ? '#7C3AED' : '#64748B',
                                  fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {showNationalRef ? '✓' : '+'}
                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: showNationalRef ? '#7C3AED' : 'white', border: showNationalRef ? '2px solid #6D28D9' : '1px dashed #CBD5E1', verticalAlign: 'middle' }} />
                                전국 핵심평가영역 평균
                              </button>
                            </div>
                            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>
                              <strong>{selectedStudent?.name}</strong>의 영역별 등급 평균을 동일 그룹 평균·동일학교 학년 평균과 비교합니다.
                              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: 6 }}>· 검정 점선 = 그룹 평균 · 컬러 dot = 본인 평균 · 우측 텍스트에 동일학교 {selectedTrendGrade}학년 평균 함께 표기</span>
                              {showNationalRef && <span style={{ color: '#7C3AED', fontWeight: 700, marginLeft: 6 }}>· 보라 마커 「전국」 = 전국 핵심평가영역 평균</span>}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {rows.map((r, i) => {
                              const diffInt = Math.round(r.stuYIdx - r.clsYIdx);
                              const stuLevel = pointToLevelName(r.stuYIdx);
                              const clsLevel = pointToLevelName(r.clsYIdx);
                              const diffBadgeColor = diffInt > 0 ? '#10B981' : diffInt < 0 ? '#EF4444' : '#64748B';
                              const diffBadgeLabel = diffInt === 0 ? '그룹 평균 동등' : `그룹 평균 대비 ${diffInt >= 0 ? '+' : ''}${diffInt}등급`;
                              const nationalRef = showNationalRef ? getNationalAreaRef(selectedTrendGrade, selectedSubject, r.area) : null;
                              const nationalLevel = nationalRef ? pointToLevelName(nationalRef.yIdx) : null;
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                  <div style={{ width: '120px', fontWeight: 800, color: '#1E2225' }}>
                                    {r.area} <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>({r.n}회)</span>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <GradeAvgBar
                                      targetYIdx={r.stuYIdx}
                                      referenceYIdx={r.clsYIdx}
                                      secondaryReferenceYIdx={nationalRef ? nationalRef.yIdx : null}
                                      secondaryReferenceLabel={nationalRef ? `전국 ${r.area} 평균 (${nationalLevel}, 표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳)` : null}
                                      targetLabel={`${selectedStudent?.name} ${r.area}`}
                                      height={20}
                                      showRailLabels={false}
                                    />
                                  </div>
                                  <div style={{ width: '230px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.3 }}>
                                    <div title={`${r.n}개 과제의 5단계 정규화 평균 (Y=${r.clsYIdx.toFixed(2)}) — 3·4단계 과제는 컷오프 overlap 가중으로 변환 후 평균`}
                                      style={{ color: '#64748B', fontWeight: 700, cursor: 'help' }}>
                                      그룹 평균: <strong style={{ color: LEVEL_COLORS[clsLevel] || '#1E2225' }}>{clsLevel}</strong>
                                    </div>
                                    {/* [v3.55] 학교 학년 평균 추가 — 본인 vs 그룹만 비교하던 한계 보완 */}
                                    {(() => {
                                      const grdYIdx = areaGradeAvgMap[r.area];
                                      if (grdYIdx == null) return null;
                                      const grdLevel = pointToLevelName(grdYIdx);
                                      return (
                                        <div title="동일학교·동일 교과 학년 평균"
                                          style={{ color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>
                                          {selectedTrendGrade}학년 평균 (동일학교): <strong style={{ color: LEVEL_COLORS[grdLevel] || '#1E2225' }}>{grdLevel}</strong>
                                        </div>
                                      );
                                    })()}
                                    {nationalRef && (
                                      <div title={`표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳`}
                                        style={{ color: '#7C3AED', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>
                                        ┄ 전국 {r.area}: <strong>{nationalLevel}</strong>
                                      </div>
                                    )}
                                    {showNationalRef && !nationalRef && (
                                      <div title="해당 영역의 전국 표본이 임계값(100명) 미만이거나 모집단에 동일 영역 데이터가 없습니다."
                                        style={{ color: '#92400E', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', background: '#FEF3C7', border: '1px solid #FCD34D', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                                        ┄ 전국: 표본 부족
                                      </div>
                                    )}
                                    <div title={`${r.n}개 과제의 5단계 정규화 평균 (Y=${r.stuYIdx.toFixed(2)}) — 3·4단계 과제는 컷오프 overlap 가중으로 변환 후 평균`}
                                      style={{ color: '#1E2225', fontWeight: 800, cursor: 'help' }}>
                                      {selectedStudent?.name}: <strong style={{ color: LEVEL_COLORS[stuLevel] || '#2A75F3' }}>{stuLevel}</strong>
                                      <span style={{ marginLeft: 6, color: diffBadgeColor, fontSize: 'var(--neo-font-size-xs)' }}>({diffBadgeLabel})</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#475569', lineHeight: 1.5 }}>
                            ※ 채점 방식이 3등급·4등급·5등급 어느 쪽이든 <strong>같은 등급명(예: 「우수」)은 그래프에서 같은 자리</strong>에 표시됩니다. 그래서 채점 방식이 다른 과제끼리도 한 화면에서 자연스럽게 비교할 수 있어요. (정렬 순서: 매우 노력 → 노력 → 보통 → 우수 → 매우 우수)
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
              ) : (
              <>
                {/* v2.0 — 학생 미선택: 그룹 평균 / 학년 멀티라인 모드 */}
                <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 600 }}>
                  📊 {isAllClassMode ? `${selectedTrendGrade}학년 전체 그룹 비교 모드` : `${selectedClass} 그룹 평균 모드`}
                  <span style={{ marginLeft: '8px', color: '#94A3B8' }}>· 학년 평균은 동일학교 · 동일 교과 전체 교사 채점 합산</span>
                </div>
                {/* 시계열 */}
                {classes.length === 0 ? (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '20px', fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', textAlign: 'center' }}>
                    선택한 학년에 등록된 그룹 데이터가 없습니다.
                  </div>
                ) : (
                <>
                  {/* [v3.20] 범례 — 차트 위로 이동 (X축 라벨과 시각 충돌 방지) */}
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', fontSize: 'var(--neo-font-size-sm)', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {isAllClassMode ? (
                      <>
                        {/* [v3.43] 범례 클릭으로 포커스 모드 — 겹친 라인 분리. 학년 평균은 항상 노출 */}
                        {classes.map(([clsName,], idx) => {
                          const color = cMulti[idx % cMulti.length];
                          const isFocused = focusedClass === clsName;
                          const isOther = focusedClass && !isFocused;
                          return (
                            <span key={clsName}
                              onClick={() => {
                                const next = focusedClass === clsName ? null : clsName;
                                setFocusedClass(next);
                                // 다른 그룹의 pinned 툴팁이 남아 있으면 정리
                                if (next && classMultiTooltip && classMultiTooltip.clsName !== next) setClassMultiTooltip(null);
                              }}
                              title={isFocused ? '다시 클릭해 전체 보기로 돌아가기' : `${clsName}만 강조해서 보기 (다른 그룹은 흐리게)`}
                              style={{
                                cursor: 'pointer',
                                padding: '3px 9px',
                                borderRadius: 999,
                                background: isFocused ? `${color}1F` : 'transparent',
                                border: isFocused ? `1.5px solid ${color}` : '1.5px solid transparent',
                                opacity: isOther ? 0.42 : 1,
                                fontWeight: isFocused ? 800 : 600,
                                color: isFocused ? color : (isOther ? '#94A3B8' : '#1E293B'),
                                userSelect: 'none',
                                transition: 'opacity .15s, background .15s, border-color .15s',
                              }}>
                              <span style={{ display: 'inline-block', width: 18, height: 3, background: color, verticalAlign: 'middle', marginRight: 6 }} />
                              {clsName}
                            </span>
                          );
                        })}
                        <span style={{ padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '3px dashed #1E2225', verticalAlign: 'middle' }} />
                          {selectedTrendGrade}학년 등급 평균 (동일학교·동일 교과 합산)
                        </span>
                        {/* [v3.53] 전국 핵심평가영역 평균 토글은 「핵심평가영역(내용체계)별 학년 평균」 헤더로 이동됨 */}
                        {/* [v3.57] ✕ 전체 보기 버튼 제거 — 포커스된 범례를 다시 클릭하면 전체 보기로 토글 */}
                      </>
                    ) : (
                      <>
                        <span><span style={{ display: 'inline-block', width: 18, height: 3, background: '#2A75F3', verticalAlign: 'middle', marginRight: 6 }}></span>{selectedClass} 등급 평균</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #94A3B8', verticalAlign: 'middle' }} />
                          동일 학년 등급 평균 (동일학교·동일 교과 합산)
                        </span>
                        {/* [v3.53] 전국 핵심평가영역 평균 토글은 「핵심평가영역(내용체계)별 학년 평균」 헤더로 이동됨 */}
                      </>
                    )}
                  </div>
                  {/* [v3.38] 시점당 200px + truncate 14자, wrapper width 100% (부모 폭 전체). v3.39: 안내 sticky로 차트 묶음. v3.57: Y축 sticky 고정 — 가로 스크롤 시 좌측 등급명 라벨 고정 */}
                  <div ref={trendScrollRef} style={{ position: 'relative', display: 'flex', overflowX: 'auto', overflowY: 'hidden', width: '100%', borderRadius: '6px' }}>
                  {/* [v3.57] 좌측 Y축 sticky overlay */}
                  <div style={{ position: 'sticky', left: 0, flexShrink: 0, width: `${x0}px`, height: `${h + y0 + 44}px`, background: 'white', zIndex: 2, pointerEvents: 'none' }}>
                    <svg width={x0} height={h + y0 + 44} viewBox={`0 0 ${x0} ${h + y0 + 44}`} style={{ display: 'block' }}>
                      {[1, 2, 3, 4, 5].map((gradePoint, i) => {
                        const y = y0 + h - (gradePoint / 5) * h;
                        return (
                          <text key={i} x={x0 - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{pointToLevelName(gradePoint)}</text>
                        );
                      })}
                    </svg>
                  </div>
                  <svg viewBox={`0 0 ${itemW + x0 + 60} ${h + y0 + 44}`} style={{ flexShrink: 0, width: `${itemW + x0 + 60}px`, height: `${h + y0 + 44}px`, marginLeft: `-${x0}px`, display: 'block' }}>
                    {[1, 2, 3, 4, 5].map((gradePoint, i) => {
                      const y = y0 + h - (gradePoint / 5) * h;
                      return (
                        <line key={i} x1={x0} y1={y} x2={x0 + itemW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      );
                    })}
                    {isAllClassMode ? (
                      <>
                        {/* [v3.43] 포커스 모드: focusedClass 외 라인/점은 dim + pointer-events 비활성 */}
                        {classes.map(([clsName, cs2], idx) => {
                          // [v3.56] 문항 단위 확장 (영역 기반 그룹 평균)
                          const enrichedItems = expandClassItems(cs2);
                          const isDimmed = focusedClass && focusedClass !== clsName;
                          const isFocused = focusedClass === clsName;
                          return (
                          <g key={clsName} opacity={isDimmed ? 0.18 : 1}>
                            <path d={buildLinePath(enrichedItems.map(t => t.avgYIdx), 5, x0, y0, itemW, h)} fill="none" stroke={cMulti[idx % cMulti.length]} strokeWidth={isFocused ? 3.5 : 2.5} />
                            {enrichedItems.map((t, i) => {
                              const cx = x0 + (i * itemW / Math.max(1, enrichedItems.length - 1));
                              const cy = y0 + h - (t.avgYIdx / 5) * h;
                              return (
                                <g key={i}>
                                  {/* 클릭 영역 확장용 투명 원 — dim 그룹은 pointer-events 차단 */}
                                  <circle cx={cx} cy={cy} r={isFocused ? 14 : 12} fill="transparent"
                                    style={{ cursor: isDimmed ? 'default' : 'pointer', pointerEvents: isDimmed ? 'none' : 'auto' }}
                                    onMouseEnter={() => setClassMultiTooltip(p => p?.pinned ? p : { clsName, ptIdx: i })}
                                    onMouseLeave={() => setClassMultiTooltip(p => p?.pinned ? p : null)}
                                    onClick={(e) => { e.stopPropagation(); setClassMultiTooltip(p => (p?.clsName === clsName && p?.ptIdx === i && p.pinned) ? null : { clsName, ptIdx: i, pinned: true }); }} />
                                  <circle cx={cx} cy={cy} r={isFocused ? 4.5 : 3.5} fill="white" stroke={cMulti[idx % cMulti.length]} strokeWidth={isFocused ? 2.5 : 2} style={{ pointerEvents: 'none' }} />
                                </g>
                              );
                            })}
                          </g>
                          );
                        })}
                        {/* 학년 평균 라인 (문항별, 영역 기반) */}
                        <path d={buildLinePath(gradeAvgItems, 5, x0, y0, itemW, h)} fill="none" stroke="#1E2225" strokeWidth="3" strokeDasharray="8 4" />
                        {/* X축 라벨: 문항(과제N-M) + 과제 그룹(과제명·마지막 완료일) */}
                        {groupRefItems.map((t, i) => {
                          const cx = x0 + (i * itemW / Math.max(1, groupRefItems.length - 1));
                          const denom = Math.max(1, groupRefItems.length - 1);
                          const groupCx = x0 + ((i + (t.itemCount - 1) / 2) * itemW / denom);
                          const sepX = x0 + ((i - 0.5) * itemW / denom);
                          return (
                            <g key={i} style={{ pointerEvents: 'none' }}>
                              <text x={cx} y={y0 + h + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{truncateName(t.taskName)}-{t.itemNo}<title>{t.taskName}</title></text>
                            <text x={cx} y={y0 + h + 34} textAnchor="middle" fontSize="9" fill="#94A3B8">({t.date})</text>
                              {t.isFirstOfTask && (
                                <>
                                  {i > 0 && <line x1={sepX} y1={y0} x2={sepX} y2={y0 + h + 6} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />}
                                </>
                              )}
                            </g>
                          );
                        })}
                        {/* [v3.43] 멀티 그룹 모드 툴팁 */}
                        {classMultiTooltip && (() => {
                          const clsEntry = classes.find(([n]) => n === classMultiTooltip.clsName);
                          if (!clsEntry) return null;
                          const [clsName, cs2] = clsEntry;
                          const enrichedItems = expandClassItems(cs2);
                          const t = enrichedItems[classMultiTooltip.ptIdx];
                          if (!t) return null;
                          const tCx = x0 + (classMultiTooltip.ptIdx * itemW / Math.max(1, enrichedItems.length - 1));
                          const tCy = y0 + h - (t.avgYIdx / 5) * h;
                          const clsNorm = pointToLevelName(t.avgYIdx);
                          const grdNorm = t.gradeAvgYIdx != null ? pointToLevelName(t.gradeAvgYIdx) : null;
                          const tipW = 300;
                          const tipH = 120;
                          const isLeft = tCx < x0 + itemW / 2;
                          const tipX = Math.max(x0, Math.min(x0 + itemW - tipW, tCx + (isLeft ? 14 : -tipW - 14)));
                          const tipY = Math.max(y0 + 4, tCy - tipH / 2);
                          return (
                            <g data-tooltip-card="true" pointerEvents={classMultiTooltip.pinned ? 'auto' : 'none'}>
                              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="8" fill="#1E293B" stroke="#2A75F3" strokeWidth="1.5" />
                              <text x={tipX + 12} y={tipY + 20} fill="#F1F5F9" fontSize="12" fontWeight="800">{clsName} · {t.taskName}-{t.itemNo}</text>
                              <text x={tipX + 12} y={tipY + 38} fill="#94A3B8" fontSize="10">📅 {t.date} · {t.itemNo}번 문항 · {t.area}</text>
                              <text x={tipX + 12} y={tipY + 60} fill="#E2E8F0" fontSize="11" fontWeight="700">그룹 평균</text>
                              <text x={tipX + 92} y={tipY + 60} fill="#10B981" fontSize="11" fontWeight="800">{clsNorm}</text>
                              {grdNorm && (
                                <>
                                  <text x={tipX + 12} y={tipY + 80} fill="#E2E8F0" fontSize="11" fontWeight="700">학년 평균</text>
                                  <text x={tipX + 92} y={tipY + 80} fill="#CBD5E1" fontSize="11" fontWeight="700">{grdNorm}</text>
                                </>
                              )}
                              {classMultiTooltip.pinned && (
                                <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setClassMultiTooltip(null); }}>
                                  <circle cx={tipX + tipW - 12} cy={tipY + 12} r="9" fill="#334155" />
                                  <text x={tipX + tipW - 12} y={tipY + 16} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">✕</text>
                                </g>
                              )}
                            </g>
                          );
                        })()}
                      </>
                    ) : csOne && (() => {
                      const csOneItems = groupRefItems; // = expandClassItems(csOne) (문항 단위)
                      return (
                      <>
                        <path d={buildLinePath(csOneItems.map(t => t.gradeAvgYIdx), 5, x0, y0, itemW, h)} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 4" />
                        <path d={buildLinePath(csOneItems.map(t => t.avgYIdx), 5, x0, y0, itemW, h)} fill="none" stroke="#2A75F3" strokeWidth="3" />
                        {csOneItems.map((t, i) => {
                          const clsYIdx = t.avgYIdx;
                          const yrYIdx  = t.gradeAvgYIdx;
                          const clsNorm = pointToLevelName(clsYIdx);
                          const cx = x0 + (i * itemW / Math.max(1, csOneItems.length - 1));
                          const cy = y0 + h - (clsYIdx / 5) * h;
                          const denom = Math.max(1, csOneItems.length - 1);
                          const groupCx = x0 + ((i + (t.itemCount - 1) / 2) * itemW / denom);
                          const sepX = x0 + ((i - 0.5) * itemW / denom);
                          const diffYIdx = clsYIdx - yrYIdx;
                          const diffInt = Math.round(diffYIdx);
                          const isClose = Math.abs(diffYIdx) <= 0.3;
                          const diffLabel = diffInt === 0 ? '(=)' : `(${diffInt >= 0 ? '+' : ''}${diffInt})`;
                          const diffColorVal = diffYIdx >= 0 ? '#10B981' : '#EF4444';
                          const dotColor = areaColorMap[t.area] || '#2A75F3';
                          return (
                            <g key={i}>
                              <circle cx={cx} cy={cy} r="14" fill="transparent" style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setClassOneTooltip(p => p?.pinned ? p : { idx: i })}
                                onMouseLeave={() => setClassOneTooltip(p => p?.pinned ? p : null)}
                                onClick={(e) => { e.stopPropagation(); setClassOneTooltip(p => (p?.idx === i && p.pinned) ? null : { idx: i, pinned: true }); }} />
                              <circle cx={cx} cy={cy} r="5" fill={dotColor} stroke="white" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                              <text x={cx} y={cy - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1E2225" style={{ pointerEvents: 'none' }}>{clsNorm}</text>
                              {isClose && (
                                <text x={cx + 9} y={cy + 4} textAnchor="start" fontSize="9.5" fontWeight="800" fill={diffColorVal} style={{ pointerEvents: 'none' }}>{diffLabel}</text>
                              )}
                              <text x={cx} y={y0 + h + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{truncateName(t.taskName)}-{t.itemNo}<title>{t.taskName}</title></text>
                            <text x={cx} y={y0 + h + 34} textAnchor="middle" fontSize="9" fill="#94A3B8">({t.date})</text>
                              {t.isFirstOfTask && (
                                <g style={{ pointerEvents: 'none' }}>
                                  {i > 0 && <line x1={sepX} y1={y0} x2={sepX} y2={y0 + h + 6} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />}
                                </g>
                              )}
                            </g>
                          );
                        })}
                        {/* [v3.43] 단일 그룹 모드 툴팁 (문항 단위) */}
                        {classOneTooltip && (() => {
                          const t = csOneItems[classOneTooltip.idx];
                          if (!t) return null;
                          const tCx = x0 + (classOneTooltip.idx * itemW / Math.max(1, csOneItems.length - 1));
                          const tCy = y0 + h - (t.avgYIdx / 5) * h;
                          const clsNorm = pointToLevelName(t.avgYIdx);
                          const grdNorm = t.gradeAvgYIdx != null ? pointToLevelName(t.gradeAvgYIdx) : null;
                          const diffInt = Math.round(t.avgYIdx - (t.gradeAvgYIdx || 0));
                          const diffTitle = diffInt === 0 ? '동등' : `${diffInt >= 0 ? '+' : ''}${diffInt}등급`;
                          const tipW = 300;
                          const tipH = 120;
                          const isLeft = tCx < x0 + itemW / 2;
                          const tipX = Math.max(x0, Math.min(x0 + itemW - tipW, tCx + (isLeft ? 14 : -tipW - 14)));
                          const tipY = Math.max(y0 + 4, tCy - tipH / 2);
                          return (
                            <g data-tooltip-card="true" pointerEvents={classOneTooltip.pinned ? 'auto' : 'none'}>
                              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="8" fill="#1E293B" stroke="#2A75F3" strokeWidth="1.5" />
                              <text x={tipX + 12} y={tipY + 20} fill="#F1F5F9" fontSize="12" fontWeight="800">{t.taskName}-{t.itemNo}</text>
                              <text x={tipX + 12} y={tipY + 38} fill="#94A3B8" fontSize="10">📅 {t.date} · {t.itemNo}번 문항 · {t.area}</text>
                              <text x={tipX + 12} y={tipY + 60} fill="#E2E8F0" fontSize="11" fontWeight="700">그룹 평균</text>
                              <text x={tipX + 92} y={tipY + 60} fill="#10B981" fontSize="11" fontWeight="800">{clsNorm}</text>
                              {grdNorm && (
                                <>
                                  <text x={tipX + 12} y={tipY + 80} fill="#E2E8F0" fontSize="11" fontWeight="700">학년 평균</text>
                                  <text x={tipX + 92} y={tipY + 80} fill="#CBD5E1" fontSize="11" fontWeight="700">{grdNorm}</text>
                                </>
                              )}
                              <text x={tipX + tipW - 12} y={tipY + tipH - 8} textAnchor="end" fill="#94A3B8" fontSize="10">학년 대비 {diffTitle}</text>
                              {classOneTooltip.pinned && (
                                <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setClassOneTooltip(null); }}>
                                  <circle cx={tipX + tipW - 12} cy={tipY + 12} r="9" fill="#334155" />
                                  <text x={tipX + tipW - 12} y={tipY + 16} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">✕</text>
                                </g>
                              )}
                            </g>
                          );
                        })()}
                      </>
                      );
                    })()}
                    <line x1={x0} y1={y0 + h} x2={x0 + itemW} y2={y0 + h} stroke="#CBD5E1" strokeWidth="1" />
                  </svg>
                  </div>
                  {activeItemLen * ITEM_TICK > BASE_W && (
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#7C3AED', fontWeight: 700, textAlign: 'center', padding: '6px 8px', background: '#F5F3FF', borderTop: '1px solid #E2E8F0', borderRadius: '0 0 6px 6px' }}>
                      ← 좌우 스크롤로 모든 문항 확인 →
                    </div>
                  )}

                  {/* [v3.32] 요약 카드 3종 — 학년 평균 단일 마커 (소수점 폐기) */}
                  {isAllClassMode ? (() => {
                    const totalStudents = classes.reduce((s, [, c]) => s + c.studentCount, 0);
                    const gradeAvgYIdx = gradeAvgPointFor(selectedTrendGrade);
                    const gradeAvgLevel = pointToLevelName(gradeAvgYIdx);
                    const cards = [
                      {
                        label: '학년 등급 평균',
                        custom: true,
                        value: (
                          <div>
                            <GradeAvgBar targetYIdx={gradeAvgYIdx} targetLabel="학년 평균" />
                            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', fontWeight: 800, marginTop: '6px' }}>
                              <strong style={{ color: LEVEL_COLORS[gradeAvgLevel] || '#1E2225' }}>{gradeAvgLevel || '-'}</strong>
                            </div>
                          </div>
                        ),
                        sub: `${totalStudents}명 · 동일학교·${selectedSubject} 교과 합산`,
                        tip: `${selectedTrendGrade}학년 ${selectedSubject} 교과 학생 전체의 등급 평균. 마커 위치로 등급 안 위치 시각화.`,
                      },
                      { label: '그룹 수', value: `${classes.length}개`, sub: `${selectedTrendGrade}학년 그룹`, color: '#2A75F3', tip: '동일 학년 내 그룹 수' },
                      { label: '학생 수', value: `${totalStudents}명`, sub: '관리 대상', color: '#10B981', tip: '학년 전체 학생 수' },
                    ];
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '14px' }}>
                        {cards.map((c, i) => (
                          <div key={i} title={c.tip} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', cursor: 'help' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{c.label}</div>
                            {c.custom ? c.value : (
                              <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                            )}
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px', lineHeight: 1.3 }}>{c.sub}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })() : csOne && (() => {
                    // [v3.32] 평균 모델 — 학년 평균 reference + 그룹 평균 target (학년 점수에서 3-1반 위치 표시)
                    const cAvg = distAvgPoint(csOne.distribution);
                    const cAvgLevel = pointToLevelName(cAvg);
                    const gradeAvg = gradeAvgPointFor(selectedTrendGrade);
                    const gradeAvgLevel = pointToLevelName(gradeAvg);
                    const { rank, total: rankTotal } = classRankingInGrade(selectedClass, selectedTrendGrade);
                    const rankColor = rank === 1 ? '#10B981' : rank === rankTotal ? '#EF4444' : '#475569';
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '14px' }}>
                        {[
                          {
                            label: '그룹 등급 평균 (학년 평균 대비)',
                            custom: true,
                            value: (
                              <div>
                                <GradeAvgBar targetYIdx={cAvg} referenceYIdx={gradeAvg} targetLabel={selectedClass} />
                                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700, marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div>● 그룹 평균: <strong style={{ color: LEVEL_COLORS[cAvgLevel] || '#2A75F3' }}>{cAvgLevel || '-'}</strong></div>
                                  <div style={{ color: '#64748B' }}>
                                    <span style={{ display: 'inline-block', width: 10, borderTop: '2px dashed #1E2225', verticalAlign: 'middle', margin: '0 4px 0 0' }} />
                                    학년 평균: <strong style={{ color: LEVEL_COLORS[gradeAvgLevel] || '#1E2225' }}>{gradeAvgLevel || '-'}</strong>
                                  </div>
                                </div>
                                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: rankColor, fontWeight: 800, marginTop: '6px' }}>
                                  학년 {rankTotal}개 그룹 중 {rank}위 · {csOne.studentCount}명
                                </div>
                              </div>
                            ),
                            sub: `${selectedTrendGrade}학년·${selectedSubject} 교과`,
                            tip: `[그룹 등급 평균]\n학년 평균(점선) 대비 그룹 평균(점) 위치. 학년 ${rankTotal}개 그룹 중 ${rank}위`,
                          },
                          { label: '학생 수', value: `${csOne.studentCount}명`, sub: '관리 대상', color: '#2A75F3', tip: '그룹 학생 수' },
                        ].map((c, i) => (
                          <div key={i} title={c.tip} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', cursor: 'help' }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{c.label}</div>
                            {c.custom ? c.value : (
                              <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                            )}
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px', lineHeight: 1.3 }}>{c.sub}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 그룹 비교 표 (v3.34: 영역별 약점/강점 컬럼 폐기 — 영역 분석은 하단 sub-section에서 단일 그룹 단위로 별도 노출) */}
                  {isAllClassMode && (() => {
                    const gradeAvg = gradeAvgPointFor(selectedTrendGrade);
                    const gradeAvgLevel = pointToLevelName(gradeAvg);
                    return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: 'var(--neo-font-size-sm)' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {['그룹', '그룹 평균 (학년 평균 대비)', '학년 내 위치'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, color: '#475569' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map(([clsName, c]) => {
                          const cAvg = distAvgPoint(c.distribution);
                          const cAvgLevel = pointToLevelName(cAvg);
                          const { rank, total: rankTotal } = classRankingInGrade(clsName, selectedTrendGrade);
                          const rankColor = rank === 1 ? '#10B981' : rank === rankTotal ? '#EF4444' : '#475569';
                          return (
                            <tr key={clsName}
                              onClick={() => setSelectedClass(clsName)}
                              style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1D4ED8', whiteSpace: 'nowrap' }}>{clsName} ›</td>
                              <td style={{ padding: '10px 12px', minWidth: 260 }}>
                                <GradeAvgBar targetYIdx={cAvg} referenceYIdx={gradeAvg} targetLabel={clsName} height={14} showRailLabels={false} />
                                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginTop: '4px' }}>
                                  ● 그룹 <strong style={{ color: LEVEL_COLORS[cAvgLevel] || '#475569' }}>{cAvgLevel}</strong> ·
                                  <span style={{ display: 'inline-block', width: 10, borderTop: '2px dashed #1E2225', verticalAlign: 'middle', margin: '0 4px' }} />
                                  학년 <strong style={{ color: LEVEL_COLORS[gradeAvgLevel] || '#1E2225' }}>{gradeAvgLevel}</strong> · {c.studentCount}명 응시
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: rankColor, whiteSpace: 'nowrap' }}
                                  title={`학년 ${rankTotal}개 그룹 중 ${rank}위 (distribution 가중 평균 기준)`}>
                                {rank}위 / {rankTotal}개
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    );
                  })()}

                  {/* [v3.37] 핵심평가영역 분석 — 모드별 분기 (학생 미선택 모드)
                      전체 그룹 (isAllClassMode): 학년 전체 영역별 평균만. 그룹 fallback 노출 안 함
                      단일 그룹 (!isAllClassMode): 그룹 평균 vs 학년 평균
                      ※ 학생 모드(hasStudent)는 위쪽 분기에서 별도 처리 */}
                  <div id="strength-weakness" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px dashed #E2E8F0', scrollMarginTop: '20px' }}>
                    {selectedCourse === '전체' ? (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '18px', fontSize: 'var(--neo-font-size-sm)', color: '#9A3412', textAlign: 'center', lineHeight: 1.6 }}>
                        🎯 핵심평가영역(내용체계)별 분석은 <strong>과목을 선택해야 활성화</strong>됩니다.<br />
                        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#C2410C' }}>상단 「과목」에서 특정 과목(예: 공통수학1)을 선택하면 해당 과목의 핵심평가영역별 분석이 표시됩니다.</span>
                      </div>
                    ) : isAllClassMode ? (() => {
                      // 전체 그룹 모드 — 학년 전체 영역 평균만 표시 (그룹 정보 없음)
                      const sampleCs = Object.values(classStats).find(c => c.grade === selectedTrendGrade);
                      if (!sampleCs?.areaBreakdown) return null;
                      // gradeAvgYIdx는 그 학년의 모든 그룹이 동일하므로 첫 그룹 areaBreakdown의 gradeAvgYIdx 사용
                      // [영역 순서 고정] subjectCatalog.areas(교육과정) 순서로 고정 — 그룹/학년 전환 시에도 위치 동일
                      const areaOrder = currentAreas; // 핵심평가영역은 선택 과목 기준
                      const orderIdx = (name) => { const i = areaOrder.indexOf(name); return i === -1 ? 999 : i; };
                      const areas = [...sampleCs.areaBreakdown].filter(a => currentAreas.includes(a.area)).sort((a, b) => orderIdx(a.area) - orderIdx(b.area));
                      return (
                        <div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0 }}>🎯 핵심평가영역(내용체계)별 학년 평균</h4>
                              {/* [v3.53] 전국 평균 토글 — 본 섹션 헤더로 이동 (영향 받는 영역과 같은 위치) */}
                              <button onClick={() => setShowNationalRef(v => !v)}
                                title={showNationalRef ? '전국 핵심평가영역 평균 마커 숨기기' : '아래 비교 막대에 전국 평균을 보라 마커 「전국」으로 추가 표시. 표본 부족·영역 매핑 실패 시 해당 영역만 미노출'}
                                style={{ padding: '4px 12px', borderRadius: 999, border: showNationalRef ? '1.5px solid #7C3AED' : '1px dashed #CBD5E1',
                                  background: showNationalRef ? '#F5F3FF' : 'white',
                                  color: showNationalRef ? '#7C3AED' : '#64748B',
                                  fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {showNationalRef ? '✓' : '+'}
                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: showNationalRef ? '#7C3AED' : 'white', border: showNationalRef ? '2px solid #6D28D9' : '1px dashed #CBD5E1', verticalAlign: 'middle' }} />
                                전국 핵심평가영역 평균
                              </button>
                            </div>
                            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>
                              <strong>{selectedTrendGrade}학년 · {selectedSubject} {selectedCourse}</strong> 과목의 영역별 학년 등급 평균입니다. <span style={{ color: '#94A3B8', fontWeight: 600 }}>(동일학교·동일 과목 전체 그룹 합산 · 낮은 영역 → 보충 우선)</span>
                              {showNationalRef && <span style={{ color: '#7C3AED', fontWeight: 700, marginLeft: 6 }}>· 보라 마커 「전국」 = 전국 핵심평가영역 평균</span>}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {areas.map((a, i) => {
                              const schoolYIdx = a.gradeAvgYIdx;
                              const schoolLevel = pointToLevelName(schoolYIdx);
                              const nationalRef = showNationalRef ? getNationalAreaRef(selectedTrendGrade, selectedSubject, a.area) : null;
                              const nationalLevel = nationalRef ? pointToLevelName(nationalRef.yIdx) : null;
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                  <div style={{ width: '120px', fontWeight: 800, color: '#1E2225' }}>
                                    {a.area}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <GradeAvgBar
                                      targetYIdx={schoolYIdx}
                                      secondaryReferenceYIdx={nationalRef ? nationalRef.yIdx : null}
                                      secondaryReferenceLabel={nationalRef ? `전국 ${a.area} 평균 (${nationalLevel}, 표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳)` : null}
                                      targetLabel={`${selectedTrendGrade}학년 ${a.area}`}
                                      height={20}
                                      showRailLabels={false}
                                    />
                                  </div>
                                  <div style={{ width: '210px', fontSize: 'var(--neo-font-size-sm)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <div style={{ color: '#1E2225', fontWeight: 800 }}>
                                      {selectedTrendGrade}학년 평균 (동일학교): <strong style={{ color: LEVEL_COLORS[schoolLevel] || '#1E2225' }}>{schoolLevel}</strong>
                                    </div>
                                    {nationalRef && (
                                      <div title={`표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳`}
                                        style={{ color: '#7C3AED', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>
                                        ┄ 전국: <strong>{nationalLevel}</strong>
                                      </div>
                                    )}
                                    {showNationalRef && !nationalRef && (
                                      <div title="해당 영역의 전국 표본이 임계값(100명) 미만이거나 모집단에 동일 영역 데이터가 없습니다."
                                        style={{ color: '#92400E', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', background: '#FEF3C7', border: '1px solid #FCD34D', padding: '3px 6px', borderRadius: 4, display: 'inline-block' }}>
                                        ┄ 전국: 표본 부족
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#475569', lineHeight: 1.5 }}>
                            ※ 채점 방식이 3등급·4등급·5등급 어느 쪽이든 <strong>같은 등급명(예: 「우수」)은 그래프에서 같은 자리</strong>에 표시됩니다. 그래서 채점 방식이 다른 과제끼리도 한 화면에서 자연스럽게 비교할 수 있어요. (정렬 순서: 매우 노력 → 노력 → 보통 → 우수 → 매우 우수)
                          </div>
                        </div>
                      );
                    })() : (() => {
                      // 단일 그룹 모드 — 그룹 평균 vs 학년 평균
                      const cs = classStats[selectedClass];
                      if (!cs?.areaBreakdown) return null;
                      // [영역 순서 고정] subjectCatalog.areas(교육과정) 순서로 고정 — 반 전환 시에도 위치 동일 (약점순 정렬 폐기)
                      const areaOrder = currentAreas; // 핵심평가영역은 선택 과목 기준
                      const orderIdx = (name) => { const i = areaOrder.indexOf(name); return i === -1 ? 999 : i; };
                      const sorted = [...cs.areaBreakdown].filter(a => currentAreas.includes(a.area)).sort((a, b) => orderIdx(a.area) - orderIdx(b.area));
                      return (
                        <div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0 }}>🎯 핵심평가영역(내용체계)별 학년 평균 대비 분석</h4>
                              {/* [v3.53] 전국 평균 토글 — 본 섹션 헤더로 이동 */}
                              <button onClick={() => setShowNationalRef(v => !v)}
                                title={showNationalRef ? '전국 핵심평가영역 평균 마커 숨기기' : '아래 비교 막대에 전국 평균을 보라 마커 「전국」으로 추가 표시. 표본 부족·영역 매핑 실패 시 해당 영역만 미노출'}
                                style={{ padding: '4px 12px', borderRadius: 999, border: showNationalRef ? '1.5px solid #7C3AED' : '1px dashed #CBD5E1',
                                  background: showNationalRef ? '#F5F3FF' : 'white',
                                  color: showNationalRef ? '#7C3AED' : '#64748B',
                                  fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {showNationalRef ? '✓' : '+'}
                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: showNationalRef ? '#7C3AED' : 'white', border: showNationalRef ? '2px solid #6D28D9' : '1px dashed #CBD5E1', verticalAlign: 'middle' }} />
                                전국 핵심평가영역 평균
                              </button>
                            </div>
                            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: 0 }}>
                              <strong>{selectedClass}</strong> 영역별 등급 평균을 동일 <strong>{selectedTrendGrade}학년 · {selectedSubject} {selectedCourse}</strong> 과목 학년 평균과 비교합니다.
                              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginLeft: 6 }}>· 검정 점선 = 학년 평균 · 컬러 dot = 그룹 평균</span>
                              {showNationalRef && <span style={{ color: '#7C3AED', fontWeight: 700, marginLeft: 6 }}>· 보라 마커 「전국」 = 전국 핵심평가영역 평균</span>}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {sorted.map((a, i) => {
                              const classYIdx  = a.classAvgYIdx;
                              const schoolYIdx = a.gradeAvgYIdx;
                              const diffInt = Math.round(classYIdx - schoolYIdx);
                              const classLevel = pointToLevelName(classYIdx);
                              const schoolLevel = pointToLevelName(schoolYIdx);
                              const nationalRef = showNationalRef ? getNationalAreaRef(selectedTrendGrade, selectedSubject, a.area) : null;
                              const nationalLevel = nationalRef ? pointToLevelName(nationalRef.yIdx) : null;
                              const diffBadgeColor = diffInt > 0 ? '#10B981' : diffInt < 0 ? '#EF4444' : '#64748B';
                              const diffBadgeLabel = diffInt === 0 ? '학년 평균 동등' : `학년 평균 대비 ${diffInt >= 0 ? '+' : ''}${diffInt}등급`;
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                  <div style={{ width: '120px', fontWeight: 800, color: '#1E2225' }}>
                                    {a.area}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <GradeAvgBar
                                      targetYIdx={classYIdx}
                                      referenceYIdx={schoolYIdx}
                                      secondaryReferenceYIdx={nationalRef ? nationalRef.yIdx : null}
                                      secondaryReferenceLabel={nationalRef ? `전국 ${a.area} 평균 (${nationalLevel}, 표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳)` : null}
                                      targetLabel={`${selectedClass} ${a.area}`}
                                      height={20}
                                      showRailLabels={false}
                                    />
                                  </div>
                                  <div style={{ width: '210px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.3 }}>
                                    <div style={{ color: '#64748B', fontWeight: 700 }}>
                                      {selectedTrendGrade}학년 평균 (동일학교): <strong style={{ color: LEVEL_COLORS[schoolLevel] || '#1E2225' }}>{schoolLevel}</strong>
                                    </div>
                                    {nationalRef && (
                                      <div title={`표본 ${nationalRef.sampleSize?.toLocaleString?.()}명·학교 ${nationalRef.schools}곳`}
                                        style={{ color: '#7C3AED', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>
                                        ┄ 전국 {a.area}: <strong>{nationalLevel}</strong>
                                      </div>
                                    )}
                                    {showNationalRef && !nationalRef && (
                                      <div style={{ color: '#94A3B8', fontWeight: 600, fontSize: 'var(--neo-font-size-xs)' }}>
                                        ┄ 전국: (표본 부족 / 영역 매핑 없음)
                                      </div>
                                    )}
                                    <div style={{ color: '#1E2225', fontWeight: 800 }}>
                                      {selectedClass}: <strong style={{ color: LEVEL_COLORS[classLevel] || '#2A75F3' }}>{classLevel}</strong>
                                      <span style={{ marginLeft: 6, color: diffBadgeColor, fontSize: 'var(--neo-font-size-xs)' }}>({diffBadgeLabel})</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#475569', lineHeight: 1.5 }}>
                            ※ 채점 방식이 3등급·4등급·5등급 어느 쪽이든 <strong>같은 등급명(예: 「우수」)은 그래프에서 같은 자리</strong>에 표시됩니다. 그래서 채점 방식이 다른 과제끼리도 한 화면에서 자연스럽게 비교할 수 있어요. (정렬 순서: 매우 노력 → 노력 → 보통 → 우수 → 매우 우수)
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
                )}
              </>
              )}
              </div>
            </div>
          );
        })()}

      </section>{/* /trend-analysis */}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* [NEW] 인사이트 카드                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.25rem' }}>💡 자동 인사이트</h3>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1rem' }}>그룹·학생·단원 데이터에서 자동 추출된 핵심 인사이트입니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
          {insights.map((ins, i) => {
            const hasStudents = Array.isArray(ins.students) && ins.students.length > 0;
            const isExpanded = expandedInsight === i;
            return (
              <div
                key={i}
                onClick={hasStudents ? (e) => { e.stopPropagation(); setExpandedInsight(isExpanded ? null : i); } : undefined}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px',
                  position: 'relative',
                  borderLeft: `4px solid ${ins.color}`,
                  cursor: hasStudents ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={hasStudents ? (e) => e.currentTarget.style.background = '#F1F5F9' : undefined}
                onMouseLeave={hasStudents ? (e) => e.currentTarget.style.background = '#F8FAFC' : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: ins.color, background: ins.color + '15', padding: '2px 8px', borderRadius: '4px' }}>{ins.label}</span>
                  {hasStudents && (
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: ins.color, fontWeight: 700 }}>{isExpanded ? '▼ 명단 닫기' : '▲ 명단 보기'}</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', fontWeight: 600, lineHeight: 1.4 }}>{ins.message}</div>
                {/* [v3.19] click 시 학생 명단 popover — 카드 위로 펼침 */}
                {hasStudents && isExpanded && (
                  <>
                    {/* outside click 닫기용 투명 overlay */}
                    <div
                      onClick={(e) => { e.stopPropagation(); setExpandedInsight(null); }}
                      style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'transparent' }}
                    />
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        boxShadow: '0 -12px 28px -8px rgba(15,23,42,0.25)',
                        padding: '10px 12px',
                        zIndex: 60,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {/* 아래쪽 화살표 (popover 하단에서 카드 가리킴) */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-7px',
                        left: '20px',
                        width: 0,
                        height: 0,
                        borderLeft: '7px solid transparent',
                        borderRight: '7px solid transparent',
                        borderTop: '7px solid white',
                        filter: 'drop-shadow(0 1px 0 #E2E8F0)',
                      }}></div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: ins.color }}>📋 {ins.label} · 학생 {ins.students.length}명</span>
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>본 교사 관리 모든 그룹 대상</span>
                      </div>
                      {ins.students.map((s, k) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>
                              {s.name} <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>· {s.className}</span>
                            </span>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{s.detail}</span>
                          </div>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: ins.color, whiteSpace: 'nowrap' }}>{s.recentDelta}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* 점수 분포표 셀 클릭 시 학생 정보 툴팁 (간략 popover)              */}
      {/* ════════════════════════════════════════════════════════════ */}
      {distTooltip && (() => {
        // [v3.3] 표현 5등급 통일 — 학생 필터·색상 모두 5등급 기준 (과제 native scale 무관)
        const popoverScale = gradeScales[5];
        const levelColors = Object.fromEntries(popoverScale.levels.map(lv => [lv.name, lv.color]));
        // [v3.28] students[].level 직접 사용 (lastScore 폐기 정책)
        const matched = students.filter(s =>
          s.className === distTooltip.className &&
          s.level === distTooltip.level
        );
        const levelColor = levelColors[distTooltip.level] || '#64748B';
        // 화면 가장자리 보정 (오른쪽으로 넘치면 왼쪽으로)
        const tooltipW = 280;
        const left = Math.min(distTooltip.x - tooltipW / 2, window.innerWidth - tooltipW - 16);
        const adjustedLeft = Math.max(16, left);
        // [v3.4] 학생 클릭 → 학습 추이 분석으로 이동 (영역 필터 폐기, 교과 셀렉트는 그대로 유지)
        const goToTrendAnalysis = (student) => {
          setSelectedStudentId(student.id);
          setSelectedTrendGrade(student.grade);
          setSelectedClass(student.className);
          setDistTooltip(null);
          setTimeout(() => {
            const el = document.getElementById('trend-analysis');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        };
        return (
          <>
            {/* outside click 닫기용 투명 overlay */}
            <div
              onClick={() => setDistTooltip(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'transparent' }}
            />
            <div
              style={{
                position: 'fixed',
                left: adjustedLeft,
                top: distTooltip.y,
                width: `${tooltipW}px`,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                boxShadow: '0 12px 28px -8px rgba(15,23,42,0.25)',
                padding: '10px 12px',
                zIndex: 1000,
                fontSize: 'var(--neo-font-size-sm)',
              }}
            >
              {/* 화살표 (위쪽) */}
              <div style={{
                position: 'absolute',
                top: '-7px',
                left: `${distTooltip.x - adjustedLeft - 7}px`,
                width: 0,
                height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '7px solid white',
                filter: 'drop-shadow(0 -1px 0 #E2E8F0)',
              }}></div>
              {/* 헤더 — 학년반 + 등급 배지 (v2.7: 과제명·영역 제거, 데이터 지표는 학년반·등급·학생명·점수만 노출) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 800, color: '#1E2225', fontSize: 'var(--neo-font-size-sm)' }}>{distTooltip.className}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: 'white', background: levelColor, padding: '1px 6px', borderRadius: '8px' }}>{distTooltip.level}</span>
                </div>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{matched.length}명</span>
              </div>
              {/* 학생 list (학생명 + 점수만) */}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {matched.length === 0 ? (
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', padding: '6px 0', textAlign: 'center' }}>학생 정보가 없습니다.</div>
                ) : (
                  matched.map((s) => (
                    <div
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToTrendAnalysis(s);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '5px 4px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225' }}>{s.name}</span>
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: levelColor }}>{s.level}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
};

export default TeacherDashboard;
