import { signedFetch } from './api';
import { getCredentials } from './auth';
import { SessionService, SessionSummary, SessionDetail, CreateSessionRequest, UpdateSessionRequest } from '../types';

async function requireCreds() {
  const creds = await getCredentials();
  if (!creds) throw new Error('Not authenticated');
  return creds;
}

export const service: SessionService = {
  async list(): Promise<SessionSummary[]> {
    const creds = await requireCreds();
    const res = await signedFetch('/sessions', { method: 'GET' }, creds);
    if (!res.ok) throw new Error('Failed to list sessions');
    return res.json();
  },

  async get(id: string): Promise<SessionDetail> {
    const creds = await requireCreds();
    const res = await signedFetch(`/sessions/${id}`, { method: 'GET' }, creds);
    if (!res.ok) throw new Error('Failed to get session');
    return res.json();
  },

  async create(req: CreateSessionRequest): Promise<{ session_id: string }> {
    const creds = await requireCreds();
    const res = await signedFetch('/sessions', { method: 'POST', body: JSON.stringify(req) }, creds);
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  },

  async update(id: string, req: UpdateSessionRequest): Promise<SessionDetail> {
    const creds = await requireCreds();
    const res = await signedFetch(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(req) }, creds);
    if (!res.ok) throw new Error('Failed to update session');
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const creds = await requireCreds();
    const res = await signedFetch(`/sessions/${id}`, { method: 'DELETE' }, creds);
    if (!res.ok) throw new Error('Failed to delete session');
  },

  async appendHistory(): Promise<void> {
    // Remote backend manages history internally via chat endpoint
  },
};

export async function remoteChat(sessionId: string, question: string): Promise<string> {
  const creds = await requireCreds();
  const tokenRes = await signedFetch(`/sessions/${sessionId}/stream-token`, { method: 'POST' }, creds);
  if (!tokenRes.ok) throw new Error('Failed to get stream token');
  const { token } = await tokenRes.json();

  const res = await signedFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, question }),
    headers: { 'x-stream-token': token },
  }, creds);
  if (!res.ok) throw new Error('Chat failed');
  const data = await res.json();
  return data.answer;
}

export { Settings } from './settings-ui';
