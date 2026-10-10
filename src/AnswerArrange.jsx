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

export const BasicInfoCard = ({ title, onTitle, curriculum, onCurriculum, entries, children }) => {
  const total = entries.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const noAnswer = entries.filter((e) => !hasAnswer(e.item)).length;
  const allBasic = entries.length > 0 && entries.every((e) => e.item.track === 'basic');
  const setC = (k, v) => onCurriculum({ ...curriculum, [k]: v });
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(110px, 1fr))', gap: 10, alignItems: 'end' }}>
        <div><span style={label}>과제명 *</span>
          <input value={title} onChange={(e) => onTitle(e.target.value)} maxLength={100} placeholder="예: 1학기 중간고사 과학" aria-label="과제명"
            style={{ ...input, borderColor: title.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
        <div><span style={label}>학교급</span>
          <select value={curriculum.schoolLevelName || ''} onChange={(e) => setC('schoolLevelName', e.target.value)} aria-label="학교급" style={input}>
            <option value="">{allBasic ? '기초학력' : '선택'}</option>
            {[...new Set([...SCHOOL_LEVELS, curriculum.schoolLevelName].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><span style={label}>학년</span><input value={curriculum.gradeLabel || ''} onChange={(e) => setC('gradeLabel', e.target.value)} placeholder="예: 1-3학년" aria-label="학년" style={input} /></div>
        <div><span style={label}>교과</span><input value={curriculum.curriculumName || ''} onChange={(e) => setC('curriculumName', e.target.value)} placeholder="예: 과학" aria-label="교과" style={input} /></div>
        <div><span style={label}>과목</span><input value={curriculum.subjectName || ''} onChange={(e) => setC('subjectName', e.target.value)} placeholder="예: 과학" aria-label="과목" style={input} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>✅ 정답형 · 문항 {entries.length}개 · 총 {total}점</span>
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{[...new Set(entries.map((e) => ITEM_TYPES[e.item.itemType]?.label))].filter(Boolean).join(' · ')}</span>
        {noAnswer > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>정답 없는 문항 {noAnswer}개 — 저장은 되지만 채점 전에 정답이 필요합니다</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</span>
      </div>
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
