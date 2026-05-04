import { useState, useRef } from 'react';
import { Profile, listProfiles, saveProfile, deleteProfile, exportProfile, importProfile } from '../lib';
import { AXES, FactorySettings } from '../lib';

const DEFAULTS: FactorySettings = {
  storageMode: 'local',
  chatProvider: 'generic',
  providerUrl: 'https://api.openai.com/v1/chat/completions',
  providerToken: '',
  providerModelId: 'gpt-4o-mini',
  bedrockRegion: 'us-east-1',
  bedrockModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
};

function profileSummary(profile: Profile): string[] {
  const lines: string[] = [];
  for (const axis of AXES) {
    const key = profile[axis.settingsKey as keyof Profile] as string | undefined;
    const option = axis.options.find(o => o.key === key);
    if (option) lines.push(`${axis.label}: ${option.label}`);
  }
  if (profile.chatProvider === 'generic' && profile.providerUrl) {
    lines.push(`URL: ${profile.providerUrl}`);
    if (profile.providerModelId) lines.push(`Model: ${profile.providerModelId}`);
  }
  if (profile.chatProvider === 'bedrock') {
    lines.push(`Region: ${profile.bedrockRegion || 'us-east-1'}`);
    if (profile.bedrockModelId) lines.push(`Model: ${profile.bedrockModelId}`);
  }
  return lines;
}

export function ProfileManager() {
  const [profiles, setProfiles] = useState<Profile[]>(listProfiles);
  const [editing, setEditing] = useState<Profile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';
  const selectCls = inputCls + ' appearance-none cursor-pointer';

  function refresh() { setProfiles(listProfiles()); }

  function handleNew() {
    setEditing({ id: crypto.randomUUID(), name: '', ...DEFAULTS });
  }

  function handleSave() {
    if (!editing || !editing.name.trim()) return;
    saveProfile(editing);
    setEditing(null);
    refresh();
  }

  function handleDelete(id: string) {
    deleteProfile(id);
    refresh();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await importProfile(file); refresh(); } catch { alert('Invalid profile file'); }
    e.target.value = '';
  }

  function patch(partial: Partial<Profile>) {
    setEditing(prev => prev ? { ...prev, ...partial } : prev);
  }

  // --- Edit form ---
  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Profile name</label>
          <input className={inputCls} value={editing.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Groq Free" />
        </div>

        {AXES.map(axis => {
          const currentKey = (editing[axis.settingsKey as keyof Profile] ?? axis.options[0]?.key) as string;
          const active = axis.options.find(o => o.key === currentKey) ?? axis.options[0];
          return (
            <div key={axis.settingsKey} className="flex flex-col gap-2">
              <div>
                <label className={labelCls}>{axis.label}</label>
                {axis.options.length > 1 ? (
                  <select className={selectCls} value={currentKey}
                    onChange={e => patch({ [axis.settingsKey]: e.target.value })}>
                    {axis.options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-light-muted dark:text-dark-muted mt-1">{active?.label}</p>
                )}
              </div>
              {active?.Settings && <active.Settings draft={editing as FactorySettings} onChange={patch} />}
            </div>
          );
        })}

        <div className="flex gap-2 mt-1">
          <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90">Save profile</button>
        </div>
      </div>
    );
  }

  // --- List view ---
  return (
    <div className="flex flex-col gap-2">
      {profiles.length === 0 && <p className="text-xs text-light-muted dark:text-dark-muted">No profiles yet</p>}
      {profiles.map(p => (
        <div key={p.id} className="px-3 py-2 rounded-lg bg-light-surface-alt dark:bg-dark-surface-alt">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
            <button onClick={() => setEditing({ ...DEFAULTS, ...p })} className="text-[10px] text-light-muted dark:text-dark-muted hover:text-accent">Edit</button>
            <button onClick={() => exportProfile(p)} className="text-[10px] text-light-muted dark:text-dark-muted hover:text-accent">Export</button>
            <button onClick={() => handleDelete(p.id)} className="text-[10px] text-red-400 hover:text-red-300">×</button>
          </div>
          <div className="mt-1 text-[10px] text-light-muted dark:text-dark-muted leading-relaxed">
            {profileSummary(p).map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <button onClick={handleNew} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10">+ New</button>
        <button onClick={() => fileRef.current?.click()} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-light-muted dark:text-dark-muted hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt">Import</button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
    </div>
  );
}

export function ProfileSelect({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const profiles = listProfiles();
  const selected = profiles.find(p => p.id === value);
  const selectCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50 cursor-pointer';

  return (
    <div>
      <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">Inference profile</label>
      <select className={selectCls} value={value || ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">Default (from settings)</option>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {selected && (
        <div className="mt-1 text-[10px] text-light-muted dark:text-dark-muted leading-relaxed">
          {profileSummary(selected).map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
