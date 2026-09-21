/**
 * PenFirmwareModal
 * 펜 펌웨어 업데이트 명단 모달 화면입니다.
 * 환경설정에서 호출되며, 연결된 펜의 배터리 및 펌웨어 최신 상태를 리스트로 확인하고 일괄 업데이트를 지원합니다.
 */
import React from 'react';

const PenFirmwareModal = ({ isOpen, onClose, penData }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10003 }}>
      <div className="modal-container" style={{ width: '800px', height: '600px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <button className="btn-modal-close" onClick={onClose}>×</button>
        <h2 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, marginBottom: '0.5rem' }}>펜 펌웨어 업데이트 명단</h2>
        <p style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-base)', marginBottom: '2rem' }}>현재 연결된 펜의 펌웨어 상태를 확인하고 일괄 업데이트를 진행할 수 있습니다.</p>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#F1F3F5', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>No.</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>펜 MAC 주소</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>배터리</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>펌웨어 버전</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {penData.map((pen, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ padding: '10px 12px', color: '#8A94A1' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#4E5968' }}>{pen.mac}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{pen.battery}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{pen.firmware}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {pen.needsUpdate ? (
                      <span style={{ color: '#FF4D4D', fontWeight: 800 }}>업데이트 필요</span>
                    ) : (
                      <span style={{ color: '#10B981', fontWeight: 700 }}>최신</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button 
            className="btn-card-detail" 
            style={{ width: '150px' }}
            onClick={onClose}
          >
            닫기
          </button>
          {penData.some(p => p.needsUpdate) && (
            <button 
              className="btn-primary" 
              style={{ background: '#FF4D4D', padding: '0.8rem 2rem' }}
              onClick={() => {
                alert('일괄 업데이트를 시작합니다.');
                onClose();
              }}
            >
              일괄 업데이트 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PenFirmwareModal;
