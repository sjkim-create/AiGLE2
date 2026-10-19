/**
 * narration.js — 풀이 과정 보기 음성 설명 (TSK-10 · 로컬 프로토 코드 · 시연용)
 *
 * 자막 = 꼭 봐야 하는 짧은 정리 / 음성 = 교사가 옆에서 풀어 주는 설명(원고가 따로 있다)
 *   · 문항 하나 · 언어 하나의 설명을 한 번에 만든 음성 파일 하나 — 목소리가 중간에 바뀌지 않는다
 *   · 도입(필기 전) → 장면마다 설명(필기 장면 · 멈춤 장면) → 마무리(필기 후)
 *   · 소리가 주인이고 필기가 따라간다 — 장면 설명 길이에 맞춰 필기 배속을 바꾼다(lib/penTiming.js fitWriting)
 * 실제는 결과 발송 때 서버에서 원고 · 음성을 만들어 채점 결과와 함께 저장한다.
 * 프로토는 scripts/narration/generate.mjs 로 유리함수 샘플만 미리 만들어 public/audio/narration/ 에 둔다.
 *   narration.json = { [voiceKey(lang, 문항 글)]: { file, sec, intro:[a0,a1], segs:[[a0,a1] | null, …], outro:[a0,a1], script } }
 *   segs는 문항의 모든 장면(단계 순서 · 장면 순서)과 1:1 — null이면 그 장면은 말 없이 필기만
 */

/* 글 → 음성 키 (FNV-1a) — 생성 스크립트와 화면이 같은 함수를 쓴다 */
export const voiceKey = (lang, text) => {
  let h = 0x811c9dc5;
  const s = `${lang}|${text}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${lang}-${h.toString(16).padStart(8, '0')}`;
};

const BASE = `${import.meta.env?.BASE_URL || '/'}audio/narration/`;
let cache = null;

/* 음성 설명 목록 — 한 번만 읽는다. 없으면 빈 목록(음성 버튼이 나오지 않는다) */
export const loadNarration = async () => {
  if (cache) return cache;
  try {
    const r = await fetch(`${BASE}narration.json`, { cache: 'no-cache' });
    cache = r.ok ? await r.json() : {};
  } catch {
    cache = {};
  }
  return cache;
};

/* 문항(한국어 원문 글) · 언어의 음성 설명 — 없으면 null */
export const narrationOf = (m, qText, lang) => {
  const n = m?.[voiceKey(lang, qText)];
  return n ? { ...n, url: `${BASE}${n.file}` } : null;
};
