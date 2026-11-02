/**
 * Sidebar.jsx
 * 앱 메인 좌측 사이드바 컴포넌트입니다.
 * 대시보드, 학생, 과제 관리, 채점 관리, 게시판, Prompt Studio 메뉴와
 * 사용자 프로필 드롭다운, 환경설정 모드 전환 기능을 포함합니다.
 */
import React, { useState } from 'react';
import { FORM_LISTS, SIDEBAR_REGISTER_HISTORY, ANSWER_SUBS, isAnswerSub } from './registerMenu';
import { isMenuVisible, isSubVisible, firstVisibleSub, homeOf } from './lib/appVersion'; // [v2.4] 버전별 메뉴 노출

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
    onOpenIncident,          // [BRD-16 v2.8] 좌측 하단 [🚨 이용불편 접수] — 어느 화면에서나 같은 모달을 연다
    onRegister,              // [TSK-15 v1.3] 새 과제 등록 메뉴 — (mode) => 해당 등록 화면
    registrationMode = null, // 지금 열린 등록 화면 (메뉴 강조용)
    listOrigin = '과제 관리', // 등록 화면을 연 목록 (서·논술형 과제 / 정답형 과제 / 과제 관리)
    formCounts,              // { essay, answer } 형태별 과제 수
    appVersion = '2.3',      // [v2.4] 버전 트리거 — 2.4에서 빠지는 메뉴는 lib/appVersion.js REMOVED
    appRole = 'admin',       // [v2.4] 사용자 모드 — 모드별 메뉴는 lib/appVersion.js ROLES
}) => {
  const showMenu = (m) => isMenuVisible(appVersion, m, appRole);
  const showSub = (m, sub) => isSubVisible(appVersion, m, sub, appRole);
  const subFor = (m, preferred) => firstVisibleSub(appVersion, m, preferred, appRole);
  const [historyOpen, setHistoryOpen] = useState(false); // 이전 메뉴 (history) 펼침
  const onRegisterScreen = activeSubMenu === '과제 등록';
  // 같은 화면을 여는 메뉴가 둘(새 메뉴 · 이전 메뉴)일 수 있어, 마지막으로 누른 메뉴만 강조한다
  const [clicked, setClicked] = useState(null); // { key, mode }
  const activeKey = clicked && clicked.mode === registrationMode ? clicked.key : `list:${registrationMode}`;
  const regActive = (key) => onRegisterScreen && activeKey === key;
  const historyActive = onRegisterScreen && activeKey.startsWith('hist:');
  const openReg = (key, mode) => { setClicked({ key, mode }); onRegister(mode); };
  // 목록에서 등록하면 이전 메뉴 강조를 지운다
  React.useEffect(() => { if (!onRegisterScreen) setClicked(null); }, [onRegisterScreen]);
  const handleMenuChange = (menu) => {
    setActiveMenu(menu);
    if (setShowAnalysis) setShowAnalysis(false);
  };
  /* 펼침 메뉴(회원 관리 · 과제 관리 · 채점 관리 · 게시판 · 학생 모드 · 아이글 채점 테스트) — 모든 모드 공통. 펼친 메뉴를 다시 누르면 접고, 한 번 더 누르면 편다(보던 화면은 그대로).
   *   다른 메뉴를 누르면 그 메뉴가 펼쳐진 채로 열린다 */
  const [folded, setFolded] = useState(null);
  React.useEffect(() => { setFolded(null); }, [activeMenu]);
  const toggleMenu = (menu, sub) => {
    if (activeMenu === menu) { setFolded((f) => (f === menu ? null : menu)); return; }
    handleMenuChange(menu);
    setActiveSubMenu(sub);
  };
  const isOpen = (menu) => activeMenu === menu && folded !== menu;
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
                    const home = homeOf(appVersion, appRole); // [v2.4] 모드의 첫 화면
                    handleMenuChange(home.menu);
                    setActiveSubMenu(home.sub);
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
                        {showMenu('대시보드') && (
                        <div className={`nav-item ${activeMenu === '대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('대시보드')}>
                            📊 대시보드
                        </div>
                        )}
                        {showMenu('교사 대시보드') && (
                        <div className={`nav-item ${activeMenu === '교사 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('교사 대시보드')}>
                            👩‍🏫 교사 대시보드
                        </div>
                        )}
                        {showMenu('학교 대시보드') && (
                        <div className={`nav-item ${activeMenu === '학교 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('학교 대시보드')}>
                            🏫 학교 대시보드
                        </div>
                        )}
                        {showMenu('교육청 대시보드') && (
                        <div className={`nav-item ${activeMenu === '교육청 대시보드' ? 'active' : ''}`} onClick={() => handleMenuChange('교육청 대시보드')}>
                            🏛 교육청 대시보드
                        </div>
                        )}
                        {showMenu('회원 관리') && (<>
                        <div
                            className={`nav-item ${activeMenu === '회원 관리' ? 'active' : ''} ${folded === '회원 관리' ? 'folded' : ''}`}
                            aria-expanded={isOpen('회원 관리')}
                            onClick={() => toggleMenu('회원 관리', subFor('회원 관리', '교사 관리'))}
                        >
                            🛡️ 회원 관리 <span className="arrow">▼</span>
                        </div>

                        {isOpen('회원 관리') && (
                            <div className="nav-sub-menu">
                                {showSub('회원 관리', '교사 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '교사 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('교사 관리')}
                                >
                                    ⊙ 교사 관리
                                </div>
                                )}
                                {showSub('회원 관리', '교사관리(학교모드)') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '교사관리(학교모드)' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('교사관리(학교모드)')}
                                >
                                    ⊙ {appRole === 'school' ? '교사 관리' : '교사관리(학교모드)'}
                                </div>
                                )}
                                {showSub('회원 관리', '학교 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '학교 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('학교 관리')}
                                >
                                    ⊙ 학교 관리
                                </div>
                                )}
                                {showSub('회원 관리', '학생 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '학생 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('학생 관리')}
                                >
                                    ⊙ 학생 관리 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="badge">1,540</span>
                                </div>
                                )}
                                {showSub('회원 관리', '그룹 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '그룹 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('그룹 관리')}
                                >
                                    ⊙ 그룹 관리 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="badge">500</span>
                                </div>
                                )}
                            </div>
                        )}
                        </>)}
                        {/* [v4.7] 「과제 및 채점관리」 단일 메뉴 → 「과제 관리」 / 「채점 관리」 두 메뉴로 분리 */}
                        {showMenu('과제 관리') && (<>
                        <div
                            className={`nav-item ${activeMenu === '과제 관리' ? 'active' : ''} ${folded === '과제 관리' ? 'folded' : ''}`}
                            aria-expanded={isOpen('과제 관리')}
                            onClick={() => toggleMenu('과제 관리', subFor('과제 관리', '과제 관리'))}
                        >
                            📂 과제 관리 <span className="arrow">▼</span>
                        </div>

                        {isOpen('과제 관리') && (
                            <div className="nav-sub-menu">
                                {showSub('과제 관리', '과제 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '과제 관리' || (onRegisterScreen && !historyActive && !FORM_LISTS.some((f) => f.sub === listOrigin) && !isAnswerSub(listOrigin)) ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('과제 관리')}
                                >
                                    ⊙ 과제 관리 <span className="n-badge">N</span> <span className="badge">{taskCount ?? 0}</span>
                                </div>
                                )}
                                {/* [TSK-15 v1.4] 형태별 과제 목록 — 등록은 목록의 [+ 새 과제 등록]에서 직접 등록 / 스마트 등록 */}
                                {FORM_LISTS.filter((f) => showSub('과제 관리', f.sub)).map((f) => {
                                    const isAnswer = f.form === 'answer';
                                    const fromHere = onRegisterScreen && !historyActive && (isAnswer ? isAnswerSub(listOrigin) : listOrigin === f.sub);
                                    // 정답형 과제를 고르면 하위 메뉴(문항 · 문제집)가 열리고, 다른 메뉴를 고르면 닫힌다 (등록 중에는 열린 채로)
                                    const answerOpen = isAnswer && (isAnswerSub(activeSubMenu) || fromHere);
                                    // [2.4] 「정답형 과제」 제목 없이 하위 메뉴를 과제 관리 바로 아래에 (2026-10-29)
                                    if (isAnswer && appVersion === '2.4') {
                                        return ANSWER_SUBS.map((a) => (
                                            <div key={a.sub} className={`nav-sub-item ${activeSubMenu === a.sub || (fromHere && a.sub === listOrigin) ? 'active' : ''}`}
                                                onClick={() => setActiveSubMenu(a.sub)}>
                                                ⊙ {a.label}
                                            </div>
                                        ));
                                    }
                                    return (
                                        <React.Fragment key={f.sub}>
                                            <div className={`nav-sub-item ${(!isAnswer && activeSubMenu === f.sub) || fromHere ? 'active' : ''}`}
                                                onClick={() => setActiveSubMenu(f.sub)}>
                                                ⊙ {f.sub} {!isAnswer && <span className="badge">{formCounts?.essay ?? 0}</span>}{isAnswer && <span className="arrow" aria-hidden="true" style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)' }}>{answerOpen ? '▾' : '▸'}</span>}
                                            </div>
                                            {/* [TSK-15 v1.10] 정답형 과제 › 문항 · 문제집 */}
                                            {/* 정답형 과제의 하위 메뉴 — 부모(3.5rem)보다 안쪽으로 들이고 왼쪽 안내선 */}
                                            {answerOpen && (
                                                <div role="group" aria-label="정답형 과제 하위 메뉴" style={{ margin: '0 0 4px calc(3.5rem + 6px)', borderLeft: '2px solid #E2E8F0' }}>
                                                    {ANSWER_SUBS.map((a) => (
                                                        <div key={a.sub} className={`nav-sub-item ${activeSubMenu === a.sub ? 'active' : ''}`}
                                                            onClick={() => setActiveSubMenu(a.sub)}
                                                            style={{ padding: '0.5rem 1rem 0.5rem 0.9rem', fontSize: 'var(--neo-font-size-sm)', ...(activeSubMenu === a.sub ? { borderLeft: '2px solid var(--primary)', marginLeft: -2 } : {}) }}>
                                                            {a.icon} {a.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {showSub('과제 관리', '공유된 과제') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '공유된 과제' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('공유된 과제')}
                                >
                                    ⊙ 공유된 과제 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span>
                                </div>
                                )}
                                {/* [2.4] 교육청 문제 은행 — 교육청(시스템 관리자)이 등록한 과제를 골라 복제 (TSK-16) */}
                                {showSub('과제 관리', '교육청 문제 은행') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '교육청 문제 은행' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('교육청 문제 은행')}
                                >
                                    ⊙ 교육청 문제 은행
                                </div>
                                )}
                                {/* 이전 메뉴 (history) — 정리 전 등록 메뉴. 같은 화면으로 연결 */}
                                {onRegister && showSub('과제 관리', '이전 메뉴') && (
                                    <>
                                        <div className="nav-sub-item" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}
                                            style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>
                                            🕘 이전 메뉴 (history) {historyOpen ? '▴' : '▾'}
                                        </div>
                                        {historyOpen && SIDEBAR_REGISTER_HISTORY.map((m) => (
                                            <div key={m.mode} className={`nav-sub-item ${regActive(`hist:${m.mode}`) ? 'active' : ''}`} onClick={() => openReg(`hist:${m.mode}`, m.mode)}
                                                style={{ paddingLeft: 36, fontSize: 'var(--neo-font-size-xs)' }}>
                                                {m.icon} {m.label}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                        </>)}

                        {showMenu('채점 관리') && (<>
                        <div
                            className={`nav-item ${activeMenu === '채점 관리' ? 'active' : ''} ${folded === '채점 관리' ? 'folded' : ''}`}
                            aria-expanded={isOpen('채점 관리')}
                            onClick={() => toggleMenu('채점 관리', subFor('채점 관리', '채점 관리'))}
                        >
                            📝 채점 관리 <span className="arrow">▼</span>
                        </div>

                        {isOpen('채점 관리') && (
                            <div className="nav-sub-menu">
                                {showSub('채점 관리', '채점 관리') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '채점 관리' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('채점 관리')}
                                >
                                    ⊙ 채점 관리
                                </div>
                                )}
                                {/* [SCR-06] 퇴고 지원판 — 기존 채점 관리와 구분하기 위해 별도 메뉴로 노출 */}
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '채점 관리 2' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('채점 관리 2')}
                                >
                                    ⊙ 채점 관리 2 <span className="n-badge" style={{ background: '#7C3AED' }}>퇴고</span>
                                </div>
                                {/* 크래들·스캔 일괄 채점 통합 구조 시안 */}
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '일괄 채점 통합' ? 'active' : ''}`}
                                    onClick={() => { setActiveSubMenu('일괄 채점 통합'); window.dispatchEvent(new CustomEvent('aigle:submenu', { detail: '일괄 채점 통합' })); /* 이미 이 메뉴여도 목록으로 */ }}
                                >
                                    ⊙ 일괄 채점 통합 <span className="n-badge" style={{ background: '#6D28D9' }}>시안</span>
                                </div>
                            </div>
                        )}
                        </>)}
                        {/* [2.4] 교육청 문제 은행 — 시스템 관리자가 과제를 등록한다 (TSK-16) */}
                        {showMenu('교육청 문제 은행') && (
                        <div className={`nav-item ${activeMenu === '교육청 문제 은행' ? 'active' : ''}`} onClick={() => handleMenuChange('교육청 문제 은행')}>
                            🏛️ 교육청 문제 은행
                        </div>
                        )}
                        {/* [BRD-16] 게시판 — 공지사항 / 장애신고(시스템 관리자) */}
                        {showMenu('게시판') && (<>
                        <div
                            className={`nav-item ${activeMenu === '게시판' ? 'active' : ''} ${folded === '게시판' ? 'folded' : ''}`}
                            aria-expanded={isOpen('게시판')}
                            onClick={() => toggleMenu('게시판', subFor('게시판', '공지사항'))}
                        >
                            📋 게시판 <span className="n-badge" style={{ background: 'var(--success)' }}>N</span> <span className="arrow">▼</span>
                        </div>
                        {isOpen('게시판') && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu !== '장애신고' && activeSubMenu !== 'Q&A' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('공지사항')}
                                >
                                    ⊙ 공지사항
                                </div>
                                {/* Q&A — 2.3 · 2.4 공통(2.4는 모드별 허용에 따름) */}
                                {showSub('게시판', 'Q&A') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === 'Q&A' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('Q&A')}
                                >
                                    ⊙ Q&A
                                </div>
                                )}
                                {showSub('게시판', '장애신고') && (
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '장애신고' ? 'active' : ''}`}
                                    onClick={() => setActiveSubMenu('장애신고')}
                                >
                                    ⊙ {appVersion === '2.4' ? '이용불편신고' : '장애신고'} <span className="n-badge" style={{ background: '#DC2626' }}>N</span>{incidentOpenCount > 0 && <span className="badge">{incidentOpenCount}</span>}
                                </div>
                                )}
                            </div>
                        )}
                        </>)}
                        {/* [TSK-06·09·10] 학생 모드 — 학생 화면(내 과제) 미리보기 */}
                        {showMenu('학생 모드') && (<>
                        <div
                            className={`nav-item ${activeMenu === '학생 모드' ? 'active' : ''} ${folded === '학생 모드' ? 'folded' : ''}`}
                            aria-expanded={isOpen('학생 모드')}
                            onClick={() => toggleMenu('학생 모드', '내 과제')}
                        >
                            🎒 학생 모드 <span className="arrow">▼</span>
                        </div>
                        {isOpen('학생 모드') && (
                            <div className="nav-sub-menu">
                                <div
                                    className={`nav-sub-item ${activeSubMenu === '내 과제' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveSubMenu('내 과제');
                                        // [TSK-10 v1.16] 과제 상세를 보고 있어도 「내 과제」를 누르면 목록으로
                                        window.dispatchEvent(new CustomEvent('aigle:student-tasks-list'));
                                    }}
                                >
                                    ⊙ 내 과제
                                </div>
                            </div>
                        )}
                        </>)}
                        {showMenu('스마트펜 모니터링') && (
                        <div className={`nav-item ${activeMenu === '스마트펜 모니터링' ? 'active' : ''}`} onClick={() => handleMenuChange('스마트펜 모니터링')}>
                            📡 스마트펜 모니터링
                        </div>
                        )}
                        {showMenu('화면 명세서') && (
                        <div className={`nav-item ${activeMenu === '화면 명세서' ? 'active' : ''}`} onClick={() => handleMenuChange('화면 명세서')}>
                            🗂️ 화면 명세서
                        </div>
                        )}
                        {/* [v3.57] AI 채점 PoC 메뉴 삭제 — 「아이글 채점 테스트」로 통합됨 */}
                        {/* [v2.85] 메뉴 「Prompt Studio」 폐기 → 「아이글 채점 테스트」로 대체. 서브: 아이글 채점 테스트 + 아이글 채점 테스트 아카이브 */}
                        {showMenu('아이글 채점 테스트') && (<>
                        <div
                            className={`nav-item ${activeMenu === '아이글 채점 테스트' ? 'active' : ''} ${folded === '아이글 채점 테스트' ? 'folded' : ''}`}
                            aria-expanded={isOpen('아이글 채점 테스트')}
                            onClick={() => toggleMenu('아이글 채점 테스트', '아이글 채점 테스트')}
                        >
                            ⚗️ 아이글 채점 테스트 <span className="arrow">▼</span>
                        </div>

                        {isOpen('아이글 채점 테스트') && (
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
                        </>)}
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
