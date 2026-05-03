import { useNavigate } from 'react-router-dom';
import { useSidebar, useSettingsModal } from '../App';
import { useSessions } from '../lib';

export function EmptyPage() {
  const { openSidebar } = useSidebar();
  const { openSettings } = useSettingsModal();
  const { Settings: SessionSettings } = useSessions();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-5 py-3 md:hidden">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent transition-colors" onClick={openSidebar}>☰</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-3xl font-semibold text-light-text-primary dark:text-dark-text-primary">doc-chatter</div>
        <p className="text-sm text-light-muted dark:text-dark-muted text-center max-w-sm">
          {SessionSettings
            ? 'Sign in to start exploring research papers with voice.'
            : 'Paste a research paper and ask questions about it — hands-free, voice-first.'}
        </p>

        {SessionSettings && (
          <div className="w-full max-w-xs">
            <SessionSettings />
          </div>
        )}

        <button onClick={() => navigate('/sessions/new')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2 ${
            SessionSettings
              ? 'text-light-muted dark:text-dark-muted hover:text-accent'
              : 'bg-accent text-white hover:bg-accent/90'
          }`}>
          + New session
        </button>
        <button onClick={openSettings}
          className="text-xs text-light-muted dark:text-dark-muted hover:text-accent transition-colors">
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}
