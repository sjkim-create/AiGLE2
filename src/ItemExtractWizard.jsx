/**
 * ItemExtractWizard — 스마트 과제 등록 › 정답형 (TSK-14)
 *
 * STEP 1 자료 올리기 → STEP 2 문항 분류(자동) → STEP 3 확인·선택 → STEP 4 문제 은행 저장
 * 저장한 문항은 문제 은행(QBK-01)에 쌓이고, 다음 단계 「과제 배치」에서 평가 문항으로 엮는다(준비 중).
 * [분할 추출] 30쪽이 넘는 자료는 30쪽(한 구간)씩 분석한다. 구간 결과를 확인한 뒤 다음 구간을 이어서 돌리거나 시작 쪽을 바꿔 건너뛴다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { extractItemsFromFile, EXTRACT_STEPS, unitOptionsFor, pagesOfItems } from './lib/itemExtract';
import { analyzeSample, makeSampleFile } from './lib/sampleItems';
import { isFileGenerateAvailable, GenerateError, ITEM_MAX_PAGES, ITEM_MAX_FILE_MB, loadCatalog } from './lib/taskFromFile';
import { ITEM_TYPES, ITEM_TYPE_KEYS, hasAnswer, saveExtraction } from './lib/itemBank';
import ItemCard from './ItemCard';
import { BulkEditBar, WorkbookPicker, SubjectPicker, applySubject } from './ItemBankParts';
import { ItemEditDialog } from './ItemEditForm';
import { IssueList } from './TaskFileGenerate';

const STEPS = ['자료 올리기', '문항 분류', '확인·선택', '문제 은행 저장'];
const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 24px', width: '100%', boxSizing: 'border-box' };
const btn = (primary, disabled) => ({
  padding: '10px 18px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569',
});
const chipBtn = (on) => ({
  padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer',
  border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569', whiteSpace: 'nowrap',
});

// [분할 추출] 구간이 둘 이상인 자료는 확인 항목 앞에 쪽 범위를 붙인다 (어느 구간에서 나온 문제인지)
const tagIssues = (list, range) => (range.total > ITEM_MAX_PAGES
  ? list.map((i) => (i.field === '구간' ? i : { ...i, field: `${range.from}~${range.to}쪽 · ${i.field}` }))
  : list);

// 이어서 분석한 구간을 지금까지의 결과에 붙인다 — 같은 자료(sourceId)이므로 원본 쪽 이미지·문항 목록을 합친다
const mergeSection = (cur, r) => {
  const byNo = new Map([...(cur.source.pageImages || []), ...(r.source.pageImages || [])].map((pg) => [pg.no, pg]));
  const base = !cur.items.length && r.items.length ? r.source : cur.source; // 앞 구간에서 문항을 못 찾았으면 이 구간의 교육과정 정보를 쓴다
  const items = [...cur.items, ...r.items];
  return {
    ...cur,
    source: { ...base, id: cur.source.id, itemIds: items.map((i) => i.id), pageImages: [...byNo.values()].sort((a, b) => a.no - b.no) },
    passages: [...cur.passages, ...r.passages],
    items,
    summaryIssues: [...cur.summaryIssues, ...tagIssues(r.summaryIssues, r.range)],
    meta: r.meta,
  };
};

// 저장·다음 단계로 넘길 때 원본 쪽 이미지는 고른 문항이 나온 쪽만 남긴다
const trimSource = (source, chosen) => {
  const keep = pagesOfItems(chosen);
  return { ...source, itemIds: chosen.map((it) => it.id), pageImages: (source.pageImages || []).filter((pg) => keep.has(pg.no)) };
};

const Stepper = ({ step, steps = STEPS }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
    {steps.map((label, i) => {
      const n = i + 1; const state = n < step ? 'done' : n === step ? 'now' : 'todo';
      return (
        <React.Fragment key={label}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
            background: state === 'now' ? '#EFF6FF' : state === 'done' ? '#ECFDF5' : '#F8FAFC',
            color: state === 'now' ? '#1D4ED8' : state === 'done' ? '#047857' : '#94A3B8',
            border: `1px solid ${state === 'now' ? '#93C5FD' : state === 'done' ? '#A7F3D0' : '#E2E8F0'}`,
          }}>{state === 'done' ? '✓' : n}. {label}</span>
          {n < steps.length && <span style={{ color: '#CBD5E1' }}>›</span>}
        </React.Fragment>
      );
    })}
  </div>
);

// onPick — 정답형 과제 만들기(과제 관리) 안에서 쓸 때: 확인·선택 뒤 문제 은행에 저장하지 않고 고른 문항을 넘긴다 ({ items, passages, source })
// pickLabel(n) — onPick 버튼 이름 (정답형 스마트 등록은 「문제집 만들기」)
// initialFile — [2.4] 과제 등록 › 스마트 등록에서 이미 올린 자료. 있으면 자료 올리기를 건너뛰고 바로 분석한다
const ItemExtractWizard = ({ onBack, onGoItemBank, onPick, pickLabel, initialFile = null }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [subStep, setSubStep] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { source, passages, items, summaryIssues }
  const [selected, setSelected] = useState({});
  const [typeFilter, setTypeFilter] = useState('all');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState([]);
  const [editing, setEditing] = useState(null); // 문항 편집 중인 문항
  const [wbOpen, setWbOpen] = useState(false);
  const [wbDone, setWbDone] = useState(null); // 담은 문제집
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const available = isFileGenerateAvailable();
  // [분할 추출] 분석한 구간 · 다음 시작 쪽 · 이어서 분석 중 여부
  const [sections, setSections] = useState([]); // [{ from, to, count, failed: [{ from, to }] }] — failed: AI 호출이 실패해 다시 분석할 쪽
  const [nextFrom, setNextFrom] = useState(1);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState(null);
  // 단원 선택지 — 자료의 과목에 속한 단원(핵심평가영역)
  const [unitOptions, setUnitOptions] = useState([]);
  // 자료 전체 교과 지정 — AI가 교과를 맞추지 못했을 때(또는 바꿀 때) 교사가 고른다
  const [cat, setCat] = useState(null);
  const [subjectEdit, setSubjectEdit] = useState(false);
  useEffect(() => { loadCatalog().then(setCat).catch(() => setCat(null)); }, []);
  const applySourceSubject = (cur) => {
    setResult((r) => ({
      ...r,
      source: { ...r.source, curriculum: { ...r.source.curriculum, ...cur } },
      items: r.items.map((it) => ((it.track || 'curriculum') === 'basic' ? { ...it, curriculum: { ...it.curriculum, ...cur } } : applySubject(it, cur))),
      summaryIssues: r.summaryIssues.filter((i) => !['교육과정', '과목'].includes(i.field) && !/교과를 확인하지 못/.test(i.message || '')),
    }));
    setSubjectEdit(false);
  };
  useEffect(() => {
    if (!result?.source?.curriculum?.subjectId) { setUnitOptions([]); return; }
    loadCatalog().then((cat) => setUnitOptions(unitOptionsFor(cat, result.source.curriculum.subjectId)));
  }, [result?.source?.curriculum?.subjectId]);

  const [sample, setSample] = useState(false); // 샘플 문제로 해 보기 — AI 없이 고정 결과
  const run = async (f, asSample = false) => {
    if (!f) return;
    setFile(f); setStep(2); setError(null); setSubStep(null); setSample(asSample);
    try {
      const r = await extractItemsFromFile(f, setSubStep, asSample ? { analyze: analyzeSample, assign: async () => ({}) } : {});
      setResult({ ...r, summaryIssues: tagIssues(r.summaryIssues, r.range) });
      setSections([{ from: r.range.from, to: r.range.to, count: r.items.length, failed: r.failed || [] }]);
      setExtendError(null);
      setSelected(Object.fromEntries(r.items.map((it) => [it.id, true])));
      setTypeFilter('all'); setOnlyIssues(false);
      setStep(3);
    } catch (err) {
      setError(err instanceof GenerateError ? err : new GenerateError('UNKNOWN', '문항을 추출하는 중 문제가 생겼습니다.', String(err?.message || err)));
    }
  };
  useEffect(() => { if (initialFile) run(initialFile); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setStep(1); setFile(null); setResult(null); setError(null); setSelected({}); setSections([]); setExtendError(null); };

  /* [분할 추출] 구간 이어서 분석 — 지금까지 고친 내용·선택은 그대로 두고 새 문항만 목록 아래에 붙인다 */
  const totalPages = result?.source?.pages || 0;
  const isDone = (pg) => sections.some((x) => pg >= x.from && pg <= x.to && !(x.failed || []).some((f) => pg >= f.from && pg <= f.to));
  const analyzedCount = Array.from({ length: totalPages }, (_, i) => i + 1).filter(isDone).length;
  useEffect(() => {
    if (!sections.length) return;
    const lastTo = Math.max(...sections.map((x) => x.to));
    let n = null;
    for (let pg = lastTo + 1; pg <= totalPages && n == null; pg += 1) if (!isDone(pg)) n = pg;
    for (let pg = 1; pg <= totalPages && n == null; pg += 1) if (!isDone(pg)) n = pg; // 뒤가 끝났으면 건너뛴 앞 구간
    setNextFrom(n ?? 0);
  }, [sections, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDone = sections.length > 0 && analyzedCount >= totalPages;
  const nextValid = nextFrom >= 1 && nextFrom <= totalPages;
  // 다음 구간은 최대 30쪽 — 이미 분석한 쪽을 만나면 그 앞에서 끊는다 (실패한 묶음만 다시 분석할 때)
  const nextTo = (() => {
    let to = nextFrom;
    while (to < totalPages && to - nextFrom + 1 < ITEM_MAX_PAGES && !isDone(to + 1)) to += 1;
    return to;
  })();
  const overlaps = nextValid && isDone(nextFrom);
  const extend = async () => {
    if (!nextValid || overlaps || extending) return;
    setExtending(true); setExtendError(null); setSubStep(null);
    try {
      const r = await extractItemsFromFile(file, setSubStep, { fromPage: nextFrom, pageCount: nextTo - nextFrom + 1, prev: { sourceId: result.source.id, meta: result.meta, orderBase: result.items.length } });
      setResult((cur) => mergeSection(cur, r));
      setSelected((sel) => ({ ...sel, ...Object.fromEntries(r.items.map((it) => [it.id, true])) }));
      // 이번에 다시 분석한 쪽은 앞 구간의 「실패」에서 지운다
      const covered = (f) => f.from >= r.range.from && f.to <= r.range.to;
      setSections((ss) => [...ss.map((x) => ({ ...x, failed: (x.failed || []).filter((f) => !covered(f)) })), { from: r.range.from, to: r.range.to, count: r.items.length, failed: r.failed || [] }].sort((a, b) => a.from - b.from));
    } catch (err) {
      setExtendError(err instanceof GenerateError ? err : new GenerateError('UNKNOWN', '이 구간을 분석하지 못했습니다.', String(err?.message || err)));
    } finally { setExtending(false); }
  };

  /* 자료 올리기 영역 — STEP 1과 추출 실패 화면이 같이 쓴다(끌어다 놓기 · 클릭해서 선택) */
  const dropZone = (compact = false) => (
    <>
      <div role="button" tabIndex={0}
        onClick={() => available && inputRef.current?.click()}
        onKeyDown={(e) => { if (available && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); if (available) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (available) run(e.dataTransfer.files?.[0]); }}
        style={{ border: `2px dashed ${dragOver ? '#2A75F3' : '#CBD5E1'}`, background: dragOver ? '#EFF6FF' : '#F8FAFC', borderRadius: 12, padding: compact ? '22px 16px' : '36px 16px', textAlign: 'center', cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.5 }}>
        <div style={{ fontSize: compact ? '1.8rem' : '2.4rem', lineHeight: 1 }}>📄</div>
        <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginTop: 10 }}>{compact ? '다른 파일을 끌어다 놓거나 클릭해서 선택' : '파일을 끌어다 놓거나 클릭해서 선택'}</div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>PDF · JPG · PNG · 최대 {ITEM_MAX_FILE_MB}MB · PDF는 {ITEM_MAX_PAGES}쪽씩 나눠 분석 · 정답표가 함께 있으면 더 정확합니다</div>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; run(f); }} />
    </>
  );

  const items = result?.items || [];
  const passageById = useMemo(() => Object.fromEntries((result?.passages || []).map((p) => [p.id, p])), [result]);
  const typeCounts = useMemo(() => ITEM_TYPE_KEYS.reduce((acc, k) => ({ ...acc, [k]: items.filter((i) => i.itemType === k).length }), {}), [items]);
  const needsCheck = (it) => (it.issues || []).some((i) => i.level !== 'info');
  const visible = items.filter((it) => (typeFilter === 'all' || it.itemType === typeFilter) && (!onlyIssues || needsCheck(it)));
  const chosen = items.filter((it) => selected[it.id]);
  const chosenNoAnswer = chosen.filter((it) => !hasAnswer(it)).length;
  const allVisibleOn = visible.length > 0 && visible.every((it) => selected[it.id]);

  const updateItem = (next) => setResult((r) => ({ ...r, items: r.items.map((it) => (it.id === next.id ? next : it)) }));
  const updateMany = (list) => { const byId = Object.fromEntries(list.map((x) => [x.id, x])); setResult((r) => ({ ...r, items: r.items.map((it) => byId[it.id] || it) })); };
  const toggleVisible = () => setSelected((s) => ({ ...s, ...Object.fromEntries(visible.map((it) => [it.id, !allVisibleOn])) }));

  const save = async () => {
    if (!chosen.length) return;
    setSaving(true);
    try {
      const usedPassageIds = new Set(chosen.map((it) => it.passageId).filter(Boolean));
      await saveExtraction({
        source: trimSource(result.source, chosen),
        passages: result.passages.filter((p) => usedPassageIds.has(p.id)),
        items: chosen.map((it) => ({ ...it, status: hasAnswer(it) && !(it.issues || []).some((i) => i.level === 'error') ? 'ready' : 'needs_review' })),
      });
      setSavedIds(chosen.map((it) => it.id)); setWbDone(null);
      setStep(4);
    } catch (err) {
      setError(new GenerateError('SAVE', '문제 은행에 저장하지 못했습니다.', String(err?.message || err)));
    } finally { setSaving(false); }
  };

  const subIdx = EXTRACT_STEPS.findIndex((s) => s.key === subStep);

  return (
    <div>
      <Stepper step={step} steps={onPick ? STEPS.slice(0, 3) : STEPS} />

      {/* STEP 1 — 자료 올리기 */}
      {step === 1 && (
        <div style={card}>
          <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 6px' }}>평가 자료를 올려 주세요</h2>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 18px', lineHeight: 1.6 }}>
            시험지·문제집·평가지를 올리면 AI가 문항을 찾아 <b>유형별로 분류</b>하고 정답·배점·<b>단원</b>을 정리합니다. 성취기준은 단원에 따라 정해집니다. {onPick ? <>확인한 뒤 고른 문항을 <b>문제집</b>으로 묶습니다.</> : <>확인한 뒤 고른 문항만 <b>문제 은행</b>에 저장합니다.</>}
          </p>
          {!available && <div style={{ marginBottom: 14 }}><IssueList issues={[{ level: 'info', field: 'AI 분석', message: '이 환경에서는 AI 분석을 쓸 수 없어요. 샘플 문제로 해 볼 수 있어요.' }]} /></div>}
          {dropZone()}
          {/* 샘플 문제로 해 보기 — 배포 버전(AI 키 없음)에서도 등록 → 문제 은행 → 문제집 흐름을 끝까지 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{available ? '자료가 없나요?' : 'AI 없이'}</span>
            <button type="button" onClick={async () => run(await makeSampleFile(), true)} style={btn(!available)}>🧪 샘플 문제로 해 보기</button>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginRight: 4 }}>분류하는 유형</span>
            {ITEM_TYPE_KEYS.map((k) => <span key={k} title={ITEM_TYPES[k].desc} style={{ ...chipBtn(false), cursor: 'default' }}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</span>)}
          </div>
        </div>
      )}

      {/* STEP 2 — 문항 분류 (자동) */}
      {step === 2 && (
        <div style={card}>
          {!error ? (
            <>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 4px' }}>문항을 찾아 분류하고 있습니다</h2>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 18px' }}>{file?.name} · 문항이 많으면 1분 가까이 걸릴 수 있습니다. 창을 닫지 마세요.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {EXTRACT_STEPS.map((s, i) => {
                  const st = i < subIdx ? 'done' : i === subIdx ? 'now' : 'todo';
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--neo-font-size-sm)', fontWeight: st === 'now' ? 800 : 600, color: st === 'todo' ? '#94A3B8' : '#1E293B' }}>
                      <span style={{ width: 22, textAlign: 'center' }}>{st === 'done' ? '✅' : st === 'now' ? <span className="ie-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #BFDBFE', borderTopColor: '#2A75F3', borderRadius: '50%' }} /> : '○'}</span>
                      {s.label}
                    </div>
                  );
                })}
              </div>
              <style>{'@keyframes ieSpin{to{transform:rotate(360deg)}}.ie-spin{animation:ieSpin .8s linear infinite}'}</style>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 12px' }}>❌ 문항을 추출하지 못했습니다</h2>
              <IssueList issues={[{ level: 'error', field: file?.name || '파일', message: error.message }]} />
              {error.hint && <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', margin: '12px 0 0' }}>{error.hint}</p>}
              {/* 다른 파일 — 자료 올리기와 같은 끌어다 놓기 영역(버튼 대신) */}
              <div style={{ marginTop: 18 }}>{dropZone(true)}</div>
              {file && !['FILE_TYPE', 'FILE_SIZE', 'NO_KEY'].includes(error.code) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => run(file, sample)} style={btn(true)}>다시 시도</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 3 — 확인·선택 */}
      {step === 3 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0 }}>문항 {items.length}개를 찾았습니다</h2>
              {sample && <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 999, padding: '2px 10px' }}>🧪 샘플 문제</span>}
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                {result.source.title} · {[result.source.curriculum.schoolLevelName, result.source.curriculum.gradeLabel, result.source.curriculum.subjectName].filter(Boolean).join(' · ') || '교육과정 미확인'}
                {/* 교과 지정 — 못 정했으면 바로 고르게, 정했으면 [교과 변경] */}
                {(result.source.curriculum?.subjectId == null || subjectEdit) ? (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginLeft: 8 }}>
                    <b style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C' }}>교과 지정</b>
                    <SubjectPicker compact cat={cat} value={result.source.curriculum?.subjectId} onPick={applySourceSubject} />
                    {subjectEdit && <button type="button" onClick={() => setSubjectEdit(false)} style={{ ...btn(false), padding: '4px 10px' }}>취소</button>}
                  </span>
                ) : (
                  <button type="button" onClick={() => setSubjectEdit(true)} title="자료 전체 문항의 교과를 바꿉니다 · 단원은 다시 골라야 합니다" style={{ ...btn(false), padding: '3px 10px', marginLeft: 8 }}>교과 변경</button>
                )}
              </span>
            </div>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '6px 0 12px' }}>
              문제 은행에 넣을 문항을 골라 주세요. 유형이 틀리면 바꾸고, 정답은 선다형 보기를 누르거나 O/X·입력란으로 고칠 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={chipBtn(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>전체 {items.length}</button>
              {ITEM_TYPE_KEYS.filter((k) => typeCounts[k]).map((k) => (
                <button key={k} style={chipBtn(typeFilter === k)} onClick={() => setTypeFilter(k)}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label} {typeCounts[k]}</button>
              ))}
              <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> 확인 필요한 문항만
              </label>
            </div>
            {(result.source.examScope?.units || []).length > 0 && (
              <div style={{ marginTop: 10, fontSize: 'var(--neo-font-size-xs)', color: '#475569' }}>
                <b>시험 범위</b> {result.source.examScope.units.join(' · ')}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>
              {result.source.track === 'basic'
                ? <>🧩 <b>기초학력 자료</b>{result.source.skill ? ` · ${result.source.skill}` : ''} — 단원·성취기준 없이 등록하고 정답 대조로 채점합니다. 학년 수준 문항이면 아래에서 「학년 수준으로」 바꾸세요.</>
                : <>성취기준은 문항마다 고르지 않고 <b>단원</b>에 따라 정해집니다. 단원이 「추정」이면 맞는지 확인해 주세요.</>}
            </div>
            {result.summaryIssues.length > 0 && <div style={{ marginTop: 12 }}><IssueList issues={result.summaryIssues} /></div>}

            {/* [분할 추출] 구간 진행 — 30쪽이 넘는 자료만 */}
            {totalPages > ITEM_MAX_PAGES && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>📑 {totalPages}쪽 중 {analyzedCount}쪽 분석</b>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>{ITEM_MAX_PAGES}쪽씩 나눠 분석합니다</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {sections.map((x) => (
                    <span key={x.from} style={{ ...chipBtn(false), cursor: 'default', color: x.count ? '#047857' : '#94A3B8', borderColor: x.count ? '#A7F3D0' : '#E2E8F0' }}>
                      {x.from}~{x.to}쪽 · 문항 {x.count}개
                      {(x.failed || []).map((f) => <span key={f.from} style={{ color: '#B91C1C' }}> · {f.from}~{f.to}쪽 실패</span>)}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {extending ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1D4ED8' }}>
                      <span className="ie-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #BFDBFE', borderTopColor: '#2A75F3', borderRadius: '50%' }} />
                      {nextFrom}~{nextTo}쪽 분석 중 · {EXTRACT_STEPS[subIdx]?.label || '준비'}
                      <style>{'@keyframes ieSpin{to{transform:rotate(360deg)}}.ie-spin{animation:ieSpin .8s linear infinite}'}</style>
                    </span>
                  ) : allDone ? (
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#047857' }}>✓ 모든 쪽을 분석했습니다.</span>
                  ) : (
                    <>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569' }}>
                        시작 쪽
                        <input type="number" min={1} max={totalPages} value={nextFrom || ''} onChange={(e) => setNextFrom(Number(e.target.value) || 0)}
                          style={{ width: 72, padding: '6px 8px', borderRadius: 8, border: `1px solid ${overlaps || !nextValid ? '#FCA5A5' : '#CBD5E1'}`, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }} />
                      </label>
                      <button onClick={extend} disabled={!nextValid || overlaps} style={btn(true, !nextValid || overlaps)}>
                        {nextValid ? `${nextFrom}~${nextTo}쪽 이어서 분석` : '이어서 분석'}
                      </button>
                      {overlaps && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>이미 분석한 쪽이 들어 있습니다.</span>}
                      {!nextValid && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>1~{totalPages}쪽 사이로 입력해 주세요.</span>}
                    </>
                  )}
                </div>
                {extendError && (
                  <div style={{ marginTop: 10 }}>
                    <IssueList issues={[{ level: 'error', field: `${nextFrom}~${nextTo}쪽`, message: `${extendError.message}${extendError.hint ? ` ${extendError.hint}` : ''}` }]} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={allVisibleOn} onChange={toggleVisible} /> 보이는 문항 모두 선택
            </label>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{visible.length}개 표시 중</span>
          </div>
          <ItemEditDialog open={!!editing} item={editing} pages={result.source.pageImages} unitOptions={unitOptions} onSave={updateItem} onClose={() => setEditing(null)} scopeNote="저장 전 — 확인·선택에 바로 반영" />
          <div style={{ padding: '0 4px' }}>
            <BulkEditBar items={chosen} onApply={updateMany} unitOptions={unitOptions} skill={result.source.skill} />
          </div>
          {visible.map((it) => (
            <ItemCard key={it.id} item={it} passage={passageById[it.passageId]} selectable checked={!!selected[it.id]}
              onToggle={() => setSelected((s) => ({ ...s, [it.id]: !s[it.id] }))} editable onChange={updateItem} unitOptions={unitOptions} dimUnchecked onEdit={() => setEditing(it)} />
          ))}
          {visible.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>조건에 맞는 문항이 없습니다.</div>}

          {/* 하단 고정 바 */}
          <div style={{ position: 'sticky', bottom: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 -4px 16px rgba(15,23,42,0.06)' }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B' }}>{chosen.length}개 선택</span>
            {chosenNoAnswer > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>· 정답 없는 문항 {chosenNoAnswer}개는 「확인 필요」로 저장됩니다</span>}
            <span style={{ flex: 1 }} />
            <button onClick={reset} style={btn(false)}>다른 자료 올리기</button>
            {onPick ? (
              <button onClick={() => { const used = new Set(chosen.map((it) => it.passageId).filter(Boolean)); onPick({ items: chosen, passages: result.passages.filter((p) => used.has(p.id)), source: trimSource(result.source, chosen) }); }}
                disabled={!chosen.length || extending} style={btn(true, !chosen.length || extending)}>{pickLabel ? pickLabel(chosen.length) : `선택한 ${chosen.length}개로 다음 →`}</button>
            ) : (
              <button onClick={save} disabled={!chosen.length || saving || extending} style={btn(true, !chosen.length || saving || extending)}>{saving ? '저장 중…' : `문제 은행에 ${chosen.length}개 저장`}</button>
            )}
          </div>
          {error?.code === 'SAVE' && <IssueList issues={[{ level: 'error', field: '저장', message: `${error.message} ${error.hint || ''}` }]} />}
        </div>
      )}

      {/* STEP 4 — 저장 완료 */}
      {step === 4 && (
        <div style={card}>
          <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 6px' }}>✅ 문제 은행에 {savedIds.length}개 문항을 저장했습니다</h2>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 16px', lineHeight: 1.6 }}>
            저장한 문항은 <b>과제 관리 › 문제 은행</b>에서 유형·교과로 찾아볼 수 있습니다.
          </p>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, marginBottom: 18 }}>
            <b>다음 단계 — 과제 배치</b> (준비 중)<br />
            문제 은행의 문항이나 문제집을 골라 평가 문항으로 배치하고, Ncode 시험지로 출력해 채점합니다.
          </div>
          {wbDone && <div style={{ marginBottom: 14, fontSize: 'var(--neo-font-size-sm)', color: '#047857', fontWeight: 700 }}>📚 「{wbDone.title}」 문제집에 담았습니다 (문항 {wbDone.itemIds.length}개). 문제 은행 › 문제집에서 볼 수 있습니다.</div>}
          <WorkbookPicker open={wbOpen} itemIds={savedIds} defaultTitle={(result?.source?.track === 'basic' && result?.source?.skill) || result?.source?.title || ''} defaultPurpose={result?.source?.track === 'basic' ? 'basic' : 'exam'}
            onClose={() => setWbOpen(false)} onDone={(wb) => { setWbOpen(false); setWbDone(wb); }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={reset} style={btn(false)}>다른 자료 올리기</button>
            <button onClick={() => setWbOpen(true)} style={btn(false)}>📚 문제집으로 엮기</button>
            {onGoItemBank && <button onClick={onGoItemBank} style={btn(true)}>문제 은행에서 보기</button>}
            {!onGoItemBank && <button onClick={onBack} style={btn(true)}>목록으로</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemExtractWizard;
