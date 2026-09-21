/**
 * TaskDirectInputWizard.jsx
 * 직접 입력 2 — 탭(Step) 기반 과제 등록 Wizard
 *
 * 인과관계(입력 순서):
 *   문항 내용이 있어야 채점 기준을 만들 수 있으므로 문항 입력이 채점 기준 설정보다 선행한다.
 *   - [v3.74] 자동평가 폐기 — 평가 기준은 자율평가 루브릭 단일 체제.
 *   - Step 4 「평가 기준」 진입 시 성취기준·문항 내용을 분석해 채점 루브릭을 자동 설계한다.
 *     문항별 범주(채점 기준) 3개 기본(1~5개 추가·삭제), 범주마다 평가 내용 3개(점수 구간 3개 고정, 배점 → 0점).
 *     채점 등급(3/4/5등급) 기본값은 학교급별(초등 3 / 중·고등 5).
 *   - 입력한 점수는 등급으로 환산되어 결과를 낸다.
 *
 * Step 1 기본 정보 → Step 2 문항 입력 → Step 3 성취기준 → Step 4 평가 기준 → Step 5 그룹 배포·출력
 *
 * 주의: 「AI 루브릭 자동 설계」는 현재 샘플(stub) 동작이며 실제 LLM 연동은 미구현이다.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  subjectsOf, gradesOf, competenciesOf, evalAreasOf,
  defaultGradeScale,
  defaultInterval, buildScoreRows, makeCriterion,
  aiFillCriteria, designRubric, criteriaHaveContent,
} from './lib/gradingShared';
import { buildDirectInputTask } from './lib/taskSchema';
import WorksheetPreviewModal from './WorksheetPreviewModal';

const STEPS = [
  { n: 1, label: '기본 정보',          icon: '📋' },
  { n: 2, label: '문항 입력',          icon: '📝' },
  { n: 3, label: '성취기준',           icon: '🎯' },
  { n: 4, label: '평가 기준',          icon: '⚖️' },
  { n: 5, label: '그룹 배포·출력',      icon: '🚀' },
];

// 성취기준 mock — 각 성취기준은 핵심평가영역(area) 1종 + 관련 핵심역량(competencies) 매핑
// [직접입력 규칙] 성취기준은 핵심평가영역(필수)·핵심역량(선택) 선택에 따라 필터되어 노출된다.
const MOCK_STANDARDS = [
  { id: 's1', area: '듣기·말하기', competencies: ['의사소통 역량', '공동체·대인관계 역량'], text: '[10국어1-01-01] 대화의 원리를 고려하여 대화하고 자신의 듣기·말하기 과정을 성찰한다.' },
  { id: 's2', area: '읽기', competencies: ['비판적·창의적 사고 역량'], text: '[10국어1-02-01] 글의 주제와 내용을 종합적으로 파악한다.' },
  { id: 's3', area: '읽기', competencies: ['비판적·창의적 사고 역량', '자기 성찰·계발 역량'], text: '[10국어1-02-02] 글에 드러난 관점·표현 방법을 비판적으로 이해한다.' },
  { id: 's4', area: '쓰기', competencies: ['비판적·창의적 사고 역량', '자기 성찰·계발 역량'], text: '[10국어1-03-01] 글의 짜임에 맞게 자신의 생각을 표현한다.' },
  { id: 's5', area: '문법', competencies: ['비판적·창의적 사고 역량'], text: '[10국어1-04-01] 문장 성분을 이해하고 정확하게 표현한다.' },
  { id: 's6', area: '문학', competencies: ['비판적·창의적 사고 역량', '자기 성찰·계발 역량'], text: '[10국어1-05-01] 문학 작품의 내용과 형식을 작품 맥락에서 감상한다.' },
];
const MOCK_COMPETENCIES = ['비판적·창의적 사고 역량', '자기 성찰·계발 역량', '의사소통 역량', '공동체·대인관계 역량'];
const MOCK_EVAL_AREAS = ['듣기·말하기', '읽기', '쓰기', '문법', '문학'];

// 평가 단계(등급 체계)별 루브릭 레벨 — DSH-02 등급명·색상과 정합.
const LEVEL_META = {
  '매우 우수': { color: '#10B981', bg: '#D1FAE5', desc: '성취기준을 탁월하게 달성하며, 논리·근거·표현이 모두 빼어나다.' },
  '우수':     { color: '#2A75F3', bg: '#EFF6FF', desc: '성취기준을 충실히 달성하며, 논리적 일관성과 근거가 분명하다.' },
  '보통':     { color: '#94A3B8', bg: '#F1F5F9', desc: '성취기준의 주요 요소를 충족하나, 일부 논리 비약 또는 근거 부족이 관찰된다.' },
  '노력':     { color: '#F59E0B', bg: '#FEF3C7', desc: '성취기준 일부만 충족하며, 핵심 개념의 이해 또는 표현에 어려움이 있다.' },
  '매우 노력': { color: '#EF4444', bg: '#FEE2E2', desc: '문항 요구와 답안 내용이 부합하지 않거나 이해가 매우 미흡하다.' },
};
// [v3.53] 4단계 갱신 — 「매우 우수」 복귀, 「매우 노력」 폐기 (GRADE_CUTOFFS와 동기화)
const RUBRIC_LEVELS = {
  3: ['우수', '보통', '노력'],
  4: ['매우 우수', '우수', '보통', '노력'],
  5: ['매우 우수', '우수', '보통', '노력', '매우 노력'],
};

// 성취기준 텍스트에서 코드([10국어1-01-01]) 추출
const stdCode = (text) => {
  const m = (text || '').match(/\[([^\]]+)\]/);
  return m ? m[1] : '성취기준';
};

// [v3.53] % 기반 cutoff 정책 (학교 평가 관례)
//   3단계: 우수 ≥80%·보통 ≥60%·노력 ≥0%
//   4단계: 매우 우수 ≥90%·우수 ≥80%·보통 ≥60%·노력 ≥0% (v3.53 — 「매우 우수」 복귀, 「매우 노력」 폐기)
//   5단계: 매우 우수 ≥90%·우수 ≥80%·보통 ≥70%·노력 ≥60%·매우 노력 ≥0%
const GRADE_CUTOFFS = {
  3: [{ min: 80, name: '우수' }, { min: 60, name: '보통' }, { min: 0, name: '노력' }],
  4: [{ min: 90, name: '매우 우수' }, { min: 80, name: '우수' }, { min: 60, name: '보통' }, { min: 0, name: '노력' }],
  5: [{ min: 90, name: '매우 우수' }, { min: 80, name: '우수' }, { min: 70, name: '보통' }, { min: 60, name: '노력' }, { min: 0, name: '매우 노력' }],
};
// [v2.42] 등급 이름 (GRADE_CUTOFFS에서 name만 추출) — UI 라벨 동적 표시용
const GRADE_NAMES = {
  3: GRADE_CUTOFFS[3].map((b) => b.name),
  4: GRADE_CUTOFFS[4].map((b) => b.name),
  5: GRADE_CUTOFFS[5].map((b) => b.name),
};

let _uid = 1;
const uid = (p) => `${p}-${_uid++}`;

const makeQuestion = (idx) => ({
  id: uid('q'),
  content: '',
  evaluationAreas: [],  // [v2.7] 문항별 핵심평가영역 (다중) — 독립 관리
  standard: '',         // 문항별 성취기준 1개 (sid) — v2.31 standards[0]과 동기화
  standards: [],        // [v2.31] 문항별 성취기준 다중 선택 (sid 배열)
  points: '',           // 문항 총 배점 (채점 기준 배점 합과 일치해야 함)
  modelAnswer: { html: '' }, // [v2.67] contenteditable HTML 단일 (텍스트+이미지 inline)
  criteria: [makeCriterion()], // 채점 기준 1~5개 — Step 4 최초 진입 시 AI가 자동 설계로 교체
});

// 인라인 에디터 — 툴바가 붙은 편집 영역(textarea가 곧 에디터). 서식 버튼은 표시용.
const tbBtn = { minWidth: 28, height: 28, padding: '0 6px', border: '1px solid #E2E8F0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#475569', fontSize: 'var(--neo-font-size-sm)' };
function InlineEditor({ value, onChange, placeholder, minHeight = 120 }) {
  // 입력한 만큼 세로로 자동 확장 — ref 콜백은 매 렌더(=value 변경)마다 실행되어 항상 동기화
  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, minHeight) + 'px';
  };
  return (
    <div style={{ border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', flexWrap: 'wrap' }}>
        <button type="button" title="굵게" style={{ ...tbBtn, fontWeight: 800 }}><b>B</b></button>
        <button type="button" title="기울임" style={tbBtn}><i>I</i></button>
        <button type="button" title="밑줄" style={tbBtn}><u>U</u></button>
        <button type="button" title="취소선" style={tbBtn}><s>S</s></button>
        <span style={{ width: 1, height: 16, background: '#E2E8F0', margin: '0 3px' }} />
        <button type="button" title="글머리표" style={tbBtn}>≔</button>
        <button type="button" title="번호 매기기" style={tbBtn}>①</button>
        <button type="button" title="인용" style={tbBtn}>❝</button>
        <button type="button" title="형광펜" style={tbBtn}>🖍</button>
      </div>
      <textarea ref={autoGrow} value={value} onChange={onChange} onInput={(e) => autoGrow(e.target)} placeholder={placeholder}
        style={{ width: '100%', minHeight, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 'var(--neo-font-size-base)', lineHeight: 1.6, resize: 'none', overflow: 'hidden', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1E2225' }} />
    </div>
  );
}

const TaskDirectInputWizard = ({ onBack, showToast, onAdd }) => {
  const [step, setStep] = useState(1);
  const [basicInfo, setBasicInfo] = useState({
    title: '',
    type: '서술형',
    subject: '국어',       // 교과
    subSubject: '공통국어1', // 과목 (교과 종속)
    schoolLevel: '고등학교',
    grade: '1~3학년',       // 학년군 (학교급 종속)
    competencies: [],
    // [v2.7] evaluationAreas는 questions[].evaluationAreas로 이관 — 문항별 독립 관리
  });
  const [passage, setPassage] = useState(''); // 지문 (과제 단위, Step 2)
  const [questions, setQuestions] = useState([makeQuestion(0)]);
  const [activeQId, setActiveQId] = useState(null); // Step 2 문항 입력 탭 — 현재 선택된 문항 id
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { qid, idx } — 내용 있는 문항 삭제 확인 모달
  // [v2.11] worksheetOpen·worksheetMode state 폐기 — 미리보기 영역·모달 통째 제거
  // [v2.10] 응시 설정 — 복사·붙여넣기 차단 (학생 응시 화면 정책, TaskRegistration 직접입력1과 동일)
  const [blockCopyPaste, setBlockCopyPaste] = useState(false);
  // [v2.15] 평가내용의 수식 입력 모달 — { qid, cid, ri, initialContent }
  const [formulaModal, setFormulaModal] = useState(null);
  // AI 개선 모달 (문항 내용)
  const [aiImprove, setAiImprove] = useState(null); // { qid, original, improved }
  const evalMode = 'self'; // [v3.74] 자동평가 폐기 — 자율평가 단일 체제 (저장 스키마 호환용 고정값)
  const [resultScale, setResultScale] = useState(3); // 등급 환산 체계
  const [resultMode, setResultMode] = useState('grade'); // [v3.82] 채점 결과 표시 — 'grade'(등급) | 'score'(점수)
  const [selfScale, setSelfScale] = useState(3);     // 채점 등급(3/4/5) — Step 4 최초 진입 시 학교급 기본값(초등 3 / 중·고등 5)으로 설정. 점수 구간은 3개 고정
  // [v3.74] Step 4 진입 시 AI 루브릭 자동 설계 완료 여부 { [qid]: true } — 문항당 1회만 설계, 이후는 교사 수정 보존
  const [rubricReady, setRubricReady] = useState({});
  const [worksheetPreviewOpen, setWorksheetPreviewOpen] = useState(false); // [TSK-05 v2.30] 평가 답안지 미리보기 모달
  const [stdOpen, setStdOpen] = useState({}); // 문항별 성취기준 목록 펼침 상태 { [qid]: bool }
  const [taskStdOpen, setTaskStdOpen] = useState(false); // [v3.46] 과제 단위 성취기준 펼침 상태 — 미선택=자동 펼침
  const [modelAnsOpen, setModelAnsOpen] = useState({}); // 문항별 모범답안 펼침 { [qid]: bool } — 미지정 시 펼침
  const toggleModelAns = (qid) => setModelAnsOpen((p) => ({ ...p, [qid]: !(p[qid] ?? true) }));
  const [modelAnsFocused, setModelAnsFocused] = useState(false); // [v2.66] 활성 문항 모범답안 textarea focus — 오버레이 자동 숨김
  // 그룹 배포 (TSK-05) — [v3.75] printed = 답안지 출력 완료(채점 관리 미채점 등록, 학생 노출 X), studentDeployed = 학생 노출
  const [groupList, setGroupList] = useState([
    { id: 1, label: '1학년 1반', studentCount: 28, checked: false, printed: false, studentDeployed: false },
    { id: 2, label: '1학년 2반', studentCount: 27, checked: false, printed: false, studentDeployed: false },
    { id: 3, label: '1학년 3반', studentCount: 26, checked: false, printed: false, studentDeployed: false },
  ]);
  // [v2.52] 학생 1명당 인쇄할 답안지 수 — 기본 1, 범위 1~10 (v2.54: 호환용 유지)
  const [answerSheetCopies, setAnswerSheetCopies] = useState(1);
  // [v2.54] 문항별 답안지 수 매핑 — { [qid]: number }, 기본 1
  const [copiesPerQuestion, setCopiesPerQuestion] = useState({});
  const getCopies = (qid) => copiesPerQuestion[qid] ?? 1;
  const setCopies = (qid, n) => setCopiesPerQuestion((p) => ({ ...p, [qid]: Math.max(1, Math.min(10, n)) }));
  const totalCopies = questions.reduce((s, q) => s + getCopies(q.id), 0);

  const toast = (m) => showToast && showToast(m);

  // [v2.7] 문항별 성취기준 후보 — 활성 문항의 evaluationAreas + 과제 단위 competencies로 필터
  const filteredStandardsFor = (qEvalAreas) => MOCK_STANDARDS.filter((s) => {
    if (!qEvalAreas || qEvalAreas.length === 0) return false;
    if (!qEvalAreas.includes(s.area)) return false;
    if (basicInfo.competencies.length > 0 && !s.competencies.some((c) => basicInfo.competencies.includes(c))) return false;
    return true;
  });

  // [v2.7] 핵심역량 변경 시 — 문항의 성취기준이 더 이상 유효하지 않으면 해제 (영역은 문항별이므로 영역 변경은 별도 핸들러에서 처리)
  useEffect(() => {
    const valid = (q, sid) => {
      const s = MOCK_STANDARDS.find((x) => x.id === sid);
      return !!s && q.evaluationAreas.includes(s.area) && (basicInfo.competencies.length === 0 || s.competencies.some((c) => basicInfo.competencies.includes(c)));
    };
    // [v2.31] 핵심역량 변경 시 — invalid한 standards는 자동 해제. standard·standards 동기화
    setQuestions((qs) => qs.map((q) => {
      const curStandards = q.standards || (q.standard ? [q.standard] : []);
      const validStandards = curStandards.filter((sid) => valid(q, sid));
      if (validStandards.length === curStandards.length) return q;
      return { ...q, standards: validStandards, standard: validStandards[0] || '' };
    }));
  }, [basicInfo.competencies]);

  // 교과 변경 시 — 새 교과 프레임워크에 속하지 않는 기존 선택 chip 자동 해제
  useEffect(() => {
    const allowedComp = new Set(competenciesOf(basicInfo.subject));
    const allowedArea = new Set(evalAreasOf(basicInfo.subject));
    setBasicInfo((p) => {
      const nextComp = p.competencies.filter((c) => allowedComp.has(c));
      if (nextComp.length === p.competencies.length) return p;
      return { ...p, competencies: nextComp };
    });
    // [v2.7] 모든 문항의 evaluationAreas에서도 정리
    setQuestions((qs) => qs.map((q) => {
      const nextArea = q.evaluationAreas.filter((a) => allowedArea.has(a));
      if (nextArea.length === q.evaluationAreas.length) return q;
      return { ...q, evaluationAreas: nextArea };
    }));
  }, [basicInfo.subject]);

  // [v3.47] selfScale 변경 시 — resultScale(등급 환산 체계)만 동기화. 채점기준 c.levels(점수 행 수)는 채점기준별 자유 유지.
  useEffect(() => { setResultScale(selfScale); }, [selfScale]);

  // [v3.74] Step 4 「평가 기준」 진입 시 — 아직 설계되지 않은 문항의 채점 루브릭을 AI가 자동 설계 (샘플 stub)
  //   · 성취기준(핵심평가영역)·문항 내용을 근거로 범주(채점 기준) 3개 × 평가 내용 3개(점수 구간 3개 고정)
  //   · 채점 등급 기본값 = 학교급별 (초등 3등급 / 중·고등 5등급). 최초 1회만 적용, 이후 교사 수정 보존
  //   · 교사가 이미 채점 기준을 입력한 문항(복원 데이터 등)은 건드리지 않고 설계 완료로 간주
  useEffect(() => {
    if (step !== 4) return;
    const pending = questions.filter((q) => !rubricReady[q.id]);
    if (pending.length === 0) return;
    const scale = defaultGradeScale(basicInfo.schoolLevel);
    if (Object.keys(rubricReady).length === 0) setSelfScale(scale);
    const designed = {};
    pending.filter((q) => !criteriaHaveContent(q.criteria)).forEach((q) => {
      const std = MOCK_STANDARDS.find((x) => x.id === q.standard);
      designed[q.id] = designRubric(std?.area || '평가 영역');
    });
    setQuestions((qs) => qs.map((q) => {
      const criteria = designed[q.id];
      if (!criteria) return q;
      return { ...q, criteria }; // [v3.77] 배점·총 배점은 비워 둔다 (교사 입력)
    }));
    setRubricReady((p) => { const n = { ...p }; pending.forEach((q) => { n[q.id] = true; }); return n; });
    if (Object.keys(designed).length > 0) toast(`성취기준·문항 내용을 분석해 채점 루브릭을 자동 설계했습니다. (${basicInfo.schoolLevel} 기본 ${scale}등급 · 채점 기준 1개 · 평가 내용 3개) 검토 후 수정하세요.`);
  }, [step]);

  // [v3.77] 舊 [v3.45] 브라우저 닫기 시 균등 재분배 자동 저장 폐기 — 총 배점은 범주 배점에 영향을 주지 않는다


  // ── 상태 업데이트 헬퍼 ──────────────────────────────────────────────
  const toggleChip = (key, val) => setBasicInfo((p) => {
    const arr = p[key];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    return { ...p, [key]: next };
  });

  const updateQuestion = (qid, patch) =>
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));

  const MAX_QUESTIONS = 3; // 지문당 문항 최대 3개
  const addQuestion = () => setQuestions((qs) => {
    if (qs.length >= MAX_QUESTIONS) { toast(`문항은 최대 ${MAX_QUESTIONS}개까지 추가할 수 있습니다.`); return qs; }
    return [...qs, makeQuestion(qs.length)];
  });
  const removeQuestion = (qid) =>
    setQuestions((qs) => (qs.length <= 1 ? qs : qs.filter((q) => q.id !== qid)));
  // 빈 탭 클릭 시 문항 추가 + 새 문항으로 포커스 이동
  const addQuestionAndFocus = () => {
    if (questions.length >= MAX_QUESTIONS) { toast(`문항은 최대 ${MAX_QUESTIONS}개까지 추가할 수 있습니다.`); return; }
    const nq = makeQuestion(questions.length);
    setQuestions([...questions, nq]);
    setActiveQId(nq.id);
  };
  // 문항에 입력된 내용 여부 — 본문/모범답안/성취기준/배점/채점 기준 중 하나라도 있으면 true
  const hasQuestionContent = (q) => {
    if (!q) return false;
    if (q.content && q.content.trim()) return true;
    if (isModelAnswerFilled(q)) return true;
    if (q.standard) return true;
    if (q.points !== '' && Number(q.points) > 0) return true;
    if (criteriaHaveContent(q.criteria)) return true;
    return false;
  };
  // 탭의 (삭제 -) 클릭 처리 — 내용이 있으면 확인 모달, 없으면 즉시 삭제
  const requestDeleteQuestion = (qid, idx) => {
    const q = questions.find((qq) => qq.id === qid);
    const prevId = (questions[idx - 1] || questions.find((qq) => qq.id !== qid))?.id || null;
    if (hasQuestionContent(q)) {
      setDeleteConfirm({ qid, idx, prevId });
      return;
    }
    removeQuestion(qid);
    setActiveQId(prevId);
  };
  const confirmDeleteQuestion = () => {
    if (!deleteConfirm) return;
    removeQuestion(deleteConfirm.qid);
    setActiveQId(deleteConfirm.prevId);
    setDeleteConfirm(null);
    toast('문항을 삭제했습니다.');
  };

  // 문항별 성취기준 선택 (1개) — 같은 항목 다시 누르면 해제
  // [v2.31] 다중 성취기준 토글 — 체크박스 다중 선택 정책
  //   - standards 배열에 sid를 토글(추가/제거)
  //   - standard(단수)는 standards[0]과 동기화 (기존 로직 호환)
  //   - evaluationAreas: 선택된 standards의 영역들의 합집합으로 자동 갱신
  const selectQuestionStandard = (qid, sid) => {
    // [v2.35] 트리거 결정을 setQuestions 외부로 이동
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    const current = q.standards || (q.standard ? [q.standard] : []);
    const has = current.includes(sid);
    // [v2.63] 최대 3개 제한 — 4번째 추가 시도 시 토스트 + return
    if (!has && current.length >= 3) {
      toast('성취기준은 문항당 최대 3개까지 선택할 수 있습니다.');
      return;
    }
    const nextStandards = has ? current.filter((s) => s !== sid) : [...current, sid];
    // [v2.58] 1 → 2 전환 순간 모달 대신 배너 주의 영역 자동 펼침
    if (current.length === 1 && nextStandards.length === 2) {
      setWarnExpanded(true);
    }
    setQuestions((qs) => qs.map((x) => {
      if (x.id !== qid) return x;
      const nextAreas = Array.from(new Set(nextStandards
        .map((id) => MOCK_STANDARDS.find((y) => y.id === id)?.area)
        .filter(Boolean)));
      return {
        ...x,
        standards: nextStandards,
        standard: nextStandards[0] || '',
        evaluationAreas: nextStandards.length > 0 ? nextAreas : x.evaluationAreas,
      };
    }));
  };

  // [v3.46 → v2.31] 과제 단위 성취기준 일괄 적용 — standards 배열도 동기화
  const setStandardForAll = (sid) =>
    setQuestions((qs) => {
      const allSame = qs.every((q) => q.standard === sid);
      const next = allSame ? '' : sid;
      return qs.map((q) => ({ ...q, standard: next, standards: next ? [next] : [] }));
    });
  // 과제 단위 현재 선택값 — 모든 문항 q.standard가 같으면 그 값, 다르면 빈 값(미선택 취급)
  const taskStandardId = (() => {
    if (questions.length === 0) return '';
    const first = questions[0].standard || '';
    return questions.every((q) => q.standard === first) ? first : '';
  })();

  // AI 개선 — 입력한 문항 내용을 다듬은 버전을 제안 (현재 샘플 stub)
  const improveQuestionText = (t) => {
    let s = (t || '').replace(/\s+/g, ' ').trim();
    if (!s) return s;
    // 조건 절을 끝부분에 명확히 배치하는 등 가독성 보정 (샘플)
    if (!/[.?!」』)]$/.test(s)) s += '.';
    return s;
  };
  const openAiImprove = (qid) => {
    const q = questions.find((x) => x.id === qid);
    if (!q || !q.content.trim()) { toast('AI 개선을 위해 문항 내용을 먼저 입력해 주세요.'); return; }
    setAiImprove({ qid, original: q.content, improved: improveQuestionText(q.content) });
  };
  const applyAiImprove = () => {
    if (!aiImprove) return;
    updateQuestion(aiImprove.qid, { content: aiImprove.improved });
    setAiImprove(null);
    toast('AI 개선 내용을 적용했습니다.');
  };

  // [v2.67] 문항별 모범답안 — contenteditable HTML 단일 필드 (텍스트 + 이미지 inline) + 10MB 합계 가드
  const MAX_MODEL_ANSWER_IMAGES_BYTES = 10 * 1024 * 1024;
  const getModelAnswer = (q) => {
    if (!q) return { html: '' };
    if (q.modelAnswer && q.modelAnswer.html !== undefined) return q.modelAnswer;
    if (q.modelAnswer && (q.modelAnswer.text !== undefined || q.modelAnswer.images)) {
      let html = '';
      const text = q.modelAnswer.text || '';
      if (text) html += text.split('\n').map((line) => `<div>${line || '<br>'}</div>`).join('');
      (q.modelAnswer.images || []).forEach((img) => {
        html += `<img src="${img.src}" style="max-width:100%;display:block;margin:8px 0;" />`;
      });
      return { html };
    }
    if (q.modelAnswers) {
      let html = '';
      ['상', '중', '하'].forEach((lv) => {
        if (q.modelAnswers[lv]) html += `<div><strong>[${lv}]</strong> ${q.modelAnswers[lv]}</div>`;
      });
      return { html };
    }
    return { html: '' };
  };
  const isModelAnswerFilled = (q) => {
    const html = getModelAnswer(q).html || '';
    const stripped = html.replace(/<[^>]+>/g, '').trim();
    const hasImg = /<img\b/i.test(html);
    return !!(stripped || hasImg);
  };
  const updateModelAnswerHtml = (qid, html) =>
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, modelAnswer: { html } } : q)));
  const clearModelAnswer = (qid) =>
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, modelAnswer: { html: '' } } : q)));
  const getImageTotalBytes = (html) => {
    if (!html) return 0;
    let total = 0;
    const re = /<img\s+[^>]*src="data:image\/[^;]+;base64,([^"]+)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      total += Math.floor(m[1].length * 0.75);
    }
    return total;
  };
  const canAddImage = (currentHtml, dataUrl) => {
    const base64 = (dataUrl.split(',')[1] || '');
    const additionBytes = Math.floor(base64.length * 0.75);
    const currentBytes = getImageTotalBytes(currentHtml);
    if (currentBytes + additionBytes > MAX_MODEL_ANSWER_IMAGES_BYTES) {
      const remainMB = Math.max(0, (MAX_MODEL_ANSWER_IMAGES_BYTES - currentBytes) / 1024 / 1024);
      toast(`첨부 이미지 합계가 10MB를 초과합니다. (현재 ${(currentBytes / 1024 / 1024).toFixed(1)}MB · 추가 가능 ${remainMB.toFixed(1)}MB)`);
      return false;
    }
    return true;
  };
  const insertImageIntoEditor = (editor, dataUrl) => {
    if (!editor) return false;
    if (!canAddImage(editor.innerHTML, dataUrl)) return false;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.maxWidth = '100%';
    img.style.display = 'block';
    img.style.margin = '8px 0';
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(img);
    }
    return true;
  };
  const handleModelAnswerPaste = (e, qid) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter((it) => it.type && it.type.indexOf('image') !== -1);
    if (imageItems.length === 0) return;
    e.preventDefault();
    const editor = e.currentTarget;
    imageItems.forEach((item) => {
      const blob = item.getAsFile();
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (insertImageIntoEditor(editor, ev.target.result)) {
          updateModelAnswerHtml(qid, editor.innerHTML);
        }
      };
      reader.readAsDataURL(blob);
    });
  };
  const onModelAnswerFiles = (qid, fileList) => {
    const editor = document.querySelector(`[data-model-answer-editor="${qid}"]`);
    if (!editor) return;
    Array.from(fileList || []).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (insertImageIntoEditor(editor, ev.target.result)) {
          updateModelAnswerHtml(qid, editor.innerHTML);
        }
      };
      reader.readAsDataURL(f);
    });
  };
  const generateModelAnswers = (qid) => {
    const q = questions.find((x) => x.id === qid);
    if (!q || !q.content.trim()) { toast('모범답안 생성을 위해 문항 내용을 먼저 입력해 주세요.'); return; }
    if (isModelAnswerFilled(q)) { toast('모범답안이 이미 입력되어 있습니다. ✕ 비우기 후 다시 실행하세요.'); return; }
    const sample = '<div>문항 요구를 정확히 충족하고 핵심 개념을 통합적으로 적용하며, 논리·근거·표현이 명확한 모범답안 예시입니다. (성취기준 기반 stub — 실연동 시 LLM 호출)</div>';
    updateModelAnswerHtml(qid, sample);
    toast('AI 모범답안을 생성했습니다. (성취기준 기반 — 검토·수정하세요)');
  };

  // 자율평가 — 채점 기준 CRUD
  // [v3.77] 총 배점 → 범주 배점 균등 재분배(distributeTotal·redistributeTotal) 폐기 — 총 배점은 범주 배점에 영향을 주지 않는다
  const addCriterion = (qid) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      if (q.criteria.length >= 5) { toast('채점 기준은 문항당 최대 5개까지 추가할 수 있습니다.'); return q; }
      return { ...q, criteria: [...q.criteria, makeCriterion()] }; // [v3.74] 범주 추가 — 점수 구간 3개 고정, 배점 빈 값
    }));
  const removeCriterion = (qid, cid) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      if (q.criteria.length <= 1) { toast('채점 기준은 문항당 최소 1개가 필요합니다.'); return q; }
      const criteria = q.criteria.filter((c) => c.id !== cid);
      return { ...q, criteria, points: String(criteria.reduce((sum, c) => sum + (Number(c.maxPoints) || 0), 0)) }; // [v3.79] 총 배점 = 합계 동기화
    }));
  const updateCriterion = (qid, cid, patch) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      const nextCriteria = q.criteria.map((c) => {
        if (c.id !== cid) return c;
        const merged = { ...c, ...patch };
        // 배점·단계·간격 변경 시 점수 행 재생성(기존 평가 내용 보존)
        // [v3.73] 단계 수는 [+]/[−] 스텝퍼로만 바뀐다. 배점 입력·수정·삭제는 단계 축소 트리거가 아니다
        if ('maxPoints' in patch || 'levels' in patch || 'interval' in patch) {
          const M = Number(merged.maxPoints) || 0;
          merged.levels = Math.max(2, Number(merged.levels) || 2);
          // [v3.74] 배점 간격 선택 폐기 — 배점이 바뀌면 간격은 최대값(배점÷2)으로 재산출 (배점 → 0점 균등 분배)
          merged.interval = M >= 2 ? defaultInterval(M, merged.levels) : Math.max(1, Number(merged.interval) || 1);
          merged.rows = buildScoreRows(merged.maxPoints, merged.levels, merged.interval, c.rows);
        }
        return merged;
      });
      // [v2.32] 채점 기준 maxPoints 수정 시 q.points(총 배점)도 합산값으로 자동 갱신
      if ('maxPoints' in patch) {
        const newSum = nextCriteria.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
        return { ...q, criteria: nextCriteria, points: String(newSum) };
      }
      return { ...q, criteria: nextCriteria };
    }));

  // [v3.79] 총 배점 입력 폐기 — 범주 배점 합계를 표시만 한다 (q.points는 합계로 항상 동기화)

  // [v3.74] 舊 changeCriterionLevels(스텝퍼) 폐기 → [v3.80] 표 안 [+ 평가 내용 추가]·[✕ 삭제]로 대체

  /* [v3.80] 평가 내용 행 추가·삭제 — 舊 배점 단계 스텝퍼 대신 표 안에서 직접 다룬다.
   *   · 추가: 구간을 1개 늘리고 배점 → 0점으로 다시 균등 분배 (평가 내용은 보존). 상한 = 배점+1 (배점 없으면 5)
   *   · 삭제: 그 행만 지운다 (나머지 점수는 그대로). 최소 2개 */
  const rowLimit = (c) => (Number(c.maxPoints) > 0 ? Math.min(Number(c.maxPoints) + 1, 9) : 5);
  const addRow = (qid, cid) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        criteria: q.criteria.map((c) => {
          if (c.id !== cid) return c;
          const limit = rowLimit(c);
          if (c.rows.length >= limit) { toast(`평가 내용은 최대 ${limit}개까지 둘 수 있습니다. (배점 ${c.maxPoints || '미입력'}점 기준)`); return c; }
          const levels = c.rows.length + 1;
          const interval = defaultInterval(c.maxPoints, levels);
          return { ...c, levels, interval, rows: buildScoreRows(c.maxPoints, levels, interval, c.rows) };
        }),
      };
    }));
  const removeRow = (qid, cid, rowIdx) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        criteria: q.criteria.map((c) => {
          if (c.id !== cid) return c;
          if (c.rows.length <= 2) { toast('평가 내용은 최소 2개가 필요합니다.'); return c; }
          const rows = c.rows.filter((_, i) => i !== rowIdx);
          return { ...c, levels: rows.length, rows };
        }),
      };
    }));
  const updateRowDesc = (qid, cid, rowIdx, desc) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        criteria: q.criteria.map((c) => {
          if (c.id !== cid) return c;
          return { ...c, rows: c.rows.map((r, i) => (i === rowIdx ? { ...r, desc } : r)) };
        }),
      };
    }));
  // [v2.32] 점수 행 입력 — 위/아래 단계 점수 비교하여 단조 감소 위반 시 입력 차단 + 토스트
  const updateRowScore = (qid, cid, rowIdx, raw) =>
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        criteria: q.criteria.map((c) => {
          if (c.id !== cid) return c;
          const M = Number(c.maxPoints) || 0;
          let v = raw;
          if (raw !== '') {
            let n = Math.round(Number(raw));
            if (!Number.isFinite(n)) n = 0;
            v = Math.max(0, Math.min(M, n));
          }
          // [v2.32] 단조 감소 강제 — 위 단계보다 크거나 아래 단계보다 작으면 차단
          if (v !== '' && v !== null) {
            const prevRaw = rowIdx > 0 ? c.rows[rowIdx - 1].score : null;
            const nextRaw = rowIdx < c.rows.length - 1 ? c.rows[rowIdx + 1].score : null;
            const prev = prevRaw !== null && prevRaw !== '' ? Number(prevRaw) : null;
            const next = nextRaw !== null && nextRaw !== '' ? Number(nextRaw) : null;
            if (prev !== null && Number.isFinite(prev) && v >= prev) {
              toast(`위 단계 점수(${prev}점)보다 작아야 합니다.`);
              return c;
            }
            if (next !== null && Number.isFinite(next) && v <= next) {
              toast(`아래 단계 점수(${next}점)보다 커야 합니다.`);
              return c;
            }
          }
          return { ...c, rows: c.rows.map((r, i) => (i === rowIdx ? { ...r, score: v } : r)) };
        }),
      };
    }));
  // 균등 분배 — 배점부터 0점까지 균등 분배(간격을 최대로 재설정, 평가 내용은 보존)
  const redistribute = (qid, cid) => {
    const c0 = questions.find((x) => x.id === qid)?.criteria.find((x) => x.id === cid);
    if (c0 && !(Number(c0.maxPoints) > 0)) { toast('먼저 배점을 입력해 주세요.'); return; }
    setQuestions((qs) => qs.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        criteria: q.criteria.map((c) => {
          if (c.id !== cid) return c;
          const interval = defaultInterval(c.maxPoints, c.levels);
          return { ...c, interval, rows: buildScoreRows(c.maxPoints, c.levels, interval, c.rows) };
        }),
      };
    }));
  };
  // [v2.43] distributeAllByGrade 함수 폐기 — 배점 단계 기능과 역할 중복
  // 점수 내림차순(위 → 아래로 낮아짐) 여부
  const rowsDescending = (rows) => rows.every((r, i) => i === 0 || (Number(rows[i - 1].score) || 0) > (Number(r.score) || 0));

  // AI 채점 기준 생성(샘플) — 교사가 설정한 배점·단계·간격(점수 구조)은 그대로 유지하고,
  // 빈 채점 기준명·평가 내용만 성취기준·문항에 맞게 채운다. (수동 수정한 칸 보존 — 재생성하려면 ✕로 비운 뒤 재호출)
  const aiGenerateCriteria = (qid) => {
    const q = questions.find((x) => x.id === qid);
    if (!q || !q.content.trim()) { toast('AI 생성을 위해 문항 내용을 먼저 입력해 주세요.'); return; }
    const std = MOCK_STANDARDS.find((s) => s.id === q.standard);
    const { criteria, filled, skipped } = aiFillCriteria(q.criteria, std?.area || '평가 영역');
    updateQuestion(qid, { criteria });
    if (filled === 0) toast('빈 칸이 없습니다. ✕ 버튼으로 칸을 비운 뒤 다시 실행하세요.');
    else toast(`빈 칸 ${filled}개를 AI가 채웠습니다. 수동 수정한 ${skipped}개 칸은 보존됨. (성취기준 기반 — 검토·수정하세요)`);
  };

  // ── 합계/환산 ──────────────────────────────────────────────────────
  const totalPoints = questions.reduce((s, q) => s + q.criteria.reduce((cs, c) => cs + (Number(c.maxPoints) || 0), 0), 0);

  // [v3.51] % 기반 cutoff 등급 환산
  const scoreToGrade = (score, max, scale) => {
    if (!max || max <= 0) return '-';
    const pct = (Number(score) / max) * 100;
    const band = GRADE_CUTOFFS[scale].find((b) => pct >= b.min);
    return band ? band.name : '-';
  };

  // ── 그룹 배포 (그룹별 인라인 토글) ───────────────────────────────────
  // [v3.75] 「번호표 배포」 버튼 폐기. 채점 관리 미채점 진입 트리거 = 답안지 다운로드(인쇄) 완료(g.printed). [v3.80] 스마트펜 번호표 폐기 — 학생 식별은 답안지 기재란(학년/반/번호·이름) OCR
  //   학생 배포는 출력이 완료된 그룹만 가능 — 답안지 없이 학생에게만 노출되어 미채점에 잡히지 않는 상태를 방지한다.
  //   학생 배포 ⇄ 취소는 학생 노출 여부만 바꾼다 (미채점 등록은 유지).
  // [v3.80] 舊 번호표 인쇄 한도(117명) 폐기 — 번호표를 쓰지 않는다
  // 출력 모달에서 인쇄(다운로드)가 시작되면 해당 그룹을 출력 완료로 기록 → 미채점 등록 + 학생 배포 활성화
  const markGroupPrinted = (label) => setGroupList((prev) => prev.map((g) => {
    if (g.label !== label || g.printed) return g;
    toast(`「${g.label}」 답안지 출력 완료 — 채점 관리 미채점에 등록되었고 학생 배포가 가능해졌습니다.`);
    return { ...g, printed: true };
  }));
  // 학생 배포 ⇄ 취소
  const toggleGroupStudent = (gid) => setGroupList((prev) => prev.map((g) => {
    if (g.id !== gid) return g;
    if (!g.studentDeployed) {
      if (!g.printed) { toast('답안지 인쇄에서 다운로드를 진행한 후 배포할 수 있습니다.'); return g; }
      toast(`「${g.label}」 학생 배포 — 학생에게 과제가 노출됩니다.`);
      return { ...g, studentDeployed: true };
    }
    toast(`「${g.label}」 학생 배포 취소 — 학생이 과제를 확인할 수 없는 상태가 됩니다. 과제를 수정한 경우 기 출력한 문제지를 다시 인쇄하세요. (답안지는 무관)`);
    return { ...g, studentDeployed: false };
  }));
  // [v3.75] 과제 수정 잠금 — 학생 배포된 그룹이 하나라도 있으면 Step 1~4 수정 불가. 수정하려면 학생 배포를 먼저 취소해야 한다
  //   (학생 답안이 제출된 과제도 수정 불가 — 등록 화면에서는 발생하지 않으므로 과제 관리/상세 쪽 정책)
  const editLocked = groupList.some((g) => g.studentDeployed);

  // ── 진행 가능 여부 ──────────────────────────────────────────────────
  const stepValid = (n) => {
    if (n === 1) return !!basicInfo.title.trim();
    if (n === 2) return questions.every((q) => q.content.trim().length > 0);
    // [v2.7] 각 문항이 자체 evaluationAreas ≥ 1 + standard 매핑 + 모범답안(상·중·하)
    if (n === 3) return questions.every((q) =>
      q.evaluationAreas.length > 0 &&
      !!q.standard &&
      isModelAnswerFilled(q)
    );
    if (n === 4) {
      // 채점기준 valid + 총 배점 입력 시 합 일치 필수
      return questions.every((q) => {
        const ok = q.criteria.every((c) =>
          Number(c.maxPoints) > 0 && c.name.trim() &&
          c.rows.every((r) => r.score !== '') && rowsDescending(c.rows)
        );
        if (!ok) return false;
        return true; // [v3.79] 총 배점은 범주 배점 합계로 자동 산출 — 별도 조건 없음
      });
    }
    return true;
  };
  const canProceed = () => stepValid(step);
  // 탭 이동 허용: 뒤로/현재 단계는 항상, 앞으로는 현재~목표 직전 단계가 모두 유효할 때만 ([다음] 비활성이면 앞으로 이동 불가)
  const canGoToStep = (target) => {
    if (target <= step) return true;
    for (let n = step; n < target; n++) if (!stepValid(n)) return false;
    return true;
  };

  const next = () => { if (canProceed()) setStep((s) => Math.min(5, s + 1)); };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  // 기본 정보(과제명)만 입력되면 저장 가능
  const canSave = !!basicInfo.title.trim();

  // [v3.79] 총 배점 = 범주 배점 합계(표시 전용) — 불일치 검사·정합성 모달 폐기
  const performSave = () => {
    // [v3.46] 영속화 — 부모에게 task 객체 전달
    if (onAdd) {
      const task = buildDirectInputTask({
        basicInfo, passage, questions,
        evalMode, groupList, isShared,
      });
      onAdd(task);
    }
    const deployed = groupList.filter((g) => g.studentDeployed).length;
    const printedOnly = groupList.filter((g) => g.printed && !g.studentDeployed).length;
    const deployMsg = deployed || printedOnly ? ` · 학생배포 ${deployed}그룹/출력 ${printedOnly}그룹` : '';
    toast(`과제 「${basicInfo.title || '제목 없음'}」 저장 완료 (총 ${totalPoints}점${deployMsg})`);
    onBack && onBack();
  };
  const handleSave = () => {
    if (!canSave) { toast('과제명을 입력해야 저장할 수 있습니다.'); return; }
    performSave();
  };
  const handleExitNoSave = () => {
    if (window.confirm('저장하지 않고 나가시겠습니까? 작성 중인 내용은 사라집니다.')) onBack && onBack();
  };
  const handleDelete = () => {
    if (window.confirm('이 과제를 삭제하시겠습니까? 되돌릴 수 없습니다.')) { toast('과제를 삭제했습니다.'); onBack && onBack(); }
  };
  const handleToggleShare = () => {
    setIsShared((s) => {
      const next = !s;
      toast(next ? '과제를 공유했습니다.' : '과제 공유를 취소했습니다.');
      return next;
    });
  };

  // 헤더 더보기 메뉴 (공유 / 과제파일관리 / 삭제)
  const [moreOpen, setMoreOpen] = useState(false);
  const [isShared, setIsShared] = useState(false); // 기본값 미공유 → 「공유확인」, 공유 시 「공유취소」 토글
  const fileInputRef = useRef(null);
  const handleExport = () => {
    const data = { basicInfo, passage, questions, evalMode, selfScale, resultScale, resultMode };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(basicInfo.title || 'task').replace(/[\\/:*?"<>|]/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
    toast('과제를 내보냈습니다.');
  };
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.basicInfo) setBasicInfo((p) => ({ ...p, ...data.basicInfo }));
        if (typeof data.passage === 'string') setPassage(data.passage);
        if (Array.isArray(data.questions)) {
          setQuestions(data.questions);
          // [v3.74] 가져온 문항은 채점 기준을 이미 갖고 있으므로 Step 4 진입 시 자동 설계를 건너뛴다
          setRubricReady(Object.fromEntries(data.questions.map((q) => [q.id, true])));
        }
        if (data.resultScale) setResultScale(data.resultScale);
        if (data.selfScale) setSelfScale(data.selfScale);
        if (data.resultMode) setResultMode(data.resultMode);
        toast('과제를 가져왔습니다.');
      } catch {
        toast('가져오기 실패 — 올바른 과제 파일(JSON)이 아닙니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── 공통 스타일 ─────────────────────────────────────────────────────
  const card = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '18px 20px', marginBottom: 16 };
  const label = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' };
  const input = { width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', boxSizing: 'border-box' };
  const chip = (on, color = '#2A75F3') => ({
    padding: '6px 14px', borderRadius: 999, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${on ? color : '#E2E8F0'}`, background: on ? `${color}14` : 'white', color: on ? color : '#64748B',
  });
  const moreItem = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#1E293B' };

  return (
    <div style={{ height: '100%', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 + Step indicator (고정) */}
      <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <header style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>직접 입력 2 — 과제 등록</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleExitNoSave} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>나가기</button>
            {/* [v2.2] 공유 버튼을 더보기에서 헤더로 외부 노출 — 1차 액션으로 승격 */}
            <button onClick={handleToggleShare}
              title={isShared ? '과제 공유를 취소합니다.' : '과제를 공유합니다.'}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid', borderColor: isShared ? '#2A75F3' : '#E2E8F0', background: isShared ? '#EFF6FF' : 'white', color: isShared ? '#1D4ED8' : '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>🔗 {isShared ? '공유취소' : '공유확인'}</button>
            <button onClick={handleSave} disabled={!canSave}
              title={canSave ? '과제를 저장합니다.' : '과제명을 입력해야 저장할 수 있습니다.'}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: canSave ? '#10B981' : '#CBD5E1', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: canSave ? 'pointer' : 'not-allowed' }}>💾 저장</button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMoreOpen((o) => !o)} aria-haspopup="true" aria-expanded={moreOpen}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>⋯ 더보기</button>
              {moreOpen && (
                <>
                  <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 41, background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,0.16)', overflow: 'hidden', minWidth: 180 }}>
                    <div style={{ padding: '6px 14px 4px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#94A3B8', background: '#F8FAFC' }}>과제 파일 관리</div>
                    <button onClick={handleExport} style={moreItem}>↥ 과제 내보내기</button>
                    <button onClick={() => { setMoreOpen(false); fileInputRef.current?.click(); }} style={moreItem}>↧ 과제 가져오기</button>
                    <button onClick={() => { setMoreOpen(false); handleDelete(); }} style={{ ...moreItem, color: '#EF4444', borderTop: '1px solid #F1F5F9' }}>🗑 삭제</button>
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
            </div>
          </div>
        </header>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.5rem 14px', gap: 4, overflowX: 'auto' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              {(() => {
                const allowed = canGoToStep(s.n);
                return (
                  <button
                    onClick={() => {
                      if (!allowed || s.n === step) return;
                      // [v2.14] 단계 탭 이동 시 토스트
                      toast('저장됨');
                      setStep(s.n);
                    }}
                    disabled={!allowed}
                    title={allowed ? `${s.n}. ${s.label}로 이동` : '현재 단계를 완료해야 이동할 수 있습니다.'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999,
                      border: `1px solid ${step === s.n ? '#2A75F3' : s.n < step ? '#10B981' : '#E2E8F0'}`,
                      background: step === s.n ? '#EFF6FF' : s.n < step ? '#D1FAE5' : 'white',
                      color: step === s.n ? '#1D4ED8' : s.n < step ? '#047857' : '#94A3B8',
                      fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, whiteSpace: 'nowrap',
                      cursor: allowed ? 'pointer' : 'not-allowed',
                      opacity: allowed ? 1 : 0.55,
                    }}
                  >
                    <span>{s.icon}</span> {s.n}. {s.label}{s.n < step ? ' ✓' : ''}
                  </button>
                );
              })()}
              {i < STEPS.length - 1 && <span style={{ color: '#CBD5E1', flexShrink: 0 }}>—</span>}
            </React.Fragment>
          ))}
        </div>
        {/* [v3.77] 舊 [v3.45] 합 불일치 상단 영구 배너([↻ 모두 균등 재분배]) 폐기 — 총 배점 입력란 오류 표시로 일원화 */}
      </div>

      {/* 본문 (스크롤 영역) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>
       <div style={{ maxWidth: 920, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* [v3.75] 과제 수정 잠금 안내 — 학생 배포 중이면 Step 1~4는 읽기 전용 */}
        {editLocked && step < 5 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 'var(--neo-font-size-sm)', color: '#991B1B', fontWeight: 700 }}>
            <span>🔒</span>
            <span>학생 배포 중인 과제는 수정할 수 없습니다. 수정하려면 Step 5에서 학생 배포를 취소하세요.</span>
            <button onClick={() => setStep(5)} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#B91C1C', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer' }}>Step 5로 이동</button>
          </div>
        )}
        {/* 잠금 시 pointer-events:none → 휠 스크롤은 바깥 스크롤 컨테이너가 받는다 */}
        <div inert={editLocked && step < 5 ? true : undefined} style={editLocked && step < 5 ? { pointerEvents: 'none', opacity: 0.6, userSelect: 'none' } : undefined}>

        {/* Step 1 — 기본 정보 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 6 }}>📋 Step 1. 기본 정보</h2>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 16 }}>
              과제 기본 정보(과제명·학교급·학년·교과·과목·핵심역량)를 입력합니다. 핵심평가영역·성취기준·모범답안은 「성취기준」 단계에서 입력합니다.
            </p>
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>문제 유형</label>
                  <select style={input} value={basicInfo.type} onChange={(e) => setBasicInfo((p) => ({ ...p, type: e.target.value }))}>
                    <option>서술형</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={label}>과제명 *</label>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: basicInfo.title.length >= 100 ? '#EF4444' : '#94A3B8' }}>{basicInfo.title.length}/100</span>
                  </div>
                  <textarea value={basicInfo.title} placeholder="예) 대화의 원리 성찰 에세이" maxLength={100}
                    onChange={(e) => setBasicInfo((p) => ({ ...p, title: e.target.value.slice(0, 100) }))}
                    style={{ ...input, minHeight: 64, lineHeight: 1.5, resize: 'vertical', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', fontFamily: 'inherit' }} />
                </div>
                {/* 학교급·학년·교과·과목 — 한 행, 필수항목 (학교급→학년→교과→과목 자연 순서) */}
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
                  <div>
                    <label style={label}>학교급 <span style={{ color: '#EF4444' }}>*</span></label>
                    <select style={input} value={basicInfo.schoolLevel} onChange={(e) => { const schoolLevel = e.target.value; setBasicInfo((p) => ({ ...p, schoolLevel, grade: gradesOf(schoolLevel)[0] })); }}>
                      <option>초등학교</option><option>중학교</option><option>고등학교</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>학년 <span style={{ color: '#EF4444' }}>*</span></label>
                    <select style={input} value={basicInfo.grade} onChange={(e) => setBasicInfo((p) => ({ ...p, grade: e.target.value }))}>
                      {gradesOf(basicInfo.schoolLevel).map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>교과 <span style={{ color: '#EF4444' }}>*</span></label>
                    <select style={input} value={basicInfo.subject} onChange={(e) => { const subject = e.target.value; setBasicInfo((p) => ({ ...p, subject, subSubject: subjectsOf(subject)[0] || '' })); }}>
                      <option>국어</option><option>영어</option><option>사회</option><option>과학</option><option>도덕</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>과목 <span style={{ color: '#EF4444' }}>*</span></label>
                    <select style={input} value={basicInfo.subSubject} onChange={(e) => setBasicInfo((p) => ({ ...p, subSubject: e.target.value }))}>
                      {subjectsOf(basicInfo.subject).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {/* [v3.50] 핵심역량 — 기본정보 단계로 이동 (성취기준 단계에서 분리). 선택 교과의 프레임워크에 따라 동적 노출 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>핵심 역량 <span style={{ color: '#94A3B8', fontWeight: 600 }}>(선택 · 다중)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {competenciesOf(basicInfo.subject).length === 0 ? (
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>선택한 교과에 정의된 핵심 역량이 없습니다.</span>
                    ) : competenciesOf(basicInfo.subject).map((c) => (
                      <span key={c} style={chip(basicInfo.competencies.includes(c))} onClick={() => toggleChip('competencies', c)}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Step 2 — 문항 입력 */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 6 }}>📝 Step 2. 문항 입력</h2>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 16 }}>
              지문(선택)과 문항을 직접 입력합니다. <strong>문항 탭에서 [추가 +]로 최대 {MAX_QUESTIONS}개까지</strong> 추가할 수 있습니다. 모범답안은 다음 「성취기준」 단계에서 입력합니다.
            </p>

            {/* 지문 (과제 단위) */}
            <div style={card}>
              <label style={label}>지문 <span style={{ color: '#94A3B8', fontWeight: 600 }}>(선택 · 문항이 공유하는 자료)</span></label>
              <InlineEditor value={passage} onChange={(e) => setPassage(e.target.value)} placeholder="다음 글을 읽고 물음에 답하시오." minHeight={160} />
            </div>

            {/* 문항 탭 — 항상 MAX_QUESTIONS(3)개 슬롯 노출, 활성/비활성으로 표현 */}
            {(() => {
              const effectiveActiveId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              const activeIdx = questions.findIndex((qq) => qq.id === effectiveActiveId);
              const activeQ = questions[activeIdx];
              return (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {/* 추가된 문항만 탭으로 노출 */}
                    {questions.map((q, idx) => {
                      const focused = q.id === effectiveActiveId;
                      const filled = q.content.trim().length > 0;
                      const canDelete = focused && questions.length > 1;
                      return (
                        <div key={q.id} role="button" tabIndex={0}
                          onClick={() => setActiveQId(q.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveQId(q.id); } }}
                          title={`문항 ${idx + 1} 보기`}
                          style={{
                            flex: 1, minWidth: 120,
                            padding: '10px 12px', borderRadius: 10,
                            border: focused ? '2px solid #2A75F3' : '1px solid #CBD5E1',
                            background: focused ? '#EFF6FF' : 'white',
                            color: focused ? '#1D4ED8' : '#1E293B',
                            fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            userSelect: 'none',
                          }}>
                          <span>{filled ? '✅' : '📝'}</span>
                          <span>문항 {idx + 1}</span>
                          {canDelete && (
                            <span onClick={(e) => { e.stopPropagation(); requestDeleteQuestion(q.id, idx); }}
                              title="이 문항 삭제"
                              style={{ color: '#EF4444', fontWeight: 800, cursor: 'pointer' }}>
                              (삭제 -)
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* 끝에 + 추가 버튼 — 최대 한도까지 노출 */}
                    {questions.length < MAX_QUESTIONS && (
                      <div role="button" tabIndex={0}
                        onClick={addQuestionAndFocus}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addQuestionAndFocus(); } }}
                        title="문항 추가"
                        style={{
                          flex: '0 0 auto', padding: '10px 16px', borderRadius: 10,
                          border: '1px dashed #94A3B8', background: '#F8FAFC',
                          color: '#475569', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none',
                        }}>
                        <span style={{ color: '#2A75F3', fontSize: 'var(--neo-font-size-base)' }}>＋</span>
                        <span>문항 추가</span>
                      </div>
                    )}
                  </div>

                  {/* 활성 문항 카드 — 선택된 문항만 표시 (삭제는 탭의 ✕에서) */}
                  {activeQ && (
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>문항 {activeIdx + 1}</span>
                      </div>
                      <InlineEditor value={activeQ.content} onChange={(e) => updateQuestion(activeQ.id, { content: e.target.value })} placeholder={`문항 ${activeIdx + 1} 내용을 입력하세요.`} minHeight={180} />
                      {/* 문항 편집 도구 — 문항 내용 입력 후 활성화 */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {(() => {
                          const hasContent = activeQ.content.trim().length > 0;
                          return (
                            <button onClick={() => openAiImprove(activeQ.id)} disabled={!hasContent}
                              title={hasContent ? '입력한 문항 내용을 AI가 다듬어 제안합니다.' : '문항 내용을 먼저 입력하세요.'}
                              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${hasContent ? '#2A75F3' : '#E2E8F0'}`, background: hasContent ? '#EFF6FF' : '#F1F5F9', color: hasContent ? '#1D4ED8' : '#94A3B8', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: hasContent ? 'pointer' : 'not-allowed' }}>✨ AI 개선</button>
                          );
                        })()}
                      </div>

                      {/* 모범답안은 Step 3 「성취기준」에서 입력 (성취기준과 같은 카드) */}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Step 3 — 평가영역·성취기준 (입력된 문항을 보며 핵심평가영역·문항별 성취기준 선택) */}
        {step === 3 && (() => {
          // [v2.7] 핵심평가영역이 문항별 독립이므로 활성 문항 기준으로 판단
          const activeQ = questions.find((qq) => qq.id === activeQId) ?? questions[0];
          const activeEvalAreas = activeQ ? activeQ.evaluationAreas : [];
          const evalAreasSelected = activeEvalAreas.length > 0;
          // 활성 문항의 영역 토글 (기존 toggleChip 대신 — 문항별 독립)
          // [v2.36] 영역 해제 시 — 그 영역에 속한 선택된 standards도 자동 해제
          const toggleActiveQEvalArea = (area) => {
            if (!activeQ) return;
            setQuestions((qs) => qs.map((q) => {
              if (q.id !== activeQ.id) return q;
              const has = q.evaluationAreas.includes(area);
              const nextAreas = has ? q.evaluationAreas.filter((a) => a !== area) : [...q.evaluationAreas, area];
              if (has) {
                const curStandards = q.standards || (q.standard ? [q.standard] : []);
                const validStandards = curStandards.filter((sid) => {
                  const std = MOCK_STANDARDS.find((s) => s.id === sid);
                  return std && nextAreas.includes(std.area);
                });
                return {
                  ...q,
                  evaluationAreas: nextAreas,
                  standards: validStandards,
                  standard: validStandards[0] || '',
                };
              }
              return { ...q, evaluationAreas: nextAreas };
            }));
            // [v2.8] 핵심평가영역 칩 변경 시 성취기준 라디오 자동 펼침 — 새 영역 후보가 보이도록
            setStdOpen((p) => ({ ...p, [activeQ.id]: true }));
          };
          return (
          <div>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 16 }}>🎯 Step 3. 성취기준</h2>

            {/* [v3.51] 문항 탭을 맨 위로 — 어느 문항 작업할지 먼저 선택 */}
            {questions.length > 0 && (() => {
              const effId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {questions.map((qq, idx) => {
                    const isActive = qq.id === effId;
                    const filled = !!qq.standard && isModelAnswerFilled(qq);
                    return (
                      <button key={qq.id} onClick={() => setActiveQId(qq.id)} title={`문항 ${idx + 1} 보기`}
                        style={{ flex: '1 1 0', minWidth: 130, padding: '10px 12px', borderRadius: 10,
                          border: isActive ? '2px solid #2A75F3' : '1px solid #CBD5E1',
                          background: isActive ? '#EFF6FF' : 'white',
                          color: isActive ? '#1D4ED8' : '#1E293B',
                          fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <span>{filled ? '✅' : '🎯'}</span>
                        <span>문항 {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* [v2.6] 레이아웃 재구성:
                1) 활성 문항 미리보기 박스 (문항 N + 내용)
                2) 「성취기준 매핑」 카드 — 핵심평가영역 + 성취기준 통합
                3) 모범답안 카드 (별도) */}

            {/* (1) 활성 문항 미리보기 박스 — 어느 문항 작업 중인지 명시 */}
            {questions.length > 0 && (() => {
              const effId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              const actIdx = questions.findIndex((qq) => qq.id === effId);
              const q = questions[actIdx];
              if (!q) return null;
              const i = actIdx;
              return (
                <div style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>📝 문항 {i + 1}</div>
                  <div title={q.content || ''} style={{ fontSize: 'var(--neo-font-size-sm)', color: q.content ? '#475569' : '#94A3B8', lineHeight: 1.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.content ? (q.content.split('\n')[0] || q.content) : '(문항 내용 없음 — Step 2에서 입력)'}
                  </div>
                </div>
              );
            })()}

            {/* (2) 성취기준 매핑 카드 — 핵심평가영역 + 성취기준 통합 (v2.6) */}
            {questions.length > 0 && (() => {
              const effId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              const actIdx = questions.findIndex((qq) => qq.id === effId);
              const q = questions[actIdx];
              if (!q) return null;
              return (
                <div style={{
                  ...card,
                  border: evalAreasSelected ? '2px solid #10B981' : '2px solid #EF4444',
                }}>
                  {/* [v2.59] 핵심평가영역 섹션 안내 — 학교급/학년/교과/과목 4개 요소 표시 */}
                  <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 10 }}>
                    학교급 : <strong style={{ color: '#1D4ED8' }}>{basicInfo.schoolLevel}</strong> / 학년 : <strong style={{ color: '#1D4ED8' }}>{basicInfo.grade}</strong> / 교과 : <strong style={{ color: '#1D4ED8' }}>{basicInfo.subject}</strong> / 과목 : <strong style={{ color: '#1D4ED8' }}>{basicInfo.subSubject}</strong>
                  </div>
                  <label style={label}>핵심평가영역 <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#94A3B8', fontWeight: 600 }}>(이 문항에 적용 · 1개 이상 · 다중)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {evalAreasOf(basicInfo.subject).length === 0 ? (
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>선택한 교과에 정의된 핵심평가영역이 없습니다.</span>
                    ) : evalAreasOf(basicInfo.subject).map((a) => (
                      <span key={a} style={chip(q.evaluationAreas.includes(a), '#047857')} onClick={() => toggleActiveQEvalArea(a)}>{a}</span>
                    ))}
                  </div>

                  {/* 구분선 */}
                  <div style={{ height: 1, background: '#E2E8F0', margin: '4px 0 14px' }} />

                  {/* [v2.31] 성취기준 섹션 — 문항별 다중 선택 가능 (체크박스) */}
{/* [v3.82] 舊 통합 배너(활용/주의) 폐기 — 활용 안내는 ⓘ 호버 툴팁(히든)으로, 성취기준 목록은 핵심평가영역 선택 즉시 바로 아래에 체크 가능 */}
                  <label style={label}>성취기준 <span style={{ color: '#EF4444' }}>*</span> <span style={{ color: '#94A3B8', fontWeight: 600 }}>(이 문항에 적용 · 다중 선택 가능, 1개 권장)</span>
                  <span className="std-tip" style={{ position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}>
                    <span tabIndex={0} aria-label="성취기준의 활용 안내" style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #94A3B8', color: '#64748B', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', lineHeight: 1 }}>i</span>
                    <span className="std-tip-body" style={{ position: 'absolute', left: 0, top: 22, zIndex: 20, width: 380, padding: '10px 12px', background: '#1E293B', color: 'white', borderRadius: 8, fontSize: 'var(--neo-font-size-xs)', lineHeight: 1.6, boxShadow: '0 8px 20px rgba(15,23,42,0.25)', display: 'none' }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>ℹ️ 성취기준의 활용</div>
                      <div>• 평가 기준 단계 진입 시 성취기준·문항 내용을 분석해 채점 루브릭을 자동 설계합니다.</div>
                      <div>• AI 채점 기준 생성 시에도 평가 내용의 참고 자료로 활용됩니다.</div>
                      <div style={{ marginTop: 6, color: '#FDE68A' }}>⚠️ 1개 권장 — 여러 개를 고르면 모두 채점 기준에 반영되며, 평가 내용이 많아져 AI 응답이 느려지거나 실패할 수 있습니다.</div>
                    </span>
                    <style>{`.std-tip:hover .std-tip-body, .std-tip:focus-within .std-tip-body { display: block !important; }`}</style>
                  </span>
                  </label>
                  {q.evaluationAreas.length === 0 ? (
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#B45309', background: '#FEF3C7', padding: '10px 12px', borderRadius: 8 }}>
                      위 핵심평가영역을 먼저 선택하면 해당 성취기준이 표시됩니다.
                    </div>
                  ) : filteredStandardsFor(q.evaluationAreas).length === 0 ? (
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', background: '#F8FAFC', padding: '10px 12px', borderRadius: 8 }}>
                      선택한 핵심평가영역{basicInfo.competencies.length > 0 ? ' · 핵심역량' : ''} 조건에 해당하는 성취기준이 없습니다.
                    </div>
                  ) : (() => {
                    const selectedStandards = q.standards || (q.standard ? [q.standard] : []);
                    const multiWarn = selectedStandards.length >= 2;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {multiWarn && (
                          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px' }}>
                            ⚠️ 성취기준 {selectedStandards.length}개 선택 — 모두 채점 기준에 반영됩니다. 평가 내용이 많아져 AI 응답이 느려질 수 있으니 1개를 권장합니다.
                          </div>
                        )}
                        {filteredStandardsFor(q.evaluationAreas).map((s) => {
                          const on = selectedStandards.includes(s.id);
                          return (
                            <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? '#2A75F3' : '#E2E8F0'}`, background: on ? '#EFF6FF' : 'white' }}>
                              <input type="checkbox" checked={on} onChange={() => selectQuestionStandard(q.id, s.id)} style={{ marginTop: 2 }} />
                              <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', lineHeight: 1.5 }}>
                                <span style={{ fontWeight: 700, color: '#047857' }}>[{s.area}]</span> {s.text}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* (3) 모범답안 카드 — 별도 (v2.6) */}
            {questions.length > 0 && (() => {
              const effId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              const actIdx = questions.findIndex((qq) => qq.id === effId);
              const q = questions[actIdx];
              if (!q) return null;
              const i = actIdx;
              return (
              <div key={q.id} style={card}>

                {/* [v2.67] 모범답안 — contenteditable HTML (텍스트+이미지 inline) + 10MB 합계 가드 */}
                {(() => {
                  const maOpen = modelAnsOpen[q.id] ?? true;
                  const ma = getModelAnswer(q);
                  const maFilled = isModelAnswerFilled(q);
                  const hasContent = q.content.trim().length > 0;
                  return (
                    <div style={{ marginTop: 12, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                      <button onClick={() => toggleModelAns(q.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', background: maOpen ? '#F8FAFC' : 'white', border: 'none', borderBottom: maOpen ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>{maOpen ? '▼' : '▶'}</span>
                        <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>모범답안 <span style={{ color: '#EF4444' }}>*</span> <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>(텍스트 · 이미지 · 수식 입력 가능)</span></span>
                        {!maFilled && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#DC2626', fontWeight: 700 }}>미입력</span>}
                        {maFilled && <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#10B981', fontWeight: 700 }}>입력 완료</span>}
                      </button>
                      {maOpen && (() => {
                        const showOverlay = !maFilled && !modelAnsFocused;
                        return (
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* [v2.68] 헤더 — 자동 생성 + 전체 비우기. 합계 표시 제거 (10MB 가드는 유지) */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {maFilled && (
                              <button onClick={() => clearModelAnswer(q.id)} title="텍스트·이미지 전체 비우기"
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', color: '#94A3B8', fontWeight: 700, fontSize: 'var(--neo-font-size-xs)', cursor: 'pointer' }}>전체 비우기</button>
                            )}
                            <button onClick={() => generateModelAnswers(q.id)} disabled={!hasContent}
                              title={hasContent ? '문항 내용·성취기준을 기반으로 모범답안 텍스트를 생성합니다.' : '문항 내용을 먼저 입력하세요(Step 2).'}
                              style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${hasContent ? '#2A75F3' : '#E2E8F0'}`, background: hasContent ? '#EFF6FF' : '#F1F5F9', color: hasContent ? '#1D4ED8' : '#94A3B8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: hasContent ? 'pointer' : 'not-allowed' }}>🤖 자동 생성</button>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <div
                              ref={(el) => { if (el && el.innerHTML !== (ma.html || '')) el.innerHTML = ma.html || ''; }}
                              data-model-answer-editor={q.id}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => updateModelAnswerHtml(q.id, e.currentTarget.innerHTML)}
                              onPaste={(e) => handleModelAnswerPaste(e, q.id)}
                              onFocus={() => setModelAnsFocused(true)}
                              onBlur={() => setModelAnsFocused(false)}
                              style={{ width: '100%', minHeight: 160, border: '1px solid #CBD5E1', borderRadius: 8, padding: '12px 14px', paddingRight: 80, fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', overflowY: 'auto', maxHeight: 480 }}
                            />
                            {showOverlay && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                                <label style={{ pointerEvents: 'auto', padding: '10px 16px', borderRadius: 10, border: '1px dashed #94A3B8', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  onMouseDown={(e) => e.preventDefault()}>
                                  📷 이미지 업로드
                                  <input type="file" accept="image/*" multiple onChange={(e) => { onModelAnswerFiles(q.id, e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                                </label>
                                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>또는 텍스트를 입력하거나 Ctrl+V로 이미지를 붙여넣으세요</span>
                              </div>
                            )}
                            <button onClick={() => setFormulaModal({ target: 'modelAnswer', qid: q.id, level: 'single', initialContent: '' })}
                              title="모범답안에 수식(LaTeX)을 삽입·편집합니다"
                              style={{ position: 'absolute', right: 8, top: 8, padding: '3px 9px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4 }}>∑ 수식</button>
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
              );
            })()}
          </div>
          );
        })()}

        {/* Step 4 — 평가 기준 ([v3.74] 자동평가 폐기 → 자율평가 루브릭 단일 체제. 진입 시 AI 자동 설계) */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 16 }}>⚖️ Step 4. 평가 기준</h2>

            {/* ── 문항 탭 + 총 배점 요약 + 활성 문항 카드 ── */}
            {questions.length > 0 && (() => {
              const effectiveActiveId = (questions.find((qq) => qq.id === activeQId)?.id) ?? questions[0]?.id;
              const activeIdx = questions.findIndex((qq) => qq.id === effectiveActiveId);
              const activeQ = questions[activeIdx];
              const qTotal = (q) => q.criteria.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
              const totalSelf = questions.reduce((s, q) => s + qTotal(q), 0);
              return (
              <div>
                <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E40AF', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 12px', borderRadius: 8, marginBottom: 14, lineHeight: 1.6 }}>
                  🤖 성취기준과 문항 내용을 분석해 채점 루브릭을 자동 설계했습니다. 문항마다 채점 기준 1개 · 평가 내용 3개를 기본으로 제공하며, 채점 기준은 1~5개, 평가 내용은 2~(배점+1)개로 추가·삭제할 수 있습니다. 채점 결과(등급/점수)는 맨 아래에서 정합니다.
                </div>

                {/* 문항 탭 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {questions.map((q, idx) => {
                    const focused = q.id === effectiveActiveId;
                    const pts = qTotal(q);
                    return (
                      <button key={q.id} onClick={() => setActiveQId(q.id)} title={`문항 ${idx + 1} 보기`}
                        style={{ flex: '1 1 0', minWidth: 130, padding: '10px 12px', borderRadius: 10,
                          border: focused ? '2px solid #2A75F3' : '1px solid #CBD5E1',
                          background: focused ? '#EFF6FF' : 'white',
                          color: focused ? '#1D4ED8' : '#1E293B',
                          fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <span>✍️</span>
                        <span>문항 {idx + 1}</span>
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 7px', borderRadius: 999 }}>{pts}점</span>
                      </button>
                    );
                  })}
                </div>



                {/* 활성 문항 카드 */}
                {activeQ && (() => {
                  const q = activeQ;
                  const i = activeIdx;
                  return (
                  <div key={q.id} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B' }}>문항 {i + 1}</span>
                      <button onClick={() => aiGenerateCriteria(q.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2A75F3', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>🤖 AI 채점 기준 생성</button>
                    </div>
                    <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{q.content || '(문항 내용 없음)'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#475569' }}>성취기준:</span>
                      {(() => {
                        const s = MOCK_STANDARDS.find((x) => x.id === q.standard);
                        return s
                          ? <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#047857', background: '#D1FAE5', padding: '3px 9px', borderRadius: 999 }}>[{s.area}] {stdCode(s.text)}</span>
                          : <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#B45309' }}>Step 3에서 선택해 주세요.</span>;
                      })()}
                    </div>

                    {/* [v3.79] 총 배점 — 입력 없음. 범주 배점 합계를 표시만 한다 */}
                    {(() => {
                      const sum = q.criteria.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
                      return (
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569' }}>총 배점</span>
                          <strong style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: sum > 0 ? '#1D4ED8' : '#94A3B8' }}>{sum}</strong>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>점</span>
                          <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>· 각 범주의 배점 합계로 자동 산출됩니다.</span>
                        </div>
                      );
                    })()}

                    {q.criteria.map((c, ci) => (
                      <div key={c.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#64748B', minWidth: 48 }}>채점 {ci + 1}</span>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input style={{ ...input, paddingRight: c.name && c.name.trim() ? 32 : 12 }} value={c.name} placeholder="채점 기준명 (예: 주제 명확성)"
                              onChange={(e) => updateCriterion(q.id, c.id, { name: e.target.value })} />
                            {c.name && c.name.trim() && (
                              <button onClick={() => updateCriterion(q.id, c.id, { name: '' })}
                                title="비우기 (재생성 시 AI가 다시 채움)"
                                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#E2E8F0', color: '#475569', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                          {q.criteria.length > 1 && (
                            <button onClick={() => removeCriterion(q.id, c.id)}
                              title="이 채점 기준 카드 삭제"
                              style={{ border: '1px solid #FECACA', background: 'white', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '4px 10px', borderRadius: 8 }}>🗑 카드 삭제</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 4, flexWrap: 'wrap' }}>
                          {/* 배점 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>배점</span>
                            <input type="number" min={2} placeholder="배점" style={{ ...input, width: 80 }} value={c.maxPoints}
                              onChange={(e) => updateCriterion(q.id, c.id, { maxPoints: e.target.value })} />
                            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B' }}>점</span>
                          </div>
                          {/* [v3.74] 배점 단계 스텝퍼 폐기 — 점수 구간 3개 고정 */}
                          {/* [v3.74] 배점 간격 드롭다운 폐기 — 간격은 항상 최대값(배점÷2)으로 자동 산출, [↻ 점수 균등 분배]만 유지 */}
                          {/* [v2.38] 점수 균등 분배만 채점 기준 단위로 유지. 등급 균등 분배는 총 배점 영역에서 전체 일괄 처리 */}
                          <button onClick={() => redistribute(q.id, c.id)} title="입력한 배점을 3개 구간(배점 → 0점)에 균등하게 다시 분배합니다."
                            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>↻ 점수 균등 분배</button>
                        </div>
                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600, marginBottom: 10 }}>
                          배점을 입력하면 구간(기본 3개, 배점 → 0점)에 균등 분배됩니다. 아래 표에서 각 구간 점수를 직접 수정할 수 있고, [+ 평가 내용 추가]·[✕ 삭제]로 구간 수를 바꿀 수 있으며, [↻ 점수 균등 분배]로 되돌릴 수 있습니다. (0~배점, 정수)
                        </div>
                        {/* 점수 표 — 점수 직접 편집 가능 */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)' }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 700, width: 96 }}>점수</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 700 }}>평가 내용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.rows.map((r, ri) => (
                              <tr key={ri} style={{ borderTop: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '4px 8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* [v2.33] 동적 min/max 제거 — 브라우저가 큰 수 입력 자체를 차단하면 onChange가 발생 안 해 토스트가 안 뜸. 절대 상한(maxPoints)/0만 두고 단조 감소 검증은 onChange에서 처리 */}
                                    <input type="number" min={0} max={Number(c.maxPoints) || 0} value={r.score}
                                      onChange={(e) => updateRowScore(q.id, c.id, ri, e.target.value)}
                                      style={{ width: 56, padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#2A75F3', fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box' }} />
                                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8' }}>점</span>
                                  </div>
                                </td>
                                <td style={{ padding: '4px 8px' }}>
                                  {/* [v2.16] 평가내용 — input처럼 보이는 에디터. [∑+ 수식] / chip 클릭 모두 평가내용 전체를 편집기에 로드 */}
                                  <EvalContentEditor
                                    desc={r.desc}
                                    placeholder={`${r.score !== '' ? `${r.score}점` : ['상', '중', '하'][ri] || ''} 수준의 평가 내용`}
                                    onChange={(v) => updateRowDesc(q.id, c.id, ri, v)}
                                    onOpenEditor={() => setFormulaModal({ qid: q.id, cid: c.id, ri, initialContent: r.desc || '' })}
                                    onDelete={() => removeRow(q.id, c.id, ri)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                          <button onClick={() => addRow(q.id, c.id)} title="평가 내용 구간을 하나 추가하고 점수를 배점 → 0점으로 균등 분배합니다. 점수는 직접 수정할 수 있습니다."
                            style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, border: '1px dashed #94A3B8', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-xs)' }}>+ 평가 내용 추가 ({c.rows.length}/{rowLimit(c)})</button>
                        {/* [v2.32] 단조 감소 경고 박스 폐기 — 입력 시점에 차단(updateRowScore + input dynMin/dynMax)으로 정책 강제 */}
                      </div>
                    ))}
                    <button onClick={() => addCriterion(q.id)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px dashed #94A3B8', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>+ 채점 기준 추가 ({q.criteria.length}/5)</button>
                    {/* [v3.82] 채점 결과 — 맨 아래로 이동. 결과를 「등급」으로 낼지 「점수」로 낼지 고르고, 등급이면 3/4/5등급 선택 */}
                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1E293B' }}>채점 결과</span>
                      {[['grade', '등급'], ['score', '점수']].map(([k, lbl]) => (
                        <button key={k} onClick={() => setResultMode(k)}
                          style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${resultMode === k ? '#2A75F3' : '#E2E8F0'}`, background: resultMode === k ? '#EFF6FF' : 'white', color: resultMode === k ? '#1D4ED8' : '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
                          {resultMode === k ? '✓ ' : ''}{lbl}
                        </button>
                      ))}
                      {resultMode === 'grade' && (<>
                        <span style={{ width: 1, height: 22, background: '#E2E8F0' }} />
                        {[3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setSelfScale(n)}
                            style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${selfScale === n ? '#2A75F3' : '#E2E8F0'}`, background: selfScale === n ? '#EFF6FF' : 'white', color: selfScale === n ? '#1D4ED8' : '#475569', fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, cursor: 'pointer' }}>
                            {selfScale === n ? '✓ ' : ''}{n}등급
                          </button>
                        ))}
                      </>)}
                      <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginLeft: 'auto' }}>
                        {resultMode === 'grade' ? (() => {
                          const names = GRADE_NAMES[selfScale] || [];
                          const range = names.length >= 2 ? `${names[0]}~${names[names.length - 1]}` : '';
                          return <>채점기준 점수의 <strong>합산 → {selfScale}등급({range})</strong>으로 환산.</>;
                        })() : <>채점기준 점수의 <strong>합산(총 배점 {totalSelf}점 만점)</strong>을 점수 그대로 결과로 표시.</>}
                      </span>
                    </div>

                    {/* [v3.76] 등급 환산 미리보기 패널 폐기 — 채점 등급 카드의 환산 안내 문구로 갈음 */}
                  </div>
                  );
                })()}
              </div>
              );
            })()}
          </div>
        )}
        </div>{/* /잠금 래퍼 */}

        {/* Step 5 — 그룹 배포 · 문답지 출력 */}
        {step === 5 && (() => {
          const badge = (bg, color) => ({ background: bg, color, fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 10 });
          const studentBtn = (on) => ({ padding: '7px 14px', borderRadius: 8, fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer', border: on ? '1px solid #EF4444' : 'none', background: on ? 'white' : '#2A75F3', color: on ? '#EF4444' : 'white' });
          return (
            <div>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: 6 }}>🚀 Step 5. 그룹 배포 · 문답지 출력</h2>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 16 }}>
                응시 설정 → 문답지 출력 → 학생 배포 순으로 진행합니다.
                <strong> 답안지 다운로드(인쇄)</strong> = 채점 관리 미채점 진입(학생 화면 미노출),
                <strong> 학생 배포</strong> = 학생에게 노출. 학생 배포는 답안지 출력이 완료된 그룹만 가능하며, 학생 배포 중에는 과제를 수정할 수 없습니다. 스마트펜 번호표는 사용하지 않습니다 — 학생이 답안지 기재란에 쓴 학년/반/번호·이름을 OCR로 읽어 식별합니다.
              </p>

              {/* [v2.29] 응시·출력 설정 카드 — 배포 전에 학생 응시 정책 + 답안지 출력 매수를 함께 결정 (v2.10 응시 설정 + v2.21 출력 매수 통합) */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <label style={{ ...label, margin: 0, fontWeight: 800 }}>응시·출력 설정</label>
                  <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 500 }}>— 배포 전에 응시 정책과 답안지 출력 매수를 결정합니다</span>
                </div>

                {/* 응시 정책 섹션 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.02em' }}>응시 정책</div>
                  <div style={{
                    background: blockCopyPaste ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${blockCopyPaste ? '#FCA5A5' : '#E5E7EB'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    transition: 'all 0.2s ease',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <span
                        role="switch"
                        aria-checked={blockCopyPaste}
                        onClick={() => setBlockCopyPaste(v => !v)}
                        style={{
                          position: 'relative', width: 44, height: 24, borderRadius: 12,
                          background: blockCopyPaste ? '#EF4444' : '#CBD5E1',
                          transition: 'background 0.2s ease', flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2, left: blockCopyPaste ? 22 : 2,
                          width: 20, height: 20, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        }} />
                      </span>
                      <input type="checkbox" checked={blockCopyPaste} onChange={(e) => setBlockCopyPaste(e.target.checked)} style={{ display: 'none' }} />
                      <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>복사·붙여넣기 차단</span>
                      <span title="공정한 평가를 위해 학생이 AI 생성 답안 등 외부 출처 문구를 그대로 복제하지 못하도록 차단합니다. 학생 응시 화면에만 적용됩니다." style={{ fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', cursor: 'help', border: '1px solid #CBD5E1', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>ℹ</span>
                    </label>
                    <p style={{
                      margin: '10px 0 0 56px', fontSize: 'var(--neo-font-size-sm)',
                      color: blockCopyPaste ? '#B91C1C' : '#475569',
                      fontWeight: 600, lineHeight: 1.5,
                    }}>
                      {blockCopyPaste
                        ? '🚫 학생은 답안 입력 시 복사·붙여넣기를 사용할 수 없습니다. (Ctrl+C/V, 우클릭 메뉴, 드래그 복사 모두 차단)'
                        : '✅ 학생은 답안 입력 시 복사·붙여넣기를 자유롭게 사용할 수 있습니다.'}
                    </p>
                  </div>
                </div>

                {/* [v2.54] 출력 정책 섹션 — 문항별 답안지 수 매핑 */}
                <div>
                  <div style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, color: '#94A3B8', marginBottom: 6, letterSpacing: '0.02em' }}>출력 정책</div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 700, color: '#1E2225' }}>📝 문항당 인쇄할 답안지 수</span>
                      <span title="각 문항별로 인쇄할 답안지 매수입니다. 학생 1명당 합산 매수가 답안지 PDF 생성에 적용됩니다." style={{ fontSize: 'var(--neo-font-size-xs)', color: '#8A94A1', cursor: 'help', border: '1px solid #CBD5E1', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>ℹ</span>
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)', color: '#475569', fontWeight: 700 }}>학생당 총 <strong style={{ color: '#1D4ED8' }}>{totalCopies}</strong>장</span>
                    </div>
                    {questions.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8', fontStyle: 'italic' }}>문항을 먼저 입력하세요.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {questions.map((q, idx) => {
                          const copies = getCopies(q.id);
                          return (
                            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                              <span style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#1E293B', minWidth: 60 }}>문항 {idx + 1}</span>
                              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button onClick={() => setCopies(q.id, copies - 1)} disabled={copies <= 1}
                                  style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #CBD5E1', background: copies <= 1 ? '#F1F5F9' : 'white', color: copies <= 1 ? '#CBD5E1' : '#475569', cursor: copies <= 1 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', padding: 0, lineHeight: 1 }}>−</button>
                                {/* [v2.55] 직접 입력 가능한 input — 1~10 자동 clamp */}
                                <input type="number" min={1} max={10} value={copies}
                                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) setCopies(q.id, n); }}
                                  style={{ width: 44, textAlign: 'center', fontWeight: 800, color: '#1E293B', fontSize: 'var(--neo-font-size-base)', border: '1px solid #CBD5E1', borderRadius: 6, padding: '3px 4px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                <button onClick={() => setCopies(q.id, copies + 1)} disabled={copies >= 10}
                                  style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #CBD5E1', background: copies >= 10 ? '#F1F5F9' : 'white', color: copies >= 10 ? '#CBD5E1' : '#475569', cursor: copies >= 10 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', padding: 0, lineHeight: 1 }}>+</button>
                                <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#475569', fontWeight: 700 }}>장</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p style={{ margin: '8px 0 0 0', fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 600 }}>(문항별 기본 1장 · 최대 10장)</p>
                  </div>
                </div>
              </div>

              {/* [v3.78] 문답지 출력 — 배포 그룹 카드 위로 이동 (출력 → 학생 배포 순서와 화면 순서 일치)
                  [v2.10] 통합 문답지 출력 → 3-카드 분리 → [v3.80] 스마트펜 번호표 카드 폐기 (문제지·답안지 2-카드) */}
              <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, marginBottom: 6 }}>🖨️ 문답지 출력</h3>
            <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#64748B', marginBottom: 16 }}>
              입력한 문항을 기반으로 <strong>문제지·답안지</strong>를 출력합니다. 답안지의 기재란(학년/반/번호·이름)에 학생이 직접 쓰고, 스캔 채점 시 OCR로 학생을 식별합니다.
            </p>

            {/* [v2.11] 미리보기 영역 폐기 / [v2.12] 「번호표 배포 필요」 비활성 정책 폐기 — 항상 활성
                [v3.75] 답안지 미리보기 모달의 [🖨 인쇄]가 그룹별 출력 완료(printed)를 기록 → 미채점 등록 + 학생 배포 활성화 */}
            <div style={card}>
              {/* [v2.21] 답안지 카드만 학생당 N장 spinner 인라인 — 3 카드 모두 div + [PDF 출력] 버튼 분리로 일관성 유지 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '📄', label: '문제지 출력', desc: '입력한 문항으로 구성된 문제지', key: 'question' },
                  { icon: '📝', label: '답안지 출력', desc: '학년/반/번호·이름 기재란 포함 (OCR 학생 식별)', key: 'answer' },
                ].map((btn) => (
                  <div key={btn.label}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 10px', borderRadius: 12, border: '1px solid #CBD5E1', background: 'white', color: '#1E293B' }}>
                    <span style={{ fontSize: '1.8rem' }}>{btn.icon}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800 }}>{btn.label}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center' }}>{btn.desc}</span>
                    {/* [v2.30] 답안지 카드 「학생당 N장 인쇄」 안내 제거 — 매수는 응시·출력 설정 카드에서 결정·표시 (중복 노출 방지)
                        [TSK-05 v2.30] answer 카드는 미리보기 모달로 이관
                        [v3.80] 번호표 카드 폐기, question은 기존 toast 유지 */}
                    <button onClick={() => {
                      if (btn.key === 'answer') {
                        setWorksheetPreviewOpen(true);
                      } else {
                        toast(`${btn.label} PDF 생성 중... (샘플)`);
                      }
                    }}
                      style={{ marginTop: 8, padding: '6px 18px', borderRadius: 8, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {btn.key === 'answer' ? '👁 미리보기' : '📥 PDF 출력'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* [v2.14] 「번호표 배포된 그룹」 칩 영역 폐기 — 출력 카드만 노출 */}
          </div>

              <div style={card}>
                <label style={label}>배포 그룹</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {groupList.map((g) => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                      <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 'var(--neo-font-size-base)' }}>{g.label}</span>
                      <span style={{ color: '#94A3B8', fontSize: 'var(--neo-font-size-sm)' }}>{g.studentCount}명</span>
                      {/* [v3.75] 번호표 배포 배지·버튼 폐기 → 출력 완료 배지 + 학생 배포(출력 완료 그룹만 활성) */}
                      {g.printed && !g.studentDeployed && <span style={badge('#FEF3C7', '#B45309')}>🖨 답안지 출력 완료 · 미채점 등록</span>}
                      {!g.printed && <span style={badge('#F1F5F9', '#64748B')}>출력 전</span>}
                      {g.studentDeployed && <span style={badge('#DBEAFE', '#1D4ED8')}>🚀 학생 배포</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button onClick={() => toggleGroupStudent(g.id)}
                          aria-disabled={!g.printed && !g.studentDeployed}
                          title={g.studentDeployed ? '학생이 과제를 확인할 수 없는 상태가 됩니다.' : (g.printed ? '학생에게 과제가 노출됩니다.' : '답안지 인쇄에서 다운로드를 진행한 후 배포할 수 있습니다.')}
                          style={{ ...studentBtn(g.studentDeployed), ...(!g.printed && !g.studentDeployed ? { background: '#E2E8F0', color: '#94A3B8', cursor: 'not-allowed' } : {}) }}>{g.studentDeployed ? '↩ 학생 배포 취소' : '🚀 학생 배포'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

       </div>
      </div>

      {/* 하단 네비게이션 (고정 · 가운데 정렬) */}
      <div style={{ flexShrink: 0, background: 'white', borderTop: '1px solid #E2E8F0', padding: '12px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {!canProceed() && step < 5 && (
          <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#B45309' }}>
            {step === 1 ? '과제명을 입력하세요.'
              : step === 2 ? '모든 문항의 내용을 입력하세요.'
              : step === 3 ? '각 문항마다 핵심평가영역(1개 이상) · 성취기준(1개) · 모범답안(상·중·하)을 입력하세요. (핵심역량은 Step 1에서 선택)'
              : step === 4 ? (() => {
                  return '채점 기준의 이름·배점을 입력하고, 각 단계 점수를 채워 위→아래로 낮아지게 하세요.';
                })()
              : ''}
          </span>
        )}
        {/* [v2.13] [✕ 취소] 폐기 → 헤더 [나가기]로 일원화.
            [← 이전] · [다음 →] 가운데 정렬. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => {
              if (step > 1) {
                toast('저장됨');
                prev();
              }
            }}
            disabled={step === 1}
            style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: step === 1 ? '#CBD5E1' : '#475569', fontWeight: 700, cursor: step === 1 ? 'not-allowed' : 'pointer', fontSize: 'var(--neo-font-size-sm)', opacity: step === 1 ? 0.5 : 1 }}
          >← 이전</button>
          {step < 5 && (
            <button
              onClick={() => {
                if (!canProceed()) return;
                toast('저장됨');
                next();
              }}
              disabled={!canProceed()}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: canProceed() ? '#2A75F3' : '#CBD5E1', color: 'white', fontWeight: 800, cursor: canProceed() ? 'pointer' : 'not-allowed', fontSize: 'var(--neo-font-size-sm)' }}
            >
              다음 →
            </button>
          )}
        </div>
      </div>

      {/* 문항 삭제 확인 모달 — 내용이 입력된 문항을 삭제할 때 */}
      {/* [v3.79] 저장 정합성 모달 폐기 — 총 배점은 범주 배점 합계 표시 전용 */}

      {deleteConfirm && (() => {
        const q = questions.find((qq) => qq.id === deleteConfirm.qid);
        if (!q) return null;
        return (
          <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '92vw', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '18px 22px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.6rem' }}>⚠️</span>
                <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0, color: '#1E293B' }}>문항 {deleteConfirm.idx + 1} 삭제</h2>
              </div>
              <div style={{ padding: '4px 22px 18px', fontSize: 'var(--neo-font-size-base)', color: '#475569', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px' }}>이 문항에는 <strong style={{ color: '#DC2626' }}>입력된 내용</strong>이 있습니다.</p>
                <p style={{ margin: '0 0 12px', color: '#64748B' }}>
                  {q.content && q.content.trim() && <>· 문항 내용<br /></>}
                  {isModelAnswerFilled(q) && <>· 모범답안<br /></>}
                  {q.standard && <>· 성취기준 선택<br /></>}
                  {q.points !== '' && Number(q.points) > 0 && <>· 배점<br /></>}
                  {criteriaHaveContent(q.criteria) && <>· 채점 기준<br /></>}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>삭제하면 위 내용은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?</p>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '12px 22px 18px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>취소</button>
                <button onClick={confirmDeleteQuestion} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#EF4444', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer' }}>🗑 삭제</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* [v2.11] 문답지 미리보기 모달 폐기 — 미리보기 영역과 함께 제거 */}

      {/* AI 개선 결과 모달 */}
      {aiImprove && (
        <div onClick={() => setAiImprove(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 860, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0 }}>AI 개선 결과</h2>
              <button onClick={() => setAiImprove(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding: '18px 20px', overflowY: 'auto' }}>
              <label style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 6 }}>원본 문항 내용</label>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.7, background: '#F8FAFC', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{aiImprove.original}</div>
              <label style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#1D4ED8', display: 'block', marginBottom: 6 }}>AI 개선 내용 <span style={{ color: '#94A3B8', fontWeight: 600 }}>(직접 수정 가능 · 샘플)</span></label>
              <textarea value={aiImprove.improved} onChange={(e) => setAiImprove((p) => ({ ...p, improved: e.target.value }))}
                style={{ width: '100%', minHeight: 120, border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: '#1E2225', lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FBFF' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setAiImprove(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>취소</button>
              <button onClick={applyAiImprove} style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: '#2A75F3', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>적용하기</button>
            </div>
          </div>
        </div>
      )}

      {/* [v2.58] 성취기준 1→2 전환 경고 모달 폐기 — 통합 배너(좌:활용 + 우:주의)로 일원화 */}

      {/* [v2.16/v2.19] 수식 입력 모달 — 평가내용 / 모범답안 통합 편집 (v2.19 target 분기) */}
      {formulaModal && (
        <FormulaModal
          initialLatex={formulaModal.initialContent}
          onCancel={() => setFormulaModal(null)}
          onConfirm={(newContent) => {
            if (formulaModal.target === 'modelAnswer') {
              const editor = document.querySelector(`[data-model-answer-editor="${formulaModal.qid}"]`);
              if (editor) {
                const formulaHtml = `<div data-formula="true">$$${newContent}$$</div>`;
                editor.innerHTML = (editor.innerHTML || '') + formulaHtml;
                updateModelAnswerHtml(formulaModal.qid, editor.innerHTML);
              }
            } else {
              // 평가내용 전체를 새 내용으로 교체 (텍스트 + $$LaTeX$$ 마커 통합)
              updateRowDesc(formulaModal.qid, formulaModal.cid, formulaModal.ri, newContent);
            }
            setFormulaModal(null);
          }}
        />
      )}

      {/* [TSK-05 v2.30] 평가 답안지 미리보기 모달 */}
      <WorksheetPreviewModal
        open={worksheetPreviewOpen}
        onClose={() => setWorksheetPreviewOpen(false)}
        subject={basicInfo?.subject || '국어'}
        taskTitle={basicInfo?.title || '과제명'}
        groups={groupList.map((g) => g.label)}
        onPrint={markGroupPrinted}
      />
    </div>
  );
};

// ============================================================
// [v2.16] 자율평가 평가내용 에디터 — input처럼 보이는 인라인 표시.
//   - 수식($$LaTeX$$)이 있으면 chip으로 인라인 표시
//   - chip 호버 시 ✏ 편집 아이콘 노출
//   - [∑+ 수식] 버튼 / chip 클릭 모두 onOpenEditor(전체 내용) 호출
//   - 모달에서 평가내용 전체(텍스트+수식 마커)를 LaTeX 형식으로 통째 편집
// ============================================================
const EvalContentEditor = ({ desc, placeholder, onChange, onOpenEditor, onDelete }) => {
  // 평가내용 문자열을 [{type:'text'|'formula', value/latex}] 배열로 파싱
  const parsed = React.useMemo(() => {
    if (!desc) return [];
    const parts = [];
    let i = 0;
    let formulaIdx = 0;
    desc.replace(/\$\$([^$]+)\$\$/g, (match, latex, offset) => {
      if (offset > i) parts.push({ type: 'text', value: desc.slice(i, offset) });
      parts.push({ type: 'formula', latex, formulaIdx });
      formulaIdx += 1;
      i = offset + match.length;
      return match;
    });
    if (i < desc.length) parts.push({ type: 'text', value: desc.slice(i) });
    return parts;
  }, [desc]);

  // 텍스트 변경 핸들러 — 수식 마커는 보존, 텍스트만 새로 결합
  const handleTextChange = (textIdx, newText) => {
    let textOccurrence = 0;
    const newDesc = parsed.map((p) => {
      if (p.type === 'formula') return `$$${p.latex}$$`;
      const out = textOccurrence === textIdx ? newText : p.value;
      textOccurrence += 1;
      return out;
    }).join('');
    onChange(newDesc);
  };

  // chip CSS injection (한 번만)
  React.useEffect(() => {
    if (document.getElementById('formula-chip-style')) return;
    const style = document.createElement('style');
    style.id = 'formula-chip-style';
    style.textContent = `
      .formula-chip {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: #EFF6FF;
        border: 1px solid #BFDBFE;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: var(--neo-font-size-sm);
        color: #1D4ED8;
        cursor: pointer;
        margin: 0 2px;
        white-space: nowrap;
      }
      .formula-chip:hover {
        background: #DBEAFE;
        border-color: #2A75F3;
      }
      .formula-chip::after {
        content: '✏';
        opacity: 0;
        font-size: var(--neo-font-size-xs);
        transition: opacity 0.15s;
        margin-left: 4px;
      }
      .formula-chip:hover::after {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const hasContent = parsed.length > 0;

  // 텍스트 input들 사이에 chip 끼워넣기
  let textOccurrence = 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
      padding: '4px 6px',
      border: '1px solid #CBD5E1',
      borderRadius: 6,
      background: 'white',
      minHeight: 32,
      fontSize: 'var(--neo-font-size-sm)',
    }}>
      {!hasContent && (
        <input
          value=""
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 'var(--neo-font-size-sm)', minWidth: 80, padding: '4px 6px', fontFamily: 'inherit' }}
        />
      )}
      {hasContent && parsed.map((p, pi) => {
        if (p.type === 'text') {
          const currentTextIdx = textOccurrence;
          textOccurrence += 1;
          return (
            <input
              key={pi}
              value={p.value}
              onChange={(e) => handleTextChange(currentTextIdx, e.target.value)}
              style={{
                border: 'none', outline: 'none',
                fontSize: 'var(--neo-font-size-sm)',
                padding: '4px 4px',
                fontFamily: 'inherit',
                flex: '0 1 auto',
                width: `${Math.max(p.value.length, 1) * 8 + 16}px`,
                minWidth: 16,
              }}
            />
          );
        }
        // formula chip — 클릭 시 평가내용 전체를 편집기로 로드
        return (
          <span
            key={pi}
            className="formula-chip"
            title="클릭하여 평가내용 전체 편집 (수식 + 텍스트)"
            onClick={onOpenEditor}
          >
            📐 {p.latex}
          </span>
        );
      })}
      {/* [v3.80] ✕ 삭제 — 이 평가 내용 행을 지운다 (舊 v2.61 「✕ 비우기」 대체). onDelete 가 없으면 옛 비우기 동작 */}
      {(onDelete || hasContent) && (
        <button
          type="button"
          onClick={() => (onDelete ? onDelete() : onChange(''))}
          title={onDelete ? '이 평가 내용을 삭제합니다.' : '평가 내용을 비웁니다.'}
          style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            border: '1px solid #E2E8F0',
            background: 'white',
            color: '#94A3B8',
            borderRadius: 4,
            fontSize: 'var(--neo-font-size-xs)',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >{onDelete ? '✕ 삭제' : '✕ 비우기'}</button>
      )}
      <button
        type="button"
        onClick={onOpenEditor}
        title="평가내용 전체를 LaTeX 편집기로 열어 수식·텍스트를 함께 편집합니다"
        style={{
          marginLeft: (onDelete || hasContent) ? 0 : 'auto',
          padding: '2px 8px',
          border: '1px solid #BFDBFE',
          background: '#EFF6FF',
          color: '#1D4ED8',
          borderRadius: 4,
          fontSize: 'var(--neo-font-size-sm)',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >∑ 수식</button>
    </div>
  );
};

// ============================================================
// [v2.16] 수식 입력 모달 — 평가내용 통합 편집기
//   - 평가내용 전체(텍스트 + $$LaTeX$$ 마커)를 통째로 로드
//   - 텍스트와 수식을 LaTeX 형식 하나의 textarea로 편집
//   - 미리보기 영역에 텍스트+수식 chip 통합 렌더
//   상단: 카테고리 툴바 (분수·제곱근·적분·시그마·sin·lim·괄호·행렬)
//   중앙: 큰 미리보기 영역 (텍스트 + 수식 chip)
//   하단: 평가내용 통합 입력 영역 (텍스트 + $$LaTeX$$ 마커)
//   푸터: [취소] [입력]
// ============================================================
const FormulaModal = ({ initialLatex, onCancel, onConfirm }) => {
  const [latex, setLatex] = React.useState(initialLatex || '');
  // 툴바 카테고리 → 클릭 시 마커 형식으로 템플릿 삽입 (텍스트와 구분)
  const insertTemplate = (tpl) => {
    setLatex((prev) => prev ? `${prev} $$${tpl}$$` : `$$${tpl}$$`);
  };
  // 미리보기용 파싱
  const previewParts = React.useMemo(() => {
    if (!latex) return [];
    const parts = [];
    let i = 0;
    latex.replace(/\$\$([^$]+)\$\$/g, (match, lx, offset) => {
      if (offset > i) parts.push({ type: 'text', value: latex.slice(i, offset) });
      parts.push({ type: 'formula', latex: lx });
      i = offset + match.length;
      return match;
    });
    if (i < latex.length) parts.push({ type: 'text', value: latex.slice(i) });
    return parts;
  }, [latex]);
  const toolbarBtnStyle = {
    padding: '6px 10px',
    border: '1px solid #E2E8F0',
    background: 'white',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 'var(--neo-font-size-sm)',
    color: '#475569',
    fontWeight: 600,
    fontFamily: 'inherit',
  };
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 720, maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ flex: 1 }} />
          <h2 style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 800, margin: 0, color: '#1E293B' }}>수식 입력</h2>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--neo-font-size-xl)', color: '#94A3B8' }}>✕</button>
          </div>
        </div>
        {/* 툴바 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 22px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('+ - × ÷ ▲')} title="사칙연산">+−×÷ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('{a} OVER {b} ▲')} title="분수">{'{}—{} ▲'}</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('SQRT{ } ▲')} title="제곱근">√▢ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('INT_{ }^{ } ▲')} title="적분">∫▢ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('SUM_{ }^{ } ▲')} title="시그마">∑▢ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('sin{ } ▲')} title="삼각함수">sin▢ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('lim_{ } ▲')} title="극한">lim▢ ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('({ }) ▲')} title="괄호">(▢) ▲</button>
          <button style={toolbarBtnStyle} onClick={() => insertTemplate('MATRIX{ } ▲')} title="행렬">▢▢ ▲</button>
        </div>
        {/* 큰 미리보기 영역 — 평가내용 전체(텍스트 + 수식 chip) 렌더 */}
        <div style={{ flex: 1, minHeight: 200, padding: '24px', background: 'white', borderBottom: '1px solid #E2E8F0', overflowY: 'auto' }}>
          {previewParts.length > 0 ? (
            <div style={{ fontSize: 'var(--neo-font-size-base)', color: '#1E293B', lineHeight: 1.8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              {previewParts.map((p, pi) => p.type === 'text' ? (
                <span key={pi} style={{ whiteSpace: 'pre-wrap' }}>{p.value}</span>
              ) : (
                <span key={pi} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, fontFamily: 'Cambria Math, Latin Modern Math, serif', fontSize: 'var(--neo-font-size-lg)', color: '#1D4ED8' }}>📐 {p.latex}</span>
              ))}
            </div>
          ) : (
            <div style={{ color: '#CBD5E1', fontSize: 'var(--neo-font-size-sm)', textAlign: 'center', marginTop: '60px' }}>아래 입력 영역에 평가내용을 작성하면 여기에 미리보기가 표시됩니다.</div>
          )}
        </div>
        {/* 하단 평가내용 통합 입력 영역 (텍스트 + $$LaTeX$$ 마커) */}
        <div style={{ padding: '12px 22px', background: '#F8FAFC' }}>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', marginBottom: 6 }}>
            💡 텍스트와 수식을 함께 입력할 수 있습니다. 수식은 <code style={{ background: 'white', padding: '1px 6px', borderRadius: 3, border: '1px solid #E2E8F0', fontFamily: 'monospace' }}>$$LaTeX$$</code> 형식으로 감쌉니다. 툴바 버튼은 마커를 자동 삽입합니다.
          </div>
          <textarea
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder="예: 학생의 답안이 $$ {a} OVER {b} $$ 형태로 정확히 표현된 경우 만점"
            style={{
              width: '100%', minHeight: 100,
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              fontSize: 'var(--neo-font-size-sm)',
              fontFamily: 'Courier New, monospace',
              resize: 'vertical',
              boxSizing: 'border-box',
              background: 'white',
              lineHeight: 1.6,
            }}
          />
        </div>
        {/* 푸터 */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 22px', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', color: '#475569', fontWeight: 700, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer' }}>취소</button>
          <button onClick={() => onConfirm(latex)} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 8, background: '#2A75F3', color: 'white', fontWeight: 800, fontSize: 'var(--neo-font-size-base)', cursor: 'pointer' }}>입력</button>
        </div>
      </div>
    </div>
  );
};

export default TaskDirectInputWizard;
