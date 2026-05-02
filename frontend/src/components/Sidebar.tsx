import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useSessions } from '../lib/sessions-context';
import { getSession, SessionDetail } from '../lib/sessions';
import { useAuth } from '../lib/auth';

const modelLabels: Record<string, string> = { opus: 'Deep', sonnet: 'Balanced', haiku: 'Fast' };

export function Sidebar({ onNavigate, activeSessionId }: { onNavigate?: () => void; activeSessionId?: string }) {
  const { sessions, loading, refresh } = useSessions();
  const { getCredentials } = useAuth();
  const navigate = useNavigate();
  const [activeDetail, setActiveDetail] = useState<SessionDetail | null>(null);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeSessionId) { setActiveDetail(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const creds = await getCredentials();
        if (!creds || cancelled) return;
        const detail = await getSession(creds, activeSessionId);
        if (!cancelled) setActiveDetail(detail);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId]);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="flex flex-col h-full bg-light-sidebar dark:bg-dark-sidebar pb-14">
      <div className="px-3 pt-3 pb-2">
        <Link
          to="/sessions/new"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
            text-light-text-secondary dark:text-dark-text-secondary
            hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt transition-colors"
        >
          <span className="text-accent text-base">+</span>
          New session
        </Link>
      </div>

      <div className="px-2 mb-1">
        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider
          text-light-muted dark:text-dark-muted">
          Recents
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="px-3 py-2 text-xs text-light-muted dark:text-dark-muted">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="px-3 py-2 text-xs text-light-muted dark:text-dark-muted">No sessions yet</div>
        ) : (
          sorted.map((s) => {
            const isActive = activeSessionId === s.session_id;
            return (
              <Link
                key={s.session_id}
                to={`/sessions/${s.session_id}`}
                onClick={onNavigate}
                className={`block rounded-lg px-3 my-0.5 transition-all ${
                  isActive
                    ? 'bg-accent/10 dark:bg-accent/15 py-3'
                    : 'hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt py-2'
                }`}
              >
                <div className={`text-sm truncate ${
                  isActive
                    ? 'text-accent dark:text-accent-muted font-medium'
                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                }`}>
                  {s.title}
                </div>

                {isActive ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {activeDetail && activeDetail.session_id === s.session_id ? (
                      <>
                        {[
                          ['Understanding', '—'],
                          ['Model', modelLabels[s.model] || s.model],
                          ['Tokens in', `~${Math.round(activeDetail.history.filter(t => t.role === 'user').reduce((a, t) => a + t.content.length, 0) / 4).toLocaleString()}`],
                          ['Tokens out', `~${Math.round(activeDetail.history.filter(t => t.role === 'assistant').reduce((a, t) => a + t.content.length, 0) / 4).toLocaleString()}`],
                          ['Paper size', `${(activeDetail.paper_text.length / 1024).toFixed(1)} KB`],
                          ['Paper tokens', `~${Math.round(activeDetail.paper_text.length / 4).toLocaleString()}`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between text-[10px]">
                            <span className="text-light-muted dark:text-dark-muted">{label}</span>
                            <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">{value}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-[10px] text-light-muted dark:text-dark-muted">Loading...</div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-light-muted dark:text-dark-muted">
                        {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })} · Created {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <span
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/sessions/${s.session_id}/edit`); onNavigate?.(); }}
                        className="text-[10px] text-accent hover:underline cursor-pointer"
                      >
                        Edit
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-light-muted dark:text-dark-muted mt-0.5">
                    {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
