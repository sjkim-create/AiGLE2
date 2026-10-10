/**
 * WorkbookDeploy — 문제집 · 낱말 문제집 「그룹 배포·출력」 단계 (TSK-15 v1.41)
 *
 * 서·논술형 직접 등록 Step 5(TSK-13)와 같은 구성:
 *   · 응시·출력 설정 — 복사·붙여넣기 차단(응시 정책) · 문항당 인쇄할 답안지 수(문제집은 문제지에 답을 쓰므로 비활성)
 *   · 문답지 출력 — 📄 문제지 출력(그룹 골라 실제 인쇄 → 그 그룹 「출력 완료」) · 📝 답안지 출력(필요 없음 — 비활성)
 *   · 배포 그룹 — 그룹별 출력 상태 · [🚀 학생 배포](출력 완료 그룹만) · [↩ 학생 배포 취소]
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
const badge = (bg, color) => ({ background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 10 });

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
 * onNotice(msg)
 */
const WorkbookDeploy = ({ wb, onSave, sheet, paper = 'A4', onNotice }) => {
  const dep = { blockCopyPaste: false, groups: DEFAULT_GROUPS, ...(wb.deploy || {}) };
  const [printGroup, setPrintGroup] = React.useState(dep.groups[0]?.id ?? null);
  const sheetRef = React.useRef(null);
  const saveDep = (patch) => onSave({ ...wb, deploy: { ...dep, ...patch } });
  const setGroup = (id, patch) => saveDep({ groups: dep.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  const print = () => {
    const root = sheetRef.current;
    if (!root || !root.querySelector('[data-page]')) { onNotice?.('인쇄할 문제지가 없습니다. 문제집 배치를 확인해 주세요.'); return; }
    printHtml(buildPrintHtml(root, paper, wb.title));
    const g = dep.groups.find((x) => x.id === Number(printGroup));
    if (g) { setGroup(g.id, { printed: true }); onNotice?.(`「${g.label}」 문제지를 인쇄했습니다 — 학생 배포를 할 수 있습니다.`); }
  };

  const toggle = (on) => ({ position: 'relative', width: 44, height: 24, borderRadius: 12, background: on ? '#EF4444' : '#CBD5E1', transition: 'background 0.2s ease', flexShrink: 0, cursor: 'pointer' });
  const studentBtn = (on, disabled) => ({
    padding: '7px 14px', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer', border: on ? '1px solid #EF4444' : '1px solid transparent',
    background: disabled ? '#E2E8F0' : on ? 'white' : '#2A75F3', color: disabled ? '#94A3B8' : on ? '#EF4444' : 'white',
  });

  return (
    <div>
      {/* 인쇄용 지면 — 화면 밖에 실제 크기로 */}
      <div ref={sheetRef} aria-hidden="true" style={{ position: 'absolute', left: -100000, top: 0, width: 1600, pointerEvents: 'none' }}>{sheet}</div>

      {/* 응시·출력 설정 */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 'var(--neo-font-size-base)' }}>응시·출력 설정</b>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>— 배포 전에 응시 정책과 출력 매수를 정합니다</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={sectionTitle}>응시 정책</div>
          <div style={{ background: dep.blockCopyPaste ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${dep.blockCopyPaste ? '#FCA5A5' : '#E5E7EB'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span role="switch" aria-checked={dep.blockCopyPaste} aria-label="복사·붙여넣기 차단" tabIndex={0}
                onClick={() => saveDep({ blockCopyPaste: !dep.blockCopyPaste })}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); saveDep({ blockCopyPaste: !dep.blockCopyPaste }); } }}
                style={toggle(dep.blockCopyPaste)}>
                <span style={{ position: 'absolute', top: 2, left: dep.blockCopyPaste ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
              </span>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>복사·붙여넣기 차단</span>
            </div>
            <p style={{ margin: '10px 0 0 56px', fontSize: 'var(--neo-font-size-sm)', color: dep.blockCopyPaste ? '#B91C1C' : '#475569', fontWeight: 600, lineHeight: 1.5 }}>
              {dep.blockCopyPaste ? '🚫 학생은 답안 입력 시 복사·붙여넣기를 사용할 수 없습니다. (Ctrl+C/V, 우클릭 메뉴, 드래그 복사 모두 차단)' : '✅ 학생은 답안 입력 시 복사·붙여넣기를 자유롭게 사용할 수 있습니다.'}
            </p>
          </div>
        </div>
        <div>
          <div style={sectionTitle}>출력 정책</div>
          {/* 문제집은 문제지에 답을 바로 쓴다 — 답안지 매수는 쓰지 않음(비활성) */}
          <div aria-disabled="true" style={{ background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#64748B' }}>📝 문항당 인쇄할 답안지 수</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" disabled style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#CBD5E1', padding: 0 }}>−</button>
                <input type="number" disabled value={0} aria-label="답안지 수(사용 안 함)" style={{ width: 44, textAlign: 'center', border: '1px solid #CBD5E1', borderRadius: 6, padding: '3px 4px', background: '#F1F5F9', color: '#94A3B8' }} />
                <button type="button" disabled style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #CBD5E1', background: '#F1F5F9', color: '#CBD5E1', padding: 0 }}>+</button>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>장</span>
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 600 }}>문제집은 문제지에 바로 답을 쓰므로 답안지를 따로 인쇄하지 않습니다.</p>
          </div>
        </div>
      </div>

      {/* 문답지 출력 */}
      <div style={card}>
        <b style={{ fontSize: 'var(--neo-font-size-base)', display: 'block', marginBottom: 4 }}>🖨️ 문답지 출력</b>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>문제집 배치 그대로 <b>문제지</b>를 인쇄합니다. 인쇄한 그룹은 「출력 완료」가 되어 학생 배포를 할 수 있습니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 10px', borderRadius: 12, border: '1px solid #CBD5E1', background: 'white' }}>
            <span style={{ fontSize: '1.8rem' }}>📄</span>
            <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>문제지 출력</span>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center' }}>문제집 배치 그대로 · {paper} · 이름 칸 포함</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569', marginTop: 4 }}>
              인쇄할 그룹
              <select value={printGroup ?? ''} onChange={(e) => setPrintGroup(Number(e.target.value))} aria-label="인쇄할 그룹"
                style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)' }}>
                {dep.groups.map((g) => <option key={g.id} value={g.id}>{g.label} ({g.studentCount}명)</option>)}
              </select>
            </label>
            <button type="button" onClick={print} style={{ marginTop: 6, padding: '6px 18px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>🖨 인쇄</button>
          </div>
          <div aria-disabled="true" title="문제집은 답안지가 필요 없습니다" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 10px', borderRadius: 12, border: '1px dashed #CBD5E1', background: '#F1F5F9', opacity: 0.6 }}>
            <span style={{ fontSize: '1.8rem', filter: 'grayscale(1)' }}>📝</span>
            <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#64748B' }}>답안지 출력</span>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center' }}>문제집은 답안지가 필요 없습니다</span>
            <button type="button" disabled style={{ marginTop: 6, padding: '6px 18px', borderRadius: 8, border: 'none', background: '#CBD5E1', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'not-allowed', fontFamily: 'inherit' }}>사용 안 함</button>
          </div>
        </div>
      </div>

      {/* 배포 그룹 */}
      <div style={card}>
        <b style={{ fontSize: 'var(--neo-font-size-base)', display: 'block', marginBottom: 4 }}>배포 그룹</b>
        <p style={{ margin: '0 0 10px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>문제지를 인쇄한 그룹만 학생 배포를 할 수 있습니다.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dep.groups.map((g) => {
            const disabled = !g.printed && !g.studentDeployed;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 'var(--neo-font-size-base)' }}>{g.label}</span>
                <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>{g.studentCount}명</span>
                {g.printed && !g.studentDeployed && <span style={badge('#FEF3C7', '#B45309')}>🖨 문제지 출력 완료</span>}
                {!g.printed && <span style={badge('#F1F5F9', '#64748B')}>출력 전</span>}
                {g.studentDeployed && <span style={badge('#DBEAFE', '#1D4ED8')}>🚀 학생 배포</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button type="button" aria-disabled={disabled}
                    title={g.studentDeployed ? '학생이 문제집을 볼 수 없는 상태가 됩니다.' : g.printed ? '학생에게 문제집이 보입니다.' : '문제지를 인쇄한 뒤 배포할 수 있습니다.'}
                    onClick={() => { if (disabled) return; setGroup(g.id, { studentDeployed: !g.studentDeployed }); onNotice?.(g.studentDeployed ? `「${g.label}」 학생 배포를 취소했습니다.` : `「${g.label}」에 학생 배포했습니다.`); }}
                    style={studentBtn(g.studentDeployed, disabled)}>{g.studentDeployed ? '↩ 학생 배포 취소' : '🚀 학생 배포'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkbookDeploy;
