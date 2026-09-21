/**
 * gradingShared.js
 * 채점 기준(자율평가 단일 체제) 공유 모델 — TSK-13(직접 입력 2)·TSK-12(파일 업로드)에서 공통 사용.
 * 화면 렌더는 각 화면이 담당하고, 본 모듈은 상수·순수 헬퍼만 제공한다.
 * [v3.74] 자동평가 폐기 — AUTO_*·RUBRIC_CATEGORIES·RUBRIC_TEMPLATE 제거. 평가 기준은 자율평가 루브릭 하나로 운영한다.
 */

// 평가 단계(등급 체계)별 루브릭 레벨 — DSH-02 등급명·색상과 정합
export const LEVEL_META = {
  '매우 우수': { color: '#10B981', bg: '#D1FAE5', desc: '성취기준을 탁월하게 달성하며, 논리·근거·표현이 모두 빼어나다.' },
  '우수':     { color: '#2A75F3', bg: '#EFF6FF', desc: '성취기준을 충실히 달성하며, 논리적 일관성과 근거가 분명하다.' },
  '보통':     { color: '#94A3B8', bg: '#F1F5F9', desc: '성취기준의 주요 요소를 충족하나, 일부 논리 비약 또는 근거 부족이 관찰된다.' },
  '노력':     { color: '#F59E0B', bg: '#FEF3C7', desc: '성취기준 일부만 충족하며, 핵심 개념의 이해 또는 표현에 어려움이 있다.' },
  '매우 노력': { color: '#EF4444', bg: '#FEE2E2', desc: '문항 요구와 답안 내용이 부합하지 않거나 이해가 매우 미흡하다.' },
};

// 교과 → 과목(세부 과목) 옵션 (2022 개정 교육과정 예시)
export const SUBJECTS = {
  '국어': ['공통국어1', '공통국어2', '화법과 언어', '독서와 작문', '문학'],
  '수학': ['공통수학1', '공통수학2', '대수', '미적분Ⅰ', '확률과 통계'],
  '영어': ['공통영어1', '공통영어2', '영어Ⅰ', '영어Ⅱ', '영어 독해와 작문'],
  '사회': ['통합사회1', '통합사회2', '한국사1', '한국사2', '세계시민과 지리'],
  '과학': ['통합과학1', '통합과학2', '물리학', '화학', '생명과학'],
  '도덕': ['현대사회와 윤리', '윤리와 사상', '인문학과 윤리'],
};
export const subjectsOf = (subject) => SUBJECTS[subject] || [];

// 교과별 핵심역량·핵심평가영역 프레임워크 (2022 개정 교육과정 예시)
// — 교과 선택에 따라 핵심역량 chips·핵심평가영역 chips가 동적으로 노출된다.
export const SUBJECT_FRAMEWORK = {
  '국어': {
    competencies: ['비판적·창의적 사고 역량', '자기 성찰·계발 역량', '의사소통 역량', '공동체·대인관계 역량', '정보 처리 역량', '문화 향유 역량'],
    areas: ['듣기·말하기', '읽기', '쓰기', '문법', '문학', '매체'],
  },
  '수학': {
    competencies: ['문제 해결', '추론', '의사소통', '연결', '정보 처리', '태도 및 실천'],
    areas: ['수와 연산', '변화와 관계', '도형과 측정', '자료와 가능성'],
  },
  '영어': {
    competencies: ['영어 의사소통 역량', '자기관리 역량', '공동체 역량', '지식정보처리 역량'],
    areas: ['듣기', '말하기', '읽기', '쓰기'],
  },
  '사회': {
    competencies: ['창의적 사고력', '비판적 사고력', '문제 해결력 및 의사 결정력', '의사소통 및 협업 능력', '정보 활용 능력'],
    areas: ['지리 인식', '일반 사회', '역사 인식', '윤리적 탐구'],
  },
  '과학': {
    competencies: ['과학적 사고력', '과학적 탐구 능력', '과학적 문제 해결력', '과학적 의사소통 능력', '과학적 참여와 평생학습 능력'],
    areas: ['운동과 에너지', '물질', '생명', '지구와 우주'],
  },
  '도덕': {
    competencies: ['자기 존중 및 관리 능력', '도덕적 사고 능력', '도덕적 대인관계 능력', '도덕적 정서 능력', '도덕적 공동체 의식'],
    areas: ['자신과의 관계', '타인과의 관계', '사회·공동체와의 관계', '자연·초월과의 관계'],
  },
};
export const competenciesOf = (subject) => (SUBJECT_FRAMEWORK[subject]?.competencies) || [];
export const evalAreasOf = (subject) => (SUBJECT_FRAMEWORK[subject]?.areas) || [];

// 학교급별 학년 편제(학년군)
export const GRADE_BANDS = {
  '초등학교': ['1~2학년', '3~4학년', '5~6학년'],
  '중학교': ['1~3학년'],
  '고등학교': ['1~3학년', '2~3학년'],
};
export const gradesOf = (schoolLevel) => GRADE_BANDS[schoolLevel] || ['1~3학년'];

// 성취기준 텍스트에서 코드([10국어1-01-01]) 추출
export const stdCode = (text) => {
  const m = (text || '').match(/\[([^\]]+)\]/);
  return m ? m[1] : '성취기준';
};

// 등급 이름 (3/4/5 단계 체계) — v3.53 4단계 갱신 (매우 우수 복귀)
export const GRADE_NAMES = {
  3: ['우수', '보통', '노력'],
  4: ['매우 우수', '우수', '보통', '노력'],
  5: ['매우 우수', '우수', '보통', '노력', '매우 노력'],
};

// [v3.53] % 기반 cutoff 정책 (학교 평가 관례)
//   3등급: 우수 ≥80%·보통 ≥60%·노력 ≥0%
//   4등급: 매우 우수 ≥90%·우수 ≥80%·보통 ≥60%·노력 ≥0% (v3.53 — 「매우 우수」 복귀, 「매우 노력」 폐기)
//   5등급: 매우 우수 ≥90%·우수 ≥80%·보통 ≥70%·노력 ≥60%·매우 노력 ≥0%
export const GRADE_CUTOFFS = {
  3: [{ min: 80, name: '우수' }, { min: 60, name: '보통' }, { min: 0, name: '노력' }],
  4: [{ min: 90, name: '매우 우수' }, { min: 80, name: '우수' }, { min: 60, name: '보통' }, { min: 0, name: '노력' }],
  5: [{ min: 90, name: '매우 우수' }, { min: 80, name: '우수' }, { min: 70, name: '보통' }, { min: 60, name: '노력' }, { min: 0, name: '매우 노력' }],
};

// ── 자율평가 점수 모델: 배점(M)·단계(n)·간격(d) ──────────────────────────
// 점수 행 = 배점에서 간격만큼 차감: [M, M-d, M-2d, …] (최저 등급 0점 이상)
// [v3.74] 점수 구간(배점 단계)은 채점 등급(3/4/5등급)과 무관하게 항상 3개 고정 — 배점 M → [M, M−d, M−2d]
//   채점 등급 기본값만 학교급별 (초등 3등급 / 중·고등 5등급). 舊 배점 단계 스텝퍼(2~배점+1 / 3~5)는 폐기
export const RUBRIC_LEVELS = 3;
export const defaultGradeScale = (schoolLevel) => (schoolLevel === '초등학교' ? 3 : 5);
// [v3.77] 기본 배점 없음 — 범주 배점·총 배점은 교사가 직접 입력한다. 배점을 입력하면 점수 구간 3개에 균등 분배
export const DEFAULT_MAX_POINTS = '';
export const LEVEL_WORDS = ['상', '중', '하']; // 점수 구간 3개의 수준 표기 (배점 미입력 상태에서도 평가 내용 서술에 사용)
export const maxIntervalFor = (maxPoints, levels) => {
  const M = Number(maxPoints) || 0;
  const n = Math.max(2, Number(levels) || 2);
  if (M < 2) return 1;
  return Math.max(1, Math.floor(M / (n - 1))); // 최대 간격이면 최저 등급 = 0점
};
export const defaultInterval = (maxPoints, levels) => maxIntervalFor(maxPoints, levels);
export const buildScoreRows = (maxPoints, levels, interval, prevRows = []) => {
  const M = Number(maxPoints) || 0;
  // [v3.73] 단계 수(n)는 사용자가 스텝퍼로 정한 값을 그대로 쓴다 — 배점(M)으로 clamp 하지 않는다.
  // 舊 로직은 배점을 직접 타이핑하는 도중의 빈 값·1점 같은 중간 상태에서 n을 2로 강등시켜,
  // 늘려둔 입력 구간과 거기 적어둔 평가 내용을 되돌릴 수 없게 지웠다.
  // (스피너 화살표 조작은 값이 2 미만으로 내려가는 중간 상태가 없어 이 문제가 드러나지 않았다)
  const n = Math.max(2, Number(levels) || 2);
  const d = Math.max(1, Math.min(maxIntervalFor(M, n), Number(interval) || 1));
  return Array.from({ length: n }, (_, i) => ({
    // [v3.77] 배점 미입력(빈 값·0)이면 점수 구간도 비워 둔다 — 교사가 배점을 입력하는 순간 균등 분배
    score: M > 0 ? Math.max(0, M - i * d) : '',
    desc: prevRows[i]?.desc || '',
  }));
};
export const rowsDescending = (rows) => rows.every((r, i) => i === 0 || (Number(rows[i - 1].score) || 0) > (Number(r.score) || 0));

let _uid = 1;
export const uid = (p) => `${p}-${_uid++}`;
// [v3.74] 점수 구간 3개 고정 · [v3.77] 배점 기본 빈 값 (점수 구간도 빈 값)
export const makeCriterion = () => {
  const levels = RUBRIC_LEVELS, maxPoints = DEFAULT_MAX_POINTS, interval = 1;
  return { id: uid('c'), name: '', maxPoints, levels, interval, rows: buildScoreRows(maxPoints, levels, interval) };
};

// ── [v3.74] AI 루브릭 자동 설계 (샘플 stub — 실연동 시 LLM 호출) ──────────────
// 성취기준(area)·문항 내용을 근거로 채점 기준명과 점수 구간(3개)별 평가 내용을 채운다 → 범주(채점 기준)당 평가 내용 3개.
// 교사가 이미 입력한 칸(비어있지 않은 name·desc)은 보존하고 빈 칸만 채운다.
export const AI_CRITERIA_NAMES = ['내용 이해와 적용', '논리적 구성', '표현의 정확성', '근거의 타당성', '창의적 사고'];
export const AI_QUALITIES = ['탁월하게', '충실히', '대체로', '부분적으로', '미흡하게'];
export const aiFillCriteria = (criteria, area = '평가 영역') => {
  const qualityFor = (i, n) => (n <= 1 ? AI_QUALITIES[0] : AI_QUALITIES[Math.round((i / (n - 1)) * (AI_QUALITIES.length - 1))]);
  let filled = 0, skipped = 0;
  const next = criteria.map((c, ci) => {
    const aiName = AI_CRITERIA_NAMES[ci % AI_CRITERIA_NAMES.length];
    const name = (c.name && c.name.trim()) ? (skipped++, c.name) : (filled++, aiName);
    const n = c.rows.length;
    const rows = c.rows.map((r, ri) => {
      if (r.desc && r.desc.trim()) { skipped++; return r; }
      filled++;
      return { ...r, desc: `${area} 영역에서 '${name}'을(를) ${qualityFor(ri, n)} 충족함. (${LEVEL_WORDS[ri] || ''} 수준)` };
    });
    return { ...c, name, rows };
  });
  return { criteria: next, filled, skipped };
};
// 평가 기준 단계 최초 진입 시 — 문항당 범주(채점 기준) 3개 × 평가 내용 3개(점수 구간)를 설계하고 빈 칸을 모두 채운다
export const DEFAULT_CRITERIA_COUNT = 3;
export const designRubric = (area) => {
  const base = Array.from({ length: DEFAULT_CRITERIA_COUNT }, () => makeCriterion());
  return aiFillCriteria(base, area).criteria;
};
// 채점 기준에 교사·AI가 입력한 내용이 하나라도 있는지 (자동 설계 대상 판별용)
export const criteriaHaveContent = (criteria) =>
  Array.isArray(criteria) && criteria.some((c) => (c.name && c.name.trim()) || (c.rows || []).some((r) => r.desc && r.desc.trim()));

// [v3.51] 점수 → 등급 환산 — % 기반 cutoff 복귀 (학교 평가 관례 정합)
export const scoreToGrade = (score, max, scale) => {
  if (!max || max <= 0) return '-';
  const pct = (Number(score) / max) * 100;
  const band = GRADE_CUTOFFS[scale].find((b) => pct >= b.min);
  return band ? band.name : '-';
};
