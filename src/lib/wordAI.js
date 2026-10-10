/**
 * wordAI — 낱말 문제집 AI 낱말 만들기 (TSK-15 v1.36 · 로컬 프로토 코드)
 *
 * 핵심평가영역 · 성취기준(교육과정 DB)과 학교급 · 학년을 근거로 Gemini가 낱말(단어 · 숙어)과 한글 뜻을 만든다.
 *   · 성취기준에는 단어 목록이 없다 — AI가 학년 수준에 맞을 낱말을 「추정」한다. 교사 확인이 필요하다.
 *   · 호출 1회 = 한 번 만들기. 키는 로컬 개발 환경(.env.development.local)에만 있다 — 배포 판에서는 쓸 수 없다.
 *   · 프롬프트 본문은 PRD에 적지 않는다(「추후 설정 필요」). 상용에서는 서버(Prompt Studio)로 옮긴다.
 */
import { callGeminiJson } from './taskFromFile';

const LEVEL_CODE = { 초등학교: 'ELEMENTARY', 중학교: 'MIDDLE', 고등학교: 'HIGH' };

// 학교급 · 학년 · 교과(· 과목) → 그 학년군 교과의 핵심평가영역 · 성취기준
//   카탈로그: curricula{gradeId} → subjects{curriculumId} → areas{subjectId} · standards[code] = [순번, areaId, text]
export const catalogStandardsFor = (cat, cur = {}) => {
  if (!cat || !LEVEL_CODE[cur.schoolLevelName] || !cur.curriculumName) return { areas: [], standards: [] };
  const gradesOfLevel = Object.entries(cat.grades).filter(([, g]) => g.level === LEVEL_CODE[cur.schoolLevelName]);
  const exact = gradesOfLevel.filter(([, g]) => g.name === cur.gradeLabel);
  const gradeIds = (exact.length ? exact : gradesOfLevel).map(([id]) => Number(id));
  const curIds = Object.entries(cat.curricula).filter(([, c]) => c.name === cur.curriculumName && gradeIds.includes(Number(c.gradeId))).map(([id]) => Number(id));
  let subIds = Object.entries(cat.subjects).filter(([, s]) => curIds.includes(Number(s.curriculumId))).map(([id, s]) => ({ id: Number(id), name: s.name }));
  const exactSub = subIds.filter((s) => s.name === cur.subjectName);
  if (exactSub.length) subIds = exactSub;
  const sid = subIds.map((s) => s.id);
  const areaName = Object.fromEntries(Object.entries(cat.areas).filter(([, a]) => sid.includes(Number(a.subjectId))).map(([id, a]) => [Number(id), a.name]));
  const standards = Object.entries(cat.standards)
    .filter(([, v]) => areaName[Number(v[1])])
    .map(([code, v]) => ({ code, areaName: areaName[Number(v[1])], text: v[2] }))
    .sort((a, b) => a.code.localeCompare(b.code, 'ko', { numeric: true }));
  const areas = [...new Set(standards.map((s) => s.areaName))];
  return { areas, standards };
};

export const WORD_KINDS = { word: '단어', idiom: '숙어', both: '단어 + 숙어' };

const buildWordPrompt = ({ cur, standards, count, kind, existing }) => [
  '너는 한국 초·중·고 영어 교사를 돕는 어휘 출제 도우미다. 아래 조건에 맞는 영어 낱말과 한글 뜻을 JSON으로만 답한다.',
  `학교급·학년: ${cur.schoolLevelName || '미지정'} ${cur.gradeLabel || ''} / 교과·과목: ${cur.curriculumName || '영어'} · ${cur.subjectName || ''}`,
  '근거 성취기준(2022 개정 교육과정):',
  ...standards.map((s) => `- ${s.code} (${s.areaName}) ${s.text}`),
  `만들 개수: ${count}개 · 종류: ${kind === 'idiom' ? '숙어(두 단어 이상 표현)만' : kind === 'both' ? '단어와 숙어를 섞어서(숙어는 30% 안팎)' : '단어만'}`,
  '규칙:',
  '- 해당 학년이 실제로 배우는 수준(교육부 영어과 기본 어휘 수준)을 넘지 않게 고른다. 초등은 아주 쉬운 생활 어휘 위주.',
  '- 성취기준의 상황·주제(일상생활, 문화, 담화 등)와 관련된 낱말을 우선한다.',
  '- 뜻은 그 학년이 쓰는 자연스러운 한글로, 여러 뜻이면 쉼표로 2개까지.',
  '- 고유명사·비속어·중복은 넣지 않는다.',
  existing.length ? `- 이미 있는 낱말은 빼라: ${existing.slice(0, 200).join(', ')}` : '',
  '응답 형식: {"words":[{"word":"apple","meaning":"사과","type":"word","standard":"[6영01-03]"}]}  type은 word 또는 idiom, standard는 근거 성취기준 코드 하나.',
].filter(Boolean).join('\n');

// → [{ word, meaning, type, standard }]
export const generateWords = async ({ cur, standards, count = 20, kind = 'word', existing = [] }) => {
  const parsed = await callGeminiJson(buildWordPrompt({ cur, standards, count, kind, existing }), []);
  const list = Array.isArray(parsed?.words) ? parsed.words : Array.isArray(parsed) ? parsed : [];
  const seen = new Set();
  return list.map((w) => ({
    word: String(w.word || '').trim(),
    meaning: String(w.meaning || '').trim(),
    type: w.type === 'idiom' || /\s/.test(String(w.word || '').trim()) ? 'idiom' : 'word',
    standard: String(w.standard || '').trim(),
  })).filter((w) => {
    const k = w.word.toLowerCase();
    if (!w.word || seen.has(k)) return false;
    seen.add(k); return true;
  });
};
