/**
 * handwritingAnalysis.test.js
 *
 * §7.3 테스트 케이스 기반 검증 하네스.
 * 브라우저/Node에서 동일하게 동작하도록 순수 JS로 작성.
 *
 * 사용법 (브라우저 콘솔):
 *   import { runTestsFromFile } from './handwritingAnalysis.test.js';
 *   runTestsFromFile('/docs/9C_7B_D2_1A_18_36_3-27-618-21_strokes_parsed.json');
 *
 * 사용법 (Node):
 *   node --experimental-vm-modules src/handwritingAnalysis.test.js <json_path>
 */

import { analyzeHandwriting } from './handwritingAnalysis.js';

// §7.3 기대값 (spec 기준)
export const EXPECTED = {
  '고등2_27_하.json': {
    n_strokes: 124,
    micro_pause_ratio_approx: 0.17,
    hesitation_score_approx: 0.42,
    hesitation_grade: 'b',
  },
  '중등1_1_상.json': {
    n_strokes: 118,
    micro_pause_ratio_approx: 0.32,
    hesitation_score_approx: 0.53,
    hesitation_grade: 'b',
  },
  '9C_7B_D2_1A_3A_6A_10-53-300-0_strokes_parsed.json': {
    n_strokes: 683,
    micro_pause_ratio_approx: 0.16,
    hesitation_score_approx: 0.32,
    hesitation_grade: 'b',
  },
  '9C_7B_D2_1A_3A_9B_3-27-618-1_strokes_parsed.json': {
    n_strokes: 30,
    micro_pause_ratio_approx: 0.03,
    hesitation_score_approx: 0.09,
    hesitation_grade: 'a',
  },
};

const TOLERANCE = 0.10; // ±10% (spec §7.3)

function approxEquals(actual, expected, tol = TOLERANCE) {
  if (expected === 0) return Math.abs(actual) < 0.01;
  return Math.abs(actual - expected) / Math.abs(expected) <= tol;
}

export function runTest(fileName, strokesData) {
  const result = analyzeHandwriting(strokesData);
  const expected = EXPECTED[fileName];

  const report = {
    file: fileName,
    actual: {
      n_strokes: result.metadata.n_strokes,
      micro_pause_ratio: result.raw_metrics.micro_pause_ratio,
      hesitation_score: result.normalized_scores.hesitation_score,
      hesitation_grade: result.grades.hesitation,
      pattern_code: result.pattern_code,
    },
    checks: [],
    passed: true,
  };

  if (!expected) {
    report.checks.push({ name: 'has_expected', pass: false, msg: `${fileName}에 대한 기대값 미정의 — 실측값만 출력` });
    report.passed = null; // unknown
    return report;
  }

  const add = (name, actual, exp, compareFn = approxEquals) => {
    const pass = compareFn(actual, exp);
    report.checks.push({ name, actual, expected: exp, pass });
    if (!pass) report.passed = false;
  };

  add('n_strokes', result.metadata.n_strokes, expected.n_strokes, (a, e) => a === e);
  add('micro_pause_ratio_approx', result.raw_metrics.micro_pause_ratio, expected.micro_pause_ratio_approx);
  add('hesitation_score_approx', result.normalized_scores.hesitation_score, expected.hesitation_score_approx);
  add('hesitation_grade', result.grades.hesitation, expected.hesitation_grade, (a, e) => a === e);

  return report;
}

export function formatReport(report) {
  const lines = [];
  lines.push(`\n━━━ ${report.file} ━━━`);
  lines.push(`실측: n_strokes=${report.actual.n_strokes}, micro_pause_ratio=${report.actual.micro_pause_ratio.toFixed(3)}, hesitation_score=${report.actual.hesitation_score.toFixed(3)}, grade=${report.actual.hesitation_grade}, pattern=${report.actual.pattern_code}`);
  for (const c of report.checks) {
    const mark = c.pass === true ? '✓' : c.pass === false ? '✗' : '?';
    lines.push(`  ${mark} ${c.name}: actual=${typeof c.actual === 'number' ? c.actual.toFixed?.(3) ?? c.actual : c.actual}, expected=${c.expected ?? '—'}`);
  }
  if (report.passed === null) lines.push('  ⚠ 기대값 미정의 (검증 스킵)');
  else if (report.passed) lines.push('  ✅ PASS');
  else lines.push('  ❌ FAIL');
  return lines.join('\n');
}

export async function runTestsFromFile(url) {
  const res = await fetch(url);
  const data = await res.json();
  const fileName = url.split('/').pop();
  const report = runTest(fileName, data);
  console.log(formatReport(report));
  return report;
}

// Node CLI 진입점
if (typeof process !== 'undefined' && process.argv?.length >= 3 && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  (async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = process.argv[2];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const fileName = path.basename(filePath);
    const report = runTest(fileName, data);
    console.log(formatReport(report));
    process.exit(report.passed === false ? 1 : 0);
  })();
}
