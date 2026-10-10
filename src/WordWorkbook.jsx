/**
 * WordWorkbook — 낱말 문제집 (TSK-15 v1.26 · QBK-01)
 *
 * 영어 단어 시험 · 국어/영어 받아쓰기는 문항을 하나씩 등록하지 않고 「낱말 목록」으로 만든다. 교사가 직접 입력한다.
 *   · 출제 방식 — 낱말 시험(입력은 영어 → 한글, 빈칸은 낱말마다 영어/한글 — 번갈아 · 무작위) / 받아쓰기(번호와 빈칸만)
 *   · 낱말 입력 — 표에서 한 줄씩, 또는 엑셀·메모장에서 「낱말 [Tab] 뜻」 줄들을 붙여넣기
 *   · 문제집 배치 — 시험지 크기 · 단(1~4) · 줄 간격 · 이름 칸 · 정답 보기(교사용 — 받아쓰기는 불러 줄 목록)
 * 뜻은 쉼표로 여러 개를 적으면 모두 정답으로 본다(채점은 다음 단계).
 */
import React from 'react';
import { newId } from './lib/itemBank';
import { PAPERS } from './WorkbookLayout';

// [v1.28] 출제 방식 — 낱말 시험(입력은 늘 영어 → 한글, 빈칸은 낱말마다 영어/한글) / 받아쓰기
//   舊 meaning(영→한) · spelling(한→영)은 낱말 시험으로 읽는다 (spelling이었으면 빈칸 기본값이 영어)
export const WORD_MODES = {
  vocab: { label: '낱말 시험 (영어 ↔ 한글)', icon: '🔤' },
  dictation: { label: '받아쓰기 (듣고 쓰기)', icon: '👂' },
};
export const normMode = (m) => (m === 'dictation' ? 'dictation' : 'vocab');
// 빈칸 — 'meaning'(한글 뜻을 쓴다, 영어가 보임) · 'word'(영어를 쓴다, 한글 뜻이 보임)
export const blankOf = (w, rawMode) => w.blank || (rawMode === 'spelling' ? 'word' : 'meaning');
export const BLANK_LABEL = { meaning: '한글', word: '영어' };
export const DEFAULT_WORD_LAYOUT = { paper: 'A4', columns: 2, spacing: 'normal', style: 'line', nameBox: true, answerKey: false };
// 줄 간격 — 넓게는 舊 56px의 2배 (v1.27)
const ROW_H = { narrow: 30, normal: 40, wide: 112 };
// 배치 형태 — 밑줄(번호 · 낱말 · 답 줄) / 표(칸을 그은 표)
export const WORD_STYLES = { line: '밑줄', table: '표' };
const MM = 3.78; const PAD_V = 48; const PAD_H = 44; const COL_GAP = 24; const FOOTER = 24; const HEADER_H = 74;
const SHEET_FONT = { fontFamily: '"Noto Serif KR", "Batang", serif', fontSize: 13, lineHeight: 1.5, color: '#0F172A' };

const input = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' };
const smallBtn = (danger) => ({ padding: '2px 8px', borderRadius: 6, border: `1px solid ${danger ? '#FCA5A5' : '#CBD5E1'}`, background: 'white', color: danger ? '#B91C1C' : '#334155', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 });
const chip = (on) => ({ padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569' });
const optLabel = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' };

// 붙여넣기 — 한 줄에 낱말 하나. 「낱말 [Tab] 뜻」 · 「낱말 | 뜻」 · 「낱말 = 뜻」 · 「낱말 : 뜻」 (받아쓰기는 줄 전체가 낱말)
export const parseWordPaste = (text, mode) => String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
  if (mode === 'dictation') return { id: newId('w'), word: line, meaning: '' };
  const m = line.split(/\t|\s*\|\s*|\s+=\s+|\s*:\s+/);
  return { id: newId('w'), word: (m[0] || '').trim(), meaning: m.slice(1).join(', ').trim(), blank: 'meaning' };
});

export const wordIssues = (words, mode) => {
  const noWord = words.filter((w) => !w.word.trim()).length;
  const noMeaning = normMode(mode) === 'dictation' ? 0 : words.filter((w) => w.word.trim() && !w.meaning.trim()).length;
  const msgs = [];
  if (noWord) msgs.push(`낱말이 비어 있는 줄 ${noWord}개`);
  if (noMeaning) msgs.push(`뜻이 비어 있는 낱말 ${noMeaning}개 — 정답이나 보여 줄 뜻이 없습니다`);
  return msgs;
};

// ② 낱말 입력 — onChange(next, commit): 글자 입력은 화면에만(commit=false), 줄 추가·빼기·순서·붙여넣기는 바로 저장(commit=true). 입력 칸을 벗어나면 저장(onCommit)
export const WordEditor = ({ words, mode: rawMode, onChange, onCommit }) => {
  const mode = normMode(rawMode);
  const M = WORD_MODES[mode];
  const vocab = mode === 'vocab';
  // 빈칸 · 순서 한꺼번에 — 번갈아(1번 영어 빈칸, 2번 한글 빈칸 …) · 무작위 · 모두 한글 · 모두 영어 · 순서 섞기
  const setBlanks = (fn) => onChange(words.map((w, i) => ({ ...w, blank: fn(w, i) })), true);
  const shuffle = () => { const n = [...words]; for (let i = n.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [n[i], n[j]] = [n[j], n[i]]; } onChange(n, true); };
  const [paste, setPaste] = React.useState('');
  const set = (i, patch) => onChange(words.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= words.length) return; const n = [...words]; [n[i], n[j]] = [n[j], n[i]]; onChange(n, true); };
  const issues = wordIssues(words, mode);
  return (
    <div onBlurCapture={(e) => { if (e.target.tagName === 'INPUT') onCommit?.(); }} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 'var(--neo-font-size-sm)' }}>{M.icon} {M.label} · 낱말 {words.length}개</b>
        {issues.map((m) => <span key={m} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ {m}</span>)}
      </div>
      {words.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#F8FAFC', borderRadius: 10, padding: '8px 10px' }}>
          <span style={optLabel}>순서</span>
          <button type="button" onClick={shuffle} style={smallBtn()}>🔀 순서 섞기</button>
          {vocab && (
            <>
              <span style={{ ...optLabel, marginLeft: 8 }}>빈칸</span>
              <button type="button" onClick={() => setBlanks((w, i) => (i % 2 === 0 ? 'word' : 'meaning'))} title="1번 영어 빈칸, 2번 한글 빈칸 … 번갈아" style={smallBtn()}>↔ 번갈아</button>
              <button type="button" onClick={() => setBlanks(() => (Math.random() < 0.5 ? 'word' : 'meaning'))} style={smallBtn()}>🎲 무작위</button>
              <button type="button" onClick={() => setBlanks(() => 'meaning')} style={smallBtn()}>모두 한글 빈칸</button>
              <button type="button" onClick={() => setBlanks(() => 'word')} style={smallBtn()}>모두 영어 빈칸</button>
            </>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: vocab ? '40px 1fr 1fr 110px 120px' : '40px 1fr 1fr 120px', gap: 6, alignItems: 'center', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>
        <span>번호</span><span>{mode === 'dictation' ? '불러 줄 낱말·문장 (정답)' : '영어 낱말'}</span><span>{mode === 'dictation' ? '메모 (선택)' : '한글 뜻 (여러 개는 쉼표로)'}</span>{vocab && <span>빈칸</span>}<span />
      </div>
      {words.map((w, i) => (
        <div key={w.id} style={{ display: 'grid', gridTemplateColumns: vocab ? '40px 1fr 1fr 110px 120px' : '40px 1fr 1fr 120px', gap: 6, alignItems: 'center' }}>
          <span style={{ fontWeight: 900, color: '#2A75F3' }}>{i + 1}</span>
          <input value={w.word} onChange={(e) => set(i, { word: e.target.value })} aria-label={`${i + 1}번 낱말`} placeholder={mode === 'dictation' ? '예: 무릎을 꿇다' : '예: apple'}
            style={{ ...input, border: `1px solid ${w.word.trim() ? '#CBD5E1' : '#FCA5A5'}` }} />
          <input value={w.meaning} onChange={(e) => set(i, { meaning: e.target.value })} aria-label={`${i + 1}번 뜻`} placeholder={mode === 'dictation' ? '' : '예: 사과'}
            style={{ ...input, border: `1px solid ${mode !== 'dictation' && w.word.trim() && !w.meaning.trim() ? '#FCA5A5' : '#CBD5E1'}` }} />
          {vocab && (
            <span style={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label={`${i + 1}번 빈칸`}>
              {['word', 'meaning'].map((k) => {
                const on = blankOf(w, rawMode) === k;
                return <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(words.map((x, j) => (j === i ? { ...x, blank: k } : x)), true)}
                  style={{ ...smallBtn(), ...(on ? { background: '#2A75F3', color: 'white', border: '1px solid #2A75F3' } : {}) }}>{BLANK_LABEL[k]}</button>;
              })}
            </span>
          )}
          <span style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}번 위로`} style={smallBtn()}>↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === words.length - 1} aria-label={`${i + 1}번 아래로`} style={smallBtn()}>↓</button>
            <button type="button" onClick={() => onChange(words.filter((_, j) => j !== i), true)} aria-label={`${i + 1}번 빼기`} style={smallBtn(true)}>✕</button>
          </span>
        </div>
      ))}
      <div>
        <button type="button" onClick={() => onChange([...words, { id: newId('w'), word: '', meaning: '', blank: 'meaning' }], true)} style={{ ...smallBtn(), padding: '6px 12px' }}>+ 한 줄 추가</button>
      </div>
      <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={optLabel}>여러 개 붙여넣기 — 한 줄에 하나{mode === 'dictation' ? '' : ' · 「낱말 [Tab] 뜻」 (엑셀 두 열 복사) 또는 「낱말 | 뜻」'}</span>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} aria-label="낱말 붙여넣기"
          placeholder={mode === 'dictation' ? '무릎\n넓다\n읽고 찾기' : 'apple\t사과\nrun | 달리다, 뛰다'} style={{ ...input, fontFamily: 'monospace' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" disabled={!paste.trim()} onClick={() => { onChange([...words.filter((w) => w.word.trim() || w.meaning.trim()), ...parseWordPaste(paste, mode)], true); setPaste(''); }}
            style={{ ...smallBtn(), padding: '6px 12px', background: paste.trim() ? '#2A75F3' : '#E2E8F0', color: paste.trim() ? 'white' : '#94A3B8', border: '1px solid transparent', cursor: paste.trim() ? 'pointer' : 'not-allowed' }}>
            붙여넣은 {parseWordPaste(paste, mode).length}개 추가
          </button>
        </div>
      </div>
    </div>
  );
};

export const WordLayoutOptions = ({ layout, onChange, children }) => {
  const L = { ...DEFAULT_WORD_LAYOUT, ...(layout || {}) };
  const set = (k, v) => onChange({ ...L, [k]: v });
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 6 }}>시험지 크기
        <select value={L.paper} onChange={(e) => set('paper', e.target.value)} aria-label="시험지 크기"
          style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>
          {Object.entries(PAPERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </label>
      <span style={{ ...optLabel, marginLeft: 6 }}>단</span>
      {[1, 2, 3, 4].map((n) => <button key={n} type="button" onClick={() => set('columns', n)} style={chip(L.columns === n)} aria-pressed={L.columns === n}>{n}단</button>)}
      <span style={{ ...optLabel, marginLeft: 6 }}>형태</span>
      {Object.entries(WORD_STYLES).map(([k, l]) => <button key={k} type="button" onClick={() => set('style', k)} style={chip((L.style || 'line') === k)} aria-pressed={(L.style || 'line') === k}>{l}</button>)}
      <span style={{ ...optLabel, marginLeft: 6 }}>줄 간격</span>
      {[['narrow', '좁게'], ['normal', '보통'], ['wide', '넓게']].map(([k, l]) => <button key={k} type="button" onClick={() => set('spacing', k)} style={chip(L.spacing === k)} aria-pressed={L.spacing === k}>{l}</button>)}
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 6 }}><input type="checkbox" checked={L.nameBox} onChange={(e) => set('nameBox', e.target.checked)} /> 이름 칸</label>
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={L.answerKey} onChange={(e) => set('answerKey', e.target.checked)} /> 정답 보기 (교사용)</label>
      {children && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{children}</span>}
    </div>
  );
};

// ③ 문제집 배치 — 번호 · (보여 줄 것) · 답 칸. 단을 위에서부터 채우고 넘치면 다음 단 · 다음 쪽
export const WordSheet = ({ title, curriculum, words, mode: rawMode, layout, actualSize = false }) => {
  const mode = normMode(rawMode);
  const L = { ...DEFAULT_WORD_LAYOUT, ...(layout || {}) };
  const M = WORD_MODES[mode];
  const paper = PAPERS[L.paper] || PAPERS.A4;
  const pageW = Math.round(paper.w * MM); const pageH = Math.round(paper.h * MM);
  const colW = Math.floor((pageW - PAD_H * 2 - COL_GAP * (L.columns - 1)) / L.columns);
  const rowH = ROW_H[L.spacing] || ROW_H.normal;
  const list = words.filter((w) => w.word.trim());
  const perCol = (first) => Math.max(1, Math.floor((pageH - PAD_V * 2 - FOOTER - (first ? HEADER_H : 0)) / rowH));
  const pages = [];
  let k = 0; let first = true;
  while (k < list.length) {
    // 이 쪽에 들어갈 낱말 수 → 단마다 고르게 (예: 12개 · 4단 → 3개씩)
    const cap = perCol(first);
    const onPage = Math.min(list.length - k, cap * L.columns);
    const per = Math.min(cap, Math.ceil(onPage / L.columns));
    const cols = [];
    for (let c = 0; c < L.columns && k < list.length && cols.flat().length < onPage; c += 1) { const n = Math.min(per, onPage - cols.flat().length); cols.push(list.slice(k, k + n).map((w, j) => ({ w, no: k + j + 1 }))); k += n; }
    pages.push({ cols, first }); first = false;
  }
  const boxRef = React.useRef(null);
  const [boxW, setBoxW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!boxRef.current) return undefined;
    const ro = new ResizeObserver(([en]) => setBoxW(en.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);
  const zoom = actualSize ? 1 : (boxW ? Math.min(1, boxW / pageW) : 1);
  const curText = [curriculum?.schoolLevelName, curriculum?.gradeLabel, curriculum?.curriculumName, curriculum?.subjectName].filter(Boolean).join(' · ');
  // 낱말 시험 — 빈칸 쪽이 답, 다른 쪽이 보임 / 받아쓰기 — 낱말이 답, 보이는 것 없음
  const answerOf = (w) => (mode === 'dictation' ? w.word : blankOf(w, rawMode) === 'word' ? w.word : w.meaning);
  // 정답 보기(교사용) — 줄여 보여도 읽히게 굵고 진하게
  const answerStyle = { color: '#DC2626', fontSize: 15, fontWeight: 800, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const shownOf = (w) => (mode === 'dictation' ? '' : blankOf(w, rawMode) === 'word' ? w.meaning : w.word);
  const hasShown = mode !== 'dictation';
  return (
    <div ref={boxRef} style={{ background: '#E2E8F0', padding: 16, borderRadius: 12, overflow: actualSize ? 'auto' : 'hidden' }}>
      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
        {paper.label} · {L.columns}단 · {Math.max(1, pages.length)}쪽 — {M.icon} {M.label} · 낱말 {list.length}개{L.answerKey ? ' · 정답 보기(교사용)' : ''}
      </div>
      <div aria-label="낱말 문제집 지면 미리 보기" data-pages={pages.length} style={{ zoom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {(pages.length ? pages : [{ cols: [], first: true }]).map((pg, pi, arr) => (
          <div key={pi} data-page={pi + 1} style={{ width: pageW, height: pageH, background: 'white', boxShadow: '0 2px 12px rgba(15,23,42,0.15)', padding: `${PAD_V}px ${PAD_H}px`, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', ...SHEET_FONT }}>
            {pg.first && (
              <div style={{ height: HEADER_H - 14, borderBottom: '2px solid #0F172A', marginBottom: 14, display: 'flex', alignItems: 'flex-end', gap: 12, boxSizing: 'border-box', paddingBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{title || '제목 없음'}{L.answerKey && <span style={{ fontSize: 12, color: '#DC2626', marginLeft: 8 }}>[정답 · 교사용]</span>}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{curText}{curText ? ' · ' : ''}{M.label} · {list.length}개</div>
                </div>
                {L.nameBox && (
                  <div style={{ display: 'flex', border: '1px solid #0F172A', fontSize: 11 }}>
                    {['학년', '반', '번호', '이름'].map((h) => (
                      <div key={h} style={{ borderLeft: h === '학년' ? 'none' : '1px solid #0F172A' }}>
                        <div style={{ padding: '1px 8px', borderBottom: '1px solid #0F172A', background: '#F1F5F9', textAlign: 'center' }}>{h}</div>
                        <div style={{ height: 22, width: h === '이름' ? 80 : 40 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: COL_GAP }}>
              {Array.from({ length: L.columns }).map((_, ci) => (
                <div key={ci} style={{ width: colW, flex: '0 0 auto', ...(L.style === 'table' && (pg.cols[ci] || []).length ? { border: '1px solid #334155', borderBottom: 'none', alignSelf: 'flex-start' } : {}) }}>
                  {(pg.cols[ci] || []).map(({ w, no }) => (L.style === 'table' ? (
                    // 표 — 번호 | 보여 줄 것 | 답 칸
                    <div key={w.id} data-word-row style={{ height: rowH, display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #334155', boxSizing: 'border-box' }}>
                      <b style={{ width: 34, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #334155', background: '#F8FAFC' }}>{no}</b>
                      {hasShown && <span style={{ flex: '0 1 45%', display: 'flex', alignItems: 'center', padding: '0 6px', borderRight: '1px solid #334155', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{shownOf(w)}</span>}
                      <span style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 6px', minWidth: 40, ...answerStyle }}>{L.answerKey ? answerOf(w) : ''}</span>
                    </div>
                  ) : (
                    // 밑줄 — 번호 · 보여 줄 것 · 답 줄
                    <div key={w.id} data-word-row style={{ height: rowH, display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 4, boxSizing: 'border-box' }}>
                      <b style={{ minWidth: 26 }}>{no}.</b>
                      {hasShown && <span style={{ flex: '0 1 45%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{shownOf(w)}</span>}
                      <span style={{ flex: 1, borderBottom: '1px solid #334155', minWidth: 40, paddingLeft: 4, ...answerStyle }}>{L.answerKey ? answerOf(w) : ' '}</span>
                    </div>
                  )))}
                </div>
              ))}
            </div>
            {!list.length && <div style={{ color: '#94A3B8', textAlign: 'center', paddingTop: 60, fontFamily: 'inherit' }}>낱말이 없습니다. 수정 → 낱말 입력에서 넣어 주세요.</div>}
            <div style={{ position: 'absolute', bottom: PAD_V / 2, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#64748B' }}>{pi + 1} / {arr.length}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
