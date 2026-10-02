/**
 * StudentMyTasks.jsx — 학생 모드 › 내 과제
 *
 * 학생 화면 목업(학생모드_내과제.html)의 목록 · 상세를 그대로 옮긴다.
 *   · 목록: 상태 필터(전체 · 미제출 · 채점중 · 결과 확인) + 과제명 검색 + 과제 카드
 *   · 상세: 문항 탭 → [채점 결과] [과제 내용] 두 탭 + 우측 채점 완료 · 답안 미리보기 · [리포트 PDF 다운로드]
 *
 * [채점 결과] 탭은 학생에게 가는 리포트(POP-19 채점 결과 내보내기)와 같은 순서·내용을 싣는다.
 *   등급(점수) → 학습 피드백(좋아요 · 노력 · 성장) → 학습 안내 → AI 필기 분석(캐릭터 + 총평)
 *   · 리포트의 「지문 + 문항」은 [과제 내용] 탭이 맡는다
 *   · 목업의 「내용 분석」은 교사 전용 「채점 근거」(SCR-03 v5.2)로 옮겨 갔으므로 학생 화면에 싣지 않는다
 *   · 목업의 행동 지표 · 풀이 과정 밀착 가이드는 SCR-03 v5.8에서 삭제 — 캐릭터와 총평만 남긴다
 */
import React, { useState, useRef, useEffect } from 'react';
import { PATTERN_CHARACTERS, gradeFeedbackOf, PROCESS_INSUFFICIENT_MESSAGE } from './GradingReviewModal';
import { lookupPattern } from './handwritingPatternMatrix';

const STUDENT = { cls: '3학년 1반 1번', name: '김소리', id: 'stu2600394a1n' };

/* ── 지문 ── */
const MATH_PASSAGE = (
  <>
    <div className="smt-prose">
      <p>다음은 민아의 하루 일과 내용이다. 물음에 답하시오.</p>
      <p>&lt;민아의 일기&gt;<br />오늘은 과학관 견학이 있는 날이다.<br />지하철을 타기 위해 카드를 찍었더니 교통카드에 남은 잔액이 ‘4240원’이라고 표시되었다.<br />며칠 전에 10000원을 충전한 다음 지하철만 이용한 후에 남은 금액이고,<br />지하철을 몇 번 이용한 것인지 궁금하여 지하철 요금표를 찾아보니 다음과 같았다.</p>
    </div>
    <table className="smt-pt">
      <thead><tr><th scope="col"><span className="smt-sr">구분</span></th><th scope="col">어른</th><th scope="col">청소년</th><th scope="col">어린이</th></tr></thead>
      <tbody><tr><th scope="row">지하철 요금</th><td>1250원</td><td>720원</td><td>450원</td></tr></tbody>
    </table>
    <div className="smt-prose">
      <p>과학관에 도착하여 입장료를 내야 하는데, 어른의 입장료는 청소년 입장료의 2배나 되었다.<br />청소년 8명, 어른 1명의 입장료로 선생님께서 총 2만원을 지불하셨다.<br />과학관 견학이 끝나고, 설명을 너무나 잘해주신 우리 선생님께 비밀스럽게 나이를 여쭈어보았더니, 다음과 같이 말씀해주셨다.<br />“선생님 나이가 궁금해? 선생님 나이는 6년 후가 되면 민아 나이의 2배보다 5살이 적어.”<br />집에 돌아올 때는 친구들과 함께 지하철 안에서 신나게 수다를 떨며 재미있게 돌아왔다.</p>
    </div>
  </>
);

const KOR_PASSAGE = (
  <div className="smt-prose">
    <p>다음 글을 읽고 물음에 답하시오.</p>
    <p>SNS는 이용자가 직접 정보를 생산하고 유통한다는 점에서 기존의 대중 매체와 구별된다. 신문이나 방송에서는 정보를 만드는 쪽과 받아들이는 쪽이 뚜렷하게 나뉘어 있었지만, SNS에서는 한 사람이 두 역할을 동시에 수행한다. 게시물을 올리는 순간 생산자가 되고, 다른 사람의 글을 읽는 순간 수용자가 된다.</p>
    <p>이러한 구조는 정보의 확산 속도를 크게 높인다. 공유와 인용이 한 번의 동작으로 이루어지기 때문에, 하나의 게시물이 짧은 시간 안에 수많은 이용자에게 전달될 수 있다. 그러나 같은 이유로 검증되지 않은 정보 또한 빠르게 퍼진다. 전달되는 과정에서 원래의 맥락이 잘려 나가거나, 특정 부분만 강조되어 본래의 의미와 다르게 읽히는 일도 잦다.</p>
    <p>따라서 SNS를 이용할 때에는 정보를 받아들이는 태도와 함께, 전달하는 사람으로서의 책임을 함께 고려해야 한다. 내가 공유한 한 건의 게시물이 다른 누군가에게는 판단의 근거가 될 수 있기 때문이다.</p>
  </div>
);

/* ── 과제 데이터 (프로토타입 고정 — 실제는 결과 발송된 채점 결과) ──
 *   fb    : 학습 피드백 [좋아요, 노력, 성장]
 *   guide : 학습 안내 { title, points[], items[{ ask, written, whenTo, example, tip, check }] }
 *   hw    : AI 필기 분석 { code(3축), summary(총평) } — 과제에 과정 분석이 포함됐을 때만 */
const ASSIGN = {
  math: {
    title: '[수학] 민아의 일기 속 상황을 일차방정식으로 세우기',
    subject: '수학', full: 6, pub: '2026. 09. 02', done: '2026년 9월 2일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.09.02 21:04',
    passage: MATH_PASSAGE, hasProcess: true,
    questions: [
      {
        label: '문항 1', point: 2, score: 1, grade: 'B', chip: '우수', chipCls: 'b',
        text: '민아가 지하철을 이용한 횟수를 a회라 할 때, 교통카드의 남은 잔액에 대한 관계를 일차방정식으로 나타내고, a의 값을 구하시오.',
        answer: ['지하철을 a회 이용하면 요금은 720a원 이므로 남은 잔액은 10000 − 720a', '∴ 교통카드 잔액 = 10000 − 720a  (a = 8)'],
        fb: [
          '문제 상황을 분석하여 ‘10000 − 720a’라는 핵심적인 관계식을 도출해낸 점, 미지수 a의 의미를 문장으로 명확히 정의한 점이 우수합니다.',
          '문제에서 요구한 것은 ‘일차방정식’이므로, 구한 식을 현재 잔액인 4240원과 등호(=)로 연결하여 ‘10000 − 720a = 4240’과 같은 형태로 완성하는 연습이 필요합니다.',
          '식의 의미를 설명하는 논리적인 서술 능력이 좋습니다. 방정식의 정의인 ‘등식’의 형태만 갖춘다면 완벽한 답안이 될 것입니다.',
        ],
        /* 채점 확인 상세 · 리포트가 쓰는 같은 문항의 학습 안내를 그대로 */
        guide: gradeFeedbackOf('우수').guide,
        hw: { code: 'cba', summary: '확정 등급 B를 받은 이번 답안은 문항이 요구한 ‘일차방정식’의 형태를 갖추는 데 있어 핵심적인 수치 하나를 놓친 아쉬움이 있습니다. 풀이 과정에서 불필요한 되돌아감 없이 논리적으로 식을 세워나갔으나, 지문에 명시된 현재 잔액(4240원)을 등식의 결과로 연결하지 못했습니다. 풀이 중간에 발생한 장시간의 정지는 전체적인 식의 구조를 잡는 과정에서의 고민으로 보입니다.' },
      },
      {
        label: '문항 2', point: 2, score: 2, grade: 'A', chip: '매우 우수', chipCls: 'a',
        text: '청소년 입장료를 x원이라 할 때, 선생님께서 지불하신 총 입장료에 대한 일차방정식을 세우고 x의 값을 구하시오. (어른 입장료는 청소년 입장료의 2배이다.)',
        answer: ['청소년 입장료를 x라 하면 8x + 2x = 20000', '10x = 20000   ∴ x = 2000원'],
        fb: [
          '어른 입장료가 청소년의 2배라는 조건을 2x로 정확히 옮기고, 인원수를 곱해 총액과 연결한 뒤 등호까지 완성하여 방정식의 요건을 모두 갖추었습니다.',
          '정리 과정에서 10x = 20000이 나오는 중간 단계를 한 줄 더 적어두면, 검산할 때 어디서 틀렸는지 스스로 찾기 쉬워집니다.',
          '미지수를 무엇으로 둘지 먼저 선언하는 습관이 잘 잡혀 있습니다. 이 습관을 문장제 전반에 그대로 적용해 보세요.',
        ],
        guide: {
          title: '배수 관계를 미지수 하나로 나타내기',
          points: [
            '두 값 사이에 «몇 배» 관계가 있으면, 기준이 되는 값 하나만 미지수로 두고 나머지는 그 미지수로 표현해요.',
            '「총액 = 1인 요금 × 인원」을 사람 종류마다 세운 뒤 더해요.',
            '구한 값을 원래 조건에 넣어 총액이 맞는지 확인해요.',
          ],
          items: [
            {
              ask: '좌변을 정리하는 중간 단계를 한 줄 더 적어 봐요.',
              written: '"8x + 2x = 20000"',
              whenTo: '같은 미지수를 가진 항을 하나로 모을 때',
              example: '8x + 2x = 10x 이므로 10x = 20000 이고, 양변을 10으로 나누면 x = 2000 이다.',
              tip: '중간 식을 남겨 두면 검산할 때 틀린 곳을 바로 찾을 수 있어요.',
              check: '구한 x = 2000을 넣었을 때 8 × 2000 + 2 × 2000 = 20000이 되는지 확인해요.',
            },
          ],
        },
        hw: { code: 'baa', summary: '조건을 식으로 옮기는 단계에서 망설임이 거의 없었고, 식을 세운 직후 곧바로 정리와 계산으로 이어져 흐름이 끊기지 않았습니다. 되돌아감이 전혀 없고 평균 획 간격도 안정적이어서 문제 구조를 먼저 파악한 뒤 필기를 시작한 것으로 보입니다.' },
      },
      {
        label: '문항 3', point: 2, score: 1, grade: 'C', chip: '보통', chipCls: 'c',
        text: '민아의 나이가 16살일 때, 선생님의 현재 나이를 y라 하고 일차방정식을 세워 y의 값을 구하시오.',
        answer: ['선생님 나이를 y라 하면 y + 6 = 2 × 16 − 5'],
        fb: [
          '‘6년 후’라는 조건을 y + 6으로 바꾸어 식의 왼쪽을 정확하게 세웠습니다.',
          '‘2배보다 5살이 적다’를 2 × 16 − 5로 옮긴 것은 맞지만, 이후 y의 값을 구하는 단계가 빠져 있습니다.',
          '조건을 하나씩 끊어 읽고 식으로 옮기는 힘이 있습니다. 마지막 계산까지 습관적으로 이어 붙이면 점수가 크게 올라갑니다.',
        ],
        guide: {
          title: '나이 문제를 방정식으로 세우고 끝까지 풀기',
          points: [
            '«지금»과 «몇 년 후»처럼 시점이 다르면, 시점마다 나이를 따로 식으로 적어요.',
            '「~의 2배보다 5 적다」처럼 말로 된 관계는 «2 × □ − 5»처럼 순서대로 옮겨요.',
            '방정식을 세운 뒤에는 반드시 미지수의 값을 구하고 단위를 붙여 마무리해요.',
          ],
          items: [
            {
              ask: '세운 방정식의 우변을 먼저 계산해 봐요.',
              written: '"y + 6 = 2 × 16 − 5"',
              whenTo: '숫자만 있는 쪽을 하나의 수로 정리할 때',
              example: '2 × 16 − 5 = 27 이므로 방정식은 y + 6 = 27 이 된다.',
              tip: '곱셈을 먼저, 뺄셈을 나중에 계산하는 순서를 지켜요.',
              check: '우변이 하나의 수로 정리됐는지 확인해요.',
            },
            {
              ask: '이항해서 y의 값을 구하고 답을 문장으로 마무리해 봐요.',
              written: '(y의 값을 구하는 과정이 없었어요)',
              whenTo: '방정식에서 미지수만 한쪽에 남길 때',
              example: '양변에서 6을 빼면 y = 21 이므로 선생님의 현재 나이는 21살이다.',
              tip: '마지막 줄에 «따라서 ~은 ○○이다»를 쓰는 습관을 들여요.',
              check: '구한 값을 원래 조건에 넣어 6년 후 27살이 맞는지 확인해요.',
            },
          ],
        },
        hw: { code: 'cbc', summary: '조건을 식으로 옮기는 앞부분에 시간을 충분히 썼고 그 결과 등식의 좌변과 우변 모두 정확합니다. 다만 식을 완성한 시점에서 필기가 멈추었고, 이후 15초 이상 입력이 없다가 제출로 이어졌습니다. 계산 단계로 넘어가지 못하고 종료된 패턴입니다.' },
      },
    ],
  },

  kor: {
    title: '[국어] SNS 특성 분석하기 자율 5단계',
    subject: '공통국어2', full: 4, pub: '2026. 08. 25', done: '2026년 8월 31일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.08.31 19:22',
    passage: KOR_PASSAGE, hasProcess: false,
    questions: [
      {
        label: '문항 1', point: 2, score: 2, grade: 'A', chip: '매우 우수', chipCls: 'a',
        text: '윗글을 바탕으로 SNS가 기존 대중 매체와 구별되는 지점을 한 문장으로 서술하시오.',
        answer: ['SNS는 생산자와 수용자가 나뉘어 있지 않고', '한 사람이 두 역할을 동시에 한다는 점에서 다르다.'],
        fb: [
          '지문의 핵심인 ‘생산자와 수용자의 경계 소멸’을 정확히 짚어냈고, 기존 매체와의 대비 구조를 한 문장 안에 담아냈습니다.',
          '‘다르다’보다 ‘구별된다’처럼 지문의 어휘를 그대로 활용하면 근거가 더 분명해집니다.',
          '핵심을 먼저 쓰고 부연을 뒤에 붙이는 구성이 좋습니다. 서술형 문항에서 계속 유지해 보세요.',
        ],
        guide: {
          title: '두 대상을 대비해 한 문장으로 쓰기',
          points: [
            '비교하는 두 대상(SNS · 기존 대중 매체)의 차이가 드러나는 문단을 먼저 찾아요.',
            '「A는 ~인 반면, B는 ~이다」처럼 대비 구조를 한 문장에 담아요.',
            '지문의 핵심 어휘를 그대로 가져오면 근거가 분명해져요.',
          ],
          items: [
            {
              ask: '지문의 어휘를 살려 서술어를 바꾸어 써 봐요.',
              written: '"~한다는 점에서 다르다."',
              whenTo: '지문이 쓴 개념어로 답을 맺을 때',
              example: 'SNS는 한 사람이 정보의 생산자이자 수용자가 된다는 점에서 기존의 대중 매체와 구별된다.',
              tip: '‘다르다’보다 지문의 ‘구별된다’를 쓰면 근거와 답이 바로 이어져요.',
              check: '답에 비교 대상(기존 대중 매체)이 함께 드러났는지 확인해요.',
            },
          ],
        },
      },
      {
        label: '문항 2', point: 2, score: 1, grade: 'C', chip: '보통', chipCls: 'c',
        text: '윗글에서 설명한 SNS의 빠른 정보 확산이 가지는 긍정적 측면과 부정적 측면을 각각 한 가지씩 쓰시오.',
        answer: ['좋은 점은 정보가 빨리 퍼지는 것이고', '나쁜 점은 거짓 정보도 빨리 퍼지는 것이다.'],
        fb: [
          '확산 속도라는 하나의 특성이 양면으로 작동한다는 구조를 파악했습니다.',
          '‘좋은 점 / 나쁜 점’이라는 표현 대신 지문에 제시된 ‘맥락의 훼손’처럼 구체적인 근거를 들어야 점수가 올라갑니다. 지금 답안은 질문을 다시 옮겨 적은 수준에 가깝습니다.',
          '두 측면을 나누어 쓰는 틀은 잘 잡았습니다. 각 측면마다 지문의 문장을 하나씩 근거로 붙이는 연습을 해봅시다.',
        ],
        guide: {
          title: '지문의 근거로 양면성 설명하기',
          points: [
            '긍정적 측면과 부정적 측면을 각각 지문의 어느 문장에서 찾았는지 표시해 봐요.',
            '질문을 다시 옮겨 적지 말고, 지문의 구체적인 내용으로 채워요.',
            '두 측면을 같은 형식의 문장으로 나란히 쓰면 읽기 쉬워요.',
          ],
          items: [
            {
              ask: '긍정적 측면을 지문의 표현으로 구체적으로 써 봐요.',
              written: '"좋은 점은 정보가 빨리 퍼지는 것이고"',
              whenTo: '장점을 근거와 함께 밝힐 때',
              example: '공유와 인용이 한 번의 동작으로 이루어져, 하나의 게시물이 짧은 시간 안에 많은 이용자에게 전달된다.',
              tip: '‘빨리 퍼진다’가 왜 가능한지(공유·인용)를 함께 쓰면 근거가 돼요.',
              check: '답의 근거가 지문 둘째 문단에 있는지 확인해요.',
            },
            {
              ask: '부정적 측면에 지문의 ‘맥락’ 이야기를 더해 써 봐요.',
              written: '"나쁜 점은 거짓 정보도 빨리 퍼지는 것이다."',
              whenTo: '단점을 구체적인 사례로 설명할 때',
              example: '검증되지 않은 정보가 빠르게 퍼지고, 전달 과정에서 원래의 맥락이 잘려 본래 의미와 다르게 읽힐 수 있다.',
              tip: '‘거짓 정보’ 하나로 끝내지 말고 지문이 든 두 번째 문제(맥락 훼손)까지 써요.',
              check: '긍정 · 부정 두 측면이 모두 지문의 근거로 채워졌는지 확인해요.',
            },
          ],
        },
      },
    ],
  },

  /* 지문 없이 문항만 등록된 과제 */
  nopass: {
    title: '[국어] 내 생각 쓰기 — 우리 반 규칙 제안하기',
    subject: '공통국어2', full: 4, pub: '2026. 04. 28', done: '2026년 4월 28일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.04.28 16:40',
    passage: null, hasProcess: false,
    questions: [
      {
        label: '문항 1', point: 2, score: 2, grade: 'A', chip: '매우 우수', chipCls: 'a',
        text: '우리 반에 새로 만들고 싶은 규칙을 한 가지 제안하고, 그 규칙이 필요한 이유를 두 가지 이상 들어 서술하시오.',
        answer: ['쉬는 시간에 교실 뒤쪽을 비워두자고 제안한다.', '이유는 첫째 이동이 편해지고, 둘째 다툼이 줄어들기 때문이다.'],
        fb: [
          '제안을 한 문장으로 분명하게 밝힌 뒤 근거를 번호로 나누어 제시해, 읽는 사람이 주장과 근거를 바로 구분할 수 있습니다.',
          '근거 두 가지가 모두 한 문장에 묶여 있습니다. 각각을 한 문장씩으로 나누면 설득력이 더 살아납니다.',
          '주장을 먼저 쓰고 근거를 뒤에 붙이는 구조가 안정적입니다. 여기에 예상되는 반대 의견을 한 줄 덧붙이면 훨씬 단단한 글이 됩니다.',
        ],
        guide: {
          title: '주장과 근거를 나누어 쓰기',
          points: [
            '첫 문장에 제안(주장)을 분명히 밝혀요.',
            '근거는 하나에 한 문장씩, «첫째 · 둘째»로 나누어 써요.',
            '근거마다 «그러면 어떻게 좋아지는지»를 덧붙여요.',
          ],
          items: [
            {
              ask: '한 문장에 묶인 두 근거를 각각 한 문장으로 나누어 써 봐요.',
              written: '"첫째 이동이 편해지고, 둘째 다툼이 줄어들기 때문이다."',
              whenTo: '근거가 두 가지 이상일 때',
              example: '첫째, 교실 뒤쪽이 비어 있으면 쉬는 시간에 이동이 편해진다. 둘째, 자리를 두고 부딪히는 일이 줄어 다툼이 줄어든다.',
              tip: '근거마다 문장을 나누면 각 근거가 얼마나 타당한지 읽는 사람이 판단하기 쉬워요.',
              check: '근거가 두 문장 이상으로 나뉘었는지 확인해요.',
            },
          ],
        },
      },
      {
        label: '문항 2', point: 2, score: 1, grade: 'C', chip: '보통', chipCls: 'c',
        text: '문항 1에서 제안한 규칙에 반대하는 사람이 있다면 어떤 이유를 들지 예상하고, 그에 대한 자신의 생각을 쓰시오.',
        answer: ['짐을 둘 곳이 없다고 할 것 같다.'],
        fb: [
          '반대 이유를 구체적인 상황으로 떠올린 점이 좋습니다. 실제로 나올 법한 의견입니다.',
          '문항이 요구한 두 가지 중 ‘그에 대한 자신의 생각’이 빠져 있습니다. 반대 이유를 적은 뒤 그에 어떻게 답할지까지 써야 답안이 완성됩니다.',
          '상대 입장을 떠올리는 힘은 이미 있습니다. 거기서 한 걸음 더 나아가 ‘그래서 나는 이렇게 생각한다’를 붙이는 연습을 해봅시다.',
        ],
        guide: {
          title: '반대 의견을 예상하고 답하기',
          points: [
            '문항이 요구한 것이 몇 가지인지 먼저 세어 봐요. (반대 이유 + 내 생각)',
            '반대 이유를 인정할 부분은 인정하고, 그래도 내 제안이 필요한 까닭을 써요.',
            '반대 의견을 줄일 수 있는 방법(보완책)을 함께 제시하면 설득력이 커져요.',
          ],
          items: [
            {
              ask: '예상한 반대 이유에 대한 나의 생각을 이어서 써 봐요.',
              written: '"짐을 둘 곳이 없다고 할 것 같다."',
              whenTo: '반대 의견에 답할 때',
              example: '짐을 둘 곳이 없다는 걱정은 이해한다. 그래서 사물함 위나 복도 선반을 함께 쓰자고 제안하면, 교실 뒤쪽을 비워도 불편이 줄어들 것이다.',
              tip: '「~라는 걱정은 이해한다. 그래서 ~」처럼 인정 → 보완 순서로 써요.',
              check: '반대 이유와 내 생각이 모두 들어갔는지 확인해요.',
            },
          ],
        },
      },
    ],
  },
};

/* 제출 완료(채점중) 과제 — 결과가 발송되기 전이라 채점 결과 데이터가 없다 */
ASSIGN.sci = {
  title: '[과학] 물질의 상태 변화 관찰 기록 쓰기',
  subject: '과학', full: 4, pub: '2026. 09. 24', done: '2026년 9월 25일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.09.25 20:11',
  passage: null,
  questions: [
    { label: '문항 1', point: 2, text: '얼음이 녹아 물이 되는 과정을 관찰한 내용을 쓰고, 이때 일어나는 상태 변화의 이름을 쓰시오.',
      answer: ['얼음을 컵에 두었더니 가장자리부터 물로 바뀌었다.', '고체가 액체로 바뀌는 것이므로 융해이다.'] },
    { label: '문항 2', point: 2, text: '물이 끓어 수증기가 될 때 열의 출입을 설명하고, 생활 속 예를 한 가지 쓰시오.',
      answer: ['물이 끓을 때는 열을 흡수한다.', '예) 젖은 빨래가 마른다.'] },
  ],
};
ASSIGN.mathEq = {
  title: '[수학] 연립방정식의 활용 — 거리 · 속력 · 시간',
  subject: '수학', full: 3, pub: '2026. 09. 26', done: '2026년 9월 29일', way: '스마트펜 업로드', cap: '스마트펜 업로드 · 2026.09.29 19:47',
  passage: null,
  questions: [
    { label: '문항 1', point: 3, text: '집에서 도서관까지 가는 데 처음에는 시속 4km로 걷다가 나머지는 시속 12km로 자전거를 타서 모두 1시간이 걸렸다. 전체 거리가 8km일 때, 걸은 거리와 자전거로 간 거리를 각각 구하시오.',
      answer: ['걸은 거리 x, 자전거 거리 y', 'x + y = 8,  x/4 + y/12 = 1', '∴ x = 2km, y = 6km'] },
  ],
};

/* status — done: 결과 확인(TSK-10) · submitted: 제출 완료 · 채점중(TSK-09) */
const CARDS = [
  { key: 'mathEq', status: 'submitted', pub: '2026-09-26', sub: '2026-09-29', point: '3점' },
  { key: 'sci', status: 'submitted', pub: '2026-09-24', sub: '2026-09-25', point: '4점' },
  { key: 'math', status: 'done', pub: '2026-09-02', sub: '2026-09-02', point: '6점' },
  { key: 'kor', status: 'done', pub: '2026-08-25', sub: '2026-08-31', point: '4점' },
  { key: 'nopass', status: 'done', pub: '2026-04-28', sub: '2026-04-28', point: '4점' },
  { key: 'kor', status: 'done', pub: '2026-04-13', sub: '2026-04-15', point: '4점', title: '[국어] 1학년_엮어 읽고 쓰기 — 소희의 그늘, 나의 봄', subject: '공통국어1', detailPub: '2026. 04. 13' },
];

const STATUS = {
  todo: { label: '미제출', cls: 'todo' },
  submitted: { label: '채점중', cls: 'grading' },
  done: { label: '결과 확인', cls: 'done' },
};
/* 상태 필터 — 건수는 내 과제 목록에서 센다 */
const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'todo', label: '미제출' },
  { key: 'submitted', label: '채점중' },
  { key: 'done', label: '결과 확인' },
];
const countOf = (key) => (key === 'all' ? CARDS.length : CARDS.filter((c) => c.status === key).length);

const FB_ROWS = [
  { label: '이런 점이 좋아요', cls: 'good' },
  { label: '조금만 더 노력해볼까요', cls: 'more' },
  { label: '함께 성장해요', cls: 'grow' },
];

/* ── 아이콘 ── */
const IcoBack = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>;
const IcoDown = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const IcoSpin = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M21 12a9 9 0 0 0-9-9" opacity=".3" /></svg>;
const IcoCheck = ({ color = 'currentColor', w = 16 }) => <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;
const IcoSearch = () => <svg className="smt-s-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>;
const IcoExpand = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
const IcoCopy = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;

const StudentMyTasks = () => {
  const [filter, setFilter] = useState('done');
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState(null);
  const [qIdx, setQIdx] = useState(0);
  const [kind, setKind] = useState('result');
  const [pdf, setPdf] = useState('idle'); // idle · saving · done
  const [toast, setToast] = useState(null);
  const [zoom, setZoom] = useState(false);
  const [asideW, setAsideW] = useState(420); // 우측(제출 정보 · 답안 미리보기) 폭 — 가운데 손잡이로 조절
  const timers = useRef([]);
  const scroller = useRef(null);
  const colsRef = useRef(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* 좌우 폭 조절 — 좌측 최소 400px, 우측 300px ~ 전체의 60% */
  const startResize = (e) => {
    e.preventDefault();
    const box = colsRef.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev) => {
      const w = box.right - ev.clientX;
      setAsideW(Math.round(Math.max(300, Math.min(w, box.width * 0.6, box.width - 400))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const nudgeResize = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const width = colsRef.current?.getBoundingClientRect().width || 1200;
    setAsideW((w) => Math.round(Math.max(300, Math.min(w + (e.key === 'ArrowLeft' ? 24 : -24), width * 0.6, width - 400))));
  };
  const toTop = () => { if (scroller.current) scroller.current.scrollTop = 0; };

  /* 목록 카드에서 덮어쓴 값은 상세에도 그대로 반영한다 */
  const A = openIdx == null ? null : (() => {
    const c = CARDS[openIdx];
    const base = ASSIGN[c.key];
    return { ...base, status: c.status, title: c.title || base.title, subject: c.subject || base.subject, pub: c.detailPub || base.pub };
  })();
  const isDone = A?.status === 'done';
  const q = A ? A.questions[qIdx] : null;

  const open = (i) => { setOpenIdx(i); setQIdx(0); setKind('result'); setPdf('idle'); toTop(); };
  const back = () => { setOpenIdx(null); toTop(); };
  const pickQ = (i) => { setQIdx(i); toTop(); };

  const savePdf = () => {
    if (pdf !== 'idle') return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPdf('saving');
    timers.current.push(setTimeout(() => {
      setPdf('done');
      const t = (A?.title || '채점리포트').replace(/[\\/:*?"<>|]/g, '').trim();
      setToast(`${t}_${STUDENT.name}_채점리포트.pdf`);
      timers.current.push(setTimeout(() => setToast(null), 3200));
      timers.current.push(setTimeout(() => setPdf('idle'), 1900));
    }, 1400));
  };

  const cards = CARDS.map((c, i) => ({ ...c, i, title: c.title || ASSIGN[c.key].title, subject: c.subject || ASSIGN[c.key].subject }))
    .filter((c) => (filter === 'all' || c.status === filter))
    .filter((c) => !query.trim() || c.title.includes(query.trim()));

  return (
    <div className="smt-root" ref={scroller}>
      <style>{CSS}</style>
      <div className="smt-content">
        {/* 학생 정보 — 학생 화면에서는 좌측 사이드바 상단에 놓이는 블록 */}
        <div className="smt-who">
          <span className="smt-who-tag">학생 모드</span>
          <span className="smt-who-cls">[{STUDENT.cls}]</span>
          <span className="smt-who-nm">{STUDENT.name}</span>
          <span className="smt-who-id">{STUDENT.id}</span>
          <button type="button" className="smt-icobtn" aria-label="학생 아이디 복사"
            onClick={() => { try { navigator.clipboard?.writeText(STUDENT.id); } catch { /* 복사 미지원 */ } }}><IcoCopy /></button>
        </div>

        {!A ? (
          <section>
            <div className="smt-head">
              <h1>내 과제</h1>
              <p>배포된 과제를 확인하고 답안을 제출하세요.</p>
            </div>
            <div className="smt-filters">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className="smt-pill" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label}({countOf(f.key)})
                </button>
              ))}
              <div className="smt-searchbox">
                <IcoSearch />
                <label htmlFor="smt-q" className="smt-sr">과제명으로 검색</label>
                <input id="smt-q" type="search" placeholder="과제명으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            {cards.length ? (
              <div className="smt-cards">
                {cards.map((c) => (
                  <article key={c.i} className="smt-card" tabIndex={0} role="button" aria-label={`${c.title} 상세 보기`}
                    onClick={() => open(c.i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c.i); } }}>
                    <div className="smt-card-in">
                      <div className="smt-card-top"><span className={`smt-badge ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span><span className="smt-card-date">배포일 : {c.pub}</span></div>
                      <div className="smt-card-title">{c.title}</div>
                      <div className="smt-meta">
                        <div><span>과목</span><span>{c.subject}</span></div>
                        <div><span>배점</span><span>{c.point}</span></div>
                        <div><span>제출일</span><span>{c.sub}</span></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="smt-empty">
                {query.trim() ? '검색 결과가 없습니다.' : filter === 'todo' ? '제출할 과제가 없습니다.' : filter === 'submitted' ? '채점 중인 과제가 없습니다.' : filter === 'done' ? '결과가 나온 과제가 없습니다.' : '배포된 과제가 없습니다.'}
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="smt-dhead">
              <div className="smt-dhead-l">
                <button type="button" className="smt-back" aria-label="목록으로 돌아가기" onClick={back}><IcoBack /></button>
                <div>
                  <div className="smt-ttl"><span className={`smt-badge ${STATUS[A.status].cls}`}>{STATUS[A.status].label}</span><span className="smt-nm">{A.title}</span></div>
                  <div className="smt-sub">
                    과목 <b>{A.subject}</b><span className="smt-sep">|</span>배포일 <b>{A.pub}</b>
                    <span className="smt-sep">|</span>총 <b>{A.questions.length}문항</b><span className="smt-sep">|</span>배점 <b>{A.full}점</b>
                  </div>
                </div>
              </div>
              <div className="smt-btns">
                <button type="button" className="smt-ghost" onClick={back}>목록으로</button>
                {/* 리포트는 결과가 발송된 뒤에만 받을 수 있다 */}
                {isDone && <button type="button" className={`smt-solid ${pdf === 'saving' ? 'saving' : ''} ${pdf === 'done' ? 'done' : ''}`} disabled={pdf !== 'idle'} onClick={savePdf}>
                  <span className="smt-btn-ico">{pdf === 'saving' ? <IcoSpin /> : pdf === 'done' ? <IcoCheck /> : <IcoDown />}</span>
                  <span>{pdf === 'saving' ? '다운로드 중…' : pdf === 'done' ? '다운로드 완료' : '리포트 PDF 다운로드'}</span>
                </button>}
              </div>
            </div>

            <div className="smt-qtabs" role="tablist" aria-label="문항 선택">
              {A.questions.map((qq, i) => (
                <button key={i} type="button" className="smt-qtab" role="tab" aria-selected={i === qIdx} onClick={() => pickQ(i)}>
                  {qq.label}<span className="smt-qpt">{qq.point}점</span>
                </button>
              ))}
            </div>

            <div className="smt-board">
              <div className="smt-subtabs" role="tablist" aria-label="상세 보기">
                <button type="button" className="smt-subtab" role="tab" aria-selected={kind === 'content'} onClick={() => setKind('content')}>과제 내용</button>
                <button type="button" className="smt-subtab" role="tab" aria-selected={kind === 'result'} onClick={() => setKind('result')}>채점 결과</button>
              </div>

              <div className="smt-cols" ref={colsRef} style={{ '--aside-w': `${asideW}px` }}>
                <div className="smt-col-l">
                  {kind === 'result' ? (
                    isDone ? <ResultPane A={A} q={q} /> : (
                      /* 제출 완료(채점중) — 결과가 발송되면 결과 확인으로 바뀌고 채점 결과가 채워진다 */
                      <div className="smt-notice">
                        <b>선생님이 채점하고 있어요.</b> 채점 결과가 발송되면 이 과제가 「결과 확인」으로 바뀌고, 채점 결과와 리포트를 볼 수 있어요.
                      </div>
                    )
                  ) : (
                    <div>
                      {/* 지문은 과제 등록 시 선택 항목이라, 없으면 영역째 빠지고 문항만 남는다 */}
                      {A.passage && (
                        <div className="smt-passage">
                          <div className="smt-seclab"><span className="smt-tag p">지문</span></div>
                          {A.passage}
                        </div>
                      )}
                      <div className={A.passage ? 'smt-question' : ''}>
                        <div className="smt-seclab"><span className="smt-tag q">{q.label}</span><span className="smt-note">배점 {q.point}점</span></div>
                        <div className="smt-qbox smt-prose"><p>{q.text}</p></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="smt-resizer" role="separator" aria-orientation="vertical" aria-label="좌우 화면 폭 조절" tabIndex={0}
                  title="끌어서 좌우 폭을 조절합니다 (두 번 누르면 원래 폭)"
                  onPointerDown={startResize} onKeyDown={nudgeResize} onDoubleClick={() => setAsideW(420)}><span /></div>

                <aside className="smt-col-r">
                  <div className="smt-darkcard">
                    {isDone
                      ? <div className="smt-dh"><IcoCheck color="#7DD3A0" w={19} />채점 완료</div>
                      : <div className="smt-dh"><IcoCheck color="#93C5FD" w={19} />제출 완료 · 채점중</div>}
                    <div className="smt-rows">
                      <div><span>제출일</span><span>{A.done}</span></div>
                      <div><span>제출 방법</span><span>{A.way}</span></div>
                    </div>
                  </div>
                  <div className="smt-prev-head">
                    <h3>답안 미리보기 · {q.label}</h3>
                    <button type="button" className="smt-mini" onClick={() => setZoom(true)}><IcoExpand />크게 보기</button>
                  </div>
                  <div className="smt-paper">{q.answer.map((l, i) => <div key={i} className="smt-hand">{l}</div>)}</div>
                  <div className="smt-pcap">{A.cap}</div>
                </aside>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="smt-foot">
        <a href="#none" onClick={(e) => e.preventDefault()}>이용약관</a><a href="#none" onClick={(e) => e.preventDefault()}>개인정보 처리방침</a>
        <span className="smt-dot">|</span><span>© 2026 NeoLAB Convergence Inc. All Rights Reserved.</span>
      </div>

      {/* 답안 크게 보기 */}
      {zoom && q && (
        <div className="smt-zoom" onClick={() => setZoom(false)} role="dialog" aria-label="답안 크게 보기">
          <div className="smt-zoom-in" onClick={(e) => e.stopPropagation()}>
            <div className="smt-zoom-head">
              <b>답안 · {q.label}</b>
              <button type="button" className="smt-ghost" onClick={() => setZoom(false)}>닫기</button>
            </div>
            <div className="smt-paper big">{q.answer.map((l, i) => <div key={i} className="smt-hand">{l}</div>)}</div>
            <div className="smt-pcap">{A.cap}</div>
          </div>
        </div>
      )}

      <div className={`smt-toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        <span className="smt-t-ico"><IcoCheck color="#fff" /></span>
        <span>
          <span className="smt-t-t">채점 리포트를 다운로드했습니다</span>
          <span className="smt-t-s">{toast}</span>
        </span>
      </div>
    </div>
  );
};

/* ── [채점 결과] — 리포트(POP-19) 순서: 등급(점수) → 학습 피드백 → 학습 안내 → AI 필기 분석 ── */
const ResultPane = ({ A, q }) => {
  const g = q.guide;
  const hw = A.hasProcess ? q.hw : null;
  const code = hw?.code;
  const pat = code ? lookupPattern(code) : null;
  const img = code && PATTERN_CHARACTERS[code];
  return (
    <div>
      <div className="smt-evalhead"><span className="smt-evaldot g" /><h2>등급 평가</h2></div>

      {/* 1. 성취도 */}
      <div className="smt-gradebar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="smt-g">{q.grade}</span><span className={`smt-chip ${q.chipCls}`}>{q.chip}</span>
        </div>
        <div className="smt-vline" />
        <div className="smt-kv"><div className="k">점수</div><div className="v"><b>{q.score}</b> / {q.point}점</div></div>
        <div className="smt-vline" />
        <div className="smt-kv"><div className="k">평가 기준</div><div className="v">5단계 기준</div></div>
      </div>

      {/* 2. 학습 피드백 */}
      <div className="smt-sect">
        <h3><span className="smt-bar" />학습 피드백</h3>
        {FB_ROWS.map((r, i) => (
          <div key={r.cls} className="smt-fb"><span className={`smt-lab ${r.cls}`}>{r.label}</span><span className="smt-txt">{q.fb[i]}</span></div>
        ))}
      </div>

      {/* 3. 학습 안내 */}
      {g && (
        <div className="smt-sect">
          <h3><span className="smt-bar" />학습 안내</h3>
          <div className="smt-guide">
            <div className="smt-guide-t">{g.title}</div>
            <ul>{g.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
          {g.items.map((it, i) => (
            <div key={i} className="smt-gitem">
              <div className="smt-gask">{i + 1}. {it.ask}</div>
              <div className="smt-gwritten"><span>학생이 작성한 내용</span>{it.written}</div>
              <div className="smt-gtry">
                <div className="smt-gtry-k">이렇게 해봐요</div>
                <div className="smt-gwhen">{it.whenTo}</div>
                <div>{it.example}</div>
                {it.tip && <div className="smt-gtip">{it.tip}</div>}
              </div>
              <div className="smt-gcheck"><span>확인</span>{it.check}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4. AI 필기 분석 — 과정 분석이 포함된 과제만. 캐릭터 + 총평 */}
      {A.hasProcess && (
        <div className="smt-evalsec-p">
          <div className="smt-evalhead"><span className="smt-evaldot p" /><h2>AI 필기 분석</h2><span className="smt-evalsub">필기 과정에서 나타난 학습 행동을 분석합니다</span></div>
          {hw ? (
            <>
              <div className="smt-pattern">
                {img
                  ? <img src={img} alt={pat.name} className="smt-char" />
                  : <div className="smt-char ph">{(code || '?').toUpperCase()}</div>}
                <div>
                  <div className="k">진단된 학습 행동 패턴</div>
                  <div className="n">{pat.name}</div>
                  {pat.brief && <div className="b">{pat.brief}</div>}
                </div>
              </div>
              <div className="smt-sect p" style={{ marginTop: 20 }}>
                <h3><span className="smt-bar" />총평</h3>
                <div className="smt-overall">{hw.summary}</div>
              </div>
            </>
          ) : (
            <div className="smt-overall">{PROCESS_INSUFFICIENT_MESSAGE}</div>
          )}
        </div>
      )}
    </div>
  );
};

/* 목업 스타일 — 앱 전역 클래스(.card · .badge 등)와 겹치지 않게 smt- 접두사로 가둔다 */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap');
.smt-root{--blue:#2563EB;--blue-dark:#1D4ED8;--blue-soft:#EEF3FD;--vio:#6D5BD0;--vio-dark:#5646B8;--vio-soft:#F1EFFB;
  --page:#F4F7FB;--line:#E4EAF3;--line-soft:#EFF2F7;--t1:#17212F;--t2:#3C4858;--t3:#6B7684;--t4:#98A3B0;--dark:#3A4353;
  --ok:#2E6B32;--ok-bg:#EAF6E9;--mid:#8A5A12;--mid-bg:#FBF1DE;
  flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;background:var(--page);color:var(--t1);font-size:var(--neo-font-size-sm)}
.smt-root *{box-sizing:border-box}
.smt-root button{font-family:inherit;cursor:pointer}
.smt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.smt-content{flex-grow:1;padding:24px 32px 36px}
.smt-foot{border-top:1px solid var(--line);background:#fff;padding:18px 32px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:var(--neo-font-size-sm);color:var(--t3)}
.smt-foot a{color:var(--t3);text-decoration:none}
.smt-dot{color:#D5DBE5}

.smt-who{display:flex;align-items:center;gap:8px;margin-bottom:18px;padding:10px 14px;background:#fff;border:1px solid var(--line);border-radius:10px;width:fit-content}
.smt-who-tag{font-size:var(--neo-font-size-xs);font-weight:700;color:#fff;background:var(--blue);padding:3px 9px;border-radius:6px}
.smt-who-cls{font-size:var(--neo-font-size-xs);font-weight:700;color:var(--blue)}
.smt-who-nm{font-size:var(--neo-font-size-base);font-weight:700}
.smt-who-id{font-size:var(--neo-font-size-sm);color:var(--t3)}
.smt-icobtn{border:none;background:none;color:var(--t4);padding:2px;display:inline-flex}

.smt-head h1{margin:0;font-size:var(--neo-font-size-xxl);font-weight:700}
.smt-head p{margin:8px 0 0;font-size:var(--neo-font-size-sm);color:var(--t3)}
.smt-filters{display:flex;align-items:center;gap:9px;margin:22px 0 20px;flex-wrap:wrap}
.smt-pill{height:38px;padding:0 20px;border:1px solid #DDE3ED;background:#fff;color:#5A6675;font-size:var(--neo-font-size-sm);border-radius:19px}
.smt-pill[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:500}
.smt-searchbox{margin-left:auto;display:flex;align-items:center;gap:11px;width:320px;height:40px;padding:0 17px;border:1px solid #DDE3ED;background:#fff;border-radius:20px}
.smt-searchbox:focus-within{border-color:#A9C4F7;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.smt-s-ico{flex-shrink:0;color:#9AA5B4}
.smt-searchbox input{flex-grow:1;min-width:0;height:100%;border:none;outline:none;background:none;font-size:var(--neo-font-size-sm);font-family:inherit;color:var(--t1)}
.smt-searchbox input::-webkit-search-cancel-button{display:none}
.smt-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px}
.smt-card{background:#fff;border:1px solid var(--line);border-radius:12px;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
.smt-card:hover{border-color:#A9C4F7;box-shadow:0 4px 14px rgba(37,99,235,.09);transform:translateY(-2px)}
.smt-card-in{padding:20px}
.smt-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.smt-badge{font-size:var(--neo-font-size-xs);font-weight:500;color:#5F7020;background:#F2F6DC;padding:5px 10px;border-radius:6px;white-space:nowrap}
.smt-badge.grading{color:#1D4ED8;background:#E8F0FE}
.smt-badge.todo{color:#B45309;background:#FEF3C7}
.smt-notice{padding:14px 18px;background:#F5F9FF;border:1px solid #DBEAFE;border-radius:10px;font-size:var(--neo-font-size-sm);color:var(--t2);line-height:1.7}
.smt-notice b{color:var(--blue-dark)}
.smt-card-date{font-size:var(--neo-font-size-xs);color:var(--t4)}
.smt-card-title{margin-top:16px;font-size:var(--neo-font-size-base);font-weight:700;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:45px}
.smt-meta{margin-top:16px;display:flex;flex-direction:column;gap:9px}
.smt-meta div{display:flex;font-size:var(--neo-font-size-sm)}
.smt-meta span:first-child{width:56px;color:var(--t3)}
.smt-empty{padding:60px 0;text-align:center;color:var(--t3);background:#fff;border:1px dashed var(--line);border-radius:12px}

.smt-dhead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.smt-dhead-l{display:flex;align-items:flex-start;gap:12px}
.smt-back{width:30px;height:30px;margin-top:2px;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:8px;color:var(--t3)}
.smt-back:hover{background:#E9EEF7}
.smt-ttl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.smt-nm{font-size:var(--neo-font-size-xl);font-weight:700}
.smt-sub{margin-top:7px;font-size:var(--neo-font-size-sm);color:var(--t3)}
.smt-sub b{font-weight:400;color:var(--t2)}
.smt-sep{margin:0 8px;color:#D5DBE5}
.smt-btns{display:flex;gap:8px;flex-shrink:0}
.smt-ghost{height:40px;padding:0 18px;display:flex;align-items:center;gap:7px;border:1px solid #D8DEE9;background:#fff;color:var(--t2);font-size:var(--neo-font-size-sm);border-radius:8px}
.smt-ghost:hover{background:#F7F9FC}
.smt-solid{height:40px;padding:0 18px;display:flex;align-items:center;gap:8px;border:none;background:var(--blue);color:#fff;font-size:var(--neo-font-size-sm);font-weight:500;border-radius:8px;box-shadow:0 2px 10px rgba(37,99,235,.28);transition:background .2s,box-shadow .2s;min-width:158px;justify-content:center}
.smt-solid:hover:not(:disabled){background:var(--blue-dark)}
.smt-solid:disabled{cursor:default}
.smt-btn-ico{display:flex;align-items:center;justify-content:center;width:16px;height:16px}
@keyframes smt-spin{to{transform:rotate(360deg)}}
@keyframes smt-pop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.smt-solid.saving{background:#5B8DEF;box-shadow:none}
.smt-solid.saving .smt-btn-ico{animation:smt-spin .75s linear infinite}
.smt-solid.done{background:#1F9D62;box-shadow:0 2px 10px rgba(31,157,98,.3)}
.smt-solid.done .smt-btn-ico svg{animation:smt-pop .32s ease-out}

.smt-toast{position:fixed;right:28px;bottom:28px;z-index:10050;display:flex;align-items:center;gap:13px;background:#212B3A;color:#fff;padding:15px 20px;border-radius:12px;box-shadow:0 12px 34px rgba(16,24,38,.32);opacity:0;transform:translateY(16px);pointer-events:none;transition:opacity .26s ease,transform .26s ease}
.smt-toast.show{opacity:1;transform:translateY(0)}
.smt-t-ico{width:30px;height:30px;flex-shrink:0;border-radius:50%;background:#1F9D62;display:flex;align-items:center;justify-content:center}
.smt-t-t{display:block;font-size:var(--neo-font-size-sm);font-weight:500}
.smt-t-s{display:block;margin-top:3px;font-size:var(--neo-font-size-xs);color:#A9B4C6;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.smt-qtabs{margin-top:20px;display:flex;gap:4px;align-items:flex-end;flex-wrap:wrap}
.smt-qtab{height:44px;padding:0 22px;border:1px solid var(--line);border-bottom:none;background:#EDF1F7;color:var(--t3);font-size:var(--neo-font-size-base);border-radius:12px 12px 0 0;position:relative;top:1px}
.smt-qtab:hover{background:#F4F7FB}
.smt-qtab[aria-selected="true"]{background:#fff;color:var(--t1);font-weight:700;height:48px}
.smt-qpt{font-size:var(--neo-font-size-xs);font-weight:400;color:var(--t4);margin-left:7px}
.smt-board{background:#fff;border:1px solid var(--line);border-radius:0 12px 12px 12px;padding:24px 26px}
.smt-cols{display:grid;grid-template-columns:minmax(0,1fr) 24px var(--aside-w,420px);align-items:stretch}
.smt-col-l{min-width:0}
.smt-col-r{min-width:0;align-self:start}
.smt-resizer{position:relative;cursor:col-resize;display:flex;justify-content:center;touch-action:none;outline:none}
.smt-resizer span{width:2px;height:100%;min-height:120px;border-radius:2px;background:transparent;transition:background .15s}
.smt-resizer:hover span,.smt-resizer:focus-visible span{background:#A9C4F7}
.smt-resizer::after{content:"";position:absolute;top:40px;left:50%;width:6px;height:36px;margin-left:-3px;border-radius:3px;background:#D5DBE5}
.smt-resizer:hover::after,.smt-resizer:focus-visible::after{background:var(--blue)}
@media (max-width:1180px){.smt-cols{grid-template-columns:minmax(0,1fr)}.smt-resizer{display:none}.smt-col-r{margin-top:24px}}
.smt-subtabs{display:flex;gap:26px;border-bottom:1px solid var(--line);margin-bottom:20px}
.smt-subtab{padding:0 2px 13px;background:none;border:none;border-bottom:2px solid transparent;font-size:var(--neo-font-size-base);color:var(--t3);position:relative;top:1px}
.smt-subtab[aria-selected="true"]{color:var(--t1);font-weight:700;border-bottom-color:var(--t1)}

.smt-evalhead{display:flex;align-items:baseline;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.smt-evalhead h2{margin:0;font-size:var(--neo-font-size-lg);font-weight:700}
.smt-evaldot{width:9px;height:9px;border-radius:50%;align-self:center}
.smt-evaldot.g{background:var(--blue)}
.smt-evaldot.p{background:var(--vio)}
.smt-evalsub{font-size:var(--neo-font-size-xs);color:var(--t4)}
.smt-evalsec-p{margin-top:36px;padding-top:30px;border-top:2px solid #E9E6F7}
.smt-evalsec-p .smt-evalhead h2{color:var(--vio-dark)}

.smt-gradebar{display:flex;align-items:center;gap:20px;padding:18px 20px;background:#F8FAFD;border:1px solid var(--line-soft);border-radius:10px;flex-wrap:wrap}
.smt-g{font-size:var(--neo-font-size-xxl);font-weight:800;line-height:1;color:var(--blue)}
.smt-chip{font-size:var(--neo-font-size-xs);font-weight:500;padding:5px 11px;border-radius:6px}
.smt-chip.a{color:#1B5E20;background:#E7F5E8}
.smt-chip.b{color:var(--ok);background:var(--ok-bg)}
.smt-chip.c{color:var(--mid);background:var(--mid-bg)}
.smt-vline{width:1px;height:34px;background:#E2E8F1}
.smt-kv .k{font-size:var(--neo-font-size-xs);color:var(--t4)}
.smt-kv .v{margin-top:4px;font-size:var(--neo-font-size-sm);color:var(--t2)}
.smt-kv .v b{font-weight:700;color:var(--t1)}

.smt-sect{margin-top:28px}
.smt-sect > h3{margin:0 0 14px;font-size:var(--neo-font-size-base);font-weight:700;display:flex;align-items:center;gap:9px}
.smt-bar{width:3px;height:15px;border-radius:2px;background:var(--blue)}
.smt-sect.p .smt-bar{background:var(--vio)}
.smt-fb{display:flex;gap:18px;padding:16px 0;border-bottom:1px solid var(--line-soft)}
.smt-fb:last-child{border-bottom:none}
.smt-lab{width:152px;flex-shrink:0;font-size:var(--neo-font-size-sm);font-weight:500;word-break:keep-all}
.smt-lab.good{color:var(--ok)} .smt-lab.more{color:var(--mid)} .smt-lab.grow{color:var(--blue-dark)}
.smt-txt{font-size:var(--neo-font-size-sm);color:var(--t2);line-height:1.75;min-width:0}

.smt-guide{padding:16px 20px;background:var(--blue-soft);border:1px solid #D6E3FA;border-radius:10px}
.smt-guide-t{font-size:var(--neo-font-size-sm);font-weight:700;color:var(--blue-dark);margin-bottom:8px}
.smt-guide ul{margin:0;padding-left:18px;font-size:var(--neo-font-size-sm);color:var(--t2);line-height:1.8}
.smt-gitem{margin-top:16px;padding:16px 18px;border:1px solid var(--line);border-radius:10px;background:#FCFCFE;font-size:var(--neo-font-size-sm);color:var(--t2);line-height:1.7}
.smt-gask{font-weight:700;color:var(--t1);margin-bottom:10px}
.smt-gwritten{padding:8px 12px;background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:8px}
.smt-gwritten span,.smt-gcheck span{font-size:var(--neo-font-size-xs);color:var(--t3);font-weight:700;margin-right:8px}
.smt-gtry{padding:10px 12px;background:#F5F9FF;border:1px solid #DBEAFE;border-radius:8px;margin-bottom:8px}
.smt-gtry-k{font-size:var(--neo-font-size-xs);font-weight:700;color:var(--blue-dark);margin-bottom:2px}
.smt-gwhen{color:var(--t3)}
.smt-gtip{margin-top:4px;font-size:var(--neo-font-size-xs);color:var(--blue)}

.smt-pattern{display:flex;align-items:center;gap:18px;padding:16px 20px;background:var(--vio-soft);border:1px solid #DFD9F6;border-radius:10px}
.smt-char{width:96px;height:96px;object-fit:contain;flex:none;background:#fff;border-radius:10px}
.smt-char.ph{display:flex;align-items:center;justify-content:center;font-weight:800;color:#A78BFA}
.smt-pattern .k{font-size:var(--neo-font-size-xs);color:#6B6390}
.smt-pattern .n{margin-top:4px;font-size:var(--neo-font-size-xl);font-weight:700;color:#3B3268}
.smt-pattern .b{margin-top:4px;font-size:var(--neo-font-size-xs);color:#6B6390}
.smt-overall{padding:18px 20px;background:#FBFBFE;border:1px solid var(--line-soft);border-radius:10px;font-size:var(--neo-font-size-sm);color:var(--t2);line-height:1.8}

.smt-passage + .smt-question,.smt-question{margin-top:30px;padding-top:26px;border-top:1px solid var(--line-soft)}
.smt-seclab{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.smt-tag{font-size:var(--neo-font-size-sm);font-weight:700;padding:6px 13px;border-radius:7px}
.smt-tag.p{color:var(--t2);background:#EDF1F7}
.smt-tag.q{color:var(--blue-dark);background:var(--blue-soft)}
.smt-note{font-size:var(--neo-font-size-xs);color:var(--t4)}
.smt-prose{font-size:var(--neo-font-size-base);color:#2F3B4C;line-height:1.9}
.smt-prose p{margin:0}
.smt-prose p + p{margin-top:16px}
table.smt-pt{border-collapse:collapse}
table.smt-pt{width:100%;font-size:var(--neo-font-size-sm);margin:18px 0}
table.smt-pt th,table.smt-pt td{border:1px solid var(--line);padding:11px 14px;text-align:left;color:#2F3B4C}
table.smt-pt th{background:#F8FAFD;font-weight:500;color:var(--t2)}
.smt-qbox{background:#F8FAFD;border:1px solid var(--line-soft);border-radius:10px;padding:20px 22px}

.smt-darkcard{background:var(--dark);border-radius:12px;padding:20px 22px}
.smt-dh{display:flex;align-items:center;gap:9px;font-size:var(--neo-font-size-base);font-weight:700;color:#fff}
.smt-rows{margin-top:14px;display:flex;flex-direction:column;gap:7px}
.smt-rows div{display:flex;font-size:var(--neo-font-size-sm)}
.smt-rows span:first-child{width:82px;color:#AEB8C7}
.smt-rows span:last-child{color:#E9EDF4}
.smt-prev-head{margin-top:22px;display:flex;align-items:center;justify-content:space-between}
.smt-prev-head h3{margin:0;font-size:var(--neo-font-size-base);font-weight:700}
.smt-mini{height:32px;padding:0 12px;display:flex;align-items:center;gap:6px;border:1px solid #D8DEE9;background:#fff;color:var(--t2);font-size:var(--neo-font-size-sm);border-radius:7px}
.smt-paper{margin-top:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:26px 24px;min-height:330px}
.smt-paper.big{min-height:60vh}
.smt-hand{font-family:'Nanum Pen Script','Segoe Script','Comic Sans MS',cursive;font-size:var(--neo-font-size-xxl);color:#22325C;line-height:1.75}
.smt-hand + .smt-hand{margin-top:16px}
.smt-pcap{margin-top:12px;font-size:var(--neo-font-size-xs);color:var(--t4);text-align:right}

.smt-zoom{position:fixed;inset:0;z-index:10040;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:32px}
.smt-zoom-in{width:min(900px,100%);max-height:100%;overflow:auto;background:var(--page);border-radius:14px;padding:20px 24px}
.smt-zoom-head{display:flex;align-items:center;justify-content:space-between;font-size:var(--neo-font-size-base)}
@media (prefers-reduced-motion: reduce){.smt-solid,.smt-toast{transition:none}.smt-solid.saving .smt-btn-ico,.smt-solid.done .smt-btn-ico svg{animation:none}}
`;

export default StudentMyTasks;
