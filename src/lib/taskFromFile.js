/**
 * taskFromFile.js — 「파일로 과제 생성」: 평가 문항 PDF/이미지 → 과제 객체
 *
 * 흐름: 파일을 쪽 이미지로 렌더 → Gemini가 문항·채점 기준·성취기준 코드·그림 위치를 구조화
 *      → 성취기준 코드로 교육과정 카탈로그(src/data/aigleCatalog.json, 「아이글_과제 생성 정보.xlsx」 변환본)에서 ID 확정
 *      → 그림 영역을 잘라 모범답안·문항에 붙임 → 부족한 항목(issues) 목록과 함께 반환
 *
 * ⚠️ 보안: geminiGrading.js와 같이 VITE_GEMINI_API_KEY를 브라우저에서 직접 쓴다 → 로컬 dev 전용.
 * ⚠️ AI 평가 기준표(autoRubric)는 서버 rubricId가 있어야 해서 만들 수 없다 → 자율 평가 기준표로만 생성.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { openPdf } from './pdfSplit';

export const MAX_PAGES = 10;
export const MAX_FILE_MB = 20;
const RENDER_W = 1400;
// 앞에서부터 시도 — 혼잡(503)·한도(429)·종료(404)면 다음 모델로 넘어간다.
// gemini-2.0/2.5-flash는 종료됨(404). 2026-10 기준 이 키로 호출 가능한 flash 계열
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

const getApiKey = () => (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
export const isFileGenerateAvailable = () => getApiKey().length > 0;

// 단계별 실패 — 화면이 사유와 할 일을 그대로 보여 준다
export class GenerateError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

// ───────────────────── 1. 파일 → 쪽 이미지 ─────────────────────
const canvasToJpeg = (canvas, q = 0.85) => canvas.toDataURL('image/jpeg', q);

const loadImageFile = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
  img.src = url;
});

/** @returns {Promise<{pages: {no, canvas, dataUrl}[], totalPages: number}>} */
export const readFilePages = async (file) => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = /^image\/(png|jpe?g|webp)$/.test(file.type);
  if (!isPdf && !isImage) {
    throw new GenerateError('FILE_TYPE', 'PDF 또는 이미지(JPG·PNG) 파일만 올릴 수 있습니다.', '파일 형식을 확인해 주세요.');
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new GenerateError('FILE_SIZE', `파일이 ${MAX_FILE_MB}MB를 넘습니다.`, '쪽 수를 줄이거나 해상도를 낮춰 다시 올려 주세요.');
  }

  if (isImage) {
    let img;
    try { img = await loadImageFile(file); } catch {
      throw new GenerateError('FILE_OPEN', '이미지를 열 수 없습니다.', '파일이 손상되지 않았는지 확인해 주세요.');
    }
    const scale = Math.min(1, RENDER_W / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { pages: [{ no: 1, canvas, dataUrl: canvasToJpeg(canvas) }], totalPages: 1 };
  }

  let doc;
  try { doc = await openPdf(file); } catch (err) {
    throw new GenerateError('FILE_OPEN',
      err?.name === 'PasswordException' ? '암호가 걸린 PDF입니다.' : 'PDF를 열 수 없습니다 (손상된 파일).',
      err?.name === 'PasswordException' ? '암호를 풀고 다시 올려 주세요.' : '다시 저장한 뒤 올려 주세요.');
  }
  const pages = [];
  const count = Math.min(doc.numPages, MAX_PAGES);
  for (let p = 1; p <= count; p += 1) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, RENDER_W / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas, intent: 'print' }).promise;
    pages.push({ no: p, canvas, dataUrl: canvasToJpeg(canvas) });
  }
  return { pages, totalPages: doc.numPages };
};

// ───────────────────── 2. AI 구조화 ─────────────────────
// 프롬프트 본문은 PRD에 두지 않는다 (코드에만 존재)
const buildPrompt = (pageCount) => `당신은 한국 초·중·고 서·논술형 평가 문항 자료를 디지털 과제로 옮기는 담당자입니다.
첨부한 ${pageCount}장의 이미지는 하나의 평가 문항 자료(PDF)를 쪽 순서대로 렌더한 것입니다(1쪽부터).
자료에 적힌 내용만 옮기고, 없는 내용은 지어내지 마세요. 없는 값은 빈 문자열·빈 배열·null로 둡니다.

추출 규칙
- title: 평가 과제명(서·논술형 문항 제목). 없으면 학습 목표를 짧게.
- schoolLevel: ELEMENTARY | MIDDLE | HIGH (자료의 학교급·학년·성취기준 코드로 판단, 모르면 "")
- studentGrade: 자료에 적힌 학년 그대로 (예: "3학년")
- subject: 교과명 (예: "국어")
- standardCodes: 자료에 적힌 성취기준 코드를 대괄호 없이 그대로 (예: "4국06-02")
- competencies: 자료에 핵심 역량·교과 역량이 적혀 있으면 그 이름. 없으면 빈 배열.
- passage: 문항과 별개인 공통 지문(제시문). 없으면 "".
- questions: 서·논술형 문항마다 1개
  - content: 발문 + 조건/보기 전체 (줄바꿈 유지)
  - modelAnswer: 예시 답안·모범 답안 글 전체 (출처 줄 포함, 줄바꿈 유지)
  - criteria: 채점 기준표의 평가 요소마다 1개. name=평가 요소, levels=척도(높은 순) [{label: 척도명(예: 능숙), content: 행동 특성}], feedback=피드백 문구, points=배점 숫자(자료에 있을 때만, 없으면 null)
  - images: 이 문항에 딸린 사진·그림·도표(장식용 아이콘·로고·머리글 그림 제외). where = "question"|"modelAnswer", page = 쪽 번호, box_2d = [ymin, xmin, ymax, xmax] (그 쪽 이미지 기준 0~1000 정규화), label = 무엇의 그림인지
- unreadable: 이모티콘이 □로 보이는 등 읽을 수 없거나 옮기지 못한 부분을 한 줄씩 설명 (위치 포함)
- isAssignment: 평가 문항 자료가 맞으면 true. 문항을 찾을 수 없으면 false + reason에 이유.

JSON만 응답:
{"isAssignment":true,"reason":"","title":"","schoolLevel":"","studentGrade":"","subject":"","standardCodes":[],"competencies":[],"passage":"",
"questions":[{"content":"","modelAnswer":"","criteria":[{"name":"","levels":[{"label":"","content":""}],"feedback":"","points":null}],"images":[{"where":"modelAnswer","page":1,"box_2d":[0,0,0,0],"label":""}]}],
"unreadable":[]}`;

const extractJson = (text) => {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
};

/**
 * Gemini에 프롬프트 + 쪽 이미지를 보내 JSON을 받는다 (서·논술형·정답형 공용)
 * 혼잡(503)·한도(429)·종료(404)면 MODELS 순서로 넘어가며 최대 3바퀴 재시도
 * @returns {Promise<object>} 파싱된 JSON — 파싱 실패 시 GenerateError('AI_PARSE')
 */
export const callGeminiJson = async (prompt, pages) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GenerateError('NO_KEY', 'AI 분석을 쓸 수 없는 환경입니다 (Gemini API 키 없음).',
      '로컬 개발 환경(.env.development.local에 VITE_GEMINI_API_KEY)에서만 동작합니다.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const parts = [
    { text: prompt },
    ...pages.map((p) => ({ inlineData: { mimeType: 'image/jpeg', data: p.dataUrl.split(',')[1] } })),
  ];
  let text;
  let lastMsg = '';
  // 혼잡(503)은 호출마다 성공·실패가 갈린다 — 모델 목록을 최대 3바퀴, 바퀴 사이 잠깐 쉬고 다시 돈다
  let fatal = false;
  for (let round = 0; round < 3 && text == null && !fatal; round += 1) {
    if (round) await new Promise((r) => setTimeout(r, 2000 * round));
    for (const name of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: name, generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } });
        text = (await model.generateContent(parts)).response.text();
        break;
      } catch (err) {
        lastMsg = String(err?.message || '');
        if (!/(503|429|404)|high demand|overloaded|quota|exhausted|not found|no longer available/i.test(lastMsg)) { fatal = true; break; } // 키·네트워크 문제는 다시 해도 안 됨
      }
    }
  }
  if (text == null) {
    const busy = /503|429|high demand|overloaded|quota|exhausted/i.test(lastMsg);
    throw new GenerateError('AI_CALL',
      busy ? 'AI 서버가 혼잡하거나 사용량 한도를 넘었습니다.' : 'AI 분석 요청이 실패했습니다.',
      busy ? '잠시 후 다시 시도해 주세요.' : `네트워크·키 상태를 확인해 주세요. (${lastMsg.slice(0, 160)})`);
  }
  const parsed = extractJson(text);
  if (!parsed) {
    throw new GenerateError('AI_PARSE', 'AI 응답을 형식에 맞게 읽지 못했습니다.', '다시 시도해 주세요. 반복되면 쪽 수를 줄여 올려 주세요.');
  }
  return parsed;
};

export const analyzePages = async (pages) => {
  const parsed = await callGeminiJson(buildPrompt(pages.length), pages);
  if (parsed.isAssignment === false || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new GenerateError('NOT_ASSIGNMENT', '파일에서 서·논술형 문항을 찾지 못했습니다.',
      parsed.reason || '문항(발문)이 들어 있는 평가 자료인지 확인해 주세요.');
  }
  return parsed;
};

// ───────────────────── 3. 교육과정 카탈로그 매칭 ─────────────────────
let catalogPromise = null;
export const loadCatalog = () => {
  // 0.6MB — 이 기능을 쓸 때만 불러온다
  if (!catalogPromise) catalogPromise = import('../data/aigleCatalog.json').then((m) => m.default || m);
  return catalogPromise;
};

const normCode = (c) => `[${String(c || '').replace(/[[\]\s]/g, '')}]`;
const normName = (s) => String(s || '').replace(/[\s·⋅‧ㆍ・.]/g, '');

// 학년 → 학년군 라벨 (카탈로그 grade name과 비교)
const gradeBandFor = (level, studentGrade) => {
  const n = parseInt(String(studentGrade || '').replace(/[^0-9]/g, ''), 10);
  if (level === 'ELEMENTARY' && n) return n <= 2 ? '1-2학년' : n <= 4 ? '3-4학년' : '5-6학년';
  if (level === 'MIDDLE' || level === 'HIGH') return '1-3학년';
  return '';
};

export const matchCatalog = (cat, ai, issues) => {
  const codes = [...new Set([...(ai.standardCodes || []), ...(ai.questions || []).flatMap((q) => q.standardCodes || [])])];
  const standards = [];
  const missed = [];
  codes.forEach((c) => {
    const hit = cat.standards[normCode(c)];
    if (!hit) { missed.push(normCode(c)); return; }
    const [id, areaId, text] = hit;
    standards.push({ id, code: normCode(c), text, areaId, areaName: cat.areas[areaId]?.name || '' });
  });
  if (missed.length) {
    issues.push({ level: 'warn', field: '성취기준', message: `파일의 성취기준 코드 ${missed.join(', ')}를 교육과정 목록에서 찾지 못했습니다. 상세 화면에서 직접 선택해 주세요.` });
  }

  let subjectId = null;
  if (standards.length) {
    subjectId = cat.areas[standards[0].areaId]?.subjectId ?? null;
    const others = standards.filter((s) => cat.areas[s.areaId]?.subjectId !== subjectId);
    if (others.length) {
      issues.push({ level: 'warn', field: '과목', message: `성취기준이 서로 다른 과목에 걸쳐 있습니다 (${others.map((s) => s.code).join(', ')}). 첫 성취기준의 과목으로 등록했습니다.` });
    }
  } else {
    // 코드가 없을 때 — 학교급·학년·교과명으로 과목까지만 추정
    const band = gradeBandFor(ai.schoolLevel, ai.studentGrade);
    const subj = Object.entries(cat.subjects).find(([, s]) => {
      const cu = cat.curricula[s.curriculumId];
      const gr = cat.grades[cu?.gradeId];
      return gr && gr.level === ai.schoolLevel && (!band || gr.name === band)
        && normName(cu.name) === normName(ai.subject) && normName(s.name) === normName(ai.subject);
    });
    if (subj) {
      subjectId = Number(subj[0]);
      issues.push({ level: 'warn', field: '성취기준', message: '파일에 성취기준 코드가 없어 학교급·학년·교과로 과목만 맞췄습니다. 핵심평가영역과 성취기준을 직접 선택해 주세요.' });
    } else {
      issues.push({ level: 'error', field: '교육과정', message: '학교급·학년·교과를 교육과정 목록과 맞추지 못했습니다. 상세 화면에서 학교급부터 직접 선택해 주세요.' });
    }
  }

  const subject = subjectId != null ? cat.subjects[subjectId] : null;
  const curriculumId = subject?.curriculumId ?? null;
  const curriculum = curriculumId != null ? cat.curricula[curriculumId] : null;
  const gradeId = curriculum?.gradeId ?? null;
  const grade = gradeId != null ? cat.grades[gradeId] : null;
  const level = grade ? cat.levels[grade.level] : null;

  // 교과 역량 — 파일에 적힌 이름만 해당 교육과정 역량 목록과 맞춘다
  const competencies = [];
  if (curriculum) {
    const pool = Object.entries(curriculum.competencies);
    (ai.competencies || []).forEach((name) => {
      const hit = pool.find(([, n]) => normName(n) === normName(name) || normName(n).includes(normName(name)));
      if (hit && !competencies.some((c) => c.id === Number(hit[0]))) competencies.push({ id: Number(hit[0]), name: hit[1] });
    });
  }
  if (!competencies.length) {
    issues.push({ level: 'info', field: '교과 역량', message: '파일에 교과 역량이 적혀 있지 않아 비워 두었습니다. 필요하면 상세 화면에서 선택해 주세요.' });
  }

  return {
    schoolLevelKey: grade?.level || ai.schoolLevel || '',
    schoolLevelCode: level?.code ?? null,
    schoolLevelName: level?.name || '',
    gradeId, gradeLabel: grade?.name || '',
    curriculumId, curriculumName: curriculum?.name || ai.subject || '',
    subjectId, subjectName: subject?.name || '',
    competencies,
    standards,
  };
};

// ───────────────────── 4. 그림 자르기 ─────────────────────
export const cropImage = (pages, img) => {
  const page = pages.find((p) => p.no === Number(img.page));
  const b = img.box_2d;
  if (!page || !Array.isArray(b) || b.length !== 4) return null;
  const [y0, x0, y1, x1] = b.map(Number);
  if (![y0, x0, y1, x1].every(Number.isFinite) || y1 <= y0 || x1 <= x0) return null;
  const { canvas } = page;
  const pad = 8; // 테두리 잘림 방지
  const sx = Math.max(0, Math.floor((x0 / 1000) * canvas.width) - pad);
  const sy = Math.max(0, Math.floor((y0 / 1000) * canvas.height) - pad);
  const sw = Math.min(canvas.width - sx, Math.ceil(((x1 - x0) / 1000) * canvas.width) + pad * 2);
  const sh = Math.min(canvas.height - sy, Math.ceil(((y1 - y0) / 1000) * canvas.height) + pad * 2);
  if (sw < 24 || sh < 24) return null;
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = canvasToJpeg(out);
  return { label: img.label || '그림', dataUrl, bytes: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75) };
};

// ───────────────────── 5. 채점 기준 → 자율 평가 기준표 ─────────────────────
const DEFAULT_SCORES = { 2: [5, 2], 3: [5, 3, 1], 4: [4, 3, 2, 1], 5: [5, 4, 3, 2, 1] };

const buildCriteria = (q, qi, issues) => {
  const src = (q.criteria || []).filter((c) => c && (c.name || (c.levels || []).length));
  let usedDefault = false;
  const criteria = src.slice(0, 5).map((c, ci) => {
    const levels = (c.levels || []).filter((l) => l && (l.label || l.content)).slice(0, 5);
    const n = Math.max(2, levels.length || 3);
    const top = Number(c.points) > 0 ? Number(c.points) : null;
    if (!top) usedDefault = true;
    const scores = top
      ? Array.from({ length: n }, (_, i) => Math.round((top * (n - i)) / n))
      : DEFAULT_SCORES[n] || DEFAULT_SCORES[3];
    return {
      id: `fg-q${qi + 1}-c${ci + 1}`,
      name: c.name || `채점 기준 ${ci + 1}`,
      maxPoints: scores[0],
      levels: Array.from({ length: n }, (_, i) => ({ label: levels[i]?.label || '', score: scores[i], content: levels[i]?.content || '' })),
      feedback: c.feedback || '',
    };
  });
  if (src.length > 5) issues.push({ level: 'warn', field: `문항 ${qi + 1} 채점 기준`, message: `채점 기준이 ${src.length}개라 앞의 5개만 옮겼습니다 (최대 5개).` });
  if (!criteria.length) {
    issues.push({ level: 'warn', field: `문항 ${qi + 1} 채점 기준`, message: '파일에서 채점 기준표를 찾지 못했습니다. 채점 전에 직접 작성해 주세요.' });
  } else if (usedDefault) {
    issues.push({ level: 'info', field: `문항 ${qi + 1} 배점`, message: `파일에 배점이 없어 척도별 기본 배점(${criteria.map((c) => c.levels.map((l) => l.score).join('/')).join(', ')}점)을 넣었습니다.` });
  }
  if (criteria.some((c) => c.feedback)) {
    issues.push({ level: 'info', field: `문항 ${qi + 1} 피드백`, message: '채점 기준표의 피드백 문구는 기준표에 넣을 칸이 없어 참고용으로만 보관했습니다.' });
  }
  return criteria;
};

// ───────────────────── 전체 실행 ─────────────────────
export const STEPS = [
  { key: 'read', label: '파일 읽기' },
  { key: 'ai', label: 'AI로 문항·채점 기준 분석' },
  { key: 'match', label: '교육과정·성취기준 연결' },
  { key: 'image', label: '그림 정리' },
  { key: 'save', label: '과제 등록' },
];

/**
 * @param {File} file
 * @param {(stepKey: string) => void} onStep
 * @param {{analyze?: (pages) => Promise<object>}} opts  analyze — AI 분석 대체(검증용). 기본 analyzePages
 * @returns {Promise<{draft, issues}>}
 */
export const generateTaskFromFile = async (file, onStep = () => {}, { analyze = analyzePages } = {}) => {
  const issues = [];

  onStep('read');
  const { pages, totalPages } = await readFilePages(file);
  if (totalPages > MAX_PAGES) {
    issues.push({ level: 'warn', field: '파일', message: `${totalPages}쪽 중 앞의 ${MAX_PAGES}쪽만 분석했습니다. 뒤쪽 문항은 빠졌을 수 있습니다.` });
  }

  onStep('ai');
  const [ai, cat] = await Promise.all([analyze(pages), loadCatalog()]);

  onStep('match');
  const meta = matchCatalog(cat, ai, issues);

  onStep('image');
  let imageFail = 0;
  const questions = ai.questions.map((q, qi) => {
    const imgs = (q.images || []).map((im) => ({ where: im.where === 'question' ? 'question' : 'modelAnswer', ...cropImage(pages, im) }));
    imageFail += imgs.filter((im) => !im.dataUrl).length;
    const ok = imgs.filter((im) => im.dataUrl);
    const criteria = buildCriteria(q, qi, issues);
    if (!String(q.modelAnswer || '').trim()) {
      issues.push({ level: 'warn', field: `문항 ${qi + 1} 모범답안`, message: '파일에서 예시(모범) 답안을 찾지 못했습니다. 직접 작성해 주세요.' });
    }
    return {
      id: `fg-q${qi + 1}`,
      content: String(q.content || '').trim(),
      contentImages: ok.filter((im) => im.where === 'question'),
      modelAnswer: String(q.modelAnswer || '').trim(),
      modelAnswerImages: ok.filter((im) => im.where === 'modelAnswer'),
      standards: meta.standards,
      evaluationAreas: [...new Map(meta.standards.map((s) => [s.areaId, { id: s.areaId, name: s.areaName }])).values()],
      criteria,
      points: criteria.reduce((s, c) => s + c.maxPoints, 0),
    };
  });
  const imageCount = questions.reduce((s, q) => s + q.contentImages.length + q.modelAnswerImages.length, 0);
  if (imageCount) issues.push({ level: 'info', field: '그림', message: `그림 ${imageCount}장을 AI가 찾은 위치로 잘라 넣었습니다. 잘린 범위가 맞는지 확인해 주세요.` });
  if (imageFail) issues.push({ level: 'warn', field: '그림', message: `그림 ${imageFail}장은 위치를 정확히 찾지 못해 넣지 못했습니다. 직접 첨부해 주세요.` });
  (ai.unreadable || []).filter(Boolean).forEach((u) => issues.push({ level: 'warn', field: '읽지 못한 내용', message: String(u) }));

  // 항상 — 상용 「AI 평가 기준표」는 서버 rubricId가 필요해 파일로 만들 수 없다
  issues.push({ level: 'info', field: 'AI 평가 기준표', message: 'AI 평가 기준표(자동)는 서버에 등록된 기준표 ID가 필요해 만들 수 없습니다. 파일의 채점 기준으로 자율 평가 기준표를 만들었습니다.' });

  onStep('save');
  const draft = {
    title: String(ai.title || '').trim() || file.name.replace(/\.[^.]+$/, ''),
    meta,
    passage: String(ai.passage || '').trim(),
    questions,
    sourceFile: { name: file.name, size: file.size, pages: totalPages },
  };
  const order = { error: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return { draft, issues };
};
