// 새 과제 등록 메뉴 — 과제 목록 [+ 새 과제 등록] 패널과 등록 방식 선택 화면이 함께 쓴다
// [TSK-15 v1.2] 등록 메뉴 = 과제 형태(서·논술형 / 정답형) × 등록 방식(직접 등록 / 스마트 등록)
//   직접 등록 — 교사가 화면에서 하나씩 작성 · 스마트 등록 — 자료(PDF·이미지)를 올리면 AI가 모든 단계를 채움
//   more — 기존 방식(직접 입력 · 파일 업로드)은 접어 둔다
export const REGISTER_GROUPS = [
    { title: '📝 서·논술형 과제', sub: '문항별 답안지 · 루브릭 채점', color: '#6D28D9', hover: '#F5F3FF', border: '#DDD6FE', items: [
        { mode: 'direct2', icon: '✍️', label: '서·논술형 직접 등록', desc: '기본 정보 → 문항 → 성취기준·모범답안 → 채점 기준 → 배포를 단계별로 작성합니다.' },
        { mode: 'generate', icon: '✨', label: '서·논술형 스마트 등록', desc: '평가 자료를 올리면 AI가 문항·모범답안·채점 기준까지 채웁니다. 결과는 직접 등록 화면에서 고칩니다.' },
    ], more: [
        { mode: 'direct', icon: '📝', label: '직접 입력 (기존)', desc: '한 화면에서 문제 텍스트·이미지를 작성합니다.' },
        { mode: 'upload', icon: '📷', label: '파일 업로드 (종이 양식)', desc: '기존 종이 양식(PDF/이미지)을 그대로 학생 문답지로 사용합니다.' },
    ] },
    { title: '✅ 정답형 과제', sub: '객관식·진위·단답 등 · 한 장 시험지 · 정답 대조 채점', color: '#1D4ED8', hover: '#EFF6FF', border: '#BFDBFE', items: [
        { mode: 'answer-direct', icon: '✍️', label: '정답형 직접 등록', desc: '문항을 직접 작성하거나 문제 은행·문제집에서 골라 시험지를 만듭니다.' },
        { mode: 'answer-smart', icon: '✨', label: '정답형 스마트 등록', desc: '시험지·교재를 올리면 AI가 문항 분류·정답·배점·과제명까지 채웁니다. 확인만 하면 됩니다.' },
    ] },
];

// [TSK-15 v1.4] 왼쪽 메뉴 「과제 관리」 아래 형태별 과제 목록 — 등록은 각 목록의 [+ 새 과제 등록]에서 직접/스마트로 분기
// [TSK-15 v1.5] 과제 관리(기존) [+ 새 과제 등록] — 정리 전과 같은 3가지
export const LEGACY_REGISTER = [
  { mode: 'direct', icon: '📝', label: '직접 입력', desc: '문제 텍스트·이미지를 시스템 내에서 직접 작성합니다.' },
  { mode: 'direct2', icon: '🧩', label: '직접 입력 2', desc: '탭 단계형 입력 — 문항 → 자동/자율 채점 기준 → 등급 환산까지 단계별로 작성합니다.' },
  { mode: 'upload', icon: '📷', label: '파일 업로드', desc: '기존 종이 양식(PDF/이미지)을 업로드하여 그대로 학생 문답지로 사용합니다.' },
];

// 서·논술형 과제 = 과제 관리 목록과 같은 화면(서·논술형만) · 정답형 과제 = 문제 은행 목록 (v1.5 — 문제 은행 메뉴 삭제)
export const FORM_LISTS = [
  { sub: '서·논술형 과제', form: 'essay', icon: '📝', group: REGISTER_GROUPS[0] },
  { sub: '정답형 과제', form: 'answer', icon: '✅', group: REGISTER_GROUPS[1] },
];

// 이전 메뉴 (history) — 정리 전 등록 메뉴를 그대로 남긴다. 같은 화면으로 연결
export const SIDEBAR_REGISTER_HISTORY = [
  { mode: 'direct', icon: '📝', label: '직접 입력' },
  { mode: 'direct2', icon: '🧩', label: '직접 입력 2' },
  { mode: 'upload', icon: '📷', label: '파일 업로드' },
  { mode: 'generate-pick', icon: '✨', label: '스마트 과제 등록 (형태 선택)' },
  { mode: 'answer-bank', icon: '🗂️', label: '문제 은행에서 고르기' },
];
