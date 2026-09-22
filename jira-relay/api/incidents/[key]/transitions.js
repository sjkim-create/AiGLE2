// POST /api/incidents/:key/transitions { name } → 워크플로우 상태 이름으로 전환
import { cors, jira, fail, body } from '../../../lib/jira.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const key = String(req.query.key || '');
    const { name } = body(req);
    const { transitions = [] } = await jira(`/issue/${key}/transitions`);
    const t = transitions.find((x) => x.name === name || x.to?.name === name);
    if (!t) return res.status(400).json({ error: `transition not found: ${name}`, available: transitions.map((x) => x.name) });
    await jira(`/issue/${key}/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: t.id } }) });
    return res.status(200).json({ ok: true, to: t.to?.name });
  } catch (e) { return fail(res, e); }
}
