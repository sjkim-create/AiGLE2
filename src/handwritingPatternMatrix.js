/**
 * handwritingPatternMatrix.js
 *
 * 3축 패턴 코드(Time-Coord-Hesitation) 27개에 대한
 * 이름(name) · 요약(brief) · 강점 템플릿(strengths) · 등급별 피드백(feedback)을 정의.
 *
 * feedback 버킷 매핑:
 *   - High: 5단계 A·B / 4단계 A / 3단계 A
 *   - Med:  5단계 C / 4단계 B / 3단계 B
 *   - Low:  5단계 D·E / 4단계 C·D / 3단계 C
 *
 * null 값은 매트릭스 미정의 상태로, UI에서 fallback 규칙 템플릿으로 대체.
 *
 * 참조: handwriting_analysis_spec.md §6.2, 과정평가_prompt.md §5.2
 * 유형명·캐릭터: 「아이글 27가지 학습 행동 유형별 캐릭터」(서비스기획팀, 2026-08-26) 기준. 캐릭터는 public/images/patterns/{code}.png
 */

export const PATTERN_MATRIX = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 빠름(a) × 순차(a) — aa*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  aaa: {
    name: '거침없는 실행형',
    brief: '빠르고 순차적이며 머뭇거림 없음',
    strengths: ['consistent_flow', 'sequential_order', 'fast_execution', 'few_revisions'],
    feedback: {
      High: '머뭇거림 없이 아주 매끄럽고 빠르게 수식을 전개했어요. 완벽한 개념 이해와 강한 자신감이 느껴져요.',
      Med: '풀이 전개는 거침없고 빨랐지만, 중간 논리 과정이나 식 세우기에서 일부 틈이 있어 아쉬움이 남아요.',
      Low: '망설임 없이 빠른 속도로 풀이를 전개했지만 정답에 도달하기에는 부족함이 보여요. 익숙한 유형이라 빠르게 접근한 만큼, 조건을 한 번 더 확인하거나 연산을 차분히 점검했다면 결과가 달라졌을 거예요.',
    },
  },
  aab: {
    name: '안정적 속공형',
    brief: '빠르고 순차적이지만 약간의 머뭇거림',
    strengths: ['sequential_order', 'fast_execution'],
    feedback: {
      High: '빠른 속도로 위에서 아래까지 순차적으로 풀이를 정돈하며 뛰어난 직관력을 보여주었어요. 자연스러운 흐름으로 전개를 안정적으로 유지했어요.',
      Med: '직관적인 풀이 속도는 좋았지만, 나중에 식을 끼워 맞추려다 보니 논리 전개 과정이 매끄럽지 못한 부분이 있어요.',
      Low: '답을 먼저 적고 중간 과정을 나중에 채워 넣는 방식이라 논리 전개가 자연스럽게 이어지지 못한 점이 아쉬워요. 처음부터 순서대로 풀이를 정리하는 습관을 들이면 실력을 제대로 발휘할 수 있을 거예요.',
    },
  },
  aac: {
    name: '민첩 정돈 불안형',
    brief: '빠르고 순차적이나 잦은 머뭇거림',
    strengths: ['sequential_order', 'fast_execution'],
    feedback: {
      High: '빠른 속도로 위에서 아래까지 순차적으로 풀이를 완성한 성실함이 돋보여요. 구간에 따라 잠깐 머뭇거리기도 했지만 끝까지 차분하게 풀이를 이어간 끈기가 훌륭해요.',
      Med: '풀이과정을 차례대로 잘 적었지만, 특정 개념에서 오래 고민하며 확신을 갖지 못해 일부 아쉬운 부분이 남아요.',
      Low: '줄을 맞춰 성실히 풀어보려 했지만 긴 시간 멈춰 있었고, 확신이 부족한 상태에서 개념을 적용해 아쉬움이 남아요. 관련 개념을 한 번 더 정리하면 비슷한 문제에서 자신감을 갖고 풀 수 있을 거예요.',
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 빠름(a) × 보통(b) — ab*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  aba: {
    name: '빠른 보완 확신형',
    brief: '빠르고 되돌아가지만 단단하게 마무리',
    strengths: ['fast_execution', 'self_correction', 'few_revisions'],
    feedback: { High: null, Med: null, Low: null },
  },
  abb: {
    name: '민첩 자기교정형',
    brief: '빠르고 되돌아가며 자연스러운 수정',
    strengths: ['fast_execution', 'self_correction'],
    feedback: { High: null, Med: null, Low: null },
  },
  abc: {
    name: '불안한 급행 보완형',
    brief: '빠르나 약간의 수정과 잦은 머뭇거림',
    strengths: ['fast_execution'],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 빠름(a) × 역행(c) — ac*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  aca: {
    name: '산만한 확신형',
    brief: '빠르게 풀며 크게 되돌아가지만 확신 있음',
    strengths: ['fast_execution', 'self_correction'],
    feedback: { High: null, Med: null, Low: null },
  },
  acb: {
    name: '흩어진 속도형',
    brief: '빠르게 풀며 대폭 수정, 자연스러운 흐름',
    strengths: ['fast_execution', 'self_correction'],
    feedback: { High: null, Med: null, Low: null },
  },
  acc: {
    name: '성급한 직관/찍기형',
    brief: '빠르지만 방향성이 흐트러지고 머뭇거림',
    strengths: ['fast_execution'],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 보통(b) × 순차(a) — ba*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  baa: {
    name: '신중한 절차적 확신형',
    brief: '안정적 속도로 순차적이며 확신 있음',
    strengths: ['sequential_order', 'consistent_flow', 'few_revisions'],
    feedback: {
      High: null,
      Med: '순서는 잘 지켰지만 머뭇거림이 관찰된 구간에서 확신이 부족했던 점이 아쉬움으로 남아요.',
      Low: null,
    },
  },
  bab: {
    name: '표준 정석형',
    brief: '평균적 속도로 순차적이며 자연스러운 흐름',
    strengths: ['sequential_order'],
    feedback: { High: null, Med: null, Low: null },
  },
  bac: {
    name: '정석 속 불안형',
    brief: '안정적이나 순차적 진행 중 머뭇거림',
    strengths: ['sequential_order'],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 보통(b) × 보통(b) — bb*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bba: {
    name: '점검형 확신 풀이',
    brief: '차분한 속도로 필요한 부분 확실히 수정',
    strengths: ['self_correction', 'consistent_flow'],
    feedback: { High: null, Med: null, Low: null },
  },
  bbb: {
    name: '일반 재정비형',
    brief: '평균적 속도·순서·확신도, 무난한 흐름',
    strengths: ['consistent_flow'],
    feedback: { High: null, Med: null, Low: null },
  },
  bbc: {
    name: '불안한 재정비형',
    brief: '차분히 진행하며 위쪽으로 돌아가 보완',
    strengths: ['self_correction'],
    feedback: {
      High: '차분한 페이스로 풀이를 이어가다 윗부분으로 돌아가 보완하려는 태도가 돋보여요. 일부 머뭇거리기도 했지만 끝까지 재정비하며 완성한 끈기가 훌륭해요.',
      Med: '안정적인 풀이였지만 핵심 단계에서 한 번 더 점검했더라면 하는 아쉬움이 있어요.',
      Low: '절차를 잘 지키며 풀이를 이어갔지만 결과까지 도달하기에는 부족함이 보여요. 특정 개념을 한 번 더 복습하면 같은 페이스로 더 또렷한 풀이를 완성할 수 있을 거예요.',
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 보통(b) × 역행(c) — bc*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bca: {
    name: '능동적 탐색 확신형', // pptx 표기는 「능동적 탐색 확신」— 접미 '형' 누락으로 보고 보정
    brief: '여러 방향을 탐색하며 단호한 흐름으로 해답 도달',
    strengths: ['self_correction'],
    feedback: {
      High: '차분한 페이스로 여러 방향을 능동적으로 탐색하며 단호한 흐름으로 올바른 길을 찾아낸 태도가 훌륭해요.',
      Med: '순서는 잘 지켰지만 특정 단계에서 확신이 약해지며 머뭇거림이 관찰된 점이 아쉬워요.',
      Low: '절차를 지키려는 태도는 훌륭하지만 확신이 부족한 흔적이 보여요. 핵심 개념을 한 번 더 정리하고 간단한 문제부터 자신감을 쌓아가면 좋은 결과로 이어질 거예요.',
    },
  },
  bcb: {
    name: '시행착오 탐색형',
    brief: '여러 방향을 시도하며 탐색적으로 해답 도출',
    strengths: ['self_correction'],
    feedback: {
      High: '차분한 페이스로 여러 방향을 시도하며 자연스러운 흐름으로 올바른 해답을 찾아가는 탐색 능력이 돋보여요.',
      Med: '보완 시도는 확신이 있었지만, 되돌아가는 과정에서 논리가 살짝 어긋난 아쉬움이 있어요.',
      Low: '되돌아가서 보완하려는 의지는 좋았지만 근본적인 방향이 다시 살펴볼 여지가 있어요. 처음부터 풀이를 차근차근 정리해 보면 훨씬 또렷한 결과가 나올 거예요.',
    },
  },
  bcc: {
    name: '불안한 시행착오형',
    brief: '방향이 흐트러지고 머뭇거림이 잦음',
    strengths: [],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 느림(c) × 순차(a) — ca*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  caa: {
    name: '신중한 완성형',
    brief: '천천히 진행하지만 순차적이며 망설임 없음',
    strengths: ['sequential_order', 'few_revisions'],
    feedback: { High: null, Med: null, Low: null },
  },
  cab: {
    name: '신중한 재구조화형', // pptx 표기는 「신중한 재구조화」— 접미 '형' 누락으로 보고 보정
    brief: '천천히 진행하지만 순차적이며 약간의 머뭇거림',
    strengths: ['sequential_order'],
    feedback: { High: null, Med: null, Low: null },
  },
  cac: {
    name: '숙고 정돈 불안형',
    brief: '느리고 순차적이나 잦은 머뭇거림',
    strengths: ['sequential_order'],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 느림(c) × 보통(b) — cb*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cba: {
    name: '심사숙고 확신형',
    brief: '느리게 진행하며 되돌아가지만 단단히 마무리',
    strengths: ['self_correction'],
    feedback: { High: null, Med: null, Low: null },
  },
  cbb: {
    name: '신중한 계획형',
    brief: '느리게 진행하며 자연스럽게 수정',
    strengths: ['self_correction'],
    feedback: { High: null, Med: null, Low: null },
  },
  cbc: {
    name: '불안한 재구조화형',
    brief: '느리고 머뭇거리지만 신중히 진행',
    strengths: [],
    feedback: { High: null, Med: null, Low: null },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 느림(c) × 역행(c) — cc*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cca: {
    name: '혼란 속 확신형',
    brief: '긴 고민 끝에 여러 방향을 시도하며 단호히 해답 도달',
    strengths: ['self_correction'],
    feedback: {
      High: '긴 고민 끝에 여러 방향을 시도하며 단호한 흐름으로 확신 있게 올바른 해답을 찾아낸 태도가 훌륭해요.',
      Med: '보완 시도는 좋았지만 흐름과 논리 모두 다소 흔들리며 완성도에 아쉬움이 남아요.',
      Low: '신중하게 보완하려 했지만 확신이 부족한 흔적이 보여요. 기본 개념부터 차근차근 익히며 작은 성공을 쌓아가면 자신감이 확실히 올라올 거예요.',
    },
  },
  ccb: {
    name: '혼란 탐색형',
    brief: '긴 사고 시간 속 여러 방향을 탐색하며 해답 도출',
    strengths: ['self_correction'],
    feedback: {
      High: '긴 사고 시간을 거치며 여러 방향을 탐색한 끝에 자연스러운 흐름으로 올바른 길을 찾아낸 태도가 훌륭해요.',
      Med: '신중한 탐색은 좋았지만 시도 흔적이 많아 정돈된 풀이로 이어지지 못한 아쉬움이 있어요.',
      Low: '확신 있게 여러 방향을 시도했지만 정돈된 풀이로 이어지지 못한 점이 아쉬워요. 시도 전에 한 가지 방향을 먼저 결정하는 연습을 하면 좋은 결과가 나올 거예요.',
    },
  },
  ccc: {
    name: '신중한 탐색형',
    brief: '긴 사고 시간에 여러 방향 탐색 + 머뭇거림',
    strengths: [],
    feedback: {
      High: '긴 사고 시간을 거치며 여러 방향을 탐색한 끈기가 돋보여요. 일부 머뭇거리기도 했지만 끝까지 해답을 찾으려 한 태도가 훌륭해요.',
      Med: '탐색 시도는 많았지만 사고 시간이 길어지고 풀이가 분산된 아쉬움이 있어요.',
      Low: '오래 고민하며 여러 방향을 시도했지만 정돈된 결과로 이어지지 못한 점이 아쉬워요. 핵심 개념을 한 번 더 정리하면 고민 시간이 줄어들고 풀이가 훨씬 매끄러워질 거예요.',
    },
  },
};

/**
 * 긍정 신호 코드 → 학생용 문구 (handwriting_analysis_spec.md §11.5 기반)
 */
export const POSITIVE_SIGNAL_TEMPLATES = {
  consistent_flow: '풀이 전반에 걸쳐 흐름이 일관되게 유지되어, 안정적인 집중력을 보여주었어요.',
  sequential_order: '위에서 아래로 순차적으로 풀이를 정돈하는 체계적인 사고 습관이 잘 잡혀 있어요.',
  few_revisions: '한 번 쓴 내용을 거의 고치지 않고 깔끔하게 풀이를 이어갔어요. 생각이 잘 정리되어 있다는 신호예요.',
  completed_work: '끝까지 풀이를 성실하게 진행한 태도가 훌륭해요.',
  fast_execution: '거침없이 빠른 속도로 풀이를 전개한 실행력이 돋보여요.',
  self_correction: '스스로 점검하며 필요한 부분을 보완해낸 자기 조정 능력이 뛰어나요.',
  verification_habit: '풀이 마무리 단계에서 결과를 다시 한 번 확인하는 검산 습관이 자리잡혀 있어요.',
  persistent_work: '중간에 멈춤이 있어도 끈기 있게 다시 풀이를 이어간 꾸준함이 돋보여요.',
};

/**
 * 학생 등급을 feedback 버킷(High/Med/Low)으로 매핑
 *
 * @param {number|string} scaleType - 3, 4, 5 or "3단계", "4단계", "5단계"
 * @param {string} grade - A, B, C, D, E
 * @returns {'High' | 'Med' | 'Low'}
 */
export function gradeToBucket(scaleType, grade) {
  const scaleNum = typeof scaleType === 'number'
    ? scaleType
    : parseInt(String(scaleType).replace(/[^0-9]/g, ''), 10);
  const g = String(grade || '').toUpperCase();

  if (scaleNum === 3) {
    if (g === 'A') return 'High';
    if (g === 'B') return 'Med';
    return 'Low';
  }
  if (scaleNum === 4) {
    if (g === 'A') return 'High';
    if (g === 'B') return 'Med';
    return 'Low'; // C, D
  }
  // 5단계 (default)
  if (g === 'A' || g === 'B') return 'High';
  if (g === 'C') return 'Med';
  return 'Low'; // D, E
}

/**
 * 패턴 코드 → 매트릭스 항목 조회 (기본값 폴백 포함)
 */
export function lookupPattern(code) {
  return (
    PATTERN_MATRIX[code] || {
      name: '미정의 패턴',
      brief: `패턴 코드 ${String(code || '').toUpperCase()} — 매트릭스 미정의`,
      strengths: [],
      feedback: { High: null, Med: null, Low: null },
    }
  );
}

/**
 * 패턴 × 등급 버킷에 해당하는 feedback 문구 조회.
 * 매트릭스에 문구가 없으면 null 반환 (fallback 생성 필요)
 */
export function lookupPatternFeedback(code, bucket) {
  const entry = lookupPattern(code);
  return entry.feedback?.[bucket] ?? null;
}

/**
 * 긍정 신호 코드 목록 → 학생용 문구 배열
 */
export function expandSignalLabels(labels) {
  return (labels || []).map(l => POSITIVE_SIGNAL_TEMPLATES[l] || l);
}
