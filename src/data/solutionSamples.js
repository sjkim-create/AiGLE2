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
  en: { subject: 'Math', cap: 'Smart pen upload · 2026.10.15 16:20' },
  subject: '수학', full: 4, pub: '2026. 10. 14', done: '2026년 10월 15일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.10.15 16:20',
  passage: null, hasProcess: true,
  questions: [
    {
      label: '문항 1', point: 4, score: 3, grade: 'B', chip: '우수', chipCls: 'b',
      text: '두 점근선이 x = 2, y = −1이고 점 (3, 0)을 지나는 유리함수의 그래프를 그리고, 이 유리함수의 식을 구하시오.',
      answer: ['점근선 x = 2, y = −1', 'y = k/(x−2) − 1 (k ≠ 0)로 둔다', '그래프가 점 (3, 0)을 지나므로 x = 3, y = 0 대입', '0 = k/(3−2) = −1 → 0 = k − 1 ∴ k = 1', '∴ 유리함수식 1/(x−2) − 1'],
      pen: PEN_RATIONAL, penFrom: PEN_FROM,
      en: { label: 'Q1', text: 'Draw the graph of a rational function whose asymptotes are x = 2 and y = −1 and which passes through (3, 0), then find its equation.' },
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
          },
          {
            ask: '마지막 답을 함수식으로 써 봐요.',
            written: '"유리함수식 1/(x−2) − 1"',
            whenTo: '구한 k를 넣어 식을 완성할 때',
            example: '따라서 구하는 유리함수의 식은 y = 1/(x−2) − 1 이다.',
            tip: '「y =」가 있어야 함수의 식이 돼요.',
            check: 'x = 3을 넣었을 때 y = 0이 나오는지 확인해요.',
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
  ],
};
