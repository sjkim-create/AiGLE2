/**
 * WorksheetPreviewModal.jsx
 * [TSK-05 v4.0] 답안지 미리보기 — 상용 화면 기준으로 재구성
 *   진입: 과제 등록 Step 「그룹 배포·출력」의 [답안지 출력]
 *   구성: 제목 `답안지 미리보기 - [{교과}] {과제명}`
 *     · 좌: A4 미리보기 (페이지 배지 `1/N`)
 *     · 우: 프린터명 · 그룹 · **답안지 종류** · 매수(배포할 학생 수 — 읽기 전용)
 *     · 하단: [PDF 다운받기] [🖨 인쇄하기]
 *   [v4.0] 답안지 종류 3종 — 舊 「선 있는 / 선 없는」 상단 탭 폐기
 *     · 선 있는 답안 (1.4cm) — 기존 줄 간격
 *     · 선 있는 답안 (1cm)  — 신규. 한 장에 더 많은 줄
 *     · 선 없는 답안
 *   인쇄는 Ncode Print Doctor 설치 시에만 가능(미설치면 안내 모달). PDF 다운받기는 드라이버 없이 가능.
 *   Print Doctor 설치 여부: localStorage['ncodePrintDoctor:downloaded']
 */
import React, { useState, useMemo } from 'react';

const isPrintDoctorInstalled = () => {
  try {
    return localStorage.getItem('ncodePrintDoctor:downloaded') === 'true';
  } catch (_) {
    return false;
  }
};

// [v3.2] Print Doctor 다이렉트 다운로드 (환경설정 이동 없이 안내 모달에서 즉시 실행)
const downloadPrintDoctorMock = () => new Promise((resolve) => {
  setTimeout(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    try {
      localStorage.setItem('ncodePrintDoctor:downloaded', 'true');
      localStorage.setItem('ncodePrintDoctor:version', '1.0.3');
      localStorage.setItem('ncodePrintDoctor:downloadedAt', stamp);
    } catch (_) { /* localStorage 사용 불가 환경 무시 */ }
    resolve({ version: '1.0.3', downloadedAt: stamp });
  }, 1200);
});

/* [v4.0] 답안지 종류 — 줄 높이(cm)가 곧 종류다. 미리보기는 1.4cm = 24px 기준으로 비례 환산한다 */
export const SHEET_TYPES = [
  { key: 'line14', label: '선 있는 답안', cm: 1.4 },
  { key: 'line10', label: '선 있는 답안', cm: 1.0 },
  { key: 'blank', label: '선 없는 답안', cm: null },
];
const PX_PER_CM = 24 / 1.4;           // 미리보기 축척
const ANSWER_AREA_PX = 460;           // 답안 영역 높이(미리보기)
export const sheetTypeLabel = (key) => {
  const t = SHEET_TYPES.find((x) => x.key === key) || SHEET_TYPES[0];
  return t.cm ? `${t.label} (${t.cm}cm)` : t.label;
};

const WorksheetPreviewModal = ({
  open, onClose, schoolName = '공주 고등학교', subject = '국어', taskTitle = '토론의 논증 구성하기',
  groups = ['그룹1', '그룹2'], totalPages = 1, taskCode = '00000594',
  groupStudentCounts = {}, // { 그룹명: 배포할 학생 수 } — 매수는 여기서 정해지고 교사가 고치지 않는다
  onPrint,
}) => {
  // [v3.75] onPrint(groupLabel) — 인쇄·PDF 다운로드가 실제 시작될 때 호출. 과제 등록 화면이 그룹별 출력 완료를 기록한다
  const [sheetType, setSheetType] = useState('line14'); // [v4.0] 舊 lineTab('with'|'without') 대체
  const [activeGroup, setActiveGroup] = useState(groups[0] || '그룹1');
  const [printerName, setPrinterName] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installDownloading, setInstallDownloading] = useState(false);

  const copies = Number(groupStudentCounts[activeGroup]) || 1; // 매수 = 배포할 학생 수 (읽기 전용)
  const type = SHEET_TYPES.find((t) => t.key === sheetType) || SHEET_TYPES[0];
  const rowPx = type.cm ? Math.round(type.cm * PX_PER_CM) : 0;
  const lineRows = useMemo(() => (rowPx ? Array.from({ length: Math.floor(ANSWER_AREA_PX / rowPx) }, (_, i) => i) : []), [rowPx]);

  if (!open) return null;

  const handlePrint = () => {
    if (isPrintDoctorInstalled()) {
      // mock — 실제 서비스에선 Ncode Print Doctor 드라이버 경유
      if (window.showToast) window.showToast(`「${activeGroup}」 ${sheetTypeLabel(sheetType)} ${copies}부 인쇄가 시작되었습니다.`, 'success');
      onPrint && onPrint(activeGroup);
      setTimeout(() => window.print(), 200);
    } else {
      setShowInstallGuide(true);
    }
  };

  /* PDF 다운받기 — 드라이버 없이 가능. 출력 기록은 인쇄와 동일하게 남긴다 */
  const handleDownloadPdf = () => {
    if (window.showToast) window.showToast(`「${activeGroup}」 ${sheetTypeLabel(sheetType)} ${copies}부 PDF를 내려받았습니다.`, 'success');
    onPrint && onPrint(activeGroup);
  };

  const fieldLabel = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', marginBottom: 6, display: 'block' };
  const field = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', border: '1px solid #CBD5E1', borderRadius: 8, background: 'white', fontFamily: 'inherit' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: 860, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* 헤더 — 제목에 교과·과제명 */}
        <div style={{ padding: '18px 24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>
            답안지 미리보기 - [{subject}] {taskTitle}
          </h2>
          <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', right: 20, background: 'none', border: 'none', fontSize: 'var(--neo-font-size-xl)', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
        </div>

        {/* 본문 — 좌 미리보기 / 우 설정 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 8px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* 좌: A4 미리보기 */}
          <div style={{ flex: '1 1 0', minWidth: 0, background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
            <div style={{ position: 'relative', background: 'white', border: '1px solid #E2E8F0', borderRadius: 4, padding: '18px 20px', minHeight: 620 }}>
              <div style={{ position: 'absolute', top: 10, right: 12, background: '#E2E8F0', color: '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                1/{totalPages}
              </div>

              <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3A8A', marginBottom: 10 }}>QiGLE</div>

              {/* 정보 테이블 */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-xs)', marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 110 }}>교과/과제명</td>
                    <td colSpan={3} style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>[{subject}] {taskTitle}</td>
                  </tr>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>그룹명</td>
                    <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>{activeGroup}</td>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 80 }}>과제코드</td>
                    <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', width: 150, color: '#DC2626', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{activeGroup} ({taskCode})</td>
                  </tr>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>선생님명(학교명)</td>
                    <td colSpan={3} style={{ border: '1px solid #CBD5E1', padding: '5px 8px', color: '#64748B' }}>서예진 ({schoolName})</td>
                  </tr>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>학년 / 반 / 번호</td>
                    <td colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>(　)학년 (　)반 (　)번</td>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>이름</td>
                  </tr>
                </tbody>
              </table>

              {/* 답안 영역 — 선택한 답안지 종류에 따라 줄 간격이 바뀐다 */}
              <div style={{ border: '1px solid #CBD5E1', padding: '14px 12px', minHeight: ANSWER_AREA_PX + 28 }}>
                {rowPx ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {lineRows.map((i) => (
                      <div key={i} style={{ height: rowPx, borderBottom: '1px dashed #93C5FD' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ minHeight: ANSWER_AREA_PX }} />
                )}
              </div>
            </div>
          </div>

          {/* 우: 설정 */}
          <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
            <div>
              <label style={fieldLabel}>
                프린터명
                <span title="Ncode Print Doctor가 인식한 프린터입니다. 비워 두면 기본 프린터로 인쇄합니다." style={{ marginLeft: 4, width: 14, height: 14, borderRadius: '50%', border: '1px solid #94A3B8', color: '#64748B', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>i</span>
              </label>
              <input value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="" style={field} />
            </div>

            <div>
              <label style={fieldLabel}>그룹</label>
              <select value={activeGroup} onChange={(e) => setActiveGroup(e.target.value)} aria-label="인쇄할 그룹 선택" style={field}>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label style={fieldLabel}>답안지 종류</label>
              <select value={sheetType} onChange={(e) => setSheetType(e.target.value)} aria-label="답안지 종류 선택" style={field}>
                {SHEET_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.cm ? `${t.label} (${t.cm}cm)` : t.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6, lineHeight: 1.5 }}>
                {type.cm ? `줄 높이 ${type.cm}cm · 한 장에 ${lineRows.length}줄` : '줄 없이 빈 칸으로 출력됩니다.'}
              </div>
            </div>

            <div>
              <label style={{ ...fieldLabel, color: '#94A3B8' }}>매수 (배포할 학생 수)</label>
              <select value={copies} disabled aria-label="인쇄 매수 (배포할 학생 수)" title="배포할 학생 수만큼 인쇄됩니다. 매수는 바꿀 수 없습니다."
                style={{ ...field, background: '#F1F5F9', color: '#94A3B8', cursor: 'not-allowed' }}>
                <option value={copies}>{copies}</option>
              </select>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 24px 20px' }}>
          <button onClick={handleDownloadPdf}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #2A75F3', background: 'white', color: '#2A75F3', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            PDF 다운받기
          </button>
          <button onClick={handlePrint} title={`「${activeGroup}」 ${sheetTypeLabel(sheetType)} ${copies}부 인쇄`}
            style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            🖨 인쇄하기
          </button>
        </div>
      </div>

      {/* Print Doctor 미설치 안내 모달 — [v3.2] 다이렉트 다운로드 방식 */}
      {showInstallGuide && (
        <div onClick={() => !installDownloading && setShowInstallGuide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '92vw', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>🖨️</span>
              <h3 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>Ncode Print Doctor 설치 필요</h3>
            </div>
            <div style={{ padding: '4px 22px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 10px' }}>Ncode 인쇄를 위해서는 <strong>Ncode Print Doctor</strong> 드라이버가 설치되어 있어야 합니다.</p>
              <p style={{ margin: '0 0 6px', color: '#64748B' }}>
                아래 <strong>[다운로드]</strong> 버튼을 눌러 지금 바로 설치하실 수 있습니다. 설치 없이 받으시려면 <strong>[PDF 다운받기]</strong>를 이용해 주세요.
              </p>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', marginTop: 10, fontSize: 'var(--neo-font-size-sm)', color: '#1E3A8A' }}>
                💡 설치 후 다시 [인쇄하기]를 눌러 주세요. 한 번 설치하면 이후 별도 설치 없이 인쇄가 가능합니다.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '12px 22px 18px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9' }}>
              <button onClick={() => !installDownloading && setShowInstallGuide(false)} disabled={installDownloading}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: installDownloading ? 'not-allowed' : 'pointer', opacity: installDownloading ? 0.5 : 1 }}>
                닫기
              </button>
              <button onClick={handleDirectDownload} disabled={installDownloading}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: installDownloading ? '#94A3B8' : '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: installDownloading ? 'wait' : 'pointer' }}>
                {installDownloading ? '다운로드 중…' : '📥 다운로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // [v3.2] 안내 모달에서 바로 Print Doctor 다운로드·설치
  async function handleDirectDownload() {
    if (installDownloading) return;
    setInstallDownloading(true);
    if (window.showToast) window.showToast('Ncode Print Doctor 다운로드가 시작되었습니다.', 'success');
    await downloadPrintDoctorMock();
    setInstallDownloading(false);
    setShowInstallGuide(false);
    if (window.showToast) window.showToast('Ncode Print Doctor 설치가 완료되었습니다. [인쇄하기]를 다시 눌러 주세요.', 'success');
  }
};

export default WorksheetPreviewModal;
