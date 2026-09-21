import React, { useState, useEffect } from 'react';
import './index.css';

const TeacherDetailDrawer = ({ isOpen, teacher, onClose }) => {
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isSchoolApproved, setIsSchoolApproved] = useState(false);

  useEffect(() => {
    if (teacher) {
      setName(teacher.name);
      setIsApproved(!teacher.pendingApproval);
      setIsSchoolApproved(!teacher.pendingSchoolChange);
    }
  }, [teacher]);

  if (!teacher) return null;

  return (
    <>
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer-container ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="header-left">
            <h2 className="drawer-title">교사정보</h2>
          </div>
          <button className="drawer-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="drawer-content">
          <div className="drawer-joined-date">가입일 : {teacher.joinDate}</div>

          {/* 기본 정보 */}
          <section className="drawer-section">
            <h3 className="section-title-sm">기본 정보</h3>
            <div className="grid-2col">
              <div className="form-item">
                <label>아이디</label>
                <input type="text" value={teacher.id} disabled className="input-disabled" />
              </div>
              <div className="form-item">
                <label>이메일</label>
                <input type="text" value={teacher.email} disabled className="input-disabled" />
              </div>
            </div>
            <div className="form-item mt-1">
              <label>이름</label>
              <div className="input-with-clear">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="input-clear" onClick={() => setName('')}>×</button>
              </div>
            </div>
            <div className="form-item mt-1">
              <label>비밀번호</label>
              <div className="password-reset-row">
                <input type="password" value="******" disabled className="input-disabled" />
                <button className="btn-reset">초기화</button>
              </div>
            </div>
          </section>

          <hr className="divider-dash" />

          {/* 소속 및 유형 */}
          <section className="drawer-section">
            <h3 className="section-title-sm">소속 및 유형</h3>
            
            {/* 정보 영역: 수정 가능한 정보 중심 UI */}
            <div className="info-group-box">
              <div className="form-item">
                <label>회원 유형 및 기간</label>
                <div className="type-date-row">
                  <select className="select-type">
                    <option>{teacher.type}</option>
                    <option>유료회원</option>
                    <option>무료회원</option>
                  </select>
                  <div className="date-range-picker">
                    <input type="text" value="2026.04.10 - 2026.04.23" readOnly />
                    <span className="cal-icon">📅</span>
                  </div>
                </div>
                <p className="field-hint">※ 날짜 수정은 정보 변경 사항이며 승인 처리에 영향을 주지 않습니다.</p>
              </div>

              {/* 학교 정보 */}
              <div className="form-item mt-1">
                <label>학교 정보</label>
                <input type="text" value={teacher.pendingSchoolChange ? `${teacher.school} → ${teacher.requestedSchool}` : teacher.school} disabled className="input-disabled" />
              </div>
            </div>

            {/* 승인 처리 영역: UX 개선 적용 - 날짜와 무관하게 전용 액션으로 분리 */}
            {(teacher.pendingApproval || teacher.pendingSchoolChange) && (
              <div className="approval-action-area">
                <div className="action-header">🔔 승인 요청 내역</div>
                
                {teacher.pendingApproval && (
                  <div className="action-row">
                    <div className="action-desc">
                      <span className="req-badge">유료회원</span> 
                      승인 요청이 있습니다.
                    </div>
                    <button 
                      className={`btn-approve-action ${isApproved ? 'done' : ''}`}
                      onClick={() => setIsApproved(true)}
                      disabled={isApproved}
                    >
                      {isApproved ? '승인 완료' : '승인확인'}
                    </button>
                  </div>
                )}

                {teacher.pendingSchoolChange && (
                  <div className="action-row">
                    <div className="action-desc">
                      <span className="req-badge school">학교변경</span> 
                      {teacher.requestedSchool}로 변경 요청
                    </div>
                    <button 
                      className={`btn-approve-action ${isSchoolApproved ? 'done' : ''}`}
                      onClick={() => setIsSchoolApproved(true)}
                      disabled={isSchoolApproved}
                    >
                      {isSchoolApproved ? '승인 완료' : '학교 변경 승인'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <hr className="divider-dash" />

          {/* 활동 정보 */}
          <section className="drawer-section">
            <h3 className="section-title-sm">활동 정보</h3>
            <div className="activity-stats">
              <span>생성 과제수 <strong>0개</strong></span>
              <span className="v-divider">|</span>
              <span>담당 학생 수 <strong>0명</strong></span>
            </div>
          </section>

          {/* 업무 처리 */}
          <section className="drawer-section">
            <h3 className="section-title-sm">업무 처리</h3>
            <div className="editor-container">
              {/* 실제 에디터 라이브러리 대신 UI 형태만 재현 */}
              <div className="editor-mock-toolbar">
                <span>맑은 고딕 ▼</span>
                <span>10pt ▼</span>
                <span className="tool-b">B</span>
                <span className="tool-i">I</span>
                <span className="tool-u">U</span>
                <span className="tool-s">S</span>
              </div>
              <textarea 
                className="editor-textarea" 
                placeholder="관리 메모를 입력하세요..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </section>
        </div>

        <div className="drawer-footer">
          <button className="btn-drawer-close" onClick={onClose}>닫기</button>
          <button className="btn-drawer-complete" onClick={onClose}>수정 완료</button>
        </div>
      </div>
    </>
  );
};

export default TeacherDetailDrawer;
