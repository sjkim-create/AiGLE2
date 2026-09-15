/**
 * TaskManagement.jsx
 * 과제 관리 목록 화면 컴포넌트입니다.
 * 필터링, 검색, 과제 카드/목록 보기 토글을 포함합니다.
 */
import React, { useState, useEffect, useRef } from 'react';
import TaskRegistration from './TaskRegistration';

// 사이드바 카운트 뱃지가 동일한 소스를 참조하도록 모듈 스코프로 노출
export const BASE_TASKS = [
    /* [TSK v3.8] 테스트 과제 예시 — 배포됐지만 결과 발송·통계·공유에서 빠진다 */
    {
        id: 4,
        status: '배포됨',
        visibility: '비공유',
        isTest: true,
        lastUpdate: '2026-09-15',
        title: '크래들 채점 점검용 논술 과제',
        schoolLevel: '중학교 · 1~3학년',
        subject: '국어',
        subSubject: '공통국어1',
        questions: 2,
        points: 20,
        competencies: '비판적·창의적 사고 역량'
    },
    {
        id: 1,
        status: '배포됨',
        visibility: '비공유',
        lastUpdate: '2025-02-18',
        title: '세계 시민으로서의 역할 에세이',
        schoolLevel: '중학교 · 1~3학년',
        subject: '사회',
        subSubject: '윤리와 사상',
        questions: 4,
        points: 38,
        competencies: '의사소통 및 협업 능력 / 문제 해결력 및 의사 결정력'
    },
    {
        id: 2,
        status: '배포됨',
        visibility: '공유',
        lastUpdate: '2025-02-18',
        title: 'AI윤리에 대한 토론문 작성',
        schoolLevel: '고등학교 · 1~3학년',
        subject: '도덕',
        subSubject: '생활과 윤리',
        questions: 5,
        points: 45,
        competencies: '창의적 사고력 / 비판적 사고력 / 문제 해결력 및 의사 결정력 / 의사소통 및 협업능력 / 정보 활용 능력'
    },
    {
        id: 3,
        status: '작성중',
        visibility: '비공유',
        lastUpdate: '2025-02-18',
        title: '탄소 발자국 줄이기 실천 계획',
        schoolLevel: '초등학교 · 1~3학년',
        subject: '과학',
        subSubject: '환경과학',
        questions: 3,
        points: 35,
        competencies: '과학적 탐구 능력과 태도 / 문제 해결력'
    }
];

// onAdd 시그니처: (mode) 또는 (taskObject). taskObject는 lib/taskSchema.js 기반.
// onAddTask: wizard에서 task 객체를 직접 부모로 전달할 때 호출 (영속화용)
// onOpenDetail: 상세보기 분기 라우팅 (source에 따라 detail 컴포넌트 선택)
const TaskManagement = ({ onAdd, extraTasks = [], onAddTask, onOpenDetail, onTaskChange }) => {
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'list'
    /* [TSK v3.8] 테스트 과제의 전환·삭제 결과 — { [id]: { isTest:false } | { deleted:true } } (프로토타입 로컬 상태) */
    const [overrides, setOverrides] = useState({});
    const [confirm, setConfirm] = useState(null); // { kind: 'convert'|'delete', task }
    const applyConfirm = () => {
        if (!confirm) return;
        const { kind, task } = confirm;
        setOverrides((prev) => ({ ...prev, [task.id]: kind === 'convert' ? { isTest: false } : { deleted: true } }));
        onTaskChange?.(kind, task);
        setConfirm(null);
    };
    const [statusFilter, setStatusFilter] = useState('전체'); // '전체' | '작성중' | '배포됨'
    // [v3.5] 과제 등록 화면 진입 — 「+ 새 과제 등록」 버튼 클릭 시
    const [showRegistration, setShowRegistration] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); };

    // [v3.6] 등록 방식 선택 — 버튼 아래 슬라이딩 패널
    const [registerMenuOpen, setRegisterMenuOpen] = useState(false);
    const registerMenuRef = useRef(null);

    useEffect(() => {
      if (!registerMenuOpen) return;
      const onDocClick = (e) => {
        if (registerMenuRef.current && !registerMenuRef.current.contains(e.target)) {
          setRegisterMenuOpen(false);
        }
      };
      const onEsc = (e) => { if (e.key === 'Escape') setRegisterMenuOpen(false); };
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onEsc);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onEsc);
      };
    }, [registerMenuOpen]);

    const handleRegisterMethod = (mode) => {
      setRegisterMenuOpen(false);
      if (onAdd) onAdd(mode);
      else setShowRegistration(true);
    };

    if (showRegistration) {
      return (
        <>
          <TaskRegistration
            onBack={() => setShowRegistration(false)}
            showToast={showToast}
            onAdd={(task) => { onAddTask && onAddTask(task); }}
          />
          {toastMsg && (
            <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, zIndex: 9999, boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>
              {toastMsg}
            </div>
          )}
        </>
      );
    }

    // [TSK-11] 공유 카탈로그에서 복사된 사본을 상단에 prepend
    const allTasks = [...extraTasks, ...BASE_TASKS]
        .map((t) => ({ ...t, ...(overrides[t.id] || {}) }))
        .filter((t) => !t.deleted);

    const filteredTasks = statusFilter === '전체'
        ? allTasks
        : statusFilter === '테스트'
            ? allTasks.filter(t => t.isTest)
            : allTasks.filter(t => t.status === statusFilter);

    /* [TSK v3.8] 테스트 과제 배지 + 카드/행 액션 */
    const testBadge = (task) => task.isTest && (
        <span className="task-status-tag" title="테스트 과제 — 학생 결과 발송·통계·공유에서 제외. 언제든 삭제 가능" style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' }}>테스트</span>
    );
    const testActions = (task) => task.isTest && (
        <>
            <button className="btn-task-detail" onClick={() => setConfirm({ kind: 'convert', task })}
                style={{ background: '#2A75F3', color: 'white', border: 'none' }}>실제 과제로 전환</button>
            <button className="btn-task-detail" onClick={() => setConfirm({ kind: 'delete', task })}
                style={{ background: 'white', color: '#DC2626', border: '1px solid #FCA5A5' }}>삭제</button>
        </>
    );

    const getStatusClass = (s) => s === '배포됨' ? 'completed' : 'writing';
    const getVisibilityClass = (v) => v === '공유' ? 'public' : 'private';

    return (
        <div className="task-management-container">
            <header className="content-header">
                <div className="page-title">과제 관리</div>
            </header>
            
            <div className="task-filter-wrapper">
                <div className="task-filter-card">
                    <div className="filter-dropdowns">
                        <select className="filter-select"><option>학교급</option></select>
                        <select className="filter-select"><option>학년</option></select>
                        <select className="filter-select"><option>교과</option></select>
                        <select className="filter-select" style={{ flex: 1.5 }}><option>핵심 역량</option></select>
                        <select
                            className="filter-select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="전체">상태: 전체</option>
                            <option value="작성중">작성중</option>
                            <option value="배포됨">배포됨</option>
                            <option value="테스트">테스트 과제</option>
                        </select>
                    </div>
                    <div className="filter-search-row">
                        <div className="search-input-wrapper">
                            <input type="text" placeholder="과제명, 필수 키워드를 검색하세요." />
                            <span className="search-icon">🔍</span>
                        </div>
                        <div className="filter-stats-actions">
                            <span className="filter-count">필터 적용 <b>{filteredTasks.length}</b>건</span>
                            <button className="btn-filter-reset">↺ 필터 초기화</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="task-list-controls">
                <div className="list-sort-info">
                    <select className="sort-select">
                        <option>최신순</option>
                        <option>오래된순</option>
                    </select>
                    <span className="update-timestamp">최근 업데이트 : 2025-02-15</span>
                </div>
                <div className="list-actions-meta">
                    <span className="total-tasks">총 과제수 <b>{allTasks.length}</b></span>
                    <div className="task-view-toggle" role="group" aria-label="보기 방식 전환">
                        <button
                            className={`btn-view-toggle ${viewMode === 'card' ? 'active' : ''}`}
                            onClick={() => setViewMode('card')}
                            aria-pressed={viewMode === 'card'}
                            title="카드 보기"
                        >
                            <span className="view-icon" aria-hidden="true">▦</span>
                            <span className="view-label">카드</span>
                        </button>
                        <button
                            className={`btn-view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            aria-pressed={viewMode === 'list'}
                            title="목록 보기"
                        >
                            <span className="view-icon" aria-hidden="true">≡</span>
                            <span className="view-label">목록</span>
                        </button>
                    </div>
                    <div ref={registerMenuRef} style={{ position: 'relative' }}>
                        <button
                            className="btn-add-new-task"
                            onClick={() => setRegisterMenuOpen((o) => !o)}
                            aria-haspopup="true"
                            aria-expanded={registerMenuOpen}
                        >
                            <span className="plus">+</span> 새 과제 등록
                            <span style={{ marginLeft: '6px', fontSize: 'var(--neo-font-size-xs)', display: 'inline-block', transform: registerMenuOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.18s' }}>▾</span>
                        </button>
                        {/* 슬라이딩 패널 — 등록 방식 선택 */}
                        <div
                            role="menu"
                            aria-label="등록 방식 선택"
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                width: '420px',
                                maxWidth: '92vw',
                                background: 'white',
                                border: '1px solid #E2E8F0',
                                borderRadius: '14px',
                                boxShadow: '0 16px 40px rgba(15,23,42,0.18)',
                                zIndex: 100,
                                overflow: 'hidden',
                                opacity: registerMenuOpen ? 1 : 0,
                                transform: registerMenuOpen ? 'translateY(0)' : 'translateY(-8px)',
                                pointerEvents: registerMenuOpen ? 'auto' : 'none',
                                transition: 'opacity 0.18s ease, transform 0.18s ease',
                            }}
                        >
                            <div style={{ padding: '14px 16px 8px', borderBottom: '1px solid #F1F5F9' }}>
                                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>등록 방식 선택</div>
                                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginTop: '2px' }}>과제를 어떤 방식으로 만드시겠습니까?</div>
                            </div>
                            <div style={{ padding: '8px' }}>
                                <button
                                    role="menuitem"
                                    onClick={() => handleRegisterMethod('direct')}
                                    style={{
                                        width: '100%', textAlign: 'left',
                                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                                        padding: '12px 14px',
                                        background: 'transparent', border: '1px solid transparent',
                                        borderRadius: '10px', cursor: 'pointer',
                                        transition: 'background 0.12s, border-color 0.12s',
                                        fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>📝</span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>직접 입력</span>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: '2px', lineHeight: 1.5 }}>
                                            문제 텍스트·이미지를 시스템 내에서 직접 작성합니다.
                                        </span>
                                    </span>
                                    <span style={{ color: '#94A3B8', alignSelf: 'center' }}>›</span>
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => handleRegisterMethod('direct2')}
                                    style={{
                                        width: '100%', textAlign: 'left',
                                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                                        padding: '12px 14px',
                                        background: 'transparent', border: '1px solid transparent',
                                        borderRadius: '10px', cursor: 'pointer',
                                        transition: 'background 0.12s, border-color 0.12s',
                                        fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.borderColor = '#DDD6FE'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🧩</span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>직접 입력 2</span>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: '2px', lineHeight: 1.5 }}>
                                            탭 단계형 입력 — 문항 → 자동/자율 채점 기준 → 등급 환산까지 단계별로 작성합니다.
                                        </span>
                                    </span>
                                    <span style={{ color: '#94A3B8', alignSelf: 'center' }}>›</span>
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => handleRegisterMethod('upload')}
                                    style={{
                                        width: '100%', textAlign: 'left',
                                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                                        padding: '12px 14px',
                                        background: 'transparent', border: '1px solid transparent',
                                        borderRadius: '10px', cursor: 'pointer',
                                        transition: 'background 0.12s, border-color 0.12s',
                                        fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.borderColor = '#BBF7D0'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>📷</span>
                                    <span style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>파일 업로드</span>
                                        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: '2px', lineHeight: 1.5 }}>
                                            기존 종이 양식(PDF/이미지)을 업로드하여 그대로 학생 문답지로 사용합니다.
                                        </span>
                                    </span>
                                    <span style={{ color: '#94A3B8', alignSelf: 'center' }}>›</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="task-empty-state">
                    <div className="empty-icon" aria-hidden="true">🔍</div>
                    <p className="empty-title">검색 조건에 맞는 과제가 없습니다.</p>
                    <p className="empty-sub">필터를 조정하거나 초기화해 주세요.</p>
                    <button className="btn-filter-reset" onClick={() => setStatusFilter('전체')}>
                        ↺ 필터 초기화
                    </button>
                </div>
            ) : viewMode === 'card' ? (
                <div className="task-cards-grid">
                    {filteredTasks.map(task => (
                        <div key={task.id} className="task-card-item">
                            <div className="card-header-row">
                                <div className="status-tags">
                                    <span className={`task-status-tag ${getStatusClass(task.status)}`}>{task.status}</span>
                                    <span className={`task-status-tag ${getVisibilityClass(task.visibility)}`}>{task.visibility}</span>
                                    {testBadge(task)}
                                </div>
                                <div className="card-teacher-meta">
                                    <span className="t-date">최근 수정 : {task.lastUpdate}</span>
                                </div>
                            </div>

                            <h3 className="card-task-title">{task.title}</h3>

                            {task.copiedFromTaskId && task.originalAuthorName && (
                                <div style={{
                                    fontSize: 'var(--neo-font-size-xs)', color: '#475569',
                                    background: '#F8FAFC', padding: '4px 8px',
                                    borderRadius: '6px', border: '1px solid #F1F5F9',
                                    marginBottom: '0.5rem', display: 'inline-block',
                                }}>
                                    원작 ⓒ <strong style={{ color: '#1E2225' }}>{task.originalAuthorName}</strong>
                                    {task.originalSchool && <span style={{ color: '#94A3B8' }}> · {task.originalSchool}</span>}
                                </div>
                            )}

                            <div className="card-task-details">
                                <div className="detail-row">
                                    <div className="detail-item">
                                        <span className="d-icon">🏫</span>
                                        <span className="d-text">{task.schoolLevel}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="d-icon">📚</span>
                                        <span className="d-text">교과 : {task.subject}{task.subSubject ? ` · 과목 : ${task.subSubject}` : ''}</span>
                                    </div>
                                </div>
                                <div className="detail-row">
                                    <div className="detail-item">
                                        <span className="d-icon">📊</span>
                                        <span className="d-text">문항수 : {task.questions}개</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="d-icon">🚩</span>
                                        <span className="d-text">총 배점 : {task.points}점</span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-competency-section">
                                <div className="comp-label">핵심 역량</div>
                                <div className="comp-content">{task.competencies}</div>
                            </div>

                            <div className="card-footer-buttons" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button className="btn-task-detail" onClick={() => onOpenDetail && onOpenDetail(task)}>상세보기</button>
                                {testActions(task)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="task-list-table-wrapper">
                    <table className="task-list-table">
                        <thead>
                            <tr>
                                <th style={{ width: '160px' }}>상태</th>
                                <th>과제명</th>
                                <th style={{ width: '140px' }}>학교급</th>
                                <th style={{ width: '200px' }}>교과/과목</th>
                                <th style={{ width: '70px' }}>문항수</th>
                                <th style={{ width: '80px' }}>총 배점</th>
                                <th style={{ width: '110px' }}>최근 수정</th>
                                <th style={{ width: '120px' }}>상세보기</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map(task => (
                                <tr key={task.id} className="task-list-row">
                                    <td>
                                        <div className="status-tags">
                                            <span className={`task-status-tag ${getStatusClass(task.status)}`}>{task.status}</span>
                                            <span className={`task-status-tag ${getVisibilityClass(task.visibility)}`}>{task.visibility}</span>
                                            {testBadge(task)}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="list-task-title">{task.title}</div>
                                        {task.copiedFromTaskId && task.originalAuthorName && (
                                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', marginTop: '2px' }}>
                                                원작 ⓒ <strong style={{ color: '#1E2225' }}>{task.originalAuthorName}</strong>
                                                {task.originalSchool && <span style={{ color: '#94A3B8' }}> · {task.originalSchool}</span>}
                                            </div>
                                        )}
                                        <div className="list-task-competencies" title={task.competencies}>
                                            <span className="comp-inline-label">핵심 역량</span>
                                            <span className="comp-inline-content">{task.competencies}</span>
                                        </div>
                                    </td>
                                    <td className="list-cell-muted">{task.schoolLevel}</td>
                                    <td className="list-cell-muted">{task.subject}{task.subSubject ? ` · ${task.subSubject}` : ''}</td>
                                    <td className="list-cell-num">{task.questions}개</td>
                                    <td className="list-cell-num">{task.points}점</td>
                                    <td className="list-cell-muted">{task.lastUpdate}</td>
                                    <td>
                                        <div className="list-row-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button className="btn-task-detail" onClick={() => onOpenDetail && onOpenDetail(task)}>상세보기</button>
                                            {testActions(task)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* [TSK v3.8] 전환·삭제 확인 */}
            {confirm && (
                <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '94vw', padding: '22px 24px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)' }}>
                        {confirm.kind === 'convert' ? (
                            <>
                                <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>실제 과제로 전환할까요?</h3>
                                <p style={{ margin: '0 0 6px', fontSize: 'var(--neo-font-size-sm)', color: '#4E5968', lineHeight: 1.7 }}>
                                    <strong>{confirm.task.title}</strong><br />
                                    지금까지의 답안지·번호표·제출물·채점 결과는 그대로 유지됩니다. 전환하면 학생에게 노출되고 결과 발송이 가능해지며 통계에 포함됩니다.
                                </p>
                                <p style={{ margin: '0 0 16px', fontSize: 'var(--neo-font-size-sm)', color: '#B45309', fontWeight: 700 }}>다시 테스트 과제로 되돌릴 수 없습니다.</p>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn-task-detail" onClick={() => setConfirm(null)}>취소</button>
                                    <button className="btn-task-detail" onClick={applyConfirm} style={{ background: '#2A75F3', color: 'white', border: 'none' }}>전환</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>테스트 과제를 삭제할까요?</h3>
                                <p style={{ margin: '0 0 6px', fontSize: 'var(--neo-font-size-sm)', color: '#4E5968', lineHeight: 1.7 }}>
                                    <strong>{confirm.task.title}</strong><br />
                                    제출물·채점 결과가 함께 삭제됩니다. 학생에게 발송된 결과가 없으므로 학생 기록에는 영향이 없습니다. 이 과제의 북코드는 폐기되어 다시 쓰이지 않으며, 출력해 둔 답안지·번호표는 더 쓸 수 없습니다.
                                </p>
                                <p style={{ margin: '0 0 16px', fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1' }}>사용한 AI 토큰은 「테스트」로 사용량에 남습니다. 삭제한 과제는 30일간 휴지통에서 복구할 수 있습니다.</p>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn-task-detail" onClick={() => setConfirm(null)}>취소</button>
                                    <button className="btn-task-detail" onClick={applyConfirm} style={{ background: '#DC2626', color: 'white', border: 'none' }}>삭제</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskManagement;
