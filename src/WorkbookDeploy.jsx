/**
 * WorkbookDeploy — 「그룹 배포·출력」 단계 (TSK-15 v1.41 · TSK-13 v4.11)
 *
 * 문제집 · 낱말 문제집 · [2.4] 서·논술형 문제지 공통. 답안지 출력은 없다 — 답안 영역은 문제지 안에 있다 (2026-10-29 화면 새로 구성)
 *   ① 문제지 · 응시 정책 — 첫 쪽 축소 미리 보기 · 「{크기} · {쪽}쪽 · 학생 1명당 {쪽}장」 · 인쇄 / 배포 그룹 수 · 복사·붙여넣기 차단
 *   ② 그룹별 출력 · 배포 — 그룹 · 인원 · 상태 · [🖨 문제지 인쇄](다시 인쇄) → [🚀 학생 배포](인쇄한 그룹만) · [↩ 배포 취소]
 * 바꾼 내용은 문제집(wb.deploy)에 바로 저장. 배포 그룹은 프로토 샘플(1학년 1~3반).
 */
import React from 'react';

export const DEFAULT_GROUPS = [
  { id: 1, label: '1학년 1반', studentCount: 28, printed: false, studentDeployed: false },
  { id: 2, label: '1학년 2반', studentCount: 27, printed: false, studentDeployed: false },
  { id: 3, label: '1학년 3반', studentCount: 26, printed: false, studentDeployed: false },
];
const PAPER_MM = { A4: [210, 297], B4: [257, 364], A3: [297, 420] };

const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 18px', marginBottom: 14 };
const sectionTitle = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.02em' };
const badge = (bg, color) => ({ background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' });

// 미리 보기 지면(data-page)들을 인쇄용 문서로 — 쪽마다 한 장, 시험지 크기 그대로
export const buildPrintHtml = (pagesRoot, paper = 'A4', title = '') => {
  const [w, h] = PAPER_MM[paper] || PAPER_MM.A4;
  const pages = [...pagesRoot.querySelectorAll('[data-page]')].map((p) => p.outerHTML).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title>
<style>
@page { size: ${w}mm ${h}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: white; }
[data-page] { width: ${w}mm !important; height: ${h}mm !important; box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page; overflow: hidden; }
[data-page]:last-child { page-break-after: auto; break-after: auto; }
[data-edit-toolbar] { display: none !important; }
</style></head><body>${pages}</body></html>`;
};

// 화면에 보이지 않는 iframe에 넣고 인쇄 창을 연다 (팝업 차단 없음)
const printHtml = (html) => {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  Object.assign(f.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1000); }, 300);
};

/**
 * wb — 문제집 · onSave(next wb) · sheet — 인쇄할 지면(실제 크기로 그린 WorkbookSheet/WordSheet) · paper — 'A4' | 'B4' | 'A3'
 * onNotice(msg) · noun · layoutName — 화면 문구 (문제집 / 과제, 문제집 배치 / 문제지 배치)
 */
const WorkbookDeploy = ({ wb, onSave, sheet, paper = 'A4', onNotice, noun = '문제집', layoutName = '문제집 배치' }) => {
  const dep = { blockCopyPaste: false, groups: DEFAULT_GROUPS, ...(wb.deploy || {}) };
  const [cancelTarget, setCancelTarget] = React.useState(null); // 학생 배포 취소 확인
  const [pageCount, setPageCount] = React.useState(0);
  const sheetRef = React.useRef(null);
  const saveDep = (patch) => onSave({ ...wb, deploy: { ...dep, ...patch } });
  const setGroup = (id, patch) => saveDep({ groups: dep.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  // 쪽 수 — 인쇄용 지면은 높이를 잰 뒤에 쪽이 나뉘므로 그려진 다음에 센다
  React.useEffect(() => {
    const t = setTimeout(() => {
      const n = sheetRef.current?.querySelectorAll('[data-page]').length || 0;
      setPageCount((p) => (p === n ? p : n));
    }, 300);
    return () => clearTimeout(t);
  });

  const print = (g) => {
    const root = sheetRef.current;
    if (!root || !root.querySelector('[data-page]')) { onNotice?.(`인쇄할 문제지가 없습니다. ${layoutName}를 확인해 주세요.`); return; }
    printHtml(buildPrintHtml(root, paper, wb.title));
    setGroup(g.id, { printed: true, printedAt: g.printedAt || new Date().toISOString() });
    onNotice?.(`「${g.label}」 문제지를 인쇄했습니다 — 채점 관리 미채점에 등록되었고 학생 배포를 할 수 있습니다.`);
  };

  const toggle = (on) => ({ position: 'relative', width: 40, height: 22, borderRadius: 11, background: on ? '#EF4444' : '#CBD5E1', transition: 'background 0.2s ease', flexShrink: 0, cursor: 'pointer' });
  const actBtn = (kind, disabled) => ({
    padding: '7px 12px', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: kind === 'ghost' ? '1px solid #CBD5E1' : kind === 'danger' ? '1px solid #EF4444' : '1px solid transparent',
    background: disabled ? '#E2E8F0' : kind === 'primary' ? '#2A75F3' : 'white',
    color: disabled ? '#94A3B8' : kind === 'primary' ? 'white' : kind === 'danger' ? '#EF4444' : '#334155',
  });
  const printedN = dep.groups.filter((g) => g.printed).length;
  const deployedN = dep.groups.filter((g) => g.studentDeployed).length;
  const th = { textAlign: 'left', padding: '8px 12px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' };
  const td = { padding: '10px 12px', borderBottom: '1px solid #F1F5F9', fontSize: 'var(--neo-font-size-sm)', verticalAlign: 'middle' };
  const pc = pageCount || '…';

  return (
    <div>
      {/* 인쇄용 지면 — 화면 밖에 실제 크기로 */}
      <div ref={sheetRef} aria-hidden="true" style={{ position: 'absolute', left: -100000, top: 0, width: 1600, pointerEvents: 'none' }}>{sheet}</div>

      {/* ① 문제지 · 응시 정책 */}
      <div style={{ ...card, display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* 첫 쪽 축소 미리 보기 */}
        <div aria-hidden="true" style={{ flex: '0 0 auto', width: 168, height: 226, borderRadius: 8, border: '1px solid #E2E8F0', background: '#E2E8F0', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 840, transform: 'scale(0.2)', transformOrigin: 'top left', pointerEvents: 'none' }}>{sheet}</div>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={sectionTitle}>문제지</div>
            <div style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>{paper} · {pc}쪽</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: 2 }}>{layoutName} 그대로 인쇄합니다 · 학생 1명당 {pc}장 · 이름 칸 포함</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={badge('#F1F5F9', '#475569')}>인쇄 {printedN}/{dep.groups.length} 그룹</span>
            <span style={badge('#DBEAFE', '#1D4ED8')}>학생 배포 {deployedN}/{dep.groups.length} 그룹</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={sectionTitle}>응시 정책</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span role="switch" aria-checked={dep.blockCopyPaste} aria-label="복사·붙여넣기 차단" tabIndex={0}
                onClick={() => saveDep({ blockCopyPaste: !dep.blockCopyPaste })}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); saveDep({ blockCopyPaste: !dep.blockCopyPaste }); } }}
                style={toggle(dep.blockCopyPaste)}>
                <span style={{ position: 'absolute', top: 2, left: dep.blockCopyPaste ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
              </span>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225' }}>복사·붙여넣기 차단</span>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: dep.blockCopyPaste ? '#B91C1C' : '#64748B' }}>{dep.blockCopyPaste ? '학생 답안 입력 시 차단' : '사용 가능'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ② 그룹별 출력 · 배포 — 인쇄한 그룹만 학생 배포 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 6px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 'var(--neo-font-size-base)' }}>그룹별 출력 · 배포</b>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>문제지를 인쇄한 그룹만 학생 배포를 할 수 있습니다.</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>그룹</th><th style={th}>인원</th><th style={th}>상태</th><th style={{ ...th, textAlign: 'right' }}>문제지</th><th style={{ ...th, textAlign: 'right' }}>학생 배포</th></tr>
            </thead>
            <tbody>
              {dep.groups.map((g) => {
                const canDeploy = g.printed || g.studentDeployed;
                return (
                  <tr key={g.id}>
                    <td style={{ ...td, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap' }}>{g.label}</td>
                    <td style={{ ...td, color: '#64748B', whiteSpace: 'nowrap' }}>{g.studentCount}명</td>
                    <td style={td}>
                      {g.studentDeployed ? <span style={badge('#DBEAFE', '#1D4ED8')}>🚀 학생 배포</span>
                        : g.printed ? <span style={badge('#FEF3C7', '#B45309')}>🖨 인쇄 완료 · 미채점 등록</span>
                        : <span style={badge('#F1F5F9', '#64748B')}>출력 전</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button type="button" onClick={() => print(g)} style={actBtn(g.printed ? 'ghost' : 'primary', false)}>{g.printed ? '🖨 다시 인쇄' : '🖨 문제지 인쇄'}</button>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button type="button" aria-disabled={!canDeploy}
                        title={g.studentDeployed ? `학생이 ${noun}을 볼 수 없는 상태가 됩니다.` : g.printed ? `학생에게 ${noun}이 보입니다.` : '문제지를 인쇄한 뒤 배포할 수 있습니다.'}
                        onClick={() => {
                          if (!canDeploy) return;
                          if (g.studentDeployed) { setCancelTarget(g); return; } // 취소는 확인창 — 채점 정보 삭제 안내
                          setGroup(g.id, { studentDeployed: true }); onNotice?.(`「${g.label}」에 학생 배포했습니다 — 배포 중에는 ${noun}을 수정할 수 없습니다.`);
                        }}
                        style={actBtn(g.studentDeployed ? 'danger' : 'primary', !canDeploy)}>{g.studentDeployed ? '↩ 배포 취소' : '🚀 학생 배포'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 학생 배포 취소 확인 — 이미 배포한 학생들의 채점 정보가 모두 지워진다 */}
      {cancelTarget && (
        <div onClick={() => setCancelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-label="학생 배포 취소" onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '94vw', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 22px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.6rem' }}>⚠️</span>
              <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>「{cancelTarget.label}」 학생 배포를 취소할까요?</h2>
            </div>
            <div style={{ padding: '6px 22px 16px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px' }}>학생 배포를 취소하면 <b style={{ color: '#DC2626' }}>이 그룹에 배포한 학생들의 답안과 채점 정보가 모두 삭제</b>되며 되돌릴 수 없습니다.</p>
              <p style={{ margin: 0, color: '#64748B' }}>학생은 {noun}을 볼 수 없게 되고, {noun}을 다시 수정할 수 있습니다. 수정한 뒤에는 문제지를 다시 인쇄해 주세요.</p>
            </div>
            <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" autoFocus onClick={() => setCancelTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
              <button type="button" onClick={() => { setGroup(cancelTarget.id, { studentDeployed: false, gradingReset: new Date().toISOString() }); onNotice?.(`「${cancelTarget.label}」 학생 배포를 취소했습니다 — 학생 답안·채점 정보를 삭제했습니다.`); setCancelTarget(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: 'white', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>배포 취소 · 채점 정보 삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkbookDeploy;
