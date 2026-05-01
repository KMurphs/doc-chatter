import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getSession, chat, getStreamToken, deleteSession, SessionDetail } from '../lib/sessions';
import { useSessions } from '../lib/sessions-context';

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCredentials } = useAuth();
  const { removeSession } = useSessions();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadSession();
  }, [id]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.history]);

  async function loadSession() {
    setLoading(true);
    try {
      const creds = await getCredentials();
      if (!creds || !id) return;
      const data = await getSession(creds, id);
      setSession(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !id || sending) return;
    const question = input;
    setInput('');
    setSending(true);
    setError('');

    // Optimistic: add user message
    setSession(prev => prev ? {
      ...prev,
      history: [...prev.history, { role: 'user', content: question }],
    } : prev);

    try {
      const creds = await getCredentials();
      if (!creds) throw new Error('Not authenticated');

      // Get stream token first
      const st = await getStreamToken(creds, id);

      const res = await chat(creds, id, question, st.token);

      setSession(prev => prev ? {
        ...prev,
        history: [...prev.history, { role: 'assistant', content: res.answer }],
      } : prev);
    } catch (e: any) {
      setError(e.message || 'Chat failed');
      // Remove optimistic message on error
      setSession(prev => prev ? {
        ...prev,
        history: prev.history.slice(0, -1),
      } : prev);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this session?')) return;
    // Optimistic: remove from sidebar immediately
    removeSession(id);
    navigate('/');
    try {
      const creds = await getCredentials();
      if (!creds) return;
      await deleteSession(creds, id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm text-light-muted dark:text-dark-muted">Loading session...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm text-red-500">Session not found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-light-border dark:border-dark-border">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent md:hidden transition-colors" onClick={() => navigate('/')}>←</span>
        <h1 className="text-sm font-medium flex-1 truncate">{session.title}</h1>
        <button
          onClick={handleDelete}
          className="text-xs text-light-muted dark:text-dark-muted hover:text-red-500 transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-4 py-6 flex flex-col gap-6">
          {session.history.length === 0 && (
            <div className="text-center text-sm text-light-muted dark:text-dark-muted py-12">
              Ask your first question about this paper
            </div>
          )}
          {session.history.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-accent/10 dark:bg-accent/15 text-light-text-primary dark:text-dark-text-primary rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]'
                  : 'text-light-text-primary dark:text-dark-text-primary max-w-full'
              }`}>
                {turn.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="text-sm text-light-muted dark:text-dark-muted italic">Thinking...</div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-red-500 dark:text-red-400 text-center">{error}</div>
      )}

      <div className="pb-4 px-4">
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-center gap-2 bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-2xl px-4 py-2 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the paper..."
              disabled={sending}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-light-muted dark:placeholder:text-dark-muted py-1.5 disabled:opacity-50"
            />
            <button className="text-light-muted dark:text-dark-muted hover:text-accent transition-colors text-lg">🎤</button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
                input.trim() && !sending
                  ? 'bg-accent text-white'
                  : 'bg-light-border dark:bg-dark-border text-light-muted dark:text-dark-muted'
              }`}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
