import { useState, createContext, useContext, useCallback, ReactNode } from 'react';

export interface AppSettings {
  triggerWord: string;
  silenceTimeout: number;
  ttsSpeed: number;
  darkMode: boolean;
  renderMarkdown: boolean;
}

const DEFAULTS: AppSettings = {
  triggerWord: 'send',
  silenceTimeout: 2,
  ttsSpeed: 1.1,
  darkMode: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  renderMarkdown: true,
};

const KEY = 'doc-chatter-app-settings';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore corrupt localStorage */ }
  return { ...DEFAULTS };
}

function save(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

interface AppSettingsCtx {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => void;
}

const Ctx = createContext<AppSettingsCtx | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
