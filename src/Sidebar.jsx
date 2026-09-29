/**
 * Sidebar.jsx
 * 앱 메인 좌측 사이드바 컴포넌트입니다.
 * 대시보드, 학생, 과제 관리, 채점 관리, 게시판, Prompt Studio 메뉴와
 * 사용자 프로필 드롭다운, 환경설정 모드 전환 기능을 포함합니다.
 */
import React from 'react';

const Sidebar = ({
    activeMenu,
    setActiveMenu,
    activeSubMenu,
    setActiveSubMenu,
    isSettingsMode,
    setIsSettingsMode,
    activeSettingsMenu,
    setActiveSettingsMenu,
    isProfileDropdownOpen,
    setIsProfileDropdownOpen,
    setShowAnalysis,
    taskCount,
    settingsBadgeCount = 0,  // [v4.6] 환경설정 「설정 필요」 배지 카운트 (0이면 미노출)
    incidentOpenCount = 0,   // [BRD-16] 장애신고 미처리 건수 (메일 발송 전)
    onOpenIncident           // [BRD-16 v2.8] 좌측 하단 [🚨 이용불편 접수] — 어느 화면에서나 같은 모달을 연다
}) => {
  const handleMenuChange = (menu) => {
    setActiveMenu(menu);
    if (setShowAnalysis) setShowAnalysis(false);
  };
  /* [상용 헤더 정렬] 舊 renderSetupBadge — 「설정 필요」 배지는 상단 ⚙️ 아이콘의 빨간 점으로 옮겼다 */

    return (
        <aside className="main-sidebar">
            {/* [v4.7] AiGLE 로고 — 프로필 위. 어느 화면(환경설정 포함)에서든 누르면 메인(대시보드)으로 돌아간다.
                v2.86에서 숨겼던 것을 되살림: 환경설정 모드에서 서비스로 돌아갈 길이 없었다. */}
            <div
                className="logo-container"
                role="button"
                title="메인으로"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', padding: '0.25rem 0 0.75rem' }}
                onClick={() => {
                    setIsSettingsMode(false);
                    setIsProfileDropdownOpen(false);
                    handleMenuChange('대시보드');
                }}
            >
                <img src="/images/logo.svg" alt="AiGLE" style={{ height: '30px' }} />
            </div>

            {/* [상용 헤더 정렬] 교사 프로필 블록은 **상단 우측**(AppTopBar)으로 옮겼다.
                사이드바는 「무엇을 하는가」(메뉴)만 담고, 「누구인가」(계정)는 헤더가 맡는다.
                환경설정·로그아웃도 함께 옮겨 갔다 — 여기서 열던 드롭다운은 없다. */}

            <nav className="nav-menu">
                {!isSettingsMode ? (
                    <>
                        <div className={`nav-item ${activeMenu === '대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('대시보드')}>
                            📊 대시보드
                        </div>
                        <div className={`nav-item ${activeMenu === '교사 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('교사 대시보드')}>
                            👩‍🏫 교사 대시보드
                        </div>
                        <div className={`nav-item ${activeMenu === '학교 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('학교 대시보드')}>
                            🏫 학교 대시보드
                        </div>
                        <div className={`nav-item ${activeMenu === '교육청 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('교육청 대시보드')}>
                            🏛 교육청 대시보드
                        </div>
                        <div
                            className={`nav-item ${activeMenu === '회원 관리' ? 'active' : ''}`}
                            onClick={() => {
                                handleMenuChange('회원 관리');
                                if (activeMenu !== '회원 관리') setActiveSubMenu('교사 관리');
                            }}
                        >
                            🛡️ 회원 관리 <span className="arrow">▼</span>
                        </div>

                        {activeMenu === '회원 관리' && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '교사 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('교사 관리')}
                                >
                                    ⊙ 교사 관리
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '교사관리(학교모드)' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('교사관리(학교모드)')}
                                >
                                    ⊙ 교사관리(학교모드)
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '학교 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('학교 관리')}
                                >
                                    ⊙ 학교 관리
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '학생 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('학생 관리')}
                                >
                                    ⊙ 학생 관리 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="badge">1,540</span>
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '그룹 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('그룹 관리')}
                                >
                                    ⊙ 그룹 관리 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="badge">500</span>
                                </div>
                            </div>
                        )}
                        {/* [v4.7] 「과제 및 채점관리」 단일 메뉴 → 「과제 관리」 / 「채점 관리」 두 메뉴로 분리 */}
                        <div
                            className={`nav-item ${activeMenu === '과제 관리' ? 'active' : ''}`}
                            onClick={() => {
                                handleMenuChange('과제 관리');
                                if (activeMenu !== '과제 관리') setActiveSubMenu('과제 관리');
                            }}
                        >
                            📂 과제 관리 <span className="arrow">▼</span>
                        </div>

                        {activeMenu === '과제 관리' && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '과제 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('과제 관리')}
                                >
                                    ⊙ 과제 관리 <span className="n-badge">N</span> <span className="badge">{taskCount ?? 0}</span>
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '공유된 과제' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('공유된 과제')}
                                >
                                    ⊙ 공유된 과제 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span>
                                </div>
                            </div>
                        )}

                        <div
                            className={`nav-item ${activeMenu === '채점 관리' ? 'active' : ''}`}
                            onClick={() => {
                                handleMenuChange('채점 관리');
                                if (activeMenu !== '채점 관리') setActiveSubMenu('채점 관리');
                            }}
                        >
                            📝 채점 관리 <span className="arrow">▼</span>
                        </div>

                        {activeMenu === '채점 관리' && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '채점 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('채점 관리')}
                                >
                                    ⊙ 채점 관리
                                </div>
                                {/* [SCR-06] 퇴고 지원판 — 기존 채점 관리와 구분하기 위해 별도 메뉴로 노출 */}
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '채점 관리 2' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('채점 관리 2')}
                                >
                                    ⊙ 채점 관리 2 <span className="n-badge" style={{ background: '#7C3AED' }}>퇴고</span>
                                </div>
                            </div>
                        )}
                        {/* [BRD-16] 게시판 — 공지사항 / 장애신고(시스템 관리자) */}
                        <div
                            className={`nav-item ${activeMenu === '게시판' ? 'active' : ''}`}
                            onClick={() => {
                                handleMenuChange('게시판');
                                if (activeMenu !== '게시판') setActiveSubMenu('공지사항');
                            }}
                        >
                            📋 게시판 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="arrow">▼</span>
                        </div>
                        {activeMenu === '게시판' && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu !== '장애신고' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('공지사항')}
                                >
                                    ⊙ 공지사항
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '장애신고' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('장애신고')}
                                >
                                    ⊙ 장애신고 <span className="n-badge" style={{ background: '#DC2626' }}>N</span>{incidentOpenCount > 0 && <span className="badge">{incidentOpenCount}</span>}
                                </div>
                            </div>
                        )}
                        <div className={`nav-item ${activeMenu === '스마트펜 모니터링' ? 'active' : ''}`} onClick={() => handleMenuChange('스마트펜 모니터링')}>
                            📡 스마트펜 모니터링
                        </div>
                        <div className={`nav-item ${activeMenu === '화면 명세서' ? 'active' : ''}`} onClick={() => handleMenuChange('화면 명세서')}>
                            🗂️ 화면 명세서
                        </div>
                        {/* [v3.57] AI 채점 PoC 메뉴 삭제 — 「아이글 채점 테스트」로 통합됨 */}
                        {/* [v2.85] 메뉴 「Prompt Studio」 폐기 → 「아이글 채점 테스트」로 대체. 서브: 아이글 채점 테스트 + 아이글 채점 테스트 아카이브 */}
                        <div
                            className={`nav-item ${activeMenu === '아이글 채점 테스트' ? 'active' : ''}`}
                            onClick={() => {
                                handleMenuChange('아이글 채점 테스트');
                                if (activeMenu !== '아이글 채점 테스트') setActiveSubMenu('아이글 채점 테스트');
                            }}
                        >
                            ⚗️ 아이글 채점 테스트 <span className="arrow">▼</span>
                        </div>

                        {activeMenu === '아이글 채점 테스트' && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '아이글 채점 테스트' ? 'active' : ''}`}
                                    onClick={() => { setActiveSubMenu('아이글 채점 테스트'); if (setShowAnalysis) setShowAnalysis(false); }}
                                >
                                    ⊙ 아이글 채점 테스트
                                </div>
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '아이글 채점 테스트 아카이브' ? 'active' : ''}`}
                                    onClick={() => { setActiveSubMenu('아이글 채점 테스트 아카이브'); if (setShowAnalysis) setShowAnalysis(false); }}
                                >
                                    ⊙ 아이글 채점 테스트 아카이브
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
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
                {/* [POP-41] 이용불편 접수 — 舊 환경설정 카드 안 버튼을 여기로 옮겼다.
                    불편은 환경설정에서 생기지 않는다. 어느 화면에서 막히든 눈에 보이는 자리에 있어야 한다. */}
                {onOpenIncident && (
                    <button type="button" onClick={onOpenIncident}
                        title="화면에서 겪은 불편을 접수합니다. 진단 로그와 펜 원본 진단 파일이 함께 전달됩니다."
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: '0.5rem',
                            padding: '9px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2',
                            color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        🚨 이용불편 접수
                    </button>
                )}
                {/* [상용 헤더 정렬] 이용 가이드·동의서 링크는 상단 ❓ 메뉴로 옮겼다 */}
            </div>
        </aside>
    );
};

export default Sidebar;
