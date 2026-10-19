/**
 * i18n.js — 학생 화면 다국어 (TSK-10 다국어 · 로컬 프로토 코드)
 *
 * 지금은 한국어 · 영어만 켠다. 언어를 늘릴 때는
 *   1) 아래 LANGS에서 그 언어의 enabled를 true로
 *   2) 화면 글자 사전(각 화면의 UI 객체)에 그 언어 키를 추가 — 없는 글자는 한국어로 보인다
 *   3) 채점 결과 데이터에 그 언어 값을 넣는다 — 항목마다 { ..., en: {...}, ja: {...} }
 *      실제는 AI 채점 때 학생 화면 언어로 미리 만들어 둔다(학생은 기다리지 않음). 없으면 한국어 + 안내
 */
import { useEffect, useState } from 'react';

export const BASE_LANG = 'ko';

/* ai = AI에게 「이 언어로 답하라」고 할 때 쓰는 이름 */
export const LANGS = [
  { code: 'ko', label: '한국어', ai: 'Korean', enabled: true },
  { code: 'en', label: 'English', ai: 'English', enabled: true },
  /* 확장 후보(다문화 학생 비중 순) — 켜기 전 화면 글자 · 채점 결과 번역이 먼저 준비돼야 한다 */
  { code: 'zh-CN', label: '简体中文', ai: 'Simplified Chinese', enabled: false },
  { code: 'vi', label: 'Tiếng Việt', ai: 'Vietnamese', enabled: false },
  { code: 'ru', label: 'Русский', ai: 'Russian', enabled: false },
  { code: 'ja', label: '日本語', ai: 'Japanese', enabled: false },
];

export const ACTIVE_LANGS = LANGS.filter((l) => l.enabled);
export const langInfo = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
const isActive = (code) => ACTIVE_LANGS.some((l) => l.code === code);

/* 항목의 언어별 값 — obj[lang][key]가 없으면 한국어 원문 */
export const tr = (obj, key, lang) => (lang !== BASE_LANG && obj?.[lang]?.[key] != null ? obj[lang][key] : obj?.[key]);

/* 이 항목에 그 언어 값이 있는지 — 없으면 화면에 「한국어로 보여요」 안내 */
export const hasLang = (obj, lang) => lang === BASE_LANG || obj?.[lang] != null;

/* 화면 글자 사전 — 그 언어에 없는 글자는 한국어로 채운다 */
export const uiOf = (dict, lang) => (lang === BASE_LANG ? dict[BASE_LANG] : { ...dict[BASE_LANG], ...(dict[lang] || {}) });

/* 학생이 고른 화면 언어 — 기기에 기억한다(다음에 들어와도 그대로) */
const STORE_KEY = 'aigle.student.lang';
const readLang = () => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v && isActive(v) ? v : BASE_LANG;
  } catch {
    return BASE_LANG;
  }
};
export const useStudentLang = () => {
  const [lang, setLang] = useState(readLang);
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* 저장 불가 환경 — 이번 화면에서만 */ }
  }, [lang]);
  return [lang, (v) => setLang(isActive(v) ? v : BASE_LANG)];
};
