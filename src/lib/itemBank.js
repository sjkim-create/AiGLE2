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
 *   workbook — 문제집. 문항을 순서대로 엮은 묶음 (시험 대비·기초학력 연습 등). 과제 배치의 입력이 된다
 */

export const ITEM_SCHEMA_VERSION = 1;

// 문항 유형 — 교육평가 표준 분류(선택형 / 서답형)를 따른다
export const ITEM_TYPES = {
  multiple_choice: { label: '선다형', group: 'select', icon: '①', desc: '보기 중 정답을 고름 (객관식)' },
  binary_choice: { label: '양자택일형', group: 'select', icon: '◐', desc: '둘 중 맞는 것에 동그라미 (예: 무릎/무름)' },
  true_false: { label: '진위형', group: 'select', icon: '⭕', desc: '맞으면 O, 틀리면 X' },
  matching: { label: '연결형', group: 'select', icon: '🔗', desc: '왼쪽과 오른쪽 항목을 짝지음' },
  short_answer: { label: '단답형', group: 'supply', icon: '✏️', desc: '단어·숫자 등 짧게 답함' },
  completion: { label: '완성형', group: 'supply', icon: '▢', desc: '문장 속 빈칸을 채움' },
  essay: { label: '서술형', group: 'supply', icon: '📝', desc: '문장으로 서술 (채점 기준 필요)' },
};
export const ITEM_TYPE_KEYS = Object.keys(ITEM_TYPES);
export const TYPE_GROUPS = { select: '선택형', supply: '서답형' };

// 문항 성격 — 교과 문항은 단원·성취기준으로, 기초학력 문항은 기초 기능(예: 한글 해득 › 복잡한 받침 읽기)으로 관리
//   기초학력은 교과 단원의 성취기준에 딱 맞지 않을 수 있어 단원·성취기준을 요구하지 않는다 (채점은 정답 대조로 동일)
export const TRACKS = {
  curriculum: { label: '교과', desc: '단원·성취기준으로 관리' },
  basic: { label: '기초학력', desc: '성취기준 없이 기초 기능으로 관리' },
};

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
    case 'multiple_choice':
    case 'binary_choice': return (a.choices || []).length > 0;
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
    case 'binary_choice': return (a.choices || []).map((n) => (item.choices || []).find((c) => c.no === n)?.text || n).join(', ');
    case 'true_false': return a.truth === true ? 'O' : a.truth === false ? 'X' : '';
    case 'matching': return (a.pairs || []).map(([l, r]) => `${l}-${r}`).join(', ') + ' (왼쪽-오른쪽 순번)';
    case 'short_answer': return (a.texts || []).filter(Boolean).join(' / ');
    case 'completion': return (a.blanks || []).map((b, i) => `(${i + 1}) ${(b || []).join('/')}`).join('  ');
    case 'essay': return a.model ? `${String(a.model).slice(0, 40)}${a.model.length > 40 ? '…' : ''}` : '';
    default: return '';
  }
};

/** 정답 관련 확인 항목을 다시 판정 — 정답이 있으면 지우고, 없으면 「꼭 입력」으로 */
export const recheckAnswer = (item, missingMessage = '정답을 입력해야 채점할 수 있습니다.') => {
  const rest = (item.issues || []).filter((i) => i.field !== '정답');
  return { ...item, issues: hasAnswer(item) ? rest : [{ level: 'error', field: '정답', message: missingMessage }, ...rest] };
};

/**
 * 유형 바꾸기 — **정답을 지우지 않는다.** 정답 객체는 유형별 칸을 모두 갖고 있어 다른 칸의 값이 그대로 남는다
 * 바꿀 수 있는 정답은 옮겨 준다:
 *   선다형 ↔ 양자택일형 : 고른 보기 번호 그대로
 *   선다형·양자택일형 → 단답형 : 고른 보기의 글자를 허용 답으로 (예: 무릎/무름 → 「무릎」 쓰기)
 *   단답형 → 선다형·양자택일형 : 허용 답과 같은 글자의 보기를 정답으로
 * 옮길 수 없으면(예: 선다형 → 진위형) 그 유형 칸이 비어 「정답 없음」이 되고, 되돌리면 원래 정답이 살아난다
 */
export const changeItemType = (item, nextType) => {
  if (item.itemType === nextType) return item;
  const a = { ...emptyAnswer(), ...(item.answer || {}) };
  const choiceTypes = ['multiple_choice', 'binary_choice'];
  if (choiceTypes.includes(item.itemType) && nextType === 'short_answer' && !(a.texts || []).length) {
    a.texts = (a.choices || []).map((n) => (item.choices || []).find((c) => c.no === n)?.text).filter(Boolean);
  }
  if (item.itemType === 'short_answer' && choiceTypes.includes(nextType) && !(a.choices || []).length) {
    const norm = (t) => String(t || '').replace(/\s/g, '');
    a.choices = (item.choices || []).filter((c) => (a.texts || []).some((t) => norm(t) === norm(c.text))).map((c) => c.no);
  }
  let next = { ...item, itemType: nextType, answer: a };
  next.issues = (next.issues || []).filter((i) => i.field !== '유형' && i.field !== '보기');
  if (nextType === 'binary_choice' && (item.choices || []).length !== 2) {
    next.issues = [{ level: 'warn', field: '보기', message: `양자택일형은 보기가 2개여야 합니다 (지금 ${(item.choices || []).length}개).` }, ...next.issues];
  }
  next = recheckAnswer(next, '유형을 바꾸며 이 유형의 정답 칸이 비었습니다. 정답을 입력해 주세요. (이전 유형으로 되돌리면 원래 정답이 살아납니다)');
  // 출처(answerSource)는 건드리지 않는다 — 「정답 없음」 표시는 화면이 hasAnswer로 판단하므로, 되돌리면 원래 출처가 다시 보인다
  return next;
};

export const isReady = (it) => hasAnswer(it) && !(it.issues || []).some((i) => i.level === 'error');

// ───────────────────── IndexedDB ─────────────────────
const DB_NAME = 'aigle-item-bank';
const DB_VERSION = 2; // v2: workbooks(문제집) 추가
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
      if (!db.objectStoreNames.contains('workbooks')) db.createObjectStore('workbooks', { keyPath: 'id' });
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

/** 문항 저장 — 저장 시각을 붙여 저장하고, 저장된 문항을 돌려준다 (화면 사본을 이것으로 맞춰야 「고친 내용 있음」이 풀린다) */
export const putItem = async (item) => {
  const db = await openDb();
  const tx = db.transaction('items', 'readwrite');
  const saved = { ...item, updatedAt: new Date().toISOString() };
  tx.objectStore('items').put(saved);
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
  return saved;
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

// ───────────────────── 문제집 ─────────────────────
// 문제집 성격 — 시험 대비(교과) / 기초학력 연습 / 수업 활동
export const WORKBOOK_PURPOSES = {
  exam: { label: '시험 대비', icon: '📝' },
  basic: { label: '기초학력', icon: '🧩' },
  practice: { label: '수업·연습', icon: '📚' },
};

export const listWorkbooks = async () => {
  const db = await openDb();
  const all = await reqDone(db.transaction('workbooks').objectStore('workbooks').getAll());
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};

export const putWorkbook = async (wb) => {
  const db = await openDb();
  const tx = db.transaction('workbooks', 'readwrite');
  const now = new Date().toISOString();
  tx.objectStore('workbooks').put({ schemaVersion: ITEM_SCHEMA_VERSION, createdAt: now, ...wb, updatedAt: now });
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
};

export const deleteWorkbook = async (id) => {
  const db = await openDb();
  const tx = db.transaction('workbooks', 'readwrite');
  tx.objectStore('workbooks').delete(id);
  await txDone(tx);
  window.dispatchEvent(new CustomEvent('aigle:item-bank-changed'));
};

/** 문제집에 문항 추가 — 이미 있는 문항은 건너뛰고 끝에 붙인다 */
export const addToWorkbook = (wb, itemIds) => ({ ...wb, itemIds: [...wb.itemIds, ...itemIds.filter((id) => !wb.itemIds.includes(id))] });
