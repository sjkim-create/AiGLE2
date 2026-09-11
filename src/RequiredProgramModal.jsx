/**
 * RequiredProgramModal.jsx
 * [POP-30] AiGLE 필수 프로그램 확인
 *
 * 목적: 화면이 동작하려면 로컬 PC에 깔려 있고 **실행 중이어야 하는** 프로그램을
 *       한자리에서 확인하고, 그 자리에서 다운로드하거나 실행하게 한다.
 *
 * 다루는 프로그램
 *   · AiGLE Connect       — USB·블루투스 펜 연결 · 크래들 일괄 채점 · 백그라운드 자동 실행
 *   · Ncode Print Doctor  — N-code 인쇄 최적 상태 지원 · 프린터 인쇄 적합성 진단
 *
 * ─────────────────────────────────────────────────────────────────────────
 * [POP-30 v1.0] 「설치」와 「실행」을 한 흐름으로 다루는 이유
 *
 *   교사가 겪는 실패는 두 가지인데 증상이 똑같다 — 펜이 안 잡힌다.
 *     ① 프로그램이 아예 없다        → 다운로드해야 한다
 *     ② 깔려 있는데 꺼져 있다        → 실행하면 된다
 *   舊 안내는 ①만 말해서(「설치되어 있지 않습니다」 + 다운로드 버튼), 이미 깔려 있는데
 *   꺼진 ② 상황에서 교사가 다시 설치 파일을 받는 헛수고를 했다.
 *   그래서 [설치 확인]으로 **먼저 상태를 판별**하고, 판별 결과에 맞는 행동
 *   하나만([다운로드] 또는 [실행]) 내놓는다.
 *
 * [POP-30 v1.0] 이 화면에 필요 없는 프로그램도 목록에 남기는 이유
 *   교사에게 「AiGLE 필수 프로그램」은 한 덩어리다. 목록에서 빼면 그 프로그램이
 *   문제인지 아닌지를 다른 데서 다시 찾아야 한다. 대신 **필요 없는 항목은 흐리게** 두고
 *   조작을 막아, 지금 무엇을 해결해야 하는지가 한눈에 남게 한다.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* 프로그램 상태
 *   unknown          아직 확인하지 않음          → [설치 확인]
 *   checking         확인 중
 *   not_installed    설치되어 있지 않음          → [다운로드]
 *   downloading      다운로드·설치 진행 중
 *   stopped          설치됨 · 실행 전 (경유 상태 — [POP-30 v1.2] 화면에 머물지 않고 곧바로 실행으로 넘어간다)
 *   starting         실행 중… ([설치 확인] 또는 다운로드 완료 직후 자동 진입 — 별도 [실행] 버튼 없음)
 *   start_failed     실행 요청했으나 응답 없음    → [다시 실행] + 수동 실행 안내
 *   running          실행 중                     → 조작 없음
 */
const STATE_TEXT = {
  unknown: { label: '', color: '#8A94A1' },
  checking: { label: '확인하는 중…', color: '#4E5968' },
  not_installed: { label: '설치되어 있지 않습니다', color: '#DC2626' },
  downloading: { label: '다운로드하는 중…', color: '#1D4ED8' },
  stopped: { label: '설치 확인됨 · 실행 중…', color: '#1D4ED8' },
  starting: { label: '실행 중…', color: '#1D4ED8' },
  start_failed: { label: '실행되지 않았습니다', color: '#DC2626' },
  running: { label: '● 실행 중', color: '#059669' },
};

/* [POP-30 v1.0] AiGLE Connect 다운로드 기록
 *
 *   브라우저는 로컬 프로그램의 **설치 여부를 알 수 없다**. 알 수 있는 건 그 프로그램이
 *   로컬 포트를 열고 **실행 중인지**뿐이다. 그래서 연결이 안 될 때 「안 깔렸다」와
 *   「깔렸는데 꺼졌다」를 구분할 방법이 없다.
 *   차선책으로 **이 브라우저에서 다운로드한 적이 있는지**를 기억해 추정한다.
 *   [TSK-05] Ncode Print Doctor가 쓰는 방식과 같다. 추정이 틀릴 수 있으므로
 *   두 상태 모두 반대쪽으로 건너갈 수 있는 보조 링크를 함께 노출한다.
 */
export const CONNECT_DOWNLOAD_KEY = 'aigleConnect:downloaded';
export const isConnectDownloaded = () => {
  try { return localStorage.getItem(CONNECT_DOWNLOAD_KEY) === 'true'; } catch (_) { return false; }
};
export const markConnectDownloaded = () => {
  try { localStorage.setItem(CONNECT_DOWNLOAD_KEY, 'true'); } catch (_) { /* 사용 불가 환경 무시 */ }
};

const RequiredProgramModal = ({
  open,
  onClose,
  /** [{ key, name, desc, required, installed }] — `required:false`는 흐리게 표시되고 조작할 수 없다 */
  programs = [],
  /** 필수 프로그램이 모두 `running`이 됐을 때 1회 호출 */
  onAllReady,
  /** 개별 프로그램이 설치 완료됐을 때 호출 — 상위에서 설치 여부를 기억해 둘 때 쓴다 */
  onInstalled,
  /* 아래 3개는 **실제 환경 연동용 훅**이다. 주지 않으면 목 시나리오로 동작한다.
   *   onCheck(key)    → 'running' | 'stopped' | 'not_installed'
   *   onDownload(key) → 다운로드/설치 트리거. resolve 되면 `stopped`로 넘어간다
   *   onStart(key)    → 실행 요청 후 실제로 떴는지 boolean */
  onCheck, onDownload, onStart,
  title = 'AiGLE 필수 프로그램 확인',
}) => {
  const [states, setStates] = useState({});
  const [progress, setProgress] = useState({});

  // 모달을 열 때마다 상태를 초기화한다 (실행 상태는 상위가 기억하므로 여기선 매번 다시 확인)
  useEffect(() => {
    if (!open) return;
    const init = {};
    programs.forEach((p) => { init[p.key] = 'unknown'; });
    setStates(init);
    setProgress({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const requiredKeys = programs.filter((p) => p.required !== false).map((p) => p.key);
  const allReady = requiredKeys.length > 0 && requiredKeys.every((k) => states[k] === 'running');

  useEffect(() => {
    if (allReady) onAllReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady]);

  if (!open) return null;

  const setState = (key, v) => setStates((prev) => ({ ...prev, [key]: v }));

  /** [실행] — 백그라운드로 올라오면 `running`. 실제 환경에서는 뜨지 않을 수 있다 */
  const startProgram = async (p) => {
    setState(p.key, 'starting');
    if (onStart) {
      const ok = await onStart(p.key);
      setState(p.key, ok ? 'running' : 'start_failed');
      return;
    }
    setTimeout(() => setState(p.key, 'running'), 900);
  };

  /* [설치 확인] — 설치 여부를 가린 뒤, 설치돼 있으면 **곧바로 실행**한다.
   * [POP-30 v1.2] 舊 「설치 완료 → [실행]」 2단계를 없앴다. 교사가 보는 흐름은
   *   [설치 확인] → 실행 중… → 준비 완료  하나뿐이고, 설치가 안 됐을 때만 [다운로드]가 끼어든다. */
  const checkProgram = async (p) => {
    setState(p.key, 'checking');
    if (onCheck) {
      const r = await onCheck(p.key);
      if (r === 'running') setState(p.key, 'running');
      else if (r === 'stopped') startProgram(p);
      else setState(p.key, 'not_installed');
      return;
    }
    setTimeout(() => (p.installed ? startProgram(p) : setState(p.key, 'not_installed')), 900);
  };

  /** [다운로드] — 완료되면 「설치됨 · 꺼짐」으로 이어져 곧바로 [실행]을 누를 수 있다 */
  const downloadProgram = async (p) => {
    setState(p.key, 'downloading');
    setProgress((prev) => ({ ...prev, [p.key]: 0 }));
    if (onDownload) {
      // 실제 다운로드는 진행률을 알 수 없으므로 화면만 진행 중으로 두고 완료를 기다린다
      await onDownload(p.key);
      onInstalled?.(p.key);
      startProgram(p);
      return;
    }
    let v = 0;
    const iv = setInterval(() => {
      v += 10;
      setProgress((prev) => ({ ...prev, [p.key]: v }));
      if (v >= 100) {
        clearInterval(iv);
        onInstalled?.(p.key);
        startProgram(p);
      }
    }, 120);
  };

  /* 안내 문구 — 지금 무엇이 문제인지에 따라 갈린다 */
  const anyMissing = requiredKeys.some((k) => states[k] === 'not_installed');
  const anyStartFailed = requiredKeys.some((k) => states[k] === 'start_failed');
  const anyStarting = requiredKeys.some((k) => ['stopped', 'starting'].includes(states[k]));
  const headline = allReady
    ? '필수 프로그램이 모두 실행 중이에요.'
    : anyStartFailed
      ? '프로그램이 켜지지 않았어요. 직접 실행한 뒤 다시 확인해주세요.'
      : anyMissing
        ? '필수 프로그램이 설치되어 있지 않아요. 확인해주세요.'
        : anyStarting
          ? '설치가 확인되어 프로그램을 실행하고 있어요.'
          : '필수 프로그램이 실행 중인지 확인해주세요.';
  const okTone = allReady;

  const linkBtn = {
    marginLeft: 6, padding: 0, border: 'none', background: 'none', color: '#2A75F3',
    fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700,
    textDecoration: 'underline', cursor: 'pointer',
  };

  const actionBtn = (label, onClick, { disabled = false, primary = false } = {}) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 150, padding: '12px 20px', borderRadius: 8, fontFamily: 'inherit',
        fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        border: primary ? 'none' : `1px solid ${disabled ? '#E5E7EB' : '#D5DAE0'}`,
        background: primary ? (disabled ? '#CBD5E1' : '#2A75F3') : (disabled ? '#F8FAFC' : 'white'),
        color: primary ? 'white' : (disabled ? '#C3C9D0' : '#1E2225'),
      }}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      onClick={(e) => { e.stopPropagation(); onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        style={{ background: 'white', borderRadius: 12, width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px 28px 28px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)', position: 'relative' }}
      >
        {/* 헤더 */}
        <button
          onClick={() => onClose?.()}
          aria-label="닫기"
          style={{ position: 'absolute', top: 16, right: 18, width: 28, height: 28, borderRadius: 6, border: '1px solid #1E2225', background: 'white', color: '#1E2225', fontSize: 'var(--neo-font-size-base)', lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}
        >✕</button>
        <h2 style={{ margin: '4px 0 24px', textAlign: 'center', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>{title}</h2>

        {/* 상태 아이콘 + 안내 */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            aria-hidden="true"
            style={{
              width: 52, height: 52, margin: '0 auto 14px', borderRadius: '50%',
              border: `2px solid ${okTone ? '#10B981' : '#5BC0DE'}`, color: okTone ? '#10B981' : '#5BC0DE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 700, fontStyle: okTone ? 'normal' : 'italic',
            }}
          >{okTone ? '✓' : 'i'}</div>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>{headline}</div>
        </div>

        {/* 프로그램 목록 */}
        <div style={{ background: '#F7F9FC', border: '1px solid #E5EAF0', borderRadius: 10, padding: 6, marginBottom: 24 }}>
          {programs.map((p) => {
            const st = states[p.key] || 'unknown';
            const disabled = p.required === false;
            const t = STATE_TEXT[st];
            return (
              <div
                key={p.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 8,
                  background: disabled ? 'transparent' : st === 'running' ? '#F0FDF4' : '#EDF3FB',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: disabled ? '#8A94A1' : '#1E2225' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: disabled ? '#A9B0B8' : '#4E5968', marginTop: 3 }}>{p.desc}</div>
                  {!disabled && t.label && (
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: t.color, fontWeight: 700, marginTop: 6 }}>{t.label}</div>
                  )}
                  {st === 'downloading' && (
                    <div style={{ marginTop: 6, width: '100%', maxWidth: 260, height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${progress[p.key] || 0}%`, height: '100%', background: '#2A75F3', transition: 'width 0.15s' }} />
                    </div>
                  )}
                  {/* [POP-30 v1.0] 설치/실행 추정이 틀렸을 때 빠져나갈 길.
                      브라우저는 둘을 확실히 가릴 수 없으므로 반대쪽으로 건너가는 링크를 항상 둔다. */}
                  {!disabled && st === 'not_installed' && (
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', marginTop: 4 }}>
                      다운로드하면 설치까지 자동으로 진행됩니다 (약 100MB).
                      <button onClick={() => startProgram(p)} style={linkBtn}>이미 설치했어요</button>
                    </div>
                  )}
                  {!disabled && st === 'start_failed' && (
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', marginTop: 4, lineHeight: 1.7 }}>
                      브라우저가 프로그램을 직접 켜지 못했습니다. <strong>바탕화면·작업 표시줄에서 {p.name}을 실행</strong>한 뒤
                      [다시 실행]을 눌러 주세요.
                      <button onClick={() => setState(p.key, 'not_installed')} style={linkBtn}>설치가 안 되어 있나요?</button>
                    </div>
                  )}
                </div>

                <div style={{ flexShrink: 0 }}>
                  {disabled && actionBtn('설치 확인', undefined, { disabled: true })}
                  {!disabled && st === 'unknown' && actionBtn('설치 확인', () => checkProgram(p))}
                  {!disabled && st === 'checking' && actionBtn('확인 중…', undefined, { disabled: true })}
                  {!disabled && st === 'not_installed' && actionBtn('다운로드', () => downloadProgram(p), { primary: true })}
                  {!disabled && st === 'downloading' && actionBtn(`${progress[p.key] || 0}%`, undefined, { disabled: true, primary: true })}
                  {!disabled && (st === 'stopped' || st === 'starting') && actionBtn('실행 중…', undefined, { disabled: true, primary: true })}
                  {!disabled && st === 'start_failed' && actionBtn('다시 실행', () => startProgram(p), { primary: true })}
                  {!disabled && st === 'running' && (
                    <span style={{ display: 'inline-block', minWidth: 150, textAlign: 'center', padding: '12px 20px', fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#059669' }}>준비 완료</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onClose?.()}
            style={{
              minWidth: 150, padding: '12px 28px', borderRadius: 8, fontFamily: 'inherit',
              fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer',
              border: allReady ? 'none' : '1px solid #D5DAE0',
              background: allReady ? '#2A75F3' : 'white',
              color: allReady ? 'white' : '#1E2225',
            }}
          >{allReady ? '확인' : '닫기'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequiredProgramModal;
