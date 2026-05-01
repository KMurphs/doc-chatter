import { useState } from 'react';

export interface SessionFormData {
  title: string;
  model: string;
  paper_text: string;
  subject_expertise: string;
  research_expertise: string;
  system_prompt: string;
}

interface Props {
  initial: SessionFormData;
  onSubmit: (data: SessionFormData) => Promise<void>;
  submitLabel: string;
  /** Hide paper_text field (e.g. when editing) */
  hidePaper?: boolean;
}

const modelLabels: Record<string, string> = { opus: 'Deep', sonnet: 'Balanced', haiku: 'Fast' };

export function SessionForm({ initial, onSubmit, submitLabel, hidePaper }: Props) {
  const [form, setForm] = useState<SessionFormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof SessionFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  async function handleSubmit() {
    if (!hidePaper && !form.paper_text.trim()) { setError('Paper text is required'); return; }
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-xl p-3.5 text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-light-muted dark:placeholder:text-dark-muted";
  const labelCls = "block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2";

  return (
    <div className="max-w-[560px] mx-auto px-6 py-8">
      {!hidePaper && (
        <>
          <label className={labelCls}>Paper text</label>
          <textarea
            className={inputCls + " h-44 resize-y"}
            placeholder="Paste the paper text here..."
            value={form.paper_text}
            onChange={e => set('paper_text', e.target.value)}
          />
          <button className="mt-3 border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
            📎 Upload PDF
          </button>
        </>
      )}

      <label className={labelCls + (!hidePaper ? " mt-8" : "")}>Title</label>
      <input
        type="text"
        className={inputCls}
        placeholder="Auto-generated from paper"
        value={form.title}
        onChange={e => set('title', e.target.value)}
      />

      <label className={labelCls + " mt-8"}>Model</label>
      <div className="flex rounded-xl overflow-hidden border border-light-border dark:border-dark-border">
        {(['opus', 'sonnet', 'haiku'] as const).map(m => (
          <button
            key={m}
            onClick={() => set('model', m)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              form.model === m
                ? 'bg-accent text-white'
                : 'bg-light-surface-alt dark:bg-dark-surface-alt text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }`}
          >
            {modelLabels[m]}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mt-8">
        <div className="flex-1">
          <label className={labelCls}>Subject expertise</label>
          <select className={inputCls} value={form.subject_expertise} onChange={e => set('subject_expertise', e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Research expertise</label>
          <select className={inputCls} value={form.research_expertise} onChange={e => set('research_expertise', e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>
      </div>

      <label className={labelCls + " mt-8"}>System prompt</label>
      <textarea
        className={inputCls + " h-48 resize-y"}
        placeholder="Custom instructions for the assistant..."
        value={form.system_prompt}
        onChange={e => set('system_prompt', e.target.value)}
      />

      {error && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full mt-10 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}
