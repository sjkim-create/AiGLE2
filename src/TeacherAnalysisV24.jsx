/**
 * TeacherAnalysisV24.jsx — [v2.4] 교사 대시보드 분석 영역 (점수 기준 재구성)
 *
 * 舊(2.3) 분석은 등급(매우 우수~매우 노력)과 5단계 정규화 축으로 그렸다. 2.4는 모두 100점 환산 점수다.
 * 교사가 묻는 순서대로 네 덩어리:
 *   1. 이번 과제 결과는 어땠나?      — 평균·중앙값·60점 미만, 10점 구간 분포, 문항별 평균 득점률
 *   2. 나아지고 있나?                 — 과제별 반 평균 점수 추이 (+ 학년 평균, 고른 학생)
 * 학년 평균 = 내가 관리하는 그 학년 학생 전체 (다른 교사 반은 넣지 않는다 — 2026-10-28 결정)
 *   3. 어느 영역이 약하고 누가 도움이 필요한가? — 평가 영역별 분포 (AreaDistribution)
 *   4. 먼저 살펴볼 학생               — 최근 60점 미만 · 2회 연속 하락 · 가장 많이 오른 학생
 * 학생을 고르면: 과제 결과에 그 학생 위치를 겹치고, [학생 리포트]로 과제를 골라 1인용 리포트를 연다
 * 舊에서 뺀 것: 등급 분포표의 N/A 열, 5단계 정규화 안내, 학년 등급 평균 막대, 영역별 학년 평균 대비 분석 3종(영역별 분포로 흡수), 전국 평균 비교
 *
 * 점수 = 받은 점수 ÷ 배점 × 100 (과제·영역·문항 모두 같은 식). 결과 발송이 끝난 과제만 반영.
 * mock: 학생 등급·추세(↑↓)에서 문항 점수를 결정적으로 만든다 — production은 채점 결과를 그대로 집계
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import AreaDistribution from './AreaDistribution';
import StudentReportV24 from './StudentReportV24'; // 학생 1인용 리포트 (과제 골라 집계)

const LOW = 60;

/* ── mock 과제 (결과 발송 완료) ─────────────────────────────── */
const TASKS = {
  '수학': {
    areas: ['다항식', '방정식과 부등식', '경우의 수', '행렬'],
    tasks: [
      { id: 'm1', name: '단원1 평가', date: '26.03.15', items: [
        { no: 1, area: '다항식', type: '서술형', points: 10, diff: 4 }, { no: 2, area: '다항식', type: '단답형', points: 5, diff: 0 }, { no: 3, area: '방정식과 부등식', type: '서술형', points: 15, diff: -8 }] },
      { id: 'm2', name: '단원2 평가', date: '26.04.12', items: [
        { no: 1, area: '방정식과 부등식', type: '선다형', points: 5, diff: 6 }, { no: 2, area: '방정식과 부등식', type: '서술형', points: 15, diff: -4 }, { no: 3, area: '경우의 수', type: '서술형', points: 10, diff: -12 }] },
      { id: 'm3', name: '비례식 평가', date: '26.04.18', items: [
        { no: 1, area: '다항식', type: '단답형', points: 10, diff: 2 }, { no: 2, area: '다항식', type: '서술형', points: 10, diff: -2 }] },
      { id: 'm4', name: '단원3 평가', date: '26.05.06', items: [
        { no: 1, area: '경우의 수', type: '선다형', points: 5, diff: 5 }, { no: 2, area: '경우의 수', type: '서술형', points: 15, diff: -6 }, { no: 3, area: '행렬', type: '서술형', points: 10, diff: -10 }, { no: 4, area: '행렬', type: '단답형', points: 5, diff: 0 }] },
    ],
  },
  '국어': {
    areas: ['듣기·말하기', '읽기', '쓰기', '문법', '문학'],
    tasks: [
      { id: 'k1', name: '읽기 진단 평가', date: '26.03.05', items: [
        { no: 1, area: '읽기', type: '선다형', points: 5, diff: 6 }, { no: 2, area: '읽기', type: '서술형', points: 15, diff: -3 }] },
      { id: 'k2', name: '논술 진단 평가', date: '26.03.20', items: [
        { no: 1, area: '쓰기', type: '논술형', points: 30, diff: -7 }] },
      { id: 'k3', name: '문학 단원 평가', date: '26.04.10', items: [
        { no: 1, area: '문학', type: '서술형', points: 15, diff: 0 }, { no: 2, area: '문법', type: '단답형', points: 5, diff: -9 }, { no: 3, area: '듣기·말하기', type: '서술형', points: 10, diff: 3 }] },
      { id: 'k4', name: '비문학 독해 평가', date: '26.05.10', items: [
        { no: 1, area: '읽기', type: '서술형', points: 15, diff: -2 }, { no: 2, area: '문법', type: '선다형', points: 5, diff: -5 }, { no: 3, area: '쓰기', type: '서술형', points: 10, diff: -4 }] },
    ],
  },
};
const LEVEL_BASE = { '매우 우수': 91, '우수': 82, '보통': 73, '노력': 64, '매우 노력': 53 };
const SLOPE = { '↑': 3, '↓': -3, '–': 0 };
const hash = (...xs) => { let h = 7; for (const x of xs.join('|')) h = (h * 31 + x.charCodeAt(0)) % 9973; return h; };
const clamp = (v) => Math.max(0, Math.min(100, v));
// [원점수] 과제 만점 = 문항 배점 합. 화면은 100점 환산이 기준이고, 원점수(받은 점수/만점)를 옆에 함께 적는다 — 교사가 매긴 배점(10점·100점 등) 그대로
const totalOf = (t) => t.items.reduce((a, it) => a + it.points, 0);
const fmt1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const rawText = (got, t) => `${fmt1(got)}/${totalOf(t)}점`;
const avg = (vals) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
const median = (vals) => {
  if (!vals.length) return null;
  const s = vals.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/* 학생 × 과제 × 문항 득점률(%) */
const itemPct = (st, task, ti, nTasks, it) => {
  const base = LEVEL_BASE[st.level] ?? 73;
  const slope = (SLOPE[st.trend] ?? 0) * (ti - (nTasks - 1) / 2);
  const jitter = (hash(st.id, task.id, it.no) % 19) - 9;
  return clamp(Math.round(base + slope + it.diff + jitter));
};

const card = { background: 'white', padding: '1.5rem', borderRadius: 24, boxShadow: 'var(--shadow)', marginBottom: '1.5rem' };
const h3 = { fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, margin: '0 0 0.25rem' };
const sub = { fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 1rem' };
const sel = { padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, fontFamily: 'inherit' };
const scoreColor = (v) => (v == null ? '#94A3B8' : v < LOW ? '#DC2626' : v < 70 ? '#B45309' : '#1E293B');
const CLASS_COLORS = ['#2A75F3', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];

/* ── 2. 점수 추이 선 그래프 ─────────────────────────────────── */
const TrendChart = ({ tasks, series }) => {
  const W = 900; const H = 260; const L = 70; const R = 60; const T = 16; const B = 46; // L·R: 양끝 과제명이 잘리지 않게
  // 축 글자는 화면 폭과 관계없이 고정 px — 그래프가 늘어나도 글자는 커지지 않게 viewBox 단위로 되돌려 쓴다
  const ref = useRef(null);
  const [k, setK] = useState(1); // viewBox 1단위 = 화면 몇 px 의 역수
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const fit = () => { const w = el.getBoundingClientRect().width; if (w) setK(W / w); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const px = (n) => n * k;
  // 선 · 점도 고정 px — 강조 선(학생 · 고른 그룹) 2.5px, 나머지 1.5px (舊: 2~3.5단위가 화면 폭에 맞춰 늘어 3~4px로 두꺼웠다)
  const lineW = (sr) => ((sr.width || 2.5) >= 3 ? 2.5 : 1.5);
  const dashOf = (d) => (d ? d.split(' ').map((n) => Number(n) * k).join(' ') : undefined);
  const iw = W - L - R; const ih = H - T - B;
  const x = (i) => L + (tasks.length <= 1 ? iw / 2 : (i * iw) / (tasks.length - 1));
  // y축 아래쪽 — 기본 40점(대부분 점수가 이 위라 차이가 잘 보인다). 더 낮은 점수가 있으면 10점 단위로 내린다
  const minV = Math.min(...series.flatMap((s) => s.values).filter((v) => v != null));
  const lo = Math.max(0, Math.min(40, Math.floor((minV - 5) / 10) * 10));
  const y = (v) => T + ih - ((clamp(v) - lo) / (100 - lo)) * ih;
  return (
    <svg ref={ref} data-chart-fixed viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <rect x={L} y={y(LOW)} width={iw} height={y(lo) - y(LOW)} fill="#FEF2F2" />
      {Array.from({ length: (100 - lo) / 10 + 1 }, (_, i) => lo + i * 10).map((t) => (
        <g key={t}>
          <line x1={L} x2={L + iw} y1={y(t)} y2={y(t)} stroke={t === LOW ? '#FCA5A5' : '#F1F5F9'} strokeWidth={px(1)} strokeDasharray={t === LOW ? dashOf('4 3') : undefined} />
          <text x={L - 8} y={y(t) + px(4)} textAnchor="end" fontSize={px(11)} fill="#94A3B8">{t}</text>
        </g>
      ))}
      {tasks.map((t, i) => (
        <g key={t.id}>
          {/* 과제명 12px · 날짜 11px — 데이터 선보다 앞에 나오지 않게 보조색 · 보통 굵기 */}
          <text x={x(i)} y={H - 26} textAnchor="middle" fontSize={px(12)} fontWeight="600" fill="#475569">{t.name}</text>
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={px(11)} fill="#94A3B8">{t.date}</text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.key}>
          <path d={s.values.map((v, i) => (v == null ? '' : `${i === 0 || s.values[i - 1] == null ? 'M' : 'L'}${x(i)},${y(v)}`)).join(' ')}
            fill="none" stroke={s.color} strokeWidth={px(lineW(s))} strokeDasharray={dashOf(s.dash)} strokeLinejoin="round" strokeLinecap="round" />
          {s.dots !== false && s.values.map((v, i) => v == null ? null : (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={px(s.width >= 3 ? 4 : 3)} fill={s.color} stroke="white" strokeWidth={px(1.5)}><title>{`${s.label} · ${tasks[i].name} ${v}점${s.raws && s.raws[i] != null ? ` (원점수 ${rawText(s.raws[i], tasks[i])})` : ''}`}</title></circle>
              {s.labels && <text x={x(i)} y={y(v) - px(10)} textAnchor="middle" fontSize={px(12)} fontWeight="800" fill={s.color}>{v}</text>}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
};

/**
 * @param {{ students: { id, name, className, grade, level, trend }[] }} props
 */
const TeacherAnalysisV24 = ({ students }) => {
  const [subject, setSubject] = useState('수학');
  const grades = [...new Set(students.map((s) => s.grade))].sort();
  const [grade, setGrade] = useState(grades[0]);
  const [group, setGroup] = useState('all');
  const [studentId, setStudentId] = useState(null);
  const def = TASKS[subject];
  const tasks = def.tasks;
  const [taskId, setTaskId] = useState(null);
  const task = tasks.find((t) => t.id === taskId) || tasks[tasks.length - 1];
  const [openBin, setOpenBin] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const gradeStudents = students.filter((s) => s.grade === grade);
  const classes = [...new Set(gradeStudents.map((s) => s.className))].sort();
  const scoped = group === 'all' ? gradeStudents : gradeStudents.filter((s) => s.className === group);
  const picked = students.find((s) => s.id === studentId) || null;

  // 학생 × 과제 점수, 학생 × 영역 점수
  const data = useMemo(() => {
    const byStudent = {};
    gradeStudents.forEach((st) => {
      const taskScores = {}; const taskRaw = {}; const itemScores = {}; const areaAcc = {};
      tasks.forEach((t, ti) => {
        let got = 0; let tot = 0;
        t.items.forEach((it) => {
          const p = itemPct(st, t, ti, tasks.length, it);
          const raw = Math.round((p / 100) * it.points);
          got += raw; tot += it.points;
          itemScores[`${t.id}-${it.no}`] = raw;
          areaAcc[it.area] = areaAcc[it.area] || { got: 0, tot: 0 };
          areaAcc[it.area].got += raw; areaAcc[it.area].tot += it.points;
        });
        taskScores[t.id] = Math.round((got / tot) * 100);
        taskRaw[t.id] = got; // 원점수 — 교사가 매긴 배점 그대로 (만점은 totalOf(task))
      });
      const areaScores = Object.fromEntries(Object.entries(areaAcc).map(([a, v]) => [a, Math.round((v.got / v.tot) * 100)]));
      byStudent[st.id] = { taskScores, taskRaw, itemScores, areaScores };
    });
    return byStudent;
  }, [subject, grade, students]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetStudent = () => { setStudentId(null); };
  const setScope = (fn) => { fn(); setOpenBin(null); };

  /* ── 1. 이번 과제 결과 ── */
  const tScores = scoped.map((s) => ({ s, v: data[s.id]?.taskScores[task.id], raw: data[s.id]?.taskRaw[task.id] })).filter((x) => x.v != null);
  const tRaws = tScores.map((x) => x.raw);
  const tVals = tScores.map((x) => x.v);
  const BINS = [{ k: 'u50', label: '50점 미만', lo: 0, hi: 49 }, { k: '50', label: '50점대', lo: 50, hi: 59 }, { k: '60', label: '60점대', lo: 60, hi: 69 },
    { k: '70', label: '70점대', lo: 70, hi: 79 }, { k: '80', label: '80점대', lo: 80, hi: 89 }, { k: '90', label: '90점 이상', lo: 90, hi: 100 }];
  const binRows = BINS.map((b) => ({ ...b, list: tScores.filter((x) => x.v >= b.lo && x.v <= b.hi).sort((a, c) => a.v - c.v) }));
  const maxBin = Math.max(1, ...binRows.map((b) => b.list.length));
  const itemRates = task.items.map((it) => {
    const raws = scoped.map((s) => data[s.id]?.itemScores[`${task.id}-${it.no}`]).filter((v) => v != null);
    return { ...it, rawAvg: raws.length ? Math.round((raws.reduce((a, b) => a + b, 0) / raws.length) * 10) / 10 : null, rate: raws.length ? Math.round((raws.reduce((a, b) => a + b, 0) / (raws.length * it.points)) * 100) : null };
  });
  const hardest = itemRates.slice().sort((a, b) => a.rate - b.rate)[0];
  const lowCount = tVals.filter((v) => v < LOW).length;
  // [학생 선택] 과제 결과에 고른 학생의 위치를 겹친다 — 분포는 반 전체 그대로, 학생은 표시만
  const mine = picked ? tScores.find((x) => x.s.id === picked.id) || null : null;
  const cmpLabel = group === 'all' ? `${grade}학년 평균` : `${group} 평균`; // 위 분포·문항 평균과 같은 범위
  const myItemRate = (it) => {
    if (!mine) return null;
    const raw = data[picked.id]?.itemScores[`${task.id}-${it.no}`];
    return raw == null ? null : { raw, rate: Math.round((raw / it.points) * 100) };
  };

  /* ── 2. 추이 ── */
  const classAvgSeries = (cls) => tasks.map((t) => avg(gradeStudents.filter((s) => s.className === cls).map((s) => data[s.id].taskScores[t.id])));
  const rawAvg = (list, t) => { const v = list.map((s) => data[s.id].taskRaw[t.id]); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const classRawSeries = (cls) => tasks.map((t) => rawAvg(gradeStudents.filter((s) => s.className === cls), t));
  // 학년 평균 — 내가 관리하는 그 학년 학생 전체 (다른 교사 반은 넣지 않는다)
  const gradeAvg = tasks.map((t) => avg(gradeStudents.map((s) => data[s.id].taskScores[t.id])));
  const gradeRaw = tasks.map((t) => rawAvg(gradeStudents, t));
  let series;
  if (picked) {
    series = [
      { key: 'grade', label: `${grade}학년 평균`, color: '#0F172A', dash: '7 5', width: 2, values: gradeAvg, raws: gradeRaw },
      { key: 'cls', label: `${picked.className} 평균`, color: '#94A3B8', width: 2, values: classAvgSeries(picked.className), raws: classRawSeries(picked.className) },
      { key: 'stu', label: picked.name, color: '#2563EB', width: 3.5, values: tasks.map((t) => data[picked.id]?.taskScores[t.id]), raws: tasks.map((t) => data[picked.id]?.taskRaw[t.id]), labels: true },
    ];
  } else if (group === 'all') {
    series = [
      { key: 'grade', label: `${grade}학년 평균`, color: '#0F172A', dash: '7 5', width: 2, values: gradeAvg, raws: gradeRaw },
      ...classes.map((c, i) => ({ key: c, label: c, color: CLASS_COLORS[i % CLASS_COLORS.length], width: 2.5, values: classAvgSeries(c), raws: classRawSeries(c) })),
    ];
  } else {
    series = [
      { key: 'grade', label: `${grade}학년 평균`, color: '#0F172A', dash: '7 5', width: 2, values: gradeAvg, raws: gradeRaw },
      { key: group, label: `${group} 평균`, color: '#2A75F3', width: 3.5, values: classAvgSeries(group), raws: classRawSeries(group), labels: true },
    ];
  }
  const focus = series[series.length - 1];
  const fFirst = focus.values.find((v) => v != null); const fLast = [...focus.values].reverse().find((v) => v != null);
  const trendLine = group === 'all' && !picked
    ? (() => {
        const deltas = classes.map((c) => { const v = classAvgSeries(c); return { c, d: v[v.length - 1] - v[0], last: v[v.length - 1] }; }).sort((a, b) => a.d - b.d);
        const worst = deltas[0]; const best = deltas[deltas.length - 1];
        const sg = (d) => `${d >= 0 ? '+' : ''}${d}점`;
        return `첫 과제 대비 가장 많이 오른 그룹 ${best.c}(${sg(best.d)}) · 가장 ${worst.d >= 0 ? '적게 오른' : '많이 내려간'} 그룹 ${worst.c}(${sg(worst.d)})`;
      })()
    : `${focus.label}: 첫 과제 ${fFirst}점 → 최근 ${fLast}점 (${fLast - fFirst >= 0 ? '+' : ''}${fLast - fFirst}점)`;

  /* ── 4. 먼저 살펴볼 학생 ── */
  const lastT = tasks[tasks.length - 1]; const prevT = tasks[tasks.length - 2]; const prev2T = tasks[tasks.length - 3];
  const watch = scoped.map((s) => {
    const ts = data[s.id].taskScores;
    return { s, last: ts[lastT.id], lastRaw: data[s.id].taskRaw[lastT.id], d1: prevT ? ts[lastT.id] - ts[prevT.id] : 0, d2: prev2T && prevT ? ts[prevT.id] - ts[prev2T.id] : 0, total: ts[lastT.id] - ts[tasks[0].id] };
  });
  const groups = [
    { key: 'low', title: '최근 과제 60점 미만', tone: '#DC2626', bg: '#FEF2F2', list: watch.filter((w) => w.last < LOW).sort((a, b) => a.last - b.last), detail: (w) => `${w.last}점 (${rawText(w.lastRaw, lastT)})` },
    { key: 'down', title: '2회 연속 하락', tone: '#B45309', bg: '#FFFBEB', list: watch.filter((w) => w.d1 < 0 && w.d2 < 0).sort((a, b) => (a.d1 + a.d2) - (b.d1 + b.d2)), detail: (w) => `${w.last}점 (${w.d2 + w.d1}점)` },
    { key: 'up', title: '가장 많이 오른 학생', tone: '#047857', bg: '#ECFDF5', list: watch.filter((w) => w.total > 0).sort((a, b) => b.total - a.total).slice(0, 5), detail: (w) => `${w.last}점 (+${w.total}점)` },
  ];

  const scopeLabel = `${subject} · ${grade}학년 · ${group === 'all' ? '전체 그룹' : group}`;
  const areaRows = scoped.map((s) => ({ id: s.id, name: s.name, scores: data[s.id].areaScores }));

  return (
    <div>
      {/* 분석 범위 — 아래 네 덩어리가 모두 이 선택을 따른다
          스크롤 영역 위쪽 여백(2rem)만큼 위로 붙여 고정하고, 그 여백을 배경색으로 덮어 뒤 내용이 비치지 않게 한다 */}
      <div style={{ position: 'sticky', top: '-2rem', zIndex: 5, background: '#F4F7FB', paddingTop: '1.5rem', marginTop: '-1.5rem' }}>
      <div style={{ ...card, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', marginRight: 4 }}>분석 범위</b>
        <select value={subject} onChange={(e) => setScope(() => { setSubject(e.target.value); setTaskId(null); })} style={sel} aria-label="교과">
          {Object.keys(TASKS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={grade} onChange={(e) => setScope(() => { setGrade(Number(e.target.value)); setGroup('all'); resetStudent(); })} style={sel} aria-label="학년">
          {grades.map((g) => <option key={g} value={g}>{g}학년</option>)}
        </select>
        <select value={group} onChange={(e) => setScope(() => { setGroup(e.target.value); resetStudent(); })} style={sel} aria-label="그룹">
          <option value="all">전체 그룹</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={studentId ?? ''} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : null)} style={sel} aria-label="학생">
          <option value="">학생 전체</option>
          {scoped.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.className})</option>)}
        </select>
        {picked && (
          <button type="button" onClick={() => setReportOpen(true)}
            style={{ ...sel, background: '#2A75F3', borderColor: '#2A75F3', color: 'white', cursor: 'pointer' }}>
            📄 {picked.name} 학생 리포트
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>점수는 100점 환산 · 결과 발송이 끝난 과제만</span>
      </div>
      </div>

      {reportOpen && picked && (
        <StudentReportV24 student={picked} subject={subject} tasks={tasks} data={data}
          classmates={gradeStudents.filter((s) => s.className === picked.className)} onClose={() => setReportOpen(false)} />
      )}

      {/* ── 1. 이번 과제 결과 ── */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h3 style={h3}>과제 결과</h3>
            <p style={sub}>점수가 어떻게 나뉘었는지, 어느 문항이 어려웠는지 봅니다.</p>
          </div>
          <select value={task.id} onChange={(e) => { setTaskId(e.target.value); setOpenBin(null); }} style={sel} aria-label="과제">
            {tasks.slice().reverse().map((t) => <option key={t.id} value={t.id}>{t.name} ({t.date} · {totalOf(t)}점 만점)</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            ['응시', `${tVals.length}명`, `${totalOf(task)}점 만점 과제`],
            ['평균', `${avg(tVals)}점`, `원점수 ${rawText(Math.round((tRaws.reduce((a, b) => a + b, 0) / Math.max(1, tRaws.length)) * 10) / 10, task)}`],
            ['중앙값', `${median(tVals)}점`, `원점수 ${rawText(median(tRaws) ?? 0, task)}`],
            ['60점 미만', `${lowCount}명`, `원점수 ${fmt1(totalOf(task) * 0.6)}점 미만`],
          ].map(([l, v, raw]) => (
            <div key={l} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, color: l === '60점 미만' && lowCount ? '#DC2626' : '#1E293B' }}>{v}</div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>{raw}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 28 }}>
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#334155', marginBottom: 10 }}>점수 분포 <span style={{ fontWeight: 600, color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>막대를 누르면 학생</span>
              {mine && <span style={{ marginLeft: 8, color: '#2563EB', fontSize: 'var(--neo-font-size-xs)' }}>▼ {picked.name} {mine.v}점 ({rawText(mine.raw, task)}) · {cmpLabel} {mine.v - avg(tVals) >= 0 ? '+' : ''}{mine.v - avg(tVals)}점</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
              {binRows.map((b) => {
                const n = b.list.length; const on = openBin === b.k;
                const isMine = !!mine && b.list.some((x) => x.s.id === mine.s.id);
                return (
                  <button key={b.k} type="button" onClick={() => setOpenBin(on ? null : b.k)} disabled={!n} title={`${b.label} ${n}명`}
                    style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', gap: 4, border: 'none', background: 'none', padding: 0, cursor: n ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                    {isMine && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#2563EB', textAlign: 'center', whiteSpace: 'nowrap' }}>▼ {picked.name}</span>}
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: n ? '#334155' : '#CBD5E1', textAlign: 'center' }}>{n}명</span>
                    <span style={{ height: `${(n / maxBin) * 100}px`, minHeight: n ? 4 : 0, borderRadius: '6px 6px 0 0', background: b.hi < LOW ? '#F87171' : b.hi < 70 ? '#FBBF24' : '#60A5FA', outline: isMine ? '3px solid #2563EB' : on ? '2px solid #1E293B' : 'none', opacity: mine && !isMine ? 0.45 : 1 }} />
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E2E8F0', paddingTop: 6 }}>
              {binRows.map((b) => <span key={b.k} style={{ flex: 1, textAlign: 'center', fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{b.label}</span>)}
            </div>
            {openBin && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {binRows.find((b) => b.k === openBin).list.map((x) => (
                  <button key={x.s.id} type="button" onClick={() => setStudentId(x.s.id)}
                    style={{ border: '1px solid #E2E8F0', background: x.s.id === studentId ? '#EFF6FF' : 'white', borderRadius: 8, padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: scoreColor(x.v), cursor: 'pointer', fontFamily: 'inherit' }}>
                    {x.s.name} {x.v}점 <span style={{ fontWeight: 600, color: '#64748B' }}>({rawText(x.raw, task)})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#334155', marginBottom: 10 }}>문항별 평균 득점률
              {mine && <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#2563EB', fontSize: 'var(--neo-font-size-xs)' }}><span style={{ width: 3, height: 12, background: '#2563EB', borderRadius: 2 }} />{picked.name}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {itemRates.map((it) => {
                const hard = it.no === hardest.no;
                const my = myItemRate(it);
                return (
                  <div key={it.no}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 'var(--neo-font-size-xs)', marginBottom: 3 }}>
                      <b style={{ color: '#1E293B' }}>{it.no}번</b>
                      <span style={{ color: '#64748B' }}>{it.area} · {it.type} · {it.points}점</span>
                      {hard && <span style={{ color: '#DC2626', fontWeight: 800 }}>가장 어려움</span>}
                      <span style={{ marginLeft: 'auto', color: '#64748B' }}>평균 {fmt1(it.rawAvg)}/{it.points}점</span>
                      <b style={{ color: scoreColor(it.rate) }}>{it.rate}%</b>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ height: 10, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${it.rate}%`, height: '100%', background: it.rate < LOW ? '#F87171' : it.rate < 70 ? '#FBBF24' : '#60A5FA', opacity: my ? 0.55 : 1 }} />
                      </div>
                      {my && <span title={`${picked.name} ${my.raw}/${it.points}점 (${my.rate}%)`}
                        style={{ position: 'absolute', left: `${my.rate}%`, top: -4, width: 4, height: 18, marginLeft: -2, borderRadius: 2, background: '#2563EB', boxShadow: '0 0 0 2px white' }} />}
                    </div>
                    {my && (
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2563EB', fontWeight: 700, marginTop: 3 }}>
                        {picked.name} {my.raw}/{it.points}점 ({my.rate}%) · {cmpLabel} {my.rate - it.rate >= 0 ? '+' : ''}{my.rate - it.rate}%p
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. 점수 추이 ── */}
      <section style={card}>
        <h3 style={h3}>점수 추이</h3>
        <p style={sub}>{trendLine}</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-xs)', color: '#475569', marginBottom: 6 }}>
          {series.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, borderTop: `${s.width >= 3 ? 2.5 : 1.5}px ${s.dash ? 'dashed' : 'solid'} ${s.color}` }} />{s.label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, background: '#FEF2F2', border: '1px dashed #FCA5A5' }} />60점 미만</span>
          {picked && <button type="button" onClick={resetStudent} style={{ marginLeft: 'auto', border: '1px solid #BFDBFE', background: 'white', color: '#1D4ED8', borderRadius: 8, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)' }}>학생 선택 해제</button>}
        </div>
        <TrendChart tasks={tasks} series={series} />
      </section>

      {/* ── 3. 평가 영역별 분포 ── */}
      <section style={card}>
        <h3 style={h3}>평가 영역별 분포</h3>
        <p style={sub}>영역마다 학생 점수를 한 줄에 펼쳤습니다. 약한 영역과 보충할 학생을 찾습니다.</p>
        <AreaDistribution areas={def.areas} rows={areaRows} selectedId={studentId} onSelect={setStudentId} scopeLabel={scopeLabel} />
      </section>

      {/* ── 4. 먼저 살펴볼 학생 ── */}
      <section style={card}>
        <h3 style={h3}>먼저 살펴볼 학생</h3>
        <p style={sub}>최근 과제({lastT.name} · {totalOf(lastT)}점 만점) 기준입니다. 이름을 누르면 위 그래프에 그 학생이 표시됩니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.key} style={{ background: g.bg, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <b style={{ color: g.tone, fontSize: 'var(--neo-font-size-sm)' }}>{g.title}</b>
                <span style={{ marginLeft: 'auto', fontWeight: 800, color: g.tone }}>{g.list.length}명</span>
              </div>
              {g.list.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.list.map((w) => (
                    <button key={w.s.id} type="button" onClick={() => setStudentId(w.s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 8, padding: '6px 8px', background: w.s.id === studentId ? 'white' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', textAlign: 'left' }}>
                      <b style={{ color: '#1E293B' }}>{w.s.name}</b>
                      <span style={{ color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>{w.s.className}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#334155' }}>{g.detail(w)}</span>
                    </button>
                  ))}
                </div>
              ) : <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>해당 학생이 없습니다.</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TeacherAnalysisV24;
