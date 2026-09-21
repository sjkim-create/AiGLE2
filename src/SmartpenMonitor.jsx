/**
 * SmartpenMonitor.jsx
 * 스마트펜 BLE 모니터링 화면
 * 교실 내 등록된 NPEN 디바이스의 BLE Advertisement 상태를 실시간으로 표시합니다.
 * (웹 프로토타입 - 시뮬레이션 데이터 사용)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

const CARD_MIN_WIDTH = 220; // 카드 최소 폭(px) — 반응형 auto-fill 기준
const TIMEOUT_SEC = 10;
const LOADING_DELAY_MS = 800;
const DEBOUNCE_MS = 300;
const STORAGE_KEY = 'smartpen-monitor-filter';

// 현재 로그인 교사의 소속 학교 (서버에서 전달받는 값)
const CURRENT_SCHOOL = '서울초등학교';

// 해당 학교에 등록된 그룹(반) 목록 — 서버에서 조회
const REGISTERED_GROUPS = [
  { grade: '3학년', classNum: '1반' },
  { grade: '3학년', classNum: '2반' },
  { grade: '4학년', classNum: '1반' },
  { grade: '4학년', classNum: '2반' },
  { grade: '4학년', classNum: '3반' },
  { grade: '5학년', classNum: '1반' },
];

// [v2.0] 본 교사가 출제한 진행 중 과제 목록 (mock — 서버에서 조회)
// 진행 중 = 미채점 답안 1건 이상 있는 과제
const ASSIGNMENTS = [
  { id: 1, subject: '수학', name: '단원3 평가', date: '26.05.06' },
  { id: 2, subject: '수학', name: '비례식 평가', date: '26.04.18' },
  { id: 3, subject: '국어', name: '문학 단원 평가', date: '26.04.10' },
  { id: 4, subject: '국어', name: '서술형 모의고사', date: '26.04.30' },
];

// 과제별 배포 그룹 + 미채점 건수 (mock — 10초 polling으로 갱신)
// 미채점 0건이면 자동 제외 (=종료, 노출 안 함)
const ASSIGNMENT_GROUPS = {
  1: [
    { grade: '3학년', classNum: '1반', studentCount: 28, ungradedCount: 22 },
    { grade: '3학년', classNum: '2반', studentCount: 27, ungradedCount: 18 },
    { grade: '4학년', classNum: '1반', studentCount: 30, ungradedCount: 14 },
  ],
  2: [
    { grade: '4학년', classNum: '2반', studentCount: 29, ungradedCount: 20 },
    { grade: '4학년', classNum: '3반', studentCount: 28, ungradedCount: 16 },
  ],
  3: [
    { grade: '3학년', classNum: '1반', studentCount: 28, ungradedCount: 25 },
    { grade: '3학년', classNum: '2반', studentCount: 27, ungradedCount: 21 },
  ],
  4: [
    { grade: '5학년', classNum: '1반', studentCount: 25, ungradedCount: 19 },
  ],
};

// localStorage 필터 저장/복원
function loadSavedFilter() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && REGISTERED_GROUPS.some(g => g.grade === saved.grade && g.classNum === saved.classNum)) {
      return saved;
    }
  } catch { /* ignore */ }
  const first = REGISTERED_GROUPS[0];
  return { grade: first?.grade || '', classNum: first?.classNum || '' };
}

function saveFilter(grade, classNum) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ grade, classNum }));
}

// 학생명 mock pool (반 별로 22명까지 사용)
const STUDENT_NAMES = [
  '강길동', '김민준', '이서연', '박지호', '최유진', '정도윤', '윤하은', '서지우', '강도훈', '한가은',
  '오시현', '한지민', '신유찬', '조나린', '홍서아', '문은채', '백지호', '오시아', '강예린', '이도현',
  '진소은', '한지안',
];

// 16진 한 옥텟 생성
const hexOctet = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
// BT MAC 주소 (XX:XX:XX:XX:XX:XX)
const generateBtMac = () => Array.from({ length: 6 }, hexOctet).join(':');

// 시뮬레이션용 더미 디바이스 목록 (v4.5 — 카드 필드 4종 단순화)
function generateDemoDevices(gradeNum, classNum) {
  return Array.from({ length: 22 }, (_, i) => {
    const num = i + 1;
    return {
      grade: gradeNum,
      classNum: classNum,
      studentNum: num,
      studentName: STUDENT_NAMES[i % STUDENT_NAMES.length],
      rssi: -(45 + Math.floor(Math.random() * 35)),
      battery: Math.floor(Math.random() * 80) + 20,
      btMac: generateBtMac(),
    };
  });
}

const emptySlots = (count) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, null]));
const emptyStatus = (count) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, 'timeout']));

const SmartpenMonitor = () => {
  // [v2.0] 초기 그룹 미선택 → placeholder 노출 (사용자 chip 선택 후에만 슬롯 그리드 렌더)
  const [grade, setGrade] = useState('');
  const [classNum, setClassNum] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // 에러 토스트 메시지
  const [totalSlots, setTotalSlots] = useState(0); // 등록 디바이스 수 = 전체 슬롯 수
  // [v2.0] 과제 셀렉트 + 그룹 chip list — 단일 화면. 그룹 미선택 시 placeholder, 선택 시 슬롯 그리드 렌더
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(ASSIGNMENTS[0]?.id || null);
  const selectedAssignment = ASSIGNMENTS.find(a => a.id === selectedAssignmentId);
  const assignmentGroups = ASSIGNMENT_GROUPS[selectedAssignmentId] || [];
  // 그룹 선택 여부 (classNum이 비어있으면 미선택 = placeholder 노출)
  const hasGroupSelected = grade && classNum;

  // [v4.5] slots: { [1..N]: { grade, classNum, studentNum, studentName, rssi, battery, btMac, lastSeen } | null }
  const [slots, setSlots] = useState({});
  const [slotStatus, setSlotStatus] = useState({}); // 'active' | 'timeout'

  const deviceSlotMap = useRef({});
  const slotUsed = useRef(new Set());
  const demoDevices = useRef([]);
  const timerRef = useRef(null);
  const debounceRef = useRef(null);

  // 반 변경 시 상태 초기화 + 로딩
  const resetMonitor = useCallback((gradeNum, cn) => {
    setLoading(true);
    setScanning(false);
    const devices = generateDemoDevices(gradeNum, cn);
    const count = devices.length;
    demoDevices.current = devices;
    setTotalSlots(count);
    setSlots(emptySlots(count));
    setSlotStatus(emptyStatus(count));
    deviceSlotMap.current = {};
    slotUsed.current = new Set();

    setTimeout(() => {
      setLoading(false);
      setScanning(true);
    }, LOADING_DELAY_MS);
  }, []);

  // 필터 저장
  useEffect(() => {
    saveFilter(grade, classNum);
  }, [grade, classNum]);

  // 학교/학년/반 변경 핸들러 (debounce 적용)
  const handleClassChange = (newGrade, newClass) => {
    setGrade(newGrade);
    setClassNum(newClass);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const gn = parseInt(newGrade);
      const cn = parseInt(newClass);
      resetMonitor(gn, cn);
    }, DEBOUNCE_MS);
  };

  // [v2.0] 초기 로딩 제거 — 그룹 선택 후 handleClassChange 호출 시점에 resetMonitor 실행

  // 시뮬레이션 BLE 스캔
  useEffect(() => {
    if (!scanning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // 첫 번째 배치: 즉시 일부 디바이스 표시
    const initialBatch = demoDevices.current.slice(0, 15);
    initialBatch.forEach((dev) => assignAndUpdate(dev));

    // 이후 주기적으로 ADV 수신 시뮬레이션
    timerRef.current = setInterval(() => {
      const now = Date.now();

      // 무작위로 일부 디바이스 업데이트
      const active = demoDevices.current.filter(() => Math.random() > 0.2);
      active.forEach((dev) => {
        // RSSI 약간 변동
        const updatedDev = {
          ...dev,
          rssi: Math.max(-100, Math.min(-30, dev.rssi + Math.floor(Math.random() * 7) - 3)),
          battery: Math.max(1, dev.battery - (Math.random() > 0.97 ? 1 : 0)),
        };
        assignAndUpdate(updatedDev);
      });
    }, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scanning]);

  // 타임아웃 체크
  useEffect(() => {
    const checker = setInterval(() => {
      const now = Date.now();
      setSlots((prev) => {
        const keys = Object.keys(prev);
        const nextStatus = {};
        for (const s of keys) {
          if (prev[s] && prev[s].lastSeen) {
            const elapsed = (now - prev[s].lastSeen) / 1000;
            nextStatus[s] = elapsed > TIMEOUT_SEC ? 'timeout' : 'active';
          } else {
            nextStatus[s] = 'timeout';
          }
        }
        setSlotStatus(nextStatus);
        return prev;
      });
    }, 1000);
    return () => clearInterval(checker);
  }, []);

  const assignAndUpdate = (dev) => {
    let slot = deviceSlotMap.current[dev.name];

    if (slot === undefined) {
      const sn = dev.studentNum;
      if (sn >= 1 && sn <= totalSlots && !slotUsed.current.has(sn)) {
        slot = sn;
      } else {
        for (let s = 1; s <= totalSlots; s++) {
          if (!slotUsed.current.has(s)) {
            slot = s;
            break;
          }
        }
      }
      if (slot === undefined) return;
      deviceSlotMap.current[dev.name] = slot;
      slotUsed.current.add(slot);
    }

    setSlots((prev) => ({
      ...prev,
      [slot]: { ...dev, lastSeen: Date.now() },
    }));
    setSlotStatus((prev) => ({ ...prev, [slot]: 'active' }));
  };

  // 요약 통계
  const activeCount = Object.values(slotStatus).filter((s) => s === 'active').length;
  const timeoutCount = Object.values(slotStatus).filter((s) => s === 'timeout').length;
  // [v4.7] 신호 수신 대기 상태 — 그룹 선택 후 첫 BLE 신호가 한 번도 들어오지 않은 상태
  const anySignalReceived = activeCount > 0;
  const isWaitingSignal = hasGroupSelected && !loading && totalSlots > 0 && !anySignalReceived;

  const getRSSIBars = (rssi) => {
    if (!rssi) return 0;
    if (rssi >= -55) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -75) return 2;
    return 1;
  };

  const getBatteryColor = (bat) => {
    if (bat >= 50) return '#10B981';
    if (bat >= 20) return '#FBBF24';
    return '#EF4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F4F7FB' }}>
      {/* 헤더 */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #E2E8F0',
        padding: '1.25rem 1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900, margin: 0, color: '#1E293B' }}>스마트펜 모니터링</h1>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', margin: 0, marginTop: '4px' }}>
              교실 내 디바이스의 BLE Advertisement 수신 상태를 실시간으로 확인합니다.
            </p>
          </div>

          {/* 스캔 상태 및 제어 버튼 - 우측 상단 고정 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: '#f8fafc', padding: '8px 16px', borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            {/* 상태 표시 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: loading ? '#94A3B8' : scanning ? '#22C55E' : '#EF4444',
                display: 'inline-block',
                animation: loading ? 'none' : scanning ? 'pulse 1.5s infinite' : 'none',
              }} />
              <span style={{
                fontSize: 'var(--neo-font-size-sm)',
                fontWeight: 800,
                color: loading ? '#94A3B8' : scanning ? '#15803D' : '#DC2626',
                letterSpacing: '0.5px'
              }}>
                {loading ? 'LOADING' : scanning ? 'SCANNING' : 'STOPPED'}
              </span>
            </div>

            <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

            {/* [v2.0] 제어 버튼 — 로딩 중·그룹 미선택 시 비활성화 */}
            <button
              onClick={() => !loading && hasGroupSelected && setScanning((prev) => !prev)}
              disabled={loading || !hasGroupSelected}
              title={!hasGroupSelected ? '그룹을 먼저 선택해 주세요.' : undefined}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: (loading || !hasGroupSelected) ? '#e2e8f0' : scanning ? '#cbd5e1' : '#DC2626',
                background: (loading || !hasGroupSelected) ? '#f1f5f9' : scanning ? 'white' : '#fee2e2',
                color: (loading || !hasGroupSelected) ? '#94A3B8' : scanning ? '#64748b' : '#dc2626',
                fontWeight: 800,
                fontSize: 'var(--neo-font-size-sm)',
                cursor: (loading || !hasGroupSelected) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                opacity: (loading || !hasGroupSelected) ? 0.6 : 1,
              }}
            >
              {scanning ? '⏸ 중지' : '▶ 시작'}
            </button>
          </div>
        </div>

        {/* [v2.0] 학교 + 과제 셀렉트 (단일 행) */}
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'center',
          background: '#f1f5f9', padding: '8px', borderRadius: '12px', width: 'fit-content'
        }}>
          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#64748B', marginLeft: '8px', marginRight: '4px' }}>모니터링 대상:</span>
          <span style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: '1.5px solid #E2E8F0',
            fontSize: 'var(--neo-font-size-sm)',
            fontWeight: 700,
            color: '#1E293B',
            background: 'white',
          }}>
            {CURRENT_SCHOOL}
          </span>
          <select
            value={selectedAssignmentId || ''}
            onChange={(e) => {
              setSelectedAssignmentId(Number(e.target.value));
              // 과제 변경 시 그룹 미선택 상태로 복귀 (placeholder)
              setGrade('');
              setClassNum('');
              setScanning(false);
            }}
            style={selectStyle}
          >
            {ASSIGNMENTS.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.subject}] {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* [v2.0] 그룹 chip list — 선택 과제에 배포된 그룹들 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#64748B' }}>그룹:</span>
          {assignmentGroups.length === 0 ? (
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontStyle: 'italic' }}>선택 과제에 배포된 진행 중 그룹이 없습니다.</span>
          ) : (
            assignmentGroups.map((g) => {
              const isSelected = grade === g.grade && classNum === g.classNum;
              return (
                <button
                  key={`${g.grade}|${g.classNum}`}
                  onClick={() => {
                    if (isSelected) {
                      // 재클릭 → 선택 해제 (placeholder 복귀)
                      setGrade('');
                      setClassNum('');
                      setScanning(false);
                    } else {
                      handleClassChange(g.grade, g.classNum);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: isSelected ? '1.5px solid #2A75F3' : '1px solid #CBD5E1',
                    background: isSelected ? '#EFF6FF' : 'white',
                    color: isSelected ? '#1D4ED8' : '#475569',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isSelected && <span>✓</span>}
                  {g.grade} {g.classNum}
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#DC2626', fontWeight: 800 }}>· 미채점 {g.ungradedCount}건</span>
                </button>
              );
            })
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @keyframes shimmer {
            0% { opacity: 0.4; }
            50% { opacity: 1; }
            100% { opacity: 0.4; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>

      {/* 에러 토스트 — 마지막 데이터 유지 상태에서 상단에 표시 */}
      {error && (
        <div style={{
          background: '#FEF2F2', borderBottom: '1px solid #FECACA',
          padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#DC2626', fontWeight: 600, flex: 1 }}>
            ⚠ {error}
          </span>
          <button
            onClick={() => { setError(null); setScanning(true); }}
            style={{
              padding: '4px 12px', borderRadius: '6px', border: '1px solid #FECACA',
              background: 'white', color: '#DC2626', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
            }}
          >
            재시도
          </button>
          <button
            onClick={() => setError(null)}
            style={{
              padding: '4px 8px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#94A3B8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* [v2.0] 그룹 미선택 placeholder — 슬롯 그리드 위치에 안내 */}
      {!hasGroupSelected && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '3rem',
          color: '#64748B',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📡</div>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
            위에서 모니터링할 그룹을 선택해 주세요.
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>
            선택 과제에 배포된 그룹 중 하나를 클릭하면 디바이스 모니터링이 시작됩니다.
          </div>
        </div>
      )}

      {/* [v4.7] 신호 수신 대기 placeholder — 그룹 선택 후 첫 BLE 신호가 들어오지 않은 상태 (그룹 미선택 안내와 동일 영역) */}
      {isWaitingSignal && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '3rem',
          color: '#64748B',
        }}>
          <div style={{
            fontSize: '3rem', marginBottom: '12px',
            animation: 'pulse 1.6s ease-in-out infinite',
          }}>📡</div>
          <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: '6px' }}>
            펜 신호를 수신하고 있습니다...
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', textAlign: 'center', lineHeight: 1.55, maxWidth: '420px' }}>
            번호표에 체크한 펜이 켜져 있어야 신호가 잡힙니다.<br />
            페어링 직후 신호가 잡힐 때까지 최대 30초가 소요될 수 있습니다.
          </div>
          <div style={{ marginTop: '14px', fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '8px', height: '8px',
              borderRadius: '50%', background: '#22C55E',
              animation: 'blink 1.2s ease-in-out infinite',
            }} />
            스캔 중 ({selectedAssignment?.subject} · {grade} {classNum})
          </div>
        </div>
      )}

      {/* 요약 통계 바 — 그룹 선택 + 신호 수신 후 노출 (v4.7: isWaitingSignal 동안 숨김) */}
      {hasGroupSelected && !isWaitingSignal && (
      <div style={{
        background: 'white',
        borderBottom: '1px solid #E2E8F0',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        gap: '2rem',
        flexShrink: 0,
      }}>
        {loading ? (
          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 600 }}>데이터를 불러오는 중…</span>
        ) : totalSlots === 0 ? (
          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontWeight: 600 }}>등록된 디바이스가 없습니다. 환경설정에서 펜 기기를 등록해 주세요.</span>
        ) : (
          <>
            <StatChip color="#475569" bg="#F1F5F9" label="전체" value={totalSlots} />
            <StatChip color="#22C55E" bg="#DCFCE7" label="수신 중 (활성)" value={activeCount} />
            <StatChip color="#EF4444" bg="#FEE2E2" label="미수신 (타임아웃)" value={timeoutCount} />
          </>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', alignSelf: 'center' }}>
          {CURRENT_SCHOOL} · {grade} · {classNum}
        </div>
      </div>
      )}

      {/* 슬롯 그리드 — monitoring view일 때만 노출 (v4.7: isWaitingSignal 동안 숨김) */}
      {hasGroupSelected && !isWaitingSignal && (
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '1.25rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_WIDTH}px, 1fr))`,
          gap: '10px',
        }}>
          {Array.from({ length: totalSlots }, (_, i) => {
            const num = i + 1;
            if (loading) return <SkeletonCard key={num} num={num} />;
            const data = slots[num];
            const status = slotStatus[num] || 'timeout';
            return (
              <SlotCard key={num} num={num} data={data} status={status} getRSSIBars={getRSSIBars} getBatteryColor={getBatteryColor} />
            );
          })}
        </div>
      </div>
      )}

      {/* 범례 — monitoring view일 때만 노출 (v4.7: isWaitingSignal 동안 숨김) */}
      {hasGroupSelected && !isWaitingSignal && (
      <div style={{
        background: 'white',
        borderTop: '1px solid #E2E8F0',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        gap: '1.5rem',
        fontSize: 'var(--neo-font-size-xs)',
        color: '#8A94A1',
        flexShrink: 0,
      }}>
        <LegendItem color="#DCFCE7" border="#BBF7D0" label="수신 중 (활성) — ADV 데이터 수신 중" />
        <LegendItem color="#FEE2E2" border="#FECACA" label={`미수신 (타임아웃) — ${TIMEOUT_SEC}초 이상 미수신`} />
        <span style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          BT MAC 주소 형식: XX:XX:XX:XX:XX:XX
        </span>
      </div>
      )}
    </div>
  );
};

const SkeletonCard = ({ num }) => (
  <div style={{
    background: 'white',
    border: '1.5px solid #E2E8F0',
    borderRadius: '12px',
    padding: '10px 12px',
    minHeight: '110px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', color: '#CBD5E1' }}>#{String(num).padStart(2, '0')}</span>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E2E8F0', display: 'inline-block' }} />
    </div>
    <div style={{ height: '10px', background: '#F1F5F9', borderRadius: '4px', width: '75%', animation: 'shimmer 1.5s infinite' }} />
    <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', width: '55%', animation: 'shimmer 1.5s infinite' }} />
    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '4px', width: '40%', animation: 'shimmer 1.5s infinite' }} />
  </div>
);

// [v4.5] 슬롯 카드 — 4개 필드 단순화 (학년·반·번호·학생명 / 신호 / 배터리 / BT MAC)
const SlotCard = ({ num, data, status, getRSSIBars, getBatteryColor }) => {
  const bgColor = status === 'active' ? '#F0FDF4' : '#FFF1F2';
  const borderColor = status === 'active' ? '#86EFAC' : '#FECACA';
  const dotColor = status === 'active' ? '#22C55E' : '#EF4444';

  return (
    <div style={{
      background: bgColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '12px 14px',
      minHeight: '130px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      transition: 'background 0.5s, border-color 0.5s',
      position: 'relative',
    }}>
      {/* 슬롯 번호 + 상태 점 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>#{String(num).padStart(2, '0')}</span>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
      </div>

      {data ? (
        <>
          {/* 학년·반·번호 · 학생명 */}
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.grade}학년 {data.classNum}반 {data.studentNum}번 {data.studentName}
          </div>

          {/* 신호 세기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', minWidth: '52px' }}>신호 세기</span>
            <RSSIBars bars={getRSSIBars(data.rssi)} active={status === 'active'} />
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700 }}>{data.rssi}dBm</span>
          </div>

          {/* 배터리 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', minWidth: '52px' }}>배터리</span>
            <div style={{
              width: '40px', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${data.battery}%`, height: '100%',
                background: getBatteryColor(data.battery),
                borderRadius: '4px',
                transition: 'width 0.5s',
              }} />
            </div>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700 }}>{data.battery}%</span>
          </div>

          {/* BT MAC */}
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.btMac}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#CBD5E1' }}>—</span>
        </div>
      )}
    </div>
  );
};

const RSSIBars = ({ bars, active }) => {
  const color = active ? '#22C55E' : '#CBD5E1';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5px', height: '10px' }}>
      {[1, 2, 3, 4].map((b) => (
        <div key={b} style={{
          width: '3px',
          height: `${b * 2.5}px`,
          background: b <= bars ? color : '#E2E8F0',
          borderRadius: '1px',
        }} />
      ))}
    </div>
  );
};

const StatChip = ({ color, bg, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#4E5968' }}>{label}</span>
    <span style={{
      fontSize: 'var(--neo-font-size-sm)', fontWeight: 800,
      background: bg, color, padding: '1px 8px', borderRadius: '6px',
    }}>{value}</span>
  </div>
);

const LegendItem = ({ color, border, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ width: '14px', height: '14px', background: color, border: `1.5px solid ${border}`, borderRadius: '4px' }} />
    <span>{label}</span>
  </div>
);

const selectStyle = {
  padding: '0.4rem 0.75rem',
  borderRadius: '8px',
  border: '1.5px solid #E2E8F0',
  fontSize: 'var(--neo-font-size-sm)',
  fontWeight: 600,
  color: '#4E5968',
  background: 'white',
  cursor: 'pointer',
  outline: 'none',
};

export default SmartpenMonitor;
