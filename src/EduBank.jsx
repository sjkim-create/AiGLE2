/**
 * EduBank.jsx — [2.4] 교육청 문제 은행 (TSK-16)
 *
 *   mode='admin'   시스템 관리자 › 교육청 문제 은행 — [+ 새 과제 등록 ▾](직접 등록 › 서·논술형/정답형 · 스마트 등록)로 등록 · 삭제
 *   mode='teacher' 교사 › 과제 관리 › 교육청 문제 은행 — 골라서 [복제] → 내 과제가 된다
 *                    서·논술형 → 서·논술형 과제 목록 · 정답형 → 내 문항(문제집은 교사가 문항에서 엮는다 — v1.5)
 *   화면: 왼쪽 목록 | 오른쪽 보기(읽기 전용)
 * 프로토타입: 이 브라우저에 저장 (lib/eduBank.js). 2.3의 「공유된 과제」(교사 간 공유)와는 다른 기능이다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import TaskRegistration from './TaskRegistration';
import { EDU_CATEGORIES, categoryOf, listEduEntries, deleteEduEntry, putEduEssay, putEduAnswer, putEduAnswerTask, cloneEssayTask, cloneAnswerToItems } from './lib/eduBank';
import { ITEM_TYPES, stemText } from './lib/itemBank';
import { taskToDirectInputData, modelRowIdx, modelAnswerScore, criteriaTotal } from './lib/taskSchema';

const btn = (primary = false, danger = false) => ({
  padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
  border: primary ? 'none' : `1px solid ${danger ? '#FECACA' : '#CBD5E1'}`, background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : danger ? '#DC2626' : '#475569',
});
const stripHtml = (h) => String(h || '').replace(/<img[^>]*>/gi, ' [그림] ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const dateOf = (iso) => (iso || '').slice(0, 10);
const Badge = ({ entry }) => {
  const c = EDU_CATEGORIES[categoryOf(entry)];
  return <span style={{ padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, whiteSpace: 'nowrap' }}>{c.icon} {c.label}</span>;
};

/** 오른쪽 보기 — 입력 칸 없이 읽기만 */
const Preview = ({ entry }) => {
  if (entry.kind === 'essay') {
    // 직접 등록 · 스마트 등록 과제를 같은 모양(서·논술형 직접 등록의 문항)으로 맞춰 보인다 — 문항 · 모범답안 · 채점 기준표(루브릭)
    const data = entry.task ? taskToDirectInputData(entry.task) : {};
    const qs = data.questions || [];
    const passage = stripHtml(data.passage);
    const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B', margin: '10px 0 4px' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {passage && <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7 }}>{passage}</div>}
        {qs.map((q, i) => {
          const crit = (q.criteria || []).filter((c) => c.name || (c.rows || []).some((r) => r.desc));
          return (
            <article key={q.id || i} style={{ borderTop: i ? '1px solid #F1F5F9' : 'none', paddingTop: i ? 16 : 0 }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B' }}>
                문항 {i + 1}{q.points ? <span style={{ color: '#94A3B8', fontWeight: 700, marginLeft: 6 }}>[{q.points}점]</span> : null}
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', lineHeight: 1.7, marginTop: 4 }}>{stripHtml(q.content) || '(문항 내용 없음)'}</div>
              {stripHtml(q.modelAnswer?.html) && (<>
                <div style={label}>모범답안{criteriaTotal(q) > 0 && <span style={{ marginLeft: 6, color: '#047857' }}>· 평가 기준 {modelAnswerScore(q)}/{criteriaTotal(q)}점</span>}</div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', lineHeight: 1.7 }}>{stripHtml(q.modelAnswer.html)}</div>
              </>)}
              <div style={label}>채점 기준표 (루브릭)</div>
              {crit.length === 0 ? (
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#B45309' }}>채점 기준이 없습니다.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: '24%' }}>평가 범주</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0', width: 56, textAlign: 'center' }}>점수</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #E2E8F0' }}>채점 기준</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crit.map((c, ci) => (c.rows || []).map((r, ri) => (
                      <tr key={`${ci}-${ri}`}>
                        {ri === 0 && (
                          <td rowSpan={(c.rows || []).length} style={{ padding: '6px 8px', border: '1px solid #E2E8F0', verticalAlign: 'top', fontWeight: 700, color: '#1E293B' }}>
                            {c.name || `범주 ${ci + 1}`}{c.maxPoints ? <div style={{ color: '#94A3B8', fontWeight: 600 }}>{c.maxPoints}점</div> : null}
                          </td>
                        )}
                        <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', textAlign: 'center', fontVariantNumeric: 'tabular-nums', background: modelRowIdx(c) === ri ? '#ECFDF5' : undefined }}>
                          {r.score}{modelRowIdx(c) === ri && <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#047857', fontWeight: 800, whiteSpace: 'nowrap' }}>모범답안</div>}
                        </td>
                        <td style={{ padding: '6px 8px', border: '1px solid #E2E8F0', color: '#334155', lineHeight: 1.6 }}>{stripHtml(r.desc) || '—'}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              )}
            </article>
          );
        })}
        {qs.length === 0 && <div style={{ color: '#94A3B8' }}>문항 내용이 없습니다.</div>}
      </div>
    );
  }
  const passById = Object.fromEntries((entry.passages || []).map((p) => [p.id, p]));
  const shown = new Set();
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entry.items.map((it) => {
        const p = it.passageId && !shown.has(it.passageId) ? passById[it.passageId] : null;
        if (p) shown.add(it.passageId);
        return (
          <li key={it.id} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', lineHeight: 1.7 }}>
            {p && <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', marginBottom: 6, color: '#475569', whiteSpace: 'pre-wrap' }}>{p.text}</div>}
            <span style={{ color: '#64748B', fontWeight: 700, marginRight: 6 }}>{ITEM_TYPES[it.itemType]?.label || it.itemType}</span>
            {stemText(it.stem)}
            <span style={{ color: '#94A3B8', marginLeft: 6 }}>[{entry.itemPoints?.[it.id] ?? it.points ?? 1}점]</span>
            {(it.choices || []).length > 0 && (
              <div style={{ color: '#475569', marginTop: 2 }}>{it.choices.map((c, ci) => <span key={ci} style={{ marginRight: 12 }}>{'①②③④⑤⑥⑦⑧'[ci]} {c.text}</span>)}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

const EduBank = ({ mode = 'teacher', showToast, onCloneEssay, onOpenItems, onOpenEssayList }) => {
  const admin = mode === 'admin';
  const [entries, setEntries] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [kindF, setKindF] = useState('all');
  const [q, setQ] = useState('');
  const [reg, setReg] = useState(null); // 관리자 등록 중 { mode, n, entry? } — entry가 있으면 그 서·논술형 과제를 고친다
  const [confirmDel, setConfirmDel] = useState(null);
  const [cloned, setCloned] = useState({}); // 이번에 복제한 항목 — { [entryId]: 'essay' | 자료 id(복제한 문항 묶음) }
  const toast = (m, tone) => showToast && showToast(m, tone);

  const load = () => listEduEntries().then(setEntries).catch(() => setEntries([]));
  useEffect(() => {
    load();
    const on = () => load();
    window.addEventListener('aigle:edu-bank-changed', on);
    return () => window.removeEventListener('aigle:edu-bank-changed', on);
  }, []);

  const all = entries || [];
  const visible = useMemo(() => all.filter((e) => (kindF === 'all' || categoryOf(e) === kindF)
    && (!q.trim() || `${e.title} ${e.subject} ${e.schoolLevel}`.includes(q.trim()))), [all, kindF, q]);
  const opened = all.find((e) => e.id === openId) || visible[0] || null;

  /* 관리자 등록 — 새 과제 등록 화면을 그대로 쓰고, 결과만 교육청 문제 은행에 저장한다 */
  if (admin && reg) {
    const close = () => setReg(null);
    return (
      <TaskRegistration key={reg.n} initialMode={reg.mode} unifiedEntry showToast={showToast} initialEditTask={reg.entry?.task || null}
        onBack={close} onLeaveGuardChange={() => {}} onGoItemBank={() => {}} onOpenWorkbook={() => {}}
        eduMode={{
          onAnswerSmart: async ({ items, passages, source }) => {
            await putEduAnswer({ title: source.title || source.fileName, items, passages, points: Object.fromEntries(items.map((i) => [i.id, i.points ?? 1])), origin: 'smart' });
            toast(`「${source.title || source.fileName}」 — 교육청 문제 은행에 등록했습니다.`);
            close();
          },
        }}
        onAdd={async (task) => {
          if (task.form === 'answer') { await putEduAnswerTask(task); toast(`「${task.title}」 — 교육청 문제 은행에 등록했습니다.`); close(); return; }
          // 서·논술형은 스마트 결과 화면 · 직접 등록 수정이 이어지므로 저장만 하고 화면은 그대로 (같은 과제는 덮어쓴다)
          await putEduEssay(task, reg.entry?.createdAt);
          toast(`「${task.title}」 — 교육청 문제 은행에 저장했습니다.`);
        }} />
    );
  }

  const clone = async (e) => {
    if (e.kind === 'essay') {
      onCloneEssay?.(cloneEssayTask(e));
      setCloned((c) => ({ ...c, [e.id]: 'essay' }));
      toast(`「${e.title}」 — 내 서·논술형 과제로 복제했습니다.`);
    } else {
      const srcId = await cloneAnswerToItems(e);
      setCloned((c) => ({ ...c, [e.id]: srcId }));
      toast(`「${e.title}」 — 문항 ${e.items.length}개를 내 문항으로 복제했습니다.`);
    }
  };

  return (
    <div className="task-management-container" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
      <header className="content-header" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">교육청 문제 은행</h1>
          <p className="content-subtitle">
            {admin ? '등록한 과제는 모든 교사가 보고 복제할 수 있습니다.' : '교육청이 등록한 과제를 골라 복제하면 내 과제가 됩니다.'} · {all.length}건
          </p>
        </div>
        {admin && <button type="button" onClick={() => setReg({ mode: 'select', n: Date.now() })} style={{ ...btn(true), marginLeft: 'auto' }}>+ 새 과제 등록</button>}
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 과제명 · 교과 · 학교급 검색"
          style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }} />
        {/* 구분 — 서·논술 · 기초학력 (교육청 문제는 이 둘뿐 — TSK-16 v1.6) */}
        {[['all', `전체 ${all.length}`], ...Object.entries(EDU_CATEGORIES).map(([k, c]) => [k, `${c.icon} ${c.label} ${all.filter((e) => categoryOf(e) === k).length}`])].map(([k, l]) => (
          <button key={k} type="button" className={`btn-outline${kindF === k ? ' active' : ''}`} onClick={() => setKindF(k)}>{l}</button>
        ))}
      </div>

      {entries === null ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>불러오는 중…</div>
      ) : all.length === 0 ? (
        <div className="task-empty-state">
          <div className="empty-icon" aria-hidden="true">🏛️</div>
          <p className="empty-title">교육청 문제 은행에 과제가 없습니다.</p>
          <p className="empty-sub">{admin ? '오른쪽 위 [+ 새 과제 등록]으로 과제를 등록해 주세요.' : '교육청이 과제를 등록하면 여기에 보입니다.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flex: '1 1 0', minHeight: 0, alignItems: 'stretch' }}>
          {/* 왼쪽 목록 */}
          <div role="listbox" aria-label="교육청 문제 은행 목록" style={{ flex: 'none', width: 'clamp(240px, 38%, 380px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((e) => {
              const on = opened?.id === e.id;
              return (
                <div key={e.id} role="option" aria-selected={on} tabIndex={0} onClick={() => setOpenId(e.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setOpenId(e.id); } }}
                  style={{ background: on ? '#EFF6FF' : 'white', border: `1px solid ${on ? '#93C5FD' : '#E2E8F0'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Badge entry={e} />
                    {cloned[e.id] && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#16A34A', fontWeight: 800 }}>✓ 복제함</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{dateOf(e.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>{e.title}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>
                    {[e.schoolLevel, e.subject, `문항 ${e.questions}개`, e.points != null && `${e.points}점`].filter(Boolean).join(' · ')}
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>조건에 맞는 과제가 없습니다.</div>}
          </div>

          {/* 오른쪽 보기 */}
          <section aria-label="과제 보기" style={{ flex: '1 1 0', minWidth: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {opened ? (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Badge entry={opened} />
                    <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '6px 0 2px', color: '#1E293B' }}>{opened.title}</h2>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                      {[opened.schoolLevel, opened.subject, `문항 ${opened.questions}개`, opened.points != null && `총 ${opened.points}점`, `등록 ${dateOf(opened.createdAt)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {admin ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* 서·논술형은 서·논술형 직접 등록 화면(평가 기준 단계 — 루브릭)에서 고친다 */}
                      {opened.kind === 'essay' && <button type="button" style={btn()} onClick={() => setReg({ mode: 'direct2', n: Date.now(), entry: opened })}>✏️ 수정</button>}
                      <button type="button" style={btn(false, true)} onClick={() => setConfirmDel(opened)}>🗑 삭제</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {cloned[opened.id] && (
                        <button type="button" style={btn()} onClick={() => (opened.kind === 'essay' ? onOpenEssayList?.() : onOpenItems?.(cloned[opened.id]))}>
                          {opened.kind === 'essay' ? '내 문제집 목록으로' : '복제한 문항 보기'}
                        </button>
                      )}
                      <button type="button" style={btn(true)} onClick={() => clone(opened)}>{cloned[opened.id] ? '다시 복제' : opened.kind === 'essay' ? '📋 내 과제로 복제' : '📋 내 문항으로 복제'}</button>
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                  <Preview entry={opened} />
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>왼쪽에서 과제를 고르세요.</div>
            )}
          </section>
        </div>
      )}

      {confirmDel && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 24, width: 400, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 900 }}>「{confirmDel.title}」 과제를 삭제할까요?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.6 }}>교사가 이미 복제한 과제는 그대로 남습니다.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={btn()} onClick={() => setConfirmDel(null)}>닫기</button>
              <button type="button" style={{ ...btn(true), background: '#DC2626' }} onClick={async () => { await deleteEduEntry(confirmDel.id); toast('삭제했습니다.'); setConfirmDel(null); setOpenId(null); }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EduBank;
