/**
 * TeacherInk.jsx — 교사 첨삭 층 (SCR-03 원본 보기 · TSK-10 학생 결과 · POP-19 리포트 공용)
 *
 * InkedPen = 학생 펜 답안(PenStrokes) + 같은 Ncode 좌표 위 교사 첨삭
 *   · 보기만(학생 · 리포트): 교사가 「보이기」로 둔 첨삭만
 *   · 쓰기(교사, editable): 교사펜이 연결되면 답안 위에 쓴 필기가 실시간으로 들어간다
 *     프로토는 펜 에뮬레이터 — 마우스 · 터치펜으로 답안 위에 쓰면 교사펜 필기와 같은 형태로 저장
 */
import React, { useRef, useState } from 'react';
import PenStrokes from './PenStrokes';
import { useInk, inkHex, INK_WIDTH, INK_COLORS } from './lib/teacherInk';

const pathOf = (p) => (p.length === 1 ? `M${p[0][0]} ${p[0][1]}l0.01 0` : p.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(''));

/* svg 안에 그리는 첨삭 층 — editable이면 투명 판을 깔아 펜(포인터) 입력을 받는다 */
export const InkLayer = ({ strokes, editable = false, color = 'red', bold = false, onStroke }) => {
  const [live, setLive] = useState(null);
  const drawing = useRef(false);
  const toSvg = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100];
  };
  const down = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; setLive([toSvg(e)]); };
  const move = (e) => { if (drawing.current) { const q = toSvg(e); setLive((l) => (l ? [...l, q] : [q])); } };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (live?.length) onStroke?.({ color, bold, p: live });
    setLive(null);
  };
  return (
    <g aria-label="교사 첨삭">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((st, i) => <path key={i} d={pathOf(st.p)} stroke={inkHex(st.color)} strokeWidth={st.bold ? INK_WIDTH.bold : INK_WIDTH.normal} />)}
        {live && <path d={pathOf(live)} stroke={inkHex(color)} strokeWidth={bold ? INK_WIDTH.bold : INK_WIDTH.normal} />}
      </g>
      {editable && (
        <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill="transparent" style={{ cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      )}
    </g>
  );
};

/* 학생 펜 답안 + 교사 첨삭
 *   inkKey · show(이번 화면에서 싣는지) · editable(교사 쓰기) · tool { color, bold } */
const InkedPen = ({ pen, from = 0, inkKey: key, show = true, editable = false, tool = {}, label, style, width }) => {
  const [ink, update] = useInk(key);
  const visible = show && ink.visible;
  const strokes = visible ? ink.strokes : [];
  return (
    <PenStrokes pen={pen} from={from} label={label} width={width} style={{ ...style, ...(editable && ink.visible ? { touchAction: 'none' } : {}) }}>
      {(strokes.length > 0 || (editable && ink.visible)) && (
        <InkLayer strokes={strokes} editable={editable && ink.visible} color={tool.color} bold={tool.bold}
          onStroke={(st) => update((cur) => ({ ...cur, strokes: [...cur.strokes, st] }))} />
      )}
    </PenStrokes>
  );
};

/* 교사펜 패널 — 원본 보기(일괄 채점 통합) 학생 답안 오른쪽, 디자인 툴처럼 세로 패널
 *   locked — 첨삭할 수 없는 단계면 그 이유(채점 확인 단계에서만 쓸 수 있다). 잠기면 연결 · 펜 · 고치기 · 보이기가 모두 막힌다
 *   conn: null | { type: 'BLE' | 'USB', name } — BLE는 주변 펜을 찾아 셀렉트에서 골라 연결(프로토는 에뮬레이터 목록) · tool { color, bold }
 *   Ctrl+Z(⌘Z) · [↶] = 마지막 획 되돌리기(화면에는 단축키 안내를 따로 쓰지 않는다) · [전체 지우기]는 한 번 더 확인 · 레이어 눈 = 학생 화면 · 리포트에 싣는지 */
const P = {
  line: '#E5E7EB', soft: '#F3F4F6', text: '#111827', sub: '#6B7280', mute: '#9CA3AF',
  accent: '#2563EB', accentSoft: '#EFF6FF', danger: '#DC2626',
};
const Section = ({ title, right, children }) => (
  <div style={{ padding: '10px 12px', borderTop: `1px solid ${P.line}` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: P.sub, letterSpacing: '0.02em' }}>{title}</span>
      {right}
    </div>
    {children}
  </div>
);
const IconBtn = ({ on, disabled, title, onClick, children, danger, wide }) => (
  <button type="button" title={title} aria-label={title} aria-pressed={on} disabled={disabled} onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, minWidth: 32, padding: wide ? '0 10px' : 0, flex: wide ? 1 : 'none',
      borderRadius: 6, border: `1px solid ${on ? '#93C5FD' : P.line}`, background: on ? P.accentSoft : 'white',
      color: disabled ? P.mute : danger ? P.danger : on ? P.accent : P.text, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
    }}>{children}</button>
);

/* [펜 에뮬레이터] 주변에서 찾은 BLE 교사펜 — 실제는 브라우저 블루투스 검색 결과 */
const BLE_PENS = [
  { id: '9C:7B:D2:1A:18:36', name: 'Neo smartpen M1+' },
  { id: '9C:7B:D2:2F:04:11', name: 'Neo smartpen dimo' },
  { id: '9C:7B:D2:3C:7A:52', name: 'Neo smartpen R1' },
];

export const TeacherPenPanel = ({ inkKey: key, locked, conn, onConnect, tool, onTool }) => {
  const [ink, update] = useInk(key);
  const [askClear, setAskClear] = useState(false);
  const [scan, setScan] = useState(null); // null | 'searching' | 펜 목록
  const [pick, setPick] = useState('');
  const scanTimer = useRef(0);
  React.useEffect(() => () => clearTimeout(scanTimer.current), []);
  const startBle = () => {
    setScan('searching');
    clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => { setScan(BLE_PENS); setPick(BLE_PENS[0].id); }, 900);
  };
  const connectBle = () => {
    const pen = BLE_PENS.find((x) => x.id === pick);
    if (!pen) return;
    onConnect({ type: 'BLE', name: pen.name, id: pen.id });
    setScan(null);
  };
  const canWrite = !locked && !!conn && ink.visible;
  const undo = () => update((cur) => ({ ...cur, strokes: cur.strokes.slice(0, -1) }));
  React.useEffect(() => {
    if (!canWrite) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return; // 글 고치기의 되돌리기는 그대로
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWrite, key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 잠기는 단계로 바뀌면(결과 발송 등) 연결도 끊는다 */
  React.useEffect(() => { if (locked) { setScan(null); if (conn) onConnect(null); } }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = ink.strokes.length;
  return (
    <aside role="toolbar" aria-orientation="vertical" aria-label="교사펜 첨삭" style={{
      width: 196, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 0,
      background: 'white', border: `1px solid ${P.line}`, borderRadius: 12, boxShadow: '0 6px 20px rgba(15,23,42,0.08)', overflow: 'hidden',
    }}>
      {/* 머리 — 패널 이름 + 연결 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.soft }}>
        <span aria-hidden="true">🖊</span>
        <b style={{ fontSize: 'var(--neo-font-size-sm)', color: P.text }}>교사펜</b>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: locked ? P.mute : conn ? '#047857' : P.sub }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: !locked && conn ? '#10B981' : '#D1D5DB' }} />
          {locked ? '잠김' : conn ? '연결됨' : '연결 안 됨'}
        </span>
      </div>

      {locked && (
        <div role="status" style={{ padding: '10px 12px', fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.55, color: '#92400E', background: '#FFFBEB', borderTop: '1px solid #FDE68A' }}>
          🔒 {locked}
        </div>
      )}

      <Section title="연결">
        {conn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: P.text, fontWeight: 700, lineHeight: 1.45 }}>
              {conn.type} · {conn.name}
              <div style={{ color: P.mute, fontWeight: 600 }}>{conn.id ? `${conn.id} · ` : ''}펜 에뮬레이터</div>
            </div>
            <IconBtn wide title="교사펜 연결 해제" onClick={() => onConnect(null)}>연결 해제</IconBtn>
          </div>
        ) : scan ? (
          /* BLE — 찾은 펜을 셀렉트에서 골라 연결 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scan === 'searching' ? (
              <div role="status" style={{ fontSize: 'var(--neo-font-size-xs)', color: P.sub }}>주변 펜을 찾는 중…</div>
            ) : (
              <>
                <label style={{ fontSize: 'var(--neo-font-size-xs)', color: P.sub }} htmlFor="tp-ble-pick">찾은 펜 {scan.length}개</label>
                <select id="tp-ble-pick" value={pick} onChange={(e) => setPick(e.target.value)}
                  style={{ width: '100%', height: 32, borderRadius: 6, border: `1px solid ${P.line}`, padding: '0 6px', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', color: P.text, background: 'white' }}>
                  {scan.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.id.slice(-5)}</option>)}
                </select>
              </>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <IconBtn wide on disabled={scan === 'searching' || !pick} title="고른 펜 연결" onClick={connectBle}>연결</IconBtn>
              <IconBtn wide title="취소" onClick={() => { clearTimeout(scanTimer.current); setScan(null); }}>취소</IconBtn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <IconBtn wide disabled={!!locked} title="블루투스로 교사펜 연결" onClick={startBle}>BLE</IconBtn>
            <IconBtn wide disabled={!!locked} title="USB로 교사펜 연결" onClick={() => onConnect({ type: 'USB', name: 'USB 연결 펜' })}>USB</IconBtn>
          </div>
        )}
      </Section>

      <Section title="색상">
        <div role="radiogroup" aria-label="첨삭 색상" style={{ display: 'flex', gap: 14 }}>
          {INK_COLORS.map((c) => {
            const on = tool.color === c.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} aria-label={c.label} title={c.label} disabled={!!locked} onClick={() => onTool({ ...tool, color: c.id })}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: 'none', background: 'none', padding: 0, cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: locked ? 0.5 : 1 }}>
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', background: c.hex, boxShadow: on ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: on ? P.text : P.sub, fontWeight: on ? 700 : 500 }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="굵기">
        <div role="radiogroup" aria-label="첨삭 굵기" style={{ display: 'flex', gap: 6 }}>
          {[false, true].map((b) => (
            <IconBtn key={String(b)} wide on={tool.bold === b} disabled={!!locked} title={b ? '진하게' : '보통'} onClick={() => onTool({ ...tool, bold: b })}>
              <span aria-hidden="true" style={{ width: 16, height: b ? 4 : 2, borderRadius: 2, background: inkHex(tool.color) }} />{b ? '진하게' : '보통'}
            </IconBtn>
          ))}
        </div>
      </Section>

      <Section title="레이어">
        {/* 디자인 툴의 레이어 줄처럼 — 눈을 끄면 학생 화면 · 리포트에서 숨김 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${P.line}`, borderRadius: 6, background: ink.visible ? 'white' : P.soft }}>
          <button type="button" aria-pressed={!ink.visible} aria-label={ink.visible ? '첨삭 숨기기' : '첨삭 보이기'} disabled={!!locked} onClick={() => update((cur) => ({ ...cur, visible: !cur.visible }))}
            title={ink.visible ? '첨삭 숨기기 — 학생 화면과 리포트에 싣지 않습니다' : '첨삭 보이기'}
            style={{ border: 'none', background: 'none', padding: 0, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 'var(--neo-font-size-base)', lineHeight: 1, opacity: locked ? 0.5 : 1 }}>{ink.visible ? '👁' : '🙈'}</button>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: ink.visible ? P.text : P.mute }}>교사 첨삭</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: P.sub }}>{n}획</span>
        </div>
        {!ink.visible && <div style={{ marginTop: 6, fontSize: 'var(--neo-font-size-xs)', color: '#B45309', lineHeight: 1.5 }}>숨김 상태에서는 쓸 수 없어요.</div>}
      </Section>

      <Section title="편집">
        {askClear ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: P.danger, fontWeight: 700 }}>이 문항 첨삭을 모두 지울까요?</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <IconBtn wide danger title="첨삭 모두 지우기" onClick={() => { update((cur) => ({ ...cur, strokes: [] })); setAskClear(false); }}>지우기</IconBtn>
              <IconBtn wide title="취소" onClick={() => setAskClear(false)}>취소</IconBtn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <IconBtn disabled={!canWrite || !n} title="되돌리기" onClick={undo}><span aria-hidden="true" style={{ fontSize: 'var(--neo-font-size-base)' }}>↶</span></IconBtn>
            <IconBtn danger disabled={!!locked || !n} title="전체 삭제" onClick={() => setAskClear(true)}><span aria-hidden="true">🗑</span></IconBtn>
          </div>
        )}
      </Section>

      {!locked && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${P.line}`, fontSize: 'var(--neo-font-size-xs)', color: P.sub, lineHeight: 1.55, background: P.soft }}>
          {conn ? (ink.visible ? '답안 위에 쓰면 바로 첨삭돼요.' : '눈을 켜면 쓸 수 있어요.') : '교사펜을 연결하면 첨삭할 수 있어요.'}
        </div>
      )}
    </aside>
  );
};

/* 학생 화면 · 리포트 — 보이는 첨삭이 있을 때만 「선생님 첨삭」 표시 */
export const InkNote = ({ inkKey: key, text = '✎ 선생님 첨삭이 함께 보여요' }) => {
  const [ink] = useInk(key);
  if (!ink.visible || !ink.strokes.length) return null;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, padding: '2px 10px' }}>{text}</span>;
};

export default InkedPen;
