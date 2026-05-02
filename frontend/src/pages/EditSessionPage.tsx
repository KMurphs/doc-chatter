import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getSession, updateSession, deleteSession, SessionDetail } from '../lib/sessions';
import { useSessions } from '../lib/sessions-context';
import { SessionForm, SessionFormData } from '../components/SessionForm';

import { useSidebar } from '../App';

export function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCredentials } = useAuth();
  const { refresh, removeSession } = useSessions();
  const { openSidebar } = useSidebar();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  async function handleDelete() {
    if (!id) return;
    removeSession(id);
    navigate('/');
    try {
      const creds = await getCredentials();
      if (creds) await deleteSession(creds, id);
    } catch {}
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
        <div className="max-w-[480px] mx-auto px-6 pb-10">
          <div className="border-t border-light-border dark:border-dark-border pt-8 mt-4">
            {confirmDelete ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-red-500 dark:text-red-400 font-medium">Are you sure? This will permanently delete this session and all its history.</p>
                <div className="flex gap-3">
                  <button onClick={handleDelete}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 border border-light-border dark:border-dark-border rounded-xl text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-alt dark:hover:bg-dark-surface-alt transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 border border-red-500/30 text-red-500 dark:text-red-400 rounded-xl text-sm hover:bg-red-500/10 transition-colors">
                Delete session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
