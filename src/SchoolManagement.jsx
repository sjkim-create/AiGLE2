/**
 * SchoolManagement.jsx
 * [SCH-01] 학교 관리 목록 — 시스템 관리자 모드
 * [SCH-02] 학교 등록 (drawer)
 * [SCH-03] 학교 상세보기 (drawer)
 * 스크린샷 기준 구현 (mock 데이터)
 */
import React, { useState, useMemo, useRef } from 'react';

// ── mock 데이터 ─────────────────────────────────────────────
const MOCK_SCHOOLS = [
  { id: 1,  name: '한올중학교',        manager: '구현정', position: '교',   phone: '041-544-8161', email: 'hanolm0@cne.go.kr',          teacherCount: 3,  joinDate: '2026.06.16', endDate: '2027.06.30', principal: '최호',   billerName: '김운', billerDept: '행정실', billerEmail: 'hanolm01@cne.go.kr', billerPhone: '041-544-8162', status: '승인완료', certVerified: true },
  { id: 2,  name: '성연초등학교',      manager: '김선욱', position: '교감', phone: '041-544-1001', email: 'tjddus@cne.go.kr',           teacherCount: 1,  joinDate: '2026.06.16', endDate: '2027.06.30', principal: '박교장', billerName: '이행정', billerDept: '행정실', billerEmail: 'tjddus01@cne.go.kr', billerPhone: '041-544-1002', status: '승인완료', certVerified: true },
  { id: 3,  name: '비인초등학교',      manager: '이주현', position: '교사', phone: '041-544-2001', email: 'biin1322@cne.go.kr',         teacherCount: 0,  joinDate: '2026.06.15', endDate: '2027.06.30', principal: '강교장', billerName: '최행정', billerDept: '행정실', billerEmail: 'biin01@cne.go.kr', billerPhone: '041-544-2002', status: '승인완료', certVerified: true },
  { id: 4,  name: '삼은초등학교',      manager: '성종민', position: '교감', phone: '041-544-3001', email: 'sameun@cne.go.kr',           teacherCount: 1,  joinDate: '2026.06.15', endDate: '2027.06.14', principal: '윤교장', billerName: '정행정', billerDept: '행정실', billerEmail: 'sameun01@cne.go.kr', billerPhone: '041-544-3002', status: '승인완료', certVerified: true, extensionRequested: true },
  { id: 5,  name: '도산초등학교',      manager: '이순자', position: '교사', phone: '041-544-4001', email: 'dosan1@cne.go.kr',           teacherCount: 1,  joinDate: '2026.06.15', endDate: '2027.06.30', principal: '도교장', billerName: '한행정', billerDept: '행정실', billerEmail: 'dosan01@cne.go.kr', billerPhone: '041-544-4002', status: '가입승인대기', certVerified: true },
  { id: 6,  name: '한국미래문화고등학교', manager: '안경옥', position: '교',   phone: '02-1234-5001', email: 'kfch@cne.go.kr',            teacherCount: 1,  joinDate: '2026.06.09', endDate: '2026.07.05', principal: '김교장', billerName: '서행정', billerDept: '행정실', billerEmail: 'kfch01@cne.go.kr', billerPhone: '02-1234-5002', status: '승인완료', certVerified: true },
  { id: 7,  name: '네오초등학교',      manager: '김지민', position: '교',   phone: '02-9876-6001', email: 'neolab_elementary@korea.kr', teacherCount: 26, joinDate: '2026.06.08', endDate: '2026.06.10', principal: '오교장', billerName: '문행정', billerDept: '행정실', billerEmail: 'neolab01@korea.kr', billerPhone: '02-9876-6002', status: '승인완료', certVerified: true },
];

// 기준일(프로토타입): 2026-06-16 가정
const TODAY = new Date(2026, 5, 16);
// endDate 'YYYY.MM.DD' → 종료일까지 남은 일수 (음수면 이미 종료)
const endDaysLeft = (endDateStr) => {
  const [y, m, d] = (endDateStr || '').split('.').map(Number);
  if (!y) return Infinity;
  const end = new Date(y, m - 1, d);
  return Math.floor((end - TODAY) / (1000 * 60 * 60 * 24));
};

// [v3.57] 파일명에서 확장자를 제거해 label 기본값으로 사용 (예: '세금계산서_2026-07.pdf' → '세금계산서_2026-07')
const stripExtension = (fileName) => String(fileName || '').replace(/\.[^./\\]+$/, '') || String(fileName || '');

// [v3.72] 발송된 메일 유형 정의 — SCH-03 「발송된 메일 관리」 카드에서 필터·재발송에 사용
const EMAIL_TYPES = {
  'EML-04': { code: 'EML-04', label: '유료 기간 종료 30일 전 안내', targetRole: '학교 관리자', auto: true },
  'EML-05': { code: 'EML-05', label: '학교 회원 승인 · 계약 연장 승인 (기간 포함)', targetRole: '학교 관리자', auto: false },
  'EML-06': { code: 'EML-06', label: '학교 회원가입 승인 (유료회원, 계정 포함)', targetRole: '학교 관리자', auto: true },
  'EML-09': { code: 'EML-09', label: '교사 유료회원 등록 완료', targetRole: '교사', auto: false },
};

// [v3.72] 학교별 초기 발송 메일 mock — 재발송 시나리오 확인용 (일부 학교는 이메일 변경 사례 포함)
//   originalEmail: 발송 당시 이메일 · currentEmail: 현재 등록된 이메일 (다르면 변경 표시 노출)
//   resendHistory: 재발송 이력 배열 (누적)
const makeInitialSentEmails = (s) => {
  if (!s) return [];
  const list = [];
  // 승인완료 학교만 EML-05/06 발송 이력 보유
  if (s.status === '승인완료' || s.status === '유료 계약 승인 완료') {
    list.push({
      id: `em-${s.id}-06`, type: 'EML-06',
      recipientRole: '학교 관리자', recipientName: s.manager,
      originalEmail: s.id === 2 ? 'old_tjddus@cne.go.kr' : s.email,
      currentEmail: s.email,
      sentAt: s.joinDate,
      resendHistory: [],
    });
    list.push({
      id: `em-${s.id}-05`, type: 'EML-05',
      recipientRole: '학교 관리자', recipientName: s.manager,
      originalEmail: s.email, currentEmail: s.email,
      sentAt: s.joinDate, resendHistory: [],
    });
  }
  // 삼은초등학교 — 계약 연장 신청 학교 → EML-04 만기 안내 발송 이력 (D-30 도래 후)
  if (s.id === 4) {
    list.push({
      id: `em-${s.id}-04`, type: 'EML-04',
      recipientRole: '학교 관리자', recipientName: s.manager,
      originalEmail: s.email, currentEmail: s.email,
      sentAt: '2026.05.15', resendHistory: [],
    });
  }
  // EML-09: 교사 유료회원 등록 완료 (교사가 있는 학교 일부)
  //   성연초 정지혜 — 이메일 변경 사례
  if (s.id === 2) {
    list.push({
      id: `em-${s.id}-09-1`, type: 'EML-09',
      recipientRole: '교사', recipientName: '정지혜',
      originalEmail: 'jjh@school.kr', currentEmail: 'jjh_new@gmail.com',
      sentAt: '2026.06.20',
      resendHistory: [{ resentAt: '2026.07.02', toEmail: 'jjh_new@gmail.com' }],
    });
  }
  if (s.id === 4) {
    list.push({
      id: `em-${s.id}-09-1`, type: 'EML-09',
      recipientRole: '교사', recipientName: '박진수',
      originalEmail: 'park@sameun.kr', currentEmail: 'park@sameun.kr',
      sentAt: '2026.06.18', resendHistory: [],
    });
  }
  return list;
};

// 학교별 초기 첨부파일 — 학교관리자가 가입 시 필수 2건 업로드 (재직증명서 · 기관고유번호증)
//  [v3.57] 「확인 대기/확인 완료」 개념 폐기: 서류는 업로드 = 유효로 취급, 확인 독려 UI 삭제
//  [v3.57] label(표시명) · name(원본 파일명) 분리 관리 — label만 수정 가능. 초기 label은 파일명(확장자 제외)
const makeInitialAttachments = (s) => {
  if (!s || !s.certVerified) return [];
  return [
    { id: `doc-${s.id}-1`, label: stripExtension('재직증명서.pdf'), name: '재직증명서.pdf', size: '1.2MB', type: 'pdf', uploadedAt: s.joinDate, uploadedBy: s.manager, uploaderRole: '학교관리자' },
    { id: `doc-${s.id}-2`, label: stripExtension('기관고유번호증.jpg'), name: '기관고유번호증.jpg', size: '0.9MB', type: 'image', uploadedAt: s.joinDate, uploadedBy: s.manager, uploaderRole: '학교관리자' },
  ];
};

// [v3.58] 유료 계약 승인 상태 파생 — form.status·paidApproved·legacy '승인완료' 모두 인식
const isPaidApproved = (s) =>
  s?.paidApproved === true || s?.status === '유료 계약 승인 완료' || s?.status === '승인완료';

// [v3.58] 목록 상태 라벨 5종 재편 (SCH-01)
//   계약 종료 (진빨강+취소선) · 유료 계약 중단 (빨강+취소선) · 계정 비활성화 (회색+취소선)
//   승인 전 (빨강) · 계약 연장 전 D-N (빨강)
//   폐기: 종료 임박(→계약 연장 전 개명), 계약 연장 승인 대기, 가입 승인 대기 (v0.8 통합으로 흡수)
const getSchoolStatuses = (s) => {
  const out = [];
  const days = endDaysLeft(s.endDate);
  const expired = days < 0;
  const approved = isPaidApproved(s);

  if (expired) out.push({
    label: '계약 종료', color: '#B91C1C', strikethrough: true,
    title: `계약 종료 (${s.endDate}) — 학교 관리자·교사 자동 비활성화 처리`,
  });
  if (!expired && s.contractStopped) out.push({
    label: '유료 계약 중단', color: '#B91C1C', strikethrough: true,
    title: '유료 계약 중단 — 학교 관리자 로그인 불가 · 교사 14일 무료 회원 후 휴면',
  });
  if (s.accountDeactivated) out.push({
    label: '계정 비활성화', color: '#64748B', strikethrough: true,
    title: '학교 관리자 계정 비활성화 — 학교 교사에는 영향 없음',
  });
  if (!expired && !approved) out.push({
    label: '승인 전', color: '#DC2626',
    title: '유료 계약 승인 전 — 관리자 승인 대기',
  });
  if (!expired && approved && !s.contractStopped && !s.extensionApplied && days >= 0 && days <= 30) out.push({
    label: `계약 연장 전 D-${days}`, color: '#DC2626',
    title: `계약 연장 전 D-${days} (${s.endDate}) — 만기 30일 이내 & 아직 연장 안 함`,
  });
  return out;
};

const SchoolManagement = () => {
  const [schools, setSchools] = useState(() =>
    MOCK_SCHOOLS.map((s) => ({ ...s, attachments: makeInitialAttachments(s), sentEmails: makeInitialSentEmails(s) }))
  );
  // 상세 drawer 변경을 목록 state에 반영 (서류 확인 상태·승인 처리 등 → 목록 상태 텍스트 동기화)
  const patchSchool = (schoolId, partial) =>
    setSchools((prev) => prev.map((s) => (s.id === schoolId ? { ...s, ...partial } : s)));
  const updateAttachments = (schoolId, nextAttachments) => patchSchool(schoolId, { attachments: nextAttachments });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [schoolFilter, setSchoolFilter] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // [v3.66] 상태 필터 — all/extension/expired/notApproved/accountDeactivated
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'register'
  const [drawerMode, setDrawerMode] = useState(null); // null | 'detail' (상세만 drawer)
  const [detailId, setDetailId] = useState(null);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      if (schoolFilter && !s.name.includes(schoolFilter)) return false;
      if (managerSearch && !s.manager.includes(managerSearch)) return false;
      // [v3.66] 상태 필터 (계약연장 D-30 이하 / 계약 종료 / 승인 전 / 계정 비활성화)
      if (statusFilter !== 'all') {
        const days = endDaysLeft(s.endDate);
        const approved = isPaidApproved(s);
        if (statusFilter === 'extension') {
          // 승인 완료 + 만기 30일 이내 + 아직 연장 안 함 + 만료 아님 + 중단 아님
          if (!(approved && !s.contractStopped && !s.extensionApplied && days >= 0 && days <= 30)) return false;
        } else if (statusFilter === 'expired') {
          if (!(days < 0)) return false;
        } else if (statusFilter === 'notApproved') {
          if (approved) return false;
        } else if (statusFilter === 'accountDeactivated') {
          if (!s.accountDeactivated) return false;
        }
      }
      return true;
    });
  }, [schools, schoolFilter, managerSearch, statusFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = (av < bv) ? -1 : (av > bv) ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paged.map((s) => s.id)));
  };

  const openDetail = (id) => { setDetailId(id); setDrawerMode('detail'); };
  const openRegister = () => { setView('register'); };
  const closeDrawer = () => { setDrawerMode(null); setDetailId(null); };

  // [v3.62~v3.65] 선택 일괄 액션 — 검색창 자리를 대체하는 액션 바
  const selectedSchools = () => schools.filter((s) => selectedIds.has(s.id));
  const allNotApproved = selectedIds.size > 0 && selectedSchools().every((s) => !isPaidApproved(s));
  const allContractLive = selectedIds.size > 0 && selectedSchools().every((s) => isPaidApproved(s) && !s.contractStopped);
  const allAccountDeactivated = selectedIds.size > 0 && selectedSchools().every((s) => s.accountDeactivated);
  // [v3.67] 계약 종료 학교만 선택 시 「유료 계약 갱신」 케이스 추가 — 오늘 기준 1년 갱신
  const allExpired = selectedIds.size > 0 && selectedSchools().every((s) => isPaidApproved(s) && endDaysLeft(s.endDate) < 0);
  // 유료 계약 버튼 4-상태: 승인 / 갱신 / 중단 / 유지 (혼합 시 안전 방향인 유지)
  const contractBtn = (() => {
    if (allNotApproved) return { label: '유료 계약 승인', color: '#2A75F3', border: '#2A75F3', bg: '#EFF6FF', action: 'approve' };
    if (allExpired) return { label: '유료 계약 갱신', color: '#6D28D9', border: '#7C3AED', bg: '#F5F3FF', action: 'renew' };
    if (allContractLive) return { label: '유료 계약 중단', color: '#1D4ED8', border: '#2A75F3', bg: '#EFF6FF', action: 'stop' };
    return { label: '유료 계약 유지', color: '#10B981', border: '#10B981', bg: '#ECFDF5', action: 'keep' };
  })();

  const bulkApply = (patchFn, confirmMsg, toastMsg) => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(confirmMsg.replace('{N}', selectedIds.size))) return;
    setSchools((prev) => prev.map((s) => (selectedIds.has(s.id) ? { ...s, ...patchFn(s) } : s)));
    if (window.showToast) window.showToast(toastMsg.replace('{N}', selectedIds.size));
  };
  const bulkContractApprove = () => bulkApply(
    () => ({ status: '유료 계약 승인 완료', paidApproved: true, contractStopped: false }),
    '선택한 {N}개 학교에 유료 계약 승인을 처리하시겠습니까?',
    '{N}개 학교에 유료 계약 승인이 처리되었습니다. 학교 관리 교사에게 안내 메일이 발송됩니다.',
  );
  const bulkContractStop = () => bulkApply(
    () => ({ contractStopped: true, accountDeactivated: true }),
    '선택한 {N}개 학교의 유료 계약을 중단하시겠습니까?',
    '{N}개 학교의 유료 계약이 중단되었습니다.',
  );
  const bulkContractKeep = () => bulkApply(
    () => ({ contractStopped: false }),
    '선택한 {N}개 학교의 유료 계약을 유지하시겠습니까?',
    '{N}개 학교의 유료 계약이 유지되었습니다.',
  );
  // [v3.67] 계약 종료 학교 일괄 갱신 — 오늘 기준 1년 갱신 (endDate = TODAY + 1년)
  const bulkContractRenew = () => bulkApply(
    () => {
      const t = new Date();
      const nextDate = new Date(t.getFullYear() + 1, t.getMonth(), t.getDate());
      const next = `${nextDate.getFullYear()}.${String(nextDate.getMonth() + 1).padStart(2, '0')}.${String(nextDate.getDate()).padStart(2, '0')}`;
      return { endDate: next, extensionApplied: true };
    },
    '선택한 {N}개 학교의 유료 계약을 갱신하시겠습니까? (오늘부터 1년)',
    '{N}개 학교의 유료 계약이 1년 갱신되었습니다.',
  );
  const bulkAccountActivate = () => bulkApply(
    () => ({ accountDeactivated: false }),
    '선택한 {N}개 학교의 관리자 계정을 활성화하시겠습니까?',
    '{N}개 학교 관리자 계정이 활성화되었습니다.',
  );
  const bulkAccountDeactivate = () => bulkApply(
    () => ({ accountDeactivated: true }),
    '선택한 {N}개 학교의 관리자 계정을 비활성화하시겠습니까?',
    '{N}개 학교 관리자 계정이 비활성화되었습니다.',
  );
  const onContractBtnClick = () => {
    if (contractBtn.action === 'approve') bulkContractApprove();
    else if (contractBtn.action === 'renew') bulkContractRenew();
    else if (contractBtn.action === 'stop') bulkContractStop();
    else bulkContractKeep();
  };

  // 등록 화면 — 별도 페이지
  if (view === 'register') {
    return <SchoolRegisterPage onCancel={() => setView('list')} onComplete={() => setView('list')} />;
  }

  const SortIcon = ({ active, dir }) => (
    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: active ? '#1D4ED8' : '#94A3B8', marginLeft: 4 }}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
    </span>
  );

  const th = { padding: '14px 12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', userSelect: 'none' };
  const td = { padding: '16px 12px', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', borderBottom: '1px solid #F1F5F9' };

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto', background: 'white', position: 'relative' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E293B', margin: 0, marginBottom: 6 }}>학교 관리</h1>
          <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#94A3B8', margin: 0 }}>전체 학교를 관리할 수 있습니다.</p>
        </div>
        <button onClick={openRegister}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--neo-font-size-base)' }}>+</span> 학교 등록
        </button>
      </div>

      {/* [v3.62~v3.65] 필터 영역 — 선택 없으면 검색창, 선택 1개+ 시 일괄 액션 바로 대체 */}
      {selectedIds.size === 0 ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <input type="text" placeholder="학교 선택" value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '11px 38px 11px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box', outline: 'none' }} />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#CBD5E1', pointerEvents: 'none' }}>🔍</span>
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <input type="text" placeholder="관리교사 이름으로 검색" value={managerSearch} onChange={(e) => { setManagerSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '11px 38px 11px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box', outline: 'none' }} />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#CBD5E1', pointerEvents: 'none' }}>🔍</span>
          </div>
          {/* [v3.66] 상태 필터 셀렉트 */}
          <select value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', background: 'white', cursor: 'pointer', minWidth: 200, color: statusFilter === 'all' ? '#94A3B8' : '#1E293B', fontWeight: statusFilter === 'all' ? 500 : 700 }}>
            <option value="all">상태 필터 전체</option>
            <option value="extension">계약 연장 전 (D-30 이하)</option>
            <option value="expired">계약 종료</option>
            <option value="notApproved">승인 전</option>
            <option value="accountDeactivated">계정 비활성화</option>
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10 }}>
          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1D4ED8' }}>
            {selectedIds.size}개 선택
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onContractBtnClick}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${contractBtn.border}`, background: contractBtn.bg, color: contractBtn.color, fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
            {contractBtn.label}
          </button>
          {allAccountDeactivated ? (
            <button type="button" onClick={bulkAccountActivate}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #10B981', background: 'white', color: '#10B981', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
              계정 활성화
            </button>
          ) : (
            <button type="button" onClick={bulkAccountDeactivate}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #EF4444', background: 'white', color: '#EF4444', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
              계정 비활성화
            </button>
          )}
        </div>
      )}

      {/* 테이블 */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 44 }}>
                <input type="checkbox" checked={paged.length > 0 && selectedIds.size === paged.length} onChange={toggleSelectAll} />
              </th>
              <th style={{ ...th, width: 60 }}>No.</th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => toggleSort('name')}>학교 <SortIcon active={sortKey === 'name'} dir={sortDir} /></th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => toggleSort('manager')}>이름 <SortIcon active={sortKey === 'manager'} dir={sortDir} /></th>
              <th style={{ ...th }}>이메일</th>
              <th style={{ ...th, cursor: 'pointer', textAlign: 'center' }} onClick={() => toggleSort('teacherCount')}>등록교사 수 <SortIcon active={sortKey === 'teacherCount'} dir={sortDir} /></th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => toggleSort('joinDate')}>가입일 <SortIcon active={sortKey === 'joinDate'} dir={sortDir} /></th>
              <th style={{ ...th, cursor: 'pointer' }} onClick={() => toggleSort('endDate')}>종료일 <SortIcon active={sortKey === 'endDate'} dir={sortDir} /></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s, idx) => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s.id)}>
                <td style={{ ...td }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td style={{ ...td, color: '#64748B' }}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>
                  <div>{s.name}</div>
                  {(() => {
                    const statuses = getSchoolStatuses(s);
                    return statuses.length > 0 ? (
                      <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                        {statuses.map((st, i) => (
                          <span key={i} title={st.title} style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: st.color, textDecoration: st.strikethrough ? 'line-through' : 'none' }}>{st.label}</span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </td>
                <td style={{ ...td }}>{s.manager}</td>
                <td style={{ ...td, color: '#64748B' }}>{s.email}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    style={{ color: '#2A75F3', textDecoration: 'underline', fontWeight: 600 }}>{s.teacherCount}</a>
                </td>
                <td style={{ ...td, color: '#64748B' }}>{s.joinDate.replace(/\d{4}\./, (m) => m.slice(2))}</td>
                <td style={{ ...td, color: '#64748B' }}>{s.endDate.replace(/\d{4}\./, (m) => m.slice(2))}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '40px 12px' }}>검색 결과가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
        <PageBtn onClick={() => setPage(1)} disabled={page === 1}>|◁</PageBtn>
        <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>◁</PageBtn>
        {Array.from({ length: totalPages }, (_, i) => (
          <PageBtn key={i} active={page === i + 1} onClick={() => setPage(i + 1)}>{i + 1}</PageBtn>
        ))}
        <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>▷</PageBtn>
        <PageBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>▷|</PageBtn>
      </div>

      {/* 상세 Drawer (등록은 별도 페이지 — SchoolRegisterPage) */}
      {drawerMode === 'detail' && (
        <SchoolDrawer
          school={schools.find((s) => s.id === detailId)}
          onClose={closeDrawer}
          onAttachmentsChange={updateAttachments}
          onSchoolPatch={patchSchool}
        />
      )}
    </div>
  );
};

const PageBtn = ({ active, children, ...props }) => (
  <button {...props}
    style={{
      width: 32, height: 32, borderRadius: 8,
      border: '1px solid', borderColor: active ? '#2A75F3' : '#E2E8F0',
      background: active ? '#2A75F3' : 'white',
      color: active ? 'white' : props.disabled ? '#CBD5E1' : '#475569',
      fontSize: 'var(--neo-font-size-sm)', fontWeight: 700,
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
    {children}
  </button>
);

// [v3.60] 상태 토글 스위치 — on(오른쪽·초록)=정상, off(왼쪽·빨강)=중단/비활성
//   양쪽 라벨 동시 노출, 슬라이더로 현재 상태 표시
const StatusToggle = ({ on, onLabel, offLabel, onClick, disabled, disabledReason }) => {
  const onColor = '#10B981', offColor = '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* 왼쪽 라벨 (off 상태) */}
      <span style={{
        fontSize: 'var(--neo-font-size-sm)', fontWeight: on ? 500 : 800,
        color: on ? '#CBD5E1' : offColor, minWidth: 96, textAlign: 'right',
      }}>{offLabel}</span>
      {/* 스위치 */}
      <button type="button" onClick={onClick} disabled={disabled}
        aria-pressed={on}
        title={disabled && disabledReason ? disabledReason : `현재: ${on ? onLabel : offLabel} · 클릭 시 반대 상태로 전환`}
        style={{
          position: 'relative', width: 48, height: 26,
          borderRadius: 999, border: 'none',
          background: on ? onColor : offColor,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0, transition: 'background 0.15s',
          opacity: disabled ? 0.5 : 1,
        }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 25 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'left 0.15s',
        }} />
      </button>
      {/* 오른쪽 라벨 (on 상태) */}
      <span style={{
        fontSize: 'var(--neo-font-size-sm)', fontWeight: on ? 800 : 500,
        color: on ? onColor : '#CBD5E1', minWidth: 96,
      }}>{onLabel}</span>
    </div>
  );
};

// ── 학교 정보 Drawer (SCH-03 상세) — 첨부파일 관리(여러 개 업로드·보관) ──────────
const SchoolDrawer = ({ school, onClose, onAttachmentsChange, onSchoolPatch }) => {
  const isDetail = true;
  const initial = school || {
    name: '', email: '', manager: '', position: '', phone: '',
    principal: '', billerName: '', billerDept: '', billerEmail: '', billerPhone: '',
    joinDate: '', endDate: '', status: '대기', certVerified: false,
  };

  const [form, setForm] = useState(initial);
  const [businessNote, setBusinessNote] = useState('');

  // ── 첨부파일 관리 (여러 개 업로드·보관) — 목록 state에서 내려받아 시작 ──
  const [attachments, setAttachments] = useState(() => school?.attachments ?? []);
  const seq = useRef(1000);

  // 로컬 state + 목록(부모) state 동기화 (🔴 아이콘 즉시 반영)
  const applyAttachments = (next) => {
    setAttachments(next);
    if (school?.id != null) onAttachmentsChange?.(school.id, next);
  };

  const addAttachments = (fileList) => {
    // [v3.57] 시스템관리자 업로드는 개수 제한 없음. label은 업로드 파일명(확장자 제외)로 자동 세팅
    const files = Array.from(fileList || []);
    // [v3.70] 업로드 시각은 TODAY 기준 실제 날짜 문자열로 저장 (「방금 전」 표기 폐기)
    const t = TODAY;
    const todayStr = `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
    const incoming = files.map((f) => ({
      id: `up-${seq.current++}`,
      label: stripExtension(f.name),
      name: f.name,
      size: f.size ? `${(f.size / (1024 * 1024)).toFixed(1)}MB` : '-',
      type: (f.type || '').includes('pdf') ? 'pdf' : 'image',
      uploadedAt: todayStr,
      uploadedBy: '운영팀',
      uploaderRole: '시스템관리자',
    }));
    if (incoming.length) { applyAttachments([...attachments, ...incoming]); setDirty(true); }
  };
  const removeAttachment = (id) => { applyAttachments(attachments.filter((f) => f.id !== id)); setDirty(true); };
  // [v3.57] label(표시명) 수정 — 원본 파일명(name)과 분리 관리. name은 다운로드용으로 보존, label만 관리자가 자유롭게 변경
  const renameLabel = (id, nextLabel) => {
    const cleaned = String(nextLabel || '').trim();
    if (!cleaned) return;
    applyAttachments(attachments.map((f) => (f.id === id ? { ...f, label: cleaned } : f)));
    setDirty(true);
  };
  // label 편집 중인 항목 id 추적
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  // [v3.57] 파일 필터·정렬 툴바 (10~30건 시나리오 대비 B안)
  //   [v3.70] 「업로더순」 정렬 옵션 폐기 — role 필터 chip으로 이미 그룹핑 가능. 「방금 전」 표기 폐기로 parseUploadDate 특수 케이스도 제거
  const [attSearch, setAttSearch] = useState('');
  const [attSort, setAttSort] = useState('newest'); // newest | oldest | name
  const [attRoleFilter, setAttRoleFilter] = useState('all'); // all | 학교관리자 | 시스템관리자

  // [v3.72] 발송된 메일 관리 — 로컬 state + 목록 state 동기화
  const [sentEmails, setSentEmails] = useState(() => school?.sentEmails ?? []);
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const applySentEmails = (next) => {
    setSentEmails(next);
    if (school?.id != null) onSchoolPatch?.(school.id, { sentEmails: next });
  };
  // 재발송 — 확인 모달 + 성공/실패 토스트. 재발송 이력을 resendHistory에 누적
  const resendEmail = (id) => {
    const em = sentEmails.find((x) => x.id === id);
    if (!em) return;
    const typeLabel = EMAIL_TYPES[em.type]?.label || em.type;
    if (!window.confirm(`${em.type} ${typeLabel} 메일을 재발송 하시겠습니까?\n수신: ${em.currentEmail}`)) return;
    try {
      const t = TODAY;
      const nowStr = `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
      const nextEmails = sentEmails.map((x) => x.id === id
        ? { ...x, resendHistory: [...(x.resendHistory || []), { resentAt: nowStr, toEmail: x.currentEmail }] }
        : x);
      applySentEmails(nextEmails);
      if (window.showToast) window.showToast(`${em.recipientName}(${em.currentEmail})에게 ${em.type} 메일이 재발송되었습니다.`);
    } catch (e) {
      if (window.showToast) window.showToast('메일 재발송 중 문제가 발생했습니다.');
    }
  };
  const filteredSentEmails = emailTypeFilter === 'all'
    ? sentEmails
    : sentEmails.filter((e) => e.type === emailTypeFilter);

  // uploadedAt 문자열(YYYY.MM.DD) → Date
  const parseUploadDate = (s) => {
    const [y, m, d] = String(s || '').split('.').map(Number);
    if (!y) return new Date(0);
    return new Date(y, m - 1, d);
  };

  // 필터·검색·정렬 파생 (편집 중이어도 렌더 유지)
  const filteredAttachments = (() => {
    let items = [...attachments];
    if (attRoleFilter !== 'all') items = items.filter((f) => (f.uploaderRole || '시스템관리자') === attRoleFilter);
    const q = attSearch.trim().toLowerCase();
    if (q) items = items.filter((f) => (f.label || '').toLowerCase().includes(q) || (f.name || '').toLowerCase().includes(q));
    const cmp = {
      newest: (a, b) => parseUploadDate(b.uploadedAt) - parseUploadDate(a.uploadedAt),
      oldest: (a, b) => parseUploadDate(a.uploadedAt) - parseUploadDate(b.uploadedAt),
      name: (a, b) => String(a.label || '').localeCompare(String(b.label || '')),
    };
    items.sort(cmp[attSort] || cmp.newest);
    return items;
  })();

  // role별 카운트 (chip에 표기)
  const roleCounts = {
    all: attachments.length,
    학교관리자: attachments.filter((f) => f.uploaderRole === '학교관리자').length,
    시스템관리자: attachments.filter((f) => (f.uploaderRole || '시스템관리자') === '시스템관리자').length,
  };

  // 첨부파일 외 내용(폼 필드·업무처리 메모) 또는 첨부 추가/삭제로 변경사항 발생 시 「수정 완료」 활성화
  const [dirty, setDirty] = useState(false);
  const update = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  // ── [v3.57] 회원 상태 & 유료 계약 승인 통합 처리 ─────────────────────────────
  //   승인 요청 여부와 무관하게 관리자가 직접 승인·연장·중단·비활성화 가능
  const [extensionApplied, setExtensionApplied] = useState(school?.extensionApplied ?? false);
  const [contractStopped, setContractStopped] = useState(school?.contractStopped ?? false);
  const [accountDeactivated, setAccountDeactivated] = useState(school?.accountDeactivated ?? false);

  // [v3.57] paidApproved를 form.status 파생값으로 관리 — 상태 동기 오차 방지
  //   form.status가 '유료 계약 승인 완료' 또는 legacy '승인완료' 값일 때 승인 상태로 인식
  const paidApproved = form.status === '유료 계약 승인 완료' || form.status === '승인완료' || school?.paidApproved === true;

  // 유료 계약 승인 — 상태 변경 + 학교 관리 교사 메일 발송(mock)
  const approvePaidContract = () => {
    setForm((p) => ({ ...p, status: '유료 계약 승인 완료' }));
    if (school?.id != null) onSchoolPatch?.(school.id, { status: '유료 계약 승인 완료', paidApproved: true });
    if (window.showToast) window.showToast('학교 관리 교사에게 유료 계약 승인 완료 안내 메일이 발송되었습니다.');
  };

  // [v3.67] 유료 계약 연장/갱신 — 종료일이 미래면 endDate + 1년(연장), 만료된 상태면 오늘 + 1년(갱신)
  const applyExtension = () => {
    const [y, m, d] = (form.endDate || '').split('.').map(Number);
    let next = form.endDate;
    if (y) {
      const endTs = new Date(y, m - 1, d).getTime();
      const base = endTs > Date.now() ? new Date(y, m - 1, d) : new Date();
      const nextDate = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
      next = `${nextDate.getFullYear()}.${String(nextDate.getMonth() + 1).padStart(2, '0')}.${String(nextDate.getDate()).padStart(2, '0')}`;
    }
    const isRenewal = y && new Date(y, m - 1, d).getTime() <= Date.now();
    setForm((p) => ({ ...p, endDate: next }));
    setExtensionApplied(true);
    if (school?.id != null) onSchoolPatch?.(school.id, { endDate: next, extensionApplied: true });
    if (window.showToast) window.showToast(isRenewal ? '유료 계약이 1년 갱신되었습니다.' : '유료 계약이 1년 연장되었습니다.');
  };

  // [v3.59] 유료 계약 중단 → 계정 비활성화 동반 세팅 (단독 중단 불가)
  //   중단 시: contractStopped=true + accountDeactivated=true 동반. 학교 관리자 즉시 로그인 불가, 교사 14일 무료→휴면 (mock)
  //   유지 시: contractStopped=false만 세팅. 계정 활성화는 별도 [계정 활성화] 액션으로 처리 (자동 해제 안 함)
  const toggleContractStopped = () => {
    const next = !contractStopped;
    const confirmMsg = next ? '유료 계약을 중단 하시겠습니까?' : '유료 계약을 유지 하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;
    try {
      setContractStopped(next);
      const patch = { contractStopped: next };
      if (next) {
        // 중단 시 계정 비활성화 동반 설정
        setAccountDeactivated(true);
        patch.accountDeactivated = true;
      }
      // 유지(next=false) 시에는 accountDeactivated 자동 해제하지 않음
      if (school?.id != null) onSchoolPatch?.(school.id, patch);
      if (window.showToast) window.showToast(next ? '유료 계약이 중단되었습니다.' : '유료 계약이 유지되었습니다.');
    } catch (e) {
      if (window.showToast) window.showToast(next ? '유료 계약 중단 중 문제가 발생했습니다.' : '유료 계약 승인 중 문제가 발생했습니다.');
    }
  };

  // [v3.58/v3.71] 계정 비활성화 ↔ 활성화 토글 — 학교 관리자 계정만 대상
  //   유료 계약 중단 상태에서는 조작 불가 (계약 상태가 상위 규칙)
  const toggleAccountDeactivated = () => {
    if (contractStopped) {
      if (window.showToast) window.showToast('유료 계약 중단 상태에서는 계정을 활성화할 수 없습니다. 먼저 「유료 계약 유지」로 전환하세요.');
      return;
    }
    const next = !accountDeactivated;
    const confirmMsg = next ? '학교 관리자 계정을 비활성화 하시겠습니까?' : '학교 관리자 계정을 활성화 하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;
    setAccountDeactivated(next);
    if (school?.id != null) onSchoolPatch?.(school.id, { accountDeactivated: next });
    if (window.showToast) window.showToast(next ? '학교 관리자 계정이 비활성화되었습니다.' : '학교 관리자 계정이 활성화되었습니다.');
  };

  // [v3.67] 활성화 판정 — 만기 30일 이내(연장) OR 이미 종료(갱신) 시 모두 활성
  //   isExpired: 만료 여부 판정용 파생값 (버튼 라벨 분기에 사용)
  const { canExtend, isExpired } = (() => {
    if (extensionApplied || !paidApproved) return { canExtend: false, isExpired: false };
    if (!form.endDate) return { canExtend: false, isExpired: false };
    const [y, m, d] = form.endDate.split('.').map(Number);
    if (!y) return { canExtend: false, isExpired: false };
    const endTs = new Date(y, m - 1, d).getTime();
    const now = Date.now();
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const remaining = endTs - now;
    const expired = remaining < 0;
    // 만기 30일 이내(연장) OR 만료(갱신)면 활성
    return { canExtend: expired || (remaining >= 0 && remaining <= oneMonthMs), isExpired: expired };
  })();

  // 수정 완료 → 편집한 폼 값을 목록 state에 반영 후 닫기 (날짜 변경 시 목록 상태 텍스트 재계산)
  //  ※ attachments/extensionRequested는 별도 경로로 관리되므로 폼 필드만 patch
  const saveEdits = () => {
    if (school?.id != null) {
      onSchoolPatch?.(school.id, {
        manager: form.manager, position: form.position, phone: form.phone, principal: form.principal,
        billerName: form.billerName, billerDept: form.billerDept, billerEmail: form.billerEmail, billerPhone: form.billerPhone,
        joinDate: form.joinDate, endDate: form.endDate, status: form.status,
      });
    }
    onClose();
  };

  const fieldLabel = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' };
  const star = <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>;
  const inputBox = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
  const readonlyBox = { ...inputBox, background: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed' };
  const fieldWrap = { position: 'relative' };
  const clearBtn = (onClear) => (
    <button type="button" onClick={onClear}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, border: 'none', background: '#E2E8F0', borderRadius: '50%', color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9500 }} />
      <div onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '60vw', maxWidth: 1200, minWidth: 800,
          background: 'white', zIndex: 9501, display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 30px rgba(15,23,42,0.18)',
        }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 800, color: '#1E293B', margin: 0 }}>{isDetail ? '학교 정보' : '학교 등록'}</h2>
            {isDetail && (
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>가입일 : {form.joinDate}</span>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8' }}>✕</button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {/* 좌측: 기본 정보 — [v3.58] minWidth: 0으로 grid track 확장 방지 (긴 파일명 등이 부모 폭 밀지 못하게) */}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', margin: '0 0 16px' }}>기본 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={fieldLabel}>학교명</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} readOnly={isDetail}
                  style={isDetail ? readonlyBox : inputBox} placeholder="학교명을 입력하세요" />
              </div>
              <div>
                <label style={fieldLabel}>이메일</label>
                <div style={fieldWrap}>
                  <input value={form.email} onChange={(e) => update('email', e.target.value)} readOnly={isDetail}
                    style={{ ...(isDetail ? readonlyBox : inputBox), paddingRight: 42 }} placeholder="example@domain.kr" />
                  {isDetail && (
                    <button onClick={() => navigator.clipboard?.writeText(form.email)}
                      title="이메일 복사"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: '1px solid #E2E8F0', background: 'white', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>📋</button>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={fieldLabel}>관리교사 이름{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.manager} onChange={(e) => update('manager', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="이름" />
                    {form.manager && clearBtn(() => update('manager', ''))}
                  </div>
                </div>
                <div>
                  <label style={fieldLabel}>관리교사 직위{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.position} onChange={(e) => update('position', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="직위" />
                    {form.position && clearBtn(() => update('position', ''))}
                  </div>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>관리교사 직통 연락처{star}</label>
                <div style={fieldWrap}>
                  <input value={form.phone} onChange={(e) => update('phone', e.target.value)}
                    style={{ ...inputBox, paddingRight: 32 }} placeholder="000-0000-0000" />
                  {form.phone && clearBtn(() => update('phone', ''))}
                </div>
              </div>
              <div>
                <label style={fieldLabel}>기관장 이름{star}</label>
                <div style={fieldWrap}>
                  <input value={form.principal} onChange={(e) => update('principal', e.target.value)}
                    style={{ ...inputBox, paddingRight: 32 }} placeholder="기관장 이름" />
                  {form.principal && clearBtn(() => update('principal', ''))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={fieldLabel}>결제 담당자 이름{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.billerName} onChange={(e) => update('billerName', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="이름" />
                    {form.billerName && clearBtn(() => update('billerName', ''))}
                  </div>
                </div>
                <div>
                  <label style={fieldLabel}>결제 담당자 부서{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.billerDept} onChange={(e) => update('billerDept', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="부서명" />
                    {form.billerDept && clearBtn(() => update('billerDept', ''))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={fieldLabel}>결제 담당자 이메일{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.billerEmail} onChange={(e) => update('billerEmail', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="example@domain.kr" />
                    {form.billerEmail && clearBtn(() => update('billerEmail', ''))}
                  </div>
                </div>
                <div>
                  <label style={fieldLabel}>결제 담당자 연락처{star}</label>
                  <div style={fieldWrap}>
                    <input value={form.billerPhone} onChange={(e) => update('billerPhone', e.target.value)}
                      style={{ ...inputBox, paddingRight: 32 }} placeholder="000-0000-0000" />
                    {form.billerPhone && clearBtn(() => update('billerPhone', ''))}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ ...fieldLabel, marginBottom: 0 }}>
                    첨부파일 관리
                    <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: 4 }}>(재직증명서 · 기관 고유번호증 등)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #2A75F3', background: 'white', color: '#2A75F3', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-base)', lineHeight: 1 }}>＋</span> 파일 추가
                    <input type="file" accept="image/jpeg,image/png,application/pdf" multiple
                      onChange={(e) => { addAttachments(e.target.files); e.target.value = ''; }}
                      style={{ display: 'none' }} />
                  </label>
                </div>

                {/* [v3.57] 파일 필터·정렬 툴바 — 첨부 2건 초과 시 노출 */}
                {attachments.length > 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', pointerEvents: 'none' }}>🔍</span>
                        <input
                          value={attSearch}
                          onChange={(e) => setAttSearch(e.target.value)}
                          placeholder="표시명 · 파일명 검색"
                          style={{ width: '100%', padding: '7px 30px 7px 30px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {attSearch && (
                          <button type="button" onClick={() => setAttSearch('')} title="검색 초기화"
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, border: 'none', background: '#E2E8F0', borderRadius: '50%', color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                        )}
                      </div>
                      <select value={attSort} onChange={(e) => setAttSort(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                        <option value="newest">최신순</option>
                        <option value="oldest">오래된순</option>
                        <option value="name">이름순</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { key: 'all', label: '전체', count: roleCounts.all },
                        { key: '학교관리자', label: '학교관리자', count: roleCounts.학교관리자 },
                        { key: '시스템관리자', label: '시스템관리자', count: roleCounts.시스템관리자 },
                      ].map((c) => {
                        const active = attRoleFilter === c.key;
                        return (
                          <button key={c.key} type="button" onClick={() => setAttRoleFilter(c.key)}
                            style={{
                              padding: '3px 10px', borderRadius: 999,
                              border: '1px solid', borderColor: active ? '#2A75F3' : '#E2E8F0',
                              background: active ? '#EFF6FF' : 'white',
                              color: active ? '#1D4ED8' : '#64748B',
                              fontWeight: active ? 800 : 600, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer',
                            }}>
                            {c.label} <span style={{ color: active ? '#1D4ED8' : '#94A3B8', fontWeight: 700 }}>{c.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addAttachments(e.dataTransfer.files); }}
                  style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', maxHeight: 360, overflowY: filteredAttachments.length > 6 ? 'auto' : 'visible' }}>
                  {attachments.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6, background: '#F8FAFC' }}>
                      등록된 첨부파일이 없습니다.<br />
                      파일을 끌어다 놓거나 「파일 추가」로 업로드하세요.
                    </div>
                  ) : filteredAttachments.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6, background: '#F8FAFC' }}>
                      검색·필터 조건에 맞는 파일이 없습니다.
                      <button type="button" onClick={() => { setAttSearch(''); setAttRoleFilter('all'); }}
                        style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
                        조건 초기화
                      </button>
                    </div>
                  ) : (
                    filteredAttachments.map((file, i) => {
                      const isSchoolAdminFile = file.uploaderRole === '학교관리자';
                      const isRenaming = renamingId === file.id;
                      const displayLabel = file.label || file.name || '(이름 없음)';
                      const commitRename = () => {
                        renameLabel(file.id, renameDraft);
                        setRenamingId(null); setRenameDraft('');
                      };
                      const startRename = () => {
                        setRenameDraft(displayLabel);
                        setRenamingId(file.id);
                      };
                      return (
                      <div key={file.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < filteredAttachments.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <span style={{ fontSize: 'var(--neo-font-size-base)', flexShrink: 0 }}>{file.type === 'pdf' ? '📄' : '🖼'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 1행: label (편집 가능) · 원본 파일명 (수정 불가) */}
                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); } }}
                              onBlur={commitRename}
                              placeholder="표시명 (예: 2026-07 세금계산서)"
                              style={{ width: '100%', padding: '3px 7px', borderRadius: 5, border: '1px solid #2A75F3', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', outline: 'none', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                              <span
                                title={'더블클릭 또는 ✎ 버튼으로 표시명(label) 수정'}
                                onDoubleClick={startRename}
                                style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', cursor: 'text', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '38%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {displayLabel}
                              </span>
                              <span style={{ color: '#CBD5E1', flexShrink: 0 }}>·</span>
                              <span
                                title={`원본 파일명 (수정 불가): ${file.name}`}
                                style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                📎 {file.name}
                              </span>
                            </div>
                          )}
                          {/* 2행: 업로드 날짜 + 업로더 역할 배지 */}
                          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{file.uploadedAt}</span>
                            <span style={{ padding: '0 6px', borderRadius: 999, background: isSchoolAdminFile ? '#EFF6FF' : '#F1F5F9', color: isSchoolAdminFile ? '#1D4ED8' : '#64748B', fontWeight: 700 }}>
                              {file.uploaderRole || '시스템관리자'}
                            </span>
                          </div>
                        </div>
                        {/* 표시명(label) 편집 */}
                        <button type="button" onClick={startRename} title="표시명(label) 수정 — 원본 파일명은 변경되지 않습니다" disabled={isRenaming}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: isRenaming ? '#CBD5E1' : '#475569', cursor: isRenaming ? 'not-allowed' : 'pointer', fontSize: 'var(--neo-font-size-xs)', flexShrink: 0 }}>✎</button>
                        {/* 미리보기 / 다운로드 */}
                        <button type="button" title="미리보기 / 다운로드"
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', flexShrink: 0 }}>⤓</button>
                        {/* 삭제 */}
                        <button type="button" onClick={() => removeAttachment(file.id)} title="삭제"
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #FECACA', background: 'white', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', flexShrink: 0 }}>🗑</button>
                      </div>
                      );
                    })
                  )}
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', margin: '8px 0 0', lineHeight: 1.75 }}>
                  <div>① <strong style={{ color: '#334155' }}>파일 형식</strong> — JPG · PNG · PDF · 파일당 10MB 이하</div>
                  <div>② <strong style={{ color: '#334155' }}>업로드 정책</strong> — 학교관리자 2건 고정 / 시스템관리자 개수 제한 없음</div>
                  <div>③ <strong style={{ color: '#334155' }}>표시명(label)</strong> — 업로드 파일명(확장자 제외)으로 자동 부여, <code style={{ background: 'white', border: '1px solid #E2E8F0', padding: '0 4px', borderRadius: 3, fontSize: 'var(--neo-font-size-xs)' }}>✎</code> 또는 표시명 더블클릭으로 수정</div>
                  <div>④ <strong style={{ color: '#334155' }}>원본 파일명</strong> — 수정 불가 (다운로드 시 원본 파일명 그대로 사용)</div>
                </div>
              </div>

              {/* [v3.72] 발송된 메일 관리 — 이메일 변경 시 재발송 지원 */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ ...fieldLabel, marginBottom: 0 }}>
                    발송된 메일 관리
                    <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: 4 }}>(EML-04·05·06·09)</span>
                  </label>
                  <select value={emailTypeFilter} onChange={(e) => setEmailTypeFilter(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                    <option value="all">전체 ({sentEmails.length})</option>
                    {Object.values(EMAIL_TYPES).map((t) => {
                      const count = sentEmails.filter((e) => e.type === t.code).length;
                      return <option key={t.code} value={t.code}>{t.code} ({count})</option>;
                    })}
                  </select>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', maxHeight: 360, overflowY: filteredSentEmails.length > 4 ? 'auto' : 'visible' }}>
                  {sentEmails.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', background: '#F8FAFC' }}>
                      발송된 메일이 없습니다.
                    </div>
                  ) : filteredSentEmails.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', background: '#F8FAFC' }}>
                      선택한 유형의 발송 메일이 없습니다.
                      <button type="button" onClick={() => setEmailTypeFilter('all')}
                        style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 5, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>
                        전체 보기
                      </button>
                    </div>
                  ) : (
                    filteredSentEmails.map((em, i) => {
                      const meta = EMAIL_TYPES[em.type] || { label: em.type };
                      const emailChanged = em.originalEmail !== em.currentEmail;
                      const resendCount = (em.resendHistory || []).length;
                      return (
                        <div key={em.id} style={{ padding: '10px 12px', borderBottom: i < filteredSentEmails.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* 1행: 유형 + 라벨 */}
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                                <span style={{ padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 800, fontSize: 'var(--neo-font-size-xs)', flexShrink: 0 }}>{em.type}</span>
                                <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {meta.label}
                                </span>
                                {meta.auto && (
                                  <span title="자동 발송 유형" style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', flexShrink: 0 }}>· 자동</span>
                                )}
                              </div>
                              {/* 2행: 수신자 · 이메일 */}
                              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>
                                {em.recipientRole} · <strong style={{ color: '#334155' }}>{em.recipientName}</strong>
                                {' · '}
                                {emailChanged ? (
                                  <>
                                    <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>{em.originalEmail}</span>
                                    <span style={{ color: '#94A3B8' }}> → </span>
                                    <span style={{ color: '#B45309', fontWeight: 700 }}>{em.currentEmail}</span>
                                    <span title="이메일 변경됨 · 재발송 권장" style={{ marginLeft: 4, padding: '0 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>변경됨</span>
                                  </>
                                ) : (
                                  <span>{em.currentEmail}</span>
                                )}
                              </div>
                              {/* 3행: 발송일 · 재발송 이력 */}
                              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 1 }}>
                                📅 최초 발송 {em.sentAt}
                                {resendCount > 0 && (
                                  <span style={{ marginLeft: 6, color: '#7C3AED', fontWeight: 700 }}>
                                    · 재발송 {resendCount}회 (최근: {em.resendHistory[resendCount - 1].resentAt} → {em.resendHistory[resendCount - 1].toEmail})
                                  </span>
                                )}
                              </div>
                            </div>
                            <button type="button" onClick={() => resendEmail(em.id)} title={`현재 등록된 이메일(${em.currentEmail})로 재발송`}
                              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2A75F3', background: emailChanged ? '#2A75F3' : 'white', color: emailChanged ? 'white' : '#2A75F3', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              재발송
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.5 }}>
                  ※ 재발송은 <strong>현재 등록된 이메일 주소</strong>로 발송됩니다. 원본 발송 시 이메일과 다르면 <span style={{ padding: '0 5px', borderRadius: 3, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>변경됨</span> 배지가 표시됩니다. 자동 발송 유형(EML-04·EML-06)도 관리자 판단으로 수동 재발송 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 우측: 유형 및 상태 — [v3.58] minWidth: 0으로 grid track 확장 방지 */}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', margin: '0 0 16px' }}>유형 및 상태</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={fieldLabel}>비밀번호</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="password" value="••••" readOnly style={{ ...readonlyBox, flex: 1 }} />
                  <button style={{ padding: '0 18px', borderRadius: 8, border: '1px solid #EF4444', background: 'white', color: '#EF4444', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>초기화</button>
                </div>
              </div>
              {/* [v3.57] 회원 상태 & 유료 계약 승인 통합 — 회원 유형 필드 삭제, 승인 대기/완료 분기 병합 */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', marginBottom: 10 }}>
                  회원 상태 & 유료 계약 승인
                </div>

                {/* 상태 배지 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>상태:</span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999,
                    background: paidApproved ? '#DCFCE7' : '#FEF3C7',
                    color: paidApproved ? '#166534' : '#92400E',
                    fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
                  }}>
                    {paidApproved ? '✓ 유료 계약 승인 완료' : '⚠ 유료 계약 승인 전'}
                  </span>
                  {paidApproved && contractStopped && (
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: '#FEE2E2', color: '#B91C1C', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', textDecoration: 'line-through' }}>
                      유료 계약 중단
                    </span>
                  )}
                  {/* [v3.58] 계정 비활성화 배지 — 계약 중단 시 파생 표시 or 계정 비활성화 필드 세팅 시 */}
                  {(contractStopped || accountDeactivated) && (
                    <span title={contractStopped && !accountDeactivated ? '유료 계약 중단으로 학교 관리자 계정 로그인 불가 (파생 표시)' : '학교 관리자 계정 비활성화'}
                      style={{ padding: '3px 10px', borderRadius: 999, background: '#F1F5F9', color: '#64748B', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', textDecoration: 'line-through' }}>
                      계정 비활성화
                    </span>
                  )}
                </div>

                {/* [v3.61] 액션 영역 — 승인 분기(승인 버튼 or 연장 버튼) + 상시 노출 토글 스위치 2종 */}
                {/* 1) 승인 분기 블록 — 승인 전엔 승인 버튼, 승인 후엔 연장 버튼 */}
                {!paidApproved ? (
                  <div style={{ marginBottom: 12 }}>
                    <button type="button" onClick={approvePaidContract}
                      style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                      유료 계약 승인
                    </button>
                    <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '10px 0 0', lineHeight: 1.5 }}>
                      유료 계약 승인으로 회원 상태는 <strong>'유료 계약 승인 완료'</strong>로 변경되며, 학교 관리 교사에게 메일이 발송됩니다.
                    </p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <button type="button" onClick={applyExtension} disabled={!canExtend}
                      title={extensionApplied ? '이미 연장 완료됨' : (canExtend ? (isExpired ? '계약 종료 상태 — 오늘 기준 1년 갱신' : '유료 계약 1년 연장') : '만기 1개월 전에만 활성화됩니다')}
                      style={{
                        padding: '8px 16px', borderRadius: 8,
                        border: canExtend ? (isExpired ? '1px solid #7C3AED' : '1px solid #2A75F3') : '1px solid #CBD5E1',
                        background: canExtend ? (isExpired ? '#F5F3FF' : '#EFF6FF') : '#F1F5F9',
                        color: canExtend ? (isExpired ? '#6D28D9' : '#1D4ED8') : '#94A3B8',
                        fontWeight: 700, fontSize: 'var(--neo-font-size-sm)',
                        cursor: canExtend ? 'pointer' : 'not-allowed',
                      }}>
                      {canExtend && isExpired ? '유료 계약 갱신' : `유료 계약 연장${canExtend ? '' : ' (만기 1개월 전 활성화)'}`}
                    </button>
                  </div>
                )}

                {/* 2) [v3.69] 토글 스위치 2종 — 유료 계약 승인 후에만 노출 (승인 전에는 계약 자체가 없어 유지/중단·계정 상태 액션이 의미 없음) */}
                {paidApproved && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                    <StatusToggle
                      on={!contractStopped}
                      onLabel="유료 계약 유지"
                      offLabel="유료 계약 중단"
                      onClick={toggleContractStopped}
                    />
                    {/* [v3.71] 유료 계약 중단 상태에서는 계정 스위치 disabled — 계약 상태가 상위, 계정 상태는 하위 */}
                    <StatusToggle
                      on={!accountDeactivated}
                      onLabel="계정 활성화"
                      offLabel="계정 비활성화"
                      onClick={toggleAccountDeactivated}
                      disabled={contractStopped}
                      disabledReason="유료 계약 중단 상태에서는 계정을 활성화할 수 없습니다. 먼저 「유료 계약 유지」로 전환하세요."
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={fieldLabel}>유료 회원 기간</label>
                {/* 시작일 ~ 종료일 편집 (YYYY.MM.DD ↔ date input YYYY-MM-DD 변환) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="date" value={(form.joinDate || '').replace(/\./g, '-')}
                    onChange={(e) => update('joinDate', e.target.value.replace(/-/g, '.'))}
                    style={{ ...inputBox, flex: 1 }} />
                  <span style={{ color: '#94A3B8', fontWeight: 700 }}>~</span>
                  <input type="date" value={(form.endDate || '').replace(/\./g, '-')}
                    onChange={(e) => update('endDate', e.target.value.replace(/-/g, '.'))}
                    style={{ ...inputBox, flex: 1 }} />
                </div>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: '6px 0 0' }}>* 날짜 변경 시 메일이 발송되지 않습니다.</p>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={fieldLabel}>업무 처리</label>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                  {/* 서식 툴바 (mock) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', color: '#475569', flexWrap: 'wrap' }}>
                    <select style={{ padding: '3px 6px', fontSize: 'var(--neo-font-size-sm)', border: '1px solid #E2E8F0', borderRadius: 4 }}>
                      <option>맑은 고딕</option><option>나눔고딕</option>
                    </select>
                    <select style={{ padding: '3px 6px', fontSize: 'var(--neo-font-size-sm)', border: '1px solid #E2E8F0', borderRadius: 4 }}>
                      <option>10pt</option><option>12pt</option><option>14pt</option>
                    </select>
                    {['B', 'I', 'U', 'S', 'A'].map((c) => (
                      <button key={c} style={{ width: 26, height: 26, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', fontWeight: c === 'B' ? 800 : 500, fontStyle: c === 'I' ? 'italic' : 'normal', textDecoration: c === 'U' ? 'underline' : c === 'S' ? 'line-through' : 'none', color: c === 'A' ? '#EF4444' : '#475569' }}>{c}</button>
                    ))}
                    {['≡', '≣', '≢', '≜', 'x²', 'x₂', '🖌', '•', '#', '"', '—', '⊞', '⊟', '⊟', '⌫', '🖼'].map((c, i) => (
                      <button key={i} style={{ width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', color: '#475569', fontSize: 'var(--neo-font-size-sm)' }}>{c}</button>
                    ))}
                  </div>
                  <textarea value={businessNote} onChange={(e) => { setBusinessNote(e.target.value); setDirty(true); }} placeholder=""
                    style={{ width: '100%', minHeight: 260, border: 'none', padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onClose}
            style={{ padding: '12px 40px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer', minWidth: 160 }}>
            취소
          </button>
          <button disabled={!dirty} onClick={() => dirty && saveEdits()}
            style={{ padding: '12px 40px', borderRadius: 8, border: 'none', background: dirty ? '#2A75F3' : '#CBD5E1', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: dirty ? 'pointer' : 'not-allowed', minWidth: 160 }}>
            {isDetail ? '수정 완료' : '등록'}
          </button>
        </div>
      </div>
    </>
  );
};


// ── SCH-02 학교 등록 페이지 (full page) ──────────────────
const SchoolRegisterPage = ({ onCancel, onComplete }) => {
  const [form, setForm] = useState({
    name: '', email: '', manager: '', position: '', phone: '',
    principal: '',
    billerDept: '', billerName: '', billerEmail: '', billerPhone: '',
  });
  const [files, setFiles] = useState([]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isValid =
    form.name.trim() && form.email.trim() && form.manager.trim() && form.position.trim() && form.phone.trim() &&
    form.principal.trim() && form.billerDept.trim() && form.billerName.trim() && form.billerEmail.trim() && form.billerPhone.trim() &&
    files.length > 0;

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const merged = [...files, ...incoming].slice(0, 2);
    setFiles(merged);
  };

  const label = { display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', marginBottom: 8 };
  const star = <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>;
  const input = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto', background: 'white' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E293B', margin: 0, marginBottom: 6 }}>학교 등록</h1>
        <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#94A3B8', margin: 0 }}>등록할 학교의 정보를 입력하세요.</p>
      </div>

      {/* 카드 */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: '36px 40px' }}>
        {/* 2-column 폼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 32 }}>
          {/* 좌측: 학교 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <label style={label}>학교명{star}</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)}
                placeholder="학교명을 입력하세요." style={input} />
            </div>
            <div>
              <label style={label}>이메일{star}</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                placeholder="지정된 기관 이메일(@korea.kr 등)로만 가입할 수 있습니다." style={input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>관리교사 이름{star}</label>
                <input value={form.manager} onChange={(e) => update('manager', e.target.value)}
                  placeholder="관리교사 이름을 입력하세요." style={input} />
              </div>
              <div>
                <label style={label}>관리교사 직위{star}</label>
                <input value={form.position} onChange={(e) => update('position', e.target.value)}
                  placeholder="관리교사 직위를 입력하세요." style={input} />
              </div>
            </div>
            <div>
              <label style={label}>관리교사 직통 연락처{star}</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)}
                placeholder="직통 연락처를 입력하세요." style={input} />
            </div>
          </div>

          {/* 가운데 점선 구분 */}
          <div style={{ borderLeft: '1px dashed #E2E8F0' }} />

          {/* 우측: 결제·기관장 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <label style={label}>기관장 이름{star}</label>
              <input value={form.principal} onChange={(e) => update('principal', e.target.value)}
                placeholder="기관장 이름을 입력하세요." style={input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>결제 담당자 부서{star}</label>
                <input value={form.billerDept} onChange={(e) => update('billerDept', e.target.value)}
                  placeholder="결제 담당자 부서명을 입력하세요." style={input} />
              </div>
              <div>
                <label style={label}>결제 담당자 이름{star}</label>
                <input value={form.billerName} onChange={(e) => update('billerName', e.target.value)}
                  placeholder="결제 담당자 이름을 입력하세요." style={input} />
              </div>
            </div>
            <div>
              <label style={label}>결제 담당자 이메일{star}</label>
              <input type="email" value={form.billerEmail} onChange={(e) => update('billerEmail', e.target.value)}
                placeholder="지정된 기관 이메일(@korea.kr 등)로만 가입할 수 있습니다." style={input} />
            </div>
            <div>
              <label style={label}>결제 담당자 연락처{star}</label>
              <input value={form.billerPhone} onChange={(e) => update('billerPhone', e.target.value)}
                placeholder="결제 담당자 연락처를 입력하세요." style={input} />
            </div>
          </div>
        </div>

        {/* 증명서 업로드 */}
        <div style={{ marginTop: 32 }}>
          <label style={{ ...label, marginBottom: 10 }}>
            증명서 업로드<span style={{ color: '#1E293B', fontWeight: 700 }}>(재직증명서 &amp; 기관 고유번호증)</span>
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            style={{ border: '1px dashed #CBD5E1', borderRadius: 10, padding: '24px 20px', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--neo-font-size-base)' }}>⬆</span> 업로드 파일 선택
              <input type="file" accept="image/jpeg,image/png,application/pdf" multiple
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
              {files.length === 0
                ? '여기에 파일을 끌어다 놓거나 버튼을 눌러 업로드하세요.'
                : files.map((f) => f.name).join(' · ')}
            </span>
          </div>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', margin: '8px 0 0' }}>
            이미지(JPG, PNG) 또는 PDF 파일만 업로드 가능 (10MB 이하, 최대 2개까지)
          </p>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28 }}>
        <button onClick={onCancel}
          style={{ padding: '14px 56px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer', minWidth: 200 }}>
          취소
        </button>
        <button onClick={() => isValid && onComplete()} disabled={!isValid}
          style={{ padding: '14px 56px', borderRadius: 8, border: 'none', background: isValid ? '#2A75F3' : '#CBD5E1', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: isValid ? 'pointer' : 'not-allowed', minWidth: 200 }}>
          등록
        </button>
      </div>
    </div>
  );
};

export default SchoolManagement;
