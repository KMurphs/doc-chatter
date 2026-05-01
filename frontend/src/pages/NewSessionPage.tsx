import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { createSession } from '../lib/sessions';
import { useSessions } from '../lib/sessions-context';
import { SessionForm, SessionFormData } from '../components/SessionForm';

const DEFAULT_SYSTEM_PROMPT = `You are a research paper assistant helping someone who is driving or walking. They cannot read — they are listening to your responses. Keep responses concise: short sentences, clear transitions, no bullet points or lists. Speak naturally as if explaining to a colleague. When making claims, reference which part of the paper you are drawing from. If the answer is not in the paper, say so rather than guessing.`;

export function NewSessionPage() {
  const navigate = useNavigate();
  const { getCredentials } = useAuth();
  const { addSession } = useSessions();

  async function handleCreate(data: SessionFormData) {
    const creds = await getCredentials();
    if (!creds) throw new Error('Not authenticated');
    const res = await createSession(creds, {
      paper_text: data.paper_text,
      title: data.title || undefined,
      model: data.model,
      subject_expertise: data.subject_expertise,
      research_expertise: data.research_expertise,
      system_prompt: data.system_prompt || undefined,
    });
    addSession({
      session_id: res.session_id,
      title: data.title || data.paper_text.slice(0, 50).trim(),
      model: data.model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    navigate(`/sessions/${res.session_id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-light-border dark:border-dark-border">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent md:hidden transition-colors" onClick={() => navigate('/')}>←</span>
        <h1 className="text-sm font-medium flex-1">New Session</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SessionForm
          initial={{ title: '', model: 'sonnet', paper_text: '', subject_expertise: 'medium', research_expertise: 'medium', system_prompt: DEFAULT_SYSTEM_PROMPT }}
          onSubmit={handleCreate}
          submitLabel="Start Session"
        />
      </div>
    </div>
  );
}
