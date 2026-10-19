/**
 * DontGetIt.jsx — 학생 결과 확인(TSK-10) 「모르겠어요」 (Tecet 역기획 차용)
 *
 * 단계 · 줄마다가 아니라 설명 묶음에 하나 — 채점 결과는 문항마다(학습 피드백 · 학습 안내 아래), 풀이 과정 보기는 풀이 단계 목록 아래
 *   · 누르면 AI가 받은 설명 전체를 학년 눈높이로 처음부터 다시 정리한다(글자가 바로바로 채워진다)
 *   · 이어서 물어볼 수 있다 — 최대 MAX_FOLLOWUPS번. 넘으면 선생님께 여쭤보도록 안내
 *   · 등급 · 점수는 바뀌지 않는다. 답은 학생 화면 언어로
 * 상용 반영 시 정할 것 — 질문 · 답변 기록을 교사가 볼지, 하루 질문 수 제한, 부적절한 질문 처리
 */
import React, { useEffect, useRef, useState } from 'react';
import { askTutor, firstAskOf, MAX_FOLLOWUPS } from './lib/tutorAI';
import { uiOf } from './lib/i18n';

const UI = {
  ko: {
    btn: '모르겠어요', title: '처음부터 다시 정리', close: '닫기', writing: '설명을 쓰고 있어요…', me: '나',
    placeholder: '더 궁금한 걸 물어보세요', send: '보내기', left: (n) => `남은 질문 ${n}번`,
    quick: ['예를 들어 주세요', '더 쉽게 말해 주세요', '어디가 틀렸는지 다시 짚어 주세요'],
    done: '더 궁금한 점은 선생님께 여쭤보세요.', fail: '설명을 만들지 못했어요. 잠시 후 다시 시도해 주세요.', retry: '다시 시도',
    sample: '샘플', note: 'AI 설명은 틀릴 수 있어요. 등급과 점수는 바뀌지 않아요.',
  },
  en: {
    btn: "I don't get it", title: 'Going over it again', close: 'Close', writing: 'Writing an explanation…', me: 'Me',
    placeholder: 'Ask a follow-up question', send: 'Send', left: (n) => `${n} question${n === 1 ? '' : 's'} left`,
    quick: ['Give me an example', 'Say it more simply', 'Show me where I went wrong'],
    done: 'For more questions, please ask your teacher.', fail: "Couldn't write an explanation. Please try again in a moment.", retry: 'Try again',
    sample: 'Sample', note: "AI explanations can be wrong. Your grade and score won't change.",
  },
};

/* 답에 섞여 오는 마크다운 기호(코드 따옴표 · 굵게)는 지운다 — 학생 화면은 평범한 문장 */
const plain = (t) => (t || '').replace(/`|\*\*/g, '').replace(/\n{3,}/g, '\n\n');

const DontGetIt = ({ ctx, lang = 'ko', level, onClose }) => {
  const U = uiOf(UI, lang);
  /* msgs: { role: 'user'|'model', text, first? } — first = 처음 「모르겠어요」(화면에는 버튼 이름으로) */
  const [msgs, setMsgs] = useState([{ role: 'user', text: firstAskOf(lang), first: true }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [sample, setSample] = useState(false);
  const [input, setInput] = useState('');
  const abort = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const asked = msgs.filter((m) => m.role === 'user' && !m.first).length;
  const left = MAX_FOLLOWUPS - asked;

  const run = async (history) => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setErr(false);
    setMsgs([...history, { role: 'model', text: '', writing: true }]);
    const put = (text, writing) => setMsgs((m) => [...m.slice(0, -1), { role: 'model', text, writing }]);
    try {
      const r = await askTutor({ ctx, level, lang, history, signal: ac.signal, onText: (t) => put(t, true) });
      if (ac.signal.aborted) return;
      put(r.text, false);
      setSample(r.sample);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    } catch {
      if (ac.signal.aborted) return;
      setMsgs(history);
      setErr(true);
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  };

  /* 처음 열면 바로 다시 설명 */
  useEffect(() => {
    run(msgs);
    return () => abort.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs]);

  const ask = (text) => {
    const q = text.trim();
    if (!q || busy || left <= 0) return;
    setInput('');
    run([...msgs.filter((m) => !m.writing), { role: 'user', text: q }]);
  };

  return (
    <div className="dg-box" role="region" aria-label={U.title} lang={lang}>
      <style>{CSS}</style>
      <div className="dg-head">
        <b>{U.title}</b>
        {sample && <span className="dg-tag">{U.sample}</span>}
        <button type="button" className="dg-x" aria-label={U.close} onClick={onClose}>✕</button>
      </div>
      <div className="dg-list" ref={listRef} aria-live="polite">
        {msgs.map((m, i) => (m.role === 'user'
          ? <div key={i} className="dg-me"><span>{m.first ? U.btn : m.text}</span></div>
          : <div key={i} className="dg-ai">{plain(m.text) || (m.writing ? <span className="dg-wait">{U.writing}</span> : '')}{m.writing && m.text && <span className="dg-caret" aria-hidden="true" />}</div>))}
        {err && <div className="dg-err">{U.fail} <button type="button" onClick={() => run(msgs)}>{U.retry}</button></div>}
      </div>
      {left > 0 ? (
        <>
          <div className="dg-quick">
            {U.quick.map((t) => <button key={t} type="button" disabled={busy} onClick={() => ask(t)}>{t}</button>)}
          </div>
          <form className="dg-form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input ref={inputRef} value={input} maxLength={200} placeholder={U.placeholder} aria-label={U.placeholder} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()}>{U.send}</button>
          </form>
          <div className="dg-foot"><span>{U.left(left)}</span><span>{U.note}</span></div>
        </>
      ) : (
        <div className="dg-foot end"><span>{U.done}</span><span>{U.note}</span></div>
      )}
    </div>
  );
};

/* 설명 아래 작은 버튼 */
DontGetIt.Button = ({ lang = 'ko', onClick }) => (
  <button type="button" className="dg-btn" onClick={onClick}>
    <style>{BTN_CSS}</style>
    <span className="dg-btn-ico" aria-hidden="true">?</span>{uiOf(UI, lang).btn}
  </button>
);

const BTN_CSS = `
.dg-btn{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 10px 4px 6px;border:1px solid #C7D2FE;border-radius:999px;background:#fff;color:#3730A3;font-size:var(--neo-font-size-xs);font-weight:600;cursor:pointer;line-height:1.4}
.dg-btn:hover{background:#EEF2FF}
.dg-btn:focus-visible{outline:2px solid #4F46E5;outline-offset:2px}
.dg-btn-ico{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#4F46E5;color:#fff;font-size:var(--neo-font-size-xs);font-weight:700}
`;

const CSS = `
.dg-box{margin-top:10px;border:1px solid #C7D2FE;border-radius:12px;background:#F8FAFF;overflow:hidden;text-align:left}
.dg-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #E0E7FF;font-size:var(--neo-font-size-sm);color:#1E1B4B}
.dg-tag{font-size:var(--neo-font-size-xs);padding:1px 6px;border-radius:4px;background:#FEF3C7;color:#92400E;font-weight:600}
.dg-x{margin-left:auto;border:0;background:none;color:#64748B;font-size:var(--neo-font-size-sm);cursor:pointer;padding:2px 4px}
.dg-list{max-height:280px;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.dg-me{display:flex;justify-content:flex-end}
.dg-me span{max-width:85%;padding:6px 10px;border-radius:12px 12px 2px 12px;background:#4F46E5;color:#fff;font-size:var(--neo-font-size-sm);line-height:1.5}
.dg-ai{max-width:92%;padding:8px 12px;border-radius:12px 12px 12px 2px;background:#fff;border:1px solid #E0E7FF;color:#1E293B;font-size:var(--neo-font-size-sm);line-height:1.6;white-space:pre-wrap}
.dg-wait{color:#64748B}
.dg-caret{display:inline-block;width:2px;height:14px;margin-left:2px;vertical-align:-2px;background:#4F46E5;animation:dg-blink 1s steps(2) infinite}
@keyframes dg-blink{50%{opacity:0}}
.dg-err{font-size:var(--neo-font-size-xs);color:#B91C1C}
.dg-err button{margin-left:6px;border:1px solid #FCA5A5;background:#fff;color:#B91C1C;border-radius:6px;font-size:var(--neo-font-size-xs);padding:2px 8px;cursor:pointer}
.dg-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
.dg-quick button{border:1px solid #E0E7FF;background:#fff;color:#3730A3;border-radius:999px;font-size:var(--neo-font-size-xs);padding:3px 10px;cursor:pointer}
.dg-quick button:disabled{opacity:.5;cursor:default}
.dg-form{display:flex;gap:6px;padding:0 12px 8px}
.dg-form input{flex:1;min-width:0;border:1px solid #CBD5E1;border-radius:8px;padding:6px 10px;font-size:var(--neo-font-size-sm);background:#fff}
.dg-form input:focus{outline:2px solid #A5B4FC;border-color:#6366F1}
.dg-form button{border:0;border-radius:8px;background:#4F46E5;color:#fff;font-size:var(--neo-font-size-sm);font-weight:600;padding:6px 12px;cursor:pointer}
.dg-form button:disabled{background:#A5B4FC;cursor:default}
.dg-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding:6px 12px 8px;font-size:var(--neo-font-size-xs);color:#64748B;border-top:1px solid #E0E7FF}
.dg-foot.end span:first-child{color:#3730A3;font-weight:600}
`;

export default DontGetIt;
