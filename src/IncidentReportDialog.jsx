/**
 * IncidentReportDialog.jsx
 * [BRD-16] 장애 신고 다이얼로그 — 교사 화면(크래들 일괄 채점 헤더 · 환경설정 AiGLE Connect 카드)에서 연다.
 *   · 학교 · 교사 · 과제 · 그룹 정보는 화면이 넘겨 주는 값으로 자동 채워진다 (교사가 다시 쓰지 않는다)
 *   · 진단 로그(전체 기간)와 연결된 펜 데이터를 자동 첨부한다 — 舊 [로그 다운로드]·[펜 데이터 다운로드]를 대체
 *   · [신고하기] → 시스템 관리자 > 게시판 > 장애신고에 등록 + Jira 자동 등록(MCP 연동 예정 — 시뮬레이션)
 */
/* [v1.7] 펜 원본 진단 파일 = 채점 때마다 로컬에 쌓인 펜 원본 폴더(최근 5회). 신고하면 zip 으로 전송하고 로컬 파일은 지운다 — 舊 「펜 데이터」 첨부 대체 */
import React, { useState, useEffect } from 'react';
import { addIncident, SYMPTOMS } from './lib/incidentStore';
import { availableDates } from './appLogger';
import { listSessions, buildZipManifest, clearAll as clearPenRaw, formatBytes, PEN_RAW_ROOT, PEN_RAW_KEEP } from './lib/penRawStore';

const IncidentReportDialog = ({ open, onClose, onSubmitted, context }) => {
  const [symptom, setSymptom] = useState(SYMPTOMS[0].label);
  const [detail, setDetail] = useState('');
  const [logDate, setLogDate] = useState(''); // [v1.3] 진단 로그 일자 'YYYY-MM-DD' — 기본 최신 날짜 (舊 '전체 기간' 옵션 폐기)
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setSymptom(SYMPTOMS[0].label); setDetail(''); setLogDate(availableDates()[0] || ''); setSubmitting(false); } }, [open]);
  if (!open) return null;

  const { source = '환경설정', school = '공주 고등학교', teacher = '김 b', teacherId = 'tch20261zim', teacherEmail = 'tch20261zim@gjhs.kr', task = null, group = null, studentCount = null } = context || {};
  const dates = availableDates();
  const penSessions = listSessions();
  const manifest = buildZipManifest(teacherId);
  const fmtAt = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    /* 펜 원본 폴더(최근 5회)를 zip 으로 묶어 첨부 → 전송이 끝나면 로컬 파일 삭제 */
    const penRaw = manifest.files.length ? { zipName: manifest.zipName, sessions: manifest.sessions, pens: manifest.pens, bytes: manifest.bytes } : null;
    const report = addIncident({ source, school, teacher, teacherId, teacherEmail, task, group, studentCount, symptom, detail, penFiles: manifest.files, penRaw, logDate: logDate || 'all' });
    if (penRaw) clearPenRaw();
    onSubmitted && onSubmitted(report);
    onClose && onClose();
  };

  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 'var(--neo-font-size-sm)' }}>
      <span style={{ width: 64, color: '#94A3B8', fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1E293B', fontWeight: 700 }}>{value || '-'}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="장애신고" style={{ background: 'white', borderRadius: 14, width: 560, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 22px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>장애신고</h2>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>신고 내용은 운영팀이 확인한 후 메일로 보내드립니다.</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
        </div>

        <div style={{ padding: '14px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 자동 수집 정보 */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B', marginBottom: 2 }}>신고 정보</div>
            {row('학교', school)}
            {row('교사', `${teacher} (${teacherEmail})`)}
            {task && row('과제', task)}
            {group && row('그룹', group)}
          </div>

          {/* 증상 */}
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>어떤 문제인가요?</div>
            {/* [v1.1] 오류 종류 — 발생 지점별 6종, 각 버튼에 설명 1줄 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SYMPTOMS.map((s) => {
                const on = symptom === s.label;
                return (
                  <button key={s.key} type="button" onClick={() => setSymptom(s.label)}
                    style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: on ? '#1D4ED8' : '#1E293B' }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: on ? '#3B82F6' : '#94A3B8', marginTop: 2 }}>{s.desc}</div>
                  </button>
                );
              })}
            </div>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="언제, 어떤 조작을 했을 때 어떤 현상이 났는지 적어 주시면 확인이 빨라집니다. (선택)"
              style={{ width: '100%', minHeight: 84, marginTop: 10, padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          {/* 자동 첨부 — [v1.3] 항목명 없이 진단 로그(일자)·펜 데이터 안내만 */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>진단 로그</strong>
                {dates.length ? (
                  <select value={logDate} onChange={(e) => setLogDate(e.target.value)} aria-label="진단 로그 일자 선택"
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', background: 'white', fontFamily: 'inherit', minWidth: 140 }}>
                    {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : <span style={{ color: '#94A3B8' }}>기록된 로그 없음</span>}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>펜 원본 진단 파일</strong>
                  {penSessions.length
                    ? <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 8px', borderRadius: 999 }}>최근 {penSessions.length}/{PEN_RAW_KEEP}회 · 펜 {manifest.pens}자루 · 파일 {manifest.files.length}개 · {formatBytes(manifest.bytes)}</span>
                    : <span style={{ color: '#94A3B8' }}>저장된 파일 없음 — 채점할 때 자동으로 쌓입니다</span>}
                </div>
                {penSessions.length > 0 && (
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'monospace', fontSize: 'var(--neo-font-size-xs)', color: '#475569', lineHeight: 1.7 }}>
                    {PEN_RAW_ROOT}<br />
                    {penSessions.map((s) => (
                      <div key={s.id}>└ {s.id}\ <span style={{ color: '#94A3B8' }}>({fmtAt(s.at)} · {s.task} · {s.group} · 펜 {s.pens.length}자루)</span></div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 4 }}>채점 때마다 펜 MAC → 답안지(s.o.b) 단위로 저장되며 최근 {PEN_RAW_KEEP}회만 보관합니다. 신고하면 이 폴더를 zip으로 전송하고 로컬 파일은 삭제됩니다. 펜 안의 필기는 지워지지 않습니다.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 22px 18px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={submit} disabled={submitting} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>🚨 신고하기</button>
        </div>
      </div>
    </div>
  );
};

export default IncidentReportDialog;
