/**
 * RegisterDropdown.jsx — [+ 새 과제 등록 ▾] 펼침 메뉴
 *   정답형 과제(ItemBank) · [2.4] 교육청 문제 은행(관리자)이 같이 쓴다.
 *   직접 등록은 형태별로 나열(머리글 「직접 등록」 아래 두 항목), 스마트 등록은 하나 — AI가 형태를 추천 (TSK-14 §5A)
 *   header — 누를 수 없는 묶음 머리글 · divider — 구분선 · children — 메뉴 안에서 펼치는 항목(지금은 쓰지 않음)
 */
import React, { useState } from 'react';

// [2.4] 과제 등록 — 직접 등록은 형태별로 나열, 스마트 등록은 AI가 형태 추천 (2026-10-29 펼치기 → 나열)
export const UNIFIED_REGISTER = [
  { header: '직접 등록' },
  { mode: 'direct2', icon: '📝', label: '서·논술형 직접 등록', desc: '긴 문장으로 생각을 쓰는 과제 · 별도 답안지 1~10장' },
  { mode: 'answer-direct', icon: '✅', label: '정답형 직접 등록', desc: '문제와 답 칸이 한 장인 시험지' },
  { divider: true },
  { mode: 'entry-smart', icon: '✨', label: '스마트 등록', desc: '자료(PDF·이미지)를 올리면 AI가 과제 형태를 추천하고 내용을 채웁니다.' },
];

const RegisterDropdown = ({ items = UNIFIED_REGISTER, onPick, label = '+ 새 과제 등록', buttonStyle }) => {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null); // 메뉴 안에서 펼친 항목
  const pick = (mode) => { setOpen(false); setSub(null); onPick?.(mode); };
  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button type="button" onClick={() => { setOpen((v) => !v); setSub(null); }} aria-haspopup="true" aria-expanded={open} style={buttonStyle}>{label} ▾</button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 320, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,0.18)', padding: 6 }}>
          {items.map((m, i) => (m.header ? (
            <div key={`h${i}`} style={{ padding: '8px 12px 2px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8' }}>{m.header}</div>
          ) : m.divider ? (
            <div key={`d${i}`} role="separator" style={{ height: 1, background: '#E2E8F0', margin: '6px 8px' }} />
          ) : (
            <React.Fragment key={m.mode}>
              <button type="button" role="menuitem" aria-expanded={m.children ? sub === m.mode : undefined}
                onClick={() => (m.children ? setSub((v) => (v === m.mode ? null : m.mode)) : pick(m.mode))}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '10px 12px', border: 'none', background: sub === m.mode ? '#EFF6FF' : 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = sub === m.mode ? '#EFF6FF' : 'transparent'; }}>
                <span style={{ fontSize: '1.3rem' }}>{m.icon}</span>
                <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 'var(--neo-font-size-base)' }}>{m.label}</b><span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{m.desc}</span></span>
                {m.children && <span aria-hidden style={{ color: '#64748B', alignSelf: 'center' }}>{sub === m.mode ? '▾' : '▸'}</span>}
              </button>
              {m.children && sub === m.mode && (
                <div role="group" aria-label={`${m.label} 과제 형태`} style={{ margin: '2px 0 6px 34px', borderLeft: '2px solid #E2E8F0', paddingLeft: 4 }}>
                  {m.children.map((c) => (
                    <button key={c.mode} type="button" role="menuitem" onClick={() => pick(c.mode)}
                      style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <span>{c.icon}</span>
                      <span><b style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)' }}>{c.label}</b><span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{c.desc}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          )))}
        </div>
      )}
    </div>
  );
};

export default RegisterDropdown;
