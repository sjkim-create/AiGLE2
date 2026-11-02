/**
 * AnswerArrange — 정답형 과제 배치 화면 공용 (TSK-15 v1.8)
 *
 * 배치와 기본 정보를 한 화면에서 정한다 — 별도 「기본 정보」 단계를 두지 않는다.
 *   · BasicInfoCard: 과제명 · 교육과정(학교급·학년·교과·과목) · 문항 수·총점·유형 · 정답 없는 문항 경고 + 저장 버튼(children)
 *   · ArrangeRows: 문항마다 번호(⠿ 끌어서 옮기기) · 배점 · ✕ · 문항 카드([✏️ 문항 편집], 유형·정답 바로 수정)
 * 쓰는 곳: 정답형 직접·스마트 등록(AnswerTaskWizard 2단계) · 정답형 과제 › 문제집 상세(ItemBank)
 */
import React from 'react';
import ItemCard from './ItemCard';
import { ITEM_TYPES, hasAnswer } from './lib/itemBank';
import { loadCatalog } from './lib/taskFromFile';
import { reorderByDrop, scrollParentOf } from './WorkbookLayout';

const btn = (primary, disabled) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' };
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 4, display: 'block' };
const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 18px', boxSizing: 'border-box' };
export const SCHOOL_LEVELS = ['초등학교', '중학교', '고등학교'];

// 담은 문항에서 가장 많은 교육과정 — 교사가 고칠 수 있는 기본값
export const topCurriculum = (items) => {
  const counts = {};
  items.forEach((it) => {
    const c = it.curriculum || {};
    const k = [c.schoolLevelName, c.gradeLabel, c.curriculumName, c.subjectName].map((x) => x || '').join('|');
    if (c.subjectName || c.schoolLevelName) counts[k] = (counts[k] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return { schoolLevelName: '', gradeLabel: '', curriculumName: '', subjectName: '' };
  const [schoolLevelName, gradeLabel, curriculumName, subjectName] = top[0].split('|');
  return { schoolLevelName, gradeLabel, curriculumName, subjectName };
};

// 문항 수 · 총점 · 유형 · 정답 없는 문항 경고 + 오른쪽 버튼(children)
export const ArrangeSummary = ({ entries, children }) => {
  const total = entries.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const noAnswer = entries.filter((e) => !hasAnswer(e.item)).length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>✅ 정답형 · 문항 {entries.length}개 · 총 {total}점</span>
      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{[...new Set(entries.map((e) => ITEM_TYPES[e.item.itemType]?.label))].filter(Boolean).join(' · ')}</span>
      {noAnswer > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>정답 없는 문항 {noAnswer}개 — 저장은 되지만 채점 전에 정답이 필요합니다</span>}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</span>
    </div>
  );
};

// 단계 표시 — 누르면 그 단계로 (단계 강제 없음)
export const StepChips = ({ steps, step, onStep }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="단계">
    {steps.map((l, i) => {
      const n = i + 1; const st = n < step ? 'done' : n === step ? 'now' : 'todo';
      return (
        <button key={l} type="button" role="tab" aria-selected={n === step} onClick={() => onStep(n)}
          style={{ padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: st === 'now' ? '#EFF6FF' : st === 'done' ? '#ECFDF5' : '#F8FAFC', color: st === 'now' ? '#1D4ED8' : st === 'done' ? '#047857' : '#94A3B8', border: `1px solid ${st === 'now' ? '#93C5FD' : st === 'done' ? '#A7F3D0' : '#E2E8F0'}` }}>
          {st === 'done' ? `✓ ${l}` : `${n}. ${l}`}
        </button>
      );
    })}
  </div>
);

// titleLabel · onTitleBlur — 문제집 상세에서는 「문제집 이름」으로 쓴다
// extra — 이름 다음 칸에 넣는 입력(문제집 성격 등)
export const BasicInfoCard = ({ title, onTitle, onTitleBlur, titleLabel = '과제명', curriculum, onCurriculum, onCurriculumBlur, entries, children, extra = null }) => {
  const allBasic = entries.length > 0 && entries.every((e) => e.item.track === 'basic');
  const setC = (k, v) => { onCurriculum({ ...curriculum, [k]: v }); };
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(220px, 2fr) repeat(${extra ? 5 : 4}, minmax(110px, 1fr))`, gap: 10, alignItems: 'end' }}>
        <div><span style={label}>{titleLabel} *</span>
          <input value={title} onChange={(e) => onTitle(e.target.value)} onBlur={onTitleBlur} maxLength={100} placeholder="예: 1학기 중간고사 과학" aria-label={titleLabel}
            style={{ ...input, borderColor: title.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
        {extra}
        <div><span style={label}>학교급</span>
          <select value={curriculum.schoolLevelName || ''} onChange={(e) => setC('schoolLevelName', e.target.value)} onBlur={onCurriculumBlur} aria-label="학교급" style={input}>
            <option value="">{allBasic ? '기초학력' : '선택'}</option>
            {[...new Set([...SCHOOL_LEVELS, curriculum.schoolLevelName].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><span style={label}>학년</span><input value={curriculum.gradeLabel || ''} onChange={(e) => setC('gradeLabel', e.target.value)} placeholder="예: 1-3학년" aria-label="학년" onBlur={onCurriculumBlur} style={input} /></div>
        <div><span style={label}>교과</span><input value={curriculum.curriculumName || ''} onChange={(e) => setC('curriculumName', e.target.value)} placeholder="예: 과학" aria-label="교과" onBlur={onCurriculumBlur} style={input} /></div>
        <div><span style={label}>과목</span><input value={curriculum.subjectName || ''} onChange={(e) => setC('subjectName', e.target.value)} placeholder="예: 과학" aria-label="과목" onBlur={onCurriculumBlur} style={input} /></div>
      </div>
      <ArrangeSummary entries={entries}>{children}</ArrangeSummary>
    </div>
  );
};

// entries: [{ item, points }] · onChange(next) · onEdit(i) · onItemChange(i, item) — 유형·정답 바로 수정
export const ArrangeRows = ({ entries, onChange, passages = {}, onEdit, onItemChange, removeLabel = '빼기' }) => {
  // 순서 — [⠿ N번]을 잡고 끌어 놓는다 (v1.52 — ↑↓ 삭제). 손잡이를 잡을 때만 끌려 카드 안 정답 입력과 겹치지 않는다
  //   공통 지문 묶음은 함께 움직이고, 묶음 안 다른 문항 위에 놓으면 묶음 안에서 순서만 바꾼다 (문제집 배치와 같은 규칙)
  const [armed, setArmed] = React.useState(null);
  const [dragId, setDragId] = React.useState(null);
  const [over, setOver] = React.useState(null); // { id, before }
  const ids = entries.map((e) => e.item.id);
  const end = () => { setArmed(null); setDragId(null); setOver(null); };
  const dnd = (id) => ({
    draggable: armed === id,
    onDragStart: (ev) => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', id); setDragId(id); },
    onDragEnd: end,
    onDragOver: (ev) => {
      if (!dragId) return;
      ev.preventDefault();
      const before = ids.indexOf(id) < ids.indexOf(dragId);
      if (!over || over.id !== id || over.before !== before) setOver({ id, before });
      const sp = scrollParentOf(ev.currentTarget); const sr = sp === document.scrollingElement ? { top: 0, bottom: innerHeight } : sp.getBoundingClientRect();
      if (ev.clientY < sr.top + 60) sp.scrollBy(0, -24); else if (ev.clientY > sr.bottom - 60) sp.scrollBy(0, 24);
    },
    onDrop: (ev) => {
      ev.preventDefault();
      if (dragId) { const byId = Object.fromEntries(entries.map((e) => [e.item.id, e])); onChange(reorderByDrop(entries, dragId, id, ids.indexOf(id) < ids.indexOf(dragId)).map((x) => byId[x])); }
      end();
    },
  });
  return entries.map((e, i) => {
    const id = e.item.id;
    const target = over && over.id === id && dragId && dragId !== id;
    return (
    <div key={id} {...dnd(id)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', position: 'relative', borderRadius: 8, opacity: dragId === id ? 0.4 : 1,
      ...(target ? { boxShadow: over.before ? 'inset 0 4px 0 #2A75F3' : 'inset 0 -4px 0 #2A75F3', background: 'rgba(42,117,243,0.06)' } : {}) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', paddingTop: 8, width: 64 }}>
        <span role="button" aria-label={`${i + 1}번 끌어서 옮기기`} title="끌어서 옮기기" onMouseDown={() => setArmed(id)} onMouseUp={() => setArmed(null)}
          style={{ fontWeight: 900, color: '#2A75F3', cursor: 'grab', background: '#DBEAFE', borderRadius: 6, padding: '2px 6px', userSelect: 'none', whiteSpace: 'nowrap' }}>⠿ {i + 1}번</span>
        <input type="number" min={0} value={e.points} aria-label={`${i + 1}번 배점`}
          onChange={(ev) => onChange(entries.map((x, j) => (j === i ? { ...x, points: ev.target.value === '' ? '' : Number(ev.target.value) } : x)))}
          style={{ ...input, width: 56, textAlign: 'center', padding: '4px' }} />
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>점</span>
        <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))} aria-label={removeLabel} title={removeLabel} style={{ ...btn(false), padding: '2px 8px' }}>✕</button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ItemCard item={{ ...e.item, number: String(i + 1) }} passage={passages[e.item.passageId]} editable onEdit={() => onEdit?.(i)}
          onChange={(x) => onItemChange?.(i, { ...x, number: e.item.number })} />
      </div>
    </div>
  );
  });
};

// [TSK-15 v1.23] 문제집 기본 정보 — 위에서부터 성격 / 문제집 이름 / 학교급 · 학년 / 교과 · 과목
//   학년은 학교급에 맞는 목록 + 「공통」. 성격이 기초학력이어도 학년으로 구분한다 (v1.24)
export const GRADE_OPTIONS = {
  초등학교: ['공통', '1-2학년', '3-4학년', '5-6학년'],
  중학교: ['공통', '1-3학년', '1학년', '2학년', '3학년'],
  고등학교: ['공통', '1학년', '2학년', '3학년'],
};
// [v1.25] 교과 · 과목은 교육과정 DB(카탈로그)에 등록된 목록에서 고른다
//   학교급 · 학년 → DB 학년군(초 1-2 · 3-4 · 5-6 / 중 1-3 / 고 1-3 · 2-3) → 그 학년군의 교과 → 그 교과의 과목
//   「공통」 또는 DB에 없는 학년(중 1학년 등)은 그 학교급의 모든 학년군에서 찾는다
const LEVEL_CODE = { 초등학교: 'ELEMENTARY', 중학교: 'MIDDLE', 고등학교: 'HIGH' };
export const catalogOptions = (cat, schoolLevelName, gradeLabel, curriculumName) => {
  if (!cat || !LEVEL_CODE[schoolLevelName]) return { curricula: [], subjects: [] };
  const gradesOfLevel = Object.entries(cat.grades).filter(([, g]) => g.level === LEVEL_CODE[schoolLevelName]);
  const exact = gradesOfLevel.filter(([, g]) => g.name === gradeLabel);
  const gradeIds = (exact.length ? exact : gradesOfLevel).map(([id]) => Number(id));
  const curs = Object.entries(cat.curricula).filter(([, c]) => gradeIds.includes(Number(c.gradeId)));
  const curricula = [...new Set(curs.map(([, c]) => c.name))];
  const curIds = curs.filter(([, c]) => c.name === curriculumName).map(([id]) => Number(id));
  const subjects = [...new Set(Object.values(cat.subjects).filter((sb) => curIds.includes(Number(sb.curriculumId))).map((sb) => sb.name.replace(/\s+/g, ' ').trim()))];
  return { curricula, subjects };
};

// allowedCurricula — 교과를 이 목록으로만 고르게 (받아쓰기 = 국어 · 영어)
export const WorkbookInfoCard = ({ purpose, purposes, onPurpose, title, onTitle, onTitleBlur, curriculum, onCurriculum, onCurriculumSave, children, allowedCurricula = null }) => {
  const [cat, setCat] = React.useState(null);
  React.useEffect(() => { loadCatalog().then(setCat).catch(() => {}); }, []);
  const opts = catalogOptions(cat, curriculum.schoolLevelName, curriculum.gradeLabel, curriculum.curriculumName);
  const withCurrent = (list, v) => [...new Set([...list, v].filter(Boolean))];
  const fitCurriculum = (patch) => {
    const next = { ...curriculum, ...patch };
    if (!cat) return patch;
    const o = catalogOptions(cat, next.schoolLevelName, next.gradeLabel, next.curriculumName);
    const curOk = o.curricula.includes(next.curriculumName);
    const subOk = curOk && o.subjects.includes(next.subjectName);
    return { ...patch, curriculumName: curOk ? next.curriculumName : '', subjectName: subOk ? next.subjectName : '' };
  };
  // 교과를 바꾸면 맞지 않는 과목은 비우고, 과목이 하나뿐이면 바로 고른다
  const pickCurriculum = (name) => {
    const sub = catalogOptions(cat, curriculum.schoolLevelName, curriculum.gradeLabel, name).subjects;
    set({ curriculumName: name, subjectName: sub.includes(curriculum.subjectName) ? curriculum.subjectName : (sub.length === 1 ? sub[0] : '') }, true);
  };
  const set = (patch, saveNow) => { const next = { ...curriculum, ...patch }; onCurriculum(next); if (saveNow) onCurriculumSave?.(next); };
  const grades = [...new Set([...(GRADE_OPTIONS[curriculum.schoolLevelName] || ['공통']), curriculum.gradeLabel].filter(Boolean))];
  const row = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: 10 };
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <div style={{ maxWidth: 300 }}><span style={label}>성격</span>
        <select value={purpose} onChange={(e) => onPurpose(e.target.value)} aria-label="문제집 성격" style={input}>
          {Object.entries(purposes).map(([k, p]) => <option key={k} value={k}>{p.icon} {p.label}</option>)}
        </select></div>
      <div><span style={label}>문제집 이름 *</span>
        <input value={title} onChange={(e) => onTitle(e.target.value)} onBlur={onTitleBlur} maxLength={100} placeholder="예: 1학기 중간고사 과학" aria-label="문제집 이름"
          style={{ ...input, borderColor: title.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
      <div style={row}>
        <div><span style={label}>학교급</span>
          <select value={curriculum.schoolLevelName || ''} onChange={(e) => set(fitCurriculum({ schoolLevelName: e.target.value, gradeLabel: (GRADE_OPTIONS[e.target.value] || []).includes(curriculum.gradeLabel) ? curriculum.gradeLabel : '' }), true)} aria-label="학교급" style={input}>
            <option value="">선택</option>
            {[...new Set([...SCHOOL_LEVELS, curriculum.schoolLevelName].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><span style={label}>학년</span>
          <select value={curriculum.gradeLabel || ''} onChange={(e) => set(fitCurriculum({ gradeLabel: e.target.value }), true)} aria-label="학년" style={input}>
            <option value="">선택</option>
            {grades.map((g) => <option key={g}>{g}</option>)}
          </select></div>
      </div>
      <div style={row}>
        <div><span style={label}>교과</span>
          <select value={curriculum.curriculumName || ''} onChange={(e) => pickCurriculum(e.target.value)} disabled={!curriculum.schoolLevelName} aria-label="교과"
            title={!curriculum.schoolLevelName ? '학교급을 먼저 골라 주세요.' : ''} style={{ ...input, ...(!curriculum.schoolLevelName ? { background: '#F1F5F9', color: '#94A3B8' } : {}) }}>
            <option value="">{curriculum.schoolLevelName ? '선택' : '학교급을 먼저 선택'}</option>
            {withCurrent(allowedCurricula ? opts.curricula.filter((x) => allowedCurricula.includes(x)) : opts.curricula, curriculum.curriculumName).map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><span style={label}>과목</span>
          <select value={curriculum.subjectName || ''} onChange={(e) => set({ subjectName: e.target.value }, true)} disabled={!curriculum.curriculumName} aria-label="과목"
            title={!curriculum.curriculumName ? '교과를 먼저 골라 주세요.' : ''} style={{ ...input, ...(!curriculum.curriculumName ? { background: '#F1F5F9', color: '#94A3B8' } : {}) }}>
            <option value="">{curriculum.curriculumName ? '선택' : '교과를 먼저 선택'}</option>
            {withCurrent(opts.subjects, curriculum.subjectName).map((x) => <option key={x}>{x}</option>)}
          </select></div>
      </div>
      {children}
    </div>
  );
};
