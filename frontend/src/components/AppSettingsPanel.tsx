import { AppSettings } from '../lib/app-settings';

export function AppSettingsPanel({ settings, onChange, onClose }: {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}) {
  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-xl w-80 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-light-muted dark:text-dark-muted hover:text-accent text-lg">×</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Trigger word</label>
            <input className={inputCls} value={settings.triggerWord}
              onChange={e => onChange({ triggerWord: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. send, over" />
            <p className="text-[10px] text-light-muted dark:text-dark-muted mt-1">Say this word to send your message</p>
          </div>

          <div>
            <label className={labelCls}>Silence timeout: {settings.silenceTimeout}s</label>
            <input type="range" min="1" max="5" step="0.5" value={settings.silenceTimeout}
              onChange={e => onChange({ silenceTimeout: parseFloat(e.target.value) })}
              className="w-full mt-1 accent-accent" />
            <p className="text-[10px] text-light-muted dark:text-dark-muted mt-1">Auto-send after this silence (Auto mode)</p>
          </div>

          <div>
            <label className={labelCls}>Speech speed: {settings.ttsSpeed.toFixed(1)}×</label>
            <input type="range" min="0.5" max="2" step="0.1" value={settings.ttsSpeed}
              onChange={e => onChange({ ttsSpeed: parseFloat(e.target.value) })}
              className="w-full mt-1 accent-accent" />
            <p className="text-[10px] text-light-muted dark:text-dark-muted mt-1">How fast the assistant reads responses aloud</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-light-border dark:border-dark-border">
            <label className={labelCls}>Render markdown</label>
            <button onClick={() => onChange({ renderMarkdown: !settings.renderMarkdown })}
              className={`w-10 h-6 rounded-full transition-colors ${settings.renderMarkdown ? 'bg-accent' : 'bg-light-border dark:bg-dark-border'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${settings.renderMarkdown ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className={labelCls}>Dark mode</label>
            <button onClick={() => onChange({ darkMode: !settings.darkMode })}
              className={`w-10 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-accent' : 'bg-light-border dark:bg-dark-border'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${settings.darkMode ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
