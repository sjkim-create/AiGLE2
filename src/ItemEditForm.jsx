/**
 * ItemEditForm — 정답형 문항 만들기·고치기 공용 화면 (TSK-15 직접 작성 · QBK-01/TSK-15 문항 편집)
 *
 * 직접 작성(create)과 문항 편집(edit)이 같은 화면을 쓴다 — 교사가 한 화면만 익히면 된다.
 *   유형 · 발문 · <보기>·제시 자료 · 보기/두 낱말/연결 항목/빈칸 수 · 배점 · 그림 · 정답(미리 보기 카드)
 *   그림: [✂️ 범위 조정](원본 쪽 위 상자) · [➕ 쪽에서 새로 자르기] · [📎 내 그림 올리기] · [🗑 빼기]
 *         원본 쪽(pages)이 있을 때만 범위 조정·새로 자르기가 보인다
 * edit에서 유형을 바꾸면 정답을 지우지 않는다 (changeItemType)
 * ItemEditDialog — edit를 모달로 띄우는 포장
 */
import React, { useEffect, useRef, useState } from 'react';
import ItemCard from './ItemCard';
import { FormulaModal } from './TaskDirectInputWizard';
import CropDialog from './CropDialog';
import { ITEM_TYPES, ITEM_TYPE_KEYS, ITEM_SCHEMA_VERSION, TRACKS, emptyAnswer, newId, recheckAnswer, changeItemType, BLANK_MARK, countBlanks, remapBlankAnswers } from './lib/itemBank';
import { applyTrack, applyUnit, applySubject, SubjectPicker } from './ItemBankParts';
import { loadCatalog } from './lib/taskFromFile';
import { unitOptionsFor } from './lib/itemExtract';

const btn = (primary, disabled) => ({
  padding: '8px 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' };
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 4, display: 'block' };

// ƒx 수식 — 입력칸 오른쪽 안에 두는 버튼 (서·논술 평가 내용과 같은 수식 편집기, 수식은 $$LaTeX$$로 저장)
const fxBtn = { position: 'absolute', right: 6, top: 6, padding: '3px 10px', border: '1px solid #CBD5E1', background: 'white', color: '#334155', borderRadius: 6, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.5 };
const WithFx = ({ onFx, center = false, children }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
    {children}
    <button type="button" onClick={onFx} title="수식 넣기 · 고치기" style={center ? { ...fxBtn, top: '50%', transform: 'translateY(-50%)', padding: '1px 8px' } : fxBtn}><i style={{ fontFamily: 'serif' }}>ƒ</i><sub style={{ fontSize: '0.7em' }}>x</sub> 수식</button>
  </div>
);

// 편집 화면 묶음 — 관련 항목끼리 한 상자에
const Section = ({ title, note, children }) => (
  <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      <strong style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>{title}</strong>
      {note && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{note}</span>}
    </div>
    {children}
  </section>
);
const Field = ({ label: text, hint, children }) => (
  <div style={{ minWidth: 0 }}>
    <span style={label}>{text}</span>
    {children}
    {hint && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 4 }}>{hint}</div>}
  </div>
);

export const blankItem = (type = 'multiple_choice') => ({
  id: newId('itm'), schemaVersion: ITEM_SCHEMA_VERSION, number: '', itemType: type, stem: '', material: '',
  choices: type === 'binary_choice' ? [{ no: 1, text: '' }, { no: 2, text: '' }] : type === 'multiple_choice' ? [1, 2, 3, 4, 5].map((no) => ({ no, text: '' })) : [],
  matching: type === 'matching' ? { left: ['', ''], right: ['', ''] } : null, blankCount: 0,
  answer: emptyAnswer(), answerSource: 'teacher', explanation: '', points: null, images: [], passageId: null,
  unit: { label: '', areaId: null, areaName: '', source: 'none' }, track: 'curriculum', skill: '',
  curriculum: { standardsBasis: 'unit', standards: [] }, source: { sourceId: null, fileName: '직접 작성', page: null },
  lineage: { rootId: null, parentId: null, derivation: null }, issues: [], createdAt: '', updatedAt: '',
});

// 올린 그림 — 긴 변 1200px JPEG로 줄인다
const readImageFile = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 1200 / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    resolve({ label: file.name.replace(/\.[^.]+$/, ''), dataUrl, bytes: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75), page: null, box: null, origin: 'upload' });
  };
  im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 열 수 없습니다.')); };
  im.src = url;
});

/** 그림 영역 — 문항 편집·서·논술 모범답안이 함께 쓴다 */
export const ImageTools = ({ images, pages, onChange }) => {
  const [crop, setCrop] = useState(null); // { index | -1(새로), initial }
  const fileRef = useRef(null);
  const hasPages = (pages || []).length > 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...label, marginBottom: 0 }}>그림</span>
        {hasPages && <button type="button" onClick={() => setCrop({ index: -1, initial: null })} style={{ ...btn(false), padding: '5px 10px' }}>➕ 쪽에서 새로 자르기</button>}
        <button type="button" onClick={() => fileRef.current?.click()} style={{ ...btn(false), padding: '5px 10px' }}>📎 내 그림 올리기</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onChange([...images, await readImageFile(f)]); }} />
      </div>
      {images.length > 0 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {images.map((im, i) => (
          <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 6, width: 180, background: 'white' }}>
            <img src={im.dataUrl} alt={im.label} style={{ width: '100%', height: 110, objectFit: 'contain', background: '#F8FAFC', borderRadius: 6 }} />
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={im.label}>
              {im.origin === 'ai' ? '🤖 AI가 자름' : im.origin === 'upload' ? '📎 올린 그림' : '✂️ 교사가 자름'}{im.page ? ` · ${im.page}쪽` : ''}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {hasPages && im.page && <button type="button" onClick={() => setCrop({ index: i, initial: { page: im.page, box: im.box, dataUrl: im.dataUrl } })} style={{ ...btn(false), padding: '4px 8px', flex: 1 }}>✂️ 범위 조정</button>}
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} style={{ ...btn(false), padding: '4px 8px', color: '#DC2626' }} aria-label="그림 빼기">🗑</button>
            </div>
          </div>
        ))}
      </div>}
      {!hasPages && images.some((im) => im.origin === 'ai') && (
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>원본 쪽 이미지가 없는 자료라 범위 조정은 할 수 없습니다. 그림을 빼고 내 그림을 올려 주세요.</div>
      )}
      <CropDialog open={!!crop} pages={pages || []} initial={crop?.initial} title={crop?.index === -1 ? '쪽에서 새로 자르기' : '그림 범위 조정'}
        label={crop?.index >= 0 ? images[crop.index]?.label : '그림'}
        onClose={() => setCrop(null)}
        onApply={(img) => { onChange(crop.index >= 0 ? images.map((x, j) => (j === crop.index ? img : x)) : [...images, img]); setCrop(null); }} />
    </div>
  );
};

/* unitOptions — 이 문항 교과의 단원 목록. 넘기지 않으면(undefined) 단원 칸을 두지 않는다 */
/* onDraft(it) — 고치는 중인 내용을 바깥(문제 은행 편집 패널)에 알린다 — 저장 안 한 내용 확인용 */
/* leftActions — 버튼 줄 왼쪽(예: 🗑 삭제) · stickyActions — 버튼 줄을 패널 아래에 고정 (QBK-01 v1.30 — 삭제 · 저장을 한 줄에) */
const ItemEditForm = ({ initial, pages, mode = 'create', onSubmit, onCancel, submitLabel, hideNumber = false, unitOptions, onDraft, leftActions = null, stickyActions = false }) => {
  const [it, setIt] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : blankItem());
  // 교과 · 단원 — 단원 칸을 쓰는 곳(unitOptions를 넘긴 곳)에서만 카탈로그를 읽어 이 문항 교과의 단원 목록을 만든다
  const [cat, setCat] = useState(null);
  useEffect(() => { if (unitOptions !== undefined) loadCatalog().then(setCat).catch(() => setCat(null)); }, [unitOptions !== undefined]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (onDraft) onDraft(it); }, [it]); // eslint-disable-line react-hooks/exhaustive-deps
  const units = cat && it.curriculum?.subjectId != null ? unitOptionsFor(cat, it.curriculum.subjectId) : (unitOptions || []);
  const set = (patch) => setIt((x) => ({ ...x, ...patch }));
  // 완성형 — 빈칸 수는 지문의 [빈칸] 표시 개수로 정한다
  const stemRef = useRef(null);
  // 빈칸 정답은 자기 빈칸을 따라간다 (앞에 빈칸을 넣으면 ①의 정답이 ②로)
  const setStem = (stem) => setIt((x) => ({ ...x, stem, blankCount: countBlanks(stem), answer: { ...emptyAnswer(), ...(x.answer || {}), blanks: remapBlankAnswers(x.stem, stem, x.answer?.blanks) } }));
  const insertBlank = () => {
    const el = stemRef.current;
    const at = el ? el.selectionStart : it.stem.length;
    const end = el ? el.selectionEnd : at;
    setStem(it.stem.slice(0, at) + BLANK_MARK + it.stem.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(at + BLANK_MARK.length, at + BLANK_MARK.length); } });
  };
  const blanks = it.itemType === 'completion' ? countBlanks(it.stem) : null;
  const [fx, setFx] = useState(null); // { field: 'stem' | 'material' | 'choice', index, value }
  const changeType = (type) => {
    if (mode === 'edit') { setIt((x) => changeItemType(x, type)); return; }
    const b = blankItem(type); setIt((x) => ({ ...b, id: x.id, stem: x.stem, material: x.material, images: x.images, track: x.track, skill: x.skill, curriculum: x.curriculum }));
  };
  const ensureChoices = (type, choices) => (type === 'binary_choice' ? [0, 1].map((i) => choices[i] || { no: i + 1, text: '' }) : choices);
  const choices = ['multiple_choice', 'binary_choice'].includes(it.itemType) ? ensureChoices(it.itemType, it.choices || []) : [];
  const matching = it.itemType === 'matching' ? (it.matching || { left: ['', ''], right: ['', ''] }) : null;
  const ready = it.stem.trim() && blanks !== 0 && (!['multiple_choice', 'binary_choice'].includes(it.itemType) || choices.filter((c) => c.text.trim()).length >= 2);
  // 고칠 때는 바뀐 내용이 있어야 [저장]이 켜진다 (열자마자 켜져 있으면 저장할 게 있는 것처럼 보인다)
  const [initialJson] = useState(() => JSON.stringify(it));
  const changed = mode !== 'edit' || JSON.stringify(it) !== initialJson;
  const submit = () => {
    const now = new Date().toISOString();
    const cleaned = {
      ...it,
      choices: choices.filter((c) => c.text.trim()).map((c, i) => ({ no: i + 1, text: c.text.trim() })),
      matching: matching ? { left: matching.left.filter((x) => x.trim()), right: matching.right.filter((x) => x.trim()) } : null,
      updatedAt: now, createdAt: it.createdAt || now,
      lineage: it.lineage?.rootId ? it.lineage : { rootId: it.id, parentId: null, derivation: null },
    };
    // 교사가 그림을 고쳐 AI가 자른 그림이 남지 않으면 「잘린 범위를 확인해 주세요」 안내를 지운다
    if (!(cleaned.images || []).some((im) => im.origin === 'ai')) cleaned.issues = (cleaned.issues || []).filter((x) => x.field !== '그림');
    if (countBlanks(cleaned.stem)) cleaned.issues = (cleaned.issues || []).filter((x) => x.field !== '빈칸');
    onSubmit(recheckAnswer(cleaned));
    if (mode === 'create') setIt({ ...blankItem(it.itemType), track: it.track, skill: it.skill, curriculum: it.curriculum }); // 수준은 다음 문항에도 이어 쓴다
  };
  const trackKey = it.track || 'curriculum';
  const setTrack = (k) => setIt((x) => (mode === 'edit' ? applyTrack(x, k) : { ...x, track: k, curriculum: { ...x.curriculum, standardsBasis: k === 'basic' ? 'none' : 'unit', standards: [] } }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ① 문항 정보 — 유형 · 수준 · 배점 (+ 교과 · 단원) */}
      <Section title="문항 정보">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <Field label="유형" hint={mode === 'edit' ? '바꿔도 정답은 지워지지 않아요.' : ''}>
            <select value={it.itemType} onChange={(e) => changeType(e.target.value)} style={input} title={ITEM_TYPES[it.itemType]?.desc}>
              {ITEM_TYPE_KEYS.map((k) => <option key={k} value={k}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</option>)}
            </select>
          </Field>
          {/* 수준 — 학년 수준(단원·성취기준) / 기초학력(기초 기능). 스마트 등록은 AI가 자료를 보고 정한다 */}
          <Field label="수준">
            <select value={trackKey} onChange={(e) => setTrack(e.target.value)} style={input} title={TRACKS[trackKey]?.desc}>
              {Object.entries(TRACKS).map(([k, t]) => <option key={k} value={k}>{k === 'basic' ? '🧩' : '📘'} {t.label}</option>)}
            </select>
          </Field>
          {trackKey === 'basic' && (
            <Field label="기초 기능 (선택)">
              <input value={it.skill || ''} onChange={(e) => set({ skill: e.target.value })} placeholder="예: 받침 읽기" maxLength={40} style={input} />
            </Field>
          )}
          <Field label="배점 (선택)">
            <input type="number" min={0} value={it.points ?? ''} onChange={(e) => set({ points: e.target.value === '' ? null : Number(e.target.value) })} style={input} />
          </Field>
        </div>
        {/* 교과 · 단원 — 학년 수준 문항만. 교과를 못 정했으면 교과부터 고른다(학교급 → 학년 → 교과), 그다음 단원 */}
        {unitOptions !== undefined && trackKey !== 'basic' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 10 }}>
            <Field label="교과">
              {/* 고른 뒤에도 셀렉트를 그대로 둔다 — 바꾸면 단원을 다시 고른다 */}
              <SubjectPicker key={cat ? 'cat' : 'loading'} cat={cat} value={it.curriculum?.subjectId} onPick={(cur) => setIt((x) => applySubject(x, cur))} />
            </Field>
            <Field label="단원">
              {units.length ? (
                <select value={it.unit?.areaId ?? ''} onChange={(e) => { const opt = units.find((o) => o.areaId === Number(e.target.value)); setIt((x) => applyUnit(x, opt)); }}
                  style={{ ...input, borderColor: it.unit?.areaId ? '#CBD5E1' : '#FCA5A5' }}>
                  <option value="">단원 선택</option>
                  {units.map((o) => <option key={o.areaId} value={o.areaId}>📘 {o.name}{it.unit?.source === 'ai' && it.unit?.areaId === o.areaId ? ' (AI 추정)' : ''}</option>)}
                </select>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', minHeight: 36, fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>교과를 먼저 고르세요.</span>
              )}
            </Field>
          </div>
        )}
      </Section>

      {/* ② 문제 — 발문 · 제시 자료 · 보기(또는 연결 항목) · 그림 */}
      <Section title="문제">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="지문 및 문항 *">
            <WithFx onFx={() => setFx({ field: 'stem', value: it.stem })}>
              <textarea ref={stemRef} value={it.stem} onChange={(e) => setStem(e.target.value)} rows={6} placeholder="예: 다음 중 힘의 단위로 옳은 것은?" style={{ ...input, resize: 'vertical', paddingRight: 84, borderColor: it.stem.trim() && blanks !== 0 ? '#CBD5E1' : '#FCA5A5' }} />
            </WithFx>
            {blanks !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={insertBlank} style={{ padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, border: '1px solid #94A3B8', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>＋ 빈칸 넣기</button>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: blanks ? '#475569' : '#B91C1C' }}>{blanks ? `빈칸 ${blanks}개` : '빈칸 자리에 커서를 두고 누르세요.'}</span>
              </div>
            )}
          </Field>
          <Field label="<보기>·제시 자료 (선택)">
            <WithFx onFx={() => setFx({ field: 'material', value: it.material || '' })}>
              <textarea value={it.material || ''} onChange={(e) => set({ material: e.target.value })} rows={2} style={{ ...input, resize: 'vertical', paddingRight: 84 }} />
            </WithFx>
          </Field>
          {choices.length > 0 && (
            <Field label={it.itemType === 'binary_choice' ? '두 낱말 *' : '보기 * (2개 이상)'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {choices.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 22, fontWeight: 800, color: '#64748B' }}>{it.itemType === 'binary_choice' ? (i ? 'B' : 'A') : '①②③④⑤⑥⑦⑧'[i]}</span>
                    <WithFx center onFx={() => setFx({ field: 'choice', index: i, value: c.text })}>
                      <input value={c.text} onChange={(e) => set({ choices: choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={{ ...input, paddingRight: 84 }} />
                    </WithFx>
                    {it.itemType === 'multiple_choice' && choices.length > 2 && <button type="button" onClick={() => set({ choices: choices.filter((_, j) => j !== i).map((x, j) => ({ ...x, no: j + 1 })), answer: { ...it.answer, choices: [] } })} style={{ ...btn(false), padding: '4px 8px' }} aria-label="보기 삭제">✕</button>}
                  </div>
                ))}
                {it.itemType === 'multiple_choice' && choices.length < 8 && <button type="button" onClick={() => set({ choices: [...choices, { no: choices.length + 1, text: '' }] })} style={{ ...btn(false), alignSelf: 'flex-start', padding: '4px 10px' }}>+ 보기 추가</button>}
              </div>
            </Field>
          )}
          {matching && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['left', 'right'].map((side) => (
                <Field key={side} label={side === 'left' ? '왼쪽 항목 (한 줄에 하나)' : '오른쪽 항목 (한 줄에 하나)'}>
                  <textarea value={matching[side].join('\n')} rows={4} onChange={(e) => set({ matching: { ...matching, [side]: e.target.value.split('\n') } })} style={{ ...input, resize: 'vertical' }} />
                </Field>
              ))}
            </div>
          )}
          <ImageTools images={it.images || []} pages={pages} onChange={(images) => set({ images })} />
        </div>
      </Section>

      {/* ③ 정답 — 미리 보기에서 정답을 고른다 */}
      <Section title="정답" note="미리 보기에서 정답을 골라요.">
        <ItemCard hideMeta hideNumber={hideNumber} item={{ ...it, number: mode === 'edit' ? it.number : '새', choices, matching: matching ? { left: matching.left.filter(Boolean), right: matching.right.filter(Boolean) } : null }} editable
          onChange={(x) => set({ answer: x.answer, answerSource: x.answerSource, issues: x.issues, itemType: x.itemType })} />
      </Section>

      {fx && (
        <FormulaModal initialLatex={fx.value} onCancel={() => setFx(null)}
          onConfirm={(v) => {
            if (fx.field === 'choice') set({ choices: choices.map((x, j) => (j === fx.index ? { ...x, text: v } : x)) });
            else if (fx.field === 'stem') setStem(v);
            else set({ [fx.field]: v });
            setFx(null);
          }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, ...(stickyActions ? { position: 'sticky', bottom: -14, margin: '0 -14px -14px', padding: '10px 14px', background: 'white', borderTop: '1px solid #E2E8F0', zIndex: 2 } : {}) }}>
        {leftActions}{leftActions && <span style={{ flex: 1 }} />}
        {onCancel && <button type="button" onClick={onCancel} style={btn(false)}>취소</button>}
        <button type="button" onClick={submit} disabled={!ready || !changed} style={btn(true, !ready || !changed)} title={!ready ? '발문과 보기를 입력해 주세요' : !changed ? '고친 내용이 없습니다' : ''}>{submitLabel || (mode === 'edit' ? '저장' : '+ 이 문항 담기')}</button>
      </div>
    </div>
  );
};

/** 문항 편집 모달 — 확인·선택 단계 · 문제 은행 상세 · 정답형 과제 배치에서 연다 */
export const ItemEditDialog = ({ open, item, pages, onSave, onClose, scopeNote, hideNumber = false, unitOptions }) => {
  if (!open || !item) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label="문항 편집" onClick={(e) => e.stopPropagation()}
        style={{ background: '#F8FAFC', borderRadius: 14, width: 'min(860px, 98vw)', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>✏️ 문항 편집{!hideNumber && item.number ? ` · ${item.number}번` : ''}</strong>
          {scopeNote && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{scopeNote}</span>}
          <button onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <ItemEditForm key={item.id} initial={item} pages={pages} mode="edit" hideNumber={hideNumber} unitOptions={unitOptions} onSubmit={(x) => { onSave(x); onClose(); }} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
};

export default ItemEditForm;
