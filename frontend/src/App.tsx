import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { SessionsProvider } from './lib/sessions-context';
import { Sidebar } from './components/Sidebar';
import { EmptyPage } from './pages/EmptyPage';
import { NewSessionPage } from './pages/NewSessionPage';
import { ChatPage } from './pages/ChatPage';
import { EditSessionPage } from './pages/EditSessionPage';
import { LoginPage } from './pages/LoginPage';

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-4 right-4 z-40 w-9 h-9 rounded-full flex items-center justify-center text-sm
        bg-light-surface-alt dark:bg-dark-surface-alt
        border border-light-border dark:border-dark-border
        text-light-text-secondary dark:text-dark-text-secondary
        hover:text-accent transition-colors shadow-sm"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

function AppLayout() {
  const { isAuthenticated, isLoading, username, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const activeSessionId = location.pathname.match(/\/sessions\/([^/]+)/)?.[1];
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-dark-bg">
        <div className="text-light-muted dark:text-dark-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
      </>
    );
  }

  return (
    <SessionsProvider>
      <div className="flex h-screen bg-light-bg dark:bg-dark-bg text-light-text-primary dark:text-dark-text-primary">
        <div className={`
          ${sidebarOpen ? 'block' : 'hidden'}
          md:block
          w-full md:w-64 md:flex-shrink-0
          md:border-r md:border-light-border md:dark:border-dark-border
          absolute md:relative z-10 h-full
        `}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} activeSessionId={activeSessionId} />
          <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-light-border dark:border-dark-border bg-light-sidebar dark:bg-dark-sidebar">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-light-muted dark:text-dark-muted truncate">{username}</span>
              <button
                onClick={logout}
                className="text-xs text-light-muted dark:text-dark-muted hover:text-accent transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className={`
          ${sidebarOpen ? 'hidden' : 'flex'}
          md:flex
          flex-col flex-1 min-w-0
        `}>
          <Routes>
            <Route path="/" element={<EmptyPage />} />
            <Route path="/sessions/new" element={<NewSessionPage />} />
            <Route path="/sessions/:id" element={<ChatPage />} />
            <Route path="/sessions/:id/edit" element={<EditSessionPage />} />
          </Routes>
        </div>

        <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
      </div>
    </SessionsProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
