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
import ItemExtractWizard from './ItemExtractWizard';
import ItemEditForm, { ItemEditDialog } from './ItemEditForm';
import { BasicInfoCard, ArrangeRows, topCurriculum } from './AnswerArrange';
import UnsavedLeaveModal from './UnsavedLeaveModal';
import { buildAnswerTask } from './lib/taskSchema';
import { hasAnswer, listSources, saveExtraction, putItem } from './lib/itemBank';

const STEPS = ['문항 모으기', '배치·기본 정보'];
const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '20px 22px', boxSizing: 'border-box' };
const btn = (primary, disabled) => ({
  padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569', whiteSpace: 'nowrap',
});
const Crumb = ({ path }) => <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: 2 }}>{path.join(' › ')}</div>;

// 직접 작성은 ItemEditForm(create) — 문항 편집과 같은 화면

// ───────────── 마법사 ─────────────
// initialSource — 'direct'(직접 작성) · 'file'(스마트 — 자료)
// [v1.7] 문항·문제집 고르기는 정답형 과제 목록(문제집 상세)에서 한다 · [v1.8] 배치와 기본 정보를 한 화면에서
const AnswerTaskWizard = ({ initialSource = 'direct', onBack, onAdd, onLeaveGuardChange }) => {
  const smart = initialSource === 'file';
  const [step, setStep] = useState(1);
  const tab = smart ? 'file' : 'direct';
  const [entries, setEntries] = useState([]);      // [{ item, points, fromFile }]
  const [passages, setPassages] = useState({});    // id → passage
  const [pending, setPending] = useState({ sources: [], passages: [] }); // 자료에서 가져온 것 — 문제 은행 저장용
  const [title, setTitle] = useState('');
  const [curriculumEdit, setCurriculumEdit] = useState(null); // 교사가 고친 교육과정 (없으면 담은 문항의 기본값)
  const [saveToBank, setSaveToBank] = useState(true);
  const [done, setDone] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [editIdx, setEditIdx] = useState(null);   // 배치 단계 문항 편집 — 이 과제에만 적용
  const [bankSources, setBankSources] = useState([]); // 문제 은행 문항의 원본 쪽 이미지
  useEffect(() => { listSources().then(setBankSources).catch(() => {}); }, []);
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

  // 교육과정 — 담은 문항에서 가장 많은 값이 기본, 교사가 배치 화면에서 고칠 수 있다
  const curriculum = useMemo(() => curriculumEdit || topCurriculum(entries.map((e) => e.item)), [curriculumEdit, entries]);
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


  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={back} style={btn(false)}>← 과제 목록</button>
        <div>
          <Crumb path={['과제 관리', '과제 목록', '새 과제 등록']} />
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>{smart ? '✨ 정답형 스마트 등록' : '✍️ 정답형 직접 등록'}</h1>
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
                    {/* 직접 등록 = 직접 작성 / 스마트 등록 = 자료에서 가져오기 (문제 은행 문항은 정답형 과제 목록의 [📐 과제 배치하기]) */}
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569' }}>{smart ? '📥 자료에서 가져오기' : '✍️ 직접 작성'}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>담은 문항 {entries.length}개</span>
                    <button onClick={() => setStep(2)} disabled={!entries.length} style={btn(true, !entries.length)}>다음: 배치 →</button>
                  </div>
                  <div style={card}>
                    {tab === 'direct' && <ItemEditForm mode="create" onSubmit={(item) => add([item])} />}
                    {tab === 'file' && <ItemExtractWizard onPick={onPicked} onBack={back} />}
                  </div>
                </>
              )}

              {/* STEP 2 — 배치·기본 정보 (v1.8 — 기본 정보 단계를 따로 두지 않는다) */}
              {step === 2 && (
                <>
                  <BasicInfoCard title={title} onTitle={setTitle} curriculum={curriculum} onCurriculum={setCurriculumEdit} entries={entries}>
                    <button onClick={() => setStep(1)} style={btn(false)}>← 문항 더 모으기</button>
                    {newCount > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
                        <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
                        새 문항 {newCount}개 문제 은행에도 저장
                      </label>
                    )}
                    <button onClick={save} disabled={!title.trim() || !entries.length} title={!title.trim() ? '과제명을 입력해 주세요.' : ''} style={btn(true, !title.trim() || !entries.length)}>과제 저장</button>
                  </BasicInfoCard>
                  <ArrangeRows entries={entries} onChange={setEntries} passages={passages} onEdit={(i) => setEditIdx(i)}
                    onItemChange={(i, x) => setEntries((es) => es.map((y, j) => (j === i ? { ...y, item: x } : y)))} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {editIdx != null && entries[editIdx] && (() => {
        const it = entries[editIdx].item;
        const pages = [...pending.sources, ...bankSources].find((x) => x.id === it.source?.sourceId)?.pageImages;
        return <ItemEditDialog open item={{ ...it, number: String(editIdx + 1) }} pages={pages} scopeNote="이 과제에만 적용 · 문제 은행 원본은 그대로"
          onClose={() => setEditIdx(null)} onSave={(x) => setEntries((es) => es.map((y, j) => (j === editIdx ? { ...y, item: { ...x, number: it.number } } : y)))} />;
      })()}
      <UnsavedLeaveModal open={leaveOpen} canSave={false} onStay={() => setLeaveOpen(false)} onLeave={() => { setLeaveOpen(false); onLeaveGuardChange?.(null); onBack && onBack(); }} />
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 1100 }}>{toast}</div>}
    </div>
  );
};

export default AnswerTaskWizard;
