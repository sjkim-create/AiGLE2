// GET /api/incidents/:key → 이슈 + 댓글
import { cors, jira, browse, fail } from '../../../lib/jira.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const key = String(req.query.key || '');
    const i = await jira(`/issue/${key}?fields=summary,status,created,updated,assignee,description,comment`);
    const comments = (i.fields.comment?.comments || []).map((c) => ({
      id: c.id, author: c.author?.displayName, authorId: c.author?.accountId, created: c.created,
      text: (c.body?.content || []).map((p) => (p.content || []).map((t) => t.text || '').join('')).join('\n'),
    }));
    return res.status(200).json({
      key: i.key, url: browse(i.key), summary: i.fields.summary,
      status: i.fields.status?.name, statusCategory: i.fields.status?.statusCategory?.key || null, // new | indeterminate | done
      assignee: i.fields.assignee?.displayName || null, created: i.fields.created, updated: i.fields.updated, comments,
    });
  } catch (e) { return fail(res, e); }
}
