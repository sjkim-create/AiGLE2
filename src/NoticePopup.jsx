/**
 * NoticePopup.jsx
 * 슬라이딩 다중 공지 팝업 — 「팝업 노출」 설정된 공지를 한 개의 팝업에서 좌우 슬라이딩으로 확인한다.
 * - 각 공지: 첨부 이미지가 있으면 이미지 노출, 없으면 본문 내용 노출 (fallback)
 * - 본문/이미지 영역 내부 세로 스크롤
 * - 다중 공지면 ← → 화살표 + 점 인디케이터로 전환
 * - 「오늘 하루 보지 않기」 + 닫기
 *
 * props:
 *   notices: [{ id, title, type, importance, date, content, imageDataUrl }]
 *   onClose: () => void
 *   onHideToday?: () => void
 */
import React, { useState } from 'react';

const TYPE_COLORS = {
  '공지': { bg: '#EFF6FF', color: '#1D4ED8' },
  '점검': { bg: '#FEF3C7', color: '#B45309' },
  '이벤트': { bg: '#ECFDF5', color: '#047857' },
  '긴급': { bg: '#FEE2E2', color: '#B91C1C' },
};

export default function NoticePopup({ notices = [], onClose, onHideToday }) {
  const [idx, setIdx] = useState(0);
  const [hideToday, setHideToday] = useState(false);
  if (!notices.length) return null;

  const total = notices.length;
  const cur = notices[Math.max(0, Math.min(idx, total - 1))];
  const go = (d) => setIdx((i) => (i + d + total) % total);
  const tc = TYPE_COLORS[cur.type] || TYPE_COLORS['공지'];

  const handleClose = () => {
    if (hideToday && onHideToday) onHideToday();
    onClose && onClose();
  };

  return (
    <div
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '84vh', background: 'white', borderRadius: 16, boxShadow: '0 24px 60px -16px rgba(15,23,42,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: tc.bg, color: tc.color }}>{cur.type || '공지'}</span>
            {cur.importance && <span title="중요" style={{ color: '#F59E0B', fontSize: 'var(--neo-font-size-base)' }}>★</span>}
            {total > 1 && <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 700 }}>{idx + 1} / {total}</span>}
          </div>
          <button onClick={handleClose} aria-label="닫기" style={{ border: 'none', background: 'transparent', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* 타이틀 영역 (헤더·본문과 별도 구분 — BLUE 계열로 구분, 슬라이딩·스크롤 시 고정) */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #BFDBFE', background: '#EFF6FF', borderLeft: '4px solid #2A75F3' }}>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1D4ED8', marginBottom: 4, lineHeight: 1.4 }}>{cur.title}</div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#60A5FA' }}>{cur.date}</div>
        </div>

        {/* 본문 (내부 스크롤) — 이미지는 본문 영역 크기에 맞춰 비율 유지(contain) */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
          {cur.imageDataUrl ? (
            <img src={cur.imageDataUrl} alt={cur.title} style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', margin: 'auto', borderRadius: 10, display: 'block' }} />
          ) : (
            <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {cur.content || <span style={{ color: '#94A3B8' }}>내용이 없습니다.</span>}
            </div>
          )}
        </div>

        {/* 슬라이딩 컨트롤 (다중일 때만) */}
        {total > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid #F1F5F9' }}>
            <button onClick={() => go(-1)} style={navBtn}>← 이전</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {notices.map((n, i) => (
                <button key={n.id} onClick={() => setIdx(i)} aria-label={`${i + 1}번째 공지`} style={{
                  width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                  background: i === idx ? '#2A75F3' : '#CBD5E1',
                }} />
              ))}
            </div>
            <button onClick={() => go(1)} style={navBtn}>다음 →</button>
          </div>
        )}

        {/* 하단 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-sm)', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
            오늘 하루 보지 않기
          </label>
          <button onClick={handleClose} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const navBtn = { padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' };
