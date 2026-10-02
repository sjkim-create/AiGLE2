/**
 * UnsavedLeaveModal — 과제 등록 중 저장하지 않고 벗어날 때의 경고 (TSK-12·TSK-13 v3.88~)
 *
 * 마지막 저장(자동 저장 포함 — v3.89) 이후 입력한 내용은 벗어나면 사라진다.
 * 헤더 [나가기] · 사이드바/상단바 메뉴 이동 · 뒤로가기 모두 이 모달을 쓴다.
 *   canSave=false → 현재 단계 필수 항목이 비어 지금은 저장할 수 없음을 함께 알린다
 */
import React, { useEffect } from 'react';

const UnsavedLeaveModal = ({ open, canSave = false, onStay, onLeave }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onStay?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onStay]);

  if (!open) return null;
  return (
    <div onClick={onStay} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="unsaved-leave-title" onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 14, padding: '22px 24px', width: 460, maxWidth: '94vw', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <h3 id="unsaved-leave-title" style={{ margin: '0 0 10px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>⚠️ 저장하지 않고 나가시겠습니까?</h3>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, marginBottom: 18 }}>
          {canSave ? (
            <>지금 나가면 <strong style={{ color: '#DC2626' }}>저장하지 않은 내용이 모두 사라지며</strong> 되돌릴 수 없습니다.</>
          ) : (
            <>
              <strong>현재 단계의 필수 항목</strong>이 입력되지 않아 지금은 저장할 수 없습니다.<br />
              지금 나가면 <strong style={{ color: '#DC2626' }}>저장하지 않은 내용이 모두 사라지며</strong> 되돌릴 수 없습니다.
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" autoFocus onClick={onStay}
            style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>계속 작성</button>
          <button type="button" onClick={onLeave}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#EF4444', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>나가기</button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedLeaveModal;
