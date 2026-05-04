import { useState, useRef } from 'react';
import { Profile, listProfiles, saveProfile, deleteProfile, exportProfiles, importProfiles, AXES } from '../lib';

function profileSummary(profile: Profile): string[] {
  const lines: string[] = [];
  if (profile.inference.chatProvider === 'generic') {
    lines.push('Provider: OpenAI-compatible');
    if (profile.inference.providerUrl) lines.push(`URL: ${profile.inference.providerUrl}`);
    if (profile.inference.providerModelId) lines.push(`Model: ${profile.inference.providerModelId}`);
  }
  if (profile.inference.chatProvider === 'bedrock') {
    lines.push('Provider: AWS Bedrock');
    lines.push(`Region: ${profile.inference.bedrockRegion || 'us-east-1'}`);
    if (profile.inference.bedrockModelId) lines.push(`Model: ${profile.inference.bedrockModelId}`);
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
    setEditing({
      id: crypto.randomUUID(), name: '',
      inference: { chatProvider: 'generic', providerUrl: 'https://api.openai.com/v1/chat/completions', providerToken: '', providerModelId: 'gpt-4o-mini', bedrockRegion: 'us-east-1', bedrockModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' },
      voice: {},
    });
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
    try { await importProfiles(file); refresh(); } catch { alert('Invalid profile file'); }
    e.target.value = '';
  }

  function patchInference(partial: Partial<Profile['inference']>) {
    setEditing(prev => prev ? { ...prev, inference: { ...prev.inference, ...partial } } : prev);
  }

  // --- Edit form ---
  if (editing) {
    return (
      <div className="flex flex-col gap-3 p-3 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
        <div>
          <label className={labelCls}>Profile name</label>
          <input className={inputCls} value={editing.name} onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)} placeholder="e.g. Groq Free" />
        </div>

        {/* Inference */}
        <div>
          <label className={labelCls}>Inference provider</label>
          <select className={selectCls} value={editing.inference.chatProvider || 'generic'} onChange={e => patchInference({ chatProvider: e.target.value })}>
            {AXES.find(a => a.settingsKey === 'chatProvider')?.options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {editing.inference.chatProvider === 'generic' ? (
          <>
            <div>
              <label className={labelCls}>Endpoint URL</label>
              <input className={inputCls} value={editing.inference.providerUrl || ''} onChange={e => patchInference({ providerUrl: e.target.value })} placeholder="https://api.openai.com/v1/chat/completions" />
            </div>
            <div>
              <label className={labelCls}>API Key</label>
              <input className={inputCls} type="password" value={editing.inference.providerToken || ''} onChange={e => patchInference({ providerToken: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Model</label>
              <input className={inputCls} value={editing.inference.providerModelId || ''} onChange={e => patchInference({ providerModelId: e.target.value })} placeholder="gpt-4o-mini" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelCls}>Region</label>
              <input className={inputCls} value={editing.inference.bedrockRegion || ''} onChange={e => patchInference({ bedrockRegion: e.target.value })} placeholder="us-east-1" />
            </div>
            <div>
              <label className={labelCls}>Model ID</label>
              <input className={inputCls} value={editing.inference.bedrockModelId || ''} onChange={e => patchInference({ bedrockModelId: e.target.value })} />
            </div>
          </>
        )}

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
            <button onClick={() => setEditing({ ...p })} className="text-[10px] text-light-muted dark:text-dark-muted hover:text-accent">Edit</button>
            <button onClick={() => handleDelete(p.id)} className="text-[10px] text-red-400 hover:text-red-300">×</button>
          </div>
          <div className="mt-1 text-[10px] text-light-muted dark:text-dark-muted leading-relaxed">
            {profileSummary(p).map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <button onClick={handleNew} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10">+ New</button>
        <button onClick={() => exportProfiles(profiles)} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-light-muted dark:text-dark-muted hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt">Export all</button>
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
      <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">Profile</label>
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
