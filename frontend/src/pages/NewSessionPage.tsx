import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { createSession } from '../lib/sessions';
import { useSessions } from '../lib/sessions-context';

export function NewSessionPage() {
  const navigate = useNavigate();
  const { getCredentials } = useAuth();
  const { addSession } = useSessions();
  const [model, setModel] = useState('sonnet');
  const [paperText, setPaperText] = useState('');
  const [title, setTitle] = useState('');
  const [subjectExpertise, setSubjectExpertise] = useState('medium');
  const [researchExpertise, setResearchExpertise] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!paperText.trim()) { setError('Paper text is required'); return; }
    setError('');
    setLoading(true);
    try {
      const creds = await getCredentials();
      if (!creds) throw new Error('Not authenticated');
      const res = await createSession(creds, {
        paper_text: paperText,
        title: title || undefined,
        model,
        subject_expertise: subjectExpertise,
        research_expertise: researchExpertise,
      });
      addSession({
        session_id: res.session_id,
        title: title || paperText.slice(0, 50).trim(),
        model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      navigate(`/sessions/${res.session_id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-xl p-3.5 text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-light-muted dark:placeholder:text-dark-muted";
  const labelCls = "block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-light-border dark:border-dark-border">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent md:hidden transition-colors" onClick={() => navigate('/')}>←</span>
        <h1 className="text-sm font-medium flex-1">New Session</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-6 py-8">
          <label className={labelCls}>Paper text</label>
          <textarea
            className={inputCls + " h-44 resize-y"}
            placeholder="Paste the paper text here..."
            value={paperText}
            onChange={(e) => setPaperText(e.target.value)}
          />
          <button className="mt-3 border border-light-border dark:border-dark-border rounded-xl px-4 py-2.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
            📎 Upload PDF
          </button>

          <label className={labelCls + " mt-8"}>Title (optional)</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Auto-generated from paper"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className={labelCls + " mt-8"}>Model</label>
          <div className="flex rounded-xl overflow-hidden border border-light-border dark:border-dark-border">
            {(['opus', 'sonnet', 'haiku'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  model === m
                    ? 'bg-accent text-white'
                    : 'bg-light-surface-alt dark:bg-dark-surface-alt text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {m === 'opus' ? 'Deep' : m === 'sonnet' ? 'Balanced' : 'Fast'}
              </button>
            ))}
          </div>

          <div className="flex gap-4 mt-8">
            <div className="flex-1">
              <label className={labelCls}>Subject expertise</label>
              <select className={inputCls} value={subjectExpertise} onChange={(e) => setSubjectExpertise(e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Research expertise</label>
              <select className={inputCls} value={researchExpertise} onChange={(e) => setResearchExpertise(e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full mt-10 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
