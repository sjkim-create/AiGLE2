/**
 * MyInfo.jsx — [MY-01] 내 정보 화면
 *
 * 사이드바 프로필 드롭다운 → [내 정보] 진입 시 노출되는 본인 정보 화면.
 * PRD: skills/aigle/2.1/prd/MY-01_내정보.md
 * 정보 박스 7행 (read-only) + 비밀번호 변경 + 약관 동의 + 액션 버튼 + 회원 탈퇴 안내
 *
 * v1.1 — 학교 크레딧 잔량 행 추가 (DSH-02 헤더 chip과 동일 데이터·동일 4단계 임계)
 */
import React, { useMemo, useState } from 'react';

const PASSWORD_REGEX = /^[a-zA-Z][a-zA-Z0-9!@#$%^&*]{7,29}$/;

const MyInfo = () => {
  // ── mock 본인 정보 ──
  const teacher = {
    name: '서예진',
    id: 'tch202612nb',
    email: 's_yj_@neolab.net',
    schoolName: '네오중학교',
    tier: '학교유료회원', // '무료회원' | '학교유료회원'
    contractStart: '2026.05.12',
    contractEnd: '2027.05.12',
    signupDate: '2026.04.10',
  };

  // ── mock 크레딧 (DSH-02와 동일 데이터, 시연 케이스: 620 / 320 / 95 / 0) ──
  const schoolCredit = { total: 1000, remaining: 620 };
  const isFreeTier = teacher.tier === '무료회원';
  const creditUsed = schoolCredit.total - schoolCredit.remaining;
  const creditUsedRatio = schoolCredit.total > 0 ? (creditUsed / schoolCredit.total) * 100 : 0;
  const creditState = isFreeTier
    ? 'na'
    : schoolCredit.remaining === 0
    ? 'depleted'
    : creditUsedRatio > 80
    ? 'critical'
    : creditUsedRatio > 50
    ? 'warning'
    : 'normal';
  const creditColor =
    creditState === 'normal' ? '#0EA5E9' :
    creditState === 'warning' ? '#F59E0B' :
    creditState === 'critical' || creditState === 'depleted' ? '#EF4444' :
    '#94A3B8';
  const creditUsedRatioLabel =
    creditUsedRatio === 0 || creditUsedRatio === 100
      ? creditUsedRatio.toString()
      : creditUsedRatio < 10
      ? creditUsedRatio.toFixed(1)
      : Math.round(creditUsedRatio).toString();
  const creditMessage =
    creditState === 'depleted' ? '🚨 소진 — AI 호출이 차단되었습니다. 관리자에게 추가 충전을 요청하세요' :
    creditState === 'critical' ? '🚨 잔량 부족 — 채점·과제 등록이 곧 제한됩니다' :
    null;

  // 상태 pill (여유/주의/위급/소진)
  const creditPillLabel =
    creditState === 'normal' ? '여유' :
    creditState === 'warning' ? '주의' :
    creditState === 'critical' ? '위급' :
    creditState === 'depleted' ? '소진' : '';
  const creditPillBg =
    creditState === 'normal' ? '#D1FAE5' :
    creditState === 'warning' ? '#FEF3C7' : '#FEE2E2';
  const creditPillFg =
    creditState === 'normal' ? '#10B981' :
    creditState === 'warning' ? '#F59E0B' : '#EF4444';

  // 충전 예정일 = 계약 만료일 (학교유료회원만, 무료회원은 표기 생략)
  const creditRefillDate = !isFreeTier ? teacher.contractEnd : null;

  const contractLabel = isFreeTier
    ? `${teacher.signupDate} 가입 (trial)`
    : `${teacher.contractStart} ~ ${teacher.contractEnd} (1년 계약)`;

  // ── 비밀번호 변경 ──
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // ── 약관 동의 (필수 2종 prefilled true, 선택 1종) ──
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [agreeMarketing, setAgreeMarketing] = useState(true);

  // ── 검증·저장 상태 ──
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  const passwordValid = password === '' || PASSWORD_REGEX.test(password);
  const passwordMatch = password === passwordConfirm;
  const passwordTouched = password.length > 0 || passwordConfirm.length > 0;

  const hasChanges = useMemo(() => {
    return password.length > 0 || passwordConfirm.length > 0; // 약관 변경도 추적하려면 별도 비교 필요 (mock 단순화)
  }, [password, passwordConfirm]);

  const submitEnabled =
    agreeTerms && agreePrivacy && hasChanges &&
    (passwordTouched ? (passwordValid && passwordMatch && password.length >= 8) : true);

  const handleCancel = () => {
    setPassword('');
    setPasswordConfirm('');
  };

  const handleSubmit = () => {
    if (!submitEnabled) return;
    setToast({ type: 'success', message: '수정이 완료되었습니다.' });
    setPassword('');
    setPasswordConfirm('');
    setTimeout(() => setToast(null), 3000);
  };

  // ── 스타일 helpers ──
  const labelStyle = { color: '#2A75F3', fontWeight: 700, fontSize: 'var(--neo-font-size-base)', minWidth: '64px' };
  const valueStyle = { color: '#1E293B', fontWeight: 500, fontSize: 'var(--neo-font-size-base)' };
  const inputStyle = {
    width: '100%', padding: '12px 40px 12px 14px', borderRadius: '10px',
    border: '1px solid #E2E8F0', fontSize: 'var(--neo-font-size-base)', background: 'white',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{
        width: '100%', maxWidth: '640px', background: 'white',
        borderRadius: '20px', padding: '2.5rem 2.5rem 2rem',
        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
        border: '1px solid #F1F5F9',
      }}>
        {/* 정보 박스 (7행) — 2열 grid (페이지 타이틀은 Setting.jsx content-header에서 표시) */}
        <div style={{
          background: '#F8FAFC', borderRadius: '14px', padding: '1.5rem',
          border: '1px solid #F1F5F9', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '14px', columnGap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={labelStyle}>이름</span><span style={valueStyle}>{teacher.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={labelStyle}>학교명</span><span style={valueStyle}>{teacher.schoolName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={labelStyle}>이메일</span>
              <span style={valueStyle}>{teacher.email}</span>
              <span style={{ color: '#94A3B8', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }} title="복사">📋</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={labelStyle}>교사유형</span>
              <span style={valueStyle}>교사 ({teacher.tier})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', gridColumn: '1 / -1' }}>
              <span style={labelStyle}>계약일자</span><span style={valueStyle}>{contractLabel}</span>
            </div>

            {/* 크레딧 행 — 5줄 구조: 라벨+pill+위급 메시지 / 잔량 메인 / 진행 바 / 사용%+충전일 / 보조 안내 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1', paddingTop: '4px', borderTop: '1px dashed #E2E8F0' }}>
              {/* 줄 1: 라벨 + 상태 pill (+ 위급·소진 메시지) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={labelStyle}>💰 크레딧</span>
                {creditState === 'na' ? (
                  <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 'var(--neo-font-size-base)' }}>
                    해당 없음 (무료 회원 — 학교 계약 후 이용 가능)
                  </span>
                ) : (
                  <>
                    <span style={{
                      background: creditPillBg,
                      color: creditPillFg,
                      fontSize: 'var(--neo-font-size-xs)',
                      fontWeight: 800,
                      padding: '2px 10px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}>
                      {creditPillLabel}
                    </span>
                    {creditMessage && (
                      <span style={{ color: creditColor, fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>· {creditMessage}</span>
                    )}
                  </>
                )}
              </div>
              {/* 줄 2: 잔량 / 전체 (메인 강조, 큰 글씨) + "남음" 작게 */}
              {creditState !== 'na' && (
                <div style={{ color: creditColor, fontWeight: 900, fontSize: 'var(--neo-font-size-xl)', lineHeight: 1.2, paddingLeft: '74px', marginTop: '2px' }}>
                  {schoolCredit.remaining.toLocaleString()} / {schoolCredit.total.toLocaleString()}
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, marginLeft: '6px', opacity: 0.75 }}>남음</span>
                </div>
              )}
              {/* 줄 3: 진행 바 */}
              {creditState !== 'na' && (
                <div style={{
                  marginLeft: '74px',
                  marginTop: '4px',
                  height: '6px',
                  borderRadius: '999px',
                  background: '#E2E8F0',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, creditUsedRatio))}%`,
                    background: creditColor,
                    borderRadius: '999px',
                    transition: 'width 0.2s, background 0.2s',
                  }} />
                </div>
              )}
              {/* 줄 4: 사용 %  ↔  충전 예정일 (양쪽 정렬) */}
              {creditState !== 'na' && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#64748B',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 600,
                  paddingLeft: '74px',
                  marginTop: '2px',
                }}>
                  <span>{creditUsedRatioLabel}% 사용</span>
                  {creditRefillDate && (
                    <span>🔄 충전 예정 {creditRefillDate}</span>
                  )}
                </div>
              )}
              {/* 줄 5: 보조 안내 */}
              {creditState !== 'na' && (
                <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.5, paddingLeft: '74px', marginTop: '2px' }}>
                  학교 전체에 해당되는 정보이며 소속 교사 모두 동일한 내용을 봅니다. AI 호출(과제 생성·채점·재채점·과정 분석) 시 차감됩니다.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              style={{
                ...inputStyle,
                borderColor: !passwordValid && password.length > 0 ? '#EF4444' : '#E2E8F0',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)',
              }}
            >{showPassword ? '🙈' : '👁'}</button>
          </div>
          <div style={{ color: !passwordValid && password.length > 0 ? '#EF4444' : '#94A3B8', fontSize: 'var(--neo-font-size-sm)', marginBottom: '12px' }}>
            {!passwordValid && password.length > 0
              ? '비밀번호 형식이 올바르지 않습니다 (영어로 시작하는 8~30자 대소문자·숫자·특수문자 조합)'
              : '영어로 시작하는 8~30자리 대소문자, 숫자, 특수문자 조합'}
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type={showPasswordConfirm ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 확인"
              style={{
                ...inputStyle,
                borderColor: !passwordMatch && passwordConfirm.length > 0 ? '#EF4444' : '#E2E8F0',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)',
              }}
            >{showPasswordConfirm ? '🙈' : '👁'}</button>
          </div>
          {!passwordMatch && passwordConfirm.length > 0 && (
            <div style={{ color: '#EF4444', fontSize: 'var(--neo-font-size-sm)', marginTop: '6px' }}>
              비밀번호가 일치하지 않습니다.
            </div>
          )}
        </div>

        {/* 약관 동의 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: '12px' }}>약관 동의</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>
              <input
                type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2A75F3' }}
              />
              <span><span style={{ color: '#EF4444', fontWeight: 700 }}>(필수)</span> 이용약관에 동의합니다. <span style={{ color: '#94A3B8' }}>(26.03.04)</span></span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>
              <input
                type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2A75F3' }}
              />
              <span><span style={{ color: '#EF4444', fontWeight: 700 }}>(필수)</span> 개인정보 수집 및 이용에 동의합니다. <span style={{ color: '#94A3B8' }}>(26.03.04)</span></span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>
              <input
                type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#2A75F3' }}
              />
              <span><span style={{ color: '#94A3B8', fontWeight: 700 }}>(선택)</span> 이벤트, 서비스 안내수신에 동의합니다. <span style={{ color: '#94A3B8' }}>(26.03.04)</span></span>
              <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>›</span>
            </label>
          </div>
          {(!agreeTerms || !agreePrivacy) && (
            <div style={{ color: '#EF4444', fontSize: 'var(--neo-font-size-sm)', marginTop: '8px' }}>
              필수 약관 미동의
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: '#E2E8F0', color: '#1E293B', fontWeight: 700, fontSize: 'var(--neo-font-size-base)',
            }}
          >취소</button>
          <button
            onClick={handleSubmit}
            disabled={!submitEnabled}
            style={{
              padding: '14px', borderRadius: '10px', border: 'none',
              cursor: submitEnabled ? 'pointer' : 'not-allowed',
              background: submitEnabled ? '#2A75F3' : '#CBD5E1',
              color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)',
            }}
          >수정완료</button>
        </div>

        {/* 회원 탈퇴 안내 박스 */}
        <div style={{
          background: '#F1F5F9', borderRadius: '12px', padding: '16px 20px',
          border: '1px solid #E2E8F0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--neo-font-size-lg)' }}>💡</span>
            <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)', color: '#1E2225' }}>회원 탈퇴 문의</span>
          </div>
          <p style={{ color: '#64748B', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.55, margin: '0 0 8px' }}>
            회원 탈퇴 문의는 고객센터로 문의 주시면 처리 가능합니다.
          </p>
          <a href="#" style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, textDecoration: 'underline' }}>
            고객센터 바로가기 ›
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#10B981' : '#EF4444',
          color: 'white', padding: '12px 24px', borderRadius: '10px', fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 9999,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default MyInfo;
