/**
 * answerGrading — 정답형 문제집 · 낱말 문제집 자동 채점 (TSK-15 · SCR 후속, 로컬 프로토)
 *
 * 채점 흐름은 서·논술과 같다(미채점 → 채점 확인 → 결과 발송). 다른 것은 채점기:
 *   · 자동 채점 = 학생 답(스캔 OCR · 펜 인식)을 정답과 「대조」 — AI 판단이 아니다
 *   · 결과 = 맞힌 수 · 점수, 인식이 애매하거나 정답이 없는 문항은 「확인 필요」 → 교사가 O/X로 정한다
 * 프로토: 학생 답은 모의로 만든다(실제 스캔 OCR · Ncode 펜 인식은 다음 단계).
 */
import { answerText, hasAnswer } from './itemBank';
import { blankOf } from '../WordWorkbook';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
const NAMES = ['김하늘', '이서준', '박지우', '최민서', '정예준', '강서연', '조하준', '윤지민', '장도윤', '임수아', '한시우', '오지호', '서유나', '신은우', '권하린', '황지안', '안로운', '송다온', '류시아', '전이준', '홍채원', '고서윤', '문건우', '양하율', '손지아', '배도현', '백나윤', '허준서', '유이서', '남주원'];

// 결정적 난수 — 같은 학생 · 같은 문항이면 늘 같은 모의 답
const rand = (seed) => { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

const norm = (t) => String(t ?? '').toLowerCase().replace(/[\s.,!?'"·]/g, '');

/** 문제집 → 채점 문항 [{ key, no, prompt, correct(표시), accept[](맞는 답들), points, kind }] */
export const gradingQuestionsOf = (wb, itemsById = {}) => {
  if (wb.kind === 'word') {
    const words = (wb.words || []).filter((w) => w.word.trim());
    return words.map((w, i) => {
      const dict = wb.mode === 'dictation';
      const blankSide = dict ? 'word' : blankOf(w, wb.mode, (wb.words || []).indexOf(w)); // 시험지(WordSheet)와 같은 빈칸
      const answer = blankSide === 'word' ? w.word : w.meaning;
      return {
        key: w.id, no: i + 1, kind: 'word',
        prompt: dict ? '(불러 준 낱말)' : (blankSide === 'word' ? w.meaning : w.word),
        correct: answer, accept: String(answer || '').split(',').map((x) => x.trim()).filter(Boolean), points: 1,
      };
    });
  }
  // 맞는 답 목록 — 단답형은 인정 답 여러 개, 연결형은 「왼쪽-오른쪽」 쌍만
  const acceptOf = (it) => {
    if (!hasAnswer(it)) return [];
    if (it.itemType === 'short_answer') return (it.answer?.texts || []).map((t) => String(t).trim()).filter(Boolean);
    if (it.itemType === 'matching') return [(it.answer?.pairs || []).map(([l, r]) => `${l}-${r}`).join(', ')];
    return [answerText(it)];
  };
  return (wb.itemIds || []).map((id) => itemsById[id]).filter(Boolean).map((it, i) => ({
    key: it.id, no: i + 1, kind: it.itemType,
    prompt: it.stem || '(발문 없음)',
    correct: acceptOf(it).join(' / '),
    accept: acceptOf(it),
    points: Number(wb.points?.[it.id] ?? it.points ?? 1) || 0,
    choices: it.itemType === 'binary_choice' ? (it.choices || []).map((c) => c.text) : null,
    manual: it.itemType === 'essay' || !hasAnswer(it), // 서술형 · 정답 없음 → 교사가 정한다
  }));
};

// 틀린 모의 답
const wrongOf = (q, r) => {
  const c = String(q.correct || '');
  if (q.kind === 'multiple_choice') { const n = CIRCLED.indexOf(c[0]) + 1 || 1; return CIRCLED[(n + Math.floor(r * 3)) % 5]; }
  if (q.kind === 'true_false') return c.includes('O') ? 'X' : 'O';
  if (q.kind === 'binary_choice' && q.choices?.length === 2) return q.choices.find((x) => x !== c) || q.choices[0];
  if (c.length > 2) return c.slice(0, -1) + (/[a-z]/i.test(c) ? 'e' : '이'); // 철자 · 글자 실수
  return /[a-z]/i.test(c) ? `${c}s` : '모름';
};

/** 모의 학생 답 — { [key]: { text, uncertain } } (정답률 약 80%, 인식 애매 약 8%) */
export const mockAnswersFor = (studentId, questions) => Object.fromEntries(questions.map((q) => {
  const r = rand(`${studentId}:${q.key}`);
  if (q.manual) return [q.key, { text: q.kind === 'essay' ? '(서술 답안)' : '(답 표기)', uncertain: false }];
  const right = r < 0.8;
  return [q.key, { text: right ? (q.accept[0] || q.correct) : wrongOf(q, rand(`${studentId}:${q.key}:w`)), uncertain: rand(`${studentId}:${q.key}:u`) < 0.08 }];
}));

/** 자동 채점 — { [key]: true | false | null(확인 필요) } */
export const autoGrade = (questions, answers) => Object.fromEntries(questions.map((q) => {
  const a = answers?.[q.key];
  if (!a || q.manual || a.uncertain || !q.accept.length) return [q.key, null];
  return [q.key, q.accept.some((x) => norm(x) === norm(a.text))];
}));

/** 결과 — 교사가 정한 O/X(overrides)를 자동 결과 위에 덮는다 */
export const scoreOf = (questions, auto = {}, overrides = {}) => {
  let correct = 0; let score = 0; let pending = 0;
  const total = questions.reduce((s, q) => s + q.points, 0);
  questions.forEach((q) => {
    const v = q.key in overrides ? overrides[q.key] : auto[q.key];
    if (v === true) { correct += 1; score += q.points; } else if (v == null) pending += 1;
  });
  return { correct, count: questions.length, score, total, pending };
};
export const scoreLabel = (r) => `${r.correct}/${r.count} · ${r.score}점${r.pending ? ` · 확인 필요 ${r.pending}` : ''}`;

/** 인쇄한 그룹 → 학생 명단(미채점) */
export const rosterOf = (groups) => groups.flatMap((g) => Array.from({ length: g.studentCount }).map((_, i) => ({
  id: `${g.id}-${i + 1}`, groupId: g.id, name: NAMES[(i + g.id * 7) % NAMES.length], grade: `${g.label} ${i + 1}번`,
  status: '미채점', submitType: null, answers: null, auto: null, overrides: {}, teacherEdited: false,
})));
