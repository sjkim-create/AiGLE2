/**
 * AiGLE 장애신고 → Jira 중계 — 공통 (Vercel Serverless Functions)
 *
 * 브라우저는 Jira REST API 를 직접 부를 수 없다(CORS · 토큰 노출). 이 함수들이 토큰을 쥐고 대신 호출한다.
 * DB 없음 — Jira 가 저장소다.
 *
 * 비밀값(Vercel 환경변수, 대시보드 또는 `vercel env add`): JIRA_EMAIL · JIRA_API_TOKEN
 * 나머지는 아래 기본값을 쓰고, 바꾸려면 같은 이름의 환경변수로 덮는다.
 */
const cfg = () => ({
  base: process.env.JIRA_BASE || 'https://neolab-convergence.atlassian.net',
  project: process.env.JIRA_PROJECT || 'AGI',
  issueType: process.env.JIRA_ISSUE_TYPE || 'Task',
  // 이슈 담당자 — Jira 목록 링크의 assignee 계정 ID (여기에 지정해야 그 목록에 쌓인다)
  assignee: process.env.JIRA_ASSIGNEE || '712020:bb91b68a-a0c1-4273-9fe3-c6872c239498',
  // 호출을 허용할 웹앱 origin (쉼표 구분). 비우면 전부 허용
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://aigle2-ff923.web.app,https://aigle2-ff923.firebaseapp.com,http://localhost:5173,http://localhost:5174')
    .split(',').map((s) => s.trim()).filter(Boolean),
  email: process.env.JIRA_EMAIL || '',
  token: process.env.JIRA_API_TOKEN || '',
});

/** CORS 처리. preflight 이면 true 를 돌려주고 응답을 끝낸다. origin 이 허용 밖이면 403 */
export const cors = (req, res) => {
  const c = cfg();
  const origin = req.headers.origin || '';
  const ok = c.allowedOrigins.length === 0 || c.allowedOrigins.includes(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? (origin || '*') : c.allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (!ok) { res.status(403).json({ error: 'origin not allowed' }); return true; }
  if (!c.email || !c.token) { res.status(500).json({ error: 'JIRA_EMAIL / JIRA_API_TOKEN 환경변수가 설정되지 않았습니다' }); return true; }
  return false;
};

/** Jira REST v3 호출 */
export const jira = async (path, init = {}) => {
  const c = cfg();
  const auth = 'Basic ' + Buffer.from(`${c.email}:${c.token}`).toString('base64');
  const res = await fetch(`${c.base}/rest/api/3${path}`, {
    ...init,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(`Jira ${res.status}`), { status: res.status, data });
  return data;
};

export const browse = (key) => `${cfg().base}/browse/${key}`;
export const project = () => cfg().project;

/* Jira 설명란은 ADF(Atlassian Document Format) — 문단 배열로 만든다 */
export const adf = (lines) => ({
  type: 'doc', version: 1,
  content: lines.filter((l) => l != null && l !== '').map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: String(l) }] })),
});

/* 화면이 보내는 신고 → Jira 이슈 필드 */
export const toIssueFields = (r) => {
  const c = cfg();
  return {
    project: { key: c.project },
    issuetype: { name: c.issueType },
    summary: `[${r.source || '환경설정'}] ${r.symptom || '장애'} — ${r.school || ''} ${r.teacher || ''}`.trim(),
    labels: ['aigle-incident'],
    ...(c.assignee ? { assignee: { id: c.assignee } } : {}),
    description: adf([
      `접수번호: ${r.id || '-'}    접수 일시: ${r.createdAt || '-'}    출처: ${r.source || '-'}`,
      `학교: ${r.school || '-'}    교사: ${r.teacher || '-'} (${r.teacherId || '-'}, ${r.teacherEmail || '-'})`,
      `과제: ${r.task || '-'}    그룹: ${r.group || '-'}    대상 학생: ${r.studentCount ?? '-'}`,
      `증상: ${r.symptom || '-'}`,
      r.detail ? `상세: ${r.detail}` : null,
      `진단 로그: ${r.attachments?.log?.name || '-'} (${r.logDate || '-'})`,
      r.attachments?.penRaw
        ? `펜 원본 진단 파일: ${r.attachments.penRaw.zipName} — 채점 ${r.attachments.penRaw.sessions}회분 · 펜 ${r.attachments.penRaw.pens}자루 · ${r.attachments.penData?.length || 0}개 파일`
        : '펜 원본 진단 파일: 없음',
      ...(r.attachments?.penData || []).slice(0, 30).map((p) => `  - ${p}`),
    ]),
  };
};

/** 예외 → 응답 */
export const fail = (res, e) => res.status(e.status && e.status >= 400 ? 502 : 500).json({ error: e.message, detail: e.data || null });

/** Vercel 이 body 를 파싱해 주지 않는 경우 대비 */
export const body = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
};
