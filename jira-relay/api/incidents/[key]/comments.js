// POST /api/incidents/:key/comments { text } → 댓글 추가 (운영팀 메일 발송 기록 등)
import { cors, jira, adf, fail, body } from '../../../lib/jira.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const key = String(req.query.key || '');
    const { text } = body(req);
    const c = await jira(`/issue/${key}/comment`, { method: 'POST', body: JSON.stringify({ body: adf(String(text || '').split('\n')) }) });
    return res.status(201).json({ id: c.id, created: c.created });
  } catch (e) { return fail(res, e); }
}
