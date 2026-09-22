// POST /api/incidents → AGI 이슈 생성 { key, url } · GET /api/incidents?max=50 → 이 앱이 만든 이슈 목록
import { cors, jira, browse, project, toIssueFields, fail, body } from '../../lib/jira.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    if (req.method === 'POST') {
      const created = await jira('/issue', { method: 'POST', body: JSON.stringify({ fields: toIssueFields(body(req)) }) });
      return res.status(201).json({ key: created.key, id: created.id, url: browse(created.key) });
    }
    if (req.method === 'GET') {
      const max = Math.min(100, Number(req.query.max) || 50);
      const jql = `project = ${project()} AND labels = aigle-incident ORDER BY created DESC`;
      const data = await jira(`/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${max}&fields=summary,status,created,updated,assignee,labels`);
      const issues = (data.issues || []).map((i) => ({
        key: i.key, url: browse(i.key), summary: i.fields.summary, status: i.fields.status?.name,
        created: i.fields.created, updated: i.fields.updated, assignee: i.fields.assignee?.displayName || null,
      }));
      return res.status(200).json({ issues });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) { return fail(res, e); }
}
