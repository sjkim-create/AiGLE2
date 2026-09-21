/**
 * SchoolTeacherManagement.jsx
 * [SCH-03 v1.3] 교사관리(학교모드)
 *
 * v1.3 — 모델 단순화:
 * - 인계는 사실상 1회성 (보낸 사람은 즉시 데이터 0 → 다음 인계 불가)
 * - 학교 변경 신청 시 학교 모드 목록에서 즉시 제외 (소프트 삭제, schoolChangeRequested=true)
 * - 받은 사람에게만 「← 받음 (보낸이)」 sub-line 표시
 * - 「학교 변경 신청 중」 라벨 폐기 (목록에 안 보이므로 라벨 불필요)
 * - 상태 라벨 2종: 정상 / 학교유료회원 승인신청
 * - 글로벌 transferHistory 폐기 (감사가 필요하면 시스템 모드 TCH-01에서 별도 처리)
 *
 * 시스템 관리자(TCH-01)가 학교 변경 신청을 취소하면 schoolChangeRequested=false로 환원되어
 * 학교 모드 목록에 다시 노출됨 (본 prototype 범위 외).
 */
import React, { useMemo, useState } from 'react';
import './index.css';
import SchoolTeacherDetailDrawer from './SchoolTeacherDetailDrawer';

const SCHOOL_NAME = '성일고등학교';

const INITIAL_TEACHERS = [
  {
    no: 1, type: '유료회원', name: '홍길동1', id: 'tch2600059hyH',
    email: 'teacher03@korea.kr', joinDate: '26.04.10',
    managedTaskCount: 10, managedStudentCount: 120,
    managedGroups: ['1-1반', '1-2반', '1-3반', '2-1반', '2-2반'], managedGradingCount: 2880,
    pendingApproval: false,
    schoolChangeRequested: false,
    // 박지용으로부터 받음 (시연용)
    receivedFrom: { teacherId: 'tch2600061hyP', teacherName: '박지용', receivedAt: '26.05.10' },
  },
  {
    no: 2, type: '무료회원', name: '김나영', id: 'tch2600060nyK',
    email: 'nayoung@ai.cne.go.kr', joinDate: '26.04.10',
    managedTaskCount: 3, managedStudentCount: 12,
    managedGroups: ['3-1반'], managedGradingCount: 240,
    pendingApproval: true,
    schoolChangeRequested: false,
    receivedFrom: null,
  },
  {
    no: 3, type: '유료회원', name: '박지용', id: 'tch2600061hyP',
    email: 'park@korea.kr', joinDate: '26.03.15',
    // 인계 완료 (데이터 0). 후임 지정 비활성, 학교 변경 신청만 가능
    managedTaskCount: 0, managedStudentCount: 0,
    managedGroups: [], managedGradingCount: 0,
    pendingApproval: false,
    schoolChangeRequested: false,
    receivedFrom: null,
  },
  {
    no: 4, type: '유료회원', name: '최유진', id: 'tch2600062yjC',
    email: 'yujin@ai.cne.go.kr', joinDate: '26.04.09',
    managedTaskCount: 7, managedStudentCount: 30,
    managedGroups: ['2-3반', '3-2반'], managedGradingCount: 720,
    pendingApproval: false,
    schoolChangeRequested: false,
    receivedFrom: null,
  },
  {
    no: 5, type: '무료회원', name: '한결', id: 'tch2600063ghH',
    email: 'gh@ai.cne.go.kr', joinDate: '26.04.08',
    managedTaskCount: 2, managedStudentCount: 8,
    managedGroups: ['3-3반'], managedGradingCount: 64,
    pendingApproval: false,
    schoolChangeRequested: false,
    receivedFrom: null,
  },
];

const TYPE_FILTER = ['전체', '유료회원', '무료회원'];

// 라벨 derive 규칙:
//   학교유료회원 승인신청: pendingApproval === true  (최우선)
//   인계 받음:           receivedFrom !== null  AND  데이터 보유 중
//   인계 완료:           receivedFrom !== null  AND  데이터 없음
//   미인계:              receivedFrom === null  (받은 적 없음)
const deriveStatus = (t) => {
  if (t.pendingApproval) return '학교유료회원 승인신청';
  const hasData =
    t.managedStudentCount > 0 ||
    t.managedTaskCount > 0 ||
    (t.managedGroups || []).length > 0 ||
    t.managedGradingCount > 0;
  if (t.receivedFrom) return hasData ? '인계 받음' : '인계 완료';
  return '미인계';
};

const statusBadgeStyle = (status) => {
  if (status === '학교유료회원 승인신청') return { background: '#FEE2E2', color: '#DC2626' };
  if (status === '인계 받음') return { background: '#DBEAFE', color: '#1D4ED8' };
  if (status === '인계 완료') return { background: '#EDE9FE', color: '#5B21B6' };
  return { background: '#F1F5F9', color: '#475569' }; // 미인계
};

const SchoolTeacherManagement = ({ onAdd }) => {
  const [teachers, setTeachers] = useState(INITIAL_TEACHERS);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortOrder('asc'); }
  };
  const sortIndicator = (key) => {
    if (sortKey !== key) return <span style={{ marginLeft: '4px', color: '#CBD5E1' }}>↕</span>;
    return <span style={{ marginLeft: '4px', color: '#2A75F3', fontWeight: 800 }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // schoolChangeRequested === true 인 교사는 학교 모드 목록에서 즉시 제외
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = teachers.filter((t) => {
      if (t.schoolChangeRequested) return false;
      if (typeFilter !== '전체' && t.type !== typeFilter) return false;
      if (q && !`${t.name} ${t.id} ${t.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortKey) {
      arr = [...arr].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString();
        const bv = (b[sortKey] ?? '').toString();
        const cmp = av.localeCompare(bv, 'ko');
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
    return arr;
  }, [teachers, query, typeFilter, sortKey, sortOrder]);

  // 인계 처리 — 보낸 사람 데이터 0으로 비우고, 받은 사람에 receivedFrom + managed* 누적
  const handleTransferComplete = (teacherId, successor) => {
    const transferor = teachers.find((t) => t.id === teacherId);
    if (!transferor || !successor) return;
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '.');
    const movedItems = {
      students: transferor.managedStudentCount,
      groups: [...(transferor.managedGroups || [])],
      tasks: transferor.managedTaskCount,
      gradings: transferor.managedGradingCount,
    };

    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id === transferor.id) {
          // 송신 후 데이터는 0이 되지만 receivedFrom(받은 이력)은 보존
          // → 받았다가 또 보낸 케이스는 라벨 「인계 완료」로 표현됨
          return {
            ...t,
            managedStudentCount: 0, managedTaskCount: 0,
            managedGroups: [], managedGradingCount: 0,
          };
        }
        if (t.id === successor.id) {
          return {
            ...t,
            managedStudentCount: t.managedStudentCount + movedItems.students,
            managedTaskCount: t.managedTaskCount + movedItems.tasks,
            managedGroups: [...new Set([...(t.managedGroups || []), ...movedItems.groups])],
            managedGradingCount: t.managedGradingCount + movedItems.gradings,
            receivedFrom: {
              teacherId: transferor.id,
              teacherName: transferor.name,
              receivedAt: today,
            },
          };
        }
        return t;
      })
    );
    setSelectedTeacher(null);
    showToast(`${transferor.name}의 관리 데이터가 ${successor.name}에게 이관되었습니다.`);
  };

  const handleUpdate = (teacherId, patch) => {
    setTeachers((prev) => prev.map((t) => (t.id === teacherId ? { ...t, ...patch } : t)));
    setSelectedTeacher(null);
    showToast('수정이 완료되었습니다.');
  };

  const handleApprove = (teacherId) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, type: '유료회원', pendingApproval: false } : t))
    );
    setSelectedTeacher(null);
    showToast('승인이 완료되었습니다.');
  };

  // 학교 변경 신청 = 학교 모드 목록에서 즉시 제외 + 시스템 관리자에게 신청 발송
  const handleSchoolChangeRequest = (teacherId, requestedSchool) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, schoolChangeRequested: true } : t))
    );
    setSelectedTeacher(null);
    showToast(`학교 변경 신청이 시스템 관리자에게 발송되었습니다. 본 목록에서 제외됩니다.`);
  };

  const isEmpty = filtered.length === 0;
  const hasNoData = teachers.length === 0;

  return (
    <div className="content-container" style={{ padding: '2rem 2.5rem', height: '100%', overflowY: 'auto', background: '#F8FAFC', position: 'relative' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 800, color: '#1E2225', margin: 0 }}>👥 교사관리 (학교 모드)</h1>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0.4rem 0 0' }}>
              <strong>{SCHOOL_NAME}</strong> 소속 교사를 조회하고 인계 처리합니다.
            </p>
          </div>
          <button onClick={onAdd} style={{ padding: '10px 18px', background: '#2A75F3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer' }}>+ 교사등록</button>
        </div>
      </header>

      <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
          <input type="text" placeholder="교사명 / 아이디 / 이메일로 검색" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', outline: 'none', boxSizing: 'border-box', background: '#F8FAFC' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {TYPE_FILTER.map((t) => {
            const active = typeFilter === t;
            return <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '7px 12px', background: active ? '#2A75F3' : 'white', color: active ? 'white' : '#475569', border: active ? 'none' : '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>{t}</button>;
          })}
        </div>
      </section>

      <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 0.75rem 0.25rem' }}>
        결과 <strong style={{ color: '#1E2225' }}>{filtered.length}</strong>건
      </div>

      {isEmpty ? (
        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '4rem 2rem', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👥</div>
          <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.5rem' }}>
            {hasNoData ? '아직 등록된 교사가 없습니다.' : '검색 조건에 맞는 교사가 없습니다.'}
          </h2>
          <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#64748B', margin: 0 }}>
            {hasNoData ? '[+ 교사등록] 버튼으로 첫 교사를 등록해 보세요.' : '다른 키워드나 필터로 다시 시도해 주세요.'}
          </p>
        </section>
      ) : (
        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', width: '50px' }}>No.</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', width: '110px' }}>회원 유형</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', width: '110px', cursor: 'pointer' }} onClick={() => handleSort('name')}>이름{sortIndicator('name')}</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }} onClick={() => handleSort('id')}>아이디{sortIndicator('id')}</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>이메일</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', width: '100px', cursor: 'pointer' }} onClick={() => handleSort('joinDate')}>가입일{sortIndicator('joinDate')}</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', width: '220px' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const status = deriveStatus(t);
                return (
                  <tr key={t.id}
                    onClick={() => setSelectedTeacher(t)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#64748B', borderBottom: '1px solid #F1F5F9' }}>{t.no}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '6px', background: t.type === '유료회원' ? '#DBEAFE' : '#F3F4F6', color: t.type === '유료회원' ? '#1D4ED8' : '#4B5563', fontWeight: 700 }}>{t.type}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', borderBottom: '1px solid #F1F5F9' }}>{t.name}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', borderBottom: '1px solid #F1F5F9', fontFamily: 'monospace' }}>{t.id}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', borderBottom: '1px solid #F1F5F9' }}>{t.email}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', borderBottom: '1px solid #F1F5F9' }}>{t.joinDate}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--neo-font-size-sm)', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ ...statusBadgeStyle(status), padding: '3px 10px', borderRadius: '999px', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>{status}</span>
                      {t.receivedFrom && (
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#16A34A', marginTop: '4px' }}>
                          ← 받음 <strong>{t.receivedFrom.teacherName}</strong>
                          <span style={{ color: '#94A3B8', marginLeft: '4px' }}>({t.receivedFrom.receivedAt})</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {selectedTeacher && (
        <SchoolTeacherDetailDrawer
          teacher={teachers.find((t) => t.id === selectedTeacher.id) || selectedTeacher}
          allTeachers={teachers.filter((t) => !t.schoolChangeRequested)}
          schoolName={SCHOOL_NAME}
          onClose={() => setSelectedTeacher(null)}
          onUpdate={handleUpdate}
          onTransfer={handleTransferComplete}
          onApprove={handleApprove}
          onSchoolChangeRequest={handleSchoolChangeRequest}
        />
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#1E2225', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: 'var(--neo-font-size-base)', fontWeight: 600, boxShadow: '0 8px 24px rgba(15,23,42,0.18)', zIndex: 9999, maxWidth: '90vw' }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default SchoolTeacherManagement;
