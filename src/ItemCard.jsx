/**
 * ItemCard — 정답형 문항 카드 (스마트 과제 등록 확인 단계 · 문제 은행 공용)
 *
 * editable=true 이면 그 자리에서 고친다:
 *   · 유형 변경 — 정답을 지우지 않는다 (itemBank.changeItemType: 옮길 수 있는 정답은 옮기고, 나머지는 칸에 남겨 되돌리면 복구)
 *   · 단원 변경 — 정답·유형은 그대로, 단원 성취기준만 바뀜 (교과 문항)
 *   · 정답 수정 — 모든 유형: 선다형·양자택일형(보기 누르기) · 진위형(O/X) · 연결형(짝 선택) · 단답형·완성형(입력) · 서술형(모범답안)
 * 필수(정답) 누락은 잠금 대신 테두리 색으로만 강조한다 (단계 강제 UX 지양).
 */
import React from 'react';
import { ITEM_TYPES, ITEM_TYPE_KEYS, ANSWER_SOURCE, hasAnswer, answerText, changeItemType, recheckAnswer, stemParts, blankNo, blankCountOf } from './lib/itemBank';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
// 자료에 이미 (1)·(가)·ㄱ. 같은 표지가 붙어 있으면 번호를 또 붙이지 않는다
const HAS_MARK = /^\s*(\(?[0-9가-힣a-zA-Zㄱ-ㅎ]{1,2}[).]|[①-⑩])/;
const RIGHT_MARK = (i) => String.fromCharCode(97 + i);
const chip = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' });
const inputStyle = (bad) => ({ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', border: `1px solid ${bad ? '#FCA5A5' : '#CBD5E1'}` });
const stop = (e) => e.stopPropagation();

/**
 * 허용 답 칩 — 답 하나를 쓰고 Enter(또는 칸을 벗어나면) 칩으로 쌓인다. 칩 [×]로 빼고, 빈 칸에서 Backspace는 마지막 칩을 뺀다
 * 구분 기호를 쓰지 않아 1/2 · 1,000 · x=3 같은 답도 그대로 넣는다
 */
export const AnswerChips = ({ values, onChange, bad }) => {
  const [draft, setDraft] = React.useState('');
  const list = (values || []).map((v) => String(v).trim()).filter(Boolean);
  const add = () => {
    const t = draft.trim();
    if (t && !list.includes(t)) onChange([...list, t]);
    setDraft('');
  };
  return (
    <div onClick={stop} style={{ ...inputStyle(bad && !list.length), display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'white' }}>
      {list.map((v) => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', borderRadius: 999, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>
          {v}
          <button type="button" onClick={() => onChange(list.filter((x) => x !== v))} aria-label={`${v} 빼기`}
            style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', padding: '0 2px', fontSize: 'var(--neo-font-size-sm)' }}>×</button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={add}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          else if (e.key === 'Backspace' && !draft && list.length) onChange(list.slice(0, -1));
        }}
        placeholder={list.length ? '다른 답도 맞으면 입력 후 Enter' : '정답 입력 후 Enter · 여러 개 가능'}
        style={{ flex: 1, minWidth: 220, border: 'none', outline: 'none', padding: '2px 4px', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }} />
    </div>
  );
};

export const TypeBadge = ({ type }) => {
  const t = ITEM_TYPES[type] || { label: type, icon: '?' };
  return <span style={chip(t.group === 'select' ? '#EFF6FF' : '#F5F3FF', t.group === 'select' ? '#1D4ED8' : '#6D28D9')}>{t.icon} {t.label}</span>;
};

// dimUnchecked — 정답형 확인 단계처럼 「선택 안 함 = 저장에서 빠짐」일 때만 흐리게. 문제 은행 목록은 선택이 고르기일 뿐이라 흐리게 하지 않는다
// active — 문제 은행에서 지금 상세에 열린 문항 (파란 테두리)
// onEdit — [✏️ 문항 편집](직접 작성과 같은 편집 화면)을 연다. 그림 위 ✂️도 같은 화면으로
// hideNumber — 문제 은행에서는 번호를 숨긴다. 번호는 원본 자료의 문항 번호라 은행 안에서는 뜻이 없다(자료가 다르면 겹침). 과제·문제집은 담은 순서로 번호를 새로 매겨 넘긴다
/** 지문 — [빈칸] 자리를 ① 칸으로 그린다 (완성형) */
export const StemWithBlanks = ({ stem }) => stemParts(stem).map((p, k) => ('blank' in p
  ? <span key={k} style={{ display: 'inline-block', minWidth: 40, margin: '0 2px', padding: '0 8px', border: '1px solid #94A3B8', borderRadius: 4, textAlign: 'center', fontWeight: 700 }}>{blankNo(p.blank)}</span>
  : <React.Fragment key={k}>{p.text}</React.Fragment>));

const ItemCard = ({ item, passage, selectable, checked, onToggle, editable, onChange, onOpen, compact, unitOptions, dimUnchecked = false, active = false, onEdit, hideNumber = false, hideMeta = false, hideIssues = false }) => {
  const showNumber = !hideNumber && !!item.number;
  const missing = !hasAnswer(item);
  const src = ANSWER_SOURCE[missing ? 'none' : item.answerSource] || ANSWER_SOURCE.none;
  const a = item.answer || {};
  // 교사가 정답을 고치면 출처는 「교사 확인」, 정답 관련 확인 항목은 다시 판정
  const setAnswer = (patch) => onChange && onChange(recheckAnswer({ ...item, answer: { ...a, ...patch }, answerSource: 'teacher' }));
  const errCount = (item.issues || []).filter((i) => i.level === 'error').length;
  const warnCount = (item.issues || []).filter((i) => i.level === 'warn').length;
  const isBasic = item.track === 'basic';

  // 단원 — 교과 문항의 성취기준은 단원 단위로 매핑된다 (문항별 성취기준 없음)
  const unit = item.unit || { areaId: null, areaName: '', label: '', source: 'none' };
  const unitStyle = !unit.areaId ? ['#FEE2E2', '#B91C1C'] : unit.source === 'ai' ? ['#FEF3C7', '#B45309'] : ['#ECFDF5', '#047857'];
  const unitTitle = [
    unit.label && unit.label !== unit.areaName ? `자료 단원: ${unit.label}` : '',
    unit.source === 'ai' ? 'AI 추정 단원 — 확인 필요' : unit.source === 'scope' ? '자료의 시험 범위로 확인한 단원' : '',
    `성취기준 ${(item.curriculum?.standards || []).length}개 (단원 단위)`,
  ].filter(Boolean).join('\n');
  const setUnit = (areaId) => {
    const opt = (unitOptions || []).find((o) => o.areaId === Number(areaId));
    onChange && onChange({
      ...item, // 정답·유형은 그대로 둔다
      unit: { ...unit, areaId: opt?.areaId ?? null, areaName: opt?.name || '', source: opt ? 'teacher' : 'none' },
      curriculum: { ...item.curriculum, standardsBasis: 'unit', standards: opt ? opt.standards : [] },
      issues: [...(opt ? [] : [{ level: 'warn', field: '단원', message: '단원을 골라 주세요.' }]), ...(item.issues || []).filter((i) => i.field !== '단원' && i.field !== '성취기준')],
    });
  };

  const toggleChoice = (no, single) => {
    const cur = a.choices || [];
    const on = cur.includes(no);
    setAnswer({ choices: single ? (on ? [] : [no]) : on ? cur.filter((n) => n !== no) : [...cur, no].sort() });
  };
  const blankCount = blankCountOf(item);
  const showAnswerLine = !['multiple_choice', 'binary_choice', 'true_false'].includes(item.itemType) && !editable;

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'white', borderRadius: 12, padding: '14px 16px', cursor: onOpen ? 'pointer' : 'default',
        border: active ? '2px solid #2A75F3' : `1px solid ${editable && missing ? '#FCA5A5' : checked === false ? '#E2E8F0' : '#CBD5E1'}`,
        boxShadow: active ? '0 0 0 3px #DBEAFE' : 'none',
        opacity: dimUnchecked && selectable && !checked ? 0.55 : 1, display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      {selectable && (
        <input type="checkbox" checked={!!checked} onChange={onToggle} onClick={stop} aria-label={showNumber ? `${item.number}번 선택` : '문항 선택'}
          style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* hideMeta — 문항 편집의 정답 칸: 유형·정답 출처·배점·단원 칩을 빼고 문항과 정답만 */}
        {!hideMeta && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {showNumber && <span style={{ fontWeight: compact ? 600 : 800, color: '#0F172A', fontSize: 'var(--neo-font-size-base)' }}>{item.number}.</span>}
          {editable ? (
            <select value={item.itemType} onClick={stop} onChange={(e) => onChange && onChange(changeItemType(item, e.target.value))}
              title="유형을 바꿔도 정답은 지워지지 않습니다"
              style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit' }}>
              {ITEM_TYPE_KEYS.map((k) => <option key={k} value={k}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</option>)}
            </select>
          ) : <TypeBadge type={item.itemType} />}
          <span style={chip(src.bg, src.color)} title="정답 출처">{src.label}</span>
          {item.copiedFromEduId && <span style={chip('#FEF3C7', '#92400E')} title="교육청 문제 은행에서 복제한 문항">🏛️ 교육청</span>}
          {item.points != null && <span style={chip('#F1F5F9', '#475569')}>{item.points}점</span>}
          {isBasic ? (
            <span style={chip('#FFF7ED', '#C2410C')} title="기초학력 문항 — 단원·성취기준 없이 기초 기능으로 관리">🧩 기초학력{item.skill ? ` · ${item.skill}` : ''}</span>
          ) : editable && (unitOptions || []).length > 0 ? (
            <select value={unit.areaId ?? ''} onClick={stop} onChange={(e) => setUnit(e.target.value)} title={`${unitTitle}\n단원을 바꿔도 정답은 그대로입니다`}
              style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 8, fontFamily: 'inherit', border: `1px solid ${unitStyle[1]}55`, background: unitStyle[0], color: unitStyle[1], maxWidth: 220 }}>
              <option value="">📘 단원 선택</option>
              {unitOptions.map((o) => <option key={o.areaId} value={o.areaId}>📘 {o.name}{unit.source === 'ai' && unit.areaId === o.areaId ? ' (AI 추정)' : ''}</option>)}
            </select>
          ) : (
            <span style={chip(unitStyle[0], unitStyle[1])} title={unitTitle}>📘 {unit.areaName || unit.label || '단원 미지정'}{unit.source === 'ai' ? ' · 추정' : ''}</span>
          )}
          {item.lineage?.parentId && <span style={chip('#FDF4FF', '#A21CAF')}>파생</span>}
          {!editable && (errCount + warnCount) > 0 && <span style={chip(errCount ? '#FEE2E2' : '#FEF3C7', errCount ? '#B91C1C' : '#92400E')}>확인 필요 {errCount + warnCount}</span>}
          {onEdit && (
            <button type="button" onClick={(e) => { stop(e); onEdit(); }} title="발문·보기·그림·정답 등 문항 전체를 고칩니다"
              style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#334155', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ 문항 편집</button>
          )}
        </div>}

        {passage && !compact && (
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', background: '#F8FAFC', borderRadius: 6, padding: '6px 8px', marginBottom: 6, whiteSpace: 'pre-wrap', maxHeight: 72, overflow: 'hidden' }}>
            📖 공통 지문{passage.range ? ` (${passage.range})` : ''} — {passage.text.slice(0, 120)}{passage.text.length > 120 ? '…' : ''}
          </div>
        )}
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#0F172A', fontWeight: 400, lineHeight: 1.6, whiteSpace: 'pre-wrap', ...(compact ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>
          {item.stem ? <StemWithBlanks stem={item.stem} /> : '(지문 및 문항 없음)'}
        </div>
        {item.material && !compact && (
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 10px', marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.material}</div>
        )}
        {(item.images || []).length > 0 && !compact && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {item.images.map((im, i) => (
              <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                <img src={im.dataUrl} alt={im.label} title={im.label} style={{ maxWidth: 220, maxHeight: 150, borderRadius: 6, border: '1px solid #E2E8F0', objectFit: 'contain', display: 'block' }} />
                {onEdit && <button type="button" onClick={(e) => { stop(e); onEdit('images'); }} title="그림 범위 조정 · 바꾸기 (문항 편집)" aria-label="그림 범위 조정"
                  style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px', borderRadius: 6, border: '1px solid #CBD5E1', background: 'rgba(255,255,255,0.92)', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)' }}>✂️</button>}
              </span>
            ))}
          </div>
        )}

        {/* 선다형 — 보기 목록, 눌러서 정답 지정/해제 (복수 정답 가능) */}
        {!compact && item.itemType === 'multiple_choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {(item.choices || []).map((c) => {
              const on = (a.choices || []).includes(c.no);
              return (
                <div key={c.no} onClick={(e) => { if (!editable) return; stop(e); toggleChoice(c.no, false); }} title={editable ? '눌러서 정답 지정/해제' : undefined}
                  style={{ fontSize: 'var(--neo-font-size-sm)', padding: '4px 8px', borderRadius: 6, cursor: editable ? 'pointer' : 'default', background: on ? '#DBEAFE' : 'transparent', color: on ? '#1D4ED8' : '#334155', fontWeight: on ? 800 : 500 }}>
                  {CIRCLED[c.no - 1] || `${c.no}.`} {c.text}{on ? '  ✔' : ''}
                </div>
              );
            })}
          </div>
        )}
        {/* 양자택일형 — 두 낱말 중 하나에 동그라미 */}
        {!compact && item.itemType === 'binary_choice' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {(item.choices || []).map((c) => {
              const on = (a.choices || []).includes(c.no);
              return (
                <span key={c.no} onClick={(e) => { if (!editable) return; stop(e); toggleChoice(c.no, true); }} title={editable ? '눌러서 정답(동그라미) 지정' : undefined}
                  style={{ padding: '6px 16px', borderRadius: 999, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, cursor: editable ? 'pointer' : 'default',
                    border: on ? '2.5px solid #2A75F3' : '1px dashed #CBD5E1', color: on ? '#1D4ED8' : '#334155', background: on ? '#EFF6FF' : 'white' }}>
                  {c.text}
                </span>
              );
            })}
          </div>
        )}
        {!compact && item.itemType === 'true_false' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={stop}>
            {[[true, 'O'], [false, 'X']].map(([v, l]) => (
              <button key={l} type="button" disabled={!editable} onClick={() => setAnswer({ truth: v })}
                style={{ width: 44, height: 32, borderRadius: 8, fontWeight: 900, fontFamily: 'inherit', cursor: editable ? 'pointer' : 'default', border: a.truth === v ? '2px solid #2A75F3' : '1px solid #CBD5E1', background: a.truth === v ? '#DBEAFE' : 'white', color: '#1E293B' }}>{l}</button>
            ))}
          </div>
        )}
        {/* 연결형 — 왼쪽마다 오른쪽 짝을 고른다 */}
        {!compact && item.itemType === 'matching' && item.matching && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.matching.left.map((l, i) => {
                const pair = (a.pairs || []).find(([li]) => li === i + 1);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1 }}>{HAS_MARK.test(l) ? l : `${i + 1}. ${l}`}</span>
                    {editable && (
                      <select value={pair ? pair[1] : ''} onClick={stop}
                        onChange={(e) => { const r = Number(e.target.value); const rest = (a.pairs || []).filter(([li]) => li !== i + 1); setAnswer({ pairs: r ? [...rest, [i + 1, r]].sort((x, y) => x[0] - y[0]) : rest }); }}
                        style={{ fontSize: 'var(--neo-font-size-xs)', padding: '2px 4px', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'inherit' }}>
                        <option value="">짝</option>
                        {item.matching.right.map((_, j) => <option key={j} value={j + 1}>{RIGHT_MARK(j)}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div>{item.matching.right.map((r, i) => <div key={i}>{RIGHT_MARK(i)}. {r}</div>)}</div>
          </div>
        )}
        {/* 단답형 */}
        {!compact && editable && item.itemType === 'short_answer' && (
          <div style={{ marginTop: 8 }}><AnswerChips values={a.texts || []} bad={missing} onChange={(texts) => setAnswer({ texts })} /></div>
        )}
        {/* 완성형 — 빈칸마다 허용 답 */}
        {!compact && editable && item.itemType === 'completion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {Array.from({ length: blankCount }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', width: 44 }}>빈칸 {blankNo(i)}</span>
                <div style={{ flex: 1 }}><AnswerChips values={(a.blanks || [])[i] || []} bad={missing}
                  onChange={(vals) => { const next = Array.from({ length: blankCount }, (_, k) => [...((a.blanks || [])[k] || [])]); next[i] = vals; setAnswer({ blanks: next }); }} /></div>
              </div>
            ))}
          </div>
        )}
        {/* 서술형 — 모범답안 */}
        {!compact && editable && item.itemType === 'essay' && (
          <textarea value={a.model || ''} onClick={stop} onChange={(e) => setAnswer({ model: e.target.value })} rows={3}
            placeholder="모범답안" style={{ ...inputStyle(missing), marginTop: 8, resize: 'vertical' }} />
        )}

        {/* 정답 한 줄 — 보기에 표시되지 않는 유형, 또는 목록(compact) */}
        {(showAnswerLine || compact) && (
          <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: missing ? '#B91C1C' : '#065F46', fontWeight: compact ? 400 : 700 }}>
            정답: {missing ? '없음' : answerText(item)}
          </div>
        )}

        {editable && !hideIssues && (item.issues || []).filter((i) => i.level !== 'info').length > 0 && (
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
