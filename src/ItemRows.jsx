/**
 * ItemRows — 과제 관리 › 문항 목록의 한 줄 표 (QBK-01 v1.26)
 *
 *   · needsCheck(item) — 「확인 필요」: 정답이 없거나, 꼭 입력(⛔) · 확인 필요(⚠️) 항목이 남은 문항 (문항 카드의 「확인 필요 N」과 같은 기준)
 *   · checkLabel(item) — 상태 열에 보일 짧은 이유 (정답 없음 · AI 정답 · 단원 확인 …)
 *   · ItemRow — 체크 · 번호 · 유형 · 문항(선다형은 보기까지 한 줄) · 정답 · 배점 · 상태
 *   · RowHeader · GroupHeader — 열 이름 줄 · 단원 묶음 머리(접기)
 *   · QuickCheck — 편집 패널의 「정답 확인」: 확인할 이유 → 문제 → 정답 지정 → [정답 맞음 · 다음 확인 필요]
 */
import React from 'react';
import { ITEM_TYPES, hasAnswer, answerText, stemText } from './lib/itemBank';
import ItemCard from './ItemCard';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

export const needsCheck = (it) => !hasAnswer(it) || (it.issues || []).some((x) => x.level === 'error' || x.level === 'warn');

export const checkLabel = (it) => {
  if (!hasAnswer(it)) return { text: '정답 없음', danger: true };
  const first = (it.issues || []).find((x) => x.level === 'error') || (it.issues || []).find((x) => x.level === 'warn');
  if (!first) return null;
  if (first.field === '정답' && it.answerSource === 'ai') return { text: 'AI 정답', danger: false };
  return { text: `${first.field} 확인`, danger: first.level === 'error' };
};

// 열 — 체크 · 번호 · 유형 · 문항 · 정답 · 배점 · 상태. 편집 패널이 열려 목록이 좁으면(narrow) 유형 · 배점 열을 뺀다
//   유형과 문항 사이는 넓게 띄우고(열 간격 20), 정답 열을 넓혀 문항 열이 끝없이 길어 보이지 않게 (v1.29)
const COLS = '28px 36px 84px minmax(0, 1fr) minmax(96px, 220px) 44px 100px';
const COLS_NARROW = '28px 30px minmax(0, 1fr) minmax(48px, 88px) 76px';
const cell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// 머리줄 체크박스 — 지금 보이는 문항 전체 선택/해제. 일부만 골랐으면 「–」(indeterminate)
const HeadCheck = ({ allOn, someOn, count, onToggleAll }) => {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!someOn && !allOn; }, [someOn, allOn]);
  return <input ref={ref} type="checkbox" checked={!!allOn} onChange={onToggleAll} disabled={!count}
    aria-label={`보이는 ${count}문항 선택`} title={`보이는 ${count}문항 선택`} style={{ width: 16, height: 16, cursor: count ? 'pointer' : 'default' }} />;
};

export const RowHeader = ({ narrow, allOn, someOn, count = 0, onToggleAll }) => (
  <div role="row" style={{ display: 'grid', gridTemplateColumns: narrow ? COLS_NARROW : COLS, columnGap: narrow ? 10 : 20, alignItems: 'center', padding: '0 12px', height: 36, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B' }}>
    {onToggleAll ? <HeadCheck allOn={allOn} someOn={someOn} count={count} onToggleAll={onToggleAll} /> : <span />}<span>번호</span>{!narrow && <span>유형</span>}<span>문항</span><span>정답</span>{!narrow && <span style={{ textAlign: 'right' }}>배점</span>}<span>상태</span>
  </div>
);

export const GroupHeader = ({ label, count, review, collapsed, onToggle }) => (
  <button type="button" onClick={onToggle} aria-expanded={!collapsed}
    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', border: 'none', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#334155', cursor: 'pointer', textAlign: 'left' }}>
    <span aria-hidden="true" style={{ display: 'inline-block', width: 10, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms ease-out' }}>▾</span>
    {label}
    <span style={{ color: '#64748B', fontWeight: 400 }}>{count}문항{review ? ` · 확인 필요 ${review}` : ''}</span>
  </button>
);

// 문항 열 — 발문 한 줄. 선다형 · 양자택일형은 보기를 이어 붙이고 정답 보기는 진하게
const StemCell = ({ item }) => {
  const choices = ['multiple_choice', 'binary_choice'].includes(item.itemType) ? (item.choices || []) : [];
  const right = new Set(item.answer?.choices || []);
  return (
    <span style={{ ...cell, color: '#0F172A' }} title={stemText(item.stem)}>
      {stemText(item.stem) || '(발문 없음)'}
      {choices.length > 0 && (
        <span style={{ color: '#64748B', marginLeft: 8 }}>
          {choices.map((c, i) => (
            <span key={c.no} style={right.has(c.no) ? { color: '#1D4ED8', fontWeight: 800 } : undefined}>
              {i ? '  ' : ''}{item.itemType === 'binary_choice' ? '' : `${CIRCLED[c.no - 1] || c.no} `}{c.text}
            </span>
          ))}
        </span>
      )}
    </span>
  );
};

export const ItemRow = ({ item, no, checked, onToggle, onOpen, active, cursor, rowRef, narrow }) => {
  const lab = checkLabel(item);
  const ans = hasAnswer(item) ? answerText(item) : '';
  return (
    <div ref={rowRef} role="row" tabIndex={-1} aria-selected={active} onClick={onOpen} data-item-row={item.id}
      style={{
        display: 'grid', gridTemplateColumns: narrow ? COLS_NARROW : COLS, columnGap: narrow ? 10 : 20, alignItems: 'center', padding: '8px 12px', minHeight: 48, boxSizing: 'border-box',
        borderBottom: '1px solid #F1F5F9', fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
        background: active ? '#EFF6FF' : cursor ? '#F8FAFC' : 'white', outline: cursor ? '2px solid #93C5FD' : 'none', outlineOffset: -2,
      }}>
      <input type="checkbox" checked={!!checked} onClick={(e) => e.stopPropagation()} onChange={onToggle} aria-label={`${no}번 선택`} style={{ width: 16, height: 16, cursor: 'pointer' }} />
      <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{no}</span>
      {!narrow && <span style={{ ...cell, color: '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>{ITEM_TYPES[item.itemType]?.label || item.itemType}</span>}
      <StemCell item={item} />
      <span style={{ ...cell, fontWeight: 700, color: ans ? '#0F172A' : '#B91C1C' }} title={ans}>{ans || '없음'}</span>
      {!narrow && <span style={{ textAlign: 'right', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{item.points ?? '–'}</span>}
      <span style={{ ...cell, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: lab ? (lab.danger ? '#B91C1C' : '#B45309') : '#94A3B8' }}>
        {lab ? `⚠ ${lab.text}` : ''}
      </span>
    </div>
  );
};

/**
 * 정답 확인 — 확인 필요 문항을 열면 편집 폼 대신 먼저 보인다
 *   item(고치는 중) · onChange(item) · onConfirm() · onEditFull() · pos/total(확인 필요 중 몇 번째)
 *   정답 지정은 문항 카드 미리 보기를 그대로 쓴다(유형별 정답 칸 — 보기 누르기 · O/X · 허용 답 칩 …)
 */
export const QuickCheck = ({ item, onChange, onConfirm, onEditFull, pos, total, error, leftActions = null }) => {
  const reasons = [
    ...(!hasAnswer(item) ? [{ level: 'error', field: '정답', message: '정답을 입력해야 채점할 수 있습니다.' }] : []),
    ...(item.issues || []).filter((x) => (x.level === 'error' || x.level === 'warn') && !(x.field === '정답' && !hasAnswer(item))),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 'var(--neo-font-size-sm)', color: '#0F172A' }}>정답 확인</strong>
        {total > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>확인 필요 {pos} / {total}</span>}
      </div>
      {reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          {reasons.map((r, k) => (
            <div key={k} style={{ fontSize: 'var(--neo-font-size-xs)', color: r.level === 'error' ? '#B91C1C' : '#92400E', lineHeight: 1.6 }}>
              <b>{r.field}</b> — {r.message}
            </div>
          ))}
        </div>
      )}
      <ItemCard item={item} editable hideMeta hideNumber hideIssues onChange={onChange} />
      {error && <div role="alert" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>{error}</div>}
      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>Ctrl+Enter 정답 맞음 · Esc 닫기</div>
      {/* 버튼 줄 — 편집 화면과 같은 자리(패널 아래 고정): 왼쪽 삭제 · 오른쪽 고치기 · 정답 맞음 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'sticky', bottom: -14, margin: '0 -14px -14px', padding: '10px 14px', background: 'white', borderTop: '1px solid #E2E8F0', zIndex: 2 }}>
        {leftActions}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onEditFull}
          style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
          문제 내용 고치기
        </button>
        <button type="button" onClick={onConfirm}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #2A75F3', background: '#2A75F3', color: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
          정답 맞음 · 다음 확인 필요 →
        </button>
      </div>
    </div>
  );
};

/**
 * 쪽 넘김 — 「{a}–{b} / {N}문항」 · ‹ 1 2 … › · 「{n}개씩」 (QBK-01 v1.28)
 *   page(0부터) · pages · total · size · onPage(p) · onSize(n)
 */
export const PAGE_SIZES = [20, 50, 100];
export const Pager = ({ page, pages, total, size, onPage, onSize }) => {
  // 보일 쪽 번호 — 처음 · 끝 · 지금 앞뒤 2쪽, 사이는 …
  const nums = [...new Set([0, pages - 1, ...[-2, -1, 0, 1, 2].map((d) => page + d)])].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  const pb = (on, disabled) => ({
    minWidth: 32, height: 32, padding: '0 8px', borderRadius: 8, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: on ? 800 : 600,
    border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: disabled ? '#CBD5E1' : on ? '#1D4ED8' : '#475569', cursor: disabled ? 'default' : 'pointer',
  });
  return (
    <nav aria-label="문항 쪽 넘김" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontVariantNumeric: 'tabular-nums', minWidth: 110 }}>
        {total ? `${page * size + 1}–${Math.min(total, (page + 1) * size)} / ${total}문항` : '0문항'}
      </span>
      <span style={{ flex: 1 }} />
      {pages > 1 && <>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 0} aria-label="이전 쪽" style={pb(false, page <= 0)}>‹</button>
        {nums.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && p - nums[i - 1] > 1 && <span aria-hidden="true" style={{ color: '#94A3B8' }}>…</span>}
            <button type="button" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`${p + 1}쪽`} style={pb(p === page)}>{p + 1}</button>
          </React.Fragment>
        ))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label="다음 쪽" style={pb(false, page >= pages - 1)}>›</button>
      </>}
      <span style={{ flex: 1 }} />
      <select value={size} onChange={(e) => onSize(Number(e.target.value))} aria-label="한 쪽에 보일 문항 수"
        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', background: 'white', color: '#334155' }}>
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}개씩</option>)}
      </select>
    </nav>
  );
};

