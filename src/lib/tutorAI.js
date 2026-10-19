/**
 * tutorAI.js — 학생 결과 확인 「모르겠어요」 다시 설명 · 이어서 묻기 (TSK-10 · 로컬 프로토 코드)
 *
 * ⚠️ 보안: geminiGrading.js와 같이 VITE_GEMINI_API_KEY를 브라우저에서 직접 쓴다 → 로컬 dev 전용.
 *   상용은 서버(채점 서버) 쪽 호출로 옮기고, 질문 · 답변 기록을 교사가 볼 수 있게 남긴다.
 * 키가 없으면 고정 샘플 설명을 글자씩 흘려 보여 준다(호출 없음).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { langInfo } from './i18n';

const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
const getApiKey = () => (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
export const isTutorAvailable = () => getApiKey().length > 0;

/* 한 항목에서 이어서 물을 수 있는 횟수(첫 다시 설명 제외) — 비용 · 집중을 위해 */
export const MAX_FOLLOWUPS = 3;
const REQUEST_TIMEOUT_MS = 20000;

/* ctx: { subject, question, answer[], explained[](학생이 받은 설명 전체), correct[] } · level: 문항 목표 학년 */
const buildSystem = ({ ctx, level, lang }) => {
  const L = langInfo(lang).ai;
  return [
    `You are a kind ${ctx.subject || ''} tutor for a ${level || 'middle/high school'} student who already received graded results.`,
    'The student pressed "I don\'t get it" after reading the whole explanation for this question.',
    'First reply: re-organize the WHOLE explanation from the start, more simply: what the question asks, what the student did right, the one or two things to fix, and how the correct solution goes. At most 6 short sentences.',
    'Follow-up replies: answer only what the student asks, at most 4 short sentences.',
    'Rules:',
    '- Use words and examples that fit the student\'s grade. One idea at a time.',
    '- Refer to what the student actually wrote. Never change, question or discuss the grade or score.',
    '- If the student asks about something unrelated to this item, say briefly that you can only help with this item and suggest asking the teacher.',
    '- No markdown at all (no headings, tables, bold, bullet lists or backticks). Plain sentences; math may use plain symbols (×, −, ≠, /).',
    `- Always reply in ${L}.`,
    '',
    `[Question] ${ctx.question || ''}`,
    `[Student's answer] ${(ctx.answer || []).join(' / ')}`,
    ctx.correct?.length ? `[Correct solution] ${ctx.correct.join(' / ')}` : '',
    `[Explanation the student received]\n${(ctx.explained || []).join('\n')}`,
  ].filter(Boolean).join('\n');
};

/* 첫 요청(다시 설명) — 학생이 아직 아무것도 묻지 않았을 때 보낼 말 */
const FIRST_ASK = {
  ko: '설명이 잘 이해가 안 돼요. 처음부터 쉽게 다시 정리해 주세요.',
  en: "I don't really get the explanation. Can you go over it again simply from the start?",
};
export const firstAskOf = (lang) => FIRST_ASK[lang] || FIRST_ASK.en;

/* 키가 없을 때의 샘플 설명 */
const SAMPLE = {
  ko: () => '샘플 설명이에요. 처음부터 다시 정리해 볼게요. 이 문제는 주어진 조건을 식으로 옮겨 답을 구하는 문제예요. 조건을 식으로 옮긴 부분은 잘했어요. 고칠 곳은 한두 군데뿐이니, 내가 쓴 줄과 바른 풀이를 한 줄씩 나란히 놓고 달라지는 곳을 찾아보세요.',
  en: () => "This is a sample explanation. Let's go over it again from the start. The question asks you to turn the given conditions into an equation and solve it. You did that part well. There are only one or two places to fix, so put your lines next to the correct solution and find where they differ.",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 스트리밍으로 답을 받는다 — onText(지금까지 받은 전체 글)
 * history: [{ role: 'user'|'model', text }] — 마지막이 이번 질문
 * 반환: { text, sample }
 */
export const askTutor = async ({ ctx, level, lang, history, onText, signal }) => {
  if (!isTutorAvailable()) {
    const full = (SAMPLE[lang] || SAMPLE.en)(ctx);
    let out = '';
    for (const ch of full) {
      if (signal?.aborted) break;
      out += ch;
      onText(out);
      await sleep(14);
    }
    return { text: out, sample: true };
  }
  const genAI = new GoogleGenerativeAI(getApiKey());
  const contents = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  let lastErr = null;
  /* 혼잡(503)은 호출마다 갈린다 — 모델 목록을 2바퀴. 응답이 멈추면 끝없이 기다리지 않도록 요청마다 제한 시간 */
  for (let round = 0; round < 2; round += 1) {
    if (round) await sleep(1500);
    for (const name of MODELS) {
      if (signal?.aborted) return { text: '', sample: false };
      try {
        const model = genAI.getGenerativeModel({ model: name, systemInstruction: buildSystem({ ctx, level, lang }), generationConfig: { temperature: 0.4 } }, { timeout: REQUEST_TIMEOUT_MS });
        const res = await model.generateContentStream({ contents });
        let out = '';
        for await (const chunk of res.stream) {
          if (signal?.aborted) break;
          out += chunk.text();
          onText(out);
        }
        if (!out.trim() && !signal?.aborted) throw new Error('empty reply');
        return { text: out.trim(), sample: false };
      } catch (err) {
        lastErr = err;
        if (!/(503|429|404)|high demand|overloaded|quota|exhausted|not found|no longer available|timeout|timed out|abort|empty reply/i.test(String(err?.message || ''))) throw err;
        onText(''); // 다른 모델로 다시 — 쓰던 글은 지운다
      }
    }
  }
  throw lastErr || new Error('tutor failed');
};
