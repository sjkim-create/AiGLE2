/**
 * TaskRegisterEntryV24.jsx — [2.4] 과제 등록 입구 (TSK-14 §5A)
 *
 *   [2.4] [+ 새 과제 등록] → 정답형 직접 등록 화면(renderDirect)이 바로 열린다
 *     머리말 안내 줄: 「자료 파일을 끌어다 놓으면 AI가 채워 줍니다」 · [파일 선택] · 서·논술형 직접 등록
 *     파일을 화면으로 끌고 오면 그때만 놓기 레이어가 뜬다 → 놓으면 AI 형태 추천 → 교사 확인 → onSmart(kind, file)
 *     작성 중인 내용이 있으면 놓은 뒤 한 번 확인한다
 *   renderDirect가 없으면 과제 형태 고르기 화면 + 스마트 등록 레이어(✕ · 바깥 영역 · Esc로 닫음)
 * 형태가 정해진 뒤의 화면은 기존 등록 흐름(서·논술형: TSK-13 / TSK-14 §4.2, 정답형: TSK-15)을 그대로 쓴다.
 * 서·논술형 / 정답형 목록의 [+ 새 과제 등록]은 형태가 고정되어 이 화면을 거치지 않는다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { isFileGenerateAvailable, GenerateError, ITEM_MAX_FILE_MB } from './lib/taskFromFile';
import { recommendTaskKind } from './lib/taskKind';

const KINDS = {
  essay: { icon: '📝', title: '서·논술형', color: '#7C3AED', bg: '#F5F3FF', desc: '긴 문장으로 생각을 쓰는 과제 · 별도 답안지 1~10장' },
  answer: { icon: '✅', title: '정답형', color: '#2A75F3', bg: '#EFF6FF', desc: '문제와 답 칸이 한 장인 시험지 · 짧은 서술형이 섞여도 정답형' },
};
const other = (k) => (k === 'essay' ? 'answer' : 'essay');

const cardBtn = (color, bg) => ({
  base: { background: 'white', border: '2px solid #E2E8F0', borderRadius: 16, padding: '22px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', fontFamily: 'inherit', width: '100%' },
  enter: (e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = bg; },
  leave: (e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; },
});

const Card = ({ icon, title, desc, color = '#2A75F3', bg = '#EFF6FF', onClick }) => {
  const s = cardBtn(color, bg);
  return (
    <button type="button" onClick={onClick} style={s.base} onMouseEnter={s.enter} onMouseLeave={s.leave}>
      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5, marginTop: 4 }}>{desc}</span>
      </span>
    </button>
  );
};

const btn = (primary = false) => ({
  padding: '10px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
  border: primary ? 'none' : '1px solid #CBD5E1', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569',
});

// initialPhase — 'kind'이면 레이어 없이 직접 등록 · 그 밖('pick' · 'upload')은 스마트 등록 레이어를 띄운 채로 연다
// renderDirect(headerExtra, onGuard) — 기본으로 깔 직접 등록 화면 (없으면 과제 형태 고르기). onGuard로 「작성 중」을 알린다
const TaskRegisterEntryV24 = ({ onBack, onDirect, onSmart, initialPhase = 'pick', renderDirect = null }) => {
  const [phase, setPhase] = useState('kind'); // kind(직접 등록) | judging | confirm
  const [layer, setLayer] = useState(!renderDirect && initialPhase !== 'kind'); // ✨ 스마트 등록 레이어 (renderDirect가 없을 때)
  const [dropping, setDropping] = useState(false); // 파일을 끌고 들어온 동안의 놓기 레이어 (renderDirect)
  const [pending, setPending] = useState(null);    // 작성 중에 놓은 파일 — 확인 뒤 진행
  const dirtyRef = useRef(false);
  const dragDepth = useRef(0);
  const [file, setFile] = useState(null);
  const [rec, setRec] = useState(null);       // 추천 결과 — null이면 추천 없이 고르기
  const [note, setNote] = useState(null);     // 추천 실패 사유 (confirm 단계에서 보임)
  const [error, setError] = useState(null);   // 파일 오류 (레이어 안에 보임)
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const available = isFileGenerateAvailable();

  useEffect(() => {
    if (!layer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setLayer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layer]);

  const judge = async (f) => {
    if (!f) return;
    setFile(f); setRec(null); setNote(null); setError(null); setLayer(false); setPhase('judging');
    try {
      setRec(await recommendTaskKind(f));
      setPhase('confirm');
    } catch (err) {
      const e = err instanceof GenerateError ? err : new GenerateError('UNKNOWN', 'AI가 형태를 판단하지 못했습니다.', String(err?.message || err));
      if (['FILE_TYPE', 'FILE_SIZE', 'FILE_OPEN'].includes(e.code)) { setError(e); setFile(null); setPhase('kind'); setLayer(!renderDirect); return; }
      // AI 쪽 실패는 추천 없이 교사가 고른다
      setNote(e.code === 'NOT_ASSIGNMENT'
        ? '자료에서 문항을 찾지 못했습니다. 평가 자료가 맞다면 과제 형태를 직접 골라 주세요.'
        : 'AI가 형태를 판단하지 못했습니다. 과제 형태를 직접 골라 주세요.');
      setPhase('confirm');
    }
  };
  // 다른 파일 선택 · ← 이전 — 직접 등록 화면으로 돌아가 레이어를 다시 띄운다
  const repick = () => { setFile(null); setRec(null); setNote(null); setError(null); setPhase('kind'); setLayer(!renderDirect); };
  const back = () => (phase === 'confirm' ? repick() : onBack && onBack());
  const openLayer = () => { setError(null); setLayer(true); };

  // [renderDirect] 놓은 파일 — 작성 중이면 한 번 확인
  const take = (f) => { if (!f || !available) return; if (dirtyRef.current) setPending(f); else judge(f); };
  // 파일을 끌고 올 때만 놓기 레이어 (화면 안 문항 순서 끌기에는 뜨지 않는다)
  useEffect(() => {
    if (!renderDirect || phase !== 'kind') return undefined;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e) => { if (!hasFiles(e)) return; dragDepth.current += 1; setDropping(true); };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDropping(false); };
    const drop = (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current = 0; setDropping(false); };
    const key = (e) => { if (e.key === 'Escape') { dragDepth.current = 0; setDropping(false); } };
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('keydown', key);
    };
  }, [renderDirect, phase]);

  // ✨ 스마트 등록 레이어 — 직접 등록 화면 위에 띄운다. ✕ · 바깥 영역 · Esc로 닫으면 직접 등록
  const layerNode = layer && phase === 'kind' && (
        <div onClick={() => setLayer(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="smart-layer-title" onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: 560, background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 24px 60px rgba(15,23,42,0.28)', boxSizing: 'border-box' }}>
            <button type="button" aria-label="닫기" onClick={() => setLayer(false)}
              style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, border: 'none', background: 'transparent', borderRadius: 8, fontSize: 'var(--neo-font-size-lg)', color: '#64748B', cursor: 'pointer' }}>✕</button>
            <h2 id="smart-layer-title" style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 4px' }}>✨ 스마트 등록</h2>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 16px' }}>자료를 올리면 AI가 과제 형태를 추천하고 내용을 채웁니다.</p>
            {!available && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>
                AI 분석을 쓸 수 없는 환경입니다 (Gemini API 키 없음). 로컬 개발 환경에서만 동작합니다.
              </div>
            )}
            {error && (
              <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                ❌ {error.message}{error.hint && <span style={{ display: 'block', fontWeight: 500, color: '#64748B', marginTop: 4 }}>{error.hint}</span>}
              </div>
            )}
            <div role="button" tabIndex={0}
              onClick={() => available && inputRef.current?.click()}
              onKeyDown={(e) => { if (available && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); if (available) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (available) judge(e.dataTransfer.files?.[0]); }}
              style={{ border: `2px dashed ${dragOver ? '#2A75F3' : '#CBD5E1'}`, background: dragOver ? '#EFF6FF' : '#F8FAFC', borderRadius: 12, padding: '40px 16px', textAlign: 'center', cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.5 }}>
              <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>📄</div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginTop: 10 }}>파일을 끌어다 놓거나 클릭해서 선택</div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>PDF · JPG · PNG · 최대 {ITEM_MAX_FILE_MB}MB</div>
            </div>
            <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; judge(f); }} />
            <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: '12px 0 0', textAlign: 'center' }}>창을 닫으면 직접 등록할 수 있습니다.</p>
          </div>
        </div>
  );
  const reopenBtn = <button type="button" onClick={openLayer} style={btn()}>✨ 스마트 등록</button>;

  // [2.4] 정답형 직접 등록 화면 그대로 — 머리말 안내 줄 + 파일을 끌고 올 때만 놓기 레이어
  let wrap = (page) => page;
  if (renderDirect) {
    const link = { border: 'none', background: 'transparent', padding: 0, color: '#475569', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700 };
    const guide = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
          <span>📄 자료 파일을 끌어다 놓으면 AI가 채워 줍니다</span>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!available}
            title={available ? `PDF · JPG · PNG · 최대 ${ITEM_MAX_FILE_MB}MB` : 'AI 분석을 쓸 수 없는 환경입니다 (Gemini API 키 없음).'}
            style={{ ...btn(), padding: '6px 12px', opacity: available ? 1 : 0.5, cursor: available ? 'pointer' : 'not-allowed' }}>파일 선택</button>
          <span aria-hidden>·</span>
          <button type="button" onClick={() => onDirect && onDirect('essay')} style={link}>서·논술형 직접 등록</button>
        </div>
        {error && <div role="alert" style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#B91C1C' }}>❌ {error.message}</div>}
        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; take(f); }} />
      </div>
    );
    // 판단 · 추천 확인 중에도 정답형 화면은 숨겨 둔 채 두어, 돌아오면 입력이 그대로 남는다
    wrap = (rest) => (
      <>
        <div style={{ display: phase === 'kind' ? 'contents' : 'none' }}>{renderDirect(guide, (g) => { dirtyRef.current = !!g; })}</div>
        {rest}
      </>
    );
  }
  if (renderDirect && phase === 'kind') {
    return wrap(
      <>
        {dropping && (
          <div onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dragDepth.current = 0; setDropping(false); take(e.dataTransfer.files?.[0]); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ pointerEvents: 'none', width: '100%', maxWidth: 560, background: 'white', borderRadius: 16, padding: '40px 24px', border: '3px dashed #2A75F3', textAlign: 'center', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(15,23,42,0.28)' }}>
              <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>📄</div>
              <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B', marginTop: 10 }}>{available ? '여기에 놓으면 AI가 채워 줍니다' : 'AI 분석을 쓸 수 없는 환경입니다'}</div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>PDF · JPG · PNG · 최대 {ITEM_MAX_FILE_MB}MB</div>
            </div>
          </div>
        )}
        {pending && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="smart-pending-title"
              style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 16, padding: 24, boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(15,23,42,0.28)' }}>
              <h2 id="smart-pending-title" style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 8px' }}>작성 중인 내용이 사라집니다.</h2>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 20px' }}>📄 {pending.name}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" style={btn()} onClick={() => setPending(null)}>취소</button>
                <button type="button" style={btn(true)} onClick={() => { const f = pending; setPending(null); judge(f); }}>스마트 등록 진행</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const title = phase === 'kind' ? '✍️ 직접 등록' : '✨ 스마트 등록';

  return wrap(
    <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="button" onClick={back} disabled={phase === 'judging'}
          style={{ ...btn(), padding: '8px 14px', opacity: phase === 'judging' ? 0.5 : 1 }}>{phase === 'kind' ? '← 목록' : '← 이전'}</button>
        <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>{title}</h1>
        {/* 레이어를 닫은 뒤에도 다시 열 수 있게 */}
        {phase === 'kind' && <div style={{ marginLeft: 'auto' }}>{reopenBtn}</div>}
      </header>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ maxWidth: 760, width: '100%' }}>
          {phase === 'kind' && (
            <>
              <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, textAlign: 'center', margin: '0 0 24px' }}>과제 형태를 골라 주세요</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <Card key={k} icon={v.icon} title={v.title} desc={v.desc} color={v.color} bg={v.bg} onClick={() => onDirect && onDirect(k)} />
                ))}
              </div>
            </>
          )}

          {phase === 'judging' && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }} aria-hidden>⏳</div>
              <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, marginTop: 8 }}>AI가 과제 형태를 판단하고 있습니다.</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 6 }}>{file?.name}</div>
            </div>
          )}

          {phase === 'confirm' && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 12 }}>📄 {file?.name}</div>
              {rec ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#64748B' }}>AI 추천</span>
                    <span style={{ padding: '4px 12px', borderRadius: 999, background: KINDS[rec.kind].bg, color: KINDS[rec.kind].color, fontWeight: 900, fontSize: 'var(--neo-font-size-base)' }}>
                      {KINDS[rec.kind].icon} {KINDS[rec.kind].title}
                    </span>
                  </div>
                  {rec.reason && <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', margin: '12px 0 4px', lineHeight: 1.6 }}>{rec.reason}</p>}
                  <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 20px' }}>
                    찾은 문항 {rec.itemCount}개{rec.types.length > 0 && ` · ${rec.types.join(' · ')}`}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" style={btn(true)} onClick={() => onSmart && onSmart(rec.kind, file)}>이 형태로 진행</button>
                    <button type="button" style={btn()} onClick={() => onSmart && onSmart(other(rec.kind), file)}>{KINDS[other(rec.kind)].icon} {KINDS[other(rec.kind)].title}으로 진행</button>
                    <button type="button" style={{ ...btn(), marginLeft: 'auto' }} onClick={repick}>다른 파일 선택</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', margin: '0 0 20px', lineHeight: 1.6 }}>{note}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(KINDS).map(([k, v]) => (
                      <button key={k} type="button" style={btn()} onClick={() => onSmart && onSmart(k, file)}>{v.icon} {v.title}으로 진행</button>
                    ))}
                    <button type="button" style={{ ...btn(), marginLeft: 'auto' }} onClick={repick}>다른 파일 선택</button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {layerNode}
    </div>
  );
};

export default TaskRegisterEntryV24;
