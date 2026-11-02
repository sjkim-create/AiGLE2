/**
 * AreaDistribution.jsx — [v2.4] 교사 대시보드 › 평가 영역별 분포
 *
 * 교사가 여기서 하는 일: ① 우리 반이 약한 영역 찾기 ② 그 영역에서 보충 지도할 학생 고르기.
 *   한 줄 = 한 평가 영역. 0~100점 축 위에 학생마다 점 하나 — 퍼짐·중앙값·60점 미만 쏠림이 한눈에 보인다.
 *   오른쪽 「60점 미만 N명」을 누르면 그 학생 이름이 펼쳐진다 (누르면 그 학생 선택).
 *   학생을 고르면 모든 영역에서 그 학생 점만 강조하고, 반 중앙값 대비 강점·약점 영역을 한 줄로 알려 준다.
 * 학생 선택은 학습 추이 분석과 같은 값이다.
 */
import React, { useMemo, useState } from 'react';

const LOW = 60;   // 보충 기준
const MID = 70;
const median = (vals) => {
  if (!vals.length) return 0;
  const s = vals.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/* 같은 점수대 점이 겹치지 않게 줄(lane)을 나눈다 — 점수 순으로 놓고, 가까우면 다음 줄로 */
const laneOf = (items, gap = 2.6, lanes = 4) => {
  const last = Array(lanes).fill(-Infinity);
  return items.slice().sort((a, b) => a.v - b.v).map((it) => {
    let lane = last.findIndex((x) => it.v - x >= gap);
    if (lane < 0) lane = last.indexOf(Math.min(...last));
    last[lane] = it.v;
    return { ...it, lane };
  });
};

/**
 * @param {{ areas: string[], rows: { id, name, scores: Record<string, number> }[],
 *           selectedId: (number|null), onSelect: (id) => void, scopeLabel: string }} props
 */
const AreaDistribution = ({ areas, rows, selectedId, onSelect, scopeLabel }) => {
  const [openArea, setOpenArea] = useState(null); // 60점 미만 이름을 펼친 영역
  const stats = useMemo(() => areas.map((area) => {
    const pts = rows.filter((r) => r.scores[area] != null).map((r) => ({ id: r.id, name: r.name, v: r.scores[area] }));
    const vals = pts.map((p) => p.v);
    const low = pts.filter((p) => p.v < LOW).sort((a, b) => a.v - b.v);
    return { area, pts: laneOf(pts), med: median(vals), low };
  }), [areas, rows]);

  if (!areas.length || !rows.length) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>표시할 학생이나 평가 영역이 없습니다.</div>;
  }

  // 보충이 가장 필요한 영역 — 60점 미만 인원이 많은 순, 같으면 중앙값이 낮은 순
  const weakest = stats.slice().sort((a, b) => b.low.length - a.low.length || a.med - b.med)[0];
  const picked = rows.find((r) => r.id === selectedId) || null;
  const diffs = picked ? stats.map((s) => ({ area: s.area, d: (picked.scores[s.area] ?? s.med) - s.med, v: picked.scores[s.area] })) : [];
  const strong = diffs.slice().sort((a, b) => b.d - a.d)[0];
  const weak = diffs.slice().sort((a, b) => a.d - b.d)[0];
  const sign = (d) => (d > 0 ? `+${d}` : `${d}`);

  const H = 46; const pct = (v) => `${Math.max(0, Math.min(100, v))}%`; // 점 위치 — 폭이 바뀌어도 점이 찌그러지지 않게 퍼센트로

  return (
    <div>
      {/* 요약 한 줄 — 반 전체 또는 고른 학생 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, background: picked ? '#EFF6FF' : '#FFF7ED', marginBottom: 14 }}>
        {picked ? (
          <>
            <b style={{ color: '#1D4ED8' }}>{picked.name}</b>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
              {strong.d > 0 ? '강점' : '가장 나은 영역'} <b>{strong.area}</b> {strong.v}점 (반 중앙값 {sign(strong.d)}) · {weak.d < 0 ? '약점' : '가장 낮은 영역'} <b>{weak.area}</b> {weak.v}점 (반 중앙값 {sign(weak.d)})
            </span>
            <button type="button" onClick={() => onSelect && onSelect(null)}
              style={{ marginLeft: 'auto', border: '1px solid #BFDBFE', background: 'white', color: '#1D4ED8', borderRadius: 8, padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>반 전체 보기</button>
          </>
        ) : (
          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#7C2D12' }}>
            {weakest.low.length
              ? <>보충이 가장 필요한 영역은 <b>{weakest.area}</b>입니다 — 60점 미만 {weakest.low.length}명 · 중앙값 {weakest.med}점</>
              : <>모든 영역에서 60점 미만 학생이 없습니다. 중앙값이 가장 낮은 영역은 <b>{weakest.area}</b>({weakest.med}점)입니다.</>}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 6 }}>
        <span>{scopeLabel} · 학생 {rows.length}명 · 점을 누르면 그 학생을 고릅니다</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 2, height: 12, background: '#0F172A' }} /> 반 중앙값
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 점수 눈금 */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 130px', gap: 12 }}>
          <span />
          <div style={{ position: 'relative', height: 14 }}>
            {[0, 60, 70, 80, 90, 100].map((t) => (
              <span key={t} style={{ position: 'absolute', left: pct(t), transform: t === 0 ? 'none' : t === 100 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: 10, color: '#94A3B8', lineHeight: '14px' }}>{t}</span>
            ))}
          </div>
          <span />
        </div>

        {stats.map((s) => {
          const open = openArea === s.area;
          const isWeakest = !picked && s.area === weakest.area && weakest.low.length > 0;
          return (
            <div key={s.area} style={{ borderTop: '1px solid #F1F5F9', padding: '8px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 130px', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: isWeakest ? '#C2410C' : '#1E293B' }}>{s.area}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>중앙값 {s.med}점</div>
                </div>
                <div style={{ position: 'relative', height: H }}>
                  {/* 60점 미만 구간만 옅게 — 보충 대상이 모이는 곳 */}
                  <div style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: pct(LOW), background: '#FEF2F2', borderRadius: 4 }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: H / 2, height: 1, background: '#E2E8F0' }} />
                  {[LOW, MID, 80, 90].map((t) => <div key={t} style={{ position: 'absolute', left: pct(t), top: 4, bottom: 4, width: 1, background: '#F1F5F9' }} />)}
                  <div title={`중앙값 ${s.med}점`} style={{ position: 'absolute', left: pct(s.med), top: 2, bottom: 2, width: 2, marginLeft: -1, background: '#0F172A' }} />
                  {s.pts.map((p) => {
                    const on = p.id === selectedId;
                    const d = on ? 14 : 9;
                    const top = on ? H / 2 : 8 + p.lane * ((H - 16) / 3);
                    return (
                      <button key={p.id} type="button" title={`${p.name} ${p.v}점`} aria-label={`${p.name} ${p.v}점`} onClick={() => onSelect && onSelect(on ? null : p.id)}
                        style={{ position: 'absolute', left: pct(p.v), top, width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, padding: 0, borderRadius: 999, cursor: 'pointer',
                          border: '1.5px solid white', background: on ? '#2563EB' : p.v < LOW ? '#EF4444' : '#94A3B8', opacity: picked && !on ? 0.3 : 0.9, zIndex: on ? 2 : 1 }} />
                    );
                  })}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {picked ? (
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: (picked.scores[s.area] ?? 0) < LOW ? '#DC2626' : '#1D4ED8' }}>
                      {picked.scores[s.area] ?? '–'}점 <span style={{ fontWeight: 600, color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>({sign((picked.scores[s.area] ?? s.med) - s.med)})</span>
                    </span>
                  ) : s.low.length ? (
                    <button type="button" onClick={() => setOpenArea(open ? null : s.area)} aria-expanded={open}
                      style={{ border: '1px solid #FECACA', background: open ? '#FEE2E2' : 'white', color: '#B91C1C', borderRadius: 999, padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      60점 미만 {s.low.length}명 {open ? '▴' : '▾'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#16A34A', fontWeight: 700 }}>60점 미만 없음</span>
                  )}
                </div>
              </div>
              {open && !picked && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 2px 162px' }}>
                  {s.low.map((p) => (
                    <button key={p.id} type="button" onClick={() => onSelect && onSelect(p.id)}
                      style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', borderRadius: 8, padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {p.name} {p.v}점
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AreaDistribution;
