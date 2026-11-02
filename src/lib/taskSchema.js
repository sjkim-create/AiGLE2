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

// 「파일로 과제 생성」 출력(lib/taskFromFile) → BASE_TASKS 호환 + 부족한 항목(issues) 보존
//   AI가 채운 과제라 바로 등록하되 「작성중」으로 시작한다 — 교사가 issues를 확인한 뒤 배포
export const buildFileGenerateTask = ({ id, draft, issues }) => {
  const { meta } = draft;
  return {
    id: id ?? Date.now(),
    status: '작성중',
    visibility: '비공유',
    lastUpdate: todayISO(),
    title: draft.title,
    schoolLevel: formatSchoolLevel(meta.schoolLevelName, meta.gradeLabel),
    subject: meta.curriculumName,
    subSubject: meta.subjectName,
    questions: draft.questions.length,
    points: computeTotalPoints('self', draft.questions),
    competencies: formatCompetencies(meta.competencies.map((c) => c.name)),
    source: 'file_generate',
    detail: { ...draft, evalMode: 'self', issues },
  };
};

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

// [TSK-15] 정답형 과제 — 문항(문제 은행 문항 또는 새로 만든 문항)을 순서대로 배치한 시험지형 과제
//   form: 'answer' (서·논술형 과제는 form 없음 = 'essay')
//   detail.entries: 배치 순서대로 { number, points, item(스냅샷) } — 배포 뒤 문제 은행 원본을 고쳐도 과제는 그대로
export const buildAnswerTask = ({ id, title, entries, passages = [], curriculum = {}, origin = 'direct' }) => {
  const level = curriculum.schoolLevelName || '';
  const grade = curriculum.gradeLabel || '';
  return {
    id: id ?? Date.now(),
    form: 'answer',
    status: '작성중',
    visibility: '비공유',
    lastUpdate: todayISO(),
    title,
    schoolLevel: formatSchoolLevel(level, grade) || (entries.every((e) => e.item.track === 'basic') ? '기초학력' : ''),
    subject: curriculum.curriculumName || curriculum.subjectName || '',
    subSubject: curriculum.subjectName && curriculum.subjectName !== curriculum.curriculumName ? curriculum.subjectName : '',
    questions: entries.length,
    points: entries.reduce((s, e) => s + (Number(e.points) || 0), 0),
    competencies: '',
    source: 'answer_based',
    detail: {
      origin, // 'direct' | 'file' | 'bank' — 처음 시작한 방법
      entries: entries.map((e, i) => ({ number: i + 1, points: Number(e.points) || 0, item: e.item })),
      passages,
    },
  };
};

// [TSK-13 · TSK-14] 서·논술 과제를 직접 입력 2(편집 화면)로 열기 — 스마트 과제 등록 결과(file_generate) 또는 직접 입력 과제(direct_input)
//   교과·영역·성취기준·역량은 실제 교육과정 값이라 직접 입력 2의 기본 목록에 없을 수 있어 extraOptions로 선택지에 더한다
//   그림은 <img data-page data-box>로 넣어 두어 직접 입력 2에서도 원본 쪽 위 범위 조정이 된다
const escHtml = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const imageTag = (im) => `<p><img src="${im.dataUrl}" alt="${escHtml(im.label)}" data-page="${im.page ?? ''}" data-box="${(im.box || []).join(',')}" data-origin="${im.origin || ''}" style="max-width:100%"></p>`;
export const taskToDirectInputData = (task) => {
  const d = task.detail || {};
  if (task.source === 'direct_input') {
    return { taskId: task.id, basicInfo: d.basicInfo, passage: d.passage || '', questions: d.questions, extraOptions: d.fromFile?.extraOptions, pageImages: d.fromFile?.pageImages || [], keep: d.fromFile || null, eduSource: task.copiedFromEduId || null, sheet: d.sheet || null };
  }
  const meta = d.meta || {};
  const std = (x) => `std-${x.id}`;
  const comps = (meta.competencies || []).map((c) => c.name);
  const questions = (d.questions || []).map((q, i) => ({
    id: q.id || `q-file-${i + 1}`,
    content: q.content || '',
    contentImages: q.contentImages || [], // 문제 속 그림 — 직접 입력 2에서 범위 조정
    evaluationAreas: [...new Set((q.evaluationAreas || []).map((a) => a.name).filter(Boolean))],
    standards: (q.standards || []).map(std),
    standard: q.standards?.[0] ? std(q.standards[0]) : '',
    points: q.points ? String(q.points) : '',
    modelAnswer: { html: escHtml(q.modelAnswer).split('\n').map((l) => `<div>${l || '<br>'}</div>`).join('') + (q.modelAnswerImages || []).map(imageTag).join('') },
    criteria: (q.criteria || []).map((c) => ({
      id: c.id, name: c.name, maxPoints: c.maxPoints, levels: c.levels.length,
      interval: c.levels.length > 1 ? Math.max(1, c.levels[0].score - c.levels[1].score) : 1,
      rows: c.levels.map((l) => ({ score: l.score, desc: l.content })),
    })),
  }));
  const extraOptions = {
    competencies: comps,
    areas: [...new Set((meta.standards || []).map((x) => x.areaName).filter(Boolean))],
    standards: (meta.standards || []).map((x) => ({ id: std(x), area: x.areaName, competencies: comps, text: `${x.code} ${x.text}` })),
  };
  return {
    taskId: task.id,
    eduSource: task.copiedFromEduId || null, // [TSK-16] 교육청 출처 — 고쳐 저장해도 유지
    basicInfo: {
      title: task.title, type: '서술형',
      subject: meta.curriculumName || task.subject || '국어', subSubject: meta.subjectName || task.subSubject || '',
      schoolLevel: meta.schoolLevelName || '고등학교', grade: (meta.gradeLabel || '1-3학년').replace('-', '~'),
      competencies: comps,
    },
    passage: d.passage || '',
    questions: questions.length ? questions : undefined,
    selfScale: d.questions?.[0]?.criteria?.[0]?.levels?.length || 3,
    extraOptions,
    pageImages: d.pageImages || [],
    keep: { origin: 'file_generate', issues: d.issues, sourceFile: d.sourceFile, pageImages: d.pageImages || [], meta, extraOptions },
  };
};

// [TSK-13 v4.x] 모범답안 점수대 — 채점 기준(범주)마다 모범답안이 받는 점수 행을 고른다 (기본: 맨 위 = 최고 점수)
//   modelRow: 그 범주 rows의 인덱스. 행이 줄어들면 마지막 행으로 맞춘다
export const modelRowIdx = (c) => Math.min(Math.max(0, Number(c?.modelRow) || 0), Math.max(0, (c?.rows || []).length - 1));
export const modelAnswerScore = (q) => (q?.criteria || []).reduce((s, c) => s + (Number(c.rows?.[modelRowIdx(c)]?.score) || 0), 0);
export const criteriaTotal = (q) => (q?.criteria || []).reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
