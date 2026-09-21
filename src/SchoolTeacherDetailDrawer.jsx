/**
 * SchoolTeacherDetailDrawer.jsx
 * [SCH-03 v1.3] 교사관리(학교모드) 상세 슬라이드 아웃
 *
 * v1.3 — 모델 단순화:
 * - 인계 이력 섹션 폐기 → 「인계 받은 내역」 1줄(receivedFrom)로 축소
 * - 후임 교사 지정 버튼은 managedDataCount === 0 일 때 비활성 (보낼 자료 없음)
 * - 학교 변경 버튼은 managedDataCount === 0 일 때만 활성 (인계 선행)
 * - 학교 변경 신청 시 부모에서 schoolChangeRequested=true → 목록에서 즉시 제외
 */
import React, { useState } from 'react';
import './index.css';

// ─────────────────────────────────────────────
// 후임 교사 지정 모달
// ─────────────────────────────────────────────
const SuccessorAssignmentModal = ({ teacher, allTeachers, onCancel, onConfirm }) => {
  const [selectedId, setSelectedId] = useState('');
  const candidates = allTeachers.filter((t) => t.id !== teacher.id);
  const groups = teacher.managedGroups || [];
  const groupsLabel = groups.length > 0 ? `${groups.length}개 (${groups.join(', ')})` : '0개';

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '560px', maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden' }}>
        <header style={{ padding: '1.2rem 1.5rem 0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: 0 }}>후임 교사 지정</h2>
            <button onClick={onCancel} style={{ background: 'transparent', border: 'none', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>›</button>
          </div>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0.4rem 0 0', lineHeight: 1.55 }}>
            <strong style={{ color: '#1E2225' }}>{teacher.name}</strong> 교사가 관리하던 데이터를 인계 받을 후임 교사를 지정하세요.
          </p>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem 0' }}>
          <section style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.9rem 1.1rem', marginBottom: '1.1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.6rem' }}>이관될 데이터</h3>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.85 }}>
              <li>학생 : <strong style={{ color: '#1E2225' }}>{teacher.managedStudentCount}명</strong></li>
              <li>그룹 : <strong style={{ color: '#1E2225' }}>{groupsLabel}</strong></li>
              <li>과제 : <strong style={{ color: '#1E2225' }}>{teacher.managedTaskCount}개</strong></li>
              <li>채점 : <strong style={{ color: '#1E2225' }}>{(teacher.managedGradingCount || 0).toLocaleString()}건</strong></li>
            </ul>
          </section>

          <section style={{ marginBottom: '1.1rem' }}>
            <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225', marginBottom: '0.5rem' }}>
              후임 교사 선택 <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', color: selectedId ? '#1E2225' : '#94A3B8', cursor: 'pointer', outline: 'none' }}>
              <option value="">후임 교사를 선택하세요.</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </section>

          <section style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#92400E', marginBottom: '0.4rem' }}>⚠️ 주의 사항</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#92400E', lineHeight: 1.7 }}>
              선택한 그룹의 소유권과 관리 권한이 후임 교사에게 완전히 이전됩니다.<br />
              이관 후에는 원래 교사의 목록에서 해당 그룹이 사라집니다.
            </div>
          </section>
        </div>

        <footer style={{ padding: '0.95rem 1.5rem', borderTop: '1px solid #E2E8F0', background: 'white', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 22px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>취소</button>
          <button onClick={() => {
            if (!selectedId) return;
            const successor = candidates.find((c) => c.id === selectedId);
            onConfirm(successor);
          }} disabled={!selectedId}
            style={{ padding: '10px 26px', background: selectedId ? '#2A75F3' : '#CBD5E1', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: selectedId ? 'pointer' : 'not-allowed', fontSize: 'var(--neo-font-size-sm)' }}>
            이관 완료
          </button>
        </footer>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 학교 변경 신청 모달
// ─────────────────────────────────────────────
const SchoolChangeRequestModal = ({ teacher, onCancel, onConfirm }) => {
  const [newSchool, setNewSchool] = useState('');

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', padding: '1.5rem 1.75rem', width: '440px', maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
        <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.5rem' }}>학교 변경 신청</h2>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: '0 0 1rem', lineHeight: 1.55 }}>
          <strong style={{ color: '#1E2225' }}>{teacher.name}</strong> 교사의 변경 학교를 입력하세요. 신청 즉시 학교 모드 교사 목록에서 제외되며, 시스템 관리자의 승인 후 학교 변경이 최종 완료됩니다.
        </p>
        <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>변경 학교 *</label>
        <input type="text" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="새 학교명 입력"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box', outline: 'none', marginBottom: '1rem' }} />
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '0.7rem 0.9rem', marginBottom: '1.25rem', fontSize: 'var(--neo-font-size-sm)', color: '#92400E', lineHeight: 1.65 }}>
          ⚠️ 신청 즉시 본 목록에서 사라집니다. 시스템 관리자가 변경을 취소할 경우에만 다시 노출됩니다.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>취소</button>
          <button onClick={() => newSchool.trim() && onConfirm(newSchool.trim())} disabled={!newSchool.trim()}
            style={{ padding: '8px 18px', background: newSchool.trim() ? '#2A75F3' : '#CBD5E1', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: newSchool.trim() ? 'pointer' : 'not-allowed', fontSize: 'var(--neo-font-size-sm)' }}>
            신청
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 메인 슬라이드 아웃
// ─────────────────────────────────────────────
const SchoolTeacherDetailDrawer = ({
  teacher,
  allTeachers = [],
  schoolName,
  onClose,
  onUpdate,
  onTransfer,
  onApprove,
  onSchoolChangeRequest,
}) => {
  const [name, setName] = useState(teacher.name);
  const [showSuccessorModal, setShowSuccessorModal] = useState(false);
  const [showSchoolChangeModal, setShowSchoolChangeModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [transferPanelOpen, setTransferPanelOpen] = useState(true);

  const hasOwnedData =
    teacher.managedStudentCount > 0 ||
    teacher.managedTaskCount > 0 ||
    (teacher.managedGroups || []).length > 0 ||
    teacher.managedGradingCount > 0;

  const hasChanges = name !== teacher.name;

  const handleAttemptClose = () => {
    if (hasChanges) setShowUnsavedModal(true);
    else onClose();
  };
  const handleSubmit = () => {
    if (name !== teacher.name) onUpdate(teacher.id, { name });
    else onClose();
  };
  const handleResetPassword = () => {
    if (!window.confirm('이 교사의 비밀번호를 초기화하시겠습니까?')) return;
    alert('비밀번호 초기화 이메일이 발송되었습니다.');
  };
  const handleSuccessorConfirm = (successor) => {
    setShowSuccessorModal(false);
    onTransfer(teacher.id, successor);
  };
  const handleSchoolChangeConfirm = (newSchool) => {
    setShowSchoolChangeModal(false);
    onSchoolChangeRequest(teacher.id, newSchool);
  };

  const fieldStyle = { width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', background: 'white', boxSizing: 'border-box', outline: 'none' };
  const readonlyFieldStyle = { ...fieldStyle, background: '#F1F5F9', color: '#64748B' };

  return (
    <div onClick={handleAttemptClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }}>
      <aside onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxWidth: '96vw', height: '100%', background: 'white', boxShadow: '-8px 0 24px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: 0 }}>교사 정보</h2>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>가입일 : {teacher.joinDate}</div>
          </div>
          <button onClick={handleAttemptClose} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', color: '#94A3B8', cursor: 'pointer' }}>×</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', background: '#F8FAFC' }}>
          {/* 기본 정보 */}
          <section style={{ background: 'white', padding: '1rem 1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.75rem' }}>기본 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div><label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '4px', fontWeight: 700 }}>이름</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '4px', fontWeight: 700 }}>이메일</label><input type="text" value={teacher.email} readOnly style={readonlyFieldStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '4px', fontWeight: 700 }}>교사유형</label><input type="text" value={`교사 (${teacher.type})`} readOnly style={readonlyFieldStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '4px', fontWeight: 700 }}>관리 그룹</label><input type="text" value={teacher.managedGroups && teacher.managedGroups.length > 0 ? teacher.managedGroups.join(', ') : '담당 그룹 없음'} readOnly style={readonlyFieldStyle} /></div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '4px', fontWeight: 700 }}>비밀번호</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="password" value="•••••" readOnly style={readonlyFieldStyle} />
                  <button onClick={handleResetPassword} style={{ padding: '8px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>
                </div>
              </div>
            </div>
          </section>

          {/* 활동 정보 */}
          <section style={{ background: 'white', padding: '1rem 1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.75rem' }}>활동 정보 <span style={{ fontWeight: 400, fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginLeft: '4px' }}>현재 보유</span></h3>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: 'var(--neo-font-size-sm)', color: '#475569' }}>
              <div>학생 <strong style={{ color: '#1E2225', marginLeft: '4px' }}>{teacher.managedStudentCount}명</strong></div>
              <div>그룹 <strong style={{ color: '#1E2225', marginLeft: '4px' }}>{(teacher.managedGroups || []).length}개</strong></div>
              <div>과제 <strong style={{ color: '#1E2225', marginLeft: '4px' }}>{teacher.managedTaskCount}개</strong></div>
              <div>채점 <strong style={{ color: '#1E2225', marginLeft: '4px' }}>{(teacher.managedGradingCount || 0).toLocaleString()}건</strong></div>
            </div>

            {/* 인계 받은 내역 (receivedFrom 있을 때만 1줄) */}
            {teacher.receivedFrom && (
              <div style={{ marginTop: '0.75rem', padding: '8px 12px', background: '#F0FDF4', borderRadius: '6px', borderLeft: '3px solid #16A34A', fontSize: 'var(--neo-font-size-sm)', color: '#15803D' }}>
                ← <strong>{teacher.receivedFrom.teacherName}</strong>으로부터 인계 받음
                <span style={{ color: '#94A3B8', marginLeft: '6px' }}>({teacher.receivedFrom.receivedAt})</span>
              </div>
            )}
          </section>

          {/* 유료회원 승인 */}
          {teacher.pendingApproval && (
            <section style={{ background: '#FFFBEB', padding: '1rem 1.1rem', borderRadius: '10px', border: '1px solid #FDE68A', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#92400E', margin: '0 0 0.5rem' }}>🔔 승인 요청 내역</h3>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#92400E', margin: '0 0 0.75rem' }}>유료회원 승인 요청이 있습니다.</p>
              <button onClick={() => onApprove(teacher.id)} style={{ padding: '8px 14px', background: '#2A75F3', border: 'none', borderRadius: '8px', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>승인확인</button>
            </section>
          )}

          {/* 교사 인계 처리 */}
          <section style={{ background: 'white', padding: '1rem 1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.75rem' }}>교사 인계 처리</h3>

            <div style={{ background: '#FEF3C7', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '0.75rem', borderLeft: '3px solid #DC2626' }}>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#92400E', marginBottom: '4px' }}>⚠️ 교사 인계 처리 안내</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#92400E', lineHeight: 1.65 }}>
                교사가 전근, 휴직, 퇴직 등의 사유로 관리 중인 학생과 그룹을 후임 교사에게 인계해야 하는 경우 사용합니다.
                인계 완료 후 [학교 변경] 신청 시 본 목록에서 자동 제외되며, 시스템 관리자 승인을 거쳐 학교 변경이 최종 완료됩니다.
              </div>
            </div>

            <button onClick={() => setTransferPanelOpen((o) => !o)}
              style={{ width: '100%', padding: '10px 12px', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', color: '#166534' }}>
              <span>📋 인계 처리 절차 <span style={{ fontWeight: 400, fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginLeft: '6px' }}>변경 완료 시 교사 목록에서 자동 제외</span></span>
              <span>{transferPanelOpen ? '▼' : '▶'}</span>
            </button>

            {transferPanelOpen && (
              <div style={{ padding: '0.6rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {/* 후임 교사 지정 — 데이터 0이면 비활성 (보낼 자료 없음) */}
                <button type="button" onClick={() => setShowSuccessorModal(true)} disabled={!hasOwnedData}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px',
                    background: hasOwnedData ? '#F8FAFC' : '#F1F5F9',
                    border: '1px solid #E2E8F0', borderRadius: '8px',
                    cursor: hasOwnedData ? 'pointer' : 'not-allowed',
                    opacity: hasOwnedData ? 1 : 0.6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>후임 교사 지정</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
                      {hasOwnedData ? '데이터 인계 진행' : '🔒 인계할 데이터 없음'}
                    </span>
                    <span style={{ color: '#94A3B8' }}>›</span>
                  </span>
                </button>

                {/* 학교 변경 — 데이터 0일 때만 활성 */}
                <button type="button" onClick={() => setShowSchoolChangeModal(true)} disabled={hasOwnedData}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px',
                    background: hasOwnedData ? '#F1F5F9' : '#F8FAFC',
                    border: '1px solid #E2E8F0', borderRadius: '8px',
                    cursor: hasOwnedData ? 'not-allowed' : 'pointer',
                    opacity: hasOwnedData ? 0.5 : 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>학교 변경</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
                      {hasOwnedData ? '🔒 인계 완료 후 활성화' : '학교 변경 신청'}
                    </span>
                    <span style={{ color: '#94A3B8' }}>›</span>
                  </span>
                </button>
              </div>
            )}
          </section>
        </div>

        <footer style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid #E2E8F0', background: 'white', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={handleAttemptClose} style={{ padding: '10px 18px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>취소</button>
          <button onClick={handleSubmit} style={{ padding: '10px 20px', background: '#2A75F3', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>수정 완료</button>
        </footer>
      </aside>

      {showSuccessorModal && (
        <SuccessorAssignmentModal
          teacher={teacher}
          allTeachers={allTeachers}
          onCancel={() => setShowSuccessorModal(false)}
          onConfirm={handleSuccessorConfirm}
        />
      )}

      {showSchoolChangeModal && (
        <SchoolChangeRequestModal
          teacher={teacher}
          onCancel={() => setShowSchoolChangeModal(false)}
          onConfirm={handleSchoolChangeConfirm}
        />
      )}

      {showUnsavedModal && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '1.5rem 1.75rem', width: '380px', maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', margin: '0 0 0.6rem' }}>저장하지 않은 변경사항이 있습니다.</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', margin: '0 0 1.25rem' }}>닫으시겠습니까?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUnsavedModal(false)} style={{ padding: '8px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>계속 편집</button>
              <button onClick={() => { setShowUnsavedModal(false); onClose(); }} style={{ padding: '8px 14px', background: '#DC2626', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>닫기 (변경 폐기)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolTeacherDetailDrawer;
