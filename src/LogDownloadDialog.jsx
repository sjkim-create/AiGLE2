/**
 * LogDownloadDialog.jsx
 * [SET-01 · SCR-07] 진단 로그 다운로드 — 날짜 선택
 *
 * 환경설정 카드와 크래들 모달 ⋯ 메뉴가 같은 다이얼로그를 띄운다.
 * 선택지는 「전체 기간」 + 로그가 남아 있는 날짜(최신 순). 고르고 [다운로드]를 누르면 그 범위만 파일로 내려받는다.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { availableDates } from './appLogger';

const LogDownloadDialog = ({ open, onClose, onDownload }) => {
  const [date, setDate] = useState('');
  const [dates, setDates] = useState([]);
  useEffect(() => { if (open) { setDates(availableDates()); setDate(''); } }, [open]);
  if (!open) return null;
  return createPortal(
    <div onClick={(e) => { e.stopPropagation(); onClose?.(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="로그 다운로드"
        style={{ background: 'white', borderRadius: 14, width: 380, maxWidth: '94vw', padding: '22px 24px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)' }}>
        <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', textAlign: 'center', marginBottom: 14 }}>다운로드할 날짜를 선택하세요.</div>
        <select value={date} onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D5DAE0', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', color: '#1E2225', background: 'white' }}>
          <option value="">전체 기간</option>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', marginTop: 8, lineHeight: 1.6 }}>
          날짜를 골라 진단 로그를 내려받습니다.<br />다운받은 파일을 고객센터에 전달해주세요.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D5DAE0', background: 'white', color: '#1E2225', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button type="button" onClick={() => onDownload?.(date || null)}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>⬇ 다운로드</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LogDownloadDialog;
