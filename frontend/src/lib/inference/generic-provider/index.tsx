import { SessionDetail } from '../../sessions/types';
import { InferenceService } from '../types';

export function createService(url: string, token: string): InferenceService {
  return {
    async chat(session: SessionDetail, question: string): Promise<string> {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ session_id: session.session_id, question }),
      });
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
      const data = await res.json();
      return data.answer ?? data.choices?.[0]?.message?.content ?? JSON.stringify(data);
    },
  };
}

export function Settings({ config, onChange }: {
  config: { providerUrl: string; providerToken: string; providerModelId: string };
  onChange: (updates: Partial<{ providerUrl: string; providerToken: string; providerModelId: string }>) => void;
}) {
  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';

  return (
    <>
      <div>
        <label className={labelCls}>Endpoint URL</label>
        <input className={inputCls} value={config.providerUrl}
          onChange={e => onChange({ providerUrl: e.target.value })}
          placeholder="https://api.example.com/chat" />
      </div>
      <div>
        <label className={labelCls}>Token</label>
        <input className={inputCls} type="password" value={config.providerToken}
          onChange={e => onChange({ providerToken: e.target.value })}
          placeholder="Bearer token or API key" />
      </div>
      <div>
        <label className={labelCls}>Model ID (optional)</label>
        <input className={inputCls} value={config.providerModelId}
          onChange={e => onChange({ providerModelId: e.target.value })}
          placeholder="e.g. gpt-4o, claude-sonnet-4-20250514" />
      </div>
    </>
  );
}
