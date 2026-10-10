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
import { readXlsxRows, makeXlsxBlob, downloadBlob } from './lib/xlsxLite';
import { loadCatalog, isFileGenerateAvailable } from './lib/taskFromFile';
import { catalogStandardsFor, generateWords, WORD_KINDS } from './lib/wordAI';

// [v1.28] 출제 방식 — 낱말 시험(입력은 늘 영어 → 한글, 빈칸은 낱말마다 영어/한글) / 받아쓰기
//   舊 meaning(영→한) · spelling(한→영)은 낱말 시험으로 읽는다 (spelling이었으면 빈칸 기본값이 영어)
export const WORD_MODES = {
  vocab: { label: '낱말 시험 (영어 ↔ 한글)', icon: '🔤' },
  dictation: { label: '받아쓰기 (듣고 쓰기)', icon: '👂' },
};
export const normMode = (m) => (m === 'dictation' ? 'dictation' : 'vocab');
// 빈칸 — 'meaning'(한글 뜻을 쓴다, 영어가 보임) · 'word'(영어를 쓴다, 한글 뜻이 보임)
//   정하지 않은 낱말은 번호로 번갈아 — 1번 영어 빈칸(한글이 보임), 2번 한글 빈칸(영어가 보임) … (v1.30 — 기본이 모두 한글 빈칸이라 영어만 보이던 문제)
export const blankOf = (w, rawMode, index = 0) => {
  const b = w.blank || (rawMode === 'spelling' ? 'word' : (index % 2 === 0 ? 'word' : 'meaning'));
  // 문제로 보일 쪽이 비어 있으면 빈칸을 반대로 — 어떤 경우에도 한글이나 영어 중 하나는 문제로 보인다 (v1.31)
  if (b === 'word' && !String(w.meaning || '').trim()) return 'meaning';
  if (b === 'meaning' && !String(w.word || '').trim()) return 'word';
  return b;
};
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
  return { id: newId('w'), word: (m[0] || '').trim(), meaning: m.slice(1).join(', ').trim() };
});

export const wordIssues = (words, mode) => {
  const noWord = words.filter((w) => !w.word.trim()).length;
  const noMeaning = normMode(mode) === 'dictation' ? 0 : words.filter((w) => w.word.trim() && !w.meaning.trim()).length;
  const msgs = [];
  if (noWord) msgs.push(`낱말이 비어 있는 줄 ${noWord}개`);
  if (noMeaning) msgs.push(`뜻이 비어 있는 낱말 ${noMeaning}개 — 정답이나 보여 줄 뜻이 없습니다`);
  return msgs;
};

// ② 낱말 입력 — 입력만(번호 · 영어 · 한글 · ✕). 순서 · 빈칸은 ③ 문제집 배치에서 (v1.29)
//   저장 — 편집기가 낱말 목록을 직접 들고 있다(밖에서 다시 불러온 값이 입력 중인 글자를 덮지 않게, v1.32).
//   줄 추가·빼기·붙여넣기·엑셀은 바로 onSave, 글자 입력은 0.5초 쉬면 · 칸을 벗어나면 · 화면을 떠나면 onSave
//   엑셀 — [⬇️ 양식 내려받기] A열 영어 낱말 · B열 한글 뜻 / [📤 엑셀 올리기] 2행부터 읽어 끝에 덧붙인다
// ai — { cur, codes } : 기본 정보에서 고른 성취기준으로 [✨ AI로 낱말 만들기] (낱말 시험만)
// dictLang — 받아쓰기 언어(국어 · 영어): 입력 예시 · 양식 이름
export const WordEditor = ({ words: initialWords, mode: rawMode, onSave, onNotice, ai = null, dictLang = '국어' }) => {
  const [dragOn, setDragOn] = React.useState(false);
  const [words, setWords] = React.useState(initialWords || []);
  const latest = React.useRef(words); latest.current = words;
  const saveRef = React.useRef(onSave); saveRef.current = onSave;
  const timer = React.useRef(null);
  const dirty = React.useRef(false);
  const flush = () => { clearTimeout(timer.current); if (dirty.current) { dirty.current = false; saveRef.current?.(latest.current); } };
  React.useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // commit=true — 바로 저장 / false — 글자 입력: 0.5초 뒤 저장
  const onChange = (next, commit) => {
    setWords(next); latest.current = next; dirty.current = true;
    clearTimeout(timer.current);
    if (commit) flush(); else timer.current = setTimeout(flush, 500);
  };
  const onCommit = flush;
  const mode = normMode(rawMode);
  const M = WORD_MODES[mode];
  const dict = mode === 'dictation';
  const [paste, setPaste] = React.useState('');
  const fileRef = React.useRef(null);
  const set = (i, patch) => onChange(words.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const issues = wordIssues(words, mode);
  const kept = () => words.filter((w) => w.word.trim() || w.meaning.trim());
  const downloadTemplate = () => {
    const engDict = dict && dictLang === '영어';
    const rows = dict ? [['불러 줄 낱말·문장', '메모'], ...(engDict ? [['apple', ''], ['How are you?', '']] : [['무릎', ''], ['읽고 찾기', '']])] : [['영어 낱말', '한글 뜻'], ['apple', '사과'], ['run', '달리다, 뛰다']];
    downloadBlob(makeXlsxBlob(rows, { sheetName: '낱말', widths: [24, 32] }), dict ? `받아쓰기_${dictLang}_양식.xlsx` : '낱말_양식.xlsx');
  };
  const upload = async (file) => {
    if (!file) return;
    try {
      const rows = await readXlsxRows(file);
      const added = rows.slice(1).map((r) => ({ id: newId('w'), word: String(r.A ?? '').trim(), meaning: String(r.B ?? '').trim() })).filter((w) => w.word || w.meaning);
      if (!added.length) { onNotice?.('엑셀 2행부터 A열(영어 낱말) · B열(한글 뜻)에 낱말이 없습니다. 양식을 내려받아 확인해 주세요.'); return; }
      onChange([...kept(), ...added], true);
      const noMeaning = dict ? 0 : added.filter((w) => w.word && !w.meaning).length;
      onNotice?.(`엑셀에서 낱말 ${added.length}개를 추가했습니다.${noMeaning ? ` 뜻이 비어 있는 낱말 ${noMeaning}개가 있습니다.` : ''}`);
    } catch (err) {
      onNotice?.(err?.message || '엑셀 파일을 읽을 수 없습니다.');
    } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const grid = '40px 1fr 1fr 44px';
  return (
    <div onBlurCapture={(e) => { if (e.target.tagName === 'INPUT' && e.target.type !== 'file') onCommit?.(); }} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 'var(--neo-font-size-sm)' }}>{M.icon} {M.label}{dict ? ` · ${dictLang}` : ''} · 낱말 {words.length}개</b>
        {issues.map((m) => <span key={m} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ {m}</span>)}
      </div>
      {!dict && ai && <WordAIPanel ai={ai} existing={words} onAdd={(added) => { onChange([...kept(), ...added], true); onNotice?.(`AI가 만든 낱말 ${added.length}개를 추가했습니다. 뜻과 수준을 확인해 주세요.`); }} />}
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>
        <span>번호</span><span>{dict ? '불러 줄 낱말·문장 (정답)' : '영어 낱말'}</span><span>{dict ? '메모 (선택)' : '한글 뜻 (여러 개는 쉼표로)'}</span><span />
      </div>
      {words.map((w, i) => (
        <div key={w.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center' }}>
          <span style={{ fontWeight: 900, color: '#2A75F3', display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>{i + 1}{w.ai && <span title={`AI가 만든 낱말${w.standard ? ` · 근거 ${w.standard}` : ''} — 확인해 주세요`} style={{ fontSize: 9, fontWeight: 800, color: '#7C3AED' }}>AI</span>}</span>
          <input value={w.word} onChange={(e) => set(i, { word: e.target.value })} aria-label={`${i + 1}번 낱말`} placeholder={dict ? (dictLang === '영어' ? '예: How are you?' : '예: 무릎을 꿇다') : '예: apple'}
            style={{ ...input, border: `1px solid ${w.word.trim() ? '#CBD5E1' : '#FCA5A5'}` }} />
          <input value={w.meaning} onChange={(e) => set(i, { meaning: e.target.value })} aria-label={`${i + 1}번 뜻`} placeholder={dict ? '' : '예: 사과'}
            style={{ ...input, border: `1px solid ${!dict && w.word.trim() && !w.meaning.trim() ? '#FCA5A5' : '#CBD5E1'}` }} />
          <button type="button" onClick={() => onChange(words.filter((_, j) => j !== i), true)} aria-label={`${i + 1}번 빼기`} style={smallBtn(true)}>✕</button>
        </div>
      ))}
      <div>
        <button type="button" onClick={() => onChange([...words, { id: newId('w'), word: '', meaning: '' }], true)} style={{ ...smallBtn(), padding: '6px 12px' }}>+ 한 줄 추가</button>
      </div>
      <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* [v1.37] 엑셀 — 양식 내려받기 · 올리기(버튼 또는 파일을 끌어 놓기) */}
        <div onDragOver={(e) => { e.preventDefault(); if (!dragOn) setDragOn(true); }} onDragLeave={() => setDragOn(false)}
          onDrop={(e) => { e.preventDefault(); setDragOn(false); upload(e.dataTransfer.files?.[0]); }}
          aria-label="엑셀 파일을 끌어 놓는 곳"
          style={{ border: `2px dashed ${dragOn ? '#2A75F3' : '#CBD5E1'}`, background: dragOn ? '#EFF6FF' : '#F8FAFC', borderRadius: 12, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.3rem' }}>📊</span>
          <span style={{ flex: 1, minWidth: 220, fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
            <b>엑셀 파일을 여기로 끌어 놓거나</b> [📤 엑셀 올리기]를 누르세요.
            <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>A열 {dict ? '불러 줄 낱말·문장' : '영어 낱말'} · B열 {dict ? '메모' : '한글 뜻'}, 1행은 머리글 — 2행부터 읽어 목록 끝에 덧붙입니다.</span>
          </span>
          <button type="button" onClick={downloadTemplate} style={{ ...smallBtn(), padding: '6px 12px' }}>⬇️ 양식 내려받기</button>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ ...smallBtn(), padding: '6px 12px', border: '1px solid #2A75F3', color: '#1D4ED8' }}>📤 엑셀 올리기</button>
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="엑셀 파일 선택" style={{ display: 'none' }} onChange={(e) => upload(e.target.files?.[0])} />
        </div>
        <span style={optLabel}>여러 개 붙여넣기 — 한 줄에 하나{dict ? '' : ' · 「낱말 [Tab] 뜻」 (엑셀 두 열 복사) 또는 「낱말 | 뜻」'}</span>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} aria-label="낱말 붙여넣기"
          placeholder={dict ? (dictLang === '영어' ? 'apple\nHow are you?\nI like it.' : '무릎\n넓다\n읽고 찾기') : 'apple\t사과\nrun | 달리다, 뛰다'} style={{ ...input, fontFamily: 'monospace' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" disabled={!paste.trim()} onClick={() => { onChange([...kept(), ...parseWordPaste(paste, mode)], true); setPaste(''); }}
            style={{ ...smallBtn(), padding: '6px 12px', background: paste.trim() ? '#2A75F3' : '#E2E8F0', color: paste.trim() ? 'white' : '#94A3B8', border: '1px solid transparent', cursor: paste.trim() ? 'pointer' : 'not-allowed' }}>
            붙여넣은 {parseWordPaste(paste, mode).length}개 추가
          </button>
        </div>
      </div>
    </div>
  );
};

// ③ 문제집 배치 — 순서 · 빈칸 한꺼번에 (낱말 시험만 빈칸) · 시험지 위에서는 끌어서 순서, 눌러서 빈칸 바꾸기
export const WordOrderTools = ({ words, mode: rawMode, onChange }) => {
  const vocab = normMode(rawMode) === 'vocab';
  const setBlanks = (fn) => onChange(words.map((w, i) => ({ ...w, blank: blankOf({ ...w, blank: fn(w, i) }, rawMode, i) })));
  const noMeaning = vocab ? words.filter((w) => w.word.trim() && !String(w.meaning || '').trim()).length : 0;
  const shuffle = () => { const n = [...words]; for (let i = n.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [n[i], n[j]] = [n[j], n[i]]; } onChange(n); };
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={optLabel}>순서</span>
      <button type="button" onClick={shuffle} style={smallBtn()}>🔀 순서 섞기</button>
      {vocab && (
        <>
          <span style={{ ...optLabel, marginLeft: 10 }}>빈칸</span>
          <button type="button" onClick={() => setBlanks((w, i) => (i % 2 === 0 ? 'word' : 'meaning'))} title="1번 영어 빈칸, 2번 한글 빈칸 … 번갈아" style={smallBtn()}>↔ 번갈아</button>
          <button type="button" onClick={() => setBlanks(() => (Math.random() < 0.5 ? 'word' : 'meaning'))} style={smallBtn()}>🎲 무작위</button>
          <button type="button" onClick={() => setBlanks(() => 'meaning')} style={smallBtn()}>모두 한글 빈칸</button>
          <button type="button" onClick={() => setBlanks(() => 'word')} style={smallBtn()}>모두 영어 빈칸</button>
        </>
      )}
      {noMeaning > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ 뜻이 없는 낱말 {noMeaning}개는 늘 영어를 보이고 한글 칸을 비웁니다 — 낱말 입력에서 뜻을 넣어 주세요</span>}
      <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>시험지에서 낱말을 끌면 순서{vocab ? ', 누르면 빈칸(영어↔한글)' : ''}이 바뀝니다</span>
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
// editMode — 낱말을 끌어 다른 낱말 위에 놓으면 그 번호 자리로(onOrder), 누르면 빈칸 영어↔한글(onToggleBlank, 낱말 시험만)
export const WordSheet = ({ title, curriculum, words, mode: rawMode, layout, actualSize = false, editMode = false, onOrder, onToggleBlank }) => {
  const mode = normMode(rawMode);
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);
  const ids = words.map((w) => w.id);
  const dropTo = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = ids.indexOf(dragId); const to = ids.indexOf(targetId);
    const n = words.filter((w) => w.id !== dragId);
    const at = n.findIndex((w) => w.id === targetId) + (to > from ? 1 : 0); // 아래로 끌면 대상 뒤, 위로 끌면 대상 앞 = 대상 번호 자리
    n.splice(at, 0, words[from]);
    onOrder?.(n);
  };
  const rowEdit = (w, no) => (editMode ? {
    draggable: true,
    onDragStart: (ev) => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', w.id); setDragId(w.id); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
    onDragOver: (ev) => { if (!dragId) return; ev.preventDefault(); if (overId !== w.id) setOverId(w.id); },
    onDrop: (ev) => { ev.preventDefault(); dropTo(w.id); setDragId(null); setOverId(null); },
    onClick: () => { if (mode === 'vocab') onToggleBlank?.(w.id); },
    title: mode === 'vocab' ? `${no}번 — 끌어서 순서 · 누르면 빈칸 ${blankOf(w, rawMode, words.indexOf(w)) === 'word' ? '한글' : '영어'}으로` : `${no}번 — 끌어서 순서`,
    'data-edit-row': true,
  } : {});
  const rowEditStyle = (w) => (editMode ? {
    cursor: 'grab', outline: overId === w.id && dragId !== w.id ? '2px solid #2A75F3' : '1px dashed #93C5FD', outlineOffset: 1,
    background: overId === w.id && dragId !== w.id ? 'rgba(42,117,243,0.08)' : undefined, opacity: dragId === w.id ? 0.4 : 1,
  } : {});
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
  const idxOf = (w) => words.indexOf(w);
  // 정답 보기(교사용) — 줄여 보여도 읽히게 굵고 진하게
  const answerStyle = { color: '#DC2626', fontSize: 15, fontWeight: 800, fontFamily: 'Pretendard, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const blankCount = mode === 'vocab' ? list.reduce((a, w) => { a[blankOf(w, rawMode, idxOf(w))] += 1; return a; }, { word: 0, meaning: 0 }) : null;
  return (
    <div ref={boxRef} style={{ background: '#E2E8F0', padding: 16, borderRadius: 12, overflow: actualSize ? 'auto' : 'hidden' }}>
      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
        {paper.label} · {L.columns}단 · {Math.max(1, pages.length)}쪽 — {M.icon} {M.label} · 낱말 {list.length}개{blankCount ? ` · 빈칸 영어 ${blankCount.word} · 한글 ${blankCount.meaning}` : ''}{L.answerKey ? ' · 정답 보기(교사용)' : ''}
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
                  {(pg.cols[ci] || []).map(({ w, no }) => {
                    // [v1.33] 낱말 시험은 칸 자리를 고정 — 왼쪽 영어 · 오른쪽 한글. 빈칸 쪽만 비우고(정답 보기면 빨간 정답) 자리는 바뀌지 않는다
                    //   받아쓰기는 번호 · 답 칸
                    const cells = mode === 'vocab'
                      ? [{ k: 'word', text: w.word }, { k: 'meaning', text: w.meaning }].map((c) => ({ ...c, blank: blankOf(w, rawMode, idxOf(w)) === c.k }))
                      : [{ k: 'word', text: w.word, blank: true }];
                    const cellText = (c) => (c.blank ? (L.answerKey ? c.text : '') : c.text);
                    const textStyle = (c) => (c.blank ? answerStyle : { overflow: 'hidden', wordBreak: 'keep-all', lineHeight: 1.2, fontSize: (c.text || '').length > 6 ? 12 : 13 });
                    return L.style === 'table' ? (
                      // 표 — 번호 | 영어 | 한글
                      <div key={w.id} data-word-row {...rowEdit(w, no)} style={{ height: rowH, display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #334155', boxSizing: 'border-box', ...rowEditStyle(w) }}>
                        <b style={{ width: 34, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #334155', background: '#F8FAFC' }}>{no}</b>
                        {cells.map((c, ci2) => (
                          <span key={c.k} data-cell={c.k} data-blank={c.blank ? 'y' : 'n'} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', padding: '0 6px', ...(ci2 < cells.length - 1 ? { borderRight: '1px solid #334155' } : {}), ...textStyle(c) }}>{cellText(c)}</span>
                        ))}
                      </div>
                    ) : (
                      // 밑줄 — 번호 · 영어 · 한글 (빈칸 쪽은 밑줄)
                      <div key={w.id} data-word-row {...rowEdit(w, no)} style={{ height: rowH, display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 4, boxSizing: 'border-box', ...rowEditStyle(w) }}>
                        <b style={{ minWidth: 26 }}>{no}.</b>
                        {cells.map((c) => (
                          <span key={c.k} data-cell={c.k} data-blank={c.blank ? 'y' : 'n'} style={{ flex: '1 1 0', minWidth: 0, paddingLeft: 2, ...(c.blank ? { borderBottom: '1px solid #334155', minHeight: 18 } : {}), ...textStyle(c) }}>{cellText(c) || ' '}</span>
                        ))}
                      </div>
                    );
                  })}
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

// ① 기본 정보 — 핵심평가영역 · 성취기준 (교육과정 DB). AI 낱말 만들기의 근거
//   value: { areas: [영역 이름], codes: [성취기준 코드] }
export const WordStandardsPicker = ({ curriculum, value, onChange }) => {
  const [cat, setCat] = React.useState(null);
  React.useEffect(() => { loadCatalog().then(setCat).catch(() => {}); }, []);
  const { areas, standards } = catalogStandardsFor(cat, curriculum || {});
  const v = { areas: value?.areas || [], codes: value?.codes || [] };
  const toggleArea = (a) => {
    const nextAreas = v.areas.includes(a) ? v.areas.filter((x) => x !== a) : [...v.areas, a];
    // 영역을 빼면 그 영역의 성취기준도 뺀다
    onChange({ areas: nextAreas, codes: v.codes.filter((c) => nextAreas.includes(standards.find((s) => s.code === c)?.areaName)) });
  };
  const shown = standards.filter((s) => v.areas.includes(s.areaName));
  const box = (on) => ({ width: 18, height: 18, borderRadius: 4, flex: '0 0 auto', border: `1.5px solid ${on ? '#2A75F3' : '#CBD5E1'}`, background: on ? '#2A75F3' : 'white', color: 'white', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' });
  if (!curriculum?.schoolLevelName || !curriculum?.curriculumName) {
    return <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>학교급 · 학년 · 교과를 고르면 핵심평가영역과 성취기준이 나옵니다.</div>;
  }
  if (cat && !areas.length) return <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>이 학교급·학년·교과에 등록된 성취기준이 없습니다.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span style={{ ...optLabel, display: 'block', marginBottom: 6 }}>핵심평가영역 <span style={{ color: '#94A3B8', fontWeight: 600 }}>(AI 낱말 만들기 근거 · 다중)</span></span>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {areas.map((a) => (
            <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>
              <input type="checkbox" checked={v.areas.includes(a)} onChange={() => toggleArea(a)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
              <span aria-hidden="true" style={box(v.areas.includes(a))}>{v.areas.includes(a) ? '✓' : ''}</span>{a}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span style={{ ...optLabel, display: 'block', marginBottom: 6 }}>성취기준 <span style={{ color: '#94A3B8', fontWeight: 600 }}>(다중 · {v.codes.length}개 선택)</span></span>
        {!v.areas.length ? <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>핵심평가영역을 먼저 골라 주세요.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
            {shown.map((s) => {
              const on = v.codes.includes(s.code);
              return (
                <label key={s.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${on ? '#93C5FD' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.5 }}>
                  <input type="checkbox" checked={on} onChange={() => onChange({ ...v, codes: on ? v.codes.filter((c) => c !== s.code) : [...v.codes, s.code] })} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
                  <span aria-hidden="true" style={{ ...box(on), marginTop: 2 }}>{on ? '✓' : ''}</span>
                  <span><b style={{ color: '#047857' }}>[{s.areaName}]</b> {s.code} {s.text}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ② 낱말 입력 — [✨ AI로 낱말 만들기]: 개수 · 종류 → 미리 보기에서 골라 추가
const WordAIPanel = ({ ai, existing, onAdd }) => {
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(20);
  const [kind, setKind] = React.useState('word');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [result, setResult] = React.useState(null); // [{ word, meaning, type, standard, dup, on }]
  const [cat, setCat] = React.useState(null);
  React.useEffect(() => { loadCatalog().then(setCat).catch(() => {}); }, []);
  const stds = catalogStandardsFor(cat, ai.cur).standards.filter((s) => (ai.codes || []).includes(s.code));
  const have = new Set(existing.map((w) => w.word.trim().toLowerCase()).filter(Boolean));
  const keyOk = isFileGenerateAvailable();
  const run = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const list = await generateWords({ cur: ai.cur, standards: stds, count, kind, existing: [...have] });
      setResult(list.map((w) => ({ ...w, dup: have.has(w.word.toLowerCase()), on: !have.has(w.word.toLowerCase()) })));
    } catch (e) {
      setErr({ message: e?.message || 'AI로 만들 수 없습니다.', hint: e?.hint || '' });
    } finally { setBusy(false); }
  };
  const chosen = (result || []).filter((w) => w.on && !w.dup);
  const panel = { border: '1px solid #DDD6FE', background: '#FAF5FF', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 };
  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen(true)} style={{ ...smallBtn(), padding: '6px 12px', border: '1px solid #7C3AED', color: '#6D28D9', background: '#FAF5FF' }}>✨ AI로 낱말 만들기</button>
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{stds.length ? `성취기준 ${stds.length}개를 근거로 학년 수준의 단어·숙어를 만듭니다.` : '① 기본 정보에서 핵심평가영역 · 성취기준을 고르면 쓸 수 있습니다.'}</span>
      </div>
    );
  }
  return (
    <div style={panel} aria-label="AI로 낱말 만들기">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 'var(--neo-font-size-sm)', color: '#6D28D9' }}>✨ AI로 낱말 만들기</b>
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{[ai.cur?.schoolLevelName, ai.cur?.gradeLabel, ai.cur?.curriculumName].filter(Boolean).join(' · ')} · 성취기준 {stds.length}개</span>
        <span style={{ marginLeft: 'auto' }} />
        <button type="button" onClick={() => { setOpen(false); setResult(null); setErr(null); }} style={smallBtn()}>닫기</button>
      </div>
      {!stds.length && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>① 기본 정보에서 핵심평가영역 · 성취기준을 1개 이상 골라 주세요.</div>}
      {!keyOk && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>AI를 쓸 수 없는 환경입니다(API 키 없음) — 직접 입력하거나 엑셀로 올려 주세요.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={optLabel}>개수</span>
        {[10, 20, 30].map((n) => <button key={n} type="button" onClick={() => setCount(n)} style={chip(count === n)} aria-pressed={count === n}>{n}개</button>)}
        <span style={{ ...optLabel, marginLeft: 8 }}>종류</span>
        {Object.entries(WORD_KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} style={chip(kind === k)} aria-pressed={kind === k}>{l}</button>)}
        <button type="button" disabled={busy || !stds.length || !keyOk} onClick={run}
          style={{ ...smallBtn(), padding: '6px 14px', marginLeft: 'auto', background: busy || !stds.length || !keyOk ? '#E2E8F0' : '#7C3AED', color: busy || !stds.length || !keyOk ? '#94A3B8' : 'white', border: '1px solid transparent', cursor: busy || !stds.length || !keyOk ? 'not-allowed' : 'pointer' }}>
          {busy ? 'AI가 만드는 중…' : result ? '다시 만들기' : '만들기'}
        </button>
      </div>
      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>성취기준에는 단어 목록이 없어 AI가 학년 수준을 추정합니다. 추가하기 전에 뜻과 수준을 확인해 주세요. 만들기 1번 = AI 호출 1번.</div>
      {busy && <div role="status" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#6D28D9', fontWeight: 700 }}>AI가 낱말을 만드는 중입니다. 보통 수십 초, AI 서버가 혼잡하면 1~3분 걸릴 수 있습니다.</div>}
      {err && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ {err.message} {err.hint}</div>}
      {result && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>AI가 만든 낱말 {result.length}개{result.some((w) => w.dup) ? ` · 이미 있음 ${result.filter((w) => w.dup).length}개` : ''}</span>
            <button type="button" onClick={() => setResult(result.map((w) => ({ ...w, on: !w.dup })))} style={smallBtn()}>모두 고르기</button>
            <button type="button" onClick={() => setResult(result.map((w) => ({ ...w, on: false })))} style={smallBtn()}>모두 빼기</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {result.map((w, i) => (
              <label key={`${w.word}-${i}`} title={w.dup ? '이미 목록에 있는 낱말' : w.standard ? `근거 ${w.standard}` : ''}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'white', border: `1px solid ${w.on && !w.dup ? '#C4B5FD' : '#E2E8F0'}`, opacity: w.dup ? 0.45 : 1, cursor: w.dup ? 'not-allowed' : 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>
                <input type="checkbox" disabled={w.dup} checked={w.on && !w.dup} onChange={() => setResult(result.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                <b>{w.word}</b><span style={{ color: '#475569' }}>{w.meaning}</span>
                {w.type === 'idiom' && <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 800 }}>숙어</span>}
                {w.dup && <span style={{ fontSize: 10, color: '#94A3B8' }}>이미 있음</span>}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" disabled={!chosen.length} onClick={() => { onAdd(chosen.map((w) => ({ id: newId('w'), word: w.word, meaning: w.meaning, ai: true, standard: w.standard, wordType: w.type }))); setResult(null); setOpen(false); }}
              style={{ ...smallBtn(), padding: '6px 14px', background: chosen.length ? '#2A75F3' : '#E2E8F0', color: chosen.length ? 'white' : '#94A3B8', border: '1px solid transparent', cursor: chosen.length ? 'pointer' : 'not-allowed' }}>
              고른 {chosen.length}개 추가
            </button>
          </div>
        </>
      )}
    </div>
  );
};
