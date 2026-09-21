/**
 * penRawStore.js
 * [BRD-16 v1.7 · SET-01] 펜 원본 진단 파일 — 채점 때마다 로컬에 쌓고, 장애신고 때 zip 으로 보낸다
 *
 * 실서비스 동작 (AiGLE Connect 가 수행)
 *   · 채점(크래들 일괄 채점 · 개별 펜 동기화)할 때마다 펜에서 읽은 원본 데이터를 로컬 폴더에 저장한다
 *       {루트}\{채점 일시}\{펜 MAC}\{s}.{o}.{b}.raw   — s/o/b = Ncode 섹션·오너·북 (답안지 종류 단위)
 *   · 로컬에는 최근 5회 채점분만 남긴다 (6회째 저장 시 가장 오래된 폴더 삭제)
 *   · [장애신고] → 루트 폴더 전체를 zip 으로 묶어 서버에 전송하고, 전송이 끝나면 로컬 파일을 지운다
 *   · 舊 「펜 데이터 다운로드(교사가 파일을 받아 고객센터에 전달)」 흐름을 대체한다
 *
 * 프로토타입은 폴더 구조와 파일 목록만 localStorage 에 흉내 낸다 (실파일 없음).
 */

const STORAGE_KEY = 'aigle:penRaw';
export const PEN_RAW_ROOT = 'AiGLE-PEN-RAW\\';
export const PEN_RAW_KEEP = 5;

let sessions = [];
const listeners = new Set();

const load = () => {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) sessions = JSON.parse(raw); } catch (_) { sessions = []; }
};
const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch (_) { /* 저장 불가 환경 무시 */ }
  listeners.forEach((fn) => { try { fn(sessions); } catch (_) { /* noop */ } });
};
load();

const pad = (n) => String(n).padStart(2, '0');
const folderStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const macFolder = (mac) => String(mac || '').replace(/:/g, '').toUpperCase();

/** 북코드 → s.o.b (프로토타입 고정 규칙. 실제는 펜이 읽은 Ncode 주소) */
export const sobOf = (bookCode) => ({ s: 3, o: 27, b: Number(bookCode) || 0 });
export const sobName = (bookCode) => { const { s, o, b } = sobOf(bookCode); return `${s}.${o}.${b}`; };

/**
 * 채점 1회분 저장. pens = [{ mac, books: [{ code, pages, strokes? }] }]
 * 답안 페이지가 하나도 없는 펜은 파일이 생기지 않는다.
 */
export const recordGradingSession = ({ source, task, group, pens = [] }) => {
  const at = new Date();
  const penEntries = pens
    .map((p) => ({
      mac: p.mac,
      files: (p.books || []).filter((b) => (b.pages || 0) > 0).map((b) => ({
        name: `${sobName(b.code)}.raw`, code: b.code, pages: b.pages,
        bytes: Math.round((b.strokes || b.pages * 140) * 46), // 획당 ~46B (프로토타입 추정치)
      })),
    }))
    .filter((p) => p.files.length);
  if (!penEntries.length) return null;
  const session = { id: folderStamp(at), at: at.toISOString(), source, task, group, pens: penEntries };
  sessions = [session, ...sessions].slice(0, PEN_RAW_KEEP); // 최근 5회만 보관
  persist();
  return session;
};

export const listSessions = () => sessions;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** zip 에 들어갈 파일 경로 목록과 요약 */
export const buildZipManifest = (teacherId = 'unknown') => {
  const files = [];
  let bytes = 0;
  sessions.forEach((s) => s.pens.forEach((p) => p.files.forEach((f) => {
    files.push(`${PEN_RAW_ROOT}${s.id}\\${macFolder(p.mac)}\\${f.name}`);
    bytes += f.bytes;
  })));
  const d = new Date();
  return {
    zipName: `aigle-pen-raw_${teacherId}_${folderStamp(d)}.zip`,
    sessions: sessions.length,
    pens: new Set(sessions.flatMap((s) => s.pens.map((p) => p.mac))).size,
    files, bytes,
  };
};

/** 전송이 끝나면 로컬 폴더를 비운다 */
export const clearAll = () => { sessions = []; persist(); };

export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* 프로토타입 시연용 — 저장분이 없으면 지난 채점 2회를 심는다 (실서비스는 실제 채점에서 쌓인다) */
if (typeof window !== 'undefined' && !window.__aiglePenRawSeeded) {
  window.__aiglePenRawSeeded = true;
  if (sessions.length === 0) {
    const daysAgo = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d; };
    const seed = (d, task, group, macs) => ({
      id: folderStamp(d), at: d.toISOString(), source: '크래들 일괄 채점', task, group,
      pens: macs.map((mac, i) => ({ mac, files: [{ name: `${sobName('334212')}.raw`, code: '334212', pages: 2, bytes: 12000 + i * 900 }] })),
    });
    sessions = [
      seed(daysAgo(1, 10, 12), '오늘 테스트 과제', '1학년 1반', ['9C:7B:D2:07:13:03', '9C:7B:D2:14:26:06', '9C:7B:D2:21:39:09']),
      seed(daysAgo(3, 9, 31), '과제테스트', '1학년 1반', ['9C:7B:D2:07:13:03', '9C:7B:D2:14:26:06']),
    ];
    persist();
  }
}

export default { recordGradingSession, listSessions, subscribe, buildZipManifest, clearAll, formatBytes, PEN_RAW_ROOT, PEN_RAW_KEEP };
