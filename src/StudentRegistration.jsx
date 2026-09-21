import React, { useState, useEffect } from 'react';
import './index.css';

const StudentRegistration = ({ onCancel, onComplete, showToast }) => {
  // [v1.2] 탭 폐기 — 일괄·개별 통합 1-스크린 정책. activeTab state 제거.
  const [tempList, setTempList] = useState([]);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [stuNum, setStuNum] = useState('');
  const [manualId, setManualId] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);        // 학년반번호 중복
  const [isIdDuplicate, setIsIdDuplicate] = useState(false);    // 아이디 중복
  // [v1.5] 직접 입력 카드 접기/펼침 (기본: 접힘)
  const [isIndividualExpanded, setIsIndividualExpanded] = useState(false);
  // [v2.1] 파일 드래그 오버 시각 피드백
  const [isDragOver, setIsDragOver] = useState(false);
  // [v1.5] 그룹 선택 (단일 선택, null = 미선택)
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [pendingGroup, setPendingGroup] = useState(null); // 모달 임시 선택

  // [v2.2 갭 4] 마운트 시 sessionStorage에서 draft 복원
  //   세션 만료(401) 대응 정책 시뮬레이션 — 실제 운영에서는 401 응답 시 draft 저장 + 로그인 모달
  //   prototype: 화면 진입 시 직전 작성 중이던 명단/그룹이 있으면 자동 복원
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('stu-09-draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.tempList?.length) {
        setTempList(draft.tempList);
        if (draft.selectedGroup) setSelectedGroup(draft.selectedGroup);
        showToast(`작성 중이던 명단 ${draft.tempList.length}명을 복원했습니다.`);
      }
      sessionStorage.removeItem('stu-09-draft');
    } catch (e) {
      // 복원 실패 시 무시
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [v2.2 갭 4] tempList/selectedGroup 변경 시 sessionStorage에 임시 저장
  //   실제 운영에서는 401 응답 콜백에서 호출. prototype: 변경 즉시 저장하여 새로고침/이탈 시 복원 가능하도록
  useEffect(() => {
    if (tempList.length === 0 && !selectedGroup) {
      sessionStorage.removeItem('stu-09-draft');
      return;
    }
    try {
      sessionStorage.setItem('stu-09-draft', JSON.stringify({ tempList, selectedGroup }));
    } catch (e) {
      // 저장 실패(quota 초과 등) 시 무시
    }
  }, [tempList, selectedGroup]);

  // [v1.5] 그룹관리 mock data — 실제로는 그룹관리 메뉴에서 등록한 그룹 list 조회
  const AVAILABLE_GROUPS = [
    { id: 'g1', name: '1학년 1반', studentCount: 28 },
    { id: 'g2', name: '1학년 2반', studentCount: 27 },
    { id: 'g3', name: '2학년 1반', studentCount: 26 },
    { id: 'g4', name: '2학년 2반', studentCount: 27 },
    { id: 'g5', name: '진학반', studentCount: 15 },
    { id: 'g6', name: '야간자율학습반', studentCount: 32 },
  ];

  // 20자 이름 제한 처리 함수
  const truncateName = (str) => {
    if (str.length > 20) return str.substring(0, 20);
    return str;
  };

  // 숫자 전용 입력 필터 및 127 제한 처리
  const handleNumericInput = (val, max = 127) => {
    const numeric = val.replace(/[^0-9]/g, '');
    if (!numeric) return '';
    const num = parseInt(numeric);
    if (num > max) return max.toString();
    return numeric;
  };

  // 모의 기존 등록 데이터 (중복 대조용)
  const existingStudents = [
    { name: '심사임당', gradeInfo: '1학년 1반 12번', id: 'stu25012avc' },
    { name: '홍길동', gradeInfo: '2학년 3반 5번', id: 'stu25018xyz' },
  ];

  // [STU-09] 학년반번호 중복 검사 — 기존 등록 + 우측 누적 명단(엑셀+개별 양측 포함) 모두 체크
  const checkDuplicate = (student) => {
    const inExisting = existingStudents.some(e => e.gradeInfo === student.gradeInfo);
    const inTempList = tempList.some(t => t.gradeInfo === student.gradeInfo);
    return inExisting || inTempList;
  };

  // [STU-09] 아이디 중복 검사 — 기존 등록 + 우측 누적 명단 모두 체크. 빈 값은 자동생성이므로 검사 안 함
  const checkIdDuplicate = (id) => {
    if (!id) return false;
    const inExisting = existingStudents.some(e => e.id === id);
    const inTempList = tempList.some(t => t.id === id);
    return inExisting || inTempList;
  };

  // [STU-09] 아이디 유효성 검사 (PRD §3 비즈니스 로직 — 아이디 유효성 규칙)
  //   조건: 5~13자, 영문자로 시작, 영문 소문자·숫자 조합
  //   반환: 통과 시 null, 위반 시 사유 문자열
  const validateStudentId = (id) => {
    if (!id) return null; // 빈 값은 「자동생성」 표시 대상 — 검증 안 함
    if (id.length < 5) return '5자 이상 필요';
    if (id.length > 13) return '13자 이하 필요';
    if (!/^[a-z]/.test(id)) return '영문 소문자로 시작 필요';
    if (!/^[a-z][a-z0-9]*$/.test(id)) return '영문 소문자·숫자만 허용';
    return null;
  };

  const handleAddStudent = () => {
    if (!name || !grade || !classNum || !stuNum) {
      showToast('모든 필수 항목을 입력해주세요.', 'warning');
      return;
    }
    const truncated = truncateName(name);
    const gradeInfo = `${grade}학년 ${classNum}반 ${stuNum}번`;

    // 1) 아이디 형식 검증 — 위반 시 추가 차단, 인풋의 빨간 보더로 이미 시각화됨
    const idFormatErr = validateStudentId(manualId);
    if (idFormatErr) {
      showToast(`아이디 형식 오류: ${idFormatErr}`, 'warning');
      return;
    }

    // 2) 학년반번호 중복 검사 (기존 등록 + 우측 누적 명단)
    const gradeInfoDup = checkDuplicate({ name: truncated, gradeInfo });
    // 3) 아이디 중복 검사 (기존 등록 + 우측 누적 명단). 빈 값(자동생성)은 검사 안 함
    const idDup = checkIdDuplicate(manualId);

    setIsDuplicate(gradeInfoDup);
    setIsIdDuplicate(idDup);

    // 중복이 하나라도 있으면 추가 차단
    if (gradeInfoDup || idDup) {
      const parts = [];
      if (gradeInfoDup) parts.push('학년·반·번호');
      if (idDup) parts.push('아이디');
      showToast(`${parts.join(' / ')} 중복이 감지되었습니다. 확인 후 수정해 주세요.`, 'warning');
      return;
    }

    // 모든 검증 통과 → 명단 추가
    const newStudent = {
      no: tempList.length + 1,
      name: truncated,
      gradeInfo,
      id: manualId || '',
      duplicate: false,
      idError: null,
    };

    setTempList([...tempList, newStudent]);
    setName('');
    setGrade('');
    setClassNum('');
    setStuNum('');
    setManualId('');
    setIsDuplicate(false);
    setIsIdDuplicate(false);
    showToast('학생이 명단에 추가되었습니다.');
  };

  const handleRemoveStudent = (no) => {
    setTempList(tempList.filter(s => s.no !== no));
  };

  // [v1.1] 번호 필드 onBlur 자동 명단 추가
  //   조건: 모든 필수 필드(이름·학년·반·번호) 채워짐 + 아이디 형식 유효(또는 빈 값)
  //   미충족 시 무동작(토스트 없음) — 사용자가 채워서 번호 필드에서 다시 blur해야 재시도
  //   충족 시 handleAddStudent 호출하여 중복 검사 후 명단 추가
  const handleStuNumBlur = () => {
    // 모든 필수 필드 미충족 시 무동작
    if (!name || !grade || !classNum || !stuNum) return;
    // 아이디 형식 오류면 무동작 — 사용자가 아이디 수정 후 번호 필드에서 다시 blur
    if (validateStudentId(manualId)) return;
    // 모든 조건 충족 — handleAddStudent 호출 (중복 검사 + 명단 추가)
    handleAddStudent();
  };

  // 모의 엑셀 업로드 처리 (이름 20자 제한 + 업로드 즉시 중복 확인 + 아이디 유효성 검사)
  // [STU-09] 기존 명단(엑셀+개별 누적분) 위에 누적되며 대체하지 않음
  const simulateFileUpload = () => {
    const baseNo = tempList.length;
    const mockData = [
      { name: '이름이매우긴학생졸업생신입생복학생장학생만학도이름이20자가넘어갑니다', gradeInfo: '1학년 1반 1번', id: 'stu25011avc' },
      { name: '심사임당', gradeInfo: '1학년 1반 12번', id: 'stu25012avc' },
      { name: '장영실', gradeInfo: '1학년 1반 13번', id: '' },
      // [STU-09] 아이디 조건 불일치 케이스 (시연용)
      { name: '김유효', gradeInfo: '1학년 1반 14번', id: '2abc' },               // 숫자 시작 + 5자 미만
      { name: '이형식', gradeInfo: '1학년 1반 15번', id: 'StudentName2026' },    // 13자 초과 + 대문자 포함
      { name: '박오류', gradeInfo: '1학년 1반 16번', id: 'stu_25017' },          // 특수문자 포함
    ];

    // [v2.2 갭 3] 행 수 상한 500명 검증 — 기존 명단 + 신규 업로드 합계
    const MAX_TOTAL = 500;
    if (tempList.length + mockData.length > MAX_TOTAL) {
      showToast(`최대 ${MAX_TOTAL}명까지 한 번에 등록 가능합니다. (현재 ${tempList.length}명 + 신규 ${mockData.length}명) 파일을 나누어 업로드해 주세요.`, 'warning');
      return;
    }

    const processed = mockData.map((m, idx) => {
      const truncated = truncateName(m.name);
      return {
        no: baseNo + idx + 1,
        name: truncated,
        gradeInfo: m.gradeInfo,
        id: m.id,
        duplicate: checkDuplicate({ name: truncated, gradeInfo: m.gradeInfo }),
        idError: validateStudentId(m.id),
      };
    });

    const dupCount = processed.filter(s => s.duplicate).length;
    const idErrCount = processed.filter(s => s.idError).length;
    setTempList([...tempList, ...processed]);
    if (dupCount > 0 || idErrCount > 0) {
      const parts = [];
      if (dupCount > 0) parts.push(`중복 ${dupCount}명`);
      if (idErrCount > 0) parts.push(`아이디 오류 ${idErrCount}명`);
      showToast(`엑셀 업로드 완료. ${parts.join(' · ')} 감지되었습니다.`, 'warning');
    } else {
      showToast('엑셀 파일이 업로드 되었습니다.');
    }
  };

  // 등록 완료 처리 (ID 자동 생성 포함)
  // [v2.2 갭 5] 부모에서 history.replace 이동 처리 — STU-09는 콜백만 호출
  const handleCompleteRegistration = () => {
    const finalizedList = tempList.map(stu => ({
      ...stu,
      id: stu.id || `stu_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    }));

    console.log('Finalized Registration Data:', finalizedList);
    // [v2.2 갭 4] 등록 성공 시 draft 즉시 삭제 (재진입 시 복원되지 않도록)
    sessionStorage.removeItem('stu-09-draft');
    onComplete(finalizedList);
  };

  // 취소 시 경고 메시지 (이탈 방지)
  const handleCancel = () => {
    if (tempList.length > 0 || name || grade || classNum || stuNum || manualId) {
      if (window.confirm('작성 중인 내용이 저장되지 않습니다. 나가시겠습니까?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="content-container bg-white" style={{ borderRadius: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 가운데 스크롤 영역: 헤더 + 좌·우 레이아웃. v1.7: mini-footer 추가로 하단 padding 축소 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2rem 1rem' }}>
        <header className="content-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h1 className="content-title">학생등록</h1>
            <p className="content-subtitle">학생 정보를 일괄 또는 개별로 등록할 수 있습니다. 두 방식을 자유롭게 병행하여 한 화면에서 명단을 구성하세요.</p>
          </div>
          {/* [v1.4] 헤더 [← 목록으로] — v1.2의 푸터 [✕ 취소]를 헤더로 이동 */}
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
        {/* Left: Input Area (일괄 + 개별 통합 세로 배치, v1.2 / 그룹 선택은 우측으로 이동, v1.5) */}
        <div className="reg-left">
          {/* 엑셀 일괄 등록 영역 — v1.1 세로 카드 3개 그대로 */}
          <div className="bulk-reg-section">
            <label className="reg-label" style={{ color: '#2A75F3' }}>엑셀 파일 등록 <span className="required">*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {/* Step 01 — 다운로드 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', border: '1px solid #E5E7EB', borderRadius: '12px', background: 'white' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>1. 다운로드</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>엑셀파일을 다운로드 해주세요.</div>
                </div>
                <button style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 'var(--neo-font-size-base)', fontWeight: 700, cursor: 'pointer' }}>⬇ 다운로드</button>
              </div>
              {/* Step 02 — 작성 (안내 박스) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #E5E7EB', borderRadius: '12px', background: 'white' }}>
                <div style={{ flex: '0 0 35%' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem' }}>2. 엑셀파일 작성</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>다운로드한 파일에 학생정보를 입력하세요.</div>
                </div>
                <div style={{ flex: 1, padding: '0.85rem 1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '0.35rem' }}>▶ 작성 안내</div>
                  - 성명은 최대 20자까지 가능하며, 초과 시 자동 절삭됩니다.<br/>
                  - 아이디(ID) 칸을 비워두면 등록 완료 시 자동 생성됩니다.<br/>
                  - 직접 입력 시 영문 소문자로 시작하는 5~13자(소문자·숫자 조합)로 입력해 주세요.
                </div>
              </div>
              {/* [v2.1] Step 03 — 세로 드롭존 (드래그 앤 드롭 가능함을 명확히 인지하도록 강화) */}
              <div
                onDragOver={(e) => { e.preventDefault(); if (!isDragOver) setIsDragOver(true); }}
                onDragLeave={(e) => {
                  // currentTarget 밖으로 벗어날 때만 leave 처리 (자식 요소 진입에서 leave 안 되도록)
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  // prototype: 실제 파일 파싱 대신 mock simulateFileUpload 호출
                  simulateFileUpload();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.85rem',
                  padding: '2rem 1.5rem',
                  border: `2.5px dashed ${isDragOver ? '#2A75F3' : '#94A3B8'}`,
                  borderRadius: '12px',
                  background: isDragOver ? '#EFF6FF' : '#F8FAFC',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  lineHeight: 1,
                  transform: isDragOver ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                  filter: isDragOver ? 'drop-shadow(0 4px 8px rgba(42,117,243,0.3))' : 'none',
                }}>📤</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: isDragOver ? '#1D4ED8' : '#1E293B', marginBottom: '0.2rem' }}>
                    {isDragOver ? '여기에 파일을 놓으세요' : '파일을 여기로 드래그하세요'}
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.4 }}>
                    Step 03 · 작성한 엑셀(.xlsx) 파일을 드롭하거나 아래 버튼으로 선택
                  </div>
                </div>
                {/* 또는 구분선 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '70%', maxWidth: '280px' }}>
                  <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E2E8F0', margin: 0 }} />
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>또는</span>
                  <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E2E8F0', margin: 0 }} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); simulateFileUpload(); }}
                  style={{
                    padding: '0.7rem 1.75rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2A75F3',
                    color: 'white',
                    fontSize: 'var(--neo-font-size-base)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(42,117,243,0.2)',
                  }}
                >📁 파일 선택</button>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                  지원 형식: .xlsx · 최대 10MB
                </div>
              </div>
            </div>
          </div>

          {/* 구분선 + 개별 등록 보조 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0 1rem' }}>
            <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E5E7EB' }} />
            <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#64748B', padding: '0 0.5rem', whiteSpace: 'nowrap' }}>또는 직접 입력으로 추가하기</span>
            <hr style={{ flex: 1, border: 0, borderTop: '1px solid #E5E7EB' }} />
          </div>

          {/* 개별 등록 카드 — v1.3: form 컨테이너로 감싸 Enter 키 트리거 지원
              트리거 1: 번호 필드 onBlur / 트리거 2: 어느 필드든 Enter (form onSubmit)
              v1.5: 접기/펼침 토글 — 헤더 클릭 시 펼침/접힘. 기본 = 접힘 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStuNumBlur();
            }}
            style={{
              padding: isIndividualExpanded ? '1.25rem 1.5rem' : '1rem 1.5rem',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              background: 'white',
              transition: 'padding 0.15s ease',
            }}
          >
            {/* 카드 헤더 — 클릭 시 펼침/접힘 토글 */}
            <div
              onClick={() => setIsIndividualExpanded(v => !v)}
              style={{
                marginBottom: isIndividualExpanded ? '1rem' : 0,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
              title={isIndividualExpanded ? '클릭하여 접기' : '클릭하여 펼치기'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✏️</span> 직접 입력 추가
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>
                  {isIndividualExpanded ? (
                    <>누락된 학생을 1명씩 직접 입력하여 우측 명단에 추가합니다. <strong style={{ color: '#2A75F3' }}>번호 입력 후 다른 곳을 클릭하거나, Enter 키, 또는 하단 [➕ 명단 추가] 버튼</strong>으로 추가됩니다.</>
                  ) : (
                    <>클릭하여 직접 입력 폼 펼치기</>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: 'var(--neo-font-size-sm)',
                color: '#94A3B8',
                fontWeight: 700,
                flexShrink: 0,
                padding: '0.25rem 0.6rem',
                background: '#F1F5F9',
                borderRadius: '6px',
              }}>{isIndividualExpanded ? '▲' : '▼'}</div>
            </div>

            {/* 카드 본문 — 펼침 시에만 노출 (1행 필드 ~ 인라인 에러 + hidden submit) */}
            {isIndividualExpanded && <>

            {/* 1행: 아이디(선택) + 이름(필수) 가로 2칸 */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  아이디 <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 400 }}>(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="비워두면 자동 생성"
                  value={manualId}
                  onChange={(e) => {
                    setManualId(e.target.value.toLowerCase());
                    if (isIdDuplicate) setIsIdDuplicate(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: `1px solid ${((manualId && !/^[a-z][a-z0-9]{4,12}$/.test(manualId)) || isIdDuplicate) ? '#EF4444' : '#CBD5E1'}`,
                    borderRadius: '8px',
                    fontSize: 'var(--neo-font-size-sm)',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{
                  fontSize: 'var(--neo-font-size-xs)', margin: '0.3rem 0 0', lineHeight: 1.3,
                  color: manualId && !/^[a-z][a-z0-9]{4,12}$/.test(manualId) ? '#EF4444' : '#94A3B8'
                }}>
                  영문 소문자 시작, 5~13자
                </p>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  이름 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="이름 (최대 20자)"
                  value={name}
                  onChange={(e) => {
                    setName(truncateName(e.target.value));
                    if (isDuplicate) setIsDuplicate(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: 'var(--neo-font-size-sm)',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: '0.3rem 0 0', lineHeight: 1.3 }}>
                  초과 시 자동 절삭
                </p>
              </div>
            </div>

            {/* 2행: 학년 + 반 + 번호 가로 3칸 */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ flex: '0 0 90px' }}>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  학년 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="1~6"
                  value={grade}
                  onChange={(e) => {
                    const val = handleNumericInput(e.target.value, 6);
                    setGrade(val);
                    if (isDuplicate) setIsDuplicate(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: `1px solid ${isDuplicate ? '#EF4444' : '#CBD5E1'}`,
                    borderRadius: '8px',
                    fontSize: 'var(--neo-font-size-sm)',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  반 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 1, 새싹, A"
                  value={classNum}
                  maxLength={20}
                  onChange={(e) => {
                    setClassNum(e.target.value.trimStart());
                    if (isDuplicate) setIsDuplicate(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: `1px solid ${isDuplicate ? '#EF4444' : '#CBD5E1'}`,
                    borderRadius: '8px',
                    fontSize: 'var(--neo-font-size-sm)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: '0 0 110px' }}>
                <label style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  번호 <span style={{ color: '#EF4444' }}>*</span> <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', fontWeight: 700 }}>↵ 자동</span>
                </label>
                <input
                  type="text"
                  placeholder="1~127"
                  value={stuNum}
                  onChange={(e) => {
                    const val = handleNumericInput(e.target.value, 127);
                    setStuNum(val);
                    if (isDuplicate) setIsDuplicate(false);
                  }}
                  onBlur={handleStuNumBlur}
                  title="번호 입력 후 포커스를 빼거나 Enter 키를 누르면 자동으로 명단에 추가됩니다."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: `1px solid ${isDuplicate ? '#EF4444' : '#CBD5E1'}`,
                    borderRadius: '8px',
                    fontSize: 'var(--neo-font-size-sm)',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
              학년 1~6 (중/고는 1~3) · 반 최대 20자 · 번호 최대 127
            </p>

            {/* 인라인 에러 박스 */}
            {isDuplicate && (
              <div style={{
                marginTop: '0.75rem',
                color: '#B91C1C',
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: 500,
                backgroundColor: '#FEF2F2',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #FCA5A5'
              }}>
                🚨 해당 학년·반·번호로 등록된 학생이 이미 있습니다. (기존 등록 또는 우측 명단과 중복) — 학년·반·번호를 다시 확인해 주세요.
              </div>
            )}
            {isIdDuplicate && (
              <div style={{
                marginTop: '0.5rem',
                color: '#B91C1C',
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: 500,
                backgroundColor: '#FEF2F2',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #FCA5A5'
              }}>
                🚨 아이디 <strong style={{ fontFamily: 'monospace' }}>{manualId}</strong>가 이미 사용 중입니다. 다른 아이디를 입력하거나 비워두어 자동 생성으로 처리해 주세요.
              </div>
            )}

            {/* [v1.6] 카드 내부 [➕ 명단 추가] 버튼 — 우측 정렬, 필드/에러 박스 아래 */}
            {(() => {
              const canAdd = !!(name && grade && classNum && stuNum);
              return (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    onClick={handleAddStudent}
                    disabled={!canAdd}
                    title={canAdd ? '입력한 학생을 우측 명단에 추가합니다 (Enter 키와 동일).' : '이름·학년·반·번호를 모두 입력해 주세요.'}
                    style={{
                      padding: '0.7rem 1.5rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: canAdd ? '#2A75F3' : '#E2E8F0',
                      color: canAdd ? 'white' : '#94A3B8',
                      fontSize: 'var(--neo-font-size-base)',
                      fontWeight: 800,
                      cursor: canAdd ? 'pointer' : 'not-allowed',
                    }}
                  >➕ 명단 추가</button>
                </div>
              );
            })()}

            </>}
            {/* /v1.5 카드 본문 펼침 조건 종료 */}
          </form>
        </div>

        {/* Right: Group Select + Preview List (sticky, v1.5) */}
        <div className="reg-right" style={{ position: 'sticky', top: '1rem', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto' }}>
          {/* [v1.5] 그룹 선택 카드 — 우측 명단 패널 위에 배치. 선택한 그룹에 명단 전체 매핑 */}
          <div style={{
            padding: '1rem 1.25rem',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            background: 'white',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>👥</span> 그룹 선택 <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 500 }}>(선택)</span>
              </div>
              <button
                onClick={() => { setPendingGroup(selectedGroup); setIsGroupModalOpen(true); }}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #BFDBFE',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >{selectedGroup ? '변경' : '그룹 선택'}</button>
            </div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginBottom: '0.5rem', lineHeight: 1.4 }}>
              선택 시 명단 전체가 해당 그룹에 매핑됩니다. 선택 안 해도 등록 가능합니다.
            </div>
            {selectedGroup ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '0.35rem 0.75rem',
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '999px',
                  color: '#1D4ED8',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 700,
                }}>👥 {selectedGroup.name} ({selectedGroup.studentCount}명)</span>
                <button
                  onClick={() => { setSelectedGroup(null); showToast('그룹 선택이 해제되었습니다.'); }}
                  style={{
                    padding: '0.3rem 0.55rem',
                    borderRadius: '6px',
                    border: '1px solid #FCA5A5',
                    background: 'white',
                    color: '#B91C1C',
                    fontSize: 'var(--neo-font-size-xs)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >× 해제</button>
              </div>
            ) : (
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>선택된 그룹 없음 — 그룹 없음으로 등록됩니다.</div>
            )}
          </div>

          <div className="preview-header">
            <h3>업로드 명단 중복 확인</h3>
            <span>
              중복인원 <b style={{ color: tempList.some(s => s.duplicate) ? '#EF4444' : undefined }}>{tempList.filter(s => s.duplicate).length}</b>명
              {' / '}
              아이디 오류 <b style={{ color: tempList.some(s => s.idError) ? '#EF4444' : undefined }}>{tempList.filter(s => s.idError).length}</b>명
              {' / '}
              전체인원 <b>{tempList.length}</b>명
            </span>
          </div>
          {tempList.some(s => s.duplicate) && (
            <div style={{
              marginBottom: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              fontSize: 'var(--neo-font-size-sm)',
              color: '#B91C1C',
              fontWeight: 500
            }}>
              🚨 해당 학교의 반번호로 등록된 학생이 있습니다. 회원관리에서 확인하세요.
            </div>
          )}
          {tempList.some(s => s.idError) && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              fontSize: 'var(--neo-font-size-sm)',
              color: '#92400E',
              fontWeight: 500
            }}>
              ⚠️ 아이디 형식이 올바르지 않은 학생이 있습니다. 영문 소문자로 시작하는 5~13자(영문 소문자·숫자 조합)로 입력해 주세요. 해당 행의 아이디를 수정하거나 비워서 자동 생성으로 처리할 수 있습니다.
            </div>
          )}
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>이름</th>
                  <th>아이디</th>
                  <th>학년-반-번호</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {tempList.length > 0 ? tempList.map((stu) => {
                  const rowBg = stu.duplicate ? '#FEF2F2' : (stu.idError ? '#FFFBEB' : undefined);
                  return (
                    <tr key={stu.no} style={rowBg ? { background: rowBg } : undefined}>
                      <td>{stu.no}</td>
                      <td style={stu.duplicate ? { color: '#EF4444', fontWeight: 700 } : undefined}>
                        {stu.name}
                        {stu.duplicate && <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#EF4444', fontWeight: 400 }}>해당 학교의 반번호로 등록된 학생이 있습니다.</span>}
                      </td>
                      <td style={stu.idError ? { color: '#92400E' } : undefined}>
                        {stu.id ? (
                          <span style={stu.idError ? { fontFamily: 'monospace', fontWeight: 700 } : { fontFamily: 'monospace' }}>{stu.id}</span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>자동생성</span>
                        )}
                        {stu.idError && (
                          <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#92400E', fontWeight: 600, marginTop: '2px' }}>
                            ⚠️ {stu.idError}
                          </span>
                        )}
                      </td>
                      <td style={stu.duplicate ? { color: '#EF4444' } : undefined}>{stu.gradeInfo}</td>
                      <td><button className="btn-del-mini" onClick={() => handleRemoveStudent(stu.no)}>×</button></td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="5" className="empty-msg">
                      엑셀을 업로드하거나 좌측에서 학생을 추가해 주세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* [v1.7] 우측 명단 패널 내부 [💾 등록] 제거 — 화면 우측 하단 sticky로 단독 이동 */}
        </div>
        </div>
      </div>

      {/* [v1.7] 화면 우측 하단 mini-footer — [💾 등록] 단독 고정. 좌측은 비움
          (v1.6: 우측 패널 내부 [💾 등록] 폐기 후 단일 위치로 통합) */}
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
          className={`btn-footer complete ${tempList.length > 0 && !tempList.some(s => s.duplicate || s.idError) ? 'active' : ''}`}
          onClick={handleCompleteRegistration}
          disabled={tempList.length === 0 || tempList.some(s => s.duplicate || s.idError)}
          style={{ width: 'auto', padding: '0.85rem 2.5rem', fontSize: 'var(--neo-font-size-base)' }}
          title={
            tempList.length === 0
              ? '명단에 학생을 추가해 주세요'
              : tempList.some(s => s.duplicate)
                ? '중복 학생을 제거해 주세요'
                : tempList.some(s => s.idError)
                  ? '아이디 형식 오류를 수정해 주세요'
                  : selectedGroup ? `명단 전체를 「${selectedGroup.name}」 그룹에 매핑하여 저장합니다.` : '명단 전체를 최종 저장합니다.'
          }
        >
          💾 등록
        </button>
      </div>

      {/* [v1.5] 그룹 선택 모달 */}
      {isGroupModalOpen && (
        <div
          onClick={() => setIsGroupModalOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            zIndex: 9500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 14,
              width: 460,
              maxWidth: '92vw',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ padding: '18px 22px 8px', borderBottom: '1px solid #E2E8F0' }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>👥</span> 그룹 선택
              </h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
                업로드한 학생 명단을 매핑할 그룹을 선택하세요. 「선택 안 함」으로 두면 그룹 없이 등록됩니다.
              </p>
              {/* [v2.3] 배포된 그룹에도 학생 등록 허용 — 신규 학생은 배포 과제의 미채점 단계에 자동 재등장 */}
              <p style={{ margin: '0.4rem 0 0', padding: '0.5rem 0.7rem', fontSize: 'var(--neo-font-size-xs)', color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', lineHeight: 1.5 }}>
                💡 <strong>과제가 배포된 그룹에도 학생을 등록할 수 있습니다.</strong> 신규 학생은 배포된 과제의 <strong>「미채점」 단계</strong>에 자동으로 추가되어 이어서 채점할 수 있습니다.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.5rem' }}>
              {/* 선택 안 함 */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderRadius: '8px',
                background: pendingGroup === null ? '#EFF6FF' : 'transparent',
              }}>
                <input
                  type="radio"
                  name="groupChoice"
                  checked={pendingGroup === null}
                  onChange={() => setPendingGroup(null)}
                />
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 600 }}>선택 안 함 (그룹 없이 등록)</span>
              </label>
              <div style={{ height: '1px', background: '#E2E8F0', margin: '0.35rem 1rem' }} />
              {/* 그룹 list */}
              {AVAILABLE_GROUPS.map((g) => (
                <label key={g.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  background: pendingGroup?.id === g.id ? '#EFF6FF' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <input
                      type="radio"
                      name="groupChoice"
                      checked={pendingGroup?.id === g.id}
                      onChange={() => setPendingGroup(g)}
                    />
                    <span style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', fontWeight: 700 }}>{g.name}</span>
                  </div>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{g.studentCount}명</span>
                </label>
              ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: 'white',
                  color: '#475569',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >취소</button>
              <button
                onClick={() => {
                  setSelectedGroup(pendingGroup);
                  setIsGroupModalOpen(false);
                  showToast(pendingGroup ? `그룹 「${pendingGroup.name}」이 선택되었습니다.` : '그룹 선택을 해제했습니다.');
                }}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2A75F3',
                  color: 'white',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentRegistration;
