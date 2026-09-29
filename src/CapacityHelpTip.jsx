/**
 * [SCR-07 v4.32] 「저장 잔량 ?」 — 누른 자리에 툴팁으로 뜬다 (본문 위에 안내를 펼치지 않는다)
 *   표·카드가 overflow: hidden이라 잘리지 않도록 화면 좌표(fixed)로 띄운다.
 *   바깥을 누르거나 스크롤·Esc면 닫힌다.
 */
import React, { useEffect, useRef, useState } from 'react';

export const CAPACITY_HELP_TEXT = '저장 공간이 부족하면 노랑색 불이 점멸(깜박임) — 이전 필기가 남아 있는 펜으로 채점이 정상 완료되면 펜의 데이터가 지워져 잔량이 회복됩니다.';

/** 저장 잔량 20% 미만 슬롯 라벨의 노랑 점멸 — 실물 펜의 노랑 LED 점멸을 흉내 낸다 */
export const CapacityBlinkStyle = () => (
  <style>{'@keyframes capBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } } .cap-blink { animation: capBlink 1s ease-in-out infinite; }'}</style>
);

const CapacityHelpTip = () => {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null); // { top, left } — null이면 닫힘

  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type === 'mousedown' && btnRef.current?.contains(e.target)) return; setPos(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = (e) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const width = 300;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left + r.width / 2 - width / 2)), width });
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} title="저장 잔량 안내" aria-expanded={!!pos}
        style={{ width: 16, height: 16, padding: 0, borderRadius: '50%', border: `1px solid ${pos ? '#F59E0B' : '#CBD5E1'}`, background: pos ? '#FEF3C7' : 'white', color: pos ? '#B45309' : '#64748B', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, lineHeight: '14px', cursor: 'pointer', fontFamily: 'inherit', verticalAlign: 'middle' }}>?</button>
      {pos && (
        <span role="tooltip" onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 10050, display: 'block', padding: '10px 12px', borderRadius: 8, background: '#1E293B', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 500, lineHeight: 1.6, textAlign: 'left', whiteSpace: 'normal', boxShadow: '0 8px 20px rgba(15,23,42,0.25)' }}>
          <span className="cap-blink" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#FACC15', marginRight: 6, verticalAlign: 'middle' }} />
          {CAPACITY_HELP_TEXT}
        </span>
      )}
    </>
  );
};

export default CapacityHelpTip;
