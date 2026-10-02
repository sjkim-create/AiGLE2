/**
 * itemExtract.js — 스마트 과제 등록 › 정답형: 평가 자료(PDF·이미지) → 문항 유형별 분류 → 문제 은행 레코드
 *
 * 흐름: 쪽 이미지 렌더(readFilePages) → Gemini 분류(callGeminiJson) → 문항마다 교육과정 매칭(matchCatalog)
 *      → 그림 자르기(cropImage) → source / passages / items 레코드 + 문항별 부족한 항목(issues)
 * 저장은 하지 않는다 — 교사가 확인·선택한 뒤 itemBank.saveExtraction으로 저장
 */
import { readFilePages, callGeminiJson, loadCatalog, matchCatalog, cropImage, GenerateError, MAX_PAGES } from './taskFromFile';
import { ITEM_TYPES, ITEM_SCHEMA_VERSION, emptyAnswer, hasAnswer, newId } from './itemBank';

// 프롬프트 본문은 PRD에 두지 않는다 (코드에만 존재)
const buildPrompt = (pageCount) => `당신은 한국 초·중·고 평가 문항 자료(시험지·문제집·평가지)를 문제 은행으로 옮기는 담당자입니다.
첨부한 ${pageCount}장의 이미지는 하나의 자료를 쪽 순서대로 렌더한 것입니다(1쪽부터).
자료에 있는 문항을 빠짐없이 하나씩 옮기고, 유형을 분류합니다. 없는 내용은 지어내지 마세요.

유형(itemType) — 하나만 고른다
- multiple_choice: 보기(①②③…) 중 고르는 선다형(객관식). 정답이 여럿일 수 있음
- true_false: O/X, 맞으면 ○ 틀리면 × 등 진위형
- matching: 왼쪽·오른쪽 항목을 선으로 잇거나 짝짓는 연결형
- short_answer: 단어·숫자·기호 등 짧게 쓰는 단답형
- completion: 문장·표 속 빈칸(   )을 채우는 완성형
- essay: 문장으로 서술하는 서술형·논술형

추출 규칙
- meta: 자료 전체의 schoolLevel(ELEMENTARY|MIDDLE|HIGH|""), studentGrade(적힌 그대로, 예 "3학년"), subject(교과명), title(자료 제목), standardCodes(자료에 적힌 성취기준 코드, 대괄호 없이)
- passages: 여러 문항이 함께 보는 공통 지문·자료(예: "[1~3] 다음 글을 읽고"). key는 "P1","P2"…, text는 지문 전문, range는 해당 문항 번호 설명
- items: 문항마다 1개, 자료 순서대로
  - number: 자료의 문항 번호(문자열)
  - itemType: 위 유형 중 하나
  - stem: 발문(질문 문장)
  - material: 발문 아래 <보기>·조건·제시 자료 글 (없으면 "")
  - choices: 선다형 보기 [{"no":1,"text":"..."}] (선다형이 아니면 [])
  - matching: 연결형이면 {"left":["..."],"right":["..."]} (아니면 null)
  - blanks: 완성형 빈칸 수 (아니면 0)
  - answer: {"choices":[번호…], "truth":true|false|null, "texts":["허용 답…"], "blanks":[["빈칸1 허용 답…"],…], "pairs":[[왼쪽번호,오른쪽번호]…], "model":"서술형 모범답안"} — 해당 유형 칸만 채움
  - answerSource: 정답을 자료의 정답표·해설에서 읽었으면 "file", 정답이 자료에 없어 직접 풀었으면 "ai", 풀 수 없으면 "none"
  - explanation: 자료에 해설이 있으면 그대로, 없으면 ""
  - points: 자료에 적힌 배점 숫자, 없으면 null
  - standardCodes: 이 문항에 적힌 성취기준 코드 (없으면 [])
  - passageKey: 공통 지문을 쓰면 그 key, 아니면 null
  - page: 문항이 있는 쪽 번호
  - images: 문항에 딸린 그림·도표·사진 [{"page":쪽,"box_2d":[ymin,xmin,ymax,xmax](0~1000 정규화),"label":"무엇의 그림"}] (장식 아이콘 제외)
- unreadable: 읽을 수 없거나 옮기지 못한 부분을 한 줄씩 (위치 포함)
- isItemSource: 문항이 있는 자료면 true, 아니면 false + reason

JSON만 응답:
{"isItemSource":true,"reason":"","meta":{"schoolLevel":"","studentGrade":"","subject":"","title":"","standardCodes":[]},
"passages":[{"key":"P1","text":"","range":""}],
"items":[{"number":"1","itemType":"multiple_choice","stem":"","material":"","choices":[{"no":1,"text":""}],"matching":null,"blanks":0,
"answer":{"choices":[],"truth":null,"texts":[],"blanks":[],"pairs":[],"model":""},"answerSource":"file","explanation":"","points":null,
"standardCodes":[],"passageKey":null,"page":1,"images":[]}],
"unreadable":[]}`;

export const EXTRACT_STEPS = [
  { key: 'read', label: '파일 읽기' },
  { key: 'ai', label: 'AI로 문항 찾기 · 유형 분류' },
  { key: 'match', label: '교육과정·성취기준 연결' },
  { key: 'image', label: '그림 정리' },
];

const toNum = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** AI가 준 정답 객체를 유형에 맞게 정리 */
const normalizeAnswer = (type, raw = {}) => {
  const a = emptyAnswer();
  if (type === 'multiple_choice') a.choices = (raw.choices || []).map(Number).filter((n) => n > 0);
  if (type === 'true_false') a.truth = raw.truth === true || raw.truth === false ? raw.truth : null;
  if (type === 'matching') a.pairs = (raw.pairs || []).filter((p) => Array.isArray(p) && p.length === 2).map((p) => p.map(Number));
  if (type === 'short_answer') a.texts = (raw.texts || []).map(String).filter((t) => t.trim());
  if (type === 'completion') a.blanks = (raw.blanks || []).map((b) => (Array.isArray(b) ? b : [b]).map(String));
  if (type === 'essay') a.model = String(raw.model || '');
  return a;
};

/**
 * @param {File} file
 * @param {(stepKey: string) => void} onStep
 * @returns {Promise<{source, passages, items, summaryIssues}>}
 */
export const extractItemsFromFile = async (file, onStep = () => {}, { analyze } = {}) => {
  const summaryIssues = [];

  onStep('read');
  const { pages, totalPages } = await readFilePages(file);
  if (totalPages > MAX_PAGES) {
    summaryIssues.push({ level: 'warn', field: '파일', message: `${totalPages}쪽 중 앞의 ${MAX_PAGES}쪽만 분석했습니다. 뒤쪽 문항은 빠졌을 수 있습니다.` });
  }

  onStep('ai');
  const [ai, cat] = await Promise.all([analyze ? analyze(pages) : callGeminiJson(buildPrompt(pages.length), pages), loadCatalog()]);
  const rawItems = Array.isArray(ai.items) ? ai.items : [];
  if (ai.isItemSource === false || rawItems.length === 0) {
    throw new GenerateError('NOT_ITEM_SOURCE', '파일에서 문항을 찾지 못했습니다.', ai.reason || '문항이 들어 있는 평가 자료인지 확인해 주세요.');
  }

  onStep('match');
  const meta = ai.meta || {};
  const now = new Date().toISOString();
  const sourceId = newId('src');
  // 자료 전체 교육과정 — 문항에 코드가 없을 때 기본값
  const docIssues = [];
  const docMeta = matchCatalog(cat, { ...meta, competencies: [] }, docIssues);

  const passageIdByKey = {};
  const passages = (ai.passages || []).filter((p) => p && String(p.text || '').trim()).map((p) => {
    const id = newId('psg');
    passageIdByKey[p.key] = id;
    return { id, sourceId, key: p.key, text: String(p.text).trim(), range: p.range || '', schemaVersion: ITEM_SCHEMA_VERSION, createdAt: now };
  });

  onStep('image');
  const items = rawItems.map((r, idx) => {
    const issues = [];
    const itemType = ITEM_TYPES[r.itemType] ? r.itemType : 'short_answer';
    if (!ITEM_TYPES[r.itemType]) issues.push({ level: 'warn', field: '유형', message: `AI가 유형을 정하지 못해(${r.itemType || '없음'}) 단답형으로 두었습니다. 맞는 유형으로 바꿔 주세요.` });

    // 교육과정 — 문항 코드 우선, 없으면 자료 전체 값
    let curriculum = docMeta;
    if ((r.standardCodes || []).length) {
      const itemIssues = [];
      curriculum = matchCatalog(cat, { ...meta, standardCodes: r.standardCodes, competencies: [] }, itemIssues);
      issues.push(...itemIssues.filter((i) => i.field === '성취기준' || i.level === 'error'));
    } else if (!docMeta.standards.length) {
      issues.push({ level: 'info', field: '성취기준', message: '자료에 성취기준 코드가 없어 비워 두었습니다.' });
    }

    const answer = normalizeAnswer(itemType, r.answer);
    const draft = { itemType, answer };
    let answerSource = ['file', 'ai', 'none'].includes(r.answerSource) ? r.answerSource : 'none';
    if (!hasAnswer(draft)) answerSource = 'none';
    if (answerSource === 'ai') issues.push({ level: 'warn', field: '정답', message: '자료에 정답이 없어 AI가 풀어 넣은 정답입니다. 맞는지 확인해 주세요.' });
    if (answerSource === 'none') issues.push({ level: 'error', field: '정답', message: '정답을 찾지 못했습니다. 정답을 입력해야 채점할 수 있습니다.' });
    if (itemType === 'multiple_choice' && (r.choices || []).length < 2) issues.push({ level: 'warn', field: '보기', message: '선다형인데 보기를 2개 이상 찾지 못했습니다.' });
    if (itemType === 'essay') issues.push({ level: 'info', field: '채점 기준', message: '서술형은 채점 기준(루브릭)을 과제 배치 단계에서 정합니다.' });

    const images = (r.images || []).map((im) => cropImage(pages, im)).filter(Boolean);
    if ((r.images || []).length > images.length) issues.push({ level: 'warn', field: '그림', message: '그림 일부를 찾지 못해 넣지 못했습니다.' });
    if (images.length) issues.push({ level: 'info', field: '그림', message: `그림 ${images.length}장을 AI가 찾은 위치로 잘라 넣었습니다. 잘린 범위를 확인해 주세요.` });

    const order = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    return {
      id: newId('itm'),
      schemaVersion: ITEM_SCHEMA_VERSION,
      order: idx,
      number: String(r.number ?? idx + 1),
      itemType,
      stem: String(r.stem || '').trim(),
      material: String(r.material || '').trim(),
      choices: (r.choices || []).map((c, i) => ({ no: Number(c.no) || i + 1, text: String(c.text || '').trim() })),
      matching: r.matching && Array.isArray(r.matching.left) ? { left: r.matching.left.map(String), right: (r.matching.right || []).map(String) } : null,
      blankCount: Number(r.blanks) || 0,
      answer,
      answerSource,
      explanation: String(r.explanation || '').trim(),
      points: toNum(r.points),
      images,
      passageId: r.passageKey ? passageIdByKey[r.passageKey] || null : null,
      curriculum: {
        schoolLevelCode: curriculum.schoolLevelCode, schoolLevelName: curriculum.schoolLevelName,
        gradeId: curriculum.gradeId, gradeLabel: curriculum.gradeLabel,
        curriculumId: curriculum.curriculumId, curriculumName: curriculum.curriculumName,
        subjectId: curriculum.subjectId, subjectName: curriculum.subjectName,
        standards: curriculum.standards,
      },
      source: { sourceId, fileName: file.name, page: Number(r.page) || null },
      // 파생 문항: 원본은 parentId=null · rootId=자기 자신. 파생은 parentId=원본 id, derivation=만든 방식
      lineage: { rootId: null, parentId: null, derivation: null },
      issues,
      createdAt: now,
      updatedAt: now,
    };
  });
  items.forEach((it) => { it.lineage.rootId = it.id; });

  (ai.unreadable || []).filter(Boolean).forEach((u) => summaryIssues.push({ level: 'warn', field: '읽지 못한 내용', message: String(u) }));
  if (!docMeta.subjectId) summaryIssues.push(...docIssues.filter((i) => i.level === 'error'));

  const source = {
    id: sourceId,
    schemaVersion: ITEM_SCHEMA_VERSION,
    fileName: file.name,
    fileSize: file.size,
    pages: totalPages,
    title: String(meta.title || '').trim() || file.name.replace(/\.[^.]+$/, ''),
    curriculum: { schoolLevelName: docMeta.schoolLevelName, gradeLabel: docMeta.gradeLabel, curriculumName: docMeta.curriculumName, subjectName: docMeta.subjectName },
    itemIds: items.map((i) => i.id),
    uploadedAt: now,
  };
  return { source, passages, items, summaryIssues };
};
