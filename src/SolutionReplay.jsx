/**
 * SolutionReplay.jsx — 학생 모드 › 풀이 과정 보기 (docs/multi-type/풀이과정_보기_설계.md)
 *
 * Tecet 「과정을 영상처럼」을 차용하되, AI가 그린 그림이 아니라 **학생 본인 필기**를 단계별로 재생한다.
 *   · 단계마다 그 구간의 필기가 써지고, 자막(설명)이 바뀐다 — 음성 없음(자막만)
 *   · 설명 수준 = 문항 목표 학년 자동(학생이 고르지 않음) / 설명 길이 = 기본 · 자세히
 *   · 정답 잠금 — 끝까지 재생하면 바른 풀이 공개(한 번 열리면 다시 잠기지 않음)
 *   · 필기가 멈춘 구간(머뭇거림)은 「⏸ n초 멈춤」으로 짧게 보여 준다
 *   · 태블릿 — 가로는 2단(재생 · 단계), 좁은 화면은 1단. 손가락으로 누르기 쉬운 버튼 크기
 *
 * 프로토: 필기 획 데이터 대신 답안 글자를 한 글자씩 드러내 쓰는 순서를 흉내 낸다.
 *   실제는 펜 획(좌표 · 시각)을 그대로 재생 — 단계 = 획 구간. 단계 나누기 · 설명은 AI 채점 때 미리 만들어 두어 학생은 기다리지 않는다
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

const CHAR_SEC = 0.11;   // 글자 하나 쓰는 시간(프로토)
const GAP_SEC = 0.7;     // 단계 사이 쉼
const PAUSE_SHOW_SEC = 1.6; // 실제 멈춘 시간은 이 길이로 줄여 보여 준다
const SPEEDS = [1, 1.5, 2];

/* steps: [{ title, ok, line, text, pauseSec?, basic, detail }] — text는 그 단계에 쓴 글자(답안 줄 안에서 순서대로) */
const buildTimeline = (steps) => {
  let t = 0;
  const lineCursor = {};
  return steps.map((s, i) => {
    const start = t;
    let pauseFrom = null;
    if (s.pauseSec) { pauseFrom = t; t += PAUSE_SHOW_SEC; }
    const writeFrom = t;
    const from = lineCursor[s.line] || 0;
    const len = s.text ? s.text.length : 0;
    lineCursor[s.line] = from + len;
    t += len * CHAR_SEC;
    const end = t;
    if (i < steps.length - 1) t += GAP_SEC;
    return { ...s, start, writeFrom, end, from, len, pauseFrom };
  });
};

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const SolutionReplay = ({ q, A, onClose }) => {
  const sol = q.solution;
  const tl = useMemo(() => buildTimeline(sol.steps), [sol]);
  const total = tl[tl.length - 1].end;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [len, setLen] = useState('basic'); // basic · detail
  const [unlocked, setUnlocked] = useState(false);
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
        if (nv >= total) { setPlaying(false); setUnlocked(true); }
        return nv;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cur = Math.max(0, tl.findIndex((s, i) => t < (tl[i + 1]?.start ?? Infinity)));
  const step = tl[cur];
  const pausing = step.pauseFrom != null && t >= step.pauseFrom && t < step.writeFrom;

  const toggle = () => {
    if (t >= total) { setT(0); setPlaying(true); return; }
    setPlaying((p) => !p);
  };
  const seek = (v) => { setT(v); if (v >= total) setUnlocked(true); };
  const goStep = (i) => { setT(tl[i].start); setPlaying(true); };

  /* 줄마다 지금까지 쓴 글자 수 · 단계별 색 */
  const lines = q.answer.map((line, li) => {
    const parts = tl.filter((s) => s.line === li && s.len > 0).map((s) => {
      const idx = tl.indexOf(s);
      const shown = t <= s.writeFrom ? 0 : Math.min(s.len, Math.ceil((t - s.writeFrom) / CHAR_SEC));
      return { s, idx, text: line.slice(s.from, s.from + s.len), shown };
    });
    return parts;
  });
  const writingIdx = tl.findIndex((s) => s.len > 0 && t > s.writeFrom && t < s.end);

  return (
    <div className="srp-wrap" role="dialog" aria-modal="true" aria-label={`풀이 과정 보기 · ${q.label}`}>
      <style>{CSS}</style>
      <div className="srp-box">
        <div className="srp-head">
          <div className="srp-head-l">
            <div className="srp-ttl">풀이 과정 보기 <span className="srp-q">{q.label}</span></div>
            <div className="srp-tags">
              <span>{A.subject}</span><span>{sol.unit}</span>
              <span title="설명 수준은 문항의 목표 학년에 맞춰 정해집니다">설명 수준 · {sol.level} 눈높이</span>
            </div>
          </div>
          <button type="button" className="srp-x" aria-label="닫기" onClick={onClose}>✕</button>
        </div>

        <div className="srp-cols">
          {/* 좌: 내 필기 재생 + 자막 + 재생 막대 */}
          <div className="srp-l">
            <div className="srp-paper" aria-label="내 필기 재생">
              <div className="srp-paper-cap">내 필기 · {A.cap}</div>
              {lines.map((parts, li) => (
                <div key={li} className="srp-line">
                  {parts.map(({ s, idx, text, shown }) => (
                    <span key={idx} className={`srp-seg ${idx === cur ? 'on' : ''} ${!s.ok && t >= s.end ? 'warn' : ''}`}>
                      {text.slice(0, shown)}
                      {idx === writingIdx && <span className="srp-tip" aria-hidden="true" />}
                      <span className="srp-ghost">{text.slice(shown)}</span>
                    </span>
                  ))}
                </div>
              ))}
              {pausing && <div className="srp-pause">⏸ 필기가 {step.pauseSec}초 멈췄어요</div>}
            </div>

            <div className={`srp-sub ${step.ok ? '' : 'warn'}`} aria-live="polite">
              <div className="srp-sub-t"><span className="srp-no">{String(cur + 1).padStart(2, '0')}</span>{step.title}<span className={`srp-mark ${step.ok ? 'ok' : 'no'}`}>{step.ok ? '✓ 잘했어요' : '! 다시 보기'}</span></div>
              <div className="srp-sub-d">{len === 'detail' ? step.detail : step.basic}</div>
            </div>

            <div className="srp-ctrl">
              <button type="button" className="srp-btn main" aria-label={playing ? '일시정지' : '재생'} onClick={toggle}>{playing ? '⏸' : t >= total ? '⟲' : '▶'}</button>
              <button type="button" className="srp-btn" aria-label="처음부터" onClick={() => { setT(0); setPlaying(true); }}>⟲</button>
              <input className="srp-seek" type="range" min={0} max={total} step={0.01} value={t} aria-label="재생 위치"
                onChange={(e) => seek(Number(e.target.value))} />
              <span className="srp-time">{cur + 1}/{tl.length} · {fmt(t)}</span>
              <div className="srp-seg-btns" role="group" aria-label="재생 속도">
                {SPEEDS.map((v) => <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v.toFixed(1)}x</button>)}
              </div>
            </div>
          </div>

          {/* 우: 단계 목록 · 설명 길이 · 정답 */}
          <div className="srp-r">
            <div className="srp-rhead">
              <b>풀이 단계</b>
              <div className="srp-seg-btns" role="group" aria-label="설명 길이">
                <button type="button" aria-pressed={len === 'basic'} onClick={() => setLen('basic')}>기본</button>
                <button type="button" aria-pressed={len === 'detail'} onClick={() => setLen('detail')}>자세히</button>
              </div>
            </div>
            <ol className="srp-steps">
              {tl.map((s, i) => (
                <li key={i}>
                  <button type="button" className={`srp-step ${i === cur ? 'on' : ''} ${t >= s.end ? 'done' : ''}`} onClick={() => goStep(i)}>
                    <span className="srp-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="srp-step-t">{s.title}</span>
                    <span className={`srp-dot ${s.ok ? 'ok' : 'no'}`} aria-label={s.ok ? '잘했어요' : '다시 보기'}>{s.ok ? '✓' : '!'}</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="srp-concept">
              <div className="k">핵심 개념</div>
              <div>{sol.concept}</div>
            </div>

            <div className={`srp-answer ${unlocked ? 'open' : ''}`}>
              <div className="k">바른 풀이 {unlocked ? '' : '🔒'}</div>
              {unlocked
                ? sol.answer.map((l, i) => <div key={i} className="srp-ans-l">{l}</div>)
                : <div className="srp-lock">내 풀이를 끝까지 보면 열려요</div>}
            </div>
          </div>
        </div>

        <div className="srp-foot">풀이 설명은 AI가 내 필기를 단계로 나눠 만들고, 선생님이 채점 결과와 함께 보낸 내용이에요. 궁금한 점은 선생님께 여쭤보세요.</div>
      </div>
    </div>
  );
};

export default SolutionReplay;

const CSS = `
.srp-wrap{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.srp-box{background:#fff;border-radius:16px;width:min(1180px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);color:#17212F}
.srp-box button{font-family:inherit;cursor:pointer}
.srp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid #E4EAF3}
.srp-ttl{font-size:var(--neo-font-size-lg);font-weight:700}
.srp-q{margin-left:6px;font-size:var(--neo-font-size-sm);color:#2563EB;background:#EEF3FD;padding:2px 9px;border-radius:999px;vertical-align:middle}
.srp-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.srp-tags span{font-size:var(--neo-font-size-xs);color:#3C4858;background:#F4F7FB;border:1px solid #E4EAF3;padding:2px 8px;border-radius:6px}
.srp-x{border:none;background:#F4F7FB;width:44px;height:44px;border-radius:10px;font-size:var(--neo-font-size-lg);color:#3C4858;flex:none}
.srp-cols{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:0;min-height:0;overflow-y:auto}
.srp-l{padding:18px 20px;display:flex;flex-direction:column;gap:14px;min-width:0}
.srp-r{padding:18px 20px;border-left:1px solid #E4EAF3;background:#FAFBFD;display:flex;flex-direction:column;gap:14px}
.srp-paper{position:relative;min-height:220px;background:#FFFEF8;border:1px solid #E9E3CF;border-radius:12px;padding:40px 22px 26px;
  background-image:repeating-linear-gradient(transparent 0 47px,#EDE7D3 47px 48px);background-position:0 30px}
.srp-paper-cap{position:absolute;top:10px;left:16px;font-size:var(--neo-font-size-xs);color:#98A3B0}
.srp-line{font-family:'Nanum Pen Script',cursive;font-size:30px;line-height:48px;color:#1E293B;word-break:keep-all;overflow-wrap:anywhere}
.srp-seg{transition:color .2s}
.srp-seg.on{color:#1D4ED8}
.srp-seg.warn{text-decoration:underline wavy #EF4444;text-decoration-thickness:1.5px;text-underline-offset:6px}
.srp-ghost{color:transparent}
.srp-tip{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2563EB;margin:0 1px;vertical-align:middle;box-shadow:0 0 0 4px rgba(37,99,235,.18)}
.srp-pause{position:absolute;right:14px;bottom:12px;font-size:var(--neo-font-size-sm);font-weight:700;color:#8A5A12;background:#FBF1DE;padding:6px 12px;border-radius:999px}
.srp-sub{border-radius:12px;background:#EEF3FD;padding:14px 16px;min-height:96px}
.srp-sub.warn{background:#FFF4ED}
.srp-sub-t{display:flex;align-items:center;gap:8px;font-weight:700;font-size:var(--neo-font-size-base);flex-wrap:wrap}
.srp-sub-d{margin-top:6px;line-height:1.7;color:#3C4858;font-size:var(--neo-font-size-base)}
.srp-no{font-size:var(--neo-font-size-xs);font-weight:700;color:#fff;background:#2563EB;border-radius:6px;padding:2px 7px}
.srp-mark{font-size:var(--neo-font-size-xs);font-weight:700;padding:2px 8px;border-radius:999px}
.srp-mark.ok{color:#2E6B32;background:#EAF6E9}
.srp-mark.no{color:#C2410C;background:#FFEDD5}
.srp-ctrl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.srp-btn{min-width:44px;height:44px;border-radius:10px;border:1px solid #E4EAF3;background:#fff;font-size:var(--neo-font-size-lg);color:#3C4858}
.srp-btn.main{background:#2563EB;border-color:#2563EB;color:#fff}
.srp-seek{flex:1;min-width:140px;height:44px;accent-color:#2563EB}
.srp-time{font-size:var(--neo-font-size-sm);color:#6B7684;font-variant-numeric:tabular-nums}
.srp-seg-btns{display:inline-flex;border:1px solid #E4EAF3;border-radius:10px;overflow:hidden;background:#fff}
.srp-seg-btns button{border:none;background:none;min-width:48px;height:40px;padding:0 10px;font-size:var(--neo-font-size-sm);font-weight:700;color:#6B7684}
.srp-seg-btns button[aria-pressed="true"]{background:#2563EB;color:#fff}
.srp-rhead{display:flex;justify-content:space-between;align-items:center;gap:8px}
.srp-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.srp-step{width:100%;min-height:48px;display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #E4EAF3;border-radius:10px;background:#fff;text-align:left;font-size:var(--neo-font-size-sm);color:#3C4858}
.srp-step .srp-no{background:#98A3B0}
.srp-step.done .srp-no{background:#3C4858}
.srp-step.on{border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,.15);color:#17212F;font-weight:700}
.srp-step.on .srp-no{background:#2563EB}
.srp-step-t{flex:1}
.srp-dot{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:var(--neo-font-size-xs);font-weight:700}
.srp-dot.ok{color:#2E6B32;background:#EAF6E9}
.srp-dot.no{color:#C2410C;background:#FFEDD5}
.srp-concept,.srp-answer{border:1px solid #E4EAF3;border-radius:12px;background:#fff;padding:12px 14px;font-size:var(--neo-font-size-sm);line-height:1.7;color:#3C4858}
.srp-concept .k,.srp-answer .k{font-weight:700;color:#17212F;margin-bottom:4px}
.srp-answer{background:#F4F7FB}
.srp-answer.open{background:#EAF6E9;border-color:#BFE3BC}
.srp-lock{color:#98A3B0}
.srp-ans-l{font-weight:700;color:#1E293B}
.srp-foot{padding:10px 20px;border-top:1px solid #E4EAF3;font-size:var(--neo-font-size-xs);color:#6B7684;background:#fff}
@media (max-width:900px){
  .srp-wrap{padding:0}
  .srp-box{border-radius:0;height:100%}
  .srp-cols{grid-template-columns:minmax(0,1fr)}
  .srp-r{border-left:none;border-top:1px solid #E4EAF3}
  .srp-line{font-size:26px}
}
@media (prefers-reduced-motion: reduce){.srp-seg{transition:none}}
`;
