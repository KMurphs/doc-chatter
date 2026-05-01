import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useSessions } from '../lib/sessions-context';

export function Sidebar({ onNavigate, activeSessionId }: { onNavigate?: () => void; activeSessionId?: string }) {
  const { sessions, loading, refresh } = useSessions();

  useEffect(() => { refresh(); }, []);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="flex flex-col h-full bg-light-sidebar dark:bg-dark-sidebar pb-14">
      <div className="px-3 pt-3 pb-2 flex flex-col gap-1">
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
          sorted.map((s) => (
            <Link
              key={s.session_id}
              to={`/sessions/${s.session_id}`}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2 my-0.5 transition-colors ${
                activeSessionId === s.session_id
                  ? 'bg-accent/10 dark:bg-accent/15'
                  : 'hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt'
              }`}
            >
              <div className={`text-sm truncate ${
                activeSessionId === s.session_id
                  ? 'text-accent dark:text-accent-muted font-medium'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}>
                {s.title}
              </div>
              <div className="text-[11px] text-light-muted dark:text-dark-muted mt-0.5">
                {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
