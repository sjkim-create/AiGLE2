/**
 * PenDataDownloadDialog.jsx
 * [SET-01 · SCR-07] 펜 데이터 다운로드 — 안내 다이얼로그
 *
 * 크래들에 연결된 펜의 오프라인 필기 데이터를 통째로 추출한다(진단·백업용).
 * 실제 추출은 AiGLE Connect가 로컬 다운로드 폴더에 펜별 파일로 저장하며,
 * 화면은 「어디에 무엇이 저장되는가」만 안내한다. 프로토타입은 안내까지만 흉내 낸다.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import appLogger from './appLogger';

export const PEN_DATA_DIR = 'DOWNLOAD\\AiGLE-PEN00\\';

const PenDataDownloadDialog = ({ open, onClose, penCount = 0 }) => {
  if (!open) return null;
  const start = () => {
    appLogger.info('penDataExport', '펜 데이터 다운로드 시작', { penCount, dir: PEN_DATA_DIR });
    onClose?.('started');
  };
  return createPortal(
    <div onClick={(e) => { e.stopPropagation(); onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="펜 데이터 다운로드"
        style={{ background: 'white', borderRadius: 14, width: 440, maxWidth: '94vw', padding: '22px 24px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)' }}>
        <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', textAlign: 'center', marginBottom: 12 }}>펜 데이터 다운로드</div>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', lineHeight: 1.7 }}>
          크래들에 연결된 펜 <strong>{penCount}자루</strong>의 필기 데이터를 추출해 아래 폴더에 펜마다 한 파일씩 저장합니다.
        </div>
        <div style={{ margin: '10px 0', padding: '10px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>
          다운로드\{PEN_DATA_DIR}<br />
          <span style={{ color: '#64748B' }}>└ PEN-001_9C7BD2….pen · PEN-002_… · … ({penCount}개)</span>
        </div>
        <ul style={{ margin: '0 0 6px', paddingLeft: 18, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.7 }}>
          <li>AiGLE Connect가 실행 중이어야 하며, 지금 크래들에 연결된 펜만 대상입니다.</li>
          <li>펜에 있는 데이터를 복사만 합니다 — 펜의 필기는 지워지지 않습니다.</li>
          <li>문제 진단이 필요하면 이 폴더를 로그 파일과 함께 고객센터에 전달해 주세요.</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={() => onClose?.()}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D5DAE0', background: 'white', color: '#1E2225', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button type="button" onClick={start} disabled={penCount === 0}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: penCount === 0 ? '#CBD5E1' : '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: penCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>⬇ 다운로드</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PenDataDownloadDialog;
