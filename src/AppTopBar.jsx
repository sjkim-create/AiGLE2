/**
 * AppTopBar.jsx
 * [상용 헤더 정렬] 화면 우측 상단 공용 유틸리티 바.
 *
 *   舊: 교사 정보가 좌측 사이드바 맨 위에 있었고, 이용 가이드·동의서는 사이드바 하단 링크,
 *       환경설정은 프로필 드롭다운 안에 숨어 있었다. 메뉴(무엇을 하는가)와 계정·도움말(누구인가/어떻게 쓰는가)이
 *       한 기둥에 섞여 있어, 사이드바를 훑어야 계정을 찾는 구조였다.
 *   현: 계정과 보조 기능을 **상단 우측 한 줄**로 모은다. 왼쪽부터
 *       🖊 펜 · ❓ 도움말 · 🌐 언어 · ⚙️ 환경설정 · 프로필(이름/메일).
 *
 * 각 아이콘은 드롭다운을 열고, 환경설정만 바로 이동한다.
 */
import React, { useState, useEffect, useRef } from 'react';

const ITEM = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', fontWeight: 600,
  textAlign: 'left', whiteSpace: 'nowrap',
};

const AppTopBar = ({
  teacherName = '김교사 선생님',
  teacherEmail = 'neolab@neolab.com',
  settingsBadgeCount = 0,
  onNavigate,          // (menu) => void — 본 화면 메뉴로 이동
  onGoSettings,        // (settingsMenu) => void — 환경설정 모드로 이동
  onOpenPenReset,      // () => void — 환경설정 > 펜 데이터 초기화 열기
  showToast,
}) => {
  const [open, setOpen] = useState(null); // 'pen' | 'help' | 'lang' | 'profile' | null
  const [lang, setLang] = useState('ko');
  const barRef = useRef(null);

  /* 바깥을 누르거나 ESC 를 누르면 닫는다 — 드롭다운이 여러 개라 한 곳에서 관리한다 */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = (key) => setOpen((prev) => (prev === key ? null : key));
  const pick = (fn) => { setOpen(null); fn && fn(); };
  const toast = (msg, tone = 'info') => showToast && showToast(msg, tone);

  const iconBtn = (key, icon, label, onClick, dot = false) => (
    <button type="button" title={label} aria-label={label} aria-haspopup={key ? 'menu' : undefined} aria-expanded={key ? open === key : undefined}
      onClick={onClick || (() => toggle(key))}
      style={{
        position: 'relative', width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
        border: 'none', background: open === key ? '#EFF6FF' : 'transparent',
        fontSize: 'var(--neo-font-size-base)', lineHeight: 1, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {icon}
      {dot && <span aria-hidden style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: 999, background: '#EF4444', boxShadow: '0 0 0 2px white' }} />}
    </button>
  );

  const menu = (children, width = 200) => (
    <div role="menu" style={{
      position: 'absolute', top: 'calc(100% + 6px)', right: 0, width, zIndex: 80,
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
      boxShadow: '0 12px 28px rgba(15,23,42,0.14)', padding: '5px 0', overflow: 'hidden',
    }}>{children}</div>
  );

  const menuItem = (label, onClick, extra = null) => (
    <button type="button" role="menuitem" onClick={() => pick(onClick)} style={ITEM}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
      <span style={{ flex: 1 }}>{label}</span>
      {extra}
    </button>
  );

  return (
    <div ref={barRef} className="app-topbar" style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
      padding: '8px 20px', borderBottom: '1px solid #F1F5F9', background: 'white',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
    }}>
      {/* ① 펜 — 스마트펜 모니터링 · 펜 초기화 */}
      <div style={{ position: 'relative' }}>
        {iconBtn('pen', '🖊', '스마트펜')}
        {open === 'pen' && menu(
          <>
            {menuItem('스마트펜 모니터링', () => onNavigate && onNavigate('스마트펜 모니터링'))}
            {menuItem('펜 초기화', () => onOpenPenReset && onOpenPenReset())}
          </>
        )}
      </div>

      {/* ② 도움말 — 이용 가이드 · 동의서 (舊 사이드바 하단 링크) */}
      <div style={{ position: 'relative' }}>
        {iconBtn('help', '❓', '도움말')}
        {open === 'help' && menu(
          <>
            {menuItem('학생 이용 가이드', () => toast('학생 이용 가이드는 준비 중입니다.'))}
            {menuItem('교사 이용 가이드', () => toast('교사 이용 가이드는 준비 중입니다.'))}
            {menuItem('개인정보수집 이용 동의서', () => toast('개인정보수집 이용 동의서는 준비 중입니다.'))}
          </>, 220
        )}
      </div>

      {/* ③ 언어 */}
      <div style={{ position: 'relative' }}>
        {iconBtn('lang', '🌐', '언어')}
        {open === 'lang' && menu(
          <>
            {menuItem('한국어', () => { setLang('ko'); toast('언어를 한국어로 설정했습니다.'); },
              lang === 'ko' ? <span style={{ color: '#2A75F3', fontWeight: 800 }}>✓</span> : null)}
            {menuItem('영어', () => toast('영어 화면은 준비 중입니다. 한국어로 유지합니다.'),
              lang === 'en' ? <span style={{ color: '#2A75F3', fontWeight: 800 }}>✓</span> : null)}
          </>, 160
        )}
      </div>

      {/* ④ 환경설정 — 드롭다운 없이 바로 이동. 설정이 필요하면 빨간 점 */}
      {iconBtn(null, '⚙️', '환경설정', () => { setOpen(null); onGoSettings && onGoSettings('환경설정'); }, settingsBadgeCount > 0)}

      {/* ⑤ 프로필 — 누르면 로그아웃 */}
      <div style={{ position: 'relative', marginLeft: 8 }}>
        <button type="button" onClick={() => toggle('profile')} aria-haspopup="menu" aria-expanded={open === 'profile'}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 4px 4px', borderRadius: 10,
            border: 'none', background: open === 'profile' ? '#EFF6FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <span aria-hidden style={{
            width: 32, height: 32, borderRadius: 999, background: '#DBEAFE', color: '#1D4ED8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-base)', flexShrink: 0,
          }}>👤</span>
          <span style={{ textAlign: 'left', lineHeight: 1.3 }}>
            <span style={{ display: 'block', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', whiteSpace: 'nowrap' }}>{teacherName}</span>
            <span style={{ display: 'block', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', whiteSpace: 'nowrap' }}>{teacherEmail}</span>
          </span>
        </button>
        {open === 'profile' && menu(
          menuItem('로그아웃', () => toast('로그아웃되었습니다. (프로토타입)'),
            <span aria-hidden>↪</span>), 170
        )}
      </div>
    </div>
  );
};

export default AppTopBar;
