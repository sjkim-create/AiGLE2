/**
 * ResetConfirmModal
 * 기기(펜) 초기화 확인 모달 화면입니다.
 * 환경설정에서 호출되며, 다수의 펜 데이터를 일괄 삭제(초기화)하기 전 사용자에게 경고하고 확인을 받습니다.
 */
import React from 'react';

const ResetConfirmModal = ({ isOpen, onClose, penCount }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10002 }}>
      <div className="modal-container" style={{ width: '440px', height: 'auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, marginBottom: '1rem' }}>펜 데이터 초기화 확인</h3>
        <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#4E5968', lineHeight: '1.6', marginBottom: '2rem' }}>
          현재 <strong style={{ color: 'var(--primary)' }}>{penCount}개</strong>의 펜이 연결되어 있습니다.<br />
          연결된 펜의 모든 데이터를 초기화하시겠습니까?<br />
          <span style={{ color: '#EF4444', fontWeight: 700 }}>초기화 후 삭제된 데이터는 되돌릴 수 없습니다.</span>
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn-card-detail" 
            style={{ flex: 1, padding: '0.8rem' }}
            onClick={onClose}
          >
            취소
          </button>
          <button 
            className="btn-primary" 
            style={{ flex: 1, padding: '0.8rem', background: '#EF4444' }}
            onClick={() => {
              alert('모든 펜의 데이터가 초기화되었습니다.');
              onClose();
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetConfirmModal;
