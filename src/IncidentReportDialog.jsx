/**
 * IncidentReportDialog.jsx
 * [POP-41] 이용불편 접수 다이얼로그 — 게시판(접수 이후)은 [BRD-16] — 교사 화면(크래들 일괄 채점 헤더 · 환경설정 AiGLE Connect 카드)에서 연다.
 *   · 학교 · 교사 · 과제 · 그룹 정보는 화면이 넘겨 주는 값으로 자동 채워진다 (교사가 다시 쓰지 않는다)
 *   · 진단 로그(전체 기간)와 연결된 펜 데이터를 자동 첨부한다 — 舊 [로그 다운로드]·[펜 데이터 다운로드]를 대체
 *   · [신고하기] → 시스템 관리자 > 게시판 > 장애신고에 등록 + Jira 자동 등록(MCP 연동 예정 — 시뮬레이션)
 */
/* [v1.7] 펜 원본 진단 파일 = 채점 때마다 로컬에 쌓인 펜 원본 폴더(최근 5회). 신고하면 zip 으로 전송하고 로컬 파일은 지운다 — 舊 「펜 데이터」 첨부 대체 */
import React, { useState, useEffect } from 'react';
import { addIncident, SYMPTOMS } from './lib/incidentStore';
import { availableDates } from './appLogger';
import { buildZipManifest, clearAll as clearPenRaw } from './lib/penRawStore';

/* [POP-41] 문제가 생긴 날 — **최근 3일**만 고르게 한다.
 *   진단 로그 보관 기간 안에서 교사가 기억하는 범위가 그 정도이고, 날짜가 좁아야 개발자가 로그를 빨리 짚는다. */
const recentDays = () => Array.from({ length: 3 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { key, hasLog: availableDates().includes(key) };
});

const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/* [POP-41] 첨부 제한 — 개수 5개, 파일 하나당 10MB.
 *   메일로 되돌려 보내는 자료라 한 통에 담기는 크기를 넘지 않게 한다. */
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

const IncidentReportDialog = ({ open, onClose, onSubmitted, context, taskOptions = [] }) => {
  const [symptom, setSymptom] = useState(SYMPTOMS[0].label);
  const [detail, setDetail] = useState('');
  const [days, setDays] = useState(recentDays());
  const [occurredAt, setOccurredAt] = useState('');   // [v2.7] 문제가 생긴 날 (최근 3일 중 1)
  const [files, setFiles] = useState([]);             // [v2.7] 선생님이 붙인 파일
  const [fileError, setFileError] = useState('');     // [v2.9] 개수·용량 초과 안내
  const [pickedTask, setPickedTask] = useState('');   // [v2.8] 화면 밖에서 접수할 때 교사가 고르는 과제
  const [pickedGroup, setPickedGroup] = useState(''); // [v2.8] 〃 그룹
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = recentDays();
    setDays(d); setOccurredAt(d[0].key);
    setSymptom(SYMPTOMS[0].label); setDetail(''); setFiles([]); setSubmitting(false);
    setPickedTask(''); setPickedGroup(''); setFileError('');
  }, [open]);
  if (!open) return null;

  const { source = '환경설정', school = '공주 고등학교', teacher = '김 b', teacherId = 'tch20261zim', teacherEmail = 'tch20261zim@gjhs.kr', task = null, group = null, studentCount = null } = context || {};

  const manifest = buildZipManifest(teacherId);

  /* [v2.8] 화면이 과제를 넘겨 주지 않았고 고를 목록이 있으면 교사가 직접 고른다.
   *   채점 화면 밖(사이드바)에서 접수하면 어느 과제에서 막혔는지 시스템이 알 수 없기 때문이다. */
  const needsPick = !task && taskOptions.length > 0;
  const groupsOfPicked = taskOptions.find((t) => t.title === pickedTask)?.groups || [];
  const finalTask = task || pickedTask || null;
  const finalGroup = group || pickedGroup || null;

  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    /* 펜 원본 폴더(최근 5회)를 zip 으로 묶어 첨부 → 전송이 끝나면 로컬 파일 삭제 */
    const penRaw = manifest.files.length ? { zipName: manifest.zipName, sessions: manifest.sessions, pens: manifest.pens, bytes: manifest.bytes } : null;
    /* 진단 로그는 «문제가 생긴 날»분을 담는다 — 그 날 로그가 없으면 보관 전체로 되돌린다 */
    const hasLog = days.find((d) => d.key === occurredAt)?.hasLog;
    const report = addIncident({ source, school, teacher, teacherId, teacherEmail, task: finalTask, group: finalGroup, studentCount, symptom, detail,
      penFiles: manifest.files, penRaw, logDate: hasLog ? occurredAt : 'all', occurredAt,
      userFiles: files.map((f) => ({ name: f.name, size: f.size })) });
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
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="이용불편 접수" style={{ background: 'white', borderRadius: 14, width: 560, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 22px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>이용불편 접수</h2>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>접수 내용은 운영팀이 확인한 후 메일로 보내드립니다.</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
        </div>

        <div style={{ padding: '14px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 자동 수집 정보 */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#64748B', marginBottom: 2 }}>접수 정보</div>
            {row('학교', school)}
            {row('교사', `${teacher} (${teacherEmail})`)}
            {task && row('과제', task)}
            {group && row('그룹', group)}
            {/* [v2.8] 과제·그룹 직접 선택 — 채점 화면에서 열면 이 줄은 나오지 않는다(이미 자동 입력) */}
            {needsPick && (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 64, color: '#94A3B8', fontWeight: 700, flexShrink: 0, fontSize: 'var(--neo-font-size-sm)' }}>과제</span>
                  <select value={pickedTask} onChange={(e) => { setPickedTask(e.target.value); setPickedGroup(''); }}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B' }}>
                    <option value="">선택 안 함</option>
                    {taskOptions.map((t) => <option key={t.title} value={t.title}>{t.title}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 64, color: '#94A3B8', fontWeight: 700, flexShrink: 0, fontSize: 'var(--neo-font-size-sm)' }}>그룹</span>
                  <select value={pickedGroup} onChange={(e) => setPickedGroup(e.target.value)} disabled={!pickedTask}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: pickedTask ? 'white' : '#F1F5F9', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', color: pickedTask ? '#1E293B' : '#94A3B8' }}>
                    <option value="">{pickedTask ? '선택 안 함' : '과제를 먼저 고르세요'}</option>
                    {groupsOfPicked.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 2 }}>
                  어떤 과제에서 겪은 일인지 골라 주시면 확인이 빨라집니다. 과제와 상관없는 문제라면 비워 두세요.
                </div>
              </>
            )}
          </div>

          {/* [v2.9] 언제 — 최근 3일 중 하루. 칩 3개는 자리를 많이 쓰고 선택지가 늘면 줄바꿈이 생겨 셀렉트로 바꿨다 */}
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>언제 생긴 문제인가요?</div>
            <select value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', boxSizing: 'border-box' }}>
              {days.map((d) => (
                /* [POP-41] 날짜만 보인다 — 「오늘/어제」는 여는 날에 따라 뜻이 달라져 나중에 읽을 때 혼란을 준다 */
                <option key={d.key} value={d.key}>{d.key}</option>
              ))}
            </select>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>고른 날짜의 진단 로그가 함께 전달됩니다. 더 이전 일은 상세 내용에 적어 주세요.</div>
          </div>

          {/* 증상 */}
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>어떤 문제인가요?</div>
            {/* [v2.7] 이용불편 종류 4종 — 2×2 */}
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

          {/* [v2.7] 첨부파일 — 선생님이 직접 붙인다. 진단 로그·펜 원본은 여전히 자동 첨부라 여기 보이지 않는다 */}
          <div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>첨부파일 <span style={{ fontWeight: 600, color: '#94A3B8' }}>(선택)</span></div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1px dashed #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>
              📎 파일 선택
              <input type="file" multiple style={{ display: 'none' }}
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  e.target.value = '';
                  const tooBig = picked.filter((f) => f.size > MAX_BYTES);
                  const ok = picked.filter((f) => f.size <= MAX_BYTES);
                  setFiles((prev) => {
                    const merged = [...prev, ...ok];
                    const over = merged.length > MAX_FILES;
                    setFileError(
                      tooBig.length ? `${tooBig.map((f) => f.name).join(', ')} — 파일 하나가 10MB를 넘어 첨부하지 못했습니다.`
                        : over ? `첨부는 최대 ${MAX_FILES}개까지입니다. 앞의 ${MAX_FILES}개만 담았습니다.`
                          : ''
                    );
                    return merged.slice(0, MAX_FILES);
                  });
                }} />
            </label>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginLeft: 10 }}>화면 캡처·사진 등 최대 {MAX_FILES}개 · 파일당 10MB 이하</span>
            {fileError && <div style={{ marginTop: 6, fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', fontWeight: 700 }}>⚠ {fileError}</div>}
            {files.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-xs)', color: '#475569', background: '#F1F5F9', borderRadius: 6, padding: '5px 8px' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ color: '#94A3B8' }}>{fmtBytes(f.size)}</span>
                    <button type="button" onClick={() => { setFiles((prev) => prev.filter((_, j) => j !== i)); setFileError(''); }} aria-label={`${f.name} 첨부 제거`}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 22px 18px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={submit} disabled={submitting} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>🚨 접수하기</button>
        </div>
      </div>
    </div>
  );
};

export default IncidentReportDialog;
