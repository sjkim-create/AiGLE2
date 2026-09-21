/**
 * WorksheetPreviewModal.jsx
 * [TSK-05 v2.30] 평가 답안지 미리보기 모달
 *   진입: 과제관리 > 답안지 출력 카드의 [답안지 출력] 버튼
 *   구성:
 *     · 상단 탭: 「선 있는 답안」/「선 없는 답안」
 *     · 정보 라인: 학교명 · 교과 · 과제명
 *     · 그룹 선택: 셀렉트 박스 ([v3.6] 舊 서브탭 폐기)
 *     · 우상단 [🖨 인쇄하기] 버튼 (기존 PDF 다운로드 대체)
 *     · A4 프리뷰 (AiGLE 헤더 + 답안 영역, 선 유무 반영)
 *   인쇄 액션:
 *     · Ncode Print Doctor 설치되어 있으면 window.print() (mock)
 *     · 미설치면 「설치 필요」 안내 모달 노출 → [환경설정으로 이동] 시 window CustomEvent 발행
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
//   Setting.jsx의 handleDownloadPrintDoctor와 동일한 mock 로직·localStorage 키 사용
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

const WorksheetPreviewModal = ({ open, onClose, schoolName = '공주 고등학교', subject = '국어', taskTitle = '토론의 논증 구성하기', groups = ['그룹1', '그룹2'], totalPages = 10, taskCode = '00000594', onPrint }) => {
  // [v3.75] onPrint(groupLabel) — 인쇄(다운로드)가 실제 시작될 때 호출. 과제 등록 화면이 그룹별 출력 완료를 기록한다
  const [lineTab, setLineTab] = useState('with'); // with | without
  const [activeGroup, setActiveGroup] = useState(groups[0] || '그룹1');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installDownloading, setInstallDownloading] = useState(false); // [v3.2] 안내 모달 내부 다운로드 진행 상태
  // [v3.3] 그룹별 인쇄 매수 — { '그룹1': 1, '그룹2': 1, ... } 형태. 그룹 탭 전환 시 각각 유지
  const [groupCopies, setGroupCopies] = useState(() => Object.fromEntries(groups.map((g) => [g, 1])));
  const currentCopies = groupCopies[activeGroup] ?? 1;
  const updateCurrentCopies = (val) => {
    const n = Math.max(1, Math.min(99, Number(val) || 1));
    setGroupCopies((prev) => ({ ...prev, [activeGroup]: n }));
  };

  const lineRows = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);

  if (!open) return null;

  const handlePrint = () => {
    if (isPrintDoctorInstalled()) {
      // mock — 실제 서비스에선 Ncode Print Doctor 드라이버 경유. [v3.3] 그룹별 매수 반영
      if (window.showToast) window.showToast(`「${activeGroup}」 답안지 ${currentCopies}부 인쇄가 시작되었습니다.`, 'success');
      onPrint && onPrint(activeGroup);
      setTimeout(() => window.print(), 200);
    } else {
      setShowInstallGuide(true);
    }
  };

  // [v3.2] 안내 모달에서 바로 Print Doctor 다운로드·설치.
  //   완료 시 안내 모달만 닫고 미리보기 유지 → 사용자가 [인쇄하기] 재클릭
  const handleDirectDownload = async () => {
    if (installDownloading) return;
    setInstallDownloading(true);
    if (window.showToast) window.showToast('Ncode Print Doctor 다운로드가 시작되었습니다.', 'success');
    await downloadPrintDoctorMock();
    setInstallDownloading(false);
    setShowInstallGuide(false);
    if (window.showToast) window.showToast('Ncode Print Doctor 설치가 완료되었습니다. [인쇄하기]를 다시 눌러 주세요.', 'success');
  };

  const tabBase = { flex: 1, padding: '14px 12px', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, background: 'white', border: 'none', cursor: 'pointer' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: 720, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>평가 답안지 미리보기</h2>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 'var(--neo-font-size-xl)', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
        </div>

        {/* 상단 탭: 선 있는 / 선 없는 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0' }}>
          <button onClick={() => setLineTab('with')}
            style={{ ...tabBase, borderBottom: lineTab === 'with' ? '3px solid #1E293B' : '3px solid transparent', color: lineTab === 'with' ? '#1E293B' : '#94A3B8' }}>
            선 있는 답안
          </button>
          <button onClick={() => setLineTab('without')}
            style={{ ...tabBase, borderBottom: lineTab === 'without' ? '3px solid #1E293B' : '3px solid transparent', color: lineTab === 'without' ? '#1E293B' : '#94A3B8' }}>
            선 없는 답안
          </button>
        </div>

        {/* 스크롤 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 20px' }}>
          {/* 정보 라인 */}
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <span><span style={{ color: '#94A3B8' }}>학교명 </span><strong style={{ color: '#1E293B' }}>{schoolName}</strong></span>
            <span><span style={{ color: '#94A3B8' }}>교과 </span><strong style={{ color: '#1E293B' }}>{subject}</strong></span>
            <span><span style={{ color: '#94A3B8' }}>과제명 </span><strong style={{ color: '#1E293B' }}>{taskTitle}</strong></span>
          </div>

          {/* [v3.6] 그룹 선택 — 舊 서브탭 → 셀렉트 박스. 옵션 라벨에 그룹별 인쇄 매수 「(N부)」 · 우측 매수 입력·인쇄 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>
              <span>그룹</span>
              <select
                value={activeGroup}
                onChange={(e) => setActiveGroup(e.target.value)}
                aria-label="인쇄할 그룹 선택"
                style={{ minWidth: 180, padding: '7px 10px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', border: '1px solid #CBD5E1', borderRadius: 8, background: 'white', fontFamily: 'inherit' }}>
                {groups.map((g) => (
                  <option key={g} value={g}>{g} ({groupCopies[g] ?? 1}부)</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>
                <span>매수</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={currentCopies}
                  onChange={(e) => updateCurrentCopies(e.target.value)}
                  aria-label={`${activeGroup} 인쇄 매수`}
                  style={{ width: 56, padding: '5px 8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, textAlign: 'center', border: '1px solid #CBD5E1', borderRadius: 6, color: '#1E293B' }}
                />
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>부</span>
              </label>
              <button onClick={handlePrint}
                title={`「${activeGroup}」 답안지 ${currentCopies}부 인쇄`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #2A75F3', background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
                🖨 {activeGroup} 인쇄
              </button>
            </div>
          </div>

          {/* A4 프리뷰 */}
          <div style={{ position: 'relative', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', padding: '18px 20px', minHeight: 620, overflow: 'hidden' }}>
            {/* 페이지 번호 */}
            <div style={{ position: 'absolute', top: 12, right: 14, background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
              1/{totalPages}
            </div>

            {/* AiGLE 로고 */}
            <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E3A8A', marginBottom: 12 }}>
              QiGLE
            </div>

            {/* 정보 테이블 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-xs)', marginBottom: 14 }}>
              <tbody>
                {/* [TSK-05 v3.5] 스캔 채점 OCR 매핑을 위한 서식 보강
                    · 과제코드: 舊 빈칸(손글씨) → 시스템 인쇄값. 활자라 OCR 인식률이 사실상 100%
                    · 문항 [ ]번: 신규 기재란. 답안지에 문항 식별자가 없어 스캔본만으로는 문항 판별이 불가능했음 */}
                <tr>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 110 }}>교과/과제명</td>
                  <td colSpan={2} style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>{subject} / {taskTitle}</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', width: 140, fontWeight: 700 }}>
                    문항 <span style={{ display: 'inline-block', minWidth: 34, borderBottom: '1.5px solid #1E293B', margin: '0 3px' }} /> 번
                  </td>
                </tr>
                <tr>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>그룹명</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>{activeGroup}</td>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 90 }}>과제코드</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', width: 140, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{taskCode}</td>
                </tr>
                <tr>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>선생님명(학교명)</td>
                  <td colSpan={3} style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}></td>
                </tr>
                <tr>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>학년 / 반 / 번호</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>(  )학년 (  )반 (  )번</td>
                  <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>이름</td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}></td>
                </tr>
              </tbody>
            </table>

            {/* [TSK-05 v3.5] 기재 안내 — 스캔 채점 시 문항 번호가 매핑 키가 되므로 누락되면 미분류로 빠진다 */}
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4, padding: '4px 8px', marginBottom: 10 }}>
              ※ 답안지마다 <strong>문항 번호</strong>와 <strong>학년/반/번호·이름</strong>을 반드시 적어 주세요. 한 문항을 여러 장에 이어 쓸 경우 각 장에 모두 적습니다.
            </div>

            {/* 답안 영역 */}
            <div style={{ border: '1px solid #CBD5E1', padding: '16px 14px', minHeight: 460 }}>
              {lineTab === 'with' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {lineRows.map((i) => (
                    <div key={i} style={{ height: 24, borderBottom: '1px solid #94A3B8' }} />
                  ))}
                </div>
              ) : (
                <div style={{ minHeight: 460 }} />
              )}
            </div>
          </div>
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
                아래 <strong>[다운로드]</strong> 버튼을 눌러 지금 바로 설치하실 수 있습니다.
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
};

export default WorksheetPreviewModal;
