import { signedFetch } from './api';

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export interface SessionSummary {
  session_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail {
  session_id: string;
  title: string;
  paper_text: string;
  history: { role: string; content: string }[];
  model: string;
  system_prompt: string;
  subject_expertise: string;
  research_expertise: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionRequest {
  paper_text: string;
  title?: string;
  model?: string;
  subject_expertise?: string;
  research_expertise?: string;
}

export async function listSessions(creds: Credentials): Promise<SessionSummary[]> {
  const res = await signedFetch('/sessions', { method: 'GET' }, creds);
  if (!res.ok) throw new Error('Failed to list sessions');
  return res.json();
}

export async function getSession(creds: Credentials, id: string): Promise<SessionDetail> {
  const res = await signedFetch(`/sessions/${id}`, { method: 'GET' }, creds);
  if (!res.ok) throw new Error('Failed to get session');
  return res.json();
}

export async function createSession(creds: Credentials, req: CreateSessionRequest): Promise<{ session_id: string }> {
  const res = await signedFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(req),
  }, creds);
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function deleteSession(creds: Credentials, id: string): Promise<void> {
  const res = await signedFetch(`/sessions/${id}`, { method: 'DELETE' }, creds);
  if (!res.ok) throw new Error('Failed to delete session');
}

export async function chat(creds: Credentials, sessionId: string, question: string, streamToken?: string): Promise<{ answer: string }> {
  const headers: Record<string, string> = {};
  if (streamToken) headers['x-stream-token'] = streamToken;

  const res = await signedFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, question }),
    headers,
  }, creds);
  if (!res.ok) throw new Error('Chat failed');
  return res.json();
}

export async function getStreamToken(creds: Credentials, sessionId: string): Promise<{ token: string; expires_at: string }> {
  const res = await signedFetch(`/sessions/${sessionId}/stream-token`, { method: 'POST' }, creds);
  if (!res.ok) throw new Error('Failed to get stream token');
  return res.json();
}
