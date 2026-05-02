import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { SessionsProvider } from './lib/sessions-context';
import { useAppSettings, AppSettingsProvider } from './lib/app-settings';
import { AppSettingsPanel } from './components/AppSettingsPanel';
import { Sidebar } from './components/Sidebar';
import { EmptyPage } from './pages/EmptyPage';
import { NewSessionPage } from './pages/NewSessionPage';
import { ChatPage } from './pages/ChatPage';
import { EditSessionPage } from './pages/EditSessionPage';
import { LoginPage } from './pages/LoginPage';

const SidebarContext = createContext<{ openSidebar: () => void }>({ openSidebar: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

function AppLayout() {
  const { isAuthenticated, isLoading, username, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const activeSessionId = location.pathname.match(/\/sessions\/([^/]+)/)?.[1];
  const { settings, update: updateSettings } = useAppSettings();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-dark-bg">
        <div className="text-light-muted dark:text-dark-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <SidebarContext.Provider value={{ openSidebar: () => setSidebarOpen(true) }}>
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
              <button onClick={() => updateSettings({ renderMarkdown: !settings.renderMarkdown })}
                className={`w-full flex items-center gap-2 px-2 py-2 mb-1 rounded-lg text-xs transition-colors ${
                  settings.renderMarkdown ? 'text-accent bg-accent/10' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt'
                }`}>
                <span>📝</span> Markdown {settings.renderMarkdown ? 'on' : 'off'}
              </button>
              <button onClick={() => setShowSettings(true)}
                className="w-full flex items-center gap-2 px-2 py-2 mb-2 rounded-lg text-xs text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt transition-colors">
                <span>⚙️</span> Settings
              </button>
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-light-muted dark:text-dark-muted truncate">{username}</span>
                <button onClick={logout}
                  className="text-xs text-light-muted dark:text-dark-muted hover:text-accent transition-colors">
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
        </div>
        {showSettings && <AppSettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />}
      </SessionsProvider>
    </SidebarContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppSettingsProvider>
          <AppLayout />
        </AppSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
