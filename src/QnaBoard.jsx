/**
 * QnaBoard.jsx
 * [v2.4] 시스템 관리자 > 게시판 > Q&A
 *   · 목록: 등록일 · 학교명 · 작성자 · 제목 · 상태(답변 대기 / 답변 완료). 상태 필터
 *   · 상세: 질문 본문 · 관리자 답변 작성/수정 → [답변 등록] 시 상태가 「답변 완료」로 바뀐다
 *   · 프로토타입은 목 데이터 — 실서비스는 교사가 남긴 문의를 서버에서 받는다
 */
import React, { useMemo, useState } from 'react';

const SEED = [
  { id: 'Q-0007', createdAt: '2026-10-18 14:22', school: '공주 고등학교', author: '김 b', title: '크래들 채점 중 펜 한 자루가 계속 「오류」로 떠요', body: '30자루 중 1자루만 매번 오류 상태가 됩니다. 다시 거치해도 같습니다. 펜 교체가 필요한가요?', answer: '', answeredAt: '' },
  { id: 'Q-0006', createdAt: '2026-10-17 09:05', school: '세종 중학교', author: '이수진', title: '정답형 과제를 다른 반에도 배포할 수 있나요?', body: '이미 1반에 배포한 정답형 과제를 2반에도 내고 싶습니다. 복사해야 하나요?', answer: '과제 상세 › [배포 그룹 추가]에서 다른 반을 고르시면 같은 과제로 배포됩니다. 복사할 필요는 없습니다.', answeredAt: '2026-10-17 11:40' },
  { id: 'Q-0005', createdAt: '2026-10-15 16:48', school: '대전 고등학교', author: '박민호', title: 'AI 채점 결과를 엑셀로 받을 수 있나요?', body: '학년 협의회 자료로 쓰려고 합니다.', answer: '', answeredAt: '' },
  { id: 'Q-0004', createdAt: '2026-10-12 10:30', school: '공주 고등학교', author: '최유리', title: '학생 비밀번호 초기화 방법', body: '학생이 비밀번호를 잊었다고 합니다.', answer: '회원 관리 › 학생 관리에서 학생을 선택한 뒤 [비밀번호 초기화]를 누르면 됩니다.', answeredAt: '2026-10-12 13:02' },
];

const STATUS_STYLE = {
  '답변 대기': { bg: '#FFF1F2', color: '#E11D48' },
  '답변 완료': { bg: '#F0FDF4', color: '#16A34A' },
};
const statusOf = (q) => (q.answer ? '답변 완료' : '답변 대기');
const Badge = ({ status }) => {
  const s = STATUS_STYLE[status];
  return <span style={{ background: s.bg, color: s.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{status}</span>;
};
const btn = (extra = {}) => ({ padding: '7px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', ...extra });
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8', marginBottom: 4 };
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

const QnaBoard = ({ showToast }) => {
  const [items, setItems] = useState(SEED);
  const [filter, setFilter] = useState('전체');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => (filter === '전체' ? items : items.filter((q) => statusOf(q) === filter)), [items, filter]);
  const waiting = items.filter((q) => !q.answer).length;
  const open = items.find((q) => q.id === openId);

  const openDetail = (q) => { setOpenId(q.id); setDraft(q.answer); };
  const submit = () => {
    if (!draft.trim()) { showToast && showToast('답변 내용을 입력해 주세요.', 'error'); return; }
    setItems((list) => list.map((q) => (q.id === openId ? { ...q, answer: draft.trim(), answeredAt: now() } : q)));
    showToast && showToast('답변을 등록했습니다. 작성자에게 알림이 전달됩니다.');
  };

  if (open) {
    return (
      <div className="content-container" style={{ padding: '1.5rem 2rem' }}>
        <button type="button" onClick={() => setOpenId(null)} style={btn({ marginBottom: 16 })}>← 목록</button>
        <section style={{ background: 'white', borderRadius: 16, border: '1px solid #EEF2F7', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B', margin: 0, flex: 1 }}>{open.title}</h2>
            <Badge status={statusOf(open)} />
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{open.id} · {open.school} · {open.author} · {open.createdAt}</div>
          <div>
            <div style={label}>질문</div>
            <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{open.body}</div>
          </div>
          <div>
            <div style={label}>답변{open.answeredAt && ` · ${open.answeredAt}`}</div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} placeholder="답변을 입력하세요."
              style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-base)', lineHeight: 1.6, resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={submit} style={{ padding: '0.55rem 1.1rem', fontSize: 'var(--neo-font-size-sm)' }}>
                {open.answer ? '답변 수정' : '답변 등록'}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* [디자인 v2] 게시판 공통 머리 — 제목 · 설명(답변 대기 건수) / 필터 / 목록 표 (회원 관리 목록과 같은 모양) */}
      <header className="content-header">
        <div>
          <h1 className="content-title">Q&A</h1>
          <p className="content-subtitle">답변 대기 <b style={{ color: waiting ? '#E11D48' : '#1E293B' }}>{waiting}건</b></p>
        </div>
      </header>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['전체', '답변 대기', '답변 완료'].map((f) => (
          <button key={f} type="button" className={`btn-outline${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
          <thead>
            <tr style={{ color: '#64748B', textAlign: 'left' }}>
              {['등록일', '학교명', '작성자', '제목', '상태'].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid #CBD5E1', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} onClick={() => openDetail(q)} style={{ borderBottom: '1px solid #EEF2F6', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                <td style={{ padding: '12px', color: '#64748B', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{q.createdAt}</td>
                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{q.school}</td>
                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{q.author}</td>
                <td style={{ padding: '12px', color: '#1E293B', fontWeight: 600 }}>{q.title}</td>
                <td style={{ padding: '12px' }}><Badge status={statusOf(q)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>해당하는 문의가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QnaBoard;
