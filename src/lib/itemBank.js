/**
 * itemBank.js — 문제 은행(정답형 문항) 데이터 정의 + 저장소
 *
 * 상용 이관 기준 설계: docs/multi-type/문제은행_DB설계.md
 *   · 프로토: 브라우저 IndexedDB(aigle-item-bank) — 새로고침해도 유지, 기기·브라우저마다 따로
 *   · 상용: 같은 구조를 서버 DB 테이블(item_source / item_passage / item)로 옮긴다
 *
 * 저장 단위
 *   source  — 업로드한 자료 1건 (파일명·쪽 수·교육과정 추정치)
 *   passage — 여러 문항이 함께 쓰는 공통 지문/자료 (예: [1~3] 다음 글을 읽고…)
 *   item    — 문항 1개. 파생 문항은 lineage.parentId로 원본을 가리킨다
 */

export const ITEM_SCHEMA_VERSION = 1;

// 문항 유형 — 교육평가 표준 분류(선택형 / 서답형)를 따른다
export const ITEM_TYPES = {
  multiple_choice: { label: '선다형', group: 'select', icon: '①', desc: '보기 중 정답을 고름 (객관식)' },
  true_false: { label: '진위형', group: 'select', icon: '⭕', desc: '맞으면 O, 틀리면 X' },
  matching: { label: '연결형', group: 'select', icon: '🔗', desc: '왼쪽과 오른쪽 항목을 짝지음' },
  short_answer: { label: '단답형', group: 'supply', icon: '✏️', desc: '단어·숫자 등 짧게 답함' },
  completion: { label: '완성형', group: 'supply', icon: '▢', desc: '문장 속 빈칸을 채움' },
  essay: { label: '서술형', group: 'supply', icon: '📝', desc: '문장으로 서술 (채점 기준 필요)' },
};
export const ITEM_TYPE_KEYS = Object.keys(ITEM_TYPES);
export const TYPE_GROUPS = { select: '선택형', supply: '서답형' };

// 정답 출처 — 자료의 정답표·해설에서 읽었는지, AI가 풀어서 추정했는지, 교사가 확인·수정했는지
export const ANSWER_SOURCE = {
  file: { label: '자료 정답', color: '#047857', bg: '#D1FAE5' },
  ai: { label: 'AI 추정', color: '#B45309', bg: '#FEF3C7' },
  teacher: { label: '교사 확인', color: '#1D4ED8', bg: '#DBEAFE' },
  none: { label: '정답 없음', color: '#B91C1C', bg: '#FEE2E2' },
};

let seq = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 빈 정답 객체 — 유형별로 쓰는 칸만 채운다 */
export const emptyAnswer = () => ({ choices: [], truth: null, texts: [], blanks: [], pairs: [], model: '' });

/** 정답이 채워졌는지 (유형별) */
export const hasAnswer = (item) => {
  const a = item.answer || {};
  switch (item.itemType) {
    case 'multiple_choice': return (a.choices || []).length > 0;
    case 'true_false': return a.truth === true || a.truth === false;
    case 'matching': return (a.pairs || []).length > 0;
    case 'short_answer': return (a.texts || []).some((t) => String(t).trim());
    case 'completion': return (a.blanks || []).length > 0 && a.blanks.every((b) => (b || []).some((t) => String(t).trim()));
    case 'essay': return !!String(a.model || '').trim();
    default: return false;
  }
};

/** 정답을 한 줄 문자열로 (목록 표시용) */
export const answerText = (item) => {
  const a = item.answer || {};
  switch (item.itemType) {
    case 'multiple_choice': return (a.choices || []).map((n) => '①②③④⑤⑥⑦⑧⑨⑩'[n - 1] || n).join(', ');
    case 'true_false': return a.truth === true ? 'O' : a.truth === false ? 'X' : '';
    case 'matching': return (a.pairs || []).map(([l, r]) => `${l}-${r}`).join(', ') + ' (왼쪽-오른쪽 순번)';
    case 'short_answer': return (a.texts || []).filter(Boolean).join(' / ');
    case 'completion': return (a.blanks || []).map((b, i) => `(${i + 1}) ${(b || []).join('/')}`).join('  ');
    case 'essay': return a.model ? `${String(a.model).slice(0, 40)}${a.model.length > 40 ? '…' : ''}` : '';
    default: return '';
  }
};

// ───────────────────── IndexedDB ─────────────────────
const DB_NAME = 'aigle-item-bank';
const DB_VERSION = 1;
let dbPromise = null;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('이 브라우저는 문제 은행 저장소(IndexedDB)를 쓸 수 없습니다.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('passages')) {
        const ps = db.createObjectStore('passages', { keyPath: 'id' });
        ps.createIndex('sourceId', 'sourceId');
      }
      if (!db.objectStoreNames.contains('items')) {
        const is = db.createObjectStore('items', { keyPath: 'id' });
        is.createIndex('sourceId', 'source.sourceId');
        is.createIndex('itemType', 'itemType');
        is.createIndex('parentId', 'lineage.parentId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
};

const txDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('저장이 취소되었습니다.'));
});
const reqDone = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** 자료 1건 + 지문 + 문항을 한 번에 저장 (전부 성공하거나 전부 실패) */
export const saveExtraction = async ({ source, passages, items }) => {
  const db = await openDb();
  const tx = db.transaction(['sources', 'passages', 'items'], 'readwrite');
  tx.objectStore('sources').put(source);
  passages.forEach((p) => tx.objectStore('passages').put(p));
  items.forEach((it) => tx.objectStore('items').put(it));
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
};

export const listItems = async () => {
  const db = await openDb();
  const all = await reqDone(db.transaction('items').objectStore('items').getAll());
  return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || (a.order ?? 0) - (b.order ?? 0));
};
export const listPassages = async () => {
  const db = await openDb();
  return reqDone(db.transaction('passages').objectStore('passages').getAll());
};
export const listSources = async () => {
  const db = await openDb();
  return reqDone(db.transaction('sources').objectStore('sources').getAll());
};

export const putItem = async (item) => {
  const db = await openDb();
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').put({ ...item, updatedAt: new Date().toISOString() });
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
};

export const deleteItems = async (ids) => {
  const db = await openDb();
  const tx = db.transaction('items', 'readwrite');
  ids.forEach((id) => tx.objectStore('items').delete(id));
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
};

export const countItems = async () => {
  try {
    const db = await openDb();
    return await reqDone(db.transaction('items').objectStore('items').count());
  } catch { return 0; }
};
