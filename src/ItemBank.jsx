/**
 * ItemBank — 과제 관리 › 문제 은행 (QBK-01)
 *
 * 스마트 과제 등록(정답형)으로 저장한 문항을 유형·교과·학년·상태·자료로 찾아보고, 상세에서 정답을 고친다.
 * 문항을 골라 「과제 배치」(평가 문항 편집 → Ncode 시험지 → 채점)로 넘기는 것과 「파생 문항 만들기」는 다음 단계(준비 중).
 * 문제집 탭: 문항을 순서대로 엮은 문제집(시험 대비·기초학력·수업 연습)을 만들고 순서를 바꾼다.
 * 저장소: lib/itemBank (프로토 IndexedDB — 상용은 서버 DB)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId, ITEM_TYPES, ITEM_TYPE_KEYS, TRACKS, WORKBOOK_PURPOSES, isReady, listItems, listPassages, listSources, putItem, deleteItems, listWorkbooks, putWorkbook, deleteWorkbook } from './lib/itemBank';
import { BulkEditBar, WorkbookPicker } from './ItemBankParts';
import ItemCard from './ItemCard';
import { loadCatalog } from './lib/taskFromFile';
import { unitOptionsFor } from './lib/itemExtract';
import { IssueList } from './TaskFileGenerate';
import { ItemEditDialog } from './ItemEditForm';
import { WorkbookInfoCard, ArrangeSummary, StepChips, topCurriculum } from './AnswerArrange';
import { WorkbookSheet, LayoutOptions } from './WorkbookLayout';
import { WORD_MODES, DEFAULT_WORD_LAYOUT, WordEditor, WordOrderTools, WordLayoutOptions, WordSheet, wordIssues, normMode, blankOf } from './WordWorkbook';

const Crumb = ({ path }) => (
  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: 2 }}>{path.join(' › ')}</div>
);


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

// 서·논술 과제의 문항은 들어오지 않는다. 문항은 정답형 직접 등록·스마트 등록(TSK-15)으로 쌓인다 (QBK-01 v1.7 — 자료에서 문항 가져오기 삭제)
// [TSK-15 v1.5] 왼쪽 메뉴 「정답형 과제」 = 이 목록. registerItems가 있으면 [+ 새 과제 등록] → 정답형 직접 등록 · 스마트 등록
// initialTab · onTabChange — 왼쪽 메뉴 「정답형 과제 › 문항 / 문제집」과 탭을 맞춘다 (TSK-15 v1.10)
const ItemBank = ({ title = '문제 은행', registerItems = null, onRegister, initialTab = 'items', onTabChange }) => {
  const [wbEditIdx, setWbEditIdx] = useState(null); // 문제집 상세에서 문항 편집 중
  const [wbStep, setWbStep] = useState(1);          // 문제집 상세 단계 — 1 기본 정보 · 2 문제집 배치 (v1.18 — 순서 배치는 문제집 배치의 편집 모드로)
  const [wbEditing, setWbEditing] = useState(false); // 문제집 수정 모드 (열면 보기 — 출력 모양)
  const [wbActual, setWbActual] = useState(false);  // 100%로 보기
  const [wbRemoved, setWbRemoved] = useState(null); // 방금 뺀 문항 — 되돌리기
  const [regOpen, setRegOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [passages, setPassages] = useState([]);
  const [sources, setSources] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [type, setType] = useState('all');
  const [subject, setSubject] = useState('all');
  const [unitF, setUnitF] = useState('all');
  const [catalog, setCatalog] = useState(null);
  const [grade, setGrade] = useState('all');
  const [status, setStatus] = useState('all');
  const [sourceId, setSourceId] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState({});
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);     // 상세에서 고치는 중인 문항
  const [confirmDelete, setConfirmDelete] = useState(null); // 삭제할 id 배열
  const [toast, setToast] = useState('');
  const [tab, setTabState] = useState(initialTab); // 'items' | 'workbooks'
  const setTab = (k) => { setTabState(k); onTabChange?.(k); };
  const [trackF, setTrackF] = useState('all');
  const [workbooks, setWorkbooks] = useState([]);
  const [wbOpen, setWbOpen] = useState(false);    // 문제집에 담기 창
  const [openWbId, setOpenWbId] = useState(null); // 열어 본 문제집
  const [confirmWbDelete, setConfirmWbDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const [it, ps, ss, wb] = await Promise.all([listItems(), listPassages(), listSources(), listWorkbooks()]);
      setItems(it); setPassages(ps); setSources(ss); setWorkbooks(wb); setLoadError(null);
    } catch (err) { setLoadError(String(err?.message || err)); setItems([]); }
  }, []);
  useEffect(() => { loadCatalog().then(setCatalog).catch(() => {}); }, []);
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
  const unitName = (i) => (i.track === 'basic' ? `기초학력${i.skill ? ` · ${i.skill}` : ''}` : i.unit?.areaName || '단원 미지정');
  const units = useMemo(() => [...new Set(all.filter((i) => subject === 'all' || i.curriculum?.subjectName === subject).map(unitName))], [all, subject]);
  const grades = useMemo(() => [...new Set(all.map((i) => [i.curriculum?.schoolLevelName, i.curriculum?.gradeLabel].filter(Boolean).join(' ')).filter(Boolean))], [all]);
  const base = all.filter((i) =>
    (subject === 'all' || i.curriculum?.subjectName === subject)
    && (unitF === 'all' || unitName(i) === unitF)
    && (trackF === 'all' || (i.track || 'curriculum') === trackF)
    && (grade === 'all' || [i.curriculum?.schoolLevelName, i.curriculum?.gradeLabel].filter(Boolean).join(' ') === grade)
    && (status === 'all' || (status === 'ready' ? isReady(i) : !isReady(i)))
    && (sourceId === 'all' || i.source?.sourceId === sourceId)
    && (!q.trim() || `${i.stem} ${i.material} ${(i.choices || []).map((c) => c.text).join(' ')} ${unitName(i)} ${i.unit?.label || ''}`.includes(q.trim())));
  const typeCounts = ITEM_TYPE_KEYS.reduce((acc, k) => ({ ...acc, [k]: base.filter((i) => i.itemType === k).length }), {});
  const visible = base.filter((i) => type === 'all' || i.itemType === type);
  const chosenIds = Object.keys(selected).filter((id) => selected[id] && all.some((i) => i.id === id));
  const allOn = visible.length > 0 && visible.every((i) => selected[i.id]);

  const opened = all.find((i) => i.id === openId);
  // 고친 내용 있음 — 저장 시각·상태처럼 저장할 때 자동으로 붙는 값은 비교하지 않는다
  const comparable = (it) => { const { updatedAt, status, ...rest } = it || {}; return JSON.stringify(rest); };
  const dirty = !!(draft && opened && comparable(draft) !== comparable(opened));
  // [QBK-01 v1.2] 목록 | 상세 나란히 — 다른 문항을 누르면 상세가 닫히지 않고 그 문항으로 바뀐다
  //   고친 내용이 있으면 이동 전에 저장 여부를 묻는다 (pendingOpen)
  const [pendingOpen, setPendingOpen] = useState(null);
  const [editOpen, setEditOpen] = useState(false); // 문항 편집 (직접 작성과 같은 화면)
  const show = (it) => { setOpenId(it.id); setDraft(it); };
  const open = (it) => {
    if (it.id === openId) return;
    if (dirty) { setPendingOpen(it); return; }
    show(it);
  };
  const close = () => { setOpenId(null); setDraft(null); };
  // 넓은 화면이면 나란히, 좁으면(900px 미만) 오른쪽에서 나오는 패널
  const rootRef = useRef(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (!rootRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 900));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const saveDraft = async () => {
    const saved = await putItem({ ...draft, status: isReady(draft) ? 'ready' : 'needs_review' });
    setDraft(saved); // 화면 사본을 저장본과 맞춘다
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


  // 상세 패널 내용 — 나란히(넓은 화면) / 오른쪽 패널(좁은 화면) 공용
  const detailBody = opened && draft ? (
          <>
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
              <ItemCard item={draft} editable onChange={setDraft} onEdit={() => setEditOpen(true)} unitOptions={catalog ? unitOptionsFor(catalog, draft.curriculum?.subjectId) : []} />
              {draft.explanation && <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap' }}><b>해설</b><br />{draft.explanation}</div>}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.8 }}>
                <div><b>교육과정</b> {[draft.curriculum?.schoolLevelName, draft.curriculum?.gradeLabel, draft.curriculum?.curriculumName, draft.curriculum?.subjectName].filter(Boolean).join(' · ') || '미확인'}</div>
                <div><b>성격</b> {TRACKS[draft.track || 'curriculum'].label}{draft.track === 'basic' && draft.skill ? ` · ${draft.skill}` : ''}</div>
                {draft.track !== 'basic' && <>
                <div><b>단원</b> {draft.unit?.areaName || '미지정'}{draft.unit?.label && draft.unit.label !== draft.unit.areaName ? ` (자료 표기: ${draft.unit.label})` : ''}{draft.unit?.source === 'ai' ? ' · AI 추정' : draft.unit?.source === 'teacher' ? ' · 교사 확인' : ''}</div>
                <div style={{ marginTop: 4 }}><b>단원 성취기준</b> {(draft.curriculum?.standards || []).length}개 — 문항마다 고르지 않고 단원에 따라 정해집니다</div>
                {(draft.curriculum?.standards || []).map((s) => <div key={s.id} style={{ fontSize: 'var(--neo-font-size-xs)' }}>{s.code} {s.text}</div>)}
                </>}
                <div><b>계보</b> {draft.lineage?.parentId ? `파생 문항 (원본 ${draft.lineage.parentId})` : '원본 문항'}</div>
              </div>
              {(draft.issues || []).length > 0 && <IssueList issues={draft.issues} />}
            </div>
            <div style={{ padding: '12px 16px', background: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmDelete([opened.id])} style={btn(false, false, true)}>🗑 삭제</button>
              <button onClick={() => setEditOpen(true)} style={btn(false)}>✏️ 문항 편집</button>
              <button disabled title="다음 단계에서 만듭니다 — 이 문항을 원본으로, 숫자·보기·표현을 바꾼 변형 문항을 AI로 만들고 원본과 연결" style={btn(false, true)}>🧬 파생 문항 만들기 (준비 중)</button>
              <span style={{ flex: 1 }} />
              <button onClick={saveDraft} disabled={!dirty} style={btn(true, !dirty)}>저장</button>
            </div>
          </>
  ) : null;

  return (
    <div ref={rootRef} className="task-management-container" style={{ position: 'relative', flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
      {/* [QBK-01 v1.7] 「자료에서 문항 가져오기」 삭제 — 정답형 스마트 등록(TSK-15)이 같은 단계 + 과제 저장 + 문제 은행 저장을 한다 */}
      <>
      <header className="content-header" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Crumb path={['과제 관리']} />
          <div className="page-title">{registerItems ? '✅ ' : ''}{title}{onTabChange ? (tab === 'workbooks' ? ' › 📚 문제집' : ' › 🗂️ 문항') : ''}</div>
        </div>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>정답형 문항 {all.length}개 · 문제집 {workbooks.length}개 · 자료 {sources.length}건</span>
        {registerItems && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setRegOpen((v) => !v)} aria-haspopup="true" aria-expanded={regOpen} style={btn(true)}>+ 새 과제 등록 ▾</button>
            {regOpen && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 320, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,0.18)', padding: 6 }}>
                {registerItems.map((m) => (
                  <button key={m.mode} role="menuitem" onClick={() => { setRegOpen(false); onRegister?.(m.mode); }}
                    style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '10px 12px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ fontSize: '1.3rem' }}>{m.icon}</span>
                    <span><b style={{ display: 'block', fontSize: 'var(--neo-font-size-base)' }}>{m.label}</b><span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{m.desc}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '-4px 0 10px' }}>
        정답형 문항·문제집 목록입니다. <b>서·논술형 과제의 문항은 포함되지 않으며</b> 서·논술형 과제에서 관리합니다.
      </div>

      {/* [TSK-15 v1.11] 왼쪽 메뉴(정답형 과제 › 문항 · 문제집)가 탭을 대신하면 화면 안 탭은 두지 않는다 */}
      {!onTabChange && <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #E2E8F0' }}>
        {[['items', `🗂️ 문항 ${all.length}`], ['workbooks', `📚 문제집 ${workbooks.length}`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `3px solid ${tab === k ? '#2A75F3' : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: tab === k ? '#1D4ED8' : '#64748B', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>}

      {loadError && <div style={{ marginBottom: 12 }}><IssueList issues={[{ level: 'error', field: '문제 은행', message: `저장소를 열 수 없습니다. ${loadError}` }]} /></div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
      {tab === 'items' && <>
      {/* 필터 */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}><option value="all">교과: 전체</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select value={trackF} onChange={(e) => setTrackF(e.target.value)} style={selectStyle}><option value="all">성격: 전체</option>{Object.entries(TRACKS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
          <select value={unitF} onChange={(e) => setUnitF(e.target.value)} style={selectStyle}><option value="all">단원: 전체</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle}><option value="all">학교급·학년: 전체</option>{grades.map((g) => <option key={g} value={g}>{g}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}><option value="all">상태: 전체</option><option value="ready">사용 가능</option><option value="review">확인 필요</option></select>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...selectStyle, maxWidth: 260 }}><option value="all">자료: 전체</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="발문·보기·단원 검색" style={{ ...selectStyle, flex: 1, minWidth: 180 }} />
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
          <p className="empty-sub">[+ 새 과제 등록]의 「정답형 스마트 등록」으로 시험지·교재 PDF를 올리거나 「정답형 직접 등록」으로 작성하면 문항이 유형별로 쌓입니다.</p>
          {registerItems && <button onClick={() => onRegister?.('answer-smart')} style={btn(true)}>✨ 정답형 스마트 등록</button>}
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
              <ItemCard key={it.id} item={it} passage={passageById[it.passageId]} compact selectable checked={!!selected[it.id]} active={it.id === openId}
                onToggle={() => setSelected((s) => ({ ...s, [it.id]: !s[it.id] }))} onOpen={() => open(it)} />
            ))}
            {visible.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>조건에 맞는 문항이 없습니다.</div>}
          </div>
        </>
      )}

      {/* 선택 바 — 다음 단계 입구 */}
      {chosenIds.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 -4px 16px rgba(15,23,42,0.08)' }}>
          <button onClick={() => setSelected({})} style={{ ...btn(false), padding: '6px 10px' }}>선택 해제</button>
          <BulkEditBar items={all.filter((i) => chosenIds.includes(i.id))}
            unitOptions={catalog ? unitOptionsFor(catalog, all.find((i) => chosenIds.includes(i.id))?.curriculum?.subjectId) : []}
            onApply={async (list) => { for (const it of list) await putItem({ ...it, status: isReady(it) ? 'ready' : 'needs_review' }); setToast(`문항 ${list.length}개를 바꿨습니다.`); }} />
          <span style={{ flex: 1 }} />
          <button onClick={() => setConfirmDelete(chosenIds)} style={btn(false, false, true)}>🗑 삭제</button>
          <button onClick={() => setWbOpen(true)} style={btn(false)}>📚 문제집에 담기</button>
        </div>
      )}
      </>}

      {/* 문제집 탭 */}
      {tab === 'workbooks' && (() => {
        const itemById = Object.fromEntries(all.map((i) => [i.id, i]));
        const wb = workbooks.find((w) => w.id === openWbId);
        const save = async (next) => { await putWorkbook(next); };
        const move = (idx, d) => { const ids = [...wb.itemIds]; const j = idx + d; if (j < 0 || j >= ids.length) return; [ids[idx], ids[j]] = [ids[j], ids[idx]]; save({ ...wb, itemIds: ids }); };
        // [TSK-15 v1.26] 낱말 문제집 — 영어 단어 시험 · 받아쓰기. 교사가 직접 낱말을 입력한다
        const createWordWb = async () => {
          const id = newId('wb');
          await putWorkbook({ id, kind: 'word', title: '새 낱말 문제집', purpose: 'practice', itemIds: [], words: [], mode: 'vocab', layout: { ...DEFAULT_WORD_LAYOUT } });
          setOpenWbId(id); setWbStep(1); setWbEditing(true); setWbRemoved(null);
        };
        const wordBtn = <button onClick={createWordWb} style={{ ...btn(false), borderColor: '#2A75F3', color: '#1D4ED8' }}>+ 🔤 낱말 문제집 만들기</button>;
        if (!wb) {
          return workbooks.length === 0 ? (
            <div className="task-empty-state">
              <div className="empty-icon" aria-hidden="true">📚</div>
              <p className="empty-title">아직 문제집이 없습니다.</p>
              <p className="empty-sub">문항 탭에서 문항을 고르고 [📚 문제집에 담기]를 누르면 문제집이 만들어집니다. 영어 단어 시험 · 받아쓰기는 낱말 문제집으로 만듭니다.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}><button onClick={() => setTab('items')} style={btn(true)}>문항 고르러 가기</button>{wordBtn}</div>
            </div>
          ) : (
            <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>{wordBtn}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {workbooks.map((w) => {
                if (w.kind === 'word') {
                  const n = (w.words || []).filter((x) => x.word.trim()).length;
                  return (
                    <button key={w.id} onClick={() => { setOpenWbId(w.id); setWbStep(1); setWbEditing(false); setWbRemoved(null); }} style={{ textAlign: 'left', background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>🔤 낱말 문제집 · {WORKBOOK_PURPOSES[w.purpose]?.icon} {WORKBOOK_PURPOSES[w.purpose]?.label}</span>
                      <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B' }}>{w.title}</span>
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>낱말 {n}개 · {WORD_MODES[normMode(w.mode)].label}</span>
                    </button>
                  );
                }
                const its = w.itemIds.map((id) => itemById[id]).filter(Boolean);
                const review = its.filter((i) => !isReady(i)).length;
                return (
                  <button key={w.id} onClick={() => { setOpenWbId(w.id); setWbStep(1); setWbEditing(false); setWbRemoved(null); }} style={{ textAlign: 'left', background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>{WORKBOOK_PURPOSES[w.purpose]?.icon} {WORKBOOK_PURPOSES[w.purpose]?.label}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B' }}>{w.title}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>문항 {its.length}개{review ? ` · 확인 필요 ${review}개` : ''}{w.itemIds.length > its.length ? ` · 삭제된 문항 ${w.itemIds.length - its.length}개` : ''}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{[...new Set(its.map((i) => ITEM_TYPES[i.itemType]?.label))].join(' · ')}</span>
                  </button>
                );
              })}
            </div>
            </>
          );
        }
        if (wb.kind === 'word') {
          const words = wb.words || [];
          const wcur = wb.curriculum || {};
          const setW = (patch) => setWorkbooks((ws) => ws.map((w) => (w.id === wb.id ? { ...w, ...patch } : w)));
          const wShort = [wb.purpose === 'basic' ? '기초학력' : '', wcur.schoolLevelName, wcur.gradeLabel, wcur.curriculumName].filter(Boolean).join(' · ');
          const actualW = (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={wbActual} onChange={(e) => setWbActual(e.target.checked)} /> 100%로 보기
            </label>
          );
          const issues = wordIssues(words, wb.mode);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setOpenWbId(null)} style={{ ...btn(false), padding: '6px 10px' }}>← 문제집 목록</button>
                <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B', flex: 1, minWidth: 160 }}>🔤 {wb.title || '이름 없는 낱말 문제집'}<span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B' }}>{wShort}</span>{wbEditing && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '2px 8px' }}>수정 중</span>}</span>
                {wbEditing ? (
                  <button onClick={() => { save(wb); setWbEditing(false); }} style={btn(true)}>✅ 수정 끝내기</button>
                ) : (
                  <>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>{WORD_MODES[normMode(wb.mode)].icon} {WORD_MODES[normMode(wb.mode)].label}</span>
                    <button onClick={() => { setWbEditing(true); setWbStep(1); }} style={{ ...btn(false), borderColor: '#2A75F3', color: '#1D4ED8' }}>✏️ 수정</button>
                    <button onClick={() => setConfirmWbDelete(wb)} style={btn(false, false, true)}>🗑 문제집 삭제</button>
                  </>
                )}
              </div>
              {!wbEditing && (
                <>
                  {issues.length > 0 && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ {issues.join(' · ')}</div>}
                  <WordLayoutOptions layout={wb.layout} onChange={(l) => save({ ...wb, layout: l })}>{actualW}</WordLayoutOptions>
                  <WordSheet title={wb.title} curriculum={wcur} words={words} mode={wb.mode} layout={wb.layout} actualSize={wbActual} />
                </>
              )}
              {wbEditing && (
                <>
                  <StepChips steps={['기본 정보', '낱말 입력', '문제집 배치']} step={wbStep} onStep={setWbStep} />
                  {wbStep === 1 && (
                    <WorkbookInfoCard purpose={wb.purpose} purposes={WORKBOOK_PURPOSES} onPurpose={(p) => save({ ...wb, purpose: p })}
                      title={wb.title} onTitle={(t) => setW({ title: t })} onTitleBlur={() => save(wb)}
                      curriculum={wcur} onCurriculum={(c) => setW({ curriculum: c })} onCurriculumSave={(c) => save({ ...wb, curriculum: c })}>
                      <div><span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 6, display: 'block' }}>출제 방식</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="출제 방식">
                          {Object.entries(WORD_MODES).map(([k, m]) => (
                            <button key={k} type="button" role="radio" aria-checked={normMode(wb.mode) === k} onClick={() => save({ ...wb, mode: k })}
                              style={{ padding: '8px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${normMode(wb.mode) === k ? '#2A75F3' : '#E2E8F0'}`, background: normMode(wb.mode) === k ? '#EFF6FF' : 'white', color: normMode(wb.mode) === k ? '#1D4ED8' : '#475569' }}>
                              {m.icon} {m.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 6 }}>
                          {normMode(wb.mode) === 'vocab' && '영어 낱말과 한글 뜻을 입력합니다. 낱말마다 영어나 한글 중 하나를 빈칸으로 — 낱말 입력에서 번갈아 · 무작위로 정할 수 있습니다.'}
                          {normMode(wb.mode) === 'dictation' && '시험지에는 번호와 빈칸만 나옵니다. 교사가 낱말을 불러 주면 학생이 듣고 씁니다 (국어 · 영어 받아쓰기).'}
                        </div>
                      </div>
                    </WorkbookInfoCard>
                  )}
                  {wbStep === 2 && <WordEditor words={words} mode={wb.mode} onNotice={setToast} onChange={(next, commit) => { setW({ words: next }); if (commit) save({ ...wb, words: next }); }} onCommit={() => save(wb)} />}
                  {wbStep === 3 && (
                    <>
                      <WordLayoutOptions layout={wb.layout} onChange={(l) => save({ ...wb, layout: l })}>{actualW}</WordLayoutOptions>
                      <WordOrderTools words={words} mode={wb.mode} onChange={(next) => save({ ...wb, words: next })} />
                      <WordSheet title={wb.title} curriculum={wcur} words={words} mode={wb.mode} layout={wb.layout} actualSize={wbActual}
                        editMode onOrder={(next) => save({ ...wb, words: next })}
                        onToggleBlank={(id) => save({ ...wb, words: words.map((w) => (w.id === id ? { ...w, blank: blankOf(w, wb.mode) === 'word' ? 'meaning' : 'word' } : w)) })} />
                    </>
                  )}
                </>
              )}
            </div>
          );
        }
        const its = wb.itemIds.map((id) => itemById[id]).filter(Boolean);
        // [TSK-15 v1.20] 문제집 상세 — 보기(출력 모양) / [✏️ 수정] → ① 기본 정보 ② 문제집 배치. 모두 문제집에 바로 저장
        //   과제로 저장(배포·채점)은 다음 단계에서 한다
        const entries = its.map((item) => ({ item, points: wb.points?.[item.id] ?? item.points ?? 1 }));
        const curriculum = wb.curriculum || topCurriculum(its);
        const setLocal = (patch) => setWorkbooks((ws) => ws.map((w) => (w.id === wb.id ? { ...w, ...patch } : w)));
        // 제목 옆 — 학교급 · 학년 · 교과 (기초학력 문제집은 앞에 「기초학력」)
        const curShort = [wb.purpose === 'basic' ? '기초학력' : '', curriculum.schoolLevelName, curriculum.gradeLabel, curriculum.curriculumName].filter(Boolean).join(' · ') || (its.length && its.every((i) => i.track === 'basic') ? '기초학력' : '');
        const curText = [curriculum.schoolLevelName, curriculum.gradeLabel, curriculum.curriculumName, curriculum.subjectName].filter(Boolean).join(' · ') || (its.length && its.every((i) => i.track === 'basic') ? '기초학력' : '교육과정 미지정');
        const sheetProps = {
          title: wb.title, curriculum, entries, passages: passageById, layout: wb.layout, actualSize: wbActual,
          onOrder: (ids) => save({ ...wb, itemIds: [...ids, ...wb.itemIds.filter((id) => !itemById[id])] }),
          onPoints: (id, v) => save({ ...wb, points: { ...(wb.points || {}), [id]: v } }),
          onEdit: (i) => setWbEditIdx(i),
          onRemove: (id) => { setWbRemoved({ wbId: wb.id, no: wb.itemIds.filter((x) => itemById[x]).indexOf(id) + 1, itemIds: wb.itemIds, points: wb.points }); save({ ...wb, itemIds: wb.itemIds.filter((x) => x !== id) }); },
        };
        const actualToggle = (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={wbActual} onChange={(e) => setWbActual(e.target.checked)} /> 100%로 보기
          </label>
        );
        // [TSK-15 v1.20] 문제집을 열면 출력 모양으로 보고, [✏️ 수정]을 누르면 기본 정보 · 문제집 배치를 고친다
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setOpenWbId(null)} style={{ ...btn(false), padding: '6px 10px' }}>← 문제집 목록</button>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B', flex: 1, minWidth: 160 }}>📚 {wb.title || '이름 없는 문제집'}<span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B' }}>{curShort}</span>{wbEditing && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '2px 8px' }}>수정 중</span>}</span>
              {wbEditing ? (
                <>
                  <button onClick={() => { setWbEditing(false); setWbRemoved(null); }} style={btn(true)}>✅ 수정 끝내기</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>{WORKBOOK_PURPOSES[wb.purpose]?.icon} {WORKBOOK_PURPOSES[wb.purpose]?.label}</span>
                  <button onClick={() => { setWbEditing(true); setWbStep(1); }} style={{ ...btn(false), borderColor: '#2A75F3', color: '#1D4ED8' }}>✏️ 수정</button>
                  <button onClick={() => setConfirmWbDelete(wb)} style={btn(false, false, true)}>🗑 문제집 삭제</button>
                </>
              )}
            </div>

            {/* 보기 — 출력 모양 그대로 */}
            {!wbEditing && (
              <>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <ArrangeSummary entries={entries}>{actualToggle}</ArrangeSummary>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{curText} · 출력 모양 미리 보기입니다. 문제집 이름 · 교육과정 · 문항 순서 · 배점 · 지면 설정은 [✏️ 수정]에서 고칩니다.</div>
                </div>
                <WorkbookSheet {...sheetProps} editMode={false} />
                {its.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>문항이 없습니다. 「문항」 메뉴에서 골라 [📚 문제집에 담기]로 넣어 주세요.</div>}
              </>
            )}

            {/* 수정 모드 — ① 기본 정보 ② 문제집 배치 (단계 칩으로 이동) */}
            {wbEditing && (
              <>
                <StepChips steps={['기본 정보', '문제집 배치']} step={wbStep} onStep={setWbStep} />
                {wbStep === 1 && (
                  <WorkbookInfoCard purpose={wb.purpose} purposes={WORKBOOK_PURPOSES}
                    onPurpose={(p) => save({ ...wb, purpose: p })}
                    title={wb.title} onTitle={(t) => setLocal({ title: t })} onTitleBlur={() => save(wb)}
                    curriculum={curriculum} onCurriculum={(c) => setLocal({ curriculum: c })} onCurriculumSave={(c) => save({ ...wb, curriculum: c })} />
                )}
                {wbStep === 2 && (
                  <>
                    {/* v1.21 — 설명 카드 삭제. 뺀 직후에만 되돌리기 줄 */}
                    {wbRemoved && wbRemoved.wbId === wb.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', background: '#FEF2F2', borderRadius: 8, padding: '6px 10px' }}>
                        🗑 {wbRemoved.no}번 문항을 문제집에서 뺐습니다. (문제 은행에는 남아 있습니다)
                        <button onClick={() => { save({ ...wb, itemIds: wbRemoved.itemIds, points: wbRemoved.points }); setWbRemoved(null); }} style={{ ...btn(false), padding: '4px 10px', marginLeft: 'auto' }}>↶ 되돌리기</button>
                      </div>
                    )}
                    <LayoutOptions layout={wb.layout} onChange={(l) => save({ ...wb, layout: l })}>{actualToggle}</LayoutOptions>
                    <WorkbookSheet {...sheetProps} editMode />
                    {its.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>문항이 없습니다. 「문항」 메뉴에서 골라 [📚 문제집에 담기]로 넣어 주세요.</div>}
                  </>
                )}
              </>
            )}
            {wbEditIdx != null && its[wbEditIdx] && (
              <ItemEditDialog open item={its[wbEditIdx]} pages={sources.find((x) => x.id === its[wbEditIdx].source?.sourceId)?.pageImages}
                scopeNote="문제 은행 원본이 바뀝니다 · 이미 저장한 과제는 그대로" onClose={() => setWbEditIdx(null)}
                onSave={async (x) => { await putItem({ ...x, status: isReady(x) ? 'ready' : 'needs_review' }); setToast(`${wbEditIdx + 1}번 문항을 저장했습니다.`); }} />
            )}
          </div>
        );
      })()}

      </div>
      {/* 상세 — 넓은 화면: 오른쪽 열에 고정, 목록을 눌러도 닫히지 않고 바뀐다 */}
      {wide && detailBody && (
        <aside role="region" aria-label="문항 상세"
          style={{ flex: '0 0 min(520px, 46%)', position: 'sticky', top: 0, maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
          {detailBody}
        </aside>
      )}
      </div>
      {/* 상세 — 좁은 화면: 오른쪽에서 나오는 패널 */}
      {!wide && detailBody && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 900 }}>
          <aside onClick={(e) => e.stopPropagation()} role="dialog" aria-label="문항 상세"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: '#F8FAFC', boxShadow: '-12px 0 32px rgba(15,23,42,0.15)', display: 'flex', flexDirection: 'column' }}>
            {detailBody}
          </aside>
        </div>
      )}

      {/* 문항 편집 — 문제 은행 원본이 바뀐다 (이미 과제에 담긴 사본은 그대로) */}
      <ItemEditDialog open={editOpen && !!draft} item={draft} pages={sources.find((x) => x.id === draft?.source?.sourceId)?.pageImages}
        scopeNote="문제 은행 원본이 바뀝니다 · 이미 과제에 담긴 문항은 그대로" onClose={() => setEditOpen(false)}
        onSave={async (x) => { const saved = await putItem({ ...x, status: isReady(x) ? 'ready' : 'needs_review' }); setDraft(saved); setToast(`${x.number}번 문항을 저장했습니다.`); }} />

      {/* 고친 내용이 있는데 다른 문항을 누름 */}
      {pendingOpen && (
        <div onClick={() => setPendingOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 440, maxWidth: '94vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>고친 내용을 저장할까요?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>{draft?.number}번 문항에 저장하지 않은 내용이 있습니다. 저장하지 않고 이동하면 고친 내용이 사라집니다.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button autoFocus onClick={() => setPendingOpen(null)} style={btn(false)}>취소</button>
              <button onClick={() => { const it = pendingOpen; setPendingOpen(null); show(it); }} style={btn(false)}>저장하지 않고 이동</button>
              <button onClick={async () => { const it = pendingOpen; setPendingOpen(null); await saveDraft(); show(it); }} style={btn(true)}>저장하고 이동</button>
            </div>
          </div>
        </div>
      )}

      <WorkbookPicker open={wbOpen} itemIds={chosenIds}
        defaultPurpose={all.filter((i) => chosenIds.includes(i.id)).every((i) => i.track === 'basic') ? 'basic' : 'exam'}
        onClose={() => setWbOpen(false)}
        onDone={(w, created) => { setWbOpen(false); setSelected({}); setToast(created ? `「${w.title}」 문제집을 만들었습니다 (문항 ${w.itemIds.length}개).` : `「${w.title}」에 담았습니다 (문항 ${w.itemIds.length}개).`); }} />

      {confirmWbDelete && (
        <div onClick={() => setConfirmWbDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 420, maxWidth: '94vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>「{confirmWbDelete.title}」 문제집을 삭제할까요?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>문제집만 지우며 되돌릴 수 없습니다. 담긴 문항은 문제 은행에 그대로 남습니다.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button autoFocus onClick={() => setConfirmWbDelete(null)} style={btn(false)}>취소</button>
              <button onClick={async () => { await deleteWorkbook(confirmWbDelete.id); setOpenWbId(null); setToast(`「${confirmWbDelete.title}」 문제집을 삭제했습니다.`); setConfirmWbDelete(null); }} style={{ ...btn(true), background: '#EF4444', borderColor: '#EF4444' }}>삭제</button>
            </div>
          </div>
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

      </>
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 1100 }}>{toast}</div>}
    </div>
  );
};

export default ItemBank;
