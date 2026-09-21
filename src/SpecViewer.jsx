/**
 * SpecViewer.jsx
 * 화면 명세서 viewer — 좌측 화면 미리보기 + 우측 번호 매긴 description annotation 카드
 * 화면 아래 「화면 내용 등록」 영역 (localStorage 영구 보존)
 */
import React, { useState, useEffect, useRef } from 'react';

// 화면 명세 데이터 (필요 시 추가)
const specs = [
  {
    id: 'DSH-01',
    name: '시스템 관리자 대시보드',
    menuKey: '대시보드',
    purpose: '시스템 단위 KPI(학교 무관 전체) — 누적 등록·활동·과제 트렌드를 모니터링',
    annotations: [
      {
        title: '운영 KPI 카드',
        bullets: [
          '총 학교·교사·학생·과제 수 등 시스템 전체 누적 지표',
          '학년도 시작 시 학생·채점 데이터 리셋, 과제는 영구 보존',
        ],
      },
      {
        title: '학교급별 활동 (월별 추세)',
        bullets: [
          '초·중·고 학교급별 월별 활동량 추세',
          '학년도 단위 (3월~다음 해 2월)',
        ],
      },
      {
        title: '누적 보유 과제 탭',
        bullets: [
          '학교급·교과별 누적 과제 + 올해 신규 과제 분리 노출',
          '카드 그리드 (3 columns 학교급, 5 columns 교과)',
        ],
      },
      {
        title: '교사 접속률 학교별 추세',
        bullets: [
          '학교별 접속률 시계열 + 유료 학교 chip 강조',
          '무료/유료 회원 비중 가시화',
        ],
      },
    ],
  },
  {
    id: 'DSH-02',
    name: '교사 대시보드',
    menuKey: '교사 대시보드',
    purpose: '교사 본인이 관리하는 학생·학급 단위 학습 추이 파악',
    annotations: [
      {
        title: '헤더 배너 — 내 서비스 기간 + 데이터 학년',
        bullets: [
          '내 서비스 기간: 유료 1년 계약 / 무료 14일 trial',
          '데이터 학년 노란 박스: 본 대시보드는 학년도 데이터만 반영',
        ],
      },
      {
        title: '본인 학급 KPI 카드',
        bullets: [
          '담임/지도 학급 수, 학생 수, 진행 과제 수',
          '카드 클릭 시 해당 관리 화면 이동',
        ],
      },
      {
        title: '학생 학습 추이 (월별)',
        bullets: [
          '본인 학급 학생들의 월별 응시·점수 추이',
          '학년도 단위, 학기 경계 시각화',
        ],
      },
      {
        title: '본인 채점 활동',
        bullets: [
          '과제 생성·채점 완료·결과 발송 단계별 본인 활동량',
          'AI vs 교사 재검토 비율 (등급평가)',
        ],
      },
    ],
  },
  {
    id: 'DSH-03',
    name: '학교 대시보드',
    menuKey: '학교 대시보드',
    purpose: '학교 관리자 관점에서 학생·교사·과제·채점 활동을 한눈에 파악',
    annotations: [
      {
        title: '헤더 배너 — 내 서비스 기간 + 데이터 학년',
        bullets: [
          '내 서비스 기간: 학교유료회원 1년 계약 / 무료회원 14일 trial',
          '데이터 학년 노란 강조 박스: 본 대시보드는 학년도 데이터만 반영',
          '학년 종료 시 학생·채점 데이터 자동 초기화, 과제는 영구 보존',
        ],
      },
      {
        title: '운영 KPI 카드 4종',
        bullets: [
          '진행중인 과제 / 등록 학생 / 등록 교사 / 등록 그룹',
          '진행중인 과제를 좌측 우선 배치 (운영 우선순위 반영)',
          '각 카드 클릭 시 해당 관리 화면으로 이동',
        ],
      },
      {
        title: '학년별 과제 진행현황 (전체 + 학년별 가로 stacked bar)',
        bullets: [
          '「전체」 row (최상단, 강조) + 1·2·3학년 row, 각 row 100% 정규화',
          '미채점·채점확인·결과발송 완료 3단계 누적',
          '「전체」는 학년별 합으로 derive → 단일 source, 자동 일관성',
          '학교장 한 눈 파악(전체) + 학년 격차(학년별) 동시 가시화',
        ],
      },
      {
        title: '교사별 활동도 Top 10',
        bullets: [
          '과제 생성·채점 활동 dual-display 가로 막대',
          '학년도 활동 합계 내림차순 Top 10',
          '클릭 시 TCH-04 교사 상세로 이동',
        ],
      },
      {
        title: '그룹 과제 개인 점수 분포표',
        bullets: [
          '5등급(매우우수~매우노력) × N학급 매트릭스',
          '셀 색상 강도: 비중 비례 파란 톤',
          '셀 hover 시 해당 학급·등급 학생명 popover',
        ],
      },
    ],
  },
];

const STORAGE_KEY = 'specViewer_notes';
const CUSTOM_SPECS_KEY = 'specViewer_customSpecs';
const LAYOUT_KEY = 'specViewer_leftPct';
const ORDER_KEY = 'specViewer_order'; // 화면별 항목 순서 보존

const SpecViewer = ({ renderPreview }) => {
  // 사용자가 업로드한 이미지 화면 (localStorage 영구 보존)
  const [customSpecs, setCustomSpecs] = useState(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_SPECS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  });
  const allSpecs = [...specs, ...customSpecs];

  const [activeSpecId, setActiveSpecId] = useState(specs[0].id);
  const spec = allSpecs.find(s => s.id === activeSpecId) || specs[0];
  const noteKey = `${STORAGE_KEY}_${spec.id}`;

  // 좌/우 컬럼 width 비율 — 가운데 divider 드래그로 조절
  const [leftPct, setLeftPct] = useState(() => {
    const v = parseInt(localStorage.getItem(LAYOUT_KEY), 10);
    return Number.isFinite(v) && v >= 30 && v <= 75 ? v : 58;
  });
  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, String(leftPct));
  }, [leftPct]);

  // divider drag
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      setLeftPct(Math.max(30, Math.min(75, pct)));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 우측 컬럼 width → 고정 폼 width/right 동기화
  const rightColRef = useRef(null);
  const [formGeo, setFormGeo] = useState({ width: 400, right: 32 });
  useEffect(() => {
    const measure = () => {
      if (!rightColRef.current) return;
      const r = rightColRef.current.getBoundingClientRect();
      setFormGeo({ width: r.width, right: window.innerWidth - r.right });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [leftPct, activeSpecId]);

  // 화면 내용 등록 — localStorage 영구 보존
  const [notes, setNotes] = useState([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  // 우측 list 사용자 정의 순서 (annotation + note 통합)
  const orderKey = `${ORDER_KEY}_${spec.id}`;
  const [itemOrder, setItemOrder] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(orderKey);
      setItemOrder(stored ? JSON.parse(stored) : []);
    } catch (e) {
      setItemOrder([]);
    }
  }, [orderKey]);

  const persistOrder = (next) => {
    setItemOrder(next);
    try { localStorage.setItem(orderKey, JSON.stringify(next)); } catch (e) { console.warn(e); }
  };

  // 영역 마킹 상태
  const [markingMode, setMarkingMode] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [pendingRegion, setPendingRegion] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const scrollRef = useRef(null);

  // 화면 전환 시 영역·선택 상태 초기화
  useEffect(() => {
    setMarkingMode(false);
    setStartPoint(null);
    setCurrentRect(null);
    setPendingRegion(null);
    setSelectedNoteId(null);
  }, [activeSpecId]);

  const getRelativeCoords = (e) => {
    if (!scrollRef.current) return { x: 0, y: 0 };
    const rect = scrollRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top + scrollRef.current.scrollTop,
    };
  };

  const handleMarkStart = (e) => {
    if (!markingMode) return;
    e.preventDefault();
    const p = getRelativeCoords(e);
    setStartPoint(p);
    setCurrentRect({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const handleMarkMove = (e) => {
    if (!markingMode || !startPoint) return;
    e.preventDefault();
    const p = getRelativeCoords(e);
    setCurrentRect({
      x: Math.min(startPoint.x, p.x),
      y: Math.min(startPoint.y, p.y),
      width: Math.abs(p.x - startPoint.x),
      height: Math.abs(p.y - startPoint.y),
    });
  };

  const handleMarkEnd = () => {
    // mousedown 없이 mouseup/leave는 무시 — markingMode 유지
    if (!markingMode || !startPoint) return;
    if (currentRect && currentRect.width > 10 && currentRect.height > 10) {
      setPendingRegion(currentRect);
    }
    setStartPoint(null);
    setCurrentRect(null);
    setMarkingMode(false);
  };

  const handleMarkLeave = () => {
    // 드래그 도중 미리보기 밖으로 나가면 진행 중 rect만 취소 (markingMode는 유지)
    if (startPoint) {
      setStartPoint(null);
      setCurrentRect(null);
    }
  };

  const handleNoteClick = (note) => {
    const next = selectedNoteId === note.id ? null : note.id;
    setSelectedNoteId(next);
    if (next && note.region && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: Math.max(0, note.region.y - 60),
        behavior: 'smooth',
      });
    }
  };

  // 통합 items 배열 (annotation + note) — itemOrder 적용
  const buildOrderedItems = () => {
    const all = [
      ...spec.annotations.map((a, i) => ({ id: `ann-${i}`, type: 'annotation', data: a })),
      ...notes.map(n => ({ id: `note-${n.id}`, type: 'note', data: n })),
    ];
    if (!itemOrder.length) return all;
    const byId = new Map(all.map(it => [it.id, it]));
    const ordered = [];
    const seen = new Set();
    for (const id of itemOrder) {
      if (byId.has(id)) { ordered.push(byId.get(id)); seen.add(id); }
    }
    // 신규(아직 order에 없는) 항목은 뒤에 추가
    for (const it of all) {
      if (!seen.has(it.id)) ordered.push(it);
    }
    return ordered;
  };
  const orderedItems = buildOrderedItems();

  // 드래그로 itemId 위치를 targetId 자리로 이동
  const moveItem = (itemId, targetId) => {
    if (itemId === targetId) return;
    const ids = orderedItems.map(it => it.id);
    const fromIdx = ids.indexOf(itemId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [removed] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, removed);
    persistOrder(ids);
  };

  // 노트 마커용: 노트의 표시 번호 = orderedItems 내 index + 1
  const getDisplayNumber = (item) => orderedItems.findIndex(it => it.id === item.id) + 1;

  // 이미지 업로드 → custom spec 생성
  const fileInputRef = useRef(null);
  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const baseName = file.name.replace(/\.[^.]+$/, '') || '업로드 화면';
      const newSpec = {
        id: `CUSTOM-${Date.now()}`,
        name: baseName,
        menuKey: '(이미지)',
        purpose: '사용자 업로드 이미지',
        annotations: [],
        imageData: ev.target.result,
        isCustom: true,
      };
      try {
        const updated = [...customSpecs, newSpec];
        setCustomSpecs(updated);
        localStorage.setItem(CUSTOM_SPECS_KEY, JSON.stringify(updated));
        setActiveSpecId(newSpec.id);
      } catch (err) {
        alert('이미지 저장에 실패했습니다. (용량 초과 가능성)');
        console.warn(err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteCustomSpec = () => {
    if (!spec.isCustom) return;
    if (!window.confirm(`'${spec.name}' 화면을 삭제하시겠습니까?`)) return;
    const updated = customSpecs.filter(s => s.id !== spec.id);
    setCustomSpecs(updated);
    localStorage.setItem(CUSTOM_SPECS_KEY, JSON.stringify(updated));
    setActiveSpecId(specs[0].id);
  };


  useEffect(() => {
    try {
      const stored = localStorage.getItem(noteKey);
      if (!stored) return;
      const raw = JSON.parse(stored);
      // 이전 스키마({author, content}) → 신규 스키마({title, bullets}) 마이그레이션
      const migrated = (raw || []).map(n => {
        if (n.bullets && n.title) return n;
        return {
          id: n.id || Date.now(),
          title: n.title || n.author || '메모',
          bullets: (n.content || '').split('\n').map(b => b.trim()).filter(Boolean),
          createdAt: n.createdAt || new Date().toISOString(),
        };
      });
      setNotes(migrated);
    } catch (e) {
      console.warn('notes load failed', e);
    }
  }, [noteKey]);

  const persist = (next) => {
    setNotes(next);
    try {
      localStorage.setItem(noteKey, JSON.stringify(next));
    } catch (e) {
      console.warn('notes save failed', e);
    }
  };

  const addNote = () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;
    // 내용은 줄바꿈 기준으로 bullet split
    const bullets = draftContent.split('\n').map(b => b.trim()).filter(Boolean);
    const newNote = {
      id: Date.now(),
      title: draftTitle.trim(),
      bullets,
      createdAt: new Date().toISOString(),
      region: pendingRegion,
    };
    persist([...notes, newNote]);
    setDraftTitle('');
    setDraftContent('');
    setPendingRegion(null);
  };

  const removeNote = (id) => {
    if (!window.confirm('이 내용을 삭제하시겠습니까?')) return;
    persist(notes.filter(n => n.id !== id));
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
  };

  // 폼 높이만큼 우측 컬럼 하단 padding 확보 (fixed form이 list를 가리지 않도록)
  const FORM_HEIGHT = 240; // 대략적인 폼 높이 (px)

  return (
    <div style={{ padding: '2rem', paddingBottom: 0, background: '#F4F7FB', minHeight: '100%', overflowY: 'auto' }}>
      {/* 헤더 + 화면 선택 셀렉트 + 업로드 + 리사이즈 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, marginBottom: '4px' }}>화면 명세서</h1>
          <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>화면 구성 요소와 의도를 빠르게 공유하기 위한 spec sheet</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* 화면 선택 */}
          <select value={activeSpecId} onChange={(e) => setActiveSpecId(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: 'var(--neo-font-size-base)', background: 'white', fontWeight: 700, cursor: 'pointer', minWidth: '240px' }}>
            <optgroup label="기본 화면">
              {specs.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
            </optgroup>
            {customSpecs.length > 0 && (
              <optgroup label="업로드 화면">
                {customSpecs.map(s => <option key={s.id} value={s.id}>📷 {s.name}</option>)}
              </optgroup>
            )}
          </select>

          {/* 이미지 업로드 (파일) */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ padding: '10px 14px', background: '#10B981', color: 'white', border: 'none', borderRadius: '10px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}
          >
            + 이미지 업로드
          </button>

          {/* custom spec 삭제 */}
          {spec.isCustom && (
            <button
              onClick={handleDeleteCustomSpec}
              style={{ padding: '10px 14px', background: 'white', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '10px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}
            >
              🗑 화면 삭제
            </button>
          )}
        </div>
      </div>

      {/* 화면 ID 태그 + 화면명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
        <span style={{ background: '#10B981', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800 }}>
          화면 ID · {spec.id}
        </span>
        <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, color: '#1E2225' }}>{spec.name}</span>
      </div>
      <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginBottom: '1rem' }}>{spec.purpose}</p>

      {/* 좌: 화면 미리보기 (sticky, 내부 스크롤) | divider | 우: annotation + 등록 list */}
      <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: `${leftPct}fr 14px ${100 - leftPct}fr`, gap: 0, alignItems: 'flex-start' }}>
        {/* 좌측 — 화면 미리보기 (height: viewport 기준 100, 내부 스크롤) */}
        <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', overflow: 'hidden', height: 'calc(100vh - 240px)', position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#F8FAFC', padding: '10px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }}></span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FACC15' }}></span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></span>
            <span style={{ marginLeft: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 600 }}>
              화면 미리보기 — {spec.menuKey}
            </span>
            {markingMode && (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '3px 10px', borderRadius: '6px' }}>
                🖱️ 영역을 드래그하세요
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} ref={scrollRef}>
            <div style={{ position: 'relative', minHeight: '100%' }}>
              {spec.imageData ? (
                <img src={spec.imageData} alt={spec.name} style={{ width: '100%', display: 'block' }} draggable={false} />
              ) : renderPreview ? renderPreview(spec.menuKey) : (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94A3B8' }}>
                  미리보기 사용 불가
                </div>
              )}

              {/* 등록된 region 번호 마커 (항상 노출, 번호는 orderedItems 기준) */}
              {orderedItems.map((item, idx) => {
                if (item.type !== 'note') return null;
                const n = item.data;
                if (!n.region) return null;
                const isSel = selectedNoteId === n.id;
                return (
                  <div key={`marker-${n.id}`}
                    onClick={() => handleNoteClick(n)}
                    title={n.title}
                    style={{
                      position: 'absolute',
                      left: n.region.x - 4,
                      top: n.region.y - 4,
                      width: 26, height: 26,
                      background: isSel ? '#1D4ED8' : '#10B981',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      cursor: 'pointer',
                      zIndex: 30,
                      border: '2px solid white',
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}

              {/* 선택된 노트의 region highlight */}
              {selectedNoteId && (() => {
                const note = notes.find(n => n.id === selectedNoteId);
                if (!note?.region) return null;
                return (
                  <div style={{
                    position: 'absolute',
                    left: note.region.x,
                    top: note.region.y,
                    width: note.region.width,
                    height: note.region.height,
                    border: '3px solid #1D4ED8',
                    background: 'rgba(29, 78, 216, 0.15)',
                    pointerEvents: 'none',
                    zIndex: 28,
                    borderRadius: '4px',
                    boxShadow: '0 0 0 3px rgba(29,78,216,0.18)',
                  }} />
                );
              })()}

              {/* 작성 대기 region (등록 전 확인용) */}
              {pendingRegion && !markingMode && (
                <div style={{
                  position: 'absolute',
                  left: pendingRegion.x,
                  top: pendingRegion.y,
                  width: pendingRegion.width,
                  height: pendingRegion.height,
                  border: '2px solid #F59E0B',
                  background: 'rgba(245, 158, 11, 0.15)',
                  pointerEvents: 'none',
                  zIndex: 32,
                  borderRadius: '4px',
                }}>
                  <span style={{ position: 'absolute', top: '-22px', left: 0, background: '#F59E0B', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                    등록 대기
                  </span>
                </div>
              )}

              {/* 드래그 중 임시 rect */}
              {markingMode && currentRect && (
                <div style={{
                  position: 'absolute',
                  left: currentRect.x,
                  top: currentRect.y,
                  width: currentRect.width,
                  height: currentRect.height,
                  border: '2px dashed #10B981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  pointerEvents: 'none',
                  zIndex: 50,
                }} />
              )}

              {/* 마킹 모드일 때 mouse 이벤트 캡처 오버레이 */}
              {markingMode && (
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    cursor: 'crosshair', zIndex: 49,
                  }}
                  onMouseDown={handleMarkStart}
                  onMouseMove={handleMarkMove}
                  onMouseUp={handleMarkEnd}
                  onMouseLeave={handleMarkLeave}
                />
              )}
            </div>
          </div>
        </div>

        {/* 가운데 divider — 드래그로 좌/우 width 조절 */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          title="드래그하여 화면 / 설명 영역 크기 조절"
          style={{
            cursor: 'col-resize',
            background: isResizing ? '#1D4ED8' : 'transparent',
            position: 'sticky',
            top: '1rem',
            height: 'calc(100vh - 240px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = '#DBEAFE'; }}
          onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: '4px',
            height: '40px',
            borderRadius: '2px',
            background: isResizing ? 'white' : '#94A3B8',
            opacity: isResizing ? 1 : 0.6,
          }} />
        </div>

        {/* 우측 — 통합 카드 list (annotation + note, 드래그로 순서 변경 가능) */}
        <div ref={rightColRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: `${FORM_HEIGHT + 24}px` }}>
          {orderedItems.map((item, idx) => {
            const displayNum = idx + 1;
            const isAnn = item.type === 'annotation';
            const a = isAnn ? item.data : null;
            const n = !isAnn ? item.data : null;
            const isSel = !isAnn && selectedNoteId === n.id;
            const hasRegion = !isAnn && !!n.region;
            const isDragging = draggingId === item.id;
            const isDragOver = dragOverId === item.id && draggingId && draggingId !== item.id;
            return (
              <div
                key={item.id}
                onClick={() => hasRegion && handleNoteClick(n)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(item.id); }}
                onDragLeave={() => setDragOverId(prev => prev === item.id ? null : prev)}
                onDrop={(e) => { e.preventDefault(); if (draggingId) moveItem(draggingId, item.id); setDraggingId(null); setDragOverId(null); }}
                title={hasRegion ? '클릭하여 영역 보기' : ''}
                style={{
                  background: isSel ? '#EFF6FF' : 'white',
                  borderRadius: '14px', padding: '16px 18px 16px 36px',
                  boxShadow: isSel ? '0 4px 16px rgba(29,78,216,0.15)' : '0 2px 8px rgba(15,23,42,0.04)',
                  border: isDragOver ? '2px dashed #1D4ED8' : (isSel ? '2px solid #1D4ED8' : '1px solid #F1F5F9'),
                  position: 'relative',
                  cursor: hasRegion ? 'pointer' : 'default',
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, opacity 0.12s',
                  opacity: isDragging ? 0.4 : 1,
                }}
              >
                {/* 드래그 핸들 */}
                <div
                  draggable
                  onDragStart={(e) => { setDraggingId(item.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  title="드래그하여 순서 변경"
                  style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    width: 20, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94A3B8', cursor: 'grab', fontSize: 'var(--neo-font-size-base)', lineHeight: 1, userSelect: 'none',
                  }}
                >⋮⋮</div>

                {/* 노트만: 삭제 버튼 */}
                {!isAnn && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeNote(n.id); }}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', padding: '4px 8px' }}
                    title="삭제"
                  >
                    ✕
                  </button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingRight: !isAnn ? '24px' : 0 }}>
                  <span
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: isSel ? '#1D4ED8' : '#10B981',
                      color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, flexShrink: 0,
                      opacity: !isAnn && !hasRegion ? 0.6 : 1,
                    }}
                  >
                    {displayNum}
                  </span>
                  <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>{isAnn ? a.title : n.title}</span>
                  {hasRegion && (
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: isSel ? '#1D4ED8' : '#10B981', background: isSel ? '#DBEAFE' : '#ECFDF5', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>📍 영역</span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: '34px' }}>
                  {(isAnn ? a.bullets : n.bullets).map((b, bi) => (
                    <li key={bi} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.55, marginBottom: '4px' }}>{b}</li>
                  ))}
                </ul>
                {!isAnn && (
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '8px', paddingLeft: '34px' }}>등록: {formatDate(n.createdAt)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 화면 내용 등록 폼 — fixed bottom-right, width는 우측 컬럼과 동일 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        right: `${formGeo.right}px`,
        width: `${formGeo.width}px`,
        background: 'white',
        padding: '1rem 1.25rem',
        boxShadow: '0 -6px 20px rgba(15,23,42,0.12)',
        border: '1px solid #E2E8F0',
        borderBottom: 'none',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        zIndex: 100,
        boxSizing: 'border-box',
      }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: '4px' }}>📝 {spec.id} 화면 내용 등록</h3>
        <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginBottom: '8px' }}>
          {markingMode
            ? '왼쪽 미리보기에서 영역을 드래그하세요.'
            : '영역 지정 후 제목·내용을 입력하면 해당 영역에 번호가 매핑됩니다.'}
        </p>

        {/* 영역 지정 row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <button
            onClick={() => { setMarkingMode(true); setPendingRegion(null); }}
            disabled={markingMode}
            style={{
              padding: '6px 12px',
              background: markingMode ? '#CBD5E1' : (pendingRegion ? '#F8FAFC' : '#10B981'),
              color: markingMode ? 'white' : (pendingRegion ? '#10B981' : 'white'),
              border: pendingRegion ? '1px solid #10B981' : 'none',
              borderRadius: '6px',
              fontSize: 'var(--neo-font-size-sm)',
              fontWeight: 700,
              cursor: markingMode ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📍 {markingMode ? '드래그 중...' : (pendingRegion ? '영역 재지정' : '영역 지정')}
          </button>
          {pendingRegion && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--neo-font-size-xs)', color: '#F59E0B', fontWeight: 700 }}>
              ✅ 영역 지정됨
              <button
                onClick={() => setPendingRegion(null)}
                style={{ background: 'transparent', border: 'none', color: '#F59E0B', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', padding: '0 4px' }}
                title="영역 취소"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="제목"
          style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, marginBottom: '6px', boxSizing: 'border-box', background: '#F8FAFC' }}
        />
        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder="내용"
          rows={2}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 'var(--neo-font-size-sm)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#F8FAFC' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            onClick={addNote}
            disabled={!draftTitle.trim() || !draftContent.trim()}
            style={{
              padding: '7px 20px',
              background: (draftTitle.trim() && draftContent.trim()) ? '#10B981' : '#CBD5E1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: 'var(--neo-font-size-sm)',
              fontWeight: 700,
              cursor: (draftTitle.trim() && draftContent.trim()) ? 'pointer' : 'not-allowed',
            }}
          >
            + 등록
          </button>
        </div>
      </div>

    </div>
  );
};

export default SpecViewer;
