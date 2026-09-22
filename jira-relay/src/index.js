/**
 * AiGLE 장애신고 → Jira 중계 (Cloudflare Worker)
 *
 * 브라우저는 Jira REST API 를 직접 부를 수 없다(CORS · 토큰 노출). 이 Worker 가 토큰을 쥐고 대신 호출한다.
 * DB 없음 — Jira 가 저장소다.
 *
 *   POST /incidents                → AGI 프로젝트에 이슈 생성  { key, url }
 *   GET  /incidents?max=50         → 이 Worker 가 만든 이슈 목록 (label aigle-incident)
 *   GET  /incidents/:key           → 이슈 + 댓글
 *   POST /incidents/:key/comments  → 댓글 추가 (운영팀 메일 발송 기록 등)
 *   POST /incidents/:key/transitions { name } → 상태 전환 (워크플로우 상태 이름으로)
 *
 * 비밀값(wrangler secret put): JIRA_EMAIL · JIRA_API_TOKEN
 * 변수(wrangler.toml [vars]): JIRA_BASE · JIRA_PROJECT · JIRA_ISSUE_TYPE · JIRA_ASSIGNEE · ALLOWED_ORIGINS
 */

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

/* Jira 설명란은 ADF(Atlassian Document Format) — 문단 배열로 만든다 */
const adf = (lines) => ({
  type: 'doc', version: 1,
  content: lines.filter((l) => l != null && l !== '').map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: String(l) }] })),
});

/* 화면이 보내는 신고 → Jira 이슈 필드 */
const toIssueFields = (env, r) => ({
  project: { key: env.JIRA_PROJECT },
  issuetype: { name: env.JIRA_ISSUE_TYPE || 'Task' },
  summary: `[${r.source || '환경설정'}] ${r.symptom || '장애'} — ${r.school || ''} ${r.teacher || ''}`.trim(),
  labels: ['aigle-incident'],
  ...(env.JIRA_ASSIGNEE ? { assignee: { id: env.JIRA_ASSIGNEE } } : {}),
  description: adf([
    `접수번호: ${r.id || '-'}    접수 일시: ${r.createdAt || '-'}    출처: ${r.source || '-'}`,
    `학교: ${r.school || '-'}    교사: ${r.teacher || '-'} (${r.teacherId || '-'}, ${r.teacherEmail || '-'})`,
    `과제: ${r.task || '-'}    그룹: ${r.group || '-'}    대상 학생: ${r.studentCount ?? '-'}`,
    `증상: ${r.symptom || '-'}`,
    r.detail ? `상세: ${r.detail}` : null,
    `진단 로그: ${r.attachments?.log?.name || '-'} (${r.logDate || '-'})`,
    r.attachments?.penRaw ? `펜 원본 진단 파일: ${r.attachments.penRaw.zipName} — 채점 ${r.attachments.penRaw.sessions}회분 · 펜 ${r.attachments.penRaw.pens}자루 · ${r.attachments.penData?.length || 0}개 파일` : '펜 원본 진단 파일: 없음',
    ...(r.attachments?.penData || []).slice(0, 30).map((p) => `  - ${p}`),
  ]),
});

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? (origin || '*') : allowed[0],
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!originOk) return json({ error: 'origin not allowed' }, 403, cors);
    if (!env.JIRA_EMAIL || !env.JIRA_API_TOKEN) return json({ error: 'JIRA_EMAIL / JIRA_API_TOKEN secret 이 설정되지 않았습니다' }, 500, cors);

    const auth = 'Basic ' + btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`);
    const jira = async (path, init = {}) => {
      const res = await fetch(`${env.JIRA_BASE}/rest/api/3${path}`, {
        ...init,
        headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
      if (!res.ok) throw Object.assign(new Error(`Jira ${res.status}`), { status: res.status, data });
      return data;
    };
    const browse = (key) => `${env.JIRA_BASE}/browse/${key}`;

    const url = new URL(req.url);
    const m = url.pathname.match(/^\/incidents(?:\/([A-Z][A-Z0-9]+-\d+))?(?:\/(comments|transitions))?\/?$/);
    try {
      if (!m) return json({ error: 'not found' }, 404, cors);
      const [, key, sub] = m;

      // 접수 → 이슈 생성
      if (req.method === 'POST' && !key) {
        const body = await req.json();
        const created = await jira('/issue', { method: 'POST', body: JSON.stringify({ fields: toIssueFields(env, body) }) });
        return json({ key: created.key, id: created.id, url: browse(created.key) }, 201, cors);
      }

      // 목록 — 이 Worker 가 만든 이슈만 (label)
      if (req.method === 'GET' && !key) {
        const max = Math.min(100, Number(url.searchParams.get('max')) || 50);
        const jql = `project = ${env.JIRA_PROJECT} AND labels = aigle-incident ORDER BY created DESC`;
        const data = await jira(`/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${max}&fields=summary,status,created,updated,assignee,labels`);
        const issues = (data.issues || []).map((i) => ({
          key: i.key, url: browse(i.key), summary: i.fields.summary, status: i.fields.status?.name,
          created: i.fields.created, updated: i.fields.updated, assignee: i.fields.assignee?.displayName || null,
        }));
        return json({ issues }, 200, cors);
      }

      // 상세 — 이슈 + 댓글
      if (req.method === 'GET' && key && !sub) {
        const i = await jira(`/issue/${key}?fields=summary,status,created,updated,assignee,description,comment`);
        const comments = (i.fields.comment?.comments || []).map((c) => ({
          id: c.id, author: c.author?.displayName, created: c.created,
          text: (c.body?.content || []).map((p) => (p.content || []).map((t) => t.text || '').join('')).join('\n'),
        }));
        return json({ key: i.key, url: browse(i.key), summary: i.fields.summary, status: i.fields.status?.name, created: i.fields.created, comments }, 200, cors);
      }

      // 댓글 추가
      if (req.method === 'POST' && key && sub === 'comments') {
        const { text } = await req.json();
        const c = await jira(`/issue/${key}/comment`, { method: 'POST', body: JSON.stringify({ body: adf(String(text || '').split('\n')) }) });
        return json({ id: c.id, created: c.created }, 201, cors);
      }

      // 상태 전환 — 상태 이름으로 찾아 실행
      if (req.method === 'POST' && key && sub === 'transitions') {
        const { name } = await req.json();
        const { transitions = [] } = await jira(`/issue/${key}/transitions`);
        const t = transitions.find((x) => x.name === name || x.to?.name === name);
        if (!t) return json({ error: `transition not found: ${name}`, available: transitions.map((x) => x.name) }, 400, cors);
        await jira(`/issue/${key}/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: t.id } }) });
        return json({ ok: true, to: t.to?.name }, 200, cors);
      }

      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: e.message, detail: e.data || null }, e.status && e.status >= 400 ? 502 : 500, cors);
    }
  },
};
