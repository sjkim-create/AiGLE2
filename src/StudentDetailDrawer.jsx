import React, { useState, useEffect } from 'react';
import './index.css';

/**
 * StudentDetailDrawer
 * 학생 상세 드로어 — 두 개 탭으로 구성:
 *   📋 기본 정보 — 계정·소속·비번 초기화
 *   📈 학습 추이 — 시계열 점수·강약점·채점 history·피드백·보충 과제 (v2.x 신규)
 *
 * student prop은 STU-01 list/TeacherDashboard 양쪽에서 호출 가능.
 * trend·areas·gradingHistory·feedbacks 가 없으면 mock 폴백.
 */
const StudentDetailDrawer = ({ isOpen, student, onClose, onNavigate, defaultTab = 'info' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('******');
  const [showReportPreview, setShowReportPreview] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name || '');
      setPassword('******');
      setActiveTab(defaultTab);
    }
  }, [student, defaultTab]);

  if (!student) return null;

  const isDirty = student && name !== student.name;

  const handleClose = () => {
    if (isDirty) {
      const ok = window.confirm('저장하지 않은 변경 사항이 있습니다. 닫으시겠습니까?');
      if (!ok) return;
    }
    onClose();
  };

  const handleSave = () => {
    window.alert('수정되었습니다.');
    onClose();
  };

  const handleReset = () => {
    const ok = window.confirm(`비밀번호를 아이디(${student.id || student.name})와 동일하게 초기화하시겠습니까?`);
    if (!ok) return;
    setPassword(student.id || student.name);
    window.alert('비밀번호가 초기화되었습니다.');
  };

  // ── 학습 추이 mock (student prop에 없으면 폴백; trend는 배열이어야 — 다른 용도의 trend 문자열 필드와 구분) ──
  // area = 핵심평가영역(내용체계) 기준. 수학 예: 수와 연산 / 변화와 관계 / 도형과 측정 / 자료와 가능성 (2022 개정 교육과정)
  const trend = Array.isArray(student.scoreTrend) ? student.scoreTrend : [
    { taskName: '단원1 평가', date: '3월', score: 72, level: '보통',     area: '변화와 관계',  classAvg: 76 },
    { taskName: '단원2 평가', date: '4월', score: 78, level: '우수',     area: '도형과 측정',  classAvg: 75 },
    { taskName: '중간고사 1', date: '4월', score: 80, level: '우수',     area: '수와 연산',    classAvg: 77 },
    { taskName: '단원3 평가', date: '5월', score: 85, level: '매우 우수', area: '변화와 관계',  classAvg: 80 },
  ];
  const areas = Array.isArray(student.areas) ? student.areas : [
    { area: '수와 연산',     score: 80, classAvg: 77 },
    { area: '변화와 관계',   score: 78, classAvg: 76 },
    { area: '도형과 측정',   score: 78, classAvg: 75 },
    { area: '자료와 가능성', score: 65, classAvg: 78 },
  ];
  const gradingHistory = Array.isArray(student.gradingHistory) ? student.gradingHistory : trend.map((t, i) => ({
    id: i + 1,
    taskName: t.taskName,
    date: `26.0${i + 3}.${10 + i * 5}`,
    score: t.score,
    level: t.level,
    area: t.area,
    classAvg: t.classAvg,
    delta: i === 0 ? null : t.score - trend[i - 1].score,
  }));
  // 교사 피드백 누적: 채점 상세의 `이런 점이 좋아요` 섹션 일부 발췌 (긍정 피드백 기록)
  const feedbacks = Array.isArray(student.feedbacks) ? student.feedbacks : [
    {
      date: '26.04.18',
      task: '중간고사 1',
      good: '농도 = (소금의양)/(소금물의 전체양) × 100 공식을 활용하여 실생활 예시를 유리함수 식 y = 100x/(x+50)으로 정확하게 도출해낸 점이 아주 훌륭합니다!',
    },
    {
      date: '26.04.05',
      task: '단원2 평가',
      good: '정삼각형, 정육각형, 정십이각형의 한 내각의 크기를 정확히 구하고, 270°를 채우는 두 가지 조합을 완벽하게 찾아냈어요. 논리적인 설명이 매우 훌륭합니다!',
    },
    {
      date: '26.03.22',
      task: '단원1 평가',
      good: '풀이 과정을 단계별로 정리하여 적은 점이 인상적이었어요. 식의 변형 과정이 매우 깔끔합니다.',
    },
  ];

  // 영역별 색상 코딩
  const diffColor = (diff) => {
    if (diff <= -10) return '#EF4444';
    if (diff <= -5)  return '#F59E0B';
    if (diff >= 5)   return '#10B981';
    return '#94A3B8';
  };

  // 시계열 라인 path
  const max = 100;
  const chartW = 480, chartH = 160;
  const chartX = 30, chartY = 16;
  const buildPath = (points) => {
    if (!points.length) return '';
    return points.map((v, i) => {
      const x = chartX + (i * chartW / Math.max(1, points.length - 1));
      const y = chartY + chartH - (v / max) * chartH;
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
  };

  // 통계
  const avgScore = trend.length ? Math.round(trend.reduce((s, t) => s + t.score, 0) / trend.length) : 0;
  const classAvg = trend.length ? Math.round(trend.reduce((s, t) => s + t.classAvg, 0) / trend.length) : 0;
  const high = trend.length ? Math.max(...trend.map(t => t.score)) : 0;
  const low  = trend.length ? Math.min(...trend.map(t => t.score)) : 0;
  const lastDelta = trend.length >= 2 ? trend[trend.length - 1].score - trend[trend.length - 2].score : 0;

  const tabs = [
    { id: 'info', label: '📋 기본 정보' },
    { id: 'trend', label: '📈 학습 추이' },
  ];

  // 탭별 drawer 너비: 학습 추이는 차트·표 가독성을 위해 더 넓게
  const drawerW = activeTab === 'trend' ? 920 : 660;

  return (
    <>
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={handleClose} />
      <div
        className={`drawer-container ${isOpen ? 'open' : ''}`}
        style={{
          width: `${drawerW}px`,
          maxWidth: '95vw',
          right: `-${drawerW}px`,
          transform: isOpen ? `translateX(-${drawerW}px)` : undefined,
        }}
      >
        <div className="drawer-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h2 className="drawer-title" style={{ margin: 0 }}>{student.name}</h2>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 600 }}>
              {student.gradeInfo || student.className || ''}
            </span>
          </div>
          <button className="drawer-close-btn" onClick={handleClose}>×</button>
        </div>

        {/* 탭 바 */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', padding: '0 24px', background: 'white' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #2A75F3' : '2px solid transparent',
                color: activeTab === t.id ? '#2A75F3' : '#64748B',
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: activeTab === t.id ? 800 : 600,
                cursor: 'pointer',
                marginBottom: '-1px',
              }}>{t.label}</button>
          ))}
        </div>

        <div className="drawer-content">
          {/* === 기본 정보 탭 === */}
          {activeTab === 'info' && (
            <section className="drawer-section">
              <div className="section-title-row">
                <h3 className="section-title-sm">기본 정보</h3>
                <span className="drawer-joined-date-inline">가입일 : {student.joinDate || '-'}</span>
              </div>

              <div className="form-item">
                <label>아이디</label>
                <input type="text" value={student.id || ''} disabled className="input-disabled" />
              </div>

              <div className="grid-2col mt-1">
                <div className="form-item">
                  <label>이름</label>
                  <div className="input-with-clear">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                    {name && <button className="input-clear" onClick={() => setName('')}>×</button>}
                  </div>
                </div>
                <div className="form-item">
                  <label>학년/반/번호</label>
                  <input type="text" value={student.gradeInfo || student.className || ''} disabled className="input-disabled" />
                </div>
              </div>

              <div className="form-item mt-1">
                <label>소속 그룹</label>
                <div>
                  <span className="group-chip">{student.groupName || student.className || '-'}</span>
                </div>
              </div>

              <div className="form-item mt-1">
                <label>비밀번호</label>
                <div className="password-reset-row">
                  <input type="text" value={password} disabled className="input-disabled" />
                  <button className="btn-reset" onClick={handleReset}>초기화</button>
                </div>
              </div>
            </section>
          )}

          {/* === 학습 추이 탭 === */}
          {activeTab === 'trend' && (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. 시계열 추이 라인 */}
              <section>
                <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '4px' }}>📈 시계열 점수 추이</h3>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', lineHeight: 1.4, marginBottom: '8px' }}>
                  <strong style={{ color: '#475569' }}>본인 점수</strong> = 내가 출제·관리한 과제 중 이 학생의 응시 점수 ·
                  <strong style={{ color: '#475569' }}> 학급 평균</strong> = 같은 학급 응시자 평균 (다른 교사 과제·미응시자 제외)
                </p>
                <svg viewBox={`0 0 ${chartW + chartX + 20} ${chartH + chartY + 30}`} style={{ width: '100%', height: 'auto' }}>
                  {[0, 25, 50, 75, 100].map((v, i) => {
                    const y = chartY + chartH - (v / max) * chartH;
                    return (
                      <g key={i}>
                        <line x1={chartX} y1={y} x2={chartX + chartW} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                        <text x={chartX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">{v}</text>
                      </g>
                    );
                  })}
                  {/* 학급 평균 */}
                  <path d={buildPath(trend.map(t => t.classAvg))} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="5 3" />
                  {/* 본인 점수 */}
                  <path d={buildPath(trend.map(t => t.score))} fill="none" stroke="#2A75F3" strokeWidth="2.5" />
                  {trend.map((t, i) => {
                    const x = chartX + (i * chartW / Math.max(1, trend.length - 1));
                    const y = chartY + chartH - (t.score / max) * chartH;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="white" stroke="#2A75F3" strokeWidth="2">
                          <title>{`${t.taskName} (${t.date})\n본인 ${t.score}점 (${t.level}) · ${t.area}\n학급 평균 ${t.classAvg}점`}</title>
                        </circle>
                        <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="800" fill="#1E2225">{t.score}</text>
                        <text x={x} y={chartY + chartH + 14} textAnchor="middle" fontSize="9" fill="#64748B">{t.date}</text>
                      </g>
                    );
                  })}
                  <line x1={chartX} y1={chartY + chartH} x2={chartX + chartW} y2={chartY + chartH} stroke="#CBD5E1" strokeWidth="1" />
                </svg>
                <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: 'var(--neo-font-size-xs)', marginTop: '4px' }}>
                  <span><span style={{ display: 'inline-block', width: 14, height: 2, background: '#2A75F3', verticalAlign: 'middle', marginRight: 4 }}></span>본인</span>
                  <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '1.5px dashed #94A3B8', verticalAlign: 'middle', marginRight: 4 }}></span>학급 평균</span>
                </div>

                {/* 통계 카드 4종 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                  {[
                    { label: '평균', value: `${avgScore}점`, sub: `학급 ${classAvg}점`, color: avgScore >= classAvg ? '#10B981' : '#EF4444' },
                    { label: '최고/최저', value: `${high}/${low}`, sub: '점', color: '#2A75F3' },
                    { label: '직전 대비', value: `${lastDelta >= 0 ? '+' : ''}${lastDelta}점`, sub: lastDelta >= 0 ? '↑' : '↓', color: lastDelta >= 0 ? '#10B981' : '#EF4444' },
                    { label: '약점 영역 (핵심평가영역)', value: areas.sort((a, b) => (a.score - a.classAvg) - (b.score - b.classAvg))[0].area, sub: `학급 대비 ${areas[0].score - areas[0].classAvg}점`, color: '#FB923C' },
                  ].map((c, i) => (
                    <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{c.label}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{c.sub}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 2. 영역별 강·약점 (핵심평가영역=내용체계 기준) */}
              <section>
                <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '4px' }}>🎯 영역별 강·약점</h3>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', lineHeight: 1.4, marginBottom: '8px' }}>
                  <strong style={{ color: '#475569' }}>핵심평가영역(내용체계)</strong> 기준 — 교과별로 영역 종류가 다름 (예: 수학 = 수와 연산·변화와 관계·도형과 측정·자료와 가능성)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...areas].sort((a, b) => (a.score - a.classAvg) - (b.score - b.classAvg)).map((a, i) => {
                    const diff = a.score - a.classAvg;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '60px', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)' }}>{a.area}</div>
                        <div style={{ flex: 1, position: 'relative', height: '24px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${a.score}%`, height: '100%', background: diffColor(diff), display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                            {a.score}
                          </div>
                          <div style={{ position: 'absolute', top: 0, left: `${a.classAvg}%`, height: '100%', borderLeft: '2px dashed #1E2225', opacity: 0.6 }} title={`학급 ${a.classAvg}`}></div>
                        </div>
                        <div style={{ width: '70px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: diffColor(diff), textAlign: 'right' }}>
                          {diff >= 0 ? '+' : ''}{diff}점
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '6px' }}>점선 = 학급 평균. 🔴 -10↓ 약점 / 🟡 -5~-10 주의 / 🟢 +5↑ 강점</div>
              </section>

              {/* 3. 채점 history */}
              <section>
                <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '8px' }}>📋 채점 history</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                    <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #E2E8F0' }}>과제</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #E2E8F0' }}>일자</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', borderBottom: '1px solid #E2E8F0' }}>점수</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', borderBottom: '1px solid #E2E8F0' }}>변화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradingHistory.map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('채점 관리')}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {g.taskName}
                            <span style={{ marginLeft: '6px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>{g.area}</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>{g.date}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{g.score}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: g.delta == null ? '#94A3B8' : g.delta >= 0 ? '#10B981' : '#EF4444' }}>
                            {g.delta == null ? '-' : (g.delta >= 0 ? `+${g.delta}` : g.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '4px' }}>행 클릭 → 해당 채점 상세로 이동</div>
              </section>

              {/* 4. 피드백 누적 (조회 전용) — 채점 상세의 「이런 점이 좋아요」 섹션 발췌 */}
              <section>
                <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '4px' }}>💬 교사 피드백 누적</h3>
                <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', lineHeight: 1.4, marginBottom: '8px' }}>
                  채점 상세의 <strong style={{ color: '#10B981' }}>「이런 점이 좋아요」</strong> 항목 일부를 시간순으로 누적 노출 (긍정 피드백 기록 — 조회 전용)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {feedbacks.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => onNavigate && onNavigate('채점 관리')}
                      title={f.good}
                      style={{
                        background: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2A75F3'; e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>
                        <span>📋 {f.task}</span>
                        <span>{f.date}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: '#10B981', fontSize: 'var(--neo-font-size-sm)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          이런 점이 좋아요
                        </span>
                        <span style={{
                          flex: 1,
                          fontSize: 'var(--neo-font-size-sm)',
                          color: '#1E2225',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}>
                          {f.good}
                        </span>
                        <span style={{ color: '#CBD5E1', fontSize: 'var(--neo-font-size-base)', flexShrink: 0 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. 액션 */}
              <section style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => onNavigate && onNavigate('과제 등록')}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #2A75F3', borderRadius: '8px', background: '#EFF6FF', color: '#1D4ED8', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>
                  📝 과제 만들기
                </button>
                <button onClick={() => setShowReportPreview(true)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid #FB923C', borderRadius: '8px', background: '#FFF7ED', color: '#9A3412', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>
                  📄 리포트 생성
                </button>
              </section>
            </div>
          )}
        </div>

        {activeTab === 'info' && (
          <div className="drawer-footer">
            <button className="btn-drawer-close" onClick={handleClose}>닫기</button>
            <button className="btn-drawer-complete" onClick={handleSave} disabled={!name.trim()}>수정 완료</button>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────── */}
      {/* 리포트 PDF 미리보기 모달                    */}
      {/* ──────────────────────────────────────── */}
      {showReportPreview && (
        <div
          onClick={() => setShowReportPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#F1F5F9', borderRadius: '12px', width: '720px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(15,23,42,0.4)' }}
          >
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: '12px 12px 0 0' }}>
              <div>
                <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>📄 리포트 미리보기</div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '2px' }}>학생 학습 카드 PDF — {student.name} ({student.gradeInfo || student.className})</div>
              </div>
              <button onClick={() => setShowReportPreview(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* PDF 미리보기 영역 (A4 비율) */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'white', width: '595px', minHeight: '842px', padding: '40px', boxShadow: '0 4px 12px rgba(15,23,42,0.1)', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.5 }}>
                {/* PDF 헤더 */}
                <div style={{ borderBottom: '2px solid #1E2225', paddingBottom: '14px', marginBottom: '20px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: '#1E2225' }}>학생 학습 리포트</div>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginTop: '6px' }}>
                    <strong>{student.name}</strong> · {student.gradeInfo || student.className} · 발행일 {new Date().toLocaleDateString('ko-KR')}
                  </div>
                </div>

                {/* 시계열 통계 요약 */}
                <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '8px', color: '#2A75F3' }}>📈 시계열 점수 추이</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>평균 점수</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>{avgScore}점 <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>(학급 {classAvg})</span></div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>최고 / 최저</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>{high} / {low}점</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>직전 대비</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: lastDelta >= 0 ? '#10B981' : '#EF4444' }}>{lastDelta >= 0 ? '+' : ''}{lastDelta}점 {lastDelta >= 0 ? '↑' : '↓'}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>약점 영역 (핵심평가영역)</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#FB923C' }}>{areas.sort((a, b) => (a.score - a.classAvg) - (b.score - b.classAvg))[0].area}</div>
                  </div>
                </div>

                {/* 영역별 강·약점 */}
                <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '8px', color: '#2A75F3' }}>🎯 영역별 강·약점 (핵심평가영역)</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9' }}>
                      <th style={{ padding: '6px', textAlign: 'left', fontWeight: 700 }}>영역</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>본인</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>학급 평균</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((a, i) => {
                      const diff = a.score - a.classAvg;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '6px', fontWeight: 600 }}>{a.area}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>{a.score}</td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#94A3B8' }}>{a.classAvg}</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: diff >= 0 ? '#10B981' : '#EF4444' }}>{diff >= 0 ? '+' : ''}{diff}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 채점 history */}
                <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '8px', color: '#2A75F3' }}>📋 채점 history</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9' }}>
                      <th style={{ padding: '6px', textAlign: 'left', fontWeight: 700 }}>과제</th>
                      <th style={{ padding: '6px', textAlign: 'left', fontWeight: 700 }}>일자</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>점수</th>
                      <th style={{ padding: '6px', textAlign: 'left', fontWeight: 700 }}>등급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradingHistory.map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '6px' }}>{g.taskName}</td>
                        <td style={{ padding: '6px', color: '#94A3B8' }}>{g.date}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{g.score}</td>
                        <td style={{ padding: '6px' }}>{g.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 교사 피드백 */}
                <h4 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '8px', color: '#2A75F3' }}>💬 교사 피드백 누적</h4>
                {feedbacks.map((f, i) => (
                  <div key={i} style={{ background: '#FFFBF5', border: '1px solid #FED7AA', padding: '8px 10px', borderRadius: '6px', marginBottom: '6px' }}>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#9A3412', fontWeight: 700, marginBottom: '4px' }}>📋 {f.task} · {f.date}</div>
                    <div style={{ fontWeight: 700, color: '#10B981', fontSize: 'var(--neo-font-size-xs)' }}>이런 점이 좋아요</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', marginTop: '2px' }}>{f.good}</div>
                  </div>
                ))}

                {/* PDF 푸터 */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '10px', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center' }}>
                  AiGLE 학생 학습 리포트 · 본인 점수와 학급 평균은 응시자만 집계
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid #E2E8F0', background: 'white', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>A4 한 페이지 미리보기 — 인쇄·PDF 저장 가능</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowReportPreview(false)} style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>닫기</button>
                <button
                  onClick={() => { window.print(); }}
                  style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: '#FB923C', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}
                >📥 PDF 다운로드</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentDetailDrawer;
