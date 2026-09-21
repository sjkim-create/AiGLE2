/**
 * NumberTagPreviewModal.jsx
 * [TSK-05 v3.4] 스마트펜 번호표 미리보기 모달
 *   진입: 과제관리 > 그룹 배포 카드의 [스마트펜 번호표] 버튼
 *   구성:
 *     · 그룹 서브탭 (예: 그룹1 · 그룹2) — 탭 라벨에 「(N부)」 배지
 *     · 매수 spinner + [🖨 {그룹명} 인쇄] (그룹별 개별 실행)
 *     · A4 프리뷰: 학생 번호표 헤더 + AIGLE-001 ~ N 그리드 (최대 117명 = 3페이지)
 *   인쇄 액션: Print Doctor 설치 여부 판정 → 미설치 시 안내 모달 (WorksheetPreviewModal과 동일 흐름)
 */
import React, { useState, useMemo } from 'react';

const isPrintDoctorInstalled = () => {
  try {
    return localStorage.getItem('ncodePrintDoctor:downloaded') === 'true';
  } catch (_) {
    return false;
  }
};

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

const NumberTagPreviewModal = ({
  open, onClose,
  schoolName = '공주 고등학교',
  subject = '수학',
  taskTitle = 'TEST',
  taskCode = '00000579',
  groups = ['TEST'],
  studentCount = 30,
  onPrint, // [v3.75] (groupLabel) => void — 인쇄(다운로드)가 실제 시작될 때 호출. 과제 등록 화면이 그룹별 출력 완료를 기록한다
}) => {
  const [activeGroup, setActiveGroup] = useState(groups[0] || 'TEST');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installDownloading, setInstallDownloading] = useState(false);
  // 그룹별 인쇄 매수 (그룹 탭 전환 시 개별 유지, 1~99)
  const [groupCopies, setGroupCopies] = useState(() => Object.fromEntries(groups.map((g) => [g, 1])));
  const currentCopies = groupCopies[activeGroup] ?? 1;
  const updateCurrentCopies = (val) => {
    const n = Math.max(1, Math.min(99, Number(val) || 1));
    setGroupCopies((prev) => ({ ...prev, [activeGroup]: n }));
  };

  const tagIds = useMemo(
    () => Array.from({ length: studentCount }, (_, i) => `AIGLE-${String(i + 1).padStart(3, '0')}`),
    [studentCount]
  );

  if (!open) return null;

  const handlePrint = () => {
    if (isPrintDoctorInstalled()) {
      if (window.showToast) window.showToast(`「${activeGroup}」 스마트펜 번호표 ${currentCopies}부 인쇄가 시작되었습니다.`, 'success');
      onPrint && onPrint(activeGroup);
      setTimeout(() => window.print(), 200);
    } else {
      setShowInstallGuide(true);
    }
  };

  const handleDirectDownload = async () => {
    if (installDownloading) return;
    setInstallDownloading(true);
    if (window.showToast) window.showToast('Ncode Print Doctor 다운로드가 시작되었습니다.', 'success');
    await downloadPrintDoctorMock();
    setInstallDownloading(false);
    setShowInstallGuide(false);
    if (window.showToast) window.showToast('Ncode Print Doctor 설치가 완료되었습니다. [인쇄하기]를 다시 눌러 주세요.', 'success');
  };

  const tagCardStyle = {
    border: '1px solid #2A75F3', borderRadius: 8,
    padding: '10px 12px', minHeight: 68,
    display: 'flex', justifyContent: 'space-between', alignItems: 'stretch',
    background: 'white',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: 900, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>스마트펜 번호표 미리보기</h2>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 'var(--neo-font-size-xl)', cursor: 'pointer', color: '#64748B', padding: 4 }}>✕</button>
        </div>

        {/* 그룹 서브탭 + 우측 매수 입력·인쇄 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #E2E8F0', padding: '10px 24px 0', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {groups.map((g) => {
              const active = activeGroup === g;
              const cnt = groupCopies[g] ?? 1;
              return (
                <button key={g} onClick={() => setActiveGroup(g)}
                  style={{ padding: '10px 16px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, background: active ? '#EFF6FF' : 'white', border: 'none', borderBottom: active ? '3px solid #2A75F3' : '3px solid transparent', color: active ? '#1D4ED8' : '#94A3B8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: '6px 6px 0 0' }}>
                  <span>{g}</span>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: active ? '#2A75F3' : '#CBD5E1', background: active ? 'white' : '#F1F5F9', padding: '2px 6px', borderRadius: 999 }}>
                    {cnt}부
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
              title={`「${activeGroup}」 스마트펜 번호표 ${currentCopies}부 인쇄`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #2A75F3', background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
              🖨 {activeGroup} 인쇄
            </button>
          </div>
        </div>

        {/* 스크롤 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 20px', background: '#F8FAFC' }}>
          {/* A4 프리뷰 */}
          <div style={{ position: 'relative', background: 'white', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            {/* 페이지 번호 */}
            <div style={{ position: 'absolute', top: 12, right: 14, background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
              1/{Math.max(1, Math.ceil(studentCount / 40))}
            </div>

            {/* 헤더 (로고 + 정보 테이블) */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 90 }}>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E3A8A', letterSpacing: '-0.02em' }}>QiGLE</div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginTop: 4 }}>학생 번호표</div>
              </div>
              <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                <tbody>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 100 }}>교과/과제명</td>
                    <td colSpan={3} style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>[{subject}] {taskTitle}</td>
                  </tr>
                  <tr>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700 }}>그룹명</td>
                    <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px' }}>{activeGroup}</td>
                    <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 8px', fontWeight: 700, width: 80 }}>과제코드</td>
                    <td style={{ border: '1px solid #CBD5E1', padding: '5px 8px', width: 120 }}>{taskCode}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 유의사항 */}
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', marginBottom: 14 }}>
              ⚠ 유의사항: 스마트펜은 가장 마지막에 체크된 번호를 인식하므로, 잘못 체크한 경우 원하는 번호를 다시 한번 체크해 주세요.
            </div>

            {/* 번호표 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {/* 예시 카드 */}
              <div style={{ ...tagCardStyle, background: 'white', border: '1px solid #1E293B' }}>
                <div style={{ flex: 1, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.35, color: '#1E293B' }}>
                  <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 'var(--neo-font-size-xs)' }}>*예시</div>
                  <div style={{ fontWeight: 800 }}>AIGLE-001</div>
                  <div>2026 공주초등학교</div>
                  <div style={{ fontWeight: 700 }}>3학년 12반 12번</div>
                  <div>김마리아노</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, borderLeft: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>출석</div>
                  <div style={{ fontSize: 'var(--neo-font-size-xl)', color: '#1E293B', fontWeight: 800 }}>V</div>
                </div>
              </div>
              {/* 실제 번호표들 */}
              {tagIds.map((tid, i) => (
                <div key={tid} style={tagCardStyle}>
                  <div style={{ flex: 1, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.4, color: '#2A75F3' }}>
                    <div style={{ fontWeight: 800 }}>{tid}</div>
                    {i === 0 && (
                      <>
                        <div>2026 평해중학교</div>
                        <div style={{ fontWeight: 700 }}>1학년 1반 1번</div>
                        <div>테스트</div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 8, borderLeft: '1px solid #DBEAFE' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#2A75F3' }}>출석</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Print Doctor 미설치 안내 모달 — 다이렉트 다운로드 */}
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

export default NumberTagPreviewModal;
