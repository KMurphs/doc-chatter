import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth';
import { listSessions, deleteSession as apiDeleteSession, createSession as apiCreateSession, SessionSummary, CreateSessionRequest } from './sessions';

interface SessionsState {
  sessions: SessionSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeSession: (id: string) => void;
  addSession: (session: SessionSummary) => void;
}

const SessionsContext = createContext<SessionsState | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { getCredentials } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const creds = await getCredentials();
    if (!creds) return;
    try {
      const data = await listSessions(creds);
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  const removeSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.session_id !== id));
  }, []);

  const addSession = useCallback((session: SessionSummary) => {
    setSessions(prev => [session, ...prev]);
  }, []);

  return (
    <SessionsContext.Provider value={{ sessions, loading, refresh, removeSession, addSession }}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider');
  return ctx;
}
