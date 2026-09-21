/**
 * UngradedDetailModal.jsx (SCR-02)
 * 미채점 상세 화면 — 펜 동기화 전/후, AI 채점 시작
 * STEP 1. 답안 확인
 */
import React, { useState, useEffect } from 'react';
import ExitConfirmModal from './ExitConfirmModal';

const UngradedDetailModal = ({
    isOpen,
    onClose,
    selectedStudent,
    onSelectStudent,
    students = [],
    questions,
    activeQuestion,
    setActiveQuestion,
    isScanUploadOpen,
    setIsScanUploadOpen,
    onStartGrading,
    onBackgroundGrading,
    bgGradingActive = false
}) => {
    const [penSyncState, setPenSyncState] = useState('before'); // 'before' | 'syncing' | 'synced'
    const [aiGradingState, setAiGradingState] = useState('idle'); // 'idle' | 'processing'
    const [currentPage, setCurrentPage] = useState(1);
    const [isPlaybackMode, setIsPlaybackMode] = useState(false); // 필기 재생 모드 토글
    const [isPlaying, setIsPlaying] = useState(false);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    const totalPages = 2;

    const isProcessing = aiGradingState === 'processing';

    // 학생 네비게이션
    const currentIndex = students.findIndex(s => s.id === selectedStudent?.id);
    const handlePrev = () => {
        if (isProcessing) return;
        if (currentIndex > 0) onSelectStudent(students[currentIndex - 1]);
    };
    const handleNext = () => {
        if (isProcessing) return;
        if (currentIndex < students.length - 1) onSelectStudent(students[currentIndex + 1]);
    };

    // 펜 데이터 동기화
    const handlePenSync = () => {
        setPenSyncState('syncing');
        setTimeout(() => setPenSyncState('synced'), 1500);
    };

    // AI 채점 시작
    const handleStartAI = () => {
        if (bgGradingActive) return;
        setAiGradingState('processing');
        if (onStartGrading) {
            onStartGrading(selectedStudent);
        }
    };

    // 모달 닫기 시도 — 진행 중이면 백그라운드 진행 확인 다이얼로그
    const handleAttemptClose = () => {
        if (isProcessing) {
            setCloseConfirmOpen(true);
            return;
        }
        onClose();
    };

    // 백그라운드 진행 선택 (ExitConfirmModal의 [닫기])
    const handleProceedBackground = () => {
        setCloseConfirmOpen(false);
        if (onBackgroundGrading) {
            onBackgroundGrading(selectedStudent);
        } else {
            onClose();
        }
    };

    // 진행 중 페이지 이탈 차단 + ESC 처리
    useEffect(() => {
        if (!isOpen || !isProcessing) return;
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '페이지를 벗어나면 채점 결과를 잃을 수 있습니다. 정말 이동하시겠습니까?';
            return e.returnValue;
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setCloseConfirmOpen(true);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, isProcessing]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={() => { if (!isProcessing) handleAttemptClose(); }}
        >
            <div className="modal-container grading-detail-modal" onClick={e => e.stopPropagation()}>
                <button className="btn-modal-close" onClick={handleAttemptClose}>×</button>

                {/* 상단 배너 */}
                <div className="step-banner">
                    <strong>STEP 1. 답안 확인</strong>&nbsp;&nbsp;답안을 확인 하고 AI 채점을 진행하세요.
                </div>

                {/* 메인 컨텐츠 */}
                <div className="modal-content">
                    <div className="grading-layout">
                        {/* === 좌측: 문항 & 펜 캡처 === */}
                        <div className="submission-area" style={{ background: 'white' }}>
                            {/* 학생 이름 + 펜 동기화 */}
                            <div className="modal-header-info" style={{ padding: '0 0 1.5rem 0' }}>
                                <div className="modal-student-name">
                                    {selectedStudent?.name}
                                    <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#8A94A1', marginLeft: '0.5rem', fontWeight: 400 }}>
                                        {selectedStudent?.grade}
                                    </span>
                                    {/* [SCR-06] 퇴고 답안 채점 중임을 표시 — 채점 절차는 1차와 동일하고 구분 표시만 다르다.
                                        1차 답안이 아니라 재배부한 2차 답안지를 채점 중이라는 사실이 이 화면에서 보여야 한다. */}
                                    {(selectedStudent?.round ?? 1) >= 2 && (
                                        <span
                                            title={`퇴고(2차) 답안 · 답안지 번호표 ${selectedStudent?.sheetNo || '-'} · 1차 교사 채점 ${(selectedStudent?.history || []).find(h => h.round === 1)?.teacherGrade || '-'}`}
                                            style={{
                                                marginLeft: 8, verticalAlign: 'middle',
                                                background: '#F5F3FF', color: '#7C3AED',
                                                border: '1px solid #DDD6FE', borderRadius: 999,
                                                padding: '3px 10px', fontWeight: 800,
                                                fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap',
                                            }}
                                        >
                                            ✍ 2차 (퇴고)
                                        </span>
                                    )}
                                </div>
                                <button
                                    className={`btn-sync ${penSyncState === 'synced' ? 'synced' : ''}`}
                                    onClick={handlePenSync}
                                    disabled={penSyncState === 'syncing'}
                                >
                                    <span className={`dot ${penSyncState === 'synced' ? 'green' : ''}`}></span>
                                    펜 데이터 동기화
                                    {penSyncState === 'synced' && <span style={{ marginLeft: '4px' }}>✅</span>}
                                </button>
                            </div>

                            {/* 문항 탭 */}
                            <div className="modal-question-tabs" style={{ padding: '0 0 1.5rem 0' }}>
                                {questions.map(q => (
                                    <div
                                        key={q.id}
                                        className={`q-tab ${activeQuestion === q.id ? 'active' : ''}`}
                                        onClick={() => setActiveQuestion(q.id)}
                                    >
                                        문항 {q.id} ({q.score || q.id * 10}점)
                                    </div>
                                ))}
                            </div>

                            {/* 펜 캡처 원본 */}
                            <div className="submission-label">펜 캡처 원본</div>
                            <div className="pen-canvas-box" style={{ flex: 1, height: 'auto', position: 'relative' }}>
                                <div className="pen-toolbar">
                                    <div className="toolbar-btn">+</div>
                                    <div className="toolbar-btn">-</div>
                                    <div className="toolbar-btn">⤢</div>
                                    <button
                                        className="toolbar-btn btn-playback"
                                        onClick={() => {
                                            if (penSyncState !== 'synced') return;
                                            setIsPlaybackMode(v => !v);
                                            setIsPlaying(false);
                                        }}
                                        disabled={penSyncState !== 'synced'}
                                    >
                                        {isPlaybackMode ? '이미지 보기' : '▶ 필기 재생'}
                                    </button>
                                </div>
                                <div className="page-indicator">{currentPage}/{totalPages}</div>

                                {/* 좌우 페이지 화살표 */}
                                <button
                                    className="page-arrow page-arrow-left"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                >
                                    ◁
                                </button>
                                <button
                                    className="page-arrow page-arrow-right"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    ▷
                                </button>

                                {/* 캡처 내용 */}
                                <div style={{ padding: '4rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    {penSyncState === 'synced' ? (
                                        isPlaybackMode ? (
                                            <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
                                                <img
                                                    src="/assets/images/sample_paper.png"
                                                    alt="Playback"
                                                    style={{ width: '100%', border: '1px solid #eee', background: '#FAFBFC', opacity: isPlaying ? 1 : 0.4 }}
                                                />
                                                {!isPlaying && (
                                                    <button
                                                        onClick={() => {
                                                            setIsPlaying(true);
                                                            setTimeout(() => setIsPlaying(false), 3000);
                                                        }}
                                                        style={{
                                                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                                            width: '72px', height: '72px', borderRadius: '50%',
                                                            background: 'rgba(42, 117, 243, 0.95)', color: 'white',
                                                            border: 'none', fontSize: '1.8rem', cursor: 'pointer',
                                                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                                                        }}
                                                    >▶</button>
                                                )}
                                                {isPlaying && (
                                                    <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 16px', borderRadius: '16px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                                                        ⏸ 재생 중...
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <img src="/assets/images/sample_paper.png" alt="Pen Data" style={{ maxWidth: '100%', border: '1px solid #eee' }} />
                                        )
                                    ) : (
                                        <>
                                            <img src="/assets/images/sample_paper.png" alt="Scan Area" style={{ maxWidth: '100%', border: '1px solid #eee', opacity: 0.3, marginBottom: '1rem' }} />
                                            <p style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-base)', fontWeight: 600 }}>
                                                {penSyncState === 'syncing' ? '펜 데이터를 동기화하는 중입니다...' : '학생의 펜 데이터를 호출하는 중입니다...'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* === 우측: 채점 결과 === */}
                        <div className="grading-sidebar">
                            <div className="grading-section">
                                <div className="section-title">채점 결과</div>
                                <div className="grading-result-box">
                                    <div className="status-row">
                                        <div className="status-item">
                                            <span className="label">AI 채점 :</span>
                                            <span className="value">미채점</span>
                                        </div>
                                        <div className="status-item">
                                            <span className="label">교사 채점 :</span>
                                            <span className="value">미채점</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 스캔 업로드 아코디언 */}
                                <div className="scan-upload-container" style={{ marginTop: '1.5rem', border: 'none' }}>
                                    <div
                                        className="scan-upload-header"
                                        onClick={() => setIsScanUploadOpen(!isScanUploadOpen)}
                                        style={{ padding: '0.5rem 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div>
                                            <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                                                🚨 <span style={{ color: '#2A75F3', fontWeight: 800 }}>스캔 업로드</span>
                                            </span>
                                            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginLeft: '0.5rem' }}>
                                                펜 데이터가 유실되었을 때, 스캔한 답안지를 업로드하여 채점을 하세요.
                                            </span>
                                        </div>
                                        <span style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-xl)', cursor: 'pointer' }}>›</span>
                                    </div>
                                    {isScanUploadOpen && (
                                        <div className="scan-upload-body" style={{ padding: '0.75rem 0 0 0' }}>
                                            <div className="upload-dropzone">
                                                <button className="btn-file-select" style={{ padding: '0.5rem 1rem' }}>↑ 파일 선택</button>
                                                <span className="dropzone-text" style={{ fontSize: 'var(--neo-font-size-sm)' }}>파일을 이곳에 업로드하세요.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 하단 푸터 */}
                <footer className="modal-footer">
                    <div className="footer-left">
                        <button
                            className="btn-invalid-text"
                            onClick={() => {
                                if (isProcessing) return;
                                if (window.confirm('이 학생의 제출을 무효 처리하시겠습니까?')) onClose();
                            }}
                            disabled={isProcessing}
                            style={isProcessing ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                            title={isProcessing ? 'AI 등급평가 진행 중에는 무효 처리할 수 없습니다.' : undefined}
                        >
                            무효처리
                        </button>
                    </div>
                    <div className="footer-btn-group">
                        <button
                            className="btn-nav"
                            onClick={handlePrev}
                            disabled={currentIndex <= 0 || isProcessing}
                            title={isProcessing ? '진행 중에는 학생을 이동할 수 없습니다.' : undefined}
                        >
                            &lt; 이전 학생
                        </button>
                        <button
                            className="btn-nav active"
                            onClick={handleNext}
                            disabled={currentIndex >= students.length - 1 || isProcessing}
                            title={isProcessing ? '진행 중에는 학생을 이동할 수 없습니다.' : undefined}
                        >
                            다음 학생 &gt;
                        </button>
                        {aiGradingState === 'idle' ? (
                            <button
                                className="btn-primary"
                                style={{
                                    padding: '0.6rem 2.5rem',
                                    fontWeight: 800,
                                    opacity: (penSyncState !== 'synced' || bgGradingActive) ? 0.5 : 1,
                                    cursor: (penSyncState !== 'synced' || bgGradingActive) ? 'not-allowed' : 'pointer'
                                }}
                                onClick={handleStartAI}
                                disabled={penSyncState !== 'synced' || bgGradingActive}
                                title={bgGradingActive ? '다른 학생의 채점이 진행 중입니다. 완료 후 다시 시도해 주세요.' : undefined}
                            >
                                AI 채점 시작
                            </button>
                        ) : (
                            <button
                                className="btn-primary btn-processing"
                                style={{ padding: '0.6rem 2.5rem', fontWeight: 800 }}
                                disabled
                            >
                                AI 채점 진행 중...
                            </button>
                        )}
                    </div>
                </footer>
            </div>

            {/* 백그라운드 진행 확인 다이얼로그 */}
            <ExitConfirmModal
                isOpen={closeConfirmOpen}
                onClose={() => setCloseConfirmOpen(false)}
                onProceed={handleProceedBackground}
            />
        </div>
    );
};

export default UngradedDetailModal;
