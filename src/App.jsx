/**
 * App.jsx
 * [미사용 - 구버전 프로토타입] 채점 관리 화면의 초기 프로토타입 파일입니다.
 * 현재 main.jsx에서는 Setting.jsx를 진입점으로 사용하고 있으며, 이 파일은 실제 서비스에서 사용되지 않습니다.
 * 채점 관리(과제 선택, 학생 목록, 채점 상세), 환경설정 일부 기능이 포함되어 있습니다.
 */
import React, { useState } from 'react';
import './index.css';
import SmartpenSync from './SmartpenSync';
import SmartpenSyncPopup from './SmartpenSyncPopup';
import GradingDetailModal from './GradingDetailModal';
import PenFirmwareModal from './PenFirmwareModal';
import ResetConfirmModal from './ResetConfirmModal';
import ExitConfirmModal from './ExitConfirmModal';
import TaskManagement from './TaskManagement';

function App() {
  const [activeMenu, setActiveMenu] = useState('과제 및 채점관리');
  const [activeSubMenu, setActiveSubMenu] = useState('과제 관리');
  const [selectedTask, setSelectedTask] = useState(1);
  const [activeTab, setActiveTab] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(1);
  const [isScanUploadOpen, setIsScanUploadOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([
    { id: 1, name: 'image (9).png', size: '79.33 KB' },
    { id: 2, name: 'image (8).png', size: '79.33 KB' },
    { id: 3, name: 'image (7).png', size: '172.98 KB' },
    { id: 4, name: 'aigle_icon.png', size: '34.8 KB' }
  ]);

  // 채점 확인 단계 전용 상태
  const [gradingHistory, setGradingHistory] = useState([
    { id: 1, label: '#1', level: '노력 (3단계)', feedback: '문장의 호응이 좋지 않아요. "이러다드..."와 같이 나름의 답변을 작성하려고 노력한 점은 긍정적이에요. 조금만 더 노력해보세요. 제시된 질문의 의도와 답변 내용의 텍스트가 부합하는 내용을 찾기가 어렵네요. 상세 설명에서 질문의 내용을 다시 읽고 천천히 읽어보고, 요구하는 핵심 키워드를 정확하게 파악하여 답변하는 연습을 해보아야 해요. 내용 분석 A, 지식 이해 및...' }
  ]);
  const [reflectedHistoryId, setReflectedHistoryId] = useState(1);
  const [teacherFinalFeedback, setTeacherFinalFeedback] = useState('');

  // 일괄 채점 관련 상태
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('ready'); // ready, processing, completed
  
  // 백그라운드 채점 및 알림 관련 상태
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const [showFAB, setShowFAB] = useState(false);
  const [isGradingFinished, setIsGradingFinished] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSettingsMode, setIsSettingsMode] = useState(false);
  const [activeSettingsMenu, setActiveSettingsMenu] = useState('환경설정');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isFirmwareModalOpen, setIsFirmwareModalOpen] = useState(false);
  
  // 일괄 채점 전용 (크래들 연결 상태) - SmartpenSyncPopup에서 관리됨
  const [settingsPenData, setSettingsPenData] = useState([
    { mac: 'NE:00:11:22:33:44', battery: '85%', firmware: '1.2.3', needsUpdate: false },
    { mac: 'NE:55:66:77:88:99', battery: '42%', firmware: '1.2.0', needsUpdate: true },
    { mac: 'NE:AA:BB:CC:DD:EE', battery: '91%', firmware: '1.2.3', needsUpdate: false }
  ]);

  // 모의 데이터 (Mock Data)
  const tasks = [
    { id: 1, type: '국어', title: '과제테스트', date: '2024.02.23', submissions: '0/10', description: '테스트' },
    { id: 2, type: '국어', title: '오늘 테스트 과제', date: '2024.02.24', submissions: '3/3', description: '오늘 테스트' }
  ];

  // 과제별 문항 (Mock: 최대 3개, 여기서는 2개로 설정하여 동적 탭 확인)
  const questions = [
    { id: 1, title: '문항 1', description: '작품의 주제를 파악하고 자신의 생각을 서술하시오.' },
    { id: 2, title: '문항 2', description: '주요 등장인물의 심리 변화를 분석하시오.' }
  ];

  const [students, setStudents] = useState([
    { id: 11, name: '정지훈', grade: '5학년 2반 3번', aiGrade: '노력', teacherGrade: '보통', status: '채점 확인' },
    { id: 1, name: '김순정', grade: '1학년 1반 1번', aiGrade: '-', teacherGrade: '-', status: '미채점' },
    { id: 2, name: '이순정', grade: '1학년 1반 2번', aiGrade: '-', teacherGrade: '-', status: '미채점' },
    { id: 3, name: '박순정', grade: '1학년 1반 3번', aiGrade: '-', teacherGrade: '-', status: '미채점' },
    { id: 9, name: '일반테스트', grade: '6학년 1반 1번', aiGrade: '노력', teacherGrade: '노력', status: '결과 발송 완료' },
    { id: 10, name: '이하늘', grade: '4학년 1반 1번', aiGrade: '노력', teacherGrade: '노력', status: '결과 발송 완료' }
  ]);

  const currentTask = tasks.find(t => t.id === selectedTask) || tasks[1];

  const handleOpenModal = (student) => {
    setSelectedStudent(student);
    setActiveQuestion(1);
    setIsModalOpen(true);
    // 상태 초기화
    if (student.status === '채점 확인') {
      setTeacherFinalFeedback('');
      setReflectedHistoryId(1);
    }
  };

  // 탭 필터링 로직
  const filteredStudents = students.filter(student => {
    if (activeTab === '전체') return true;
    if (activeTab === '미채점') return student.status === '미채점';
    if (activeTab === '채점 확인') return student.status === '채점 확인';
    if (activeTab === '결과 발송') return student.status === '결과 발송 완료';
    return true;
  });

  const getTabLabel = (label) => {
    const count = students.filter(s => {
      if (label === '전체') return true;
      if (label === '미채점') return s.status === '미채점';
      if (label === '채점 확인') return s.status === '채점 확인';
      if (label === '결과 발송') return s.status === '결과 발송 완료';
      return false;
    }).length;
    return `${label}(${count})`;
  };

  // 일괄 채점 핸들러
  const handleBulkGrading = () => {
    if (!selectedGroup || selectedGroup === '그룹 선택') {
      alert('그룹이 선택되어야 일괄 채점을 시작할 수 있습니다.');
      return;
    }
    setIsBulkModalOpen(true);
  };

  const toggleAll = () => {
    const ungradedIds = students.filter(s => s.status === '미채점').map(s => s.id);
    if (selectedIds.length === ungradedIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(ungradedIds);
    }
  };

  const toggleStudent = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCloseProcessing = () => {
    setIsBulkModalOpen(false);
    setActiveTab('미채점'); // 완료 후 닫기 시 '미채점' 탭으로 이동
    setBulkStatus('ready');
    setIsGradingFinished(false);
  };

  const proceedToBackground = () => {
    setIsConfirmCloseOpen(false);
    setIsBulkModalOpen(false);
    setShowFAB(true);
  };

  return (
    <div className="app-container">
      {/* --- 메인 사이드바 (좌측) --- */}
      <aside className="main-sidebar">
        <div className="logo-container">
          <img src="/images/logo.svg" alt="AiGLE" style={{ height: '32px' }} />
        </div>

        <div 
          className="user-profile" 
          style={{ marginBottom: '1rem', cursor: 'pointer', position: 'relative' }}
          onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
        >
          <div className="avatar">
            <img src="/assets/images/logo.svg" alt="Avatar" style={{ opacity: 0.2 }} />
          </div>
          <div className="user-info">
            <div className="name">[교사] 김 b</div>
            <div className="id">tch20261zim</div>
          </div>
          
          {isProfileDropdownOpen && (
            <div className="user-profile-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-item" onClick={() => { setIsSettingsMode(true); setActiveSettingsMenu('내 정보'); setIsProfileDropdownOpen(false); }}>내 정보</div>
              <div className="dropdown-item" onClick={() => { setIsSettingsMode(true); setActiveSettingsMenu('환경설정'); setIsProfileDropdownOpen(false); }}>환경설정</div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item logout">로그아웃</div>
            </div>
          )}
        </div>

        <nav className="nav-menu">
          {!isSettingsMode ? (
            <>
              <div className={`nav-item ${activeMenu === '대시보드' ? 'active' : ''}`} onClick={() => setActiveMenu('대시보드')}>
                 📊 대시보드
              </div>
              <div className={`nav-item ${activeMenu === '학생' ? 'active' : ''}`} onClick={() => setActiveMenu('학생')}>
                 👥 학생 <span className="n-badge" style={{ marginLeft: 'auto', background: 'var(--success)' }}>N</span>
              </div>
              <div 
                className={`nav-item ${activeMenu === '과제 및 채점관리' ? 'active' : ''}`} 
                onClick={() => setActiveMenu('과제 및 채점관리')}
              >
                 📝 과제 및 채점관리 <span className="arrow">▼</span>
              </div>
              
              {activeMenu === '과제 및 채점관리' && (
                <div className="nav-sub-menu">
                  <div 
                    className={`nav-sub-item ${activeSubMenu === '과제 관리' ? 'active' : ''}`}
                    onClick={() => setActiveSubMenu('과제 관리')}
                  >
                    ⊙ 과제 관리 <span className="n-badge">N</span> <span className="badge">2</span>
                  </div>
                  <div 
                    className={`nav-sub-item ${activeSubMenu === '채점 관리' ? 'active' : ''}`}
                    onClick={() => setActiveSubMenu('채점 관리')}
                  >
                    ⊙ 채점 관리
                  </div>
                </div>
              )}
              <div className={`nav-item ${activeMenu === '게시판' ? 'active' : ''}`} onClick={() => setActiveMenu('게시판')}>
                 📋 게시판 <span className="n-badge" style={{ marginLeft: 'auto', background: 'var(--success)' }}>N</span>
              </div>
            </>
          ) : (
            <>
              <div 
                style={{ padding: '0.5rem 1.5rem', fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem' }}
                onClick={() => setIsSettingsMode(false)}
              >
                ← 서비스로 돌아가기
              </div>
              <div className={`nav-item ${activeSettingsMenu === '내 정보' ? 'active' : ''}`} onClick={() => setActiveSettingsMenu('내 정보')}>
                 👤 내 정보
              </div>
              <div className={`nav-item ${activeSettingsMenu === '고객센터' ? 'active' : ''}`} onClick={() => setActiveSettingsMenu('고객센터')}>
                 🎧 고객센터
              </div>
              <div className={`nav-item ${activeSettingsMenu === '환경설정' ? 'active' : ''}`} onClick={() => setActiveSettingsMenu('환경설정')}>
                 ⚙️ 환경설정
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <a href="#" className="footer-link">교사 이용 가이드 <span>›</span></a>
          <a href="#" className="footer-link">학생 이용 가이드 <span>›</span></a>
          <a href="#" className="footer-link">개인정보수집 이용 동의서<span>›</span></a>
        </div>
      </aside>

      {/* --- 메인 콘텐츠 영역 --- */}
      <main className="main-wrapper">
        {isSettingsMode ? (
          <div className="settings-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <header className="content-header" style={{ marginBottom: '2rem' }}>
              <div className="page-title">{activeSettingsMenu}</div>
            </header>

            {activeSettingsMenu === '환경설정' && (
              <div className="settings-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                
                {/* 1. AiGLE Connect 다운로드 */}
                <section className="settings-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>📦</div>
                  <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.5rem' }}>AiGLE Connect 관리</h3>
                  <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1.5rem', flex: 1 }}>자동 전송 및 크래들 연결을 위한 전용 소프트웨어의 버전을 관리합니다.</p>
                  
                  <div style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--neo-font-size-base)' }}>현재 버전: <span style={{ color: '#4E5968' }}>2.0.5</span></div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1' }}>최신 버전: <span style={{ color: 'var(--primary)', fontWeight: 700 }}>2.1.0</span></div>
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '0.8rem' }}>최신 버전 다운로드</button>
                </section>

                {/* 2. 펌웨어 업데이트 */}
                <section className="settings-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🔌</div>
                  <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.5rem' }}>펜 펌웨어 업데이트</h3>
                  <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1.5rem', flex: 1 }}>연결된 펜들의 펌웨어 상태를 확인하고 최신 버전으로 업데이트합니다.</p>
                  
                  <div style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--neo-font-size-base)' }}>연결된 펜: <span style={{ color: 'var(--primary)' }}>{settingsPenData.length}개</span></div>
                    {settingsPenData.some(p => p.needsUpdate) && <span style={{ fontSize: 'var(--neo-font-size-xs)', background: '#FFF1F2', color: '#FF4D4D', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>업데이트 필요</span>}
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#4E5968' }} onClick={() => setIsFirmwareModalOpen(true)}>펜 목록 및 업데이트 확인</button>
                </section>

                {/* 3. 초기화 버튼 */}
                <section className="settings-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', border: '1.5px solid #FFEBEE' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠️</div>
                  <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.5rem', color: '#991B1B' }}>펜 데이터 초기화</h3>
                  <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '1.5rem', flex: 1 }}>모든 펜의 데이터를 즉시 삭제하고 설정을 초기 상태로 되돌립니다.</p>
                  
                  <div style={{ background: '#FFF1F2', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#991B1B', fontWeight: 600 }}>* 초기화 시 데이터 복구가 불가능합니다.</div>
                  </div>
                  <button 
                    className="btn-primary" 
                    style={{ width: '100%', padding: '0.8rem', background: '#EF4444' }}
                    onClick={() => setIsResetModalOpen(true)}
                  >
                    연결된 펜 전체 초기화
                  </button>
                </section>

              </div>
            )}

            {/* [MY-01 v1.0] 내 정보 화면 — 교사유형별 계약 일자/기간 분기 노출 */}
            {activeSettingsMenu === '내 정보' && (() => {
              // mock 사용자 정보 (운영 시 GET /api/teachers/me 응답으로 대체)
              const myInfo = {
                name: '홍길동',
                id: 'tch20261g3u',
                email: 'hong@korea.kr',
                school: '공주고등학교',
                tier: 'paid',                  // 'free' | 'paid'
                createdAt: '2026.04.10',       // 회원가입 신청 시점 — 무료회원 표기용
                contractAt: '2026.03.15',      // 학교 계약일 (시스템 관리자 승인 시점) — 학교유료회원 표기용
              };
              // 학교 계약 종료일 산출: contract_at + 1년 (정확히 1년 후 동일 날짜 전날)
              const contractEnd = (() => {
                if (!myInfo.contractAt) return null;
                const [y, m, d] = myInfo.contractAt.split('.').map(Number);
                const end = new Date(y + 1, m - 1, d - 1); // 1년 - 1일
                const ey = end.getFullYear();
                const em = String(end.getMonth() + 1).padStart(2, '0');
                const ed = String(end.getDate()).padStart(2, '0');
                return `${ey}.${em}.${ed}`;
              })();
              const contractLabel = myInfo.tier === 'paid'
                ? `${myInfo.contractAt} ~ ${contractEnd} (1년 계약)`
                : `${myInfo.createdAt} 가입 (trial)`;
              const tierLabel = myInfo.tier === 'paid' ? '교사 (학교유료회원)' : '교사 (무료회원)';
              const infoRows = [
                { label: '이름', value: myInfo.name },
                { label: '아이디', value: myInfo.id },
                { label: '이메일', value: myInfo.email },
                { label: '학교명', value: myInfo.school },
                { label: '교사유형', value: tierLabel },
                { label: '계약 일자', value: contractLabel, isContract: true },
              ];
              return (
                <div style={{ maxWidth: '720px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ textAlign: 'center', fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, marginBottom: '1.5rem' }}>내 정보</h2>

                  {/* 정보 박스 (read-only 6행) */}
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                    {infoRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', padding: '0.5rem 0', borderBottom: i < infoRows.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                        <span style={{ minWidth: '70px', fontWeight: 700, color: '#2A75F3', fontSize: 'var(--neo-font-size-sm)' }}>{row.label}</span>
                        <span style={{ flex: 1, color: '#1E2225', fontSize: 'var(--neo-font-size-base)', fontWeight: row.isContract ? 700 : 500 }}>
                          {row.isContract && myInfo.tier === 'paid' && <span style={{ marginRight: '6px' }}>💎</span>}
                          {row.isContract && myInfo.tier === 'free' && <span style={{ marginRight: '6px' }}>🆓</span>}
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 비밀번호 변경 */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: 'var(--neo-font-size-base)' }}>비밀번호</label>
                    <input type="password" defaultValue="abcd" placeholder="영어로 시작하는 8~30자리, 대소문자·숫자·특수문자 조합" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 'var(--neo-font-size-base)' }} />
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginTop: '0.4rem' }}>영어로 시작하는 8~30자리로 대소문자, 숫자, 특수문자 조합</div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: 'var(--neo-font-size-base)' }}>비밀번호 확인</label>
                    <input type="password" defaultValue="abcd" style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: 'var(--neo-font-size-base)' }} />
                  </div>

                  {/* 약관 동의 */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: 'var(--neo-font-size-base)' }}>약관 동의</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--neo-font-size-sm)' }}>
                        <input type="checkbox" defaultChecked />
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>(필수)</span> 이용약관에 동의합니다. <span style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-sm)' }}>(26.01.01)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--neo-font-size-sm)' }}>
                        <input type="checkbox" defaultChecked />
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>(필수)</span> 개인정보 수집 및 이용에 동의합니다. <span style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-sm)' }}>(26.01.01)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--neo-font-size-sm)', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="checkbox" />
                          <span style={{ color: '#8A94A1' }}>(선택)</span> 이벤트, 서비스 안내수신에 동의합니다.
                        </div>
                        <span style={{ color: '#8A94A1' }}>›</span>
                      </label>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button style={{ flex: 1, padding: '0.85rem', background: '#E5E7EB', color: '#1E2225', border: 'none', borderRadius: '10px', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer' }}>취소</button>
                    <button style={{ flex: 1, padding: '0.85rem', background: '#2A75F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer' }}>수정완료</button>
                  </div>

                  {/* 회원 탈퇴 안내 박스 */}
                  <div style={{ background: '#9CA3AF', color: 'white', padding: '1.25rem', borderRadius: '12px' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.4rem', fontSize: 'var(--neo-font-size-base)' }}>💡 회원 탈퇴 문의</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', marginBottom: '0.6rem' }}>회원 탈퇴 문의는 고객센터로 문의 주시면 처리 가능합니다.</div>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveSettingsMenu('고객센터'); }} style={{ color: 'white', textDecoration: 'underline', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>고객센터 바로가기 ›</a>
                  </div>
                </div>
              );
            })()}

            {activeSettingsMenu !== '환경설정' && activeSettingsMenu !== '내 정보' && (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#8A94A1' }}>
                <h3>{activeSettingsMenu} 페이지를 준비 중입니다.</h3>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeSubMenu === '채점 관리' ? (
              <>
                <header className="content-header">
                  <div className="page-title">채점 관리</div>
                </header>

                <div className="content-body">
                  {/* --- 과제 선택 사이드바 --- */}
                  <aside className="sub-sidebar">
                    <div className="sub-sidebar-header">
                      <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, marginBottom: '0.75rem', color: '#1E2225' }}>과제 선택</div>
                      <div className="search-box">
                        <input type="text" placeholder="과제명 / 교과 검색" />
                        <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
                      </div>
                    </div>
                    <div className="task-list">
                      {tasks.map(task => (
                        <div 
                          key={task.id} 
                          className={`task-item ${selectedTask === task.id ? 'active' : ''}`}
                          onClick={() => setSelectedTask(task.id)}
                        >
                          <span className="tag">[{task.type}]</span>
                          <span className="title">{task.title}</span>
                          <div className="meta">
                            <span>{task.date}</span>
                            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>제출 {task.submissions}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  {/* --- 상세 채점 관리 영역 --- */}
                  <section className="detail-view">
                    <div className="task-info-banner" style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '1.5rem' }}>
                      <div className="info-left">
                        <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800 }}>[{currentTask.type}] {currentTask.title}</h2>
                        <div className="stats-summary" style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1' }}>
                          배포일: {currentTask.date} ∙ 1개 그룹 ∙ {students.length}명
                          <button className="btn-card-detail" style={{ width: 'auto', height: 'auto', padding: '2px 8px', marginLeft: '10px', fontSize: 'var(--neo-font-size-xs)', borderRadius: '4px' }}>과제 상세보기 &gt;</button>
                        </div>
                      </div>
                      <div className="info-right">
                         <div className="stat-item" style={{ color: '#4E5968' }}>제출률 <span className="stat-value" style={{ color: 'var(--primary)', fontWeight: 800 }}>0%</span></div>
                         <div className="stat-item" style={{ color: '#4E5968' }}>완료율 <span className="stat-value" style={{ color: 'var(--primary)', fontWeight: 800 }}>100%</span></div>
                         <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 'var(--neo-font-size-base)' }}>채점 결과 내보내기</button>
                      </div>
                    </div>

                    <div className="control-bar">
                      <div className="tabs">
                        {['전체', '미채점', '채점 확인', '결과 발송'].map(tab => (
                          <div 
                            key={tab} 
                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                          >
                            {getTabLabel(tab)}
                          </div>
                        ))}
                      </div>
                      <div className="view-controls">
                        {activeTab === '미채점' && (
                          <label className="select-all-wrapper">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.length > 0 && selectedIds.length === students.filter(s => s.status === '미채점').length}
                              onChange={toggleAll}
                            />
                            전체 선택
                          </label>
                        )}
                        <div className="btn-icon">🖿</div>
                        <div className="btn-icon">☰</div>
                        <select 
                          className="select-box"
                          value={selectedGroup}
                          onChange={(e) => setSelectedGroup(e.target.value)}
                        >
                          <option>그룹 선택</option>
                          <option>전체 그룹</option>
                          <option>1학년 1반</option>
                          <option>1학년 2반</option>
                        </select>
                      </div>
                    </div>

                    <div className="student-grid">
                      {filteredStudents.map(student => (
                        <div key={student.id} className="student-card">
                          {activeTab === '미채점' && (
                            <input 
                              type="checkbox" 
                              className="card-checkbox" 
                              checked={selectedIds.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                            />
                          )}
                          <div className={`card-badge ${student.status === '미채점' ? 'badge-red-soft' : 'badge-blue-soft'}`}>
                            {student.status}
                          </div>
                          <div className="student-name">{student.name}</div>
                          <div className="student-meta">{student.grade}</div>
                          <div className="grading-info">
                            <div className="grading-row">
                              <span className="label">AI채점 :</span>
                              <span className="value">{student.aiGrade}</span>
                            </div>
                            <div className="grading-row">
                              <span className="label">교사채점 :</span>
                              <span className="value">
                                {student.teacherGrade !== '-' && <span className="badge-dot badge-orange"></span>}
                                {student.teacherGrade}
                              </span>
                            </div>
                          </div>
                          <button className="btn-card-detail" onClick={() => handleOpenModal(student)}>상세보기</button>
                        </div>
                      ))}
                    </div>

                    {/* 일괄 채점 버튼 */}
                    {activeTab === '미채점' && selectedIds.length > 0 && (
                      <div className="bulk-button-container">
                        <button className="btn-bulk-grading" onClick={handleBulkGrading}>
                          🖊 크래들 일괄채점 ({selectedIds.length}명)
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <TaskManagement />
            )}
          </>
        )}
      </main>

      {/* --- 모달 및 기타 컴포넌트 --- */}
      <SmartpenSyncPopup 
        isOpen={isBulkModalOpen} 
        onClose={handleCloseProcessing} 
        onComplete={() => {
          setStudents(prev => prev.map(s => {
            if (selectedIds.includes(s.id)) {
              if (s.id === 3) return s; 
              return { ...s, status: '채점 확인', aiGrade: '노력' };
            }
            return s;
          }));
          setSelectedIds([]);
        }}
      />

      <GradingDetailModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedStudent={selectedStudent}
        questions={questions}
        activeQuestion={activeQuestion}
        setActiveQuestion={setActiveQuestion}
        isScanUploadOpen={isScanUploadOpen}
        setIsScanUploadOpen={setIsScanUploadOpen}
        gradingHistory={gradingHistory}
        reflectedHistoryId={reflectedHistoryId}
        setReflectedHistoryId={setReflectedHistoryId}
        teacherFinalFeedback={teacherFinalFeedback}
        setTeacherFinalFeedback={setTeacherFinalFeedback}
      />

      <PenFirmwareModal 
        isOpen={isFirmwareModalOpen}
        onClose={() => setIsFirmwareModalOpen(false)}
        penData={settingsPenData}
      />

      <ResetConfirmModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        penCount={settingsPenData.length}
      />

      <ExitConfirmModal 
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onProceed={proceedToBackground}
      />

      {showFAB && (
        <div 
          className="grading-fab"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'white',
            borderRadius: '50px',
            padding: '1rem 2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            border: '2px solid #2A75F3'
          }}
          onClick={() => {
            setIsBulkModalOpen(true);
            setShowFAB(false);
          }}
        >
          <div className={`fab-spinner ${isGradingFinished ? 'finished' : ''}`}>
            {isGradingFinished && '✓'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)', color: '#1E2225' }}>
              {isGradingFinished ? '채점이 완료되었습니다.' : 'AI 가 채점하고 있어요.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
