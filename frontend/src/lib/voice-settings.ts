import { useState } from 'react';

export interface VoiceSettings {
  triggerWord: string;
  silenceTimeout: number;
  ttsSpeed: number;
  darkMode: boolean;
}

const DEFAULTS: VoiceSettings = {
  triggerWord: 'send',
  silenceTimeout: 2,
  ttsSpeed: 1.1,
  darkMode: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
};

const KEY = 'doc-chatter-voice-settings';

function load(): VoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore corrupt localStorage */ }
  return { ...DEFAULTS };
}

function save(s: VoiceSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(load);

  function update(partial: Partial<VoiceSettings>) {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }

  return { settings, update };
}
