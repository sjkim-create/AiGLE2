/**
 * NoticePopupDemo.jsx
 * 공지 팝업 데모 — 공지 등록(팝업 노출 체크 + 이미지 업로드) → [팝업 미리보기]로 슬라이딩 팝업 확인.
 * 「팝업 노출」 ON 공지만 팝업 슬라이드에 포함. 이미지 없으면 본문으로 표시.
 * (프로토타입: 이미지는 서버 저장이 아니라 브라우저 dataURL 미리보기)
 */
import React, { useState } from 'react';
import NoticePopup from './NoticePopup';

const TYPES = ['공지', '점검', '이벤트', '긴급'];

const SAMPLE = [
  { id: 1, title: '2026학년도 1학기 AiGLE 정기 점검 안내', type: '점검', importance: true, date: '26.05.28', popup: true,
    content: '안녕하세요. 보다 안정적인 서비스 제공을 위해 정기 점검을 진행합니다.\n\n· 일시: 2026.06.01 02:00 ~ 04:00 (2시간)\n· 영향: 점검 시간 동안 로그인 및 채점 기능 일시 중단\n· 점검 후 정상화됩니다.\n\n이용에 참고 부탁드립니다.', imageDataUrl: null },
  { id: 2, title: '신규 기능 출시 — 서·논술형 AI 채점 안내', type: '이벤트', importance: false, date: '26.05.20', popup: true,
    content: '서·논술형 답안을 AI가 인식·채점하는 기능이 추가되었습니다. 성취기준 기반 수준별 예시 답안 자동 생성으로 채점 기준 작성 부담을 줄였습니다.', imageDataUrl: null },
  { id: 3, title: '개인정보 처리방침 개정 안내', type: '공지', importance: false, date: '26.05.10', popup: false,
    content: '개인정보 처리방침이 일부 개정되었습니다. 자세한 내용은 하단 약관에서 확인하실 수 있습니다.', imageDataUrl: null },
];

export default function NoticePopupDemo() {
  const [notices, setNotices] = useState(SAMPLE);
  const [popupOpen, setPopupOpen] = useState(false);
  // 추가 폼
  const [form, setForm] = useState({ title: '', type: '공지', importance: false, date: '26.05.28', popup: true, content: '', imageDataUrl: null, imageName: '' });

  const popupNotices = notices.filter(n => n.popup);

  const onImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, imageDataUrl: reader.result, imageName: file.name }));
    reader.readAsDataURL(file);
  };

  const addNotice = () => {
    if (!form.title.trim()) return;
    setNotices(list => [{ ...form, id: Date.now() }, ...list]);
    setForm({ title: '', type: '공지', importance: false, date: '26.05.28', popup: true, content: '', imageDataUrl: null, imageName: '' });
  };

  const togglePopup = (id) => setNotices(list => list.map(n => n.id === id ? { ...n, popup: !n.popup } : n));
  const removeNotice = (id) => setNotices(list => list.filter(n => n.id !== id));

  const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 };
  const label = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', marginBottom: 6, display: 'block' };
  const inp = { width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 12px', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>📢 공지 팝업 데모</h2>
        <button onClick={() => setPopupOpen(true)} disabled={popupNotices.length === 0}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 'var(--neo-font-size-base)',
            background: popupNotices.length === 0 ? '#CBD5E1' : '#2A75F3', color: 'white', cursor: popupNotices.length === 0 ? 'not-allowed' : 'pointer' }}>
          팝업 미리보기 ({popupNotices.length})
        </button>
      </div>
      <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 16 }}>
        「팝업 노출」 ON 공지가 한 개의 팝업에서 슬라이딩으로 표시됩니다. 첨부 이미지가 있으면 이미지, 없으면 본문 내용이 노출됩니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* 좌: 공지 추가 폼 */}
        <div style={card}>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: 12 }}>① 공지 등록</div>
          <label style={label}>제목</label>
          <input style={inp} value={form.title} maxLength={50} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="제목을 입력하세요 (최대 50자)" />

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>게시글 유형</label>
              <select style={inp} value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <label style={label}>중요도</label>
              <button onClick={() => setForm(f => ({ ...f, importance: !f.importance }))}
                style={{ ...inp, cursor: 'pointer', textAlign: 'center', color: form.importance ? '#F59E0B' : '#94A3B8', fontWeight: 800 }}>
                {form.importance ? '★ 중요' : '☆ 일반'}
              </button>
            </div>
          </div>

          <label style={{ ...label, marginTop: 12 }}>내용</label>
          <textarea style={{ ...inp, minHeight: 110, resize: 'vertical' }} value={form.content} maxLength={1000}
            onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} placeholder="내용을 입력하세요 (이미지가 없으면 이 내용이 팝업에 표시됩니다)" />

          <label style={{ ...label, marginTop: 12 }}>첨부 이미지 (선택)</label>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onImage(e.dataTransfer.files?.[0]); }}
            style={{ display: 'block', border: '2px dashed #CBD5E1', borderRadius: 10, padding: form.imageDataUrl ? 8 : 20, textAlign: 'center', cursor: 'pointer', background: '#F8FAFC' }}
          >
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onImage(e.target.files?.[0])} />
            {form.imageDataUrl
              ? <img src={form.imageDataUrl} alt="첨부" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8 }} />
              : <div style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>📎 이미지를 드래그하거나 클릭해 업로드 (없으면 본문으로 표시)</div>}
          </label>
          {form.imageDataUrl && (
            <button onClick={() => setForm(f => ({ ...f, imageDataUrl: null, imageName: '' }))}
              style={{ marginTop: 6, fontSize: 'var(--neo-font-size-xs)', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕ 이미지 제거</button>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.popup} onChange={(e) => setForm(f => ({ ...f, popup: e.target.checked }))} />
            팝업 노출하기
          </label>

          <button onClick={addNotice} disabled={!form.title.trim()}
            style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 'var(--neo-font-size-base)',
              background: form.title.trim() ? '#10B981' : '#CBD5E1', color: 'white', cursor: form.title.trim() ? 'pointer' : 'not-allowed' }}>
            + 공지 등록
          </button>
        </div>

        {/* 우: 공지 목록 */}
        <div style={card}>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: 12 }}>② 공지 목록 <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 600 }}>(팝업 노출 {popupNotices.length}건)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
            {notices.map(n => (
              <div key={n.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', background: n.popup ? '#F0F9FF' : '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '1px 8px', borderRadius: 999, background: '#EFF6FF', color: '#1D4ED8' }}>{n.type}</span>
                  {n.importance && <span style={{ color: '#F59E0B' }}>★</span>}
                  {n.imageDataUrl && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>🖼 이미지</span>}
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginLeft: 'auto' }}>{n.date}</span>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', marginBottom: 6 }}>{n.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--neo-font-size-sm)', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={n.popup} onChange={() => togglePopup(n.id)} /> 팝업 노출
                  </label>
                  <button onClick={() => removeNotice(n.id)} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>삭제</button>
                </div>
              </div>
            ))}
            {notices.length === 0 && <div style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', padding: 20 }}>등록된 공지가 없습니다.</div>}
          </div>
        </div>
      </div>

      {popupOpen && <NoticePopup notices={popupNotices} onClose={() => setPopupOpen(false)} />}
    </div>
  );
}
