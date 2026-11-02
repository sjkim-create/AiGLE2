/**
 * DashboardTopV24.jsx — [v2.4] 대시보드 공통 상단
 *
 * 시스템 관리자 · 교사 · 학교 · 교육청 대시보드가 같은 상단을 쓴다 (2.4에서만 — 2.3은 각 화면의 舊 상단 그대로).
 *   제목 「대시보드」(+ 오른쪽 actions) → 파란 배너(오늘 날짜 · 학년도 셀렉트 · 오른쪽 소속 기관명) → 카드 4개(아이콘 · 이름 · 숫자)
 *   舊 배너 안의 구독 기간 · 크레딧 · 데이터 기준 학년도 경고 · 바로가기 버튼 · 활용 가이드는 2.4에서 뺐다 (2026-10-28)
 *   모드마다 조금 다르다 — 교사: 학년도는 고정 표시(셀렉트 없음), 기관명 자리에 [과제 등록 ›] [채점 관리 ›] 버튼
 */
import React from 'react';

// 학년도 셀렉트 선택지 — 대시보드 4종 공통
export const ACADEMIC_YEARS = [
  { value: '2026', label: '2026학년도 (26.02.28 ~ 27.02.28)' },
  { value: '2025', label: '2025학년도 (25.03.01 ~ 26.02.27)' },
  { value: '2024', label: '2024학년도 (24.03.01 ~ 25.02.28)' },
];

// 카드·배너 버튼 hover·키보드 포커스 — 인라인 스타일로는 :hover/:focus-visible을 줄 수 없어 한 번만 선언
const TOP_CSS = `
.dsh24-card { transition: box-shadow 0.15s ease-out, border-color 0.15s ease-out; }
.dsh24-card[role="button"]:hover { border-color: #BFDBFE; box-shadow: 0 4px 12px rgba(15,23,42,0.08); }
.dsh24-card:focus-visible { outline: 2px solid #2A75F3; outline-offset: 2px; }
.dsh24-cards { display: grid; grid-template-columns: repeat(var(--dsh24-n), minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
@media (max-width: 1100px) { .dsh24-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.dsh24-banner-btn:focus-visible, .dsh24-banner select:focus-visible { outline: 2px solid white; outline-offset: 2px; }
`;

const todayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 배너 오른쪽 바로가기 버튼 (교사 대시보드) */
export const BannerLinkButton = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className="dsh24-banner-btn"
    style={{ minWidth: 180, padding: '20px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.85)', background: 'transparent',
      color: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-base)', fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    {label} <span aria-hidden>›</span>
  </button>
);

/**
 * yearFixed — 학년도를 고를 수 없는 모드(교사)는 셀렉트 대신 글자로 보인다
 * right — 기관명 대신 배너 오른쪽에 둘 내용 (교사: 바로가기 버튼 · 시스템 관리자: 승인 대기 2종)
 * bare — 제목 줄을 그리지 않는다 (시스템 관리자: 제목 줄을 바로가기와 함께 따로 그린다) · cards가 비면 카드 줄도 없다
 * @param {{ year: string, onYearChange: (v: string) => void, orgName: string, yearFixed?: boolean, right?: React.ReactNode,
 *           cards: { icon: string, label: string, value: (string|number), onClick?: () => void }[],
 *           actions?: React.ReactNode, bare?: boolean }} props
 */
const DashboardTopV24 = ({ year, onYearChange, orgName, cards, actions = null, yearFixed = false, right = null, bare = false }) => (
  <>
    <style>{TOP_CSS}</style>
    {!bare && (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, color: '#1E2225', margin: 0 }}>대시보드</h1>
      {actions}
    </div>
    )}

    <div className="dsh24-banner" style={{
      background: '#1A7BD7', borderRadius: 16, padding: '28px 36px', color: 'white', marginBottom: '1rem',
      display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
    }}>
      {/* 왼쪽(날짜·학년도)은 최소 320px — 오른쪽 내용이 많으면 오른쪽이 아래 줄로 내려간다 */}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, marginBottom: 16, whiteSpace: 'nowrap' }}>{todayLabel()}</div>
        {yearFixed ? (
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 500 }}>
            학년도 :&nbsp; {(ACADEMIC_YEARS.find((y) => y.value === year) || ACADEMIC_YEARS[0]).label}
          </div>
        ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%', whiteSpace: 'nowrap', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600 }}>
          학년도 :
          <select value={year} onChange={(e) => onYearChange && onYearChange(e.target.value)}
            style={{ width: 360, maxWidth: '100%', minWidth: 0, padding: '8px 12px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#1E2225',
              fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
            {ACADEMIC_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        </label>
        )}
      </div>
      {right ? <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{right}</div> : orgName && <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, whiteSpace: 'nowrap' }}>{orgName}</div>}
    </div>

    {/* 넓은 화면은 한 줄, 좁은 화면은 2열 — 3+1처럼 한 장만 남는 줄이 생기지 않게 */}
    {cards.length > 0 && (
    <div className="dsh24-cards" style={{ '--dsh24-n': cards.length }}>
      {cards.map((c) => (
        <div key={c.label} className="dsh24-card" role={c.onClick ? 'button' : undefined} tabIndex={c.onClick ? 0 : undefined}
          onClick={c.onClick} onKeyDown={(e) => { if (c.onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.onClick(); } }}
          style={{ background: 'white', borderRadius: 16, padding: '20px 24px', border: '1px solid transparent', cursor: c.onClick ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', minWidth: 0 }}>
            <span aria-hidden style={{ flexShrink: 0 }}>{c.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            {c.onClick && <span aria-hidden style={{ marginLeft: 'auto', color: '#94A3B8' }}>›</span>}
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225', marginTop: 8, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
        </div>
      ))}
    </div>
    )}
  </>
);

export default DashboardTopV24;
