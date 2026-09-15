/**
 * TaskDeleteDialog.jsx
 * [TSK-01] 과제 삭제 확인
 *
 * 과제를 지우면 「과제 생성 → 학생 배포 → 채점」으로 이어진 일련의 데이터가 함께 사라진다.
 * 학생 정보·그룹 정보는 남는다. 무엇이 지워지고 무엇이 남는지를 눌러 보기 전에 보여 주고,
 * 배포된 과제는 학생이 이미 본 결과까지 사라진다는 점을 따로 경고한다.
 * 삭제 버튼은 「확인했습니다」 체크 뒤에만 활성화된다.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TaskDeleteDialog = ({ task, onCancel, onConfirm }) => {
  const [ack, setAck] = useState(false);
  useEffect(() => { setAck(false); }, [task]);
  if (!task) return null;
  const deployed = task.status === '배포됨';
  const li = { display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.6 };
  return createPortal(
    <div onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="과제 삭제"
        style={{ background: 'white', borderRadius: 14, width: 520, maxWidth: '94vw', padding: '22px 24px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>과제를 삭제할까요?</h3>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#4E5968', marginBottom: 14 }}>
          <strong style={{ color: '#1E2225' }}>{task.title}</strong>
          <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, background: deployed ? '#D1FAE5' : '#FEF3C7', color: deployed ? '#065F46' : '#92400E' }}>{task.status}</span>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#991B1B', marginBottom: 6 }}>함께 삭제되는 것</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--neo-font-size-sm)', color: '#7F1D1D' }}>
            <div style={li}><span>✕</span><span>과제 정보 — 문항 · 모범답안 · 채점 기준</span></div>
            <div style={li}><span>✕</span><span>학생 배포 정보 — 그룹 연결, 답안지·번호표 북코드 <span style={{ color: '#B45309' }}>(출력해 둔 답안지·번호표는 더 쓸 수 없습니다)</span></span></div>
            <div style={li}><span>✕</span><span>학생 제출 답안 — 펜 필기 · 스캔본</span></div>
            <div style={li}><span>✕</span><span>채점 이력 — AI 채점 결과 · 교사 채점 · 피드백 · 퇴고(2차) 이력</span></div>
            <div style={li}><span>✕</span><span>결과 발송 이력 {deployed && <strong>— 학생에게 이미 발송된 결과도 사라져 학생 화면에서 보이지 않게 됩니다</strong>}</span></div>
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#166534', marginBottom: 4 }}>유지되는 것</div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#166534', lineHeight: 1.6 }}>학생 정보 · 그룹 정보 · 사용한 AI 토큰 기록(사용량 통계에는 「삭제된 과제」로 남습니다)</div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          위 내용을 확인했으며, 삭제 후 되돌릴 수 없음을 이해합니다.
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D5DAE0', background: 'white', color: '#1E2225', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button type="button" disabled={!ack} onClick={() => onConfirm?.(task)}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: ack ? '#DC2626' : '#CBD5E1', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: ack ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>과제 삭제</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TaskDeleteDialog;
