/**
 * PenStrokes.jsx — 스마트펜 획 데이터(Ncode 좌표)를 SVG로 그린다
 *
 * pen = { strokes: [{ t(첫 획 기준 ms), p: [[x, y, dt(ms)] ...] }] } — 원본 `*_strokes_parsed.json`에서 x · y · dt만 남긴 형태
 *   · 정적 그리기(답안 미리보기) — progress 없이
 *   · 재생(풀이 과정 보기) — strokeState(k) 가 { n: 그릴 점 수, color } 를 돌려주면 그만큼만 그린다
 */
import React from 'react';

/* 그릴 획들의 테두리 + 여백 → viewBox */
export const penViewBox = (pen, from = 0, to = pen.strokes.length - 1, pad = 2) => {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (let k = from; k <= to; k += 1) {
    for (const [x, y] of pen.strokes[k].p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
};

const pathOf = (pts, n) => {
  let d = '';
  for (let i = 0; i < n; i += 1) d += `${i ? 'L' : 'M'}${pts[i][0]} ${pts[i][1]}`;
  return n === 1 ? `${d}l0.01 0` : d;
};

const PenStrokes = ({ pen, from = 0, to, viewBox, strokeState, tip, width = 0.38, color = '#1E293B', style, label = '펜 필기', ghost }) => {
  const last = to ?? pen.strokes.length - 1;
  const vb = viewBox || penViewBox(pen, from, last);
  const paths = [];
  for (let k = from; k <= last; k += 1) {
    const pts = pen.strokes[k].p;
    const st = strokeState ? strokeState(k) : { n: pts.length };
    if (!st || st.n <= 0) continue;
    paths.push(<path key={k} d={pathOf(pts, Math.min(st.n, pts.length))} stroke={st.color || color} />);
  }
  return (
    <svg viewBox={vb} role="img" aria-label={label} style={{ width: '100%', height: 'auto', display: 'block', ...style }}>
      {/* ghost — 아직 쓰지 않은 부분까지 원본 전체를 옅게 깔아 둔다(재생이 원본 위에 덧그려지는 느낌) */}
      {ghost && <g fill="none" stroke={ghost} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
        {pen.strokes.slice(from, last + 1).map((st, i) => <path key={i} d={pathOf(st.p, st.p.length)} />)}
      </g>}
      <g fill="none" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">{paths}</g>
      {tip && <circle cx={tip[0]} cy={tip[1]} r={0.75} fill="#2563EB" stroke="rgba(37,99,235,.25)" strokeWidth={1.2} />}
    </svg>
  );
};

export default PenStrokes;
