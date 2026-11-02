/**
 * WorkbookLayout — 문제집 배치 (TSK-15 v1.14 · QBK-01)
 *
 * 순서 배치를 마친 문제집을 종이(A4) 지면으로 배치해 미리 본다.
 *   · 설정: 시험지 크기(A4 · B4 · A3) · 단(1단 · 2단) · 문항 간격(좁게 · 보통 · 넓게 · 한 단 2문항 · 한 단 1문항) · 배점 표시 · 이름 칸 — 바꾸면 문제집에 바로 저장
 *   · 공통 지문은 그 지문을 쓰는 첫 문항 앞에 한 번 「[1~3] 다음 글을 읽고 물음에 답하시오.」로
 *   · 유형별 답 쓰는 자리: 선다형 ①~⑤ · 양자택일형 ( A / B ) · 진위형 ( O / X ) · 연결형 · 단답형 답 칸 · 완성형 빈칸 (서술형은 테두리 답안 영역 — 아래 TSK-13 v4.03)
 * 쪽 나누기: 문항 높이를 재서 단 · 쪽을 채운다 (종이가 클수록 한 쪽에 문항이 많다). Ncode 입힌 출력 · 과제로 저장(배포·채점)은 다음 단계.
 * [TSK-13 v4.03] 답안 공간 — 문제와 답안을 나누지 않는다. entry.answerSpace에 따라 문항 바로 아래에 줄 칸이 이어지고, 단 · 쪽을 따라 흐른다
 *   'col' = 한 단 쓰기(새 단에서 시작 — 문항 + 답안이 그 단을 채운다)
 *   'half' = 반 단 쓰기(한 단 2문항 — 문항 + 답안이 단의 위쪽 반 · 아래쪽 반을 채운다)
 *   'p1'~'p10' = N쪽 쓰기(새 단에서 시작 — 문항 아래부터 채우고 쪽은 통째로(모든 단) 쓴다.
 *               문항이 쪽 맨 앞이면 그 쪽부터 N쪽, 쪽 중간(예: 2단의 오른쪽 단)이면 그 쪽 나머지 + 다음 쪽부터 N쪽 전체)
 *   서·논술형 문항과 다른 문항(정답형)이 섞이면: 답안 공간이 있는 문항만 새 단에서 시작하고, 끝난 다음 문항은 다음 단에서 이어진다
 *   정답형 문제집의 서술형 문항도 같은 선택지를 쓴다 — 서·논술 문항은 모두 테두리 답안 영역이 있다(기본 한 단)
 *   길이는 위에 따로 고르지 않고 문항마다 지면 위 도구 줄에서 고른다 (answerTools · editMode)
 */
import React from 'react';
import { PEN, MarkedNo, AnswerNote } from './GradeMarks';
import { stemParts, blankNo, blankCountOf } from './lib/itemBank';

export const DEFAULT_LAYOUT = { paper: 'A4', columns: 2, spacing: 'normal', showPoints: true, nameBox: true };
// 시험지 크기 (세로, mm) — 미리 보기는 1mm ≈ 3.78px, 화면 폭에 맞게 줄여 보인다
export const PAPERS = { A4: { w: 210, h: 297, label: 'A4 (210×297)' }, B4: { w: 257, h: 364, label: 'B4 (257×364)' }, A3: { w: 297, h: 420, label: 'A3 (297×420)' } };
const MM = 3.78;
// 문항 간격 — 넓게는 「한 단에 문항 2개」: 단 높이를 둘로 나눠 문항 사이에 풀이 공간을 둔다
// v1.51 — 좁게 = 舊 보통(40px) · 보통 80px · 넓게 130px (문항 아래 풀이 공간)
const SPACING = { narrow: 40, normal: 80, loose: 130, wide: 20, wide1: 20 };
// 한 단에 문항 수를 정하는 간격 — 단 높이를 문항 수로 나눠 문항 아래를 풀이 공간으로 (v1.19 — 한 단 1문항 추가)
const PER_COL = { wide: 2, wide1: 1 };
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
// 서·논술형 답안 길이 — 한 단 쓰기 · 1~10쪽 쓰기
// 'half' = 반 단 쓰기(한 단 2문항) — 답이 짧은 서·논술 문항용 (2026-10-29)
export const ANSWER_SPACES = [['col', '한 단 쓰기'], ['half', '반 단 쓰기 (한 단 2문항)'], ...Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, `${i + 1}쪽 쓰기`])];
const pagesOfSpace = (s) => (/^p\d+$/.test(s || '') ? Number(s.slice(1)) : 0);
const isEssayItem = (it) => it.itemType === 'essay' || it.itemType === 'essay_sheet';
// 서·논술 문항(서·논술형 문제지 · 정답형 문제집의 서술형)은 모두 테두리 답안 영역이 있다 — 기본 한 단 (2026-10-29 「답 칸 없음」 폐기)
const answerOptionsOf = () => ANSWER_SPACES;
const answerOf = (e) => e.answerSpace || (isEssayItem(e.item) ? 'col' : undefined);
// 'h120' = 높이 직접 조절(px) — 답안 영역 아래 손잡이를 끌어 줄이고 늘인다. 새 단에서 시작하지 않아 한 단에 여러 문항이 이어진다 (2026-10-30)
const customH = (s) => (/^h\d+$/.test(s || '') ? Number(s.slice(1)) : 0);
const startOf = (s) => (customH(s) ? undefined : s);
const MIN_SEG = 56; // 단 아래 남은 높이가 이보다 작으면 답안 영역을 다음 단부터
// 답안 영역 — 정해진 높이, 테두리로 범위만 정한다(Ncode를 입힐 답안 영역의 경계) · 행선(쓰기 줄)은 두지 않는다 (2026-10-29)
//   data-answer-area — 어느 문항의 답안 영역인지 (Ncode 영역 매핑 · 인쇄에도 남는다)
//   onResize(px) — 정답형 문제집 배치(editMode)에서만. 서·논술형 문제지(answerTools)는 답안 길이 선택만 (2026-10-30)
//   있으면 아래 손잡이(인쇄 안 됨)를 끌어 높이를 바꾼다. 끄는 동안은 상자만 바뀌고, 놓으면 쪽 나누기를 다시 한다
const AnswerLines = ({ label, height, qid, onResize, zoom = 1, max }) => {
  const ref = React.useRef(null);
  const [live, setLive] = React.useState(null);
  const down = (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const y0 = ev.clientY; const h0 = height;
    const clamp = (h) => Math.round(Math.max(MIN_SEG, Math.min(max || h, h)));
    const move = (e) => setLive(clamp(h0 + (e.clientY - y0) / zoom));
    const up = (e) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); setLive(null); const h = clamp(h0 + (e.clientY - y0) / zoom); if (h !== h0) onResize(h); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  return (
    <div ref={ref} data-answer-area={qid} style={{ position: 'relative', height: live ?? height, boxSizing: 'border-box', border: '1.5px solid #0F172A', borderRadius: 2, overflow: onResize ? 'visible' : 'hidden' }}>
      {label && <div style={{ padding: '2px 8px', borderBottom: '1px solid #0F172A', background: '#F1F5F9', fontSize: 11, fontWeight: 800 }}>{label}</div>}
      {onResize && (
        <div data-edit-toolbar role="separator" aria-orientation="horizontal" aria-label="답안 영역 높이 조절" title="끌어서 답안 영역 높이 조절" onMouseDown={down}
          style={{ position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)', width: 56, height: 12, borderRadius: 6, background: '#2A75F3', cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, lineHeight: 1, fontFamily: 'Pretendard, sans-serif', userSelect: 'none' }}>
          {live != null ? `${Math.round(live / MM)}mm` : '⇕'}
        </div>
      )}
    </div>
  );
};

const chip = (on) => ({
  padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer',
  border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569',
});
const optLabel = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' };

// 지문 — 완성형 [빈칸] 자리에 ( ① ) 를 찍는다 (답은 아래 ① 칸에 쓴다)
const SheetStem = ({ stem }) => stemParts(stem).map((p, k) => ('blank' in p
  ? <span key={k} style={{ whiteSpace: 'nowrap' }}>(&nbsp;&nbsp;{blankNo(p.blank)}&nbsp;&nbsp;)</span>
  : <React.Fragment key={k}>{p.text}</React.Fragment>));

// 유형별 답 쓰는 자리
//   g(채점 상세) — { ans{text,uncertain}, v(○✗?), correct } : 고른 답에 펜 동그라미, 쓴 답은 펜 글씨, 틀리면 옆에 정답
const penRing = { border: '2px solid #2563EB', borderRadius: '50%', padding: '0 3px', margin: '0 -5px' };
const AnswerArea = ({ item, g = null }) => {
  const ch = item.choices || [];
  const picked = (t) => g && String(g.ans?.text || '').trim() === String(t).trim();
  const note = g ? <AnswerNote v={g.v} correct={g.correct} uncertain={g.ans?.uncertain} /> : null;
  const pen = g ? <span style={PEN}>{g.ans?.text || ''}</span> : null;
  switch (item.itemType) {
    case 'multiple_choice':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: ch.some((c) => (c.text || '').length > 14) ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: '2px 12px', marginTop: 4 }}>
          {ch.map((c) => { const mk = CIRCLED[c.no - 1] || c.no; return <div key={c.no}><span style={picked(mk) ? penRing : undefined}>{mk}</span> {c.text}</div>; })}
          {note && <div>{note}</div>}
        </div>
      );
    case 'binary_choice':
      return <div style={{ marginTop: 4 }}>( <span style={picked(ch[0]?.text) ? penRing : undefined}>{ch[0]?.text || '　'}</span> / <span style={picked(ch[1]?.text) ? penRing : undefined}>{ch[1]?.text || '　'}</span> ){note}</div>;
    case 'true_false':
      return <div style={{ marginTop: 4, textAlign: 'right' }}>( <span style={picked('O') ? penRing : undefined}>O</span> / <span style={picked('X') ? penRing : undefined}>X</span> ){note}</div>;
    case 'matching': {
      const m = item.matching || { left: [], right: [] };
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: '2px 6px', marginTop: 4, alignItems: 'center' }}>
          {Array.from({ length: Math.max(m.left.length, m.right.length) }).map((_, i) => (
            <React.Fragment key={i}>
              <div>{m.left[i] ? `(${i + 1}) ${m.left[i]} •` : ''}</div><div />
              <div>{m.right[i] ? `• ${'ㄱㄴㄷㄹㅁㅂㅅㅇ'[i] || i + 1}. ${m.right[i]}` : ''}</div>
            </React.Fragment>
          ))}
          {g && <div style={{ gridColumn: '1 / -1' }}>답: {pen}{note}</div>}
        </div>
      );
    }
    case 'short_answer':
      return <div style={{ marginTop: 6 }}>답: <span style={{ display: 'inline-block', width: '60%', borderBottom: '1px solid #334155' }}>{pen || <>&nbsp;</>}</span>{note}</div>;
    case 'completion':
      return (
        <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: blankCountOf(item) }).map((_, i) => (
            <span key={i}>{blankNo(i)} <span style={{ display: 'inline-block', minWidth: 90, borderBottom: '1px solid #334155' }}>{(i === 0 && pen) || <>&nbsp;</>}</span></span>
          ))}
          {note}
        </div>
      );
    case 'essay':
      // 문제집은 문제지에 바로 풀므로 서술형 답 칸(줄 박스)을 두지 않는다 — 채점 상세에서만 쓴 답을 보인다
      return g ? <div style={{ marginTop: 6 }}>답: {pen}{note}</div> : null;
    default: return g ? <div style={{ marginTop: 6 }}>답: {pen}{note}</div> : null;
  }
};

// 같은 공통 지문을 쓰는 문항 범위 — 「[1~3]」
const passageRanges = (entries) => {
  const r = {};
  entries.forEach((e, i) => { const p = e.item.passageId; if (!p) return; r[p] = r[p] ? { ...r[p], to: i + 1 } : { from: i + 1, to: i + 1, first: i }; });
  return r;
};

// 쪽 나누기 — 블록(공통 지문 · 문항) 높이를 실제로 재서 단을 위에서부터 채우고, 넘치면 다음 단 · 다음 쪽으로
//   종이가 클수록(A3 > B4 > A4) 한 쪽에 들어가는 문항이 많다. 한 블록이 한 단보다 길면 그 단에 혼자 둔다
const PAD_V = 48; const PAD_H = 44; const COL_GAP = 28; const FOOTER = 24;
const SHEET_FONT = { fontFamily: '"Noto Serif KR", "Batang", serif', fontSize: 13, lineHeight: 1.6, color: '#0F172A' };

// 편집 모드 (TSK-15 v1.18) — 문항을 끌어다 놓아 순서를 바꾸고(번호·쪽 나누기 자동), 도구 막대로 배점 · 수정 · 빼기
//   공통 지문을 함께 쓰는 문항은 묶음으로 움직인다. 묶음 안의 다른 문항 위에 놓으면 묶음 안에서 순서만 바꾼다 (v1.52 — ↑↓ 삭제). 마우스 끌기만 지원(터치 제외)
//   editMode · onOrder(ids) · onPoints(id, 점수) · onEdit(index) · onRemove(id) · actualSize(100%로 보기)
const unitOf = (entries, id) => {
  const it = entries.find((e) => e.item.id === id)?.item;
  return it?.passageId ? entries.filter((e) => e.item.passageId === it.passageId).map((e) => e.item.id) : [id];
};
export const reorderByDrop = (entries, dragId, targetId, before) => {
  const ids = entries.map((e) => e.item.id);
  const unit = unitOf(entries, dragId);
  if (dragId === targetId) return ids;
  if (unit.includes(targetId)) { // 같은 공통 지문 묶음 안 — 그 문항만 옮긴다
    const rest = ids.filter((x) => x !== dragId);
    const at = rest.indexOf(targetId) + (before ? 0 : 1);
    return [...rest.slice(0, at), dragId, ...rest.slice(at)];
  }
  const rest = ids.filter((x) => !unit.includes(x));
  const tUnit = unitOf(entries, targetId);
  const anchor = before ? tUnit[0] : tUnit[tUnit.length - 1];
  const at = rest.indexOf(anchor) + (before ? 0 : 1);
  return [...rest.slice(0, at), ...unit, ...rest.slice(at)];
};
export const scrollParentOf = (el) => { let p = el?.parentElement; while (p) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p; p = p.parentElement; } return document.scrollingElement; };
const tb = { whiteSpace: 'nowrap', flexShrink: 0, padding: '1px 6px', borderRadius: 6, border: '1px solid #CBD5E1', background: 'white', fontFamily: 'Pretendard, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#334155' };

// grading — 채점 상세(TSK-15 v1.44): { answers{id:{text,uncertain}}, marks{id:true|false|null}, correct{id:정답}, onMark(id) } — 문항을 누르면 O ↔ X
export const WorkbookSheet = ({ title, curriculum, entries, passages = {}, layout, editMode = false, onOrder, onPoints, onEdit, onRemove, actualSize = false, grading = null, answerTools = false, onAnswerSpace }) => {
  const [armed, setArmed] = React.useState(null);   // ⠿를 누른 문항 — 그 문항만 끌 수 있다
  const [dragId, setDragId] = React.useState(null);
  const [over, setOver] = React.useState(null);     // { key, before }
  const L = { ...DEFAULT_LAYOUT, ...(layout || {}) };
  const paper = PAPERS[L.paper] || PAPERS.A4;
  const pageW = Math.round(paper.w * MM); const pageH = Math.round(paper.h * MM);
  const colW = Math.floor((pageW - PAD_H * 2 - COL_GAP * (L.columns - 1)) / L.columns);
  const ranges = passageRanges(entries);
  const total = entries.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const curText = [curriculum?.schoolLevelName, curriculum?.gradeLabel, curriculum?.curriculumName, curriculum?.subjectName].filter(Boolean).join(' · ');
  const gap = SPACING[L.spacing];

  const header = (
    <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: 8, marginBottom: 14, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{title || '제목 없음'}</div>
        <div style={{ fontSize: 11, color: '#475569' }}>{curText}{curText ? ' · ' : ''}{entries.length}문항{L.showPoints ? ` · 총 ${total}점` : ''}</div>
      </div>
      {L.nameBox && (
        <div style={{ display: 'flex', border: '1px solid #0F172A', fontSize: 11 }}>
          {['학년', '반', '번호', '이름'].map((h) => (
            <div key={h} style={{ borderLeft: h === '학년' ? 'none' : '1px solid #0F172A' }}>
              <div style={{ padding: '1px 8px', borderBottom: '1px solid #0F172A', background: '#F1F5F9', textAlign: 'center' }}>{h}</div>
              <div style={{ height: 22, width: h === '이름' ? 80 : 40 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 블록 목록 — 공통 지문은 쓰는 첫 문항 앞에 한 번
  const blocks = [];
  const usage = {}; // { [문항 id]: { from, to } } — 문항이 놓인 쪽 ~ 답안이 끝나는 쪽
  entries.forEach((e, i) => {
    const it = e.item;
    const pr = it.passageId && ranges[it.passageId]?.first === i ? ranges[it.passageId] : null;
    if (pr) {
      const ps = passages[it.passageId];
      // 답안 공간이 있는 문항이 지문 묶음의 첫 문항이면 지문부터 새 단/쪽에서
      blocks.push({ key: `p-${it.passageId}`, gapAfter: gap / 2, start: startOf(answerOf(e)), node: (
        <>
          <div style={{ fontWeight: 800 }}>[{pr.from}{pr.to > pr.from ? `~${pr.to}` : ''}] 다음 글을 읽고 물음에 답하시오.</div>
          {ps?.text && <div style={{ border: '1px solid #94A3B8', padding: '6px 10px', marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 12 }}>{ps.text}</div>}
        </>
      ) });
    }
    const ans = answerOf(e);
    const ansSelect = isEssayItem(it) && onAnswerSpace ? (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>답안
        <select value={ans || 'col'} onChange={(ev) => onAnswerSpace(it.id, ev.target.value)} aria-label={`${i + 1}번 답안 길이`}
          style={{ maxWidth: 150, minWidth: 0, width: '100%', padding: '1px 4px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'Pretendard, sans-serif' }}>
          {customH(ans) > 0 && <option value={ans}>높이 직접 ({Math.round(customH(ans) / MM)}mm)</option>}
          {answerOptionsOf(it).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
    ) : null;
    blocks.push({ key: it.id, no: i + 1, idx: i, gapAfter: ans ? 6 : gap, answer: ans, start: pr ? undefined : startOf(ans), node: (
      <>
        {/* 답안 길이만 고르는 도구 줄 (서·논술형 문제지 배치) — 인쇄에는 나오지 않는다 */}
        {!editMode && answerTools && ansSelect && (
          <div data-edit-toolbar style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4, padding: '2px 6px', background: '#F5F3FF', borderRadius: 6, fontFamily: 'Pretendard, sans-serif' }}>
            <b style={{ fontSize: 11, color: '#6D28D9' }}>{i + 1}번</b>{ansSelect}
          </div>
        )}
        {editMode && (
          <div data-edit-toolbar style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 4, marginBottom: 4, padding: '2px 4px', background: '#EFF6FF', borderRadius: 6, fontFamily: 'Pretendard, sans-serif' }}>
            <span role="button" aria-label={`${i + 1}번 끌어서 옮기기`} title="끌어서 옮기기" onMouseDown={() => setArmed(it.id)} onMouseUp={() => setArmed(null)}
              style={{ ...tb, cursor: 'grab', background: '#DBEAFE' }}>⠿ {i + 1}번</span>
            <input type="number" min={0} value={e.points} aria-label={`${i + 1}번 배점`} onChange={(ev) => onPoints?.(it.id, ev.target.value === '' ? '' : Number(ev.target.value))}
              style={{ width: 44, padding: '1px 4px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11, textAlign: 'center' }} />
            <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>점</span>
            <span style={{ flex: 1 }} />
            {ansSelect}
            <button type="button" onClick={() => onEdit?.(i)} aria-label={`${i + 1}번 문항 수정`} title="수정" style={tb}>✏️</button>
            <button type="button" onClick={() => onRemove?.(it.id)} aria-label={`${i + 1}번 빼기`} title="빼기" style={{ ...tb, color: '#B91C1C', borderColor: '#FCA5A5' }}>🗑</button>
          </div>
        )}
        <div>{grading ? <MarkedNo no={i + 1} v={grading.marks?.[it.id]} /> : <b>{i + 1}.</b>} {it.stem ? <SheetStem stem={it.stem} /> : '(발문 없음)'}{L.showPoints && <span style={{ fontSize: 11, color: '#475569' }}> [{Number(e.points) || 0}점]</span>}</div>
        {it.material && <div style={{ border: '1px solid #94A3B8', padding: '4px 10px', margin: '4px 0', whiteSpace: 'pre-wrap', fontSize: 12 }}><b>&lt;보기&gt;</b> {it.material}</div>}
        {(it.images || []).map((im, k) => <img key={k} src={im.dataUrl} alt={im.label || ''} style={{ maxWidth: '100%', maxHeight: 180, display: 'block', margin: '4px 0' }} />)}
        <AnswerArea item={it} g={grading ? { ans: grading.answers?.[it.id], v: grading.marks?.[it.id], correct: grading.correct?.[it.id] } : null} />
      </>
    ) });
  });

  // 높이 재기 — 화면 밖 단 폭 상자에 그려서 잰다 (그림이 늦게 뜨면 다시 잰다)
  const measureRef = React.useRef(null);
  const headerRef = React.useRef(null);
  const [heights, setHeights] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const sig = `${editMode}|${grading ? 'g' : ''}|${L.paper}|${L.columns}|${L.spacing}|${L.showPoints}|${L.nameBox}|${title}|${curText}|${blocks.map((b) => b.key).join(',')}|${entries.map((e) => `${e.points}:${e.item.updatedAt || ''}:${e.item.itemType}:${e.answerSpace || ''}`).join(',')}`;
  React.useLayoutEffect(() => {
    if (!measureRef.current) return;
    const hs = [...measureRef.current.children].map((el) => el.getBoundingClientRect().height);
    const hh = headerRef.current ? headerRef.current.getBoundingClientRect().height + 14 : 0;
    setHeights({ blocks: hs, header: hh });
  }, [sig, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // 쪽 · 단 채우기
  const pages = [];
  if (heights && blocks.length) {
    const avail = (first) => pageH - PAD_V * 2 - FOOTER - (first ? heights.header : 0);
    const perCol = PER_COL[L.spacing] || 0;
    let page = { cols: [[]], first: true }; let used = 0; let first = true; let nItems = 0;
    pages.push(page);
    const col = () => page.cols[page.cols.length - 1];
    const nextCol = () => {
      if (page.cols.length < L.columns) page.cols.push([]);
      else { page = { cols: [[]], first: false }; pages.push(page); first = false; }
      used = 0; nItems = 0; colHalf = 0;
    };
    let colHalf = 0; // 지금 단에 놓인 반 단 문항 수 (2 = 더 못 넣음)
    // 답안 줄 칸 한 조각을 지금 단에 — 높이 hh
    let segN = 0;
    const pushSeg = (b, hh, label) => {
      const g = used > 0 ? col().slice(-1)[0].gapAfter : 0;
      col().push({ key: `a-${b.key}-${segN += 1}`, seg: true, qid: b.key, height: hh, label, gapAfter: gap, resizable: !label && !pagesOfSpace(b.answer), first });
      used += g + hh;
    };
    blocks.forEach((b, idx) => {
      // 시작 규칙 — 답안 공간이 있는 문항은 새 단에서 (지금 단이 비어 있으면 그대로) — 빈 단이 남지 않게 쪽 쓰기도 단 단위로
      //   반 단 쓰기는 지금 단 위쪽 반에 반 단 문항 하나만 있으면 아래쪽 반에 이어서
      if (b.start === 'half') { if (col().length > 0 && colHalf !== 1) nextCol(); }
      else if (b.start && col().length > 0) nextCol();
      if (!b.start && b.no && colHalf === 1) colHalf = 2; // 반 단 문항 뒤에 다른 문항이 오면 그 단에는 더 넣지 않는다
      const h = heights.blocks[idx] || 0;
      const prevGap = used > 0 ? page.cols[page.cols.length - 1].slice(-1)[0].gapAfter : 0;
      // 넓게: 이 단에 문항이 이미 2개면 다음 단으로 (공통 지문은 뒤 문항과 같은 단에 오도록 문항 수로만 센다)
      const full = perCol > 0 && nItems >= perCol;
      if (used > 0 && (full || used + prevGap + h > avail(first))) {
        if (page.cols.length < L.columns) page.cols.push([]);
        else { page = { cols: [[]], first: false }; pages.push(page); first = false; }
        used = 0; nItems = 0; colHalf = 0;
      }
      const g = used > 0 ? page.cols[page.cols.length - 1].slice(-1)[0].gapAfter : 0;
      page.cols[page.cols.length - 1].push(b);
      used += g + h;
      if (b.no) nItems += 1;
      if (b.no) usage[b.key] = { from: pages.length, to: pages.length };
      // 답안 공간 — 문항 바로 아래부터 줄 칸을 채운다
      if (b.answer) {
        const rest = () => avail(first) - used - 6;
        const label = `${b.no}번 답안 (이어서)`;
        if (b.answer === 'half') {
          // 반 단 쓰기 — 문항 + 답안이 단 높이의 반을 채운다 (위쪽 반 → 아래쪽 반)
          const halfH = Math.floor(avail(first) / 2);
          const end = colHalf === 0 ? halfH - gap / 2 : avail(first);
          pushSeg(b, Math.max(MIN_SEG, end - used - 6));
          colHalf += 1;
          used = colHalf >= 2 ? avail(first) + 1 : Math.max(used, halfH - gap);
        } else if (customH(b.answer)) {
          // 높이 직접 — 지금 단에 들어가면 이어서, 아니면 다음 단에. 끝난 뒤 다음 문항은 같은 단에 이어진다
          const hh = Math.min(customH(b.answer), avail(first));
          if (rest() < hh) nextCol();
          pushSeg(b, hh);
        } else if (b.answer === 'col') {
          if (rest() >= MIN_SEG) pushSeg(b, rest());
          else { nextCol(); pushSeg(b, avail(first), label); }
          used = avail(first) + 1; // 다음 블록은 다음 단에서
        } else {
          // N쪽 쓰기 — 문항 아래 남은 곳부터 채우고, 쪽은 통째로(모든 단) 쓴다
          //   문항이 쪽 맨 앞(첫 단 · 앞에 다른 문항 없음)이면 그 쪽부터 N쪽, 쪽 중간이면 그 쪽 나머지 + 다음 쪽부터 N쪽 전체
          const n = pagesOfSpace(b.answer);
          const startPage = pages.length - 1;
          const atPageStart = page.cols.length === 1 && col().filter((x) => x.no).length === 1;
          const endPage = startPage + n - (atPageStart ? 1 : 0);
          if (rest() >= MIN_SEG) pushSeg(b, rest());
          while (!(pages.length - 1 === endPage && page.cols.length === L.columns)) { nextCol(); pushSeg(b, avail(first), label); }
          used = avail(first) + 1;
        }
        usage[b.key].to = pages.length;
      }
    });
  }
  if (pages.length > 1 && pages[pages.length - 1].cols.every((c) => c.length === 0)) pages.pop();
  // 미리 보기는 화면 폭에 맞춰 줄인다 (잘리지 않게)
  const boxRef = React.useRef(null);
  const [boxW, setBoxW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!boxRef.current) return undefined;
    const ro = new ResizeObserver(([en]) => setBoxW(en.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);
  const zoom = actualSize ? 1 : (boxW ? Math.min(1, boxW / pageW) : 1);
  // 끌어다 놓기 — 놓을 자리(문항 위/아래)를 파란 선으로 보이고, 놓으면 순서를 바꾼다
  const blockDnd = (b) => {
    if (!editMode) return {};
    const targetId = b.no ? b.key : entries.find((e) => `p-${e.item.passageId}` === b.key)?.item.id; // 지문 위 = 그 묶음 앞
    return {
      draggable: !!b.no && armed === b.key,
      onDragStart: (ev) => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', b.key); setDragId(b.key); },
      onDragEnd: () => { setDragId(null); setOver(null); setArmed(null); },
      onDragOver: (ev) => {
        if (!dragId) return;
        ev.preventDefault();
        const ids = entries.map((x) => x.item.id);
        const before = b.no ? ids.indexOf(targetId) < ids.indexOf(dragId) : true;
        if (!over || over.key !== b.key || over.before !== before) setOver({ key: b.key, before, no: ids.indexOf(targetId) + 1 });
        const sp = scrollParentOf(ev.currentTarget); const sr = sp === document.scrollingElement ? { top: 0, bottom: innerHeight } : sp.getBoundingClientRect();
        if (ev.clientY < sr.top + 60) sp.scrollBy(0, -24); else if (ev.clientY > sr.bottom - 60) sp.scrollBy(0, 24);
      },
      onDrop: (ev) => {
        ev.preventDefault();
        if (dragId && targetId) { const ids = entries.map((x) => x.item.id); onOrder?.(reorderByDrop(entries, dragId, targetId, b.no ? ids.indexOf(targetId) < ids.indexOf(dragId) : true)); }
        setDragId(null); setOver(null); setArmed(null);
      },
    };
  };
  const isTarget = (b) => over && over.key === b.key && dragId && b.key !== dragId;
  const dropLine = (b) => (isTarget(b) ? { boxShadow: over.before ? 'inset 0 4px 0 #2A75F3' : 'inset 0 -4px 0 #2A75F3', background: 'rgba(42,117,243,0.06)' } : {});
  // 놓으면 갈 번호를 미리 보인다
  const dropBadge = (b) => (isTarget(b) ? (
    <span style={{ position: 'absolute', right: 6, [over.before ? 'top' : 'bottom']: -10, background: '#2A75F3', color: 'white', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 800, fontFamily: 'Pretendard, sans-serif', pointerEvents: 'none', zIndex: 2 }}>
      {b.no ? `${over.no}번 자리로` : '이 지문 묶음 앞으로'}
    </span>
  ) : null);
  const availOf = (first) => (heights ? pageH - PAD_V * 2 - FOOTER - (first ? heights.header : 0) : 0);
  const perPage = pages.map((pg) => pg.cols.flat().filter((b) => b.no).length);

  return (
    <div ref={boxRef} style={{ background: '#E2E8F0', padding: 16, borderRadius: 12, overflow: actualSize ? 'auto' : 'hidden', position: 'relative' }}>
      {/* 잴 때만 쓰는 상자 */}
      <div aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: -10000, top: 0, ...SHEET_FONT }}>
        <div ref={headerRef} style={{ width: pageW - PAD_H * 2 }}>{header}</div>
        <div ref={measureRef} style={{ width: colW }} onLoadCapture={() => setTick((t) => t + 1)}>
          {blocks.map((b) => <div key={b.key} style={{ display: 'flow-root' }}>{b.node}</div>)}
        </div>
      </div>
      {pages.length > 0 && (
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          {paper.label} · {L.columns}단 · {pages.length}쪽 — 쪽마다 문항 {perPage.join(' · ')}개
        </div>
      )}
      <div aria-label="문제집 지면 미리 보기" data-paper={L.paper} data-pages={pages.length} style={{ zoom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {pages.map((pg, pi) => (
          <div key={pi} data-page={pi + 1} style={{ width: pageW, height: pageH, background: 'white', boxShadow: '0 2px 12px rgba(15,23,42,0.15)', padding: `${PAD_V}px ${PAD_H}px`, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', ...SHEET_FONT }}>
            {pi === 0 && header}
            <div style={{ display: 'flex', gap: COL_GAP }}>
              {Array.from({ length: L.columns }).map((_, ci) => (
                // 답안 영역이 있는 단은 문항 간격 「한 단 2문항 · 1문항」의 높이 나누기를 하지 않는다 — 문항이 줄어 답안 영역과 겹치지 않게
                (() => { const fit = PER_COL[L.spacing] && !(pg.cols[ci] || []).some((b) => b.seg); return (
                <div key={ci} style={{ width: colW, flex: '0 0 auto', position: 'relative', ...(fit ? { height: availOf(pg.first), display: 'flex', flexDirection: 'column' } : {}) }}>
                  {/* 단 사이 세로선 없음 (2026-10-29) */}
                  {(pg.cols[ci] || []).map((b, bi) => (
                    // 넓게: 문항이 단 높이를 나눠 갖고(1/2씩) 남는 아래쪽이 풀이 공간
                    <div key={b.key} data-block={b.key} {...blockDnd(b)} {...(grading && b.no ? { onClick: () => grading.onMark?.(b.key), title: '누르면 O ↔ X', 'data-grade-row': b.key } : {})} style={{ display: 'flow-root', ...(grading && b.no ? { cursor: 'pointer', borderRadius: 4, background: grading.marks?.[b.key] == null ? 'rgba(254,243,199,0.6)' : undefined } : {}), marginTop: bi > 0 ? pg.cols[ci][bi - 1].gapAfter : 0, position: 'relative', ...(fit && b.no ? { flex: '1 1 0', minHeight: 0 } : {}),
                      ...(editMode ? { opacity: dragId === b.key ? 0.4 : dragId && unitOf(entries, dragId).includes(b.key) ? 0.7 : 1 } : {}), ...dropLine(b) }}>{b.seg ? <AnswerLines height={b.height} label={b.label} qid={b.qid} zoom={zoom} max={availOf(b.first)}
                        onResize={b.resizable && onAnswerSpace && editMode && !answerTools && !grading ? (h) => onAnswerSpace(b.qid, `h${h}`) : null} /> : b.node}{dropBadge(b)}</div>
                  ))}
                </div>
                ); })()
              ))}
            </div>
            <div style={{ position: 'absolute', bottom: PAD_V / 2, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#64748B' }}>{pi + 1} / {pages.length}</div>
          </div>
        ))}
        {entries.length === 0 && <div style={{ width: pageW, height: pageH, background: 'white', color: '#94A3B8', textAlign: 'center', paddingTop: 80 }}>문항이 없습니다.</div>}
      </div>
    </div>
  );
};

// children — 오른쪽 끝에 붙는 보기 설정(100%로 보기 등)
export const LayoutOptions = ({ layout, onChange, children }) => {
  const L = { ...DEFAULT_LAYOUT, ...(layout || {}) };
  const set = (k, v) => onChange({ ...L, [k]: v });
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 6 }}>시험지 크기
        <select value={L.paper} onChange={(e) => set('paper', e.target.value)} aria-label="시험지 크기"
          style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}>
          {Object.entries(PAPERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </label>
      <span style={{ ...optLabel, marginLeft: 6 }}>단</span>
      {[1, 2].map((n) => <button key={n} type="button" onClick={() => set('columns', n)} style={chip(L.columns === n)} aria-pressed={L.columns === n}>{n}단</button>)}
      <span style={{ ...optLabel, marginLeft: 6 }}>문항 간격</span>
      {[['narrow', '좁게'], ['normal', '보통'], ['loose', '넓게'], ['wide', '한 단 2문항'], ['wide1', '한 단 1문항']].map(([k, l]) => <button key={k} type="button" onClick={() => set('spacing', k)} style={chip(L.spacing === k)} aria-pressed={L.spacing === k}>{l}</button>)}
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 6 }}><input type="checkbox" checked={L.showPoints} onChange={(e) => set('showPoints', e.target.checked)} /> 배점 표시</label>
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={L.nameBox} onChange={(e) => set('nameBox', e.target.checked)} /> 이름 칸</label>
      {children && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{children}</span>}
    </div>
  );
};
