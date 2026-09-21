/**
 * handwritingAnalysis.js
 *
 * docs/handwriting_analysis_spec.md §7.1 구현 (JavaScript 포팅) + Stage 1 확장
 * - Time / Coord / Hesitation 3축 지표 산출
 * - 패턴 코드 생성 (예: "aab")
 * - 필압(pressure) 대체 지표 = Hesitation Score
 * - 역행 유형 3분류 (correction/rework/verification)
 * - pause_events, flow_zones, positive_signals, tags, narrative_blocks
 * - Stage 1 리포트 JSON (과정평가_prompt.md §0.3 스키마)
 *
 * [개발자 영역 표시]
 *   ★ 본 파일은 "JSON → 계산 → 매트릭스 조회 → Stage 1 리포트"까지만 담당.
 *   ★ Stage 2(AI 호출)는 과정평가_prompt.md와 함께 개발자가 백엔드에서 처리.
 */

import { lookupPattern, lookupPatternFeedback, gradeToBucket, expandSignalLabels, POSITIVE_SIGNAL_TEMPLATES } from './handwritingPatternMatrix.js';

// ─── §4 파라미터 ────────────────────────────────────────────────
export const PARAMS = {
  MICRO_PAUSE_MIN_MS: 300,
  MICRO_PAUSE_MAX_MS: 1500,
  REVISIT_RADIUS: 0.8,
  REVISIT_TIME_GAP_MS: 500,
  REVISIT_LOOKBACK: 10,
  MIN_POINTS_FOR_CV: 5,

  MICRO_PAUSE_NORM_CAP: 0.30,
  REVISIT_NORM_CAP: 0.15,
  SPEED_CV_NORM_MIN: 0.45,
  SPEED_CV_NORM_MAX: 0.80,

  WEIGHT_MICRO_PAUSE: 0.40,
  WEIGHT_REVISIT: 0.35,
  WEIGHT_SPEED_CV: 0.25,

  HESITATION_A_MAX: 0.30,
  HESITATION_B_MAX: 0.60,

  TIME_A_PERCENTILE: 67,
  TIME_C_PERCENTILE: 33,

  COORD_A_MIN_SCORE: 0.80,
  COORD_B_MIN_SCORE: 0.60,
  COORD_Y_BACKTRACK_THRESHOLD: 1.0,

  // Time 축 절대 속도 컷오프 (프로토타입 기본값, 코호트 기반 백분위가 없을 때 사용)
  // 단위: 좌표단위 / ms  (총 필기 거리 / 총 필기 시간)
  // 실측 기준 참고값: 기존 샘플 JSON ≈ 0.065, 합성 30획 ≈ 0.009~0.028
  TIME_A_MIN_ABS: 0.040,   // 이 이상 → a (빠름)
  TIME_C_MAX_ABS: 0.010,   // 이 이하 → c (느림)

  // §4.6 역행 유형 분류
  VERIFICATION_TIME_RATIO_MIN: 0.80,   // 전체 시간의 80% 이후 시작이면 후기 역행
  VERIFICATION_STROKES_AFTER_MAX: 10,  // 역행 후 10획 이내 종료 = 검산
  REWORK_STROKES_AFTER_MIN: 10,        // 역행 후 10획 이상 지속 = 재작성

  // §11 추가 지표
  PAUSE_MAJOR_MS: 5000,                // 주요 멈춤
  PAUSE_MINOR_MS: 1500,                // 일반 멈춤
  OUTLIER_PAUSE_MS: 30000,             // 자리비움 (30초+)
  // NOTE: spec v1.9에서 flow_zones 전면 제거됨 (수학 풀이 데이터에서 탐지 불가).
  // 집중력 해석은 persistence_score와 pause_events로 대체.

  // §8.2 답 먼저 쓰기 탐지
  EARLY_ANSWER_STROKE_RATIO: 0.20,     // 상위 20% 획 내 하단 집중
  EARLY_ANSWER_Y_BOTTOM_RATIO: 0.30,   // y 하위 30%(페이지 하단)
};

// ─── 유틸 ────────────────────────────────────────────────────────
function euclidean(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}
function strokeDuration(stroke) {
  return (stroke.points || []).reduce((s, p) => s + (p.dt || 0), 0);
}
function strokeDistance(stroke) {
  const pts = stroke.points || [];
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += euclidean(pts[i - 1], pts[i]);
  return d;
}
function strokeCenter(stroke) {
  const pts = stroke.points || [];
  if (!pts.length) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  return { x: sx / pts.length, y: sy / pts.length };
}

// 평균 필압 계산 (JSON의 f 값 평균, 참고용)
function avgPressure(strokes) {
  let sum = 0, n = 0;
  for (const s of strokes) {
    for (const p of (s.points || [])) {
      if (typeof p.f === 'number') { sum += p.f; n++; }
    }
  }
  return n > 0 ? sum / n : 0;
}

function pressureLabel(avg) {
  if (avg >= 0.60) return '안정형';
  if (avg >= 0.40) return '보통';
  if (avg > 0) return '약한 필치';
  return '데이터 없음';
}

// ─── §3.1 Time 축 ────────────────────────────────────────────────
export function computeTimeMetrics(strokes) {
  let totalDistance = 0;
  let totalDuration = 0;
  for (const s of strokes) {
    totalDistance += strokeDistance(s);
    totalDuration += strokeDuration(s);
  }
  const writingSpeed = totalDuration > 0 ? totalDistance / totalDuration : 0;
  return {
    writing_speed: writingSpeed,
    total_distance: totalDistance,
    total_duration_ms: totalDuration,
  };
}

// ─── §3.2 Coord 축 ───────────────────────────────────────────────
export function computeCoordMetrics(strokes) {
  if (strokes.length < 2) {
    return { sequentiality_score: 1.0, backtrack_count: 0, backtrack_ratio: 0, backtrack_events: [] };
  }
  const centers = strokes.map(strokeCenter);
  let sequential = 0;
  let backtrack = 0;
  const backtrackEvents = []; // {from_index, to_index, from_y, to_y, dy}
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1], cur = centers[i];
    const dy = cur.y - prev.y;
    const dx = cur.x - prev.x;
    if (dy >= 0) sequential++;
    else if (Math.abs(dy) < 1.0 && dx > 0) sequential++;
    else if (-dy >= PARAMS.COORD_Y_BACKTRACK_THRESHOLD) {
      backtrack++;
      backtrackEvents.push({
        from_index: i - 1,
        to_index: i,
        from_y: prev.y,
        to_y: cur.y,
        dy,
      });
    } else sequential++;
  }
  const transitions = centers.length - 1;
  return {
    sequentiality_score: sequential / transitions,
    backtrack_count: backtrack,
    backtrack_ratio: backtrack / transitions,
    backtrack_events: backtrackEvents,
  };
}

// ─── §3.3 Hesitation 축 ──────────────────────────────────────────
export function computeHesitationMetrics(strokes) {
  if (strokes.length < 2) {
    return {
      micro_pause_ratio: 0,
      revisit_density: 0,
      avg_speed_cv: 0,
      score_1: 0, score_2: 0, score_3: 0,
      hesitation_score: 0,
    };
  }

  // ① Micro-Pause Ratio
  let microPauseCount = 0;
  for (let i = 1; i < strokes.length; i++) {
    const gap = strokes[i].startTime - strokes[i - 1].startTime;
    const prevDur = strokeDuration(strokes[i - 1]);
    const pureGap = gap - prevDur;
    if (pureGap >= PARAMS.MICRO_PAUSE_MIN_MS && pureGap <= PARAMS.MICRO_PAUSE_MAX_MS) {
      microPauseCount++;
    }
  }
  const microPauseRatio = microPauseCount / (strokes.length - 1);
  const score1 = Math.min(microPauseRatio / PARAMS.MICRO_PAUSE_NORM_CAP, 1.0);

  // ② Revisit Density
  let revisitCount = 0;
  const centers = strokes.map(strokeCenter);
  for (let i = 0; i < strokes.length; i++) {
    const start = Math.max(0, i - PARAMS.REVISIT_LOOKBACK);
    for (let j = start; j < i; j++) {
      const dist = euclidean(centers[i], centers[j]);
      const timeGap = strokes[i].startTime - (strokes[j].startTime + strokeDuration(strokes[j]));
      if (dist < PARAMS.REVISIT_RADIUS && timeGap > PARAMS.REVISIT_TIME_GAP_MS) {
        revisitCount++;
        break;
      }
    }
  }
  const revisitDensity = revisitCount / strokes.length;
  const score2 = Math.min(revisitDensity / PARAMS.REVISIT_NORM_CAP, 1.0);

  // ③ Intra-stroke Speed CV
  const strokeCvs = [];
  for (const stroke of strokes) {
    const pts = stroke.points || [];
    if (pts.length < PARAMS.MIN_POINTS_FOR_CV) continue;
    const speeds = [];
    for (let i = 1; i < pts.length; i++) {
      const d = euclidean(pts[i - 1], pts[i]);
      if ((pts[i].dt || 0) > 0) speeds.push(d / pts[i].dt);
    }
    if (speeds.length >= 3) {
      const m = mean(speeds);
      if (m > 0) strokeCvs.push(stdev(speeds) / m);
    }
  }
  const avgSpeedCv = mean(strokeCvs);
  const score3 = Math.max(
    0,
    Math.min((avgSpeedCv - PARAMS.SPEED_CV_NORM_MIN) / (PARAMS.SPEED_CV_NORM_MAX - PARAMS.SPEED_CV_NORM_MIN), 1.0)
  );

  const hesitation =
    PARAMS.WEIGHT_MICRO_PAUSE * score1 +
    PARAMS.WEIGHT_REVISIT * score2 +
    PARAMS.WEIGHT_SPEED_CV * score3;

  return {
    micro_pause_ratio: microPauseRatio,
    revisit_density: revisitDensity,
    avg_speed_cv: avgSpeedCv,
    score_1: score1,
    score_2: score2,
    score_3: score3,
    hesitation_score: hesitation,
  };
}

// ─── 등급 산정 ───────────────────────────────────────────────────
export function gradeHesitation(score, cutoffs = null) {
  const aMax = cutoffs?.hesitation_a_max ?? PARAMS.HESITATION_A_MAX;
  const bMax = cutoffs?.hesitation_b_max ?? PARAMS.HESITATION_B_MAX;
  if (score < aMax) return 'a';
  if (score < bMax) return 'b';
  return 'c';
}

export function gradeCoord(score, cutoffs = null) {
  const aMin = cutoffs?.coord_a_min ?? PARAMS.COORD_A_MIN_SCORE;
  const bMin = cutoffs?.coord_b_min ?? PARAMS.COORD_B_MIN_SCORE;
  if (score >= aMin) return 'a';
  if (score >= bMin) return 'b';
  return 'c';
}

/**
 * Time 축 등급.
 * 1순위: cutoffs.time_a_min / time_c_max가 주입되면 그 값 사용 (코호트 백분위 기반)
 * 2순위: PARAMS.TIME_A_MIN_ABS / TIME_C_MAX_ABS (프로토타입 절대값 기본값)
 */
export function gradeTime(writingSpeed, cutoffs = null) {
  const aMin = cutoffs?.time_a_min ?? PARAMS.TIME_A_MIN_ABS;
  const cMax = cutoffs?.time_c_max ?? PARAMS.TIME_C_MAX_ABS;
  if (writingSpeed >= aMin) return 'a';
  if (writingSpeed <= cMax) return 'c';
  return 'b';
}

// ─── 메인 함수 (§7.1) ────────────────────────────────────────────
/**
 * @param {Array} strokesData - JSON의 strokes 배열 또는 [{ strokes: [...] }] 형태
 * @param {Object} options
 *   - cutoffs: 컷오프 오버라이드
 *   - ownerId, pageId: 메타데이터
 *   - cutoffVersion: 버전 문자열
 * @returns analyze 결과 객체
 */
export function analyzeHandwriting(strokesData, options = {}) {
  const { cutoffs = null, ownerId = null, pageId = null, cutoffVersion = 'v1.0' } = options;

  // 입력 정규화: 배열의 첫 요소가 strokes를 가지고 있는 경우
  let strokes = strokesData;
  let meta = {};
  if (Array.isArray(strokesData) && strokesData.length > 0 && strokesData[0].strokes) {
    strokes = strokesData[0].strokes;
    meta = { owner: strokesData[0].owner, page_id: strokesData[0].pid };
  }
  if (!Array.isArray(strokes)) strokes = [];

  const warnings = [];
  if (strokes.length < 5) warnings.push('획 수 부족 (분석 정확도 낮음, 5개 미만)');
  if (strokes.length === 0) {
    return {
      metadata: { owner: ownerId, page_id: pageId, n_strokes: 0, total_duration_sec: 0, cutoff_version: cutoffVersion },
      raw_metrics: {}, normalized_scores: {}, grades: {},
      pattern_code: '---',
      warnings: ['획 데이터 없음'],
    };
  }

  const time = computeTimeMetrics(strokes);
  const coord = computeCoordMetrics(strokes);
  const hesit = computeHesitationMetrics(strokes);

  const timeGrade = gradeTime(time.writing_speed, cutoffs);
  const coordGrade = gradeCoord(coord.sequentiality_score, cutoffs);
  const hesitGrade = gradeHesitation(hesit.hesitation_score, cutoffs);
  const patternCode = `${timeGrade}${coordGrade}${hesitGrade}`;

  return {
    metadata: {
      owner: ownerId ?? meta.owner ?? null,
      page_id: pageId ?? meta.page_id ?? null,
      n_strokes: strokes.length,
      total_duration_sec: time.total_duration_ms / 1000,
      cutoff_version: cutoffVersion,
    },
    raw_metrics: {
      writing_speed: time.writing_speed,
      sequentiality_score: coord.sequentiality_score,
      backtrack_count: coord.backtrack_count,
      backtrack_ratio: coord.backtrack_ratio,
      micro_pause_ratio: hesit.micro_pause_ratio,
      revisit_density: hesit.revisit_density,
      avg_speed_cv: hesit.avg_speed_cv,
    },
    normalized_scores: {
      hesitation_score: hesit.hesitation_score,
      hesitation_components: {
        micro_pause: hesit.score_1,
        revisit: hesit.score_2,
        speed_cv: hesit.score_3,
      },
    },
    grades: { time: timeGrade, coord: coordGrade, hesitation: hesitGrade },
    pattern_code: patternCode,
    warnings,
    _internal: { strokes, coord, hesit, time },  // Stage 1 빌더에서 재사용
  };
}

// ─── §3.2.2 역행 유형 3분류 ──────────────────────────────────────
/**
 * 역행 이벤트를 correction / rework / verification으로 분류
 * @param {Array} strokes
 * @param {Array} backtrackEvents - computeCoordMetrics 결과의 backtrack_events
 * @returns { events: [{...event, btype}], counts: {correction, rework, verification}, main_type }
 */
export function classifyBacktrackEvents(strokes, backtrackEvents) {
  const totalStrokes = strokes.length;
  const totalDuration = strokes.length > 0
    ? (strokes[strokes.length - 1].startTime - strokes[0].startTime) || 1
    : 1;

  const counts = { correction: 0, rework: 0, verification: 0 };
  const events = [];

  for (const ev of backtrackEvents) {
    const eventTimeOffset = strokes[ev.to_index].startTime - strokes[0].startTime;
    const timeRatio = eventTimeOffset / totalDuration;
    const strokesAfter = totalStrokes - 1 - ev.to_index;

    let btype;
    if (timeRatio >= PARAMS.VERIFICATION_TIME_RATIO_MIN && strokesAfter < PARAMS.VERIFICATION_STROKES_AFTER_MAX) {
      btype = 'verification';
    } else if (strokesAfter >= PARAMS.REWORK_STROKES_AFTER_MIN) {
      btype = 'rework';
    } else {
      btype = 'correction';
    }

    counts[btype]++;
    events.push({ ...ev, btype, time_ratio: timeRatio, strokes_after: strokesAfter });
  }

  // 동률 처리: verification > rework > correction
  const sortedTypes = ['verification', 'rework', 'correction'];
  let mainType = 'none';
  let mainCount = 0;
  for (const t of sortedTypes) {
    if (counts[t] > mainCount) {
      mainCount = counts[t];
      mainType = t;
    }
  }

  return { events, counts, main_type: mainType };
}

// ─── §11.3.2 Pause Events (좌표 포함 멈춤 지점) ────────────────
export function computePauseEvents(strokes) {
  const events = [];
  if (strokes.length < 2) return events;
  const base = strokes[0].startTime;

  for (let i = 1; i < strokes.length; i++) {
    const gap = strokes[i].startTime - strokes[i - 1].startTime;
    const prevDur = strokeDuration(strokes[i - 1]);
    const pureGap = gap - prevDur;

    if (pureGap >= PARAMS.PAUSE_MINOR_MS) {
      const severity = pureGap >= PARAMS.PAUSE_MAJOR_MS ? 'major' : 'minor';
      const offsetMs = strokes[i].startTime - base;
      const sec = Math.floor(offsetMs / 1000);
      const timeFormatted = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      const center = strokeCenter(strokes[i]);
      events.push({
        time_formatted: timeFormatted,
        duration_sec: pureGap / 1000,
        location: { x: +center.x.toFixed(2), y: +center.y.toFixed(2) },
        severity,
        stroke_index: i,
      });
    }
  }
  return events;
}

// ─── Outlier Pauses (30초 이상 자리비움) ────────────────────────
export function computeOutlierPauses(strokes) {
  let count = 0;
  let totalSec = 0;
  if (strokes.length < 2) return { count, total_sec: totalSec };
  for (let i = 1; i < strokes.length; i++) {
    const gap = strokes[i].startTime - strokes[i - 1].startTime;
    const pureGap = gap - strokeDuration(strokes[i - 1]);
    if (pureGap >= PARAMS.OUTLIER_PAUSE_MS) {
      count++;
      totalSec += pureGap / 1000;
    }
  }
  return { count, total_sec: +totalSec.toFixed(1) };
}

// ─── §3.4 Persistence Score (멈춤 후 필기 재개 비율) ─────────────
export function computePersistenceScore(strokes) {
  if (strokes.length < 2) return 1.0;
  let pauseCount = 0;
  let resumedCount = 0;
  for (let i = 1; i < strokes.length; i++) {
    const gap = strokes[i].startTime - strokes[i - 1].startTime - strokeDuration(strokes[i - 1]);
    if (gap >= PARAMS.PAUSE_MAJOR_MS) {
      pauseCount++;
      // 멈춤 후 최소 3획 이상 이어지면 재개된 것으로 간주
      if (strokes.length - i >= 3) resumedCount++;
    }
  }
  if (pauseCount === 0) return 1.0;
  return +((resumedCount / pauseCount).toFixed(3));
}

// ─── §8.2 답 먼저 쓰기 탐지 ──────────────────────────────────────
export function detectEarlyAnswerFlag(strokes) {
  if (strokes.length < 10) return false;
  const earlyCount = Math.max(1, Math.floor(strokes.length * PARAMS.EARLY_ANSWER_STROKE_RATIO));
  const earlyStrokes = strokes.slice(0, earlyCount);

  // y 범위 추정
  let minY = Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const c = strokeCenter(s);
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const yRange = maxY - minY || 1;
  const bottomThreshold = maxY - yRange * PARAMS.EARLY_ANSWER_Y_BOTTOM_RATIO;

  // 초기 획이 페이지 하단에 집중되었는지
  const bottomHits = earlyStrokes.filter(s => strokeCenter(s).y >= bottomThreshold).length;
  return bottomHits / earlyStrokes.length >= 0.6;
}

// ─── 긍정 신호 자동 탐지 (§11.6) ─────────────────────────────────
export function detectPositiveSignals(analysis, tags) {
  const signals = [];
  const { raw_metrics: rm, normalized_scores: ns, grades: g } = analysis;

  // consistent_flow: 속도 변동이 낮고 흐름 일관
  if (rm.avg_speed_cv != null && rm.avg_speed_cv < 0.50 && g.time !== 'c') {
    signals.push({ label: 'consistent_flow', evidence: `speed_cv=${rm.avg_speed_cv.toFixed(2)}` });
  }
  // sequential_order: 순차성 높음
  if (rm.sequentiality_score >= 0.80) {
    signals.push({ label: 'sequential_order', evidence: `sequentiality=${(rm.sequentiality_score * 100).toFixed(0)}%` });
  }
  // few_revisions: 덧쓰기 밀도 낮음
  if (rm.revisit_density < 0.05) {
    signals.push({ label: 'few_revisions', evidence: `revisit_density=${(rm.revisit_density * 100).toFixed(0)}%` });
  }
  // fast_execution: 빠른 속도
  if (g.time === 'a') {
    signals.push({ label: 'fast_execution', evidence: `writing_speed=${(rm.writing_speed * 1000).toFixed(2)}px/s` });
  }
  // self_correction: 역행은 있으나 덧쓰기 밀도는 낮음
  if (g.coord !== 'a' && rm.revisit_density < 0.10) {
    signals.push({ label: 'self_correction', evidence: `backtrack=${rm.backtrack_count}, revisit=${(rm.revisit_density * 100).toFixed(0)}%` });
  }
  // verification_habit: 후반 검산 감지됨
  if (tags.main_backtrack_type === 'verification') {
    signals.push({ label: 'verification_habit', evidence: `후반 역행 ${tags.backtrack_count_by_type.verification}건` });
  }
  // persistent_work: 멈춤 후 재개율 높음
  if (tags.persistence_score >= 0.80) {
    signals.push({ label: 'persistent_work', evidence: `persistence=${tags.persistence_score}` });
  }
  // NOTE: sustained_focus는 spec v1.9에서 flow_zones와 함께 삭제됨.
  // 집중력 해석은 persistence_score + pause_events로 대체.

  return signals;
}

// ─── Stage 1 리포트 JSON 생성 (과정평가_prompt.md §0.3 스키마) ─────
/**
 * analyzeHandwriting() 결과를 과정평가_prompt 입력 ③의 Stage 1 리포트 스키마로 변환
 * @returns {Object} Stage 1 리포트 JSON
 */
export function buildStage1Report(strokesData, options = {}) {
  const analysis = analyzeHandwriting(strokesData, options);
  const { _internal } = analysis;
  if (!_internal) {
    // 분석 실패 (획 0개 등)
    return {
      pattern_diagnosis: { code: analysis.pattern_code, name: '분석 불가', brief: '획 데이터 부족' },
      behavior_metrics: {},
      pause_events: [],
      positive_signals: [],
      tags: { main_backtrack_type: 'none', backtrack_count_by_type: { correction: 0, rework: 0, verification: 0 }, persistence_score: 1.0, early_answer_flag: false },
      narrative_blocks: { pattern_intro: '', strengths: [], weaknesses_placeholder: null, growth_placeholder: null, verdict_placeholder: null },
      warnings: analysis.warnings,
    };
  }

  const { strokes, coord } = _internal;

  // 역행 유형 분류
  const backtrackClassification = classifyBacktrackEvents(strokes, coord.backtrack_events || []);

  // 보조 계산
  const pauseEventsRaw = computePauseEvents(strokes);
  const persistenceScore = computePersistenceScore(strokes);

  // pause_events에 영역·콘텐츠 enrichment (서버 시뮬레이션)
  const bounds = computeBounds(strokes);
  const totalStrokes = strokes.length;
  const pauseEvents = pauseEventsRaw.map(p => {
    const content = resolveCoordContent(p.location.x, p.location.y, bounds, p.stroke_index);
    return {
      ...p,
      progress_pct: +((p.stroke_index / totalStrokes) * 100).toFixed(0),
      region_label: content.region_label,
      section_label: content.section_label,
      sample_content: content.sample_content,
      is_simulated: content.is_simulated,
    };
  });

  // 역행 이벤트에도 좌표 + 콘텐츠 부착
  const backtrackEnriched = backtrackClassification.events.map(ev => {
    const fromCenter = strokeCenter(strokes[ev.from_index]);
    const toCenter = strokeCenter(strokes[ev.to_index]);
    const toContent = resolveCoordContent(toCenter.x, toCenter.y, bounds, ev.to_index);
    const fromContent = resolveCoordContent(fromCenter.x, fromCenter.y, bounds, ev.from_index);
    return {
      ...ev,
      from_location: { x: +fromCenter.x.toFixed(2), y: +fromCenter.y.toFixed(2) },
      to_location: { x: +toCenter.x.toFixed(2), y: +toCenter.y.toFixed(2) },
      progress_pct: +(ev.time_ratio * 100).toFixed(0),
      from_region: fromContent.region_label,
      to_region: toContent.region_label,
      sample_content: toContent.sample_content,
      is_simulated: true,
    };
  });
  const outlierPauses = computeOutlierPauses(strokes);
  const earlyAnswerFlag = detectEarlyAnswerFlag(strokes);

  const tags = {
    main_backtrack_type: backtrackClassification.main_type,
    backtrack_count_by_type: backtrackClassification.counts,
    backtrack_events: backtrackEnriched,  // 좌표·영역·샘플 콘텐츠 포함
    persistence_score: persistenceScore,
    early_answer_flag: earlyAnswerFlag,
  };

  const positiveSignals = detectPositiveSignals(analysis, tags)
    .slice(0, 3); // 상위 2~3개만

  // 패턴 매트릭스 조회
  const patternEntry = lookupPattern(analysis.pattern_code);

  // 총 시간 포맷
  const totalSec = Math.round(analysis.metadata.total_duration_sec);
  const totalDurationFormatted = totalSec >= 60
    ? `${Math.floor(totalSec / 60)}분 ${totalSec % 60}초`
    : `${totalSec}초`;

  // Hesitation / Sequentiality 라벨
  const hesitLabel =
    analysis.grades.hesitation === 'a' ? '강한 확신'
    : analysis.grades.hesitation === 'b' ? '자연스러운 흐름'
    : '잦은 머뭇거림';
  const seqLabel =
    analysis.grades.coord === 'a' ? '순차적 진행'
    : analysis.grades.coord === 'b' ? '보통'
    : '역행 빈번';

  // narrative_blocks — 매트릭스 strengths 코드를 문구로 확장
  const strengthsText = expandSignalLabels(patternEntry.strengths);

  return {
    metadata: analysis.metadata,
    pattern_diagnosis: {
      code: analysis.pattern_code,
      name: patternEntry.name,
      brief: patternEntry.brief,
    },
    behavior_metrics: {
      total_duration_formatted: totalDurationFormatted,
      total_duration_sec: analysis.metadata.total_duration_sec,
      stroke_count: analysis.metadata.n_strokes,
      writing_speed: analysis.raw_metrics.writing_speed,
      sequentiality: {
        score: analysis.raw_metrics.sequentiality_score,
        label: seqLabel,
      },
      hesitation: {
        total_score: analysis.normalized_scores.hesitation_score,
        label: hesitLabel,
        components: analysis.normalized_scores.hesitation_components,
      },
      backtrack_count: analysis.raw_metrics.backtrack_count,
      backtrack_ratio: analysis.raw_metrics.backtrack_ratio,
      outlier_pauses_count: outlierPauses.count,
      outlier_pauses_total_sec: outlierPauses.total_sec,
    },
    pause_events: pauseEvents,
    positive_signals: positiveSignals,
    tags,
    narrative_blocks: {
      pattern_intro: `학생의 풀이 과정을 데이터로 분석한 결과, 이 패턴은 '${patternEntry.name}'으로 진단됩니다.`,
      strengths: strengthsText,
      // 아래 3개는 AI(Stage 2)가 채움
      weaknesses_placeholder: null,
      growth_placeholder: null,
      verdict_placeholder: null,
    },
    grades: analysis.grades,
    warnings: analysis.warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// 좌표 → 영역 분류 + 서버 시뮬레이션 콘텐츠 조회
// (실제 서비스에서는 이 부분을 서버 API 호출로 교체)
// ─────────────────────────────────────────────────────────────────

/**
 * 좌표 (x, y)를 페이지 9분할 영역으로 분류
 * @returns { row: 'top'|'mid'|'bottom', col: 'left'|'center'|'right', label: '상단-좌측' }
 */
export function classifyRegion(x, y, bounds) {
  const { minX, maxX, minY, maxY } = bounds;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const nx = (x - minX) / rangeX;
  const ny = (y - minY) / rangeY;
  const col = nx < 0.33 ? 'left' : nx < 0.66 ? 'center' : 'right';
  const row = ny < 0.33 ? 'top' : ny < 0.66 ? 'mid' : 'bottom';
  const rowLabel = { top: '상단', mid: '중단', bottom: '하단' }[row];
  const colLabel = { left: '좌측', center: '중앙', right: '우측' }[col];
  return { row, col, key: `${row}-${col}`, label: `${rowLabel}-${colLabel}` };
}

/**
 * 샘플 답안 이미지 기반 시뮬레이션 콘텐츠 매핑
 * 실제 서비스: POST /api/stroke-content/resolve { x, y, strokes } → { content, confidence }
 */
const REGION_CONTENT_SAMPLES = {
  'top-left':      { label: '문제 조건 영역', samples: ['주어진 조건: 삼각형 내각의 합 = 180°', 'x + y + z = 10', 'm∠A + m∠B = 90°', '첫째 항 a = 3, 공차 d = 2'] },
  'top-center':    { label: '변수 정의·도형 영역', samples: ['x = 미지수, y = x − 2', '삼각형 ABC 스케치 (한 내각 = 150°)', 'aₙ = 2n + 1 수열 정의', '좌표축 O, x축, y축'] },
  'top-right':     { label: '공식·정리 인용 영역', samples: ['피타고라스: a² + b² = c²', 'sin²θ + cos²θ = 1', '근의 공식 x = (−b ± √(b²−4ac)) / 2a', '판별식 D = b² − 4ac'] },
  'mid-left':      { label: '방정식·주요 식 영역', samples: ['3x + 5 = 14', '2x − 7 = 5', 'x + y = 10, x − y = 4', 'y = 2x + 3'] },
  'mid-center':    { label: '연산 전개 영역', samples: ['3x = 9', '(x + 2)² = x² + 4x + 4', '6/4 = 3/2', 'x² − 5x + 6 = 0'] },
  'mid-right':     { label: '중간 결과 영역', samples: ['x = 3', 'D = 9 > 0', 'y = 2×3 + 3 = 9', 'D = 25 − 24 = 1'] },
  'bottom-left':   { label: '검산·되돌아보기 영역', samples: ['검산: 3×3 + 5 = 14 ✓', '2×3 − 7 = −1 → 재계산 필요', '대입 확인: y = 9 ✓', '조건 x > 0 만족 확인'] },
  'bottom-center': { label: '최종 답안 영역', samples: ['∴ x = 3', '∴ 넓이 = 24 cm²', 'x = 2, y = 8', '∴ n = 5'] },
  'bottom-right':  { label: '답 확인·단위 정리', samples: ['∴ 12 cm', '[ 답: 2 ]', 'x = ±√2', '답: 3개 (정수 조건)'] },
};

/**
 * 서버 API 시뮬레이션: 좌표 → 예상 필기 내용
 * ⚠️ 개발 영역: 실제 서비스에서는 이 함수를 서버 API 호출로 교체
 */
export function resolveCoordContent(x, y, bounds, seed = 0) {
  const region = classifyRegion(x, y, bounds);
  const regionData = REGION_CONTENT_SAMPLES[region.key] || { label: '기타', samples: ['필기 내용 식별 불가'] };
  // 좌표값을 seed로 사용해 동일 좌표는 항상 같은 샘플 반환
  const pickIndex = Math.abs(Math.floor((x + y) * 3 + seed)) % regionData.samples.length;
  return {
    region_label: region.label,
    section_label: regionData.label,
    sample_content: regionData.samples[pickIndex],
    is_simulated: true,                // ⚠️ 서버 시뮬레이션 플래그
    api_hint: 'POST /api/stroke-content/resolve { x, y, strokes }', // 실제 서비스 API 힌트
  };
}

/**
 * stroke 배열에서 페이지 bounds 계산
 */
export function computeBounds(strokes) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const p of (s.points || [])) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return { minX, maxX, minY, maxY };
}

// ─────────────────────────────────────────────────────────────────
// 리포트 5섹션 생성 (등급 매핑 총평 / 이런 점이 좋아요 / 조금만 더 /
//                    함께 성장해요 / 병목 구간 진단)
// ─────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

function fmtMs(ms) {
  return `${(ms / 1000).toFixed(1)}초`;
}

/**
 * "조금만 더 노력해볼까요" fallback — 축 등급 기반 규칙
 */
function buildWeaknessFallback(grades, rawMetrics, tags) {
  const items = [];
  if (grades.time === 'c') {
    items.push('풀이 시간이 다소 길었어요. 핵심 개념을 먼저 정리하면 결정 시간이 짧아지고 속도가 자연스럽게 붙을 거예요.');
  }
  if (grades.coord === 'c' && tags.main_backtrack_type !== 'verification') {
    items.push('풀이 순서가 여러 번 흐트러진 흔적이 보여요. 전체 구조를 먼저 구상한 뒤 위에서 아래로 차근차근 써 보는 연습이 도움이 됩니다.');
  }
  if (grades.hesitation === 'c') {
    items.push('머뭇거림이 잦았어요. 자신 있는 부분부터 먼저 적고 어려운 구간은 따로 표시해두면 흐름이 부드러워져요.');
  }
  if (rawMetrics.revisit_density >= 0.15) {
    items.push('같은 자리를 여러 번 덧쓴 흔적이 보여요. 한 번에 정리해서 쓰는 훈련이 필요해요.');
  }
  if (tags.early_answer_flag) {
    items.push('답을 먼저 쓰고 풀이를 나중에 채운 흔적이 있어요. 풀이 과정을 먼저 만들고 마지막에 답을 정리하는 습관을 들여보세요.');
  }
  if (items.length === 0) {
    items.push('전반적으로 양호한 풀이였습니다. 개별 문항의 논리 단계를 조금 더 촘촘히 전개하면 완성도가 한층 올라갈 거예요.');
  }
  return items;
}

/**
 * "함께 성장해요" fallback — 축 등급 기반 규칙
 */
function buildGrowthFallback(grades, tags) {
  const items = [];
  if (grades.time === 'a' && grades.hesitation !== 'a') {
    items.push('빠른 실행력이 강점입니다. 여기에 결정 전 1~2초 점검을 더하면 완성도가 급상승합니다.');
  }
  if (grades.coord === 'c' && tags.main_backtrack_type === 'verification') {
    items.push('검산 습관이 자리잡혀 있어요. 풀이 초반부터 단계를 명확히 설계하면 돌아갈 횟수가 줄고 효율이 올라갑니다.');
  }
  if (tags.persistence_score >= 0.80) {
    items.push('멈춤이 있어도 포기하지 않고 이어간 끈기가 돋보여요. 이 강점을 유지하며 기본기 복습을 병행해보세요.');
  }
  if (grades.time === 'c' && grades.coord === 'a') {
    items.push('속도는 천천히라도 순차적 풀이 습관이 잘 잡혀 있어요. 유형별 표준 풀이 흐름을 암기해두면 속도도 따라올 거예요.');
  }
  if (items.length === 0) {
    items.push('현재 강점을 살려 다음 단계로 나아가 보세요. 유사 유형을 반복해서 풀면 패턴이 몸에 익어 실력이 자연스럽게 성장합니다.');
  }
  return items;
}

/**
 * "병목 구간 진단" — pause_events + backtrack + 좌표 기반 자동
 */
function buildBottleneckSection(stage1) {
  const items = [];
  const pauses = stage1.pause_events || [];
  const tags = stage1.tags || {};

  // 1. 최장 멈춤 상위 3건 — 좌표 + 영역 + 샘플 콘텐츠 포함
  const topPauses = [...pauses].sort((a, b) => b.duration_sec - a.duration_sec).slice(0, 3);
  if (topPauses.length > 0) {
    const pauseItems = topPauses.map(p => ({
      main: `${p.time_formatted} · ${p.duration_sec.toFixed(1)}초 ${p.severity === 'major' ? '(주요 정지)' : '(짧은 머뭇거림)'}`,
      sub: `#${p.stroke_index}획 · 풀이 ${p.progress_pct}% 시점 · ${p.region_label} (${p.section_label})`,
      content: p.sample_content,
      coord: `(${p.location.x}, ${p.location.y})`,
      simulated: p.is_simulated,
    }));
    items.push({ title: '주요 멈춤 지점', detailed: pauseItems });
  }

  // 2. 역행 유형별 분포 + 개별 이벤트
  const counts = tags.backtrack_count_by_type || {};
  const totalBack = (counts.correction || 0) + (counts.rework || 0) + (counts.verification || 0);
  if (totalBack > 0) {
    const typeLabel = {
      verification: '후반 검산형 역행 (긍정 신호)',
      correction: '즉시 수정형 역행',
      rework: '전면 재작성형 역행',
    };
    const summary = [];
    if (counts.verification > 0) summary.push(`• ${typeLabel.verification}: ${counts.verification}건`);
    if (counts.correction > 0) summary.push(`• ${typeLabel.correction}: ${counts.correction}건`);
    if (counts.rework > 0) summary.push(`• ${typeLabel.rework}: ${counts.rework}건 — 방향 재설정 구간에 집중된 어려움 가능성`);

    const events = (tags.backtrack_events || []).slice(0, 5);
    const eventDetails = events.map(ev => ({
      main: `${ev.btype === 'verification' ? '✓ 검산형' : ev.btype === 'correction' ? '✎ 수정형' : '↻ 재작성형'} · 획 #${ev.to_index} · 풀이 ${ev.progress_pct}% 시점`,
      sub: `${ev.from_region} → ${ev.to_region} 이동`,
      content: ev.sample_content,
      coord: `→ (${ev.to_location.x}, ${ev.to_location.y})`,
      simulated: ev.is_simulated,
    }));

    items.push({
      title: '역행 패턴 분포',
      lines: summary,
      detailed: eventDetails,
    });
  }

  // 3. 답 먼저 쓰기 플래그
  if (tags.early_answer_flag) {
    items.push({
      title: '답 먼저 쓰기 감지',
      lines: [
        '• 초반부터 페이지 하단에 획이 집중되었습니다.',
        '• 풀이 과정 없이 결론부터 적은 경향이 있어 논리 흐름 확인이 필요합니다.',
      ],
    });
  }

  // 4. 끈기 지수
  if (tags.persistence_score != null && tags.persistence_score < 0.60) {
    items.push({
      title: '끈기 지수',
      lines: [`• 긴 멈춤 이후 풀이를 이어간 비율이 낮습니다 (persistence=${tags.persistence_score}). 집중 유지 환경 점검이 도움될 수 있어요.`],
    });
  }

  // 5. 자리비움
  if (stage1.behavior_metrics?.outlier_pauses_count >= 3) {
    items.push({
      title: '장시간 중단',
      lines: [`• 30초 이상 중단이 ${stage1.behavior_metrics.outlier_pauses_count}회 발생했어요 (총 ${stage1.behavior_metrics.outlier_pauses_total_sec}초). 한 번에 몰입할 수 있는 환경을 마련해 보세요.`],
    });
  }

  if (items.length === 0) {
    items.push({
      title: '진단 결과',
      lines: ['• 특이 병목 없이 일관된 흐름으로 풀이를 전개했습니다.'],
    });
  }

  return items;
}

/**
 * 메트릭스 코드 라벨 생성 (예: "Time-c, Coord-a, Hesit-a")
 */
function buildMetricsCode(grades) {
  return `Time-${grades.time}, Coord-${grades.coord}, Hesit-${grades.hesitation}`;
}

/**
 * 자연어 병목 서술 생성 — pause_events 상위 1건에 대한 해설
 * 좌표에 실제 작성된 학생 답안 내용을 직접 인용
 */
function buildBottleneckNarrative(pause, stage1) {
  if (!pause) return null;
  const dur = pause.duration_sec.toFixed(0);
  const pct = pause.progress_pct;
  const content = pause.sample_content;
  const section = pause.section_label;
  const time = pause.time_formatted;

  // 구간별 인지 부담 템플릿 (작성 중이던 내용의 성격을 설명)
  const sectionHint = {
    '방정식·주요 식 영역': '미지수 관계를 정리하고 식을 세우는 단계로, 조건을 수식으로 변환해야 하는 인지 부담이 큰 지점',
    '연산 전개 영역': '식을 전개하거나 계산하는 단계로, 연산 정확성 유지가 필요한 지점',
    '중간 결과 영역': '중간 결과를 조건에 대입·검토하는 단계로, 해석 실수가 발생하기 쉬운 지점',
    '검산·되돌아보기 영역': '이미 구한 결과를 원 조건과 맞춰보는 단계로, 꼼꼼한 검증이 필요한 지점',
    '최종 답안 영역': '최종 결론을 정리하는 단계로, 답의 형식·단위 정확성이 요구되는 지점',
    '문제 조건 영역': '문제에서 필요한 조건을 읽고 정리하는 단계로, 정보 추출 판단이 필요한 지점',
    '변수 정의·도형 영역': '변수를 정의하거나 도형을 그리는 단계로, 추상화·시각화가 동시에 이뤄지는 지점',
    '공식·정리 인용 영역': '적절한 공식을 선택하는 단계로, 공식과 적용 맥락을 연결해야 하는 지점',
    '답 확인·단위 정리': '답의 단위와 타당성을 확인하는 단계로, 마무리 정확성이 요구되는 지점',
  }[section] || '추가 사고 시간이 필요했던 지점';

  return `풀이 ${pct}% 시점(${time})에서 ${dur}초간 필기가 중단되었습니다. 해당 좌표의 학생 답안에는 **"${content}"**가 작성되어 있었으며, 이는 ${sectionHint}입니다. 이 구간에서 주저함이 발생한 것으로 보아, 유사한 수식 처리 패턴을 사전에 정리해두는 연습이 도움이 될 수 있습니다.`;
}

/**
 * 리포트 섹션 전체 생성 (사용자 예시 포맷)
 *
 * @param {Object} stage1 - buildStage1Report()의 결과물
 * @param {Object} options
 *   - studentGrade, scaleType
 *   - gradeLabel: "Good (B)" 같은 AI 채점 결과 라벨 (있으면 verdict에 삽입)
 *   - rawStrokes: 평균 필압 계산용 (stage1이 이미 내부에서 처리했다면 생략 가능)
 * @returns 구조화된 리포트
 */
export function buildReportSections(stage1, options = {}) {
  const { studentGrade = null, scaleType = 5, gradeLabel = null, rawStrokes = null } = options;

  if (!stage1 || !stage1.pattern_diagnosis) {
    return {
      header: {},
      patternDiagnosis: [],
      verdict: [],
      strengths: [],
      weaknesses: [],
      growth: [],
      contentAnalysis: { behaviorMetrics: [], bottleneck: [] },
      dataSource: 'none',
    };
  }

  const patternId = stage1.pattern_diagnosis.code;
  const patternEntry = lookupPattern(patternId);
  const bucket = studentGrade ? gradeToBucket(scaleType, studentGrade) : null;
  const matrixFeedback = bucket ? lookupPatternFeedback(patternId, bucket) : null;
  const grades = stage1.grades || {};
  const metricsCode = buildMetricsCode(grades);

  // [진단된 학습 행동 패턴]
  const patternDiagnosis = [
    `${patternEntry.name} (Metrics: ${metricsCode})`,
  ];

  // [등급 매핑 총평]
  const verdict = [];
  const introLine = `학생의 풀이 과정을 데이터로 분석한 결과, 이 패턴은 '${patternEntry.name}'으로 진단됩니다.`;
  if (matrixFeedback) {
    const tail = gradeLabel
      ? ` 이러한 분석을 바탕으로 최종 등급 ${gradeLabel} 를 획득하였습니다.`
      : '';
    verdict.push(`${introLine} ${matrixFeedback}${tail}`);
  } else {
    verdict.push(`${introLine} (매트릭스에 "${patternId.toUpperCase()} × ${bucket || '?'}" 조합 문구 미정의 — 데이터 보강 시 자동 반영)`);
  }

  // [이런 점이 좋아요]
  const strengths = [];
  const matrixStrengthCodes = patternEntry.strengths || [];
  matrixStrengthCodes.forEach(code => {
    const text = POSITIVE_SIGNAL_TEMPLATES[code];
    if (text) strengths.push(text);
  });
  (stage1.positive_signals || []).forEach(sig => {
    const text = POSITIVE_SIGNAL_TEMPLATES[sig.label];
    if (text && !strengths.includes(text)) strengths.push(text);
  });
  if (strengths.length === 0) {
    strengths.push('끝까지 풀이를 이어간 참여 자체가 훌륭한 출발점이에요.');
  }

  // [조금만 더 노력해볼까요] — 최장 pause 좌표의 실제 학생 답안 내용 인용
  let weaknesses;
  const topPause = (stage1.pause_events || []).slice().sort((a, b) => b.duration_sec - a.duration_sec)[0];
  if (topPause && topPause.duration_sec >= 2.0) {
    const dur = topPause.duration_sec.toFixed(0);
    const pct = topPause.progress_pct;
    const content = topPause.sample_content;
    weaknesses = [
      `풀이 ${pct}% 시점에서 약 ${dur}초간 긴 멈춤이 관찰되었습니다. 이때 학생이 작성하던 내용은 **"${content}"**였으며, 이 단계를 넘어가는 과정에서 약간의 주저함이 보였습니다. 이 부분을 좀 더 능숙하게 처리하면 풀이 흐름이 한결 매끄러워질 거예요.`,
    ];
  } else {
    weaknesses = buildWeaknessFallback(grades, stage1.behavior_metrics || {}, stage1.tags || {});
  }

  // [함께 성장해요]
  const growth = buildGrowthFallback(grades, stage1.tags || {});

  // ── [내용분석] ──────────────────────────────────────
  // 행동 지표 분석
  const behaviorMetrics = [];
  const durFormatted = stage1.behavior_metrics?.total_duration_formatted || '-';
  behaviorMetrics.push(`평균 필기 시간 : ${durFormatted} (교과 평균 대비 보통)`);

  // 평균 필압 (JSON의 f 값 평균 — 참고용)
  if (rawStrokes) {
    const avgP = avgPressure(rawStrokes);
    if (avgP > 0) {
      behaviorMetrics.push(`평균 필압 : ${avgP.toFixed(2)} (${pressureLabel(avgP)})`);
    }
  }
  behaviorMetrics.push(`Hesitation 지수 : ${(stage1.behavior_metrics?.hesitation?.total_score ?? 0).toFixed(2)} (${stage1.behavior_metrics?.hesitation?.label || '-'})`);

  // 이상 패턴
  const majorPauses = (stage1.pause_events || []).filter(p => p.severity === 'major');
  const outlierCount = stage1.behavior_metrics?.outlier_pauses_count || 0;
  const anomalyParts = [];
  if (majorPauses.length > 0) anomalyParts.push(`${majorPauses.length > 1 ? '다수' : '중반부'} 장시간 정지 ${majorPauses.length}건`);
  if (outlierCount > 0) anomalyParts.push(`30초+ 자리비움 ${outlierCount}회`);
  if (stage1.tags?.main_backtrack_type === 'rework') anomalyParts.push('전면 재작성형 역행 감지');
  if (stage1.tags?.early_answer_flag) anomalyParts.push('답 먼저 쓰기 감지');
  behaviorMetrics.push(`이상 패턴 : ${anomalyParts.length > 0 ? anomalyParts.join(', ') : '특이사항 없음'}`);

  // 병목 구간 진단 (자연어 서술)
  const bottleneckLines = [];
  const narrative = buildBottleneckNarrative(topPause, stage1);
  if (narrative) bottleneckLines.push(narrative);

  // 역행 유형 기반 추가 해설
  const counts = stage1.tags?.backtrack_count_by_type || {};
  if ((counts.rework || 0) >= 2) {
    const reworkEvent = (stage1.tags?.backtrack_events || []).find(e => e.btype === 'rework');
    if (reworkEvent) {
      bottleneckLines.push(`풀이 중 ${counts.rework}회의 대규모 재작성이 관찰되었습니다. 학생은 **"${reworkEvent.sample_content}"** 부분에서 방향을 전환한 것으로 보이며, 첫 시도 전에 풀이 전략을 한 번 더 점검하는 습관이 도움이 될 수 있습니다.`);
    }
  }
  if (counts.verification >= 1) {
    bottleneckLines.push(`마무리 단계에서 ${counts.verification}회의 검산 역행이 관찰되어, 완성도를 높이려는 태도가 잘 드러났습니다.`);
  }
  if (bottleneckLines.length === 0) {
    bottleneckLines.push('특이 병목 구간이 감지되지 않았고 일관된 흐름으로 풀이가 전개되었습니다.');
  }

  // 데이터 출처 요약
  let dataSource = 'fallback';
  if (matrixFeedback) dataSource = matrixStrengthCodes.length > 0 ? 'matrix' : 'mixed';
  else if (matrixStrengthCodes.length > 0) dataSource = 'mixed';

  return {
    header: {
      pattern_id: patternId,
      pattern_name: patternEntry.name,
      pattern_brief: patternEntry.brief,
      grade: studentGrade,
      scale_type: scaleType,
      bucket,
      metrics_code: metricsCode,
    },
    patternDiagnosis,
    verdict,
    strengths,
    weaknesses,
    growth,
    contentAnalysis: {
      behaviorMetrics,
      bottleneck: bottleneckLines,
    },
    dataSource,
  };
}
