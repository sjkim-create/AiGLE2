/**
 * UngradedDetailModal.jsx (SCR-02)
 * 미채점 상세 화면 — 답안 데이터 올리기 → AI 채점 시작
 * STEP 1. 답안 확인
 *
 * [v3.0] 좌측을 [펜 채점] · [스캔 채점] 탭으로 나눈다.
 *   · 펜 채점  — [펜 데이터 업로드] 한 번으로 불러온다(별도 「펜 동기화」 없음). AiGLE Connect가 준비되지 않았으면
 *               필수 프로그램 확인 창을 띄워 설치·실행하게 하고, 준비되면 이어서 바로 불러온다.
 *               불러오면 우측 원본 보기에 필기가 보이고 필기 재생이 된다(필기 재생은 펜 데이터만)
 *   · 스캔 채점 — 펜 데이터가 유실됐을 때 스캔한 답안지를 올린다. 이미지(JPG · PNG) · PDF, 최대 10개.
 *                파일마다 [보기] · 순서 올리기/내리기 · 삭제
 *   · AI 채점은 **보고 있는 탭의 데이터**로 한다 — 그 탭에 데이터가 있어야 [AI 채점 시작]이 켜진다
 *   · 우측 「원본보기」 — 문항 탭 · 확대/축소/맞춤 · 필기 재생(펜만) · 쪽 넘김
 */
import React, { useState, useEffect, useRef } from 'react';
import ExitConfirmModal from './ExitConfirmModal';
import RequiredProgramModal, { isConnectDownloaded, markConnectDownloaded } from './RequiredProgramModal';

/* AiGLE Connect 준비 여부 — 한 번 확인되면 이 창을 다시 열어도 묻지 않는다 (세션 기억) */
let connectSessionReady = false;

const SAMPLE_SHEET = `${import.meta.env.BASE_URL}images/answer-sheet-sample.png`;
const MAX_FILES = 10;
const MAX_MB = 20;
const ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];
const PEN_PAGES = 2; // 프로토타입 — 펜 데이터 쪽 수

const C = {
    text: '#1E2225', sub: '#64748B', muted: '#94A3B8', line: '#E2E8F0', blue: '#2A75F3', red: '#DC2626', bg: '#EEF2F7',
};
const btn = { border: `1px solid ${C.line}`, background: 'white', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: C.text };
const iconBtn = (disabled) => ({ ...btn, width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' });
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);

const UngradedDetailModal = ({
    isOpen,
    onClose,
    selectedStudent,
    onSelectStudent,
    students = [],
    questions,
    activeQuestion,
    setActiveQuestion,
    onStartGrading,
    onBackgroundGrading,
    bgGradingActive = false
}) => {
    const [tab, setTab] = useState('pen'); // 'pen' | 'scan'
    const [penSyncState, setPenSyncState] = useState('before'); // 'before' | 'syncing' | 'synced'
    const [files, setFiles] = useState([]); // { id, name, size, type, url }
    const [fileErrors, setFileErrors] = useState([]);
    const [viewFileId, setViewFileId] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [aiGradingState, setAiGradingState] = useState('idle'); // 'idle' | 'processing'
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [isPlaybackMode, setIsPlaybackMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    const [programOpen, setProgramOpen] = useState(false); // AiGLE Connect 확인 창
    const inputRef = useRef(null);
    const filesRef = useRef(files);
    filesRef.current = files;

    const isProcessing = aiGradingState === 'processing';
    const hasData = tab === 'pen' ? penSyncState === 'synced' : files.length > 0;

    // 학생이 바뀌면 처음 상태로 — 올린 파일·불러온 펜 데이터는 그 학생 것이므로 넘기지 않는다
    useEffect(() => {
        filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
        setTab('pen'); setPenSyncState('before'); setFiles([]); setFileErrors([]); setViewFileId(null);
        setAiGradingState('idle'); setCurrentPage(1); setZoom(1); setIsPlaybackMode(false); setIsPlaying(false);
    }, [selectedStudent?.id]);
    useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
    // 문항 · 탭이 바뀌면 첫 쪽부터
    useEffect(() => { setCurrentPage(1); setIsPlaybackMode(false); setIsPlaying(false); }, [activeQuestion, tab]);

    // 학생 네비게이션
    const currentIndex = students.findIndex(s => s.id === selectedStudent?.id);
    const handlePrev = () => { if (!isProcessing && currentIndex > 0) onSelectStudent(students[currentIndex - 1]); };
    const handleNext = () => { if (!isProcessing && currentIndex < students.length - 1) onSelectStudent(students[currentIndex + 1]); };

    // 펜 데이터 업로드 — AiGLE Connect가 준비돼 있으면 바로 불러오고, 아니면 확인 창부터
    const loadPenData = () => {
        setPenSyncState('syncing');
        setTimeout(() => setPenSyncState('synced'), 1500);
    };
    const handlePenSync = () => {
        if (connectSessionReady) { loadPenData(); return; }
        setProgramOpen(true);
    };

    // 스캔 파일 올리기 — 형식 · 용량 · 개수 · 중복 검사
    const addFiles = (list) => {
        const errs = [];
        const next = [...files];
        Array.from(list || []).forEach((f) => {
            const okType = ACCEPT.includes(f.type) || /\.(jpe?g|png|pdf)$/i.test(f.name);
            if (!okType) { errs.push(`${f.name} — 지원하지 않는 형식입니다 (JPG · PNG · PDF만 가능)`); return; }
            if (f.size > MAX_MB * 1024 * 1024) { errs.push(`${f.name} — ${MAX_MB}MB를 넘습니다`); return; }
            if (next.some((x) => x.name === f.name && x.size === f.size)) { errs.push(`${f.name} — 이미 올린 파일입니다`); return; }
            if (next.length >= MAX_FILES) { errs.push(`${f.name} — 최대 ${MAX_FILES}개까지 올릴 수 있습니다`); return; }
            next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, size: f.size, type: f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : 'image/*'), url: URL.createObjectURL(f) });
        });
        setFiles(next);
        setFileErrors(errs);
        if (!viewFileId && next.length) setViewFileId(next[0].id);
    };
    const moveFile = (i, d) => setFiles((prev) => { const a = [...prev]; const j = i + d; if (j < 0 || j >= a.length) return prev; [a[i], a[j]] = [a[j], a[i]]; return a; });
    const removeFile = (f) => {
        URL.revokeObjectURL(f.url);
        setFiles((prev) => {
            const a = prev.filter((x) => x.id !== f.id);
            if (viewFileId === f.id) setViewFileId(a[0]?.id || null);
            return a;
        });
        setFileErrors([]);
    };
    const viewFile = (f) => setViewFileId(f.id);

    // AI 채점 시작 — 보고 있는 탭의 데이터로
    const handleStartAI = () => {
        if (bgGradingActive || !hasData) return;
        setAiGradingState('processing');
        if (onStartGrading) onStartGrading(selectedStudent, { source: tab, files: tab === 'scan' ? files.map((f) => f.name) : [] });
    };

    // 모달 닫기 시도 — 진행 중이면 백그라운드 진행 확인 다이얼로그
    const handleAttemptClose = () => { if (isProcessing) { setCloseConfirmOpen(true); return; } onClose(); };
    const handleProceedBackground = () => {
        setCloseConfirmOpen(false);
        if (onBackgroundGrading) onBackgroundGrading(selectedStudent); else onClose();
    };

    // 진행 중 페이지 이탈 차단 + ESC 처리
    useEffect(() => {
        if (!isOpen || !isProcessing) return;
        const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '페이지를 벗어나면 채점 결과를 잃을 수 있습니다. 정말 이동하시겠습니까?'; return e.returnValue; };
        const handleKeyDown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setCloseConfirmOpen(true); } };
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('beforeunload', handleBeforeUnload); window.removeEventListener('keydown', handleKeyDown); };
    }, [isOpen, isProcessing]);

    if (!isOpen) return null;

    /* ── 우측 원본보기 — 무엇을 보여 줄지 ── */
    const totalPages = tab === 'pen' ? (penSyncState === 'synced' ? PEN_PAGES : 0) : files.length;
    // 스캔은 「보기」로 고른 파일이 곧 현재 쪽 — 순서를 바꿔도 고른 파일을 그대로 보인다
    const viewIdx = files.findIndex((f) => f.id === viewFileId);
    const shownPage = tab === 'scan' ? (viewIdx >= 0 ? viewIdx + 1 : (files.length ? 1 : 0)) : currentPage;
    const pageFile = tab === 'scan' ? files[shownPage - 1] : null;
    const canPlayback = tab === 'pen' && penSyncState === 'synced';

    const tabStyle = (on, disabled) => ({
        padding: '10px 26px', border: 'none', borderRadius: '10px 10px 0 0', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700,
        background: on ? 'white' : '#DDE3EA', color: on ? C.text : C.muted, cursor: disabled ? 'not-allowed' : 'pointer',
    });

    const renderPenTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: C.text }}>펜 데이터 업로드</div>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                {penSyncState === 'before' && (<>
                    <span style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid ${C.muted}`, color: C.sub, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>i</span>
                    <div style={{ color: C.text, fontSize: 'var(--neo-font-size-sm)' }}>데이터가 없습니다. 업로드 해주세요.</div>
                    <button type="button" onClick={handlePenSync} disabled={isProcessing}
                        style={{ ...btn, border: 'none', background: '#DCE8FD', color: C.text, padding: '10px 48px' }}>펜 데이터 업로드</button>
                </>)}
                {penSyncState === 'syncing' && (<>
                    <span style={{ fontSize: 28 }}>⏳</span>
                    <div style={{ color: C.sub, fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>펜 데이터를 불러오는 중입니다…</div>
                </>)}
                {penSyncState === 'synced' && (<>
                    <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>✓</span>
                    <div style={{ color: C.text, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>펜 데이터를 불러왔습니다.</div>
                    <div style={{ color: C.sub, fontSize: 'var(--neo-font-size-xs)' }}>문항 {questions.length}개 · {PEN_PAGES}쪽 · 오른쪽 원본보기에서 확인하고 필기 재생을 할 수 있습니다.</div>
                    <button type="button" onClick={handlePenSync} disabled={isProcessing} style={{ ...btn, padding: '7px 18px', fontSize: 'var(--neo-font-size-xs)' }}>↻ 다시 불러오기</button>
                </>)}
            </div>
        </div>
    );

    const renderScanTab = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: C.text }}>
                스캔 데이터 업로드
                <span title="펜 데이터가 유실되었을 때, 스캔한 답안지를 업로드해 채점을 하세요."
                    style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${C.sub}`, color: C.sub, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>i</span>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 500, color: C.muted }}>펜 데이터가 유실되었을 때, 스캔한 답안지를 업로드해 채점을 하세요.</span>
            </div>
            <div onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!isProcessing) addFiles(e.dataTransfer.files); }}
                style={{ border: `1px dashed ${dragOver ? C.blue : '#CBD5E1'}`, background: dragOver ? '#F5F9FF' : 'white', borderRadius: 10, padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAF1FE', color: C.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⇪</span>
                <div style={{ color: C.text, fontSize: 'var(--neo-font-size-sm)' }}>여기에 파일을 끌어다 놓거나, 버튼을 눌러 업로드하세요.</div>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={isProcessing || files.length >= MAX_FILES}
                    style={{ ...btn, padding: '6px 14px', fontSize: 'var(--neo-font-size-xs)', opacity: files.length >= MAX_FILES ? 0.5 : 1 }}>파일 선택</button>
                <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <div style={{ color: C.muted, fontSize: 'var(--neo-font-size-xs)' }}>이미지(JPG, PNG) 또는 PDF 파일만 업로드 가능 (최대 {MAX_FILES}개까지 · 파일당 {MAX_MB}MB) · 올린 순서가 쪽 순서입니다</div>
            </div>
            {fileErrors.length > 0 && (
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: C.red, lineHeight: 1.6 }}>
                    <strong>⚠ 파일 {fileErrors.length}개를 올리지 못했습니다.</strong>
                    {fileErrors.map((m) => <div key={m}>· {m}</div>)}
                </div>
            )}
            {files.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflowY: 'auto', minHeight: 0, flex: 1 }}>
                    {files.map((f, i) => {
                        const on = viewFileId === f.id;
                        return (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: i ? `1px solid ${C.line}` : 'none', background: on ? '#F5F9FF' : 'white' }}>
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: C.text }}>
                                    {i + 1}. {f.name} <span style={{ fontWeight: 400, color: C.muted, fontSize: 'var(--neo-font-size-xs)', marginLeft: 4 }}>{fmtSize(f.size)}</span>
                                </span>
                                <button type="button" onClick={() => viewFile(f)} title="오른쪽 원본보기에서 봅니다"
                                    style={{ ...btn, border: 'none', background: on ? C.blue : '#94A3B8', color: 'white', padding: '6px 12px', fontSize: 'var(--neo-font-size-xs)' }}>보기</button>
                                <button type="button" aria-label="위로" disabled={i === 0 || isProcessing} onClick={() => moveFile(i, -1)} style={iconBtn(i === 0)}>↑</button>
                                <button type="button" aria-label="아래로" disabled={i === files.length - 1 || isProcessing} onClick={() => moveFile(i, 1)} style={iconBtn(i === files.length - 1)}>↓</button>
                                <button type="button" aria-label="삭제" disabled={isProcessing} onClick={() => removeFile(f)} style={{ ...iconBtn(false), color: C.red, borderColor: '#FCA5A5' }}>🗑</button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderViewer = () => {
        const empty = (msg) => (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted, fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, textAlign: 'center', padding: 24 }}>
                <img src={SAMPLE_SHEET} alt="" style={{ width: 180, opacity: 0.18 }} />
                {msg}
            </div>
        );
        let body;
        if (tab === 'pen') {
            if (penSyncState === 'syncing') body = empty('펜 데이터를 불러오는 중입니다…');
            else if (penSyncState !== 'synced') body = empty('왼쪽에서 펜 데이터를 업로드하면 원본이 여기에 보입니다.');
            else body = (
                <div style={{ position: 'relative' }}>
                    <img src={SAMPLE_SHEET} alt={`문항 ${activeQuestion} 펜 필기 ${currentPage}쪽`} style={{ display: 'block', width: '100%', opacity: isPlaybackMode && !isPlaying ? 0.4 : 1 }} />
                    {isPlaybackMode && !isPlaying && (
                        <button type="button" onClick={() => { setIsPlaying(true); setTimeout(() => setIsPlaying(false), 3000); }}
                            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 72, height: 72, borderRadius: '50%', background: 'rgba(42,117,243,0.95)', color: 'white', border: 'none', fontSize: '1.8rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>▶</button>
                    )}
                    {isPlaying && <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 16px', borderRadius: 16, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>⏸ 재생 중...</div>}
                </div>
            );
        } else if (!pageFile) {
            body = empty('왼쪽에서 스캔 파일을 올리면 원본이 여기에 보입니다.');
        } else if (/pdf/i.test(pageFile.type)) {
            body = <iframe title={pageFile.name} src={pageFile.url} style={{ width: '100%', height: '70vh', border: 'none' }} />;
        } else {
            body = <img src={pageFile.url} alt={pageFile.name} style={{ display: 'block', width: '100%' }} />;
        }
        const pageBtn = (dir) => {
            const disabled = dir < 0 ? shownPage <= 1 : shownPage >= totalPages;
            return (
                <button type="button" aria-label={dir < 0 ? '이전 쪽' : '다음 쪽'} disabled={disabled || !totalPages}
                    onClick={() => { const p = shownPage + dir; if (tab === 'scan') { if (files[p - 1]) setViewFileId(files[p - 1].id); } else setCurrentPage(p); }}
                    style={{ position: 'absolute', top: '50%', [dir < 0 ? 'left' : 'right']: 10, transform: 'translateY(-50%)', zIndex: 3, width: 42, height: 42, borderRadius: '50%', border: `1px solid ${C.line}`, background: 'white', fontSize: 18, cursor: disabled ? 'default' : 'pointer', opacity: disabled || !totalPages ? 0.35 : 1, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>{dir < 0 ? '‹' : '›'}</button>
            );
        };
        return (
            <div style={{ position: 'relative', flex: 1, minHeight: 0, background: 'white', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 도구 줄 */}
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" aria-label="확대" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))} disabled={!totalPages} style={iconBtn(!totalPages)}>＋</button>
                    <button type="button" aria-label="축소" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={!totalPages} style={iconBtn(!totalPages)}>－</button>
                    <button type="button" aria-label="화면에 맞춤" onClick={() => setZoom(1)} disabled={!totalPages} style={iconBtn(!totalPages)}>⛶</button>
                    {/* 필기 재생은 펜 데이터만 — 스캔 답안은 획 정보가 없어 재생할 수 없으므로 스캔 탭에서는 버튼을 두지 않는다 */}
                    {tab === 'pen' && <button type="button" disabled={!canPlayback}
                        title={canPlayback ? undefined : '펜 데이터를 업로드하면 재생할 수 있습니다'}
                        onClick={() => { setIsPlaybackMode((v) => !v); setIsPlaying(false); }}
                        style={{ ...btn, border: 'none', background: canPlayback ? '#475569' : '#94A3B8', color: 'white', borderRadius: 999, padding: '8px 18px', fontSize: 'var(--neo-font-size-xs)', cursor: canPlayback ? 'pointer' : 'not-allowed', opacity: canPlayback ? 1 : 0.6 }}>
                        {isPlaybackMode ? '이미지 보기' : '▶ 필기 재생'}
                    </button>}
                    {zoom !== 1 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: C.sub }}>{Math.round(zoom * 100)}%</span>}
                    <span style={{ marginLeft: 'auto', background: '#475569', color: 'white', borderRadius: 999, padding: '2px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>{totalPages ? shownPage : 0}/{totalPages}</span>
                </div>
                {pageBtn(-1)}{pageBtn(1)}
                <div style={{ flex: 1, overflow: 'auto', padding: '64px 64px 24px' }}>
                    <div style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 640 : 'none', margin: '0 auto' }}>{body}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={() => { if (!isProcessing) handleAttemptClose(); }}>
            <div className="modal-container grading-detail-modal" onClick={e => e.stopPropagation()}>
                <button className="btn-modal-close" onClick={handleAttemptClose}>×</button>

                {/* 상단 배너 */}
                <div className="step-banner">
                    <strong>STEP 1. 답안 확인</strong>&nbsp;&nbsp;답안을 올리고 확인한 뒤 AI 채점을 진행하세요.
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16, background: C.bg }}>
                    {/* === 좌측: 펜 채점 / 스캔 채점 === */}
                    <div style={{ flex: '0 0 48%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* 학생 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: C.text }}>{selectedStudent?.name}</span>
                            <span style={{ color: '#8A94A1' }}>{selectedStudent?.grade}</span>
                            {/* [SCR-06] 퇴고 답안 채점 중 표시 */}
                            {(selectedStudent?.round ?? 1) >= 2 && (
                                <span title={`퇴고(2차) 답안 · 답안지 번호표 ${selectedStudent?.sheetNo || '-'} · 1차 교사 채점 ${(selectedStudent?.history || []).find(h => h.round === 1)?.teacherGrade || '-'}`}
                                    style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 999, padding: '3px 10px', fontWeight: 800, fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap' }}>✍ 2차 (퇴고)</span>
                            )}
                        </div>
                        {/* 탭 */}
                        <div role="tablist" style={{ display: 'flex', gap: 2 }}>
                            {[['pen', '펜 채점'], ['scan', '스캔 채점']].map(([k, l]) => (
                                <button key={k} type="button" role="tab" aria-selected={tab === k} disabled={isProcessing}
                                    title={isProcessing ? 'AI 채점 중에는 바꿀 수 없습니다' : undefined}
                                    onClick={() => setTab(k)} style={tabStyle(tab === k, isProcessing)}>
                                    {l}
                                    {k === 'pen' && penSyncState === 'synced' && <span style={{ marginLeft: 6, color: '#16A34A' }}>●</span>}
                                    {k === 'scan' && files.length > 0 && <span style={{ marginLeft: 6, color: C.blue, fontSize: 'var(--neo-font-size-xs)' }}>{files.length}</span>}
                                </button>
                            ))}
                        </div>
                        <div style={{ flex: 1, minHeight: 0, background: 'white', borderRadius: '0 12px 12px 12px', padding: '22px 24px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                            {tab === 'pen' ? renderPenTab() : renderScanTab()}
                        </div>
                        {/* 하단 버튼 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14 }}>
                            <button type="button" disabled={isProcessing}
                                onClick={() => { if (!isProcessing && window.confirm('이 학생의 제출을 무효 처리하시겠습니까?')) onClose(); }}
                                title={isProcessing ? 'AI 채점 진행 중에는 무효 처리할 수 없습니다.' : undefined}
                                style={{ ...btn, color: C.red, borderColor: C.red, padding: '7px 12px', fontSize: 'var(--neo-font-size-xs)', opacity: isProcessing ? 0.4 : 1 }}>무효처리</button>
                            <span style={{ flex: 1 }} />
                            <button type="button" onClick={handlePrev} disabled={currentIndex <= 0 || isProcessing}
                                style={{ ...btn, padding: '9px 16px', fontSize: 'var(--neo-font-size-sm)', opacity: currentIndex <= 0 || isProcessing ? 0.45 : 1 }}>‹ 이전 학생</button>
                            <button type="button" onClick={handleNext} disabled={currentIndex >= students.length - 1 || isProcessing}
                                style={{ ...btn, padding: '9px 16px', fontSize: 'var(--neo-font-size-sm)', opacity: currentIndex >= students.length - 1 || isProcessing ? 0.45 : 1 }}>다음 학생 ›</button>
                            {!isProcessing ? (
                                <button type="button" onClick={handleStartAI} disabled={!hasData || bgGradingActive}
                                    title={bgGradingActive ? '다른 학생의 채점이 진행 중입니다. 완료 후 다시 시도해 주세요.'
                                        : !hasData ? (tab === 'pen' ? '펜 데이터를 먼저 업로드해 주세요.' : '스캔 파일을 1개 이상 올려 주세요.') : `${tab === 'pen' ? '펜' : '스캔'} 데이터로 AI 채점을 시작합니다.`}
                                    style={{ ...btn, border: 'none', background: C.blue, color: 'white', padding: '10px 24px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, opacity: !hasData || bgGradingActive ? 0.5 : 1, cursor: !hasData || bgGradingActive ? 'not-allowed' : 'pointer' }}>✦ AI 채점 시작</button>
                            ) : (
                                <button type="button" disabled style={{ ...btn, border: 'none', background: C.blue, color: 'white', padding: '10px 24px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, opacity: 0.8 }}>AI 채점 진행 중...</button>
                            )}
                        </div>
                    </div>

                    {/* === 우측: 원본보기 === */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: C.text, marginRight: 8 }}>원본보기</span>
                            {questions.map((q) => (
                                <button key={q.id} type="button" onClick={() => setActiveQuestion(q.id)}
                                    style={{ ...btn, borderRadius: 999, padding: '5px 14px', fontSize: 'var(--neo-font-size-sm)', background: activeQuestion === q.id ? C.blue : 'white', color: activeQuestion === q.id ? 'white' : C.sub, borderColor: activeQuestion === q.id ? C.blue : C.line }}>
                                    문항{q.id}
                                </button>
                            ))}
                            {tab === 'scan' && files.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: C.muted }}>스캔 파일 {files.length}개 · 올린 순서</span>}
                        </div>
                        {renderViewer()}
                    </div>
                </div>
            </div>

            {/* AiGLE Connect 확인 — 준비되면 창을 닫고 펜 데이터를 이어서 불러온다 */}
            <RequiredProgramModal open={programOpen} onClose={() => setProgramOpen(false)}
                programs={[
                    { key: 'connect', name: 'AiGLE Connect', desc: '펜 데이터 업로드 · USB·블루투스 펜 연결 · 백그라운드 자동 실행', required: true, installed: isConnectDownloaded() },
                    { key: 'printDoctor', name: 'Ncode Print Doctor', desc: 'N-code 인쇄 최적 상태 지원 · 프린터 인쇄 적합성 진단', required: false },
                ]}
                onInstalled={(key) => { if (key === 'connect') markConnectDownloaded(); }}
                onAllReady={() => { markConnectDownloaded(); connectSessionReady = true; setProgramOpen(false); loadPenData(); }} />

            {/* 백그라운드 진행 확인 다이얼로그 */}
            <ExitConfirmModal isOpen={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)} onProceed={handleProceedBackground} />
        </div>
    );
};

export default UngradedDetailModal;
