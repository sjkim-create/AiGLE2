/**
 * ItemBankParts — 스마트 과제 등록(정답형) 확인 단계 · 문제 은행이 함께 쓰는 조각
 *   · BulkEditBar   — 고른 문항의 유형·성격 일괄 변경 (정답은 지우지 않는다)
 *   · applyTrack    — 문항 성격(교과/기초학력) 바꾸기
 *   · WorkbookPicker — 고른 문항을 문제집에 담기 (기존 문제집 / 새 문제집)
 */
import React, { useEffect, useState } from 'react';
import { ITEM_TYPES, ITEM_TYPE_KEYS, TRACKS, WORKBOOK_PURPOSES, changeItemType, listWorkbooks, putWorkbook, addToWorkbook, newId } from './lib/itemBank';

const btn = (primary, disabled) => ({
  padding: '7px 12px', borderRadius: 8, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const selectStyle = { padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, background: 'white', color: '#334155' };

/**
 * 문항 성격 바꾸기
 *   기초학력 → 단원·성취기준 요구 안 함 (단원 확인 항목 제거, 성취기준 비움). 단원 정보는 남겨 교과로 되돌릴 때 쓴다
 *   교과     → 단원 성취기준 다시 연결. 단원이 없으면 「단원을 골라 주세요」
 */
export const applyTrack = (item, track, { unitOptions = [], skill = '' } = {}) => {
  if ((item.track || 'curriculum') === track) return item;
  const rest = (item.issues || []).filter((i) => i.field !== '단원' && i.field !== '성취기준');
  if (track === 'basic') {
    return { ...item, track, skill: item.skill || skill, curriculum: { ...item.curriculum, standardsBasis: 'none', standards: [] }, issues: rest };
  }
  const opt = unitOptions.find((o) => o.areaId === item.unit?.areaId);
  return {
    ...item, track,
    curriculum: { ...item.curriculum, standardsBasis: 'unit', standards: opt ? opt.standards : [] },
    issues: opt ? rest : [{ level: 'warn', field: '단원', message: '교과 문항으로 바꿨습니다. 단원을 골라 주세요.' }, ...rest],
  };
};

/** 고른 문항 일괄 변경 바 — onApply(바뀐 문항 배열) */
export const BulkEditBar = ({ items, onApply, unitOptions, skill, children }) => {
  const [type, setType] = useState('');
  const n = items.length;
  const applyType = () => { if (!type) return; onApply(items.map((it) => changeItemType(it, type))); setType(''); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>고른 {n}개</span>
      <select value={type} onChange={(e) => setType(e.target.value)} disabled={!n} style={selectStyle} title="유형을 바꿔도 정답은 지워지지 않습니다">
        <option value="">유형 일괄 변경…</option>
        {ITEM_TYPE_KEYS.map((k) => <option key={k} value={k}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</option>)}
      </select>
      <button type="button" onClick={applyType} disabled={!n || !type} style={btn(false, !n || !type)}>적용</button>
      <span style={{ width: 1, height: 18, background: '#E2E8F0' }} />
      {Object.entries(TRACKS).map(([k, t]) => (
        <button key={k} type="button" disabled={!n} title={t.desc}
          onClick={() => onApply(items.map((it) => applyTrack(it, k, { unitOptions, skill })))} style={btn(false, !n)}>
          {k === 'basic' ? '🧩' : '📘'} {t.label}로
        </button>
      ))}
      {children}
    </div>
  );
};

/** 문제집에 담기 — 기존 문제집에 추가하거나 새로 만든다 */
export const WorkbookPicker = ({ open, itemIds, defaultTitle = '', defaultPurpose = 'exam', onClose, onDone }) => {
  const [workbooks, setWorkbooks] = useState([]);
  const [target, setTarget] = useState('new');
  const [title, setTitle] = useState(defaultTitle);
  const [purpose, setPurpose] = useState(defaultPurpose);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle); setPurpose(defaultPurpose); setTarget('new');
    listWorkbooks().then((ws) => setWorkbooks(ws.filter((w) => w.kind !== 'word'))).catch(() => setWorkbooks([])); // 낱말 문제집은 문항을 담지 않는다
  }, [open, defaultTitle, defaultPurpose]);
  if (!open) return null;
  const canSave = itemIds.length > 0 && (target !== 'new' || title.trim());
  const save = async () => {
    setSaving(true);
    try {
      let wb;
      if (target === 'new') wb = { id: newId('wb'), title: title.trim(), purpose, itemIds: [...itemIds] };
      else wb = addToWorkbook(workbooks.find((w) => w.id === target), itemIds);
      await putWorkbook(wb);
      onDone && onDone(wb, target === 'new');
    } finally { setSaving(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="문제집에 담기" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '20px 22px', width: 460, maxWidth: '94vw' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>📚 문제집에 담기</h3>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>고른 문항 {itemIds.length}개를 문제집 끝에 순서대로 담습니다. 다른 문제집에 이미 담긴 문항도 얼마든지 다시 담을 수 있습니다(같은 문제집 안에서만 겹치지 않게 건너뜁니다).</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, marginBottom: 8, cursor: 'pointer' }}>
          <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')} /> 새 문제집 만들기
        </label>
        {target === 'new' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, paddingLeft: 24 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문제집 이름" maxLength={60}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${title.trim() ? '#CBD5E1' : '#FCA5A5'}`, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }} />
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ ...selectStyle, fontSize: 'var(--neo-font-size-sm)' }}>
              {Object.entries(WORKBOOK_PURPOSES).map(([k, p]) => <option key={k} value={k}>{p.icon} {p.label}</option>)}
            </select>
          </div>
        )}
        {workbooks.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {workbooks.map((w) => (
              <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', padding: '4px 0' }}>
                <input type="radio" checked={target === w.id} onChange={() => setTarget(w.id)} />
                {WORKBOOK_PURPOSES[w.purpose]?.icon} {w.title} <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>문항 {w.itemIds.length}개</span>
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ ...btn(false), fontSize: 'var(--neo-font-size-sm)', padding: '9px 16px' }}>취소</button>
          <button type="button" onClick={save} disabled={!canSave || saving} style={{ ...btn(true, !canSave || saving), fontSize: 'var(--neo-font-size-sm)', padding: '9px 16px' }}>{saving ? '담는 중…' : '담기'}</button>
        </div>
      </div>
    </div>
  );
};
