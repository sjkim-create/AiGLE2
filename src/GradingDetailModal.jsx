/**
 * GradingDetailModal.jsx
 * [SCR-02] 미채점 상세 모달 화면입니다.
 * 미채점 학생의 펜 필기 데이터를 동기화하고, 답안을 확인한 뒤
 * AI 등급평가를 시작하는 화면입니다. 펜 데이터 유실 시 스캔 업로드를 대체 제공합니다.
 * 관련 PRD: SCR-02_미채점 상세.md
 */
import React, { useState, useMemo } from 'react';

const GradingDetailModal = ({
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
  onInvalidate,
}) => {
  const [sortBy, setSortBy] = useState('name');
  const [searchTerm, setSearchTerm] = useState('');

  // ── 펜 동기화 상태 ──
  const [isSynced, setIsSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── 필기 재생 토글 ──
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── AI 등급평가 상태 ──
  const [isAiGrading, setIsAiGrading] = useState(false);

  // ── [SCR-02] 미채점 단계 되돌리기 확인 모달 ──
  const [showRevertModal, setShowRevertModal] = useState(false);
  const handleConfirmRevert = () => {
    setShowRevertModal(false);
    // 미채점 단계 복귀 — 펜데이터 reset + 스캔 업로드 모드 진입
    setIsSynced(false);
    setIsAiGrading(false);
    setIsScanUploadOpen(true);
  };

  const sortedStudents = useMemo(() => {
    let list = [...students];
    if (searchTerm) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.grade.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'grade') return a.grade.localeCompare(b.grade, undefined, { numeric: true });
      return 0;
    });
    return list;
  }, [students, sortBy, searchTerm]);

  const currentIndex = sortedStudents.findIndex(s => s.id === selectedStudent?.id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectStudent(sortedStudents[currentIndex - 1]);
      resetState();
    }
  };
  const handleNext = () => {
    if (currentIndex < sortedStudents.length - 1) {
      onSelectStudent(sortedStudents[currentIndex + 1]);
      resetState();
    }
  };

  const resetState = () => {
    setIsSynced(false);
    setIsSyncing(false);
    setIsReplayMode(false);
    setIsPlaying(false);
    setIsAiGrading(false);
  };

  const handleSync = () => {
    if (isSynced || isSyncing) return;
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setIsSynced(true);
    }, 1500);
  };

  const handleStartAiGrading = () => {
    if (!isSynced || isAiGrading) return;
    setIsAiGrading(true);
    setTimeout(() => {
      if (onStartGrading) onStartGrading(selectedStudent);
    }, 2000);
  };

  const handleInvalidate = () => {
    if (window.confirm('이 학생의 제출을 무효 처리하시겠습니까?')) {
      if (onInvalidate) onInvalidate(selectedStudent);
      onClose();
    }
  };

  if (!isOpen || !selectedStudent) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container scr02-modal" onClick={e => e.stopPropagation()}>
        <button className="btn-modal-close" onClick={onClose}>×</button>

        {/* ── STEP 배너 ── */}
        <div className="step-banner">
          STEP 1. 답안 확인 — 펜을 연결하고 제출된 데이터를 불러온 뒤 AI 등급평가를 시작하세요.
        </div>

        <div className="modal-content">
          {/* ── 좌측: 학생 목록 사이드바 ── */}
          <aside className="modal-sidebar-left">
            <div className="sidebar-header">
              <div className="sidebar-title">학생 목록 ({sortedStudents.length})</div>
              <div className="search-box-mini">
                <input
                  type="text"
                  placeholder="학생 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="sort-controls">
                <button className={`btn-sort ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>이름순</button>
                <button className={`btn-sort ${sortBy === 'grade' ? 'active' : ''}`} onClick={() => setSortBy('grade')}>학년반번호순</button>
              </div>
            </div>
            <div className="student-list-scroll">
              {sortedStudents.map(s => (
                <div
                  key={s.id}
                  className={`mini-student-card ${selectedStudent?.id === s.id ? 'active' : ''}`}
                  onClick={() => { onSelectStudent(s); resetState(); }}
                >
                  <div className="mini-name">{s.name}</div>
                  <div className="mini-meta">{s.grade}</div>
                  <div className={`mini-status-dot ${s.status === '미채점' ? 'red' : 'blue'}`}></div>
                </div>
              ))}
            </div>
          </aside>

          <div className="grading-layout">
            {/* ── 1행 1열: 학생 정보 + 문항 탭 + 펜 캡처 ── */}
            <div className="submission-area" style={{ background: 'white' }}>
              <div className="modal-header-info" style={{ padding: '0 0 1.5rem 0' }}>
                <div className="modal-student-name">
                  {selectedStudent.name}
                  <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#8A94A1', marginLeft: '0.5rem' }}>{selectedStudent.grade}</span>
                </div>
                <button
                  className={`btn-sync ${isSynced ? 'synced' : ''}`}
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <span className={`sync-dot ${isSynced ? 'green' : 'red'}`}>
                    {isSynced ? '✓' : isSyncing ? '...' : ''}
                  </span>
                  {isSyncing ? '동기화 중...' : '펜 데이터 동기화'}
                </button>
              </div>

              <div className="modal-question-tabs" style={{ padding: '0 0 1.5rem 0' }}>
                {questions.map(q => (
                  <div
                    key={q.id}
                    className={`q-tab ${activeQuestion === q.id ? 'active' : ''}`}
                    onClick={() => setActiveQuestion(q.id)}
                  >
                    문항 {q.id} ({q.id}점)
                  </div>
                ))}
              </div>

              <div className="submission-label">펜 캡처 원본</div>
              <div className="pen-canvas-box" style={{ flex: 1, height: 'auto' }}>
                <div className="pen-toolbar">
                  <div className="toolbar-btn">+</div>
                  <div className="toolbar-btn">-</div>
                  <div className="toolbar-btn">⤢</div>
                  <button
                    className="toolbar-btn btn-playback"
                    disabled={!isSynced}
                    onClick={() => { if (isSynced) { setIsReplayMode(!isReplayMode); setIsPlaying(false); } }}
                    style={{ opacity: isSynced ? 1 : 0.4 }}
                  >
                    {isReplayMode ? '🖼 이미지 보기' : '▶ 필기 재생'}
                  </button>
                </div>
                <div className="page-nav">
                  <button className="page-arrow" disabled>◁</button>
                  <div className="page-indicator">1/1</div>
                  <button className="page-arrow" disabled>▷</button>
                </div>
                <div style={{ padding: '3rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {!isSynced ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }}>📝</div>
                      <p style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-base)', fontWeight: 600 }}>
                        {isSyncing ? '펜 데이터를 동기화하는 중입니다...' : '학생의 펜 데이터를 호출하는 중입니다...'}
                      </p>
                      <p style={{ color: '#CBD5E1', fontSize: 'var(--neo-font-size-sm)', marginTop: '0.5rem' }}>
                        상단의 [펜 데이터 동기화] 버튼을 클릭하세요.
                      </p>
                    </div>
                  ) : isReplayMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: '80px', height: '80px', borderRadius: '50%',
                          background: 'rgba(42,117,243,0.1)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', border: '3px solid #2A75F3',
                          transition: 'all 0.3s'
                        }}
                        onClick={() => setIsPlaying(!isPlaying)}
                      >
                        <span style={{ fontSize: '2rem', color: '#2A75F3', marginLeft: isPlaying ? 0 : '4px' }}>
                          {isPlaying ? '⏸' : '▶'}
                        </span>
                      </div>
                      <p style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-sm)' }}>
                        {isPlaying ? '재생 중... (클릭하여 일시정지)' : '클릭하여 필기 재생 시작'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <img src="/assets/images/sample_paper.png" alt="Scan Area" style={{ maxWidth: '100%', border: '1px solid #eee', opacity: 0.6, marginBottom: '1rem' }} />
                      <p style={{ color: '#10B981', fontSize: 'var(--neo-font-size-base)', fontWeight: 600 }}>✓ 펜 데이터 동기화 완료</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── 1행 2열: 채점 결과 영역 ── */}
            <div className="grading-sidebar">
              <div className="grading-section">
                <div className="section-title">채점 결과</div>
                <div className="grading-result-box">
                  <div className="status-row">
                    <div className="status-item">
                      <span className="label">AI 등급평가 :</span>
                      <span className="value" style={{ color: '#FF4D4D' }}>미채점</span>
                    </div>
                    <div className="status-item">
                      <span className="label">교사 채점 :</span>
                      <span className="value" style={{ color: '#FF4D4D' }}>미채점</span>
                    </div>
                  </div>
                </div>

                {/* 스캔 업로드 아코디언 */}
                <div className="scan-upload-container" style={{ marginTop: '1.5rem', border: 'none' }}>
                  <div className="scan-upload-header" onClick={() => setIsScanUploadOpen(!isScanUploadOpen)} style={{ padding: '0.5rem 0' }}>
                    <span className="scan-title" style={{ fontSize: 'var(--neo-font-size-base)' }}>🚨 스캔 업로드</span>
                    <div className={`arrow-toggle ${isScanUploadOpen ? 'open' : ''}`}>▼</div>
                  </div>
                  <p className="scan-desc" style={{ fontSize: 'var(--neo-font-size-sm)', marginBottom: '0.75rem' }}>펜 데이터 유실 시, 스캔 답안지를 업로드하세요.</p>
                  {isScanUploadOpen && (
                    <div className="scan-upload-body" style={{ padding: '0' }}>
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

        {/* ── 모달 하단 푸터 ── */}
        <footer className="modal-footer">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-invalid" onClick={handleInvalidate}>
              무효처리
            </button>
            <button
              type="button"
              onClick={() => setShowRevertModal(true)}
              title="미채점 단계로 되돌려 스캔 업로드로 다시 채점하기"
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: 700,
                color: '#475569',
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ↺ 미채점 처리
            </button>
          </div>
          <div className="footer-btn-group">
            <button className="btn-nav" onClick={handlePrev} disabled={currentIndex <= 0}>
              &lt; 이전 학생
            </button>
            <button className="btn-nav active" onClick={handleNext} disabled={currentIndex >= sortedStudents.length - 1}>
              다음 학생 &gt;
            </button>
            <button
              className="btn-primary"
              style={{
                padding: '0.6rem 2.5rem', fontWeight: 800,
                opacity: isSynced ? 1 : 0.5,
                cursor: isSynced ? 'pointer' : 'not-allowed'
              }}
              disabled={!isSynced || isAiGrading}
              onClick={handleStartAiGrading}
            >
              {isAiGrading ? 'AI 등급평가 진행 중...' : 'AI 등급평가 시작'}
            </button>
          </div>
        </footer>

        {/* [SCR-02] 미채점 단계로 되돌리기 확인 모달 */}
        {showRevertModal && (
          <div
            onClick={() => setShowRevertModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: '14px',
                padding: '1.5rem 1.75rem', width: '480px', maxWidth: '92vw',
                boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              }}
            >
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.75rem' }}>
                미채점 처리하시겠습니까?
              </h2>
              <ul style={{
                margin: '0 0 1.25rem', padding: '0.75rem 1rem 0.75rem 1.5rem',
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px',
                fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.75,
              }}>
                <li>이미 채점된 <strong style={{ color: '#DC2626' }}>펜데이터는 삭제</strong>되어, 복구할 수 없습니다.</li>
                <li><strong style={{ color: '#1E2225' }}>스캔 업로드</strong>를 통해 AI 채점을 시작할 수 있습니다.</li>
                <li>AI 채점은 펜데이터 사용 시와 동일하게 <strong style={{ color: '#1E2225' }}>최대 2회</strong>까지 가능합니다.</li>
              </ul>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRevertModal(false)}
                  style={{
                    padding: '9px 18px', background: 'white', border: '1px solid #E2E8F0',
                    borderRadius: '8px', fontWeight: 700, color: '#475569',
                    cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit',
                  }}
                >취소</button>
                <button
                  onClick={handleConfirmRevert}
                  style={{
                    padding: '9px 18px', background: '#DC2626', border: 'none',
                    borderRadius: '8px', fontWeight: 800, color: 'white',
                    cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit',
                  }}
                >↺ 미채점 처리</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingDetailModal;
