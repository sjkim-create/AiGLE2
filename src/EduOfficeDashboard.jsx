/**
 * EduOfficeDashboard.jsx
 * 교육청 관리자(시도교육청) 전용 대시보드 — mockup 1:1 재현 (v1.0)
 * 본인 교육청 범위만 보는 단순화된 뷰: 헤더(날짜/학년도/사용학교) + 3카드(학생/교사/미활용)
 *   + 공지사항 + 과목별 AI 채점 활용률(도넛) + 이용시간(주차별/월별 막대)
 * 차트는 모두 inline SVG (Dashboard.jsx 패턴 정합)
 */
import React, { useState } from 'react';

const EduOfficeDashboard = ({ onNavigate }) => {
  const [academicYear, setAcademicYear] = useState('2026');

  // ── Mock 데이터 ─────────────────────────────────────────────
  const officeName = '충청남도교육청';
  const today = '2026년 6월 16일';
  // [v1.1] 학교 활동 분류: 도입(상위) ⊃ 활용(과제 1건↑) ∪ 미활용(과제 0건)
  //   기존 「서비스 사용학교 / 미활용 학교」 → 「도입 학교 / 활용 / 미활용」 페어로 직관화
  const adoptedSchools = 11;   // 도입 학교 (계약 + 등록 완료)
  const activeSchools = 7;     // 활용 학교 (과제 1건 이상 생성)
  const inactiveSchools = adoptedSchools - activeSchools; // 미활용 학교 (과제 0건)

  const stats = [
    { label: '등록된 학생수', value: '1,020', unit: '명', sub: '교육청 소속 학생' },
    { label: '등록된 교사수', value: '42',    unit: '명', sub: '교육청 소속 교사' },
    { label: '도입 후 미활용 학교 수', value: String(inactiveSchools), unit: '개', sub: '과제 생성하지 않은 학교' },
  ];

  const notices = [
    { id: 1, important: true,  icon: '📣', title: '6월 업데이트 소식을 알려드립니다!',           date: '26.05.27' },
    { id: 2, important: false, icon: '📝', title: '아이글 6월 서버 점검 안내',                    date: '26.05.26' },
    { id: 3, important: true,  icon: '🔒', title: '로그인 방식 변경 안내 (2026년 6월 중 시행)',  date: '26.05.21' },
    { id: 4, important: false, icon: '📝', title: '아이글 5월 서버 점검 안내',                    date: '26.04.29' },
  ];

  const subjects = [
    { name: '수학',       count: 45, pct: 49, color: '#FBBF24' },
    { name: '국어',       count: 27, pct: 29, color: '#3B82F6' },
    { name: '영어',       count: 8,  pct: 9,  color: '#10B981' },
    { name: '과학',       count: 4,  pct: 4,  color: '#94A3B8' },
    { name: '사회',       count: 4,  pct: 4,  color: '#EF4444' },
    { name: '도덕',       count: 1,  pct: 1,  color: '#DC2626' },
    { name: '바른 생활',  count: 1,  pct: 1,  color: '#F97316' },
    { name: '정보',       count: 1,  pct: 1,  color: '#EC4899' },
    { name: '제2외국어',  count: 1,  pct: 1,  color: '#A855F7' },
  ];

  const usageSummary = {
    today: 0,
    week: 29.2,
    month: 217.9,
  };

  // 1주차~5주차 stacked 색상
  const weekColors = ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8'];

  // 월별: 각 월에 대해 1~5주차 별 값 (mock — 합산이 그래프 막대 높이)
  const monthlyWeeks = [
    { month: '3월', weeks: [50, 50, 50, 50, 45.5],        total: 245.5 },
    { month: '4월', weeks: [180, 180, 180, 180, 154.7],   total: 874.7 },
    { month: '5월', weeks: [120, 120, 120, 120, 82.4],    total: 562.4 },
    { month: '6월', weeks: [218, 0, 0, 0, 0],             total: 218 },
    { month: '7월', weeks: [0, 0, 0, 0, 0],               total: 0 },
    { month: '8월', weeks: [0, 0, 0, 0, 0],               total: 0 },
    { month: '9월', weeks: [0, 0, 0, 0, 0],               total: 0 },
    { month: '10월', weeks: [0, 0, 0, 0, 0],              total: 0 },
    { month: '11월', weeks: [0, 0, 0, 0, 0],              total: 0 },
    { month: '12월', weeks: [0, 0, 0, 0, 0],              total: 0 },
    { month: '1월', weeks: [0, 0, 0, 0, 0],               total: 0 },
    { month: '2월', weeks: [0, 0, 0, 0, 0],               total: 0 },
  ];

  // ── 스타일 토큰 ─────────────────────────────────────────────
  const card = {
    background: 'white',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  };

  // ── 도넛 차트 (inline SVG, stroke-dasharray 기반) ───────────
  const Donut = ({ data, size = 200, thickness = 36 }) => {
    const r = (size - thickness) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const C = 2 * Math.PI * r;
    let cum = 0;
    return (
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#F1F5F9" strokeWidth={thickness} />
        {data.map((d, i) => {
          const arc = (d.pct / 100) * C;
          const dashoffset = -((cum / 100) * C);
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc} ${C - arc}`}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          cum += d.pct;
          return el;
        })}
        {/* 가장 큰 세그먼트에 % 라벨 */}
        {data.slice(0, 1).map((d, i) => (
          <text key={`lbl-${i}`} x={cx} y={cy + 5} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1E293B">
            {d.pct}%
          </text>
        ))}
      </svg>
    );
  };

  // [v1.3] Y축 max를 데이터에 맞춰 nice round-up — 5 step (6 라벨) 균등 분할
  const niceMax = (rawMax) => {
    if (!rawMax || rawMax <= 0) return 100;
    const orderOfMag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const normalized = rawMax / orderOfMag;
    let niceNorm;
    if (normalized <= 1)       niceNorm = 1;
    else if (normalized <= 2)  niceNorm = 2;
    else if (normalized <= 2.5) niceNorm = 2.5;
    else if (normalized <= 5)  niceNorm = 5;
    else                       niceNorm = 10;
    return niceNorm * orderOfMag;
  };
  const buildYTicks = (rawMax) => {
    const m = niceMax(rawMax);
    const step = m / 5;
    return Array.from({ length: 6 }, (_, i) => +(i * step).toFixed(2));
  };

  // ── stacked bar 차트 ────────────────────────────────────────
  const BarChart = ({ labels, dataSets, height = 260, yTicks: yTicksProp }) => {
    // dataSets: [{ label, color, values: number[] (= per bar) }]
    // [v1.3] yTicksProp 미지정 시 데이터 max를 nice round-up으로 자동 산정
    const barTotals = labels.map((_, bi) => dataSets.reduce((s, ds) => s + (ds.values[bi] || 0), 0));
    const rawMax = Math.max(0, ...barTotals);
    const yTicks = yTicksProp || buildYTicks(rawMax);
    const max = Math.max(yTicks[yTicks.length - 1], 1);
    const padLeft = 44;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 28;
    const innerW = 720 - padLeft - padRight;
    const innerH = height - padTop - padBottom;
    const barCount = labels.length;
    const barW = Math.min(40, (innerW / barCount) * 0.6);
    const colW = innerW / barCount;
    return (
      <svg width="100%" viewBox={`0 0 ${720} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {/* Y축 grid + 라벨 */}
        {yTicks.map((tk, i) => {
          const y = padTop + innerH - (tk / max) * innerH;
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={720 - padRight} y2={y} stroke="#F1F5F9" strokeWidth={1} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                {tk.toLocaleString()}
              </text>
            </g>
          );
        })}
        {/* 막대 stacked */}
        {labels.map((lb, bi) => {
          const cx = padLeft + colW * bi + colW / 2;
          let cum = 0;
          const totalThisBar = dataSets.reduce((s, ds) => s + (ds.values[bi] || 0), 0);
          return (
            <g key={bi}>
              {dataSets.map((ds, di) => {
                const v = ds.values[bi] || 0;
                if (v === 0) return null;
                const h = (v / max) * innerH;
                const y = padTop + innerH - h - (cum / max) * innerH;
                cum += v;
                return (
                  <rect key={di} x={cx - barW / 2} y={y} width={barW} height={h} fill={ds.color} />
                );
              })}
              {/* 막대 상단 값 라벨 — 합계 > 0일 때만 */}
              {totalThisBar > 0 && (
                <text x={cx} y={padTop + innerH - (totalThisBar / max) * innerH - 6} textAnchor="middle"
                      fontSize="11" fontWeight="700" fill="#475569">
                  {totalThisBar.toLocaleString()}
                </text>
              )}
              {/* X축 라벨 */}
              <text x={cx} y={padTop + innerH + 18} textAnchor="middle" fontSize="11" fill="#64748B">
                {lb}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // ── 컴포넌트들 ─────────────────────────────────────────────
  const UsageCard = ({ chartLabels, chartDataSets }) => (
    <div style={card}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B' }}>이용시간</div>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginTop: 2 }}>
          이용시간 파악으로 실제 업무 효율화의 기여도를 측정할 수 있습니다.
        </div>
      </div>
      {/* 3-card 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '14px 0 18px' }}>
        {[
          { lb: '오늘', vl: `${usageSummary.today}` },
          { lb: '이번주', vl: `${usageSummary.week}` },
          { lb: '이번달', vl: `${usageSummary.month}` },
        ].map((c, i) => (
          <div key={i} style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 6 }}>{c.lb}</div>
            <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, color: '#1E293B' }}>
              {c.vl} <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 600 }}>시간</span>
            </div>
          </div>
        ))}
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8, fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
        {chartDataSets.map((ds, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 14, height: 10, background: ds.color, borderRadius: 2 }} />
            <span>{ds.label}</span>
          </div>
        ))}
      </div>
      {/* 막대 차트 — yTicks 자동 산정 */}
      <BarChart labels={chartLabels} dataSets={chartDataSets} />
    </div>
  );

  const SubjectUsageCard = () => (
    <div style={card}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B' }}>과목별 AI 채점 활용률</div>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginTop: 2 }}>
          과목별 서·논술 AI 채점 활용율을 확인할 수 있습니다.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 16 }}>
        <Donut data={subjects} size={220} thickness={42} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', flex: 1, fontSize: 'var(--neo-font-size-sm)' }}>
          {subjects.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: s.color, borderRadius: 999 }} />
              <span style={{ color: '#475569', fontWeight: 600, minWidth: 64 }}>{s.name}</span>
              <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: 'auto' }}>
                {s.count}건 ({s.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 주차별 차트 (현재 월 기준 1~5주차) — mockup 상단 차트
  const weeklyDataSets = [
    { label: '1주차', color: weekColors[0], values: [50, 180, 120, 218, 0, 0, 0, 0, 0, 0, 0, 0] },
    { label: '2주차', color: weekColors[1], values: [50, 180, 120, 0,   0, 0, 0, 0, 0, 0, 0, 0] },
    { label: '3주차', color: weekColors[2], values: [50, 180, 120, 0,   0, 0, 0, 0, 0, 0, 0, 0] },
    { label: '4주차', color: weekColors[3], values: [50, 180, 120, 0,   0, 0, 0, 0, 0, 0, 0, 0] },
    { label: '5주차', color: weekColors[4], values: [45.5, 154.7, 82.4, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];
  const monthLabels = monthlyWeeks.map((m) => m.month);

  return (
    <div style={{ padding: '24px 32px', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* ── 헤더 카드 (그라데이션) ─────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #2A75F3 0%, #1D4ED8 100%)',
        borderRadius: 14, padding: '28px 32px', color: 'white', marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', opacity: 0.85, marginBottom: 6 }}>대시보드</div>
          <div style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, marginBottom: 8 }}>{today}</div>
          <div style={{ fontSize: 'var(--neo-font-size-base)', opacity: 0.9, marginBottom: 16 }}>
            학교 사용율, 이용 시간 등을 한눈에 확인하세요.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', opacity: 0.85 }}>학년도 :</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: 'rgba(255,255,255,0.18)', color: 'white', fontSize: 'var(--neo-font-size-sm)',
                fontWeight: 700, cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="2026" style={{ color: '#1E293B' }}>2026학년도 (26.02.28 ~ 27.02.28)</option>
              <option value="2025" style={{ color: '#1E293B' }}>2025학년도 (25.03.01 ~ 26.02.27)</option>
            </select>
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '20px 28px',
          minWidth: 260, textAlign: 'right',
        }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', opacity: 0.9, marginBottom: 6 }}>도입 학교 수</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
            {adoptedSchools}<span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, marginLeft: 4 }}>개</span>
          </div>
        </div>
      </div>

      {/* ── 3-카드 요약 (학생/교사/미활용) ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {stats.map((s, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#475569', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginBottom: 12 }}>{s.sub}</div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B' }}>{s.value}</span>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#475569', marginLeft: 4 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 공지사항 ──────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B', marginBottom: 14 }}>공지사항</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* [v1.3] [중요] 항목 최상단 고정 — 같은 그룹 내 기존 순서(stable sort) 유지 */}
          {[...notices].sort((a, b) => Number(b.important) - Number(a.important)).map((n) => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 4px', borderBottom: '1px solid #F1F5F9',
            }}>
              {n.important && (
                <span style={{
                  fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: 'white', background: '#EF4444',
                  padding: '2px 8px', borderRadius: 4,
                }}>중요</span>
              )}
              <span style={{ fontSize: 'var(--neo-font-size-base)' }}>{n.icon}</span>
              <span style={{ flex: 1, fontSize: 'var(--neo-font-size-base)', color: '#1E293B', fontWeight: 600 }}>
                {n.title}
              </span>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{n.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 차트 1: 과목별 도넛 + 주차별 막대 ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <SubjectUsageCard />
        <UsageCard
          chartLabels={monthLabels}
          chartDataSets={weeklyDataSets}
        />
      </div>

      {/* ── 차트 2: 과목별 도넛(동일) + 월별 막대(합계) ───────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SubjectUsageCard />
        <UsageCard
          chartLabels={monthLabels}
          chartDataSets={[
            { label: '월 합계', color: '#2A75F3', values: monthlyWeeks.map((m) => m.total) },
          ]}
        />
      </div>
    </div>
  );
};

export default EduOfficeDashboard;
