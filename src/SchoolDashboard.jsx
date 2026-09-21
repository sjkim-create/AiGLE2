/**
 * SchoolDashboard.jsx [DSH-03 v1.0]
 * 학교 관리자 대시보드 — 학교 단위 학생·교사·과제·채점 활동 한눈 파악
 * - 헤더: 「내 서비스 기간」 + 「데이터 학년」 분리 (DSH-02와 동일 패턴)
 * - 운영 KPI 카드 4종 + 공지사항 + 단계별 진행 + 학년별 진행 + 교사 활동도 + 학생 학습 분포 + 그룹 과제 점수 분포
 */
import React, { useState, useMemo } from 'react';

const SchoolDashboard = ({ onNavigate }) => {
  // [v1.0] 본인 계약 기간 + 데이터 학년 분리 (MY-01과 동일 source)
  const myInfo = {
    schoolName: '충남 중학교',
    tier: 'paid',
    contractAt: '2025.03.01',
    createdAt: '2025.03.01',
  };
  const computeServicePeriod = () => {
    if (myInfo.tier === 'paid') {
      const [y, m, d] = myInfo.contractAt.split('.').map(Number);
      const end = new Date(y + 1, m - 1, d - 1);
      const ey = end.getFullYear(), em = String(end.getMonth() + 1).padStart(2, '0'), ed = String(end.getDate()).padStart(2, '0');
      return { label: `${myInfo.contractAt} ~ ${ey}.${em}.${ed} (1년 계약)`, daysLeft: null };
    }
    const [y, m, d] = myInfo.createdAt.split('.').map(Number);
    const end = new Date(y, m - 1, d + 13);
    const today = new Date(2025, 10, 26); // mock 오늘 (2025-11-26)
    const daysLeft = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
    const ey = end.getFullYear(), em = String(end.getMonth() + 1).padStart(2, '0'), ed = String(end.getDate()).padStart(2, '0');
    return { label: `${myInfo.createdAt} ~ ${ey}.${em}.${ed} (14일 trial · 만료 D-${daysLeft})`, daysLeft };
  };
  const servicePeriodInfo = computeServicePeriod();
  const dataYear = '2025학년도';
  const dataYearRange = '2025.03 ~ 2026.02';

  // 운영 KPI mock — 진행중인 과제를 좌측 우선 배치
  const kpiCards = [
    { id: 'tasks', icon: '📋', label: '진행중인 과제', sub: '현재 진행 중', value: 8, unit: '개', subValue: '전체 누적 47개', color: '#F59E0B', target: '과제 관리' },
    { id: 'students', icon: '👥', label: '등록된 학생', sub: '전체 학생 수', value: 320, unit: '명', subValue: '활성 285 / 휴면 35', color: '#10B981', target: '학생 관리' },
    { id: 'teachers', icon: '👨‍🏫', label: '등록된 교사', sub: '전체 교사 수', value: 25, unit: '명', subValue: '유료 22 / 무료 3', color: '#2A75F3', target: '교사 관리' },
    { id: 'groups', icon: '🏫', label: '등록된 그룹', sub: '학급 수', value: 12, unit: '개', subValue: '1학년 4 / 2학년 4 / 3학년 4', color: '#FACC15', target: '그룹 관리' },
  ];

  // 공지사항 mock
  const notices = [
    { important: true, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23' },
    { important: false, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23' },
    { important: true, title: '2025학년도 1학기 중간고사 안내', date: '2025. 10. 23' },
  ];

  // 학년별 과제 진행현황 mock (stacked bar) — 학년별 raw count, 「전체」는 학년별 합으로 derive, 렌더 시 100% 정규화
  const gradeProgress = [
    { grade: '1학년', 미채점: 38, 채점확인: 79, 결과발송완료: 58 },
    { grade: '2학년', 미채점: 52, 채점확인: 64, 결과발송완료: 41 },
    { grade: '3학년', 미채점: 44, 채점확인: 71, 결과발송완료: 32 },
  ];

  // 교사별 활동도 mock (Top 10) — 모두 과제 단위 (grading ≤ creation, 자신이 만든 과제만 채점)
  const teacherActivity = [
    { name: '김민수', creation: 28, grading: 26 },
    { name: '이지은', creation: 24, grading: 22 },
    { name: '박서윤', creation: 22, grading: 19 },
    { name: '정현우', creation: 20, grading: 17 },
    { name: '최예린', creation: 18, grading: 14 },
    { name: '강도현', creation: 16, grading: 13 },
    { name: '윤소희', creation: 14, grading: 11 },
    { name: '오민재', creation: 12, grading: 9 },
    { name: '한가람', creation: 10, grading: 7 },
    { name: '서지우', creation: 8, grading: 5 },
  ];
  const maxActivity = Math.max(...teacherActivity.map(t => t.creation + t.grading));

  // [v1.0] 그룹 과제 점수 분포표 mock
  const [scoreGrade, setScoreGrade] = useState(1);   // 1·2·3학년
  const [scoreSubject, setScoreSubject] = useState('국어');
  const [hoverCell, setHoverCell] = useState(null);  // {row, col}
  const scoreGroups = ['1-1반', '1-2반', '1-3반', '1-4반'];
  const scoreLevels = [
    { name: '매우 우수', color: '#1D4ED8' },
    { name: '우수',      color: '#2A75F3' },
    { name: '보통',      color: '#60A5FA' },
    { name: '노력',      color: '#93C5FD' },
    { name: '매우 노력', color: '#DBEAFE' },
  ];
  // 각 학급의 등급별 학생 수 (비율 + 인원)
  const scoreMatrix = [
    // 1-1반: 매우우수 0, 우수 3, 보통 5, 노력 2, 매우노력 0 (총 10명)
    [{ ratio: 0, count: 0 },  { ratio: 30, count: 3 }, { ratio: 50, count: 5 }, { ratio: 20, count: 2 }, { ratio: 0, count: 0 }],
    // 1-2반: 매우우수 1, 우수 3, 보통 3, 노력 2, 매우노력 1 (총 10명)
    [{ ratio: 10, count: 1 }, { ratio: 30, count: 3 }, { ratio: 30, count: 3 }, { ratio: 20, count: 2 }, { ratio: 10, count: 1 }],
    // 1-3반: 매우우수 3, 우수 3, 보통 4, 노력 0, 매우노력 0 (총 10명)
    [{ ratio: 30, count: 3 }, { ratio: 30, count: 3 }, { ratio: 40, count: 4 }, { ratio: 0, count: 0 },  { ratio: 0, count: 0 }],
    // 1-4반: 매우우수 1, 우수 2, 보통 4, 노력 2, 매우노력 1 (총 10명)
    [{ ratio: 10, count: 1 }, { ratio: 20, count: 2 }, { ratio: 40, count: 4 }, { ratio: 20, count: 2 }, { ratio: 10, count: 1 }],
  ];
  // 학생명 mock (셀 hover 시 노출용)
  const studentNamesByCell = {
    '0-1': ['김민준', '이서연', '박지호'],   // 1-1반·우수
    '0-2': ['최유진', '강도윤', '윤하은', '서지우', '정예린'],
    '1-2': ['오시현', '한가은', '김도현'],
    '2-0': ['윤예준', '박지우', '최수빈'],   // 1-3반·매우우수
  };

  return (
    <div style={{ padding: '2rem', background: '#F4F7FB', minHeight: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900 }}>대시보드</h1>
      </div>

      {/* Main Banner — [v1.0] 「내 서비스 기간」 + 「데이터 학년」 분리 */}
      <div style={{ background: 'linear-gradient(135deg, #4299E1 0%, #3182CE 100%)', borderRadius: '24px', padding: '2.5rem', color: 'white', marginBottom: '1.5rem', position: 'relative', boxShadow: '0 10px 25px rgba(49, 130, 206, 0.2)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>2025년 11월 26일</h2>
        <p style={{ fontSize: 'var(--neo-font-size-lg)', opacity: 0.9, marginBottom: '1.5rem' }}>과제관리, 채점현황, 통계분석을 한눈에 확인하세요.</p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--neo-font-size-sm)' }}>📅 내 구독 기간 : </span>
            <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>{servicePeriodInfo.label}</span>
            {servicePeriodInfo.daysLeft !== null && servicePeriodInfo.daysLeft <= 7 && (
              <span style={{ background: '#F59E0B', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, marginLeft: '6px' }}>
                ⚠️ 만료 임박
              </span>
            )}
          </div>
        </div>

        <div style={{ background: 'rgba(254, 243, 199, 0.95)', border: '1.5px solid #FBBF24', borderRadius: '12px', padding: '12px 16px', color: '#78350F', maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: 'var(--neo-font-size-lg)', flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.55 }}>
              <strong style={{ fontWeight: 800, marginRight: '6px' }}>데이터 기준 학년도: {dataYear}</strong>
              <span style={{ fontWeight: 600, color: '#92400E' }}>({dataYearRange})</span>
              <div style={{ marginTop: '4px', fontWeight: 500 }}>
                본 대시보드의 학생·채점 데이터는 {dataYear}만 반영됩니다. 학년 종료 시 학생·채점 데이터는 자동 초기화되며, 과제는 영구 보존되어 다음 학년도에도 재활용됩니다.
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: 'var(--neo-font-size-xl)', fontWeight: 800 }}>
          🏫 {myInfo.schoolName}
        </div>
      </div>

      {/* 운영 KPI 카드 4종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpiCards.map(c => (
          <div key={c.id} onClick={() => onNavigate && onNavigate(c.target)}
            style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(15,23,42,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(15,23,42,0.04)'; }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              {c.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{c.sub}</span>
                <span style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, color: c.color }}>{c.value}</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>{c.unit}</span>
              </div>
              <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{c.subValue}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 공지사항 */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>공지사항 ›</h3>
          <button style={{ padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>+ 새 공지</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notices.map((n, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '12px', borderBottom: i < notices.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {n.important && <span style={{ background: '#EF4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>중요</span>}
                <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 600, color: '#1E2225' }}>{n.title}</span>
              </div>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>{n.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 학년별 과제 진행현황 + 교사별 활동도 (좌우 2분할) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
      {/* 좌 — 학년별 과제 진행현황 (전체 + 학년별 통합) */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '0.25rem' }}>학년별 과제 진행현황</h3>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginBottom: '1rem' }}>전체 + 학년별로 서·논술 채점 서비스의 이용 현황을 확인할 수 있습니다.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px', fontSize: 'var(--neo-font-size-sm)' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#F59E0B', marginRight: 4, verticalAlign: 'middle' }}></span>미채점</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#FACC15', marginRight: 4, verticalAlign: 'middle' }}></span>채점확인</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', marginRight: 4, verticalAlign: 'middle' }}></span>결과발송 완료</span>
        </div>
        {/* 가로 stacked bar — 「전체」 row + 학년별 row, 각 row 100% 정규화 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 4px' }}>
          {(() => {
            // 「전체」 row = 학년별 합산
            const totalRow = {
              grade: '전체',
              미채점: gradeProgress.reduce((s, g) => s + g.미채점, 0),
              채점확인: gradeProgress.reduce((s, g) => s + g.채점확인, 0),
              결과발송완료: gradeProgress.reduce((s, g) => s + g.결과발송완료, 0),
            };
            return [totalRow, ...gradeProgress].map((g, i) => {
              const isTotal = g.grade === '전체';
              const total = g.미채점 + g.채점확인 + g.결과발송완료;
              const p1 = (g.미채점 / total) * 100;
              const p2 = (g.채점확인 / total) * 100;
              const p3 = (g.결과발송완료 / total) * 100;
              return (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '52px', fontSize: 'var(--neo-font-size-sm)', fontWeight: isTotal ? 900 : 700, color: isTotal ? '#1D4ED8' : '#1E2225' }}>{g.grade}</span>
                    <div style={{ flex: 1, height: isTotal ? '32px' : '28px', borderRadius: '6px', overflow: 'hidden', display: 'flex', background: '#F8FAFC' }}>
                      <div style={{ width: `${p1}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: 'white' }}>
                        {p1 >= 10 ? `${Math.round(p1)}%` : ''}
                      </div>
                      <div style={{ width: `${p2}%`, background: '#FACC15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>
                        {p2 >= 10 ? `${Math.round(p2)}%` : ''}
                      </div>
                      <div style={{ width: `${p3}%`, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: 'white' }}>
                        {p3 >= 10 ? `${Math.round(p3)}%` : ''}
                      </div>
                    </div>
                    <span style={{ width: '60px', fontSize: 'var(--neo-font-size-sm)', fontWeight: isTotal ? 900 : 700, color: isTotal ? '#1D4ED8' : '#475569', textAlign: 'right' }}>{total}건</span>
                  </div>
                  {isTotal && <div style={{ height: '1px', background: '#E2E8F0', margin: '2px 0' }} />}
                </React.Fragment>
              );
            });
          })()}
        </div>
      </div>

      {/* 우 — 교사별 활동도 Top 10 */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '0.25rem' }}>👨‍🏫 교사별 활동도 (Top 10)</h3>
        <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginBottom: '1rem' }}>과제 생성·채점 활동이 활발한 교사 Top 10. (단위: 과제 수, 채점 ≤ 생성)</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '8px', fontSize: 'var(--neo-font-size-sm)' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2A75F3', marginRight: 4, verticalAlign: 'middle' }}></span>과제 생성</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', marginRight: 4, verticalAlign: 'middle' }}></span>채점 활동</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {teacherActivity.map((t, i) => {
            const total = t.creation + t.grading;
            const w = (total / maxActivity) * 100;
            const cw = (t.creation / total) * w;
            const gw = (t.grading / total) * w;
            return (
              <div key={i}
                onClick={() => onNavigate && onNavigate('교사 관리')}
                title={`${t.name} — 생성 ${t.creation}건 / 채점 완료 ${t.grading}건 (합계 ${total}건)`}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              >
                <span style={{ width: '20px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', textAlign: 'right' }}>{i + 1}.</span>
                <span style={{ width: '60px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225' }}>{t.name}</span>
                <div style={{ flex: 1, height: '20px', background: '#F8FAFC', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: `${cw}%`, background: '#2A75F3' }}></div>
                  <div style={{ width: `${gw}%`, background: '#10B981' }}></div>
                </div>
                <span style={{ width: '50px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', textAlign: 'right' }}>{total}건</span>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* 그룹 과제 개인 점수 분포표 — 5등급 × N학급 매트릭스 (DSH-03 v1.0) */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '0.25rem' }}>그룹 과제 개인 점수 분포표</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>그룹(학급)별로 학생 개인의 점수 분포를 확인할 수 있습니다.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={scoreGrade} onChange={(e) => setScoreGrade(Number(e.target.value))}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', background: 'white', cursor: 'pointer' }}>
              <option value={1}>1학년</option>
              <option value={2}>2학년</option>
              <option value={3}>3학년</option>
            </select>
            <select value={scoreSubject} onChange={(e) => setScoreSubject(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', background: 'white', cursor: 'pointer' }}>
              {['국어', '수학', '영어', '사회', '과학'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 매트릭스 */}
        <div style={{ position: 'relative', overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
            <thead>
              <tr>
                <th style={{ width: '90px', padding: '10px 8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', textAlign: 'left' }}>등급</th>
                {scoreGroups.map(g => (
                  <th key={g} style={{ padding: '10px 8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', textAlign: 'center' }}>{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoreLevels.map((lvl, li) => (
                <tr key={li}>
                  <td style={{ padding: '10px 8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>{lvl.name}</td>
                  {scoreGroups.map((g, gi) => {
                    const cell = scoreMatrix[gi][li];
                    const intensity = cell.ratio / 50; // 50%가 max로 가정
                    const opacity = Math.min(0.15 + intensity * 0.7, 0.95);
                    const cellKey = `${gi}-${li}`;
                    const studentNames = studentNamesByCell[cellKey] || [];
                    const isHovered = hoverCell && hoverCell.row === li && hoverCell.col === gi;
                    return (
                      <td key={gi}
                        onMouseEnter={() => cell.count > 0 && setHoverCell({ row: li, col: gi })}
                        onMouseLeave={() => setHoverCell(null)}
                        style={{
                          padding: '14px 10px',
                          fontSize: 'var(--neo-font-size-sm)',
                          fontWeight: 700,
                          textAlign: 'center',
                          background: cell.count === 0 ? '#F8FAFC' : `rgba(42, 117, 243, ${opacity})`,
                          color: opacity > 0.5 ? 'white' : '#1E2225',
                          borderRadius: '8px',
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                          position: 'relative',
                          border: isHovered ? '2px solid #1D4ED8' : '2px solid transparent',
                          transition: 'border 0.12s',
                        }}
                      >
                        {cell.ratio}% ({cell.count}명)
                        {/* hover popover */}
                        {isHovered && studentNames.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            boxShadow: '0 6px 16px rgba(15,23,42,0.12)',
                            zIndex: 10,
                            minWidth: '160px',
                            color: '#1E2225',
                          }}>
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1D4ED8', marginBottom: '6px', textAlign: 'left' }}>
                              {scoreGroups[gi]} · {scoreLevels[li].name}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                              {studentNames.map((name, ni) => (
                                <span key={ni} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 600 }}>· {name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                {scoreGroups.map((g, gi) => {
                  const total = scoreMatrix[gi].reduce((s, c) => s + c.count, 0);
                  return (
                    <td key={gi} style={{ padding: '10px 8px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', textAlign: 'center' }}>
                      ({total}명)
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', marginTop: '8px', textAlign: 'center' }}>
            ※ 셀에 마우스를 올리면 해당 학급·등급 학생 명단이 표시됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboard;
