/**
 * geminiGrading.js
 * 로컬 PoC 전용 — Gemini Vision으로 손글씨 서·논술형 답안을 인식하고 루브릭 기준으로 채점한다.
 *
 * ⚠️ 보안: API 키는 import.meta.env.VITE_GEMINI_API_KEY(.env.local)에서 읽는다.
 *   클라이언트에서 직접 호출하므로 키가 번들에 포함된다 → 로컬 dev 전용. 공개 배포 금지.
 *   배포가 필요하면 Firebase Functions 등 백엔드 프록시로 키를 서버에 보관해야 한다.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const getApiKey = () => (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

export const isGeminiConfigured = () => getApiKey().length > 0;

/**
 * 샘플(데모) 채점 결과 — 키가 없는 환경(배포 포함)에서 실제 호출 없이 기능 시연용.
 * 실제 인식이 아니라 고정 샘플이며, 호출/키 노출이 전혀 없다.
 * @param {{gradeScale?: 3|4|5}} p
 */
export function getSampleResult({ gradeScale = 5 } = {}) {
  const gradeByScale = { 3: '우수', 4: '우수', 5: '우수' };
  return {
    sample: true,
    recognizedText:
      '바람을 사람처럼 논다고 표현한 것이 재미있다. 또한 봄에는 기어다니고, 여름에는 그네를 타고, ' +
      '가을에는 글씨를 쓰다니고, 겨울에는 얼음판을 씽씽 내달린다고 표현하여 자라나는 나를 생각하게 되었다. ' +
      '또한, 이 시에서 겨울에는 얼음판을 씽씽 내달린다고 하여 날카로운 바람을 표현한 것에 공감이 간다.',
    grade: gradeByScale[gradeScale] || '우수',
    score: 88,
    rationale:
      '시의 의인법 표현을 정확히 파악하고, 계절별 표현을 근거로 자신의 생각·느낌을 구체적으로 서술했습니다. ' +
      '문항 요구(생각·느낌 서술)에 부합하며 근거가 분명합니다.',
    criteria: [
      { item: '시의 표현(의인법) 파악', met: true, comment: '바람을 사람처럼 표현한 점을 정확히 짚음' },
      { item: '자신의 생각·느낌 서술', met: true, comment: '계절별 표현에 대한 느낌을 구체적으로 기술' },
      { item: '근거 제시', met: true, comment: '겨울 표현(얼음판)을 근거로 공감 서술' },
      { item: '문장 완성도', met: false, comment: '일부 맞춤법·표현 오류 있음(자라나는 나 등)' },
    ],
  };
}

// data URL("data:image/png;base64,XXXX") → { mimeType, base64 }
export function dataUrlToInline(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

// 응답 텍스트에서 JSON 블록만 추출 (```json … ``` 또는 첫 { … 마지막 })
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 샘플(데모) 성취기준 기반 상/중/하 예시 답안 — 키 없는 환경에서 실제 호출 없이 시연용 */
export function getSampleAnchors() {
  return {
    sample: true,
    high: '바람을 사람처럼 표현한 점이 인상 깊다. 봄에는 기어다니고 여름에는 그네를 타며 겨울에는 얼음판을 씽씽 내달린다는 표현에서, 계절마다 다른 바람의 모습을 생생하게 떠올릴 수 있었다. 특히 날카로운 겨울바람을 "씽씽 내달린다"로 표현한 부분이 내 경험과 맞닿아 공감이 갔다.',
    mid: '바람을 사람처럼 표현한 것이 재미있다. 계절마다 바람이 다르게 분다는 점을 알 수 있었고, 겨울 바람이 차갑다는 느낌이 들었다.',
    low: '바람에 대한 시이다. 바람이 분다. 재미있었다.',
  };
}

/**
 * 과제(문제·조건·성취기준)를 분석해 상/중/하 수준 예시 답안(앵커)을 자동 생성한다.
 * @returns {Promise<{high, mid, low, sample?}>}
 */
export async function generateAnchorAnswers({ question, condition, standards, gradeScale = 5 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');

  const prompt = `당신은 초·중·고 서·논술형 문항을 출제하는 한국어 교사입니다.
아래 문제와 성취기준을 분석하여, 학생이 작성할 법한 예시 답안을 수준별로 3개(상/중/하) 생성하세요.
- 상(high): 성취기준을 충실히 달성하고 근거·표현이 풍부한 우수 답안
- 중(mid): 주요 요소는 충족하나 근거나 표현이 다소 부족한 보통 답안
- 하(low): 문항 요구를 일부만 충족하거나 이해가 미흡한 답안
- 각 답안은 실제 학생 말투로 2~4문장. ${gradeScale}등급 채점의 앵커(기준 예시)로 쓰입니다.

[문제]
${question || '(미입력)'}

[조건/보기/지문]
${condition || '(없음)'}

[성취기준]
${standards || '(미입력 — 문제 맥락으로 추론)'}

아래 JSON 형식으로만 응답하세요(코드블록 없이 순수 JSON).
{ "high": "상 수준 예시 답안", "mid": "중 수준 예시 답안", "low": "하 수준 예시 답안" }`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent([{ text: prompt }]);
  const parsed = extractJson(result.response.text());
  return parsed || { high: '', mid: '', low: '', raw: result.response.text() };
}

/**
 * 손글씨 답안 이미지를 인식·채점한다.
 * @param {object} p
 * @param {string} p.question  문제 본문
 * @param {string} p.condition (선택) 조건/보기/지문
 * @param {string} p.rubric    채점 기준(루브릭) — 등급별 서술
 * @param {{high?,mid?,low?}} p.anchors (선택) 수준별 예시 답안(앵커) — 채점 calibration용
 * @param {3|4|5} p.gradeScale 등급 체계 (기본 5)
 * @param {string} p.imageBase64 base64 (prefix 제거)
 * @param {string} p.mimeType  예: 'image/png'
 * @returns {Promise<{recognizedText, grade, score, rationale, criteria}>}
 */
export async function gradeHandwrittenAnswer({ question, condition, rubric, anchors, gradeScale = 5, imageBase64, mimeType }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다. .env.development.local에 키를 넣고 dev 서버를 재시작하세요.');
  }
  if (!imageBase64) throw new Error('답안 이미지가 없습니다.');

  const scaleLevels = {
    3: '우수 / 보통 / 노력',
    4: '매우 우수 / 우수 / 보통 / 노력',
    5: '매우 우수 / 우수 / 보통 / 노력 / 매우 노력',
  }[gradeScale] || '매우 우수 / 우수 / 보통 / 노력 / 매우 노력';

  const prompt = `당신은 초·중·고 서·논술형 답안을 채점하는 한국어 교사입니다.
첨부된 이미지는 학생이 손으로 쓴 답안입니다. 다음 단계를 수행하세요.

[1단계] 손글씨 인식
- 이미지의 한글 손글씨를 최대한 정확히 읽어 그대로 텍스트로 옮깁니다.
- 알아보기 어려운 글자는 추정하되, 추정한 부분은 그대로 두고 별도 표시는 하지 않습니다.
- 인식이 거의 불가능하면 recognizedText를 빈 문자열로 둡니다.

[2단계] 채점
- 아래 문제와 채점 기준(루브릭)에 근거해 ${gradeScale}등급 체계(${scaleLevels})로 등급을 부여합니다.
- score는 0~100 정수 추정치입니다(참고용).
- rationale은 채점 근거를 2~3문장으로 한국어로 작성합니다.
- criteria는 루브릭의 주요 평가 요소별 충족 여부를 배열로 정리합니다.

[문제]
${question || '(문제 미입력)'}

[조건/보기/지문]
${condition || '(없음)'}

[채점 기준 (루브릭)]
${rubric || '(루브릭 미입력 — 일반적 기준으로 채점)'}
${(anchors && (anchors.high || anchors.mid || anchors.low)) ? `
[수준별 예시 답안 (앵커 — 이 예시들과 비교해 등급을 보정하세요)]
- 상(우수 수준): ${anchors.high || '(없음)'}
- 중(보통 수준): ${anchors.mid || '(없음)'}
- 하(미흡 수준): ${anchors.low || '(없음)'}` : ''}

반드시 아래 JSON 형식으로만 응답하세요(코드블록 없이 순수 JSON).
{
  "recognizedText": "인식한 답안 전문",
  "grade": "${gradeScale}등급 중 하나",
  "score": 0,
  "rationale": "채점 근거",
  "criteria": [ { "item": "평가 요소", "met": true, "comment": "한 줄 코멘트" } ]
}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
  ]);
  const text = result.response.text();
  const parsed = extractJson(text);
  if (!parsed) {
    // JSON 파싱 실패 시 원문이라도 인식 결과로 반환
    return { recognizedText: text, grade: '', score: null, rationale: '응답을 구조화하지 못했습니다. 원문을 확인하세요.', criteria: [], raw: text };
  }
  return parsed;
}
