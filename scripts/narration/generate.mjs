/**
 * 풀이 과정 보기 — 시연용 음성 설명 만들기 (로컬 프로토 도구 · 상용 아님)
 *
 *   node scripts/narration/generate.mjs          # 없는 것만 만든다
 *   node scripts/narration/generate.mjs --force  # 전부 다시
 *
 * 유리함수 샘플(src/data/solutionSamples.js)의 문항마다, 한국어 · 영어로
 *   1) 장면마다 필기 시간을 화면과 같은 방식으로 계산한다(src/lib/penTiming.js)
 *   2) 교사 설명 원고를 쓴다 — 도입(필기 전) · 장면별 설명(분량 = 그 장면 필기 시간 × 말 속도) · 마무리(필기 후)
 *      자막(꼭 봐야 할 정리)을 그대로 읽지 않고, 이유 · 개념을 덧붙여 말하듯이. 멈춤 장면은 왜 멈췄는지로 채운다
 *   3) 원고 전체를 음성 한 번으로 만든다 — 모델 · 목소리 하나로 고정해 중간에 목소리가 바뀌지 않게
 *   4) 앞뒤 무음을 0이 되는 지점에서 자르고 시작 · 끝을 서서히 키우고 줄여(페이드) 「지직」 잡음을 없앤다
 *   5) 받아 적어 확인(지시문을 읽었는지 · 분량이 맞는지) → 틀리면 다시 만든다
 *   6) 장면 경계 시각 = 글자 비율로 추정한 뒤 가장 가까운 쉼(무음)에 맞춘다
 * 결과: public/audio/narration/<키>.wav · narration.json (src/lib/narration.js 설명 참고)
 * 키: .env.development.local 의 VITE_GEMINI_API_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { voiceKey } from '../../src/lib/narration.js';
import { cueWriteSec } from '../../src/lib/penTiming.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/audio/narration');
const TEXT_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
const TTS_MODEL = 'gemini-3.8-flash-tts'; // 하나로 고정 — 모델이 바뀌면 목소리가 달라진다
const VOICE = 'Kore';
const OUT_RATE = 16000; // 말소리에 충분한 음질 · 파일 크기 2/3
const STYLE = { ko: '[친절한 선생님이 학생 옆에서 차분하고 따뜻하게 설명하듯]', en: '[Like a kind teacher sitting next to the student, calm and warm]' };
const RATE = { ko: { per: 6.5, unit: '글자' }, en: { per: 2.6, unit: 'words' } }; // 1초에 말하는 분량
const FORCE = process.argv.includes('--force');

const KEY = (fs.readFileSync(path.join(ROOT, '.env.development.local'), 'utf8').match(/^VITE_GEMINI_API_KEY=(.*)$/m)?.[1] || '').replace(/["\r]/g, '').trim();
if (!KEY) { console.error('VITE_GEMINI_API_KEY 없음'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (model, body) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
});
/* 한도(429) · 혼잡(5xx)이면 쉬었다 다시. models가 여럿이면 다음 모델로 */
const api = async (models, body) => {
  for (let round = 0; round < 5; round += 1) {
    for (const m of models) {
      const r = await call(m, body);
      if (r.ok) return r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`${m} ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    await sleep(6000 * (round + 1));
  }
  throw new Error(`${models.join('/')} 계속 실패`);
};
const textOf = (d) => d.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

const loadSample = async () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/solutionSamples.js'), 'utf8')
    .replace(/from '\.\/(penSample_[^']+\.json)';/, (_, f) => `from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'src/data', f)).href)} with { type: 'json' };`);
  const tmp = path.join(os.tmpdir(), `solutionSamples_${Date.now()}.mjs`);
  fs.writeFileSync(tmp, src);
  return (await import(pathToFileURL(tmp).href)).MATH_RAT_TASK;
};

/* 1) 장면 목록 — 화면의 장면 순서(단계 → 장면)와 같다 */
const scenesOf = (q, lang) => {
  const sol = q.solution;
  const pen = sol.pen || null;
  const out = [];
  sol.steps.forEach((s, si) => (s.cues || []).forEach((c) => {
    const src = c[lang] || c;
    const W = cueWriteSec(c, pen);
    const kind = c.pause ? 'pause' : W > 0 ? 'write' : 'talk';
    const sec = kind === 'pause' ? Math.min(6, c.sec || s.pauseSec || 3) : kind === 'write' ? W : 3;
    out.push({
      step: si + 1, stepTitle: (s[lang] || s).title, stepOk: s.ok, stepSummary: (s[lang] || s).detail || (s[lang] || s).basic,
      kind, sec: Math.round(sec * 10) / 10, caption: src.sayD || src.say || '',
    });
  }));
  return out;
};

/* 2) 교사 설명 원고 */
const writeScript = async (q, lang, scenes) => {
  const sol = q.solution;
  const R = RATE[lang];
  const budget = scenes.map((x) => (x.sec < 1 ? 0 : Math.round(x.sec * R.per)));
  const rows = scenes.map((x, i) => ({ i, step: x.step, stepTitle: x.stepTitle, stepOk: x.stepOk, kind: x.kind, seconds: x.sec, budget: budget[i], caption: x.caption, stepSummary: x.stepSummary }));
  const info = {
    level: (sol[lang] || sol).level, question: (q[lang] || q).text, studentAnswer: q.answer,
    concept: (sol[lang] || sol).concept, correct: (sol[lang] || sol).answer,
  };
  const prompt = lang === 'ko'
    ? `당신은 학생 옆에 앉아 학생이 쓴 필기가 다시 그려지는 영상을 함께 보며 말로 설명해 주는 선생님입니다. 영상의 음성 원고를 써 주세요.

[문항 정보]
${JSON.stringify(info, null, 1)}

[장면 목록] 영상은 이 순서로 흘러갑니다. kind: write = 학생 필기가 그려지는 장면, pause = 학생이 필기를 멈췄던 장면, talk = 필기 없이 말만 하는 장면.
seconds = 그 장면 길이(초), budget = 그 장면에 말할 분량(${R.unit} 수, 공백 제외 · ±20%). caption = 화면에 따로 뜨는 짧은 자막(정리).
${JSON.stringify(rows, null, 1)}

[원고 규칙]
- intro: 필기가 시작되기 전 도입. 이 문제가 무엇을 묻는지, 어떻게 접근하면 되는지 2문장(60${R.unit} 안팎).
- segs: 장면마다 하나씩, 장면 목록과 같은 순서 · 같은 개수. 지금 그려지는 필기를 보며 말하듯 이어지게 씁니다.
  · 자막(caption)을 그대로 읽지 말고, 왜 그렇게 하는지 · 어떤 개념인지 · 다음에 무엇을 할지를 덧붙여 선생님처럼 설명합니다.
  · budget을 지킵니다. budget이 0이면 빈 문자열("")로 둡니다(앞 장면 설명이 이어집니다).
  · pause 장면은 학생이 왜 멈췄을지, 그 시간에 무엇을 떠올리면 좋은지로 채웁니다.
  · stepOk가 false인 단계의 장면은 틀린 곳을 부드럽게 짚고 바르게 고치는 방법을 말합니다.
- outro: 필기가 끝난 뒤 마무리 1~2문장(50${R.unit} 안팎). 잘한 점과 기억할 점.
- 해요체 존댓말. 학생 이름은 쓰지 않습니다. 등급 · 점수는 말하지 않습니다.
- 음성으로 읽을 원고이므로 수식 · 기호를 쓰지 않고 읽는 말로 씁니다. 예: "y = k/(x−2) − 1" → "와이는 엑스 빼기 이 분의 케이, 빼기 일", "(3, 0)" → "점 삼 영", "k ≠ 0" → "케이는 영이 아니다", "4초" → "사 초".
- JSON으로만 답합니다: {"intro":"…","segs":["…", …],"outro":"…"}`
    : `You are a teacher sitting next to the student, watching a video that redraws the student's own handwriting, and explaining it out loud. Write the voice script for the video.

[Item]
${JSON.stringify(info, null, 1)}

[Scenes] The video plays in this order. kind: write = the student's writing is being drawn, pause = the student stopped writing here, talk = no writing, only talking.
seconds = scene length, budget = how much to say in that scene (${R.unit}, ±20%). caption = a short on-screen caption (summary) shown separately.
${JSON.stringify(rows, null, 1)}

[Rules]
- intro: before any writing starts — what the question asks and how to approach it, 2 sentences (about 25 words).
- segs: one per scene, same order and count as the scene list, flowing on from each other as you watch the writing.
  · Do not read the caption aloud; explain like a teacher — why this step, which concept, what comes next.
  · Keep to the budget. If budget is 0, use an empty string "" (the previous explanation carries on).
  · For pause scenes, talk about why the student might have stopped and what to think about at that moment.
  · For scenes in a step with stepOk false, point out the mistake gently and how to fix it.
- outro: after the writing ends, 1–2 sentences (about 20 words): what went well and what to remember.
- Warm, plain English for the student's grade. No student name. Never mention the grade or score.
- This will be read aloud, so write math as spoken words, no symbols: "y = k/(x−2) − 1" → "y equals k over x minus two, minus one", "(3, 0)" → "the point three, zero", "k ≠ 0" → "k is not zero".
- Reply with JSON only: {"intro":"…","segs":["…", …],"outro":"…"}`;
  for (let i = 0; i < 3; i += 1) {
    const d = await api(TEXT_MODELS, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json' } });
    try {
      const j = JSON.parse(textOf(d));
      if (Array.isArray(j.segs) && j.segs.length === scenes.length && j.intro && j.outro) {
        j.segs = j.segs.map((s, k) => (budget[k] === 0 ? '' : String(s || '').trim()));
        return j;
      }
    } catch { /* 다시 */ }
    console.log('  원고 형식이 맞지 않아 다시 씁니다');
  }
  throw new Error('원고 실패');
};

/* ── 음성 다듬기: PCM16 mono ── */
const pcmOf = (buf) => {
  if (buf.toString('ascii', 0, 4) === 'RIFF') return { sr: buf.readUInt32LE(24), pcm: new Int16Array(buf.buffer.slice(buf.byteOffset + 44, buf.byteOffset + buf.length)) };
  return { sr: 24000, pcm: new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) };
};
const resample = (pcm, from, to) => {
  if (from === to) return pcm;
  const n = Math.floor((pcm.length * to) / from);
  const out = new Int16Array(n);
  const r = from / to;
  for (let i = 0; i < n; i += 1) {
    const x = i * r; const a = Math.floor(x); const f = x - a;
    // 앞뒤를 살짝 섞어 높은 소리 잡음을 줄인다
    const s0 = ((pcm[a - 1] ?? pcm[a]) + 2 * pcm[a] + (pcm[a + 1] ?? pcm[a])) / 4;
    const s1 = ((pcm[a] ?? 0) + 2 * (pcm[a + 1] ?? pcm[a]) + (pcm[a + 2] ?? pcm[a + 1] ?? pcm[a])) / 4;
    out[i] = Math.round(s0 + (s1 - s0) * f);
  }
  return out;
};
/* 앞뒤 무음을 자르되 0을 지나는 지점에서, 시작 · 끝 30ms 페이드 — 「지직」 방지 */
const tidy = (pcm, sr) => {
  const thr = 300;
  let a = 0; while (a < pcm.length && Math.abs(pcm[a]) < thr) a += 1;
  let b = pcm.length - 1; while (b > a && Math.abs(pcm[b]) < thr) b -= 1;
  a = Math.max(0, a - Math.round(sr * 0.08)); b = Math.min(pcm.length - 1, b + Math.round(sr * 0.15));
  while (a > 0 && Math.sign(pcm[a]) === Math.sign(pcm[a - 1]) && pcm[a] !== 0) a -= 1;
  while (b < pcm.length - 1 && Math.sign(pcm[b]) === Math.sign(pcm[b + 1]) && pcm[b] !== 0) b += 1;
  const out = Int16Array.from(pcm.subarray(a, b + 1));
  const f = Math.round(sr * 0.03);
  for (let i = 0; i < f && i < out.length; i += 1) {
    out[i] = Math.round(out[i] * (i / f));
    out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * (i / f));
  }
  return out;
};
const wavOf = (pcm, sr) => {
  const body = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + body.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(body.length, 40);
  return Buffer.concat([h, body]);
};

/* 6) 쉼(무음) 찾기 — 20ms 단위로 조용한 구간이 160ms 이상이면 쉼 */
const gapsOf = (pcm, sr) => {
  const fr = Math.round(sr * 0.02);
  const quiet = [];
  for (let i = 0; i + fr <= pcm.length; i += fr) {
    let e = 0; for (let k = i; k < i + fr; k += 1) e += pcm[k] * pcm[k];
    quiet.push(Math.sqrt(e / fr) < 350);
  }
  const gaps = [];
  let s = -1;
  quiet.forEach((q, i) => {
    if (q && s < 0) s = i;
    if ((!q || i === quiet.length - 1) && s >= 0) { if (i - s >= 8) gaps.push(((s + i) / 2) * 0.02); s = -1; }
  });
  return gaps;
};
const nonSpace = (s) => s.replace(/\s/g, '').length;
const align = (units, total, gaps) => {
  const sum = units.reduce((x, u) => x + nonSpace(u), 0);
  const bounds = [0];
  let acc = 0;
  let last = 0;
  for (let i = 0; i < units.length - 1; i += 1) {
    acc += nonSpace(units[i]);
    const est = (acc / sum) * total;
    const near = gaps.filter((g) => g > last + 0.3 && Math.abs(g - est) < 1.5).sort((x, y) => Math.abs(x - est) - Math.abs(y - est))[0];
    last = near ?? est;
    bounds.push(Math.round(last * 100) / 100);
  }
  bounds.push(Math.round(total * 100) / 100);
  return units.map((_, i) => [bounds[i], bounds[i + 1]]);
};

/* 3)~5) 음성 한 번에 + 확인 */
const speak = async (lang, script) => {
  const units = [script.intro, ...script.segs.filter(Boolean), script.outro];
  const full = units.join('\n\n');
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const d = await api([TTS_MODEL], {
      contents: [{ parts: [{ text: `${STYLE[lang]}\n${full}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    });
    const part = d.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) { console.log(`  음성 없음(${attempt})`); continue; }
    const { sr, pcm } = pcmOf(Buffer.from(part.inlineData.data, 'base64'));
    const clean = tidy(resample(pcm, sr, OUT_RATE), OUT_RATE);
    const sec = clean.length / OUT_RATE;
    const wav = wavOf(clean, OUT_RATE);
    // 확인 — 말 속도가 비정상이면(같은 말 반복 · 지시문 읽기 등) 다시
    const cps = nonSpace(full) / sec;
    const okRate = lang === 'ko' ? cps > 3.5 && cps < 10 : cps > 8 && cps < 22;
    const t = await api(TEXT_MODELS, {
      contents: [{ parts: [{ text: 'Transcribe this audio exactly, word for word, in the language spoken. Reply with the transcript only.' }, { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }] }],
      generationConfig: { temperature: 0 },
    });
    const heard = textOf(t).trim();
    const ratio = nonSpace(heard) / Math.max(1, nonSpace(full));
    const readStyle = /차분하고 따뜻하게|설명하듯|kind teacher sitting|calm and warm/i.test(heard);
    if (!okRate || readStyle || ratio < 0.75 || ratio > 1.3) {
      console.log(`  다시(${attempt}): 말 속도 ${cps.toFixed(1)}/초 · 받아 적은 분량 ${ratio.toFixed(2)}${readStyle ? ' · 지시문을 읽음' : ''}`);
      continue;
    }
    const ranges = align(units, sec, gapsOf(clean, OUT_RATE));
    return { wav, sec: Math.round(sec * 100) / 100, ranges, heard };
  }
  throw new Error('음성 실패');
};

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mPath = path.join(OUT, 'narration.json');
  const all = fs.existsSync(mPath) && !FORCE ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : {};
  const task = await loadSample();
  for (const [qi, q] of task.questions.entries()) {
    if (!q.solution) continue;
    for (const lang of ['ko', 'en']) {
      const key = voiceKey(lang, q.text);
      if (all[key]) { console.log(`건너뜀 문항${qi + 1} ${lang}`); continue; }
      const scenes = scenesOf(q, lang);
      console.log(`문항${qi + 1} ${lang} — 장면 ${scenes.length}개 · 필기 ${scenes.reduce((x, s) => x + (s.kind === 'write' ? s.sec : 0), 0).toFixed(1)}초`);
      const script = await writeScript(q, lang, scenes);
      const { wav, sec, ranges, heard } = await speak(lang, script);
      // 장면별 [시작, 끝] — 빈 원고 장면은 null
      let u = 1;
      const segs = script.segs.map((s) => (s ? ranges[u++] : null));
      fs.writeFileSync(path.join(OUT, `${key}.wav`), wav);
      all[key] = { file: `${key}.wav`, sec, intro: ranges[0], segs, outro: ranges[ranges.length - 1], script, heard };
      fs.writeFileSync(mPath, JSON.stringify(all, null, 1));
      console.log(`✓ 문항${qi + 1} ${lang} ${sec}초 · ${(wav.length / 1024 / 1024).toFixed(1)}MB`);
    }
  }
  console.log('끝');
};
main().catch((e) => { console.error('실패:', e.message); process.exit(1); });
