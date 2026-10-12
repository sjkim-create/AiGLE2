/**
 * AnswerGradingPanel — 채점 관리 › 정답형 문제집 · 낱말 문제집 (TSK-15 v1.43~v1.44, 로컬 프로토)
 *
 * 서·논술 채점과 같은 흐름 · 같은 목록:
 *   탭 미채점 → 채점 확인 → 결과 발송 · [🖊 크래들 일괄채점] [📷 스캔 채점] · [✓ 검토 완료 처리] · [📤 결과발송]
 *   카드 보기(학생 1명 = 카드) / 목록 보기 — 학생 이름 · 학년/반/번호 · 제출 방식 · 자동 채점 · 교사 채점 · 상태 · 상세보기
 * 다른 것: 채점기 = 정답 대조(「자동 채점」 — 맞힌 수 · 점수)
 * 상세(v1.44): 학생이 답을 쓴 문제지 모양 그대로 — 고른 답은 펜 동그라미, 쓴 답은 펜 글씨, 번호에 ○ / ╱ / ?
 *   문항(줄)을 누르면 O ↔ X. 학생 답은 모의(실제 스캔 OCR · Ncode 펜 인식은 다음 단계). 채점 정보는 문제집(wb.grading)에 저장.
 */
import React from 'react';
import { listItems, listPassages, listWorkbooks, putWorkbook } from './lib/itemBank';
import { gradingQuestionsOf, mockAnswersFor, autoGrade, scoreOf, scoreLabel, rosterOf } from './lib/answerGrading';
import { WordSheet } from './WordWorkbook';
import { WorkbookSheet } from './WorkbookLayout';
import { nextMark } from './GradeMarks';

const TABS = ['미채점', '채점 확인', '결과 발송'];
const inTab = (s, tab) => (tab === '미채점' ? s.status === '미채점' : tab === '채점 확인' ? s.status === '채점 확인' : s.status === '결과 발송 전' || s.status === '결과 발송 완료');
const pill = ([bg, color]) => ({ background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' });
// 제출 방식 — 펜(크래들) · 파일(스캔 파일) · 키보드(학생 배포 후 온라인 입력)
const submitLabel = (t) => (t === 'pen' ? '🖊 펜' : t === 'ocr' || t === 'file' ? '📄 파일' : t === 'keyboard' ? '⌨ 키보드' : '-');
const btn = (primary, off) => ({ padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit', fontWeight: 800, cursor: off ? 'not-allowed' : 'pointer', border: primary ? 'none' : '1px solid #CBD5E1', background: primary ? (off ? '#CBD5E1' : '#E8590C') : 'white', color: primary ? 'white' : '#334155', opacity: !primary && off ? 0.45 : 1 });

// unified — 일괄 채점 통합 메뉴에서만: 미채점 단계는 그룹 학생 전체 선택이 기본(전체 선택 메뉴 없음) · 자동/교사 채점 표시는 다음 단계부터
const AnswerGradingPanel = ({ task, unified = false }) => {
  const wbId = task.wb.id;
  const isWord = task.wb.kind === 'word';
  const [items, setItems] = React.useState(null);
  const [passages, setPassages] = React.useState({});
  const [students, setStudents] = React.useState(null);
  const [tab, setTab] = React.useState('미채점');
  const [view, setView] = React.useState('card'); // 서·논술과 같은 기본 — 카드
  const [groupF, setGroupF] = React.useState('all');
  const [sel, setSel] = React.useState([]);
  const [review, setReview] = React.useState(null); // 학생 id
  const [toast, setToast] = React.useState('');
  const [invalidAsk, setInvalidAsk] = React.useState(false); // [일괄 채점 통합] 무효 처리 확인
  const sheetBoxRef = React.useRef(null);
  React.useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);

  React.useEffect(() => {
    listItems().then(setItems).catch(() => setItems([]));
    listPassages().then((ps) => setPassages(Object.fromEntries(ps.map((p) => [p.id, p])))).catch(() => {});
  }, []);
  const itemsById = React.useMemo(() => Object.fromEntries((items || []).map((i) => [i.id, i])), [items]);
  const questions = React.useMemo(() => (items ? gradingQuestionsOf(task.wb, itemsById) : []), [items, itemsById, task.wb]);

  // 학생 명단 — 저장된 채점 정보 + 새로 인쇄한 그룹의 학생
  React.useEffect(() => {
    const saved = task.wb.grading?.students || [];
    const have = new Set(saved.map((s) => s.id));
    const all = [...saved, ...rosterOf(task.groups).filter((s) => !have.has(s.id))];
    setStudents(all);
    setTab(TABS.find((t) => all.some((s) => inTab(s, t))) || '미채점'); // 학생이 있는 첫 단계로 연다
  }, [wbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoKey = unified && tab === '미채점' && students
    ? students.filter((s) => inTab(s, '미채점') && (groupF === 'all' || String(s.groupId) === groupF)).map((s) => s.id).join('|') : null;
  React.useEffect(() => { if (autoKey !== null) setSel(autoKey ? autoKey.split('|') : []); }, [autoKey]);

  const persist = async (next) => {
    setStudents(next);
    const latest = (await listWorkbooks()).find((w) => w.id === wbId) || task.wb;
    await putWorkbook({ ...latest, grading: { ...(latest.grading || {}), students: next } });
  };
  const patch = (ids, fn) => persist(students.map((s) => (ids.includes(s.id) ? { ...s, ...fn(s) } : s)));

  if (!students || !items) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>불러오는 중…</div>;

  const visible = students.filter((s) => inTab(s, tab) && (groupF === 'all' || String(s.groupId) === groupF));
  const selVisible = sel.filter((id) => visible.some((s) => s.id === id));
  const allOn = visible.length > 0 && visible.every((s) => sel.includes(s.id));
  const toggleAll = () => setSel(allOn ? [] : visible.map((s) => s.id));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const resultOf = (s) => (s.auto ? scoreOf(questions, s.auto, s.overrides) : null);
  const autoOnly = (s) => (s.auto ? scoreOf(questions, s.auto, {}) : null);
  const ungradedView = unified && tab === '미채점';
  const sendable = selVisible.filter((id) => students.find((s) => s.id === id)?.status === '결과 발송 전');

  // 미채점 → 채점 확인: 답안 받기(모의) + 자동 채점
  const receive = (type) => {
    const ids = selVisible;
    patch(ids, (s) => { const answers = mockAnswersFor(s.id, questions); return { submitType: type, answers, auto: autoGrade(questions, answers), overrides: {}, teacherEdited: false, status: '채점 확인' }; });
    setSel([]); setTab('채점 확인');
    setToast(`${ids.length}명 답안을 ${type === 'pen' ? '크래들(펜)' : '스캔'}으로 받아 자동 채점했습니다 — 「채점 확인」에서 확인해 주세요.`);
  };
  const completeReview = (ids) => {
    const ok = ids.filter((id) => { const s = students.find((x) => x.id === id); return s && resultOf(s)?.pending === 0; });
    const skip = ids.length - ok.length;
    if (ok.length) patch(ok, () => ({ status: '결과 발송 전' }));
    setSel([]);
    setToast(`${ok.length}명 검토 완료${skip ? ` · 확인 필요가 남은 ${skip}명은 건너뛰었습니다(상세보기에서 O/X를 정해 주세요)` : ''}.`);
  };
  const invalidate = () => {
    const ids = selVisible;
    patch(ids, () => ({ status: '결과 발송 전', invalid: true, answers: null, auto: null, overrides: {}, teacherEdited: false }));
    setSel([]); setInvalidAsk(false);
    setToast(`${ids.length}명의 제출을 무효 처리했습니다 — 「결과 발송」 탭에서 확인할 수 있습니다.`);
  };
  const send = (ids) => {
    const ok = ids.filter((id) => students.find((x) => x.id === id)?.status === '결과 발송 전');
    patch(ok, () => ({ status: '결과 발송 완료', sentAt: new Date().toISOString() })); setSel([]);
    setToast(`${ok.length}명에게 결과를 발송했습니다 (점수 · 틀린 문항 · 정답).`);
  };

  const autoCell = (s) => { if (s.invalid) return <b style={{ color: '#DC2626' }}>무효</b>; const a = autoOnly(s); return a ? <span>{a.correct}/{a.count} · <b>{a.score}점</b>{a.pending ? <span style={{ marginLeft: 6, ...pill(['#FEF3C7', '#B45309']) }}>확인 필요 {a.pending}</span> : null}</span> : '-'; };
  const teacherCell = (s) => { const r = resultOf(s); return s.teacherEdited && r ? <span>{r.correct}/{r.count} · <b>{r.score}점</b></span> : '-'; };

  // 카드 · 줄을 누르면 상세 (상세보기 버튼 없음). 답안을 받기 전이면 안내만
  const openProps = (s) => (ungradedView ? {} : { // [일괄 채점 통합] 미채점 단계는 상세 없음
    onClick: () => (s.answers ? setReview(s.id) : setToast(`${s.name} — 답안을 받은 뒤 볼 수 있습니다.`)),
    role: 'button', tabIndex: 0, 'aria-label': `${s.name} 상세`,
    onKeyDown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); if (s.answers) setReview(s.id); } },
    title: s.answers ? '누르면 답안 상세' : '답안을 받은 뒤 볼 수 있습니다.',
    style: { cursor: s.answers ? 'pointer' : 'default' },
  });
  const cur = review ? students.find((s) => s.id === review) : null;
  const curIdx = cur ? visible.findIndex((s) => s.id === cur.id) : -1;

  return (
    <section className="detail-view" aria-label="정답형 채점">
      <div className="task-info-banner" style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '1rem' }}>
        <div className="info-left">
          <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800 }}>[{task.type}] {task.title}</h2>
        </div>
      </div>

      <div className="control-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="tabs">
          {TABS.map((t) => <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setSel([]); }}>{t}({students.filter((s) => inTab(s, t)).length})</div>)}
        </div>
        <div className="view-controls" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', rowGap: 8 }}>
          <select className="select-box" value={groupF} onChange={(e) => setGroupF(e.target.value)} aria-label="그룹 선택">
            <option value="all">전체 그룹</option>
            {task.groups.map((g) => <option key={g.id} value={String(g.id)}>{g.label}</option>)}
          </select>
          {!ungradedView && (
            <label className="select-all-wrapper">
              <input type="checkbox" checked={allOn} onChange={toggleAll} /> 전체 선택
            </label>
          )}
          {tab === '미채점' && selVisible.length > 0 && (
            <>
              <button className="btn-bulk-grading" onClick={() => receive('pen')}>🖊 크래들 일괄채점 ({selVisible.length}명)</button>
              <button className="btn-bulk-grading" style={{ background: '#0EA5E9' }} onClick={() => receive('ocr')}>📷 스캔 채점 ({selVisible.length}명)</button>
            </>
          )}
          {ungradedView && selVisible.length > 0 && (
            <>
              <button className="btn-bulk-grading" title="학생의 제출을 무효로 합니다 — 채점하지 않고 「결과 발송」으로 옮깁니다." onClick={() => setInvalidAsk(true)}
                style={{ background: 'white', color: '#DC2626', border: '1px solid #FCA5A5' }}>⊘ 무효 처리 ({selVisible.length}명)</button>
              <button type="button" onClick={() => setSel([])}
                style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>선택 해제</button>
            </>
          )}
          {tab === '채점 확인' && selVisible.length > 0 && <button className="btn-bulk-grading" style={{ background: '#E8590C' }} onClick={() => completeReview(selVisible)}>✓ 검토 완료 처리 ({selVisible.length}명)</button>}
          {tab === '결과 발송' && sendable.length > 0 && <button className="btn-bulk-grading" style={{ background: '#2A75F3' }} onClick={() => send(sendable)}>📤 결과발송 ({sendable.length}명)</button>}
          <div className={`btn-icon ${view === 'card' ? 'active' : ''}`} onClick={() => setView('card')} role="button" aria-pressed={view === 'card'} title="카드 보기" style={{ marginLeft: 'auto' }}>▦</div>
          <div className={`btn-icon ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} role="button" aria-pressed={view === 'list'} title="목록 보기">☰</div>
        </div>
      </div>

      {visible.length === 0 && <div style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>이 단계의 학생이 없습니다.</div>}

      {view === 'card' && visible.length > 0 && (
        <div className="student-grid" style={{ flexShrink: 0 }}>
          {visible.map((s) => (
            <div key={s.id} className="student-card" {...openProps(s)}>
              <input type="checkbox" className="card-checkbox" checked={sel.includes(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(s.id)} aria-label={`${s.name} 선택`} />
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {s.submitType && <div style={pill(['#F1F5F9', '#475569'])}>{submitLabel(s.submitType)}</div>}
              </div>
              <div className="student-name">{s.name}</div>
              <div className="student-meta">{s.grade}</div>
              {!ungradedView && (
                <div className="grading-info">
                  <div className="grading-row"><span className="label">자동채점 :</span><span className="value">{autoCell(s)}</span></div>
                  <div className="grading-row"><span className="label">교사채점 :</span><span className="value">{s.teacherEdited && <span className="badge-dot badge-orange" />}{teacherCell(s)}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'list' && visible.length > 0 && (
        <div className="student-list-table-wrapper" style={{ flexShrink: 0 }}>
          <table className="student-list-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>{!ungradedView && <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="전체 선택" />}</th>
                <th>학생 이름</th>
                <th>학년/반/번호</th>
                <th>제출 방식</th>
                {!ungradedView && <th title="학생 답을 정답과 대조한 결과 — 맞힌 수 · 점수">자동 채점</th>}
                {!ungradedView && <th title="교사가 O/X를 고친 뒤의 결과">교사 채점</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} {...openProps(s)}>
                  <td><input type="checkbox" checked={sel.includes(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(s.id)} aria-label={`${s.name} 선택`} /></td>
                  <td style={{ fontWeight: 700 }}>{s.name}</td>
                  <td>{s.grade}</td>
                  <td>{submitLabel(s.submitType)}</td>
                  {!ungradedView && <td>{autoCell(s)}</td>}
                  {!ungradedView && <td>{teacherCell(s)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 모달(v1.48 — 서·논술과 같은 큰 창) — 학생이 답을 쓴 문제지 그대로. 문항을 누르면 O ↔ X */}
      {cur && (() => {
        const r = resultOf(cur); const a = autoOnly(cur);
        const marks = Object.fromEntries(questions.map((q) => [q.key, q.key in (cur.overrides || {}) ? cur.overrides[q.key] : cur.auto?.[q.key]]));
        const grading = {
          answers: cur.answers || {}, marks, correct: Object.fromEntries(questions.map((q) => [q.key, q.correct])),
          onMark: (key) => patch([cur.id], (s) => ({ overrides: { ...s.overrides, [key]: nextMark(marks[key]) }, teacherEdited: true })),
        };
        const pending = questions.filter((q) => marks[q.key] == null);
        const wrong = questions.filter((q) => marks[q.key] === false);
        const jump = (key) => sheetBoxRef.current?.querySelector(`[data-grade-row="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const go = (d) => { const n = visible[curIdx + d]; if (n?.answers) setReview(n.id); };
        const entries = isWord ? null : (task.wb.itemIds || []).map((id) => itemsById[id]).filter(Boolean).map((item) => ({ item, points: task.wb.points?.[item.id] ?? item.points ?? 1 }));
        const chip = (q, tone) => (
          <button key={q.key} type="button" onClick={() => jump(q.key)} title={`${q.no}번으로`}
            style={{ minWidth: 30, padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', border: `1px solid ${tone[1]}`, background: tone[0], color: tone[1] }}>{q.no}</button>
        );
        return (
          <div className="modal-overlay" onClick={() => setReview(null)}>
            <div className="modal-container" role="dialog" aria-modal="true" aria-label="정답형 채점 상세" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="btn-modal-close" onClick={() => setReview(null)} aria-label="닫기">×</button>
              <div style={{ padding: '18px 64px 14px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 'var(--neo-font-size-lg)' }}>{cur.name}</b>
                <span style={{ color: '#64748B' }}>{cur.grade} · {submitLabel(cur.submitType)}</span>
                <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: 'var(--neo-font-size-xs)' }}>{task.title}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                {/* 왼쪽 — 학생 답안지 */}
                <div ref={sheetBoxRef} style={{ flex: '1 1 auto', minWidth: 0, overflowY: 'auto', padding: 12, background: '#F1F5F9' }}>
                  {isWord
                    ? <WordSheet title={task.wb.title} curriculum={task.wb.curriculum} words={task.wb.words || []} mode={task.wb.mode} layout={task.wb.layout} grading={grading} />
                    : <WorkbookSheet title={task.wb.title} curriculum={task.wb.curriculum} entries={entries} passages={passages} layout={task.wb.layout} grading={grading} />}
                </div>
                {/* 오른쪽 — 점수 · 확인 필요 · 틀린 문항 */}
                <aside aria-label="채점 요약" style={{ flex: '0 0 280px', borderLeft: '1px solid #E2E8F0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', boxSizing: 'border-box' }}>
                  <div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>자동 채점</div>
                    <div style={{ fontWeight: 800 }}>{scoreLabel(a)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>최종 (교사 확인)</div>
                    <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: '#1D4ED8' }}>{r.score}<span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}> / {r.total}점</span></div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>맞힌 문항 {r.correct}/{r.count}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#B45309', marginBottom: 6 }}>확인 필요 {pending.length}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{pending.length ? pending.map((q) => chip(q, ['#FEF3C7', '#B45309'])) : <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>없음</span>}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#DC2626', marginBottom: 6 }}>틀린 문항 {wrong.length}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{wrong.length ? wrong.map((q) => chip(q, ['#FEF2F2', '#DC2626'])) : <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>없음</span>}</div>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.6, background: '#F8FAFC', borderRadius: 8, padding: 10 }}>
                    <b style={{ color: '#DC2626' }}>○</b> 맞음 · <b style={{ color: '#DC2626' }}>╱</b> 틀림 · <b style={{ color: '#B45309' }}>노란 칸</b> 확인 필요<br />
                    답안지의 문항을 누르면 O ↔ X로 바뀌고 바로 저장됩니다. 확인 필요가 모두 정해져야 검토 완료할 수 있습니다.
                  </div>
                </aside>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" disabled={curIdx <= 0} onClick={() => go(-1)} style={btn(false, curIdx <= 0)}>← 이전 학생</button>
                <button type="button" disabled={curIdx < 0 || curIdx >= visible.length - 1} onClick={() => go(1)} style={btn(false, curIdx < 0 || curIdx >= visible.length - 1)}>다음 학생 →</button>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setReview(null)} style={btn(false)}>닫기</button>
                {cur.status === '채점 확인' && (
                  <button type="button" disabled={r.pending > 0} onClick={() => { completeReview([cur.id]); setReview(null); }}
                    title={r.pending > 0 ? '확인 필요 문항의 O/X를 먼저 정해 주세요.' : ''} style={btn(true, r.pending > 0)}>✓ 검토 완료</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {invalidAsk && (
        <div className="modal-overlay" onClick={() => setInvalidAsk(false)}>
          <div role="alertdialog" aria-modal="true" aria-label="무효 처리 확인" onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 16, padding: '24px 24px 18px', width: 'min(420px, 92vw)', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
            <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 8 }}>선택한 학생 {selVisible.length}명의 제출을 무효 처리하시겠습니까?</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.6 }}>무효 처리한 학생은 채점하지 않고 「결과 발송」 탭으로 옮겨집니다.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setInvalidAsk(false)} style={btn(false)}>취소</button>
              <button type="button" onClick={invalidate} style={{ ...btn(true), background: '#DC2626' }}>무효 처리</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 10000 }}>{toast}</div>}
    </section>
  );
};

export default AnswerGradingPanel;
