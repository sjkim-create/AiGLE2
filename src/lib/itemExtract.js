/**
 * itemExtract.js — 스마트 과제 등록 › 정답형: 평가 자료(PDF·이미지) → 문항 유형별 분류 → 문제 은행 레코드
 *
 * 흐름: 쪽 이미지 렌더(readFilePages) → Gemini 분류(callGeminiJson) → 문항마다 교육과정 매칭(matchCatalog)
 *      → 그림 자르기(cropImage) → source / passages / items 레코드 + 문항별 부족한 항목(issues)
 * 저장은 하지 않는다 — 교사가 확인·선택한 뒤 itemBank.saveExtraction으로 저장
 */
import { readFilePages, callGeminiJson, loadCatalog, matchCatalog, cropImage, pageImagesOf, GenerateError, ITEM_MAX_FILE_MB, ITEM_MAX_PAGES, ITEM_CHUNK_PAGES } from './taskFromFile';
import { ITEM_TYPES, ITEM_SCHEMA_VERSION, emptyAnswer, hasAnswer, newId, countBlanks, emptyParensToBlanks } from './itemBank';

// 프롬프트 본문은 PRD에 두지 않는다 (코드에만 존재)
export const buildItemPrompt = (pageCount, fileName = '') => `당신은 한국 초·중·고 평가 문항 자료(시험지·문제집·평가지)를 문제 은행으로 옮기는 담당자입니다.
첨부한 ${pageCount}장의 이미지는 하나의 자료를 쪽 순서대로 렌더한 것입니다(1쪽부터).${fileName ? ` 파일 이름: 「${fileName}」 (단원·학습 기능 이름의 참고 정보)` : ''}
자료에 있는 문항을 빠짐없이 하나씩 옮기고, 유형을 분류합니다. 없는 내용은 지어내지 마세요.

유형(itemType) — 하나만 고른다
- multiple_choice: 보기(①②③…) 중 고르는 선다형(객관식). 정답이 여럿일 수 있음
- binary_choice: 번호 없이 **두 낱말·표현 중 맞는 것에 동그라미** 치는 양자택일형 (예: 그림 옆 "무릎 / 무름"). 보기는 두 낱말 그대로 choices에 넣음
- true_false: O/X, 맞으면 ○ 틀리면 × 등 진위형
- matching: 왼쪽·오른쪽 항목을 선으로 잇거나 짝짓는 연결형
- short_answer: 단어·숫자·기호 등 짧게 쓰는 단답형
- completion: 문장·표 속 빈칸(   )을 채우는 완성형
- essay: 문장으로 서술하는 서술형·논술형

추출 규칙
- meta: 자료 전체의 schoolLevel(ELEMENTARY|MIDDLE|HIGH|""), studentGrade(적힌 그대로, 예 "3학년"), subject(교과명), title(자료 제목), standardCodes(자료에 적힌 성취기준 코드, 대괄호 없이), scopeUnits(자료에 적힌 시험 범위 단원명 목록)
  - track: 교과 시험·평가지면 "curriculum", 한글 해득·기초 연산·문해력 교재처럼 **기초학력** 자료면 "basic"
  - skill: 기초학력 자료의 학습 기능명 (예 "복잡한 받침 단어 읽기"). 쪽의 활동 이름(예 "읽고 찾기")보다 단원·차시 제목을 쓰고, 쪽에 없으면 파일 이름에서 가져옴. 교과 자료면 ""
- passages: 여러 문항이 함께 보는 공통 지문·자료(예: "[1~3] 다음 글을 읽고"). key는 "P1","P2"…, text는 지문 전문, range는 해당 문항 번호 설명
- items: 문항마다 1개, 자료 순서대로
  - number: 자료의 문항 번호(문자열)
  - itemType: 위 유형 중 하나
  - stem: 발문(질문 문장). 문항마다 발문이 따로 없고 자료 머리에 공통 지시문(예: "읽고 찾기")만 있으면 그 지시문을 넣음
  - material: 발문 아래 <보기>·조건·제시 자료 글 (없으면 "")
  - choices: 선다형·양자택일형 보기 [{"no":1,"text":"..."}] (아니면 [])
  - matching: 연결형이면 {"left":["..."],"right":["..."]} (아니면 null)
  - 완성형 stem은 빈칸 자리를 [빈칸] 으로 적음 (예: "a + [빈칸] = b + [빈칸]")
  - blanks: 완성형 빈칸 수 (아니면 0)
  - answer: {"choices":[번호…], "truth":true|false|null, "texts":["허용 답…"], "blanks":[["빈칸1 허용 답…"],…], "pairs":[[왼쪽번호,오른쪽번호]…], "model":"서술형 모범답안"} — 해당 유형 칸만 채움
  - answerSource: 정답을 자료의 정답표·해설에서 읽었으면 "file", 정답이 자료에 없어 직접 풀었으면 "ai", 풀 수 없으면 "none"
  - **정답표가 없으면 반드시 직접 풀어 answer를 채우고 answerSource를 "ai"로** 한다 (예: 양자택일형 맞춤법 문제는 표준어·바른 표기를 정답으로). 그림·지문으로도 판단할 수 없을 때만 "none"
  - explanation: 자료에 해설이 있으면 그대로, 없으면 ""
  - points: 자료에 적힌 배점 숫자, 없으면 null
  - unit: 자료에 적힌 이 문항의 단원명 (문항 위 단원 표시·시험 범위 등으로 확인될 때만, 없으면 "")
  - standardCodes: 이 문항에 적힌 성취기준 코드 (없으면 [])
  - passageKey: 공통 지문을 쓰면 그 key, 아니면 null
  - page: 문항이 있는 쪽 번호
  - images: 문항에 딸린 그림·도표·사진 [{"page":쪽,"box_2d":[ymin,xmin,ymax,xmax](0~1000 정규화),"label":"무엇의 그림"}] (장식 아이콘 제외)
- unreadable: 읽을 수 없거나 옮기지 못한 부분을 한 줄씩 (위치 포함)
- isItemSource: 문항이 있는 자료면 true, 아니면 false + reason

JSON만 응답:
{"isItemSource":true,"reason":"","meta":{"schoolLevel":"","studentGrade":"","subject":"","title":"","standardCodes":[],"scopeUnits":[],"track":"curriculum","skill":""},
"passages":[{"key":"P1","text":"","range":""}],
"items":[{"number":"1","itemType":"multiple_choice","stem":"","material":"","choices":[{"no":1,"text":""}],"matching":null,"blanks":0,
"answer":{"choices":[],"truth":null,"texts":[],"blanks":[],"pairs":[],"model":""},"answerSource":"file","explanation":"","points":null,
"unit":"","standardCodes":[],"passageKey":null,"page":1,"images":[]}],
"unreadable":[]}`;

const NL = '\n';

/** 2차 — 과목의 교육과정 단원 목록을 주고 문항마다 목록 안에서 단원을 고르게 한다 (이름을 지어내지 않게) */
const buildUnitPrompt = (options, items, scopeText) => `한국 교육과정(2022 개정) 기준으로 각 문항이 어느 단원에 속하는지 아래 단원 목록에서 고르세요.
단원 이름이 아니라 **성취기준 내용**과 문항 내용을 비교해 판단합니다. 목록에 없는 단원을 만들지 마세요.
${scopeText ? `자료에 적힌 시험 범위: ${scopeText} (교과서 단원명이라 교육과정 단원 이름과 다를 수 있음 — 참고만)
` : ''}
[단원 목록]
${options.map((o) => `- ${o.areaId}: ${o.name} — ${o.standards.slice(0, 3).map((st) => st.text.slice(0, 50)).join(' / ')}`).join(NL)}

[문항]
${items.map((it) => `- ${it.number}: ${String(it.stem).slice(0, 120)}${(it.choices || []).length ? ` (보기: ${it.choices.map((c) => c.text).join(', ').slice(0, 80)})` : ''}`).join(NL)}

JSON만 응답: {"assign":[{"number":"1","areaId":0,"confidence":"high|low"}]}`;

const assignUnits = async (options, items, scopeText) => {
  if (!options.length || !items.length) return {};
  const res = await callGeminiJson(buildUnitPrompt(options, items, scopeText), []);
  return Object.fromEntries((res.assign || []).map((a) => [String(a.number), { areaId: Number(a.areaId), confidence: a.confidence === 'low' ? 'low' : 'high' }]));
};

export const EXTRACT_STEPS = [
  { key: 'read', label: '파일 읽기' },
  { key: 'ai', label: 'AI로 문항 찾기 · 유형 분류' },
  { key: 'match', label: '단원 연결 · 성취기준 매핑' },
  { key: 'image', label: '그림 정리' },
];

const normName = (s) => String(s || '').replace(/^[\s\dIVX]+[.)]\s*/, '').replace(/[\s·⋅‧ㆍ・.,()]/g, '');

/** 과목의 단원(카탈로그 핵심평가영역) 목록 + 단원별 성취기준 — 단원 선택 상자·매핑 공용 */
export const unitOptionsFor = (cat, subjectId) => {
  if (subjectId == null) return [];
  const bySubject = Object.entries(cat.areas).filter(([, a]) => a.subjectId === Number(subjectId));
  return bySubject.map(([aid, a]) => ({
    areaId: Number(aid),
    name: a.name,
    standards: Object.entries(cat.standards)
      .filter(([, v]) => v[1] === Number(aid))
      .map(([code, [id, areaId, text]]) => ({ id, code, text, areaId, areaName: a.name }))
      .sort((x, y) => x.code.localeCompare(y.code)),
  }));
};

/** 자료의 단원 표기 속에 들어 있는 단원(영역) 전부 — 「Ⅳ. 운동과 에너지 (1. 힘의 작용 ~ 2. 중력과 무게)」 → [운동과 에너지, 힘의 작용]
 *  교과서 대단원명은 교육과정 단원과 이름만 같고 내용이 다를 수 있어, 후보를 모두 찾아 문제 내용 추정과 맞춰 본다 */
export const findAreas = (options, text) => {
  const n = normName(text);
  if (!n) return [];
  return options.filter((o) => { const m = normName(o.name); return m.length >= 2 && (n.includes(m) || m === n); });
};

/** 단원명 → 단원(영역). 번호·기호를 떼고 같거나 한쪽이 다른 쪽을 품으면 연결 */
export const findArea = (options, name) => {
  const n = normName(name);
  if (!n) return null;
  return options.find((o) => normName(o.name) === n)
    || options.find((o) => { const m = normName(o.name); return m.length >= 2 && (n.includes(m) || m.includes(n)); })
    || null;
};

const toNum = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** AI가 준 정답 객체를 유형에 맞게 정리 */
const normalizeAnswer = (type, raw = {}) => {
  // 유형과 상관없이 받은 칸은 모두 남긴다 — 나중에 유형을 바꿔도 정답이 사라지지 않게 (itemBank.changeItemType)
  const a = emptyAnswer();
  a.choices = (raw.choices || []).map(Number).filter((n) => n > 0);
  a.truth = raw.truth === true || raw.truth === false ? raw.truth : null;
  a.pairs = (raw.pairs || []).filter((p) => Array.isArray(p) && p.length === 2).map((p) => p.map(Number));
  a.texts = (raw.texts || []).map(String).filter((t) => t.trim());
  a.blanks = (raw.blanks || []).map((b) => (Array.isArray(b) ? b : [b]).map(String));
  a.model = String(raw.model || '');
  return a;
};

/* 쪽이 많으면 ITEM_CHUNK_PAGES쪽씩 나눠 분석하고 합친다 — 한 번에 보내면 AI 응답이 길어져 응답 한도를 넘는다.
 *   묶음마다 쪽 번호는 1부터 다시 세므로 원본 쪽 번호로 되돌리고, 지문 key는 묶음끼리 겹치지 않게 바꾼다.
 *   동시에 2묶음씩(사용량 한도 · 혼잡 대비). 한 묶음이 실패해도 나머지는 살리고 그 쪽 범위를 알린다.
 *   한계 — 정답표가 다른 묶음에 있으면 그 문항의 정답은 비어 교사 확인으로 남는다 */
const analyzeInChunks = async (pages, fileName, analyze, summaryIssues, failed = []) => {
  const chunks = [];
  for (let i = 0; i < pages.length; i += ITEM_CHUNK_PAGES) chunks.push(pages.slice(i, i + ITEM_CHUNK_PAGES));
  const call = (ch) => (analyze ? analyze(ch) : callGeminiJson(buildItemPrompt(ch.length, fileName), ch));
  if (chunks.length <= 1 && pages[0]?.no === 1) return call(pages); // 1쪽부터 한 묶음이면 쪽 번호를 고칠 필요가 없다 (분할 추출의 뒤 구간은 아래에서 원본 쪽으로 되돌린다)
  const results = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const ci = next; next += 1;
      try { results[ci] = { ok: true, ai: await call(chunks[ci]) }; } catch (err) { results[ci] = { ok: false, err }; }
    }
  };
  await Promise.all([worker(), worker()]);
  const ok = results.filter((r) => r.ok);
  if (!ok.length) throw results[0].err;
  const merged = { isItemSource: false, reason: '', meta: null, passages: [], items: [], unreadable: [] };
  results.forEach((r, ci) => {
    const first = chunks[ci][0].no;
    const last = chunks[ci][chunks[ci].length - 1].no;
    if (!r.ok) { failed.push({ from: first, to: last }); summaryIssues.push({ level: 'warn', field: '파일', message: `${first}~${last}쪽은 분석하지 못했습니다. 그 쪽의 문항은 빠졌을 수 있습니다.` }); return; }
    const ai = r.ai || {};
    const offset = first - 1;
    const key = (k) => (k == null ? k : `c${ci + 1}-${k}`);
    if (ai.isItemSource !== false) merged.isItemSource = true;
    if (!merged.reason && ai.reason) merged.reason = ai.reason;
    if (!merged.meta && ai.meta && Object.values(ai.meta).some((v) => (Array.isArray(v) ? v.length : v))) merged.meta = ai.meta;
    (ai.passages || []).forEach((ps) => merged.passages.push({ ...ps, key: key(ps.key) }));
    (ai.items || []).forEach((it) => merged.items.push({
      ...it,
      passageKey: key(it.passageKey),
      page: Number(it.page) ? Number(it.page) + offset : it.page,
      images: (it.images || []).map((im) => ({ ...im, page: Number(im.page) ? Number(im.page) + offset : im.page })),
    }));
    (ai.unreadable || []).forEach((u) => merged.unreadable.push(u));
  });
  merged.meta = merged.meta || {};
  return merged;
};

/** 문항이 나온 쪽 번호 — 문항 쪽 + 그림을 자른 쪽 (원본 쪽 이미지는 이 쪽만 보관) */
export const pagesOfItems = (items) => new Set(items.flatMap((it) => [it.source?.page, ...(it.images || []).map((im) => im.page)]).map(Number).filter((n) => n > 0));

const hasMeta = (m) => !!m && Object.values(m).some((v) => (Array.isArray(v) ? v.length : v));

/**
 * [분할 추출] 쪽이 많은 자료는 ITEM_MAX_PAGES쪽(한 구간)씩 나눠 분석한다 — 교사가 구간 결과를 보고 다음 구간을 이어서 돌린다.
 *   fromPage — 이 구간의 첫 쪽. prev — 앞 구간에서 이어받는 값 { sourceId, meta, orderBase }
 *     · 같은 자료이므로 sourceId를 그대로 쓴다 (문제 은행에서 한 자료로 묶인다)
 *     · 교과·학년·시험 범위(meta)는 앞 구간 값을 쓴다. 앞 구간에서 못 정했으면 이 구간 값을 쓴다
 *   뒤에 분석할 쪽이 남아 있거나 이어받은 구간이면, 문항이 없어도 실패로 끝내지 않고 빈 결과를 돌려준다
 * @param {File} file
 * @param {(stepKey: string) => void} onStep
 *   analyze · assign — AI 호출 자리(샘플 체험은 고정 결과·단원 배정 생략을 넣는다)
 * @returns {Promise<{source, passages, items, summaryIssues, range: {from, to, total}, meta}>}
 */
export const extractItemsFromFile = async (file, onStep = () => {}, { analyze, assign = assignUnits, fromPage = 1, pageCount = ITEM_MAX_PAGES, prev = null } = {}) => {
  const summaryIssues = [];
  const failed = []; // AI 호출이 실패한 쪽 범위 — 화면에서 그 쪽만 다시 분석할 수 있게 돌려준다

  onStep('read');
  const { pages, totalPages } = await readFilePages(file, { maxMb: ITEM_MAX_FILE_MB, maxPages: Math.min(pageCount, ITEM_MAX_PAGES), fromPage });
  const range = { from: pages[0]?.no || fromPage, to: pages[pages.length - 1]?.no || fromPage, total: totalPages };
  const hasMore = range.to < totalPages;

  onStep('ai');
  const [ai, cat] = await Promise.all([analyzeInChunks(pages, file.name, analyze, summaryIssues, failed), loadCatalog()]);
  const rawItems = Array.isArray(ai.items) ? ai.items : [];
  if (import.meta.env.DEV) window.__lastItemAI = ai; // 개발 확인용 — 마지막 AI 응답 (브라우저 메모리에만)
  const meta = hasMeta(prev?.meta) ? prev.meta : (ai.meta || {});
  const now = new Date().toISOString();
  const sourceId = prev?.sourceId || newId('src');
  if (ai.isItemSource === false || rawItems.length === 0) {
    if (!hasMore && !prev) throw new GenerateError('NOT_ITEM_SOURCE', '파일에서 문항을 찾지 못했습니다.', ai.reason || '문항이 들어 있는 평가 자료인지 확인해 주세요.');
    summaryIssues.push({ level: 'info', field: '구간', message: `${range.from}~${range.to}쪽에서 문항을 찾지 못했습니다.` });
    const empty = { id: sourceId, schemaVersion: ITEM_SCHEMA_VERSION, fileName: file.name, fileSize: file.size, pages: totalPages, title: String(meta.title || '').trim() || file.name.replace(/\.[^.]+$/, ''), curriculum: {}, track: 'curriculum', skill: '', examScope: { units: [], standardCodes: [] }, itemIds: [], pageImages: [], uploadedAt: now };
    return { source: empty, passages: [], items: [], summaryIssues, range, meta, failed };
  }

  onStep('match');
  // 자료 전체 교육과정 — 문항에 코드가 없을 때 기본값
  const docIssues = [];
  const docMeta = matchCatalog(cat, { ...meta, competencies: [] }, docIssues);
  const areasOfSubject = unitOptionsFor(cat, docMeta.subjectId);
  const matchArea = (name) => findArea(areasOfSubject, name);
  // 시험 범위(지필평가 계획서처럼 자료에 적힌 단원) — 문항 단원은 이 범위 안에서 정한다
  const scopeAreas = [...new Map((meta.scopeUnits || []).flatMap((u) => findAreas(areasOfSubject, u)).map((a) => [a.areaId, a])).values()];
  const inScope = (a) => a && scopeAreas.some((x) => x.areaId === a.areaId);
  // 문항 성격 — 기초학력 자료는 단원·성취기준을 요구하지 않는다 (단원 배정 생략, 기초 기능으로 관리)
  const track = meta.track === 'basic' ? 'basic' : 'curriculum';
  const skill = String(meta.skill || '').trim();
  // 단원 배정 — 실패해도 추출 결과는 살린다 (단원은 교사가 고르게 됨)
  let assigned = {};
  if (track === 'curriculum') try {
    assigned = await assign(areasOfSubject, rawItems.map((r, i) => ({ number: String(r.number ?? i + 1), stem: r.stem, choices: r.choices })), (meta.scopeUnits || []).join(', '));
  } catch { summaryIssues.push({ level: 'warn', field: '단원', message: 'AI 단원 배정에 실패했습니다. 문항마다 단원을 골라 주세요.' }); }

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

    // [단원 단위 성취기준] 문항마다 성취기준을 매칭하지 않는다 — 문항 → 단원(카탈로그 핵심평가영역) → 그 단원의 성취기준
    //   우선순위: 자료에 적힌 단원명 → 문항의 성취기준 코드가 속한 영역 → AI가 문제 내용으로 추정한 영역
    //   자료 표기 속 단원 후보와 문제 내용 추정이 맞으면 자료 근거로 확정, 어긋나면 내용 기준으로 연결하고 교사 확인
    let area = null; let unitSource = 'none'; let mismatch = null; let lowConf = false;
    const fileCands = r.unit ? findAreas(areasOfSubject, r.unit) : [];
    const pick = assigned[String(r.number ?? idx + 1)];
    const guess = pick ? areasOfSubject.find((a) => a.areaId === pick.areaId) || null : null;
    lowConf = pick?.confidence === 'low';
    const codeHit = (r.standardCodes || []).map((c) => cat.standards[`[${String(c).replace(/[[\]\s]/g, '')}]`]).find((h) => h && areasOfSubject.some((a) => a.areaId === h[1]));
    const fromCode = codeHit ? areasOfSubject.find((a) => a.areaId === codeHit[1]) : null;
    const has = (list, a) => a && list.some((x) => x.areaId === a.areaId);
    if (fromCode) { area = fromCode; unitSource = 'file'; }                                  // 성취기준 코드가 적혀 있으면 가장 확실
    else if (has(fileCands, guess) && !lowConf) { area = guess; unitSource = 'file'; }       // 자료 단원 표기 + 내용 일치
    else if (has(scopeAreas, guess) && !lowConf) { area = guess; unitSource = 'scope'; }     // 시험 범위 안
    else if (fileCands.length && guess && !has(fileCands, guess)) { area = guess; unitSource = 'ai'; mismatch = fileCands; }
    else if (guess) { area = guess; unitSource = 'ai'; }
    else if (fileCands.length === 1) { area = fileCands[0]; unitSource = 'ai'; }
    else if (scopeAreas.length === 1) { area = scopeAreas[0]; unitSource = 'ai'; }
    if (track === 'basic') {
      // 기초학력 — 단원 확인 항목을 만들지 않는다 (교사가 교과로 바꾸면 그때 단원을 고른다)
    } else if (mismatch) {
      issues.push({ level: 'warn', field: '단원', message: `자료의 단원 표기(${mismatch.map((a) => a.name).join(', ')})와 문제 내용이 맞지 않아 내용 기준 「${area.name}」으로 연결했습니다. 맞는지 확인해 주세요.` });
    } else if (unitSource === 'ai' && scopeAreas.length) {
      issues.push({ level: 'warn', field: '단원', message: `추정한 단원 「${area.name}」이 자료의 시험 범위(${scopeAreas.map((a) => a.name).join(', ')}) 밖입니다. 맞는지 확인해 주세요.` });
    } else if (unitSource === 'ai') {
      issues.push({ level: 'warn', field: '단원', message: r.unit
        ? `자료의 단원 「${r.unit}」을 교육과정 단원과 연결하지 못해 문제 내용으로 추정했습니다. 맞는지 확인해 주세요.`
        : '자료에 단원이 없어 문제 내용으로 추정했습니다. 맞는지 확인해 주세요.' });
    } else if (!area) {
      issues.push({ level: 'warn', field: '단원', message: docMeta.subjectId ? '단원을 정하지 못했습니다. 단원을 골라 주세요.' : '교과를 확인하지 못해 단원을 정할 수 없습니다.' });
    }
    const unit = { label: String(r.unit || '').trim(), areaId: area?.areaId ?? null, areaName: area?.name || '', source: area ? unitSource : 'none' };

    const answer = normalizeAnswer(itemType, r.answer);
    // 선다형·양자택일형인데 정답을 보기 번호 대신 낱말로 준 경우 → 같은 글자의 보기 번호로 옮긴다
    if (['multiple_choice', 'binary_choice'].includes(itemType) && !answer.choices.length && answer.texts.length) {
      const norm = (t) => String(t || '').replace(/\s/g, '');
      answer.choices = (r.choices || []).map((c, i) => ({ no: Number(c.no) || i + 1, text: c.text }))
        .filter((c) => answer.texts.some((t) => norm(t) === norm(c.text))).map((c) => c.no);
    }
    const draft = { itemType, answer };
    let answerSource = ['file', 'ai', 'none'].includes(r.answerSource) ? r.answerSource : 'none';
    if (answerSource === 'none' && hasAnswer({ itemType, answer })) answerSource = 'ai'; // 정답은 줬는데 출처를 안 밝힌 경우
    if (!hasAnswer(draft)) answerSource = 'none';
    if (answerSource === 'ai') issues.push({ level: 'warn', field: '정답', message: '자료에 정답이 없어 AI가 풀어 넣은 정답입니다. 맞는지 확인해 주세요.' });
    if (answerSource === 'none') issues.push({ level: 'error', field: '정답', message: '정답을 찾지 못했습니다. 정답을 입력해야 채점할 수 있습니다.' });
    if (itemType === 'multiple_choice' && (r.choices || []).length < 2) issues.push({ level: 'warn', field: '보기', message: '선다형인데 보기를 2개 이상 찾지 못했습니다.' });
    if (itemType === 'binary_choice' && (r.choices || []).length !== 2) issues.push({ level: 'warn', field: '보기', message: `양자택일형은 보기가 2개여야 합니다 (지금 ${(r.choices || []).length}개).` });
    if (itemType === 'essay') issues.push({ level: 'info', field: '채점 기준', message: '서술형은 채점 기준(루브릭)을 과제 배치 단계에서 정합니다.' });

    const images = (r.images || []).map((im) => cropImage(pages, im)).filter(Boolean);
    if ((r.images || []).length > images.length) issues.push({ level: 'warn', field: '그림', message: '그림 일부를 찾지 못해 넣지 못했습니다.' });
    if (images.length) issues.push({ level: 'info', field: '그림', message: `그림 ${images.length}장을 AI가 찾은 위치로 잘라 넣었습니다. 잘린 범위를 확인해 주세요.` });

    // 완성형 — 빈칸 자리를 [빈칸] 표시로 (AI가 빈 괄호로 남긴 것도 바꾼다). 표시가 없으면 교사가 넣게 안내
    let stem = String(r.stem || '').trim();
    if (itemType === 'completion') {
      stem = emptyParensToBlanks(stem);
      if (!countBlanks(stem)) issues.push({ level: 'warn', field: '빈칸', message: '지문에서 빈칸 자리를 찾지 못했습니다. 빈칸 넣기로 표시해 주세요.' });
    }

    const order = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    return {
      id: newId('itm'),
      schemaVersion: ITEM_SCHEMA_VERSION,
      order: (prev?.orderBase || 0) + idx,
      number: String(r.number ?? idx + 1),
      itemType,
      stem,
      material: String(r.material || '').trim(),
      choices: (r.choices || []).map((c, i) => ({ no: Number(c.no) || i + 1, text: String(c.text || '').trim() })),
      matching: r.matching && Array.isArray(r.matching.left) ? { left: r.matching.left.map(String), right: (r.matching.right || []).map(String) } : null,
      blankCount: countBlanks(stem) || Number(r.blanks) || 0,
      answer,
      answerSource,
      explanation: String(r.explanation || '').trim(),
      points: toNum(r.points),
      images,
      passageId: r.passageKey ? passageIdByKey[r.passageKey] || null : null,
      unit,
      track,
      skill: track === 'basic' ? skill : '',
      curriculum: {
        schoolLevelCode: docMeta.schoolLevelCode, schoolLevelName: docMeta.schoolLevelName,
        gradeId: docMeta.gradeId, gradeLabel: docMeta.gradeLabel,
        curriculumId: docMeta.curriculumId, curriculumName: docMeta.curriculumName,
        subjectId: docMeta.subjectId, subjectName: docMeta.subjectName,
        standardsBasis: track === 'basic' ? 'none' : 'unit', // 교과: 단원 단위(문항별로 고르지 않음) / 기초학력: 성취기준 없음
        standards: track === 'basic' ? [] : area ? area.standards : [],
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
    curriculum: { schoolLevelName: docMeta.schoolLevelName, gradeLabel: docMeta.gradeLabel, curriculumName: docMeta.curriculumName, subjectName: docMeta.subjectName, subjectId: docMeta.subjectId },
    // 지필평가 계획서처럼 자료의 시험 범위 — 단원명(적힌 그대로) · 성취기준 코드
    track,
    skill,
    examScope: { units: (meta.scopeUnits || []).map(String).filter(Boolean), standardCodes: (meta.standardCodes || []).map(String) },
    itemIds: items.map((i) => i.id),
    // 원본 쪽 — 그림 범위 조정·새로 자르기 (QBK-01 문항 편집). [분할 추출] 문항이 나온 쪽만 보관한다 (책 한 권을 다 담으면 저장소가 커진다)
    pageImages: pageImagesOf(pages.filter((p) => pagesOfItems(items).has(p.no))),
    uploadedAt: now,
  };
  return { source, passages, items, summaryIssues, range, meta, failed };
};
