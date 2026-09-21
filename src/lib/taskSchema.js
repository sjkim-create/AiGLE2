/**
 * taskSchema.js
 * 과제 등록 공유 스키마 — Wizard(파일 업로드 / 직접 입력)에서 입력한 상태를 BASE_TASKS와 호환되는 공통 객체로 직렬화한다.
 * 영속화 layer 신설 이전의 단일 진실 소스.
 */

// 단계명 + 학년군을 BASE_TASKS의 schoolLevel 문자열 형식으로 결합 ("중학교 · 1~3학년")
export const formatSchoolLevel = (level, grade) => {
  if (!level && !grade) return '';
  if (!grade) return level || '';
  return `${level || ''} · ${grade}`.trim();
};

// 경쟁력 배열을 BASE_TASKS competencies 문자열로 join
export const formatCompetencies = (arr) =>
  Array.isArray(arr) ? arr.filter(Boolean).join(' / ') : (arr || '');

// 그룹 배포 상태로 task.status 자동 결정
//   [v3.75] 학생 배포 그룹 또는 출력(스마트펜 번호표·답안지 다운로드) 그룹이 1개 이상 → '배포됨' (채점 관리 미채점 진입)
//   그 외 → '작성중'. 舊 codeDeployed(번호표 배포)는 폐기 — 구 데이터 호환으로만 인정
export const computeStatus = (groupList = []) => {
  const anyDeployed = groupList.some((g) => g.studentDeployed || g.printed || g.codeDeployed);
  return anyDeployed ? '배포됨' : '작성중';
};

// 공유 상태 → visibility 문자열
export const computeVisibility = (isShared) => (isShared ? '공유' : '비공유');

// 오늘 날짜 YYYY-MM-DD 문자열
export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 총 배점 산출 — [v3.74] 자동평가 폐기. evalMode 는 스키마 호환용('self' 고정)이며 채점기준 합계 또는 q.points 우선
export const computeTotalPoints = (evalMode, questions = []) => {
  return questions.reduce((s, q) => {
    const total = Number(q.points) || 0;
    if (total > 0) return s + total;
    return s + q.criteria.reduce((cs, c) => cs + (Number(c.maxPoints) || 0), 0);
  }, 0);
};

// 「파일 업로드」 wizard 출력 → BASE_TASKS 호환 + source 메타 보존
export const buildFileUploadTask = ({
  id, basicInfo, uploadedFile, areas, answerDetails, questions,
  evalMode, groupList, isShared,
}) => ({
  // BASE_TASKS 공통 필드
  id: id ?? Date.now(),
  status: computeStatus(groupList),
  visibility: computeVisibility(isShared),
  lastUpdate: todayISO(),
  title: basicInfo?.title || '',
  schoolLevel: formatSchoolLevel(basicInfo?.schoolLevel, basicInfo?.grade),
  subject: basicInfo?.subject || '',
  subSubject: basicInfo?.subSubject || '',
  questions: questions?.length || 0,
  points: computeTotalPoints(evalMode, questions || []),
  competencies: formatCompetencies(basicInfo?.competencies),
  // 상세보기 분기·복원용
  source: 'file_upload',
  detail: {
    basicInfo, uploadedFile, areas, answerDetails, questions,
    evalMode, groupList,
  },
});

// 「직접 입력」 wizard 출력 → BASE_TASKS 호환 + source 메타 보존
export const buildDirectInputTask = ({
  id, basicInfo, passage, questions,
  evalMode, groupList, isShared,
}) => ({
  id: id ?? Date.now(),
  status: computeStatus(groupList),
  visibility: computeVisibility(isShared),
  lastUpdate: todayISO(),
  title: basicInfo?.title || '',
  schoolLevel: formatSchoolLevel(basicInfo?.schoolLevel, basicInfo?.grade),
  subject: basicInfo?.subject || '',
  subSubject: basicInfo?.subSubject || '',
  questions: questions?.length || 0,
  points: computeTotalPoints(evalMode, questions || []),
  competencies: formatCompetencies(basicInfo?.competencies),
  source: 'direct_input',
  detail: {
    basicInfo, passage, questions,
    evalMode, groupList,
  },
});
