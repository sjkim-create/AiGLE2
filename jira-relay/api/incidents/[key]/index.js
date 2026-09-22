// GET /api/incidents/:key → 이슈 + 댓글
import { cors, jira, browse, fail } from '../../../lib/jira.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const key = String(req.query.key || '');
    const i = await jira(`/issue/${key}?fields=summary,status,created,updated,assignee,description,comment`);
    const comments = (i.fields.comment?.comments || []).map((c) => ({
      id: c.id, author: c.author?.displayName, created: c.created,
      text: (c.body?.content || []).map((p) => (p.content || []).map((t) => t.text || '').join('')).join('\n'),
    }));
    return res.status(200).json({ key: i.key, url: browse(i.key), summary: i.fields.summary, status: i.fields.status?.name, created: i.fields.created, comments });
  } catch (e) { return fail(res, e); }
}
