/**
 * solutionSamples.js — 「풀이 과정 보기」 시연 샘플 (학생 모드 TSK-10 · 교사 채점 확인 SCR-03 공용)
 *   실제는 AI 채점 때 학생 답안마다 만든 단계 · 장면 자막 · 정리를 서버에서 받는다
 */
import PEN_RATIONAL from './penSample_3-52-766-4.json';

/* [풀이 과정 보기] 실제 펜 데이터 샘플 — 유리함수 (3-52-766-4쪽, 획 208개 · 약 112초)
 *   획 0~13은 학년 · 반 · 번호 · 이름 머리글이라 미리보기 · 재생에서 뺀다(penFrom: 14)
 *   장면 cue의 s = 획 구간 [처음, 끝] · mark = 다 쓴 뒤 빨강으로 표시(다시 볼 부분) */
const PEN_FROM = 14;
export const MATH_RAT_TASK = {
  title: '[수학] 유리함수의 그래프에서 식 구하기',
  /* [다국어] 학생 화면 언어별 값 — 실제는 AI 채점 때 함께 만든다(lib/i18n.js) */
  en: { title: '[Math] Find the equation from the graph of a rational function', subject: 'Math', pub: 'Oct 14, 2026', done: 'October 15, 2026', way: 'Smart pen upload', cap: 'Smart pen upload · 2026.10.15 16:20' },
  subject: '수학', full: 6, pub: '2026. 10. 14', done: '2026년 10월 15일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.10.15 16:20',
  passage: null, hasProcess: true,
  questions: [
    {
      label: '문항 1', point: 4, score: 3, grade: 'B', chip: '우수', chipCls: 'b',
      text: '두 점근선이 x = 2, y = −1이고 점 (3, 0)을 지나는 유리함수의 그래프를 그리고, 이 유리함수의 식을 구하시오.',
      answer: ['점근선 x = 2, y = −1', 'y = k/(x−2) − 1 (k ≠ 0)로 둔다', '그래프가 점 (3, 0)을 지나므로 x = 3, y = 0 대입', '0 = k/(3−2) = −1 → 0 = k − 1 ∴ k = 1', '∴ 유리함수식 1/(x−2) − 1'],
      pen: PEN_RATIONAL, penFrom: PEN_FROM,
      en: {
        label: 'Q1', text: 'Draw the graph of a rational function whose asymptotes are x = 2 and y = −1 and which passes through (3, 0), then find its equation.',
        fb: [
          'You read both asymptotes correctly from the graph, set the form y = k/(x−2) − 1 (k ≠ 0) first, and then substituted a point to find k. That order is very well organized.',
          'After 0 = k/(3−2) you wrote "= −1" instead of "− 1", adding an extra equals sign, and your final answer is missing "y =". Practice checking each symbol as you write an expression.',
          'Drawing the graph yourself to sort out the conditions is a great habit. Finish with a function like "y = 1/(x−2) − 1" and your answer will be complete.',
        ],
        guide: {
          title: 'Write the rational function correctly and finish it',
          points: [
            'If the asymptotes are x = p and y = q, set the equation as y = k/(x−p) + q (k ≠ 0).',
            'Substitute a point on the graph to find k.',
            'Always write the answer as a function: "y = …".',
          ],
          items: [
            {
              ask: 'Rewrite the line where you substituted, with the right symbols.',
              written: '"0 = k/(3−2) = −1"',
              whenTo: 'When you substitute a point into the equation',
              example: '0 = k/(3−2) − 1, so 0 = k − 1, and therefore k = 1.',
              tip: "Don't mix up the equals sign (=) and the minus sign (−).",
              check: 'Check that the line has only one equals sign.',
              pen: { s: [155, 182], mark: [164, 167] },
            },
            {
              ask: 'Write the final answer as a function.',
              written: '"rational function 1/(x−2) − 1"',
              whenTo: 'When you put k back in to finish the equation',
              example: 'So the rational function is y = 1/(x−2) − 1.',
              tip: 'It only becomes a function when it starts with "y =".',
              check: 'Check that x = 3 gives y = 0.',
              pen: { s: [183, 207], mark: [200, 207] },
            },
          ],
        },
        hw: { name: 'Thoughtful and confident', brief: 'Slow and revisits steps, but finishes firmly', summary: 'You drew the graph first, then moved smoothly from asymptotes → form of the equation → substitution → calculation. The two 4–5 second pauses before drawing the curves look like time spent picturing the shape. You finished without going back, but missed one symbol in the substitution line and one in the final answer.' },
      },
      fb: [
        '그래프에서 두 점근선을 정확히 읽고, 식의 꼴을 y = k/(x−2) − 1 (k ≠ 0)로 먼저 정한 뒤 점을 대입해 k를 구한 풀이 순서가 매우 체계적입니다.',
        '0 = k/(3−2) 다음에 「− 1」 대신 「= −1」로 등호를 하나 더 썼고, 마지막 답에 「y =」가 빠졌습니다. 식을 쓸 때 기호 하나하나를 확인하는 연습이 필요합니다.',
        '그래프를 직접 그리며 조건을 정리하는 습관이 좋습니다. 마지막 줄을 「y = 1/(x−2) − 1」처럼 함수식으로 마무리하면 완벽한 답안이 됩니다.',
      ],
      guide: {
        title: '유리함수의 식을 바르게 쓰고 마무리하기',
        points: [
          '점근선이 x = p, y = q이면 식을 y = k/(x−p) + q (k ≠ 0)로 둬요.',
          '그래프 위의 점을 대입해 k를 구해요.',
          '답은 반드시 「y = …」 꼴의 함수식으로 써요.',
        ],
        items: [
          {
            ask: '대입한 식을 기호까지 바르게 다시 써 봐요.',
            written: '"0 = k/(3−2) = −1"',
            whenTo: '점의 좌표를 식에 대입할 때',
            example: '0 = k/(3−2) − 1 이므로 0 = k − 1, 따라서 k = 1 이다.',
            tip: '등호(=)와 빼기(−)를 헷갈리지 않게 써요.',
            check: '대입한 줄의 등호가 하나인지 확인해요.',
            pen: { s: [155, 182], mark: [164, 167] }, // [AI 첨삭] 이 안내에 해당하는 학생 필기 획 구간 · 고칠 곳
          },
          {
            ask: '마지막 답을 함수식으로 써 봐요.',
            written: '"유리함수식 1/(x−2) − 1"',
            whenTo: '구한 k를 넣어 식을 완성할 때',
            example: '따라서 구하는 유리함수의 식은 y = 1/(x−2) − 1 이다.',
            tip: '「y =」가 있어야 함수의 식이 돼요.',
            check: 'x = 3을 넣었을 때 y = 0이 나오는지 확인해요.',
            pen: { s: [183, 207], mark: [200, 207] },
          },
        ],
      },
      hw: { code: 'cba', summary: '그래프를 먼저 그린 뒤 점근선 → 식의 꼴 → 대입 → 계산 순서로 막힘 없이 이어졌습니다. 곡선을 그리기 전 4~5초씩 두 번 멈춘 것은 그래프 모양을 떠올리는 과정으로 보입니다. 되돌아감 없이 끝까지 풀었지만, 대입한 줄과 마지막 답에서 기호를 하나씩 놓쳤습니다.' },
      solution: {
        level: '고1', unit: '유리함수', pen: PEN_RATIONAL, penFrom: PEN_FROM,
        /* [다국어 프로토] 영어 — 실제는 AI가 학생 화면 언어로 만든다(학년 눈높이 그대로) */
        en: {
          level: 'Grade 10', unit: 'Rational functions',
          concept: 'A rational function with asymptotes x = p and y = q can be written as y = k/(x−p) + q (k ≠ 0). Substitute one point on the graph to find k.',
          answer: ['Asymptotes x = 2, y = −1 → y = k/(x−2) − 1 (k ≠ 0)', 'Substitute (3, 0): 0 = k/(3−2) − 1 → k = 1', '∴ y = 1/(x−2) − 1'],
        },
        concept: '점근선이 x = p, y = q인 유리함수는 y = k/(x−p) + q (k ≠ 0) 꼴로 둘 수 있어요. 그래프 위의 한 점을 대입하면 k를 구할 수 있어요.',
        steps: [
          { title: '그래프 그리기', en: { title: "Draw the graph", basic: "You drew both asymptotes as dotted lines first, then the two branches through (3, 0).", detail: "You drew the axes → asymptotes (x = 2, y = −1) → right branch → point (3, 0) → left branch. Drawing the asymptotes first makes it clear where the curve should approach. The two pauses before the curves were time spent picturing the shape." }, ok: true, line: 0, pauseSec: 5,
            cues: [
              { s: [14, 23] },
              { s: [24, 54], say: '점근선을 먼저 그려 둔 게 좋아요.', sayD: '점근선을 먼저 그려 두면 곡선이 어디로 다가가는지 분명해져요. 좋은 순서예요.', en: { say: "Nice — you drew the asymptotes first.", sayD: "Drawing the asymptotes first shows where the curve should approach. Good order." } },
              { pause: true, sec: 4, say: '곡선 앞에서 4초 멈췄어요. 모양을 떠올리는 시간이었죠.', en: { say: "You paused for 4 seconds before the curve — picturing its shape." } },
              { s: [55, 55] },
              { s: [56, 60], lv: 'detail', say: '(3, 0)은 나중에 k를 구하는 단서가 돼요.', en: { say: "(3, 0) becomes the clue for finding k later." } },
              { pause: true, sec: 5, lv: 'detail', say: '한 번 더 5초쯤 멈췄어요.', en: { say: "Another pause of about 5 seconds." } },
              { s: [61, 62] },
            ],
            basic: '점근선 두 개를 점선으로 먼저 그리고, 점 (3, 0)을 지나는 두 갈래 곡선을 그렸어요.',
            detail: '좌표축 → 점근선(x = 2, y = −1) → 오른쪽 곡선 → 점 (3, 0) → 왼쪽 곡선 순서로 그렸어요. 점근선을 먼저 그려 두면 곡선이 어디로 다가가야 하는지 분명해져요. 곡선 앞에서 두 번 멈춘 것은 모양을 떠올리는 시간이었어요.' },
          { title: '점근선 읽기', en: { title: "Read the asymptotes", basic: "You read both asymptotes, x = 2 and y = −1, correctly from the graph.", detail: "You took the vertical asymptote x = 2 and the horizontal asymptote y = −1 from the picture. In rational-function problems the asymptotes are the backbone of the equation, so this step matters most." }, ok: true, line: 0,
            cues: [
              { s: [63, 72] },
              { s: [73, 83], lv: 'detail', say: '두 점근선을 그림과 똑같이 읽었어요.', en: { say: "You read both asymptotes exactly as drawn." } },
            ],
            basic: '그래프에서 두 점근선 x = 2, y = −1을 정확히 읽었어요.',
            detail: '세로 점근선 x = 2와 가로 점근선 y = −1을 그림에서 읽어 식으로 옮겼어요. 유리함수 문제는 점근선이 식의 뼈대가 되기 때문에 이 단계가 가장 중요해요.' },
          { title: '식의 꼴 정하기', en: { title: "Set up the form", basic: "Using the asymptotes, you set y = k/(x−2) − 1 (k ≠ 0).", detail: "With asymptotes x = p and y = q, the form is y = k/(x−p) + q. You put p = 2 and q = −1 to get y = k/(x−2) − 1, and you didn't forget k ≠ 0." }, ok: true, line: 0,
            cues: [
              { s: [84, 93], say: '점근선으로 식의 꼴을 정확히 잡았어요.', sayD: '세로 점근선이 x = 2라서 분모가 x − 2가 돼요.', en: { say: "You set up the form correctly from the asymptotes.", sayD: "The vertical asymptote x = 2 makes the denominator x − 2." } },
              { s: [94, 104], lv: 'detail', say: '가로 점근선 y = −1이 뒤의 −1이 되고, k ≠ 0 조건도 챙겼어요.', en: { say: "The horizontal asymptote y = −1 becomes the −1 at the end, and you kept the condition k ≠ 0." } },
              { s: [105, 111] },
            ],
            basic: '점근선을 이용해 식을 y = k/(x−2) − 1 (k ≠ 0)로 두었어요.',
            detail: '점근선이 x = p, y = q이면 y = k/(x−p) + q 꼴이에요. p = 2, q = −1을 넣어 y = k/(x−2) − 1로 두었고, k ≠ 0 조건도 빠뜨리지 않았어요.' },
          { title: '점 대입하기', en: { title: "Substitute a point", basic: "You found the point (3, 0) on the graph and substituted x = 3, y = 0.", detail: "Only k is unknown, so one point on the graph is enough. Choosing the x-intercept (3, 0) was the right call." }, ok: true, line: 0,
            cues: [
              { s: [112, 138] },
              { s: [139, 154], lv: 'detail', say: '모르는 값이 k 하나라서 점 하나만 대입하면 충분해요.', en: { say: "Only k is unknown, so substituting one point is enough." } },
            ],
            basic: '그래프가 지나는 점 (3, 0)을 찾아 x = 3, y = 0을 대입했어요.',
            detail: 'k 하나만 모르니까 그래프 위의 점 하나면 충분해요. x축과 만나는 점 (3, 0)을 골라 대입하기로 한 판단이 정확해요.' },
          { title: 'k 구하기', en: { title: "Find k", basic: "k = 1 is right, but you wrote an extra equals sign: \"= −1\" instead of \"− 1\".", detail: "It should read 0 = k/(3−2) − 1, but writing \"= −1\" changes the meaning (it reads like 0 = k = −1). On the next line you correctly wrote 0 = k − 1, so k = 1 is right. Keep the equals sign and the minus sign distinct." }, ok: false, line: 0,
            cues: [
              { s: [155, 163] },
              { s: [164, 167], mark: true, say: '여기 등호가 하나 더 들어갔어요. 「− 1」이어야 해요.', sayD: '「= −1」로 쓰면 0 = k = −1처럼 읽혀 뜻이 달라져요. 「− 1」로 써야 해요.', en: { say: "There's an extra equals sign here. It should be \"− 1\".", sayD: "Writing \"= −1\" reads like 0 = k = −1, which changes the meaning. It should be \"− 1\"." } },
              { s: [168, 174], lv: 'detail', say: '다음 줄에서는 0 = k − 1로 바르게 이어 갔어요.', en: { say: "On the next line you continued correctly with 0 = k − 1." } },
              { s: [175, 182], say: 'k = 1, 정확해요.', en: { say: "k = 1 — correct." } },
            ],
            basic: 'k = 1은 맞았지만, 대입한 줄에 「− 1」 대신 「= −1」로 등호를 하나 더 썼어요.',
            detail: '0 = k/(3−2) − 1이라고 써야 하는데 「= −1」로 써서 식의 뜻이 달라졌어요(0 = k = −1처럼 읽혀요). 다음 줄에서 0 = k − 1로 바르게 이어 가서 k = 1은 정확해요. 등호와 빼기를 구분해 쓰는 습관을 들여요.' },
          { title: '답 쓰기', en: { title: "Write the answer", basic: "You wrote only the right-hand side and left out \"y =\". It should be y = 1/(x−2) − 1.", detail: "Putting k = 1 in gives y = 1/(x−2) − 1. Writing just \"1/(x−2) − 1\" is only one side, not the function's equation. Always finish with \"y = …\"." }, ok: false, line: 0,
            cues: [
              { s: [183, 199] },
              { s: [200, 207], mark: true, say: '앞에 「y =」가 빠졌어요.', sayD: '「y =」가 있어야 함수의 식이 돼요. y = 1/(x−2) − 1로 마무리해요.', en: { say: "\"y =\" is missing at the front.", sayD: "You need \"y =\" for it to be a function's equation. Finish with y = 1/(x−2) − 1." } },
            ],
            basic: '식의 오른쪽만 쓰고 「y =」를 빠뜨렸어요. y = 1/(x−2) − 1로 써야 해요.',
            detail: '구한 k = 1을 넣으면 y = 1/(x−2) − 1이에요. 「1/(x−2) − 1」만 쓰면 함수의 식이 아니라 식의 한쪽일 뿐이에요. 답은 언제나 「y = …」 꼴로 마무리해요.' },
        ],
        answer: ['점근선 x = 2, y = −1 → y = k/(x−2) − 1 (k ≠ 0)', '점 (3, 0) 대입: 0 = k/(3−2) − 1 → k = 1', '∴ y = 1/(x−2) − 1'],
      },
    },
    /* 문항 2 — 시연용: 실제 펜 데이터가 없어 답안 글자를 쓰는 흉내로 재생한다(펜 데이터를 받으면 pen으로 교체) */
    {
      label: '문항 2', point: 2, score: 2, grade: 'A', chip: '매우 우수', chipCls: 'a',
      text: '문항 1에서 구한 유리함수의 정의역과 치역을 구하시오.',
      en: {
        label: 'Q2', text: 'Find the domain and range of the rational function you found in Q1.',
        fb: [
          'You used the value that makes the denominator 0 and the horizontal asymptote to find both the domain and range correctly.',
          'You described the ranges well in words, like "all real numbers with x ≠ 2". Try set notation such as {x | x ≠ 2} as well — it looks even cleaner.',
          'You clearly understand how the asymptotes relate to the domain and range. Use the same method with other rational functions.',
        ],
        guide: { title: '', points: [], items: [] },
        hw: { name: 'Careful, step-by-step and confident', brief: 'Steady pace, in order, with confidence', summary: 'You wrote both lines without stopping and never went back. Turning the asymptotes from Q1 straight into the domain and range shows a steady flow.' },
      },
      answer: ['정의역 : x ≠ 2 인 모든 실수', '치역 : y ≠ −1 인 모든 실수'],
      fb: [
        '분모가 0이 되는 값과 가로 점근선을 이용해 정의역과 치역을 모두 정확하게 구했습니다.',
        '「x ≠ 2인 모든 실수」처럼 범위를 문장으로 잘 썼습니다. 집합 기호 {x | x ≠ 2}로도 써 보면 더 깔끔해집니다.',
        '점근선과 정의역 · 치역의 관계를 정확히 이해하고 있습니다. 다른 유리함수에서도 같은 방법을 써 보세요.',
      ],
      guide: { title: '', points: [], items: [] },
      hw: { code: 'baa', summary: '두 줄을 막힘 없이 이어서 썼고 되돌아감이 없었습니다. 문항 1에서 구한 점근선을 바로 정의역과 치역으로 옮긴 흐름이 안정적입니다.' },
      solution: {
        level: '고1', unit: '유리함수',
        en: {
          level: 'Grade 10', unit: 'Rational functions',
          concept: 'For y = k/(x−p) + q, the domain is all real x ≠ p and the range is all real y ≠ q. The two asymptotes are exactly the values left out.',
          answer: ['Domain: {x | x ≠ 2, x real}', 'Range: {y | y ≠ −1, y real}'],
        },
        concept: '유리함수 y = k/(x−p) + q의 정의역은 x ≠ p, 치역은 y ≠ q인 모든 실수예요. 두 점근선이 그대로 정의역 · 치역에서 「빠지는 값」이 돼요.',
        steps: [
          { title: '정의역 구하기', en: { title: 'Find the domain', basic: 'You left out only x = 2, where the denominator is 0.', detail: 'A rational function cannot have a zero denominator. x − 2 = 0 means x = 2, so the domain is all real numbers except 2.' }, ok: true, line: 0,
            cues: [{ w: '정의역 : x ≠ 2 인 모든 실수', say: '분모가 0이 되는 x = 2만 정확히 뺐어요.', sayD: '분모 x − 2가 0이 되면 안 되니까 x = 2만 빼면 돼요. 정의역은 x ≠ 2인 모든 실수예요.', en: { say: 'You left out exactly x = 2, where the denominator is 0.', sayD: 'The denominator x − 2 cannot be 0, so only x = 2 is excluded. The domain is all real x ≠ 2.' } }],
            basic: '분모가 0이 되는 x = 2만 빼서 정의역을 구했어요.',
            detail: '유리함수는 분모가 0이 되면 안 돼요. x − 2 = 0, 즉 x = 2만 빼면 되니까 정의역은 x ≠ 2인 모든 실수예요.' },
          { title: '치역 구하기', en: { title: 'Find the range', basic: 'You used the horizontal asymptote y = −1 to find the range.', detail: '1/(x−2) can never be 0, so y can never be −1. The range is all real numbers except −1.' }, ok: true, line: 1,
            cues: [{ w: '치역 : y ≠ −1 인 모든 실수', say: '가로 점근선 y = −1로 치역도 맞게 구했어요.', sayD: '1/(x−2)은 0이 될 수 없으니 y는 −1이 될 수 없어요. 그래서 치역은 y ≠ −1인 모든 실수예요.', en: { say: 'You used the horizontal asymptote y = −1 to get the range right.', sayD: '1/(x−2) is never 0, so y is never −1. The range is all real y ≠ −1.' } }],
            basic: '가로 점근선 y = −1을 이용해 치역을 구했어요.',
            detail: '1/(x−2)은 어떤 x를 넣어도 0이 될 수 없어요. 그래서 y = 1/(x−2) − 1은 −1이 될 수 없고, 치역은 y ≠ −1인 모든 실수예요.' },
        ],
        answer: ['정의역 : {x | x ≠ 2인 실수}', '치역 : {y | y ≠ −1인 실수}'],
      },
    },
  ],
};

/* [일괄 채점 통합 · SCR-03 v5.30] 학생 모드 유리함수 과제를 교사 쪽에도 — 같은 학생(김소리) · 같은 문항 · 같은 결과
 *   과제 목록에 한 줄(taskKey 'rat'), 그 과제를 고르면 명단은 김소리만, 상세는 문항마다 피드백 · 채점 근거 · 원본 필기 · 필기 재생이 그 문항 것 */
export const RAT_TEACHER_TASK = {
  id: 'rat', taskKey: 'rat', type: '수학', title: MATH_RAT_TASK.title.replace(/^\[수학\]\s*/, ''), date: '2026.10.14', submissions: '2/2', description: '학생 모드 시연 과제', resultMode: 'score',
  questions: MATH_RAT_TASK.questions.map((q, i) => ({ id: i + 1, title: q.label, score: q.point, sheets: 2, description: q.text })),
};
const ratBasis = [
  {
    criterion: '두 점근선과 지나는 점으로 유리함수의 식을 세우고, 그래프를 그려 식을 구하는 과정을 바르게 썼는가?',
    summary: '그래프와 점근선으로 식의 꼴을 정하고 점 (3, 0)을 대입해 k = 1을 정확히 구했으나, 대입한 줄에 등호를 하나 더 쓰고 마지막 답에 「y =」를 빠뜨렸습니다.',
    rows: [
      { status: '충족', req: '그래프 그리기', reason: '두 점근선을 점선으로 먼저 그리고 점 (3, 0)을 지나는 두 갈래 곡선을 그렸습니다.', quote: '(그래프 · 점선 점근선 · (3, 0))' },
      { status: '충족', req: '점근선으로 식의 꼴 설정', reason: '점근선 x = 2, y = −1을 이용해 y = k/(x−2) − 1 (k ≠ 0)로 두었습니다.', quote: 'y = k/(x−2) − 1 (k ≠ 0)로 둔다' },
      { status: '충족', req: '점 대입으로 k 구하기', reason: 'x = 3, y = 0을 대입해 k = 1을 구했습니다. 대입한 줄에 「= −1」로 등호를 하나 더 쓴 표기 오류가 있습니다.', quote: '0 = k/(3−2) = −1 · 0 = k − 1 · ∴ k = 1' },
      { status: '미충족', req: '함수식으로 답 쓰기', reason: '「y =」 없이 식의 오른쪽만 써서 함수의 식으로 답하지 못했습니다.', quote: '∴ 유리함수식 1/(x−2) − 1' },
    ],
    notUpper: '「함수식으로 답 쓰기」가 미충족이라 만점에 이르지 못했습니다.',
    notLower: '식의 꼴 설정과 k 계산이 정확해 채점 기준 3개를 충족했습니다.',
  },
  {
    criterion: '유리함수의 정의역과 치역을 점근선과 연결해 바르게 구했는가?',
    summary: '분모가 0이 되는 x = 2와 가로 점근선 y = −1을 이용해 정의역과 치역을 모두 정확하게 구했습니다.',
    rows: [
      { status: '충족', req: '정의역 구하기', reason: '분모가 0이 되는 x = 2만 빼서 정의역을 정확히 구했습니다.', quote: '정의역 : x ≠ 2 인 모든 실수' },
      { status: '충족', req: '치역 구하기', reason: '가로 점근선 y = −1을 이용해 치역을 정확히 구했습니다.', quote: '치역 : y ≠ −1 인 모든 실수' },
    ],
    notUpper: '', notLower: '채점 기준을 모두 충족했습니다.',
  },
];
/* 문항마다 상세에 쓸 값 — 피드백 · 학습 안내 · 채점 근거 · 등급(점수 과제라 점수 중심) */
export const RAT_TEACHER_QDATA = Object.fromEntries(MATH_RAT_TASK.questions.map((q, i) => [i + 1, {
  good: q.fb[0], effort: q.fb[1], grow: q.fb[2], guide: q.guide, basis: ratBasis[i],
  letter: q.grade, label: q.chip, scale: '5단계 기준',
}]));
export const RAT_TEACHER_STUDENT = {
  id: 301, name: '김소리', grade: '3학년 1반 1번', submitType: 'pen', aiGrade: '우수', teacherGrade: '우수', status: '결과 발송 완료', sentMode: 'score',
  taskKey: 'rat', round: 1, history: [], aiCount: { 1: 1, 2: 0 }, sheetNo: 'R-0001', penStats: { strokes: 194, durationSec: 112 },
  aiScore: 5, teacherScore: 5,
  qData: RAT_TEACHER_QDATA,
  /* AI 필기 분석 — 학생 모드와 같은 결과(문항 1 기준: 심사숙고 확신형 cba · 총평) */
  handwritingEvaluation: {
    patternCode: 'cba',
    systemDataLog: { processPattern: '심사숙고 확신형', metricsCode: 'Time-c, Coord-b, Hesit-a', gradeLevel: 'B' },
    evaluationSummary: { diagnosedPattern: '심사숙고 확신형', totalEvaluation: MATH_RAT_TASK.questions[0].hw.summary },
    finalFeedback: { whatsGood: '', whatNeedsWork: '', letsGrowTogether: '', contentBottleneckAnalysis: '' },
  },
  /* 원본 보기 · 필기 재생 — 문항마다 학생 모드와 같은 데이터(문항 1 = 실제 펜, 문항 2 = 글자 흉내) */
  replayQ: Object.fromEntries(MATH_RAT_TASK.questions.map((q, i) => [i + 1, q])),
};

/* [교사 첨삭 예제] 채점 확인 단계 학생 — AI 채점이 끝나고 교사가 확인 중이라 원본 보기에서 교사펜 첨삭을 할 수 있다.
 *   필기 · AI 결과는 시연용으로 김소리와 같은 펜 샘플을 쓴다(교사 첨삭은 학생마다 따로 저장) */
export const RAT_TEACHER_STUDENT_2 = {
  ...RAT_TEACHER_STUDENT,
  id: 302, name: '박지후', grade: '3학년 1반 2번', status: '채점 확인', teacherGrade: '-', teacherScore: undefined,
  sentMode: undefined, sheetNo: 'R-0002',
};
