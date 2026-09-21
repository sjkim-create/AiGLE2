/**
 * AiGradingTest.jsx — 아이글 채점 테스트
 *
 * 3-탭 구조:
 *   ① 버전1 입력 — 서비스에 등록된 문제(교과 → 과제 → 문항) + 학생 답안 업로드
 *   ② 버전2 입력 — 문제 파일(JSON/이미지) 직접 업로드 + 학생 답안 업로드
 *   ③ 결과 — 회차별 결과 테이블 (체크박스, 회차#, 그룹명, 과제명, 답안#, 소요, 토큰, AI 등급, 교사 등급, 상태)
 *
 * 정책:
 *   - 두 버전은 동시에 사용하지 않음. 탭 전환 시 그룹·결과 리셋
 *   - 답안별 개별 반복 횟수 지원 (동일 답안 N회 반복 검증 가능)
 *   - 파일 업로드: 드래그&드롭 + 「+ 답안 추가」 버튼 (mock: name/size만 기록)
 *   - 프롬프트 버전 필드 폐기 (v3.57)
 */
import { useMemo, useRef, useState } from 'react';

const SUBJECTS = ['수학', '국어', '영어', '과학', '사회'];

// [v3.57] 교과 → 과제 → 문항 mock (production: server API로 대체)
const MOCK_TASKS_BY_SUBJECT = {
  '수학': [
    { id: 'T-M-01', name: '단원1 평가 · 조합개념과 조합 수 구하기', questions: [{ no: 1, name: '문항 1' }, { no: 2, name: '문항 2' }] },
    { id: 'T-M-02', name: '단원2 평가 · 방정식과 부등식', questions: [{ no: 1, name: '문항 1' }, { no: 2, name: '문항 2' }, { no: 3, name: '문항 3' }] },
    { id: 'T-M-03', name: '비례식 평가', questions: [{ no: 1, name: '문항 1' }] },
  ],
  '국어': [
    { id: 'T-K-01', name: '읽기 진단 평가', questions: [{ no: 1, name: '문항 1' }, { no: 2, name: '문항 2' }] },
    { id: 'T-K-02', name: '논술 진단 평가', questions: [{ no: 1, name: '문항 1' }] },
  ],
  '영어': [
    { id: 'T-E-01', name: '문맥 추론 · 빈칸 채우기', questions: [{ no: 1, name: '문항 1' }] },
  ],
  '과학': [
    { id: 'T-S-01', name: '운동 에너지·위치 에너지', questions: [{ no: 1, name: '문항 1' }, { no: 2, name: '문항 2' }] },
  ],
  '사회': [
    { id: 'T-C-01', name: '민주주의의 기본 원리', questions: [{ no: 1, name: '문항 1' }] },
  ],
};

const GRADE_LEVELS = ['매우 우수', '우수', '보통', '노력', '매우 노력'];
const GRADE_COLOR = { '매우 우수': '#10B981', '우수': '#2A75F3', '보통': '#94A3B8', '노력': '#F59E0B', '매우 노력': '#EF4444' };
// [v3.57] 결과 오류 유형 (연구진 품질 태깅)
const ERROR_TYPES = ['해당없음', 'OCR', '환각(거짓논리)', '채점기준표 미준수', '포맷오류'];

// [v3.57] 평가 일치도 자동 계산 — AI 등급 vs 교사 등급 index 차이 기준
//   0단계 = 완전일치 / 1단계 = 부분일치 / 2단계 이상 = 불일치
const MATCH_STYLE = {
  '완전일치': { label: '✅ 완전일치', color: '#065F46', bg: '#D1FAE5' },
  '부분일치': { label: '⚠️ 부분일치', color: '#92400E', bg: '#FEF3C7' },
  '불일치':   { label: '❌ 불일치',   color: '#991B1B', bg: '#FEE2E2' },
};
const computeMatchStatus = (aiGrade, teacherGrade) => {
  if (!teacherGrade || !aiGrade || aiGrade === '-') return '';
  const aiIdx = GRADE_LEVELS.indexOf(aiGrade);
  const trIdx = GRADE_LEVELS.indexOf(teacherGrade);
  if (aiIdx < 0 || trIdx < 0) return '';
  const diff = Math.abs(aiIdx - trIdx);
  if (diff === 0) return '완전일치';
  if (diff === 1) return '부분일치';
  return '불일치';
};

const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

const newAnswer = (fileName = '') => ({
  id: uid('ans'),
  fileName: fileName || `answer_${Math.floor(Math.random() * 900 + 100)}.png`,
  fileType: (fileName.match(/\.(\w+)$/)?.[1] || 'png').toLowerCase(),
  iterations: 1,
  enabled: true,
});

const newGroup = (n = 1, version = 1) => {
  const subject = '수학';
  const tasks = MOCK_TASKS_BY_SUBJECT[subject] || [];
  const firstTask = tasks[0];
  const dateStr = new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '');
  return {
    id: uid('grp'),
    name: '', // 비어 있으면 defaultName을 확정 제목으로 사용
    defaultName: `${dateStr} 테스트 ${n}`,
    subject,
    // v1 전용
    taskId: firstTask?.id || '',
    questionNo: firstTask?.questions?.[0]?.no || 1,
    // v2 전용
    problemFile: null, // { fileName, fileType, questions: [{no, name}] } | null
    problemQuestionNo: 1,
    // 공통
    answers: [],
    version,
  };
};

const showToast = (msg) => {
  if (window.showToast) window.showToast(msg);
  else console.log('[toast]', msg);
};

const AiGradingTest = ({ onSaveArchive }) => {
  const [activeTab, setActiveTab] = useState('v1'); // 'v1' | 'v2' | 'result'
  const [groups, setGroups] = useState([newGroup(1, 1)]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, fail: 0, groupDone: 0 });
  const [results, setResults] = useState([]);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkIter, setBulkIter] = useState(10);
  const [smartpenModalGroupId, setSmartpenModalGroupId] = useState(null); // null | groupId
  const [detailResultId, setDetailResultId] = useState(null); // null | resultId — 결과 슬라이드 아웃 패널

  const version = activeTab === 'v2' ? 2 : 1; // result 탭이면 마지막 실행 결과에 종속
  const inputVersion = activeTab === 'v1' ? 1 : activeTab === 'v2' ? 2 : version;

  // ─── 파생 값 ───
  const totalCases = useMemo(
    () => groups.reduce((sum, g) => sum + (g.answers?.filter(a => a.enabled).reduce((s, a) => s + (Number(a.iterations) || 0), 0) || 0), 0),
    [groups]
  );

  const effectiveGroupName = (g) => (g.name?.trim() || g.defaultName || '무제');
  const validateGroup = (g) => {
    if (!g.subject) return false;
    if (!(g.name?.trim() || g.defaultName)) return false;
    const hasEnabled = g.answers?.some(a => a.enabled && Number(a.iterations) > 0);
    if (!hasEnabled) return false;
    if (g.version === 1) {
      if (!g.taskId) return false;
      const task = (MOCK_TASKS_BY_SUBJECT[g.subject] || []).find(t => t.id === g.taskId);
      if (!task) return false;
      if (task.questions.length > 1 && !g.questionNo) return false;
    } else {
      if (!g.problemFile) return false;
      if (g.problemFile.questions?.length > 1 && !g.problemQuestionNo) return false;
    }
    return true;
  };
  const canRun = !running && groups.length > 0 && groups.every(validateGroup) && totalCases > 0;

  // ─── 탭 전환 ───
  const switchTab = (tab) => {
    if (running) { showToast('실행 중에는 탭을 전환할 수 없습니다.'); return; }
    if (tab === 'result') { setActiveTab('result'); return; }
    if (tab === activeTab) return;
    // v1 <-> v2 전환 시 리셋
    if ((tab === 'v1' || tab === 'v2') && activeTab !== 'result') {
      const newVersion = tab === 'v1' ? 1 : 2;
      setGroups([newGroup(1, newVersion)]);
      setResults([]);
      setCheckedIds(new Set());
      setProgress({ done: 0, total: 0, success: 0, fail: 0, groupDone: 0 });
    }
    // 결과 → 입력 이동은 그룹 상태 유지
    setActiveTab(tab);
  };

  // ─── 그룹 조작 ───
  const updateGroup = (id, patch) => setGroups(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));
  const removeGroup = (id) => setGroups(gs => gs.length > 1 ? gs.filter(g => g.id !== id) : gs);
  const addGroup = () => setGroups(gs => [...gs, newGroup(gs.length + 1, inputVersion)]);

  const changeSubject = (groupId, subject) => {
    const tasks = MOCK_TASKS_BY_SUBJECT[subject] || [];
    const first = tasks[0];
    updateGroup(groupId, { subject, taskId: first?.id || '', questionNo: first?.questions?.[0]?.no || 1 });
  };

  const changeTask = (groupId, taskId) => {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const task = (MOCK_TASKS_BY_SUBJECT[g.subject] || []).find(t => t.id === taskId);
    updateGroup(groupId, { taskId, questionNo: task?.questions?.[0]?.no || 1 });
  };

  // ─── 파일 업로드 ───
  const acceptFilesForAnswers = (groupId, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const newAnswers = Array.from(fileList).map(f => newAnswer(f.name));
    updateGroup(groupId, { answers: [...(g.answers || []), ...newAnswers] });
  };

  const acceptFileForProblem = (groupId, file) => {
    if (!file) return;
    const ext = (file.name.match(/\.(\w+)$/)?.[1] || '').toLowerCase();
    // mock: JSON이면 다문항 파싱했다고 가정, 이미지면 단문항
    const isJson = ext === 'json';
    const problemFile = {
      fileName: file.name,
      fileType: isJson ? 'json' : 'image',
      questions: isJson ? [{ no: 1, name: '문항 1' }, { no: 2, name: '문항 2' }] : [{ no: 1, name: '문항 1' }],
    };
    updateGroup(groupId, { problemFile, problemQuestionNo: 1 });
  };

  // 답안 개별 조작
  const updateAnswer = (groupId, ansId, patch) => {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    updateGroup(groupId, { answers: g.answers.map(a => a.id === ansId ? { ...a, ...patch } : a) });
  };
  const removeAnswer = (groupId, ansId) => {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    updateGroup(groupId, { answers: g.answers.filter(a => a.id !== ansId) });
  };
  // [v3.57] 스마트펜 연동으로 전달받은 「모든 펜 데이터」를 답안 카드에 일괄 반영
  //   각 펜당 1개의 JSON 답안 카드가 생성되며, 카드 메타에 스트로크 카운트·펜 정보를 함께 보관
  const applySmartpenAnswers = (groupId, penInfos) => {
    if (!groupId || !penInfos || penInfos.length === 0) return;
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newAnswers = penInfos.map((p) => {
      const strokeCount = p.strokes?.length || 0;
      return {
        id: uid('ans'),
        fileName: `smartpen_${p.name}_${ts}.json`,
        fileType: 'json',
        iterations: 1,
        enabled: true,
        source: 'smartpen',
        penInfo: { name: p.name, model: p.model, battery: p.battery, strokeCount },
        strokes: p.strokes || [],
      };
    });
    const totalStrokes = newAnswers.reduce((s, a) => s + (a.strokes?.length || 0), 0);
    updateGroup(groupId, { answers: [...(g.answers || []), ...newAnswers] });
    showToast(`스마트펜 ${penInfos.length}개 · 총 ${totalStrokes} strokes를 답안에 반영했습니다.`);
  };

  const applyBulkIter = (groupId) => {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const n = Math.max(1, Number(bulkIter) || 1);
    updateGroup(groupId, { answers: g.answers.map(a => ({ ...a, iterations: n })) });
  };

  // ─── mock 실행 ───
  const runTest = async () => {
    if (!canRun) return;
    setRunning(true);
    const total = totalCases;
    setProgress({ done: 0, total, success: 0, fail: 0, groupDone: 0 });
    setResults([]);
    const allResults = [];
    let runIdx = 0, done = 0, success = 0, fail = 0, groupDone = 0;

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const groupName = effectiveGroupName(g);
      const taskName = g.version === 1
        ? ((MOCK_TASKS_BY_SUBJECT[g.subject] || []).find(t => t.id === g.taskId)?.name || '-')
        : (g.problemFile?.fileName || '-');
      const questionNo = g.version === 1 ? g.questionNo : g.problemQuestionNo;
      const enabled = g.answers.filter(a => a.enabled);
      for (let ai = 0; ai < enabled.length; ai++) {
        const ans = enabled[ai];
        for (let it = 1; it <= (Number(ans.iterations) || 0); it++) {
          runIdx++;
          const isSuccess = Math.random() > 0.02;
          const aiGrade = GRADE_LEVELS[Math.floor(Math.random() * GRADE_LEVELS.length)];
          const tokens = Math.round(15000 + Math.random() * 12000);
          const elapsedSec = +(2 + Math.random() * 8).toFixed(2);
          allResults.push({
            id: `res-${runIdx}-${g.id}-${ans.id}`,
            runIdx,
            groupName,
            subject: g.subject,
            taskNameRaw: taskName,
            questionNo,
            taskName: `${taskName}${questionNo ? ` (문항 ${questionNo})` : ''}`,
            answerIdx: ai + 1,
            answerFile: ans.fileName,
            elapsedSec,
            tokens,
            aiGrade: isSuccess ? aiGrade : '-',
            teacherGrade: '',
            matchStatus: '',
            errorType: '해당없음',
            teacherComment: '',
            status: isSuccess ? '성공' : '실패',
          });
          done++;
          if (isSuccess) success++; else fail++;
        }
      }
      groupDone++;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 300));
      setProgress({ done, total, success, fail, groupDone });
      setResults([...allResults]);
    }
    setRunning(false);
    setActiveTab('result'); // 완료 시 결과 탭으로 자동 전환
    showToast(`테스트 완료 — 성공 ${success} · 실패 ${fail} (${total}회)`);
  };

  // ─── 결과 조작 ───
  const setTeacherGrade = (id, grade) => {
    setResults(rs => rs.map(r => {
      if (r.id !== id) return r;
      const matchStatus = computeMatchStatus(r.aiGrade, grade);
      return { ...r, teacherGrade: grade, matchStatus };
    }));
  };
  const setErrorType = (id, errorType) => {
    setResults(rs => rs.map(r => r.id === id ? { ...r, errorType } : r));
  };
  const setTeacherComment = (id, comment) => {
    setResults(rs => rs.map(r => r.id === id ? { ...r, teacherComment: comment } : r));
  };
  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCheckAll = () => {
    if (checkedIds.size === results.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(results.map(r => r.id)));
  };
  const selectedResults = () => results.filter(r => checkedIds.has(r.id));
  const targetResults = () => (checkedIds.size > 0 ? selectedResults() : results);

  // [v3.57] 아카이브 저장 — 각 결과를 「테스트 아카이브 목록」의 개별 행으로 확장 저장
  const saveToArchive = () => {
    const target = targetResults();
    if (target.length === 0) { showToast('저장할 결과가 없습니다.'); return; }
    const ts = Date.now();
    const sessionId = `sess-${ts}`;
    // 각 결과 → 하나의 아카이브 행
    const items = target.map((r, i) => {
      // 표시용 taskName에서 문항 접미사 제거 (taskNameRaw 우선)
      const rawTask = r.taskNameRaw || (r.taskName || '').replace(/\s*\(문항\s*\d+\)$/, '');
      const qNoMatch = /\(문항\s*(\d+)\)/.exec(r.taskName || '');
      const qNo = r.questionNo || (qNoMatch ? Number(qNoMatch[1]) : r.answerIdx || 1);
      // 토큰·비용 mock 산출 (Gemini 근사 단가)
      const inputTokens = Math.round((r.tokens || 0) * 0.45);
      const outputTokens = (r.tokens || 0) - inputTokens;
      const costUsd = +((r.tokens || 0) * 0.00000187).toFixed(5);
      return {
        id: `arch-${ts}-${i}`,
        assignmentId: sessionId,
        testTitle: r.groupName,
        taskName: rawTask,
        questionNo: qNo,
        title: rawTask,
        status: r.status === '성공' ? 'success' : 'fail',
        matchStatus: r.matchStatus || '',
        errorType: r.errorType || '해당없음',
        category: r.subject || '기타',
        model: 'AiGLE 채점 v1 (mock)',
        evalMode: '자동평가',
        latency: `${Number(r.elapsedSec).toFixed(2)}s`,
        tokens: { input: inputTokens, output: outputTokens, total: r.tokens || 0 },
        costUsd,
        date: new Date().toISOString(),
        promptVersionId: 'v-mock',
        gradingType: '등급',
        aiGrade: r.aiGrade,
        teacherGrade: r.teacherGrade || '',
        teacherComment: r.teacherComment || '',
        teacherFeedback: r.teacherComment || '',
        gradingResult: JSON.stringify({
          grade: r.aiGrade,
          feedback: r.teacherComment || '(연구진 코멘트 없음)',
        }),
        // 원본 result 필드도 함께 보관 (분석 리포트 재활용용)
        runIdx: r.runIdx,
        answerIdx: r.answerIdx,
        answerFile: r.answerFile,
        groupName: r.groupName,
      };
    });
    if (typeof onSaveArchive === 'function') onSaveArchive(items);
    showToast(`테스트 아카이브에 ${items.length}건 반영되었습니다.`);
  };

  const exportCsv = () => {
    const target = targetResults();
    if (target.length === 0) { showToast('내보낼 결과가 없습니다.'); return; }
    const header = ['회차#', '그룹명', '과제명', '답안#', '답안파일', '소요(s)', '사용토큰수', 'AI 평가 등급', '교사 평가 등급', '평가 일치도', '오류 유형', '연구진 코멘트', '상태'];
    const rows = target.map(r => [r.runIdx, r.groupName, r.taskName, r.answerIdx, r.answerFile, r.elapsedSec, r.tokens, r.aiGrade, r.teacherGrade, r.matchStatus, r.errorType, r.teacherComment, r.status]);
    const csv = [header, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aigle-grading-test-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // ─── 결과 삭제 (선택 항목만) ───
  const deleteResults = () => {
    if (checkedIds.size === 0) { showToast('삭제할 항목을 먼저 체크박스로 선택하세요.'); return; }
    const selected = selectedResults();
    if (!window.confirm(`선택된 ${selected.length}건을 삭제할까요?`)) return;
    const targetIds = new Set(selected.map(r => r.id));
    setResults(rs => rs.filter(r => !targetIds.has(r.id)));
    setCheckedIds(new Set());
    showToast(`${selected.length}건을 삭제했습니다.`);
  };

  const importCsvInputRef = useRef(null);
  const importCsv = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '').replace(/^﻿/, '');
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { showToast('CSV에 데이터가 없습니다.'); return; }
        const parseRow = (line) => {
          const out = []; let cur = ''; let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQ) {
              if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
              else if (c === '"') inQ = false;
              else cur += c;
            } else {
              if (c === '"') inQ = true;
              else if (c === ',') { out.push(cur); cur = ''; }
              else cur += c;
            }
          }
          out.push(cur);
          return out;
        };
        const rows = lines.slice(1).map(parseRow);
        const imported = rows.map((r, i) => {
          const aiGrade = r[7] || '';
          const teacherGrade = r[8] || '';
          // 신 CSV(13 컬럼)에는 매치 상태가 저장되어 있고, 구 CSV는 재계산
          const looksNewFormat = ERROR_TYPES.includes(r[10]);
          return {
            id: `imp-${Date.now()}-${i}`,
            runIdx: Number(r[0]) || i + 1,
            groupName: r[1] || '',
            taskName: r[2] || '',
            answerIdx: Number(r[3]) || 1,
            answerFile: r[4] || '',
            elapsedSec: Number(r[5]) || 0,
            tokens: Number(r[6]) || 0,
            aiGrade,
            teacherGrade,
            matchStatus: looksNewFormat ? (r[9] || computeMatchStatus(aiGrade, teacherGrade)) : computeMatchStatus(aiGrade, teacherGrade),
            errorType: (looksNewFormat ? r[10] : r[9]) || '해당없음',
            teacherComment: (looksNewFormat ? r[11] : r[10]) || '',
            status: (looksNewFormat ? r[12] : r[11]) || r[9] || '성공',
          };
        });
        setResults(imported);
        setCheckedIds(new Set());
        setActiveTab('result');
        showToast(`CSV를 불러왔습니다. (${imported.length}건)`);
      } catch (e) {
        console.error(e);
        showToast('CSV 파싱에 실패했습니다.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // ─────────────────── 렌더 ───────────────────
  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const tabBtn = (id, label, badge) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => switchTab(id)}
        disabled={running}
        style={{
          padding: '10px 18px', borderRadius: '10px 10px 0 0',
          border: '1px solid #E2E8F0', borderBottom: isActive ? 'none' : '1px solid #E2E8F0',
          background: isActive ? 'white' : '#F1F5F9',
          color: isActive ? '#1E2225' : '#64748B',
          fontWeight: isActive ? 900 : 700, fontSize: 'var(--neo-font-size-base)',
          cursor: running ? 'not-allowed' : 'pointer',
          position: 'relative', top: '1px',
        }}
      >
        {label}
        {typeof badge === 'number' && badge > 0 && (
          <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: isActive ? '#2A75F3' : '#94A3B8', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      {/* 상단 타이틀 */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, color: '#1E2225' }}>🧪 아이글 채점 테스트</h2>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 24px 0', display: 'flex', gap: 6, borderBottom: '1px solid #E2E8F0' }}>
        {tabBtn('v1', '① 버전1 · 서비스 등록 문제')}
        {tabBtn('v2', '② 버전2 · 문제 파일 업로드')}
        {tabBtn('result', '③ 결과', results.length)}
      </div>

      {/* [v3.57] 탭 아래 sticky 실행 액션 바 — 진행률 + 테스트 실행 버튼 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569' }}>
                그룹 <strong style={{ color: '#1E2225' }}>{progress.groupDone}/{groups.length}</strong>
              </span>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>
                {progress.done.toLocaleString()} / {(progress.total || totalCases).toLocaleString()} 완료
              </span>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#10B981' }}>성공 <strong>{progress.success}</strong></span>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#EF4444' }}>· 실패 <strong>{progress.fail}</strong></span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden', marginTop: 6 }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: progress.fail > 0 ? '#F59E0B' : '#2A75F3', transition: 'width 0.3s' }} />
            </div>
          </div>
          {activeTab !== 'result' && (
            <button
              onClick={runTest}
              disabled={!canRun}
              style={{
                padding: '12px 22px', borderRadius: '10px', border: 'none',
                background: canRun ? '#2A75F3' : '#CBD5E1',
                color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)',
                cursor: canRun ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
              }}
            >{running ? '⏳ 실행 중…' : '테스트 실행'}</button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 24px' }}>
        {(activeTab === 'v1' || activeTab === 'v2') && (
          <InputArea
            version={inputVersion}
            groups={groups}
            onUpdateGroup={updateGroup}
            onRemoveGroup={removeGroup}
            onAddGroup={addGroup}
            onChangeSubject={changeSubject}
            onChangeTask={changeTask}
            onAcceptAnswers={acceptFilesForAnswers}
            onAcceptProblem={acceptFileForProblem}
            onUpdateAnswer={updateAnswer}
            onRemoveAnswer={removeAnswer}
            onApplyBulkIter={applyBulkIter}
            bulkIter={bulkIter}
            setBulkIter={setBulkIter}
            totalCases={totalCases}
            onOpenSmartpen={(groupId) => setSmartpenModalGroupId(groupId)}
          />
        )}

        {activeTab === 'result' && (
          <ResultArea
            results={results}
            checkedIds={checkedIds}
            onToggleCheck={toggleCheck}
            onToggleCheckAll={toggleCheckAll}
            onSetTeacherGrade={setTeacherGrade}
            onSetErrorType={setErrorType}
            onSaveArchive={saveToArchive}
            onExportCsv={exportCsv}
            onImportCsv={() => importCsvInputRef.current?.click()}
            onDeleteResults={deleteResults}
            onOpenDetail={(id) => setDetailResultId(id)}
            activeDetailId={detailResultId}
          />
        )}
        <input
          ref={importCsvInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      {/* [v3.57] 결과 상세 슬라이드 아웃 패널 — 회차 클릭 시 노출 */}
      {detailResultId && (
        <ResultDetailPanel
          result={results.find(r => r.id === detailResultId)}
          onClose={() => setDetailResultId(null)}
          onSetTeacherComment={setTeacherComment}
        />
      )}

      {/* [v3.57] 스마트펜 연동 모달 */}
      {smartpenModalGroupId && (
        <SmartpenSyncModal
          groupName={effectiveGroupName(groups.find(g => g.id === smartpenModalGroupId) || {})}
          onClose={() => setSmartpenModalGroupId(null)}
          onApply={(pens) => {
            applySmartpenAnswers(smartpenModalGroupId, pens);
            setSmartpenModalGroupId(null);
          }}
        />
      )}
    </div>
  );
};

// ─────────────────── 입력 영역 ───────────────────
const InputArea = ({
  version, groups, onUpdateGroup, onRemoveGroup, onAddGroup,
  onChangeSubject, onChangeTask, onAcceptAnswers, onAcceptProblem,
  onUpdateAnswer, onRemoveAnswer, onApplyBulkIter, bulkIter, setBulkIter, totalCases,
  onOpenSmartpen,
}) => {
  return (
    <div style={{ background: 'white', borderRadius: '0 12px 12px 12px', padding: '20px', border: '1px solid #E2E8F0', borderTop: 'none' }}>
      <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, marginBottom: 16, fontSize: 'var(--neo-font-size-sm)', color: '#1D4ED8' }}>
        {version === 1
          ? '① 서비스에 등록된 교과 → 과제 → 문항을 선택하고 학생 답안을 업로드해 채점 테스트를 진행합니다.'
          : '② 문제 파일(JSON/이미지)을 직접 업로드하고 학생 답안을 업로드해 채점 테스트를 진행합니다.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {groups.map((g) => (
          <GroupCard
            key={g.id} g={g} version={version}
            canRemove={groups.length > 1}
            onUpdate={(patch) => onUpdateGroup(g.id, patch)}
            onRemove={() => onRemoveGroup(g.id)}
            onChangeSubject={(s) => onChangeSubject(g.id, s)}
            onChangeTask={(t) => onChangeTask(g.id, t)}
            onAcceptAnswers={(files) => onAcceptAnswers(g.id, files)}
            onAcceptProblem={(file) => onAcceptProblem(g.id, file)}
            onUpdateAnswer={(ansId, patch) => onUpdateAnswer(g.id, ansId, patch)}
            onRemoveAnswer={(ansId) => onRemoveAnswer(g.id, ansId)}
            onApplyBulkIter={() => onApplyBulkIter(g.id)}
            bulkIter={bulkIter}
            setBulkIter={setBulkIter}
            onOpenSmartpen={() => onOpenSmartpen(g.id)}
          />
        ))}

        <button
          onClick={onAddGroup}
          style={{
            padding: '14px', borderRadius: '10px',
            border: '1.5px dashed #CBD5E1', background: 'white',
            color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer',
          }}
        >+ 테스트 그룹 추가</button>
      </div>

      <div style={{ textAlign: 'right', marginTop: '12px', fontSize: 'var(--neo-font-size-sm)', color: '#475569' }}>
        총 케이스 <strong style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-base)' }}>{totalCases.toLocaleString()}건</strong>
      </div>
    </div>
  );
};

// ─────────────────── 그룹 카드 ───────────────────
const GroupCard = ({
  g, version, canRemove, onUpdate, onRemove,
  onChangeSubject, onChangeTask, onAcceptAnswers, onAcceptProblem,
  onUpdateAnswer, onRemoveAnswer, onApplyBulkIter, bulkIter, setBulkIter,
  onOpenSmartpen,
}) => {
  const tasks = MOCK_TASKS_BY_SUBJECT[g.subject] || [];
  const task = tasks.find(t => t.id === g.taskId);
  const enabledCases = g.answers?.filter(a => a.enabled).reduce((s, a) => s + (Number(a.iterations) || 0), 0) || 0;

  return (
    <div style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '14px' }}>
      {/* [v3.57] 헤더 재편: 라벨 옆에 케이스 카운트 + 삭제 버튼 모두 배치, 아래에 큰 제목 입력 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, minHeight: 22 }}>
          <label style={{ ...fieldLabel, fontSize: 'var(--neo-font-size-sm)', display: 'inline' }}>📝 테스트 제목</label>
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', whiteSpace: 'nowrap' }}>
            · 케이스 <strong style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-sm)' }}>{enabledCases.toLocaleString()}건</strong>
          </span>
          <div style={{ flex: 1 }} />
          {canRemove && (
            <button
              onClick={onRemove} title="그룹 삭제"
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: 'white', color: '#DC2626', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >🗑️ 삭제</button>
          )}
        </div>
        <input
          value={g.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={g.defaultName || '테스트 제목'}
          title={`비워두면 「${g.defaultName}」로 자동 확정됩니다`}
          style={{
            width: '100%', padding: '26px 16px', borderRadius: 10,
            border: '1px solid #CBD5E1', background: 'white',
            fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225',
          }}
        />
      </div>

      {/* 대상 문항 선택 카드 (교과 → 과제명/문제파일 → 문항 계층) */}
      <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#475569' }}>
          🎯 대상 문항 선택
          <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 'var(--neo-font-size-xs)' }}>
            교과 → {version === 1 ? '과제명' : '문제 파일'} → 문항
          </span>
        </div>
      {version === 1 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 10 }}>
          <div>
            <label style={fieldLabel}>교과</label>
            <select value={g.subject} onChange={(e) => onChangeSubject(e.target.value)} style={fieldSelect}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>과제명</label>
            <select value={g.taskId} onChange={(e) => onChangeTask(e.target.value)} style={fieldSelect}>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>
              문항 {task?.questions?.length === 1 && <span style={{ color: '#94A3B8', fontWeight: 500 }}>(단일)</span>}
            </label>
            <select
              value={g.questionNo}
              onChange={(e) => onUpdate({ questionNo: Number(e.target.value) })}
              disabled={!task || task.questions.length <= 1}
              style={{ ...fieldSelect, background: task?.questions?.length <= 1 ? '#F8FAFC' : 'white' }}
            >
              {(task?.questions || []).map(q => <option key={q.no} value={q.no}>{`${q.no}번 문항`}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 10 }}>
          <div>
            <label style={fieldLabel}>교과</label>
            <select value={g.subject} onChange={(e) => onChangeSubject(e.target.value)} style={fieldSelect}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>문제 파일</label>
            <FileDropzone
              accept=".json,image/*,.pdf"
              multiple={false}
              onFiles={(files) => onAcceptProblem(files[0])}
              label={g.problemFile ? `📄 ${g.problemFile.fileName}` : 'JSON · PNG · JPG · PDF 드래그·클릭'}
              compact
            />
          </div>
          <div>
            <label style={fieldLabel}>
              문항 {g.problemFile?.questions?.length === 1 && <span style={{ color: '#94A3B8', fontWeight: 500 }}>(단일)</span>}
            </label>
            <select
              value={g.problemQuestionNo}
              onChange={(e) => onUpdate({ problemQuestionNo: Number(e.target.value) })}
              disabled={!g.problemFile || g.problemFile.questions.length <= 1}
              style={{ ...fieldSelect, background: (!g.problemFile || g.problemFile.questions.length <= 1) ? '#F8FAFC' : 'white' }}
            >
              {(g.problemFile?.questions || [{ no: 1, name: '문항 1' }]).map(q => <option key={q.no} value={q.no}>{`${q.no}번 문항`}</option>)}
            </select>
          </div>
        </div>
      )}
      </div>

      {/* 답안지 섹션 */}
      <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>학생 답안</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B' }}>일괄 반복</span>
            <input
              type="number" min="1" max="1000"
              value={bulkIter}
              onChange={(e) => setBulkIter(Number(e.target.value) || 1)}
              style={{ width: '68px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', textAlign: 'right' }}
            />
            <button
              onClick={onApplyBulkIter}
              disabled={g.answers.length === 0}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: g.answers.length === 0 ? 'not-allowed' : 'pointer' }}
            >적용</button>
            <button
              onClick={onOpenSmartpen}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #A855F7', background: '#FAF5FF', color: '#7C3AED', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}
              title="스마트펜에서 답안 필기 데이터를 JSON으로 가져옵니다"
            >📡 스마트펜 연동</button>
          </div>
        </div>

        <FileDropzone
          accept="image/*,.pdf,.json"
          multiple
          onFiles={onAcceptAnswers}
          label={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', pointerEvents: 'none' }}
              >
                <span
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    border: '1px solid #2A75F3', background: '#EFF6FF',
                    color: '#1D4ED8', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
                    pointerEvents: 'auto',
                  }}
                >+ 답안 추가</span>
              </span>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>
                또는 답안 파일을 여기로 드래그해서 놓거나 클릭해서 여러 개 업로드
              </div>
            </div>
          }
        />

        {g.answers.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {g.answers.map((a, idx) => (
              <AnswerCard
                key={a.id}
                idx={idx + 1}
                a={a}
                onToggle={(checked) => onUpdateAnswer(a.id, { enabled: checked })}
                onChangeIter={(n) => onUpdateAnswer(a.id, { iterations: n })}
                onRemove={() => onRemoveAnswer(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────── 답안 카드 ───────────────────
const AnswerCard = ({ idx, a, onToggle, onChangeIter, onRemove }) => {
  const isJson = a.fileType === 'json';
  const icon = isJson ? '📋' : (a.fileType === 'pdf' ? '📄' : '🖼️');
  const iconBg = isJson ? '#EDE9FE' : (a.fileType === 'pdf' ? '#FEF3C7' : '#DBEAFE');
  const iconColor = isJson ? '#7C3AED' : (a.fileType === 'pdf' ? '#B45309' : '#1D4ED8');
  const dim = !a.enabled;
  return (
    <div style={{
      background: 'white', border: `1.5px solid ${a.enabled ? '#CBD5E1' : '#E2E8F0'}`,
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: dim ? 0.55 : 1, transition: 'opacity .15s, border-color .15s',
      position: 'relative',
    }}>
      {/* 헤더: 체크박스 + #idx + 삭제 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>
          <input type="checkbox" checked={a.enabled} onChange={(e) => onToggle(e.target.checked)} />
          #{idx}
        </label>
        <button
          onClick={onRemove}
          title="답안 삭제"
          style={{ padding: '2px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* 파일 아이콘 + 파일명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8, background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-xl)', flexShrink: 0,
        }}>{a.source === 'smartpen' ? '📡' : icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div title={a.fileName} style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E2225', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.fileName}</div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 1 }}>
            {a.source === 'smartpen' && a.penInfo
              ? <span style={{ color: '#7C3AED', fontWeight: 700 }}>{a.penInfo.name} · {a.penInfo.strokeCount ?? 0} strokes</span>
              : <span style={{ textTransform: 'uppercase' }}>{a.fileType || 'file'}</span>}
          </div>
        </div>
      </div>

      {/* 반복 횟수 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed #E2E8F0' }}>
        <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>반복</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number" min="1" max="1000"
            value={a.iterations}
            onChange={(e) => onChangeIter(Number(e.target.value) || 1)}
            style={{ width: 62, padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', textAlign: 'right', fontWeight: 700, color: '#1E2225' }}
          />
          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>회</span>
        </div>
      </div>
    </div>
  );
};

// ─────────────────── 파일 드롭존 ───────────────────
const FileDropzone = ({ accept, multiple, onFiles, label, compact }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      style={{
        padding: compact ? '10px 12px' : '18px',
        border: `1.5px dashed ${dragOver ? '#2A75F3' : '#CBD5E1'}`,
        borderRadius: '10px',
        background: dragOver ? '#EFF6FF' : '#FAFAFA',
        // 舊 0.82rem/0.85rem(13.1px/13.6px) → 두 값 모두 sm(14px)로 스냅되어 분기 제거
        color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600,
        textAlign: 'center', cursor: 'pointer',
        marginTop: compact ? 2 : 0,
      }}
    >
      {label}
      <input
        ref={inputRef} type="file" accept={accept} multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
};

// ─────────────────── 결과 영역 ───────────────────
const ResultArea = ({
  results, checkedIds, onToggleCheck, onToggleCheckAll, onSetTeacherGrade, onSetErrorType,
  onSaveArchive, onExportCsv, onImportCsv, onDeleteResults,
  onOpenDetail, activeDetailId,
}) => {
  const allChecked = results.length > 0 && checkedIds.size === results.length;
  const selectionLabel = checkedIds.size > 0 ? `선택된 ${checkedIds.size}건` : '전체';

  return (
    <div style={{ background: 'white', borderRadius: '0 12px 12px 12px', padding: '20px', border: '1px solid #E2E8F0', borderTop: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569' }}>
          총 <strong style={{ color: '#1E2225' }}>{results.length.toLocaleString()}건</strong>
          {checkedIds.size > 0 && <span style={{ marginLeft: 8, color: '#2A75F3' }}>· 선택 {checkedIds.size}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSaveArchive}
            disabled={results.length === 0}
            style={btnPrimary(results.length === 0)}
            title={`${selectionLabel} 결과를 아카이브에 저장`}
          >📥 아카이브 저장 ({selectionLabel})</button>
          <button
            onClick={onExportCsv}
            disabled={results.length === 0}
            style={btnSecondary(results.length === 0)}
            title={`${selectionLabel} 결과를 CSV로 내보내기`}
          >⬇ CSV 내보내기</button>
          <button
            onClick={onImportCsv}
            style={btnSecondary(false)}
          >⬆ CSV 가져오기</button>
          <button
            onClick={onDeleteResults}
            disabled={checkedIds.size === 0}
            style={btnDanger(checkedIds.size === 0)}
            title={checkedIds.size === 0 ? '체크박스로 삭제할 항목을 먼저 선택하세요' : `선택된 ${checkedIds.size}건 삭제`}
          >🗑 선택 삭제{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}</button>
        </div>
      </div>

      {results.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 'var(--neo-font-size-base)' }}>
          아직 결과가 없습니다. 「버전1」 또는 「버전2」 탭에서 테스트를 실행하거나 CSV를 불러오세요.
        </div>
      ) : (
        <div style={{ overflowX: 'hidden', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#F1F5F9', zIndex: 1 }}>
              <tr>
                <th style={thStyle(36)}>
                  <input type="checkbox" checked={allChecked} onChange={onToggleCheckAll} />
                </th>
                <th style={thStyle(52)}>회차#</th>
                <th style={thStyle()}>테스트명</th>
                <th style={thStyle()}>과제명</th>
                <th style={thStyle(56)}>답안#</th>
                <th style={thStyle(62)}>소요(s)</th>
                <th style={thStyle(70)}>토큰</th>
                <th style={thStyle(82)} title="AI 평가 등급">AI 등급</th>
                <th style={thStyle(108)} title="교사 평가 등급">교사 등급</th>
                <th style={thStyle(128)}>오류 유형</th>
                <th style={thStyle(64)}>상태</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isActive = activeDetailId === r.id;
                const rowBg = isActive ? '#DBEAFE' : checkedIds.has(r.id) ? '#EFF6FF' : 'white';
                return (
                <tr
                  key={r.id}
                  onClick={() => onOpenDetail && onOpenDetail(r.id)}
                  title="클릭해서 상세 결과 열기"
                  style={{ borderTop: '1px solid #F1F5F9', background: rowBg, cursor: 'pointer' }}
                >
                  <td style={tdStyle('center')} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checkedIds.has(r.id)} onChange={() => onToggleCheck(r.id)} />
                  </td>
                  <td style={{ ...tdStyle(), color: '#2A75F3', fontWeight: 700 }}>#{r.runIdx}</td>
                  <td style={tdStyle()} title={r.groupName}>{r.groupName}</td>
                  <td style={tdStyle()} title={r.taskName}>{r.taskName}</td>
                  <td style={tdStyle()}>{r.answerIdx}</td>
                  <td style={tdStyle('right')}>{Number(r.elapsedSec).toFixed(2)}</td>
                  <td style={tdStyle('right')}>{Number(r.tokens).toLocaleString()}</td>
                  <td style={tdStyle()}>
                    {r.aiGrade && r.aiGrade !== '-' ? (
                      <span style={{ color: GRADE_COLOR[r.aiGrade] || '#475569', fontWeight: 700 }}>{r.aiGrade}</span>
                    ) : <span style={{ color: '#94A3B8' }}>-</span>}
                  </td>
                  <td style={tdStyle()} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={r.teacherGrade || ''}
                      onChange={(e) => onSetTeacherGrade(r.id, e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', color: r.teacherGrade ? (GRADE_COLOR[r.teacherGrade] || '#1E2225') : '#94A3B8', fontWeight: r.teacherGrade ? 700 : 500 }}
                    >
                      <option value="">선택</option>
                      {GRADE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    {r.matchStatus && MATCH_STYLE[r.matchStatus] && (
                      <div title={`AI 등급(${r.aiGrade}) vs 교사 등급(${r.teacherGrade}) 자동 계산`} style={{
                        marginTop: 4, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800,
                        padding: '1px 6px', borderRadius: 999,
                        background: MATCH_STYLE[r.matchStatus].bg,
                        color: MATCH_STYLE[r.matchStatus].color,
                        display: 'inline-block',
                      }}>
                        {MATCH_STYLE[r.matchStatus].label}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle()} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={r.errorType || '해당없음'}
                      onChange={(e) => onSetErrorType(r.id, e.target.value)}
                      title={r.errorType}
                      style={{
                        width: '100%',
                        padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1',
                        fontSize: 'var(--neo-font-size-sm)',
                        color: (r.errorType && r.errorType !== '해당없음') ? '#92400E' : '#64748B',
                        background: (r.errorType && r.errorType !== '해당없음') ? '#FEF3C7' : 'white',
                        fontWeight: (r.errorType && r.errorType !== '해당없음') ? 700 : 500,
                      }}
                    >
                      {ERROR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle()}>
                    {r.status === '성공' ? (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>성공</span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#FEE2E2', color: '#B91C1C', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)' }}>실패</span>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle = (width) => ({
  padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#475569',
  fontSize: 'var(--neo-font-size-xs)', borderBottom: '1px solid #E2E8F0',
  whiteSpace: 'nowrap',
  ...(width ? { width, minWidth: width, maxWidth: width } : {}),
});
const tdStyle = (align = 'left') => ({
  padding: '8px 10px', color: '#475569', textAlign: align,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
});
const btnPrimary = (disabled) => ({
  padding: '8px 14px', borderRadius: '8px', border: '1px solid #BFDBFE',
  background: disabled ? '#F1F5F9' : '#EFF6FF', color: disabled ? '#94A3B8' : '#1D4ED8',
  fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
});
const btnSecondary = (disabled) => ({
  padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1',
  background: disabled ? '#F1F5F9' : 'white', color: disabled ? '#94A3B8' : '#475569',
  fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
});
const btnDanger = (disabled) => ({
  padding: '8px 14px', borderRadius: '8px', border: '1px solid #FECACA',
  background: disabled ? '#F1F5F9' : '#FEF2F2', color: disabled ? '#94A3B8' : '#B91C1C',
  fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
});
const fieldLabel = { fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, display: 'block' };
const fieldSelect = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: 'var(--neo-font-size-sm)', marginTop: 2, background: 'white' };

// ─────────────────── 스마트펜 연동 모달 ───────────────────
const MOCK_PEN_POOL = [
  { name: 'NWP-F45 · A', model: 'NWP-F45', battery: 100 },
  { name: 'NWP-F45 · B', model: 'NWP-F45', battery: 82 },
  { name: 'NWP-F110 · C', model: 'NWP-F110', battery: 67 },
];

// [v3.57] 각 펜별로 mock 스트로크(획) 데이터 생성
//   실제 하드웨어에서는 stroke 좌표 · 필압 · 타임스탬프가 담긴 필기 궤적 배열이 반환됨
const generatePenStrokes = (penIdx) => {
  const seed = penIdx + 1;
  const strokeCount = 4 + (seed % 3); // 4~6 strokes
  const now = Date.now();
  return Array.from({ length: strokeCount }, (_, i) => {
    const pts = 12 + (i % 6);
    const startX = 80 + (i * 60 + seed * 40) % 500;
    const startY = 60 + (i * 40 + seed * 30) % 250;
    return {
      id: `stroke-${penIdx}-${i}`,
      penIdx,
      startedAt: now + i * 250,
      endedAt: now + i * 250 + pts * 20,
      points: Array.from({ length: pts }, (_, j) => ({
        x: +(startX + j * 12 + Math.sin(j * 0.6 + seed) * 20).toFixed(2),
        y: +(startY + Math.cos(j * 0.5 + seed) * 30 + j * 4).toFixed(2),
        p: +(0.4 + Math.abs(Math.sin(j * 0.3)) * 0.5).toFixed(2), // 필압 0.4~0.9
        t: now + i * 250 + j * 20,
      })),
    };
  });
};

// [v3.57] 연결된 모든 펜을 표준 JSON 번들로 내보내기
const downloadPensJson = (pens) => {
  const bundle = {
    exportedAt: new Date().toISOString(),
    source: 'AiGleConnect Smartpen Sync (mock)',
    version: '1.0',
    penCount: pens.length,
    pens: pens.map(p => ({
      name: p.name, model: p.model, battery: p.battery,
      strokeCount: p.strokes?.length || 0,
      strokes: p.strokes || [],
    })),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url; a.download = `smartpen_export_${ts}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const SmartpenSyncModal = ({ groupName, onClose, onApply }) => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'connecting' | 'success' | 'error'
  const [pens, setPens] = useState([]); // 연결된 펜 목록
  const [hasData, setHasData] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (level, message) => {
    const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs(prev => [...prev, { level, message, ts }]);
  };

  const startConnection = () => {
    if (status === 'connecting') return;
    setStatus('connecting');
    setPens([]);
    setHasData(false);
    setLogs([]);
    addLog('SUCCESS', 'AigleConnect 준비 완료 — 디스커버리 진행');
    addLog('INFO', 'AigleConnect 실행 확인 중…');
    setTimeout(() => addLog('WAIT', '로컬 서버 응답 대기 중…'), 400);
    setTimeout(() => addLog('INFO', 'AigleConnect 응답 대기 (시도 1)'), 800);
    setTimeout(() => {
      const count = 1 + Math.floor(Math.random() * 2); // 1~2개
      const found = MOCK_PEN_POOL.slice(0, count);
      setPens(found);
      addLog('SUCCESS', `스마트펜 ${found.length}개 연결됨`);
      addLog('INFO', '전체 펜 스트로크 수신 중…');
      setTimeout(() => {
        // [v3.57] 연결된 모든 펜의 데이터를 일괄 로드
        const loaded = found.map((p, i) => ({ ...p, strokes: generatePenStrokes(i) }));
        const totalStrokes = loaded.reduce((s, p) => s + p.strokes.length, 0);
        setPens(loaded);
        setHasData(true);
        setStatus('success');
        loaded.forEach(p => addLog('INFO', `[${p.name}] 스트로크 ${p.strokes.length}개 수신`));
        addLog('SUCCESS', `전체 펜 데이터 추출 완료 (총 ${totalStrokes} strokes)`);
      }, 700);
    }, 1500);
  };

  const reloadStrokes = () => {
    if (pens.length === 0) return;
    setHasData(false);
    addLog('INFO', '수동 다시 불러오기 요청 — 전체 펜 대상');
    setTimeout(() => {
      const reloaded = pens.map((p, i) => ({ ...p, strokes: generatePenStrokes(i + Date.now() % 7) }));
      const totalStrokes = reloaded.reduce((s, p) => s + p.strokes.length, 0);
      setPens(reloaded);
      setHasData(true);
      addLog('SUCCESS', `전체 펜 스트로크 재수신 완료 (총 ${totalStrokes} strokes)`);
    }, 500);
  };

  const exportJson = () => {
    if (pens.length === 0) return;
    const totalStrokes = pens.reduce((s, p) => s + (p.strokes?.length || 0), 0);
    downloadPensJson(pens);
    addLog('SUCCESS', `표준 JSON 일괄 내보내기 완료 — ${pens.length}개 펜 · 총 ${totalStrokes} strokes`);
  };

  // [v3.57] 개별 펜 미리보기 삭제 — 동기화 대상에서 그 펜 제외
  const removePen = (idx) => {
    const target = pens[idx];
    if (!target) return;
    setPens(prev => prev.filter((_, i) => i !== idx));
    addLog('INFO', `[${target.name}] 미리보기에서 제외됨 — 동기화 대상 아님`);
  };

  const isConnected = status === 'success' && pens.length > 0;
  const canApply = isConnected && hasData;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 14, boxShadow: '0 24px 60px -20px rgba(15,23,42,0.4)',
          width: '92vw', maxWidth: 1100, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 900, color: '#1E2225' }}>스마트펜 연동</h3>
          <StatusBadge status={status} pensCount={pens.length} />
          <span style={{ marginLeft: 8, color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>· 그룹: {groupName}</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose} title="창 닫기"
            style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: '#64748B', fontSize: 'var(--neo-font-size-lg)', cursor: 'pointer' }}
          >✕</button>
        </div>

        {/* 본문: 좌 캔버스 + 우 사이드 */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: 0 }}>
          {/* 좌: 펜별 미리보기 그리드 */}
          <div style={{ padding: 16, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasData ? '#10B981' : '#94A3B8', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                {hasData ? `✓ 렌더링 완료 (${pens.length}개 미리보기)` : status === 'connecting' ? '⏳ 수신 대기 중' : '· 대기'}
              </div>
              {hasData && (
                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                  총 {pens.reduce((s, p) => s + (p.strokes?.length || 0), 0)} strokes
                </div>
              )}
            </div>
            <div style={{
              flex: 1, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
              overflow: 'auto', padding: hasData ? 14 : 0,
              display: hasData ? 'block' : 'flex',
              alignItems: hasData ? undefined : 'center',
              justifyContent: hasData ? undefined : 'center',
              minHeight: 320,
            }}>
              {hasData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {pens.map((p, i) => (
                    <PenPreviewCard key={i} pen={p} idx={i} onRemove={() => removePen(i)} />
                  ))}
                </div>
              ) : (
                <EmptyState status={status} />
              )}
            </div>
            {hasData && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', color: '#1D4ED8' }}>
                <strong>ℹ 데이터 준비 완료</strong> — 각 펜의 미리보기 확인 후 [동기화 완료]로 답안에 반영하거나, 미리보기 우상단 <span style={{ background: '#EF4444', color: 'white', padding: '0 6px', borderRadius: 999, fontWeight: 800 }}>−</span> 버튼으로 개별 펜을 제외할 수 있습니다.
              </div>
            )}
          </div>

          {/* 우: 사이드 */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: '#F8FAFC' }}>
            {/* USB 연동 카드 */}
            <div style={{ padding: 16, borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                {isConnected ? (
                  <>
                    <div style={{ fontSize: '1.4rem', color: '#DC2626' }}>((·))</div>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginTop: 4 }}>수신 중</div>
                    <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginTop: 2 }}>실시간 연결됨</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '1.4rem', color: '#64748B' }}>⌁</div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                      USB로 스마트펜을 PC에 연결한 뒤<br />아래 버튼을 눌러 연동을 시작하세요.
                    </div>
                    <button
                      onClick={startConnection}
                      disabled={status === 'connecting'}
                      style={{
                        marginTop: 10, width: '100%',
                        padding: '10px', borderRadius: 8, border: 'none',
                        background: status === 'connecting' ? '#CBD5E1' : '#2A75F3',
                        color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
                        cursor: status === 'connecting' ? 'wait' : 'pointer',
                      }}
                    >{status === 'connecting' ? '⏳ 연동 중…' : '연동 가동 (앱 실행)'}</button>
                  </>
                )}
              </div>
            </div>

            {/* 연결된 펜 목록 */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>
                  연결된 펜 목록 {pens.length > 0 && <span style={{ color: '#94A3B8', fontWeight: 500 }}>({pens.length})</span>}
                </div>
                <button
                  onClick={() => startConnection()}
                  title="다시 검색"
                  style={{ padding: '2px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)' }}
                >⟳</button>
              </div>
              {pens.length === 0 ? (
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', textAlign: 'center', padding: '10px 0' }}>
                  연결된 펜이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pens.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'white', border: '1.5px solid #2A75F3', borderRadius: 8,
                      padding: '8px 12px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>
                          Model: {p.model}
                          {p.strokes?.length > 0 && <> · <span style={{ color: '#2A75F3', fontWeight: 700 }}>{p.strokes.length} strokes</span></>}
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: p.battery >= 80 ? '#10B981' : p.battery >= 40 ? '#F59E0B' : '#EF4444' }}>
                        {p.battery}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isConnected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={reloadStrokes}
                    style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}
                  >⟳ 수동으로 다시 불러오기</button>
                  <button
                    onClick={exportJson}
                    style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}
                  >⬇ 표준 JSON 내보내기</button>
                </div>
              )}
            </div>

            {/* 통신 로그 */}
            <div style={{ padding: '14px 16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E2225' }}>통신 로그</div>
                <button
                  onClick={() => setLogs([])}
                  title="로그 지우기"
                  style={{ padding: '2px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', fontSize: 'var(--neo-font-size-base)' }}
                >🗑</button>
              </div>
              <div style={{
                background: '#1E293B', borderRadius: 8, padding: 10,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 'var(--neo-font-size-xs)', color: '#CBD5E1',
                overflow: 'auto', flex: 1, minHeight: 100, maxHeight: 200,
              }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#64748B' }}>로그가 없습니다…</div>
                ) : logs.map((l, i) => (
                  <div key={i} style={{ marginBottom: 3 }}>
                    <span style={{ color: LOG_COLORS[l.level] || '#94A3B8', fontWeight: 700 }}>[{l.level}]</span>{' '}
                    <span>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}
          >창 닫기</button>
          <button
            onClick={() => onApply(pens)}
            disabled={!canApply}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: canApply ? '#2A75F3' : '#CBD5E1',
              color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
              cursor: canApply ? 'pointer' : 'not-allowed',
            }}
          >동기화 완료 (답안으로 적용)</button>
        </div>
      </div>
    </div>
  );
};

const LOG_COLORS = { SUCCESS: '#10B981', INFO: '#3B82F6', WAIT: '#F59E0B', ERROR: '#EF4444' };

const StatusBadge = ({ status, pensCount }) => {
  const label = status === 'success' && pensCount > 0 ? '연동 성공'
    : status === 'connecting' ? '연동 중'
    : status === 'error' ? '연동 실패' : '연동 꺼짐';
  const bg = status === 'success' ? '#DCFCE7' : status === 'connecting' ? '#DBEAFE' : status === 'error' ? '#FEE2E2' : '#F1F5F9';
  const color = status === 'success' ? '#166534' : status === 'connecting' ? '#1D4ED8' : status === 'error' ? '#B91C1C' : '#64748B';
  return <span style={{ padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>{label}</span>;
};

const EmptyState = ({ status }) => (
  <div style={{ textAlign: 'center', color: '#94A3B8' }}>
    <div style={{ fontSize: '2rem' }}>⌁</div>
    <div style={{ marginTop: 6, fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#475569' }}>
      {status === 'connecting' ? '수신 대기 중…' : '스마트펜 연동 필요'}
    </div>
    <div style={{ marginTop: 4, fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.5 }}>
      {status === 'connecting'
        ? '로컬 서버 응답을 기다리고 있습니다…'
        : (<>스마트펜 연동을 시작하려면 [연동 가동] 버튼을 클릭해 주세요.<br />브라우저의 프로토콜 실행 확인창이 뜨면 '허용'을 선택해야 합니다.</>)}
    </div>
  </div>
);

// [v3.57] 펜별 미리보기 카드 — 실제 스트로크 좌표를 그대로 렌더링 + 우상단 삭제(−) 버튼
const PenPreviewCard = ({ pen, idx, onRemove }) => {
  const strokes = pen.strokes || [];
  const strokeCount = strokes.length;
  // viewBox: 스트로크 좌표 범위에 여유 padding 추가 (mock 좌표는 대략 0~600 x 0~320)
  const viewBox = '0 0 600 320';
  return (
    <div style={{
      position: 'relative',
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'box-shadow .15s',
    }}>
      {/* 우상단 삭제 버튼 */}
      <button
        onClick={onRemove}
        title="이 펜을 미리보기·동기화 대상에서 제외"
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          width: 22, height: 22, borderRadius: 999, border: 'none',
          background: '#EF4444', color: 'white', fontWeight: 900, fontSize: 'var(--neo-font-size-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', lineHeight: 1,
        }}
      >−</button>

      {/* 스트로크 캔버스 */}
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        background: '#FAFAFA', border: '1px solid #F1F5F9', borderRadius: 6,
        overflow: 'hidden',
      }}>
        <svg viewBox={viewBox} style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="xMidYMid meet">
          <g fill="none" stroke="#1E293B" strokeLinecap="round" strokeLinejoin="round">
            {strokes.map((s, si) => {
              const pts = s.points || [];
              if (pts.length < 2) return null;
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              // 필압 평균으로 두께 조절 (0.4~0.9 → 1.2~2.4)
              const avgP = pts.reduce((s2, p) => s2 + (p.p || 0.6), 0) / pts.length;
              return <path key={si} d={d} strokeWidth={(0.8 + avgP * 1.8).toFixed(2)} />;
            })}
          </g>
        </svg>
      </div>

      {/* 라벨 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, minWidth: 0 }}>
        <div title={pen.name} style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, color: '#1E2225', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          #{idx + 1} · {pen.name}
        </div>
        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#7C3AED', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {strokeCount} strokes
        </div>
      </div>
    </div>
  );
};

// ─────────────────── 결과 상세 슬라이드 아웃 패널 ───────────────────
const GRADE_MAP_5 = { '매우 우수': 'A+ (매우 우수)', '우수': 'A (우수)', '보통': 'B (보통)', '노력': 'C (노력)', '매우 노력': 'D (매우 노력)' };

const buildMockOcrText = (r) => `[${r.taskName}]
답안 파일: ${r.answerFile || `answer_${r.answerIdx}.png`}

풀이 과정:
n-1Cr-1 = (n-1)!/((n-r)!(r-1)!)
n-1Cr   = (n-1)!/((n-r-1)!r!)

n-1Cr-1 + n-1Cr = (n-1)!/((n-r)(n-r-1)!(r-1)!) + (n-1)!/((n-r-1)!r(r-1)!)
                = (n-1)!/((n-r-1)!(r-1)!) · (1/(n-r) + 1/r)
                = (n-1)!/((n-r-1)!(r-1)!) · n/((n-r)r)
                = n!/((n-r)!r!)
                = nCr

따라서 nCr = (n-1)C(r-1) + (n-1)Cr 가 성립한다.

※ mock — 실제 서비스에서는 OCR 서버가 답안 이미지·JSON을 텍스트로 변환한 결과가 표시됩니다.`;

const buildMockAiRaw = (r) => {
  const gradeLabel = GRADE_MAP_5[r.aiGrade] || r.aiGrade || '-';
  if (r.status !== '성공') {
    return `[ERROR] 채점 실패
사유: 답안 이미지 인식 실패 또는 응답 시간 초과.
재시도 후에도 실패가 계속되면 답안 이미지 품질을 확인하세요.`;
  }
  return `Grade: ${gradeLabel} / 5단계

이런 점이 좋아요
"(n-1)C(r-1) + (n-1)Cr = nCr 이다"라고 공식을 언급하며 답안을 작성하려는 시도를 칭찬합니다. 좌우변 접근을 계승 정의로 풀어내려는 흐름이 학습 목표에 부합합니다.

조금만 더 노력해볼까요
문제에서 제시한 (가)의 계승 공식을 활용하여 논리적으로 증명하는 과정이 다소 생략되었습니다. 각 단계의 등식 변형이 「왜 성립하는지」 이유를 한 줄씩 붙여 서술하면 완결성이 높아집니다.

함께 성장해요
· 부분합·분수 결합 단계에서 공통분모를 명확히 표기하면 좋습니다.
· 최종 결론 이전에 조합 정의 nCr = n!/((n-r)!r!)을 다시 확인해 보세요.

※ mock — 실제 서비스에서는 Gemini 채점 API의 원문 응답 텍스트가 그대로 표시됩니다.`;
};

const ResultDetailPanel = ({ result, onClose, onSetTeacherComment }) => {
  if (!result) return null;
  // 입력/출력 토큰은 mock (총 토큰의 45% / 55%)
  const inputTokens = Math.round((result.tokens || 0) * 0.45);
  const outputTokens = (result.tokens || 0) - inputTokens;
  // 예상 비용 mock — Gemini 기준 토큰당 ~$0.00000187 가정
  const costUsd = +(result.tokens * 0.00000187 || 0).toFixed(5);
  const costKrw = Math.round(costUsd * 1550);
  const ocrText = buildMockOcrText(result);
  const aiRaw = buildMockAiRaw(result);
  const statusOk = result.status === '성공';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 500 }}
      />
      {/* Slide-out panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(95vw, 1000px)',
        background: 'white',
        boxShadow: '-16px 0 40px -10px rgba(15, 23, 42, 0.28)',
        zIndex: 501,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>회차</span>
              <strong style={{ fontSize: 'var(--neo-font-size-base)', color: '#2A75F3', fontWeight: 900 }}>#{result.runIdx}</strong>
              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>·</span>
              <strong style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E2225', fontWeight: 900 }}>{result.groupName}</strong>
            </div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', marginTop: 3 }}>
              {result.taskName} · <span style={{ color: '#7C3AED', fontWeight: 700 }}>답안 #{result.answerIdx}</span>
              {result.answerFile && <span style={{ marginLeft: 6, color: '#94A3B8' }}>({result.answerFile})</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 999,
              background: statusOk ? '#DCFCE7' : '#FEE2E2',
              color: statusOk ? '#166534' : '#B91C1C',
              fontWeight: 800, fontSize: 'var(--neo-font-size-sm)',
            }}>{result.status}</span>
            <button
              onClick={onClose} title="닫기"
              style={{ background: 'transparent', border: 'none', fontSize: 'var(--neo-font-size-xl)', cursor: 'pointer', color: '#64748B', padding: '2px 8px', borderRadius: 8 }}
            >✕</button>
          </div>
        </div>

        {/* 등급 요약 배너 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '10px 22px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>AI 평가</div>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: GRADE_COLOR[result.aiGrade] || '#475569' }}>
              {result.aiGrade && result.aiGrade !== '-' ? result.aiGrade : '-'}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>교사 평가</div>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: result.teacherGrade ? (GRADE_COLOR[result.teacherGrade] || '#1E2225') : '#94A3B8' }}>
              {result.teacherGrade || '미평가'}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>평가 일치도 <span style={{ color: '#CBD5E1' }}>(자동)</span></div>
            <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginTop: 2 }}>
              {result.matchStatus && MATCH_STYLE[result.matchStatus] ? (
                <span style={{
                  padding: '2px 10px', borderRadius: 999,
                  background: MATCH_STYLE[result.matchStatus].bg,
                  color: MATCH_STYLE[result.matchStatus].color,
                  fontSize: 'var(--neo-font-size-sm)',
                }}>{MATCH_STYLE[result.matchStatus].label}</span>
              ) : <span style={{ color: '#94A3B8' }}>-</span>}
            </div>
          </div>
        </div>

        {/* 본문: 상단 2단(OCR·AI Raw) + 하단 연구진 코멘트 (품질 평가) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: 20, overflow: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 260 }}>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: 8 }}>📝 OCR 변환 텍스트</div>
              <div style={{
                flex: 1,
                padding: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                lineHeight: 1.6, overflow: 'auto',
              }}>
                {ocrText}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225', marginBottom: 8 }}>🤖 AI 채점 결과 (Raw)</div>
              <div style={{
                flex: 1,
                padding: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', whiteSpace: 'pre-wrap',
                lineHeight: 1.65, overflow: 'auto',
              }}>
                {aiRaw}
              </div>
            </div>
          </div>

          {/* [v3.57] 품질 평가 — 연구진 코멘트 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E2225' }}>💡 연구진 코멘트 · 품질 평가</span>
              <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>· 아카이브 저장 시 함께 보존됩니다</span>
            </div>
            <textarea
              value={result.teacherComment || ''}
              onChange={(e) => onSetTeacherComment && onSetTeacherComment(result.id, e.target.value)}
              placeholder="이 회차의 AI 채점 품질을 평가해 주세요. (예: 채점 근거가 명확한가, OCR 결과 이슈, 프롬프트 개선 아이디어 등)"
              rows={5}
              style={{
                width: '100%', padding: 14,
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
                fontSize: 'var(--neo-font-size-sm)', color: '#78350F', lineHeight: 1.6,
                resize: 'vertical', minHeight: 100, fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* 하단 메트릭스 */}
        <div style={{
          padding: '12px 22px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
          display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 'var(--neo-font-size-sm)', color: '#475569',
        }}>
          <span>채점 시간 <strong style={{ color: '#1E2225', fontSize: 'var(--neo-font-size-sm)' }}>{Number(result.elapsedSec).toFixed(2)}s</strong></span>
          <span>
            사용 토큰 <strong style={{ color: '#1E2225', fontSize: 'var(--neo-font-size-sm)' }}>{result.tokens.toLocaleString()}</strong>
            <span style={{ color: '#94A3B8' }}> ({(result.tokens / 1000).toFixed(1)}K)</span>
            <span style={{ marginLeft: 8, color: '#94A3B8' }}>입력 {inputTokens.toLocaleString()} / 출력 {outputTokens.toLocaleString()}</span>
          </span>
          <span>
            예상 비용 <strong style={{ color: '#1E2225', fontSize: 'var(--neo-font-size-sm)' }}>${costUsd.toFixed(5)} USD</strong>
            <span style={{ margin: '0 4px', color: '#CBD5E1' }}>/</span>
            <strong style={{ color: '#1E2225', fontSize: 'var(--neo-font-size-sm)' }}>{costKrw.toLocaleString()}원</strong>
          </span>
        </div>
      </div>
    </>
  );
};

export default AiGradingTest;
