/**
 * assignmentJson.js — 「파일로 과제 생성」 결과(draft) → 상용 아이글 「JSON 가져오기」 형식
 *
 * 형식 정본: docs/assignment-json/reference/assignment-자유평가 기준표 테스트.json (상용 export 샘플)
 *   · passage / questions[].content / modelAnswer.html 은 TipTap(ProseMirror) doc을 문자열로 직렬화한 값
 *   · 그림은 TipTap image 노드 + data URL (상용 수용 여부 미확인 — 샘플에 그림 예시 없음)
 *   · autoRubric(AI 평가 기준표)은 서버 rubricId가 필요해 비워 두고 자율 평가 기준표(selfCriteria)만 채운다
 */

const para = (text) => (text
  ? { type: 'paragraph', attrs: { textAlign: null, lineHeight: '1.5' }, content: [{ type: 'text', text }] }
  : { type: 'paragraph', attrs: { textAlign: null, lineHeight: '1.5' } });

const imageNode = (im) => ({ type: 'image', attrs: { src: im.dataUrl, alt: im.label || '', title: im.label || '' } });

// 줄마다 문단 1개, 그림은 끝에 그림마다 문단 1개
const toDoc = (text = '', images = []) => {
  const lines = String(text || '').split('\n');
  const content = [
    ...lines.map((l) => para(l.trimEnd())),
    ...images.map((im) => ({ type: 'paragraph', attrs: { textAlign: null, lineHeight: '1.5' }, content: [imageNode(im)] })),
  ];
  return JSON.stringify({ type: 'doc', content: content.length ? content : [para('')] });
};

export const buildAssignmentJson = (draft) => {
  const { meta } = draft;
  const firstScale = draft.questions.find((q) => q.criteria.length)?.criteria[0].levels.length || 3;
  return {
    version: 1,
    kind: 'direct',
    basicInfo: {
      problemType: '서술형',
      title: draft.title,
      schoolLevelCode: meta.schoolLevelCode,
      gradeId: meta.gradeId,
      gradeLabel: meta.gradeLabel,
      curriculumId: meta.curriculumId,
      subjectId: meta.subjectId,
      competencyIds: meta.competencies.map((c) => c.id),
    },
    passage: toDoc(draft.passage),
    areas: [],
    questions: draft.questions.map((q, qi) => {
      const qid = `q-${qi + 1}`;
      const answerImages = q.modelAnswerImages || [];
      return {
        id: qid,
        content: toDoc(q.content, q.contentImages || []),
        evaluationAreas: (q.evaluationAreas || []).map((a) => a.id),
        standards: (q.standards || []).map((s) => s.id),
        modelAnswer: {
          html: toDoc(q.modelAnswer, answerImages),
          imageBytes: answerImages.reduce((s, im) => s + (im.bytes || 0), 0),
        },
        autoRubric: {},
        selectedAutoRubricId: null,
        autoScore: 10,
        selfTotal: q.points || null,
        selfTotalSource: null,
        selfCriteria: q.criteria.map((c, ci) => ({
          id: `${qid}-crit-${ci + 1}`,
          name: c.name,
          points: c.maxPoints,
          steps: c.levels.length,
          interval: c.levels.length > 1 ? c.levels[0].score - c.levels[1].score : 1,
          rows: c.levels.map((l) => ({ score: l.score, content: l.content })),
          contentEpoch: 0,
        })),
        answerSheetCopies: 1,
      };
    }),
    evaluationMode: 'self',
    gradingScale: firstScale,
    selfScale: firstScale,
    blockCopyPaste: true,
    shared: false,
  };
};

/** 브라우저에서 JSON 파일로 내려받기 — 파일명은 상용 export와 같은 「assignment-과제명.json」 */
export const downloadAssignmentJson = (draft) => {
  const json = JSON.stringify(buildAssignmentJson(draft), null, 2);
  const safe = String(draft.title || '과제').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `assignment-${safe}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
