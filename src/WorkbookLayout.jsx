/**
 * WorkbookLayout — 문제집 배치 (TSK-15 v1.14 · QBK-01)
 *
 * 순서 배치를 마친 문제집을 종이(A4) 지면으로 배치해 미리 본다.
 *   · 설정: 시험지 크기(A4 · B4 · A3) · 단(1단 · 2단) · 문항 간격(좁게 · 보통 · 넓게) · 배점 표시 · 이름 칸 — 바꾸면 문제집에 바로 저장
 *   · 공통 지문은 그 지문을 쓰는 첫 문항 앞에 한 번 「[1~3] 다음 글을 읽고 물음에 답하시오.」로
 *   · 유형별 답 쓰는 자리: 선다형 ①~⑤ · 양자택일형 ( A / B ) · 진위형 ( O / X ) · 연결형 · 단답형 답 칸 · 완성형 빈칸 · 서술형 줄 칸
 * 실제 쪽 나누기 · Ncode 입힌 출력 · 과제로 저장(배포·채점)은 다음 단계에서 한다.
 */
import React from 'react';

export const DEFAULT_LAYOUT = { paper: 'A4', columns: 2, spacing: 'normal', showPoints: true, nameBox: true };
// 시험지 크기 (세로, mm) — 미리 보기는 1mm ≈ 3.78px, 화면 폭에 맞게 줄여 보인다
export const PAPERS = { A4: { w: 210, h: 297, label: 'A4 (210×297)' }, B4: { w: 257, h: 364, label: 'B4 (257×364)' }, A3: { w: 297, h: 420, label: 'A3 (297×420)' } };
const MM = 3.78;
const PREVIEW_MAX = 794; // 미리 보기 최대 폭(px)
const SPACING = { narrow: 10, normal: 20, wide: 34 };
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

const chip = (on) => ({
  padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer',
  border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', color: on ? '#1D4ED8' : '#475569',
});
const optLabel = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' };

// 유형별 답 쓰는 자리
const AnswerArea = ({ item }) => {
  const ch = item.choices || [];
  switch (item.itemType) {
    case 'multiple_choice':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: ch.some((c) => (c.text || '').length > 14) ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: '2px 12px', marginTop: 4 }}>
          {ch.map((c) => <div key={c.no}>{CIRCLED[c.no - 1] || c.no} {c.text}</div>)}
        </div>
      );
    case 'binary_choice':
      return <div style={{ marginTop: 4 }}>( {ch[0]?.text || '　'} / {ch[1]?.text || '　'} )</div>;
    case 'true_false':
      return <div style={{ marginTop: 4, textAlign: 'right' }}>( O / X )</div>;
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
        </div>
      );
    }
    case 'short_answer':
      return <div style={{ marginTop: 6 }}>답: <span style={{ display: 'inline-block', width: '60%', borderBottom: '1px solid #334155' }}>&nbsp;</span></div>;
    case 'completion':
      return (
        <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: Math.max(1, item.blankCount || 1) }).map((_, i) => (
            <span key={i}>({i + 1}) <span style={{ display: 'inline-block', width: 90, borderBottom: '1px solid #334155' }}>&nbsp;</span></span>
          ))}
        </div>
      );
    case 'essay':
      return (
        <div style={{ marginTop: 6, border: '1px solid #94A3B8', borderRadius: 2, padding: '4px 8px' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 22, borderBottom: i < 3 ? '1px dashed #CBD5E1' : 'none' }} />)}
        </div>
      );
    default: return null;
  }
};

// 같은 공통 지문을 쓰는 문항 범위 — 「[1~3]」
const passageRanges = (entries) => {
  const r = {};
  entries.forEach((e, i) => { const p = e.item.passageId; if (!p) return; r[p] = r[p] ? { ...r[p], to: i + 1 } : { from: i + 1, to: i + 1, first: i }; });
  return r;
};

export const WorkbookSheet = ({ title, curriculum, entries, passages = {}, layout }) => {
  const L = { ...DEFAULT_LAYOUT, ...(layout || {}) };
  const paper = PAPERS[L.paper] || PAPERS.A4;
  const ranges = passageRanges(entries);
  const total = entries.reduce((s, e) => s + (Number(e.points) || 0), 0);
  const curText = [curriculum?.schoolLevelName, curriculum?.gradeLabel, curriculum?.curriculumName, curriculum?.subjectName].filter(Boolean).join(' · ');
  return (
    <div style={{ background: '#E2E8F0', padding: 16, borderRadius: 12, overflowX: 'auto' }}>
      <div aria-label="문제집 지면 미리 보기" data-paper={L.paper} style={{ width: Math.round(paper.w * MM), minHeight: Math.round(paper.h * MM), zoom: Math.min(1, PREVIEW_MAX / (paper.w * MM)), margin: '0 auto', background: 'white', boxShadow: '0 2px 12px rgba(15,23,42,0.15)', padding: '48px 44px', boxSizing: 'border-box', fontFamily: '"Noto Serif KR", "Batang", serif', fontSize: 13, lineHeight: 1.6, color: '#0F172A' }}>
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
        <div style={{ columnCount: L.columns, columnGap: 28, columnRule: L.columns > 1 ? '1px solid #CBD5E1' : 'none' }}>
          {entries.map((e, i) => {
            const it = e.item;
            const pr = it.passageId && ranges[it.passageId]?.first === i ? ranges[it.passageId] : null;
            const ps = pr ? passages[it.passageId] : null;
            return (
              <React.Fragment key={it.id}>
                {pr && (
                  <div style={{ breakInside: 'avoid', marginBottom: SPACING[L.spacing] / 2 }}>
                    <div style={{ fontWeight: 800 }}>[{pr.from}{pr.to > pr.from ? `~${pr.to}` : ''}] 다음 글을 읽고 물음에 답하시오.</div>
                    {ps?.text && <div style={{ border: '1px solid #94A3B8', padding: '6px 10px', marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 12 }}>{ps.text}</div>}
                  </div>
                )}
                <div style={{ breakInside: 'avoid', marginBottom: SPACING[L.spacing] }}>
                  <div><b>{i + 1}.</b> {it.stem || '(발문 없음)'}{L.showPoints && <span style={{ fontSize: 11, color: '#475569' }}> [{Number(e.points) || 0}점]</span>}</div>
                  {it.material && <div style={{ border: '1px solid #94A3B8', padding: '4px 10px', margin: '4px 0', whiteSpace: 'pre-wrap', fontSize: 12 }}><b>&lt;보기&gt;</b> {it.material}</div>}
                  {(it.images || []).map((im, k) => <img key={k} src={im.dataUrl} alt={im.label || ''} style={{ maxWidth: '100%', maxHeight: 180, display: 'block', margin: '4px 0' }} />)}
                  <AnswerArea item={it} />
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {entries.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 40, fontFamily: 'inherit' }}>문항이 없습니다.</div>}
      </div>
    </div>
  );
};

export const LayoutOptions = ({ layout, onChange }) => {
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
      {[['narrow', '좁게'], ['normal', '보통'], ['wide', '넓게']].map(([k, l]) => <button key={k} type="button" onClick={() => set('spacing', k)} style={chip(L.spacing === k)} aria-pressed={L.spacing === k}>{l}</button>)}
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 6 }}><input type="checkbox" checked={L.showPoints} onChange={(e) => set('showPoints', e.target.checked)} /> 배점 표시</label>
      <label style={{ ...optLabel, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={L.nameBox} onChange={(e) => set('nameBox', e.target.checked)} /> 이름 칸</label>
      <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>바꾸면 문제집에 바로 저장 · 쪽 나누기·Ncode 출력·과제로 저장은 다음 단계</span>
    </div>
  );
};
