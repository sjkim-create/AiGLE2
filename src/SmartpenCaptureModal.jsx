/**
 * 스마트펜 연동
 * 학생 개별 단말을 통한 스마트펜 필기 데이터 연동 팝업(모달) 화면입니다.
 * WebSocket을 통해 로컬 브릿지(StrokeReaderDemoApp)와 통신하여 실시간으로 펜을 찾고 데이터를 캡처/수신합니다.
 */
import React, { useState, useRef, useEffect } from 'react';
import { renderMetadataImage } from './strokeMetadata.js';

const SmartpenCaptureModal = ({ isOpen, onClose, onApply }) => {
  // --- Smartpen Capture States ---
  const [isHelperAppOn, setIsHelperAppOn] = useState(false);
  const [penConnectionStatus, setPenConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [capturedStrokes, setCapturedStrokes] = useState([]);
  const [exportDataCache, setExportDataCache] = useState([]);
  const [rawPackets, setRawPackets] = useState([]);
  const [penList, setPenList] = useState([]);
  const [selectedPenMac, setSelectedPenMac] = useState(null);
  const [currentPenInfo, setCurrentPenInfo] = useState({ id: '-', battery: '-', mac: '-' });
  // [v5.2] 페이지 단위 뷰어 — 좌우 스크롤 + 페이징 인디케이터
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  
  const wsRef = useRef(null);
  const serialRef = useRef(1);
  const pendingJobsRef = useRef(new Map());
  const captureCanvasRef = useRef(null);
  const connectIntervalRef = useRef(null);

  // --- Official Bridge Protocol Logic ---
  const tryParseJson = (input) => {
    try { return JSON.parse(input); } catch { return input; }
  };

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

  const addLog = (msg) => {
    setConnectionLogs(prev => [msg, ...prev].slice(0, 15));
  };

  const processAndRenderStrokes = (offlineData) => {
    if (!offlineData) return;
    let parsedData = tryParseJson(offlineData);
    while (parsedData && parsedData.__value__) {
      parsedData = tryParseJson(parsedData.__value__);
    }
    if (Array.isArray(parsedData) && typeof parsedData[0] === 'string') {
      parsedData = tryParseJson(parsedData[0]);
    }
    while (parsedData && parsedData.__value__) {
      parsedData = tryParseJson(parsedData.__value__);
    }

    addLog(`[디버그] 데이터 파싱 결과 속성: ${Object.keys(parsedData || {}).join(', ')}`);

    const directStrokes = [];
    const formattedPages = [];
    const items = Array.isArray(parsedData) ? parsedData : (parsedData.Items || parsedData.Data || parsedData.data || parsedData.strokes || [parsedData]);
    
    if (items.length > 0) {
      addLog(`[디버그] 분석할 첫번째 객체 미리보기: ${JSON.stringify(items[0]).slice(0, 60)}...`);
    }

    let extractedCount = 0;
    items.forEach(item => {
      const strokeArray = item.strokes || item.Strokes || (Array.isArray(item) ? item : null);
      if (strokeArray && Array.isArray(strokeArray)) {
        // [v5.2] 새 페이지에 부여될 pageIdx — 기존 cache + 이번 batch에서 만들어진 누적 페이지 수
        const newPageIdx = exportDataCache.length + formattedPages.length;

        const sobp = item.Sobp || item.sobp || {};
        const sec = sobp.section || sobp.Section || 3;
        const own = sobp.owner || sobp.Owner || 27;
        const bcode = sobp.book || sobp.Book || sobp.bookCode || 0;
        const pnum = sobp.page || sobp.Page || sobp.pageNumber || 0;
        
        const pageObj = {
          section: sec,
          owner: own,
          bookCode: bcode,
          pageNumber: pnum,
          nid: `${sec}-${own}-${bcode}-${pnum}_note_temp`,
          pid: `${sec}-${own}-${bcode}-${pnum}_page_temp`,
          strokes: []
        };

        strokeArray.forEach(s => {
          let pts = s.points || s.dots || s.Points || s.Dots || s.dotArray || s.DotArray || [];
          if (pts.length === 0 && Array.isArray(s)) pts = s;
          if (pts.length === 0) {
             const arrKey = Object.keys(s).find(k => Array.isArray(s[k]) && s[k].length > 0);
             if (arrKey) pts = s[arrKey];
          }

          if (pts.length > 0) extractedCount++;

          const exportPoints = [];
          const renderPoints = [];
          
          pts.forEach(p => {
             let x, y, f, dt;
             if (Array.isArray(p)) {
                 x = p[0]||0; y = p[1]||0; f = p[2]||0; dt = 10;
             } else {
                 x = p.x !== undefined ? p.x : (p.X !== undefined ? p.X : 0);
                 y = p.y !== undefined ? p.y : (p.Y !== undefined ? p.Y : 0);
                 f = p.f || p.p || p.Force || p.Pressure || p.pressure || 0;
                 dt = p.dt || p.DeltaTime || p.deltaTime || 10;
             }
             exportPoints.push({ x, y, f, dt });
             renderPoints.push({ x, y, p: f, time: (s.startTime || s.StartTime || Date.now()) + dt });
          });
          
          pageObj.strokes.push({
             id: s.id || s.Id || `stroke-${Math.random().toString(36).substr(2, 9)}`,
             color: s.color || s.Color || "#000000FF",
             startTime: s.startTime || s.StartTime || Date.now(),
             endTime: s.endTime || s.EndTime || 0,
             brushType: s.brushType || s.BrushType || 0,
             dotCount: exportPoints.length,
             points: exportPoints,
             dots: ""
          });
          
          directStrokes.push({ points: renderPoints, color: '#2A75F3', thickness: 1.5, pageIdx: newPageIdx });
        });
        
        if (pageObj.strokes.length > 0) {
           formattedPages.push(pageObj);
        }
      }
    });

    if (directStrokes.length > 0) {
      setCapturedStrokes(prev => [...prev, ...directStrokes]);
      setExportDataCache(prev => [...prev, ...formattedPages]);
      addLog(`성공! ${directStrokes.length}개 중 실제 좌표 점이 존재하는 획 ${extractedCount}개를 표시합니다.`);
    } else {
      addLog("오류: 데이터는 받았으나 안에 그릴 수 있는 획(Strokes)이 없습니다.");
    }
  };

  const connectToPen = () => {
    if (wsRef.current) wsRef.current.close();
    if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);
    
    setPenConnectionStatus('connecting');
    setConnectionLogs(["연동 프로그램 상시 탐색 모드 시작..."]);
    
    connectIntervalRef.current = setInterval(() => {
      const ports = [3509, 3508, 3507];
      const hosts = ['127.0.0.1', 'localhost'];
      let scanning = false;
      
      ports.forEach(port => {
        hosts.forEach(host => {
          if (penConnectionStatus === 'connected') return;
          
          const ws = new WebSocket(`ws://${host}:${port}`);
          ws.onmessage = handleBridgeMessage;

          ws.onopen = async () => {
            if (penConnectionStatus === 'connected') { ws.close(); return; }
            scanning = true;
            addLog(`포트 ${port} 발견! 정체 확인 중...`);
            wsRef.current = ws; 
            
            try {
              const versionPromise = bridgeInvokeMethodAsync("GetVersion");
              const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 500));
              const version = await Promise.race([versionPromise, timeoutPromise]);
              
              if (version) {
                clearInterval(connectIntervalRef.current);
                setPenConnectionStatus('connected');
                addLog(`연동 성공 (v${version})`);
                
                try {
                  await bridgeInvokeMethodAsync("StartReadingUSBConnections");
                } catch (e) {
                  addLog("펜 검색 시작 실패: " + e.message);
                }
                
                ws.onclose = () => {
                  setPenConnectionStatus('disconnected');
                  addLog("연결 끊김. 재전환 대기 중...");
                  connectToPen();
                };
              } else { ws.close(); }
            } catch (e) {
              ws.close();
            }
          };

          ws.onerror = () => {};
        });
      });

      if (!scanning && penConnectionStatus === 'connecting') {
        addLog(`앱 탐구 중... (3509/3508/3507)`);
      }
    }, 1000);
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

        if (devices.length === 0 && parsed.data) {
           try {
             let dataObj = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
             if (Array.isArray(dataObj) && dataObj.length === 1 && typeof dataObj[0] === 'string') dataObj = JSON.parse(dataObj[0]);
             if (Array.isArray(dataObj)) devices = dataObj;
             else if (dataObj.devices) devices = dataObj.devices;
           } catch(e){}
        }

        console.log("[Smartpen WS] Extracted devices:", devices);

        const normalizedDevices = devices.map((device, idx) => {
          let penId = `PEN-${idx}`;
          let penName = `Pen ${idx}`;
          let penBattery = '-';

          if (typeof device === 'string') {
            penId = device;
            penName = `Pen (${device.slice(-5)})`;
          } else if (device && typeof device === 'object') {
            penId = device.mac || device.id || device.MacAddress || device.macAddress || device.address || device.Address || penId;
            penName = device.name || device.Name || penId;
            penBattery = device.battery ?? device.Battery ?? '-';
          }
          
          return {
            name: penName,
            mac: penId,
            battery: penBattery,
            id: penId,
            _raw: device
          };
        });

        setPenList(normalizedDevices);
        if (normalizedDevices.length > 0 && !selectedPenMac) {
          const first = normalizedDevices[0];
          setSelectedPenMac(first.mac);
          setCurrentPenInfo({ 
            id: first.name, 
            battery: first.battery, 
            mac: first.mac 
          });
        }
        return;
      }

      if (parsed.func === "onStrokesBySobpUpdate") {
        let parsed = tryParseJson(args[0]);
        while(parsed && parsed.__value__) {
          parsed = tryParseJson(parsed.__value__);
        }
        if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
          parsed = tryParseJson(parsed[0]);
        }
        const data = parsed;
        
        const allNewStrokes = [];
        const extractStrokes = (dataObj) => {
          if (!dataObj) return;
          // 내부 속성에 배열이 있을 경우 탐색 (Items, Data 등)
          const items = Array.isArray(dataObj) ? dataObj : 
                       (dataObj.Items || dataObj.Data || dataObj.strokes || [dataObj]);
          items.forEach(item => {
            if (item.strokes && Array.isArray(item.strokes)) {
              item.strokes.forEach(s => {
                const pts = s.points || s.dots || [];
                const strokePoints = pts.map(p => ({
                    x: p.x, y: p.y,
                    p: p.f || p.p || 0,
                    time: (s.startTime || Date.now()) + (p.dt || 0)
                }));
                allNewStrokes.push({
                    points: strokePoints,
                    color: '#2A75F3',
                    thickness: 1.5
                });
              });
            }
          });
        };

        extractStrokes(data);
        
        if (allNewStrokes.length > 0) {
          setCapturedStrokes(prev => [...prev, ...allNewStrokes]);
          addLog(`${allNewStrokes.length}개의 획 정보를 수신했습니다.`);
        }
        return;
      }
      
      // 알 수 없는 이벤트 로그 기록
      if (parsed.func && parsed.func !== "onUSBConnectedUpdate") {
        addLog(`[이벤트 수신] ${parsed.func}: ${JSON.stringify(parsed).slice(0,100)}...`);
      }
    } catch (e) {
      console.error("[Smartpen WS] Protocol Error", e);
    }
  };

  const syncPenData = () => {
    if (!selectedPenMac) return alert('펜을 먼저 선택하세요.');
    addLog("펜 데이터 연동 파싱 시도 중...");
    bridgeInvokeMethodAsync("ReadOfflineStrokesForDemoApp", selectedPenMac)
       .then(data => {
           if(data) processAndRenderStrokes(data);
       })
       .catch((e) => addLog("진행오류: " + e.message));
  };

  const handleHelperAppToggle = (isOn) => {
    setIsHelperAppOn(isOn);
    if (isOn) {
      addLog("윈도우 연동 시도 중...");
      if (window.confirm("윈도우즈 앱(StrokeReaderDemoApp)을 실행할까요?")) {
        const link = document.createElement("a");
        link.href = "StrokeReaderDemoApp://";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      connectToPen();
    } else {
      if (wsRef.current) wsRef.current.close();
      if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);
      setPenConnectionStatus('disconnected');
    }
  };

  const refreshPenList = async () => {
    try {
      await bridgeInvokeMethodAsync("StartReadingUSBConnections");
      addLog("펜 목록 새로고침 요청됨");
    } catch (e) {
      console.error("Manual refresh failed", e);
      addLog("새로고침 실패: " + e.message);
    }
  };

  const selectPen = (pen) => {
    const mac = pen.mac || pen.id;
    setSelectedPenMac(mac);
    setCurrentPenInfo({
      id: pen.name || pen.id,
      battery: pen.battery ?? '-',
      mac: mac
    });
    setCapturedStrokes([]); 
    setExportDataCache([]); 
    
    // 비동기 블로킹(무한 대기) 방지: 응답(Response)을 보내지 않는 함수일 수 있으므로 바로 다음 줄 실행
    addLog(`${mac} 선택됨. 데이터를 자동으로 요청합니다...`);
    
    bridgeInvokeMethodAsync("GetPenStatus", mac).catch(()=>{});
    
    bridgeInvokeMethodAsync("ReadOfflineStrokesForDemoApp", mac)
      .then(offlineData => {
        if (offlineData) {
          processAndRenderStrokes(offlineData);
        }
      })
      .catch((e)=>{
         // Timeout or no-response is fine, just means we wait for pushed events
      });
  };

  const handleApply = () => {
    if (capturedStrokes.length === 0) return;
    const canvas = renderMetadataImage(capturedStrokes);
    canvas.toBlob((blob) => {
      if (blob) {
        onApply(URL.createObjectURL(blob), capturedStrokes);
      }
    });
  };

  const downloadJson = () => {
    if (exportDataCache.length === 0 && capturedStrokes.length === 0) return;
    
    // 이전에 구축한 표준 JSON 배열 형식을 바로 내보냅니다.
    // 만약 exportDataCache가 비어있다면 (이전 세션 등), 임시로 형태를 맞춰줍니다.
    const exportData = exportDataCache.length > 0 ? exportDataCache : [{
      section: 3,
      owner: 27,
      bookCode: 0,
      pageNumber: 0,
      nid: "default_note",
      pid: "default_page",
      strokes: capturedStrokes.map((s, idx) => ({
        id: `stroke-${idx}`,
        color: s.color || "#000000FF",
        startTime: Date.now(),
        endTime: 0,
        brushType: 0,
        dotCount: s.points.length,
        points: s.points.map(p => ({ x: p.x, y: p.y, f: p.p || 0, dt: 10 })),
        dots: ""
      }))
    }];

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `pen_data_export_${selectedPenMac || 'unknown'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // [v5.2] 페이지 단위 stroke 분리 — pageIdx별 그룹핑
  const strokesByPage = (() => {
    const map = new Map();
    capturedStrokes.forEach((s) => {
      const idx = s.pageIdx ?? 0;
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx).push(s);
    });
    // pageIdx 순 정렬
    return Array.from(map.keys()).sort((a, b) => a - b).map(k => ({ pageIdx: k, strokes: map.get(k) }));
  })();
  const totalPages = strokesByPage.length;
  const safePageIdx = Math.min(currentPageIdx, Math.max(0, totalPages - 1));
  const currentPageStrokes = totalPages > 0 ? strokesByPage[safePageIdx].strokes : [];

  // 새 페이지 도착 시 마지막 페이지로 자동 이동 (영업·교사 UX: 새로 들어온 페이지를 즉시 확인)
  useEffect(() => {
    if (totalPages > 0 && currentPageIdx > totalPages - 1) {
      setCurrentPageIdx(totalPages - 1);
    } else if (totalPages > 0 && currentPageIdx === 0 && totalPages > 1) {
      // 다중 페이지 데이터가 처음 들어온 경우 첫 페이지부터 시작 (이미 0이라 noop)
    }
  }, [totalPages]);
  // capturedStrokes가 비워지면 페이지 인덱스 reset
  useEffect(() => {
    if (capturedStrokes.length === 0) setCurrentPageIdx(0);
  }, [capturedStrokes.length]);

  useEffect(() => {
    if (isOpen && currentPageStrokes.length > 0 && captureCanvasRef.current) {
      const canvas = captureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      currentPageStrokes.forEach((stroke) => {
        stroke.points.forEach((pt) => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        });
      });

      if (minX === Infinity || minX === maxX) return;

      const padding = 30;
      const sw = (maxX - minX) || 1;
      const sh = (maxY - minY) || 1;

      let scale = (1800 - padding * 2) / sw;
      if (scale > 10) scale = 10;

      const targetWidth = Math.max(800, sw * scale + padding * 2);
      const targetHeight = Math.max(800, sh * scale + padding * 2);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerOffsetX = targetWidth > sw * scale ? (targetWidth - sw * scale) / 2 : padding;
      const offsetX = centerOffsetX - minX * scale;
      const offsetY = padding - minY * scale;

      currentPageStrokes.forEach((stroke) => {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#2A75F3';
        stroke.points.forEach((pt, pi) => {
          const x = pt.x * scale + offsetX;
          const y = pt.y * scale + offsetY;
          if (pi === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    } else if (isOpen && currentPageStrokes.length === 0 && captureCanvasRef.current) {
      const canvas = captureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [capturedStrokes, isOpen, safePageIdx]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (connectIntervalRef.current) clearInterval(connectIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // --- PRD 상태 판별 ---
  // 1) 초기(연결대기): isHelperAppOn=false, penConnectionStatus='disconnected'
  // 2) 탐색(폴링중): isHelperAppOn=true, penConnectionStatus='connecting'
  // 3) 연결성공(목록): penConnectionStatus='connected', capturedStrokes.length===0
  // 4) 데이터수신중/완료: penConnectionStatus='connected', capturedStrokes.length>0
  const isInitial = !isHelperAppOn && penConnectionStatus === 'disconnected';
  const isSearching = isHelperAppOn && penConnectionStatus !== 'connected';
  const isConnected = penConnectionStatus === 'connected';
  const hasData = isConnected && capturedStrokes.length > 0;

  // 상태 뱃지 클래스: 회색(inactive) / 주황(connecting) / 파란색+펄싱(active)
  const badgeClass = isInitial ? 'inactive' : isSearching ? 'connecting' : 'active';
  const badgeText = isInitial ? '연동 꺼짐' : isSearching ? '확인 중' : '연동 성공';

  return (
    <div className="sg-pen-modal-overlay">
      <div className="sg-pen-modal">
        {/* ===== 헤더 ===== */}
        <header className="sg-pen-modal-header">
          <div className="sg-pen-modal-title">
            <span>🖊️</span> 스마트펜 연동
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className={`sg-pen-status-badge ${badgeClass}`}>
              <div className={`sg-pen-status-dot ${isConnected ? 'pulsing' : ''}`}></div>
              {badgeText}
            </div>
            <button className="sg-btn-delete-img" onClick={onClose} style={{ position: 'static', fontSize: 'var(--neo-font-size-xl)' }}>✕</button>
          </div>
        </header>

        {/* ===== 본문: Left(캔버스) + Right(제어 패널) ===== */}
        <div className="sg-pen-capture-body" style={{ height: 'calc(100% - 60px)', position: 'relative' }}>

          {/* --- Left: 캔버스 뷰어 --- */}
          <div className="sg-pen-canvas-container" style={{ overflow: 'auto', alignItems: 'flex-start', paddingTop: '10px', height: '100%', position: 'relative' }}>
            <canvas
              ref={captureCanvasRef}
              className="sg-stroke-canvas"
              style={{ minWidth: '100%', display: 'block', margin: '0 auto' }}
            />
            {/* 캔버스 안내 메시지: 초기 + 탐색 상태에서만 노출 (PRD 조건표) */}
            {(isInitial || isSearching) && (
              <div className="sg-canvas-placeholder">
                <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.5 }}>🔌</div>
                <div style={{ color: '#475569', fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>
                  스마트펜 연동이 필요합니다.<br/>우측 안내에 따라 연동을 시작하세요.
                </div>
              </div>
            )}
            {/* 연결 성공 but 데이터 없음: 데이터 유도 메시지 */}
            {isConnected && !hasData && (
              <div className="sg-canvas-placeholder">
                <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.5 }}>📂</div>
                <div style={{ color: '#475569', fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>
                  펜을 선택하면 오프라인 데이터를 자동으로 불러옵니다.
                </div>
              </div>
            )}
            {/* [v5.2] 페이지 네비게이션 — 데이터 있고 페이지가 1개 이상일 때 노출 */}
            {hasData && totalPages > 0 && (
              <>
                {/* 좌측 이전 페이지 버튼 */}
                <button
                  onClick={() => setCurrentPageIdx(Math.max(0, safePageIdx - 1))}
                  disabled={safePageIdx === 0}
                  title={safePageIdx === 0 ? '첫 페이지' : '이전 페이지'}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #E2E8F0',
                    background: safePageIdx === 0 ? '#F8FAFC' : 'rgba(255,255,255,0.95)',
                    color: safePageIdx === 0 ? '#CBD5E1' : '#475569',
                    fontSize: 'var(--neo-font-size-xl)',
                    fontWeight: 800,
                    cursor: safePageIdx === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px -2px rgba(15,23,42,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (safePageIdx !== 0) e.currentTarget.style.background = '#EFF6FF'; }}
                  onMouseLeave={(e) => { if (safePageIdx !== 0) e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; }}
                >
                  ‹
                </button>
                {/* 우측 다음 페이지 버튼 */}
                <button
                  onClick={() => setCurrentPageIdx(Math.min(totalPages - 1, safePageIdx + 1))}
                  disabled={safePageIdx >= totalPages - 1}
                  title={safePageIdx >= totalPages - 1 ? '마지막 페이지' : '다음 페이지'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #E2E8F0',
                    background: safePageIdx >= totalPages - 1 ? '#F8FAFC' : 'rgba(255,255,255,0.95)',
                    color: safePageIdx >= totalPages - 1 ? '#CBD5E1' : '#475569',
                    fontSize: 'var(--neo-font-size-xl)',
                    fontWeight: 800,
                    cursor: safePageIdx >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px -2px rgba(15,23,42,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (safePageIdx < totalPages - 1) e.currentTarget.style.background = '#EFF6FF'; }}
                  onMouseLeave={(e) => { if (safePageIdx < totalPages - 1) e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; }}
                >
                  ›
                </button>
                {/* 하단 중앙 페이지 인디케이터 (도트 + N/M 카운터) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15,23,42,0.85)',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: 'var(--neo-font-size-sm)',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px -2px rgba(15,23,42,0.25)',
                    zIndex: 5,
                  }}
                >
                  {/* 도트 인디케이터 (페이지 ≤ 10일 때만) */}
                  {totalPages <= 10 && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPageIdx(i)}
                          title={`${i + 1}페이지로 이동`}
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            border: 'none',
                            background: i === safePageIdx ? '#FB923C' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'all 0.15s',
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span><strong style={{ color: '#FB923C' }}>{safePageIdx + 1}</strong> / {totalPages}</span>
                </div>
              </>
            )}
          </div>

          {/* --- Right: 제어 패널 --- */}
          <div className="sg-pen-info-panel" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            {/* ── 상태 1: 초기 (연결 대기) ── */}
            {isInitial && (
              <div className="sg-state-card">
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔌</div>
                <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px', fontSize: 'var(--neo-font-size-base)' }}>
                  연동 스위치를 켜주세요
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>
                  USB로 스마트펜을 PC에 연결한 뒤<br/>아래 버튼을 눌러 연동을 시작하세요.
                </div>
                <button
                  className="sg-btn-pen-action primary"
                  onClick={() => handleHelperAppToggle(true)}
                  style={{ width: '100%', padding: '14px', fontSize: 'var(--neo-font-size-base)' }}
                >
                  🚀 연동 가동 (앱 실행)
                </button>
              </div>
            )}

            {/* ── 상태 2: 탐색 (폴링 중) ── */}
            {isSearching && (
              <div className="sg-state-card">
                <div className="sg-searching-spinner">
                  <div className="sg-spinner-ring"></div>
                  <span style={{ fontSize: '1.5rem' }}>⏳</span>
                </div>
                <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: '8px', fontSize: 'var(--neo-font-size-base)' }}>
                  윈도우 앱 탐색 및 실행 중...
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>
                  StrokeReaderDemoApp 응답을 대기하고 있습니다.<br/>포트 3507~3509를 순회 탐색합니다.
                </div>
                <button
                  className="sg-btn-pen-action secondary"
                  onClick={() => handleHelperAppToggle(true)}
                  style={{ width: '100%', padding: '12px', fontSize: 'var(--neo-font-size-sm)' }}
                >
                  연동 가동 (재시도)
                </button>
              </div>
            )}

            {/* ── 상태 3·4: 연결성공 (목록 / 데이터) ── */}
            {isConnected && (
              <>
                {/* 펜 목록 */}
                <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                  <div className="sg-info-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span>📊</span> 펜 목록</span>
                    <button onClick={refreshPenList} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)' }} title="목록 새로고침">🔄</button>
                  </div>
                  {penList.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>✅</div>
                      <div style={{ fontSize: 'var(--neo-font-size-sm)' }}>연결 성공! 펜을 USB로 연결해주세요.</div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column' }}>
                      {penList.map(pen => (
                        <div
                          key={pen.mac || pen.id}
                          onClick={() => selectPen(pen)}
                          className="sg-pen-item"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: selectedPenMac === (pen.mac || pen.id) ? '#2A75F3' : '#e2e8f0',
                            background: selectedPenMac === (pen.mac || pen.id) ? '#eff6ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: 'var(--neo-font-size-sm)', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🖊️ {pen.name || pen.id}
                              {selectedPenMac === (pen.mac || pen.id) && (
                                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', fontWeight: 700 }}>(선택됨)</span>
                              )}
                            </span>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              🔋 {pen.battery}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 통신 로그 디버거 */}
                <div style={{ textAlign: 'left', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, minHeight: '120px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-xs)', color: '#64748b' }}>📡 통신 로그 디버거</span>
                    <button onClick={() => setConnectionLogs([])} style={{ background: 'none', border: 'none', fontSize: 'var(--neo-font-size-xs)', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>지우기</button>
                  </div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontFamily: 'monospace', height: '90px', overflowY: 'auto', wordBreak: 'break-all' }}>
                    {connectionLogs.length === 0 ? '> 대기 중...' : connectionLogs.map((log, idx) => (
                      <div key={idx} style={{ marginBottom: '4px', lineHeight: 1.3 }}>{`> ${log}`}</div>
                    ))}
                  </div>
                </div>

                {/* 하단 액션 버튼들: 연결성공=비활성, 데이터수신=활성 (PRD 조건표) */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', flexShrink: 0 }}>
                  <button
                    className="sg-btn-pen-action primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#2A75F3' }}
                    onClick={syncPenData}
                    disabled={!selectedPenMac}
                  >
                    🔄 수동으로 다시 불러오기
                  </button>
                  <button
                    className="sg-btn-pen-action secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={downloadJson}
                    disabled={!hasData}
                  >
                    ⬇️ 표준 JSON 내보내기
                  </button>
                </div>
              </>
            )}

            {/* 초기·탐색 상태에서도 로그 표시 */}
            {!isConnected && (
              <div style={{ marginTop: 'auto', textAlign: 'left', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', flexShrink: 0, minHeight: '100px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-xs)', color: '#64748b' }}>📡 통신 로그 디버거</span>
                  <button onClick={() => setConnectionLogs([])} style={{ background: 'none', border: 'none', fontSize: 'var(--neo-font-size-xs)', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>지우기</button>
                </div>
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94a3b8', fontFamily: 'monospace', height: '70px', overflowY: 'auto', wordBreak: 'break-all' }}>
                  {connectionLogs.length === 0 ? '> 기록 없음...' : connectionLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '4px', lineHeight: 1.3 }}>{`> ${log}`}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== 푸터 ===== */}
        <footer className="sg-pen-modal-footer">
          <button className="sg-btn-pen-action secondary" onClick={onClose}>
            창 닫기
          </button>
          {/* 동기화 완료 버튼: 초기·탐색=숨김, 연결성공=비활성, 데이터수신=활성 */}
          {isConnected && (
            <button
              className={`sg-btn-pen-action primary ${hasData ? 'sg-btn-complete' : ''}`}
              onClick={handleApply}
              disabled={!hasData}
            >
              🟢 동기화 완료 (답안으로 적용)
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default SmartpenCaptureModal;
