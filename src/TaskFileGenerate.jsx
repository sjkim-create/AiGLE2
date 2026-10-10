/**
 * TaskFileGenerate.jsx — 새 과제 등록 > ✨ 스마트 과제 등록 > 서·논술형 (舊 「파일로 과제 생성」)
 *
 * 평가 문항 자료(PDF·이미지)를 올리면 로딩 후 바로 과제를 등록한다 (중간 확인 단계 없음).
 * 등록 결과 화면에서 「부족한 항목」(AI가 채우지 못했거나 확인이 필요한 부분)을 알려 주고,
 * 상용 「JSON 가져오기」용 JSON 파일로 내려받을 수 있다 (lib/assignmentJson).
 * 변환 로직: lib/taskFromFile.js · 과제 객체: lib/taskSchema.buildFileGenerateTask
 */
import React, { useRef, useState } from 'react';
import { generateTaskFromFile, isFileGenerateAvailable, GenerateError, STEPS, MAX_PAGES, MAX_FILE_MB } from './lib/taskFromFile';
import { buildFileGenerateTask } from './lib/taskSchema';
import { downloadAssignmentJson } from './lib/assignmentJson';

const ISSUE_META = {
  error: { icon: '⛔', label: '꼭 입력', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  warn: { icon: '⚠️', label: '확인 필요', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  info: { icon: 'ℹ️', label: '참고', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
};

/** 부족한 항목 목록 — 결과 화면·과제 상세에서 같이 쓴다 */
export const IssueList = ({ issues = [] }) => {
  if (!issues.length) {
    return <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#047857', fontWeight: 700 }}>✅ 부족한 항목 없이 모두 채웠습니다.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {issues.map((it, i) => {
        const m = ISSUE_META[it.level] || ISSUE_META.info;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: m.bg, border: `1px solid ${m.border}` }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6 }}>{m.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: m.color }}>{m.label} · {it.field}</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', lineHeight: 1.6 }}>{it.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 24px', width: '100%', boxSizing: 'border-box' };
const btn = (primary) => ({
  padding: '10px 18px', borderRadius: 10, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer',
  border: primary ? '1px solid #2A75F3' : '1px solid #E2E8F0', background: primary ? '#2A75F3' : 'white', color: primary ? 'white' : '#475569',
});

// onEditTask — 만든 과제를 직접 입력 2 화면으로 열어 고친다 (그림 범위 조정 포함)
const TaskFileGenerate = ({ onBack, onAdd, embedded = false, onEditTask }) => {
  const [phase, setPhase] = useState('pick'); // pick | loading | done | error
  const [file, setFile] = useState(null);
  const [stepKey, setStepKey] = useState(null);
  const [result, setResult] = useState(null); // { task, issues, draft }
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const available = isFileGenerateAvailable();

  const run = async (f) => {
    if (!f) return;
    setFile(f); setPhase('loading'); setError(null); setStepKey(null);
    try {
      const { draft, issues } = await generateTaskFromFile(f, setStepKey);
      const task = buildFileGenerateTask({ draft, issues });
      onAdd && onAdd(task);
      setResult({ task, issues, draft });
      setPhase('done');
    } catch (err) {
      setError(err instanceof GenerateError ? err : new GenerateError('UNKNOWN', '과제를 만드는 중 문제가 생겼습니다.', String(err?.message || err)));
      setPhase('error');
    }
  };

  const onPick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; run(f); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); run(e.dataTransfer.files?.[0]); };
  const reset = () => { setPhase('pick'); setFile(null); setResult(null); setError(null); };

  const stepIdx = STEPS.findIndex((s) => s.key === stepKey);

  // [TSK-14] embedded — 「스마트 과제 등록 › 서·논술형」 안에 들어갈 때는 머리줄·바깥 여백을 상위가 그린다
  return (
    <div style={embedded ? undefined : { minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      {!embedded && (
        <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onBack} disabled={phase === 'loading'} style={{ ...btn(false), opacity: phase === 'loading' ? 0.5 : 1, cursor: phase === 'loading' ? 'not-allowed' : 'pointer' }}>← 목록</button>
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>스마트 과제 등록</h1>
        </header>
      )}

      <div style={embedded ? undefined : { flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
        {phase === 'pick' && (
          <div style={card}>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 6px' }}>평가 문항 자료를 올려 주세요</h2>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 20px', lineHeight: 1.6 }}>
              파일을 올리면 AI가 문항·모범답안·채점 기준·성취기준을 읽어 <b>바로 과제로 등록</b>합니다. 채우지 못한 항목은 등록 후 알려 드립니다.
            </p>
            {!available && (
              <div style={{ marginBottom: 16 }}>
                <IssueList issues={[{ level: 'error', field: 'AI 분석', message: 'AI 분석을 쓸 수 없는 환경입니다 (Gemini API 키 없음). 로컬 개발 환경에서만 동작합니다.' }]} />
              </div>
            )}
            <div
              role="button" tabIndex={0}
              onClick={() => available && inputRef.current?.click()}
              onKeyDown={(e) => { if (available && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); if (available) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => (available ? onDrop(e) : e.preventDefault())}
              style={{
                border: `2px dashed ${dragOver ? '#2A75F3' : '#CBD5E1'}`, background: dragOver ? '#EFF6FF' : '#F8FAFC',
                borderRadius: 12, padding: '40px 16px', textAlign: 'center', cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.5,
              }}
            >
              <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>📄</div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginTop: 10 }}>파일을 끌어다 놓거나 클릭해서 선택</div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>PDF · JPG · PNG · 최대 {MAX_FILE_MB}MB · PDF는 앞 {MAX_PAGES}쪽까지 분석</div>
            </div>
            <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={onPick} style={{ display: 'none' }} />
            <div style={{ marginTop: 20, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 800, color: '#475569', marginBottom: 2 }}>파일에서 채우는 항목</div>
              과제명 · 학교급/학년 · 교과/과목 · 핵심평가영역 · 성취기준 · 지문 · 문항(발문·조건) · 모범답안(그림 포함) · 자율 평가 기준표
              <div style={{ fontWeight: 800, color: '#475569', margin: '8px 0 2px' }}>만들 수 없는 항목</div>
              AI 평가 기준표(자동) — 서버에 등록된 기준표가 필요해 자율 평가 기준표로 대신 만듭니다.
              <div style={{ fontWeight: 800, color: '#475569', margin: '8px 0 2px' }}>결과</div>
              프로토 과제 목록에 바로 등록 · 상용 「JSON 가져오기」용 JSON 파일 내려받기
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div style={card}>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: '0 0 4px' }}>과제를 만들고 있습니다</h2>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 20px' }}>{file?.name} · 보통 10~30초 걸립니다. 창을 닫지 마세요.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STEPS.map((s, i) => {
                const state = i < stepIdx ? 'done' : i === stepIdx ? 'now' : 'todo';
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--neo-font-size-sm)', fontWeight: state === 'now' ? 800 : 600, color: state === 'todo' ? '#94A3B8' : '#1E293B' }}>
                    <span style={{ width: 22, textAlign: 'center' }}>
                      {state === 'done' ? '✅' : state === 'now' ? <span className="fg-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #BFDBFE', borderTopColor: '#2A75F3', borderRadius: '50%' }} /> : '○'}
                    </span>
                    {s.label}
                  </div>
                );
              })}
            </div>
            <style>{'@keyframes fgSpin{to{transform:rotate(360deg)}}.fg-spin{animation:fgSpin .8s linear infinite}'}</style>
          </div>
        )}

        {phase === 'done' && result && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: '1.6rem' }}>✅</span>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0 }}>과제를 등록했습니다</h2>
            </div>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 18px' }}>「작성중」 상태로 과제 목록 맨 위에 추가했습니다. 아래 항목을 확인한 뒤 배포해 주세요. 상용에 등록하려면 [JSON 내려받기]로 받은 파일을 「JSON 가져오기」에 올리면 됩니다.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, padding: 14, background: '#F8FAFC', borderRadius: 10, marginBottom: 20, fontSize: 'var(--neo-font-size-sm)' }}>
              {[
                ['과제명', result.task.title],
                ['학교급·학년', result.task.schoolLevel || '-'],
                ['교과·과목', [result.task.subject, result.task.subSubject].filter(Boolean).join(' · ') || '-'],
                ['문항 · 총 배점', `${result.task.questions}개 · ${result.task.points}점`],
                ['성취기준', (result.task.detail.meta.standards.map((s) => s.code).join(', ')) || '-'],
                ['교과 역량', result.task.competencies || '-'],
              ].map(([k, v]) => (
                <div key={k} style={{ minWidth: 0 }}>
                  <span style={{ color: '#64748B', fontWeight: 700, marginRight: 6 }}>{k}</span>
                  <span style={{ color: '#1E293B', fontWeight: 800, wordBreak: 'keep-all' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E293B', marginBottom: 10 }}>
              부족한 항목 <span style={{ color: '#64748B', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>{result.issues.filter((i) => i.level !== 'info').length}건 확인 필요 · 참고 {result.issues.filter((i) => i.level === 'info').length}건</span>
            </div>
            <IssueList issues={result.issues} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22, flexWrap: 'wrap' }}>
              <button onClick={reset} style={btn(false)}>다른 파일로 생성</button>
              <button onClick={() => downloadAssignmentJson(result.draft)} style={btn(false)} title="상용 아이글 과제 생성의 「JSON 가져오기」에 올리는 파일">⬇️ JSON 내려받기</button>
              {onEditTask && <button onClick={() => onEditTask(result.task)} style={btn(false)} title="지문·문항·채점 기준·모범답안(그림 범위 포함)을 고칩니다">✏️ 직접 입력 2에서 수정</button>}
              <button onClick={onBack} style={btn(true)}>과제 목록으로</button>
            </div>
          </div>
        )}

        {phase === 'error' && error && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: '1.6rem' }}>❌</span>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0 }}>과제를 만들지 못했습니다</h2>
            </div>
            <IssueList issues={[{ level: 'error', field: file?.name || '파일', message: error.message }]} />
            {error.hint && <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', margin: '12px 0 0', lineHeight: 1.6 }}>{error.hint}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22, flexWrap: 'wrap' }}>
              <button onClick={reset} style={btn(false)}>다른 파일 선택</button>
              {file && !['FILE_TYPE', 'FILE_SIZE', 'NO_KEY'].includes(error.code) && <button onClick={() => run(file)} style={btn(true)}>다시 시도</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskFileGenerate;
