/**
 * StudentReportV24.jsx — [v2.4] 교사 대시보드 › 학생 리포트 (1인용)
 *
 * 교사가 고른 과제들만 모아 학생 한 명의 결과를 한 장으로 정리한다 (상담·학부모 안내·학기 정리용).
 *   ① 리포트에 넣을 과제 고르기 (기본: 전부) — 고른 과제로 아래 전부 다시 집계
 *   ② 요약: 고른 과제 평균 점수 · 반 평균 대비 · 가장 잘한/아쉬운 과제
 *   ③ 과제별 점수 (원점수 · 100점 환산 · 반 평균 대비)
 *   ④ 평가 영역별 · 문항 유형별 점수 (학생 · 반 평균) — 영역 3개 이상은 방사형, 1~2개는 가로 막대(방사형은 면이 생기지 않는다)
 * [공개 기준] 학생·학부모도 보는 문서 — 점수(100점 환산)와 반 평균만 적고, 차이(±)·순위는 적지 않는다
 *   ⑤ 교사 의견 (직접 입력) → [인쇄]
 * 비교 기준은 그 학생의 반(그룹) 평균. 점수 = 받은 점수 ÷ 배점 × 100.
 *
 * [리포트 디자인 v2 2026-10-28] 채점 결과 리포트(POP-19)와 같은 문서 모양
 *   머리(제목 줄 · 이름 · 범위 · 평균 점수 크게) → 섹션은 제목 + 아래 선 → 칸선 없는 표
 *   요약의 「평균 점수」 칸은 머리로 올리고, 가장 잘한 · 아쉬운 과제는 두 줄 목록으로
 *   차트 고른 이유 안내(방사형/막대)는 교사용 — 인쇄물에서는 뺀다
 */
import React, { useMemo, useState } from 'react';

const totalOf = (t) => t.items.reduce((a, it) => a + it.points, 0);
const fmt1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const avg = (vals) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
const tone = (v) => (v < 60 ? '#DC2626' : v < 70 ? '#B45309' : '#1E293B');
const btn = (primary) => ({ padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569' });

/* 학생 vs 반 평균 막대 한 줄 */
const CompareRow = ({ label, sub, mine, cls }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 120px', gap: 12, alignItems: 'center', padding: '6px 0' }}>
    <div>
      <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B' }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{sub}</div>}
    </div>
    <div style={{ position: 'relative', height: 14, background: '#F1F5F9', borderRadius: 999 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${mine}%`, borderRadius: 999, background: mine < 60 ? '#F87171' : mine < 70 ? '#FBBF24' : '#3B82F6' }} />
      <div title={`반 평균 ${cls}점`} style={{ position: 'absolute', left: `${cls}%`, top: -4, bottom: -4, width: 2, marginLeft: -1, background: '#EF4444' }} />
    </div>
    <div style={{ textAlign: 'right', fontSize: 'var(--neo-font-size-sm)' }}>
      <b style={{ color: tone(mine) }}>{mine}점</b>
      <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)', marginLeft: 6 }}>반 평균 {cls}점</span>
    </div>
  </div>
);

/* 평가 영역 방사형 — 학생(파랑 실선) vs 반 평균(빨강 점선). 영역 3개 미만이면 막대로
 *   라벨은 SVG 글자 대신 꼭짓점 바깥에 HTML 라벨로 둔다 — 방향(위·아래·좌·우)에 맞춰 붙이고, 영역명 · 학생 점수 · 반 평균을 줄 맞춰 보인다 */
const AVG_RED = '#EF4444';
const AreaRadar = ({ rows, size = 300 }) => {
  const pad = 96;                    // 라벨 자리
  const W = size + pad * 2; const cx = W / 2; const cy = W / 2; const R = size / 2 - 6;
  const n = rows.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => { const rr = (Math.max(0, Math.min(100, v)) / 100) * R; return [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: W, margin: '0 auto', aspectRatio: '1 / 1' }}>
      {/* data-chart-fixed — 학생 선(2.5) · 반 평균(2) 굵기 차이를 그대로 둔다 (ChartScale 제외) */}
      <svg data-chart-fixed viewBox={`0 0 ${W} ${W}`} width="100%" height="100%" style={{ display: 'block' }}>
        {/* 바탕 — 안쪽부터 옅은 띠를 번갈아 칠해 단계가 읽히게 */}
        {[100, 75, 50, 25].map((lv, k) => (
          <polygon key={lv} points={poly(rows.map(() => lv))} fill={k % 2 === 0 ? '#F8FAFC' : '#FFFFFF'} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {rows.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a.k} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />; })}
        {[50, 100].map((lv) => { const [, y] = pt(0, lv); return <text key={lv} x={cx + 5} y={y + 11} fontSize="10" fill="#CBD5E1">{lv}</text>; })}
        {/* 반 평균 — 빨강 점선 */}
        <polygon points={poly(rows.map((a) => a.cls))} fill="none" stroke={AVG_RED} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        {rows.map((a, i) => { const [x, y] = pt(i, a.cls); return <circle key={`c${a.k}`} cx={x} cy={y} r="3" fill={AVG_RED} />; })}
        {/* 학생 — 면 색 없이 선만 (2026-10-28) */}
        <polygon points={poly(rows.map((a) => a.mine))} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" />
        {rows.map((a, i) => { const [x, y] = pt(i, a.mine); return <circle key={a.k} cx={x} cy={y} r="5" fill="white" stroke="#2563EB" strokeWidth="2.5"><title>{`${a.k} ${a.mine}점 · 반 평균 ${a.cls}점`}</title></circle>; })}
      </svg>
      {rows.map((a, i) => {
        const [x, y] = pt(i, 114);
        const c = Math.cos(ang(i)); const sn = Math.sin(ang(i));
        // 꼭짓점 방향으로 라벨을 붙인다 — 위는 아래쪽 기준, 아래는 위쪽 기준, 좌우는 옆에
        const tx = Math.abs(c) < 0.3 ? '-50%' : c > 0 ? '0%' : '-100%';
        const ty = Math.abs(sn) < 0.3 ? '-50%' : sn > 0 ? '0%' : '-100%';
        const align = Math.abs(c) < 0.3 ? 'center' : c > 0 ? 'left' : 'right';
        return (
          <div key={a.k} style={{ position: 'absolute', left: `${(x / W) * 100}%`, top: `${(y / W) * 100}%`, transform: `translate(${tx}, ${ty})`, textAlign: align, whiteSpace: 'nowrap', lineHeight: 1.25 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{a.k}</div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1D4ED8', letterSpacing: '-0.02em' }}>{a.mine}<span style={{ fontSize: 11, fontWeight: 700 }}>점</span></span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>반 평균 {a.cls}점 · 문항 {a.n}개</div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * @param {{ student: { id, name, className }, subject: string, tasks: any[], classmates: { id }[],
 *           data: Record<number, { taskScores, taskRaw, itemScores }>, onClose: () => void }} props
 */
const StudentReportV24 = ({ student, subject, tasks, classmates, data, onClose }) => {
  const [chosen, setChosen] = useState(() => new Set(tasks.map((t) => t.id)));
  const [note, setNote] = useState('');
  const sel = tasks.filter((t) => chosen.has(t.id));
  const toggle = (id) => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const r = useMemo(() => {
    const me = data[student.id];
    const rows = sel.map((t) => {
      const cls = avg(classmates.map((c) => data[c.id]?.taskScores[t.id]).filter((v) => v != null));
      return { t, raw: me.taskRaw[t.id], score: me.taskScores[t.id], cls, d: me.taskScores[t.id] - cls };
    });
    // 영역·유형 — 고른 과제의 문항을 모아 (받은 점수 합 ÷ 배점 합). 반 평균은 반 학생 각자의 득점률 평균
    const rateBy = (sid, key) => {
      const acc = {};
      sel.forEach((t) => t.items.forEach((it) => {
        const k = it[key]; acc[k] = acc[k] || { got: 0, tot: 0 };
        acc[k].got += data[sid]?.itemScores[`${t.id}-${it.no}`] ?? 0; acc[k].tot += it.points;
      }));
      return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round((v.got / v.tot) * 100)]));
    };
    const compare = (key) => {
      const mine = rateBy(student.id, key);
      const all = classmates.map((c) => rateBy(c.id, key));
      return Object.keys(mine).map((k) => ({ k, mine: mine[k], cls: avg(all.map((a) => a[k]).filter((v) => v != null)),
        n: sel.reduce((a, t) => a + t.items.filter((it) => it[key] === k).length, 0) }));
    };
    const areas = compare('area');
    const types = compare('type');
    const myAvg = avg(rows.map((x) => x.score)); const clsAvg = avg(rows.map((x) => x.cls));
    const best = rows.slice().sort((a, b) => b.score - a.score)[0]; const worst = rows.slice().sort((a, b) => a.score - b.score)[0]; // 학생 점수 기준
    const sa = areas.slice().sort((a, b) => b.mine - a.mine); // 학생 점수 기준 — 높은 영역 · 낮은 영역
    return { rows, areas, types, myAvg, clsAvg, best, worst, strongArea: sa[0], weakArea: sa[sa.length - 1] };
  }, [student.id, chosen, data, classmates]); // eslint-disable-line react-hooks/exhaustive-deps

  const period = sel.length ? `${sel[0].date} ~ ${sel[sel.length - 1].date}` : '–';
  const today = (() => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; })();
  const sheetId = 'student-report-sheet';
  const print = () => {
    const el = document.getElementById(sheetId);
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w || !el) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${student.name} 학습 리포트</title>
      <style>body{font-family:'Pretendard','Noto Sans KR',sans-serif;margin:24px;color:#1E293B} *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact} textarea{display:none} .print-only-note{display:block !important} .report-hint{display:none !important}</style></head><body>${el.outerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const block = { marginTop: 28 };
  const h4 = { fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B', margin: '0 0 12px', paddingBottom: 8, borderBottom: '1px solid #E2E8F0' };

  return (
    <div role="dialog" aria-modal="true" aria-label={`${student.name} 학생 리포트`}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', justifyContent: 'center', overflowY: 'auto', padding: '28px 16px' }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(920px, 100%)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 리포트에 넣을 과제 — 인쇄물에는 들어가지 않는다 */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B' }}>리포트에 넣을 과제</b>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{sel.length}/{tasks.length}개 선택 · 고른 과제로 다시 집계합니다</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" style={btn(false)} onClick={() => setChosen(new Set(tasks.map((t) => t.id)))}>전체 선택</button>
              <button type="button" style={btn(true)} onClick={print} disabled={!sel.length}>인쇄</button>
              <button type="button" style={btn(false)} onClick={onClose}>닫기</button>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tasks.map((t) => {
              const on = chosen.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on}
                  style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#94A3B8',
                    fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
                  {on ? '✓ ' : ''}{t.name} · {t.date}
                </button>
              );
            })}
          </div>
        </div>

        {/* 리포트 본문 */}
        <div id={sheetId} style={{ background: 'white', borderRadius: 16, padding: '36px 44px 40px' }}>
          {/* 머리 — 채점 결과 리포트와 같은 구성: 제목 줄 → 이름 · 범위 · 평균 점수 */}
          <header>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingBottom: 10, borderBottom: '2px solid #1E293B' }}>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>학생 학습 리포트</span>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>작성일 {today} · 비교 기준 {student.className} 평균</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 20, alignItems: 'end', padding: '18px 0 16px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E293B', lineHeight: 1.2 }}>{student.name}</div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 4 }}>{student.className}</div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#334155', marginTop: 10 }}>
                  <span style={{ color: '#2A75F3' }}>[{subject}]</span> 과제 {sel.length}개 <span style={{ fontWeight: 500, color: '#64748B' }}>· {period}</span>
                </div>
              </div>
              {sel.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 600 }}>평균 점수</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: r.myAvg < 60 ? tone(r.myAvg) : '#1D4ED8', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{r.myAvg}점</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 2 }}>반 평균 {r.clsAvg}점</div>
                </div>
              )}
            </div>
          </header>

          {!sel.length ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94A3B8' }}>리포트에 넣을 과제를 골라 주세요.</div>
          ) : (
            <>
              {/* ② 요약 */}
              <div style={{ marginTop: 14, fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
                {[['가장 잘한 과제', r.best, '#65A30D'], ['아쉬운 과제', r.worst, '#F97316']].map(([label, x, dot]) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) auto', gap: 12, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid #EEF2F6' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#1E293B' }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: dot, flex: 'none' }} />{label}
                    </span>
                    <span style={{ fontWeight: 700, color: '#1E293B', minWidth: 0 }}>{x.t.name}</span>
                    <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><b style={{ color: tone(x.score) }}>{x.score}점</b> · 반 평균 {x.cls}점</span>
                  </div>
                ))}
              </div>
              {r.areas.length > 1 && (
                <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', margin: '12px 0 0', lineHeight: 1.7, maxWidth: '68ch' }}>
                  가장 높은 영역은 <b>{r.strongArea.k}</b> {r.strongArea.mine}점(반 평균 {r.strongArea.cls}점), 가장 낮은 영역은 <b>{r.weakArea.k}</b> {r.weakArea.mine}점(반 평균 {r.weakArea.cls}점)입니다.
                </p>
              )}

              {/* ③ 과제별 점수 */}
              <div style={block}>
                <h4 style={h4}>과제별 점수</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                  <thead>
                    <tr style={{ color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>
                      {['과제', '날짜', '받은 점수', '100점 환산', '반 평균'].map((h, i) => <th key={h} style={{ textAlign: i < 2 ? 'left' : 'right', padding: '8px 4px', borderBottom: '1px solid #CBD5E1', fontWeight: 700 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((x) => (
                      <tr key={x.t.id} style={{ borderBottom: '1px solid #EEF2F6', fontVariantNumeric: 'tabular-nums' }}>
                        <td style={{ padding: '9px 4px', fontWeight: 700 }}>{x.t.name}</td>
                        <td style={{ padding: '9px 4px', color: '#64748B' }}>{x.t.date}</td>
                        <td style={{ padding: '9px 4px', textAlign: 'right' }}>{fmt1(x.raw)}/{totalOf(x.t)}점</td>
                        <td style={{ padding: '9px 4px', textAlign: 'right', fontWeight: 800, color: tone(x.score) }}>{x.score}점</td>
                        <td style={{ padding: '9px 4px', textAlign: 'right', color: '#64748B' }}>{x.cls}점</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ④ 영역 · 유형 */}
              <div style={{ ...block, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28 }}>
                <div>
                  <h4 style={h4}>평가 영역별 점수</h4>
                  {r.areas.length >= 3 && /* 방사형 범례 — 막대일 때는 아래 「빨간 선 = 반 평균」 안내로 충분 */
                  <div style={{ display: 'flex', gap: 14, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 4 }}>
                    <span><span style={{ display: 'inline-block', width: 16, borderTop: '3px solid #2563EB', verticalAlign: 'middle', marginRight: 4 }} />{student.name}</span>
                    <span><span style={{ display: 'inline-block', width: 16, borderTop: '2px dashed #EF4444', verticalAlign: 'middle', marginRight: 4 }} />반 평균</span>
                  </div>}
                  {r.areas.length >= 3
                    ? <AreaRadar rows={r.areas} />
                    : r.areas.map((a) => <CompareRow key={a.k} label={a.k} sub={`문항 ${a.n}개`} mine={a.mine} cls={a.cls} />)}
                  <p className="report-hint" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '6px 0 0', lineHeight: 1.5 }}>
                    {/* 한 줄 안내 — 방사형 · 막대 두 경우에 같은 문장 */}
                    영역 3개 이상은 방사형, 1~2개는 막대로 비교합니다.
                  </p>
                </div>
                <div>
                  <h4 style={h4}>문항 유형별 점수</h4>
                  {r.types.map((a) => <CompareRow key={a.k} label={a.k} sub={`문항 ${a.n}개`} mine={a.mine} cls={a.cls} />)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 6 }}>
                <span style={{ width: 2, height: 12, background: '#EF4444' }} /> 빨간 선 = 반 평균
              </div>

              {/* ⑤ 교사 의견 */}
              <div style={block}>
                <h4 style={h4}>교사 의견</h4>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="학생에게 전할 의견을 적어 주세요."
                  style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6, resize: 'vertical' }} />
                {/* 인쇄할 때만 보인다 — 입력란 대신 적은 글 */}
                <div className="print-only-note" style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7, color: '#1E293B', display: 'none' }}>{note}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentReportV24;
