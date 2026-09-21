import React, { useState, useEffect } from 'react';
import './index.css';

/**
 * TCH-09 교사 등록 (통합)
 * - mode='school'  : 학교 모드 — 개별 폼 [이름·이메일]. 학교는 로그인 학교로 자동
 * - mode='system'  : 시스템 모드 — 개별 폼 [학교명·이름·이메일]
 *
 * STU-09(학생 등록) 패턴을 그대로 차용. 차이점:
 *  - 그룹 선택 카드 폐기 (교사는 그룹 매핑 없음)
 *  - 명단 테이블: No / 이름 / 이메일 / 신청 / 삭제
 *  - 시스템 모드는 학교명 컬럼 추가
 *  - 자동 명단 추가 트리거: 마지막 필드(이메일) onBlur / Enter / [➕ 명단 추가]
 */
const TeacherRegistration = ({ mode = 'school', onCancel, onComplete, showToast }) => {
  const [tempList, setTempList] = useState([]);
  const [schoolName, setSchoolName] = useState('');   // 시스템 모드 전용
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailDuplicate, setIsEmailDuplicate] = useState(false);
  const [isEmailFormatErr, setIsEmailFormatErr] = useState(false);
  const [isIndividualExpanded, setIsIndividualExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 학생 등록과 동일 — sessionStorage draft 자동 저장/복원
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`tch-09-draft-${mode}`);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.tempList?.length) {
        setTempList(draft.tempList);
        showToast(`작성 중이던 명단 ${draft.tempList.length}명을 복원했습니다.`);
      }
      sessionStorage.removeItem(`tch-09-draft-${mode}`);
    } catch (e) { /* 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tempList.length === 0) {
      sessionStorage.removeItem(`tch-09-draft-${mode}`);
      return;
    }
    try {
      sessionStorage.setItem(`tch-09-draft-${mode}`, JSON.stringify({ tempList }));
    } catch (e) { /* quota 초과 등 무시 */ }
  }, [tempList, mode]);

  const truncateName = (str) => str.length > 20 ? str.substring(0, 20) : str;

  // 이메일 유효성 (RFC 단순 검증)
  const validateEmail = (e) => {
    if (!e) return '이메일 입력 필요';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) return '이메일 형식 오류';
    return null;
  };

  // 모의 기존 등록 교사 (중복 대조용)
  const existingTeachers = [
    { name: '김교사', email: 'kim@example.school.kr' },
    { name: '이교사', email: 'lee@example.school.kr' },
  ];

  const checkEmailDuplicate = (e) => {
    if (!e) return false;
    return existingTeachers.some(t => t.email === e) || tempList.some(t => t.email === e);
  };

  const handleAddTeacher = () => {
    // 필수 필드 검증 (mode별)
    if (mode === 'system' && !schoolName.trim()) {
      showToast('학교명을 입력해 주세요.', 'warning');
      return;
    }
    if (!name.trim()) {
      showToast('이름을 입력해 주세요.', 'warning');
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      showToast(`이메일 형식 오류: ${emailErr}`, 'warning');
      setIsEmailFormatErr(true);
      return;
    }
    const dup = checkEmailDuplicate(email);
    setIsEmailDuplicate(dup);
    if (dup) {
      showToast(`이메일 ${email}이 이미 사용 중입니다.`, 'warning');
      return;
    }

    const truncated = truncateName(name);
    const newRow = {
      no: tempList.length + 1,
      schoolName: mode === 'system' ? schoolName.trim() : null,
      name: truncated,
      email: email.trim(),
      status: '발송 예정',
      emailError: null,
      duplicate: false,
    };
    setTempList([...tempList, newRow]);
    if (mode === 'system') setSchoolName('');
    setName('');
    setEmail('');
    setIsEmailDuplicate(false);
    setIsEmailFormatErr(false);
    showToast('교사가 명단에 추가되었습니다.');
  };

  // 마지막 필드(이메일) onBlur 자동 추가 (silent)
  const handleEmailBlur = () => {
    if (mode === 'system' && !schoolName.trim()) return;
    if (!name.trim() || !email.trim()) return;
    if (validateEmail(email)) return;
    handleAddTeacher();
  };

  const handleRemoveTeacher = (no) => {
    setTempList(tempList.filter(t => t.no !== no));
  };

  // 모의 엑셀 업로드
  const simulateFileUpload = () => {
    const baseNo = tempList.length;
    const mockData = mode === 'system' ? [
      { schoolName: '서울중앙고', name: '홍길동', email: 'hong@central-h.kr' },
      { schoolName: '서울중앙고', name: '김교사', email: 'kim@example.school.kr' }, // 중복
      { schoolName: '부산제일고', name: '박교사', email: 'invalid-email' }, // 형식 오류
      { schoolName: '대전여고', name: '이정현', email: 'lee.jh@daejeon-w.kr' },
    ] : [
      { name: '홍길동', email: 'hong@example.school.kr' },
      { name: '김교사', email: 'kim@example.school.kr' }, // 중복
      { name: '박교사', email: 'invalid-email' }, // 형식 오류
      { name: '이정현', email: 'lee.jh@example.school.kr' },
    ];

    // 500명 상한 검증 (학생 등록과 동일 정책)
    if (tempList.length + mockData.length > 500) {
      showToast(`최대 500명까지 한 번에 등록 가능합니다.`, 'warning');
      return;
    }

    const processed = mockData.map((m, idx) => ({
      no: baseNo + idx + 1,
      schoolName: mode === 'system' ? m.schoolName : null,
      name: truncateName(m.name),
      email: m.email,
      status: '발송 예정',
      duplicate: checkEmailDuplicate(m.email),
      emailError: validateEmail(m.email),
    }));

    setTempList([...tempList, ...processed]);
    const dupCount = processed.filter(p => p.duplicate).length;
    const errCount = processed.filter(p => p.emailError).length;
    if (dupCount > 0 || errCount > 0) {
      const parts = [];
      if (dupCount > 0) parts.push(`중복 ${dupCount}명`);
      if (errCount > 0) parts.push(`이메일 오류 ${errCount}명`);
      showToast(`엑셀 업로드 완료. ${parts.join(' · ')} 감지되었습니다.`, 'warning');
    } else {
      showToast('엑셀 파일이 업로드 되었습니다.');
    }
  };

  const handleCompleteRegistration = () => {
    sessionStorage.removeItem(`tch-09-draft-${mode}`);
    onComplete(tempList);
  };

  const handleCancel = () => {
    if (tempList.length > 0 || name || email || schoolName) {
      if (window.confirm('작성 중인 내용이 저장되지 않습니다. 나가시겠습니까?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const hasErrors = tempList.some(t => t.duplicate || t.emailError);
  const subtitle = mode === 'system'
    ? '시스템 모드 — 여러 학교의 교사를 등록할 수 있습니다. 학교명·이름·이메일을 입력하세요.'
    : '학교 모드 — 우리 학교에 교사를 등록할 수 있습니다. 이름·이메일을 입력하세요.';

  return (
    <div className="content-container bg-white" style={{ borderRadius: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2rem 1rem' }}>
        <header className="content-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h1 className="content-title">교사등록</h1>
            <p className="content-subtitle">{subtitle}</p>
          </div>
          <button
            onClick={handleCancel}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: 'white',
              color: '#475569',
              fontSize: 'var(--neo-font-size-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >← 목록으로</button>
        </header>

        <div className="reg-layout">
          <div className="reg-left">
            {/* 엑셀 일괄 등록 — 세로 카드 3개 (학생 등록과 동일 패턴) */}
            <div className="bulk-reg-section">
              <label className="reg-label" style={{ color: '#2A75F3' }}>엑셀 파일 등록 <span className="required">*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', border: '1px solid #E5E7EB', borderRadius: '12px', background: 'white' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>1. 다운로드</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>엑셀파일을 다운로드 해주세요.</div>
                  </div>
                  <button style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer' }}>⬇ 다운로드</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #E5E7EB', borderRadius: '12px', background: 'white' }}>
                  <div style={{ flex: '0 0 35%' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>2. 엑셀파일 작성</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>다운로드한 파일에 교사정보를 입력하세요.</div>
                  </div>
                  <div style={{ flex: 1, padding: '0.85rem 1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '0.35rem' }}>▶ 작성 안내</div>
                    {mode === 'system' && <>- 학교명·이름·이메일 모두 필수입니다.<br/></>}
                    {mode === 'school' && <>- 이름·이메일 모두 필수입니다.<br/></>}
                    - 성명은 최대 20자까지 가능하며, 초과 시 자동 절삭됩니다.<br/>
                    - 이메일은 가입 안내 발송에 사용되므로 정확히 입력해 주세요.
                  </div>
                </div>
                {/* Step 03 — 드롭존 */}
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!isDragOver) setIsDragOver(true); }}
                  onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setIsDragOver(false); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragOver(false); simulateFileUpload(); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '0.85rem', padding: '2rem 1.5rem',
                    border: `2.5px dashed ${isDragOver ? '#2A75F3' : '#94A3B8'}`,
                    borderRadius: '12px',
                    background: isDragOver ? '#EFF6FF' : '#F8FAFC',
                    transition: 'all 0.2s ease', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '3rem', lineHeight: 1, transform: isDragOver ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.2s', filter: isDragOver ? 'drop-shadow(0 4px 8px rgba(42,117,243,0.3))' : 'none' }}>📤</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: isDragOver ? '#1D4ED8' : '#1E293B', marginBottom: '0.2rem' }}>
                      {isDragOver ? '여기에 파일을 놓으세요' : '파일을 여기로 드래그하세요'}
                    </div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.4 }}>
                      Step 03 · 작성한 엑셀(.xlsx) 파일을 드롭하거나 아래 버튼으로 선택
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '70%', maxWidth: '280px' }}>
                    <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E2E8F0', margin: 0 }} />
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>또는</span>
                    <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E2E8F0', margin: 0 }} />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); simulateFileUpload(); }} style={{ padding: '0.7rem 1.75rem', borderRadius: '8px', border: 'none', background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(42,117,243,0.2)' }}>📁 파일 선택</button>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>지원 형식: .xlsx · 최대 10MB · 500명까지</div>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0 1rem' }}>
              <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E5E7EB' }} />
              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#64748B', padding: '0 0.5rem', whiteSpace: 'nowrap' }}>또는 직접 입력으로 추가하기</span>
              <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E5E7EB' }} />
            </div>

            {/* 직접 입력 카드 (접기/펼침) */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddTeacher(); }}
              style={{
                padding: isIndividualExpanded ? '1.25rem 1.5rem' : '1rem 1.5rem',
                border: '1px solid #E5E7EB', borderRadius: '12px', background: 'white',
                transition: 'padding 0.15s ease',
              }}
            >
              <div
                onClick={() => setIsIndividualExpanded(v => !v)}
                style={{ marginBottom: isIndividualExpanded ? '1rem' : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}
                title={isIndividualExpanded ? '클릭하여 접기' : '클릭하여 펼치기'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>✏️</span> 직접 입력 추가
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>
                    {isIndividualExpanded ? (
                      <>누락된 교사를 1명씩 직접 입력하여 우측 명단에 추가합니다. <strong style={{ color: '#2A75F3' }}>이메일 입력 후 다른 곳을 클릭하거나, Enter 키, 또는 하단 [➕ 명단 추가] 버튼</strong>으로 추가됩니다.</>
                    ) : (
                      <>클릭하여 직접 입력 폼 펼치기</>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 700, flexShrink: 0, padding: '0.25rem 0.6rem', background: '#F1F5F9', borderRadius: '6px' }}>{isIndividualExpanded ? '▲' : '▼'}</div>
              </div>

              {isIndividualExpanded && <>
                {/* 시스템 모드 — 학교명 행 */}
                {mode === 'system' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      학교명 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="학교명 입력 (예: 서울중앙고)"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* 이름 + 이메일 가로 2칸 */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: '0 0 35%' }}>
                    <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      이름 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="이름 (최대 20자)"
                      value={name}
                      onChange={(e) => setName(truncateName(e.target.value))}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      이메일 <span style={{ color: '#EF4444' }}>*</span> <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', fontWeight: 700 }}>↵ 자동</span>
                    </label>
                    <input
                      type="email"
                      placeholder="teacher@school.kr"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value.trim());
                        if (isEmailDuplicate) setIsEmailDuplicate(false);
                        if (isEmailFormatErr) setIsEmailFormatErr(false);
                      }}
                      onBlur={handleEmailBlur}
                      style={{
                        width: '100%', padding: '0.55rem 0.75rem',
                        border: `1px solid ${isEmailDuplicate || isEmailFormatErr ? '#EF4444' : '#CBD5E1'}`,
                        borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', boxSizing: 'border-box',
                      }}
                      title="이메일 입력 후 포커스를 빼거나 Enter 키를 누르면 자동으로 명단에 추가됩니다."
                    />
                  </div>
                </div>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  이름 최대 20자 (초과 시 자동 절삭) · 이메일은 가입 안내 발송에 사용됩니다.
                </p>

                {isEmailDuplicate && (
                  <div style={{ marginTop: '0.75rem', color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', fontWeight: 500, backgroundColor: '#FEF2F2', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                    🚨 이메일 <strong style={{ fontFamily: 'monospace' }}>{email}</strong>이 이미 사용 중입니다. 다른 이메일을 입력해 주세요.
                  </div>
                )}
                {isEmailFormatErr && !isEmailDuplicate && (
                  <div style={{ marginTop: '0.75rem', color: '#B91C1C', fontSize: 'var(--neo-font-size-sm)', fontWeight: 500, backgroundColor: '#FEF2F2', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                    🚨 이메일 형식이 올바르지 않습니다. 예: teacher@school.kr
                  </div>
                )}

                {/* [➕ 명단 추가] 버튼 — 카드 내부 우측 정렬 */}
                {(() => {
                  const canAdd = (mode === 'system' ? schoolName.trim() : true) && !!name.trim() && !!email.trim();
                  return (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={!canAdd}
                        title={canAdd ? '입력한 교사를 우측 명단에 추가합니다 (Enter 키와 동일).' : `${mode === 'system' ? '학교명·' : ''}이름·이메일을 모두 입력해 주세요.`}
                        style={{
                          padding: '0.7rem 1.5rem', borderRadius: '10px', border: 'none',
                          background: canAdd ? '#2A75F3' : '#E2E8F0',
                          color: canAdd ? 'white' : '#94A3B8',
                          fontSize: 'var(--neo-font-size-base)', fontWeight: 800,
                          cursor: canAdd ? 'pointer' : 'not-allowed',
                        }}
                      >➕ 명단 추가</button>
                    </div>
                  );
                })()}
              </>}
            </form>
          </div>

          {/* 우측 명단 패널 */}
          <div className="reg-right" style={{ position: 'sticky', top: '1rem', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto' }}>
            <div className="preview-header">
              <h3>업로드 명단 중복 확인</h3>
              <span>
                중복인원 <b style={{ color: tempList.some(t => t.duplicate) ? '#EF4444' : undefined }}>{tempList.filter(t => t.duplicate).length}</b>명
                {' / '}
                이메일 오류 <b style={{ color: tempList.some(t => t.emailError) ? '#EF4444' : undefined }}>{tempList.filter(t => t.emailError).length}</b>명
                {' / '}
                전체인원 <b>{tempList.length}</b>명
              </span>
            </div>
            {tempList.some(t => t.duplicate) && (
              <div style={{ marginBottom: '0.5rem', padding: '0.75rem', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#B91C1C', fontWeight: 500 }}>
                🚨 이미 등록된 이메일로 신청한 교사가 있습니다. 회원관리에서 확인하세요.
              </div>
            )}
            {tempList.some(t => t.emailError) && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#92400E', fontWeight: 500 }}>
                ⚠️ 이메일 형식이 올바르지 않은 교사가 있습니다. 해당 행의 이메일을 수정해 주세요.
              </div>
            )}
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    {mode === 'system' && <th>학교명</th>}
                    <th>이름</th>
                    <th>이메일</th>
                    <th>신청</th>
                    <th>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {tempList.length > 0 ? tempList.map((t) => {
                    const rowBg = t.duplicate ? '#FEF2F2' : (t.emailError ? '#FFFBEB' : undefined);
                    return (
                      <tr key={t.no} style={rowBg ? { background: rowBg } : undefined}>
                        <td>{t.no}</td>
                        {mode === 'system' && <td>{t.schoolName}</td>}
                        <td style={t.duplicate ? { color: '#EF4444', fontWeight: 700 } : undefined}>{t.name}</td>
                        <td style={t.emailError || t.duplicate ? { color: t.duplicate ? '#EF4444' : '#92400E' } : undefined}>
                          <span style={{ fontFamily: 'monospace' }}>{t.email}</span>
                          {t.emailError && (
                            <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#92400E', fontWeight: 600, marginTop: '2px' }}>⚠️ {t.emailError}</span>
                          )}
                          {t.duplicate && (
                            <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#EF4444', fontWeight: 400 }}>이미 등록된 이메일입니다.</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', padding: '3px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '999px', color: '#1D4ED8', fontWeight: 700 }}>📩 {t.status}</span>
                        </td>
                        <td><button className="btn-del-mini" onClick={() => handleRemoveTeacher(t.no)}>×</button></td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={mode === 'system' ? '6' : '5'} className="empty-msg">
                        엑셀을 업로드하거나 좌측에서 교사를 추가해 주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* mini-footer — [💾 등록] 우측 하단 sticky (학생 등록과 동일 패턴) */}
      <div style={{
        flexShrink: 0,
        padding: '0.85rem 2rem',
        borderTop: '1px solid #E2E8F0',
        background: 'white',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        boxShadow: '0 -4px 12px rgba(15,23,42,0.06)',
      }}>
        <button
          className={`btn-footer complete ${tempList.length > 0 && !hasErrors ? 'active' : ''}`}
          onClick={handleCompleteRegistration}
          disabled={tempList.length === 0 || hasErrors}
          style={{ width: 'auto', padding: '0.85rem 2.5rem', fontSize: 'var(--neo-font-size-base)' }}
          title={
            tempList.length === 0
              ? '명단에 교사를 추가해 주세요'
              : tempList.some(t => t.duplicate) ? '중복 교사를 제거해 주세요'
                : tempList.some(t => t.emailError) ? '이메일 형식 오류를 수정해 주세요'
                  : '명단 전체를 등록하고 가입 안내 이메일을 발송합니다.'
          }
        >
          💾 등록
        </button>
      </div>
    </div>
  );
};

export default TeacherRegistration;
