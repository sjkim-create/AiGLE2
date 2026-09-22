/**
 * IncidentBoard.jsx
 * [BRD-16] 시스템 관리자 > 게시판 > 장애신고
 *   · 목록 화면과 상세(수정) 화면으로 나뉜다 (v1.2 — 舊 좌우 분할 폐기)
 *   · 목록: 접수 일시 · 학교명 · 교사명 · 과제명 · 그룹 · 증상 · 상태. 접수 일시(기본)·학교명·교사명 헤더 클릭 정렬
 *   · 상세: 신고 정보 · 첨부(진단 로그 · 펜 데이터) 다운로드 · Jira · 개발자 답변(있을 때만) · 운영팀 답변 편집 → 메일 발송
 *   · Jira 자동 등록·개발자 댓글 수신은 서버(Functions + Jira Webhook) 연동 예정 — 시뮬레이션 버튼
 *   · 저장소는 Firestore(incidentStore v2.0) — 목록·상세는 onSnapshot 으로 실시간 갱신. 진단 로그 본문은 내려받을 때만 서브문서에서 읽는다
 *   · 상태 3단계: 장애 접수 → 개발자 확인 완료 → 메일 발송
 */
import React, { useEffect, useMemo, useState } from 'react';
import { relayEnabled } from './lib/jiraRelay';
import {
  listIncidents, subscribeIncidents, receiveJiraComment, saveReplyDraft, sendReplyMail, downloadText, fetchIncidentLog, INCIDENT_STATUS,
  hasRealJira, syncFromJira, syncAllFromJira, deleteIncidents,
  replyPartsOf, composeReply, DEFAULT_GREETING, DEFAULT_CLOSING,
} from './lib/incidentStore';

const STATUS_STYLE = {
  '장애 접수':       { bg: '#FEF3C7', color: '#B45309' },
  '개발자 확인 완료': { bg: '#EFF6FF', color: '#1D4ED8' },
  '메일 발송':       { bg: '#D1FAE5', color: '#047857' },
};
const Badge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE['장애 접수'];
  return <span style={{ background: s.bg, color: s.color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{status}</span>;
};

const SIM_DEV_COMMENTS = [
  'AiGLE Connect 브릿지 소켓 재연결 타임아웃(5초)이 원인. 3.0.14에서 15초로 조정해 배포 예정.',
  '해당 학생 답안이 12,000자 이상으로 채점 프롬프트 토큰 상한을 초과. 서버 측 분할 채점 패치 적용 예정(이번 주).',
  '펜 펌웨어 1.09 이하에서 오프라인 파일 목록 응답이 비어 오는 버그. 펜 펌웨어 업데이트(환경설정)로 해결됨.',
];

const SORT_KEYS = { createdAt: '접수 일시', school: '학교명', teacher: '교사명' };

const btn = (extra = {}) => ({ padding: '7px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', ...extra });
const label = { fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8', marginBottom: 4 };

/* ── 목록 ─────────────────────────────────────────────── */
const IncidentList = ({ items, onOpen, onSyncAll, syncing, showToast }) => {
  const [filter, setFilter] = useState('전체');
  // [v2.3] 선택 삭제 — 체크박스로 고른 신고를 확인창을 거쳐 지운다 (게시판 기록만, Jira 이슈는 유지)
  const [selected, setSelected] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setSelected((s) => new Set([...s].filter((id) => items.some((r) => r.id === id)))); }, [items]);
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });

  const rows = useMemo(() => {
    const base = filter === '전체' ? items : items.filter((r) => r.status === filter);
    const { key, dir } = sort;
    return base.slice().sort((a, b) => {
      const av = a[key] || '', bv = b[key] || '';
      const c = av < bv ? -1 : av > bv ? 1 : 0;
      // 같은 값이면 접수 일시 최신순
      const tie = c === 0 && key !== 'createdAt' ? (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) : 0;
      return (dir === 'asc' ? c : -c) || tie;
    });
  }, [items, filter, sort]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'createdAt' ? 'desc' : 'asc' }));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allChecked) rows.forEach((r) => n.delete(r.id)); else rows.forEach((r) => n.add(r.id)); return n; });
  const selectedRows = items.filter((r) => selected.has(r.id));
  const doDelete = () => {
    const n = deleteIncidents(selectedRows.map((r) => r.id));
    setSelected(new Set()); setConfirmDelete(false);
    showToast && showToast(`장애 신고 ${n}건을 삭제했습니다.`, 'success');
  };

  const cell = { padding: '11px 12px', fontSize: 'var(--neo-font-size-sm)', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' };
  const th = (key, text) => (
    <th key={text} onClick={key ? () => toggleSort(key) : undefined}
      style={{ ...cell, background: '#F8FAFC', color: sort.key === key ? '#1D4ED8' : '#64748B', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', cursor: key ? 'pointer' : 'default', userSelect: 'none' }}>
      {text}{key && <span style={{ marginLeft: 4, fontSize: 'var(--neo-font-size-xs)', color: sort.key === key ? '#1D4ED8' : '#CBD5E1' }}>{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
    </th>
  );

  return (
    <div className="content-container" style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B' }}>🚨 장애신고</h1>
        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>교사 화면에서 접수된 장애 신고 — 행을 누르면 상세에서 확인·답변합니다</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {selected.size > 0 && (
            <button type="button" onClick={() => setConfirmDelete(true)} title="선택한 신고를 게시판에서 삭제합니다 (Jira 이슈는 남습니다)"
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginRight: 6 }}>🗑 선택 삭제 ({selected.size})</button>
          )}
          {relayEnabled() && (
            <button type="button" onClick={onSyncAll} disabled={syncing} title="실제 Jira 가 연결된 신고의 상태·개발자 댓글을 모두 읽어 옵니다"
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', fontFamily: 'inherit', marginRight: 6 }}>{syncing ? '가져오는 중…' : '↻ Jira 동기화'}</button>
          )}
          {['전체', ...INCIDENT_STATUS].map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={btn({ borderColor: filter === s ? '#2A75F3' : '#E2E8F0', color: filter === s ? '#1D4ED8' : '#475569', background: filter === s ? '#EFF6FF' : 'white' })}>
              {s} ({s === '전체' ? items.length : items.filter((r) => r.status === s).length})
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, background: '#F8FAFC', width: 36, textAlign: 'center' }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체 선택" title="목록 전체 선택" style={{ cursor: 'pointer' }} />
              </th>
              {th('createdAt', SORT_KEYS.createdAt)}
              {th('school', SORT_KEYS.school)}
              {th('teacher', SORT_KEYS.teacher)}
              {th(null, '과제명')}
              {th(null, '그룹')}
              {th(null, '증상')}
              {th(null, '상태')}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...cell, textAlign: 'center', color: '#94A3B8', padding: 28 }}>접수된 장애 신고가 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }} onMouseLeave={(e) => { e.currentTarget.style.background = selected.has(r.id) ? '#EFF6FF' : 'white'; }}>
                <td style={{ ...cell, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`${r.createdAt} ${r.teacher} 선택`} style={{ cursor: 'pointer' }} />
                </td>
                <td style={{ ...cell, color: '#475569', whiteSpace: 'nowrap' }}>{r.createdAt}</td>
                <td style={{ ...cell, fontWeight: 700 }}>{r.school}</td>
                <td style={{ ...cell, fontWeight: 700 }}>{r.teacher}</td>
                <td style={cell}>{r.task}</td>
                <td style={cell}>{r.group}</td>
                <td style={{ ...cell, color: '#475569' }}>{r.symptom}</td>
                <td style={cell}><Badge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* [v2.3] 선택 삭제 확인창 */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="장애 신고 삭제" style={{ background: 'white', borderRadius: 14, width: 480, maxWidth: '94vw', padding: '22px 24px', boxShadow: '0 20px 50px rgba(15,23,42,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B' }}>장애 신고 {selectedRows.length}건을 삭제할까요?</h3>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, marginBottom: 12 }}>
              게시판의 신고 기록(신고 정보 · 첨부 · 답변 · 발송 메일)이 지워지며 되돌릴 수 없습니다.<br />
              Jira에 등록된 이슈는 삭제되지 않습니다.
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 'var(--neo-font-size-xs)', color: '#475569', lineHeight: 1.7 }}>
              {selectedRows.map((r) => <div key={r.id}>{r.createdAt} · {r.school} {r.teacher} · {r.symptom}{r.jira?.key && !r.jira.simulated ? ` · ${r.jira.key}` : ''}</div>)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmDelete(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D5DAE0', background: 'white', color: '#1E293B', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button type="button" onClick={doDelete} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── 상세 (수정) ─────────────────────────────────────────── */
const IncidentDetail = ({ item, index, onBack, showToast }) => {
  // [v1.5] 메일 = 인사말 + 본문(개발자 답변) + 맺음말. 세 칸 모두 수정 가능
  const [parts, setParts] = useState(() => replyPartsOf(item || {}));
  const [mailTo, setMailTo] = useState(item?.teacherEmail || '');
  useEffect(() => { setParts(replyPartsOf(item || {})); setMailTo(item?.teacherEmail || ''); }, [item?.id, item?.replyParts, item?.devComment, item?.teacherEmail]);
  const setPart = (k) => (e) => setParts((p) => ({ ...p, [k]: e.target.value }));

  const toast = (m) => showToast && showToast(m, 'success');
  // [v1.9] 재발송 — 발송된 메일 화면에서 [↻ 재발송]을 누르면 수신자·내용을 다시 편집할 수 있는 상태로 돌아간다
  const [resending, setResending] = useState(false);
  useEffect(() => { setResending(false); }, [item?.id]);
  if (!item) return null;
  const sentStatus = item.status === '메일 발송';
  const sent = sentStatus && !resending;
  const startResend = () => { setParts(replyPartsOf(item)); setMailTo(item.mail?.to || item.teacherEmail || ''); setResending(true); };
  const cancelResend = () => { setParts(replyPartsOf(item)); setMailTo(item.mail?.to || item.teacherEmail || ''); setResending(false); };

  // [v2.2] 실제 Jira 연동 신고 — 상세를 열면 상태·댓글을 읽어 온다. [↻ Jira에서 가져오기]로 수동 갱신
  const realJira = hasRealJira(item);
  const [syncing, setSyncing] = useState(false);
  const syncNow = async (silent) => {
    if (!realJira) return;
    setSyncing(true);
    const r = await syncFromJira(item.id);
    setSyncing(false);
    if (!silent) showToast && showToast(r ? `Jira ${item.jira.key} 에서 가져왔습니다 — 상태 「${r.jiraStatus || '-'}」 · 개발자 댓글 ${(r.jiraComments || []).length}건` : 'Jira 에서 가져오지 못했습니다. 잠시 후 다시 시도하세요.', r ? 'success' : 'error');
  };
  useEffect(() => { if (hasRealJira(item)) syncNow(true); }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const simulateJiraComment = () => {
    receiveJiraComment(item.id, SIM_DEV_COMMENTS[index % SIM_DEV_COMMENTS.length]);
    toast(`Jira ${item.jira?.key} 개발자 댓글을 가져왔습니다 — 상태 「개발자 확인 완료」. (서버 연동 예정 — 시뮬레이션)`);
  };
  // 로그 본문은 목록에 싣지 않고 내려받을 때 서브문서에서 읽는다
  /* [v2.6] 첨부는 zip 1개 — 접수 시 진단 로그와 펜 원본이 하나로 묶여 올라온다.
   *   프로토타입은 실제 zip 대신 같은 내용을 담은 파일 1개를 내려받는다 (실서비스는 서버가 만든 zip). */
  const zipName = item.attachments?.penRaw?.zipName
    || `aigle-diagnostics_${item.teacherId || 'unknown'}_${String(item.id).replace(/[^0-9A-Za-z-]/g, '')}.zip`;
  const penFiles = item.attachments?.penData || [];
  const onDownloadDiagnostics = async () => {
    const logName = item.attachments?.log?.name || '-';
    try {
      const log = item.attachments?.log ? await fetchIncidentLog(item.id) : null;
      const body = [
        `# AiGLE 진단 자료 (prototype — 실서비스는 zip 1개)`,
        `# 접수번호 : ${item.id}    접수 일시 : ${item.createdAt}`,
        `# 학교/교사 : ${item.school} · ${item.teacher} (${item.teacherId})`,
        '',
        `## 1. 진단 로그 — ${logName} (${item.logDate || '전체 기간'})${log?.truncated ? ' · 최근 부분만 보관' : ''}`,
        log?.text || '(진단 로그 없음)',
        '',
        `## 2. 펜 원본 진단 파일 — ${penFiles.length}개`,
        ...(penFiles.length ? penFiles.map((n) => `  ${n}`) : ['  (없음)']),
      ].join('\n');
      downloadText(zipName.replace(/\.zip$/, '.txt'), body);
      toast(`진단 자료를 내려받았습니다 — ${zipName}`);
    } catch (e) {
      showToast && showToast(`진단 자료를 읽지 못했습니다 — ${e.message}`, 'error');
    }
  };
  const onSaveDraft = () => { saveReplyDraft(item.id, parts); toast('답변을 임시저장했습니다.'); };
  const onSendMail = () => {
    if (!parts.body.trim()) { showToast && showToast('본문(개발자 답변)을 입력하세요.', 'error'); return; }
    if (!mailTo.trim()) { showToast && showToast('수신 메일 주소를 입력하세요.', 'error'); return; }
    const wasResend = resending;
    sendReplyMail(item.id, { to: mailTo.trim(), parts });
    setResending(false);
    toast(`${item.teacher} 선생님(${mailTo.trim()})께 답변 메일을 ${wasResend ? '재발송' : '발송'}했습니다. (프로토타입 — 실제 발송 없음)`);
  };

  const box = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 };

  return (
    <div className="content-container" style={{ padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
     <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={btn()}>← 목록</button>
        <h1 style={{ margin: 0, fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E293B' }}>장애 신고 상세</h1>
        <Badge status={item.status} />
        <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{item.id} · {item.createdAt} · {item.source}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 신고 정보 */}
        <div style={box}>
          <div style={{ ...label, marginBottom: 10 }}>신고 정보</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 16px', fontSize: 'var(--neo-font-size-sm)' }}>
            <div><div style={label}>학교명</div><strong>{item.school}</strong></div>
            <div><div style={label}>교사명</div><strong>{item.teacher}</strong> <span style={{ color: '#94A3B8' }}>({item.teacherId})</span></div>
            <div><div style={label}>과제명</div><strong>{item.task}</strong></div>
            <div><div style={label}>그룹</div><strong>{item.group}</strong></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={label}>증상</div>
              <strong>{item.symptom}</strong>
              {item.detail && <div style={{ marginTop: 6, color: '#475569', whiteSpace: 'pre-wrap', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px' }}>{item.detail}</div>}
            </div>
          </div>
        </div>

        {/* 첨부 */}
        <div style={box}>
          <div style={{ ...label, marginBottom: 10 }}>첨부 (개발자 확인용)</div>
          {/* [v2.6] 진단 로그 + 펜 원본을 묶은 zip 1개. 舊 2개 버튼(진단 로그 / 펜 데이터) 폐기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {item.attachments?.log || penFiles.length ? (
              <>
                <button onClick={onDownloadDiagnostics} style={btn()}>⬇ 진단 자료 <span style={{ color: '#94A3B8', fontWeight: 600 }}>{zipName}</span></button>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                  진단 로그 {item.attachments?.log ? `1개 (${item.logDate || '전체 기간'})` : '없음'} · 펜 원본 {penFiles.length}개
                  {item.attachments?.penRaw ? ` · 채점 ${item.attachments.penRaw.sessions}회분` : ''}
                </span>
              </>
            ) : <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>첨부 없음</span>}
          </div>
        </div>

        {/* Jira + 개발자 답변 */}
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ ...label, marginBottom: 0 }}>Jira</div>
            {(!relayEnabled() || item.jira?.simulated) && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>서버 연동 예정 — 시뮬레이션</span>}
            {item.jira?.pending && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#1D4ED8', background: '#EFF6FF', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Jira 등록 중…</span>}
            {item.jira?.error && <span title={item.jira.error} style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', background: '#FEE2E2', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Jira 등록 실패 — {item.jira.error}</span>}
            {item.jira && (
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', marginLeft: 6 }}>
                {item.jira.url ? <a href={item.jira.url} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: '#1D4ED8' }}>{item.jira.key}</a> : <span style={{ fontWeight: 800, color: '#64748B' }}>{item.jira.key}</span>}
                <span style={{ color: '#64748B' }}> · 게시판 등록 시 자동 등록 ({item.jira.registeredAt})</span>
              </span>
            )}
            {realJira && (
              <>
                {item.jiraStatus && <span title="Jira 이슈의 현재 상태" style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: item.jiraStatusCategory === 'done' ? '#D1FAE5' : item.jiraStatusCategory === 'indeterminate' ? '#DBEAFE' : '#F1F5F9', color: item.jiraStatusCategory === 'done' ? '#047857' : item.jiraStatusCategory === 'indeterminate' ? '#1D4ED8' : '#475569' }}>Jira: {item.jiraStatus}</span>}
                <button type="button" onClick={() => syncNow(false)} disabled={syncing} style={{ ...btn({ padding: '3px 10px', fontSize: 'var(--neo-font-size-xs)' }), marginLeft: 'auto' }}>{syncing ? '가져오는 중…' : '↻ Jira에서 가져오기'}</button>
                {item.jiraSyncedAt && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{item.jiraSyncedAt}</span>}
              </>
            )}
          </div>
          {/* [v2.5] 개발자 원문 (Jira 댓글) — 읽기 전용. 이 문장을 그대로 보내지 않고 아래 본문에서 선생님 눈높이로 다시 쓴다 */}
          {realJira && (item.jiraComments || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...label, marginBottom: 0 }}>개발자 원문</div>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>Jira 댓글 — 선생님께 그대로 보내지 않습니다. 아래 「본문」에서 쉬운 말로 다시 씁니다.</span>
              </div>
              {item.jiraComments.map((c) => (
                <div key={c.id} style={{ padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 2 }}><strong style={{ color: '#1E293B' }}>{c.author || '개발자'}</strong> · {String(c.created || '').replace('T', ' ').slice(0, 16)}</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.text}</div>
                </div>
              ))}
            </div>
          )}
          {/* [v1.6] 개발자 답변 원문 블록 삭제 — 본문 칸(본문 — 개발자 답변)에 이미 채워지므로 중복 표시하지 않는다 */}
          {!item.devComment && !sent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>아직 개발자 답변이 없습니다. 개발자가 Jira에 댓글을 쓰면 아래 본문에 채워지고 상태가 「개발자 확인 완료」로 바뀝니다.</span>
              {!realJira && <button onClick={simulateJiraComment} style={btn({ whiteSpace: 'nowrap' })}>Jira 댓글 가져오기 (시뮬레이션)</button>}
            </div>
          )}
        </div>

        {/* 운영팀 답변 */}
        <div style={box}>
          {sent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ ...label, marginBottom: 0 }}>발송된 메일</div>
                {/* [v1.9] 재발송 — 수신자·내용을 수정할 수 있는 상태로 전환 */}
                <button type="button" onClick={startResend} title="수신 메일과 내용을 수정한 뒤 다시 보냅니다." style={{ ...btn(), marginLeft: 'auto' }}>↻ 재발송</button>
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: 8 }}>
                <strong style={{ color: '#047857' }}>✓ {item.mail?.sentAt} 발송</strong> · 수신 <strong>{item.mail?.to}</strong>
                {(item.mailHistory || []).length > 0 && <span style={{ color: '#94A3B8' }}> · 재발송 {item.mailHistory.length}회</span>}
              </div>
              <pre style={{ margin: 0, padding: '14px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, color: '#1E293B', fontSize: 'var(--neo-font-size-sm)' }}>{item.replyDraft || composeReply(replyPartsOf(item))}</pre>
              {(item.mailHistory || []).length > 0 && (
                <details style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)' }}>
                  <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 700 }}>이전 발송 {item.mailHistory.length}건</summary>
                  {item.mailHistory.slice().reverse().map((m, i) => (
                    <div key={i} style={{ marginTop: 8, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 4 }}>{m.sentAt} 발송 · 수신 {m.to}</div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6, color: '#475569', fontSize: 'var(--neo-font-size-xs)' }}>{m.body}</pre>
                    </div>
                  ))}
                </details>
              )}
            </>
          ) : (
            <>
          <div style={{ ...label, marginBottom: 8 }}>{resending ? '재발송 — 수신 메일과 내용을 수정한 뒤 다시 보냅니다' : '운영팀 답변 메일 — 인사말 · 본문(선생님 안내문) · 맺음말. 모두 수정할 수 있습니다'}</div>
          {(() => {
            const ta = (extra = {}) => ({ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', background: sent ? '#F8FAFC' : 'white', ...extra });
            const sub = (text, action) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>{text}</span>
                {action}
              </div>
            );
            const resetBtn = (k, make) => !sent && (
              <button type="button" onClick={() => setParts((p) => ({ ...p, [k]: make(item) }))} style={btn({ padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)' })}>기본 문장으로</button>
            );
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  {sub('인사말', resetBtn('greeting', DEFAULT_GREETING))}
                  <textarea value={parts.greeting} onChange={setPart('greeting')} disabled={sent} style={ta({ minHeight: 64 })} />
                </div>
                <div>
                  {/* [v2.5] 본문 = 선생님이 읽을 안내문. 개발자 원문은 위 블록에서만 보고, 여기에는 쉬운 말로 풀어 쓴다 */}
                  {sub('본문 — 선생님 안내문', !sent && (
                    <>
                      <button type="button" disabled title="개발자 원문을 CS 어투의 안내문(원인 · 조치 방법 따라하기 순서)으로 바꿔 줍니다. 연동 예정 — BRD-16 §4.4"
                        style={btn({ padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', borderColor: '#E2E8F0', cursor: 'not-allowed' })}>✨ 쉬운 말로 변환 (연동 예정)</button>
                      {item.devComment && (
                        <button type="button" onClick={() => setParts((p) => ({ ...p, body: item.devComment }))} style={btn({ padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)' })}>개발자 원문 붙여넣기</button>
                      )}
                    </>
                  ))}
                  <textarea value={parts.body} onChange={setPart('body')} disabled={sent}
                    placeholder={'선생님이 바로 따라 할 수 있게 적어 주세요. 예)\n무엇이 문제였는지 한 줄 → 왜 생겼는지 한 줄 → 어떻게 하면 되는지 번호 순서 → 그래도 안 될 때 연락 방법'}
                    style={ta({ minHeight: 130, borderColor: '#93C5FD' })} />
                  {item.devComment && !parts.body.trim() && !sent && (
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', marginTop: 4 }}>개발자 원문이 도착했습니다. 위 원문을 보고 본문을 선생님 눈높이로 작성해 주세요.</div>
                  )}
                </div>
                <div>
                  {sub('맺음말', resetBtn('closing', DEFAULT_CLOSING))}
                  <textarea value={parts.closing} onChange={setPart('closing')} disabled={sent} style={ta({ minHeight: 72 })} />
                </div>
                <details style={{ fontSize: 'var(--neo-font-size-sm)' }}>
                  <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 700 }}>발송 메일 미리보기</summary>
                  <pre style={{ margin: '8px 0 0', padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, color: '#1E293B' }}>{composeReply(parts)}</pre>
                </details>
              </div>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>수신</span>
            <input value={mailTo} onChange={(e) => setMailTo(e.target.value)} disabled={sent} placeholder="교사 메일 주소"
              style={{ flex: '1 1 220px', padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }} />
            {resending ? (
              <button onClick={cancelResend} style={btn()}>취소</button>
            ) : (
              <button onClick={onSaveDraft} style={btn()}>임시저장</button>
            )}
            <button onClick={onSendMail} style={btn({ background: '#2A75F3', color: 'white', borderColor: '#2A75F3' })}>{resending ? '✉ 재발송' : '✉ 메일 발송'}</button>
          </div>
            </>
          )}
        </div>
      </div>
     </div>
    </div>
  );
};

/* ── 컨테이너 ─────────────────────────────────────────── */
const IncidentBoard = ({ showToast }) => {
  const [items, setItems] = useState(() => listIncidents());
  const [openId, setOpenId] = useState(null);
  useEffect(() => subscribeIncidents((list) => setItems(list.slice())), []);
  const idx = items.findIndex((r) => r.id === openId);
  // [v2.2] 목록 진입 시 1회 + [↻ Jira 동기화] — 실제 Jira 연동 신고의 상태·댓글 갱신
  const [syncing, setSyncing] = useState(false);
  const syncAll = async (silent) => {
    if (!relayEnabled()) return;
    setSyncing(true);
    const { total, failed } = await syncAllFromJira();
    setSyncing(false);
    if (!silent && showToast) showToast(failed ? `Jira 동기화 — ${total}건 중 ${failed}건 실패` : `Jira 동기화 완료 — ${total}건`, failed ? 'error' : 'success');
  };
  useEffect(() => { syncAll(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (openId && idx >= 0) return <IncidentDetail item={items[idx]} index={idx} onBack={() => setOpenId(null)} showToast={showToast} />;
  return <IncidentList items={items} onOpen={setOpenId} onSyncAll={() => syncAll(false)} syncing={syncing} showToast={showToast} />;
};

export default IncidentBoard;
