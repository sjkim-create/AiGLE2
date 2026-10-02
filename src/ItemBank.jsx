/**
 * ItemBank — 과제 관리 › 문제 은행 (QBK-01)
 *
 * 스마트 과제 등록(정답형)으로 저장한 문항을 유형·교과·학년·상태·자료로 찾아보고, 상세에서 정답을 고친다.
 * 문항을 골라 「과제 배치」(평가 문항 편집 → Ncode 시험지 → 채점)로 넘기는 것과 「파생 문항 만들기」는 다음 단계(준비 중).
 * 저장소: lib/itemBank (프로토 IndexedDB — 상용은 서버 DB)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ITEM_TYPES, ITEM_TYPE_KEYS, hasAnswer, listItems, listPassages, listSources, putItem, deleteItems } from './lib/itemBank';
import ItemCard from './ItemCard';
import { IssueList } from './TaskFileGenerate';

const chipBtn = (on) => ({
  padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer',
  border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569', whiteSpace: 'nowrap',
});
const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#334155' };
const btn = (primary, disabled, danger) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: danger ? '1px solid #FCA5A5' : primary ? '1px solid #2A75F3' : '1px solid #E2E8F0',
  background: primary ? '#2A75F3' : 'white', color: danger ? '#DC2626' : primary ? 'white' : '#475569',
});
const isReady = (it) => hasAnswer(it) && !(it.issues || []).some((i) => i.level === 'error');

const ItemBank = ({ onGoRegister }) => {
  const [items, setItems] = useState(null);
  const [passages, setPassages] = useState([]);
  const [sources, setSources] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [type, setType] = useState('all');
  const [subject, setSubject] = useState('all');
  const [grade, setGrade] = useState('all');
  const [status, setStatus] = useState('all');
  const [sourceId, setSourceId] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState({});
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);     // 상세에서 고치는 중인 문항
  const [confirmDelete, setConfirmDelete] = useState(null); // 삭제할 id 배열
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const [it, ps, ss] = await Promise.all([listItems(), listPassages(), listSources()]);
      setItems(it); setPassages(ps); setSources(ss); setLoadError(null);
    } catch (err) { setLoadError(String(err?.message || err)); setItems([]); }
  }, []);
  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener('aigle:item-bank-changed', on);
    return () => window.removeEventListener('aigle:item-bank-changed', on);
  }, [load]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const all = items || [];
  const passageById = useMemo(() => Object.fromEntries(passages.map((p) => [p.id, p])), [passages]);
  const subjects = useMemo(() => [...new Set(all.map((i) => i.curriculum?.subjectName).filter(Boolean))], [all]);
  const grades = useMemo(() => [...new Set(all.map((i) => [i.curriculum?.schoolLevelName, i.curriculum?.gradeLabel].filter(Boolean).join(' ')).filter(Boolean))], [all]);
  const base = all.filter((i) =>
    (subject === 'all' || i.curriculum?.subjectName === subject)
    && (grade === 'all' || [i.curriculum?.schoolLevelName, i.curriculum?.gradeLabel].filter(Boolean).join(' ') === grade)
    && (status === 'all' || (status === 'ready' ? isReady(i) : !isReady(i)))
    && (sourceId === 'all' || i.source?.sourceId === sourceId)
    && (!q.trim() || `${i.stem} ${i.material} ${(i.choices || []).map((c) => c.text).join(' ')} ${(i.curriculum?.standards || []).map((s) => s.code).join(' ')}`.includes(q.trim())));
  const typeCounts = ITEM_TYPE_KEYS.reduce((acc, k) => ({ ...acc, [k]: base.filter((i) => i.itemType === k).length }), {});
  const visible = base.filter((i) => type === 'all' || i.itemType === type);
  const chosenIds = Object.keys(selected).filter((id) => selected[id] && all.some((i) => i.id === id));
  const allOn = visible.length > 0 && visible.every((i) => selected[i.id]);

  const open = (it) => { setOpenId(it.id); setDraft(it); };
  const close = () => { setOpenId(null); setDraft(null); };
  const opened = all.find((i) => i.id === openId);
  const dirty = draft && opened && JSON.stringify(draft) !== JSON.stringify(opened);

  const saveDraft = async () => {
    await putItem({ ...draft, status: isReady(draft) ? 'ready' : 'needs_review' });
    setToast(`${draft.number}번 문항을 저장했습니다.`);
  };
  const doDelete = async () => {
    const ids = confirmDelete;
    await deleteItems(ids);
    setSelected((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !ids.includes(id))));
    if (ids.includes(openId)) close();
    setConfirmDelete(null);
    setToast(`문항 ${ids.length}개를 삭제했습니다.`);
  };

  return (
    <div className="task-management-container" style={{ position: 'relative' }}>
      <header className="content-header" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="page-title">문제 은행</div>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>정답형 문항 {all.length}개 · 자료 {sources.length}건</span>
        {onGoRegister && <button onClick={onGoRegister} style={{ ...btn(true), marginLeft: 'auto' }}>✨ 자료에서 문항 가져오기</button>}
      </header>

      {loadError && <div style={{ marginBottom: 12 }}><IssueList issues={[{ level: 'error', field: '문제 은행', message: `저장소를 열 수 없습니다. ${loadError}` }]} /></div>}

      {/* 필터 */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}><option value="all">교과: 전체</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}><option value="all">학교급·학년: 전체</option>{grades.map((g) => <option key={g} value={g}>{g}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}><option value="all">상태: 전체</option><option value="ready">사용 가능</option><option value="review">확인 필요</option></select>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...selectStyle, maxWidth: 260 }}><option value="all">자료: 전체</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="발문·보기·성취기준 코드 검색" style={{ ...selectStyle, flex: 1, minWidth: 180 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={chipBtn(type === 'all')} onClick={() => setType('all')}>전체 {base.length}</button>
          {ITEM_TYPE_KEYS.map((k) => (
            <button key={k} style={{ ...chipBtn(type === k), opacity: typeCounts[k] ? 1 : 0.45 }} onClick={() => setType(k)} title={ITEM_TYPES[k].desc}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label} {typeCounts[k]}</button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>불러오는 중…</div>
      ) : all.length === 0 ? (
        <div className="task-empty-state">
          <div className="empty-icon" aria-hidden="true">🗂️</div>
          <p className="empty-title">아직 저장된 문항이 없습니다.</p>
          <p className="empty-sub">새 과제 등록 › 스마트 과제 등록 › 정답형으로 평가 자료를 올리면 문항이 유형별로 쌓입니다.</p>
          {onGoRegister && <button onClick={onGoRegister} style={btn(true)}>✨ 자료에서 문항 가져오기</button>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={allOn} onChange={() => setSelected((s) => ({ ...s, ...Object.fromEntries(visible.map((i) => [i.id, !allOn])) }))} /> 보이는 문항 모두 선택
            </label>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{visible.length}개 표시 중</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: chosenIds.length ? 72 : 0 }}>
            {visible.map((it) => (
              <ItemCard key={it.id} item={it} passage={passageById[it.passageId]} compact selectable checked={!!selected[it.id]}
                onToggle={() => setSelected((s) => ({ ...s, [it.id]: !s[it.id] }))} onOpen={() => open(it)} />
            ))}
            {visible.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>조건에 맞는 문항이 없습니다.</div>}
          </div>
        </>
      )}

      {/* 선택 바 — 다음 단계 입구 */}
      {chosenIds.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 -4px 16px rgba(15,23,42,0.08)' }}>
          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>{chosenIds.length}개 선택</span>
          <button onClick={() => setSelected({})} style={{ ...btn(false), padding: '6px 10px' }}>선택 해제</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => setConfirmDelete(chosenIds)} style={btn(false, false, true)}>🗑 삭제</button>
          <button disabled title="다음 단계에서 만듭니다 — 고른 문항을 평가 문항으로 배치하고 Ncode 시험지로 출력해 채점" style={btn(true, true)}>📐 과제 배치하기 (준비 중)</button>
        </div>
      )}

      {/* 상세 패널 */}
      {opened && draft && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 900 }}>
          <aside onClick={(e) => e.stopPropagation()} role="dialog" aria-label="문항 상세"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: '#F8FAFC', boxShadow: '-12px 0 32px rgba(15,23,42,0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>문항 상세</strong>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{opened.source?.fileName}{opened.source?.page ? ` · ${opened.source.page}쪽` : ''}</span>
              <button onClick={close} aria-label="닫기" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {passageById[draft.passageId] && (
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>📖 공통 지문 {passageById[draft.passageId].range}</div>{passageById[draft.passageId].text}
                </div>
              )}
              <ItemCard item={draft} editable onChange={setDraft} />
              {draft.explanation && <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap' }}><b>해설</b><br />{draft.explanation}</div>}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.8 }}>
                <div><b>교육과정</b> {[draft.curriculum?.schoolLevelName, draft.curriculum?.gradeLabel, draft.curriculum?.curriculumName, draft.curriculum?.subjectName].filter(Boolean).join(' · ') || '미확인'}</div>
                {(draft.curriculum?.standards || []).map((s) => <div key={s.id}><b>{s.areaName}</b> {s.code} {s.text}</div>)}
                <div><b>계보</b> {draft.lineage?.parentId ? `파생 문항 (원본 ${draft.lineage.parentId})` : '원본 문항'}</div>
              </div>
              {(draft.issues || []).length > 0 && <IssueList issues={draft.issues} />}
            </div>
            <div style={{ padding: '12px 16px', background: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmDelete([opened.id])} style={btn(false, false, true)}>🗑 삭제</button>
              <button disabled title="다음 단계에서 만듭니다 — 이 문항을 원본으로, 숫자·보기·표현을 바꾼 변형 문항을 AI로 만들고 원본과 연결" style={btn(false, true)}>🧬 파생 문항 만들기 (준비 중)</button>
              <span style={{ flex: 1 }} />
              <button onClick={saveDraft} disabled={!dirty} style={btn(true, !dirty)}>저장</button>
            </div>
          </aside>
        </div>
      )}

      {/* 삭제 확인 */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 420, maxWidth: '94vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>문항 {confirmDelete.length}개를 삭제할까요?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>문제 은행에서 지우며 되돌릴 수 없습니다. 이 문항에서 만든 파생 문항은 지워지지 않습니다.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button autoFocus onClick={() => setConfirmDelete(null)} style={btn(false)}>취소</button>
              <button onClick={doDelete} style={{ ...btn(true), background: '#EF4444', borderColor: '#EF4444' }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 1100 }}>{toast}</div>}
    </div>
  );
};

export default ItemBank;
