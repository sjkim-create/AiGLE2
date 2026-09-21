/**
 * AnalysisReport.jsx
 * AI 등급평가 분석 리포트 화면입니다.
 * Prompt 아카이브에서 선택한 테스트 데이터를 기반으로 QWK(Quadratic Weighted Kappa),
 * 정확도, 오류 유형, 영역별 성능, 평가 모드 비교 등의 분석 결과를 시각적으로 표시하며,
 * PDF 인쇄 기능을 제공합니다.
 */
import React, { useState, useEffect } from 'react';

// --- 등급 라벨 → 정수 매핑 ---
// [v5.11] 3·4·5단계 모두 지원. scale별로 매핑이 다름:
//   5단계: 매우우수=5, 우수=4, 보통=3, 노력=2, 매우노력=1
//   4단계: 매우우수=4, 우수=3, 보통=2, 노력=1    (PRD §5.1 4단계 매핑)
//   3단계: 우수=3, 보통=2, 노력=1
const GRADE_TO_SCORE_BY_SCALE = {
  3: { '우수': 3, '보통': 2, '노력': 1 },
  4: { '매우우수': 4, '우수': 3, '보통': 2, '노력': 1, '매우 우수': 4 },
  5: { '매우우수': 5, '우수': 4, '보통': 3, '노력': 2, '매우노력': 1, '매우 우수': 5, '매우 노력': 1 },
};

// 등급 라벨이 5단계 풀에 속하는지 (「매우」 접두 등장 시 5단계 풀)
const has5LevelMarker = (label) => typeof label === 'string' && (label.includes('매우우수') || label.includes('매우노력') || label.includes('매우 우수') || label.includes('매우 노력'));

// 엔트리의 scale(3/4/5) 결정 — d.scale 명시 우선, 없으면 라벨 셋으로 추론
function resolveScale(d, datasetScales = null) {
  if (d?.scale && [3, 4, 5].includes(Number(d.scale))) return Number(d.scale);
  // 엔트리 단일 라벨 기반 추론
  const ts = d?.matchStatus || '';
  let ai = '';
  try { ai = (typeof d?.gradingResult === 'string' ? JSON.parse(d.gradingResult) : d?.gradingResult)?.grade || ''; } catch { ai = ''; }
  if (has5LevelMarker(ts) || has5LevelMarker(ai)) return 5;
  // 데이터셋 전역 추론: 라벨 셋에 「매우」가 한 번이라도 등장 → 5단계 풀 전체. 아니면 데이터셋 메타 기본 3
  if (datasetScales?.dominantHas5) return 5;
  // 최후 보수값: 3 (가장 단순한 체계 가정)
  return 3;
}

// AI gradingResult → 정수 점수 (scale별 매핑 적용)
function parseAiGradeForScale(gradingResult, scale) {
  if (!gradingResult) return null;
  try {
    const parsed = typeof gradingResult === 'string' ? JSON.parse(gradingResult) : gradingResult;
    const grade = parsed.grade || '';
    const map = GRADE_TO_SCORE_BY_SCALE[scale] || GRADE_TO_SCORE_BY_SCALE[5];
    // 우선 정확 일치
    if (map[grade] != null) return map[grade];
    // 부분 일치 (공백·접두어 변형 흡수)
    if (scale === 5) {
      if (grade.includes('매우우수') || grade.includes('매우 우수')) return 5;
      if (grade.includes('매우노력') || grade.includes('매우 노력')) return 1;
    }
    if (scale === 4) {
      if (grade.includes('매우우수') || grade.includes('매우 우수')) return 4;
    }
    if (grade.includes('우수') || grade.includes('A')) return scale === 3 ? 3 : (scale === 4 ? 3 : 4);
    if (grade.includes('보통') || grade.includes('B')) return scale === 3 ? 2 : (scale === 4 ? 2 : 3);
    if (grade.includes('노력') || grade.includes('C')) return scale === 3 ? 1 : (scale === 4 ? 1 : 2);
    return null;
  } catch {
    return null;
  }
}

// --- QWK 계산 함수 ---
function calculateQWK(pairs, N = 5) {
  if (pairs.length < 2) return null;

  // 혼동 행렬 (1-indexed → 0-indexed)
  const O = Array.from({ length: N }, () => Array(N).fill(0));
  const rowSum = Array(N).fill(0);
  const colSum = Array(N).fill(0);
  const total = pairs.length;

  pairs.forEach(([ai, teacher]) => {
    const i = ai - 1;
    const j = teacher - 1;
    O[i][j]++;
    rowSum[i]++;
    colSum[j]++;
  });

  // 기대 행렬
  const E = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      E[i][j] = (rowSum[i] * colSum[j]) / total;
    }
  }

  // 가중치 행렬
  const W = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      W[i][j] = ((i - j) * (i - j)) / ((N - 1) * (N - 1));
    }
  }

  let numW = 0, denW = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      numW += W[i][j] * O[i][j];
      denW += W[i][j] * E[i][j];
    }
  }

  if (denW === 0) return 1.0; // 모두 동일 등급
  return 1 - (numW / denW);
}

// QWK 해석
function interpretQWK(qwk) {
  if (qwk === null) return { label: '-', color: '#64748b', desc: '데이터 부족' };
  if (qwk >= 0.81) return { label: 'Almost Perfect', color: '#10B981', desc: '거의 완벽한 일치' };
  if (qwk >= 0.61) return { label: 'Substantial', color: '#3B82F6', desc: '상당한 일치' };
  if (qwk >= 0.41) return { label: 'Moderate', color: '#F59E0B', desc: '보통 일치' };
  if (qwk >= 0.21) return { label: 'Fair', color: '#F97316', desc: '낮은 일치' };
  if (qwk >= 0.0) return { label: 'Slight', color: '#EF4444', desc: '미약한 일치' };
  return { label: 'Poor', color: '#EF4444', desc: '우연 이하' };
}

// 시간 문자열 "M:SS" → 초
function parseWritingTime(str) {
  if (!str) return 0;
  const [m, s] = str.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}
function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return '-';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}분 ${s}초`;
}

const AnalysisReport = ({ data, allArchive, onBack }) => {
  const safeData = Array.isArray(data) ? data : [];
  const safeArchive = Array.isArray(allArchive) ? allArchive : safeData;
  const totalCount = safeData.length;
  const selectedVersions = Array.from(new Set(safeData.map(d => d?.promptVersionId).filter(Boolean)));
  const versionLabel = selectedVersions.length === 0
    ? null
    : (selectedVersions.length === 1 ? selectedVersions[0] : selectedVersions.join(', '));

  // 리포트 타입 판정 (등급/과정)
  const gradingType = safeData.find(d => d?.gradingType)?.gradingType || '등급';
  const isQualitative = gradingType === '과정';
  const evalModes = Array.from(new Set(safeData.map(d => d?.evalMode).filter(Boolean)));
  const evalModeLabel = evalModes.length === 0 ? null : evalModes.length === 1 ? evalModes[0] : '자동+자율';

  // --- [v5.11] QWK용 쌍 데이터 구축 — scale별로 분리 산출 ---
  // 1) 데이터셋 전역에 「매우」 라벨이 있는지로 5단계 풀 추론용 메타 계산
  const datasetHas5 = safeData.some(d => {
    if (has5LevelMarker(d?.matchStatus)) return true;
    try { return has5LevelMarker(JSON.parse(d?.gradingResult || '{}')?.grade); } catch { return false; }
  });
  const datasetScales = { dominantHas5: datasetHas5 };

  // 2) 각 엔트리에 scale 결정 + (aiScore, teacherScore, scale) 트리플 생성
  const triples = safeData.map(d => {
    const scale = resolveScale(d, datasetScales);
    const aiScore = parseAiGradeForScale(d.gradingResult, scale);
    const teacherScore = (GRADE_TO_SCORE_BY_SCALE[scale] || {})[d.matchStatus] || null;
    return (aiScore && teacherScore) ? { ai: aiScore, t: teacherScore, scale, entry: d } : null;
  }).filter(Boolean);

  // 3) scale별 분리 산출 — 각 scale에 대해 독립 QWK
  const SCALES = [5, 4, 3];
  const qwkByScale = SCALES.map(N => {
    const pool = triples.filter(x => x.scale === N).map(x => [x.ai, x.t]);
    return { scale: N, qwk: calculateQWK(pool, N), count: pool.length };
  }).filter(x => x.count > 0);


  // 4) [v5.13] 자동 추천 scale = 표본 가장 큰 scale. 사용자가 탭으로 변경 가능 (아래 selectedScale)
  const dominantScaleEntry = [...qwkByScale].sort((a, b) => b.count - a.count)[0];
  const dominantScale = dominantScaleEntry?.scale || 5;

  // [v5.13] 사용자 선택 scale — 초기에는 dominant 자동, 데이터에 있는 scale만 활성. 탭으로 전환 가능
  const [selectedScale, setSelectedScale] = useState(dominantScale);
  // 데이터 변경 시 사용자가 선택한 scale이 더 이상 데이터에 없으면 dominant로 fallback
  useEffect(() => {
    const stillAvailable = qwkByScale.some(x => x.scale === selectedScale);
    if (!stillAvailable) setSelectedScale(dominantScale);
  }, [dominantScale, qwkByScale.map(x => x.scale).join(',')]);

  // 선택된 scale에 해당하는 결과
  const activeQwkEntry = qwkByScale.find(x => x.scale === selectedScale) || dominantScaleEntry;
  const overallQWK = activeQwkEntry?.qwk ?? null;
  const qwkInterp = interpretQWK(overallQWK);
  // 카드/차트/인사이트가 참조하는 qwkPairs = 선택된 scale의 쌍
  const qwkPairs = triples.filter(x => x.scale === selectedScale).map(x => [x.ai, x.t]);

  const totalCostUsd = safeData.reduce((acc, curr) => acc + (curr.costUsd || 0), 0);
  const totalCostKrw = Math.floor(totalCostUsd * 1350);

  // Error frequency
  const errorCounts = safeData.reduce((acc, curr) => {
    if (curr.errorType && curr.errorType !== '' && curr.errorType !== '해당 없음') {
      acc[curr.errorType] = (acc[curr.errorType] || 0) + 1;
    }
    return acc;
  }, {});

  const mostFrequentErrorKey = Object.keys(errorCounts).sort((a, b) => errorCounts[b] - errorCounts[a])[0] || 'N/A';
  const errorLabels = {
    ocr: 'OCR오류',
    hallucination: 'Hallucination(허위)',
    logic: 'Logical Error(논리)',
    rubric: 'Rubric Mismatch(기준)',
    format: 'Format/Tone(형식)',
    other: '기타',
    'OCR 인식 오류': 'OCR 인식 오류',
    '채점 기준표 미준수': '채점 기준표 미준수',
    '환각 현상 (거짓 논리)': '환각 현상',
    '포맷 오류': '포맷 오류',
  };
  const mostFrequentError = errorLabels[mostFrequentErrorKey] || mostFrequentErrorKey;

  // [v5.13] QWK & stats by category — 선택된 scale 기준 (탭으로 사용자가 전환 가능)
  const categories = [...new Set(safeData.map(d => d.category))];
  const catStats = categories.map(cat => {
    const catData = safeData.filter(d => d.category === cat);
    const catPairs = triples
      .filter(x => x.entry.category === cat && x.scale === selectedScale)
      .map(x => [x.ai, x.t]);
    const catQWK = calculateQWK(catPairs, selectedScale);
    const avgLat = catData.reduce((acc, curr) => acc + parseFloat(curr.latency || 0), 0) / catData.length;
    return { name: cat, qwk: catQWK, avgLatency: avgLat, count: catData.length, validPairs: catPairs.length };
  });

  // Worst Category by QWK
  const validCatStats = catStats.filter(c => c.qwk !== null);
  const worstCat = [...validCatStats].sort((a, b) => (a.qwk ?? 1) - (b.qwk ?? 1))[0];

  // [v5.13] QWK by evalMode — 선택된 scale 기준
  const evalModesStats = [...new Set(safeData.map(d => d.evalMode))];
  const evalStats = evalModesStats.map(mode => {
    const modePairs = triples
      .filter(x => x.entry.evalMode === mode && x.scale === selectedScale)
      .map(x => [x.ai, x.t]);
    const modeQWK = calculateQWK(modePairs, selectedScale);
    return { name: mode, qwk: modeQWK };
  });

  // Highest Latency category
  const slowestCat = [...catStats].sort((a, b) => b.avgLatency - a.avgLatency)[0];

  // --- 과정 분석: 등급평가 결과와 조인 (assignmentId 기준) ---
  const qualWithBaseline = safeData.map(d => {
    const quantMatches = safeArchive.filter(a => a.gradingType === '등급' && a.assignmentId === d.assignmentId);
    const quantGrades = quantMatches.map(q => q.matchStatus).filter(Boolean);
    const quantFeedback = quantMatches[0]?.gradingResult;
    return { ...d, quantMatches, quantGrades, quantFeedback };
  });

  // --- 과정 분석: raw JSON 기반 지표 집계 ---
  const writingTimes = safeData.map(d => d?.writingTimeSec).filter(s => typeof s === 'number' && s > 0);
  const avgWritingSec = writingTimes.length > 0 ? writingTimes.reduce((a, b) => a + b, 0) / writingTimes.length : 0;
  const pressures = safeData.map(d => d?.avgPressure).filter(p => typeof p === 'number');
  const avgPressureVal = pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0;
  const pauseCounts = safeData.map(d => d?.pauseCount).filter(p => typeof p === 'number');
  const avgPauseCount = pauseCounts.length > 0 ? pauseCounts.reduce((a, b) => a + b, 0) / pauseCounts.length : 0;
  const strokeCounts = safeData.map(d => d?.strokeCount).filter(s => typeof s === 'number');
  const avgStrokeCount = strokeCounts.length > 0 ? strokeCounts.reduce((a, b) => a + b, 0) / strokeCounts.length : 0;

  // 등급별 분포 (과정 분석 레코드에 매칭된 등급평가 등급 기준)
  const gradeBuckets = {};
  qualWithBaseline.forEach(d => {
    d.quantGrades.forEach(g => {
      if (!gradeBuckets[g]) gradeBuckets[g] = { grade: g, count: 0, writingSecs: [], pressures: [], pauses: [] };
      if (typeof d.writingTimeSec === 'number') gradeBuckets[g].writingSecs.push(d.writingTimeSec);
      if (typeof d.avgPressure === 'number') gradeBuckets[g].pressures.push(d.avgPressure);
      if (typeof d.pauseCount === 'number') gradeBuckets[g].pauses.push(d.pauseCount);
      gradeBuckets[g].count++;
    });
  });
  const gradeOrder = ['매우우수', '우수', '보통', '노력', '매우노력'];
  const avgOf = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const gradeStats = gradeOrder
    .filter(g => gradeBuckets[g])
    .map(g => {
      const b = gradeBuckets[g];
      return {
        grade: g,
        count: b.count,
        avgWritingSec: avgOf(b.writingSecs),
        avgPressure: avgOf(b.pressures),
        avgPauses: avgOf(b.pauses),
      };
    });

  // 등급평가 평균 등급 (중앙값)
  const allQuantGrades = qualWithBaseline.flatMap(d => d.quantGrades);
  const quantGradeMedian = allQuantGrades.length > 0 ? allQuantGrades[Math.floor(allQuantGrades.length / 2)] : '-';

  // 교과별 평균 필기 시간 (취약 영역 / 인사이트 #1 #3)
  const qualCatTimes = {};
  safeData.forEach(d => {
    if (!d?.category || typeof d.writingTimeSec !== 'number') return;
    if (!qualCatTimes[d.category]) qualCatTimes[d.category] = [];
    qualCatTimes[d.category].push(d.writingTimeSec);
  });
  const qualCatAvg = Object.entries(qualCatTimes).map(([cat, arr]) => ({ cat, avg: avgOf(arr) }));
  const longestCat = [...qualCatAvg].sort((a, b) => b.avg - a.avg)[0];
  const shortestCat = [...qualCatAvg].sort((a, b) => a.avg - b.avg)[0];

  const handlePrint = () => {
    window.print();
  };

  // --- 과정 분석 리포트 렌더 ---
  if (isQualitative) {
    return (
      <div className="ar-root">
        <header className="ar-header no-print">
          <div className="ar-header-main">
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)', color: '#475569', fontWeight: 600, marginRight: '16px' }}>
                ← 아카이브로 돌아가기
              </button>
            )}
            <h1 className="ar-title">
              AI 과정 분석 분석 리포트
              {versionLabel && (
                <span style={{ marginLeft: '12px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#2A75F3', background: '#EBF2FF', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>{versionLabel}</span>
              )}
              <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#86198F', background: '#FDF4FF', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>과정</span>
              {evalModeLabel && (
                <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>{evalModeLabel}</span>
              )}
            </h1>
            <button className="ar-print-btn" onClick={handlePrint}>🖨️ PDF 리포트 출력</button>
          </div>
        </header>

        <div className="ar-content print-content">
          <section className="ar-section ar-summary-grid-5">
            <div className="ar-stat-card">
              <div className="ar-stat-label">분석 데이터 수</div>
              <div className="ar-stat-val"><strong>{totalCount}건</strong></div>
            </div>
            <div className="ar-stat-card">
              <div className="ar-stat-label">평균 필기 시간</div>
              <div className="ar-stat-val"><strong>{formatSeconds(avgWritingSec)}</strong></div>
            </div>
            <div className="ar-stat-card">
              <div className="ar-stat-label">등급평가 평균 등급</div>
              <div className="ar-stat-val"><strong>{quantGradeMedian}</strong></div>
            </div>
            <div className="ar-stat-card">
              <div className="ar-stat-label">총 예상 비용 (Total Cost)</div>
              <div className="ar-stat-val"><strong>₩{Math.floor(totalCostUsd * 1350).toLocaleString()}</strong></div>
            </div>
            <div className="ar-stat-card">
              <div className="ar-stat-label">취약 영역 (Worst Area)</div>
              <div className="ar-stat-val" style={{ color: '#EF4444' }}><strong>{longestCat?.cat || '-'}</strong></div>
              {longestCat && (
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', marginTop: '2px' }}>
                  평균 {formatSeconds(longestCat.avg)}
                </div>
              )}
            </div>
          </section>

          {/* 보조 필기 지표 (raw 기반, 작은 박스) */}
          <section className="ar-section" style={{ padding: '16px 20px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', fontWeight: 700, marginRight: '8px' }}>📐 보조 필기 지표</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>평균 필압 <strong style={{ color: '#1E293B' }}>{avgPressureVal.toFixed(2)}</strong></div>
            <div style={{ color: '#CBD5E1' }}>|</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>평균 멈춤 구간 <strong style={{ color: '#1E293B' }}>{avgPauseCount.toFixed(1)}건</strong></div>
            <div style={{ color: '#CBD5E1' }}>|</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>평균 스트로크 수 <strong style={{ color: '#1E293B' }}>{Math.round(avgStrokeCount)}개</strong></div>
          </section>

          <section className="ar-section ar-card">
            <h3 className="ar-card-title">📊 등급별 필기 특성 분포 (등급평가 점수 상관)</h3>
            {gradeStats.length > 0 ? (
              <table className="ar-detail-table">
                <thead>
                  <tr>
                    <th>등급평가 등급</th>
                    <th>레코드 수</th>
                    <th>평균 필기 시간</th>
                    <th>평균 필압</th>
                    <th>평균 멈춤 구간</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeStats.map(s => (
                    <tr key={s.grade}>
                      <td><strong>{s.grade}</strong></td>
                      <td>{s.count}건</td>
                      <td>{formatSeconds(s.avgWritingSec)}</td>
                      <td>{s.avgPressure.toFixed(2)}</td>
                      <td>{s.avgPauses.toFixed(1)}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#94a3b8' }}>매칭된 등급평가 결과가 없어 등급별 집계를 산출할 수 없습니다.</p>
            )}
          </section>

          <section className="ar-section ar-card">
            <h3 className="ar-card-title">💡 필기 과정 인사이트</h3>
            <div className="ar-insight-list-complex">
              <div className="ar-insight-box">
                <div className="ar-insight-sub">1. 교과별 필기 시간 편차</div>
                {longestCat && shortestCat && longestCat.cat !== shortestCat.cat ? (
                  <p>
                    <strong>'{longestCat.cat}'</strong>({formatSeconds(longestCat.avg)})와 <strong>'{shortestCat.cat}'</strong>({formatSeconds(shortestCat.avg)}) 간 평균 필기 시간 격차가 가장 큽니다. 필기 시간이 긴 교과는 인지적 부하가 높았음을 시사합니다.
                  </p>
                ) : <p>교과별 필기 시간 비교를 위한 데이터가 부족합니다.</p>}
              </div>
              <div className="ar-insight-box">
                <div className="ar-insight-sub">2. 등급평가 등급 vs 평균 필기 시간 상관</div>
                {gradeStats.length >= 2 ? (
                  <p>
                    가장 높은 등급({gradeStats[0].grade})의 평균 필기 시간은 <strong>{formatSeconds(gradeStats[0].avgWritingSec)}</strong>, 가장 낮은 등급({gradeStats[gradeStats.length - 1].grade})은 <strong>{formatSeconds(gradeStats[gradeStats.length - 1].avgWritingSec)}</strong>입니다. 두 집단의 필기 패턴 차이를 해석해 학습 난이도 조정에 활용할 수 있습니다.
                  </p>
                ) : <p>등급평가 등급별 비교를 위해 2개 이상의 등급 데이터가 필요합니다.</p>}
              </div>
              <div className="ar-insight-box">
                <div className="ar-insight-sub">3. 멈춤 구간 평균</div>
                <p>
                  전체 평균 멈춤 구간은 <strong>{avgPauseCount.toFixed(1)}회</strong>입니다. 멈춤 구간은 스트로크 사이 간격이 2.5초 이상인 지점으로, 인지 처리에 시간이 소요된 구간을 의미합니다.
                </p>
              </div>
            </div>
          </section>

          <section className="ar-section ar-card">
            <h3 className="ar-card-title">📋 학생별 필기 특성 × 등급평가 결과 교차 요약</h3>
            <table className="ar-detail-table">
              <thead>
                <tr>
                  <th>과제명</th>
                  <th>교과</th>
                  <th>등급평가 등급</th>
                  <th>필기 시간</th>
                  <th>필압</th>
                  <th>멈춤</th>
                  <th>스트로크</th>
                </tr>
              </thead>
              <tbody>
                {qualWithBaseline.map(d => (
                  <tr key={d.id}>
                    <td>{d.title}</td>
                    <td>{d.category}</td>
                    <td>
                      {d.quantGrades.length > 0 ? (
                        <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{d.quantGrades.join(', ')}</span>
                      ) : (
                        <span style={{ color: '#EF4444', fontSize: 'var(--neo-font-size-sm)' }}>등급평가 결과 없음</span>
                      )}
                    </td>
                    <td>{typeof d.writingTimeSec === 'number' ? formatSeconds(d.writingTimeSec) : '-'}</td>
                    <td>{typeof d.avgPressure === 'number' ? d.avgPressure.toFixed(2) : '-'}</td>
                    <td>{typeof d.pauseCount === 'number' ? `${d.pauseCount}건` : '-'}</td>
                    <td>{typeof d.strokeCount === 'number' ? `${d.strokeCount}개` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    );
  }


  return (
    <div className="ar-root">
      <header className="ar-header no-print">
        <div className="ar-header-main">
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)', color: '#475569', fontWeight: 600, marginRight: '16px' }}>
              ← 아카이브로 돌아가기
            </button>
          )}
          <h1 className="ar-title">
            AI 등급평가 분석 리포트
            {versionLabel && (
              <span style={{ marginLeft: '12px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#2A75F3', background: '#EBF2FF', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>
                {versionLabel}
              </span>
            )}
            <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>등급</span>
            {evalModeLabel && (
              <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '4px 10px', borderRadius: '6px', verticalAlign: 'middle' }}>{evalModeLabel}</span>
            )}
          </h1>
          <button className="ar-print-btn" onClick={handlePrint}>🖨️ PDF 리포트 출력</button>
        </div>
      </header>

      <div className="ar-content print-content">
        {/* [v5.13] 등급체계 탭 — 데이터에 있는 scale만 활성. 사용자가 탭으로 분석 대상 scale 전환 */}
        {qwkByScale.length > 0 && (
          <section className="ar-section" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569' }}>📊 분석 대상 등급체계</span>
              {qwkByScale.map(x => {
                const on = x.scale === selectedScale;
                return (
                  <button key={x.scale} onClick={() => setSelectedScale(x.scale)}
                    style={{ padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${on ? '#2A75F3' : '#e2e8f0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
                    {on ? '✓ ' : ''}{x.scale}등급 <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, opacity: 0.7 }}>· 유효 {x.count}건</span>
                  </button>
                );
              })}
            </div>
            {/* [v5.14] 영향 범위 가이드 — 사용자가 어느 항목이 탭 영향을 받는지 한눈에 확인 */}
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.55, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
              <span style={{ display: 'inline-block', marginRight: 10 }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginRight: 4 }}>{selectedScale}등급 기준</span>
                탭 선택에 영향: QWK · 취약 영역 · 영역별 QWK 차트 · 평가 모드 비교 · 인사이트 #1·#3·#5
              </span>
              <span style={{ display: 'inline-block' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginRight: 4 }}>전체 데이터</span>
                탭 무관: 분석 데이터 수 · 총 예상 비용 · 최다 빈출 오류 · 인사이트 #2·#4
              </span>
            </div>
          </section>
        )}

        {/* -- TOP SUMMARY (5 Cards) -- */}
        <section className="ar-section ar-summary-grid-5">
          <div className="ar-stat-card">
            <div className="ar-stat-label">분석 데이터 수 (Total Records) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· 전체 데이터</span></div>
            <div className="ar-stat-val"><strong>{totalCount}</strong></div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', marginTop: '2px' }}>
              {selectedScale}등급 유효 {qwkPairs.length}건 <span style={{ color: '#cbd5e1' }}>(QWK 산출 가능)</span>
            </div>
          </div>
          {/* [v5.13] 카드 ② QWK — 선택된 scale 단일값 (탭이 등급체계 구분 역할) */}
          <div className="ar-stat-card" style={{ borderLeft: `4px solid ${qwkInterp.color}` }}>
            <div className="ar-stat-label">QWK (평가 일치도) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· {selectedScale}등급 기준</span></div>
            <div className="ar-stat-val" style={{ color: qwkInterp.color }}>
              <strong>{overallQWK !== null ? overallQWK.toFixed(3) : '-'}</strong>
            </div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: qwkInterp.color, fontWeight: 600, marginTop: '2px' }}>
              {qwkInterp.desc}
            </div>
          </div>
          {/* [v5.14] 카드별 영향 범위 메타 추가 — 등급체계 영향 받는 항목과 전체 데이터 항목을 명시 */}
          <div className="ar-stat-card">
            <div className="ar-stat-label">총 예상 비용 (Total Cost) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· 전체 데이터</span></div>
            <div className="ar-stat-val"><strong>₩{totalCostKrw.toLocaleString()}</strong></div>
          </div>
          <div className="ar-stat-card">
            <div className="ar-stat-label">취약 영역 (Worst QWK) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· {selectedScale}등급 기준</span></div>
            <div className="ar-stat-val" style={{ color: '#EF4444' }}><strong>{worstCat?.name || '-'}</strong></div>
            {worstCat && worstCat.qwk != null && (
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', marginTop: '2px' }}>
                QWK {worstCat.qwk.toFixed(3)}
              </div>
            )}
          </div>
          <div className="ar-stat-card">
            <div className="ar-stat-label">최다 빈출 오류 (Top Error) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· 전체 데이터</span></div>
            <div className="ar-stat-val"><strong>{mostFrequentError}</strong></div>
          </div>
        </section>

        {/* [v5.12] QWK 해석 가이드 — 카드 ②의 QWK 값이 어느 구간에 속하는지 한눈에 확인 */}
        <section className="ar-section" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', marginBottom: 8 }}>
            📏 QWK 해석 가이드 <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontWeight: 600 }}>· QWK 값이 어느 구간에 속하는지 비교</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 6 }}>
            {[
              { range: '0.81 ~ 1.00', ko: '거의 완벽한 일치', en: 'Almost Perfect', color: '#10B981' },
              { range: '0.61 ~ 0.80', ko: '상당한 일치', en: 'Substantial', color: '#3B82F6' },
              { range: '0.41 ~ 0.60', ko: '보통 일치', en: 'Moderate', color: '#F59E0B' },
              { range: '0.21 ~ 0.40', ko: '낮은 일치', en: 'Fair', color: '#F97316' },
              { range: '0.00 ~ 0.20', ko: '미약한 일치', en: 'Slight', color: '#EF4444' },
              { range: '< 0.00', ko: '우연 이하', en: 'Worse than chance', color: '#EF4444' },
            ].map(b => (
              <div key={b.range} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: `1px solid ${b.color}30`, background: `${b.color}0a` }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: b.color, fontFamily: 'ui-monospace, Menlo, monospace' }}>{b.range}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700 }}>{b.ko} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({b.en})</span></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -- INSIGHTS (5 items) -- */}
        <section className="ar-section ar-card">
          <h3 className="ar-card-title">💡 분석 인사이트</h3>
          {/* [v5.14] 각 인사이트 박스 헤더에 영향 범위 메타 뱃지 — 등급체계 영향 받는 항목과 전체 데이터 항목 구분 */}
          <div className="ar-insight-list-complex">
            <div className="ar-insight-box">
              <div className="ar-insight-sub">1. 취약 영역 식별 (Category Vulnerability) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>{selectedScale}등급 기준</span></div>
              {worstCat ? (
                <p>현재 모델은 <strong>'{worstCat.name}'</strong> 영역에서 가장 낮은 평가 일치도(QWK <strong>{worstCat.qwk?.toFixed(3)}</strong>)를 보입니다. 전체 QWK({overallQWK?.toFixed(3)}) 대비 낮은 수치로, 해당 영역의 프롬프트 보강이 최우선 과제입니다.</p>
              ) : (
                <p>유효한 평가 일치도 데이터가 부족하여 취약 영역을 식별할 수 없습니다.</p>
              )}
            </div>

            <div className="ar-insight-box">
              <div className="ar-insight-sub">2. 오류 원인 진단 (Root Cause) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>전체 데이터</span></div>
              <p>전체 오류의 약 {totalCount > 0 ? ((errorCounts[mostFrequentErrorKey] || 0) / (Object.values(errorCounts).reduce((a, b) => a + b, 0) || 1) * 100).toFixed(0) : 0}%가 <strong>'{mostFrequentError}'</strong>에서 발생하고 있습니다. 해당 오류 유형에 대한 프롬프트 또는 전처리 과정 점검이 필요합니다.</p>
            </div>

            <div className="ar-insight-box">
              <div className="ar-insight-sub">3. 평가 모드 격차 (Auto vs Autonomous) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>{selectedScale}등급 기준</span></div>
              {(() => {
                const autoStat = evalStats.find(e => e.name === '자동평가');
                const selfStat = evalStats.find(e => e.name === '자율평가');
                if (!autoStat?.qwk && !selfStat?.qwk) {
                  return <p>평가 모드별 데이터가 부족하여 비교할 수 없습니다.</p>;
                }
                const autoQWK = autoStat?.qwk?.toFixed(3) || '-';
                const selfQWK = selfStat?.qwk?.toFixed(3) || '-';
                return (
                  <p>자동평가(QWK <strong>{autoQWK}</strong>) 대비 자율평가(QWK <strong>{selfQWK}</strong>) 모드의 평가 일치도가 {(selfStat?.qwk || 0) >= (autoStat?.qwk || 0) ? '더 높습니다' : '더 낮습니다'}.</p>
                );
              })()}
            </div>

            <div className="ar-insight-box">
              <div className="ar-insight-sub">4. 시간 대비 효율성 (Efficiency) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>전체 데이터</span> <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 4 }}>QWK는 {selectedScale}등급</span></div>
              {slowestCat ? (
                <p>가장 시간이 오래 걸리는 <strong>'{slowestCat.name}'</strong>(평균 {slowestCat.avgLatency.toFixed(2)}초) 영역의 QWK는 <strong>{slowestCat.qwk?.toFixed(3) || '-'}</strong>입니다.</p>
              ) : (
                <p>처리 시간 데이터가 없습니다.</p>
              )}
            </div>

            <div className="ar-insight-box" style={{ borderLeftColor: qwkInterp.color }}>
              <div className="ar-insight-sub">5. AI 채점 신뢰도 (Overall Reliability) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>{selectedScale}등급 기준</span></div>
              {overallQWK !== null ? (
                <p>AI 채점의 전체 QWK는 <strong style={{ color: qwkInterp.color }}>{overallQWK.toFixed(3)}</strong>으로 <strong>'{qwkInterp.desc}'</strong> 수준입니다. {
                  overallQWK >= 0.61
                    ? '실서비스 배포에 적합한 수준의 일치도를 보이고 있습니다.'
                    : overallQWK >= 0.41
                    ? '프롬프트 개선을 통해 일치도를 높일 여지가 있습니다.'
                    : '프롬프트 전면 재설계 또는 모델 변경이 권장됩니다.'
                }</p>
              ) : (
                <p>평가 일치도 데이터가 없어 QWK를 산출할 수 없습니다. Prompt Studio에서 평가 일치도를 입력해 주세요.</p>
              )}
            </div>
          </div>
        </section>

        {/* -- CHARTS GRID -- */}
        <div className="ar-charts-grid">
          {/* Left: Category QWK */}
          <div className="ar-card">
            <h3 className="ar-card-title">📊 영역별 QWK (Category Performance) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 4, fontWeight: 700, marginLeft: 6, verticalAlign: 'middle' }}>{selectedScale}등급 기준</span></h3>
            <div className="ar-bar-chart">
              {catStats
                .sort((a, b) => (b.qwk ?? -1) - (a.qwk ?? -1))
                .map(cat => {
                  const interp = interpretQWK(cat.qwk);
                  const barWidth = cat.qwk !== null ? Math.max(cat.qwk * 100, 0) : 0;
                  return (
                    <div key={cat.name} className="ar-bar-row">
                      <div className="ar-bar-label">{cat.name}</div>
                      <div className="ar-bar-track">
                        <div className="ar-bar-fill" style={{ width: `${barWidth}%`, background: interp.color }}></div>
                      </div>
                      <div className="ar-bar-val" style={{ color: interp.color }}>
                        {cat.qwk !== null ? cat.qwk.toFixed(3) : '-'}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right: Eval Mode Comparison */}
          <div className="ar-card">
            <h3 className="ar-card-title">⚖️ 평가 모드 비교 (Auto vs Autonomous) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 4, fontWeight: 700, marginLeft: 6, verticalAlign: 'middle' }}>{selectedScale}등급 기준</span></h3>
            <div className="ar-bar-chart">
              {evalStats.map(mode => {
                const interp = interpretQWK(mode.qwk);
                const barWidth = mode.qwk !== null ? Math.max(mode.qwk * 100, 0) : 0;
                return (
                  <div key={mode.name} className="ar-bar-row">
                    <div className="ar-bar-label" style={{ width: '100px' }}>{mode.name}</div>
                    <div className="ar-bar-track">
                      <div className="ar-bar-fill" style={{ width: `${barWidth}%`, background: '#818CF8' }}></div>
                    </div>
                    <div className="ar-bar-val">QWK {mode.qwk !== null ? mode.qwk.toFixed(3) : '-'}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '2rem', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: '1.5' }}>
              ℹ️ 자율평가는 모델이 스스로 사고 과정을 기록한 뒤 결과를 도출하는 방식이며, 자동평가는 규정된 스키마에 따라 즉시 답안을 생성하는 방식입니다.
            </div>
          </div>
        </div>

        {/* -- MODEL SUMMARY TABLE -- */}
        <section className="ar-section ar-card">
          <h3 className="ar-card-title">📋 교과별 성능 상세 요약</h3>
          {/* [v5.17] 분류 축을 「교과」로 명확화 — 「영역」은 추상적 */}
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6, marginTop: 4, marginBottom: 10 }}>
            <strong>교과별로 AI 채점 성능을 한눈에 비교</strong>하기 위한 표입니다. 어느 교과에서 AI가 더 잘/못 채점했는지, 어떤 오류가 자주 나오는지, 처리 시간은 얼마나 걸렸는지를 교과 단위로 정리합니다. 프롬프트 개선이 필요한 우선 교과를 결정할 때 활용합니다.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap', fontSize: 'var(--neo-font-size-xs)' }}>
            <span style={{ color: '#2A75F3', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{selectedScale}등급 기준</span>
            <span style={{ color: '#64748B' }}>QWK 컬럼만 — 탭 선택에 따라 갱신</span>
            <span style={{ color: '#475569', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 4, fontWeight: 700, marginLeft: 8 }}>전체 데이터</span>
            <span style={{ color: '#64748B' }}>문항수 · 최다 빈출 오류 · 평균 처리 시간 — 탭 무관</span>
          </div>
          <table className="ar-table">
            <thead>
              <tr>
                <th>영역(과목)</th>
                <th>문항수</th>
                <th>QWK (평가 일치도) <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', fontWeight: 700 }}>· {selectedScale}등급</span></th>
                <th>최다 빈출 오류</th>
                <th>평균 처리 시간</th>
              </tr>
            </thead>
            <tbody>
              {catStats.map(cat => {
                const catData = safeData.filter(d => d.category === cat.name);
                const errors = catData.reduce((acc, curr) => {
                  if (curr.errorType && curr.errorType !== '해당 없음') acc[curr.errorType] = (acc[curr.errorType] || 0) + 1;
                  return acc;
                }, {});
                const topErr = Object.keys(errors).sort((a, b) => errors[b] - errors[a])[0] || '-';
                const interp = interpretQWK(cat.qwk);

                return (
                  <tr key={cat.name}>
                    <td>{cat.name}</td>
                    <td>{cat.count}</td>
                    <td>
                      <span style={{
                        fontWeight: 700, color: interp.color,
                        background: cat.qwk !== null ? `${interp.color}15` : 'transparent',
                        padding: '2px 8px', borderRadius: '4px', fontSize: 'var(--neo-font-size-sm)'
                      }}>
                        {cat.qwk !== null ? cat.qwk.toFixed(3) : '-'}
                      </span>
                    </td>
                    <td>{errorLabels[topErr] || topErr}</td>
                    <td>{cat.avgLatency.toFixed(2)}s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
            * QWK(Quadratic Weighted Kappa): AI 채점 등급과 평가 일치도 등급의 일치도. 부분 일치(1단계 차이)도 가중 반영하여 단순 정확도보다 정밀한 지표입니다.
          </div>
        </section>
      </div>

      <style>{`
        .ar-summary-grid-5 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        @media (min-width: 1200px) {
          .ar-summary-grid-5 {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        .ar-insight-list-complex {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .ar-insight-box {
          padding-left: 1rem;
          border-left: 4px solid #F1F5F9;
        }
        .ar-insight-sub {
          font-weight: 800;
          font-size: var(--neo-font-size-base);
          color: #1E293B;
          margin-bottom: 0.5rem;
        }
        .ar-insight-box p {
          margin: 0;
          font-size: var(--neo-font-size-base);
          color: #475569;
          line-height: 1.6;
        }
        .ar-insight-box strong {
          color: #1E293B;
        }
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0 !important; }
          .ar-root { background: white !important; }
          .ar-card { border: 1px solid #eee !important; box-shadow: none !important; margin-bottom: 2rem !important; }
          .ar-summary-grid-5 { grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem; }
        }
      `}</style>
    </div>
  );
};

export default AnalysisReport;
