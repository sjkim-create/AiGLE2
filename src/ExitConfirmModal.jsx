/**
 * ExitConfirmModal
 * 채점 관리 페이지 종료(이탈) 확인 모달 화면입니다.
 * 백그라운드 AI 채점이 멈추지 않음을 고지하며, 유저가 페이지를 닫거나 백그라운드 태스크로 전환할 때 사용됩니다.
 */
import React from 'react';

const ExitConfirmModal = ({ isOpen, onClose, onProceed }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="modal-container" style={{ width: '480px', height: 'auto', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}>
          <div style={{ background: '#991B1B', color: 'white', width: '24px', height: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, position: 'absolute', top: '-10px', left: '-25px' }}>7</div>
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%231E2225' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'%3E%3C/path%3E%3Cpolyline points='16 17 21 12 16 7'%3E%3C/polyline%3E%3Cline x1='21' y1='12' x2='9' y2='12'%3E%3C/line%3E%3C/svg%3E" alt="Exit" style={{ width: '64px', height: '64px' }} />
        </div>
        
        <p style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 700, color: '#1E2225', lineHeight: '1.6', marginBottom: '2rem' }}>
          페이지를 벗어나도 AI 채점은 멈추지 않습니다.<br />
          20분 이내로 채점이 완료 예정입니다.
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-card-detail" 
            style={{ flex: 1, padding: '1rem', background: '#D1E3FF', color: '#1E2225', border: 'none' }}
            onClick={onClose}
          >
            계속 채점하기
          </button>
          <button 
            className="btn-primary" 
            style={{ flex: 1, padding: '1rem', background: '#EF4444' }}
            onClick={onProceed}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitConfirmModal;
