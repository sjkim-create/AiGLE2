/**
 * GuideReplay.jsx — 일괄 채점 통합 › 원본 보기 › ▶ AI 첨삭 「학습 안내」 순서 재생
 *
 * 피드백 보기의 학습 안내(바른 풀이 해설)를 한 항목씩 설명하면서, 그 항목에 해당하는 학생 필기 영역으로 확대(포커싱)하고
 * 그 구간의 획만 실제 쓴 순서대로 다시 그린다. (Tecet 「장면 = 문장 + 화면 동작」 구조를 차용 — 그림은 AI가 그린 것이 아니라 학생 본인 필기)
 *   · 항목 하나 = 확대 이동 → 구간 재생 + 자막(학생이 쓴 내용 → 무엇을 → 이렇게 해봐요 → 팁 → 확인)
 *   · 필기가 먼저 끝나고 설명이 남으면 — 「멈춰 두기」(다 쓴 상태로 유지, 기본) 또는 「반복 재생」(그 구간만 되풀이)
 *   · 고칠 곳(mark)은 다 쓴 뒤 빨강 + 점선 상자
 *   · 다음 항목으로 넘어가면 그 영역으로 확대해 다시 그 부분만 재생 · 마지막 항목이 끝나면 전체 보기로 돌아간다
 *   · 필기 구간이 없는 항목(빠뜨린 내용 등)은 전체 보기에서 설명만
 * 데이터: guide.items[i].pen = { s: [처음 획, 끝 획], mark?: [처음, 끝] } — 실제는 AI 채점 때 학습 안내와 함께 만든다(필기 인식 결과의 획 번호)
 * 음성 없음 — 자막만(풀이 과정 보기와 같은 정책)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PenStrokes, { penViewBox } from './PenStrokes';
import { penSchedule } from './lib/penTiming';

const FOCUS_SEC = 0.9;   // 다음 영역으로 확대 이동
const TAIL_SEC = 0.5;    // 항목 끝 여유
const LOOP_REST = 0.8;   // 반복 재생 — 다 쓴 모습을 잠깐 보여 준 뒤 다시
const OUT_SEC = 1.2;     // 마지막 — 전체 보기로
const SPEEDS = [1, 1.5, 2];
const readSec = (txt) => 1.4 + txt.length * 0.075;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const boxOf = (pen, a, b) => penViewBox(pen, a, b, 0).split(' ').map(Number);

/* 획 구간을 화면 비율에 맞춘 확대 영역으로 — 너무 작게 확대되지 않게 최소 폭, 전체 밖으로 나가지 않게 */
const focusBox = (pen, full, a, b) => {
  const [x, y, w, h] = boxOf(pen, a, b);
  const A = full[2] / full[3];
  let W = Math.max(w + 12, full[2] * 0.42);
  let H = Math.max(h + 10, W / A);
  W = Math.max(W, H * A);
  H = W / A;
  if (W > full[2]) { W = full[2]; H = full[3]; }
  let X = x + w / 2 - W / 2;
  let Y = y + h / 2 - H / 2;
  X = Math.min(Math.max(X, full[0]), full[0] + full[2] - W);
  Y = Math.min(Math.max(Y, full[1]), full[1] + full[3] - H);
  return [X, Y, W, H];
};

/* 항목마다 자막 문장 — 학생이 쓴 내용부터 확인까지 */
const linesOf = (it) => [
  it.written && { k: '학생이 쓴 내용', v: it.written.replace(/^"|"$/g, '') },
  it.ask && { k: '고칠 점', v: it.ask },
  (it.whenTo || it.example) && { k: '이렇게 해봐요', v: [it.whenTo, it.example].filter(Boolean).join(' — ') },
  it.tip && { k: '팁', v: it.tip },
  it.check && { k: '확인', v: it.check },
].filter(Boolean);

const buildTimeline = (items, pen, full) => {
  let t = 0;
  let prev = full;
  const out = items.map((it) => {
    const start = t;
    const seg = pen && it.pen?.s ? it.pen.s : null;
    const sched = seg ? penSchedule(pen, seg[0], seg[1]) : null;
    const W = sched ? sched.sec : 0;
    const lines = linesOf(it);
    let lt = FOCUS_SEC;
    const subs = lines.map((l) => { const s = { ...l, at: lt }; lt += readSec(l.v); s.end = lt; return s; });
    const N = lt - FOCUS_SEC;
    const dur = FOCUS_SEC + Math.max(W + 0.4, N) + TAIL_SEC;
    t += dur;
    const cam = seg ? focusBox(pen, full, seg[0], seg[1]) : full;
    const r = { it, start, end: t, W, sched, seg, subs, from: prev, cam, mark: seg && it.pen.mark ? boxOf(pen, it.pen.mark[0], it.pen.mark[1]) : null };
    prev = cam;
    return r;
  });
  out.outStart = t;
  out.total = t + OUT_SEC;
  out.last = prev;
  return out;
};

const lerpBox = (a, b, p) => a.map((v, i) => v + (b[i] - v) * p);

const GuideReplay = ({ guide, pen, penFrom = 0, onClose, closing = false, stageTarget = null, sampleNote, studentName }) => {
  const items = guide.items;
  const full = useMemo(() => penViewBox(pen, penFrom).split(' ').map(Number), [pen, penFrom]);
  const tl = useMemo(() => buildTimeline(items, pen, full), [items, pen, full]);
  const total = tl.total;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [hold, setHold] = useState('hold'); // hold(멈춰 두기) · loop(반복 재생)
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!playing) return undefined;
    last.current = performance.now();
    const tick = (now) => {
      const dt = ((now - last.current) / 1000) * speed;
      last.current = now;
      setT((v) => {
        const nv = Math.min(total, v + dt);
        if (nv >= total) setPlaying(false);
        return nv;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, total]);

  const toggle = () => {
    if (t >= total) { setT(0); setPlaying(true); return; }
    setPlaying((p) => !p);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const outro = t >= tl.outStart;
  const cur = outro ? tl.length - 1 : Math.max(0, tl.findIndex((s) => t < s.end));
  const S = tl[cur];
  const lt = t - S.start; // 항목 안 시각
  const goItem = (i) => { setT(tl[Math.max(0, Math.min(tl.length - 1, i))].start); setPlaying(true); };

  /* 확대 영역 — 항목 시작에 이전 영역 → 이 영역으로 이동, 마지막엔 전체 보기로 */
  const cam = outro
    ? lerpBox(tl.last, full, ease(Math.min(1, (t - tl.outStart) / OUT_SEC)))
    : lerpBox(S.from, S.cam, ease(Math.min(1, lt / FOCUS_SEC)));
  const zoom = full[2] / cam[2];

  /* 지금 항목 구간의 필기 진행(초) — 멈춰 두기는 다 쓴 상태 유지, 반복 재생은 구간을 되풀이 */
  const wt = (() => {
    if (outro) return Infinity;
    const x = lt - FOCUS_SEC;
    if (x < 0) return -1;
    if (x <= S.W || hold === 'hold') return Math.min(x, S.W + 0.001);
    const P = S.W + LOOP_REST;
    const ph = (x - S.W) % P;
    return ph < LOOP_REST ? S.W + 0.001 : ph - LOOP_REST;
  })();
  const firstPassDone = outro || lt - FOCUS_SEC >= S.W;
  const looping = !outro && hold === 'loop' && firstPassDone && lt - FOCUS_SEC > S.W + 0.05;

  const penState = useMemo(() => {
    const m = new Map();
    let tip = null;
    tl.forEach((s, i) => {
      if (!s.sched) return;
      const done = outro || i < cur;
      if (i > cur && !outro) return;
      const inMark = (k) => s.it.pen.mark && k >= s.it.pen.mark[0] && k <= s.it.pen.mark[1];
      s.sched.list.forEach(({ k, at, cum }) => {
        if (done) { m.set(k, { n: cum.length, color: inMark(k) ? '#DC2626' : '#334155' }); return; }
        const x = wt - at;
        if (x < 0) return;
        let n = cum.length;
        if (x < cum[cum.length - 1]) { n = cum.findIndex((c) => c > x); if (n < 1) n = 1; const pt = pen.strokes[k].p[n - 1]; tip = [pt[0], pt[1]]; }
        m.set(k, { n, color: inMark(k) && firstPassDone ? '#DC2626' : '#1D4ED8' });
      });
    });
    return { m, tip };
  }, [tl, cur, wt, outro, firstPassDone, pen]);

  const sub = outro ? null : [...S.subs].reverse().find((s) => lt >= s.at) || null;
  const showMark = !outro && S.mark && firstPassDone;
  const pad = 1.2;

  const stage = (
    <>
      <div className="grp-sheet" aria-label="학생 필기 · 학습 안내 영역">
        <div className="grp-cap">
          <span>{outro ? '전체 보기' : S.seg ? `학습 안내 ${cur + 1} · 해당 필기 영역` : `학습 안내 ${cur + 1} · 해당 필기 없음(전체 보기)`}</span>
          {zoom > 1.05 && <span className="grp-zoom">🔍 {zoom.toFixed(1)}배</span>}
          {looping && <span className="grp-loop">⟳ 반복 재생 중</span>}
        </div>
        <PenStrokes pen={pen} from={penFrom} viewBox={cam.join(' ')} strokeState={(k) => penState.m.get(k)} tip={penState.tip}
          ghost="#E5E9F0" width={0.38 * Math.max(0.55, 1 / Math.sqrt(zoom))} style={{ maxHeight: 'min(40vh, 380px)' }} label="학생 필기">
          {showMark && (
            <rect className="grp-mark" x={S.mark[0] - pad} y={S.mark[1] - pad} width={S.mark[2] + pad * 2} height={S.mark[3] + pad * 2} rx={1.2}
              fill="rgba(220,38,38,.06)" stroke="#DC2626" strokeWidth={0.35 / Math.sqrt(zoom)} strokeDasharray="1.2 0.8" />
          )}
        </PenStrokes>
      </div>
      <div className="grp-cc" aria-live="polite">
        {sub && <span key={`${cur}-${sub.k}`} className="grp-cc-t"><b>{sub.k}</b>{sub.v}</span>}
      </div>
      <div className="grp-ctrl">
        <button type="button" className="grp-btn main" aria-label={playing ? '일시정지' : '재생'} onClick={toggle}>{playing ? '⏸' : t >= total ? '⟲' : '▶'}</button>
        <button type="button" className="grp-btn" aria-label="이전 안내" disabled={cur === 0 && !outro} onClick={() => goItem(outro ? tl.length - 1 : cur - 1)}>⏮</button>
        <button type="button" className="grp-btn" aria-label="다음 안내" disabled={cur >= tl.length - 1} onClick={() => goItem(cur + 1)}>⏭</button>
        <div className="grp-seek-wrap">
          <input className="grp-seek" type="range" min={0} max={total} step={0.01} value={t} aria-label="재생 위치" onChange={(e) => setT(Number(e.target.value))} />
          {tl.map((s, i) => i > 0 && <span key={i} className="grp-tick" style={{ left: `${(s.start / total) * 100}%` }} aria-hidden="true" />)}
        </div>
        <span className="grp-time">{cur + 1}/{tl.length} · {fmt(t)}</span>
      </div>
      <div className="grp-ctrl2">
        <div className="grp-seg" role="group" aria-label="필기가 먼저 끝났을 때">
          <span className="grp-seg-k">설명이 남으면</span>
          <button type="button" aria-pressed={hold === 'hold'} onClick={() => setHold('hold')}>멈춰 두기</button>
          <button type="button" aria-pressed={hold === 'loop'} onClick={() => setHold('loop')}>반복 재생</button>
        </div>
        <div className="grp-seg" role="group" aria-label="재생 속도">
          {SPEEDS.map((v) => <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v.toFixed(1)}x</button>)}
        </div>
      </div>
    </>
  );

  return (
    <div className={`grp-panel ${closing ? 'closing' : ''}`} role="region" aria-label="AI 첨삭 · 학습 안내">
      <style>{CSS}</style>
      <div className="grp-box">
        <div className="grp-head">
          <div>
            <div className="grp-ttl">AI 첨삭 <span>학습 안내 순서</span></div>
            <div className="grp-tags">
              {sampleNote && <span className="grp-tag-s">{sampleNote}</span>}
              {studentName && <span>{studentName}</span>}
            </div>
          </div>
          <button type="button" className="grp-x" aria-label="닫기" onClick={onClose}>✕</button>
        </div>
        <div className="grp-body">
          {guide.title && <div className="grp-gtitle">{guide.title}</div>}
          <ol className="grp-items">
            {tl.map((s, i) => {
              const on = i === cur && !outro;
              const doneI = outro || i < cur;
              return (
                <li key={i} className={`grp-li ${on ? 'on' : ''} ${doneI ? 'done' : ''}`}>
                  <button type="button" className="grp-item" aria-expanded={on} onClick={() => goItem(i)}>
                    <span className="grp-no">{i + 1}</span>
                    <span className="grp-ask">{s.it.ask}</span>
                    <span className="grp-st">{doneI ? '✓' : on ? '▶' : ''}</span>
                  </button>
                  {on && (
                    <div className="grp-detail">
                      {s.subs.map((l) => (
                        <div key={l.k} className={`grp-line ${sub?.k === l.k ? 'now' : ''} ${lt >= l.at ? 'seen' : ''}`}>
                          <span className="grp-line-k">{l.k}</span>
                          <span className="grp-line-v">{l.v}</span>
                        </div>
                      ))}
                      {!s.seg && <div className="grp-nopen">이 안내에 해당하는 필기가 없어 전체 필기를 보여 줘요.</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="grp-foot">교사 확인용 — 학습 안내 항목마다 해당 필기 영역을 확대해 그 부분만 다시 그립니다. 오른쪽 원본 보기에서 재생됩니다.</div>
      </div>
      {stageTarget && createPortal(stage, stageTarget)}
    </div>
  );
};

const CSS = `
.grp-panel{height:100%;animation:grp-pull .45s cubic-bezier(.22,.8,.24,1)}
.grp-panel.closing{animation:grp-push .3s ease-in forwards}
@keyframes grp-pull{from{clip-path:inset(0 0 0 100% round 12px);transform:translateX(24px);opacity:.4}to{clip-path:inset(0 0 0 0 round 12px);transform:none;opacity:1}}
@keyframes grp-push{from{opacity:1}to{clip-path:inset(0 0 0 100% round 12px);transform:translateX(24px);opacity:0}}
.grp-box{height:100%;display:flex;flex-direction:column;background:#fff;border:1px solid #C7D7FB;border-radius:12px;box-shadow:0 14px 34px rgba(15,23,42,.18);overflow:hidden}
.grp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:12px 16px;border-bottom:1px solid #E4EAF3}
.grp-ttl{font-size:var(--neo-font-size-base);font-weight:700;color:#0F172A}
.grp-ttl span{font-size:var(--neo-font-size-xs);font-weight:600;color:#1D4ED8;background:#EFF6FF;border-radius:999px;padding:2px 8px;margin-left:6px}
.grp-tags{display:flex;gap:6px;margin-top:4px;font-size:var(--neo-font-size-xs);color:#64748B}
.grp-tag-s{background:#FEF3C7;color:#92400E;border-radius:999px;padding:1px 8px}
.grp-x{border:none;background:none;font-size:var(--neo-font-size-base);color:#64748B;cursor:pointer;padding:4px 6px;border-radius:6px}
.grp-x:hover{background:#F1F5F9}
.grp-body{flex:1;min-height:0;overflow-y:auto;padding:14px 16px}
.grp-gtitle{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 14px;font-size:var(--neo-font-size-sm);font-weight:600;color:#1D4ED8;margin-bottom:12px}
.grp-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.grp-li{border:1px solid #E4EAF3;border-radius:10px;overflow:hidden}
.grp-li.on{border-color:#93B4F8;box-shadow:0 0 0 2px rgba(42,117,243,.12)}
.grp-item{width:100%;display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:none;background:#fff;cursor:pointer;text-align:left;font:inherit}
.grp-li.on .grp-item{background:#F5F9FF}
.grp-no{flex:none;width:22px;height:22px;border-radius:50%;background:#CBD5E1;color:#fff;font-size:var(--neo-font-size-xs);font-weight:600;display:flex;align-items:center;justify-content:center}
.grp-li.on .grp-no,.grp-li.done .grp-no{background:#2A75F3}
.grp-ask{flex:1;font-size:var(--neo-font-size-sm);font-weight:600;color:#0F172A;line-height:1.6}
.grp-st{flex:none;font-size:var(--neo-font-size-xs);color:#2A75F3;min-width:12px}
.grp-detail{padding:4px 12px 12px 44px;display:flex;flex-direction:column;gap:6px}
.grp-line{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-radius:8px;border-left:3px solid transparent;opacity:.55;transition:opacity .25s,background .25s}
.grp-line.seen{opacity:1}
.grp-line.now{background:#EFF6FF;border-left-color:#2A75F3}
.grp-line-k{font-size:var(--neo-font-size-xs);font-weight:600;color:#1D4ED8}
.grp-line-v{font-size:var(--neo-font-size-sm);color:#0F172A;line-height:1.7}
.grp-nopen{font-size:var(--neo-font-size-xs);color:#64748B}
.grp-foot{padding:8px 16px;border-top:1px solid #E4EAF3;font-size:var(--neo-font-size-xs);color:#64748B;line-height:1.6}
.grp-sheet{position:relative;background:#fff;border:1px solid #E5E7EB;padding:14px 16px 16px;overflow:hidden}
.grp-cap{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:var(--neo-font-size-xs);color:#64748B;margin-bottom:6px;min-height:22px}
.grp-zoom{background:#EFF6FF;color:#1D4ED8;border-radius:999px;padding:1px 8px;font-weight:600}
.grp-loop{background:#F5F3FF;color:#6D28D9;border-radius:999px;padding:1px 8px;font-weight:600}
.grp-mark{animation:grp-blink 1.4s ease-in-out infinite}
@keyframes grp-blink{0%,100%{opacity:1}50%{opacity:.45}}
.grp-cc{min-height:56px;display:flex;align-items:center;justify-content:center;margin-top:10px}
.grp-cc-t{max-width:100%;background:rgba(15,23,42,.84);color:#fff;font-size:var(--neo-font-size-base);line-height:1.55;padding:8px 14px;border-radius:10px;text-align:center;animation:grp-cc .25s ease-out}
.grp-cc-t b{display:block;font-size:var(--neo-font-size-xs);font-weight:600;color:#93C5FD;margin-bottom:2px}
@keyframes grp-cc{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.grp-ctrl{display:flex;align-items:center;gap:8px;margin-top:8px}
.grp-btn{width:34px;height:34px;flex:none;border-radius:50%;border:1px solid #CBD5E1;background:#fff;cursor:pointer;font-size:var(--neo-font-size-sm);color:#334155}
.grp-btn.main{background:#2A75F3;border-color:#2A75F3;color:#fff}
.grp-btn:disabled{opacity:.4;cursor:default}
.grp-seek-wrap{position:relative;flex:1;display:flex;align-items:center}
.grp-seek{width:100%;accent-color:#2A75F3}
.grp-tick{position:absolute;top:50%;width:2px;height:10px;margin-top:-5px;background:#94A3B8;pointer-events:none}
.grp-time{font-size:var(--neo-font-size-xs);color:#64748B;font-variant-numeric:tabular-nums;flex:none}
.grp-ctrl2{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.grp-seg{display:inline-flex;align-items:center;gap:2px;background:#F1F5F9;border-radius:8px;padding:2px}
.grp-seg-k{font-size:var(--neo-font-size-xs);color:#64748B;padding:0 6px}
.grp-seg button{border:none;background:none;font:inherit;font-size:var(--neo-font-size-xs);color:#475569;padding:5px 10px;border-radius:6px;cursor:pointer}
.grp-seg button[aria-pressed="true"]{background:#fff;color:#1D4ED8;font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
`;

export default GuideReplay;
