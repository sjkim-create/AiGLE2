/**
 * GradeMarks — 답안지 위 채점 표시 (정답형 채점 상세 · TSK-15 v1.44)
 *   학생 답은 펜 글씨처럼, 채점은 종이 채점처럼 — 맞으면 번호에 빨간 동그라미, 틀리면 빗금, 정할 수 없으면 「?」
 */
import React from 'react';

export const PEN = { fontFamily: '"Nanum Pen Script", "Gaegu", "Comic Sans MS", cursive', color: '#1D4ED8', fontSize: 19, fontWeight: 400, lineHeight: 1 };

// v: true(○) · false(✗) · null(? 확인 필요) — 번호 위에 겹쳐 그린다(부모는 position: relative)
export const GradeMark = ({ v, size = 30 }) => {
  const base = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', boxSizing: 'border-box' };
  if (v === true) return <span aria-label="맞음" style={{ ...base, width: size, height: size, border: '2.5px solid #DC2626', borderRadius: '50%' }} />;
  if (v === false) return <span aria-label="틀림" style={{ ...base, color: '#DC2626', fontSize: size, fontWeight: 900, fontFamily: 'Pretendard, sans-serif', lineHeight: 1 }}>╱</span>;
  return <span aria-label="확인 필요" style={{ ...base, width: size, height: size, border: '2px dashed #F59E0B', borderRadius: '50%', background: 'rgba(254,243,199,0.55)' }} />;
};

// 번호 + 채점 표시
export const MarkedNo = ({ no, v, suffix = '.', size }) => (
  <span style={{ position: 'relative', display: 'inline-block', minWidth: 22, textAlign: 'center', fontWeight: 800 }}>
    {no}{suffix}<GradeMark v={v} size={size} />
  </span>
);

// 틀렸을 때 옆에 적는 정답 · 인식 애매 표시
export const AnswerNote = ({ v, correct, uncertain }) => (
  <>
    {v === false && correct ? <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 800, fontFamily: 'Pretendard, sans-serif', marginLeft: 6, whiteSpace: 'nowrap' }}>정답 {correct}</span> : null}
    {uncertain ? <span style={{ color: '#B45309', background: '#FEF3C7', borderRadius: 6, padding: '0 5px', fontSize: 10, fontWeight: 800, fontFamily: 'Pretendard, sans-serif', marginLeft: 6, whiteSpace: 'nowrap' }}>인식 애매</span> : null}
  </>
);

// 다음 표시 — 확인 필요 → ○, ○ → ✗, ✗ → ○
export const nextMark = (v) => (v === true ? false : true);
