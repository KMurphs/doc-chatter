import { useState } from 'react';
import { AppSettings } from '../lib';
import { ProfileManager } from './ProfileManager';

export function AppSettingsPanel({ settings, onChange, onClose }: {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';

  function patch(partial: Partial<AppSettings>) {
    setDraft(prev => ({ ...prev, ...partial }));
  }

  function handleSave() {
    onChange(draft);
    onClose();
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <button onClick={onToggle}
        className={`w-10 h-6 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-light-border dark:bg-dark-border'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${on ? 'translate-x-4' : ''}`} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-xl w-80 md:w-96 max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-light-muted dark:text-dark-muted hover:text-accent text-lg">×</button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Voice */}
          <div>
            <label className={labelCls}>Trigger word</label>
            <input className={inputCls} value={draft.triggerWord}
              onChange={e => patch({ triggerWord: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. send, over" />
            <p className="text-[10px] text-light-muted dark:text-dark-muted mt-1">Say this word to send your message</p>
          </div>
          <div>
            <label className={labelCls}>Silence timeout: {draft.silenceTimeout}s</label>
            <input type="range" min="1" max="5" step="0.5" value={draft.silenceTimeout}
              onChange={e => patch({ silenceTimeout: parseFloat(e.target.value) })}
              className="w-full mt-1 accent-accent" />
          </div>
          <div>
            <label className={labelCls}>Speech speed: {draft.ttsSpeed.toFixed(1)}×</label>
            <input type="range" min="0.5" max="2" step="0.1" value={draft.ttsSpeed}
              onChange={e => patch({ ttsSpeed: parseFloat(e.target.value) })}
              className="w-full mt-1 accent-accent" />
          </div>

          {/* Display */}
          <div className="flex items-center justify-between pt-2 border-t border-light-border dark:border-dark-border">
            <label className={labelCls}>Render markdown</label>
            <Toggle on={draft.renderMarkdown} onToggle={() => patch({ renderMarkdown: !draft.renderMarkdown })} />
          </div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Dark mode</label>
            <Toggle on={draft.darkMode} onToggle={() => patch({ darkMode: !draft.darkMode })} />
          </div>

          {/* Profiles */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-accent hover:underline text-left pt-2 border-t border-light-border dark:border-dark-border">
            {showAdvanced ? '▾ Profiles' : '▸ Profiles'}
          </button>

          {showAdvanced && (
            <div>
              <p className="text-[10px] text-light-muted dark:text-dark-muted mb-3">
                Profiles bundle provider configs (inference, storage, voice). Assign a profile to each session.
              </p>
              <ProfileManager />
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-3 border-t border-light-border dark:border-dark-border">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
