/**
 * penTiming.js — 풀이 과정 보기의 필기 재생 시간 계산 (SolutionReplay · 내레이션 원고 생성 스크립트 공용)
 *   원고를 쓸 때 「이 구간 필기가 몇 초인지」를 화면과 똑같이 계산해야 설명 분량을 맞출 수 있다
 */
export const CHAR_SEC = 0.11;        // 글자 하나 쓰는 시간(펜 데이터가 없는 시연 문항)
export const PAUSE_SHOW_SEC = 1.6;   // 실제 멈춘 시간은 이 길이로 줄여 보여 준다
export const STROKE_GAP_MAX = 0.45;  // 펜: 획 사이 쉼은 최대 이만큼(초)으로 줄인다

/* 펜 획 구간 [a, b]의 재생 일정 — 획마다 시작(장면 기준 초) · 점별 누적 시간 */
export const penSchedule = (pen, a, b) => {
  let t = 0;
  const out = [];
  for (let k = a; k <= b; k += 1) {
    const st = pen.strokes[k];
    if (k > a) {
      const prev = pen.strokes[k - 1];
      const prevEnd = prev.t + prev.p.reduce((x, q) => x + q[2], 0);
      t += Math.min(STROKE_GAP_MAX, Math.max(0.03, (st.t - prevEnd) / 1000));
    }
    let acc = 0;
    const cum = st.p.map((q, i) => { if (i) acc += q[2] / 1000; return acc; });
    out.push({ k, at: t, cum });
    t += acc;
  }
  return { list: out, sec: t };
};

/* 장면 하나의 필기 시간(초) — 멈춤 장면은 0 */
export const cueWriteSec = (c, pen) => {
  if (c.pause) return 0;
  if (pen && c.s) return penSchedule(pen, c.s[0], c.s[1]).sec;
  return (c.w || '').length * CHAR_SEC;
};

/* [내레이션] 설명 길이 D에 맞춘 필기 배속 — 필기는 최대 0.5배속까지 늦추고, 최대 3배속까지 당긴다
 *   반환 k = 필기 시간에 곱할 배율(2 = 두 배 천천히). 맞추지 못한 나머지는 필기가 기다리거나(설명이 김) 말 없이 이어진다(필기가 김) */
export const fitWriting = (W, D) => (W > 0 && D > 0 ? Math.min(Math.max(D, W / 3), 2 * W) / W : 1);
