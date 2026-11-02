/**
 * ChartScale.jsx — 대시보드 차트 글자 · 선 굵기를 화면 폭과 관계없이 고정 px로 (2026-10-28)
 *
 * 대시보드 차트는 viewBox(예: 1200 폭)로 그린 SVG를 화면 폭에 맞춰 늘이고 줄인다.
 * 그래서 같은 fontSize="12"라도 넓은 화면에서는 14px로 커지고(교사 점수 추이), 좁은 칸에서는 9px로 작아졌다(관리자 차트).
 * 이 감싸개 안의 SVG는 적힌 숫자를 화면 px로 다시 맞춘다.
 *   · 글자: font-size 값 = 화면 px (12 → 늘 12px)
 *   · 선:  선 굵기 1 이하 = 1px(눈금선), 3 미만 = 1.5px, 3 이상(강조 선) = 2.5px — 데이터 선이 두꺼워 보이지 않게
 *          6 초과(도넛 · 막대처럼 굵은 획으로 면을 그리는 것)는 손대지 않는다
 * 예외: svg에 data-chart-fixed 가 있으면 건너뛴다 (자체로 px를 맞추는 차트 — 교사 점수 추이)
 *       viewBox 폭과 화면 폭이 같은 SVG(고정 크기로 그린 차트)는 바뀌는 것이 없다
 */
import React, { useEffect, useRef } from 'react';

const lineTarget = (w) => (w <= 1 ? 1 : w < 3 ? 1.5 : 2.5);

function applySvg(svg) {
  if (svg.hasAttribute('data-chart-fixed')) return;
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const w = svg.getBoundingClientRect().width;
  if (!vb || !vb.width || !w) return;
  const k = vb.width / w; // 화면 1px = viewBox 몇 단위
  if (Math.abs(k - 1) < 0.01) return;
  // 글자 — 원래 값은 data-cs-fs에 두고, React가 값을 바꾸면 그 값을 새 원래 값으로 삼는다
  svg.querySelectorAll('text').forEach((t) => {
    const cur = t.getAttribute('font-size');
    if (cur == null) return;
    if (cur !== t.dataset.csFsApplied) t.dataset.csFs = cur;
    const next = String(+(parseFloat(t.dataset.csFs) * k).toFixed(3));
    if (next !== cur) { t.setAttribute('font-size', next); t.dataset.csFsApplied = next; }
  });
  // 선 — 획으로 면을 그리는 굵은 선(6 초과)은 그대로
  svg.querySelectorAll('path, line, polyline').forEach((el) => {
    const cur = el.getAttribute('stroke-width');
    if (cur == null) return;
    if (cur !== el.dataset.csSwApplied) el.dataset.csSw = cur;
    const orig = parseFloat(el.dataset.csSw);
    if (!(orig > 0) || orig > 6) return;
    const next = String(+(lineTarget(orig) * k).toFixed(3));
    if (next !== cur) { el.setAttribute('stroke-width', next); el.dataset.csSwApplied = next; }
  });
}

/** 감싼 영역 안의 모든 viewBox SVG에 적용 — 크기가 바뀌거나 차트가 새로 그려지면 다시 맞춘다 */
const ChartScale = ({ children, style, className }) => {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => root.querySelectorAll('svg[viewBox]').forEach(applySvg)); };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(root);
    // 탭 전환 · 데이터 변경으로 차트가 새로 그려질 때 — 우리가 바꾼 값(…Applied)과 같으면 아무것도 하지 않아 되풀이되지 않는다
    const mo = new MutationObserver(run);
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['font-size', 'stroke-width', 'viewBox'] });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); };
  }, []);
  return <div ref={ref} className={className} style={style}>{children}</div>;
};

export default ChartScale;
