/**
 * ItemBankParts — 스마트 과제 등록(정답형) 확인 단계 · 문제 은행이 함께 쓰는 조각
 *   · BulkEditBar   — 고른 문항의 유형·성격 일괄 변경 (정답은 지우지 않는다)
 *   · applyTrack    — 문항 성격(교과/기초학력) 바꾸기
 *   · applyUnit     — 단원 지정(그 단원의 성취기준 연결) · UnitBulkSelect — 고른 문항 단원 일괄 지정
 *   · SubjectPicker · curriculumOf · applySubject — 교과를 확인하지 못한 문항 · 자료에 교과를 직접 지정 (학교급 → 학년 → 교과)
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
    issues: opt ? rest : [{ level: 'warn', field: '단원', message: '학년 수준 문항으로 바꿨습니다. 단원을 골라 주세요.' }, ...rest],
  };
};

/* ── 교과 직접 지정 ──
 *   AI가 교과를 맞추지 못하면(성취기준 코드도 교과명도 목록과 안 맞음) 단원을 고를 수 없다 → 교사가 교과를 고른다 */
/** 교과(과목 id) → 문항 · 자료의 교육과정 정보 */
export const curriculumOf = (cat, subjectId) => {
  const subject = cat?.subjects?.[subjectId];
  if (!subject) return null;
  const cu = cat.curricula[subject.curriculumId] || {};
  const gr = cat.grades[cu.gradeId] || {};
  const lv = cat.levels[gr.level] || {};
  return {
    schoolLevelCode: lv.code ?? null, schoolLevelName: lv.name || '',
    gradeId: cu.gradeId ?? null, gradeLabel: gr.name || '',
    curriculumId: subject.curriculumId ?? null, curriculumName: cu.name || '',
    subjectId: Number(subjectId), subjectName: subject.name || '',
  };
};
/** 문항에 교과를 지정 — 단원 · 성취기준은 비우고 「단원을 골라 주세요」. 정답 · 유형은 그대로 */
export const applySubject = (item, cur) => {
  if (!cur) return item;
  const rest = (item.issues || []).filter((i) => !['단원', '성취기준', '교육과정', '과목'].includes(i.field));
  const isBasic = (item.track || 'curriculum') === 'basic';
  return {
    ...item,
    curriculum: { ...item.curriculum, ...cur, standardsBasis: isBasic ? 'none' : 'unit', standards: [] },
    unit: { ...(item.unit || { label: '' }), areaId: null, areaName: '', source: 'none' },
    issues: isBasic ? rest : [{ level: 'warn', field: '단원', message: '단원을 골라 주세요.' }, ...rest],
  };
};
/** 학교급 → 학년 → 교과 선택. onPick(curriculumOf 결과) */
export const SubjectPicker = ({ cat, value, onPick, compact = false }) => {
  const curOf = value ? curriculumOf(cat, value) : null;
  const [level, setLevel] = useState(() => (curOf ? Object.keys(cat?.levels || {}).find((k) => cat.levels[k].code === curOf.schoolLevelCode) || '' : ''));
  const [gradeId, setGradeId] = useState(() => (curOf?.gradeId != null ? String(curOf.gradeId) : ''));
  if (!cat) return <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>교육과정 목록을 불러오는 중…</span>;
  const grades = Object.entries(cat.grades).filter(([, g]) => g.level === level);
  const subjects = Object.entries(cat.subjects).filter(([, s]) => String(cat.curricula[s.curriculumId]?.gradeId) === gradeId)
    .map(([id, s]) => {
      const cu = cat.curricula[s.curriculumId]?.name || '';
      return { id, label: cu && cu !== s.name ? `${cu} › ${s.name}` : s.name };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  const sel = { ...selectStyle, fontSize: compact ? 'var(--neo-font-size-xs)' : 'var(--neo-font-size-sm)' };
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={level} onChange={(e) => { setLevel(e.target.value); setGradeId(''); }} aria-label="학교급" style={sel}>
        <option value="">학교급</option>
        {Object.entries(cat.levels).sort((a, b) => a[1].code - b[1].code).map(([k, l]) => <option key={k} value={k}>{l.name}</option>)}
      </select>
      <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} disabled={!level} aria-label="학년" style={sel}>
        <option value="">학년</option>
        {grades.map(([id, g]) => <option key={id} value={id}>{g.name}</option>)}
      </select>
      <select value={value != null && subjects.some((s) => s.id === String(value)) ? String(value) : ''} disabled={!gradeId} aria-label="교과"
        onChange={(e) => { const cur = curriculumOf(cat, e.target.value); if (cur) onPick(cur); }} style={{ ...sel, maxWidth: 260 }}>
        <option value="">교과</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </span>
  );
};

/**
 * 단원 지정 — 단원(핵심평가영역)을 고르면 그 단원의 성취기준을 연결한다. 정답 · 유형은 그대로.
 *   opt 없음(선택 해제) → 단원 비움 + 「단원을 골라 주세요」
 */
export const applyUnit = (item, opt) => {
  const unit = item.unit || { areaId: null, areaName: '', label: '', source: 'none' };
  return {
    ...item,
    unit: { ...unit, areaId: opt?.areaId ?? null, areaName: opt?.name || '', source: opt ? 'teacher' : 'none' },
    curriculum: { ...item.curriculum, standardsBasis: 'unit', standards: opt ? opt.standards : [] },
    issues: [...(opt ? [] : [{ level: 'warn', field: '단원', message: '단원을 골라 주세요.' }]), ...(item.issues || []).filter((i) => i.field !== '단원' && i.field !== '성취기준')],
  };
};

/**
 * 고른 문항 단원 일괄 지정 — 학년 수준(교과) 문항에만, 단원 목록과 같은 교과의 문항에만 적용한다.
 *   기초학력 문항 · 다른 교과 문항은 건너뛴다(정답 · 유형은 그대로)
 */
const UnitBulkSelect = ({ items, onApply, unitOptions }) => {
  const opts = unitOptions || [];
  const sid = items.find((it) => (it.track || 'curriculum') !== 'basic')?.curriculum?.subjectId;
  const targets = items.filter((it) => (it.track || 'curriculum') !== 'basic' && it.curriculum?.subjectId === sid);
  if (!opts.length) return null;
  return (
    <select value="" disabled={!targets.length} style={selectStyle}
      title={targets.length < items.length ? `학년 수준 문항 ${targets.length}개에만 적용합니다` : '고른 문항의 단원을 한 번에 바꿉니다 · 정답은 그대로'}
      onChange={(e) => {
        const opt = opts.find((o) => o.areaId === Number(e.target.value));
        if (!opt) return;
        onApply(targets.map((it) => applyUnit(it, opt)));
      }}>
      <option value="">📘 단원 일괄 지정…</option>
      {opts.map((o) => <option key={o.areaId} value={o.areaId}>📘 {o.name}</option>)}
    </select>
  );
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
          {k === 'basic' ? '🧩' : '📘'} {t.label}으로
        </button>
      ))}
      <UnitBulkSelect items={items} onApply={onApply} unitOptions={unitOptions} />
      {children}
    </div>
  );
};

/** 문항 메뉴 선택 메뉴 — [유형 변경 ▾] [학년 수준으로] [기초학력으로] + children(문제집 만들기 · 삭제) */
export const BulkActions = ({ items, onApply, unitOptions, skill, children }) => {
  const [menu, setMenu] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <button type="button" aria-haspopup="menu" aria-expanded={menu} disabled={!n} title="유형을 바꿔도 정답은 지워지지 않습니다"
          onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }} style={btn(false, !n)}>🔀 유형 변경 ▾</button>
        {menu && (
          <div role="menu" style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 30, minWidth: 150, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: 4 }}>
            {ITEM_TYPE_KEYS.map((k) => (
              <button key={k} type="button" role="menuitem" onClick={() => { setMenu(false); onApply(items.map((it) => changeItemType(it, k))); }}
                style={{ display: 'flex', gap: 8, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 6, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#334155', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <span aria-hidden="true">{ITEM_TYPES[k].icon}</span>{ITEM_TYPES[k].label}
              </button>
            ))}
          </div>
        )}
      </div>
      {Object.entries(TRACKS).map(([k, t]) => (
        <button key={k} type="button" disabled={!n} title={t.desc}
          onClick={() => onApply(items.map((it) => applyTrack(it, k, { unitOptions, skill })))} style={btn(false, !n)}>
          {k === 'basic' ? '🧩' : '📘'} {t.label}으로
        </button>
      ))}
      <UnitBulkSelect items={items} onApply={onApply} unitOptions={unitOptions} />
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
