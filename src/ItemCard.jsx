/**
 * ItemCard — 정답형 문항 카드 (스마트 과제 등록 확인 단계 · 문제 은행 공용)
 *
 * editable=true 이면 유형 변경과 정답 수정(선다형 보기 클릭 · 진위형 O/X · 단답형 입력)을 그 자리에서 한다.
 * 필수(정답) 누락은 잠금 대신 테두리 색으로만 강조한다 (단계 강제 UX 지양).
 */
import React from 'react';
import { ITEM_TYPES, ITEM_TYPE_KEYS, ANSWER_SOURCE, hasAnswer, answerText, emptyAnswer } from './lib/itemBank';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
// 자료에 이미 (1)·(가)·ㄱ. 같은 표지가 붙어 있으면 번호를 또 붙이지 않는다
const HAS_MARK = /^\s*(\(?[0-9가-힣a-zA-Zㄱ-ㅎ]{1,2}[).]|[①-⑩])/;
const chip = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' });

export const TypeBadge = ({ type }) => {
  const t = ITEM_TYPES[type] || { label: type, icon: '?' };
  return <span style={chip(t.group === 'select' ? '#EFF6FF' : '#F5F3FF', t.group === 'select' ? '#1D4ED8' : '#6D28D9')}>{t.icon} {t.label}</span>;
};

const ItemCard = ({ item, passage, selectable, checked, onToggle, editable, onChange, onOpen, compact }) => {
  const missing = !hasAnswer(item);
  const src = ANSWER_SOURCE[missing ? 'none' : item.answerSource] || ANSWER_SOURCE.none;
  const set = (patch) => onChange && onChange({ ...item, ...patch });
  // 교사가 정답을 고치면 출처는 「교사 확인」, 정답 관련 확인 항목은 다시 판정
  const setAnswer = (patch) => {
    const next = { ...item, answer: { ...item.answer, ...patch }, answerSource: 'teacher' };
    const rest = (item.issues || []).filter((i) => i.field !== '정답');
    next.issues = hasAnswer(next) ? rest : [{ level: 'error', field: '정답', message: '정답을 입력해야 채점할 수 있습니다.' }, ...rest];
    onChange && onChange(next);
  };
  const errCount = (item.issues || []).filter((i) => i.level === 'error').length;
  const warnCount = (item.issues || []).filter((i) => i.level === 'warn').length;
  const std = item.curriculum?.standards?.[0];

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'white', borderRadius: 12, padding: '14px 16px', cursor: onOpen ? 'pointer' : 'default',
        border: `1px solid ${editable && missing ? '#FCA5A5' : checked === false ? '#E2E8F0' : '#CBD5E1'}`,
        opacity: selectable && !checked ? 0.55 : 1, display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      {selectable && (
        <input type="checkbox" checked={!!checked} onChange={onToggle} onClick={(e) => e.stopPropagation()} aria-label={`${item.number}번 선택`}
          style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontWeight: 900, color: '#1E293B', fontSize: 'var(--neo-font-size-base)' }}>{item.number}.</span>
          {editable ? (
            <select value={item.itemType} onClick={(e) => e.stopPropagation()}
              onChange={(e) => set({
                itemType: e.target.value, answer: emptyAnswer(), answerSource: 'none',
                // 유형이 바뀌면 정답 형식도 달라지므로 정답을 비우고 다시 입력하게 한다
                issues: [{ level: 'error', field: '정답', message: '유형을 바꿔 정답이 비었습니다. 정답을 다시 입력해 주세요.' },
                  ...(item.issues || []).filter((i) => i.field !== '정답' && i.field !== '유형')],
              })}
              style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit' }}>
              {ITEM_TYPE_KEYS.map((k) => <option key={k} value={k}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</option>)}
            </select>
          ) : <TypeBadge type={item.itemType} />}
          <span style={chip(src.bg, src.color)} title="정답 출처">{src.label}</span>
          {item.points != null && <span style={chip('#F1F5F9', '#475569')}>{item.points}점</span>}
          {std && <span style={chip('#ECFDF5', '#047857')} title={std.text}>{std.code}</span>}
          {item.lineage?.parentId && <span style={chip('#FDF4FF', '#A21CAF')}>파생</span>}
          {!editable && (errCount + warnCount) > 0 && <span style={chip(errCount ? '#FEE2E2' : '#FEF3C7', errCount ? '#B91C1C' : '#92400E')}>확인 {errCount + warnCount}</span>}
        </div>

        {passage && !compact && (
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', background: '#F8FAFC', borderRadius: 6, padding: '6px 8px', marginBottom: 6, whiteSpace: 'pre-wrap', maxHeight: 72, overflow: 'hidden' }}>
            📖 공통 지문{passage.range ? ` (${passage.range})` : ''} — {passage.text.slice(0, 120)}{passage.text.length > 120 ? '…' : ''}
          </div>
        )}
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap', ...(compact ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>
          {item.stem || '(발문 없음)'}
        </div>
        {item.material && !compact && (
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 10px', marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.material}</div>
        )}
        {(item.images || []).length > 0 && !compact && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {item.images.map((im, i) => <img key={i} src={im.dataUrl} alt={im.label} title={im.label} style={{ maxWidth: 220, maxHeight: 150, borderRadius: 6, border: '1px solid #E2E8F0', objectFit: 'contain' }} />)}
          </div>
        )}

        {/* 유형별 보기·정답 */}
        {!compact && item.itemType === 'multiple_choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {(item.choices || []).map((c) => {
              const on = (item.answer?.choices || []).includes(c.no);
              return (
                <div key={c.no}
                  onClick={(e) => { if (!editable) return; e.stopPropagation(); const cur = item.answer?.choices || []; setAnswer({ choices: on ? cur.filter((n) => n !== c.no) : [...cur, c.no].sort() }); }}
                  title={editable ? '눌러서 정답 지정/해제' : undefined}
                  style={{ fontSize: 'var(--neo-font-size-sm)', padding: '4px 8px', borderRadius: 6, cursor: editable ? 'pointer' : 'default', background: on ? '#DBEAFE' : 'transparent', color: on ? '#1D4ED8' : '#334155', fontWeight: on ? 800 : 500 }}>
                  {CIRCLED[c.no - 1] || `${c.no}.`} {c.text}{on ? '  ✔' : ''}
                </div>
              );
            })}
          </div>
        )}
        {!compact && item.itemType === 'true_false' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {[[true, 'O'], [false, 'X']].map(([v, l]) => (
              <button key={l} type="button" disabled={!editable} onClick={() => setAnswer({ truth: v })}
                style={{ width: 44, height: 32, borderRadius: 8, fontWeight: 900, fontFamily: 'inherit', cursor: editable ? 'pointer' : 'default', border: item.answer?.truth === v ? '2px solid #2A75F3' : '1px solid #CBD5E1', background: item.answer?.truth === v ? '#DBEAFE' : 'white', color: '#1E293B' }}>{l}</button>
            ))}
          </div>
        )}
        {!compact && item.itemType === 'matching' && item.matching && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
            <div>{item.matching.left.map((l, i) => <div key={i}>{HAS_MARK.test(l) ? l : `${i + 1}. ${l}`}</div>)}</div>
            <div>{item.matching.right.map((r, i) => <div key={i}>{HAS_MARK.test(r) ? r : `${String.fromCharCode(97 + i)}. ${r}`}</div>)}</div>
          </div>
        )}
        {!compact && editable && item.itemType === 'short_answer' && (
          <input value={(item.answer?.texts || []).join(' / ')} onClick={(e) => e.stopPropagation()}
            onChange={(e) => setAnswer({ texts: e.target.value.split('/').map((t) => t.trim()) })}
            placeholder="정답 (여러 개 허용 시 / 로 구분)"
            style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', border: `1px solid ${missing ? '#FCA5A5' : '#CBD5E1'}` }} />
        )}

        {/* 정답 한 줄 (선다형·진위형은 위에서 보이므로 나머지 유형만) */}
        {!['multiple_choice', 'true_false'].includes(item.itemType) && !(editable && item.itemType === 'short_answer') && (
          <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: missing ? '#B91C1C' : '#047857', fontWeight: 700 }}>
            정답: {missing ? '없음' : answerText(item)}
          </div>
        )}
        {compact && ['multiple_choice', 'true_false'].includes(item.itemType) && (
          <div style={{ marginTop: 6, fontSize: 'var(--neo-font-size-sm)', color: missing ? '#B91C1C' : '#047857', fontWeight: 700 }}>정답: {missing ? '없음' : answerText(item)}</div>
        )}

        {editable && (item.issues || []).filter((i) => i.level !== 'info').length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {item.issues.filter((i) => i.level !== 'info').map((i, k) => (
              <div key={k} style={{ fontSize: 'var(--neo-font-size-xs)', color: i.level === 'error' ? '#B91C1C' : '#92400E' }}>{i.level === 'error' ? '⛔' : '⚠️'} {i.field} — {i.message}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemCard;
