/**
 * CropDialog — 그림 범위 조정 · 쪽에서 새로 자르기 (QBK-01 · TSK-15 문항 편집, TSK-13 서·논술 모범답안 공용)
 *
 * 원본 쪽 이미지 위에 상자를 띄우고 마우스로 조절한다 — 좌표를 입력하지 않는다.
 *   · 상자 안을 끌면 이동, 모서리·변 손잡이를 끌면 크기 조정, 상자 밖을 끌면 새 상자
 *   · 오른쪽에 잘릴 결과를 바로 미리 보기
 *   · [이 범위로 자르기] → onApply({ label, dataUrl, bytes, page, box, origin: 'teacher' })
 * box는 [ymin, xmin, ymax, xmax] — 쪽 크기 대비 0~1000 (AI 좌표와 같은 체계)
 */
import React, { useEffect, useRef, useState } from 'react';
import { cropFromPageImage } from './lib/taskFromFile';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const btn = (primary, disabled) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569',
});

const CropDialog = ({ open, pages = [], initial, label = '그림', title = '그림 범위 조정', onApply, onClose }) => {
  const [pageNo, setPageNo] = useState(initial?.page || pages[0]?.no || 1);
  const [box, setBox] = useState(initial?.box || null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPageNo(initial?.page || pages[0]?.no || 1);
    setBox(initial?.box || null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = pages.find((p) => p.no === pageNo) || pages[0];
  // 미리 보기 — 상자가 바뀔 때마다 잘라 본다
  useEffect(() => {
    if (!open || !page || !box || box[2] - box[0] < 5 || box[3] - box[1] < 5) { setPreview(null); return; }
    let alive = true;
    cropFromPageImage(page, box, label).then((r) => { if (alive) setPreview(r); }).catch(() => {});
    return () => { alive = false; };
  }, [open, page, box, label]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // 화면 좌표 → 0~1000
  const toNorm = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 1000, 0, 1000), y: clamp(((e.clientY - r.top) / r.height) * 1000, 0, 1000) };
  };
  const start = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    const p = toNorm(e);
    drag.current = { mode, p0: p, b0: box ? [...box] : [p.y, p.x, p.y, p.x] };
    if (mode === 'new') setBox([p.y, p.x, p.y, p.x]);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const p = toNorm(e);
    let [y0, x0, y1, x1] = d.b0;
    const dy = p.y - d.p0.y; const dx = p.x - d.p0.x;
    if (d.mode === 'move') {
      const h = y1 - y0; const w = x1 - x0;
      y0 = clamp(y0 + dy, 0, 1000 - h); x0 = clamp(x0 + dx, 0, 1000 - w); y1 = y0 + h; x1 = x0 + w;
    } else if (d.mode === 'new') {
      y0 = Math.min(d.p0.y, p.y); y1 = Math.max(d.p0.y, p.y); x0 = Math.min(d.p0.x, p.x); x1 = Math.max(d.p0.x, p.x);
    } else {
      if (d.mode.includes('n')) y0 = clamp(y0 + dy, 0, y1 - 10);
      if (d.mode.includes('s')) y1 = clamp(y1 + dy, y0 + 10, 1000);
      if (d.mode.includes('w')) x0 = clamp(x0 + dx, 0, x1 - 10);
      if (d.mode.includes('e')) x1 = clamp(x1 + dx, x0 + 10, 1000);
    }
    setBox([y0, x0, y1, x1].map(Math.round));
  };
  const end = () => { drag.current = null; window.removeEventListener('pointermove', move); };

  const apply = async () => {
    if (!page || !box) return;
    setBusy(true);
    try { onApply?.(await cropFromPageImage(page, box, label)); } finally { setBusy(false); }
  };
  const pct = (v) => `${v / 10}%`;
  const handlePos = (h) => ({
    top: h.includes('n') ? pct(box[0]) : h.includes('s') ? pct(box[2]) : pct((box[0] + box[2]) / 2),
    left: h.includes('w') ? pct(box[1]) : h.includes('e') ? pct(box[3]) : pct((box[1] + box[3]) / 2),
  });
  const cursorOf = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 14, width: 'min(1180px, 98vw)', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>✂️ {title}</strong>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>상자 안을 끌면 이동 · 모서리를 끌면 크기 조정 · 상자 밖을 끌면 새로 그리기</span>
          {pages.length > 1 && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>쪽</span>
              {pages.map((p) => (
                <button key={p.no} type="button" onClick={() => { setPageNo(p.no); if (p.no !== pageNo) setBox(null); }}
                  style={{ ...btn(p.no === pageNo), padding: '4px 10px' }}>{p.no}</button>
              ))}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: 12, background: '#F1F5F9', overflow: 'auto' }}>
          <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minWidth: 0 }}>
            {page ? (
              <div ref={stageRef} onPointerDown={(e) => start(e, 'new')}
                style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair', userSelect: 'none', touchAction: 'none', boxShadow: '0 2px 10px rgba(15,23,42,0.15)' }}>
                <img src={page.dataUrl} alt={`${page.no}쪽`} draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '74vh', width: 'auto' }} />
                {box && (
                  <div onPointerDown={(e) => start(e, 'move')}
                    style={{ position: 'absolute', top: pct(box[0]), left: pct(box[1]), height: pct(box[2] - box[0]), width: pct(box[3] - box[1]), border: '2px solid #2A75F3', background: 'rgba(42,117,243,0.08)', boxShadow: '0 0 0 9999px rgba(15,23,42,0.35)', cursor: 'move' }} />
                )}
                {box && HANDLES.map((h) => (
                  <span key={h} onPointerDown={(e) => start(e, h)} aria-label={`크기 조정 ${h}`}
                    style={{ position: 'absolute', ...handlePos(h), width: 14, height: 14, marginLeft: -7, marginTop: -7, background: 'white', border: '2px solid #2A75F3', borderRadius: 3, cursor: cursorOf[h] }} />
                ))}
              </div>
            ) : <div style={{ color: '#94A3B8', padding: 40 }}>원본 쪽 이미지가 없습니다.</div>}
          </div>
          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>잘릴 결과</div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: 8, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {preview ? <img src={preview.dataUrl} alt="미리 보기" style={{ maxWidth: '100%', maxHeight: 320 }} /> : <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center' }}>쪽 위를 끌어 범위를 그려 주세요</span>}
            </div>
            {initial?.dataUrl && (
              <>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginTop: 6 }}>지금 그림</div>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: 8, display: 'flex', justifyContent: 'center' }}>
                  <img src={initial.dataUrl} alt="지금 그림" style={{ maxWidth: '100%', maxHeight: 160, opacity: 0.85 }} />
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btn(false)}>취소</button>
          <button type="button" onClick={apply} disabled={!box || !preview || busy} style={btn(true, !box || !preview || busy)}>{busy ? '자르는 중…' : '이 범위로 자르기'}</button>
        </div>
      </div>
    </div>
  );
};

export default CropDialog;
