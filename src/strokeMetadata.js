export const PADDING = 20;

export function computeTransform(strokes, canvasWidth) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  strokes.forEach(s => s.points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }));

  if (!isFinite(minX)) return { canvasH: 400, scale: 1, offsetX: 0, offsetY: 0 };

  const dataW = maxX - minX || 1;
  const dataH = maxY - minY || 1;
  const aspect = dataH / dataW;
  const canvasH = Math.max(200, Math.round(canvasWidth * aspect) + PADDING * 2);
  const drawW = canvasWidth - PADDING * 2;
  const drawH = canvasH - PADDING * 2;
  const scale = Math.min(drawW / dataW, drawH / dataH);
  const offsetX = PADDING + (drawW - dataW * scale) / 2 - minX * scale;
  const offsetY = PADDING + (drawH - dataH * scale) / 2 - minY * scale;

  return { canvasH, scale, offsetX, offsetY };
}

export function tx(x, t) { return x * t.scale + t.offsetX; }
export function ty(y, t) { return y * t.scale + t.offsetY; }

export function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function calcDuration(strokes) {
  if (strokes.length === 0) return 0;
  return strokes[strokes.length - 1].endTime - strokes[0].startTime;
}

export function strokeColor(index, total) {
  const hue = (index / Math.max(total - 1, 1)) * 270;
  return `hsl(${hue}, 85%, 45%)`;
}

export function analyzeDelays(strokes, thresholdMs = 500) {
  const delays = [];
  for (let i = 1; i < strokes.length; i++) {
    const delayMs = strokes[i].startTime - strokes[i - 1].endTime;
    if (delayMs >= thresholdMs) {
      delays.push({
        strokeIndex: i,
        delayMs,
        x: strokes[i].points[0]?.x ?? 0,
        y: strokes[i].points[0]?.y ?? 0,
      });
    }
  }
  return delays;
}

import { analyzeHandwriting } from './handwritingAnalysis.js';

const CANVAS_W = 800;
const COLOR_BAR_H = 30;
const COLOR_BAR_LABEL_H = 28;
const SUMMARY_H = 44;
const GAP = 14;
const INDICATOR_H = 90; // 3축 지표 패널 높이

export function renderOriginalImage(strokes) {
  const canvas = document.createElement('canvas');
  if (strokes.length === 0) {
    canvas.width = CANVAS_W; canvas.height = 200; return canvas;
  }
  const tr = computeTransform(strokes, CANVAS_W);
  canvas.width = CANVAS_W;
  canvas.height = tr.canvasH;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  strokes.forEach((stroke) => {
    const lw = Math.max(1.2, 2.0 * (tr.scale / 15));
    ctx.beginPath();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let pi = 1; pi < stroke.points.length; pi++) {
      const prev = stroke.points[pi - 1];
      const pt = stroke.points[pi];
      if (pi === 1) ctx.moveTo(tx(prev.x, tr), ty(prev.y, tr));
      ctx.lineTo(tx(pt.x, tr), ty(pt.y, tr));
    }
    ctx.stroke();
  });

  return canvas;
}

export function renderMetadataImage(strokes) {
  const canvas = document.createElement('canvas');
  if (strokes.length === 0) {
    canvas.width = CANVAS_W; canvas.height = 200; return canvas;
  }

  const tr = computeTransform(strokes, CANVAS_W);
  canvas.width = CANVAS_W;
  canvas.height = tr.canvasH + GAP + COLOR_BAR_H + COLOR_BAR_LABEL_H + GAP + SUMMARY_H + GAP + INDICATOR_H + 10;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const total = strokes.length;

  // 1. 색상 인코딩 획 그리기
  strokes.forEach((stroke, si) => {
    const color = strokeColor(si, total);
    const lw = Math.max(0.8, 1.5 * (tr.scale / 15));
    for (let pi = 1; pi < stroke.points.length; pi++) {
      const prev = stroke.points[pi - 1];
      const pt = stroke.points[pi];
      ctx.beginPath();
      ctx.moveTo(tx(prev.x, tr), ty(prev.y, tr));
      ctx.lineTo(tx(pt.x, tr), ty(pt.y, tr));
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });

  // 2. 멈춤 마커
  const delays = analyzeDelays(strokes, 500);
  const markers = delays.map(d => ({
    cx: tx(d.x, tr), cy: ty(d.y, tr), label: `${(d.delayMs / 1000).toFixed(1)}s`,
  }));
  markers.sort((a, b) => a.cy - b.cy);
  for (let i = 1; i < markers.length; i++) {
    const p = markers[i - 1], c = markers[i];
    if (Math.hypot(c.cx - p.cx, c.cy - p.cy) < 20) c.cy = p.cy + 20;
  }
  markers.forEach(m => {
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#e94560';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(m.label, m.cx + 8, m.cy);
  });

  // 3. 시간 비례 컬러바
  const barY = tr.canvasH + GAP;
  const barX = 20, barW = CANVAS_W - 40;
  const base = strokes[0].startTime;
  const totalDur = strokes[strokes.length - 1].endTime - base;

  for (let col = 0; col < barW; col++) {
    const absT = (col / barW) * totalDur + base;
    let si = 0;
    for (let i = 0; i < strokes.length; i++) {
      if (strokes[i].startTime <= absT) si = i; else break;
    }
    ctx.fillStyle = strokeColor(si, total);
    ctx.fillRect(barX + col, barY, 1, COLOR_BAR_H);
  }
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, COLOR_BAR_H);

  // 컬러바 라벨
  const labelY = barY + COLOR_BAR_H + 3;
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#666'; ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.fillText('0s', barX, labelY);
  ctx.textAlign = 'right'; ctx.fillText(formatTime(totalDur), barX + barW, labelY);

  delays.forEach(d => {
    const xPos = barX + ((strokes[d.strokeIndex].startTime - base) / totalDur) * barW;
    ctx.beginPath(); ctx.moveTo(xPos, barY); ctx.lineTo(xPos, barY + COLOR_BAR_H + 3);
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#333'; ctx.font = '8px sans-serif';
    ctx.fillText(`${((strokes[d.strokeIndex].startTime - base) / 1000).toFixed(0)}s`, xPos, labelY);
    ctx.fillStyle = '#e94560';
    ctx.fillText(`${(d.delayMs / 1000).toFixed(1)}s`, xPos, labelY + 10);
  });

  // 4. 요약 텍스트
  const sumY = barY + COLOR_BAR_H + COLOR_BAR_LABEL_H + GAP;
  const maxDelay = delays.length > 0 ? Math.max(...delays.map(d => d.delayMs)) : 0;
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#444';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(
    `총 획: ${total}  |  총 시간: ${formatTime(totalDur)}  |  멈춤(≥0.5s): ${delays.length}회  |  최대 멈춤: ${(maxDelay / 1000).toFixed(1)}s`,
    CANVAS_W / 2, sumY
  );

  // 5. 범례
  const legendY = sumY + 20, legendW = 200, legendX = (CANVAS_W - legendW) / 2;
  for (let col = 0; col < legendW; col++) {
    ctx.fillStyle = strokeColor(Math.floor((col / legendW) * total), total);
    ctx.fillRect(legendX + col, legendY, 1, 10);
  }
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
  ctx.strokeRect(legendX, legendY, legendW, 10);
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.fillText('#1 첫 획', legendX, legendY + 12);
  ctx.textAlign = 'right'; ctx.fillText(`#${total} 마지막`, legendX + legendW, legendY + 12);

  // 6. 3축 지표 패널 (필압 대체 지표 시각화)
  const analysis = analyzeHandwriting(strokes);
  const indY = legendY + 28;
  drawIndicatorPanel(ctx, 20, indY, CANVAS_W - 40, INDICATOR_H, analysis);

  return canvas;
}

// ─── 3축 지표 패널 렌더 ───────────────────────────────────────────
function drawIndicatorPanel(ctx, x, y, w, h, analysis) {
  // 배경
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  // 제목
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `필기 지표 (Time · Coord · Hesitation 3축) — 패턴 코드: ${analysis.pattern_code.toUpperCase()}`,
    x + 10, y + 8
  );

  // 3개 컬럼 분할
  const colW = (w - 30) / 3;
  const col1X = x + 10;
  const col2X = x + 10 + colW + 5;
  const col3X = x + 10 + (colW + 5) * 2;
  const axisY = y + 28;

  const gradeColor = (g) => g === 'a' ? '#10B981' : g === 'b' ? '#F59E0B' : '#EF4444';
  const gradeLabel = (g) => g === 'a' ? '상' : g === 'b' ? '중' : '하';

  const drawAxis = (cx, label, grade, value, unit, hint) => {
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(label, cx, axisY);

    // 등급 뱃지
    const badgeW = 34, badgeH = 18;
    ctx.fillStyle = gradeColor(grade);
    ctx.fillRect(cx, axisY + 14, badgeW, badgeH);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`${grade.toUpperCase()} ${gradeLabel(grade)}`, cx + badgeW / 2, axisY + 18);

    // 수치
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`${value}${unit}`, cx + badgeW + 8, axisY + 18);

    // 힌트
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(hint, cx, axisY + 38);
  };

  const { raw_metrics: rm, normalized_scores: ns, grades: g } = analysis;

  drawAxis(
    col1X, 'Time (속도/실행력)', g.time,
    rm.writing_speed ? (rm.writing_speed * 1000).toFixed(2) : '-',
    ' px/s', '획 거리/시간'
  );
  drawAxis(
    col2X, 'Coord (공간/전략)', g.coord,
    rm.sequentiality_score != null ? (rm.sequentiality_score * 100).toFixed(0) : '-',
    '% 순차', `역행 ${(rm.backtrack_ratio ? (rm.backtrack_ratio * 100).toFixed(0) : 0)}%`
  );
  drawAxis(
    col3X, 'Hesitation (머뭇거림)', g.hesitation,
    ns.hesitation_score != null ? ns.hesitation_score.toFixed(2) : '-',
    '', `멈칫 ${(rm.micro_pause_ratio * 100).toFixed(0)}% · 덧쓰기 ${(rm.revisit_density * 100).toFixed(0)}%`
  );
}
