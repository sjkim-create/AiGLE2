/**
 * appVersion.js — 프로토 버전 트리거 (2.3 / 2.4) + 2.4 사용자 모드
 *
 * 한 코드베이스에서 버전별로 보이는 메뉴를 나눈다. 화면 코드를 복사하지 않고,
 * 「이 버전에서 빠지는 메뉴」만 여기 한 곳에 적는다.
 *
 *   선택 우선순위: URL `?v=2.4` > localStorage > 기본값(2.3)
 *   상단 바의 버전 칩으로 바꾸면 URL·localStorage가 함께 바뀐다 — 링크를 그대로 공유하면 같은 버전이 열린다.
 *
 * 2.4는 사용자 모드(시스템 관리자 · 교사 · 학교 · 교육청 · 학생)별로 메뉴가 다르다 — ROLES.
 *   모드도 URL `?role=teacher` > localStorage > 기본값(시스템 관리자) 순으로 정한다.
 *
 * 다음 버전에서 메뉴를 더 빼려면 REMOVED 에 항목만 추가한다.
 */

export const APP_VERSIONS = ['2.3', '2.4'];
export const DEFAULT_VERSION = '2.3';
const STORAGE_KEY = 'aigle:appVersion';
const ROLE_STORAGE_KEY = 'aigle:appRole';

/* 버전별 삭제 목록
 *   menus — 상위 메뉴 통째로 숨김
 *   subs  — { 상위 메뉴: [숨길 하위 메뉴] } */
const REMOVED = {
  '2.4': {
    menus: ['스마트펜 모니터링', '화면 명세서', '아이글 채점 테스트'],
    subs: {
      // 이전 메뉴 = 🕘 이전 메뉴 (history) · 공유된 과제 → 2.4는 교육청 문제 은행 (TSK-16)
      // 서·논술형 과제 → 문제집 목록에 함께 (2026-10-29) · 교육청 문제 은행(교사)은 따로 관리 — 메뉴 복구 (TSK-16 v1.4)
      '과제 관리': ['과제 관리', '이전 메뉴', '공유된 과제', '서·논술형 과제'],
      '채점 관리': ['채점 관리'],
    },
  },
  // 2.3 — 교육청 문제 은행 없음 · 공유된 과제는 메뉴에서 숨김(2026-10-29, 기능 코드는 그대로)
  '2.3': {
    menus: ['교육청 문제 은행'],
    subs: { '과제 관리': ['공유된 과제', '교육청 문제 은행'] },
  },
};

/* 버전별 신규 하위 메뉴 — 그 버전에서만 보인다 (2.3은 그대로 둔다)
 *   게시판 › Q&A는 2.3에서도 보이도록 여기서 뺐다(2026-10-19 — 2.3 게시판 Q&A 누락)
 *   과제 관리 › 서·논술형 과제 · 정답형 과제 · 교육청 문제 은행은 2.4 전용 — 2.3은 「과제 관리」만 (2026-10-29) */
const ADDED = {
  '2.4': { subs: { '과제 관리': ['서·논술형 과제', '정답형 과제', '정답형 문제집', '정답형 낱말 문제집', '교육청 문제 은행'] } },
};

/* [2.3·2.4] 사용자 모드별 메뉴 — 두 버전 모두 모드로 나눈다 (2.3은 2026-10-29부터)
 *   2.3에만 있는 메뉴: 스마트펜 모니터링 → 교사 · 화면 명세서 · 아이글 채점 테스트 → 시스템 관리자 (2.4에서는 REMOVED로 빠진다)
 *   menus — { 상위 메뉴: 허용 하위 메뉴 배열 | null(전부) }
 *   등록 화면(교사 등록·학생 등록)은 사이드바에 없지만 목록의 [+ 등록]으로 들어가므로 함께 허용한다.
 *   home  — 모드 진입·로고 클릭 시 열 화면
 *   drill — 사이드바에는 없지만 화면 안에서 눌러 들어갈 수 있는 메뉴 (교육청 대시보드 → 학교 대시보드) */
export const ROLES = {
  admin: {
    label: '시스템 관리자', home: { menu: '대시보드', sub: '채점 관리' },
    menus: {
      '대시보드': null,
      '회원 관리': ['교사 관리', '학교 관리', '교사 등록'],
      '교육청 문제 은행': null,   // 2.4 — 교육청 문제 등록 (TSK-16)
      '게시판': ['공지사항', '장애신고', 'Q&A'],
      '화면 명세서': null,        // 2.3 전용 (운영·기획 도구)
      '아이글 채점 테스트': null, // 2.3 전용 (운영·기획 도구)
    },
  },
  teacher: {
    label: '교사', home: { menu: '교사 대시보드', sub: '채점 관리' },
    menus: {
      '교사 대시보드': null,
      '회원 관리': ['학생 관리', '그룹 관리', '학생 등록'],
      '과제 관리': null,
      '채점 관리': null,
      '게시판': ['공지사항'],
      '스마트펜 모니터링': null,  // 2.3 전용 — 교사가 수업 중 펜 상태를 본다
    },
  },
  school: {
    label: '학교', home: { menu: '학교 대시보드', sub: '채점 관리' },
    menus: {
      '학교 대시보드': null,
      '회원 관리': ['학생 관리', '교사관리(학교모드)', '학생 등록', '교사 등록'],
      '게시판': ['공지사항'],
    },
  },
  edu: {
    label: '교육청', home: { menu: '교육청 대시보드', sub: '채점 관리' },
    menus: { '교육청 대시보드': null },
    drill: ['학교 대시보드'], // 과목별 AI 채점 비중 → 학교 목록 → 학교 대시보드
  },
  student: {
    label: '학생', home: { menu: '학생 모드', sub: '내 과제' },
    menus: { '학생 모드': ['내 과제'] },
  },
};
export const ROLE_KEYS = Object.keys(ROLES);
export const DEFAULT_ROLE = 'admin';

/* 사이드바 하위 메뉴 순서 — 기본 하위 메뉴가 숨겨졌을 때 다음으로 보이는 항목을 고른다 */
const SUB_ORDER = {
  '회원 관리': ['교사 관리', '교사관리(학교모드)', '학교 관리', '학생 관리', '그룹 관리'],
  '과제 관리': ['과제 관리', '서·논술형 과제', '정답형 과제', '교육청 문제 은행', '공유된 과제'],
  '채점 관리': ['채점 관리', '채점 관리 2', '일괄 채점 통합'],
  '게시판': ['공지사항', '장애신고', 'Q&A'],
};

/* 모드는 2.3 · 2.4 모두 적용 (버전별로 빠지는 메뉴는 REMOVED가 먼저 거른다) */
const roleOf = (version, role) => ROLES[role] || ROLES[DEFAULT_ROLE];
const menuKey = (menu) => (menu === '학생' ? '회원 관리' : menu); // 해시 라우트의 옛 메뉴명 「학생」 = 회원 관리

export const isMenuVisible = (version, menu, role) => {
  if ((REMOVED[version]?.menus || []).includes(menu)) return false;
  const r = roleOf(version, role);
  return !r || menuKey(menu) in r.menus;
};

/** 화면에 머물러도 되는가 — 사이드바 메뉴 + 화면 안에서 들어가는 메뉴(drill) */
export const isMenuAllowed = (version, menu, role) =>
  isMenuVisible(version, menu, role) || (roleOf(version, role)?.drill || []).includes(menuKey(menu));

export const isSubVisible = (version, menu, sub, role) => {
  if ((REMOVED[version]?.subs?.[menu] || []).includes(sub)) return false;
  if (Object.entries(ADDED).some(([v, a]) => v !== version && (a.subs?.[menu] || []).includes(sub))) return false;
  const r = roleOf(version, role);
  if (!r) return true;
  if ((r.drill || []).includes(menuKey(menu))) return true;
  const allowed = r.menus[menuKey(menu)];
  return allowed === undefined ? false : allowed === null || allowed.includes(sub);
};

/** 상위 메뉴를 눌렀을 때 열 하위 메뉴 — 원래 기본값이 숨겨졌으면 다음 보이는 항목 */
export const firstVisibleSub = (version, menu, preferred, role) => {
  if (isSubVisible(version, menu, preferred, role)) return preferred;
  return (SUB_ORDER[menuKey(menu)] || []).find((s) => isSubVisible(version, menu, s, role)) || preferred;
};

/** 모드의 첫 화면 */
export const homeOf = (version, role) =>
  roleOf(version, role)?.home || { menu: '대시보드', sub: '채점 관리' };

const readChoice = (param, key, valid, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const fromUrl = new URLSearchParams(window.location.search).get(param);
  if (valid.includes(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(key);
    if (valid.includes(saved)) return saved;
  } catch { /* 저장소 차단 환경 — 기본값 */ }
  return fallback;
};

const writeChoice = (param, key, value) => {
  try { window.localStorage.setItem(key, value); } catch { /* 무시 */ }
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
};

export const getInitialVersion = () => readChoice('v', STORAGE_KEY, APP_VERSIONS, DEFAULT_VERSION);
export const getInitialRole = () => readChoice('role', ROLE_STORAGE_KEY, ROLE_KEYS, DEFAULT_ROLE);

/** 버전 저장 — localStorage + URL `?v=` (해시는 유지) */
export const persistVersion = (version) => writeChoice('v', STORAGE_KEY, version);
/** 모드 저장 — localStorage + URL `?role=` */
export const persistRole = (role) => writeChoice('role', ROLE_STORAGE_KEY, role);
