/**
 * Setting.jsx
 * [메인 진입 컴포넌트] 앱의 실질적인 루트 화면입니다. main.jsx에서 직접 렌더링됩니다.
 * 사이드바 메뉴 전환에 따라 각 페이지를 조건부 렌더링하는 최상위 레이아웃을 담당합니다.
 * - 채점관리: GradingManagement.jsx (분리됨)
 * - 환경설정: 이 파일에서 직접 렌더링 (펌웨어 업데이트, 펜 데이터 초기화 등)
 * - Prompt Studio / Prompt 아카이브 / 분석 리포트: 각 전용 컴포넌트
 */
import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import PromptArchive from './PromptArchive';
// [v2.85] PromptStudio (프롬프트 편집기) 메뉴 폐기 — 파일은 유지하되 라우팅에서 제외
// import PromptStudio from './PromptStudio';
import AnalysisReport from './AnalysisReport';
import AiGradingTest from './AiGradingTest';
import Sidebar from './Sidebar';
import GradingManagement from './GradingManagement';
import Dashboard from './Dashboard';
import TeacherDashboard from './TeacherDashboard';
import SchoolDashboard from './SchoolDashboard';
import EduOfficeDashboard from './EduOfficeDashboard';
import TaskManagement, { BASE_TASKS } from './TaskManagement';
import TaskRegistration from './TaskRegistration';
import SharedAssignments from './SharedAssignments';
import StudentManagement from './StudentManagement';
import StudentRegistration from './StudentRegistration';
import SmartpenMonitor from './SmartpenMonitor';
import TeacherManagement from './TeacherManagement';
import SchoolTeacherManagement from './SchoolTeacherManagement';
import SchoolManagement from './SchoolManagement';
import { markConnectDownloaded } from './RequiredProgramModal';
import IncidentReportDialog from './IncidentReportDialog'; // [BRD-16] 환경설정 AiGLE Connect 카드 [로그]·[펜 데이터] → [🚨 장애 신고]
import IncidentBoard from './IncidentBoard'; // [BRD-16] 시스템 관리자 > 게시판 > 장애신고
import { openCount as incidentOpenCount, subscribeIncidents } from './lib/incidentStore';
import TeacherRegistration from './TeacherRegistration';
import SpecViewer from './SpecViewer';
import NoticePopupDemo from './NoticePopupDemo';
import TaskDetail from './TaskDetail';
import TaskDeleteDialog from './TaskDeleteDialog';
import MyInfo from './MyInfo';

// ─────────────────────────────────────────────
// 해시 기반 딥링크 라우트 맵
// 사용: index.html#/shared-assignments 등으로 진입 시 해당 화면 직접 노출
// 라이브러리 비의존 — react-router-dom 미설치 환경 대응
// ─────────────────────────────────────────────
const HASH_ROUTES = {
  '#/dashboard':            { menu: '대시보드', sub: '채점 관리' },
  '#/teacher-dashboard':    { menu: '교사 대시보드', sub: '채점 관리' },
  '#/school-dashboard':     { menu: '학교 대시보드', sub: '채점 관리' },
  '#/smartpen-monitor':     { menu: '스마트펜 모니터링', sub: '채점 관리' },
  '#/spec-viewer':          { menu: '화면 명세서', sub: '채점 관리' },
  '#/prompt-studio':        { menu: 'Prompt Studio', sub: 'Prompt Studio' },
  '#/student-management':   { menu: '학생', sub: '학생 관리' },
  '#/student-registration': { menu: '학생', sub: '학생 등록' },
  '#/teacher-management':   { menu: '학생', sub: '교사 관리' },
  '#/school-teacher-management': { menu: '회원 관리', sub: '교사관리(학교모드)' },
  '#/teacher-registration': { menu: '학생', sub: '교사 등록' },
  // [v4.7] 「과제 및 채점관리」 → 「과제 관리」 / 「채점 관리」 메뉴 분리
  '#/grading':              { menu: '채점 관리', sub: '채점 관리' },
  // [SCR-06] 퇴고 지원판
  '#/grading2':             { menu: '채점 관리', sub: '채점 관리 2' },
  '#/task-management':      { menu: '과제 관리', sub: '과제 관리' },
  '#/task-registration':    { menu: '과제 관리', sub: '과제 등록' },
  '#/shared-assignments':   { menu: '과제 관리', sub: '공유된 과제' },
  // [BRD-16] 게시판
  '#/notice':               { menu: '게시판', sub: '공지사항' },
  '#/incident-board':       { menu: '게시판', sub: '장애신고' },
};
const ROUTE_BY_STATE = Object.entries(HASH_ROUTES)
  .reduce((acc, [hash, { menu, sub }]) => {
    acc[`${menu}|${sub}`] = hash;
    return acc;
  }, {});

function Setting() {
  // 초기 상태: 해시가 있으면 해시 기준, 없으면 기본 대시보드
  const initialRoute = HASH_ROUTES[(typeof window !== 'undefined' && window.location.hash) || ''];
  const [activeMenu, setActiveMenu] = useState(initialRoute?.menu || '대시보드');
  const [activeSubMenu, setActiveSubMenu] = useState(initialRoute?.sub || '채점 관리');
  // [TCH-09] 교사 등록 진입 시 모드 구분 (school | system)
  const [teacherRegMode, setTeacherRegMode] = useState('school');

  // 브라우저 back/forward 또는 외부 링크로 인한 해시 변경 → state 동기화
  const skipNextHashWriteRef = useRef(false);
  useEffect(() => {
    const handleHashChange = () => {
      const route = HASH_ROUTES[window.location.hash];
      if (route) {
        skipNextHashWriteRef.current = true; // 상태→해시 라운드트립 방지
        setActiveMenu(route.menu);
        setActiveSubMenu(route.sub);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 메뉴 전환 → 해시 갱신 (현재 state에 매핑된 라우트가 있을 때만)
  useEffect(() => {
    if (skipNextHashWriteRef.current) {
      skipNextHashWriteRef.current = false;
      return;
    }
    const hash = ROUTE_BY_STATE[`${activeMenu}|${activeSubMenu}`];
    if (hash && window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  }, [activeMenu, activeSubMenu]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // [TSK-11] 공유된 과제 목록에서 복사한 사본 — 과제 관리 목록(TKS-01) 상단에 노출
  // Fork 모델: 원작자 메타(originalAuthorName/School)는 사본에도 영구 표시 (변경 불가)
  const [copiedTasks, setCopiedTasks] = useState([]);

  // [v3.6] 새 과제 등록 — 슬라이딩 패널에서 선택된 등록 방식 ('direct' | 'upload' | 'select')
  const [taskRegistrationMode, setTaskRegistrationMode] = useState('select');

  // [1주차] Wizard에서 등록한 과제 누적 (lib/taskSchema.js로 빌드된 task 객체)
  //   - extraTasks와 합쳐 TaskManagement 목록 상단에 표시
  //   - 영속화 layer 없음 (prototype: 새로고침 시 휘발)
  const [registeredTasks, setRegisteredTasks] = useState([]);

  // [1주차] 상세보기 — source 분기 라우팅 대상
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  /* [TSK v3.8] 과제 삭제 — 목록·상세 어디서든 같은 확인창을 거친다. 삭제된 id는 목록에서 걷어낸다(프로토타입 로컬 상태) */
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletedTaskIds, setDeletedTaskIds] = useState([]);
  const handleDeleteTask = (task) => {
    setDeletedTaskIds((prev) => [...prev, task.id]);
    setRegisteredTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCopiedTasks((prev) => prev.filter((t) => t.id !== task.id));
    if (selectedTaskDetail?.id === task.id) setSelectedTaskDetail(null);
    setTaskToDelete(null);
    showToast(`「${task.title}」 과제가 삭제되었습니다. 학생·그룹 정보는 유지됩니다.`, 'success');
  };

  const handleCopySharedTask = (sharedItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const newTask = {
      id: `copy-${Date.now()}`,
      status: '작성중',
      visibility: '비공유',
      lastUpdate: today,
      title: sharedItem.title,
      schoolLevel: `${sharedItem.schoolLevel} · ${sharedItem.grade}`,
      subject: sharedItem.subject,
      subSubject: sharedItem.subSubject && sharedItem.subSubject !== sharedItem.subject
        ? sharedItem.subSubject
        : null,
      questions: Array.isArray(sharedItem.questions) ? sharedItem.questions.length : 0,
      points: sharedItem.totalScore ?? 0,
      competencies: Array.isArray(sharedItem.competencies)
        ? sharedItem.competencies.join(' / ')
        : (sharedItem.competencies || ''),
      copiedFromTaskId: sharedItem.id,
      rootTaskId: sharedItem.id,
      forkDepth: 1,
      originalAuthorName: sharedItem.originalAuthorName,
      originalSchool: sharedItem.originalSchool,
    };
    setCopiedTasks(prev => [newTask, ...prev]);
  };

  // ── 테스트 아카이브 & 분석 관련 상태 ──
  const [archiveTests, setArchiveTests] = useState([
    {
      id: 'TC-001', assignmentId: 'assign-003',
      testTitle: '2026.7.1 테스트 1', taskName: '방정식 기초 테스트', questionNo: 1, title: '방정식 기초 테스트',
      status: 'success',
      matchStatus: '완전일치', errorType: '해당 없음', category: '수학', model: 'Gemini 3.1 Flash',
      evalMode: '자동평가', latency: '2.4s', tokens: { input: 312, output: 140, total: 452 },
      costUsd: 0.0006, date: new Date().toISOString(), promptVersionId: 'v1.2', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '우수 (B)', feedback: '풀이 과정이 논리적입니다.' })
    },
    {
      id: 'TC-002', assignmentId: 'assign-001',
      testTitle: '2026.6.30 시 감상 세트 A', taskName: '시 감상 서술형', questionNo: 2, title: '시 감상 서술형',
      status: 'success',
      matchStatus: '부분일치', errorType: '해당 없음', category: '국어', model: 'GPT-4o mini',
      evalMode: '자율평가', latency: '3.1s', tokens: { input: 520, output: 210, total: 730 },
      costUsd: 0.0012, date: new Date(Date.now() - 86400000).toISOString(), promptVersionId: 'v1.2', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '우수 (B)', feedback: '키워드 파악은 좋으나 논리 전개 부족' })
    },
    {
      id: 'TC-003', assignmentId: 'assign-002',
      testTitle: '2026.6.29 독해 테스트', taskName: '영어 독해 평가', questionNo: 1, title: '영어 독해 평가',
      status: 'success',
      matchStatus: '완전일치', errorType: '해당 없음', category: '영어', model: 'Gemini 3.1 Flash',
      evalMode: '자동평가', latency: '1.8s', tokens: { input: 280, output: 120, total: 400 },
      costUsd: 0.0004, date: new Date(Date.now() - 172800000).toISOString(), promptVersionId: 'v1.1', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '매우우수 (A)', feedback: '완벽한 답변입니다.' })
    },
    {
      id: 'TC-004', assignmentId: 'assign-004',
      testTitle: '2026.6.28 실험 보고서 검증', taskName: '과학 실험 보고서', questionNo: 3, title: '과학 실험 보고서',
      status: 'success',
      matchStatus: '불일치', errorType: 'OCR 인식 오류', category: '과학', model: 'GPT-4o mini',
      evalMode: '자동평가', latency: '4.2s', tokens: { input: 610, output: 290, total: 900 },
      costUsd: 0.0018, date: new Date(Date.now() - 259200000).toISOString(), promptVersionId: 'v1.1', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '보통 (C)', feedback: '실험 과정 기술이 미흡합니다.' })
    },
    {
      id: 'TC-005', assignmentId: 'assign-001',
      testTitle: '2026.6.27 시 감상 세트 B', taskName: '시 감상 서술형', questionNo: 1, title: '시 감상 서술형 v2',
      status: 'success',
      matchStatus: '완전일치', errorType: '해당 없음', category: '국어', model: 'GPT-4o mini',
      evalMode: '자율평가', latency: '2.9s', tokens: { input: 480, output: 200, total: 680 },
      costUsd: 0.0010, date: new Date(Date.now() - 345600000).toISOString(), promptVersionId: 'v1.3', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '우수 (B)', feedback: '핵심 주제를 잘 파악했습니다.' })
    },
    {
      id: 'TC-006', assignmentId: 'assign-005',
      testTitle: '2026.6.26 논술 프롬프트 튜닝', taskName: '사회 논술 평가', questionNo: 2, title: '사회 논술 평가',
      status: 'success',
      matchStatus: '부분일치', errorType: '채점 기준표 미준수', category: '사회', model: 'Gemini 3.1 Flash',
      evalMode: '자동평가', latency: '3.5s', tokens: { input: 450, output: 180, total: 630 },
      costUsd: 0.0008, date: new Date(Date.now() - 432000000).toISOString(), promptVersionId: 'v1.3', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '우수 (B)', feedback: '논거가 다소 부족합니다.' })
    },
    {
      id: 'TC-007', assignmentId: 'assign-003',
      testTitle: '2026.6.25 방정식 심화', taskName: '방정식 심화 테스트', questionNo: 3, title: '방정식 심화 테스트',
      status: 'success',
      matchStatus: '완전일치', errorType: '해당 없음', category: '수학', model: 'Gemini 3.1 Flash',
      evalMode: '자율평가', latency: '2.1s', tokens: { input: 340, output: 150, total: 490 },
      costUsd: 0.0005, date: new Date(Date.now() - 518400000).toISOString(), promptVersionId: 'v1.2', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '매우우수 (A)', feedback: '풀이가 정확합니다.' })
    },
    {
      id: 'TC-008', assignmentId: 'assign-004',
      testTitle: '2026.6.24 실험 보고서 재검증', taskName: '과학 실험 보고서', questionNo: 1, title: '과학 실험 보고서 v2',
      status: 'success',
      matchStatus: '불일치', errorType: '환각 현상 (거짓 논리)', category: '과학', model: 'GPT-4o mini',
      evalMode: '자동평가', latency: '5.1s', tokens: { input: 700, output: 320, total: 1020 },
      costUsd: 0.0022, date: new Date(Date.now() - 604800000).toISOString(), promptVersionId: 'v1.3', gradingType: '등급',
      gradingResult: JSON.stringify({ grade: '보통 (C)', feedback: '근거 없는 결론을 도출했습니다.' })
    },
    {
      id: 'TC-Q01', assignmentId: 'assign-003',
      testTitle: '2026.6.29 필기 과정 진단', taskName: '방정식 필기 분석', questionNo: 1, title: '방정식 필기 분석',
      status: 'success',
      matchStatus: '', errorType: '', category: '수학', model: 'Gemini 3.1 Flash',
      evalMode: '자동평가', latency: '3.2s', tokens: { input: 420, output: 180, total: 600 },
      costUsd: 0.0009, date: new Date(Date.now() - 86400000).toISOString(), promptVersionId: 'v1.2', gradingType: '과정',
      writingTimeSec: 272, avgPressure: 0.67, pauseCount: 2, strokeCount: 148, testGrade: 'B',
      gradingResult: '필기 과정 분석: 초반 집중도 높음, 중반 이후 일시 중단 2회 감지'
    },
    {
      id: 'TC-Q02', assignmentId: 'assign-001',
      testTitle: '2026.6.28 시 감상 과정 분석', taskName: '시 감상 필기 과정', questionNo: 2, title: '시 감상 필기 과정',
      status: 'success',
      matchStatus: '', errorType: '', category: '국어', model: 'GPT-4o mini',
      evalMode: '자율평가', latency: '4.1s', tokens: { input: 560, output: 240, total: 800 },
      costUsd: 0.0015, date: new Date(Date.now() - 172800000).toISOString(), promptVersionId: 'v1.2', gradingType: '과정',
      writingTimeSec: 378, avgPressure: 0.52, pauseCount: 0, strokeCount: 215, testGrade: 'C',
      gradingResult: '필기 과정 분석: 안정적 필압, 전체 구간 일관된 몰입'
    },
    {
      id: 'TC-Q03', assignmentId: 'assign-002',
      testTitle: '2026.6.27 서술 필기 검증', taskName: '영어 서술 필기 분석', questionNo: 1, title: '영어 서술 필기 분석',
      status: 'success',
      matchStatus: '', errorType: '', category: '영어', model: 'Gemini 3.1 Flash',
      evalMode: '자동평가', latency: '2.9s', tokens: { input: 380, output: 160, total: 540 },
      costUsd: 0.0007, date: new Date(Date.now() - 259200000).toISOString(), promptVersionId: 'v1.2', gradingType: '과정',
      writingTimeSec: 225, avgPressure: 0.74, pauseCount: 1, strokeCount: 132, testGrade: 'A',
      gradingResult: '필기 과정 분석: 중반부 18초 정지 감지, 이후 정상 재개'
    },
    {
      id: 'TC-Q04', assignmentId: 'assign-004',
      testTitle: '2026.6.26 실험 과정 재검증', taskName: '과학 실험 필기 과정', questionNo: 4, title: '과학 실험 필기 과정',
      status: 'success',
      matchStatus: '', errorType: '', category: '과학', model: 'GPT-4o mini',
      evalMode: '자율평가', latency: '5.3s', tokens: { input: 640, output: 280, total: 920 },
      costUsd: 0.0019, date: new Date(Date.now() - 345600000).toISOString(), promptVersionId: 'v1.2', gradingType: '과정',
      writingTimeSec: 472, avgPressure: 0.48, pauseCount: 3, strokeCount: 287, testGrade: 'D',
      gradingResult: '필기 과정 분석: 초반 집중도 낮음(낙서 포함), 중반부 집중 구간 확보'
    }
  ]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState([]);

  const addArchiveItem = (itemOrArray) => {
    const incoming = Array.isArray(itemOrArray) ? itemOrArray : [itemOrArray];
    if (incoming.length === 0) return;
    setArchiveTests(prev => [...incoming, ...prev]);
  };

  // ── 환경설정 관련 상태 ──
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSettingsMode, setIsSettingsMode] = useState(false);
  /** [SET-01 v1.5] 진단 로그 다운로드 — 날짜 선택 다이얼로그 */
  const [isIncidentOpen, setIsIncidentOpen] = useState(false); // [BRD-16] 장애 신고 다이얼로그
  const [incidentBadge, setIncidentBadge] = useState(() => incidentOpenCount()); // [BRD-16] 사이드바 장애신고 미처리 건수
  useEffect(() => subscribeIncidents(() => setIncidentBadge(incidentOpenCount())), []);
  /** [SET-01 v1.6] 펜 데이터 다운로드 — 안내 다이얼로그 (프로토타입은 안내까지) */
  const [activeSettingsMenu, setActiveSettingsMenu] = useState('환경설정');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isFirmwareModalOpen, setIsFirmwareModalOpen] = useState(false);
  // [v1.0] 펜 절전 지연시간 설정 — 20분 → 60분 (최초 1회). AiGLE Connect 실행 필요
  const [penIdleDelayProcessed, setPenIdleDelayProcessed] = useState(0); // 작업 완료된 펜 수
  const [penIdleDelayPhase, setPenIdleDelayPhase] = useState('idle'); // idle | processing | done
  // [v4.5] Ncode Print Doctor — 다운로드 기록. localStorage 영속화로 다른 화면(답안지 미리보기 등)에서 설치 여부 판별
  const [printDoctorDownloaded, setPrintDoctorDownloaded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ncodePrintDoctor:downloaded') === 'true';
  });
  const [printDoctorVersion, setPrintDoctorVersion] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('ncodePrintDoctor:version') || null;
  });
  const [printDoctorDownloadedAt, setPrintDoctorDownloadedAt] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('ncodePrintDoctor:downloadedAt') || null;
  });

  const [settingsPenData, setSettingsPenData] = useState(
    Array.from({ length: 15 }, (_, i) => {
      const batteryValue = i === 1 ? 15 : Math.floor(Math.random() * 60) + 40;
      const isLatest = i % 4 === 1 && i !== 1;
      return {
        mac: `00:1B:44:11:3A:${(i + 1).toString(16).padStart(2, '0').toUpperCase()}`,
        battery: `${batteryValue}%`,
        firmware: isLatest ? '2.1.0 (최신)' : (i === 3 ? '1.9.5' : '2.0.8'),
        needsUpdate: !isLatest,
        updating: false,
        progress: 0,
        status: 'idle',
        errorCode: batteryValue < 20 ? 'BATTERY_LOW' : null
      };
    })
  );

  // ── 환경설정 핸들러 ──
  const handleSettingsBulkUpdate = () => {
    const updatablePens = settingsPenData.filter(p => p.needsUpdate && parseInt(p.battery) >= 20);
    if (updatablePens.length === 0) {
      const hasLowBattery = settingsPenData.some(p => p.needsUpdate && parseInt(p.battery) < 20);
      if (hasLowBattery) alert('배터리가 부족한 펜이 있습니다. 충전 후 다시 시도해주세요.');
      else showToast('이미 모든 펜이 최신 버전입니다.', 'info');
      return;
    }
    setSettingsPenData(prev => prev.map(p => (p.needsUpdate && parseInt(p.battery) >= 20) ? { ...p, updating: true, progress: 0, status: 'updating' } : p));
    const interval = setInterval(() => {
      setSettingsPenData(prev => {
        const anyUpdating = prev.some(p => p.updating && p.progress < 100);
        if (!anyUpdating) { clearInterval(interval); return prev.map(p => p.status === 'updating' ? { ...p, updating: false, status: 'success', needsUpdate: false, firmware: '2.1.0 (최신)' } : p); }
        return prev.map(p => {
          if (p.updating && p.status === 'updating') {
            const nextProgress = Math.min(100, p.progress + Math.floor(Math.random() * 20) + 5);
            return { ...p, progress: nextProgress, updating: nextProgress < 100 };
          }
          return p;
        });
      });
    }, 400);
  };

  const handleRetryUpdate = (mac) => {
    setSettingsPenData(prev => prev.map(p => p.mac === mac ? { ...p, updating: true, progress: 0, status: 'updating' } : p));
  };

  const handleResetAll = () => {
    showToast('초기화가 완료되었습니다.');
    setIsResetModalOpen(false);
  };

  const handleRemovePen = (mac) => {
    setSettingsPenData(prev => prev.filter(p => p.mac !== mac));
    showToast('기기가 명단에서 제거되었습니다.', 'info');
  };

  const handleCloseFirmwareModal = () => {
    setSettingsPenData(prev => prev.filter(p => !p.needsUpdate || parseInt(p.battery) >= 20));
    setIsFirmwareModalOpen(false);
  };

  const handleDownloadConnect = () => {
    /* [POP-30] 다운로드 사실을 남긴다 — 브라우저는 설치 여부를 알 수 없어서,
     * 「AiGLE 필수 프로그램 확인」 창이 이 기록으로 미설치와 꺼짐을 가른다. */
    markConnectDownloaded();
    showToast('AiGLE Connect 다운로드가 시작되었습니다.', 'success');
    // 실제 환경에서는 파일 시스템 API 또는 Window Open 등을 통해 다운로드를 트리거합니다.
  };

  // [v1.0] 펜 절전 지연시간 일괄 변경 (20분 → 60분). AiGLE Connect 가동 중 펜에 명령 전송.
  // 펜 한 대씩 800ms 간격으로 처리하는 시뮬레이션 — 진행률 표시
  const handleChangePenIdleDelay = () => {
    if (settingsPenData.length === 0) {
      showToast('연결된 펜이 없습니다. AiGLE Connect 및 펜 연결 상태를 확인해 주세요.', 'error');
      return;
    }
    setPenIdleDelayPhase('processing');
    setPenIdleDelayProcessed(0);
    const total = settingsPenData.length;
    let idx = 0;
    const step = () => {
      idx += 1;
      setPenIdleDelayProcessed(idx);
      if (idx >= total) {
        setPenIdleDelayPhase('done');
        showToast(`모든 펜의 절전 지연시간이 60분으로 변경되었습니다. (${total}개)`, 'success');
      } else {
        setTimeout(step, 800);
      }
    };
    setTimeout(step, 800);
  };

  // [v4.5] 답안지 미리보기 → Print Doctor 미설치 안내 모달의 [환경설정으로 이동] 액션 처리
  useEffect(() => {
    const handler = () => {
      setIsSettingsMode(true);
      setActiveSettingsMenu('환경설정');
    };
    window.addEventListener('aigle:navigate-to-settings', handler);
    return () => window.removeEventListener('aigle:navigate-to-settings', handler);
  }, []);

  // [v4.5] Ncode Print Doctor — 최신 버전 다운로드. 완료 시 다운로드 기록(버전·시각) 표시 + localStorage 영속화
  const handleDownloadPrintDoctor = () => {
    showToast('Ncode Print Doctor 다운로드가 시작되었습니다.', 'success');
    setTimeout(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const version = '1.0.3';
      setPrintDoctorDownloaded(true);
      setPrintDoctorVersion(version);
      setPrintDoctorDownloadedAt(stamp);
      try {
        localStorage.setItem('ncodePrintDoctor:downloaded', 'true');
        localStorage.setItem('ncodePrintDoctor:version', version);
        localStorage.setItem('ncodePrintDoctor:downloadedAt', stamp);
      } catch (_) { /* localStorage 사용 불가 환경 무시 */ }
      showToast('Ncode Print Doctor 다운로드가 완료되었습니다.', 'success');
    }, 1200);
  };

  // [v4.6] 사이드바 「설정 필요」 배지 카운트 — 4개 트리거 중 미해결 항목 수
  //   ① AiGLE Connect 관리 — 현재 버전(2.0.5) < 최신 버전(2.1.0) → 항상 1 (mock)
  //   ② 펜 펌웨어 업데이트 — 연결 펜 중 needsUpdate === true 존재
  //   ③ Ncode Print Doctor — 미다운로드
  //   ④ 펜 자동꺼짐 시간 변경 — 미완료
  const AIGLE_CONNECT_CURRENT_VERSION = '2.0.5';
  const AIGLE_CONNECT_LATEST_VERSION = '2.1.0';
  const settingsBadgeCount =
    (AIGLE_CONNECT_CURRENT_VERSION !== AIGLE_CONNECT_LATEST_VERSION ? 1 : 0) +
    (settingsPenData.some((p) => p.needsUpdate) ? 1 : 0) +
    (!printDoctorDownloaded ? 1 : 0) +
    (penIdleDelayPhase !== 'done' ? 1 : 0);

  return (
    <div className="app-container">
      <TaskDeleteDialog task={taskToDelete} onCancel={() => setTaskToDelete(null)} onConfirm={handleDeleteTask} />
      {/* [BRD-16] 장애 신고 — 환경설정에서 접수 (과제·그룹 없음, 진단 로그·연결된 펜 데이터 자동 첨부) */}
      <IncidentReportDialog open={isIncidentOpen} onClose={() => setIsIncidentOpen(false)}
        onSubmitted={(r) => showToast(`장애 신고가 접수되었습니다 — ${r.id} (Jira ${r.jira?.key}). 운영팀 답변은 메일로 보내 드립니다.`, 'success')}
        context={{ source: '환경설정', school: '공주 고등학교', teacher: '김 b', teacherId: 'tch20261zim', teacherEmail: 'tch20261zim@gjhs.kr',
          penFiles: settingsPenData.map((p, i) => `PEN-${String(i + 1).padStart(3, '0')}_${String(p.mac || p.id || '').replace(/:/g, '').slice(0, 6)}.pen`) }} />
      <Sidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        activeSubMenu={activeSubMenu}
        setActiveSubMenu={setActiveSubMenu}
        isSettingsMode={isSettingsMode}
        setIsSettingsMode={setIsSettingsMode}
        activeSettingsMenu={activeSettingsMenu}
        setActiveSettingsMenu={setActiveSettingsMenu}
        isProfileDropdownOpen={isProfileDropdownOpen}
        setIsProfileDropdownOpen={setIsProfileDropdownOpen}
        setShowAnalysis={setShowAnalysis}
        taskCount={BASE_TASKS.length + copiedTasks.length + registeredTasks.length}
        settingsBadgeCount={settingsBadgeCount}
        incidentOpenCount={incidentBadge}
      />

      <main className="main-wrapper" style={activeMenu === '아이글 채점 테스트' ? { padding: 0, overflow: 'hidden' } : {}}>
        {isSettingsMode ? (
          <div className="settings-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <header className="content-header" style={{ marginBottom: '2rem' }}>
              <div className="page-title">{activeSettingsMenu}</div>
            </header>
            {activeSettingsMenu === '환경설정' && (() => {
              /* [SET-01 v1.2] 카드 → 한 줄 행. 5개 항목이 한 화면에 들어오도록 스크롤을 없앤다.
               *   행 구성: 아이콘 · 제목+한 줄 설명 · 상태 · 동작 버튼. 설명·경고는 한 줄로 줄이고, 상세는 모달·툴팁이 맡는다.
               *   진단 로그 다운로드는 AiGLE Connect 행의 보조 버튼 — CS 멘트 「환경설정 → AiGLE Connect → 로그 다운로드」 유지. */
              /* [SET-01 v1.3] 가로로 긴 행은 가독성이 떨어져 **세로 카드**로 되돌리되 크기를 줄인다 —
               *   카드 안은 아이콘+제목 · 설명 한두 줄 · 상태 · 버튼이 위→아래. 카드는 격자로 놓아 한 화면에 들어온다. */
              const row = { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem 1.1rem', background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(15,23,42,0.06)', border: '1px solid #EEF2F7', minWidth: 0 };
              const title = { fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
              const desc = { fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', lineHeight: 1.55, flex: 1 };
              /* [SET-01 v1.4] 상태 칩은 타이틀 오른쪽, 버튼은 하단 오른쪽 — 상태와 동작을 한 줄에 섞지 않는다 */
              const head = (icon, text, color, status) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                  <span style={{ ...title, color: color || title.color, flex: 1, minWidth: 0 }}>{text}</span>
                  {status}
                </div>
              );
              const foot = (action) => (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: '0.25rem' }}>{action}</div>
              );
              const chip = (text, tone = 'muted') => {
                const t = { muted: { bg: '#F1F5F9', c: '#64748B' }, ok: { bg: '#DCFCE7', c: '#166534' }, warn: { bg: '#FFF1F2', c: '#DC2626' }, info: { bg: '#DBEAFE', c: '#1D4ED8' } }[tone];
                return <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: t.bg, color: t.c, whiteSpace: 'nowrap' }}>{text}</span>;
              };
              const primary = (label, onClick, opts = {}) => (
                <button className="btn-primary" onClick={onClick} disabled={opts.disabled}
                  style={{ padding: '0.55rem 1rem', fontSize: 'var(--neo-font-size-sm)', whiteSpace: 'nowrap', background: opts.bg, opacity: opts.disabled ? 0.7 : 1, cursor: opts.disabled ? 'not-allowed' : 'pointer' }}>{label}</button>
              );
              const ghost = (label, onClick, extra = {}) => (
                <button type="button" onClick={onClick} title={extra.title}
                  style={{ padding: '0.55rem 0.9rem', borderRadius: 8, border: '1px solid #D5DAE0', background: 'white', color: '#1E2225', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>
              );
              const section = (heading, sub, children) => (
                <div>
                  <div style={{ margin: '0 0 0.5rem 0.25rem', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#334155', margin: 0 }}>{heading}</h2>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1' }}>{sub}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>{children}</div>
                </div>
              );
              const needsFw = settingsPenData.some((p) => p.needsUpdate);
              return (
                <div className="settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', maxWidth: '1000px', margin: '0 auto' }}>
                  {section('관리', '설치 · 업데이트 · 초기화', (
                    <>
                      {/* ① AiGLE Connect 관리 + 진단 로그 */}
                      <div style={row}>
                        {head('📦', 'AiGLE Connect 관리', null, chip('업데이트 있음', 'info'))}
                        <div style={desc}>펜 연결·크래들 채점용 프로그램. 현재 2.0.5 → 최신 2.1.0<br />문제가 반복되면 [🚨 장애 신고]로 알려 주세요 — 진단 로그·펜 데이터가 함께 전달됩니다.</div>
                        {foot((
                          <>
                            {/* [BRD-16] 舊 [⬇ 로그]·[⬇ 펜 데이터] → [🚨 장애 신고] */}
                            {ghost('🚨 장애 신고', () => setIsIncidentOpen(true), { title: '학교·교사 정보와 진단 로그·연결된 펜 데이터를 함께 시스템 관리자에게 신고합니다. 운영팀 답변은 메일로 받습니다.' })}
                            {primary('최신 버전 다운로드', handleDownloadConnect)}
                          </>
                        ))}
                      </div>

                      {/* ② 펜 펌웨어 업데이트 */}
                      <div style={row}>
                        {head('🔌', '펜 펌웨어 업데이트', null, needsFw ? chip('업데이트 필요', 'warn') : chip('최신', 'ok'))}
                        <div style={desc}>연결된 펜 {settingsPenData.length}개의 펌웨어를 확인하고 최신으로 올립니다.</div>
                        {foot(primary('펜 목록 확인', () => setIsFirmwareModalOpen(true), { bg: '#4E5968' }))}
                      </div>

                      {/* ③ 펜 데이터 초기화 */}
                      <div style={{ ...row, border: '1px solid #FFE4E6' }}>
                        {head('⚠️', '펜 데이터 초기화', '#991B1B', chip('복구 불가', 'warn'))}
                        <div style={desc}>모든 펜의 데이터를 삭제합니다. 복구할 수 없습니다.<br />AiGLE Connect 실행 중이어야 합니다.</div>
                        {foot(primary('전체 초기화', () => setIsResetModalOpen(true), { bg: '#EF4444' }))}
                      </div>
                    </>
                  ))}

                  {section('✨ 최초 1회 셋업', '한 번만 설정하면 됩니다', (
                    <>
                      {/* ④ Ncode Print Doctor */}
                      <div style={{ ...row, background: printDoctorDownloaded ? '#F0FDF4' : 'white' }}>
                        {head('🖨️', '인쇄 최적화 도구 Ncode Print Doctor', null, printDoctorDownloaded ? chip('✓ 완료', 'ok') : chip('최초 1회', 'info'))}
                        <div style={desc}>{printDoctorDownloaded ? `다운로드 완료 · 버전 ${printDoctorVersion} · ${printDoctorDownloadedAt}` : '프린터 환경에 맞춰 인쇄 속도를 최적화합니다.'}</div>
                        {foot(primary(printDoctorDownloaded ? '다시 다운로드' : '다운로드', handleDownloadPrintDoctor, { bg: printDoctorDownloaded ? '#10B981' : undefined }))}
                      </div>

                      {/* ⑤ 펜 자동꺼짐 시간 */}
                      <div style={{ ...row, background: penIdleDelayPhase === 'done' ? '#F0FDF4' : 'white' }}>
                        {head('💤', '펜 자동꺼짐 시간 변경', null, penIdleDelayPhase === 'done' ? chip('✓ 완료', 'ok') : penIdleDelayPhase === 'processing' ? chip(`${penIdleDelayProcessed} / ${settingsPenData.length}개`, 'info') : chip('최초 1회', 'info'))}
                        <div style={desc}>20분 → 60분. 수업 중 펜이 꺼져 재연결되는 불편을 줄입니다.<br />AiGLE Connect 실행 중이어야 합니다.</div>
                        {foot(primary(penIdleDelayPhase === 'done' ? '다시 설정' : penIdleDelayPhase === 'processing' ? '진행 중…' : '설정값 변경', handleChangePenIdleDelay, { bg: penIdleDelayPhase === 'done' ? '#10B981' : undefined, disabled: penIdleDelayPhase === 'processing' }))}
                      </div>
                    </>
                  ))}
                </div>
              );
            })()}
            {activeSettingsMenu === '내 정보' && (
              <MyInfo />
            )}
            {activeSettingsMenu !== '환경설정' && activeSettingsMenu !== '내 정보' && (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#8A94A1' }}>
                <h3>{activeSettingsMenu} 페이지를 준비 중입니다.</h3>
              </div>
            )}
          </div>
        ) : activeMenu === '아이글 채점 테스트' ? (
          // [v2.85] 「Prompt Studio」 메뉴 폐기 → 「아이글 채점 테스트」로 대체
          //   ⊙ 아이글 채점 테스트       : AiGradingTest (대량 검증 화면)
          //   ⊙ 아이글 채점 테스트 아카이브 : PromptArchive (재활용, 저장된 테스트 세션 목록)
          //   분석 리포트            : AnalysisReport (재활용, 아카이브에서 진입)
          showAnalysis ? (
            <AnalysisReport data={analysisData} allArchive={archiveTests} onBack={() => setShowAnalysis(false)} />
          ) : activeSubMenu === '아이글 채점 테스트' ? (
            <AiGradingTest onSaveArchive={addArchiveItem} />
          ) : (
            <PromptArchive
              tests={archiveTests}
              onSetTests={setArchiveTests}
              onRunAnalysis={(selected) => {
                setAnalysisData(selected);
                setShowAnalysis(true);
              }}
            />
          )
        ) : activeMenu === '회원 관리' || activeMenu === '학생' ? (
          activeSubMenu === '교사 관리' ? (
            <TeacherManagement onAdd={() => { setTeacherRegMode('system'); setActiveSubMenu('교사 등록'); }} />
          ) : activeSubMenu === '교사관리(학교모드)' ? (
            <SchoolTeacherManagement onAdd={() => { setTeacherRegMode('school'); setActiveSubMenu('교사 등록'); }} />
          ) : activeSubMenu === '학교 관리' ? (
            <SchoolManagement />
          ) : activeSubMenu === '교사 등록' ? (
            <TeacherRegistration
              mode={teacherRegMode}
              onCancel={() => setActiveSubMenu(teacherRegMode === 'school' ? '교사관리(학교모드)' : '교사 관리')}
              onComplete={() => {
                showToast('교사 등록이 완료되었습니다.');
                setActiveSubMenu(teacherRegMode === 'school' ? '교사관리(학교모드)' : '교사 관리');
              }}
              showToast={showToast}
            />
          ) : activeSubMenu === '학생 등록' ? (
            <StudentRegistration 
              onCancel={() => setActiveSubMenu('학생 관리')}
              onComplete={() => {
                showToast('학생 등록이 완료되었습니다.');
                setActiveSubMenu('학생 관리');
              }}
              showToast={showToast}
            />
          ) : activeSubMenu === '학생 관리' ? (
            <StudentManagement onAdd={() => setActiveSubMenu('학생 등록')} />
          ) : (
            <div className="content-container">그룹 관리 화면 준비 중...</div>
          )
        ) : activeMenu === '채점 관리' ? (
          /* [v4.7] 채점 관리 메뉴 — 채점 관리 / 채점 관리 2(퇴고) */
          activeSubMenu === '채점 관리 2' ? (
            /* [SCR-06] 채점 관리 2 — 기존 기능 + 퇴고(1차/2차 차수 관리·점수 추이) */
            <GradingManagement activeSubMenu={activeSubMenu} variant="v2" />
          ) : (
            <GradingManagement activeSubMenu="채점 관리" />
          )
        ) : activeMenu === '과제 관리' ? (
          /* [v4.7] 과제 관리 메뉴 — 과제 관리 / 과제 등록 / 과제 상세 / 공유된 과제 */
          selectedTaskDetail ? (
            <TaskDetail task={selectedTaskDetail} onBack={() => setSelectedTaskDetail(null)} onDelete={(task) => setTaskToDelete(task)} />
          ) : activeSubMenu === '과제 등록' ? (
            <TaskRegistration
              onBack={() => setActiveSubMenu('과제 관리')}
              showToast={showToast}
              initialMode={taskRegistrationMode}
              onAdd={(task) => setRegisteredTasks((prev) => [task, ...prev])}
            />
          ) : activeSubMenu === '공유된 과제' ? (
            <SharedAssignments
              onNavigateToTaskManagement={() => setActiveSubMenu('과제 관리')}
              onCopyTask={handleCopySharedTask}
              copiedSharedIds={new Set(copiedTasks.map(t => t.copiedFromTaskId).filter(Boolean))}
            />
          ) : (
            <TaskManagement
              onAdd={(mode) => { setTaskRegistrationMode(mode || 'select'); setActiveSubMenu('과제 등록'); }}
              extraTasks={[...registeredTasks, ...copiedTasks]}
              deletedTaskIds={deletedTaskIds}
              onAddTask={(task) => { setRegisteredTasks((prev) => [task, ...prev]); }}
              onOpenDetail={(task) => setSelectedTaskDetail(task)}
              onRequestDelete={(task) => setTaskToDelete(task)}
            />
          )
        ) : activeMenu === '스마트펜 모니터링' ? (
          <SmartpenMonitor />
        ) : activeMenu === '게시판' ? (
          /* [BRD-16] 게시판 — 공지사항 / 장애신고 */
          activeSubMenu === '장애신고' ? <IncidentBoard showToast={showToast} /> : <NoticePopupDemo />
        ) : activeMenu === '대시보드' ? (
          <Dashboard onNavigate={setActiveMenu} />
        ) : activeMenu === '교사 대시보드' ? (
          // [v3.x] TeacherDashboard 상단 3 카드(과제/채점/학생) 클릭 시 각 목록 화면으로 라우팅
          //   기존: setActiveMenu(target) — 'TaskManagement' 등의 문자열은 매치되는 라우트 없음 (동작 안 함)
          //   신규: target → { menu, sub } 매핑 후 setActiveMenu + setActiveSubMenu 동시 설정
          <TeacherDashboard onNavigate={(target) => {
            const routeMap = {
              TaskManagement: { menu: '과제 관리', sub: '과제 관리' },
              GradingManagement: { menu: '채점 관리', sub: '채점 관리' },
              StudentManagement: { menu: '학생', sub: '학생 관리' },
              // 라벨 기반 호출 호환 (기존 [🤝 채점관리] 버튼 등)
              '과제 관리': { menu: '과제 관리', sub: '과제 관리' },
              '채점 관리': { menu: '채점 관리', sub: '채점 관리' },
              '학생 관리': { menu: '학생', sub: '학생 관리' },
            };
            const dest = routeMap[target];
            if (dest) {
              setActiveMenu(dest.menu);
              setActiveSubMenu(dest.sub);
            } else {
              setActiveMenu(target); // fallback
            }
          }} />
        ) : activeMenu === '학교 대시보드' ? (
          <SchoolDashboard onNavigate={setActiveMenu} />
        ) : activeMenu === '교육청 대시보드' ? (
          <EduOfficeDashboard onNavigate={setActiveMenu} />
        ) : activeMenu === '화면 명세서' ? (
          <SpecViewer renderPreview={(key) => {
            if (key === '학교 대시보드') return <SchoolDashboard onNavigate={() => {}} />;
            if (key === '교사 대시보드') return <TeacherDashboard onNavigate={() => {}} />;
            if (key === '교육청 대시보드') return <EduOfficeDashboard onNavigate={() => {}} />;
            if (key === '대시보드') return <Dashboard onNavigate={() => {}} />;
            return <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94A3B8' }}>미리보기 미지원: {key}</div>;
          }} />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8A94A1' }}>{activeMenu} 준비 중입니다.</div>
        )}
      </main>

      {/* Models for Settings */}
      {isFirmwareModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 10003 }} onClick={handleCloseFirmwareModal}>
          <div className="modal-container" style={{ width: '800px', height: '600px', padding: '2rem', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button className="btn-modal-close" onClick={handleCloseFirmwareModal}>×</button>
            <h2 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, marginBottom: '0.5rem' }}>펜 펌웨어 업데이트 명단</h2>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#F1F3F5', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}></th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>No.</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>펜 MAC 주소</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>배터리</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>펌웨어 버전</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsPenData.map((pen, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}><button onClick={() => handleRemovePen(pen.mac)} style={{ background: 'none', border: 'none', color: '#EF4444' }}>×</button></td>
                      <td style={{ padding: '10px 12px', color: '#8A94A1' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{pen.mac}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{pen.battery}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{pen.firmware}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {pen.status === 'updating' ? '...' : pen.needsUpdate ? <span style={{ color: '#FF4D4D' }}>업데이트 필요</span> : <span style={{ color: '#10B981' }}>최신</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-card-detail" onClick={handleCloseFirmwareModal}>닫기</button>
              <button className="btn-primary" style={{ background: '#FF4D4D' }} onClick={handleSettingsBulkUpdate}>일괄 업데이트</button>
            </div>
          </div>
        </div>
      )}
      {isResetModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={() => setIsResetModalOpen(false)}>
          <div className="modal-container" style={{ width: '440px', padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3>펜 데이터 초기화 확인</h3>
            <p>초기화 후 삭제된 데이터는 되돌릴 수 없습니다.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn-card-detail" style={{ flex: 1 }} onClick={() => setIsResetModalOpen(false)}>취소</button>
              <button className="btn-primary" style={{ flex: 1, background: '#EF4444' }} onClick={handleResetAll}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {toast.show && <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 11000, background: '#2A75F3', color: 'white', padding: '1rem 2rem', borderRadius: '12px' }}>{toast.message}</div>}
    </div>
  );
}

export default Setting;
