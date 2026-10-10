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
import React, { useRef, useState } from 'react';
import ItemCard from './ItemCard';
import CropDialog from './CropDialog';
import { ITEM_TYPES, ITEM_TYPE_KEYS, ITEM_SCHEMA_VERSION, emptyAnswer, newId, recheckAnswer, changeItemType } from './lib/itemBank';

const btn = (primary, disabled) => ({
  padding: '8px 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' };
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 4, display: 'block' };
const chipBtn = (on) => ({ padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569' });

export const blankItem = (type = 'multiple_choice') => ({
  id: newId('itm'), schemaVersion: ITEM_SCHEMA_VERSION, number: '', itemType: type, stem: '', material: '',
  choices: type === 'binary_choice' ? [{ no: 1, text: '' }, { no: 2, text: '' }] : type === 'multiple_choice' ? [1, 2, 3, 4, 5].map((no) => ({ no, text: '' })) : [],
  matching: type === 'matching' ? { left: ['', ''], right: ['', ''] } : null, blankCount: type === 'completion' ? 1 : 0,
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
      <span style={label}>그림</span>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
          {hasPages && <button type="button" onClick={() => setCrop({ index: -1, initial: null })} style={btn(false)}>➕ 쪽에서 새로 자르기</button>}
          <button type="button" onClick={() => fileRef.current?.click()} style={btn(false)}>📎 내 그림 올리기</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onChange([...images, await readImageFile(f)]); }} />
        </div>
      </div>
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

const ItemEditForm = ({ initial, pages, mode = 'create', onSubmit, onCancel, submitLabel }) => {
  const [it, setIt] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : blankItem());
  const set = (patch) => setIt((x) => ({ ...x, ...patch }));
  const changeType = (type) => {
    if (mode === 'edit') { setIt((x) => changeItemType(x, type)); return; }
    const b = blankItem(type); setIt((x) => ({ ...b, id: x.id, stem: x.stem, material: x.material, images: x.images }));
  };
  const ensureChoices = (type, choices) => (type === 'binary_choice' ? [0, 1].map((i) => choices[i] || { no: i + 1, text: '' }) : choices);
  const choices = ['multiple_choice', 'binary_choice'].includes(it.itemType) ? ensureChoices(it.itemType, it.choices || []) : [];
  const matching = it.itemType === 'matching' ? (it.matching || { left: ['', ''], right: ['', ''] }) : null;
  const ready = it.stem.trim() && (!['multiple_choice', 'binary_choice'].includes(it.itemType) || choices.filter((c) => c.text.trim()).length >= 2);
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
    onSubmit(recheckAnswer(cleaned));
    if (mode === 'create') setIt(blankItem(it.itemType));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span style={label}>유형{mode === 'edit' ? ' (바꿔도 정답은 지워지지 않습니다)' : ''}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ITEM_TYPE_KEYS.map((k) => <button key={k} type="button" onClick={() => changeType(k)} style={chipBtn(it.itemType === k)} title={ITEM_TYPES[k].desc}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</button>)}
        </div>
      </div>
      <div><span style={label}>발문 *</span><textarea value={it.stem} onChange={(e) => set({ stem: e.target.value })} rows={2} placeholder="예: 다음 중 힘의 단위로 옳은 것은?" style={{ ...input, resize: 'vertical', borderColor: it.stem.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
      <div><span style={label}>&lt;보기&gt;·제시 자료 (선택)</span><textarea value={it.material || ''} onChange={(e) => set({ material: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      {choices.length > 0 && (
        <div>
          <span style={label}>{it.itemType === 'binary_choice' ? '두 낱말 *' : '보기 * (2개 이상)'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {choices.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 22, fontWeight: 800, color: '#64748B' }}>{it.itemType === 'binary_choice' ? (i ? 'B' : 'A') : '①②③④⑤⑥⑦⑧'[i]}</span>
                <input value={c.text} onChange={(e) => set({ choices: choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={input} />
                {it.itemType === 'multiple_choice' && choices.length > 2 && <button type="button" onClick={() => set({ choices: choices.filter((_, j) => j !== i).map((x, j) => ({ ...x, no: j + 1 })), answer: { ...it.answer, choices: [] } })} style={{ ...btn(false), padding: '4px 8px' }} aria-label="보기 삭제">✕</button>}
              </div>
            ))}
            {it.itemType === 'multiple_choice' && choices.length < 8 && <button type="button" onClick={() => set({ choices: [...choices, { no: choices.length + 1, text: '' }] })} style={{ ...btn(false), alignSelf: 'flex-start', padding: '4px 10px' }}>+ 보기 추가</button>}
          </div>
        </div>
      )}
      {matching && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['left', 'right'].map((side) => (
            <div key={side}><span style={label}>{side === 'left' ? '왼쪽 항목 (한 줄에 하나)' : '오른쪽 항목 (한 줄에 하나)'}</span>
              <textarea value={matching[side].join('\n')} rows={4} onChange={(e) => set({ matching: { ...matching, [side]: e.target.value.split('\n') } })} style={{ ...input, resize: 'vertical' }} /></div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {it.itemType === 'completion' && <div style={{ width: 140 }}><span style={label}>빈칸 수</span><input type="number" min={1} max={10} value={it.blankCount || 1} onChange={(e) => set({ blankCount: Math.max(1, Number(e.target.value) || 1) })} style={input} /></div>}
        <div style={{ width: 140 }}><span style={label}>배점 (선택)</span><input type="number" min={0} value={it.points ?? ''} onChange={(e) => set({ points: e.target.value === '' ? null : Number(e.target.value) })} style={input} /></div>
      </div>
      <ImageTools images={it.images || []} pages={pages} onChange={(images) => set({ images })} />
      <div>
        <span style={label}>미리 보기 · 정답 지정</span>
        <ItemCard item={{ ...it, number: mode === 'edit' ? it.number : '새', choices, matching: matching ? { left: matching.left.filter(Boolean), right: matching.right.filter(Boolean) } : null }} editable
          onChange={(x) => set({ answer: x.answer, answerSource: x.answerSource, issues: x.issues, itemType: x.itemType })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {onCancel && <button type="button" onClick={onCancel} style={btn(false)}>취소</button>}
        <button type="button" onClick={submit} disabled={!ready} style={btn(true, !ready)} title={ready ? '' : '발문과 보기를 입력해 주세요'}>{submitLabel || (mode === 'edit' ? '저장' : '+ 이 문항 담기')}</button>
      </div>
    </div>
  );
};

/** 문항 편집 모달 — 확인·선택 단계 · 문제 은행 상세 · 정답형 과제 배치에서 연다 */
export const ItemEditDialog = ({ open, item, pages, onSave, onClose, scopeNote }) => {
  if (!open || !item) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label="문항 편집" onClick={(e) => e.stopPropagation()}
        style={{ background: '#F8FAFC', borderRadius: 14, width: 'min(860px, 98vw)', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>✏️ 문항 편집 · {item.number}번</strong>
          {scopeNote && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{scopeNote}</span>}
          <button onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <ItemEditForm key={item.id} initial={item} pages={pages} mode="edit" onSubmit={(x) => { onSave(x); onClose(); }} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
};

export default ItemEditForm;
