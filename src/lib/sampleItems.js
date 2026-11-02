/**
 * sampleItems.js — 정답형 스마트 등록 「샘플 문제로 해 보기」
 *
 * 배포 버전(AI 키 없음)에서도 스마트 등록 → 확인 → 문제 은행 저장 → 문제집 묶기를 끝까지 해 볼 수 있게 한다.
 *   · makeSampleFile — 샘플 시험지 한 장을 그림(PNG) 파일로 만든다 (원본 미리 보기·쪽 이미지용)
 *   · analyzeSample  — AI 응답 대신 고정 결과를 돌려준다 (extractItemsFromFile의 analyze 자리)
 * 성취기준 코드를 문항마다 넣어 AI 단원 배정 없이도 단원이 연결된다.
 */

export const SAMPLE_FILE_NAME = '샘플_중1_일차방정식_확인평가.png';

const SAMPLE = {
  isItemSource: true,
  reason: '',
  meta: { schoolLevel: 'MIDDLE', studentGrade: '1학년', subject: '수학', title: '중1 일차방정식 확인 평가 (샘플)', standardCodes: ['9수02-03', '9수02-04'], scopeUnits: ['문자와 식'], track: 'curriculum', skill: '' },
  passages: [],
  items: [
    { number: '1', itemType: 'multiple_choice', stem: '다음 중 방정식인 것은?', material: '', choices: [{ no: 1, text: '2x + 3' }, { no: 2, text: '3x − 1 = 5' }, { no: 3, text: 'x + 2 > 4' }, { no: 4, text: '5 + 2 = 7' }, { no: 5, text: '4x' }], answer: { choices: [2] }, answerSource: 'file', explanation: '미지수를 포함한 등식이 방정식이다.', points: 3, standardCodes: ['9수02-03'] },
    { number: '2', itemType: 'multiple_choice', stem: '방정식 2x + 3 = 7의 해는?', material: '', choices: [{ no: 1, text: '1' }, { no: 2, text: '2' }, { no: 3, text: '3' }, { no: 4, text: '4' }, { no: 5, text: '5' }], answer: { choices: [2] }, answerSource: 'file', explanation: '2x = 4이므로 x = 2', points: 3, standardCodes: ['9수02-04'] },
    { number: '3', itemType: 'true_false', stem: 'x = 4는 방정식 3x = 12의 해이다.', material: '', choices: [], answer: { truth: true }, answerSource: 'file', explanation: '3 × 4 = 12', points: 2, standardCodes: ['9수02-03'] },
    { number: '4', itemType: 'true_false', stem: '등식의 양변에 같은 수를 곱해도 등식은 성립한다.', material: '', choices: [], answer: { truth: true }, answerSource: 'file', explanation: '등식의 성질', points: 2, standardCodes: ['9수02-03'] },
    { number: '5', itemType: 'short_answer', stem: '방정식 x − 5 = 3의 해를 쓰시오.', material: '', choices: [], answer: { texts: ['8', 'x=8', 'x = 8'] }, answerSource: 'file', explanation: 'x = 3 + 5 = 8', points: 3, standardCodes: ['9수02-04'] },
    { number: '6', itemType: 'short_answer', stem: '방정식 4x − 7 = 2x + 5의 해를 쓰시오.', material: '', choices: [], answer: { texts: ['6', 'x=6', 'x = 6'] }, answerSource: 'file', explanation: '2x = 12이므로 x = 6', points: 4, standardCodes: ['9수02-04'] },
    { number: '7', itemType: 'completion', stem: '등식 a = b이면 a + c = b + [빈칸]이다. 빈칸에 알맞은 것을 쓰시오.', material: '', choices: [], blanks: 1, answer: { blanks: [['c']] }, answerSource: 'file', explanation: '등식의 양변에 같은 수를 더해도 등식은 성립한다.', points: 2, standardCodes: ['9수02-03'] },
    { number: '8', itemType: 'binary_choice', stem: '방정식 x + 3 = 3x − 1의 해는 (홀수 / 짝수)이다. 맞는 것을 고르시오.', material: '', choices: [{ no: 1, text: '홀수' }, { no: 2, text: '짝수' }], answer: { choices: [2] }, answerSource: 'file', explanation: '2x = 4이므로 x = 2', points: 2, standardCodes: ['9수02-04'] },
    { number: '9', itemType: 'matching', stem: '각 방정식과 그 해를 바르게 연결하시오.', material: '', choices: [], matching: { left: ['x + 1 = 4', '2x = 10', 'x − 2 = 0'], right: ['x = 2', 'x = 3', 'x = 5'] }, answer: { pairs: [[1, 2], [2, 3], [3, 1]] }, answerSource: 'file', explanation: '', points: 3, standardCodes: ['9수02-04'] },
    { number: '10', itemType: 'short_answer', stem: '어떤 수의 3배에서 4를 뺀 값은 11이다. 어떤 수를 구하시오.', material: '', choices: [], answer: { texts: ['5'] }, answerSource: 'file', explanation: '3x − 4 = 11, 3x = 15, x = 5', points: 4, standardCodes: ['9수02-04'] },
  ].map((it) => ({ matching: null, blanks: 0, unit: '', passageKey: null, page: 1, images: [], ...it, answer: { choices: [], truth: null, texts: [], blanks: [], pairs: [], model: '', ...it.answer } })),
  unreadable: [],
};

/** AI 응답 자리 — 고정 결과 (조금 기다렸다가 돌려줘 진행 단계가 보이게) */
export const analyzeSample = async () => {
  await new Promise((r) => setTimeout(r, 700));
  return JSON.parse(JSON.stringify(SAMPLE));
};

/** 샘플 시험지 한 장(A4 비율 PNG) — 문항 글을 그대로 그린다 */
export const makeSampleFile = async () => {
  const W = 1240; const H = 1754;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#111827'; g.textBaseline = 'top';
  g.font = 'bold 44px sans-serif'; g.fillText(SAMPLE.meta.title, 80, 70);
  g.font = '26px sans-serif'; g.fillStyle = '#6B7280'; g.fillText('샘플 자료 · 중학교 1학년 수학 · 문자와 식', 80, 132);
  g.fillRect(80, 180, W - 160, 2);
  let y = 210;
  g.fillStyle = '#111827';
  SAMPLE.items.forEach((it) => {
    g.font = 'bold 28px sans-serif'; g.fillText(`${it.number}.`, 80, y);
    g.font = '28px sans-serif'; g.fillText(`${it.stem.replaceAll('[빈칸]', '(     )')}${it.points ? ` [${it.points}점]` : ''}`, 130, y);
    y += 46;
    if (it.choices.length) { g.font = '26px sans-serif'; g.fillText(it.choices.map((ch) => `${'①②③④⑤'[ch.no - 1] || ch.no + ')'} ${ch.text}`).join('    '), 130, y); y += 44; }
    if (it.matching) { g.font = '26px sans-serif'; it.matching.left.forEach((l, i) => { g.fillText(`${l}   ·        ·   ${it.matching.right[i]}`, 160, y); y += 38; }); }
    y += 40;
  });
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return new File([blob], SAMPLE_FILE_NAME, { type: 'image/png' });
};
