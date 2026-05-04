import { SessionDetail, SessionSummary, SessionService, CreateSessionRequest } from '../types';

const DB_NAME = 'doc-chatter';
const STORE = 'sessions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'session_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export const service: SessionService = {
  async list(): Promise<SessionSummary[]> {
    const s = await store('readonly');
    const all: SessionDetail[] = await idbReq(s.getAll());
    return all.map(({ session_id, title, model, created_at, updated_at }) => ({
      session_id, title, model, created_at, updated_at,
    }));
  },

  async get(id: string): Promise<SessionDetail> {
    const s = await store('readonly');
    const result: SessionDetail | undefined = await idbReq(s.get(id));
    if (!result) throw new Error('Session not found');
    return result;
  },

  async create(data: CreateSessionRequest): Promise<{ session_id: string }> {
    const now = new Date().toISOString();
    const session: SessionDetail = {
      session_id: crypto.randomUUID(),
      title: data.title || 'Untitled',
      paper_text: data.paper_text,
      history: [],
      model: data.model || 'sonnet',
      system_prompt: data.system_prompt || '',
      subject_expertise: data.subject_expertise || 'medium',
      research_expertise: data.research_expertise || 'medium',
      created_at: now,
      updated_at: now,
    };
    const s = await store('readwrite');
    await idbReq(s.put(session));
    return { session_id: session.session_id };
  },

  async update(id: string, updates: Record<string, unknown>): Promise<SessionDetail> {
    const s = await store('readwrite');
    const session: SessionDetail | undefined = await idbReq(s.get(id));
    if (!session) throw new Error('Session not found');
    Object.assign(session, updates, { updated_at: new Date().toISOString() });
    await idbReq(s.put(session));
    return session;
  },

  async delete(id: string): Promise<void> {
    const s = await store('readwrite');
    await idbReq(s.delete(id));
  },

  async appendHistory(id: string, role: string, content: string): Promise<void> {
    const s = await store('readwrite');
    const session: SessionDetail | undefined = await idbReq(s.get(id));
    if (!session) throw new Error('Session not found');
    session.history.push({ role, content });
    session.updated_at = new Date().toISOString();
    await idbReq(s.put(session));
  },
};

export const Settings = null;
