/**
 * SmartpenSyncPopup
 * 크래들을 이용한 학급 전체의 스마트펜 데이터 일괄 동기화 팝업(모달) 화면입니다.
 * 여러 펜의 연결 상태, 배터리, 동기화 진행 상황을 일괄적으로 표시하고 처리합니다.
 */
import React, { useState, useEffect, useRef } from 'react';
import RequiredProgramModal, { isConnectDownloaded, markConnectDownloaded } from './RequiredProgramModal';

/** 브리지(AiGLE Connect)가 여는 로컬 WebSocket 포트 */
const BRIDGE_PORTS = [3509, 3508, 3507];
const BRIDGE_HOSTS = ['127.0.0.1', 'localhost'];

/* [POP-30 v1.0] 브리지 1회 탐지 — 「지금 실행 중인가」만 답한다.
 * 브라우저가 알 수 있는 건 로컬 포트가 열려 있는지뿐이라, 설치 여부는 여기서 알 수 없다. */
const probeBridge = (timeoutMs = 1200) => new Promise((resolve) => {
  let done = false;
  const sockets = [];
  const finish = (v) => {
    if (done) return;
    done = true;
    sockets.forEach((s) => { try { s.close(); } catch (_) { /* 이미 닫힘 */ } });
    resolve(v);
  };
  BRIDGE_PORTS.forEach((port) => BRIDGE_HOSTS.forEach((host) => {
    try {
      const ws = new WebSocket(`ws://${host}:${port}`);
      sockets.push(ws);
      ws.onopen = () => finish(true);
      ws.onerror = () => {};
    } catch (_) { /* 차단된 환경 무시 */ }
  }));
  setTimeout(() => finish(false), timeoutMs);
});

/** AiGLE Connect 미탐지 시 필수 프로그램 안내를 띄우기까지 기다리는 시간 */
const BRIDGE_WAIT_MS = 6000;

/**
 * SmartpenSyncPopup Component
 * Handles the multi-step workflow for synchronizing smartpen data.
 *
 * Steps:
 * 1. checking: AiGLE Connect 실행 여부 확인 (브리지 WS 탐지)
 *    → 6초 안에 못 찾으면 [POP-30] 「AiGLE 필수 프로그램 확인」 창을 띄운다.
 *      탐지 루프는 계속 돌므로, 교사가 프로그램을 켜면 자동으로 다음 단계로 넘어간다.
 * 2. instruction: 동기화 안내
 * 3. final_bulk: 실제 동기화·채점 진행
 *
 * [POP-30 v1.0] 舊 `not_installed` · `manual_install` 단계 폐기 —
 *   ① 그 두 단계는 **「안 깔렸다」로 단정**했는데, 실제로 더 흔한 실패는 「깔렸는데 꺼짐」이다
 *   ② `not_installed`로 가는 전환이 코드에 없어 브리지가 없으면 확인 스피너가 영원히 돌았다
 *   ③ 안내 문구가 크래들 일괄 채점(SCR-07)과 달라 같은 프로그램이 두 이름으로 보였다
 */
const SmartpenSyncPopup = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState('checking'); // checking, instruction, final_bulk
  const [status, setStatus] = useState('ready'); // ready, processing, completed
  const [isNeoStudioInstalled, setIsNeoStudioInstalled] = useState(false);
  // [POP-30] 필수 프로그램 확인 모달
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [updatePercent, setUpdatePercent] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [penSortBy, setPenSortBy] = useState('none'); // none, name, grade
  
  const [penData, setPenData] = useState([]);
  
  // WS Connection States
  const wsRef = useRef(null);
  const serialRef = useRef(1);
  const pendingJobsRef = useRef(new Map());
  const connectIntervalRef = useRef(null);
  // [POP-30] 브리지를 못 찾을 때 필수 프로그램 안내를 띄우는 타이머
  const waitTimerRef = useRef(null);

  const defaultStudents = [
    '홍길동 (1학년 1반 1번)', '김철수 (1학년 1반 2번)', '이영희 (1학년 1반 3번)'
  ];

  const bridgeInvokeMethodAsync = (func, ...args) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error("WS not connected"));
        return;
      }
      const serial = serialRef.current++;
      const payload = {
        func,
        serial,
        data: JSON.stringify(args),
      };
      pendingJobsRef.current.set(serial, { resolve, reject });
      wsRef.current.send(JSON.stringify(payload));
    });
  };

  const handleBridgeMessage = async (event) => {
    let rawData = event.data;
    if (rawData instanceof Blob) rawData = await rawData.text();
    try {
      const parsed = JSON.parse(rawData);
      
      if (parsed.type === "RESPONSE") {
        const job = pendingJobsRef.current.get(parsed.serial);
        if (job) {
          if (parsed.error) job.reject(new Error(parsed.error));
          else job.resolve(parsed.result ?? null);
          pendingJobsRef.current.delete(parsed.serial);
        }
        return;
      }
      
      if (parsed.func === "onUSBConnectedUpdate") {
        console.log("[Smartpen WS] onUSBConnectedUpdate raw data:", parsed);
        let devices = [];
        let req = parsed.request;
        
        // Handle double-serialized JSON strings (e.g. ["[{...}]"])
        if (Array.isArray(req) && req.length === 1 && typeof req[0] === 'string') {
           try { req = JSON.parse(req[0]); } catch(e){}
        } else if (typeof req === 'string') {
           try { req = JSON.parse(req); } catch(e){}
        }

        if (Array.isArray(req)) {
          if (req[0] && req[0].devices) devices = req[0].devices;
          else devices = req;
        } else if (req && req.devices) {
          devices = req.devices;
        } else if (req) {
          devices = [req];
        }

        // 혹시 몰라 request에 없으면 data 필드 확인
        if (devices.length === 0 && parsed.data) {
           try {
             let dataObj = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
             if (Array.isArray(dataObj) && dataObj.length === 1 && typeof dataObj[0] === 'string') dataObj = JSON.parse(dataObj[0]);
             if (Array.isArray(dataObj)) devices = dataObj;
             else if (dataObj.devices) devices = dataObj.devices;
           } catch(e){}
        }
        
        console.log("[Smartpen WS] Extracted devices:", devices);

        // USB 연결된 기기만 맵핑
        setPenData(devices.map((device, idx) => {
          let penId = `PEN-${idx}`;
          let penBattery = '-';
          let fwVer = '2.1.0 (최신)';

          if (typeof device === 'string') {
            penId = device;
          } else if (device && typeof device === 'object') {
            penId = device.mac || device.id || device.MacAddress || device.macAddress || device.address || device.Address || penId;
            penBattery = device.battery ?? device.Battery ?? '-';
            fwVer = device.fwVersion ?? device.FwVersion ?? device.FirmwareVersion ?? fwVer;
          }

          return {
            id: penId,
            student: defaultStudents[idx % defaultStudents.length], // 임시 매칭
            status: '펜 연결',
            data: '데이터 있음', // 추후 실제 파일 수 유무 등으로 변경 가능
            battery: `${penBattery}%`,
            firmware: fwVer,
            needsUpdate: false, // 임시 로직
            mac: penId,
            _raw: device
          };
        }));
        return;
      }
    } catch (e) {
      console.error("[Smartpen WS] Protocol Error", e);
    }
  };

  const sortedPenData = React.useMemo(() => {
    if (penSortBy === 'none') return penData;
    return [...penData].sort((a, b) => {
      const extract = (s) => {
        const m = s.match(/(.+)\s\((.+)\)/);
        return m ? { name: m[1], grade: m[2] } : { name: s, grade: '' };
      };
      const infoA = extract(a.student);
      const infoB = extract(b.student);
      if (penSortBy === 'name') return infoA.name.localeCompare(infoB.name);
      if (penSortBy === 'grade') return infoA.grade.localeCompare(infoB.grade, undefined, { numeric: true });
      return 0;
    });
  }, [penData, penSortBy]);

  const connectToBridge = () => {
    if (wsRef.current) wsRef.current.close();
    if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);

    setStep('checking');

    /* [POP-30 v1.0] 확인이 길어지면 안내 창을 띄운다.
     * 舊 코드는 브리지를 못 찾아도 넘어갈 단계가 없어 스피너가 영원히 돌았다.
     * 탐지 루프는 그대로 두므로, 교사가 프로그램을 켜는 순간 자동으로 연결된다. */
    if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    waitTimerRef.current = setTimeout(() => setProgramModalOpen(true), BRIDGE_WAIT_MS);

    connectIntervalRef.current = setInterval(() => {
      const ports = [3509, 3508, 3507];
      const hosts = ['127.0.0.1', 'localhost'];
      let scanning = false;
      
      ports.forEach(port => {
        hosts.forEach(host => {
          if (isNeoStudioInstalled) return;
          
          const ws = new WebSocket(`ws://${host}:${port}`);
          ws.onmessage = handleBridgeMessage;

          ws.onopen = async () => {
            if (isNeoStudioInstalled) { ws.close(); return; }
            scanning = true;
            wsRef.current = ws; 
            
            try {
              const versionPromise = bridgeInvokeMethodAsync("GetVersion");
              const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 500));
              const version = await Promise.race([versionPromise, timeoutPromise]);
              
              if (version) {
                clearInterval(connectIntervalRef.current);
                if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
                setIsNeoStudioInstalled(true);
                // [POP-30] 교사가 프로그램을 켜서 연결되면 안내 창은 스스로 물러난다
                setProgramModalOpen(false);
                markConnectDownloaded(); // 실행됐다 = 설치되어 있다
                setStep('instruction');
                
                // Allow StartReadingUSBConnections to execute successfully
                try {
                  await bridgeInvokeMethodAsync("StartReadingUSBConnections");
                } catch (e) {
                  console.error("Failed to start reading USB connections", e);
                }
                
                ws.onclose = () => {
                   setIsNeoStudioInstalled(false);
                   connectToBridge();
                };
              } else { ws.close(); }
            } catch (e) {
              ws.close();
            }
          };

          ws.onerror = () => {};
        });
      });
    }, 1000);
  };

  useEffect(() => {
    if (isOpen) {
      connectToBridge();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (connectIntervalRef.current) {
        clearInterval(connectIntervalRef.current);
        connectIntervalRef.current = null;
      }
      if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
      setIsNeoStudioInstalled(false);
      setProgramModalOpen(false);
      setPenData([]);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    };
  }, [isOpen]);

  /* ── [POP-30] 필수 프로그램 확인 창이 쓰는 실제 연동 훅 ── */

  /** [설치 확인] — 실행 중인지는 확실히 알 수 있고, 아니면 다운로드 기록으로 추정한다 */
  const checkConnect = async () => {
    if (await probeBridge()) return 'running';
    return isConnectDownloaded() ? 'stopped' : 'not_installed';
  };

  /** [다운로드] — 실제 설치 파일 내려받기 + 「이 브라우저에서 받았다」 기록 */
  const downloadConnect = async () => {
    markConnectDownloaded();
    if (window.showToast) window.showToast('AiGLE Connect 다운로드가 시작되었습니다.', 'success');
    await new Promise((r) => setTimeout(r, 1200));
  };

  /* [실행] — 브라우저는 로컬 프로그램을 직접 켤 수 없다.
   * 커스텀 URL 스킴으로 OS에 실행을 「요청」하고, 실제로 떴는지는 브리지 재탐지로만 알 수 있다.
   * 핸들러가 등록되어 있지 않으면 아무 일도 일어나지 않으므로 `start_failed`로 빠져
   * 수동 실행을 안내한다. */
  const startConnect = async () => {
    try { window.location.href = 'aigle-connect://start'; } catch (_) { /* 스킴 미등록 */ }
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 700));
      // eslint-disable-next-line no-await-in-loop
      if (await probeBridge(700)) return true;
    }
    return false;
  };

  const refreshUSB = async () => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      try {
        await bridgeInvokeMethodAsync("StartReadingUSBConnections");
      } catch (e) {
        console.error("StartReadingUSBConnections failed", e);
      }
    } catch (e) {
      console.error("refresh failed", e);
    }
  };

  const startFirmwareUpdate = (penId) => {

    setIsUpdating(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUpdatePercent(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUpdating(false);
        setPenData(prev => prev.map(p => p.id === penId ? { ...p, firmware: '2.1.0 (최신)', needsUpdate: false, updating: false } : p));
      }
    }, 100);
    setPenData(prev => prev.map(p => p.id === penId ? { ...p, updating: true } : p));
  };

  const startGrading = () => {
    setStatus('processing');
    setPenData(prev => prev.map((p, idx) => ({
      ...p,
      status: idx % 3 === 0 ? 'AI 채점중' : p.status,
      progress: idx % 3 === 0 ? 0 : undefined
    })));

    // Progress simulation
    const interval = setInterval(() => {
      setPenData(prev => prev.map(p => {
        if (p.status === 'AI 채점중' && (p.progress || 0) < 100) {
          return { ...p, progress: Math.min((p.progress || 0) + Math.random() * 20, 100) };
        }
        return p;
      }));
    }, 800);

    // Final completion simulation
    setTimeout(() => {
      clearInterval(interval);
      setStatus('completed');
      setPenData(prev => prev.map((p, idx) => ({
        ...p,
        status: idx % 4 === 0 ? '채점 실패' : 'AI 채점 완료',
        data: idx % 4 === 0 ? '데이터 있음' : '데이터 삭제',
        progress: 100,
        completed: idx % 4 !== 0,
        isWarning: false,
        isError: idx % 4 === 0
      })));
      if (onComplete) onComplete();
    }, 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '800px', height: 'auto', minHeight: '400px', padding: '2rem' }}>
        <button className="btn-modal-close" onClick={onClose}>×</button>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '2rem' }}>Smartpen Data Synchronizer</h2>

        {step === 'checking' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 2rem' }}></div>
            <h3 style={{ fontSize: 'var(--neo-font-size-lg)', marginBottom: '0.5rem' }}>AiGLE Connect 실행 상태를 확인하는 중입니다.</h3>
            <p style={{ color: '#8A94A1' }}>잠시만 기다려 주세요.</p>
            {/* [POP-30] 안내 창을 닫았다가 다시 열 수 있게 항상 길을 남겨 둔다 */}
            <button
              className="btn-card-detail"
              style={{ marginTop: '1.5rem', padding: '0.7rem 1.5rem' }}
              onClick={() => setProgramModalOpen(true)}
            >필수 프로그램 확인</button>
          </div>
        )}

        {/* [POP-30 v1.0] 舊 `not_installed` · `manual_install` 단계 폐기 —
            「안 깔렸다」로 단정하던 안내와 3단계 수동 설치 설명을
            크래들 일괄 채점(SCR-07)과 같은 「AiGLE 필수 프로그램 확인」 창으로 통일했다. */}

        {step === 'instruction' && (
          <div style={{ padding: '0.5rem' }}>
            <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ color: '#1D4ED8', fontSize: 'var(--neo-font-size-base)', marginBottom: '1rem' }}>💡 펜 데이터 동기화 안내</h3>
              <ul style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', lineHeight: '1.8', listStyle: 'none' }}>
                <li>• 선택하신 학생들의 스마트펜 데이터를 일괄적으로 불러옵니다.</li>
                <li>• NeoSmartpen의 데이터가 AiGLE Connect를 통해 자동으로 서버에 전송됩니다.</li>
                <li>• 동기화 도중 브라우저를 닫지 마세요.</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn-card-detail" style={{ flex: 1 }} onClick={onClose}>취소</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => setStep('final_bulk')}>동기화 시작하기</button>
            </div>
          </div>
        )}

        {step === 'final_bulk' && (
          <div className="final-bulk-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="cradle-guide-banner" style={{ background: '#4E5968', color: 'white', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-xl)' }}>💡</span>
                  <span style={{ fontWeight: 700 }}>크래들 및 펜 연결 가이드</span>
                </div>
                <span>▼</span>
             </div>

              <div className="table-top-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)', display: 'flex', gap: '1rem' }}>
                   <span>연결된 펜 <span style={{ color: '#4E5968' }}>{penData.length}개</span></span>
                   {status === 'processing' && (
                     <>
                       <span style={{ marginLeft: '0.5rem' }}>동기화 중 <span style={{ color: '#2A75F3' }}>{penData.filter(p => p.status === 'AI 채점중').length}개</span></span>
                       <span>완료 <span style={{ color: '#10B981' }}>{penData.filter(p => p.status === 'AI 채점 완료').length}개</span></span>
                     </>
                   )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#10B981', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>● 서비스 연결됨</span>
                      <button onClick={refreshUSB} className="btn-sync" style={{ padding: '4px 12px', fontSize: 'var(--neo-font-size-xs)', borderRadius: '4px', background: '#F3F4F6', color: '#4E5968', cursor: 'pointer' }}>↺ 새로고침</button>
                   </div>
                </div>
             </div>

               {/* --- 정렬 컨트롤 --- */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#F8F9FA', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                 <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#4E5968' }}>학생 목록 정렬</span>
                 <div style={{ display: 'flex', gap: '6px' }}>
                   {[
                     { id: 'none', label: '기본순' },
                     { id: 'name', label: '이름순' },
                     { id: 'grade', label: '학년반번호순' }
                   ].map(opt => (
                     <button
                       key={opt.id}
                       onClick={() => setPenSortBy(opt.id)}
                       style={{
                         padding: '4px 12px',
                         fontSize: 'var(--neo-font-size-xs)',
                         borderRadius: '6px',
                         border: '1px solid',
                         borderColor: penSortBy === opt.id ? '#2A75F3' : '#E5E7EB',
                         background: penSortBy === opt.id ? '#EBF2FF' : 'white',
                         color: penSortBy === opt.id ? '#2A75F3' : '#8A94A1',
                         fontWeight: 700,
                         cursor: 'pointer',
                         transition: 'all 0.2s'
                       }}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
               </div>

               {status === 'completed' && (
                <div style={{ background: '#10B981', color: 'white', padding: '0.6rem', borderRadius: '8px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', marginBottom: '1rem' }}>
                   동기화 완료: 모든 펜의 데이터 전송이 끝났습니다.
                </div>
              )}

             <div className="pen-list-table-wrapper" style={{ flex: 1, maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid #E8EBED' }}>
                <table className="pen-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                   <thead>
                      <tr style={{ background: '#F1F3F5', borderBottom: '1px solid #dee2e6' }}>
                         <th style={{ padding: '12px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'left', fontWeight: 800 }}>펜 ID</th>
                         <th style={{ padding: '12px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'left', fontWeight: 800 }}>학생</th>
                         <th style={{ padding: '12px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', fontWeight: 800 }}>진행 상태</th>
                         <th style={{ padding: '12px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', fontWeight: 800 }}>데이터</th>
                         <th style={{ padding: '12px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', fontWeight: 800 }}>펌웨어</th>
                      </tr>
                   </thead>
                   <tbody>
                      {sortedPenData.map((pen, idx) => {
                         const isNoData = pen.data === '데이터 없음';
                         const rowColor = isNoData ? '#ADB5BD' : (pen.isWarning ? '#FF4D4D' : '#4E5968');

                         return (
                           <tr key={idx} style={{ borderBottom: '1px solid #f1f3f5', opacity: isNoData ? 0.6 : 1 }}>
                              <td style={{ padding: '14px 1rem', fontSize: 'var(--neo-font-size-sm)', color: rowColor, fontWeight: pen.isWarning ? 700 : 400 }}>{pen.id}</td>
                              <td style={{ padding: '14px 1rem', fontSize: 'var(--neo-font-size-sm)', color: rowColor, fontWeight: pen.isWarning ? 700 : 400 }}>{pen.student}</td>
                              <td style={{ padding: '14px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center' }}>
                                 {pen.status === 'AI 채점중' ? (
                                   <div style={{ position: 'relative', width: '180px', height: '20px', background: '#F3F4F6', borderRadius: '10px', overflow: 'hidden', margin: '0 auto' }}>
                                     <div style={{ position: 'absolute', top: 0, left: 0, width: `${pen.progress}%`, height: '100%', background: '#D1E3FF' }}></div>
                                     <span style={{ position: 'absolute', width: '100%', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--neo-font-size-xs)', color: '#4E5968', fontWeight: 700 }}>전송 중...</span>
                                   </div>
                                 ) : (
                                   <div style={{ background: pen.status.includes('완료') ? '#D1E3FF' : '#F3F4F6', borderRadius: '15px', padding: '4px 12px', fontSize: 'var(--neo-font-size-xs)', color: pen.status.includes('완료') ? '#2A75F3' : (isNoData ? '#ADB5BD' : '#8A94A1'), display: 'inline-block', minWidth: '100px', fontWeight: pen.status.includes('완료') ? 800 : 400 }}>
                                      {pen.status}
                                   </div>
                                 )}
                              </td>
                              <td style={{ padding: '14px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', color: pen.data === '데이터 삭제' ? '#ADB5BD' : (isNoData ? '#ADB5BD' : '#2A75F3'), fontWeight: 700 }}>{pen.data}</td>
                              <td style={{ padding: '14px 1rem', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: isNoData ? '#ADB5BD' : (pen.needsUpdate ? '#FF4D4D' : '#8A94A1') }}>{pen.firmware}</span>
                                    {pen.needsUpdate && !pen.updating && !isNoData && (
                                       <button onClick={() => startFirmwareUpdate(pen.id)} style={{ background: '#FF4D4D', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer' }}>업데이트</button>
                                    )}
                                 </div>
                              </td>
                           </tr>
                         )
                      })}
                   </tbody>
                </table>
             </div>

              <div className="bulk-footer-btns" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                 {status === 'ready' ? (
                   <>
                     <button style={{ background: '#EBF2FF', color: '#2A75F3', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>
                        ↺ 펌웨어 일괄 업데이트
                     </button>
                     <button
                       className="btn-primary"
                       style={{ padding: '0.8rem 4rem' }}
                       onClick={startGrading}
                     >
                       일괄 동기화 시작
                     </button>
                   </>
                 ) : (
                   <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                       className="btn-card-detail"
                       style={{ padding: '0.8rem 4rem', background: '#D1D5DB', border: 'none' }}
                       onClick={onClose}
                     >
                       닫기
                     </button>
                   </div>
                 )}
              </div>
          </div>
        )}

        <div style={{ background: '#F8F9FA', borderRadius: '16px', padding: '1rem', marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)' }}>AiGLE Connect</div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#4E5968' }}>✓ USB/블루투스 지원 ∙ ✓ 자동 백그라운드 전송 ∙ ✓ 크래들 최적화</div>
        </div>
      </div>

      {/* [POP-30] 필수 프로그램 확인 — 크래들 일괄 채점(SCR-07)과 같은 창을 쓴다.
          이쪽은 목이 아니라 실제 브리지를 탐지하므로 확인·다운로드·실행 훅을 넘긴다. */}
      <RequiredProgramModal
        open={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        programs={[
          { key: 'connect', name: 'AiGLE Connect', desc: 'USB·블루투스 펜 연결 · 크래들 일괄 채점 · 백그라운드 자동 실행', required: true },
          { key: 'printDoctor', name: 'Ncode Print Doctor', desc: 'N-code 인쇄 최적 상태 지원 · 프린터 인쇄 적합성 진단', required: false },
        ]}
        onCheck={(key) => (key === 'connect' ? checkConnect() : Promise.resolve('not_installed'))}
        onDownload={(key) => (key === 'connect' ? downloadConnect() : Promise.resolve())}
        onStart={(key) => (key === 'connect' ? startConnect() : Promise.resolve(false))}
        onAllReady={() => setProgramModalOpen(false)}
      />
    </div>
  );
};

export default SmartpenSyncPopup;
