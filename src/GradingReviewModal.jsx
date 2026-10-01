/**
 * GradingReviewModal.jsx (SCR-03)
 * 채점 확인 상세 화면 — 교사 검토 진행중 / 결과 발송
 *
 * [v5.0 · 2026-09-21] 상용 화면 기준으로 재구성
 *   · 좌측: 문항 탭 → 채점 결과(AI/교사) → AI 재채점 → 채점 히스토리 → 하단 버튼  ([v5.10] AI 과정 분석 실행 카드 삭제)
 *   · 우측: 「피드백 보기」 「원본 보기」 「채점 근거」 세 탭 (상용의 「AI 과정 분석 결과 보기」 탭은 피드백 보기에 합친다)
 *   · 피드백 보기 = 등급평가 피드백(공통 영역) + 아래쪽 「AI 과정 분석」 전용 영역
 *       공통 영역: 등급 · 이런 점이 좋아요 · 조금만 더 노력해볼까요 · 함께 성장해요
 *   · [v5.2] 채점 근거 = 舊 피드백의 「내용 분석」을 떼어 낸 교사 전용 화면 — 채점 기준별 충족 여부 · 판단 이유 · 답안 원문 인용
 *         — 과정 분석이 끝나면 [과제 수행](등급평가) / [학습 태도](과정 분석) 줄이 같은 칸에 함께 실린다
 *       전용 영역: 진단된 학습 행동 패턴(캐릭터) · 총평  ([v5.8] 학습 행동 밀착 가이드 삭제)
 *         — 펜 데이터가 부족하면(80획 미만 또는 필기 30초 미만) 진단 대신 안내 문구만 보인다
 */
import React, { useState, useEffect, useMemo } from 'react';
import { lookupPattern } from './handwritingPatternMatrix';
import { formatResult, gradeToPoints, scoreToGrade } from './lib/gradingShared'; // [TSK v3.82] 과제의 채점 결과 표기(등급/점수)

const ANSWER_SHEET_IMG = `${import.meta.env.BASE_URL}images/answer-sheet-sample.png`;

/* ── 학습 행동 패턴(3축 코드) 캐릭터 ──
 *   27개 유형마다 캐릭터가 한 장씩 붙는다. 학생 리포트(결과 발송·내보내기)에 같은 캐릭터가 실리므로
 *   교사 화면에서도 리포트에 보일 모습 그대로 보여 준다. 그림이 없는 코드는 코드 배지로 폴백한다. */
/* 27개 전부 — 「아이글 27가지 학습 행동 유형별 캐릭터」(2026-08-26) pptx 에서 추출. 파일명 = 3축 코드 */
export const PATTERN_CHARACTERS = Object.fromEntries(
    ['aaa', 'aab', 'aac', 'aba', 'abb', 'abc', 'aca', 'acb', 'acc', 'baa', 'bab', 'bac', 'bba', 'bbb', 'bbc', 'bca', 'bcb', 'bcc', 'caa', 'cab', 'cac', 'cba', 'cbb', 'cbc', 'cca', 'ccb', 'ccc']
        .map((code) => [code, `${import.meta.env.BASE_URL}images/patterns/${code}.png`])
);
/* "Time-c, Coord-b, Hesit-a" → "cba" */
export const patternCodeOf = (metricsCode = '') => {
    const m = /Time-([abc]).*Coord-([abc]).*Hesit-([abc])/i.exec(metricsCode);
    return m ? (m[1] + m[2] + m[3]).toLowerCase() : null;
};
const AXIS_LABEL = {
    time: { a: '빠른 속도', b: '보통 속도', c: '신중한 속도' },
    coord: { a: '순차 진행', b: '되돌아가며 보완', c: '자주 고쳐 씀' },
    hesit: { a: '머뭇거림 없음', b: '가끔 머뭇거림', c: '잦은 머뭇거림' },
};
const axisChips = (code) => code ? [AXIS_LABEL.time[code[0]], AXIS_LABEL.coord[code[1]], AXIS_LABEL.hesit[code[2]]].filter(Boolean) : [];

/* 펜 데이터로 과정을 평가하기 위한 최소 조건 — 둘 중 하나라도 못 미치면 「분석불가-필기부족」 */
export const PROCESS_MIN_STROKES = 80;
export const PROCESS_MIN_DURATION_SEC = 30;
export const PROCESS_INSUFFICIENT_MESSAGE =
    '작성된 분량이 많지 않아 학습 행동을 자세히 살펴보기는 어려웠지만, 문제에 도전한 태도 자체를 응원해요. 다음에는 풀이 과정을 한 줄이라도 더 적어보면 더 풍부한 분석이 가능해질 거예요.';
export const isPenDataInsufficient = (penStats) =>
    !!penStats && (penStats.strokes < PROCESS_MIN_STROKES || penStats.durationSec < PROCESS_MIN_DURATION_SEC);

/* 등급평가 피드백 샘플 — 등급별. (프로토타입 고정 문안, 실제는 AI 응답) */
const GRADE_FEEDBACK = {
    '우수': {
        letter: 'B', scale: '5단계 기준',
        good: "문제 상황을 분석하여 '10000 - 720a'라는 핵심적인 관계식을 도출해낸 점과, 미지수 a의 의미를 문장으로 명확히 정의한 점이 우수합니다.",
        effort: "문제에서 요구한 것은 '일차방정식'이므로, 구한 식을 현재 잔액인 4240원과 등호(=)로 연결하여 '10000 - 720a = 4240'과 같은 형태로 완성하는 연습이 필요합니다.",
        grow: "식의 의미를 설명하는 논리적인 서술 능력이 좋습니다. 방정식의 정의인 '등식'의 형태만 갖춘다면 완벽한 답안이 될 것입니다.",
        analysis: [
            { k: 'A', title: '지식 이해 및 통합 적용', body: '일차방정식의 구성 요소인 항의 설정과 뺄셈 관계는 정확히 이해하고 있으나, 등식(=4240)을 완성하여 방정식을 풀이하는 단계까지 나아가지 못해 등식의 성질이나 이항 원리 적용 여부를 판단할 수 없습니다.' },
            { k: 'B', title: '과정·기능 및 탐구 수행', body: "문장제 상황에서 미지수 a를 이용해 잔액에 대한 식을 세우는 과정은 수행했으나, 문제에서 요구한 '일차방정식(등식)'을 완성하지 못하고 다항식 형태로 마무리했습니다." },
            { k: 'C', title: '논리적 구성 및 표현력', body: '미지수 설정에 대한 언급이 포함되어 있고 풀이 과정을 논리적인 문장으로 기술하였으나, 최종 결과가 방정식이 아닌 식의 형태로 제시되었습니다.' },
            { k: 'D', title: '가치·태도 및 성찰', body: '미지수 a의 의미를 명시하고 잔액이 산출되는 사고 과정을 텍스트로 설명하였으며, 특히 (a ≠ 8)과 같은 조건 확인에 대한 성찰적 언급이 나타나므로 2가지 이상의 요소가 충족됩니다.' },
        ],
        /* [v5.2] 채점 근거 — 교사에게만 보인다 (학생 리포트에 싣지 않는다) */
        basis: {
            criterion: '문장제 상황에서 미지수를 정하고, 수량 사이의 관계를 일차방정식으로 나타내어 그 과정을 논리적으로 설명했는가?',
            summary: "미지수 a의 의미를 밝히고 잔액을 나타내는 식 '10000 − 720a'를 세웠으나, 실제 잔액 4240원과 등호로 연결하지 않아 방정식을 완성하지 못했습니다.",
            rows: [
                { status: '충족', req: '미지수 설정 및 의미 제시', reason: '지하철 이용 횟수를 a로 두고, a가 무엇을 뜻하는지 문장으로 밝혔습니다.', quote: '지하철을 이용한 횟수를 a라고 하면 1번 탈 때마다 720원씩 나간다.' },
                { status: '충족', req: '수량 관계를 식으로 표현', reason: '1회 요금과 이용 횟수의 곱으로 사용 요금을 나타내고, 충전 금액에서 빼는 순서를 지켰습니다.', quote: '사용한 요금은 720a원이고 남은 돈은 10000-720a원이다.' },
                { status: '미충족', req: '등식(방정식) 완성', reason: '실제 잔액 4240원을 등호로 연결하지 않아 방정식이 아닌 식의 형태로 끝났습니다.', quote: '따라서 답은 10000-720a 이다.' },
                { status: '부분 충족', req: '조건 확인 및 성찰', reason: '(a ≠ 8)처럼 조건을 확인하려는 시도는 있으나, 왜 그 조건이 필요한지 근거 설명이 부족합니다.', quote: '(a≠8) 인지 [판독불가] 확인해 보았다.' },
            ],
            notUpper: '핵심 채점 기준인 「등식(방정식) 완성」이 미충족이라 A(매우 우수) 기준에 이르지 못했습니다.',
            notLower: '미지수 설정과 수량 관계 표현이 정확하고 풀이 과정을 논리적으로 설명해 C(보통) 기준(채점 기준 2개 이하 충족)을 넘습니다.',
            unreadable: true,
        },
        guide: {
            title: '문장제 상황을 일차방정식으로 나타내기',
            points: [
                '문제에 주어진 수를 그대로 옮기기 전에, 무엇이 «변하는 값»이고 무엇이 «정해진 값»인지 먼저 갈라 봐요.',
                '「남은 값 = 처음 값 − 쓴 값」처럼 관계를 말로 먼저 세운 뒤, 그 말을 식으로 바꾸어 적어요.',
                '마지막에 등호(=)가 들어갔는지 확인해요. 등호가 없으면 방정식이 아니라 식입니다.',
            ],
            items: [
                {
                    ask: '이용 횟수를 미지수로 두고, 사용한 요금 전체를 하나의 식으로 바꾸어 써 봐요.',
                    written: '"720 × a"',
                    whenTo: '1회 요금과 이용 횟수의 관계를 식으로 나타낼 때',
                    example: '청소년 1회 요금이 720원이고 a회 이용했으므로 사용한 요금은 720a원이다.',
                    tip: '곱셈 기호를 생략해 720a로 쓰면 이후 계산에서 항을 다루기 쉬워져요.',
                    check: '미지수 a가 «이용 횟수»를 뜻한다는 것을 문장으로 밝혔는지 확인해요.',
                },
                {
                    ask: '충전 금액에서 사용한 요금을 뺀 잔액을 식으로 바꾸어 써 봐요.',
                    written: '"10000 - 720a"',
                    whenTo: '처음 금액에서 쓴 금액을 빼는 관계를 나타낼 때',
                    example: '처음 충전 금액 10000원에서 사용한 요금 720a원을 빼면 남은 잔액은 10000 − 720a원이다.',
                    tip: '뺄셈의 순서가 바뀌면 값의 의미도 달라지니 «처음 − 사용»의 차례를 지켜요.',
                    check: '식이 «남은 잔액»을 뜻한다는 것이 드러났는지 확인해요.',
                },
                {
                    ask: '앞에서 세운 잔액 식과 실제 남은 잔액을 등호로 연결해 방정식을 완성해 봐요.',
                    written: '"10000 - 720a"',
                    whenTo: '구한 식과 문제에 주어진 값이 같음을 나타낼 때',
                    example: '남은 잔액이 4240원이므로 10000 − 720a = 4240이라는 일차방정식이 된다.',
                    tip: '등호를 넣어야 «방정식»이 되고, 그래야 a의 값을 구할 수 있어요.',
                    check: '문제에서 요구한 것이 식이 아니라 방정식이었는지 다시 읽어 확인해요.',
                },
            ],
        },
    },
    '노력': {
        letter: 'C', scale: '3단계 기준',
        good: '답안란에 무엇인가를 작성하여 제출하려는 시도를 하였습니다.',
        effort: '유리함수가 직선이 되기 위한 조건(분모가 상수가 되거나 분자와 분모가 약분되는 경우)을 학습하고, 문제의 의도에 맞는 답을 작성하는 연습이 필요합니다.',
        grow: '수학적 개념을 기초부터 차근차근 익히면 충분히 해결할 수 있는 문제입니다. 포기하지 말고 다시 한번 도전해 보세요.',
        analysis: [
            { k: 'A', title: '지식 이해 및 통합 적용', body: '유리함수의 정의나 성질에 대한 이해를 전혀 보여주지 못하며, 문항의 요구사항과 무관한 단순 산술식을 기재하였다. 따라서 기초 개념 이해가 불완전한 것으로 판단된다.' },
            { k: 'B', title: '과정·기능 및 탐구 수행', body: '상수 a를 구하는 과정이나 그래프를 그리는 등의 탐구 수행이 전혀 이루어지지 않았다. 문제 해결을 위한 기능 수행이 미흡하여 최하 수준에 해당한다.' },
            { k: 'C', title: '가치·태도 및 성찰', body: '유리함수 학습에 대한 흥미나 그래프를 통한 시각적 분석의 유용성을 인식하는 태도를 답안에서 전혀 찾아볼 수 없다.' },
        ],
        basis: {
            criterion: '유리함수의 그래프가 직선이 되는 조건을 찾아 상수 a의 값을 구하고, 그 과정을 근거와 함께 설명했는가?',
            summary: '문항의 요구와 이어지지 않는 단순 산술식만 적혀 있어, 유리함수의 성질이나 상수 a를 구하는 과정이 드러나지 않습니다.',
            rows: [
                { status: '미충족', req: '직선이 되는 조건 제시', reason: '분모가 상수가 되거나 분자·분모가 약분되는 조건에 대한 언급이 없습니다.', quote: '3 + 5 = 8' },
                { status: '미충족', req: '상수 a의 값 구하기', reason: '조건을 식으로 옮겨 a를 구하는 과정이 없습니다.', quote: '(관련 내용 없음)' },
                { status: '미충족', req: '검산 및 설명', reason: '구한 값을 원래 식에 넣어 확인하거나 근거를 설명한 부분이 없습니다.', quote: '(관련 내용 없음)' },
            ],
            notUpper: '세 채점 기준 모두 미충족이라 C(보통) 이상의 기준에 이르지 못했습니다.',
            notLower: '해당 없음 (최하위 수준).',
            unreadable: false,
        },
        guide: {
            title: '유리함수가 직선이 되는 조건 찾기',
            points: [
                '문제가 무엇을 구하라고 했는지 한 문장으로 다시 적어 보고 시작해요.',
                '유리함수는 분모가 상수가 되거나 분자·분모가 약분될 때 직선이 된다는 점을 떠올려요.',
                '구한 값을 원래 식에 다시 넣어, 정말 직선이 되는지 확인해요.',
            ],
            items: [
                {
                    ask: '문제에서 구해야 하는 것이 무엇인지 먼저 적어 봐요.',
                    written: '(작성한 내용이 문항의 요구와 이어지지 않았어요)',
                    whenTo: '문제의 요구 사항을 자기 말로 바꾸어 적을 때',
                    example: '이 문제는 주어진 유리함수의 그래프가 직선이 되도록 하는 상수 a의 값을 구하는 문제이다.',
                    tip: '무엇을 구하는지 먼저 적어 두면 중간에 길을 잃지 않아요.',
                    check: '답안이 문항이 요구한 «상수 a»에 대한 것인지 확인해요.',
                },
                {
                    ask: '유리함수가 직선이 되려면 어떤 조건이 필요한지 써 봐요.',
                    written: '(조건에 대한 언급이 없었어요)',
                    whenTo: '유리함수의 성질을 근거로 조건을 세울 때',
                    example: '분자와 분모가 약분되어 분모에 x가 남지 않으면 그래프는 직선이 된다.',
                    tip: '조건을 먼저 세워 두면 어떤 값을 구해야 하는지가 분명해져요.',
                    check: '직선이 되는 조건을 근거와 함께 밝혔는지 확인해요.',
                },
                {
                    ask: '세운 조건을 이용해 상수 a의 값을 구하고, 원래 식에 넣어 확인해 봐요.',
                    written: '(값을 구하는 과정이 없었어요)',
                    whenTo: '조건을 식으로 옮겨 값을 구할 때',
                    example: '약분이 되도록 분자와 분모의 인수를 맞추면 a의 값을 구할 수 있고, 그 값을 넣으면 실제로 직선이 됨을 확인할 수 있다.',
                    tip: '구한 값을 다시 넣어 확인하는 습관이 실수를 줄여 줘요.',
                    check: '구한 a의 값이 실제로 직선을 만드는지 검산했는지 확인해요.',
                },
            ],
        },
    },
};
const GRADE_LETTER = { '매우우수': 'A', '매우 우수': 'A', '우수': 'B', '보통': 'C', '노력': 'D', '매우 노력': 'E' };
const gradeFeedbackOf = (grade) => {
    const base = GRADE_FEEDBACK[grade] || GRADE_FEEDBACK['우수'];
    return { ...base, label: grade || '우수', letter: GRADE_FEEDBACK[grade] ? base.letter : (GRADE_LETTER[grade] || base.letter) };
};

/* 과정 분석 결과 샘플 — 학습 행동 밀착 가이드(문제 해석·접근 방법)는 문항 단위 고정 문안. 단계별 풀이(steps)는 화면에 싣지 않는다 */
export const PROCESS_GUIDE_SAMPLE = {
    interpretation: '지문에 제시된 교통카드 충전 금액, 청소년 지하철 요금, 그리고 현재 남은 잔액의 관계를 파악하여 변수 a를 포함한 일차방정식을 세워야 합니다.',
    approach: "'남은 잔액 = 충전 금액 - (지하철 요금 × 이용 횟수)'라는 기본 원리를 이용하되, 지문에 제시된 실제 잔액 수치를 등식의 우변에 배치하여 방정식을 완성해야 합니다.",
    steps: [
        '지문에서 필요한 정보를 추출합니다. 초기 충전 금액은 10000원, 청소년 1회 이용 요금은 720원, 현재 남은 잔액은 4240원임을 확인해야 합니다.',
        '이용 횟수를 a라고 할 때, 총 이용 요금을 a에 관한 식으로 나타냅니다. 1회에 720원이므로 a회 이용 시 요금은 720a가 됨을 명시해야 합니다.',
        "충전 금액에서 총 이용 요금을 뺀 '잔액 식'을 세웁니다. 10000에서 720a를 뺀 10000-720a를 작성해야 합니다.",
        '위에서 세운 식과 지문에 나온 실제 잔액 4240원이 같음을 등호로 연결하여 10000-720a=4240이라는 최종 방정식을 완성해야 합니다.',
    ],
};
export const PROCESS_RESULT_SAMPLE = {
    patternCode: 'cba',
    systemDataLog: { processPattern: '심사숙고 확신형', metricsCode: 'Time-c, Coord-b, Hesit-a', gradeLevel: 'B' },
    evaluationSummary: {
        diagnosedPattern: '심사숙고 확신형',
        totalEvaluation: "확정 등급 B를 받은 이번 답안은 문항이 요구한 '일차방정식'의 형태를 갖추는 데 있어 핵심적인 수치 하나를 놓친 아쉬움이 있습니다. '심사숙고 확신형' 패턴답게 충분히 생각한 뒤 식을 세우고, 한 번 되돌아가 보완한 뒤에는 머뭇거림 없이 단단하게 마무리했으나, 지문에 명시된 현재 잔액(4240원)을 등식의 결과로 연결하지 못하고 단순한 식의 표현에 그쳤습니다. 풀이 중간에 발생한 장시간의 정지는 전체적인 식의 구조를 잡는 과정에서의 고민으로 보이며, 논리적 흐름은 우수하나 문제의 최종 목표인 '방정식' 완성에는 도달하지 못한 상태입니다.",
    },
    finalFeedback: {
        whatsGood: '풀이 과정에서 단 한 번의 수정이나 되돌아감 없이 순차적으로 사고를 전개하였으며, 각 단계마다 언어적 설명을 덧붙여 논리적 근거를 명확히 밝히며 풀이하는 신중함이 돋보입니다.',
        whatNeedsWork: '지문 속에 제시된 구체적인 수치(예: 현재 잔액 4240원)가 문제 해결의 결정적인 단서가 됨을 인지하고, 이를 식의 구성 요소로 빠짐없이 활용하는 꼼꼼한 지문 분석 습관이 필요합니다.',
        letsGrowTogether: "지하철 이용 횟수에 따른 잔액의 변화를 '10000-720a'라는 멋진 식으로 아주 잘 표현해주었어요. 다만, 문제에서 '일차방정식'을 세우라고 했을 때는 이 식이 어떤 결과값과 같은지를 보여주는 등호가 꼭 필요합니다. 논리적으로 식을 세우는 힘이 충분하니, 다음에는 문제의 목표가 '식'인지 '방정식'인지 한 번 더 확인해보는 여유를 가져봅시다.",
        contentBottleneckAnalysis: '',
    },
    guide: PROCESS_GUIDE_SAMPLE,
};

/* 등급 색상 */
const gradeColorMap = { '매우우수': '#10B981', '매우 우수': '#10B981', '우수': '#2A75F3', '보통': '#F59E0B', '노력': '#EF4444', '매우 노력': '#EF4444' };

/* ── 공통 스타일 ── */
const T = {
    text: 'var(--neo-text-default, #111111)', sub: 'var(--neo-grey-dark, #64748b)', muted: 'var(--neo-grey-base, #94a3b8)',
    line: 'var(--neo-grey-light, #cbd5e1)', lineSoft: 'var(--neo-grey-lighter, #e2e8f0)', surface: 'var(--neo-grey-lightest, #f1f5f9)',
    rLg: 'var(--neo-radius-lg, 8px)', rXl: 'var(--neo-radius-xl, 12px)', r2xl: 'var(--neo-radius-2xl, 16px)', rFull: 'var(--neo-radius-full, 9999px)',
};
const card = { background: 'white', borderRadius: T.rXl, border: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', minHeight: 0 };
const secTitle = { fontSize: 'var(--neo-font-size-base)', fontWeight: 600, color: T.text, marginBottom: 8 };
const hint = { fontSize: 'var(--neo-font-size-sm)', color: T.sub, lineHeight: 1.6 };
const fbTitle = (color) => ({ fontSize: 'var(--neo-font-size-base)', fontWeight: 600, color, margin: '18px 0 8px' });
const fbBox = { width: '100%', boxSizing: 'border-box', border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: '12px 14px', fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7, background: 'white', fontFamily: 'inherit', resize: 'vertical', minHeight: 64, fieldSizing: 'content', outline: 'none' };
/* field-sizing 미지원 브라우저용 — 글자 수·줄 수로 rows 추정 */
const rowsFor = (t) => Math.max(2, t.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 60)), 0));
const pill = (bg, color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: T.rFull, fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, background: bg, color });

const GradingReviewModal = ({
    isOpen,
    onClose,
    selectedStudent,
    onSelectStudent,
    students = [],
    questions,
    activeQuestion,
    setActiveQuestion,
    gradingHistory,
    reflectedHistoryId,
    setReflectedHistoryId,
    teacherFinalFeedback,
    setTeacherFinalFeedback,
    onReviewComplete,
    onResultSend,
    onResultSendCancel,
    onRevertToStep2,
    onRevertToUngraded,
    onHandwritingEvaluated,
    taskSubject,
    // [TSK v3.82] 과제의 채점 결과 표기 — 'grade' | 'score'. 점수면 등급 대신 n점을 보여 주고 교사도 점수를 입력한다
    resultMode = 'grade',
    maxPoints = 0,
    // [SCR-06] 퇴고 — 채점 관리 2(v2)에서만 전달된다. 미전달 시 관련 UI 전부 미노출
    isV2 = false,
    aiGradingLimitPerRound = 2,
    onRevisionRequest
}) => {
    const isProcessEvalSupported = taskSubject === '수학';
    const isStep3 = selectedStudent?.status === '결과 발송 전' || selectedStudent?.status === '결과 발송 완료';
    const isSent = selectedStudent?.status === '결과 발송 완료';
    const canRequestRevision =
        isV2 && isSent && (selectedStudent?.round ?? 1) === 1 && typeof onRevisionRequest === 'function';

    const [teacherGrade, setTeacherGrade] = useState('선택 안함');
    const isScoreMode = resultMode === 'score';
    const [teacherScore, setTeacherScore] = useState(''); // 점수 모드의 교사 채점 (0~maxPoints)
    /* [v5.3] 채점 기준별 교사 점수 { [문항 id]: [n | null, ...] }.
       [v5.6] 처음엔 비어 있다(「선택」) — 교사가 기준마다 직접 고른다. 한 번 고르면 「선택」으로 되돌릴 수 없다.
       저장 전 상태는 화면 메모리에만 있어 새로고침(F5)하면 다시 「선택」으로 돌아간다 */
    const [critPicks, setCritPicks] = useState({});
    const fmt = (grade, score) => formatResult(grade, { resultMode, maxPoints, score });
    const [rightTab, setRightTab] = useState('feedback'); // 'feedback' | 'basis' | 'original'
    const [isSaved, setIsSaved] = useState(false);

    // 원본 보기 — 재생·페이지·전체화면
    const [currentPage, setCurrentPage] = useState(1);
    const [isPlaybackMode, setIsPlaybackMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playbackProgress, setPlaybackProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const totalPages = 1;

    // [SCR-06] 퇴고 요청 확인 모달 (학생 단위)
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const nextSheetNo = selectedStudent?.sheetNo ? selectedStudent.sheetNo.replace(/^A-/, 'B-') : 'B-0000';
    const handleConfirmRevision = () => { setShowRevisionModal(false); onRevisionRequest(selectedStudent); };

    // [SCR-03] 미채점 단계 되돌리기 확인 모달
    const [showRevertModal, setShowRevertModal] = useState(false);
    const handleConfirmRevert = () => {
        setShowRevertModal(false);
        if (typeof onRevertToUngraded === 'function') onRevertToUngraded(selectedStudent);
        else { alert('미채점 단계로 되돌렸습니다. 채점 관리에서 스캔 업로드로 다시 채점할 수 있습니다.'); onClose(); }
    };

    useEffect(() => {
        if (!isFullscreen) return;
        const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isFullscreen]);

    useEffect(() => {
        if (!isPlaying) return;
        const duration = 3000 / playbackSpeed;
        const startTime = Date.now();
        const tick = setInterval(() => {
            const pct = Math.min(100, ((Date.now() - startTime) / duration) * 100);
            setPlaybackProgress(pct);
            if (pct >= 100) { setIsPlaying(false); clearInterval(tick); }
        }, 50);
        return () => clearInterval(tick);
    }, [isPlaying, playbackSpeed]);

    // 학생이 바뀌면 재생·탭·과정 분석 상태 초기화
    useEffect(() => {
        setIsPlaybackMode(false); setIsPlaying(false); setRightTab('feedback');
        setTeacherGrade(isStep3 && selectedStudent?.teacherGrade && selectedStudent.teacherGrade !== '-' ? selectedStudent.teacherGrade : '선택 안함');
        setTeacherScore(selectedStudent?.teacherScore ?? (isStep3 ? (gradeToPoints(selectedStudent?.teacherGrade, maxPoints) ?? '') : ''));
        setCritPicks(selectedStudent?.teacherCriteria || {});
    }, [selectedStudent?.id, isOpen]);

    /* ── 등급평가 피드백 (공통 영역) — 편집 가능 ── */
    const hw = selectedStudent?.handwritingEvaluation;
    const hwInsufficient = !!hw?.insufficient;
    const gradeFb = useMemo(() => gradeFeedbackOf(selectedStudent?.aiGrade), [selectedStudent?.aiGrade]);
    const buildDraft = () => {
        // 과정 분석이 끝나면(필기 충분) 같은 칸에 [과제 수행]=등급평가 / [학습 태도]=과정 분석 를 함께 싣는다
        if (hw && !hwInsufficient && hw.finalFeedback) {
            return {
                good: `[과제 수행] ${gradeFb.good}\n[학습 태도] ${hw.finalFeedback.whatsGood}`,
                effort: `[과제 수행] ${gradeFb.effort}\n[학습 태도] ${hw.finalFeedback.whatNeedsWork}`,
                grow: hw.finalFeedback.letsGrowTogether || gradeFb.grow,
            };
        }
        return { good: gradeFb.good, effort: gradeFb.effort, grow: gradeFb.grow };
    };
    const [draft, setDraft] = useState(buildDraft);
    useEffect(() => { setDraft(buildDraft()); setIsSaved(false); }, [selectedStudent?.id, activeQuestion, reflectedHistoryId, hw]);
    const charCount = draft.good.length + draft.effort.length + draft.grow.length;
    const editDraft = (key) => (e) => {
        const next = { ...draft, [key]: e.target.value };
        setDraft(next);
        setIsSaved(false);
        if (typeof setTeacherFinalFeedback === 'function') {
            setTeacherFinalFeedback(`이런 점이 좋아요\n${next.good}\n\n조금만 더 노력해볼까요\n${next.effort}\n\n함께 성장해요\n${next.grow}`);
        }
        clearTimeout(window._feedbackSaveTimer);
        window._feedbackSaveTimer = setTimeout(() => setIsSaved(true), 1000);
    };

    /* ── AI 과정 분석 — [v5.10] 별도 실행 없음 ──
       과정 분석은 AI 채점(등급평가)에 통합됐다. 수학 과제는 채점 결과에 과정 분석이 함께 딸려 오므로
       교사가 따로 [AI 과정 분석 시작]을 누르지 않는다. 프로토타입은 상세를 열 때 결과를 붙여 흉내 낸다. */
    useEffect(() => {
        if (!isOpen || !isProcessEvalSupported || !selectedStudent || selectedStudent.handwritingEvaluation) return;
        const insufficient = isPenDataInsufficient(selectedStudent.penStats);
        const result = insufficient
            ? { insufficient: true, message: PROCESS_INSUFFICIENT_MESSAGE, penStats: selectedStudent.penStats,
                systemDataLog: { processPattern: '분석불가-필기부족', metricsCode: '-', gradeLevel: '-' },
                evaluationSummary: { diagnosedPattern: '분석불가-필기부족', totalEvaluation: PROCESS_INSUFFICIENT_MESSAGE },
                finalFeedback: { whatsGood: '', whatNeedsWork: '', letsGrowTogether: '', contentBottleneckAnalysis: '' } }
            : { ...PROCESS_RESULT_SAMPLE, systemDataLog: { ...PROCESS_RESULT_SAMPLE.systemDataLog, gradeLevel: gradeFb.letter } };
        if (onHandwritingEvaluated) onHandwritingEvaluated(selectedStudent.id, result);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedStudent?.id, isProcessEvalSupported]);

    // 학생 네비게이션
    const currentIndex = students.findIndex(s => s.id === selectedStudent?.id);
    const handlePrev = () => { if (currentIndex > 0) onSelectStudent(students[currentIndex - 1]); };
    const handleNext = () => { if (currentIndex < students.length - 1) onSelectStudent(students[currentIndex + 1]); };

    if (!isOpen) return null;

    const activeQ = questions.find(q => q.id === activeQuestion) || questions[0];
    const qLabel = `문항 ${activeQ?.id ?? 1}`;
    const headerNote = isStep3
        ? (isSent ? '학생에게 결과가 발송되었습니다. 취소하려면 [결과발송 취소]를 눌러주세요.' : '완료된 채점 결과를 학생에게 발송합니다.')
        : 'AI 채점 결과는 완벽하지 않을 수 있습니다. 점수 확정 전 선생님께서 내용을 확인해주세요.';
    const reflected = gradingHistory.find(h => h.id === reflectedHistoryId);
    const aiGradeDisplay = isScoreMode
        ? `${fmt(selectedStudent?.aiGrade || reflected?.level || '우수', selectedStudent?.aiScore)} / ${maxPoints}점`
        : (selectedStudent?.aiGradeDisplay || `${selectedStudent?.aiGrade || reflected?.level || '우수'} (${gradeFb.scale.replace(' 기준', '')})`);
    const aiPoints = selectedStudent?.aiScore ?? gradeToPoints(selectedStudent?.aiGrade || reflected?.level || '우수', maxPoints);

    /* [v5.3] 점수 모드 — 문항 배점을 채점 기준마다 나눠 기준별로 AI·교사 점수를 매긴다.
       AI 점수는 채점 근거의 판단(충족=만점 · 부분 충족=절반 · 미충족=0)에서 나온다 */
    const criteriaOf = (q) => {
        const rows = gradeFb.basis?.rows || [];
        const qMax = Number(q?.score) || 0;
        if (!rows.length || !qMax) return [];
        const base = Math.floor(qMax / rows.length), extra = qMax - base * rows.length;
        return rows.map((r, i) => {
            const max = base + (i < extra ? 1 : 0);
            return { name: r.req, max, ai: r.status === '충족' ? max : r.status === '부분 충족' ? Math.floor(max / 2) : 0 };
        });
    };
    const picksOf = (q) => critPicks[q.id] || criteriaOf(q).map(() => null);
    const isPicked = (v) => v !== null && v !== undefined && v !== '';
    const sum = (a) => a.reduce((t, n) => t + (Number(n) || 0), 0);
    const activeCriteria = criteriaOf(activeQ);
    const activePicks = picksOf(activeQ);
    const activeMax = Number(activeQ?.score) || 0;
    const teacherTotalAll = sum(questions.map((q) => sum(picksOf(q))));
    const activeAllPicked = activePicks.every(isPicked);
    const shownTotal = activePicks.some(isPicked) ? sum(activePicks) : '–';

    /* ── 우측: 피드백 보기 (등급평가 공통 + 과정 분석 전용 영역) ── */
    const renderFeedback = () => (
        <div style={{ padding: '4px 20px 20px' }}>
            {/* [v5.11] 점수 - 등급 — 문항 점수(AI)와 등급을 한 줄에 함께 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 600, color: '#2A75F3', fontVariantNumeric: 'tabular-nums' }}>{activeCriteria.length ? sum(activeCriteria.map((c) => c.ai)) : (aiPoints ?? '-')}점</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub }}>/ {activeCriteria.length ? activeMax : maxPoints}점</span>
                <span style={{ width: 1, height: 16, background: T.lineSoft }} />
                <span style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 600, color: gradeColorMap[gradeFb.label] || '#2A75F3' }}>{gradeFb.letter}</span>
                <span style={pill(gradeFb.label === '노력' || gradeFb.label === '매우 노력' ? '#FEE2E2' : '#DCFCE7', gradeFb.label === '노력' || gradeFb.label === '매우 노력' ? '#B91C1C' : '#15803D')}>{gradeFb.label}</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub }}>{gradeFb.scale}</span>
                {isSaved && <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-xs)', color: '#059669', fontWeight: 600 }}>✓ 저장됨</span>}
            </div>

            <div style={fbTitle('#65A30D')}>이런 점이 좋아요</div>
            <textarea style={fbBox} value={draft.good} onChange={editDraft('good')} readOnly={isStep3} rows={rowsFor(draft.good)} />
            <div style={fbTitle('#F97316')}>조금만 더 노력해볼까요</div>
            <textarea style={fbBox} value={draft.effort} onChange={editDraft('effort')} readOnly={isStep3} rows={rowsFor(draft.effort)} />
            <div style={fbTitle('#2563EB')}>함께 성장해요</div>
            <textarea style={fbBox} value={draft.grow} onChange={editDraft('grow')} readOnly={isStep3} rows={rowsFor(draft.grow)} />

            {/* [v5.2] 「내용 분석」은 [채점 근거] 탭으로 옮겼다 — 피드백(학생에게 가는 문장)에는 싣지 않는다 */}

            {/* ── 학습 안내 ──
                앞의 세 블록(좋아요·노력·성장)이 «무엇이 어땠는지»를 말한다면,
                여기는 «그래서 어떻게 고치면 되는지»를 문항의 요구 단위로 쪼개 보여준다.
                학생이 실제로 쓴 문장을 그대로 놓고 그 옆에 고친 예시를 붙여야
                교사가 「이 말을 이렇게 바꾸라」고 짚어줄 수 있다. */}
            {gradeFb.guide && (
                <div style={{ marginTop: 26 }}>
                    <div style={{ ...secTitle, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        학습 안내
                        <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 400, color: T.sub }}>고치기 전에 한 번 읽어 보세요</span>
                    </div>

                    {/* 과제 유형별 총괄 안내 */}
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: T.rLg, padding: '12px 16px', marginBottom: 16 }}>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#1D4ED8', marginBottom: 6 }}>{gradeFb.guide.title}</div>
                        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {gradeFb.guide.points.map((p, i) => (
                                <li key={i} style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7 }}>{p}</li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {gradeFb.guide.items.map((it, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                                    <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: '#2A75F3', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 600, color: T.text, lineHeight: 1.6 }}>{it.ask}</div>
                                </div>

                                <div style={{ paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {/* 학생이 실제로 쓴 문장 — 고칠 대상 */}
                                    <div style={{ background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: T.rLg, padding: '10px 14px' }}>
                                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: T.sub, marginBottom: 4 }}>학생이 작성한 내용</div>
                                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7 }}>{it.written}</div>
                                    </div>

                                    {/* 고친 예시 */}
                                    <div style={{ background: '#F5F9FF', border: '1px solid #DBEAFE', borderRadius: T.rLg, padding: '10px 14px' }}>
                                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#1D4ED8', fontWeight: 600, marginBottom: 6 }}>이렇게 해봐요</div>
                                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7, marginBottom: 8 }}>{it.whenTo}</div>
                                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.8 }}>{it.example}</div>
                                        {it.tip && (
                                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#2A75F3', lineHeight: 1.7, marginTop: 8 }}>{it.tip}</div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                        <span style={{ flex: 'none', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: T.sub }}>확인</span>
                                        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7 }}>{it.check}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── AI 필기 분석 — [v5.11] 피드백 맨 끝(학습 안내 다음). 모든 과제에 둔다.
                   분석 내용이 있으면 캐릭터 카드 + 총평, 없으면(미분석 · 필기 부족) 안내 문구 ── */}
            <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px dashed #CBD5E1' }}>
                <div style={{ ...secTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
                    AI 필기 분석
                    {hw && !hwInsufficient && <span style={pill('#ECFDF5', '#059669')}>완료</span>}
                </div>
                {(!hw || hwInsufficient) && (
                    <div style={{ padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: T.rLg }}>
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7 }}>{hw?.message || PROCESS_INSUFFICIENT_MESSAGE}</div>
                        {hw?.penStats && (
                            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: T.muted, marginTop: 4 }}>
                                획수 {hw.penStats.strokes}획 · 필기 {hw.penStats.durationSec}초 — 분석 기준 {PROCESS_MIN_STROKES}획 · {PROCESS_MIN_DURATION_SEC}초 이상
                            </div>
                        )}
                    </div>
                )}
                {hw && !hwInsufficient && (
                    <div style={{ padding: '14px 16px', background: T.surface, borderRadius: T.rLg }}>
                        {(() => {
                            const code = hw.patternCode || patternCodeOf(hw.systemDataLog?.metricsCode);
                            const name = hw.evaluationSummary?.diagnosedPattern || hw.systemDataLog?.processPattern || lookupPattern(code).name;
                            const img = code && PATTERN_CHARACTERS[code];
                            const brief = code ? lookupPattern(code).brief : '';
                            return (
                                /* 유형 캐릭터 카드 — 학생 리포트에 실리는 모습 그대로 */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', background: 'white', border: `1px solid ${T.lineSoft}`, borderRadius: T.rXl, marginBottom: 16 }}>
                                    {img ? (
                                        <img src={img} alt={name} style={{ width: 112, height: 112, objectFit: 'contain', flex: 'none' }} />
                                    ) : (
                                        <div style={{ width: 112, height: 112, flex: 'none', borderRadius: T.rXl, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--neo-font-size-xl)', fontWeight: 600, color: T.muted }}>{(code || '?').toUpperCase()}</div>
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: T.sub, marginBottom: 2 }}>진단된 학습 행동 패턴</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                            <span style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 600, color: T.text }}>{name}</span>
                                            {code && <span style={pill(T.surface, T.sub)}>{code.toUpperCase()} · {hw.systemDataLog?.metricsCode}</span>}
                                        </div>
                                        {brief && <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub, marginBottom: 8 }}>{brief}</div>}
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {axisChips(code).map((c) => (
                                                <span key={c} style={{ ...pill('#EFF6FF', '#1D4ED8'), padding: '3px 10px' }}>{c}</span>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 'var(--neo-font-size-xs)', color: T.muted, marginTop: 8 }}>이 캐릭터와 유형 이름은 학생에게 발송되는 리포트에 함께 표시됩니다.</div>
                                    </div>
                                </div>
                            );
                        })()}
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: T.text, marginBottom: 6 }}>총평</div>
                        {/* [v5.8] 과정 분석은 캐릭터 카드 + 총평만 — 등급평가와 통합돼 강점·개선은 피드백에, 舊 「학습 행동 밀착 가이드」는 싣지 않는다 */}
                        <div style={{ fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.75 }}>{hw.evaluationSummary?.totalEvaluation}</div>
                    </div>
                )}
            </div>

            <div style={{ textAlign: 'right', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, color: charCount > 1000 ? '#DC2626' : T.sub, marginTop: 16 }}>{charCount}/1000</div>
        </div>
    );

    /* ── 우측: 원본 보기 (필기 재생) ── */
    const renderOriginal = () => (
        <div style={{ padding: '4px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="pen-canvas-box" style={isFullscreen
                ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#0F172A', padding: 0 }
                : { flex: 1, height: 'auto', position: 'relative', minHeight: 520 }}>
                <div className="pen-toolbar" style={isFullscreen ? { position: 'absolute', top: 16, right: 16, zIndex: 10000 } : undefined}>
                    <div className="toolbar-btn">+</div>
                    <div className="toolbar-btn">−</div>
                    <div className="toolbar-btn" onClick={() => setIsFullscreen(v => !v)} title={isFullscreen ? '전체화면 해제 (ESC)' : '전체화면'}>{isFullscreen ? '✕' : '⛶'}</div>
                    <button className="toolbar-btn btn-playback" onClick={() => { setIsPlaybackMode(v => !v); setIsPlaying(false); setPlaybackProgress(0); }}>
                        {isPlaybackMode ? '이미지 보기' : '▶ 필기 재생'}
                    </button>
                </div>
                {!isFullscreen && <div className="page-indicator" style={{ background: T.text }}>{currentPage}/{totalPages}</div>}
                <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isFullscreen ? '3rem 2rem 8rem' : '3.5rem 2rem 4rem' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: isFullscreen ? 900 : 640 }}>
                        <img src={ANSWER_SHEET_IMG} alt="학생 답안 원본" style={{ width: '100%', border: '1px solid #E5E7EB', background: 'white', opacity: isPlaybackMode && !isPlaying ? 0.45 : 1 }} />
                        {isPlaybackMode && (
                            <button
                                onClick={() => { if (isPlaying) setIsPlaying(false); else { if (playbackProgress >= 100) setPlaybackProgress(0); setIsPlaying(true); } }}
                                aria-label={isPlaying ? '일시정지' : '재생'}
                                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 72, height: 72, borderRadius: '50%', background: 'rgba(42,117,243,0.95)', color: 'white', border: '2px solid rgba(255,255,255,0.4)', fontSize: '1.8rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', opacity: isPlaying ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isPlaying ? '⏸' : '▶'}
                            </button>
                        )}
                    </div>
                </div>

                {(isFullscreen || isPlaybackMode) && (
                    <div style={{ position: isFullscreen ? 'fixed' : 'absolute', bottom: isFullscreen ? 24 : 12, left: '50%', transform: 'translateX(-50%)', width: isFullscreen ? 'min(760px, 92vw)' : 'calc(100% - 40px)', maxWidth: 760, background: isFullscreen ? 'rgba(15,23,42,0.88)' : 'white', color: isFullscreen ? 'white' : T.text, border: isFullscreen ? '1px solid rgba(255,255,255,0.1)' : '1px solid #BFDBFE', borderRadius: T.rLg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: isFullscreen ? '0 8px 24px rgba(0,0,0,0.5)' : '0 2px 8px rgba(42,117,243,0.15)', zIndex: 10001 }}>
                        {isPlaybackMode && (<>
                            <button onClick={() => { if (isPlaying) setIsPlaying(false); else { if (playbackProgress >= 100) setPlaybackProgress(0); setIsPlaying(true); } }}
                                style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A75F3', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isPlaying ? '⏸' : '▶'}</button>
                            <div onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPlaybackProgress(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))); setIsPlaying(false); }}
                                style={{ flex: 1, height: 6, background: isFullscreen ? 'rgba(255,255,255,0.2)' : '#DBEAFE', borderRadius: 3, cursor: 'pointer' }}>
                                <div style={{ width: `${playbackProgress}%`, height: '100%', background: '#2A75F3', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, minWidth: 75, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                {(() => { const t = Math.round(3 / playbackSpeed); const c = Math.round((playbackProgress / 100) * t); const f = (s) => `00:${String(s).padStart(2, '0')}`; return `${f(c)} / ${f(t)}`; })()}
                            </span>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[0.5, 1, 2].map(sp => (
                                    <button key={sp} onClick={() => setPlaybackSpeed(sp)} style={{ padding: '3px 8px', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, borderRadius: 4, border: '1px solid', borderColor: playbackSpeed === sp ? '#2A75F3' : (isFullscreen ? 'rgba(255,255,255,0.25)' : T.lineSoft), background: playbackSpeed === sp ? '#2A75F3' : 'transparent', color: playbackSpeed === sp ? 'white' : (isFullscreen ? 'white' : T.sub), cursor: 'pointer' }}>{sp}x</button>
                                ))}
                            </div>
                        </>)}
                        {!isPlaybackMode && isFullscreen && (
                            <button onClick={() => { setIsPlaybackMode(true); setIsPlaying(false); setPlaybackProgress(0); }} style={{ padding: '6px 12px', borderRadius: 'var(--neo-radius-md, 6px)', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(42,117,243,0.85)', color: 'white', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, cursor: 'pointer' }}>▶ 필기 재생</button>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{currentPage} / {totalPages}</span>
                        <button onClick={() => setIsFullscreen(v => !v)} title={isFullscreen ? '전체화면 해제 (ESC)' : '전체화면'}
                            style={{ width: 32, height: 32, borderRadius: 'var(--neo-radius-md, 6px)', border: '1px solid', borderColor: isFullscreen ? 'rgba(255,255,255,0.25)' : T.lineSoft, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⛶</button>
                    </div>
                )}
            </div>
        </div>
    );

    /* ── 우측: 채점 근거 (교사 전용) — 채점 기준별 충족 여부 · 판단 이유 · 답안 원문 인용 ── */
    const BASIS_STATUS = { '충족': ['#ECFDF5', '#047857'], '부분 충족': ['#FFFBEB', '#B45309'], '미충족': ['#FEF2F2', '#B91C1C'] };
    const renderBasis = () => {
        const b = gradeFb.basis;
        if (!b) return <div style={{ ...hint, padding: 20 }}>이 채점 결과에는 채점 근거가 없습니다.</div>;
        const met = b.rows.filter((r) => r.status === '충족').length;
        const cell = { padding: '12px 14px', borderTop: `1px solid ${T.lineSoft}`, verticalAlign: 'top', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7, color: T.text };
        const quoteOf = (q) => q.split('[판독불가]').flatMap((part, i) => (i ? [<mark key={i} style={{ background: '#FEF3C7', color: '#92400E', padding: '0 2px' }}>[판독불가]</mark>, part] : [part]));
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                    <div style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 600, color: T.text, lineHeight: 1.6 }}>{b.criterion}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={pill('#ECFDF5', '#047857')}>{isScoreMode ? `${sum(activeCriteria.map((c) => c.ai))}점` : `${gradeFb.letter} (${gradeFb.label})`}</span>
                        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub }}>{isScoreMode ? `AI ${sum(activeCriteria.map((c) => c.ai))} / ${activeMax}점` : gradeFb.scale} · 채점 기준 {met}/{b.rows.length}개 충족</span>
                    </div>
                    <div style={{ background: '#F5F9FF', border: '1px solid #DBEAFE', borderRadius: T.rLg, padding: '12px 16px', fontSize: 'var(--neo-font-size-sm)', color: T.text, lineHeight: 1.7 }}>{b.summary}</div>
                    <div style={{ border: `1px solid ${T.lineSoft}`, borderRadius: T.rLg, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <colgroup><col style={{ width: 96 }} /><col style={{ width: '20%' }} /><col /><col style={{ width: '34%' }} /></colgroup>
                            <thead>
                                <tr style={{ background: T.surface, fontSize: 'var(--neo-font-size-xs)', color: T.sub, textAlign: 'left' }}>
                                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>상태</th>
                                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>채점 기준</th>
                                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>판단 이유</th>
                                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>답안 원문 인용</th>
                                </tr>
                            </thead>
                            <tbody>
                                {b.rows.map((r) => (
                                    <tr key={r.req}>
                                        <td style={cell}><span style={{ ...pill(...(BASIS_STATUS[r.status] || BASIS_STATUS['미충족'])), whiteSpace: 'nowrap' }}>{r.status}</span></td>
                                        <td style={{ ...cell, fontWeight: 600 }}>{r.req}</td>
                                        <td style={{ ...cell, color: T.sub }}>{r.reason}</td>
                                        <td style={cell}>
                                            <div style={{ borderLeft: `3px solid ${T.line}`, background: T.surface, padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>“{quoteOf(r.quote)}”</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 'var(--neo-font-size-sm)', lineHeight: 1.7 }}>
                        <span style={{ color: T.sub }}>위 수준이 아닌 이유</span><span style={{ color: T.text }}>{b.notUpper}</span>
                        <span style={{ color: T.sub }}>아래 수준이 아닌 이유</span><span style={{ color: T.text }}>{b.notLower}</span>
                    </div>
                </div>
                {b.unreadable && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA', position: 'sticky', bottom: 0 }}>
                        <span style={pill('#DC2626', 'white')}>주의</span>
                        <span style={{ flex: 1, fontSize: 'var(--neo-font-size-sm)', color: '#991B1B' }}>AI가 판독하지 못한 글자가 있어 원본 확인이 필요할 수 있습니다.</span>
                        <button type="button" onClick={() => setRightTab('original')} style={{ border: '1px solid #FCA5A5', background: 'white', color: '#B91C1C', borderRadius: 'var(--neo-radius-md, 6px)', padding: '5px 12px', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>원본 확인</button>
                    </div>
                )}
            </div>
        );
    };

    const tabBtn = (id, label, icon) => {
        const active = rightTab === id;
        return (
            <button key={id} onClick={() => setRightTab(id)} style={{ padding: '7px 14px', border: '1px solid', borderColor: active ? '#BFDBFE' : T.lineSoft, background: active ? '#EFF6FF' : 'white', color: active ? '#2563EB' : T.sub, fontWeight: 600, fontSize: 'var(--neo-font-size-sm)', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 0 }}>
                {icon} {label}
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container grading-detail-modal" onClick={e => e.stopPropagation()} style={{ background: T.surface }}>
                {/* 헤더 — 상용과 동일: ‹ 학생 (학년 반 번호)  안내 문구 */}
                <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: 'white', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                    <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: T.text, padding: 0 }}>‹</button>
                    <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 600, color: T.text }}>
                        {selectedStudent?.name} <span style={{ fontWeight: 600 }}>({selectedStudent?.grade})</span>
                    </span>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub }}>{headerNote}</span>
                    {isStep3 && <span style={{ marginLeft: 'auto', ...pill(isSent ? '#DCFCE7' : '#FEF3C7', isSent ? '#15803D' : '#92400E') }}>{selectedStudent?.status}</span>}
                </header>

                {/* 본문 — 좌(채점 결과) : 우(피드백/원본) */}
                <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, minHeight: 0 }}>
                    {/* ── 좌측 ── [v5.13] 폭을 절반으로(46% → 23%, 최소 360px) — 피드백·채점 근거를 넓게 */}
                    <div style={{ flex: '0 0 max(360px, 23%)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', gap: 4, paddingLeft: 4 }}>
                            {questions.map(q => (
                                <div key={q.id} className={`q-tab ${activeQuestion === q.id ? 'active' : ''}`} onClick={() => setActiveQuestion(q.id)} style={{ padding: '0.55rem 1.1rem', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>
                                    {activeQuestion === q.id ? '✓ ' : ''}문항 {q.id} <span style={{ fontWeight: 400, opacity: 0.8 }}>{q.score || 2}점</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ ...card, flex: 1, borderRadius: '0 16px 16px 16px', padding: '20px 22px', overflow: 'auto', gap: 22 }}>
                            {/* 채점 결과 */}
                            <div>
                                {activeCriteria.length > 0 ? (<>
                                {/* [v5.3] 채점 기준별 점수 — 문항 교사 총점을 제목 줄에, 아래는 채점 기준별 AI · 교사 점수.
                                    [v5.5] 등급 과제도 같은 화면을 쓴다 (교사 등급은 총점에서 환산) */}
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ ...secTitle, marginBottom: 0 }}>채점 결과</div>
                                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        <span style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 700, color: activeAllPicked ? T.text : T.muted }}>{shownTotal}</span>
                                        <span style={{ fontSize: 'var(--neo-font-size-sm)', color: T.sub }}> / {activeMax}점</span>
                                    </div>
                                </div>
                                <div style={{ border: `1px solid ${T.lineSoft}`, borderRadius: T.rLg, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)', fontVariantNumeric: 'tabular-nums' }}>
                                        <thead>
                                            <tr style={{ background: T.surface, color: T.sub, fontSize: 'var(--neo-font-size-xs)' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600 }}>채점 기준</th>
                                                <th style={{ width: 56, padding: '8px 6px', fontWeight: 600 }}>AI</th>
                                                <th style={{ width: 86, padding: '8px 14px', fontWeight: 600 }}>교사</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeCriteria.map((c, i) => (
                                                <tr key={c.name} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                                                    <td style={{ padding: '10px 14px', color: T.text }}>{c.name} <span style={{ color: T.muted, fontSize: 'var(--neo-font-size-xs)' }}>/{c.max}</span></td>
                                                    <td style={{ textAlign: 'center', color: T.sub }}>{c.ai}</td>
                                                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                                                        {isStep3 ? <strong>{activePicks[i]}</strong> : (
                                                            <select value={isPicked(activePicks[i]) ? activePicks[i] : ''} aria-label={`${c.name} 교사 점수`}
                                                                onChange={(e) => { if (e.target.value === '') return; const next = [...activePicks]; next[i] = Number(e.target.value); setCritPicks((m) => ({ ...m, [activeQ.id]: next })); }}
                                                                style={{ width: 72, padding: '4px 6px', border: `1px solid ${!isPicked(activePicks[i]) ? '#F59E0B' : activePicks[i] !== c.ai ? '#2A75F3' : T.line}`, borderRadius: 'var(--neo-radius-md, 6px)', fontWeight: 600, color: !isPicked(activePicks[i]) ? T.muted : activePicks[i] !== c.ai ? '#2563EB' : T.text, fontFamily: 'inherit', background: 'white' }}>
                                                                {/* 한 번 고르면 「선택」으로 되돌릴 수 없다 */}
                                                                <option value="" disabled>선택</option>
                                                                {Array.from({ length: c.max + 1 }, (_, v) => <option key={v} value={v}>{v}</option>)}
                                                            </select>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ borderTop: `1px solid ${T.lineSoft}`, background: T.surface, fontWeight: 700 }}>
                                                <td style={{ padding: '10px 14px' }}>총점 <span style={{ color: T.muted, fontWeight: 400, fontSize: 'var(--neo-font-size-xs)' }}>/{activeMax}</span></td>
                                                <td style={{ textAlign: 'center' }}>{sum(activeCriteria.map((c) => c.ai))}</td>
                                                <td style={{ textAlign: 'center', color: activeAllPicked ? T.text : T.muted }}>{shownTotal}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                </>) : (<>
                                <div style={secTitle}>채점 결과</div>
                                <div style={{ border: '1px solid #CBD5E1', borderRadius: T.rLg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 18, fontSize: 'var(--neo-font-size-sm)' }}>
                                    <span><span style={{ color: T.sub }}>AI채점 : </span><strong>{aiGradeDisplay}</strong></span>
                                    <span style={{ width: 1, height: 18, background: T.lineSoft }} />
                                    <span style={{ color: T.sub }}>교사채점 :</span>
                                    {isStep3 ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: gradeColorMap[selectedStudent?.teacherGrade] || '#8A94A1', display: 'inline-block' }} />
                                            {fmt(selectedStudent?.teacherGrade, selectedStudent?.teacherScore)}{isScoreMode && <span style={{ color: T.sub, fontWeight: 400 }}> / {maxPoints}점</span>}
                                        </span>
                                    ) : isScoreMode ? (
                                        /* 점수 모드 — 교사가 합산 점수를 직접 입력 (0~총 배점) */
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <input type="number" min={0} max={maxPoints} value={teacherScore} placeholder="점수"
                                                onChange={(e) => { const v = e.target.value; if (v === '') { setTeacherScore(''); return; } const n = Math.max(0, Math.min(maxPoints, Math.round(Number(v)))); setTeacherScore(Number.isFinite(n) ? n : ''); }}
                                                style={{ width: 72, padding: '4px 8px', border: `1px solid ${T.line}`, borderRadius: 'var(--neo-radius-md, 6px)', fontWeight: 600, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', textAlign: 'center' }} />
                                            <span style={{ color: T.sub }}>/ {maxPoints}점</span>
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #CBD5E1', borderRadius: 'var(--neo-radius-md, 6px)', padding: '2px 8px' }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: gradeColorMap[teacherGrade] || T.line, display: 'inline-block' }} />
                                            <select value={teacherGrade} onChange={(e) => setTeacherGrade(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', outline: 'none', minWidth: 120 }}>
                                                <option>선택 안함</option><option>매우우수</option><option>우수</option><option>보통</option><option>노력</option>
                                            </select>
                                        </span>
                                    )}
                                </div>
                                </>)}
                            </div>

                            {/* [v5.12] AI 채점 이력 — 舊 「AI 재채점」 「채점 히스토리」 두 구역을 하나로.
                                재채점은 이력을 하나 더 만드는 일이라 이력 제목 줄의 작은 버튼으로 두고,
                                이력은 회차를 위아래로 견주기 쉬운 한 줄 목록으로 둔다. 결과 발송 단계에서는 숨김 */}
                            {!isStep3 && (
                                <div style={{ paddingTop: 18, borderTop: `1px solid ${T.lineSoft}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <div style={{ ...secTitle, marginBottom: 0 }}>AI 채점 이력</div>
                                        <span style={pill(T.surface, T.sub)}>{gradingHistory.length}건</span>
                                        {/* [v5.14] AI 채점은 문항마다 최대 {aiGradingLimitPerRound}회(첫 채점 포함) — 이력 수만큼 썼다. 다 쓰면 재채점 불가 */}
                                        {(() => {
                                            const left = Math.max(0, aiGradingLimitPerRound - gradingHistory.length);
                                            return (
                                                <button type="button" className="btn-regrading" disabled={left === 0}
                                                    title={left === 0
                                                        ? `AI 채점을 ${aiGradingLimitPerRound}회 모두 진행해 더 이상 재채점할 수 없습니다. 이력에서 반영할 결과를 고르세요.`
                                                        : '기존 채점 결과는 유지되고 새 결과가 이력에 추가됩니다.'}
                                                    style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 'var(--neo-font-size-sm)', ...(left === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                                                    ✦ AI 재채점 <span style={{ fontWeight: 400, opacity: 0.8 }}>· {left === 0 ? '횟수 소진' : `${left}회 남음`}</span>
                                                </button>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ border: `1px solid ${T.lineSoft}`, borderRadius: T.rLg, overflow: 'hidden' }}>
                                        {gradingHistory.map((h, idx) => {
                                            const on = reflectedHistoryId === h.id;
                                            const pts = activeCriteria.length
                                                ? (on ? sum(activeCriteria.map((c) => c.ai)) : (gradeToPoints(h.level, activeMax) ?? '-'))
                                                : null;
                                            return (
                                                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: idx ? `1px solid ${T.lineSoft}` : 'none', background: on ? '#F5F9FF' : 'white', boxShadow: on ? 'inset 3px 0 0 #2A75F3' : 'none', fontSize: 'var(--neo-font-size-sm)', fontVariantNumeric: 'tabular-nums' }}>
                                                    <strong style={{ width: 24, flex: 'none' }}>{h.label}</strong>
                                                    <span style={{ flex: 1, minWidth: 0, color: T.sub, fontSize: 'var(--neo-font-size-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.timestamp || '2026. 09. 16. 오후 06:03'}</span>
                                                    <span style={{ flex: 'none' }}>
                                                        {pts !== null
                                                            ? <><strong>{pts}</strong><span style={{ color: T.sub }}> / {activeMax}점</span></>
                                                            : <strong>{fmt(h.level, h.score)}</strong>}
                                                    </span>
                                                    <button type="button" onClick={() => setReflectedHistoryId(h.id)} disabled={on}
                                                        style={{ flex: 'none', width: 72, border: `1px solid ${on ? '#2A75F3' : T.line}`, background: on ? '#2A75F3' : 'white', color: on ? 'white' : T.sub, borderRadius: 'var(--neo-radius-md, 6px)', padding: '3px 0', fontSize: 'var(--neo-font-size-xs)', fontWeight: 600, cursor: on ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                                        {on ? '✓ 반영됨' : '반영'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ ...hint, fontSize: 'var(--neo-font-size-xs)', marginTop: 8 }}>반영한 회차의 AI 점수와 피드백이 오른쪽에 보입니다.</div>
                                </div>
                            )}

                            {/* [v5.10] 舊 좌측 「AI 과정 분석」 실행 카드 삭제 — 과정 분석은 AI 채점에 통합됐다 */}

                            {/* [v5.16] 채점 근거 보기 — 왼쪽 카드 맨 아래. 판독 경고를 버튼 바로 위에 붙이고, 버튼은 채운 색으로 눈에 띄게 */}
                            {/* 카드가 스크롤돼도 늘 보이도록 카드 바닥에 붙인다 (카드 안쪽 여백 20px만큼 내려 붙임) */}
                            <div style={{ marginTop: 'auto', position: 'sticky', bottom: -20, zIndex: 2, background: 'white', padding: '10px 0 20px', marginBottom: -20, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {gradeFb.basis?.unreadable && (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--neo-radius-md, 6px)', fontSize: 'var(--neo-font-size-xs)', color: '#B91C1C', lineHeight: 1.5 }}>
                                        <span aria-hidden>⚠</span><span>판독하지 못한 글자가 있어 원본 확인이 필요할 수 있습니다.</span>
                                    </div>
                                )}
                                <button type="button" onClick={() => setRightTab('basis')} aria-pressed={rightTab === 'basis'}
                                    style={{ width: '100%', border: 'none', background: rightTab === 'basis' ? '#1E40AF' : '#2563EB', padding: '10px 12px', borderRadius: 'var(--neo-radius-md, 6px)', color: 'white', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}>☑ 채점 근거 보기 ›</button>
                            </div>
                        </div>

                    </div>

                    {/* ── 우측 ── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--neo-font-size-lg)', fontWeight: 600, color: T.text }}>
                                {qLabel} {rightTab === 'feedback' ? '피드백 보기' : rightTab === 'basis' ? '채점 근거' : '원본 보기'}
                                {rightTab === 'basis' && (<>
                                    <span title="AI가 채점 기준마다 충족 여부를 판단한 근거입니다. 학생에게 발송되는 리포트에는 싣지 않습니다." style={{ width: 18, height: 18, borderRadius: '50%', border: `1px solid ${T.line}`, color: T.sub, fontSize: 'var(--neo-font-size-xs)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>i</span>
                                    <span style={pill('#1E293B', 'white')}>교사에게만 표시</span>
                                </>)}
                            </div>
                            <div style={{ display: 'inline-flex', borderRadius: T.rLg, overflow: 'hidden' }}>
                                {tabBtn('feedback', '피드백 보기', '🗨')}
                                {tabBtn('original', '원본 보기', '▤')}
                                {tabBtn('basis', '채점 근거', '☑')}
                            </div>
                        </div>
                        {rightTab === 'feedback' && (
                            <div style={{ ...hint, marginBottom: 8 }}>채점이 완료되면 AI 피드백이 제공되며, 필요에 따라 내용을 직접 수정하여 완성할 수 있습니다.</div>
                        )}
                        <div style={{ ...card, flex: 1, overflow: 'auto' }}>
                            {rightTab === 'feedback' ? renderFeedback() : rightTab === 'basis' ? renderBasis() : renderOriginal()}
                        </div>
                    </div>
                </div>

                {/* [v5.13] 하단 버튼 — 화면 전체 폭 (舊 좌측 칼럼 아래) */}
                <div style={{ padding: '0 16px 14px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {isStep3 && !isSent && (
                                    <button onClick={() => { if (onRevertToStep2) onRevertToStep2(selectedStudent); }} style={{ padding: '0.55rem 1.1rem', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#EF4444', background: 'white', border: '1px solid #EF4444', borderRadius: T.rLg, cursor: 'pointer', fontFamily: 'inherit' }}>AI 재검토 (Step2로 이동)</button>
                                )}
                                <button type="button" onClick={() => setShowRevertModal(true)} title="미채점 단계로 되돌려 스캔 업로드로 다시 채점하기"
                                    style={{ padding: '0.55rem 1rem', fontSize: 'var(--neo-font-size-sm)', fontWeight: 600, color: '#DC2626', background: 'white', border: '1px solid #DC2626', borderRadius: 'var(--neo-radius-md, 6px)', cursor: 'pointer', fontFamily: 'inherit' }}>↺ 미채점 처리</button>
                            </div>
                            <div className="footer-btn-group">
                                <button className="btn-nav" onClick={handlePrev} disabled={currentIndex <= 0}>‹ 이전 학생</button>
                                <button className="btn-nav active" onClick={handleNext} disabled={currentIndex >= students.length - 1}>다음 학생 ›</button>
                                {isStep3 ? (
                                    isSent ? (<>
                                        <button className="btn-review-complete"
                                            style={canRequestRevision ? { padding: '0.6rem 1.4rem', background: 'white', color: '#EF4444', border: '1px solid #EF4444' } : { padding: '0.6rem 2rem', background: '#EF4444' }}
                                            onClick={() => { if (onResultSendCancel) onResultSendCancel(selectedStudent); else onClose(); }}>결과발송 취소</button>
                                        {canRequestRevision && (
                                            <button className="btn-review-complete" style={{ padding: '0.6rem 1.8rem', background: '#7C3AED' }} onClick={() => setShowRevisionModal(true)} title="1차 결과를 보존한 채 2차 답안지를 재배부합니다.">✍ 퇴고 요청</button>
                                        )}
                                    </>) : (
                                        <button className="btn-review-complete" style={{ padding: '0.6rem 2rem' }} onClick={() => { if (onResultSend) onResultSend(selectedStudent); else onClose(); }}>결과발송</button>
                                    )
                                ) : (
                                    <button className="btn-review-complete" style={{ padding: '0.6rem 2.2rem', background: '#2A75F3' }}
                                        onClick={() => {
                                            if (activeCriteria.length) {
                                                // [v5.3] 교사 점수 = 모든 문항의 채점 기준별 점수 합. 손대지 않은 기준은 AI 점수를 그대로 쓴다
                                                // [v5.6] 모든 문항의 채점 기준에 교사 점수를 골라야 넘어간다
                                                const missing = questions.filter((q) => !picksOf(q).every(isPicked));
                                                if (missing.length) {
                                                    alert(`교사 점수를 모두 선택해 주세요. 선택하지 않은 문항: ${missing.map((q) => `문항 ${q.id}`).join(', ')}`);
                                                    if (typeof setActiveQuestion === 'function') setActiveQuestion(missing[0].id);
                                                    return;
                                                }
                                                const total = teacherTotalAll;
                                                const teacherCriteria = Object.fromEntries(questions.map((q) => [q.id, picksOf(q)]));
                                                // 등급명을 함께 저장해 등급 기반 화면(목록·추이·통계)이 그대로 동작하게 한다. [v5.5] 등급 과제는 점수를 저장하지 않는다
                                                const teacherGrade = scoreToGrade(total, maxPoints, 5);
                                                if (onReviewComplete) onReviewComplete({ ...selectedStudent, ...(isScoreMode ? { teacherScore: total } : {}), teacherCriteria, teacherGrade }); else onClose();
                                                return;
                                            }
                                            if (teacherGrade === '선택 안함') { alert('교사 채점을 먼저 선택해 주세요. 교사 채점이 선택되어야 결과 발송 단계로 이동할 수 있습니다.'); return; }
                                            if (onReviewComplete) onReviewComplete({ ...selectedStudent, teacherGrade }); else onClose();
                                        }}>검토 완료</button>
                                )}
                            </div>
                        </div>
                </div>

                {/* [SCR-06] 퇴고 요청 확인 모달 (학생 단위) */}
                {showRevisionModal && (
                    <div onClick={() => setShowRevisionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '1.5rem 1.75rem', width: 500, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
                            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 600, color: T.text, margin: '0 0 0.75rem' }}>{selectedStudent?.name} 학생에게 퇴고를 요청하시겠습니까?</h2>
                            <ul style={{ margin: '0 0 1rem', padding: '0.75rem 1rem 0.75rem 1.5rem', background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: T.rLg, fontSize: 'var(--neo-font-size-sm)', color: T.sub, lineHeight: 1.75 }}>
                                <li>지금 보고 계신 <strong style={{ color: '#7C3AED' }}>1차 펜 데이터와 채점 결과는 그대로 보존</strong>됩니다.</li>
                                <li><strong style={{ color: T.text }}>2차 답안지(새 번호표)</strong>가 발급됩니다. 출력해 배부해 주세요.</li>
                                <li>이 학생은 <strong style={{ color: T.text }}>미채점</strong> 단계로 돌아가며, 1차와 <strong style={{ color: T.text }}>동일하게</strong> 일괄 채점 · 스캔 채점 · 개별 펜 동기화로 채점합니다.</li>
                                <li>AI 채점 횟수는 <strong style={{ color: T.text }}>2차에서 새로 {aiGradingLimitPerRound}회</strong> 주어집니다 (1차 카운터와 독립).</li>
                            </ul>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: '1.25rem', background: T.surface, border: '1px solid #E2E8F0', borderRadius: T.rLg, fontSize: 'var(--neo-font-size-sm)' }}>
                                <span style={{ color: T.sub, fontWeight: 600 }}>발급될 2차 번호표</span>
                                <span style={{ color: '#7C3AED', fontWeight: 600 }}>{selectedStudent?.sheetNo || '-'} → {nextSheetNo}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowRevisionModal(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #E2E8F0', borderRadius: T.rLg, fontWeight: 600, color: T.sub, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>취소</button>
                                <button onClick={handleConfirmRevision} style={{ padding: '9px 18px', background: '#7C3AED', border: 'none', borderRadius: T.rLg, fontWeight: 600, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>✍ 퇴고 요청</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* [SCR-03] 미채점 단계로 되돌리기 확인 모달 */}
                {showRevertModal && (
                    <div onClick={() => setShowRevertModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '1.5rem 1.75rem', width: 480, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' }}>
                            <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 600, color: T.text, margin: '0 0 0.75rem' }}>미채점 처리하시겠습니까?</h2>
                            <ul style={{ margin: '0 0 1.25rem', padding: '0.75rem 1rem 0.75rem 1.5rem', background: T.surface, border: '1px solid #E2E8F0', borderRadius: T.rLg, fontSize: 'var(--neo-font-size-sm)', color: T.sub, lineHeight: 1.75 }}>
                                <li>이미 채점된 <strong style={{ color: '#DC2626' }}>펜데이터는 삭제</strong>되어, 복구할 수 없습니다.</li>
                                <li><strong style={{ color: T.text }}>스캔 업로드</strong>를 통해 AI 채점을 시작할 수 있습니다.</li>
                                <li>AI 채점은 펜데이터 사용 시와 동일하게 <strong style={{ color: T.text }}>최대 2회</strong>까지 가능합니다.</li>
                            </ul>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowRevertModal(false)} style={{ padding: '9px 18px', background: 'white', border: '1px solid #E2E8F0', borderRadius: T.rLg, fontWeight: 600, color: T.sub, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>취소</button>
                                <button onClick={handleConfirmRevert} style={{ padding: '9px 18px', background: '#DC2626', border: 'none', borderRadius: T.rLg, fontWeight: 600, color: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>↺ 미채점 처리</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GradingReviewModal;
