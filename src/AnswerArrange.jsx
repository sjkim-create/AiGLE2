/**
 * AnswerArrange — 정답형 과제 배치 화면 공용 (TSK-15 v1.8)
 *
 * 배치와 기본 정보를 한 화면에서 정한다 — 별도 「기본 정보」 단계를 두지 않는다.
 *   · BasicInfoCard: 과제명 · 교육과정(학교급·학년·교과·과목) · 문항 수·총점·유형 · 정답 없는 문항 경고 + 저장 버튼(children)
 *   · ArrangeRows: 문항마다 번호 · 배점 · ↑↓ · ✕ · 문항 카드([✏️ 문항 편집], 유형·정답 바로 수정)
 * 쓰는 곳: 정답형 직접·스마트 등록(AnswerTaskWizard 2단계) · 정답형 과제 › 문제집 상세(ItemBank)
 */
import React from 'react';
import ItemCard from './ItemCard';
import { ITEM_TYPES, hasAnswer } from './lib/itemBank';

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
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= entries.length) return; const n = [...entries]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return entries.map((e, i) => (
    <div key={e.item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', paddingTop: 8, width: 64 }}>
        <span style={{ fontWeight: 900, color: '#2A75F3' }}>{i + 1}번</span>
        <input type="number" min={0} value={e.points} aria-label={`${i + 1}번 배점`}
          onChange={(ev) => onChange(entries.map((x, j) => (j === i ? { ...x, points: ev.target.value === '' ? '' : Number(ev.target.value) } : x)))}
          style={{ ...input, width: 56, textAlign: 'center', padding: '4px' }} />
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>점</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로" style={{ ...btn(false, i === 0), padding: '2px 6px' }}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label="아래로" style={{ ...btn(false, i === entries.length - 1), padding: '2px 6px' }}>↓</button>
        </div>
        <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))} aria-label={removeLabel} title={removeLabel} style={{ ...btn(false), padding: '2px 8px' }}>✕</button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ItemCard item={{ ...e.item, number: String(i + 1) }} passage={passages[e.item.passageId]} editable onEdit={() => onEdit?.(i)}
          onChange={(x) => onItemChange?.(i, { ...x, number: e.item.number })} />
      </div>
    </div>
  ));
};

// [TSK-15 v1.23] 문제집 기본 정보 — 위에서부터 성격 / 문제집 이름 / 학교급 · 학년 / 교과 · 과목
//   학년은 학교급에 맞는 목록 + 「공통」. 성격이 기초학력이어도 학년으로 구분한다 (v1.24)
export const GRADE_OPTIONS = {
  초등학교: ['공통', '1-2학년', '3-4학년', '5-6학년'],
  중학교: ['공통', '1-3학년', '1학년', '2학년', '3학년'],
  고등학교: ['공통', '1학년', '2학년', '3학년'],
};
export const WorkbookInfoCard = ({ purpose, purposes, onPurpose, title, onTitle, onTitleBlur, curriculum, onCurriculum, onCurriculumSave }) => {
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
          <select value={curriculum.schoolLevelName || ''} onChange={(e) => set({ schoolLevelName: e.target.value, gradeLabel: (GRADE_OPTIONS[e.target.value] || []).includes(curriculum.gradeLabel) ? curriculum.gradeLabel : '' }, true)} aria-label="학교급" style={input}>
            <option value="">선택</option>
            {[...new Set([...SCHOOL_LEVELS, curriculum.schoolLevelName].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><span style={label}>학년</span>
          <select value={curriculum.gradeLabel || ''} onChange={(e) => set({ gradeLabel: e.target.value }, true)} aria-label="학년" style={input}>
            <option value="">선택</option>
            {grades.map((g) => <option key={g}>{g}</option>)}
          </select></div>
      </div>
      <div style={row}>
        <div><span style={label}>교과</span><input value={curriculum.curriculumName || ''} onChange={(e) => set({ curriculumName: e.target.value })} onBlur={() => onCurriculumSave?.(curriculum)} placeholder="예: 국어" aria-label="교과" style={input} /></div>
        <div><span style={label}>과목</span><input value={curriculum.subjectName || ''} onChange={(e) => set({ subjectName: e.target.value })} onBlur={() => onCurriculumSave?.(curriculum)} placeholder="예: 국어" aria-label="과목" style={input} /></div>
      </div>
    </div>
  );
};
