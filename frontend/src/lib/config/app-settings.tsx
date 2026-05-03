import { useState, createContext, useContext, useCallback, ReactNode } from 'react';

/** Consumer-facing settings — display and voice preferences only. */
export interface UserSettings {
  triggerWord: string;
  silenceTimeout: number;
  ttsSpeed: number;
  darkMode: boolean;
  renderMarkdown: boolean;
}

/** Provider config — owned by the factory. */
export interface FactorySettings {
  storageMode: string;
  chatProvider: string;
  providerUrl: string;
  providerToken: string;
  providerModelId: string;
  bedrockRegion: string;
  bedrockModelId: string;
}

/** Full persisted config — union of user prefs + factory config. */
export interface AppSettings extends UserSettings, FactorySettings {}

const DEFAULTS: AppSettings = {
  triggerWord: 'send',
  silenceTimeout: 2,
  ttsSpeed: 1.1,
  darkMode: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  renderMarkdown: true,
  storageMode: 'local',
  chatProvider: 'generic',
  providerUrl: 'https://api.openai.com/v1/chat/completions',
  providerToken: '',
  providerModelId: 'gpt-4o-mini',
  bedrockRegion: 'us-east-1',
  bedrockModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
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

/** Internal — full settings. Only used by factory and settings panel. */
export function useAppSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}

/** Consumer-facing — only display and voice fields visible. */
export function useUserSettings(): { settings: UserSettings; update: (partial: Partial<UserSettings>) => void } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserSettings must be used within AppSettingsProvider');
  return ctx;
}
