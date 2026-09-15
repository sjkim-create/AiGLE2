import React, { useState, useEffect } from 'react';
import './index.css';
import TaskFileUploadWizard from './TaskFileUploadWizard';
import TaskDirectInputWizard from './TaskDirectInputWizard';
import WorksheetPreviewModal from './WorksheetPreviewModal';
import NumberTagPreviewModal from './NumberTagPreviewModal';

const TaskRegistration = ({ onBack, showToast, initialMode = 'select', onAdd }) => {
  // [v3.5] 등록 방식 — 'select' (진입 직후 선택 화면) / 'direct' (직접 입력) / 'upload' (파일 업로드 Wizard)
  // [v3.6] initialMode prop으로 TaskManagement 슬라이딩 패널에서 선택된 모드로 바로 진입 가능
  const [registrationMode, setRegistrationMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    title: '',
    /* [TSK v3.8] 테스트 과제 — 배포·채점은 실제와 같되 학생 결과 발송·통계·공유에서 빠진다. 언제든 삭제, 실제 과제로 일방향 전환 */
    isTest: false,
    type: '서술형',
    level: '고등학교',
    grade: '1-3학년',
    schoolLevel: '중학교',
    subject: '국어',
    subSubject: '공통국어1',
    competencies: ['비판적·창의적 사고 역량', '자기 성찰·계발 역량'],
    evaluationAreas: ['듣기·말하기', '읽기'],
    achievementStandards: [
      { id: 1, text: '[10국어 1-01-01] 대화의 원리를 고려하여 대화하고 자신의 듣기·말하기 과정과 공동체의 담화 관습을 성찰한다.', checked: true },
      { id: 2, text: '[10국어 1-01-01] 대화의 원리를 고려하여 대화하고 자신의 듣기·말하기 과정과 공동체의 담화 관습을 성찰한다.', checked: true },
      { id: 3, text: '[10국어 1-01-01] 대화의 원리를 고려하여 대화하고 자신의 듣기·말하기 과정과 공동체의 담화 관습을 성찰한다.', checked: false },
    ],
    passage: '',
    questionContent: '',
    modelAnswer: '',
    score: '',
    printCount: 1,
    blockCopyPaste: false,
  });

  const [rubricType, setRubricType] = useState('auto'); // 'auto' or 'manual'
  const [activeTab, setActiveTab] = useState(1); // 문항 1, 2...
  const [rightTab, setRightTab] = useState('rubric'); // 'rubric' | 'consistency' | 'group'
  const [moreMenuOpen, setMoreMenuOpen] = useState(false); // 헤더 우측 더보기 메뉴
  const [worksheetPreviewOpen, setWorksheetPreviewOpen] = useState(false); // [TSK-05 v2.30] 평가 답안지 미리보기 모달
  const [numberTagPreviewOpen, setNumberTagPreviewOpen] = useState(false); // [TSK-05 v3.4] 스마트펜 번호표 미리보기 모달

  // [TSK-11] 공유확인 모달 (Model B Fork — 공유 = 카탈로그에 read-only 노출, 사본은 복사 시 독립 생성)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);          // 현재 과제 공유 상태
  const [sharedAt, setSharedAt] = useState(null);            // 최초 공유일
  const [copyCount, setCopyCount] = useState(0);             // 누적 복사 횟수 (인기 지표)

  // 채점 기준 textarea 내용 + 리치 에디터 모달
  const [criteriaTexts, setCriteriaTexts] = useState({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTargetKey, setEditorTargetKey] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const openEditor = (key) => {
    setEditorTargetKey(key);
    setEditorContent(criteriaTexts[key] || '');
    setEditorOpen(true);
  };
  const applyEditor = () => {
    setCriteriaTexts(prev => ({ ...prev, [editorTargetKey]: editorContent }));
    setEditorOpen(false);
  };

  // 자율 평가 기준표 — 카드 단위 루브릭 (PRD §3.3 v3.2)
  // 채점 기준 등급 select(3/4/5단계)로 항목 개수 결정 — 항목 = 한 등급 단위
  // 등급명은 한국 학사 평가 체계 (DSH-02 v3.14 등급 registry와 정합)
  const RUBRIC_GRADE_SCALES = {
    3: [
      { name: '우수',     color: '#2A75F3' },
      { name: '보통',     color: '#94A3B8' },
      { name: '노력',     color: '#EF4444' },
    ],
    4: [
      { name: '우수',     color: '#2A75F3' },
      { name: '보통',     color: '#94A3B8' },
      { name: '노력',     color: '#F59E0B' },
      { name: '매우 노력', color: '#EF4444' },
    ],
    5: [
      { name: '매우 우수', color: '#10B981' },
      { name: '우수',     color: '#2A75F3' },
      { name: '보통',     color: '#94A3B8' },
      { name: '노력',     color: '#F59E0B' },
      { name: '매우 노력', color: '#EF4444' },
    ],
  };
  const buildRubricRows = (scale, prevRows = [], prevCriteria = {}) => {
    const levels = RUBRIC_GRADE_SCALES[scale];
    return levels.map((lv, idx) => {
      const existing = prevRows.find(r => r.gradeName === lv.name);
      const id = `rg-${scale}-${idx}`;
      return existing
        ? { ...existing, id, gradeName: lv.name, gradeColor: lv.color }
        : { id, gradeName: lv.name, gradeColor: lv.color, question: '문항1', area: '' };
    });
  };
  const [rubricScale, setRubricScale] = useState(3);
  const [rubricRows, setRubricRows] = useState(() => buildRubricRows(3));

  // scale 변경 시 — 사라지는 등급에 작성된 데이터가 있다면 confirm 모달
  const changeRubricScale = (newScale) => {
    if (newScale === rubricScale) return;
    const newLevels = RUBRIC_GRADE_SCALES[newScale];
    const lostRows = rubricRows.filter(r => {
      const inNew = newLevels.some(l => l.name === r.gradeName);
      if (inNew) return false;
      const hasArea = (r.area || '').trim().length > 0;
      const hasCriteria = (criteriaTexts[r.id] || '').trim().length > 0;
      return hasArea || hasCriteria;
    });
    if (lostRows.length > 0) {
      const names = lostRows.map(r => `「${r.gradeName}」`).join(', ');
      if (!window.confirm(`${names} 등급에 작성한 내용이 사라집니다.\n${newScale}단계로 변경하시겠습니까?`)) return;
    }
    // 새 rows — 등급명 매칭으로 데이터 보존
    const newRows = buildRubricRows(newScale, rubricRows, criteriaTexts);
    // criteriaTexts도 새 id에 맞춰 재매핑 (등급명 일치 보존)
    const newCriteria = {};
    newRows.forEach(row => {
      const oldRow = rubricRows.find(r => r.gradeName === row.gradeName);
      if (oldRow && criteriaTexts[oldRow.id]) newCriteria[row.id] = criteriaTexts[oldRow.id];
    });
    setRubricRows(newRows);
    setCriteriaTexts(newCriteria);
    setRubricScale(newScale);
  };

  const updateRubricRow = (id, patch) => {
    setRubricRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  // 외부 클릭 시 더보기 메뉴 닫기
  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDoc = (e) => {
      if (!e.target.closest('.reg-more-wrap')) setMoreMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [moreMenuOpen]);

  // ─── TSK-05: 그룹 및 평가 문답지 관리 ───
  const [groupList, setGroupList] = useState([
    { id: 1, label: '1학년 1반', checked: false, codeDeployed: false, studentDeployed: false },
    { id: 2, label: '1학년 2반', checked: false, codeDeployed: false, studentDeployed: false },
    { id: 3, label: '1학년 3반', checked: false, codeDeployed: false, studentDeployed: false }
  ]);

  // 파생 상태
  const checkedGroups = groupList.filter(g => g.checked);
  const selectedCount = checkedGroups.length;

  // 번호표 배포: 선택된 그룹 중 번호표 미배포가 1개 이상
  const codeTargets = checkedGroups.filter(g => !g.codeDeployed);
  const canDeployCode = codeTargets.length > 0;

  // 번호표 배포 ⇄ 번호표 배포 취소 (토글)
  //   • 선택 그룹 중 번호표 미배포 1+ → [번호표 배포] (미배포 건 할당, 채점 관리 미채점 진입 / 학생 노출 X)
  //   • 선택 그룹 전부 번호표 배포됨 + 전부 학생 미배포 → [번호표 배포 취소] (할당 해제)
  //   • 선택 그룹 전부 번호표 배포됨 + 학생 배포된 게 있음 → 차단 (학생 배포부터 취소해야 함)
  const allChecked_codeDeployed = selectedCount > 0 && checkedGroups.every(g => g.codeDeployed);
  const anyChecked_studentDeployed = checkedGroups.some(g => g.studentDeployed);
  const codeToggleMode = canDeployCode
    ? 'deploy'
    : allChecked_codeDeployed
      ? (anyChecked_studentDeployed ? 'blocked' : 'cancel')
      : 'disabled';
  const showCodeCancel = codeToggleMode === 'cancel';
  const canToggleCode = codeToggleMode === 'deploy' || codeToggleMode === 'cancel';

  // 학생 배포 토글:
  //   • 선택된 그룹이 모두 학생 배포됨 → [취소] 활성
  //   • 선택된 그룹이 모두 학생 미배포 → [배포] 활성 (번호표 미배포여도 일괄 처리)
  //   • 혼합 (일부는 배포, 일부는 미배포) → 비활성 + 경고
  const allChecked_studentDeployed = selectedCount > 0 && checkedGroups.every(g => g.studentDeployed);
  const allChecked_studentNotDeployed = selectedCount > 0 && checkedGroups.every(g => !g.studentDeployed);
  const studentToggleMode = allChecked_studentDeployed
    ? 'cancel'                                             // 모두 배포됨 → 취소
    : allChecked_studentNotDeployed
      ? 'deploy'                                           // 모두 미배포 → 배포 (번호표 미배포여도 OK)
      : 'disabled';                                        // 혼합 → 비활성
  const showStudentCancel = studentToggleMode === 'cancel';
  const canToggleStudent = studentToggleMode !== 'disabled';

  // 학생 배포 시 번호표 미배포 그룹 존재 여부 (일괄 배포 안내용)
  const willAutoDeployCode = studentToggleMode === 'deploy' && codeTargets.length > 0;

  // 출력 가능: 선택된 그룹 중 번호표 배포된 게 1개 이상 (혼합이어도 번호표 배포된 그룹은 출력)
  const printableGroups = checkedGroups.filter(g => g.codeDeployed);
  const canPrint = printableGroups.length > 0;
  const hasCodeUndeployedInSelection = checkedGroups.some(g => !g.codeDeployed);
  
  // Resizable logic
  const [rightWidth, setRightWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX - 24; // 24 for padding
      if (newWidth > 320 && newWidth < window.innerWidth * 0.6) {
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const isSubjectOther = formData.subject === '기타과목';

  // 기타과목 선택 시 자동 평가 기준표 선택 불가 로직
  useEffect(() => {
    if (isSubjectOther) {
      setRubricType('manual');
    } else {
        setRubricType('auto');
    }
  }, [formData.subject]);

  const handleRubricTypeChange = (type) => {
    if (type === 'auto' && isSubjectOther) {
      showToast('현재 선택한 교과는 자동평가 기준표를 사용할 수 없습니다.', 'warning');
      return;
    }
    setRubricType(type);
  };

  const handleSave = () => {
    showToast('과제가 성공적으로 저장되었습니다.');
    if (onBack) onBack();
  };

  const menuItemStyle = {
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 'var(--neo-font-size-sm)',
    fontWeight: 600,
    color: '#1E2225',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  // 채점 기준 textarea 위 에디터 아이콘 버튼
  const editorBtnStyle = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: 24,
    height: 24,
    border: '1px solid #E2E8F0',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: 'var(--neo-font-size-sm)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  };

  // 에디터 모달 툴바 스타일
  const tbBtnStyle = {
    width: 30, height: 30,
    border: 'none', background: 'transparent',
    borderRadius: '4px', cursor: 'pointer',
    fontSize: 'var(--neo-font-size-base)', color: '#475569',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  const tbSelectStyle = {
    height: 30,
    padding: '0 8px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: 'var(--neo-font-size-sm)',
    background: 'white',
  };
  const tbDividerStyle = {
    width: 1, height: 18, background: '#E2E8F0', margin: '0 2px',
  };

  // [v3.5] 등록 방식 선택 화면 (TSK-02 §3.5.0)
  if (registrationMode === 'select') {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>← 목록</button>
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>새 과제 등록</h1>
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '720px', width: '100%' }}>
            <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, textAlign: 'center', marginBottom: '8px' }}>등록 방식을 선택해 주세요</h2>
            <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#64748B', textAlign: 'center', marginBottom: '32px' }}>
              과제를 어떤 방식으로 만드시겠습니까?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <button
                onClick={() => setRegistrationMode('direct')}
                style={{
                  background: 'white', border: '2px solid #E2E8F0', borderRadius: '16px',
                  padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2A75F3'; e.currentTarget.style.background = '#EFF6FF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <span style={{ fontSize: '3rem' }}>📝</span>
                <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>직접 입력</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>
                  문제 텍스트·이미지를 시스템 내에서 직접 작성합니다.
                </span>
              </button>
              <button
                onClick={() => setRegistrationMode('direct2')}
                style={{
                  background: 'white', border: '2px solid #E2E8F0', borderRadius: '16px',
                  padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = '#F5F3FF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <span style={{ fontSize: '3rem' }}>🧩</span>
                <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>직접 입력 2</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>
                  탭 단계형 입력. 문항 → 자동/자율 평가 채점 기준 → 등급 환산까지 단계별로 작성합니다.
                </span>
              </button>
              <button
                onClick={() => setRegistrationMode('upload')}
                style={{
                  background: 'white', border: '2px solid #E2E8F0', borderRadius: '16px',
                  padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.background = '#F0FDF4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
              >
                <span style={{ fontSize: '3rem' }}>📷</span>
                <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>파일 업로드</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.5 }}>
                  기존 종이 양식(PDF/이미지)을 업로드하여 그대로 학생 문답지로 사용합니다.
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // [v3.5] 파일 업로드 Wizard 모드 — 저장 시 onAdd로 부모(목록)에 task 전달
  if (registrationMode === 'upload') {
    return <TaskFileUploadWizard onBack={() => { setRegistrationMode('select'); onBack && onBack(); }} showToast={showToast} onAdd={onAdd} />;
  }

  // 직접 입력 2 — 탭 단계형 Wizard 모드
  if (registrationMode === 'direct2') {
    return <TaskDirectInputWizard onBack={() => { setRegistrationMode('select'); onBack && onBack(); }} showToast={showToast} onAdd={onAdd} />;
  }

  // 기존: 직접 입력 모드
  return (
    <div className="registration-page">
      {/* Header */}
      <header className="reg-header">
        <div className="reg-header-left">
          <h1 className="reg-title">서 · 논술 문제 등록</h1>
        </div>
        <div className="reg-header-right">
          <button className="btn-outline" onClick={onBack}>나가기</button>
          <button className="btn-primary-filled" onClick={handleSave}>저장</button>
          {/* 더보기 메뉴 (아이콘) — 과제 파일 관리 / 공유확인 / 삭제 */}
          <div className="reg-more-wrap" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setMoreMenuOpen(o => !o)}
              aria-expanded={moreMenuOpen}
              title="더보기"
              style={{
                width: 38, height: 38,
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                background: moreMenuOpen ? '#F1F5F9' : 'white',
                cursor: 'pointer',
                fontSize: 'var(--neo-font-size-lg)',
                color: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ⋮
            </button>
            {moreMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                  minWidth: '200px',
                  padding: '6px',
                  zIndex: 1000,
                }}
              >
                {/* 과제 파일 관리 — 섹션 라벨 + 펼친 항목 */}
                <div style={{ padding: '6px 12px 4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.02em' }}>
                  📄 과제 파일 관리
                </div>
                <button
                  onClick={() => setMoreMenuOpen(false)}
                  style={menuItemStyle}
                >
                  ⬆️ 과제 내보내기
                </button>
                <button
                  onClick={() => setMoreMenuOpen(false)}
                  style={menuItemStyle}
                >
                  ⬇️ 과제 가져오기
                </button>
                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 6px' }} />
                <button
                  onClick={() => { setMoreMenuOpen(false); setShareModalOpen(true); }}
                  style={menuItemStyle}
                >
                  🔗 공유확인 {isShared && <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#10B981', fontWeight: 800 }}>● 공유 중</span>}
                </button>
                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 6px' }} />
                <button
                  onClick={() => setMoreMenuOpen(false)}
                  style={{ ...menuItemStyle, color: '#EF4444' }}
                >
                  🗑 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="reg-content" style={{ gridTemplateColumns: `1fr 12px ${rightWidth}px` }}>
        {/* Left Column: Basic Info & Question Input */}
        <div className="reg-col-left">
          {/* 기본 정보 섹션 */}
          <section className="reg-section">
            <h2 className="section-title">기본 정보</h2>
            <div className="form-group">
              <label>과제명 <span className="required">*</span></label>
              <div className="input-with-counter">
                <input 
                  type="text" 
                  placeholder="과제명을 입력하세요." 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
                <span className="counter">{formData.title.length}/30</span>
              </div>
            </div>

            {/* [TSK v3.8] 테스트 과제 */}
            <div className="form-group" style={{ padding: '10px 12px', borderRadius: 10, background: formData.isTest ? '#FFF7ED' : '#F8FAFC', border: `1px solid ${formData.isTest ? '#FDBA74' : '#E2E8F0'}` }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', margin: 0 }}>
                <input type="checkbox" checked={!!formData.isTest} onChange={(e) => setFormData({ ...formData, isTest: e.target.checked })} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ fontWeight: 800, color: '#1E2225' }}>테스트 과제로 등록</span>
                  <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2, lineHeight: 1.6 }}>
                    배포·인쇄·펜 채점·AI 채점은 실제와 똑같이 할 수 있습니다. 다만 <strong>학생에게 결과를 보내지 않고</strong>, 통계·공유에서 빠지며, 언제든 삭제할 수 있습니다.
                    나중에 <strong>실제 과제로 전환</strong>할 수 있습니다(되돌리기 불가).
                  </span>
                </span>
              </label>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>유형</label>
                <div className="radio-group">
                  <label><input type="radio" checked readOnly /> 서술형</label>
                </div>
              </div>
              <div className="form-group flex-2">
                <label>학교급</label>
                <div className="radio-group">
                  <label><input type="radio" name="level" /> 초등학교</label>
                  <label><input type="radio" name="level" /> 중학교</label>
                  <label><input type="radio" name="level" checked readOnly /> 고등학교</label>
                </div>
              </div>
              <div className="form-group flex-1">
                <label>학년 <span className="required">*</span></label>
                <select className="select-full">
                  <option>1-3학년</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>교과 <span className="required">*</span></label>
                <select 
                  className="select-full"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                >
                  <option>국어</option>
                  <option>수학</option>
                  <option>영어</option>
                  <option>기타과목</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label>핵심 역량</label>
                <div className="checkbox-grid">
                  <label><input type="checkbox" checked readOnly /> 비판적·창의적 사고 역량</label>
                  <label><input type="checkbox" /> 디지털·미디어 역량</label>
                  <label><input type="checkbox" checked readOnly /> 자기 성찰·계발 역량</label>
                  <label><input type="checkbox" /> 공동체·대인 관계 역량</label>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>과목</label>
                <select className="select-full">
                  <option>공통국어1</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label>핵심평가영역 (내용체계)</label>
                <div className="checkbox-grid">
                  <label><input type="checkbox" checked readOnly /> 듣기·말하기</label>
                  <label><input type="checkbox" checked readOnly /> 읽기</label>
                  <label><input type="checkbox" /> 쓰기</label>
                  <label><input type="checkbox" /> 문법</label>
                  <label><input type="checkbox" /> 문학</label>
                </div>
              </div>
            </div>

            <div className="form-group">
                <label>성취기준 <span className="required">*</span></label>
                <div className="achievement-list">
                  {formData.achievementStandards.map(s => (
                    <label key={s.id} className="achievement-item">
                      <input type="checkbox" checked={s.checked} readOnly />
                      <span>{s.text}</span>
                    </label>
                  ))}
                </div>
            </div>

            {/* ─── 응시 설정 (학생 답안 입력 정책) ─── */}
            <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px dashed #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <label style={{ margin: 0, fontWeight: 800 }}>응시 설정</label>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 500 }}>— 학생 답안 입력 정책</span>
                </div>
                <div style={{
                    background: formData.blockCopyPaste ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${formData.blockCopyPaste ? '#FCA5A5' : '#E5E7EB'}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                    transition: 'all 0.2s ease'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer'
                    }}>
                        {/* 토글 스위치 */}
                        <span
                            role="switch"
                            aria-checked={formData.blockCopyPaste}
                            style={{
                                position: 'relative',
                                width: '44px',
                                height: '24px',
                                borderRadius: '12px',
                                background: formData.blockCopyPaste ? '#EF4444' : '#CBD5E1',
                                transition: 'background 0.2s ease',
                                flexShrink: 0
                            }}
                            onClick={() => setFormData({ ...formData, blockCopyPaste: !formData.blockCopyPaste })}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '2px',
                                left: formData.blockCopyPaste ? '22px' : '2px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'white',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                            }} />
                        </span>
                        <input
                            type="checkbox"
                            checked={formData.blockCopyPaste}
                            onChange={(e) => setFormData({ ...formData, blockCopyPaste: e.target.checked })}
                            style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>
                            복사·붙여넣기 차단
                        </span>
                        <span
                            title="공정한 평가를 위해 학생이 AI 생성 답안 등 외부 출처 문구를 그대로 복제하지 못하도록 차단합니다. 학생 응시 화면에만 적용됩니다."
                            style={{
                                fontSize: 'var(--neo-font-size-xs)',
                                color: '#8A94A1',
                                cursor: 'help',
                                border: '1px solid #CBD5E1',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >ℹ</span>
                    </label>
                    <p style={{
                        margin: '10px 0 0 56px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: formData.blockCopyPaste ? '#B91C1C' : '#475569',
                        fontWeight: 600,
                        lineHeight: 1.5
                    }}>
                        {formData.blockCopyPaste
                            ? '🚫 학생은 답안 입력 시 복사·붙여넣기를 사용할 수 없습니다. (Ctrl+C/V, 우클릭 메뉴, 드래그 복사 모두 차단)'
                            : '✅ 학생은 답안 입력 시 복사·붙여넣기를 자유롭게 사용할 수 있습니다.'}
                    </p>
                </div>
            </div>

            <div className="section-collapse-btn">▲</div>
          </section>

          {/* 문항 입력 섹션 */}
          <section className="reg-section">
            <h2 className="section-title">문항 입력</h2>
            <div className="form-group">
              <label>지문 <span className="required">*</span></label>
              <div className="rich-editor-placeholder">
                <div className="editor-toolbar">
                  <span>본문 고딕 ▾</span><span>10pt ▾</span><b>B</b><i>I</i><u>U</u><s>S</s> | 🎨 🔗 🖼️ 🎥 📊
                </div>
                <textarea placeholder="지문 내용을 입력하세요." rows="4"></textarea>
              </div>
              <p className="editor-hint">💡 조건에 따라 답안을 작성하도록 유도하는 문제인 경우, 조건을 지문에 포함하여 작성하세요.</p>
            </div>

            <div className="question-tabs">
                <div className="tab active">문항1 <span className="tab-close">×</span></div>
                <div className="tab-add">+</div>
            </div>

            <div className="tab-content">
                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <label>문항 내용 <span className="required">*</span></label>
                        <button className="btn-ai-magic">✨ AI 개선</button>
                    </div>
                    <div className="rich-editor-placeholder">
                        <div className="editor-toolbar">
                            <span>본문 고딕 ▾</span><span>10pt ▾</span><b>B</b><i>I</i><u>U</u><s>S</s> | 🎨 🔗 🖼️
                        </div>
                        <textarea placeholder="문항 내용을 입력하세요." rows="4"></textarea>
                    </div>
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <label>모범 답안 <span className="required">*</span></label>
                        <button className="btn-add-small">+ 추가</button>
                    </div>
                    <div className="model-answer-item">
                        <div className="item-header">모범 답안 01 <span className="trash-icon">🗑️</span></div>
                        <div className="rich-editor-placeholder no-border-radius-top">
                            <textarea placeholder="모범 답안을 입력하세요." rows="2"></textarea>
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>배점 <span className="required">*</span></label>
                        <input type="text" placeholder="배점을 입력하세요." className="input-full" />
                    </div>
                    {/* [TSK-02 v3.3] 문항별 예상 답안지 장수.
                        인쇄 수량 산정 + 스캔 채점(SCR-05)의 결손 판정 기준으로 함께 쓰인다 */}
                    <div className="form-group flex-1">
                        <label>답안지 출력 장수 설정 <span className="required">*</span></label>
                        <input type="number" min={1} max={10} defaultValue={1} className="input-full" />
                        <span className="input-hint">기본 1장, 최대 10장까지 · 이 문항 하나에 대한 예상 답안지 장수</span>
                        <span className="input-hint" style={{ color: '#B45309' }}>
                            📷 스캔 채점 시 <strong>답안 누락 판정 기준</strong>으로 사용됩니다.
                        </span>
                    </div>
                </div>
            </div>
          </section>
        </div>

        {/* Resizer Handle */}
        <div className="reg-splitter" onMouseDown={() => setIsResizing(true)}>
          <div className="splitter-handle"></div>
        </div>

        {/* Right Column: Rubric Design */}
        <div className="reg-col-right">
          <div className="rubric-container">
            <div className="rubric-tabs">
                <div
                  className={`r-tab ${rightTab === 'rubric' ? 'active' : ''}`}
                  onClick={() => setRightTab('rubric')}
                >평가 기준표 작성</div>
                <div
                  className={`r-tab ${rightTab === 'consistency' ? 'active' : ''}`}
                  onClick={() => setRightTab('consistency')}
                >일괄성 사전 점검</div>
                <div
                  className={`r-tab ${rightTab === 'group' ? 'active' : ''}`}
                  onClick={() => setRightTab('group')}
                >그룹 및 평가 문답지 관리</div>
            </div>

            {rightTab === 'rubric' && (
            <div className="rubric-content">
                <div className="rubric-hint">
                    📍 기본정보에서 학년, 교과, 과목, 내용체계, 성취기준을 먼저 선택해주세요.
                </div>

                <div className="form-group">
                    <label>평가 유형 선택 <span className="required">*</span></label>
                    <div className="rubric-type-cards">
                        <div 
                          className={`rubric-type-card ${rubricType === 'auto' ? 'active' : ''} ${isSubjectOther ? 'disabled' : ''}`}
                          onClick={() => handleRubricTypeChange('auto')}
                        >
                            <div className="card-check">{rubricType === 'auto' && '✓'}</div>
                            <h3>자동 평가 기준표</h3>
                            <p>2022 교육과정 성취기준에 해당하는 평가표를 템플릿으로 제공하고, 수정하여 교사가 커스터마이징할 수 있습니다.</p>
                        </div>
                        <div 
                          className={`rubric-type-card ${rubricType === 'manual' ? 'active' : ''}`}
                          onClick={() => handleRubricTypeChange('manual')}
                        >
                            <div className="card-check">{rubricType === 'manual' && '✓'}</div>
                            <h3>자율 평가 기준표</h3>
                            <p>교사가 직접 평가 기준표를 입력하여 루브릭을 설정하는 방식입니다. 과제 특성에 맞는 세부 평가 요소와 기준을 자율적으로 구성할 수 있습니다.</p>
                        </div>
                    </div>
                </div>

                <div className="rubric-table-section">
                    <div className="table-header-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <label>채점 기준 (문항 기준)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>채점 기준 등급 선택</label>
                            <select
                                value={rubricScale}
                                onChange={(e) => changeRubricScale(Number(e.target.value))}
                                title="선택한 단계 수만큼 등급별 채점 기준 항목이 자동으로 노출됩니다"
                                style={{
                                    height: 32, padding: '0 28px 0 10px',
                                    border: '1.5px solid #2A75F3', borderRadius: '8px',
                                    fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1D4ED8',
                                    background: 'white', cursor: 'pointer',
                                }}
                            >
                                <option value={3}>3단계</option>
                                <option value={4}>4단계</option>
                                <option value={5}>5단계</option>
                            </select>
                        </div>
                    </div>
                    <p className="table-hint">선택한 단계 수에 따라 등급별 항목이 자동 노출됩니다. 각 항목은 한 등급에 해당하며, 문항·채점 영역·채점 기준을 작성하세요.</p>

                    {/* 카드 레이아웃 — 등급 단위 카드 (PRD §3.3 v3.2) — 내부 스크롤 (v3.2.4) */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '14px',
                        maxHeight: 'calc(100vh - 360px)', overflowY: 'auto',
                        paddingRight: '6px', // 스크롤바와 카드 간 여백
                    }}>
                        {rubricRows.map((row, idx) => {
                            return (
                                <div
                                    key={row.id}
                                    style={{
                                        border: '1px solid #E2E8F0', borderLeft: `4px solid ${row.gradeColor}`,
                                        borderRadius: '12px',
                                        background: 'white', padding: '14px 16px',
                                        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                                    }}
                                >
                                    {/* 카드 헤더: 등급 배지만 노출 (v3.2.2) */}
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '4px 10px', borderRadius: '12px',
                                            background: `${row.gradeColor}1A`, color: row.gradeColor,
                                            fontSize: 'var(--neo-font-size-sm)', fontWeight: 800,
                                        }}>
                                            <span style={{ fontSize: 'var(--neo-font-size-xs)' }}>●</span>
                                            {row.gradeName}
                                        </span>
                                    </div>

                                    {/* 메타 2종: 문항 / 채점 영역 — 등급은 위 배지로 노출됨 */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(110px, 1fr) minmax(180px, 2.5fr)',
                                        gap: '10px', marginBottom: '12px',
                                    }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>문항</label>
                                            <select
                                                value={row.question}
                                                onChange={(e) => updateRubricRow(row.id, { question: e.target.value })}
                                                style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', background: 'white' }}
                                            >
                                                <option>문항1</option>
                                                <option>문항2</option>
                                                <option>문항3</option>
                                                <option>공통</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>채점 영역</label>
                                            <input
                                                type="text"
                                                placeholder="예: 핵심 개념 제시 여부"
                                                value={row.area}
                                                onChange={(e) => updateRubricRow(row.id, { area: e.target.value })}
                                                style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* 채점 기준 인라인 에디터 — 전체 폭 */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>채점 기준</label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    className="btn-ai-small"
                                                    title="AI가 채점 기준을 추천합니다"
                                                    style={{ padding: '4px 10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700 }}
                                                >✨ AI 추천</button>
                                                <button
                                                    onClick={() => openEditor(row.id)}
                                                    title="전체 화면 에디터로 확장"
                                                    style={{
                                                        padding: '4px 8px', border: '1px solid #E2E8F0',
                                                        borderRadius: '6px', background: 'white', cursor: 'pointer',
                                                        fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700,
                                                    }}
                                                >⛶ 확장</button>
                                            </div>
                                        </div>
                                        {/* 인라인 에디터 — 컴팩트 툴바 + 본문 영역 */}
                                        <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '2px',
                                                padding: '4px 6px', borderBottom: '1px solid #F1F5F9',
                                                background: '#F8FAFC', flexWrap: 'wrap',
                                            }}>
                                                <button type="button" style={tbBtnStyle} title="굵게"><b>B</b></button>
                                                <button type="button" style={tbBtnStyle} title="기울임"><i>I</i></button>
                                                <button type="button" style={tbBtnStyle} title="밑줄"><u>U</u></button>
                                                <button type="button" style={tbBtnStyle} title="취소선"><s>S</s></button>
                                                <div style={tbDividerStyle} />
                                                <button type="button" style={tbBtnStyle} title="글머리표">≔</button>
                                                <button type="button" style={tbBtnStyle} title="번호 매기기">①</button>
                                                <div style={tbDividerStyle} />
                                                <button type="button" style={tbBtnStyle} title="형광펜">🖍</button>
                                                <button type="button" style={tbBtnStyle} title="수식 삽입"><i>fx</i></button>
                                                <div style={{ flex: 1 }} />
                                                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                                                    {(criteriaTexts[row.id] || '').length} / 500
                                                </span>
                                            </div>
                                            <textarea
                                                placeholder={`「${row.gradeName}」 등급에 해당하는 채점 기준을 작성하세요.`}
                                                value={criteriaTexts[row.id] || ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (v.length <= 500) {
                                                        setCriteriaTexts(prev => ({ ...prev, [row.id]: v }));
                                                    }
                                                }}
                                                style={{
                                                    width: '100%', minHeight: '120px',
                                                    padding: '10px 12px', border: 'none', outline: 'none',
                                                    fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.55,
                                                    resize: 'vertical', fontFamily: 'inherit',
                                                    color: '#1E2225', boxSizing: 'border-box',
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="rubric-footer">
                    <button className="btn-primary-filled large">다음</button>
                </div>
            </div>
            )}

            {rightTab === 'consistency' && (
            <div className="rubric-content" style={{ padding: '2rem', textAlign: 'center', color: '#8A94A1' }}>
                <p style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 600 }}>일괄성 사전 점검 기능</p>
                <p style={{ fontSize: 'var(--neo-font-size-sm)', marginTop: '0.5rem' }}>(별도 화면 명세 예정)</p>
            </div>
            )}

            {rightTab === 'group' && (
            <div className="rubric-content" style={{ padding: '1.5rem' }}>
                {/* 그룹/반 지정 */}
                <div className="form-group">
                    <label style={{ color: '#2A75F3', fontWeight: 800, marginBottom: '10px', display: 'block' }}>그룹/반 지정</label>
                    <div style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        padding: '16px 20px',
                        background: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        {groupList.map(g => (
                            <label
                                key={g.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    color: '#1E2225',
                                    fontSize: 'var(--neo-font-size-base)'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={g.checked}
                                    onChange={(e) => {
                                        setGroupList(prev => prev.map(item =>
                                            item.id === g.id ? { ...item, checked: e.target.checked } : item
                                        ));
                                    }}
                                />
                                <span>{g.label}</span>
                                {g.codeDeployed && !g.studentDeployed && (
                                    <span style={{
                                        background: '#FEF3C7',
                                        color: '#B45309',
                                        fontSize: 'var(--neo-font-size-xs)',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        marginLeft: '6px'
                                    }}>📋 번호표 배포</span>
                                )}
                                {g.studentDeployed && (
                                    <span style={{
                                        background: '#DBEAFE',
                                        color: '#1D4ED8',
                                        fontSize: 'var(--neo-font-size-xs)',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        marginLeft: '6px'
                                    }}>🚀 학생 배포</span>
                                )}
                            </label>
                        ))}
                    </div>

                    {/* 액션 버튼 영역 */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
                        {/* 번호표 배포 ⇄ 번호표 배포 취소 (토글) */}
                        <button
                            disabled={!canToggleCode}
                            onClick={() => {
                                if (showCodeCancel) {
                                    // 번호표 배포 취소 = 과제 할당 해제 (채점 관리 미채점에서 제거). 학생 노출은 이미 해제된 상태
                                    setGroupList(prev => prev.map(item =>
                                        item.checked ? { ...item, codeDeployed: false, studentDeployed: false } : item
                                    ));
                                    if (showToast) showToast(`번호표 배포를 취소했습니다. 과제 할당이 해제됩니다.`);
                                } else {
                                    setGroupList(prev => prev.map(item =>
                                        item.checked && !item.codeDeployed ? { ...item, codeDeployed: true } : item
                                    ));
                                    if (showToast) showToast(`번호표가 ${codeTargets.length}개 그룹에 배포되었습니다. (과제 할당 · 채점 관리 미채점)`);
                                }
                            }}
                            title={
                                codeToggleMode === 'blocked'
                                    ? '학생 배포 중인 그룹은 번호표 배포를 취소할 수 없습니다. 먼저 [학생 배포 취소]를 진행하세요.'
                                    : showCodeCancel
                                        ? '과제 할당을 해제합니다 (채점 관리 미채점에서 제거). 응시·채점 데이터가 있으면 취소할 수 없습니다.'
                                        : 'ncode를 할당해 번호표를 인쇄할 수 있도록 합니다. 과제가 학생에게 할당되어 채점 관리 미채점 단계로 들어가지만, 학생 화면에는 아직 노출되지 않습니다.'
                            }
                            style={{
                                padding: '8px 20px',
                                borderRadius: '8px',
                                border: showCodeCancel ? '1px solid #EF4444' : 'none',
                                background: !canToggleCode ? '#E5E7EB' : showCodeCancel ? 'white' : '#F59E0B',
                                color: !canToggleCode ? '#9CA3AF' : showCodeCancel ? '#EF4444' : 'white',
                                fontWeight: 700,
                                fontSize: 'var(--neo-font-size-sm)',
                                cursor: canToggleCode ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {showCodeCancel ? '↩ 번호표 배포 취소' : '📋 번호표 배포'}{canToggleCode ? ` (${showCodeCancel ? selectedCount : codeTargets.length})` : ''}
                        </button>

                        {/* 학생 배포 ⇄ 학생 배포 취소 (토글). 번호표 미배포여도 일괄 처리 */}
                        <button
                            disabled={!canToggleStudent}
                            onClick={() => {
                                if (showStudentCancel) {
                                    setGroupList(prev => prev.map(item =>
                                        item.checked ? { ...item, studentDeployed: false } : item
                                    ));
                                    if (showToast) showToast(`학생 배포를 취소했습니다.`);
                                } else {
                                    // 번호표 미배포 그룹도 함께 일괄 처리
                                    setGroupList(prev => prev.map(item =>
                                        item.checked ? { ...item, codeDeployed: true, studentDeployed: true } : item
                                    ));
                                    if (showToast) {
                                        const msg = willAutoDeployCode
                                            ? `번호표와 학생 배포가 함께 완료되었습니다.`
                                            : `학생에게 배포되었습니다.`;
                                        showToast(msg);
                                    }
                                }
                            }}
                            title={
                                !canToggleStudent
                                    ? '선택된 그룹의 학생 배포 상태가 서로 다릅니다. 같은 상태의 그룹만 선택해 주세요.'
                                    : showStudentCancel
                                        ? '학생 화면에서 과제를 숨깁니다.'
                                        : willAutoDeployCode
                                            ? '번호표 배포가 되지 않은 그룹도 함께 배포됩니다.'
                                            : '학생에게 과제를 노출합니다.'
                            }
                            style={{
                                padding: '8px 20px',
                                borderRadius: '8px',
                                border: showStudentCancel && canToggleStudent ? '1px solid #EF4444' : 'none',
                                background: !canToggleStudent
                                    ? '#E5E7EB'
                                    : showStudentCancel
                                        ? 'white'
                                        : '#2A75F3',
                                color: !canToggleStudent
                                    ? '#9CA3AF'
                                    : showStudentCancel
                                        ? '#EF4444'
                                        : 'white',
                                fontWeight: 700,
                                fontSize: 'var(--neo-font-size-sm)',
                                cursor: canToggleStudent ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {showStudentCancel ? '↩ 학생 배포 취소' : '🚀 학생 배포'}{canToggleStudent ? ` (${selectedCount})` : ''}
                        </button>
                    </div>
                </div>

                <div style={{ borderTop: '1px dashed #E5E7EB', margin: '20px 0' }} />

                {/* 상태 경고 배너 */}
                {selectedCount === 0 && (
                    <div style={{
                        background: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: '#B91C1C',
                        fontWeight: 600
                    }}>
                        🚫 그룹/반을 먼저 지정해야 출력할 수 있습니다.
                    </div>
                )}
                {willAutoDeployCode && (
                    <div style={{
                        background: '#FFFBEB',
                        border: '1px solid #F59E0B',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: '#B45309',
                        fontWeight: 600,
                        lineHeight: 1.6
                    }}>
                        ℹ 번호표 배포가 되지 않은 그룹이 있습니다. <strong>[학생 배포]</strong> 클릭 시 번호표 배포까지 함께 진행됩니다.
                    </div>
                )}
                {studentToggleMode === 'disabled' && selectedCount > 0 && (
                    <div style={{
                        background: '#FFFBEB',
                        border: '1px solid #F59E0B',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: '#B45309',
                        fontWeight: 600,
                        lineHeight: 1.6
                    }}>
                        ⚠ 선택된 그룹들의 학생 배포 상태가 서로 다릅니다. 같은 상태의 그룹들만 선택해 일괄 배포/취소해 주세요.
                    </div>
                )}
                {codeToggleMode === 'blocked' && (
                    <div style={{
                        background: '#FFFBEB',
                        border: '1px solid #F59E0B',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: '#B45309',
                        fontWeight: 600,
                        lineHeight: 1.6
                    }}>
                        ⚠ 학생 배포 중인 그룹은 번호표 배포를 취소할 수 없습니다. 먼저 <strong>[학생 배포 취소]</strong>를 진행한 뒤 번호표 배포를 취소하세요. (번호표 배포 + 학생 배포가 모두 취소되어야 과제 삭제가 가능합니다.)
                    </div>
                )}
                {showCodeCancel && (
                    <div style={{
                        background: '#FFF7ED',
                        border: '1px solid #FDBA74',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: '#B45309',
                        fontWeight: 600,
                        lineHeight: 1.6
                    }}>
                        📋 번호표가 배포되어 과제가 <strong>할당된 상태</strong>입니다 (채점 관리 미채점에 표시). 학생 화면에는 아직 노출되지 않습니다. <strong>[학생 배포]</strong>로 학생에게 노출하거나, <strong>[번호표 배포 취소]</strong>로 과제 할당을 해제할 수 있습니다.
                    </div>
                )}
                {canPrint && hasCodeUndeployedInSelection && (
                    <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', margin: '0 0 8px', fontWeight: 600 }}>
                        📌 선택한 {selectedCount}개 중 번호표 배포된 <strong>{printableGroups.length}개 그룹</strong>만 출력에 포함됩니다.
                    </p>
                )}

                {/* 평가 문답지 출력 */}
                <div className="form-group">
                    <label style={{
                        color: canPrint ? '#2A75F3' : '#9CA3AF',
                        fontWeight: 800,
                        marginBottom: '4px',
                        display: 'block'
                    }}>
                        {canPrint ? '평가 문답지' : '평가 문답지 출력'}
                    </label>
                    <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginBottom: '12px' }}>
                        문항에 입력한 지문과 문항 내용이 반영됩니다.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        {[
                            { icon: '✎', label: '스마트펜 번호표' },
                            { icon: '□', label: '문제지 출력' },
                            { icon: '□', label: '답안지 출력' }
                        ].map((btn) => (
                            <button
                                key={btn.label}
                                disabled={!canPrint}
                                onClick={() => {
                                    // [TSK-05 v2.30] 답안지 출력은 미리보기 모달 오픈
                                    // [TSK-05 v3.4] 스마트펜 번호표도 미리보기 모달로 이관, 나머지는 기존 toast
                                    if (btn.label === '답안지 출력') {
                                        setWorksheetPreviewOpen(true);
                                    } else if (btn.label === '스마트펜 번호표') {
                                        setNumberTagPreviewOpen(true);
                                    } else if (showToast) {
                                        showToast(`${btn.label} PDF 생성 중...`);
                                    }
                                }}
                                style={{
                                    padding: '12px 8px',
                                    borderRadius: '8px',
                                    border: `1px solid ${canPrint ? '#CBD5E1' : '#E5E7EB'}`,
                                    background: 'white',
                                    color: canPrint ? '#1E2225' : '#9CA3AF',
                                    fontSize: 'var(--neo-font-size-sm)',
                                    fontWeight: 600,
                                    cursor: canPrint ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>{btn.icon}</span>
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rubric-footer">
                    <button
                        className="btn-primary-filled large"
                        style={{ background: '#E5E7EB', color: '#1E2225' }}
                        onClick={() => setRightTab('rubric')}
                    >
                        이전
                    </button>
                </div>
            </div>
            )}
          </div>
        </div>
      </div>

      <footer className="reg-footer-bar">
        <span>◆ AI 채점 결과는 완벽하지 않을 수 있습니다. 점수 확정 전 선생님께서 내용을 확인해주세요. ◆</span>
        <div className="footer-links">
            <span>이용약관</span> | <span>개인정보 처리방침</span> | <span>© 2026 NeoLAB Convergence Inc. All Rights Reserved.</span>
        </div>
      </footer>

      {/* 채점 기준 리치 에디터 모달 */}
      {editorOpen && (
        <div
          onClick={() => setEditorOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '14px', width: '900px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0 }}>채점 기준 에디터</h2>
              <button onClick={() => setEditorOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8' }}>✕</button>
            </div>

            {/* 툴바 1: 폰트·서식 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
              <select style={tbSelectStyle} defaultValue="맑은 고딕">
                <option>맑은 고딕</option><option>나눔고딕</option><option>돋움</option><option>바탕</option>
              </select>
              <input type="text" defaultValue="10pt" style={{ ...tbSelectStyle, width: '50px' }} />
              <div style={tbDividerStyle} />
              <button style={tbBtnStyle} title="굵게"><b>B</b></button>
              <button style={tbBtnStyle} title="기울임"><i>I</i></button>
              <button style={tbBtnStyle} title="밑줄"><u>U</u></button>
              <button style={tbBtnStyle} title="취소선"><s>S</s></button>
              <button style={tbBtnStyle} title="글자색">A</button>
              <div style={tbDividerStyle} />
              <button style={{ ...tbBtnStyle, background: '#DBEAFE' }} title="왼쪽 정렬">⬅︎</button>
              <button style={tbBtnStyle} title="가운데 정렬">↔︎</button>
              <button style={tbBtnStyle} title="오른쪽 정렬">➡︎</button>
              <button style={tbBtnStyle} title="양쪽 정렬">≡</button>
              <div style={tbDividerStyle} />
              <button style={tbBtnStyle} title="윗첨자">T²</button>
              <button style={tbBtnStyle} title="아래첨자">T₂</button>
              <button style={tbBtnStyle} title="형광펜">🖍</button>
              <div style={tbDividerStyle} />
              <button style={tbBtnStyle} title="글머리표">≔</button>
              <button style={tbBtnStyle} title="번호 매기기">①</button>
              <button style={tbBtnStyle} title="인용">❝</button>
              <button style={tbBtnStyle} title="구분선">―</button>
              <button style={tbBtnStyle} title="열 분할">▥</button>
              <button style={tbBtnStyle} title="표">▦</button>
            </div>

            {/* 툴바 2: 삽입 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              <button style={tbBtnStyle} title="왼쪽 배치">◧</button>
              <button style={tbBtnStyle} title="오른쪽 배치">◨</button>
              <button style={tbBtnStyle} title="좌측 정렬 박스">⊏</button>
              <button style={tbBtnStyle} title="위 정렬">⊤</button>
              <button style={tbBtnStyle} title="아래 정렬">⊥</button>
              <button style={tbBtnStyle} title="박스 제거">⊠</button>
              <div style={tbDividerStyle} />
              <button style={tbBtnStyle} title="이미지 삽입">🖼</button>
              <button style={tbBtnStyle} title="수식 삽입"><i>fx</i></button>
            </div>

            {/* 본문 입력 영역 */}
            <div style={{ flex: 1, padding: '14px 18px', overflow: 'auto', minHeight: '240px' }}>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="문항 내용을 입력하세요."
                style={{
                  width: '100%', height: '300px',
                  border: 'none', outline: 'none',
                  fontSize: 'var(--neo-font-size-base)', lineHeight: 1.6,
                  resize: 'vertical', fontFamily: 'inherit',
                  color: editorContent ? '#1E2225' : '#94A3B8',
                }}
              />
            </div>

            {/* 푸터 — 취소 / 반영 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setEditorOpen(false)} className="btn-outline">취소</button>
              <button onClick={applyEditor} className="btn-primary-filled">반영</button>
            </div>
          </div>
        </div>
      )}

      {/* [TSK-11] 공유확인 모달 — 공유 활성화/해제 */}
      {shareModalOpen && (
        <div
          onClick={() => setShareModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '14px',
              width: '460px', maxWidth: '92vw', padding: '1.5rem 1.75rem',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225', margin: 0 }}>
                {isShared ? '공유 상태' : '이 과제를 공유하시겠습니까?'}
              </h2>
              <button
                onClick={() => setShareModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}
              >×</button>
            </div>

            {/* 현재 상태 배지 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '10px',
              background: isShared ? '#ECFDF5' : '#F8FAFC',
              border: `1px solid ${isShared ? '#A7F3D0' : '#E2E8F0'}`,
              marginBottom: '1rem',
            }}>
              <span style={{ fontSize: 'var(--neo-font-size-xl)' }}>{isShared ? '🟢' : '⚪'}</span>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', flex: 1 }}>
                <div style={{ fontWeight: 800 }}>
                  {isShared ? '공유 중' : '비공유'}
                </div>
                {isShared && (
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: '2px' }}>
                    공유 시작 {sharedAt} · 📋 <strong style={{ color: '#1E2225' }}>{copyCount.toLocaleString()}</strong>회 복사됨
                  </div>
                )}
              </div>
            </div>

            {/* 공유 정보 안내 */}
            <ul style={{
              fontSize: 'var(--neo-font-size-sm)', color: '#475569',
              background: '#F8FAFC', borderRadius: '8px',
              padding: '0.75rem 1rem 0.75rem 1.75rem',
              margin: '0 0 1rem', lineHeight: 1.75,
              border: '1px solid #F1F5F9',
            }}>
              <li>공유 범위: <strong>전체 공개</strong> — 모든 교사가 검색·복사 가능</li>
              <li>다른 교사가 복사하면 <strong>독립된 사본</strong>이 생성됩니다 (원본 수정에 영향 없음)</li>
              <li>원작자 정보(이름·학교)는 모든 사본에 자동 표시되며 변경 불가</li>
              <li>학생 응시 데이터·통계는 공유되지 않습니다</li>
              <li>복사된 누적 횟수는 원본 카드에 인기 지표로 표시됩니다</li>
            </ul>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShareModalOpen(false)}
                style={{ padding: '9px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
              >닫기</button>
              {isShared ? (
                <button
                  onClick={() => {
                    setIsShared(false);
                    setShareModalOpen(false);
                    if (typeof showToast === 'function') showToast('과제 공유가 해제되었습니다.');
                  }}
                  style={{ padding: '9px 18px', background: '#EF4444', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
                >공유 해제</button>
              ) : (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setIsShared(true);
                    setSharedAt(today);
                    setShareModalOpen(false);
                    if (typeof showToast === 'function') showToast('과제가 공유 목록에 등록되었습니다.');
                  }}
                  style={{ padding: '9px 18px', background: '#2A75F3', border: 'none', borderRadius: '8px', fontWeight: 800, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}
                >🔗 공유 활성화</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* [TSK-05 v2.30] 평가 답안지 미리보기 모달 */}
      <WorksheetPreviewModal
        open={worksheetPreviewOpen}
        onClose={() => setWorksheetPreviewOpen(false)}
        subject={formData.subject}
        taskTitle={formData.title || '과제명'}
      />

      {/* [TSK-05 v3.4] 스마트펜 번호표 미리보기 모달 */}
      <NumberTagPreviewModal
        open={numberTagPreviewOpen}
        onClose={() => setNumberTagPreviewOpen(false)}
        subject={formData.subject}
        taskTitle={formData.title || '과제명'}
      />
    </div>
  );
};

export default TaskRegistration;
