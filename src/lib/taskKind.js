/**
 * taskKind.js — [2.4] 과제 등록 › 스마트 등록의 과제 형태 추천 (TSK-14 §5A)
 *
 * 자료 앞부분만 읽어(AI 호출 1번) 서·논술형 / 정답형 중 하나를 추천하고 근거를 한 줄로 돌려준다.
 * 형태는 교사가 확정한다 — 여기서는 추천만. 내용 분석은 형태가 정해진 뒤 그 형태의 스마트 등록에서 한다.
 *   서·논술형 = 긴 문장으로 생각을 쓰는 과제(서술형·논술형), 별도 답안지 1~10장
 *   정답형   = 문제와 답 칸이 한 장인 시험지 — 짧은 서술형, 선다형·서술형이 섞인 자료도 정답형
 * 프롬프트 본문은 PRD에 두지 않는다 (코드에만 존재)
 */
import { readFilePages, callGeminiJson, ITEM_MAX_FILE_MB, GenerateError } from './taskFromFile';

export const KIND_PAGES = 3; // 형태 판단은 앞 3쪽만
export const KIND_TIMEOUT_MS = 30000; // 형태 판단 대기 한도 — 넘으면 추천 없이 고르기

const buildKindPrompt = (pageCount) => `당신은 한국 초·중·고 교사가 올린 평가 자료를 보고 과제 형태를 추천합니다. 첨부 이미지는 자료의 앞 ${pageCount}쪽입니다.

과제 형태는 둘 중 하나입니다.
- "essay" (서·논술형): 학생이 긴 문장으로 생각을 쓰는 서술형·논술형 문항만 있고, 문제와 별도인 답안지에 답을 쓰는 모양.
- "answer" (정답형): 선다형·양자택일형·진위형·연결형·단답형·완성형처럼 정답이 정해진 문항이 있거나, 문제지에 바로 답 칸이 있는 시험지 모양. 시험지 안의 짧은 서술형도 정답형. 정답형 문항과 서술형이 섞여 있으면 반드시 "answer".

문항이 하나도 없으면 kind는 null.

JSON 하나만 답하세요:
{"kind":"essay"|"answer"|null,"reason":"교사에게 보여 줄 근거 한 문장(존댓말, 60자 이내)","itemCount":숫자,"types":["선다형","서술형" ...]}`;

/** @returns {Promise<{ kind: 'essay'|'answer'|null, reason: string, itemCount: number, types: string[], totalPages: number }>} */
export const recommendTaskKind = async (file) => {
  // 파일 검사(형식·크기·암호·손상)는 큰 쪽(정답형) 한도로 — 서·논술형으로 정하면 그 등록 화면이 자기 한도로 다시 검사한다
  const { pages, totalPages } = await readFilePages(file, { maxMb: ITEM_MAX_FILE_MB, maxPages: KIND_PAGES });
  // 형태 판단은 추천일 뿐이라 오래 기다리게 하지 않는다 — 시간을 넘기면 교사가 직접 고른다
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new GenerateError('AI_TIMEOUT', 'AI가 형태를 판단하지 못했습니다.', '과제 형태를 직접 골라 주세요.')), KIND_TIMEOUT_MS);
  });
  const r = await Promise.race([callGeminiJson(buildKindPrompt(pages.length), pages), timeout]).finally(() => clearTimeout(timer));
  const kind = r.kind === 'essay' || r.kind === 'answer' ? r.kind : null;
  if (!kind) {
    throw new GenerateError('NOT_ASSIGNMENT', '자료에서 문항을 찾지 못했습니다.', '평가 자료가 맞다면 과제 형태를 직접 골라 주세요.');
  }
  return {
    kind,
    reason: String(r.reason || '').trim(),
    itemCount: Number.isFinite(Number(r.itemCount)) ? Number(r.itemCount) : 0,
    types: Array.isArray(r.types) ? r.types.filter(Boolean).map(String) : [],
    totalPages,
  };
};
