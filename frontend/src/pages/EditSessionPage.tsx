import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getSession, updateSession, SessionDetail } from '../lib/sessions';
import { useSessions } from '../lib/sessions-context';
import { SessionForm, SessionFormData } from '../components/SessionForm';

export function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCredentials } = useAuth();
  const { refresh } = useSessions();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const creds = await getCredentials();
        if (!creds || !id) return;
        setSession(await getSession(creds, id));
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  async function handleSave(data: SessionFormData) {
    const creds = await getCredentials();
    if (!creds || !id) throw new Error('Not authenticated');
    await updateSession(creds, id, {
      title: data.title,
      model: data.model,
      subject_expertise: data.subject_expertise,
      research_expertise: data.research_expertise,
      system_prompt: data.system_prompt,
    });
    refresh();
    navigate(`/sessions/${id}`);
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-light-muted dark:text-dark-muted">Loading...</span></div>;
  if (!session) return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-red-500">Session not found</span></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-light-border dark:border-dark-border">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent transition-colors" onClick={() => navigate(`/sessions/${id}`)}>←</span>
        <h1 className="text-sm font-medium flex-1 truncate">Edit: {session.title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SessionForm
          initial={{
            title: session.title,
            model: session.model,
            paper_text: '',
            subject_expertise: session.subject_expertise,
            research_expertise: session.research_expertise,
            system_prompt: session.system_prompt,
          }}
          onSubmit={handleSave}
          submitLabel="Save Changes"
          hidePaper
        />
      </div>
    </div>
  );
}
