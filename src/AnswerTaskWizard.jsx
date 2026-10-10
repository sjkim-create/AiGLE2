/**
 * AnswerTaskWizard — 과제 관리 › 새 과제 등록 › ✅ 정답형 과제 (TSK-15)
 *
 * 객관식·기타 정답형 문항으로 시험지형 과제를 만든다. 과제 관리 안에서 끝난다 (왼쪽 메뉴도 과제 관리).
 *   STEP 1 문항 모으기 — ✍️ 직접 작성 / 📥 자료에서 가져오기(AI) / 🗂️ 문제 은행·문제집에서 고르기 (섞어서 담을 수 있다)
 *   STEP 2 배치        — 순서·번호·배점
 *   STEP 3 기본 정보·저장 — 과제명 · 교육과정(문항에서) · 「문제 은행에도 저장」(기본 켬) → 과제 목록에 「정답형」 과제
 * 진입별 시작 탭: 직접 입력 = 직접 작성 / ✨ 스마트 과제 등록 = 자료에서 가져오기(고르면 배점·과제명까지 채워 STEP 2로) / 문제 은행에서 고르기
 * 서·논술 과제와 그 문항은 다루지 않는다. Ncode 시험지 출력·채점은 다음 단계.
 */
import React, { useEffect, useMemo, useState } from 'react';
import ItemCard from './ItemCard';
import ItemExtractWizard from './ItemExtractWizard';
import UnsavedLeaveModal from './UnsavedLeaveModal';
import { IssueList } from './TaskFileGenerate';
import { buildAnswerTask } from './lib/taskSchema';
import { ITEM_TYPES, ITEM_TYPE_KEYS, ITEM_SCHEMA_VERSION, WORKBOOK_PURPOSES, emptyAnswer, hasAnswer, newId, recheckAnswer,
  listItems, listPassages, listWorkbooks, saveExtraction, putItem } from './lib/itemBank';

const STEPS = ['문항 모으기', '배치', '기본 정보·저장'];
const SOURCES = {
  direct: { icon: '✍️', label: '직접 작성' },
  file: { icon: '📥', label: '자료에서 가져오기' },
  bank: { icon: '🗂️', label: '문제 은행에서 고르기' },
};
const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 22px', boxSizing: 'border-box' };
const btn = (primary, disabled) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' };
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569', marginBottom: 4, display: 'block' };
const chipBtn = (on) => ({ padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569' });
const Crumb = ({ path }) => <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: 2 }}>{path.join(' › ')}</div>;

// ───────────── 직접 작성 — 새 문항 1개 ─────────────
const blankItem = (type = 'multiple_choice') => ({
  id: newId('itm'), schemaVersion: ITEM_SCHEMA_VERSION, number: '', itemType: type, stem: '', material: '',
  choices: type === 'binary_choice' ? [{ no: 1, text: '' }, { no: 2, text: '' }] : type === 'multiple_choice' ? [1, 2, 3, 4, 5].map((no) => ({ no, text: '' })) : [],
  matching: type === 'matching' ? { left: ['', ''], right: ['', ''] } : null, blankCount: type === 'completion' ? 1 : 0,
  answer: emptyAnswer(), answerSource: 'teacher', explanation: '', points: null, images: [], passageId: null,
  unit: { label: '', areaId: null, areaName: '', source: 'none' }, track: 'curriculum', skill: '',
  curriculum: { standardsBasis: 'unit', standards: [] }, source: { sourceId: null, fileName: '직접 작성', page: null },
  lineage: { rootId: null, parentId: null, derivation: null }, issues: [], createdAt: '', updatedAt: '',
});

const ItemEditor = ({ onAdd }) => {
  const [it, setIt] = useState(() => blankItem());
  const set = (patch) => setIt((x) => ({ ...x, ...patch }));
  const changeType = (type) => { const b = blankItem(type); setIt((x) => ({ ...b, id: x.id, stem: x.stem, material: x.material })); };
  const ready = it.stem.trim() && (!['multiple_choice', 'binary_choice'].includes(it.itemType) || it.choices.filter((c) => c.text.trim()).length >= 2);
  const add = () => {
    const now = new Date().toISOString();
    const item = recheckAnswer({ ...it, choices: it.choices.filter((c) => c.text.trim()).map((c, i) => ({ no: i + 1, text: c.text.trim() })), createdAt: now, updatedAt: now, lineage: { rootId: it.id, parentId: null, derivation: null } });
    onAdd(item);
    setIt(blankItem(it.itemType));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <span style={label}>유형</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ITEM_TYPE_KEYS.map((k) => <button key={k} type="button" onClick={() => changeType(k)} style={chipBtn(it.itemType === k)} title={ITEM_TYPES[k].desc}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</button>)}
        </div>
      </div>
      <div><span style={label}>발문 *</span><textarea value={it.stem} onChange={(e) => set({ stem: e.target.value })} rows={2} placeholder="예: 다음 중 힘의 단위로 옳은 것은?" style={{ ...input, resize: 'vertical', borderColor: it.stem.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
      <div><span style={label}>&lt;보기&gt;·제시 자료 (선택)</span><textarea value={it.material} onChange={(e) => set({ material: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      {['multiple_choice', 'binary_choice'].includes(it.itemType) && (
        <div>
          <span style={label}>{it.itemType === 'binary_choice' ? '두 낱말 *' : '보기 * (2개 이상)'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {it.choices.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 22, fontWeight: 800, color: '#64748B' }}>{it.itemType === 'binary_choice' ? (i ? 'B' : 'A') : '①②③④⑤⑥⑦⑧'[i]}</span>
                <input value={c.text} onChange={(e) => set({ choices: it.choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={input} />
                {it.itemType === 'multiple_choice' && it.choices.length > 2 && <button type="button" onClick={() => set({ choices: it.choices.filter((_, j) => j !== i).map((x, j) => ({ ...x, no: j + 1 })), answer: emptyAnswer() })} style={{ ...btn(false), padding: '4px 8px' }} aria-label="보기 삭제">✕</button>}
              </div>
            ))}
            {it.itemType === 'multiple_choice' && it.choices.length < 8 && <button type="button" onClick={() => set({ choices: [...it.choices, { no: it.choices.length + 1, text: '' }] })} style={{ ...btn(false), alignSelf: 'flex-start', padding: '4px 10px' }}>+ 보기 추가</button>}
          </div>
        </div>
      )}
      {it.itemType === 'matching' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['left', 'right'].map((side) => (
            <div key={side}><span style={label}>{side === 'left' ? '왼쪽 항목 (한 줄에 하나)' : '오른쪽 항목 (한 줄에 하나)'}</span>
              <textarea value={it.matching[side].join('\n')} rows={4} onChange={(e) => set({ matching: { ...it.matching, [side]: e.target.value.split('\n') } })} style={{ ...input, resize: 'vertical' }} /></div>
          ))}
        </div>
      )}
      {it.itemType === 'completion' && (
        <div style={{ width: 160 }}><span style={label}>빈칸 수</span><input type="number" min={1} max={10} value={it.blankCount} onChange={(e) => set({ blankCount: Math.max(1, Number(e.target.value) || 1) })} style={input} /></div>
      )}
      <div style={{ width: 160 }}><span style={label}>배점 (선택)</span><input type="number" min={0} value={it.points ?? ''} onChange={(e) => set({ points: e.target.value === '' ? null : Number(e.target.value) })} style={input} /></div>
      <div>
        <span style={label}>미리 보기 · 정답 지정</span>
        <ItemCard item={{ ...it, number: '새', matching: it.matching ? { left: it.matching.left.filter(Boolean), right: it.matching.right.filter(Boolean) } : null }} editable onChange={(x) => set({ answer: x.answer, itemType: x.itemType })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={add} disabled={!ready} style={btn(true, !ready)} title={ready ? '' : '발문과 보기를 입력해 주세요'}>+ 이 문항 담기</button>
      </div>
    </div>
  );
};

// ───────────── 문제 은행·문제집에서 고르기 ─────────────
const BankPicker = ({ takenIds, onAdd }) => {
  const [items, setItems] = useState(null);
  const [passages, setPassages] = useState([]);
  const [workbooks, setWorkbooks] = useState([]);
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({});
  useEffect(() => { Promise.all([listItems(), listPassages(), listWorkbooks()]).then(([a, b, c]) => { setItems(a); setPassages(b); setWorkbooks(c); }).catch(() => setItems([])); }, []);
  const byId = useMemo(() => Object.fromEntries((items || []).map((i) => [i.id, i])), [items]);
  const pById = useMemo(() => Object.fromEntries(passages.map((p) => [p.id, p])), [passages]);
  if (items === null) return <div style={{ color: '#94A3B8', padding: 20 }}>불러오는 중…</div>;
  if (!items.length) return <IssueList issues={[{ level: 'info', field: '문제 은행', message: '문제 은행에 정답형 문항이 없습니다. 「자료에서 가져오기」나 「직접 작성」으로 문항을 담아 주세요.' }]} />;
  const visible = items.filter((i) => (type === 'all' || i.itemType === type) && (!q.trim() || `${i.stem} ${(i.choices || []).map((c) => c.text).join(' ')}`.includes(q.trim())));
  const chosen = visible.filter((i) => sel[i.id] && !takenIds.has(i.id));
  const addWorkbook = (wb) => onAdd(wb.itemIds.map((id) => byId[id]).filter((i) => i && !takenIds.has(i.id)), pById);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {workbooks.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={label}>문제집 통째로 담기</span>
          {workbooks.map((w) => <button key={w.id} type="button" onClick={() => addWorkbook(w)} style={chipBtn(false)}>{WORKBOOK_PURPOSES[w.purpose]?.icon} {w.title} · {w.itemIds.length}</button>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={chipBtn(type === 'all')} onClick={() => setType('all')}>전체 {items.length}</button>
        {ITEM_TYPE_KEYS.filter((k) => items.some((i) => i.itemType === k)).map((k) => <button key={k} type="button" style={chipBtn(type === k)} onClick={() => setType(k)}>{ITEM_TYPES[k].icon} {ITEM_TYPES[k].label}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="발문·보기 검색" style={{ ...input, flex: 1, minWidth: 160, width: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
        {visible.map((it) => (
          <div key={it.id} style={{ opacity: takenIds.has(it.id) ? 0.5 : 1 }} title={takenIds.has(it.id) ? '이미 담은 문항' : ''}>
            <ItemCard item={it} passage={pById[it.passageId]} compact selectable checked={!!sel[it.id] || takenIds.has(it.id)}
              onToggle={() => !takenIds.has(it.id) && setSel((s) => ({ ...s, [it.id]: !s[it.id] }))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => { onAdd(chosen, pById); setSel({}); }} disabled={!chosen.length} style={btn(true, !chosen.length)}>고른 {chosen.length}개 담기</button>
      </div>
    </div>
  );
};

// ───────────── 마법사 ─────────────
const AnswerTaskWizard = ({ initialSource = 'direct', onBack, onAdd, onLeaveGuardChange }) => {
  const smart = initialSource === 'file';
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState(initialSource);
  const [entries, setEntries] = useState([]);      // [{ item, points, fromBank, fromFile }]
  const [passages, setPassages] = useState({});    // id → passage
  const [pending, setPending] = useState({ sources: [], passages: [] }); // 자료에서 가져온 것 — 문제 은행 저장용
  const [title, setTitle] = useState('');
  const [saveToBank, setSaveToBank] = useState(true);
  const [done, setDone] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  const takenIds = useMemo(() => new Set(entries.map((e) => e.item.id)), [entries]);
  const add = (items, extra = {}) => {
    const fresh = items.filter((i) => !takenIds.has(i.id));
    setEntries((es) => [...es, ...fresh.map((item) => ({ item, points: item.points ?? 1, ...extra }))]);
    setToast(`문항 ${fresh.length}개를 담았습니다.`);
    return fresh.length;
  };
  const dirty = entries.length > 0 && !done;
  useEffect(() => { onLeaveGuardChange?.(dirty ? { canSave: false } : null); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onLeaveGuardChange?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => (dirty ? setLeaveOpen(true) : onBack && onBack());

  // 교육과정 — 담은 문항에서 가장 많은 값
  const curriculum = useMemo(() => {
    const counts = {};
    entries.forEach((e) => { const c = e.item.curriculum || {}; const k = [c.schoolLevelName, c.gradeLabel, c.curriculumName, c.subjectName].join('|'); if (c.subjectName || c.schoolLevelName) counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return {};
    const [schoolLevelName, gradeLabel, curriculumName, subjectName] = top[0].split('|');
    return { schoolLevelName, gradeLabel, curriculumName, subjectName };
  }, [entries]);
  const total = entries.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const noAnswer = entries.filter((e) => !hasAnswer(e.item)).length;
  const newCount = entries.filter((e) => !e.fromBank).length;

  const onPicked = ({ items, passages: ps, source }) => {
    setPassages((p) => ({ ...p, ...Object.fromEntries(ps.map((x) => [x.id, x])) }));
    setPending((x) => ({ sources: [...x.sources, source], passages: [...x.passages, ...ps] }));
    add(items, { fromFile: true });
    if (!title) setTitle(source.title || '');
    if (smart) setStep(2); // 스마트 — 자료에서 배점·과제명까지 채워 바로 배치로
  };

  const save = async () => {
    const task = buildAnswerTask({ title: title.trim(), entries, passages: Object.values(passages), curriculum, origin: initialSource });
    if (saveToBank && newCount) {
      const fileItems = entries.filter((e) => e.fromFile).map((e) => e.item);
      for (const src of pending.sources) {
        const its = fileItems.filter((i) => i.source?.sourceId === src.id);
        if (its.length) await saveExtraction({ source: { ...src, itemIds: its.map((i) => i.id) }, passages: pending.passages.filter((p) => p.sourceId === src.id), items: its });
      }
      for (const e of entries.filter((x) => !x.fromBank && !x.fromFile)) await putItem({ ...e.item, status: hasAnswer(e.item) ? 'ready' : 'needs_review' });
    }
    onAdd && onAdd(task);
    onLeaveGuardChange?.(null);
    setDone(task);
  };

  const move = (i, d) => setEntries((es) => { const j = i + d; if (j < 0 || j >= es.length) return es; const n = [...es]; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={back} style={btn(false)}>← 과제 목록</button>
        <div>
          <Crumb path={['과제 관리', '과제 목록', '새 과제 등록']} />
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>{smart ? '✨ 스마트 과제 등록 · ✅ 정답형' : '✅ 정답형 과제 만들기'}</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STEPS.map((l, i) => {
            const n = i + 1; const st = done ? 'done' : n < step ? 'done' : n === step ? 'now' : 'todo';
            return <span key={l} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: st === 'now' ? '#EFF6FF' : st === 'done' ? '#ECFDF5' : '#F8FAFC', color: st === 'now' ? '#1D4ED8' : st === 'done' ? '#047857' : '#94A3B8', border: `1px solid ${st === 'now' ? '#93C5FD' : st === 'done' ? '#A7F3D0' : '#E2E8F0'}` }}>{st === 'done' ? '✓' : n}. {l}</span>;
          })}
        </div>
      </header>

      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {done ? (
            <div style={card}>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 6px' }}>✅ 정답형 과제를 등록했습니다</h2>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 14px', lineHeight: 1.6 }}>
                「{done.title}」 · 문항 {done.questions}개 · 총 {done.points}점 — 「작성중」으로 과제 목록 맨 위에 추가했습니다.
                {saveToBank && newCount > 0 && <> 새 문항 {newCount}개는 문제 은행에도 저장했습니다.</>}
              </p>
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: 16 }}>
                <b>다음 단계</b> (준비 중) — Ncode 시험지 출력 · 학생 배포 · 정답 대조 채점
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onBack} style={btn(true)}>과제 목록으로</button></div>
            </div>
          ) : (
            <>
              {/* STEP 1 — 문항 모으기 */}
              {step === 1 && (
                <>
                  <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(SOURCES).map(([k, s]) => <button key={k} type="button" onClick={() => setTab(k)} style={chipBtn(tab === k)}>{s.icon} {s.label}</button>)}
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>담은 문항 {entries.length}개</span>
                    <button onClick={() => setStep(2)} disabled={!entries.length} style={btn(true, !entries.length)}>다음: 배치 →</button>
                  </div>
                  <div style={card}>
                    {tab === 'direct' && <ItemEditor onAdd={(item) => add([item])} />}
                    {tab === 'file' && <ItemExtractWizard onPick={onPicked} onBack={() => setTab('direct')} />}
                    {tab === 'bank' && <BankPicker takenIds={takenIds} onAdd={(items, pById) => { setPassages((p) => ({ ...p, ...Object.fromEntries(items.filter((i) => i.passageId && pById[i.passageId]).map((i) => [i.passageId, pById[i.passageId]])) })); add(items, { fromBank: true }); }} />}
                  </div>
                </>
              )}

              {/* STEP 2 — 배치 */}
              {step === 2 && (
                <>
                  <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setStep(1)} style={btn(false)}>← 문항 더 모으기</button>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>문항 {entries.length}개 · 총 {total}점</span>
                    {noAnswer > 0 && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>정답 없는 문항 {noAnswer}개 — 저장은 되지만 채점 전에 정답이 필요합니다</span>}
                    <button onClick={() => setStep(3)} disabled={!entries.length} style={{ ...btn(true, !entries.length), marginLeft: 'auto' }}>다음: 기본 정보 →</button>
                  </div>
                  {entries.map((e, i) => (
                    <div key={e.item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', paddingTop: 8, width: 64 }}>
                        <span style={{ fontWeight: 900, color: '#2A75F3' }}>{i + 1}번</span>
                        <input type="number" min={0} value={e.points} aria-label={`${i + 1}번 배점`}
                          onChange={(ev) => setEntries((es) => es.map((x, j) => (j === i ? { ...x, points: ev.target.value === '' ? '' : Number(ev.target.value) } : x)))}
                          style={{ ...input, width: 56, textAlign: 'center', padding: '4px' }} />
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>점</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로" style={{ ...btn(false, i === 0), padding: '2px 6px' }}>↑</button>
                          <button onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label="아래로" style={{ ...btn(false, i === entries.length - 1), padding: '2px 6px' }}>↓</button>
                        </div>
                        <button onClick={() => setEntries((es) => es.filter((_, j) => j !== i))} aria-label="빼기" style={{ ...btn(false), padding: '2px 8px' }}>✕</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <ItemCard item={{ ...e.item, number: String(i + 1) }} passage={passages[e.item.passageId]} editable
                          onChange={(x) => setEntries((es) => es.map((y, j) => (j === i ? { ...y, item: { ...x, number: e.item.number } } : y)))} />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* STEP 3 — 기본 정보·저장 */}
              {step === 3 && (
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div><span style={label}>과제명 *</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 1학기 중간고사 과학" style={{ ...input, borderColor: title.trim() ? '#CBD5E1' : '#FCA5A5' }} /></div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.8 }}>
                    <div><b>과제 형태</b> ✅ 정답형 (문제와 답안 칸이 한 장인 시험지)</div>
                    <div><b>교육과정</b> {[curriculum.schoolLevelName, curriculum.gradeLabel, curriculum.curriculumName, curriculum.subjectName].filter(Boolean).join(' · ') || (entries.every((e) => e.item.track === 'basic') ? '기초학력' : '미확인 — 문항에 교육과정이 없습니다')}</div>
                    <div><b>문항</b> {entries.length}개 · 총 {total}점 · {[...new Set(entries.map((e) => ITEM_TYPES[e.item.itemType]?.label))].join(' · ')}</div>
                  </div>
                  {newCount > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>
                      <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
                      새로 만든·가져온 문항 {newCount}개를 문제 은행에도 저장 (다른 시험지에 다시 쓰기)
                    </label>
                  )}
                  {noAnswer > 0 && <IssueList issues={[{ level: 'warn', field: '정답', message: `정답 없는 문항 ${noAnswer}개가 있습니다. 저장은 되지만 채점 전에 정답을 넣어야 합니다.` }]} />}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setStep(2)} style={btn(false)}>← 배치</button>
                    <button onClick={save} disabled={!title.trim() || !entries.length} style={btn(true, !title.trim() || !entries.length)}>과제 저장</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UnsavedLeaveModal open={leaveOpen} canSave={false} onStay={() => setLeaveOpen(false)} onLeave={() => { setLeaveOpen(false); onLeaveGuardChange?.(null); onBack && onBack(); }} />
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 1100 }}>{toast}</div>}
    </div>
  );
};

export default AnswerTaskWizard;
