/**
 * appLogger.js
 * [SET-01 · SCR-07] 앱 전역 프런트 로그 — 진단용 다운로드
 *
 * 실서비스 프런트에는 이미 모듈 태그 로거(`[시각] [레벨] [모듈] 메시지 | JSON`)가 있고,
 * 교사가 F12 콘솔에서 파일을 내려받아 CS에 보내는 흐름으로 장애를 진단해 왔다.
 * 이 모듈은 그 파일 형식을 그대로 흉내 내어 **화면 안에서 같은 파일을 내려받게** 한다.
 *
 * 설계 결정 (2026-09-14, 실제 로그 aigle_front_log_2026-09-07.log 분석 기반)
 *   · 로그는 앱 전역이다 — AiGLE Connect 소켓·USB 펜 모니터는 앱이 뜨는 순간부터 돈다.
 *     그래서 다운로드의 정본 위치도 앱 전역인 **환경설정 > AiGLE Connect 관리** 카드다.
 *   · 크래들 모달 안에서는 헤더 ⋯ 메뉴와, 장애가 반복될 때의 인라인 안내에서 **같은 파일**을 내려받는다.
 *   · 실제 로그의 결함 두 가지를 여기서 바로잡는다 —
 *       `"error":{}` 빈 객체(메시지·코드가 직렬화되지 않음) → message·code·stack을 남긴다
 *       `allCookies`·토큰 값이 그대로 찍힘 → 다운로드 시 마스킹한다
 *   · 파일명에 교사 ID를 넣는다. 날짜만 있으면 여러 교사의 파일이 섞였을 때 구분이 안 된다.
 */

const STORAGE_KEY = 'aigle:frontLog';
const MAX_LINES = 4000;          // 메모리·저장 상한 (실제 3시간 세션이 5,500줄 정도)
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 보관 범위 — 최근 30일 (MAX_LINES와 함께 상한). 다운로드는 날짜 단위로 고른다

const APP_VERSION = 'AiGLE web 2.3 (prototype)';
let connectVersion = '3.0.13';   // 실제로는 GetVersion 응답. 프로토타입은 고정값

let buffer = [];
const listeners = new Set();

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) buffer = JSON.parse(raw).slice(-MAX_LINES);
  } catch (_) { buffer = []; }
};
const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_LINES))); } catch (_) { /* 저장 불가 환경 무시 */ }
};
load();

/** 에러를 남길 때는 반드시 message·code·stack이 살아 있게 */
const normalizeData = (data) => {
  if (data == null) return {};
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v instanceof Error) out[k] = { message: v.message, name: v.name, stack: (v.stack || '').split('\n').slice(0, 3).join(' | ') };
    else if (v && typeof v === 'object' && 'message' in v) out[k] = { message: v.message, code: v.code, status: v.status };
    else out[k] = v;
  });
  return out;
};

/** 다운로드 파일에 실리면 안 되는 값 — 쿠키·토큰류 */
const SENSITIVE_KEYS = /cookie|token|authorization|password|secret/i;
const mask = (data) => {
  const out = {};
  Object.entries(data || {}).forEach(([k, v]) => { out[k] = SENSITIVE_KEYS.test(k) ? '***' : v; });
  return out;
};

export const log = (level, module, message, data) => {
  const entry = { t: new Date().toISOString(), level, module, message, data: normalizeData(data) };
  buffer.push(entry);
  if (buffer.length > MAX_LINES) buffer = buffer.slice(-MAX_LINES);
  persist();
  listeners.forEach((fn) => { try { fn(entry); } catch (_) { /* noop */ } });
  return entry;
};
export const info = (module, message, data) => log('INFO', module, message, data);
export const warn = (module, message, data) => log('WARN', module, message, data);
export const error = (module, message, data) => log('ERROR', module, message, data);
export const debug = (module, message, data) => log('DEBUG', module, message, data);

/** 새 로그가 쌓일 때 알림 — 화면이 장애 반복을 감지하는 데 쓴다 */
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const setConnectVersion = (v) => { connectVersion = v; };

/** 최근 24시간 안에서 특정 조건(장애)에 해당하는 줄 수 */
export const countRecent = (predicate, sinceMs = RETENTION_MS) => {
  const since = Date.now() - sinceMs;
  return buffer.filter((e) => new Date(e.t).getTime() >= since && predicate(e)).length;
};

const formatLine = (e) => {
  const d = mask(e.data);
  const tail = Object.keys(d).length ? ` | ${JSON.stringify(d)}` : '';
  return `[${e.t}] [${e.level}] [${e.module}] ${e.message}${tail}`;
};

/** 로컬 날짜 키 YYYY-MM-DD */
const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** 로그가 있는 날짜 목록 — 최신 순. 다운로드 다이얼로그의 선택지 */
export const availableDates = () => {
  const since = Date.now() - RETENTION_MS;
  const set = new Set(buffer.filter((e) => new Date(e.t).getTime() >= since).map((e) => dayKey(e.t)));
  return [...set].sort().reverse();
};

/** 파일 본문 — 머리에 환경 요약, 이어서 로그. date(YYYY-MM-DD)를 주면 그 날만, 없으면 보관 전체 */
export const buildLogText = ({ teacherId = 'unknown', date = null } = {}) => {
  const since = Date.now() - RETENTION_MS;
  const lines = buffer.filter((e) => new Date(e.t).getTime() >= since && (!date || dayKey(e.t) === date));
  const header = [
    '# AiGLE front log',
    `# generated : ${new Date().toISOString()}`,
    `# teacher   : ${teacherId}`,
    `# app       : ${APP_VERSION}`,
    `# connect   : AiGLE Connect ${connectVersion}`,
    `# ua        : ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
    `# range     : ${date || 'all (30d)'} · ${lines.length} lines (ERROR ${lines.filter((e) => e.level === 'ERROR').length} · WARN ${lines.filter((e) => e.level === 'WARN').length})`,
    '# note      : cookie/token 값은 마스킹됨. 학생 이름은 기록하지 않음',
    '',
  ];
  return header.concat(lines.map(formatLine)).join('\n');
};

const pad = (n) => String(n).padStart(2, '0');
export const logFileName = (teacherId = 'unknown', date = null) => {
  const d = new Date();
  const range = date ? date.replace(/-/g, '') : 'all';
  return `aigle-log_${teacherId}_${range}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.log`;
};

/** 브라우저 다운로드 트리거. 반환값은 파일명 (토스트용) */
export const downloadLog = ({ teacherId = 'unknown', date = null } = {}) => {
  const name = logFileName(teacherId, date);
  info('appLogger', '로그 다운로드', { fileName: name, range: date || 'all', lines: buffer.length });
  const blob = new Blob([buildLogText({ teacherId, date })], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
};

export const clearLog = () => { buffer = []; persist(); };

/* 앱 기동 로그 — 실제 서비스가 남기는 첫 줄들과 같은 모듈명을 쓴다 */
if (typeof window !== 'undefined' && !window.__aigleLoggerBooted) {
  window.__aigleLoggerBooted = true;
  /* 프로토타입 시연용 — 지난 세션이 없으면 며칠 전 로그를 심어 날짜 선택지를 만든다 (실서비스는 실제 기록이 쌓인다) */
  if (buffer.length === 0) {
    const daysAgo = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const seed = [
      [3, 9, 2, 'INFO', 'usb-pen-monitor', 'USB 펜 전역 모니터 시작', {}],
      [3, 9, 31, 'INFO', 'usePenDataBatchUploadModalController', '펜 데이터 읽기 시작', { penCount: 10 }],
      [3, 9, 33, 'INFO', 'useBatchUploadPipeline', '일괄 업로드 시작', { collectedCount: 9, excludedCount: 1 }],
      [2, 14, 5, 'INFO', 'usb-pen-monitor', 'USB 펜 전역 모니터 시작', {}],
      [2, 14, 6, 'ERROR', 'aigle-connect-socket', 'WebSocket send error', { error: { message: 'socket closed', code: 'E-WS-CLOSED' } }],
      [2, 14, 6, 'INFO', 'usb-pen-monitor', '브릿지 연결 종료 — 읽기 중단(목록은 유지)', {}],
      [1, 10, 12, 'INFO', 'usb-pen-monitor', 'USB 펜 전역 모니터 시작', {}],
    ];
    seed.forEach(([n, h, m, level, module, message, data]) => buffer.push({ t: daysAgo(n, h, m), level, module, message, data }));
    persist();
  }
  info('usb-pen-monitor', 'USB 펜 전역 모니터 시작');
  info('aigle-connect-socket', 'OPEN DevServer socket');
  info('bridgeEventMonitor', '브릿지 push 이벤트 전역 구독 시작');
}

export default { log, info, warn, error, debug, subscribe, countRecent, availableDates, buildLogText, downloadLog, clearLog, setConnectVersion };
