/**
 * PromptArchive.jsx
 * Prompt 아카이브 화면입니다.
 * Prompt Studio에서 저장된 테스트 결과를 목록으로 관리하며, 교과/날짜별 필터링, 검색,
 * 개별/일괄 삭제, 데이터 분석 리포트(AnalysisReport) 실행 기능을 제공합니다.
 */
import React, { useState, useRef, useMemo } from 'react';

const TEACHER_GRADE_MAP = {
  '매우우수': { label: '매우우수', score: 5, color: '#065F46', bg: '#D1FAE5' },
  '우수':     { label: '우수', score: 4, color: '#0E7490', bg: '#CFFAFE' },
  '보통':     { label: '보통', score: 3, color: '#92400E', bg: '#FEF3C7' },
  '노력':     { label: '노력', score: 2, color: '#C2410C', bg: '#FFEDD5' },
  '매우노력': { label: '매우노력', score: 1, color: '#991B1B', bg: '#FEE2E2' },
};

// [v3.57] 평가 일치도 3-state (완전일치 / 부분일치 / 불일치) + 스타일
const MATCH_STYLE = {
  '완전일치': { label: '✅ 완전일치', color: '#065F46', bg: '#D1FAE5' },
  '부분일치': { label: '⚠️ 부분일치', color: '#92400E', bg: '#FEF3C7' },
  '불일치':   { label: '❌ 불일치',   color: '#991B1B', bg: '#FEE2E2' },
};
const MATCH_LABEL = {
  '': '-',
  exact: '✅ 완전일치',
  near: '⚠️ 부분일치',
  fail: '❌ 불일치',
  '완전 일치': '✅ 완전일치',
  '부분 일치': '⚠️ 부분일치',
  '완전일치': '✅ 완전일치',
  '부분일치': '⚠️ 부분일치',
  '불일치': '❌ 불일치',
};

const ERROR_LABEL = {
  '': '-',
  ocr: 'OCR 오류',
  hallucination: 'Hallucination',
  logic: 'Logical Error',
  rubric: 'Rubric Mismatch',
  format: 'Format/Tone',
  other: 'Other',
  '해당 없음': '해당 없음',
  'OCR 인식 오류': 'OCR 인식 오류',
  '채점 기준표 미준수': '채점 기준표 미준수',
  '환각 현상 (거짓 논리)': '환각 현상',
  '포맷 오류': '포맷 오류',
};

const CATEGORY_OPTIONS = [
  { value: '국어', label: '국어' },
  { value: '수학', label: '수학' },
  { value: '영어', label: '영어' },
  { value: '과학', label: '과학' },
  { value: '사회', label: '사회' },
];

export default function PromptArchive({ tests, onSetTests, onRunAnalysis }) {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterCategory, setFilterCategory] = useState('전체');
  const [filterGradingType, setFilterGradingType] = useState('전체');
  const [filterMatch, setFilterMatch] = useState('전체'); // [v3.57] 평가 일치도 필터
  const [searchTitle, setSearchTitle] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const selectedGradingTypeSet = useMemo(() => {
    const set = new Set();
    tests.forEach(t => { if (selectedIds.includes(t.id) && t.gradingType) set.add(t.gradingType); });
    return set;
  }, [tests, selectedIds]);

  // 과정 선택 시: 동일 assignmentId의 등급 레코드가 존재해야 함 (기준선 역할)
  const missingQuantBaseline = useMemo(() => {
    if (!selectedGradingTypeSet.has('과정')) return [];
    const selected = tests.filter(t => selectedIds.includes(t.id) && t.gradingType === '과정');
    return selected
      .filter(t => !tests.some(other => other.assignmentId === t.assignmentId && other.gradingType === '등급'))
      .map(t => t.title);
  }, [tests, selectedIds, selectedGradingTypeSet]);

  const hasMixedGradingTypes = selectedGradingTypeSet.size > 1;
  const hasMissingBaseline = missingQuantBaseline.length > 0;
  const canAnalyze = selectedIds.length > 0 && !hasMixedGradingTypes && !hasMissingBaseline;

  const sortedTests = useMemo(() => {
    let items = [...tests];
    if (filterCategory !== '전체') items = items.filter(t => t.category === filterCategory);
    if (filterGradingType !== '전체') items = items.filter(t => (t.gradingType || '등급') === filterGradingType);
    if (filterMatch !== '전체') items = items.filter(t => (t.matchStatus || '') === filterMatch);
    if (searchTitle.trim()) {
      const q = searchTitle.trim().toLowerCase();
      items = items.filter(t =>
        (t.testTitle || '').toLowerCase().includes(q)
        || (t.taskName || '').toLowerCase().includes(q)
        || (t.title || '').toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      let aVal = a[sortConfig.key] || '';
      let bVal = b[sortConfig.key] || '';
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return items;
  }, [tests, sortConfig, filterCategory, filterGradingType, filterMatch, searchTitle]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedTests.length && sortedTests.length > 0) setSelectedIds([]);
    else setSelectedIds(sortedTests.map(t => t.id));
  };

  const deleteTest = (id) => {
    if (!window.confirm('이 테스트 데이터를 삭제하시겠습니까?')) return;
    onSetTests(prev => prev.filter(t => t.id !== id));
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) {
      alert('삭제할 데이터를 선택해 주세요.');
      return;
    }
    if (!window.confirm(`선택한 ${selectedIds.length}건의 데이터를 삭제하시겠습니까?`)) return;
    onSetTests(prev => prev.filter(t => !selectedIds.includes(t.id)));
    setSelectedIds([]);
  };

  const startAnalysis = () => {
    if (selectedIds.length === 0) {
      alert('분석할 데이터를 선택해 주세요.');
      return;
    }
    if (hasMixedGradingTypes) {
      alert('등급평가와 과정 분석는 함께 분석할 수 없습니다.\n동일한 채점 방식끼리 선택해 주세요.');
      return;
    }
    if (hasMissingBaseline) {
      alert(`과정 분석 분석에 필요한 등급평가 결과가 없습니다. 먼저 등급평가를 실행해 주세요.\n누락 과제: ${missingQuantBaseline.join(', ')}`);
      return;
    }
    const selectedData = tests.filter(t => selectedIds.includes(t.id));
    onRunAnalysis(selectedData);
  };

  return (
    <div className="ta-root">
      <header className="ta-header">
        <div className="ta-header-left">
          <h1 className="ta-title">Prompt 아카이브</h1>
          <p className="ta-subtitle">Prompt Studio 결과를 관리하고 데이터 분석 리포트를 생성합니다.</p>
        </div>
        <div className="ta-header-right">
          <button
            className="ta-btn-analyze"
            onClick={startAnalysis}
            disabled={!canAnalyze}
            title={hasMixedGradingTypes ? '등급평가와 과정 분석는 함께 분석할 수 없습니다.' : undefined}
            style={!canAnalyze ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            📊 {selectedIds.length}건 데이터 분석 시작
          </button>
          {hasMixedGradingTypes && (
            <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#EF4444', fontWeight: 600 }}>
              ⚠️ 등급평가와 과정 분석는 함께 분석할 수 없습니다.
            </span>
          )}
          {hasMissingBaseline && (
            <span style={{ marginLeft: '8px', fontSize: 'var(--neo-font-size-sm)', color: '#EF4444', fontWeight: 600 }}>
              ⚠️ 과정 분석 분석을 위해 동일 과제의 등급평가 결과가 필요합니다.
            </span>
          )}
          {selectedIds.length > 0 && (
            <button className="ta-btn-delete-bulk" onClick={deleteSelected} style={{ marginLeft: '8px', padding: '10px 20px', fontSize: 'var(--neo-font-size-base)', fontWeight: '600', border: '1px solid #ef4444', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
              🗑️ {selectedIds.length}건 일괄 삭제
            </button>
          )}
        </div>
      </header>

      <div className="ta-toolbar">
        <div className="ta-filters">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: 'var(--neo-font-size-base)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="ta-select"
              placeholder="과제명 검색..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              style={{ paddingLeft: '30px', minWidth: '180px' }}
            />
            {searchTitle && (
              <button
                onClick={() => setSearchTitle('')}
                style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 'var(--neo-font-size-base)', lineHeight: 1 }}
              >✕</button>
            )}
          </div>
          <select className="ta-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="전체">모든 교과</option>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="ta-select" value={filterGradingType} onChange={(e) => setFilterGradingType(e.target.value)}>
            <option value="전체">모든 채점방식</option>
            <option value="등급">등급평가</option>
            <option value="과정">과정 분석</option>
          </select>
          <select className="ta-select" value={filterMatch} onChange={(e) => setFilterMatch(e.target.value)}>
            <option value="전체">모든 일치도</option>
            <option value="완전일치">✅ 완전일치</option>
            <option value="부분일치">⚠️ 부분일치</option>
            <option value="불일치">❌ 불일치</option>
          </select>
          <select
            className="ta-select"
            value={sortConfig.key}
            onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value })}
          >
            <option value="date">날짜순</option>
            <option value="testTitle">테스트 제목순</option>
            <option value="category">교과순</option>
            <option value="taskName">과제명순</option>
            <option value="evalMode">평가모드순</option>
            <option value="matchStatus">일치도순</option>
          </select>
          <button
            className="ta-sort-btn"
            onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
          >
            {sortConfig.direction === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}
          </button>
        </div>
        <div className="ta-stats">
          전체 <strong>{tests.length}</strong>건 {' | '} 선택 <strong>{selectedIds.length}</strong>건
        </div>
      </div>

      <div className="ta-table-container">
        <table className="ta-table">
          <thead>
            <tr>
              <th className="ta-th-check">
                <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === sortedTests.length} onChange={toggleSelectAll} />
              </th>
              <th>날짜 · 테스트 제목</th>
              <th>교과</th>
              <th>과제명-문항</th>
              <th>평가모드</th>
              <th>채점방식</th>
              <th>평가 일치도</th>
              <th>오류 유형</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {sortedTests.map((t) => {
              const isGraded = (t.gradingType || '등급') === '등급';
              const matchStyle = MATCH_STYLE[t.matchStatus];
              return (
                <tr key={t.id} className={selectedIds.includes(t.id) ? 'selected' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                  </td>
                  <td className="ta-td-title">
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>
                      📅 [{new Date(t.date).toLocaleDateString('ko-KR')}]
                    </div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginTop: 2 }}>
                      {t.testTitle || t.title || '(제목 없음)'}
                    </div>
                  </td>
                  <td><span className="ta-cat-badge">{t.category}</span></td>
                  <td style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', fontWeight: 600 }}>
                    {t.taskName || t.title || '-'}{t.questionNo ? <span style={{ color: '#7C3AED', fontWeight: 800 }}>{`-${t.questionNo}`}</span> : ''}
                  </td>
                  <td><span className="ta-mode-text">{t.evalMode}</span></td>
                  <td>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: (t.gradingType || '등급') === '과정' ? '#FDF4FF' : '#EFF6FF', color: (t.gradingType || '등급') === '과정' ? '#86198F' : '#1D4ED8' }}>
                      {t.gradingType || '등급'}
                    </span>
                  </td>
                  <td>
                    {!isGraded ? (
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>-</span>
                    ) : matchStyle ? (
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: matchStyle.bg, color: matchStyle.color }}>
                        {matchStyle.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#F1F5F9', color: '#94A3B8', fontStyle: 'italic' }}>
                        미평가
                      </span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      if (!isGraded) return <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>-</span>;
                      const et = t.errorType || '';
                      // 정상 상태 (해당없음/해당 없음/빈값) — 그대로 「해당없음」 표기, 회색 중성 배지
                      const isNormal = !et || et === '해당없음' || et === '해당 없음';
                      const displayText = isNormal ? '해당없음' : (ERROR_LABEL[et] ?? et);
                      return (
                        <span style={{
                          fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                          background: isNormal ? '#F1F5F9' : '#FEF3C7',
                          color: isNormal ? '#64748B' : '#92400E',
                        }}>
                          {displayText}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="ta-btn-view" onClick={() => setSelectedItem(t)}>보기</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedTests.length === 0 && (
          <div className="ta-empty">아카이브된 데이터가 없습니다.</div>
        )}
      </div>

      {/* --- Detail Modal --- */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-container" style={{ width: '960px', height: '90vh' }} onClick={e => e.stopPropagation()}>
            <button className="btn-modal-close" onClick={() => setSelectedItem(null)}>✕</button>
            <div className="modal-header-info" style={{ borderBottom: '1px solid #eee', paddingRight: '60px', paddingBottom: '20px', display: 'flex', gap: '24px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748b', marginBottom: '4px' }}>
                  {new Date(selectedItem.date).toLocaleString()} | {selectedItem.category} | {selectedItem.evalMode}
                </div>
                <h2 className="modal-student-name" style={{ fontSize: '1.4rem', margin: 0 }}>{selectedItem.title}</h2>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#f8fafc', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94a3b8', width: '60px' }}>평가 일치도</span>
                    {(() => {
                      const g = TEACHER_GRADE_MAP[selectedItem.matchStatus];
                      return (
                        <span style={{
                          fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                          background: g?.bg || '#F1F5F9',
                          color: g?.color || '#64748b'
                        }}>
                          {g?.label || MATCH_LABEL[selectedItem.matchStatus] || selectedItem.matchStatus}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94a3b8', width: '60px' }}>오류 유형</span>
                    <span style={{
                      fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                      background: selectedItem.errorType && selectedItem.errorType !== '해당 없음' ? '#FEF3C7' : '#f1f5f9',
                      color: selectedItem.errorType && selectedItem.errorType !== '해당 없음' ? '#92400E' : '#64748b'
                    }}>
                      {ERROR_LABEL[selectedItem.errorType] || selectedItem.errorType || '-'}
                    </span>
                  </div>
                </div>
                <div style={{ width: '1px', height: '36px', background: '#e2e8f0' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94a3b8' }}>MODEL</span>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#1e293b' }}>{selectedItem.model}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94a3b8' }}>VER</span>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#2A75F3' }}>{selectedItem.promptVersionId}</span>
                  </div>
                </div>
                <div style={{ width: '1px', height: '36px', background: '#e2e8f0' }}></div>
                {/* [v5.14] AI COST 원화(KRW) 메인 표기 + USD 보조 표기 */}
                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#94a3b8', marginBottom: '2px' }}>AI COST</div>
                  <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#10B981' }}>
                    {((selectedItem.costUsd || 0) * 1350).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 원
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
                    ${selectedItem.costUsd?.toFixed(4)} USD
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-content" style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '32px' }}>
                <h3 className="section-title" style={{ fontSize: 'var(--neo-font-size-base)', marginBottom: '16px' }}>🎞️ 제출 답안 이미지</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {(selectedItem.studentImages || (selectedItem.studentImage ? [selectedItem.studentImage] : [])).map((img, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', padding: '12px', background: '#f8fafc' }}>
                      <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', marginBottom: '8px', textAlign: 'center', fontWeight: '800', background: '#EBF2FF', padding: '4px', borderRadius: '6px' }}>
                        {idx === 0 ? 'IMAGE 01: 원본 필기 (HANDWRITING)' : 'IMAGE 02: 메타데이터 인코딩 (ENCODED)'}
                      </div>
                      <img src={img} alt={`Student Answer ${idx}`} style={{ width: '100%', display: 'block', borderRadius: '4px' }} />
                    </div>
                  ))}
                  {(!selectedItem.studentImages && !selectedItem.studentImage) && (
                    <div style={{ gridColumn: 'span 2', height: '160px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      업로드된 이미지가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 className="section-title" style={{ fontSize: 'var(--neo-font-size-base)', marginBottom: '8px' }}>📝 OCR 변환 텍스트</h3>
                    <div style={{ 
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', 
                      fontSize: 'var(--neo-font-size-sm)', whiteSpace: 'pre-wrap', height: '350px', overflowY: 'auto', lineHeight: 1.6, color: '#334155'
                    }}>
                      {selectedItem.ocrText || selectedItem.ocr || '결과 없음'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 className="section-title" style={{ fontSize: 'var(--neo-font-size-base)', marginBottom: '8px' }}>🤖 AI 채점 결과 (Raw)</h3>
                    <div style={{ 
                      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', 
                      fontSize: 'var(--neo-font-size-sm)', whiteSpace: 'pre-wrap', height: '350px', overflowY: 'auto', 
                      fontFamily: 'monospace', color: '#1e40af', lineHeight: 1.5 
                    }}>
                      {selectedItem.gradingResult || selectedItem.grading || '결과 없음'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h3 className="section-title" style={{ fontSize: 'var(--neo-font-size-base)', marginBottom: '8px' }}>💡 연구진 코멘트 / 피드백</h3>
                <div style={{ 
                  background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '16px', 
                  fontSize: 'var(--neo-font-size-base)', color: '#9a3412', minHeight: '100px', lineHeight: 1.6
                }}>
                  {selectedItem.teacherFeedback || selectedItem.comment || '기록된 코멘트가 없습니다.'}
                </div>
              </div>
            </div>

            <footer style={{ padding: '16px 24px', borderTop: '1px solid #eee', textAlign: 'right', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="ta-btn-del" 
                onClick={() => { deleteTest(selectedItem.id); setSelectedItem(null); }}
                style={{ padding: '10px 20px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}
              >
                🗑️ 데이터 삭제
              </button>
              <button className="btn-primary" onClick={() => setSelectedItem(null)} style={{ padding: '10px 32px' }}>
                닫기
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
