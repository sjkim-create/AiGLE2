/**
 * PromptStudio.jsx
 * Prompt Studio 화면입니다.
 * 교과별 AI 채점 프롬프트를 버전 관리하고, 학생 답안(이미지/JSON) 업로드 및 스마트펜 연동으로
 * AI 채점을 테스트하는 원스톱 채점 자동화 도구입니다.
 * 테스트 결과는 Prompt 아카이브에 저장하고 분석 리포트와 연계됩니다.
 */
import React, { useState, useRef } from 'react';
import './index.css';
import { renderOriginalImage } from './strokeMetadata.js';
import { analyzeHandwriting, buildStage1Report, buildReportSections } from './handwritingAnalysis.js';
import SmartpenCaptureModal from './SmartpenCaptureModal';

// ─────────────────────────────────────────────────────────
//  Default Prompts & Mock Data
// ─────────────────────────────────────────────────────────
const DEFAULT_OCR_PROMPT = `Please transcribe the handwritten Korean text from the provided image precisely.
Keep the original structure and include any mathematical notations in LaTeX format if possible.`;

const DEFAULT_SYSTEM_PROMPTS = {
  '국어': `## [Role]
You are an expert Korean language educator and AI grading engine.

## [Objective]
Analyze the student's answer based on the provided Model Answer and Grading Criteria.
Provide a grade and constructive feedback.

## [Grading Logic]
1. Compare the OCR-transcribed student answer with the Model Answer.
2. Check for key literary terms, logical flow, and author's intent analysis.
3. Be encouraging but precise in your feedback.`,

  '수학': `## [Role]
You are an expert mathematics educator and AI grading engine.

## [Objective]
Analyze the student's answer based on the provided Model Answer and Grading Criteria.
Provide a grade and constructive feedback.

## [Grading Logic]
1. Compare the OCR-transcribed student answer with the Model Answer.
2. Check the accuracy of each calculation step and the final answer.
3. Partial credit may apply if the process is correct but the final answer is wrong.`,

  '과학': `## [Role]
You are an expert science educator and AI grading engine.

## [Objective]
Analyze the student's answer based on the provided Model Answer and Grading Criteria.
Provide a grade and constructive feedback.

## [Grading Logic]
1. Compare the OCR-transcribed student answer with the Model Answer.
2. Verify that key scientific concepts and required elements are mentioned.
3. Be encouraging but precise in your feedback.`,

  '기본': `## [Role]
You are an expert educator and AI grading engine.

## [Objective]
Analyze the student's answer based on the provided Model Answer and Grading Criteria.
Provide a grade and constructive feedback.

## [Grading Logic]
1. Compare the OCR-transcribed student answer with the Model Answer.
2. Apply the Grading Criteria strictly.
3. Be encouraging but precise in your feedback.`,
};

// 등급평가(과정 분석) 전용 프롬프트
const DEFAULT_PROCESS_PROMPTS = {
  '수학': `## [Role]
You are an expert mathematics educator specializing in process-based evaluation.

## [Objective]
Evaluate the student's problem-solving process using the stroke-by-stroke handwriting data provided.
Focus on the thinking process, not just the final answer.

## [Grading Logic]
1. Analyze each step of the student's written work from the JSON stroke data.
2. Evaluate logical flow, formula application, and intermediate steps.
3. Award partial credit for correct reasoning even if the final answer is wrong.
4. Provide specific feedback on which steps were correct or incorrect.`,

  '기본': `## [Role]
You are an expert educator specializing in process-based (qualitative) evaluation.

## [Objective]
Evaluate the student's problem-solving process using the provided handwriting data.

## [Grading Logic]
1. Analyze the student's written work step by step.
2. Evaluate logical reasoning, process clarity, and concept application.
3. Award partial credit based on the quality of the process.`,
};

const EVAL_TYPES = ['등급평가', '과정 분석'];

const DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPTS['기본'];

const getVersionsKey = (subject, evalType) =>
  `sg_prompt_versions_${subject || '기본'}_${evalType || '등급평가'}`;

const makeDefaultVersions = (subject, evalType) => {
  const systemPrompt = evalType === '등급평가'
    ? (DEFAULT_PROCESS_PROMPTS[subject] ?? '')
    : (DEFAULT_SYSTEM_PROMPTS[subject] ?? '');  // 미등록 교과는 빈값, 기본 폴백 없음
  const hasPrompt = !!systemPrompt;
  return [{
    id: hasPrompt ? 'v1' : '초기 세팅',
    datetime: hasPrompt ? getNowDatetime() : null,
    description: '',
    ocr: hasPrompt ? DEFAULT_OCR_PROMPT : '',
    system: systemPrompt,
    isLive: true,
    isInitial: !hasPrompt,  // 미등록 채널 표시용 플래그
  }];
};

const CURRENT_DOMAIN = 'neolab.net';
const SUBJECT_ORDER = ['전체', '국어', '수학', '과학', '영어', '사회', '역사', '도덕', '체육', '음악', '미술', '기술'];
const INDIVIDUAL_SUBJECTS = ['국어', '수학', '과학', '영어', '사회', '역사', '도덕', '체육', '음악', '미술', '기술'];

const MOCK_ASSIGNMENTS = [
  { id: 'assign-001', label: '문학 지문 분석', type: '국어', schoolLevel: '중등', owner: 'teacher01@neolab.net', question: '다음 시의 주제와 작가의 의도를 서술하시오.', modelAnswer: '작품의 주제는 인간의 고독과 극복 의지이다. 작가는 자연물을 통해 인간의 내면 세계를 상징적으로 표현하고자 했다.', criteria: '- 핵심 키워드(고독, 극복) 포함 여부\n- 문장의 논리적 완결성\n- 작가의 의도 분석의 적절성', achievement: '[10국01-01] 문학 작품의 주제와 작가의 의도를 파악할 수 있다.', evalTypeInfo: '자율평가', gradingStep: '5단계' },
  { id: 'assign-002', label: '2차 방정식 풀이', type: '수학', schoolLevel: '중등', owner: 'teacher01@neolab.net', question: 'x^2 - 5x + 6 = 0의 해를 구하고 풀이 과정을 쓰시오.', modelAnswer: '(x-2)(x-3) = 0 따라서 x = 2 또는 x = 3.', criteria: '- 인수분해 과정의 정확성\n- 최종 해 도출 여부', achievement: '[10공수1-01-01] 다항식의 사칙연산의 원리를 설명하고, 그 계산을 할 수 있다.', evalTypeInfo: '자동평가', gradingStep: '3단계' },
  { id: 'assign-003', label: '광합성 작용 원리', type: '과학', schoolLevel: '초등', owner: 'teacher02@neolab.net', question: '광합성의 주요 단계와 필요한 요소를 설명하시오.', modelAnswer: '빛 에너지, 이산화탄소, 물을 이용하여 포도당과 산소를 생성하는 과정이다.', criteria: '- 필수 요소(빛, CO2, H2O) 명시\n- 생성물(포도당, 산소) 명시', achievement: '[6과03-01] 생태계 보전의 필요성을 바탕으로 생태계를 보호하려는 태도를 가진다.', evalTypeInfo: '자동평가', gradingStep: '3단계' },
  { id: 'assign-004', label: '소설 인물 분석', type: '국어', schoolLevel: '고등', owner: 'teacher02@neolab.net', question: '소설 속 주인공의 성격 변화를 서술하시오.', modelAnswer: '주인공은 초반 소극적 태도에서 갈등을 통해 적극적으로 변화한다.', criteria: '- 변화 전후 대비 서술\n- 갈등 요인 명시', achievement: '[12국01-01] 문학 작품의 갈등 양상을 파악하고 인물의 심리를 이해한다.', evalTypeInfo: '자율평가', gradingStep: '5단계' },
  { id: 'assign-005', label: '함수의 극값', type: '수학', schoolLevel: '고등', owner: 'teacher01@neolab.net', question: 'f(x) = x³ - 3x의 극값을 구하시오.', modelAnswer: '극대 2 (x=-1), 극소 -2 (x=1)', criteria: '- 미분 과정 정확성\n- 극대/극소 값 정확성', achievement: '[12수학Ⅰ02-01] 함수의 극한을 이해하고, 극값을 구할 수 있다.', evalTypeInfo: '자동평가', gradingStep: '3단계' },
  { id: 'assign-006', label: '뉴턴 운동 법칙', type: '과학', schoolLevel: '중등', owner: 'admin@other-school.net', question: '뉴턴의 운동 제2법칙을 설명하시오.', modelAnswer: 'F=ma, 힘은 질량과 가속도의 곱이다.', criteria: '- 공식 명시\n- 단위 포함', achievement: '[9과01-01] 뉴턴의 운동 법칙을 이해하고, 이를 실생활에 적용할 수 있다.', evalTypeInfo: '자동평가', gradingStep: '3단계' },
];

const getNowDatetime = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const PromptStudio = ({ onSaveArchive }) => {
  // --- States ---
  const [selectedAssignId, setSelectedAssignId] = useState('');
  const [question, setQuestion] = useState('');
  const [modelAnswer, setModelAnswer] = useState('');
  const [criteria, setCriteria] = useState('');
  const [achievement, setAchievement] = useState('');
  const [evalTypeInfo, setEvalTypeInfo] = useState('');
  const [gradingStep, setGradingStep] = useState('');

  const [studentImages, setStudentImages] = useState([]); // [v6.22] 원본 이미지 1장. JSON·스마트펜 입력 시 학생 답안 업로드 영역에서 원본 이미지 + 「필기 지표 분석 (3축)」 패널 함께 노출
  const [handwritingAnalysis, setHandwritingAnalysis] = useState(null); // §7.1 분석 결과 — 학생 답안 업로드 영역 sub-section으로 노출 (v6.22)
  const [stage1Report, setStage1Report] = useState(null); // Stage 1 리포트 JSON (과정평가_prompt 입력 ③ 스키마)
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const [aiModel, setAiModel] = useState('Gemini 3.1 Pro');

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const [evalMatch, setEvalMatch] = useState('보통');
  const [evalErrorType, setEvalErrorType] = useState('해당 없음');
  const [evalFeedback, setEvalFeedback] = useState('');

  const [exchangeRate, setExchangeRate] = useState(1350);
  const fileInputRef = useRef(null);
  
  // --- Smartpen Capture States ---
  const [isPenModalOpen, setIsPenModalOpen] = useState(false);

  // --- Version Effect & Handlers ---
  const [currentSubject, setCurrentSubject] = useState('국어');

  // 파라미터: 교과별 × 3탭(OCR / 1차 채점 / 재채점) 독립 관리
  const [paramTab, setParamTab] = useState('ocr'); // 'ocr' | 'grade1' | 'grade2'
  const defaultParams = {
    ocr:    { temp: 0.1, topP: 1.0, maxTokens: 2048, thinkingLevel: 'Medium', gptThinking: false },
    grade1: { temp: 0.3, topP: 1.0, maxTokens: 4096, thinkingLevel: 'Medium', gptThinking: false },
    grade2: { temp: 0.1, topP: 0.9, maxTokens: 4096, thinkingLevel: 'High', gptThinking: true },
  };
  const SUBJECTS = ['국어', '수학', '영어', '과학', '사회'];
  const initAllParams = () => {
    const saved = localStorage.getItem('aigle_subject_params');
    if (saved) try { return JSON.parse(saved); } catch { /* ignore */ }
    const init = {};
    SUBJECTS.forEach(s => { init[s] = { ...defaultParams }; });
    return init;
  };
  const [allSubjectParams, setAllSubjectParams] = useState(initAllParams);

  // 현재 교과 + 탭에 해당하는 파라미터
  const subjectParams = allSubjectParams[currentSubject] || defaultParams;
  const p = subjectParams[paramTab] || defaultParams[paramTab];
  const setP = (key, val) => {
    setAllSubjectParams(prev => {
      const next = {
        ...prev,
        [currentSubject]: {
          ...prev[currentSubject],
          [paramTab]: { ...(prev[currentSubject]?.[paramTab] || defaultParams[paramTab]), [key]: val }
        }
      };
      localStorage.setItem('aigle_subject_params', JSON.stringify(next));
      return next;
    });
  };
  // 하위 호환용 alias
  const temp = p.temp, topP = p.topP, maxTokens = p.maxTokens, thinkingLevel = p.thinkingLevel, gptThinking = p.gptThinking;
  const setTemp = (v) => setP('temp', v);
  const setTopP = (v) => setP('topP', v);
  const setMaxTokens = (v) => setP('maxTokens', v);
  const setThinkingLevel = (v) => setP('thinkingLevel', v);
  const setGptThinking = (v) => setP('gptThinking', v);
  const [evalType, setEvalType] = useState('등급평가');
  // [v6.4] 과정 분석 테스트 등급은 필수 입력 — 자동 default 제거. 사용자가 명시적으로 선택해야 함
  const [testGradeStep, setTestGradeStep] = useState(() => {
    try { return localStorage.getItem('sg_testGradeStep') || ''; } catch { return ''; }
  });
  const [testGrade, setTestGrade] = useState(() => {
    try { return localStorage.getItem('sg_testGrade') || ''; } catch { return ''; }
  });
  React.useEffect(() => { try { localStorage.setItem('sg_testGrade', testGrade); } catch {} }, [testGrade]);
  React.useEffect(() => { try { localStorage.setItem('sg_testGradeStep', testGradeStep); } catch {} }, [testGradeStep]);

  // 등급 단계별 옵션
  const GRADE_OPTIONS_BY_STEP = {
    '3단계': [
      { value: 'A', label: 'A (우수)' },
      { value: 'B', label: 'B (보통)' },
      { value: 'C', label: 'C (노력)' },
    ],
    '4단계': [
      { value: 'A', label: 'A (매우우수)' },
      { value: 'B', label: 'B (우수)' },
      { value: 'C', label: 'C (보통)' },
      { value: 'D', label: 'D (노력)' },
    ],
    '5단계': [
      { value: 'A', label: 'A (매우우수)' },
      { value: 'B', label: 'B (우수)' },
      { value: 'C', label: 'C (보통)' },
      { value: 'D', label: 'D (노력)' },
      { value: 'E', label: 'E (매우노력)' },
    ],
  };
  const currentGradeOptions = GRADE_OPTIONS_BY_STEP[testGradeStep] || GRADE_OPTIONS_BY_STEP['5단계'];

  // 등급 단계 변경 시 현재 선택값이 범위를 벗어나면 빈 값으로 reset
  // [v6.4] 자동 default 잡지 않음 — 사용자가 다시 명시적으로 선택해야 AI 실행 가능
  React.useEffect(() => {
    if (testGrade && !currentGradeOptions.some(o => o.value === testGrade)) {
      setTestGrade('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testGradeStep]);
  const [promptVersions, setPromptVersions] = useState([]);
  const [activeVersionId, setActiveVersionId] = useState('v1');
  const [versionDescription, setVersionDescription] = useState('');
  const [isDraftMode, setIsDraftMode] = useState(false);

  React.useEffect(() => {
    loadVersionsForChannel('국어', '등급평가');
  }, []);

  // S1-5: 드래프트 편집 중 페이지 이탈 경고
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDraftMode) {
        e.preventDefault();
        e.returnValue = '저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDraftMode]);

  const loadVersionsForChannel = (subject, type) => {
    let saved = localStorage.getItem(getVersionsKey(subject, type));
    let versions = saved ? JSON.parse(saved) : null;
    if (!versions || versions.length === 0) {
      versions = makeDefaultVersions(subject, type);
    }
    setPromptVersions(versions);
    const liveVer = versions.find(v => v.isLive) ?? versions[0];
    if (liveVer) {
      setActiveVersionId(liveVer.id);
      setOcrPrompt(liveVer.ocr);
      setSystemPrompt(liveVer.system);
      setVersionDescription(liveVer.description ?? '');
    }
    setIsDraftMode(false);
  };

  const handleEvalTypeChange = (type) => {
    if (!currentSubject) return;
    setEvalType(type);
    loadVersionsForChannel(currentSubject, type);
  };

  const handleSubjectChange = (subject) => {
    setCurrentSubject(subject);
    setSelectedAssignId('');
    setQuestion('');
    setModelAnswer('');
    setCriteria('');
    setAchievement('');
    setEvalTypeInfo('');
    setGradingStep('');
    setStudentImages([]);
    loadVersionsForChannel(subject, evalType);
  };

  React.useEffect(() => {
    if (!currentSubject || promptVersions.length === 0) return;
    localStorage.setItem(getVersionsKey(currentSubject, evalType), JSON.stringify(promptVersions));
  }, [promptVersions, currentSubject]);

  const handleVersionChange = (id) => {
    // 드래프트 버전은 버리고 제거
    setPromptVersions(prev => prev.filter(v => !v.isDraft));
    setActiveVersionId(id);
    setIsDraftMode(false);
    const v = promptVersions.find(v => v.id === id);
    if (v) {
      setOcrPrompt(v.ocr);
      setSystemPrompt(v.system);
      setVersionDescription(v.description ?? '');
    }
  };

  const startNewVersion = () => {
    const maxNum = promptVersions.reduce((max, v) => {
      const num = parseInt(v.id.replace('v', ''), 10) || 0;
      return Math.max(max, num);
    }, 0);
    const newId = `v${maxNum + 1}`;
    const draftVer = { id: newId, datetime: '시간 미정', description: '', ocr: '', system: '', isLive: false, isDraft: true };
    setPromptVersions(prev => [...prev, draftVer]);
    setActiveVersionId(newId);
    setOcrPrompt('');
    setSystemPrompt('');
    setVersionDescription('');
    setIsDraftMode(true);
  };

  // 전체 교과 broadcast: 현재 프롬프트 내용을 모든 개별 교과 채널에 동일 버전으로 저장
  const broadcastToAllSubjects = (versionToBroadcast) => {
    INDIVIDUAL_SUBJECTS.forEach(sub => {
      const key = getVersionsKey(sub, evalType);
      const raw = localStorage.getItem(key);
      let versions = raw ? JSON.parse(raw) : makeDefaultVersions(sub, evalType);
      // 동일 id 버전이 있으면 덮어쓰고, 없으면 추가
      const idx = versions.findIndex(v => v.id === versionToBroadcast.id);
      if (idx >= 0) versions[idx] = { ...versionToBroadcast };
      else versions = [...versions, { ...versionToBroadcast }];
      // isLive broadcast: 해당 버전만 live, 다른 버전은 live 해제
      if (versionToBroadcast.isLive) {
        versions = versions.map(v => v.id === versionToBroadcast.id ? { ...v, isLive: true } : { ...v, isLive: false });
      }
      localStorage.setItem(key, JSON.stringify(versions));
    });
  };

  const saveAsNewVersion = () => {
    try {
      const now = getNowDatetime();
      const isAllChannel = currentSubject === '전체';

      if (isAllChannel) {
        const ok = window.confirm(
          '전체 교과에 동일한 프롬프트가 적용됩니다.\n기존 교과별 프롬프트 버전(국어/수학/...)은 덮어쓰기됩니다.\n계속하시겠습니까?'
        );
        if (!ok) return;
      }

      const updatedVersion = {
        ...promptVersions.find(v => v.id === activeVersionId),
        datetime: now,
        ocr: ocrPrompt,
        system: systemPrompt,
        description: versionDescription,
        isDraft: false,
      };

      setPromptVersions(prev => prev.map(v =>
        v.id === activeVersionId ? updatedVersion : v
      ));

      if (isAllChannel) {
        broadcastToAllSubjects(updatedVersion);
      }

      setVersionDescription('');
      setIsDraftMode(false);
      alert(
        isAllChannel
          ? `${activeVersionId} 버전이 전체 교과에 적용되었습니다.`
          : `${activeVersionId} 버전이 저장되었습니다.`
      );
    } catch (e) {
      alert('저장에 실패했습니다. 다시 시도해 주세요.');
      // 드래프트 모드 유지 (입력 내용 보존, 재시도 가능)
    }
  };

  const applyToLive = () => {
    const isAllChannel = currentSubject === '전체';
    const confirmMsg = isAllChannel
      ? '이 버전을 전체 교과(국어~기술)의 라이브 DB에 일괄 적용하시겠습니까?\n기존 라이브 버전은 모두 해제됩니다.'
      : '이 버전을 라이브 DB(실 서비스)에 적용하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;

    const liveVersion = {
      ...promptVersions.find(v => v.id === activeVersionId),
      isLive: true,
    };

    setPromptVersions(prev => prev.map(v =>
      v.id === activeVersionId ? { ...v, isLive: true } : { ...v, isLive: false }
    ));

    if (isAllChannel) {
      broadcastToAllSubjects(liveVersion);
      alert('전체 교과에 프롬프트가 라이브로 적용되었습니다.');
    } else {
      alert('실제 서비스에 프롬프트가 적용되었습니다.');
    }
  };

  const deleteVersion = () => {
    if (promptVersions.length <= 1) {
      alert('최소 1개의 프롬프트 버전은 필요합니다.');
      return;
    }
    const currentV = promptVersions.find(v => v.id === activeVersionId);
    if (currentV?.isLive) {
      alert('라이브로 적용된 버전은 삭제할 수 없습니다.');
      return;
    }
    
    if (window.confirm('이 버전을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) {
      const filtered = promptVersions.filter(v => v.id !== activeVersionId);
      setPromptVersions(filtered);
      setActiveVersionId(filtered[0].id);
      setOcrPrompt(filtered[0].ocr);
      setSystemPrompt(filtered[0].system);
    }
  };
  const handleAssignChange = (id) => {
    setSelectedAssignId(id);
    const assign = MOCK_ASSIGNMENTS.find(a => a.id === id);
    if (assign) {
      setQuestion(assign.question);
      setModelAnswer(assign.modelAnswer);
      setCriteria(assign.criteria);
      setAchievement(assign.achievement);
      setEvalTypeInfo(assign.evalTypeInfo);
      setGradingStep(assign.gradingStep);

      setGradingStep(assign.gradingStep);
    } else {
      setQuestion('');
      setModelAnswer('');
      setCriteria('');
      setAchievement('');
      setEvalTypeInfo('');
      setGradingStep('');
    }
    setIsSaved(false);
  };

  const saveToArchive = () => {
    if (!result || isSaved) return;

    try {
    const currentAssign = MOCK_ASSIGNMENTS.find(a => a.id === selectedAssignId);

    const archiveItem = {
      id: `TC-${Date.now().toString().slice(-4)}`,
      assignmentId: selectedAssignId,
      title: `${currentAssign?.label || '미분류'} 테스트`,
      status: 'success',
      category: currentAssign?.type || '일반',
      model: aiModel,
      evalMode: evalType,
      gradingType: evalType === '과정 분석' ? '과정' : '등급',
      testGrade: evalType === '과정 분석' ? testGrade : undefined,
      testGradeStep: evalType === '과정 분석' ? testGradeStep : undefined,
      latency: result.latency,
      tokens: result.tokens,
      costUsd: result.costUsd,
      date: new Date().toISOString(),
      ocrText: result.ocrText,
      gradingResult: result.gradingResult,
      systemPrompt: systemPrompt,
      ocrPrompt: ocrPrompt,
      modelAnswer: modelAnswer,
      studentAnswer: "OCR 변환 텍스트 참조",
      matchStatus: evalMatch,
      errorType: evalErrorType,
      teacherFeedback: evalFeedback,
      promptVersionId: activeVersionId,
      promptVersionDatetime: promptVersions.find(v => v.id === activeVersionId)?.datetime ?? '',
      promptSubject: currentSubject
    };

    onSaveArchive(archiveItem);
    setIsSaved(true);
    alert('테스트 결과가 아카이브에 저장되었습니다. [Prompt 아카이브] 메뉴에서 분석을 진행하세요.');
    } catch (e) {
      alert('저장에 실패했습니다. 다시 시도해 주세요.');
      // 버튼 활성 상태 복구 (재시도 가능)
      setIsSaved(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('파일 용량이 초과되었습니다. 10MB 이하의 파일만 업로드 가능합니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isJson = file.name.toLowerCase().endsWith('.json');
    const isImage = file.type.startsWith('image/');

    if (!isJson && !isImage) {
      alert('지원하지 않는 파일 형식입니다. 이미지(JPG, PNG 등) 또는 JSON 파일만 업로드 가능합니다.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target.result);
          const strokes = raw[0]?.strokes ?? [];
          if (strokes.length === 0) throw new Error('획 데이터가 없습니다.');

          // §7.1 분석 실행 + Stage 1 리포트 생성 (매트릭스 조회 포함)
          const analysis = analyzeHandwriting(raw);
          setHandwritingAnalysis(analysis);
          const report = buildStage1Report(raw);
          setStage1Report(report);

          // [v6.22] 학생 답안 업로드 영역 = 원본 1장 + 3축 지표 패널. 메타데이터 인코딩 이미지(`renderMetadataImage`)는 폐기
          const origCanvas = renderOriginalImage(strokes);
          origCanvas.toBlob((origBlob) => {
            if (origBlob) {
              setStudentImages([
                { url: URL.createObjectURL(origBlob), type: 'Original' }
              ]);
              setIsSaved(false);
            }
          });
        } catch (err) {
          alert('JSON 파싱 오류: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
        }
      };
      reader.readAsText(file);
    } else {
      // [v6.22] 일반 이미지 — 원본 1장만 노출. 3축 분석은 stroke 데이터가 없어 미적용
      setStudentImages([{ url: URL.createObjectURL(file), type: 'Original' }]);
      setHandwritingAnalysis(null);
      setStage1Report(null);
      setIsSaved(false);
    }
  };

  const refreshExchangeRate = () => {
    const newRate = 1300 + Math.floor(Math.random() * 100);
    setExchangeRate(newRate);
  };

  // --- Smartpen Handlers ---
  // [v6.22] 답안 업로드 영역 = 원본 1장 + 3축 지표 패널. 메타데이터 이미지 폐기
  const handlePenDataApply = (imageUrl, strokes) => {
    const origCanvas = renderOriginalImage(strokes);
    origCanvas.toBlob((origBlob) => {
      if (origBlob) {
        setStudentImages([
          { url: URL.createObjectURL(origBlob), type: 'Original' }
        ]);
        setIsSaved(false);
        setIsPenModalOpen(false);
      }
    });
  };

  const executeAI = async () => {
    setIsRunning(true);
    setResult(null);
    setIsSaved(false);
    setEvalMatch('보통');
    setEvalErrorType('해당 없음');
    setEvalFeedback('');

    // S1-4: 60초 타임아웃
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 60000)
    );

    try {
      const aiPromise = new Promise(r => setTimeout(r, 2000)); // Mock API
      await Promise.race([aiPromise, timeoutPromise]);

      const currentLabel = currentGradeOptions.find(o => o.value === testGrade)?.label || `${testGrade}`;
      const gradeLabel = currentLabel.replace(/^[A-E]\s*\(([^)]+)\).*$/, '$1');
      const totalSteps = currentGradeOptions.length;
      const gradeIdx = currentGradeOptions.findIndex(o => o.value === testGrade);
      let gradeLevel = 'Low';
      if (gradeIdx < totalSteps / 3) gradeLevel = 'High';
      else if (gradeIdx < (totalSteps * 2) / 3) gradeLevel = 'Med';
      const mockOutput = evalType === '과정 분석' ? {
        ocrText: "(과정 분석 모드: 필기 메타데이터 — 좌표/시간 분석)",
        gradingResult: `[Student Context]\nGradingStep: ${testGradeStep}\nGrade: ${testGrade} (${gradeLabel})\n---\n[System Data Log]\n(Pattern/Metrics는 아래 리포트 섹션에서 자동 분석됨)`,
        latency: "3.18s",
        tokens: { input: 520, output: 240, total: 760 },
        costUsd: 0.00112
      } : {
        ocrText: "작품의 주제는 인간의 외로움과 그것을 이겨내려는 마음입니다. 자연을 빌려 마음을 그렸습니다.",
        gradingResult: "{\n  \"grade\": \"우수 (A)\",\n  \"feedback\": \"키워드인 고독과 극복 의지를 잘 파악했습니다.\"\n}",
        latency: "2.42s",
        tokens: { input: 420, output: 156, total: 576 },
        costUsd: 0.00085
      };

      setResult(mockOutput);
    } catch (e) {
      // AI-01:에러 상태 진입
      alert('서버와 연결이 원활하지 않습니다. 다시 시도해 주세요.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="sg-root">
      <header className="sg-header">
        <h1 className="sg-title">Prompt Studio</h1>
        <p className="sg-subtitle">문항 선택부터 AI 정밀 분석까지 원스톱 채점 자동화를 경험하세요.</p>
      </header>

      <div className="sg-container">
        {/* Left: Input Pipeline */}
        <div className="sg-pipeline">
          <div className="sg-step-line"></div>

          {/* Step 1: ① 채점 대상 선택 (교과 + 문항 + 문항 정보) — v6.24 */}
          <div className="sg-step-card">

            <div className="sg-card-content">
              <div className="sg-card-header">
                <span className="sg-card-label">① 채점 대상 선택</span>
              </div>
              {/* 교과 선택 전용 영역 */}
              <div>
                {/* 채점 교과 선택 + 평가 대상 문항 선택 — 셀렉트 2개 한 줄 배치 (v6.23) */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {/* 좌: 채점 교과 선택 셀렉트 */}
                  <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                    <label className="sg-card-label" style={{ display: 'block', fontSize: 'var(--neo-font-size-base)', color: '#0f172a', marginBottom: '8px' }}>🔖 채점 교과 선택</label>
                    <select
                      className="sg-select-full"
                      value={currentSubject}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      style={{
                        width: '100%',
                        fontWeight: 600,
                        borderColor: currentSubject === '전체' ? '#8B5CF6' : '#cbd5e1',
                        color: currentSubject === '전체' ? '#7C3AED' : '#334155',
                        background: currentSubject === '전체' ? '#F5F3FF' : '#fff',
                      }}
                    >
                      {SUBJECT_ORDER.map(sub => (
                        <option key={sub} value={sub}>{sub === '전체' ? '🌐 전체' : sub}</option>
                      ))}
                    </select>
                  </div>
                  {/* 우: 평가 대상 문항 선택 셀렉트 */}
                  <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                    <label className="sg-card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--neo-font-size-base)', color: '#0f172a', marginBottom: '8px' }}>
                      평가 대상 문항 선택 <span className="sg-card-badge-req">필수</span>
                    </label>
                    {(() => {
                      const assignOptions = MOCK_ASSIGNMENTS
                        .filter(a => a.owner?.endsWith(CURRENT_DOMAIN) && a.type === currentSubject)
                        .sort((a, b) => {
                          const ai = SUBJECT_ORDER.indexOf(a.type);
                          const bi = SUBJECT_ORDER.indexOf(b.type);
                          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                        });
                      const isAll = currentSubject === '전체';
                      const noItems = !isAll && assignOptions.length === 0;
                      return (
                        <select
                          className="sg-select-full"
                          value={selectedAssignId || ''}
                          onChange={(e) => handleAssignChange(e.target.value)}
                          disabled={isAll || noItems}
                          style={{
                            width: '100%',
                            background: (isAll || noItems) ? '#f8fafc' : '#fff',
                            color: (isAll || noItems) ? '#94a3b8' : '#334155',
                          }}
                        >
                          {isAll ? (
                            <option value="">개별 교과를 선택하세요</option>
                          ) : noItems ? (
                            <option value="">이 교과에 등록된 문항이 없습니다.</option>
                          ) : (
                            <>
                              <option value="">문항을 선택하세요</option>
                              {assignOptions.map(a => (
                                <option key={a.id} value={a.id}>[{a.schoolLevel}-{a.type}] {a.label}</option>
                              ))}
                            </>
                          )}
                        </select>
                      );
                    })()}
                  </div>
                </div>
                {currentSubject === '전체' && (
                  <div style={{
                    marginTop: '12px',
                    background: '#F5F3FF',
                    border: '1px solid #C4B5FD',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: 'var(--neo-font-size-sm)',
                    color: '#6D28D9',
                    fontWeight: 600,
                    lineHeight: 1.5
                  }}>
                    🌐 전체 교과 공통 프롬프트 편집 중 — 저장 시 모든 개별 교과(국어~기술)에 동일하게 적용됩니다.
                  </div>
                )}
              </div>

              {/* 선택 문항 정보 — 교과·문항과 한 영역으로 통합 (v6.24) */}
              {selectedAssignId ? (
                <div className="sg-loaded-data" style={{ marginTop: '16px' }}>
                  <div className="sg-data-row"><strong>[성취기준]</strong> {achievement}</div>
                  {/* 평가유형 + 채점 단계 한 줄 배치 (v6.25) */}
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div className="sg-data-row"><strong>[평가유형]</strong> {evalTypeInfo}</div>
                    <div className="sg-data-row"><strong>[채점 단계]</strong> {gradingStep}</div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '16px', padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6, background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {currentSubject === '전체'
                    ? '🌐 전체 교과 공통 편집 모드입니다. 개별 교과를 선택하면 문항을 지정할 수 있습니다.'
                    : '문항을 선택하면 성취기준·평가유형·채점 단계가 표시됩니다.'}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: ② 프롬프트 버전 관리 (교과별 버전 관리 영역) — v6.24 */}
          <div className="sg-step-card">

            <div className="sg-card-content">
              <div className="sg-card-header" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}>
                <span className="sg-card-label">② 프롬프트 버전 관리</span>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748b', fontWeight: 600 }}>평가유형</span>
                    {/* 평가유형 채널 토글 */}
                    {currentSubject && (
                      <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                        {EVAL_TYPES.map(type => (
                          <button
                            key={type}
                            onClick={() => handleEvalTypeChange(type)}
                            style={{
                              padding: '3px 10px',
                              fontSize: 'var(--neo-font-size-xs)',
                              fontWeight: evalType === type ? '700' : '400',
                              border: 'none',
                              background: evalType === type ? '#334155' : '#f8fafc',
                              color: evalType === type ? '#fff' : '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Live 상태 표시 — 버전 드롭다운 앞 (draft 중엔 숨김) */}
                    {!isDraftMode && (() => {
                      const activeVer = promptVersions.find(v => v.id === activeVersionId);
                      if (activeVer?.isLive && !activeVer?.isInitial) {
                        return <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#10B981', fontWeight: '700', padding: '0 4px', whiteSpace: 'nowrap' }}>🚀 현재 Live 모델</span>;
                      } else if (!activeVer?.isLive) {
                        return (
                        <>
                          <button className="sg-btn-reset-prompt" onClick={applyToLive} style={{ background: '#EBF2FF', borderColor: '#2A75F3', color: '#2A75F3' }}>
                            ✔️ DB(Live) 적용
                          </button>
                          <button className="sg-btn-reset-prompt" onClick={deleteVersion} style={{ color: '#ef4444', borderColor: '#ef4444', background: '#fef2f2' }}>
                            🗑️ 삭제
                          </button>
                        </>
                        );
                      }
                      return null;
                    })()}
                    <select
                      className="sg-select-full"
                      style={{ width: 'auto', minWidth: '160px', fontWeight: 'bold' }}
                      value={activeVersionId}
                      onChange={(e) => handleVersionChange(e.target.value)}
                    >
                      {promptVersions.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.isInitial ? '등록 버전 없음' : v.isDraft ? `✏️ ${v.id} | 시간 미정 (미저장)` : `${v.id} | ${v.datetime ?? v.date ?? '날짜없음'}${v.isLive ? ' 🔴 Live' : ''}`}
                        </option>
                      ))}
                    </select>
                    {/* 새 버전 추가/저장 버튼 — 오른쪽 끝 */}
                    {isDraftMode ? (
                      <button className="sg-btn-reset-prompt" onClick={saveAsNewVersion} style={{ background: '#EBF2FF', color: '#2A75F3', borderColor: '#2A75F3', fontWeight: '700' }}>
                        💾 새 버전 저장
                      </button>
                    ) : (
                      <button className="sg-btn-reset-prompt" onClick={startNewVersion} style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }}>
                        + 새 버전 추가
                      </button>
                    )}
                  </div>
                </div>
                {/* 버전 설명 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748b', whiteSpace: 'nowrap', fontWeight: '600' }}>📋 버전 설명</span>
                  <input
                    type="text"
                    placeholder={isDraftMode ? '이 버전의 변경 내용을 간단히 메모하세요 (50자 이내)' : '저장된 내용이 없습니다.'}
                    maxLength={50}
                    value={versionDescription}
                    onChange={(e) => isDraftMode && setVersionDescription(e.target.value)}
                    readOnly={!isDraftMode}
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 'var(--neo-font-size-sm)', color: isDraftMode ? '#334155' : '#94a3b8', outline: 'none', minWidth: 0, cursor: isDraftMode ? 'text' : 'default' }}
                  />
                </div>
              </div>
              {/* OCR + 채점 프롬프트 2열 배치 + 높이 확대 (v6.25) */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div className="sg-prompt-group" style={{ flex: '1 1 300px', minWidth: '280px', marginBottom: 0 }}>
                  <label className="sg-prompt-label">OCR 프롬프트</label>
                  <textarea
                    className="sg-textarea-small"
                    style={{ height: '340px', resize: 'none', overflowY: 'auto' }}
                    value={ocrPrompt}
                    onChange={(e) => setOcrPrompt(e.target.value)}
                    placeholder={
                      currentSubject === ""
                        ? '교과를 선택하면 OCR 프롬프트가 없습니다.'
                        : '교과 및 평가유형을 선택하면 DB에 적용된 프롬프트 내용이 나옵니다.'
                    }
                  />
                </div>
                <div className="sg-prompt-group" style={{ flex: '1 1 300px', minWidth: '280px', marginBottom: 0 }}>
                  <label className="sg-prompt-label">채점 프롬프트 (System Prompt)</label>
                  <textarea
                    className="sg-textarea-mid"
                    style={{ height: '340px', resize: 'none', overflowY: 'auto' }}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder={
                      currentSubject === ""
                        ? '교과를 선택하면 채점 프롬프트가 없습니다.'
                        : '교과 및 평가유형을 선택하면 DB에 적용된 프롬프트 내용이 나옵니다.'
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: 학생 답안 업로드 */}
          <div className="sg-step-card">

            <div className="sg-card-content">
              <div className="sg-card-header">
                <span className="sg-card-label">학생 답안 업로드 (이미지 또는 JSON)</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* 과정 분석 테스트용 학생 등급 선택 (단계 + 등급) */}
                  {evalType === '과정 분석' && (
                    <div
                      title={(!testGradeStep || !testGrade) ? '필수 — 단계와 등급을 모두 선택해야 AI 실행이 활성화됩니다.' : ''}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '3px 8px',
                        background: (!testGradeStep || !testGrade) ? '#FFF7ED' : '#FDF4FF',
                        border: `1px solid ${(!testGradeStep || !testGrade) ? '#FDBA74' : '#E9D5FF'}`,
                        borderRadius: '6px',
                      }}
                    >
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: (!testGradeStep || !testGrade) ? '#9A3412' : '#86198F' }}>
                        테스트 등급<span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>:
                      </span>
                      <select
                        value={testGradeStep}
                        onChange={(e) => setTestGradeStep(e.target.value)}
                        disabled={isRunning}
                        style={{ fontSize: 'var(--neo-font-size-xs)', padding: '2px 4px', border: `1px solid ${!testGradeStep ? '#FB923C' : '#C084FC'}`, borderRadius: '4px', background: 'white', color: '#86198F', fontWeight: 600 }}
                        title="등급 단계 선택 (필수)"
                      >
                        <option value="" disabled>단계 선택</option>
                        <option value="3단계">3단계</option>
                        <option value="4단계">4단계</option>
                        <option value="5단계">5단계</option>
                      </select>
                      <select
                        value={testGrade}
                        onChange={(e) => setTestGrade(e.target.value)}
                        disabled={isRunning || !testGradeStep}
                        style={{ fontSize: 'var(--neo-font-size-xs)', padding: '2px 4px', border: `1px solid ${!testGrade ? '#FB923C' : '#C084FC'}`, borderRadius: '4px', background: !testGradeStep ? '#F8FAFC' : 'white', color: '#86198F', fontWeight: 600 }}
                        title="과정 분석 프롬프트의 학생 등급 분기를 테스트하기 위한 연구용 입력. 단계를 먼저 선택해주세요."
                      >
                        <option value="" disabled>등급 선택</option>
                        {currentGradeOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    className="sg-btn-reset-prompt"
                    onClick={() => setIsPenModalOpen(true)}
                    style={{ background: '#EBF2FF', color: '#2A75F3', borderColor: '#2A75F3', fontSize: 'var(--neo-font-size-xs)', padding: '4px 10px' }}
                  >
                    🖊️ 스마트펜 연동
                  </button>
                  <span className="sg-card-badge-req">필수 (1건)</span>
                </div>
              </div>
              {currentSubject === '전체' ? (
                <div style={{
                  padding: '24px',
                  border: '1px dashed #C4B5FD',
                  borderRadius: '8px',
                  background: '#F5F3FF',
                  textAlign: 'center',
                  color: '#6D28D9',
                  fontSize: 'var(--neo-font-size-sm)',
                  fontWeight: 600,
                  lineHeight: 1.6
                }}>
                  🌐 전체 교과 공통 프롬프트 편집 모드입니다.<br />
                  <span style={{ fontWeight: 500, color: '#7C3AED' }}>
                    AI 실행 테스트는 개별 교과를 선택한 뒤 진행해 주세요.
                  </span>
                </div>
              ) : (
              <div
                className="sg-upload-zone"
                onClick={() => fileInputRef.current.click()}
              >
                <input type="file" hidden ref={fileInputRef} accept="image/*,.json" onChange={handleFileChange} />
                {studentImages.length > 0 ? (
                  <div className="sg-preview-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    {studentImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', background: '#f8fafc' }}>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748b', marginBottom: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                          {img.type === 'Original' ? '이미지 1: 원본 필기' : '이미지 2: 메타데이터 인코딩'}
                        </div>
                        <img src={img.url} alt={`Preview ${idx}`} className="sg-preview-img" style={{ maxWidth: '100%', borderRadius: '4px', display: 'block' }} />
                      </div>
                    ))}
                    <button
                      className="sg-btn-delete-img"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStudentImages([]);
                        setHandwritingAnalysis(null);
                        setStage1Report(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      title="이미지 전체 삭제"
                      style={{ top: '6px', right: '6px' }}
                    >
                      ✕
                    </button>
                    {handwritingAnalysis && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: 'white',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          fontSize: 'var(--neo-font-size-xs)'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#334155', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>필기 지표 분석 (3축)</span>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 600 }}>
                            패턴 코드: <strong style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-sm)' }}>{handwritingAnalysis.pattern_code.toUpperCase()}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          {(() => {
                            const gradeColor = (g) => g === 'a' ? '#10B981' : g === 'b' ? '#F59E0B' : '#EF4444';
                            const gradeLabel = (g) => g === 'a' ? '상' : g === 'b' ? '중' : '하';
                            const axis = (title, grade, value, hint) => (
                              <div style={{ background: '#F8FAFC', borderRadius: '6px', padding: '8px' }}>
                                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ background: gradeColor(grade), color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800 }}>
                                    {grade.toUpperCase()} {gradeLabel(grade)}
                                  </span>
                                  <span style={{ color: '#1E2225', fontWeight: 700 }}>{value}</span>
                                </div>
                                <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: '4px' }}>{hint}</div>
                              </div>
                            );
                            const rm = handwritingAnalysis.raw_metrics;
                            const ns = handwritingAnalysis.normalized_scores;
                            const g = handwritingAnalysis.grades;
                            return (
                              <>
                                {axis('Time 속도', g.time, (rm.writing_speed * 1000).toFixed(2) + ' px/s', '획 거리/시간')}
                                {axis('Coord 순차성', g.coord, (rm.sequentiality_score * 100).toFixed(0) + '%', `역행 ${(rm.backtrack_ratio * 100).toFixed(0)}%`)}
                                {axis('Hesitation 머뭇거림', g.hesitation, ns.hesitation_score.toFixed(2), `멈칫 ${(rm.micro_pause_ratio * 100).toFixed(0)}% · 덧쓰기 ${(rm.revisit_density * 100).toFixed(0)}%`)}
                              </>
                            );
                          })()}
                        </div>
                        {handwritingAnalysis.warnings?.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: 'var(--neo-font-size-xs)', color: '#B45309', fontWeight: 600 }}>
                            ⚠ {handwritingAnalysis.warnings.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="sg-upload-icon">📸</div>
                    <div className="sg-upload-text">학생 답안 이미지 또는 JSON 필기 데이터를 업로드하세요</div>
                    <div className="sg-upload-sub">1. 일반 사진(JPG, PNG 등)<br/>2. NeoStudio 필기 데이터(_strokes_parsed.json)</div>
                  </>
                )}
              </div>
              )}
            </div>
          </div>

          {/* 결과 없을 때 안내 */}
          {selectedAssignId && !result && !isRunning && (
            <div style={{
              margin: '8px 0 0 0',
              padding: '20px',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '10px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 'var(--neo-font-size-sm)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>
              <div>아직 실행된 결과가 없습니다.</div>
              <div style={{ marginTop: '4px', fontSize: 'var(--neo-font-size-sm)' }}>학생 답안을 업로드하고 <strong style={{ color: '#475569' }}>AI 실행</strong>을 눌러주세요.</div>
            </div>
          )}

          {/* Result Section (If present) */}
          {result && (
            <div className="sg-step-card result-fade-in">

              <div className="sg-card-content sg-result-card">
                <div className="sg-card-header">
                  <span className="sg-card-label" style={{ color: '#10B981' }}>📊 분석 완료</span>
                  <button
                    className={`sg-btn-archive ${isSaved ? 'saved' : ''}`}
                    onClick={saveToArchive}
                    disabled={isSaved}
                  >
                    {isSaved ? '✓ 아카이브 저장됨' : '📥 아카이브에 저장'}
                  </button>
                </div>

                <div className="sg-result-grid">
                  <div className="sg-res-box">
                    <label>OCR 변환 텍스트</label>
                    <div className="sg-res-text">{result.ocrText}</div>
                  </div>
                  <div className="sg-res-box">
                    <label>AI 채점 결과 (Raw)</label>
                    <div className="sg-res-json" style={{ maxHeight: 'none', minHeight: 'auto', fontFamily: 'inherit', color: '#1E2225' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', color: '#064E3B', fontSize: 'var(--neo-font-size-sm)' }}>{result.gradingResult}</pre>

                    {/* ── sg-res-json 영역 내부 통합 리포트 ── */}
                    {stage1Report && (() => {
                      const sections = buildReportSections(stage1Report, {
                        studentGrade: testGrade,
                        scaleType: testGradeStep ? parseInt(testGradeStep, 10) : 5,
                        gradeLabel: testGrade && currentGradeOptions
                          ? (currentGradeOptions.find(o => o.value === testGrade)?.label || null)
                          : null,
                        rawStrokes: stage1Report?._internal?.strokes || null,
                      });

                      // **...** → 강조 렌더 (학생 답안 인용 부분)
                      const renderWithBold = (text) => {
                        if (!text) return null;
                        const parts = text.split(/(\*\*[^*]+\*\*)/g);
                        return parts.map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={i} style={{
                                background: '#FEF3C7',
                                color: '#92400E',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontFamily: 'monospace'
                              }}>{part.slice(2, -2)}</strong>
                            );
                          }
                          return <React.Fragment key={i}>{part}</React.Fragment>;
                        });
                      };

                      return (
                        <div style={{
                          marginTop: '14px',
                          paddingTop: '14px',
                          borderTop: '2px dashed #CBD5E1',
                          fontSize: 'var(--neo-font-size-sm)',
                          color: '#1E2225',
                          lineHeight: 1.8
                        }}>
                          {!testGrade && (
                            <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: '6px', fontSize: 'var(--neo-font-size-xs)', color: '#92400E', marginBottom: '12px', fontWeight: 600 }}>
                              💡 우측 사이드바의 "테스트 등급"을 선택하면 매트릭스에서 해당 등급의 feedback을 조회하여 더 정확한 리포트를 제공합니다.
                            </div>
                          )}

                          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: '10px', textAlign: 'right' }}>
                            {sections.dataSource === 'matrix' && '✓ 매트릭스 완전 반영'}
                            {sections.dataSource === 'mixed' && '◐ 매트릭스 + fallback'}
                            {sections.dataSource === 'fallback' && '○ 규칙 기반 fallback'}
                          </div>

                          {/* [진단된 학습 행동 패턴] */}
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontWeight: 800, color: '#4C1D95', marginBottom: '4px' }}>[진단된 학습 행동 패턴]</div>
                            <div style={{ paddingLeft: '8px' }}>
                              - {sections.patternDiagnosis[0]}
                            </div>
                          </div>

                          {/* [등급 매핑 총평] */}
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontWeight: 800, color: '#DC2626', marginBottom: '4px' }}>[등급 매핑 총평]</div>
                            <div style={{ paddingLeft: '8px' }}>
                              {sections.verdict.map((v, i) => <div key={i} style={{ marginBottom: i < sections.verdict.length - 1 ? '6px' : 0 }}>{v}</div>)}
                            </div>
                          </div>

                          {/* [이런점이 좋아요] */}
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontWeight: 800, color: '#059669', marginBottom: '4px' }}>[이런점이 좋아요]</div>
                            <div style={{ paddingLeft: '8px' }}>
                              {sections.strengths.map((s, i) => <div key={i} style={{ marginBottom: i < sections.strengths.length - 1 ? '4px' : 0 }}>{s}</div>)}
                            </div>
                          </div>

                          {/* [조금만 더 노력해볼까요] */}
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontWeight: 800, color: '#D97706', marginBottom: '4px' }}>[조금만 더 노력해볼까요]</div>
                            <div style={{ paddingLeft: '8px' }}>
                              {sections.weaknesses.map((w, i) => <div key={i} style={{ marginBottom: i < sections.weaknesses.length - 1 ? '4px' : 0 }}>{renderWithBold(w)}</div>)}
                            </div>
                          </div>

                          {/* [함께 성장해요] */}
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontWeight: 800, color: '#1D4ED8', marginBottom: '4px' }}>[함께 성장해요]</div>
                            <div style={{ paddingLeft: '8px' }}>
                              {sections.growth.map((g, i) => <div key={i} style={{ marginBottom: i < sections.growth.length - 1 ? '4px' : 0 }}>{g}</div>)}
                            </div>
                          </div>

                          {/* [내용분석] */}
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontWeight: 800, color: '#4C1D95', marginBottom: '6px' }}>[내용분석]</div>
                            {/* 행동 지표 분석 */}
                            <div style={{ paddingLeft: '8px', marginBottom: '10px' }}>
                              <div style={{ fontWeight: 700, marginBottom: '4px', color: '#6D28D9' }}>행동 지표 분석</div>
                              <div style={{ paddingLeft: '8px' }}>
                                {sections.contentAnalysis.behaviorMetrics.map((m, i) => (
                                  <div key={i}>- {m}</div>
                                ))}
                              </div>
                            </div>
                            {/* 병목 구간 진단 */}
                            <div style={{ paddingLeft: '8px' }}>
                              <div style={{ fontWeight: 700, marginBottom: '4px', color: '#6D28D9' }}>병목 구간 진단</div>
                              <div style={{ paddingLeft: '8px' }}>
                                {sections.contentAnalysis.bottleneck.map((b, i) => (
                                  <div key={i} style={{ marginBottom: i < sections.contentAnalysis.bottleneck.length - 1 ? '6px' : 0 }}>{renderWithBold(b)}</div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })()}
                    </div>
                  </div>
                </div>


                {/* AI 과정 분석 영역 */}
                <div className="sg-ai-eval-box" style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--neo-font-size-base)', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯</span> AI 채점 품질 평가 <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748b', fontWeight: 'normal' }}>(과정 분석)</span>
                  </h4>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="sg-prompt-group" style={{ flex: '1', minWidth: '200px' }}>
                      <label className="sg-prompt-label">평가 일치도 (5단계)</label>
                      <select className="sg-select-full" value={evalMatch} onChange={(e) => setEvalMatch(e.target.value)}>
                        <option value="매우우수">매우우수 (A)</option>
                        <option value="우수">우수 (B)</option>
                        <option value="보통">보통 (C)</option>
                        <option value="노력">노력 (D)</option>
                        <option value="매우노력">매우노력 (E)</option>
                      </select>
                    </div>
                    <div className="sg-prompt-group" style={{ flex: '1', minWidth: '200px' }}>
                      <label className="sg-prompt-label">오류 유형 (불일치 시)</label>
                      <select className="sg-select-full" value={evalErrorType} onChange={(e) => setEvalErrorType(e.target.value)}>
                        <option>해당 없음</option>
                        <option>OCR 인식 오류</option>
                        <option>채점 기준표 미준수</option>
                        <option>환각 현상 (거짓 논리)</option>
                        <option>포맷 오류</option>
                      </select>
                    </div>
                  </div>
                  <div className="sg-prompt-group" style={{ marginTop: '12px' }}>
                    <label className="sg-prompt-label">연구진 코멘트 / 피드백</label>
                    <textarea 
                      className="sg-textarea-small" 
                      placeholder="AI가 틀린 부분이나 개선이 필요한 점을 적어주세요."
                      value={evalFeedback}
                      onChange={(e) => setEvalFeedback(e.target.value)}
                      style={{ height: '60px' }}
                    />
                  </div>
                </div>

                {/* [v6.21] 모든 토큰 값에 K/M 단위 강제 노출 (1K 미만도 0.X K 보조 표기) */}
                {(() => {
                  // 토큰 표기 정책: 모든 값에 K/M 단위 보조 노출 — 작은 값(420 등)도 0.42K로 단위 인지 가능
                  const formatTokenWithUnit = (n) => {
                    if (n == null || n === 0) return '0';
                    const comma = n.toLocaleString();
                    if (n < 1000) return `${comma} (${(n / 1000).toFixed(2)}K)`;        // 1K 미만 — 소수점 2자리
                    if (n < 1_000_000) return `${comma} (${(n / 1000).toFixed(1)}K)`;   // 1K~1M — 소수점 1자리
                    const m = n / 1_000_000;
                    return `${comma} (${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1))}M)`; // 1M 이상 — M
                  };
                  const krw = result.costUsd * exchangeRate;
                  return (
                    <div className="sg-metrics-footer">
                      <div className="sg-m-item"><strong>채점 시간:</strong> {result.latency}</div>
                      <div className="sg-m-item">
                        <strong>토큰:</strong> 입 {formatTokenWithUnit(result.tokens.input)} / 출 {formatTokenWithUnit(result.tokens.output)} (총 {formatTokenWithUnit(result.tokens.total)})
                      </div>
                      <div className="sg-m-item sg-cost-item">
                        <strong>비용:</strong> ${result.costUsd.toFixed(5)} USD
                        <span className="sg-cost-krw">/ {krw.toLocaleString(undefined, { maximumFractionDigits: 2 })} 원</span>
                        <button className="sg-btn-refresh" onClick={refreshExchangeRate} title="환율 동기화">↻</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: AI Config */}
        <aside className="sg-sidebar">
          <section className="sg-side-card">
            <div className="sg-side-title">🤖 AI 모델 선택</div>
            <select
              className="sg-select-full"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              style={{ marginTop: '8px' }}
            >
              <optgroup label="GPT 모델">
                <option value="GPT-4o mini">GPT-4o mini</option>
                <option value="GPT-5.3 Instant">GPT-5.3 Instant</option>
                <option value="GPT-5.4 Thinking">GPT-5.4 Thinking</option>
                <option value="GPT-5.4 Pro">GPT-5.4 Pro</option>
              </optgroup>
              <optgroup label="Gemini 모델">
                <option value="Gemini 3.1 Pro">Gemini 3.1 Pro</option>
                <option value="Gemini 3.1 Flash-Lite">Gemini 3.1 Flash-Lite</option>
              </optgroup>
            </select>
          </section>

          <section className="sg-side-card">
            <div className="sg-side-title">⚙️ 파라미터 설정 — <span style={{ color: '#2A75F3' }}>{currentSubject}</span></div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              {[
                { key: 'ocr', label: 'OCR' },
                { key: 'grade1', label: '1차 채점' },
                { key: 'grade2', label: '재채점' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setParamTab(tab.key)}
                  style={{
                    flex: 1, padding: '6px 4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600,
                    border: '1px solid', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                    borderColor: paramTab === tab.key ? '#2A75F3' : '#cbd5e1',
                    backgroundColor: paramTab === tab.key ? '#EBF2FF' : '#fff',
                    color: paramTab === tab.key ? '#2A75F3' : '#64748b',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="sg-param-row">
              <div className="sg-param-info">
                <span>temperature (창의성/일관성)</span>
                <span className="sg-v">{temp.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.1" value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} className="sg-range" />
            </div>

            <div className="sg-param-row">
              <div className="sg-param-info">
                <span>top_p (단어 선택 폭)</span>
                <span className="sg-v">{topP.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} className="sg-range" />
            </div>


            <div className="sg-param-row">
              <div className="sg-param-info">
                <span>max_tokens (응답 길이)</span>
                <span className="sg-v">{maxTokens.toLocaleString()}</span>
              </div>
              <input type="range" min="100" max="8192" step="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="sg-range" />
            </div>

            {aiModel.includes('GPT') && (
              <div className="sg-param-row" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="sg-param-info" style={{ marginBottom: 0 }}>
                  <span style={{ color: '#0f172a', fontWeight: '600' }}>🧠 thinking (사고 수준)</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: '500', color: '#4338ca' }}>
                  <input type="checkbox" checked={gptThinking} onChange={(e) => setGptThinking(e.target.checked)} style={{ marginRight: '6px', width: '16px', height: '16px' }} />
                  {gptThinking ? 'On' : 'Off'}
                </label>
              </div>
            )}

            {aiModel.includes('Gemini') && (
              <div className="sg-param-row" style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div className="sg-param-info" style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#0f172a', fontWeight: '600' }}>🧠 thinking_config (사고 수준)</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Minimal', 'Low', 'Medium', 'High'].map(level => (
                    <button
                      key={level}
                      onClick={() => setThinkingLevel(level)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: 'var(--neo-font-size-xs)',
                        fontWeight: '500',
                        border: '1px solid',
                        borderColor: thinkingLevel === level ? '#4338ca' : '#cbd5e1',
                        backgroundColor: thinkingLevel === level ? '#e0e7ff' : '#ffffff',
                        color: thinkingLevel === level ? '#4338ca' : '#64748b',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* [v6.4] 과정 분석 모드에서 테스트 등급(단계+등급) 미선택이면 AI 실행 비활성화 */}
          {(() => {
            const qualitativeMissing = evalType === '과정 분석' && (!testGradeStep || !testGrade);
            const baseMissing = !selectedAssignId || studentImages.length === 0;
            const disabled = isRunning || baseMissing || qualitativeMissing;
            return (
              <>
                <button
                  className={`sg-execute-btn ${isRunning ? 'loading' : ''}`}
                  disabled={disabled}
                  onClick={executeAI}
                >
                  {isRunning ? (
                    <div className="sg-loading-wrap">
                      <Spinner />
                      <span>AI 채점 중...</span>
                    </div>
                  ) : (
                    "AI 실행 (EXECUTE)"
                  )}
                </button>
                {!isRunning && (baseMissing || qualitativeMissing) && (
                  <p className="sg-warn-text">
                    {qualitativeMissing
                      ? '⚠️ 과정 분석 모드에서는 테스트 등급(단계 + 등급)을 모두 선택해야 AI 실행이 활성화됩니다.'
                      : '⚠️ 문항 선택과 답안 업로드가 완료되어야 실행할 수 있습니다.'}
                  </p>
                )}
              </>
            );
          })()}
        </aside>
      </div>

      {/* --- Smartpen Capture Modal (Refactored to separate file) --- */}
      <SmartpenCaptureModal 
        isOpen={isPenModalOpen} 
        onClose={() => setIsPenModalOpen(false)} 
        onApply={handlePenDataApply} 
      />
    </div>
  );
};

const Spinner = () => <div className="sg-spinner"></div>;

export default PromptStudio;
