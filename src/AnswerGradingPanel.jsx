/**
 * AnswerGradingPanel — 채점 관리 › 정답형 문제집 · 낱말 문제집 (SCR 후속 · TSK-15 v1.43, 로컬 프로토)
 *
 * 서·논술 채점과 같은 흐름 · 같은 목록:
 *   탭 미채점 → 채점 확인 → 결과 발송 · [🖊 크래들 일괄채점] [📷 스캔 채점] · [✓ 검토 완료 처리] · [📤 결과발송]
 *   학생 목록 칸: 학생 이름 · 학년/반/번호 · 제출 방식 · 자동 채점 · 교사 채점 · 상태 · 상세보기
 * 다른 것: 채점기 = 정답 대조(「자동 채점」 — 맞힌 수 · 점수), 상세 = 문항별 학생 답 · 정답 · O/X, 교사가 O/X를 고친다
 * 학생 답은 모의(실제 스캔 OCR · Ncode 펜 인식은 다음 단계). 채점 정보는 문제집(wb.grading)에 저장.
 */
import React from 'react';
import { listItems, listWorkbooks, putWorkbook } from './lib/itemBank';
import { gradingQuestionsOf, mockAnswersFor, autoGrade, scoreOf, scoreLabel, rosterOf } from './lib/answerGrading';

const TABS = ['미채점', '채점 확인', '결과 발송'];
const inTab = (s, tab) => (tab === '미채점' ? s.status === '미채점' : tab === '채점 확인' ? s.status === '채점 확인' : s.status === '결과 발송 전' || s.status === '결과 발송 완료');
const STATUS_STYLE = {
  미채점: ['#F1F5F9', '#64748B'], '채점 확인': ['#FEF3C7', '#B45309'], '결과 발송 전': ['#DBEAFE', '#1D4ED8'], '결과 발송 완료': ['#D1FAE5', '#047857'],
};
const pill = ([bg, color]) => ({ background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' });
const oxBtn = (on, ok) => ({ width: 30, height: 26, borderRadius: 6, fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer', border: `1px solid ${on ? (ok ? '#10B981' : '#EF4444') : '#CBD5E1'}`, background: on ? (ok ? '#10B981' : '#EF4444') : 'white', color: on ? 'white' : '#64748B' });

const AnswerGradingPanel = ({ task }) => {
  const wbId = task.wb.id;
  const [items, setItems] = React.useState(null);
  const [students, setStudents] = React.useState(null);
  const [tab, setTab] = React.useState('미채점');
  const [groupF, setGroupF] = React.useState('all');
  const [sel, setSel] = React.useState([]);
  const [review, setReview] = React.useState(null); // 학생 id
  const [toast, setToast] = React.useState('');
  React.useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);

  React.useEffect(() => { listItems().then(setItems).catch(() => setItems([])); }, []);
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
  const resultOf = (s) => (s.auto ? scoreOf(questions, s.auto, s.overrides) : null);
  const autoOnly = (s) => (s.auto ? scoreOf(questions, s.auto, {}) : null);
  const totalPts = questions.reduce((a, q) => a + q.points, 0);

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
  const send = (ids) => {
    const ok = ids.filter((id) => students.find((x) => x.id === id)?.status === '결과 발송 전');
    patch(ok, () => ({ status: '결과 발송 완료', sentAt: new Date().toISOString() })); setSel([]);
    setToast(`${ok.length}명에게 결과를 발송했습니다 (점수 · 틀린 문항 · 정답).`);
  };

  const cur = review ? students.find((s) => s.id === review) : null;
  const curIdx = cur ? visible.findIndex((s) => s.id === cur.id) : -1;

  return (
    <section className="detail-view" aria-label="정답형 채점">
      <div className="task-info-banner" style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '1rem' }}>
        <div className="info-left">
          <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800 }}>[{task.type}] {task.title}</h2>
          <div className="stats-summary" style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1' }}>
            문제지 인쇄일: {task.date} ∙ {task.groups.length}개 그룹 ∙ {students.length}명 ∙ {task.wb.kind === 'word' ? '낱말 문제집' : '정답형 문제집'} ∙ {questions.length}문항 · {totalPts}점 ∙ 채점: 자동 채점(정답 대조)
          </div>
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
          <label className="select-all-wrapper">
            <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : visible.map((s) => s.id))} /> 전체 선택
          </label>
          {tab === '미채점' && selVisible.length > 0 && (
            <>
              <button className="btn-bulk-grading" onClick={() => receive('pen')}>🖊 크래들 일괄채점 ({selVisible.length}명)</button>
              <button className="btn-bulk-grading" style={{ background: '#0EA5E9' }} onClick={() => receive('ocr')}>📷 스캔 채점 ({selVisible.length}명)</button>
            </>
          )}
          {tab === '채점 확인' && selVisible.length > 0 && <button className="btn-bulk-grading" style={{ background: '#E8590C' }} onClick={() => completeReview(selVisible)}>✓ 검토 완료 처리 ({selVisible.length}명)</button>}
          {tab === '결과 발송' && selVisible.filter((id) => students.find((s) => s.id === id)?.status === '결과 발송 전').length > 0 && (
            <button className="btn-bulk-grading" style={{ background: '#2A75F3' }} onClick={() => send(selVisible)}>📤 결과발송 ({selVisible.filter((id) => students.find((s) => s.id === id)?.status === '결과 발송 전').length}명)</button>
          )}
        </div>
      </div>

      <div className="student-list-table-wrapper">
        <table className="student-list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : visible.map((s) => s.id))} aria-label="전체 선택" /></th>
              <th>학생 이름</th>
              <th>학년/반/번호</th>
              <th>제출 방식</th>
              <th title="학생 답을 정답과 대조한 결과 — 맞힌 수 · 점수">자동 채점</th>
              <th title="교사가 O/X를 고친 뒤의 결과">교사 채점</th>
              <th>상태</th>
              <th style={{ width: 100 }}>상세보기</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const a = autoOnly(s); const r = resultOf(s);
              return (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={sel.includes(s.id)} onChange={() => setSel((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} aria-label={`${s.name} 선택`} /></td>
                  <td style={{ fontWeight: 700 }}>{s.name}</td>
                  <td>{s.grade}</td>
                  <td>{s.submitType === 'pen' ? '🖊 펜' : s.submitType === 'ocr' ? '📷 스캔' : '-'}</td>
                  <td>{a ? <span>{a.correct}/{a.count} · <b>{a.score}점</b>{a.pending ? <span style={{ marginLeft: 6, ...pill(['#FEF3C7', '#B45309']) }}>확인 필요 {a.pending}</span> : null}</span> : '-'}</td>
                  <td>{s.teacherEdited && r ? <span>{r.correct}/{r.count} · <b>{r.score}점</b></span> : '-'}</td>
                  <td><span style={pill(STATUS_STYLE[s.status] || STATUS_STYLE.미채점)}>{s.status}</span></td>
                  <td><button className="btn-card-detail" disabled={!s.answers} onClick={() => setReview(s.id)} style={{ width: 'auto', height: 'auto', padding: '4px 10px', opacity: s.answers ? 1 : 0.4, cursor: s.answers ? 'pointer' : 'not-allowed' }}>보기</button></td>
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>이 단계의 학생이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 상세 — 문항별 학생 답 · 정답 · 자동 O/X · 교사 O/X */}
      {cur && (() => {
        const r = resultOf(cur); const a = autoOnly(cur);
        const setOv = (key, v) => patch([cur.id], (s) => ({ overrides: { ...s.overrides, [key]: v }, teacherEdited: true }));
        const go = (d) => { const n = visible[curIdx + d]; if (n?.answers) setReview(n.id); };
        return (
          <div onClick={() => setReview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div role="dialog" aria-modal="true" aria-label="정답형 채점 상세" onClick={(e) => e.stopPropagation()}
              style={{ background: 'white', borderRadius: 14, width: 'min(980px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 'var(--neo-font-size-lg)' }}>{cur.name}</b>
                <span style={{ color: '#64748B' }}>{cur.grade} · {cur.submitType === 'pen' ? '🖊 펜' : '📷 스캔'}</span>
                <span style={pill(STATUS_STYLE[cur.status])}>{cur.status}</span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)' }}>자동 채점 <b>{scoreLabel(a)}</b> → 최종 <b style={{ color: '#1D4ED8' }}>{r.correct}/{r.count} · {r.score}점</b><span style={{ color: '#94A3B8' }}> (만점 {r.total}점)</span>{r.pending ? <span style={{ marginLeft: 6, ...pill(['#FEF3C7', '#B45309']) }}>확인 필요 {r.pending}</span> : null}</span>
              </div>
              <div style={{ overflowY: 'auto', padding: '8px 18px 12px' }}>
                <table className="student-list-table" style={{ width: '100%' }}>
                  <thead><tr><th style={{ width: 48 }}>번호</th><th>문제</th><th>학생 답 (인식)</th><th>정답</th><th style={{ width: 60 }}>배점</th><th style={{ width: 90 }}>자동</th><th style={{ width: 90 }}>교사 O/X</th></tr></thead>
                  <tbody>
                    {questions.map((q) => {
                      const ans = cur.answers?.[q.key]; const auto = cur.auto?.[q.key];
                      const ov = q.key in (cur.overrides || {}) ? cur.overrides[q.key] : undefined;
                      const final = ov !== undefined ? ov : auto;
                      return (
                        <tr key={q.key} style={final == null ? { background: '#FFFBEB' } : undefined}>
                          <td style={{ fontWeight: 800 }}>{q.no}</td>
                          <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.prompt}>{q.prompt}</td>
                          <td>
                            <span style={{ display: 'inline-block', minWidth: 60, padding: '2px 8px', border: '1px dashed #94A3B8', borderRadius: 6, fontFamily: '"Nanum Pen Script", "Comic Sans MS", cursive', fontSize: 16 }}>{ans?.text || '—'}</span>
                            {ans?.uncertain && <span style={{ marginLeft: 6, ...pill(['#FEF3C7', '#B45309']) }} title="글씨가 흐리거나 두 개를 표시해 인식이 애매합니다">인식 애매</span>}
                          </td>
                          <td style={{ color: '#047857', fontWeight: 700 }}>{q.correct || <span style={{ color: '#94A3B8' }}>{q.manual ? '교사 판단' : '정답 없음'}</span>}</td>
                          <td>{q.points}</td>
                          <td>{auto === true ? <b style={{ color: '#10B981' }}>O</b> : auto === false ? <b style={{ color: '#EF4444' }}>X</b> : <span style={pill(['#FEF3C7', '#B45309'])}>확인 필요</span>}</td>
                          <td>
                            <span style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label={`${q.no}번 교사 O/X`}>
                              <button type="button" role="radio" aria-checked={final === true} onClick={() => setOv(q.key, true)} style={oxBtn(final === true, true)}>O</button>
                              <button type="button" role="radio" aria-checked={final === false} onClick={() => setOv(q.key, false)} style={oxBtn(final === false, false)}>X</button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn-card-detail" disabled={curIdx <= 0} onClick={() => go(-1)} style={{ width: 'auto', height: 'auto', padding: '6px 12px' }}>← 이전 학생</button>
                <button type="button" className="btn-card-detail" disabled={curIdx < 0 || curIdx >= visible.length - 1} onClick={() => go(1)} style={{ width: 'auto', height: 'auto', padding: '6px 12px' }}>다음 학생 →</button>
                <span style={{ flex: 1, fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>O/X를 누르면 바로 저장됩니다. 「확인 필요」가 모두 정해져야 검토 완료할 수 있습니다.</span>
                <button type="button" onClick={() => setReview(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
                {cur.status === '채점 확인' && (
                  <button type="button" disabled={r.pending > 0} onClick={() => { completeReview([cur.id]); setReview(null); }}
                    title={r.pending > 0 ? '확인 필요 문항의 O/X를 먼저 정해 주세요.' : ''}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: r.pending > 0 ? '#CBD5E1' : '#E8590C', color: 'white', fontWeight: 800, cursor: r.pending > 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>✓ 검토 완료</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', zIndex: 2100 }}>{toast}</div>}
    </section>
  );
};

export default AnswerGradingPanel;
