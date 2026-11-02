/**
 * eduBank.js — [2.4] 교육청 문제 은행 (TSK-16)
 *
 * 시스템 관리자가 과제를 등록하고, 교사가 골라 복제하면 교사 본인의 과제가 된다.
 *   항목 = 서·논술형 과제 1건 { kind: 'essay', task }  또는  정답형 문항 묶음 1건 { kind: 'answer', items, passages, points, curriculum }
 *   복제본은 복제 시점의 사본 — 관리자가 원본을 고치거나 지워도 교사 과제는 바뀌지 않는다
 * 프로토타입: 이 브라우저의 IndexedDB에만 저장한다 (서버 · 원격 DB 없음). 관리자 · 교사 모드가 같은 저장소를 본다.
 */
import { newId, saveExtraction, hasAnswer } from './itemBank';
import { topCurriculum } from '../AnswerArrange';

/* 구분 — 등록 내용에서 자동으로 정한다 (관리자가 따로 고르지 않는다)
 *   교육청 문제는 서·논술형과 기초학력(정답형)만 있다 — 서·논술 = 서·논술형 과제 · 기초학력 = 정답형 (TSK-16 v1.6, 「시험 대비」 폐기) */
export const EDU_CATEGORIES = {
  essay: { icon: '📝', label: '서·논술', color: '#7C3AED', bg: '#F5F3FF' },
  basic: { icon: '🧩', label: '기초학력', color: '#047857', bg: '#ECFDF5' },
};
export const categoryOf = (entry) => (entry.kind === 'essay' ? 'essay' : 'basic');

const DB_NAME = 'aigle-edu-bank';
const STORE = 'entries';

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const done = (tx) => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
const changed = () => window.dispatchEvent(new CustomEvent('aigle:edu-bank-changed'));

export const listEduEntries = async () => {
  const db = await openDb();
  const all = await new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

const putEntry = async (entry) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const now = new Date().toISOString();
  tx.objectStore(STORE).put({ createdAt: now, ...entry, updatedAt: now });
  await done(tx);
  changed();
};

export const deleteEduEntry = async (id) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await done(tx);
  changed();
};

/** 서·논술형 과제 등록 — 같은 과제를 다시 저장하면(직접 등록 화면에서 수정) 그 항목을 덮어쓴다 */
export const putEduEssay = (task, createdAt) => putEntry({
  id: `edu_essay_${task.id}`, kind: 'essay', title: task.title || '제목 없는 과제',
  schoolLevel: task.schoolLevel || '', subject: [task.subject, task.subSubject].filter(Boolean).join(' · '),
  questions: task.questions ?? (task.detail?.questions || []).length, points: task.points ?? null,
  task, ...(createdAt ? { createdAt } : {}),
});

/** 정답형 등록 — 스마트(자료에서 가져온 문항) · 직접 등록(배치까지 마친 과제) 모두 문항 묶음으로 */
export const putEduAnswer = ({ title, items, passages = [], points = {}, curriculum, origin }) => {
  const cur = curriculum || topCurriculum(items);
  return putEntry({
    id: newId('edu_answer'), kind: 'answer', title: title || '제목 없는 문제집', origin,
    schoolLevel: [cur?.schoolLevelName, cur?.gradeLabel].filter(Boolean).join(' '),
    subject: [cur?.curriculumName, cur?.subjectName !== cur?.curriculumName ? cur?.subjectName : ''].filter(Boolean).join(' · '),
    questions: items.length, points: items.reduce((s, it) => s + (Number(points[it.id] ?? it.points ?? 1) || 0), 0),
    items, passages, itemPoints: points, curriculum: cur,
  });
};

/** 정답형 직접 등록 결과(task) → 문항 묶음 */
export const putEduAnswerTask = (task) => {
  const entries = task.detail?.entries || [];
  return putEduAnswer({
    title: task.title, origin: 'direct',
    items: entries.map((e) => e.item), passages: task.detail?.passages || [],
    points: Object.fromEntries(entries.map((e) => [e.item.id, e.points])),
  });
};

// ───────────────────── 교사 복제 ─────────────────────

/** 서·논술형 → 교사 과제 사본 (작성중 · 비공유). 목록에 넣는 일은 부르는 쪽이 한다 */
export const cloneEssayTask = (entry) => ({
  ...entry.task, id: Date.now(), status: '작성중', visibility: '비공유',
  lastUpdate: new Date().toISOString().slice(0, 10), copiedFromEduId: entry.id,
});

/** 정답형 → 교사 문항에 사본만 (문제집은 만들지 않는다 — 교사가 문항에서 확인하고 엮는다 · TSK-16 v1.5). 자료 id를 돌려준다 */
export const cloneAnswerToItems = async (entry) => {
  const srcId = newId('src');
  const passMap = Object.fromEntries((entry.passages || []).map((p) => [p.id, newId('psg')]));
  const idMap = Object.fromEntries(entry.items.map((it) => [it.id, newId('it')]));
  const now = new Date().toISOString();
  const items = entry.items.map((it) => ({
    ...it, id: idMap[it.id], passageId: it.passageId ? (passMap[it.passageId] || it.passageId) : it.passageId,
    source: { ...(it.source || {}), sourceId: srcId, fileName: '교육청 문제 은행' },
    status: hasAnswer(it) ? 'ready' : 'needs_review', createdAt: now, copiedFromEduId: entry.id,
  }));
  const passages = (entry.passages || []).map((p) => ({ ...p, id: passMap[p.id], sourceId: srcId }));
  await saveExtraction({
    source: { id: srcId, title: entry.title, fileName: '교육청 문제 은행', pages: 0, createdAt: now, itemIds: items.map((i) => i.id), origin: { kind: 'edu', eduId: entry.id } },
    passages, items,
  });
  return srcId;
};
