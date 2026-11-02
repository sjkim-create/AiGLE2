/**
 * ItemBank — 과제 관리 › 문제 은행 (QBK-01)
 *
 * 스마트 과제 등록(정답형)으로 저장한 문항을 유형·교과·학년·상태·자료로 찾아보고, 상세에서 정답을 고친다.
 * 문항을 골라 「과제 배치」(평가 문항 편집 → Ncode 시험지 → 채점)로 넘기는 것과 「파생 문항 만들기」는 다음 단계(준비 중).
 * 문제집 탭: 문항을 순서대로 엮은 문제집(시험 대비·기초학력·수업 연습)을 만들고 순서를 바꾼다.
 * 저장소: lib/itemBank (프로토 IndexedDB — 상용은 서버 DB)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId, ITEM_TYPES, ITEM_TYPE_KEYS, TRACKS, WORKBOOK_PURPOSES, isReady, listItems, listPassages, listSources, putItem, deleteItems, listWorkbooks, putWorkbook, deleteWorkbook, changeItemType, stemText, hasAnswer, recheckAnswer } from './lib/itemBank';
import { WorkbookPicker, applyTrack, applyUnit } from './ItemBankParts';
import ItemCard from './ItemCard';
import RegisterDropdown from './RegisterDropdown';
import { loadCatalog } from './lib/taskFromFile';
import { unitOptionsFor } from './lib/itemExtract';
import { IssueList } from './TaskFileGenerate';
import ItemEditForm, { ItemEditDialog } from './ItemEditForm';
import { WorkbookInfoCard, ArrangeSummary, StepChips, topCurriculum } from './AnswerArrange';
import { WorkbookSheet, LayoutOptions } from './WorkbookLayout';
import WorkbookDeploy from './WorkbookDeploy';
import { ItemRow, RowHeader, GroupHeader, QuickCheck, Pager, needsCheck } from './ItemRows';
import { WORD_MODES, DEFAULT_WORD_LAYOUT, WordEditor, WordOrderTools, WordLayoutOptions, WordSheet, WordStandardsPicker, wordIssues, normMode, blankOf } from './WordWorkbook';



const chipBtn = (on) => ({
  padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer',
  border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569', whiteSpace: 'nowrap',
});
const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', background: 'white', color: '#334155' };
// [TSK-16] 교육청 문제 은행에서 복제한 문제집 · 문항 — 출처 표시
const EDU_CHIP = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' };
const btn = (primary, disabled, danger) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: danger ? '1px solid #FCA5A5' : primary ? '1px solid #2A75F3' : '1px solid #E2E8F0',
  background: primary ? '#2A75F3' : 'white', color: danger ? '#DC2626' : primary ? 'white' : '#475569',
});

// 서·논술 과제의 문항은 들어오지 않는다. 문항은 정답형 직접 등록·스마트 등록(TSK-15)으로 쌓인다 (QBK-01 v1.7 — 자료에서 문항 가져오기 삭제)
// [TSK-15 v1.5] 왼쪽 메뉴 「정답형 과제」 = 이 목록. registerItems가 있으면 [+ 새 과제 등록] → 정답형 직접 등록 · 스마트 등록
// initialTab · onTabChange — 왼쪽 메뉴 「정답형 과제 › 문항 / 문제집」과 탭을 맞춘다 (TSK-15 v1.10)
// [TSK-15 v1.42] 학생 배포 중인 문제집은 수정 잠금 — 그룹 배포·출력 단계만 쓸 수 있다
const LockWrap = ({ locked, onGoDeploy, children }) => (locked ? (
  <>
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#991B1B', fontWeight: 700, flexWrap: 'wrap' }}>
      <span>🔒</span>
      <span>학생 배포 중인 문제집은 수정할 수 없습니다. 수정하려면 「그룹 배포·출력」에서 학생 배포를 취소하세요.</span>
      <button type="button" onClick={onGoDeploy} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#B91C1C', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>그룹 배포·출력으로</button>
    </div>
    <div inert={true} aria-disabled="true" style={{ pointerEvents: 'none', opacity: 0.6, userSelect: 'none' }}>{children}</div>
  </>
) : children);

/* [QBK-01 v1.20] 일괄 변경 — 유형 · 수준 · 단원을 한 메뉴에 (선택 바 버튼을 줄이려고). 정답은 그대로 */
const BulkMenu = ({ items, onApply, unitOptions = [] }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const sid = items.find((it) => (it.track || 'curriculum') !== 'basic')?.curriculum?.subjectId;
  const unitTargets = items.filter((it) => (it.track || 'curriculum') !== 'basic' && it.curriculum?.subjectId === sid);
  const run = (list) => { setOpen(false); if (list.length) onApply(list); };
  const head = { padding: '8px 10px 4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8' };
  const row = { display: 'flex', gap: 8, width: '100%', padding: '7px 10px', border: 'none', borderRadius: 6, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#334155', cursor: 'pointer', textAlign: 'left' };
  const hover = { onMouseEnter: (e) => { e.currentTarget.style.background = '#EFF6FF'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; } };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={!items.length}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={btn(false, !items.length)}>일괄 변경 ▾</button>
      {open && (
        <div role="menu" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 30, width: 220, maxHeight: 420, overflowY: 'auto', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: 4 }}>
          <div style={head}>유형 (정답은 그대로)</div>
          {ITEM_TYPE_KEYS.map((k) => <button key={k} type="button" role="menuitem" style={row} {...hover} onClick={() => run(items.map((it) => changeItemType(it, k)))}><span aria-hidden="true">{ITEM_TYPES[k].icon}</span>{ITEM_TYPES[k].label}</button>)}
          <div style={head}>수준</div>
          {Object.entries(TRACKS).map(([k, t]) => <button key={k} type="button" role="menuitem" style={row} {...hover} title={t.desc} onClick={() => run(items.map((it) => applyTrack(it, k, { unitOptions })))}>{k === 'basic' ? '🧩' : '📘'} {t.label}</button>)}
          {unitOptions.length > 0 && <>
            <div style={head}>단원 {unitTargets.length < items.length ? `(학년 수준 ${unitTargets.length}개에만)` : ''}</div>
            {unitOptions.map((o) => <button key={o.areaId} type="button" role="menuitem" style={row} {...hover} disabled={!unitTargets.length} onClick={() => run(unitTargets.map((it) => applyUnit(it, o)))}>📘 {o.name}</button>)}
          </>}
        </div>
      )}
    </div>
  );
};

/* [QBK-01 v1.20] 문제집 카드 왼쪽 — 무엇이 인쇄되는지 한눈에 (aigle-v2 수업 자료의 쪽 썸네일) */
const SheetThumb = ({ title, lines }) => (
  <div aria-hidden="true" style={{ flex: '0 0 auto', width: 104, height: 146, background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, boxShadow: '0 1px 3px rgba(15,23,42,0.08)', padding: '8px 7px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ fontSize: 7, fontWeight: 900, color: '#1E293B', borderBottom: '1px solid #CBD5E1', paddingBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || '문제집'}</div>
    {lines.length ? lines.map((l, i) => (
      <div key={i} style={{ fontSize: 6, lineHeight: 1.35, color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l}</div>
    )) : <div style={{ fontSize: 6, color: '#CBD5E1' }}>비어 있음</div>}
  </div>
);

// registerUnified — [2.4] [+ 새 과제 등록] = 버튼 하나 → 정답형 직접 등록 + 자료 끌어다 놓기 (TSK-14 v1.8 §5A)
// [2.4] 출처 필터 — 문항은 [⚙ 필터] 안 선택 상자, 문제집은 카드 위 칩 (QBK-01 v1.34 · TSK-16 v1.6)
const SOURCES = [['all', '전체'], ['mine', '내가 만든 것'], ['edu', '🏛️ 교육청']];
const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const SourceChips = ({ value, onChange, counts }) => (
  <div role="radiogroup" aria-label="출처" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>출처</span>
    {SOURCES.map(([k, l]) => (
      <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} style={chipBtn(value === k)}>{l}{counts?.[k] != null ? ` ${counts[k]}` : ''}</button>
    ))}
  </div>
);
const ItemBank = ({ title = '문제 은행', registerItems = null, onRegister, initialTab = 'items', onTabChange, initialWbId = null, registerUnified = false,
  // [2.4] essayTasks — 문제집 목록에 함께 보일 서·논술형 과제 · onOpenEssay(task) 수정 · onDeployEssay(task) 출력·배포 · onDeleteEssay(task) 삭제 · eduSource 출처 필터 사용
  //   initialSourceId — 이 자료의 문항만 보며 연다(교육청 문항 복제 직후)
  essayTasks = [], onOpenEssay, onDeployEssay, onDeleteEssay, eduSource = false, essayInWorkbooks = false, initialSourceId = null }) => {
  const [srcF, setSrcF] = useState('all');
  const [wbEditIdx, setWbEditIdx] = useState(null); // 문제집 상세에서 문항 편집 중
  const [wbStep, setWbStep] = useState(1);          // 문제집 상세 단계 — 1 기본 정보 · 2 문제집 배치 (v1.18 — 순서 배치는 문제집 배치의 편집 모드로)
  const [wbEditing, setWbEditing] = useState(false); // 문제집 수정 모드 (열면 보기 — 출력 모양)
  const [wbNewId, setWbNewId] = useState(null);     // 방금 만든 문제집 — 버튼 「만들기 완료」 (기존 문제집은 「수정 완료」)
  const [wbActual, setWbActual] = useState(false);  // 100%로 보기
  const [wbRemoved, setWbRemoved] = useState(null); // 방금 뺀 문항 — 되돌리기
  const [items, setItems] = useState(null);
  const [passages, setPassages] = useState([]);
  const [sources, setSources] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [type, setType] = useState('all');
  // [QBK-01 v1.31] 학교급 · 학년 · 교과 · 단원 — 늘 보이는 선택 상자 (앞 칸을 바꾸면 뒤 칸은 전체로)
  const [levelF, setLevelF] = useState('all');
  const [gradeF, setGradeF] = useState('all');
  const [subject, setSubject] = useState('all');
  const [unitF, setUnitF] = useState('all');
  const [catalog, setCatalog] = useState(null);
  const [status, setStatus] = useState('all');
  const [sourceId, setSourceId] = useState(initialSourceId || 'all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState({});
  // [QBK-01 v1.26] 한 줄 표 — 정렬(단원순이면 단원별 묶음 · 접기) · 키보드 커서(J/K)
  const [sortBy, setSortBy] = useState('unit');
  const [collapsed, setCollapsed] = useState({});
  const [cursorId, setCursorId] = useState(null);
  const [editFull, setEditFull] = useState(false); // 확인 필요 문항도 「문제 내용 고치기」를 누르면 전체 편집 폼
  const [quickErr, setQuickErr] = useState('');
  // [QBK-01 v1.28] 쪽 넘김 — 한 쪽 20 · 50(기본) · 100개
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [filterOpen, setFilterOpen] = useState(false); // [QBK-01 v1.20] 필터는 [⚙ 필터] 뒤로
  const [cardMenu, setCardMenu] = useState(null);       // 문제집 카드 ⋯ 메뉴
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);     // 상세에서 고치는 중인 문항
  const [confirmDelete, setConfirmDelete] = useState(null); // 삭제할 id 배열
  const [toast, setToast] = useState('');
  const [tab, setTabState] = useState(initialTab); // 'items' | 'workbooks'
  const setTab = (k) => { setTabState(k); onTabChange?.(k); };
  const [trackF, setTrackF] = useState('all');
  const [workbooks, setWorkbooks] = useState([]);
  const [wbOpen, setWbOpen] = useState(false);    // 문제집에 담기 창
  const [openWbId, setOpenWbId] = useState(initialWbId); // 열어 본 문제집 — 스마트 등록 직후엔 만든 문제집
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
  const unitName = (i) => (i.track === 'basic' ? `기초학력${i.skill ? ` · ${i.skill}` : ''}` : i.unit?.areaName || '단원 미지정');
  const levelOf = (i) => i.curriculum?.schoolLevelName || '';
  const gradeOf = (i) => i.curriculum?.gradeLabel || '';
  const subjectOf = (i) => (i.track === 'basic' ? '기초학력' : i.curriculum?.subjectName || '');
  const leafOf = (i) => (i.track === 'basic' ? i.skill || '학습 기능 미지정' : i.unit?.areaName || '단원 미지정');
  // 검색 · 수준 · 자료 조건 (학교급 · 학년 · 교과 · 단원 선택지도 이 안에서 만든다)
  const treeBase = all.filter((i) =>
    (trackF === 'all' || (i.track || 'curriculum') === trackF)
    && (sourceId === 'all' || i.source?.sourceId === sourceId)
    && (srcF === 'all' || (srcF === 'edu' ? !!i.copiedFromEduId : !i.copiedFromEduId))
    && (!q.trim() || `${i.stem} ${i.material} ${(i.choices || []).map((c) => c.text).join(' ')} ${unitName(i)} ${i.unit?.label || ''}`.includes(q.trim())));
  const byName = (x, y) => (x.endsWith('미지정') - y.endsWith('미지정')) || x.localeCompare(y, 'ko', { numeric: true });
  const optsOf = (list, f) => [...new Set(list.map(f).filter(Boolean))].sort(byName);
  const atLevel = treeBase.filter((i) => levelF === 'all' || levelOf(i) === levelF);
  const atGrade = atLevel.filter((i) => gradeF === 'all' || gradeOf(i) === gradeF);
  const atSubject = atGrade.filter((i) => subject === 'all' || subjectOf(i) === subject);
  const levels = optsOf(treeBase, levelOf);
  const gradeOpts = optsOf(atLevel, gradeOf);
  const subjectOpts = optsOf(atGrade, subjectOf);
  const unitOpts = optsOf(atSubject, leafOf);
  const base = atSubject.filter((i) => unitF === 'all' || leafOf(i) === unitF);
  // 「확인 필요」 칩 — 다른 조건은 그대로 두고 확인 필요 문항만 (상태 조건을 뺀 수를 칩에 보인다)
  const reviewCount = base.filter(needsCheck).length;
  const baseS = base.filter((i) => status === 'all' || (status === 'ready' ? !needsCheck(i) : needsCheck(i)));
  const typeCounts = ITEM_TYPE_KEYS.reduce((acc, k) => ({ ...acc, [k]: baseS.filter((i) => i.itemType === k).length }), {});
  const unitKey = (i) => unitName(i);
  const SORTS = { unit: '단원순', recent: '최근 등록순', type: '유형순' };
  const sortedS = sortBy === 'recent' ? baseS
    : [...baseS].sort((a, b) => (sortBy === 'type'
      ? ITEM_TYPE_KEYS.indexOf(a.itemType) - ITEM_TYPE_KEYS.indexOf(b.itemType)
      : unitKey(a).localeCompare(unitKey(b), 'ko')));
  const filtered = sortedS.filter((i) => type === 'all' || i.itemType === type);
  // 단원순이면 단원별 묶음 — 접은 묶음의 문항은 보이지 않는다(선택도 풀린다)
  const groups = sortBy === 'unit' && unitF === 'all' ? filtered.reduce((acc, it) => { const k = unitKey(it); const g = acc.find((x) => x.key === k); if (g) g.items.push(it); else acc.push({ key: k, items: [it] }); return acc; }, []) : null;
  const visible = groups ? groups.flatMap((g) => (collapsed[g.key] ? [] : g.items)) : filtered;
  // 쪽 — visible(접은 묶음 뺀 전체 순서)을 나눈다. 번호 · ◀▶ · 다음 확인 필요 · J/K는 쪽을 넘어 이어진다
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageNo = Math.min(page, pages - 1);
  const pageRows = visible.slice(pageNo * pageSize, (pageNo + 1) * pageSize);
  const pageSet = new Set(pageRows.map((i) => i.id));
  const pageOf = (id) => { const k = visible.findIndex((i) => i.id === id); return k < 0 ? null : Math.floor(k / pageSize); };
  // 묶음 머리 — 이 쪽에 문항이 있는 묶음 + 접힌 묶음은 그 자리가 이 쪽 범위에 들 때
  const groupsOnPage = groups ? (() => {
    let at = 0;
    return groups.filter((g) => {
      const start = at;
      if (!collapsed[g.key]) { at += g.items.length; return g.items.some((i) => pageSet.has(i.id)); }
      const a = pageNo * pageSize; const b = (pageNo + 1) * pageSize;
      return (start >= a && start < b) || (start >= visible.length && pageNo === pages - 1);
    });
  })() : null;
  const chosenIds = Object.keys(selected).filter((id) => selected[id] && all.some((i) => i.id === id));
  // 머리줄 체크 = 이 쪽 문항 전체 · 선택 바의 「검색 결과 {N}문항 모두 선택」 = 모든 쪽
  const allOn = pageRows.length > 0 && pageRows.every((i) => selected[i.id]);
  const allVisibleOn = visible.length > 0 && visible.every((i) => selected[i.id]);
  // [QBK-01 v1.20] 선택 규칙 — 유형 · 필터 · 검색을 바꿔 안 보이게 된 문항은 선택을 푼다 (안 보이는 문항이 일괄 변경 · 삭제되지 않게)
  const visibleKey = visible.map((i) => i.id).join(',');
  useEffect(() => {
    const keep = new Set(visibleKey ? visibleKey.split(',') : []);
    setSelected((sel) => {
      const on = Object.keys(sel).filter((id) => sel[id]);
      if (on.every((id) => keep.has(id))) return sel;
      return Object.fromEntries(on.filter((id) => keep.has(id)).map((id) => [id, true]));
    });
  }, [visibleKey]);
  // 켠 필터 — 닫힌 필터에서도 칩으로 보이고 하나씩 끈다
  const activeFilters = [
    trackF !== 'all' && { key: 'track', label: `수준 ${TRACKS[trackF]?.label || trackF}`, clear: () => setTrackF('all') },
    srcF !== 'all' && { key: 'origin', label: `출처 ${SOURCES.find(([k]) => k === srcF)?.[1] || ''}`, clear: () => setSrcF('all') },
    sourceId !== 'all' && { key: 'source', label: `자료 ${sources.find((x) => x.id === sourceId)?.title || ''}`, clear: () => setSourceId('all') },
  ].filter(Boolean);
  const resetFilters = () => { setTrackF('all'); setStatus('all'); setSourceId('all'); setSrcF('all'); };

  const opened = all.find((i) => i.id === openId);
  // 고친 내용 있음 — 저장 시각·상태처럼 저장할 때 자동으로 붙는 값은 비교하지 않는다
  const comparable = (it) => { const { updatedAt, status, ...rest } = it || {}; return JSON.stringify(rest); };
  const dirty = !!(draft && opened && comparable(draft) !== comparable(opened));
  // [QBK-01 v1.2] 목록 | 상세 나란히 — 다른 문항을 누르면 상세가 닫히지 않고 그 문항으로 바뀐다
  //   고친 내용이 있으면 이동 전에 저장 여부를 묻는다 (pendingOpen)
  const [pendingOpen, setPendingOpen] = useState(null);
  const show = (it) => { setOpenId(it.id); setDraft(it); setEditFull(false); setQuickErr(''); setCursorId(it.id); const pg = pageOf(it.id); if (pg != null) setPage(pg); };
  // 조건 · 정렬 · 쪽 크기를 바꾸면 첫 쪽으로
  useEffect(() => { setPage(0); }, [q, type, status, levelF, gradeF, subject, unitF, trackF, sourceId, srcF, sortBy, pageSize]);
  const open = (it) => {
    if (it.id === openId) return;
    if (dirty) { setPendingOpen(it); return; }
    show(it);
  };
  // 닫기도 고친 내용이 있으면 먼저 묻는다 (✕ · Esc — QBK-01 v1.26 결함 수정)
  const doClose = () => { setOpenId(null); setDraft(null); setEditFull(false); setQuickErr(''); };
  const close = () => { if (dirty) { setPendingOpen({ close: true }); return; } doClose(); };
  // 넓은 화면이면 나란히, 좁으면(900px 미만) 오른쪽에서 나오는 패널
  const rootRef = useRef(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (!rootRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 900));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const doDelete = async () => {
    const ids = confirmDelete;
    await deleteItems(ids);
    setSelected((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !ids.includes(id))));
    if (ids.includes(openId)) doClose();
    setConfirmDelete(null);
    setToast(`문항 ${ids.length}개를 삭제했습니다.`);
  };


  // [QBK-01 v1.20] 편집 패널 — 창 대신 목록 옆에 늘 열려 있다. ◀ ▶로 다음 문항으로 넘어가며 연달아 고친다 (Quizizz · Kahoot 편집 참고)
  const openIdx = opened ? visible.findIndex((i) => i.id === opened.id) : -1;
  const goto = (d) => { const it = visible[openIdx + d]; if (it) open(it); };
  // 정답 확인 — 확인 필요 문항을 열면 정답 확인부터 (편집 폼은 「문제 내용 고치기」로)
  const reviewList = visible.filter(needsCheck);
  const quick = !!(opened && draft && needsCheck(opened) && !editFull);
  const confirmQuick = async () => {
    const x = { ...draft, issues: (draft.issues || []).filter((i) => i.level !== 'warn') };
    if (!hasAnswer(x)) { setQuickErr('정답을 입력해 주세요.'); return; }
    if (x.answerSource === 'ai') x.answerSource = 'teacher';
    const saved = await putItem({ ...x, status: isReady(x) ? 'ready' : 'needs_review', updatedAt: new Date().toISOString() });
    // 다음 확인 필요 — 지금 문항 뒤에서 찾고, 없으면 앞에서
    const idx = visible.findIndex((i) => i.id === saved.id);
    const rest = [...visible.slice(idx + 1), ...visible.slice(0, Math.max(0, idx))].filter((i) => i.id !== saved.id && needsCheck(i));
    if (rest.length) { show(rest[0]); setToast('확인했습니다. 다음 문항입니다.'); }
    else { doClose(); setToast('확인할 문항을 모두 처리했습니다.'); }
  };
  // 키보드 — 입력 칸 밖에서: J/K(↓/↑) 커서 · Space 선택 · Enter 열기 · Esc 닫기
  //   정답 확인 중: 1~9 보기 · O/X · Ctrl+Enter 정답 맞음
  const keyRef = useRef(null);
  keyRef.current = { visible, cursorId, openId, quick, draft, pendingOpen, confirmWbDelete, confirmDelete };
  useEffect(() => {
    if (tab !== 'items') return undefined;
    const onKey = (e) => {
      const k = keyRef.current;
      if (k.pendingOpen || k.confirmDelete || k.confirmWbDelete || e.altKey || e.metaKey) return;
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === 'Escape' && k.openId) { e.preventDefault(); close(); return; }
      if (k.quick && e.ctrlKey && e.key === 'Enter') { e.preventDefault(); confirmQuick(); return; }
      if (typing || e.ctrlKey) return;
      if (k.quick && k.draft) {
        const it = k.draft; const a = it.answer || {};
        const setA = (patch) => { setDraft(recheckAnswer({ ...it, answer: { ...a, ...patch }, answerSource: 'teacher' })); setQuickErr(''); };
        if (['multiple_choice', 'binary_choice'].includes(it.itemType) && /^[1-9]$/.test(e.key)) {
          const no = Number(e.key);
          if ((it.choices || []).some((c) => c.no === no)) { e.preventDefault(); setA({ choices: [no] }); }
          return;
        }
        if (it.itemType === 'true_false' && /^[oOxX]$/.test(e.key)) { e.preventDefault(); setA({ truth: /[oO]/.test(e.key) }); return; }
      }
      const list = k.visible; if (!list.length) return;
      const at = list.findIndex((i) => i.id === (k.cursorId || k.openId));
      const moveTo = (i) => { const n = Math.max(0, Math.min(list.length - 1, i)); const it = list[n]; setCursorId(it.id); setPage(Math.floor(n / pageSize)); setTimeout(() => document.querySelector(`[data-item-row="${it.id}"]`)?.scrollIntoView({ block: 'nearest' }), 0); };
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') { e.preventDefault(); moveTo(at + 1); }
      else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') { e.preventDefault(); moveTo(at < 0 ? 0 : at - 1); }
      else if (e.key === ' ' && at >= 0) { e.preventDefault(); const id = list[at].id; setSelected((s) => ({ ...s, [id]: !s[id] })); }
      else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); open(list[at]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // 삭제는 저장과 같은 버튼 줄 왼쪽에 (패널 아래 고정 — QBK-01 v1.30)
  const delBtn = opened ? <button type="button" onClick={() => setConfirmDelete([opened.id])} style={btn(false, false, true)}>🗑 삭제</button> : null;
  const editorBody = opened ? (
          <>
            <div style={{ padding: '10px 14px', background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 'var(--neo-font-size-base)' }}>문항 편집</strong>
              {openIdx >= 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{openIdx + 1} / {visible.length}</span>}
              <button type="button" onClick={() => goto(-1)} disabled={openIdx <= 0} aria-label="이전 문항" style={{ ...btn(false, openIdx <= 0), padding: '4px 10px' }}>◀</button>
              <button type="button" onClick={() => goto(1)} disabled={openIdx < 0 || openIdx >= visible.length - 1} aria-label="다음 문항" style={{ ...btn(false, openIdx < 0 || openIdx >= visible.length - 1), padding: '4px 10px' }}>▶</button>
              {dirty && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#B45309' }}>· 저장 안 함</span>}
              <span style={{ flex: 1 }} />
              
              <button onClick={close} aria-label="닫기" style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                {[opened.source?.fileName, opened.source?.page ? `${opened.source.page}쪽` : '', opened.lineage?.parentId ? '파생 문항' : ''].filter(Boolean).join(' · ')}
              </div>
              {passageById[opened.passageId] && (
                <details style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
                  <summary style={{ fontWeight: 800, cursor: 'pointer' }}>📖 공통 지문 {passageById[opened.passageId].range}</summary>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 6 }}>{passageById[opened.passageId].text}</div>
                </details>
              )}
              {quick ? (
                <QuickCheck item={draft} onChange={(x) => { setDraft(x); setQuickErr(''); }} onConfirm={confirmQuick} onEditFull={() => setEditFull(true)} error={quickErr} leftActions={delBtn}
                  pos={reviewList.findIndex((i) => i.id === opened.id) + 1} total={reviewList.length} />
              ) : (
              <ItemEditForm key={`${opened.id}:${opened.updatedAt || ''}`} initial={opened} mode="edit" hideNumber submitLabel="저장" leftActions={delBtn} stickyActions
                pages={sources.find((x) => x.id === opened.source?.sourceId)?.pageImages}
                unitOptions={catalog ? unitOptionsFor(catalog, opened.curriculum?.subjectId) : []}
                onDraft={setDraft}
                onSubmit={async (x) => { const saved = await putItem({ ...x, status: isReady(x) ? 'ready' : 'needs_review' }); setDraft(saved); setToast('문항을 저장했습니다.'); }} />
              )}
              {opened.track !== 'basic' && (opened.curriculum?.standards || []).length > 0 && (
                <details style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>단원 성취기준 {opened.curriculum.standards.length}개 (단원에 따라 정해짐)</summary>
                  {opened.curriculum.standards.map((x, k) => <div key={`${x.id || x.code || ''}-${k}`}>{x.code} {x.text}</div>)}
                </details>
              )}
            </div>
          </>
  ) : null;

  return (
    <div ref={rootRef} className="task-management-container" style={{ position: 'relative', flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
      {/* [QBK-01 v1.7] 「자료에서 문항 가져오기」 삭제 — 정답형 스마트 등록(TSK-15)이 같은 단계 + 과제 저장 + 문제 은행 저장을 한다 */}
      <>
      {/* [디자인 v2] 다른 목록 화면과 같은 머리 — 제목(이모지 · 위 「과제 관리」 표기 없이) 아래 개수 설명, 등록 버튼은 오른쪽 */}
      <header className="content-header" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{title}{onTabChange ? ({ workbooks: ' › 문제집', words: ' › 낱말 문제집' }[tab] || ' › 문항') : ''}</h1>
          <p className="content-subtitle">정답형 문항 {all.length}개 · 문제집 {workbooks.filter((w) => w.kind !== 'word').length}개 · 낱말 문제집 {workbooks.filter((w) => w.kind === 'word').length}개</p>
        </div>
        {/* 낱말 문제집 메뉴에는 [+ 새 과제 등록]을 두지 않는다 — 낱말 문제집은 2열의 [+ 🔤 낱말 문제집 만들기]로 (v1.34) */}
        {registerItems && tab !== 'words' && (
          registerUnified
            /* [2.4] 고르지 않고 바로 정답형 직접 등록 — 스마트 등록은 자료 끌어다 놓기 (TSK-14 v1.8) */
            ? <button type="button" onClick={() => onRegister?.('select')} style={{ ...btn(true), marginLeft: 'auto' }}>+ 새 과제 등록</button>
            : <RegisterDropdown items={registerItems} onPick={onRegister} buttonStyle={btn(true)} />
        )}
      </header>

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
      {/* [QBK-01 v1.20] 맨 위는 검색 1칸 + 유형 칩 + [필터]만. 교과 · 수준 · 단원 · 학교급 · 상태 · 자료는 [필터] 안으로 (aigle-v2 역기획 §6) */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 발문 · 보기 · 단원 검색" style={{ ...selectStyle, flex: 1, minWidth: 200 }} />
          <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}
            style={{ ...btn(false), padding: '8px 12px', borderColor: activeFilters.length ? '#2A75F3' : '#E2E8F0', color: activeFilters.length ? '#1D4ED8' : '#475569' }}>
            ⚙ 필터{activeFilters.length ? ` ${activeFilters.length}` : ''} {filterOpen ? '▴' : '▾'}
          </button>
        </div>
        {/* [QBK-01 v1.31] 학교급 · 학년 · 교과 · 단원 — 늘 보인다. 선택지는 앞 칸 조건에 있는 값만 */}
        <div role="group" aria-label="교육과정 조건" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="학교급" value={levelF} onChange={(e) => { setLevelF(e.target.value); setGradeF('all'); setSubject('all'); setUnitF('all'); }} style={selectStyle}>
            <option value="all">학교급: 전체</option>{levels.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select aria-label="학년" value={gradeF} onChange={(e) => { setGradeF(e.target.value); setSubject('all'); setUnitF('all'); }} style={selectStyle}>
            <option value="all">학년: 전체</option>{gradeOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select aria-label="교과" value={subject} onChange={(e) => { setSubject(e.target.value); setUnitF('all'); }} style={selectStyle}>
            <option value="all">교과: 전체</option>{subjectOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select aria-label="단원" value={unitF} onChange={(e) => setUnitF(e.target.value)} style={{ ...selectStyle, maxWidth: 280 }}>
            <option value="all">단원: 전체</option>{unitOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {(levelF !== 'all' || gradeF !== 'all' || subject !== 'all' || unitF !== 'all') && (
            <button type="button" onClick={() => { setLevelF('all'); setGradeF('all'); setSubject('all'); setUnitF('all'); }}
              style={{ border: 'none', background: 'transparent', color: '#1D4ED8', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>초기화</button>
          )}
        </div>
        {filterOpen && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}>
            <select value={trackF} onChange={(e) => setTrackF(e.target.value)} style={selectStyle}><option value="all">수준: 전체</option>{Object.entries(TRACKS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
            {eduSource && <select aria-label="출처" value={srcF} onChange={(e) => setSrcF(e.target.value)} style={selectStyle}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{k === 'all' ? '출처: 전체' : l}</option>)}</select>}
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...selectStyle, maxWidth: 260 }}><option value="all">자료: 전체</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
            {activeFilters.length > 0 && <button type="button" onClick={resetFilters} style={{ ...btn(false), padding: '7px 12px' }}>필터 초기화</button>}
          </div>
        )}
        {/* 켠 필터는 닫혀 있어도 칩으로 보인다 — ✕로 하나씩 끈다 */}
        {!filterOpen && activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {activeFilters.map((f) => (
              <span key={f.key} style={{ ...chipBtn(true), cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {f.label}
                <button type="button" aria-label={`${f.label} 필터 끄기`} onClick={f.clear} style={{ border: 'none', background: 'transparent', color: '#1D4ED8', cursor: 'pointer', fontWeight: 900, padding: 0 }}>✕</button>
              </span>
            ))}
          </div>
        )}
        {/* [QBK-01 v1.26] 맨 앞 「확인 필요 N」(누르면 확인 필요 문항만) · 전체 · 문항이 있는 유형만 (0개 유형은 숨김) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {reviewCount > 0 && (
            <button type="button" aria-pressed={status === 'review'} onClick={() => setStatus(status === 'review' ? 'all' : 'review')}
              style={{ ...chipBtn(status === 'review'), border: `1px solid ${status === 'review' ? '#D97706' : '#FCD34D'}`, background: status === 'review' ? '#FEF3C7' : '#FFFBEB', color: '#92400E' }}>
              ⚠ 확인 필요 {reviewCount}
            </button>
          )}
          <button type="button" aria-pressed={type === 'all' && status !== 'review'} style={chipBtn(type === 'all' && status !== 'review')} onClick={() => { setType('all'); setStatus('all'); }}>전체 {base.length}</button>
          {ITEM_TYPE_KEYS.filter((k) => typeCounts[k] || type === k).map((k) => (
            <button key={k} type="button" aria-pressed={type === k} style={chipBtn(type === k)} onClick={() => setType(type === k ? 'all' : k)} title={ITEM_TYPES[k].desc}>{ITEM_TYPES[k].label} {typeCounts[k]}</button>
          ))}
          <span style={{ flex: 1 }} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569' }}>정렬
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...selectStyle, padding: '6px 8px' }}>
              {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
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
          {/* 선택 바 — 고르면 표 위에 나타난다(목록을 내려도 위에 고정). 전체 선택은 표 머리줄 체크박스 (v1.27) */}
          {/* 높이는 늘 같다 — 고를 때 표가 밀리지 않게 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 8px', padding: '0 12px', minHeight: 44, boxSizing: 'border-box', background: chosenIds.length ? '#EFF6FF' : 'transparent', border: `1px solid ${chosenIds.length ? '#BFDBFE' : 'transparent'}`, borderRadius: 10, ...(chosenIds.length ? { position: 'sticky', top: 0, zIndex: 5 } : {}) }}>
            {chosenIds.length > 0 ? (<>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8' }}>{chosenIds.length}개 선택</span>
              {allOn && !allVisibleOn && (
                <button type="button" onClick={() => setSelected((sl) => ({ ...sl, ...Object.fromEntries(visible.map((i) => [i.id, true])) }))} style={{ border: 'none', background: 'transparent', color: '#1D4ED8', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>검색 결과 {visible.length}문항 모두 선택</button>
              )}
              <button type="button" onClick={() => setSelected({})} style={{ border: 'none', background: 'transparent', color: '#1D4ED8', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>선택 해제</button>
              <span style={{ flex: 1 }} />
              <button onClick={() => setWbOpen(true)} style={btn(true)}>📚 문제집에 담기</button>
              <BulkMenu items={all.filter((i) => chosenIds.includes(i.id))}
                unitOptions={catalog ? unitOptionsFor(catalog, all.find((i) => chosenIds.includes(i.id) && (i.track || 'curriculum') !== 'basic')?.curriculum?.subjectId) : []}
                onApply={async (list) => { for (const it of list) await putItem({ ...it, status: isReady(it) ? 'ready' : 'needs_review' }); setToast(`문항 ${list.length}개를 바꿨습니다.`); }} />
              <button onClick={() => setConfirmDelete(chosenIds)} style={btn(false, false, true)}>🗑 삭제</button>
            </>) : <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{filtered.length}개 표시 중</span>}
          </div>
          {/* [QBK-01 v1.26] 한 줄 표 — 번호 · 유형 · 문항(선다형은 보기까지) · 정답 · 배점 · 상태. 줄을 누르면 옆 편집 패널 */}
          <div role="table" aria-label="문항 목록" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            <RowHeader narrow={!!(wide && editorBody)} allOn={allOn} someOn={pageRows.some((i) => selected[i.id])} count={pageRows.length}
              onToggleAll={() => setSelected((sl) => ({ ...sl, ...Object.fromEntries(pageRows.map((i) => [i.id, !allOn])) }))} />
            {(groupsOnPage || [{ key: '', items: pageRows }]).map((g) => (
              <React.Fragment key={g.key || 'all'}>
                {groups && <GroupHeader label={g.key} count={g.items.length} review={g.items.filter(needsCheck).length} collapsed={!!collapsed[g.key]} onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))} />}
                {!collapsed[g.key] && g.items.filter((it) => pageSet.has(it.id)).map((it) => (
                  <ItemRow key={it.id} item={it} no={visible.indexOf(it) + 1} checked={!!selected[it.id]} active={it.id === openId} cursor={it.id === cursorId && it.id !== openId} narrow={!!(wide && editorBody)}
                    onToggle={() => setSelected((s) => ({ ...s, [it.id]: !s[it.id] }))} onOpen={() => { setCursorId(it.id); open(it); }} />
                ))}
              </React.Fragment>
            ))}
            {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>{status === 'review' ? '확인할 문항이 없습니다.' : '조건에 맞는 문항이 없습니다.'}</div>}
          </div>
          {visible.length > 0 && <Pager page={pageNo} pages={pages} total={visible.length} size={pageSize} onSize={setPageSize}
            onPage={(pg) => { setPage(pg); rootRef.current?.scrollTo({ top: 0 }); }} />}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
            <span>J / K 위아래</span><span>Space 선택</span><span>Enter 열기</span><span>Esc 닫기</span>
          </div>
        </>
      )}
      </>}

      {/* 문제집 탭 */}
      {/* [TSK-15 v1.34] 문제집 · 낱말 문제집 — 2열: 목록(수정 중이면 단계) · 오른쪽: 상세. 첫 문제집이 기본 */}
      {(tab === 'workbooks' || tab === 'words') && (() => {
        const itemById = Object.fromEntries(all.map((i) => [i.id, i]));
        const save = async (next) => { await putWorkbook(next); };
        // [TSK-15 v1.26] 낱말 문제집 — 영어 단어 시험 · 받아쓰기. 교사가 직접 낱말을 입력한다
        const createWordWb = async () => {
          const id = newId('wb');
          await putWorkbook({ id, kind: 'word', title: '새 낱말 문제집', purpose: 'practice', itemIds: [], words: [], mode: 'vocab', curriculum: { curriculumName: '영어', subjectName: '영어' }, layout: { ...DEFAULT_WORD_LAYOUT } });
          setOpenWbId(id); setWbStep(1); setWbEditing(true); setWbRemoved(null); setWbNewId(id);
          try { localStorage.setItem('aigle:lastWb:words', id); } catch { /* 무시 */ }
        };
        // 이 메뉴의 문제집만 — 📚 문제집 = 문항 문제집, 🔤 낱말 문제집 = 낱말 문제집
        const list = workbooks.filter((w) => (tab === 'words' ? w.kind === 'word' : w.kind !== 'word'));
        const lastKey = `aigle:lastWb:${tab}`;
        // [QBK-01 v1.20] 처음엔 카드 목록(aigle-v2 수업 자료처럼), 카드를 누르면 상세
        const wb = list.find((w) => w.id === openWbId) || null;
        const pick = (w) => { setOpenWbId(w.id); setWbStep(1); setWbEditing(false); setWbRemoved(null); try { localStorage.setItem(lastKey, w.id); } catch { /* 무시 */ } };
        const renderDetail = (wb) => {
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
                <button onClick={() => { setOpenWbId(null); setWbEditing(false); setWbNewId(null); }} style={{ ...btn(false), padding: '6px 10px' }}>← 목록</button>
                <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B', flex: 1, minWidth: 160 }}>🔤 {wb.title || '이름 없는 낱말 문제집'}<span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B' }}>{wShort}</span>{wbEditing && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '2px 8px' }}>{wbNewId === wb.id ? '새로 만드는 중' : '수정 중'}</span>}</span>
                {wbEditing ? (
                  <button onClick={() => { save(wb); setWbEditing(false); setWbNewId(null); }} style={btn(true)}>{wbNewId === wb.id ? '✅ 만들기 완료' : '✅ 수정 완료'}</button>
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
                  {!wide && <StepChips steps={['기본 정보', '낱말 입력', '문제집 배치', '그룹 배포·출력']} step={wbStep} onStep={setWbStep} />}
                  <LockWrap locked={(wb.deploy?.groups || []).some((g) => g.studentDeployed) && wbStep < 4} onGoDeploy={() => setWbStep(4)}>
                  <>
                  {wbStep === 1 && (
                    <WorkbookInfoCard purpose={wb.purpose} purposes={WORKBOOK_PURPOSES} onPurpose={(p) => save({ ...wb, purpose: p })}
                      title={wb.title} onTitle={(t) => setW({ title: t })} onTitleBlur={() => save(wb)}
                      curriculum={wcur} onCurriculum={(c) => setW({ curriculum: c })} onCurriculumSave={(c) => save({ ...wb, curriculum: c })}
                      allowedCurricula={normMode(wb.mode) === 'dictation' ? ['국어', '영어'] : null}>
                      <div><span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 6, display: 'block' }}>출제 방식</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="출제 방식">
                          {Object.entries(WORD_MODES).map(([k, m]) => (
                            <button key={k} type="button" role="radio" aria-checked={normMode(wb.mode) === k} onClick={() => { const lang = ['국어', '영어'].includes(wcur.curriculumName) ? wcur.curriculumName : '국어'; save({ ...wb, mode: k, ...(k === 'vocab' ? { curriculum: { ...wcur, curriculumName: '영어', subjectName: '영어' } } : { curriculum: { ...wcur, curriculumName: lang, subjectName: lang } }) }); }} // [v1.36] 낱말 시험 → 영어 · [v1.38] 받아쓰기 → 지금 교과가 국어/영어면 그대로, 아니면 국어
                              style={{ padding: '8px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${normMode(wb.mode) === k ? '#2A75F3' : '#E2E8F0'}`, background: normMode(wb.mode) === k ? '#EFF6FF' : 'white', color: normMode(wb.mode) === k ? '#1D4ED8' : '#475569' }}>
                              {m.icon} {m.label}
                            </button>
                          ))}
                        </div>
                        {/* [v1.38] 받아쓰기 언어 선택 삭제 — 교과(국어 · 영어)로 정한다 */}
                      </div>
                      {/* [v1.36] 낱말 시험 — 핵심평가영역 · 성취기준 (AI 낱말 만들기 근거) */}
                      {normMode(wb.mode) === 'vocab' && (
                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                          <WordStandardsPicker curriculum={wcur} value={wb.standards} onChange={(v) => save({ ...wb, standards: v })} />
                        </div>
                      )}
                    </WorkbookInfoCard>
                  )}
                  {wbStep === 2 && <WordEditor key={wb.id} words={words} mode={wb.mode} dictLang={wcur.curriculumName === '영어' ? '영어' : '국어'} onNotice={setToast} onSave={(next) => save({ ...wb, words: next })} ai={{ cur: wcur, codes: wb.standards?.codes || [] }} />}
                  {wbStep === 3 && (
                    <>
                      <WordLayoutOptions layout={wb.layout} onChange={(l) => save({ ...wb, layout: l })}>{actualW}</WordLayoutOptions>
                      <WordOrderTools words={words} mode={wb.mode} onChange={(next) => save({ ...wb, words: next })} />
                      <WordSheet title={wb.title} curriculum={wcur} words={words} mode={wb.mode} layout={wb.layout} actualSize={wbActual}
                        editMode onOrder={(next) => save({ ...wb, words: next })}
                        onToggleBlank={(id) => save({ ...wb, words: words.map((w, i) => (w.id === id ? { ...w, blank: blankOf(w, wb.mode, i) === 'word' ? 'meaning' : 'word' } : w)) })} />
                    </>
                  )}
                  </>
                  </LockWrap>
                  {wbStep === 4 && (
                    <WorkbookDeploy wb={wb} onSave={save} paper={wb.layout?.paper || 'A4'} onNotice={setToast}
                      sheet={<WordSheet title={wb.title} curriculum={wcur} words={words} mode={wb.mode} layout={wb.layout} actualSize />} />
                  )}
                </>
              )}
            </div>
          );
        }
        const its = wb.itemIds.map((id) => itemById[id]).filter(Boolean);
        // [TSK-15 v1.20] 문제집 상세 — 보기(출력 모양) / [✏️ 수정] → ① 기본 정보 ② 문제집 배치. 모두 문제집에 바로 저장
        //   과제로 저장(배포·채점)은 다음 단계에서 한다
        // [TSK-15 v1.55] 서술형 문항은 답안 길이(한 단 · N쪽, 기본 한 단 — 답 칸 없음 폐기)를 문제집 배치에서 고른다
        const entries = its.map((item) => ({ item, points: wb.points?.[item.id] ?? item.points ?? 1, answerSpace: wb.answerSpace?.[item.id] || '' }));
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
          onAnswerSpace: (id, v) => save({ ...wb, answerSpace: { ...(wb.answerSpace || {}), [id]: v } }),
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
              <button onClick={() => { setOpenWbId(null); setWbEditing(false); setWbNewId(null); }} style={{ ...btn(false), padding: '6px 10px' }}>← 목록</button>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B', flex: 1, minWidth: 160 }}>📚 {wb.title || '이름 없는 문제집'}<span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#64748B' }}>{curShort}</span>{wbEditing && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 999, padding: '2px 8px' }}>{wbNewId === wb.id ? '새로 만드는 중' : '수정 중'}</span>}</span>
              {wbEditing ? (
                <>
                  <button onClick={() => { setWbEditing(false); setWbRemoved(null); setWbNewId(null); }} style={btn(true)}>{wbNewId === wb.id ? '✅ 만들기 완료' : '✅ 수정 완료'}</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>{WORKBOOK_PURPOSES[wb.purpose]?.icon} {WORKBOOK_PURPOSES[wb.purpose]?.label}</span>
                  {wb.origin?.kind === 'edu' && <span title="교육청 문제 은행에서 복제한 문제집" style={EDU_CHIP}>🏛️ 교육청</span>}
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
                {!wide && <StepChips steps={['기본 정보', '문제집 배치', '그룹 배포·출력']} step={wbStep} onStep={setWbStep} />}
                <LockWrap locked={(wb.deploy?.groups || []).some((g) => g.studentDeployed) && wbStep < 3} onGoDeploy={() => setWbStep(3)}>
                <>
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
                </LockWrap>
                {wbStep === 3 && (
                  <WorkbookDeploy wb={wb} onSave={save} paper={wb.layout?.paper || 'A4'} onNotice={setToast}
                    sheet={<WorkbookSheet {...sheetProps} editMode={false} actualSize />} />
                )}
              </>
            )}
            {wbEditIdx != null && its[wbEditIdx] && (
              <ItemEditDialog open hideNumber item={its[wbEditIdx]} pages={sources.find((x) => x.id === its[wbEditIdx].source?.sourceId)?.pageImages}
                unitOptions={catalog ? unitOptionsFor(catalog, its[wbEditIdx].curriculum?.subjectId) : []}
                scopeNote="문제 은행 원본이 바뀝니다 · 이미 저장한 과제는 그대로" onClose={() => setWbEditIdx(null)}
                onSave={async (x) => { await putItem({ ...x, status: isReady(x) ? 'ready' : 'needs_review' }); setToast(`${wbEditIdx + 1}번 문항을 저장했습니다.`); }} />
            )}
          </div>
        );
        };
        // [QBK-01 v1.33] 카드 아래 버튼 줄 — 문제집 · 서·논술 과제 모두 [🖨 출력·배포] · ⋯([✏️ 수정] · [🗑 삭제])
        const menuItemStyle = (danger) => ({ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: danger ? '#DC2626' : undefined, cursor: 'pointer' });
        const cardActions = (key, onDeploy, onEdit, onDelete) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDeploy(); }} style={btn(true)}>🖨 출력·배포</button>
            <span style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <button type="button" aria-label="더보기" aria-expanded={cardMenu === key} onClick={(e) => { e.stopPropagation(); setCardMenu((m) => (m === key ? null : key)); }} style={{ ...btn(false), padding: '6px 10px' }}>⋯</button>
              {cardMenu === key && (
                <div role="menu" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 20, width: 140, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', padding: 4 }}>
                  <button type="button" role="menuitem" onClick={() => { setCardMenu(null); onEdit(); }} style={menuItemStyle(false)}>✏️ 수정</button>
                  <button type="button" role="menuitem" onClick={() => { setCardMenu(null); onDelete(); }} style={menuItemStyle(true)}>🗑 삭제</button>
                </div>
              )}
            </div>
          </div>
        );
        // [QBK-01 v1.20] 문제집 카드 — 왼쪽 시험지 미리 보기 · 오른쪽 이름 · 교육과정 한 줄 · 유형별 문항 수 · 주된 버튼 [🖨 출력·배포] 하나
        const card = (w) => {
          const isWord = w.kind === 'word';
          const its = isWord ? [] : w.itemIds.map((id) => itemById[id]).filter(Boolean);
          const review = its.filter((i) => !isReady(i)).length;
          const cur = w.curriculum || (isWord ? {} : topCurriculum(its));
          const curLine = [cur.schoolLevelName, cur.gradeLabel, cur.subjectName || cur.curriculumName].filter(Boolean).join(' · ') || (its.length && its.every((i) => i.track === 'basic') ? '기초학력' : '교육과정 미지정');
          const unitsLine = [...new Set(its.filter((i) => i.track !== 'basic').map((i) => i.unit?.areaName).filter(Boolean))].join(', ');
          const typeCount = isWord ? [] : ITEM_TYPE_KEYS.map((k) => [k, its.filter((i) => i.itemType === k).length]).filter(([, n]) => n);
          const groups = w.deploy?.groups || [];
          const [stLabel, stBg, stColor] = groups.some((g) => g.studentDeployed) ? ['학생 배포 중', '#ECFDF5', '#047857'] : groups.some((g) => g.printed) ? ['출력 완료', '#EFF6FF', '#1D4ED8'] : [null];
          // [QBK-01 v1.32] 출력·배포 전에는 상태 표식을 두지 않는다 (서·논술 과제의 「작성중」도 같음)
          const lines = isWord ? (w.words || []).filter((x) => x.word?.trim()).slice(0, 7).map((x, i) => `${i + 1}. ${x.word}`) : its.slice(0, 7).map((i, n) => `${n + 1}. ${stemText(i.stem)}`);
          const go = (edit, step) => { pick(w); if (edit) { setWbEditing(true); setWbStep(step); } };
          return (
            <div key={w.id} role="button" tabIndex={0} onClick={() => go(false)} onKeyDown={(e) => { if (e.key === 'Enter') go(false); }}
              style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', gap: 16, cursor: 'pointer', textAlign: 'left', position: 'relative' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}>
              <SheetThumb title={w.title} lines={lines} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B' }}>{isWord ? `${WORD_MODES[normMode(w.mode)].icon} ${WORD_MODES[normMode(w.mode)].label}` : `${WORKBOOK_PURPOSES[w.purpose]?.icon || ''} ${WORKBOOK_PURPOSES[w.purpose]?.label || ''}`}</span>
                  {stLabel && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: stBg, color: stColor, borderRadius: 999, padding: '2px 8px' }}>{stLabel}</span>}
                  {w.origin?.kind === 'edu' && <span title="교육청 문제 은행에서 복제한 문제집" style={EDU_CHIP}>🏛️ 교육청</span>}
                  {review > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#FEF2F2', color: '#B91C1C', borderRadius: 999, padding: '2px 8px' }}>확인 필요 {review}</span>}
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title || '이름 없음'}</div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{curLine}{unitsLine ? ` · ${unitsLine}` : ''}</div>
                {isWord ? (
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>낱말 {(w.words || []).filter((x) => x.word?.trim()).length}개</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 16px' }}>
                    {typeCount.length ? typeCount.map(([k, n]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--neo-font-size-sm)', borderBottom: '1px solid #F1F5F9', padding: '2px 0' }}>
                        <span style={{ color: '#334155' }}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</span><span style={{ color: '#64748B' }}>{n}문항</span>
                      </div>
                    )) : <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>문항 없음</span>}
                  </div>
                )}
                {cardActions(w.id, () => go(true, isWord ? 4 : 3), () => go(true, 1), () => setConfirmWbDelete(w))}
              </div>
            </div>
          );
        };
        const addBtn = tab === 'words'
          ? <button onClick={createWordWb} style={{ ...btn(true), width: '100%' }}>+ 🔤 낱말 문제집 만들기</button>
          : null;
        const empty = tab === 'words' ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>아직 낱말 문제집이 없습니다. 영어 단어 시험 · 받아쓰기를 낱말 목록으로 만듭니다.</div>
        ) : (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: 'var(--neo-font-size-sm)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span>아직 문제집이 없습니다. 「문항」 메뉴에서 문항을 골라 [📚 문제집에 담기]를 누르면 문제집이 만들어집니다.</span>
            <button onClick={() => setTab('items')} style={btn(true)}>문항 고르러 가기</button>
          </div>
        );
        // 수정 중이면 2열 = 단계 메뉴 (서·논술형 직접 등록과 같은 모양)
        const steps = wb?.kind === 'word' ? ['기본 정보', '낱말 입력', '문제집 배치', '그룹 배포·출력'] : ['기본 정보', '문제집 배치', '그룹 배포·출력']; // [v1.41] 그룹 배포·출력
        const stepCol = (
          <nav aria-label="수정 단계" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((l, i) => {
              const n = i + 1; const now = n === wbStep; const done = n < wbStep;
              return (
                <button key={l} type="button" aria-current={now ? 'step' : undefined} onClick={() => setWbStep(n)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 14px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', cursor: now ? 'default' : 'pointer',
                    border: now ? '1.5px solid #2A75F3' : '1.5px solid transparent', background: now ? 'white' : '#E9EDF2', boxShadow: now ? '0 2px 8px rgba(42,117,243,0.12)' : 'none',
                    color: now ? '#1D4ED8' : '#475569', fontSize: 'var(--neo-font-size-base)', fontWeight: now ? 800 : 600 }}>
                  <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, background: done || now ? '#2A75F3' : '#CBD5E1', color: 'white' }}>{done ? '✓' : n}</span>
                  {l}
                </button>
              );
            })}
          </nav>
        );
        // 목록 — 카드 격자. 상세 — 보기는 넓게, 수정 중이면 왼쪽에 단계 메뉴
        if (!wb) {
          // [2.4] 문제집 목록 = 정답형 문제집 + 서·논술형 과제, 출처 필터(전체 · 내가 만든 것 · 교육청) — 교육청은 내 사본 + 아직 복제하지 않은 원본
          const withEssay = (eduSource || essayInWorkbooks) && tab === 'workbooks';
          const isEduWb = (w) => w.origin?.kind === 'edu';
          const byWb = (w) => srcF === 'all' || (srcF === 'edu' ? isEduWb(w) : !isEduWb(w));
          const byTask = (t) => srcF === 'all' || (srcF === 'edu' ? !!t.copiedFromEduId : !t.copiedFromEduId);
          const shownWbs = eduSource ? list.filter(byWb) : list;
          const essays = withEssay ? essayTasks.filter(byTask) : [];
          const essayCard = (t) => {
            const qs = (t.detail?.questions || []).map((q) => stripHtml(q.content || q.questionContent || q.text)).filter(Boolean);
            return (
              <div key={`essay-${t.id}`} role="button" tabIndex={0} onClick={() => onOpenEssay?.(t)} onKeyDown={(e) => { if (e.key === 'Enter') onOpenEssay?.(t); }}
                style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', gap: 16, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C4B5FD'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}>
                <SheetThumb title={t.title} lines={qs.slice(0, 7).map((q, n) => `${n + 1}. ${q}`)} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#F5F3FF', color: '#6D28D9', borderRadius: 999, padding: '2px 8px' }}>📝 서·논술</span>
                    {t.status && t.status !== '작성중' && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: '#F1F5F9', color: '#64748B', borderRadius: 999, padding: '2px 8px' }}>{t.status}</span>}
                    {t.copiedFromEduId && <span title="교육청 문제 은행에서 복제한 과제" style={EDU_CHIP}>🏛️ 교육청</span>}
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '이름 없음'}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{[t.schoolLevel, [t.subject, t.subSubject].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || '교육과정 미지정'}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>문항 {t.questions ?? qs.length}개{t.points != null ? ` · 총 ${t.points}점` : ''}</div>
                  {cardActions(`essay-${t.id}`, () => (onDeployEssay || onOpenEssay)?.(t), () => onOpenEssay?.(t), () => onDeleteEssay?.(t))}
                </div>
              </div>
            );
          };
          const total = shownWbs.length + essays.length;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onClick={() => setCardMenu(null)}>
              {addBtn && <div style={{ maxWidth: 300 }}>{addBtn}</div>}
              {eduSource && tab === 'workbooks' && (
                <SourceChips value={srcF} onChange={setSrcF} counts={{
                  all: list.length + essayTasks.length,
                  mine: list.filter((w) => !isEduWb(w)).length + essayTasks.filter((t) => !t.copiedFromEduId).length,
                  edu: list.filter(isEduWb).length + essayTasks.filter((t) => t.copiedFromEduId).length,
                }} />
              )}
              {total ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 14 }}>
                  {shownWbs.map((w) => card(w))}
                  {essays.map(essayCard)}
                </div>
              ) : (srcF === 'all' ? empty : <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>조건에 맞는 문제집이 없습니다.</div>)}
            </div>
          );
        }
        if (wbEditing && wide) {
          return (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <aside aria-label="수정 단계" style={{ flex: '0 0 220px', position: 'sticky', top: 0 }}>{stepCol}</aside>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>{renderDetail(wb)}</div>
            </div>
          );
        }
        return renderDetail(wb);
      })()}

      </div>
      {/* [QBK-01 v1.20] 편집 패널 — 넓은 화면: 목록 오른쪽(문항을 고르면 열림). 고르기 전에는 목록이 넓게 */}
      {wide && tab === 'items' && editorBody && (
        <aside role="region" aria-label="문항 편집"
          style={{ flex: '0 0 min(560px, 46%)', position: 'sticky', top: 0, maxHeight: 'calc(100vh - 200px)', minHeight: 420, display: 'flex', flexDirection: 'column', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
          {editorBody}
        </aside>
      )}
      </div>
      {/* 상세 — 좁은 화면: 오른쪽에서 나오는 패널 */}
      {!wide && tab === 'items' && editorBody && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 900 }}>
          <aside onClick={(e) => e.stopPropagation()} role="dialog" aria-label="문항 상세"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: '#F8FAFC', boxShadow: '-12px 0 32px rgba(15,23,42,0.15)', display: 'flex', flexDirection: 'column' }}>
            {editorBody}
          </aside>
        </div>
      )}


      {/* 고친 내용이 있는데 다른 문항을 누름 */}
      {pendingOpen && (
        <div onClick={() => setPendingOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 440, maxWidth: '94vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800 }}>저장하지 않은 내용이 있습니다</h3>
            <p style={{ margin: '0 0 18px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>저장하지 않고 {pendingOpen.close ? '닫으면' : '이동하면'} 고친 내용이 사라집니다.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button autoFocus onClick={() => setPendingOpen(null)} style={btn(false)}>취소 (계속 고치기)</button>
              <button onClick={() => { const it = pendingOpen; setPendingOpen(null); if (it.close) doClose(); else show(it); }} style={{ ...btn(true), background: '#EF4444', borderColor: '#EF4444' }}>저장하지 않고 {pendingOpen.close ? '닫기' : '이동'}</button>
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
