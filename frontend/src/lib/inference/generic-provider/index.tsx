import { SessionDetail } from '../../sessions/types';
import { InferenceService } from '../types';

export function createService(url: string, token: string, modelId: string): InferenceService {
  return {
    async chat(session: SessionDetail, question: string): Promise<string> {
      const systemPrompt = session.system_prompt || `You are a research paper assistant.\n\nPaper:\n${session.paper_text}`;
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...session.history.map(t => ({ role: t.role as 'user' | 'assistant', content: t.content })),
        { role: 'user' as const, content: question },
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: modelId, messages }),
      });
      if (!res.ok) {
        const text = await res.text();
        const short = text.length > 200 ? text.slice(0, 200) + '…' : text;
        throw new Error(`${res.status}: ${short}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? JSON.stringify(data);
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
          placeholder="https://api.openai.com/v1/chat/completions" />
      </div>
      <div>
        <label className={labelCls}>API Key</label>
        <input className={inputCls} type="password" value={config.providerToken}
          onChange={e => onChange({ providerToken: e.target.value })}
          placeholder="sk-..." />
      </div>
      <div>
        <label className={labelCls}>Model</label>
        <input className={inputCls} value={config.providerModelId}
          onChange={e => onChange({ providerModelId: e.target.value })}
          placeholder="gpt-4o-mini" />
      </div>
      <p className="text-[10px] text-light-muted dark:text-dark-muted">OpenAI-compatible API — works with OpenAI, Ollama, Groq, LM Studio, etc.</p>
    </>
  );
}
