/**
 * jiraRelay.js — 장애신고 ↔ Jira 중계 클라이언트
 *
 * 브라우저는 Jira 를 직접 부르지 못하므로 Vercel 서버리스 함수(`jira-relay/`, /api/…)를 거친다.
 * `VITE_JIRA_RELAY_URL` 이 없으면 모든 함수가 null 을 돌려주고, incidentStore 는 종전 시뮬레이션(가짜 키)으로 동작한다.
 */
import { info as logInfo, error as logError } from '../appLogger';

const RELAY = String(import.meta.env.VITE_JIRA_RELAY_URL || '').replace(/\/+$/, '').replace(/\/api$/, '') + (import.meta.env.VITE_JIRA_RELAY_URL ? '/api' : '');

export const relayEnabled = () => !!RELAY;

const call = async (path, init = {}) => {
  const res = await fetch(`${RELAY}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `relay ${res.status}`), { status: res.status, detail: data?.detail });
  return data;
};

/** 신고 → Jira 이슈 생성. 성공: { key, url } / 중계 미설정: null / 실패: throw */
export const createJiraIssue = async (report) => {
  if (!RELAY) return null;
  try {
    const r = await call('/incidents', { method: 'POST', body: JSON.stringify(report) });
    logInfo('jiraRelay', 'Jira 이슈 생성', { id: report.id, key: r.key });
    return r;
  } catch (e) {
    logError('jiraRelay', 'Jira 이슈 생성 실패', { id: report.id, error: e, detail: e.detail });
    throw e;
  }
};

/** 이슈에 댓글 추가 (운영팀 메일 발송 기록 등). 중계 미설정이면 null */
export const addJiraComment = async (key, text) => {
  if (!RELAY || !key) return null;
  try {
    return await call(`/incidents/${key}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
  } catch (e) {
    logError('jiraRelay', 'Jira 댓글 추가 실패', { key, error: e });
    return null;
  }
};

/** 이슈 + 댓글 읽기 */
export const fetchJiraIssue = async (key) => (RELAY && key ? call(`/incidents/${key}`) : null);

/** 이 앱이 만든 이슈 목록 */
export const listJiraIssues = async (max = 50) => (RELAY ? call(`/incidents?max=${max}`) : null);

export default { relayEnabled, createJiraIssue, addJiraComment, fetchJiraIssue, listJiraIssues };
