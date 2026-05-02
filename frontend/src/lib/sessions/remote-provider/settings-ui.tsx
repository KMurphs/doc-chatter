import { useAuth } from './auth';

export function Settings() {
  const { isAuthenticated, username, login, logout } = useAuth();
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Signed in as {username}</span>
        <button onClick={logout} className="text-xs text-accent hover:underline">Sign out</button>
      </div>
    );
  }
  return <LoginForm onLogin={login} />;
}

function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const inputCls = 'w-full mt-1 px-3 py-2 rounded-lg text-sm bg-light-surface-alt dark:bg-dark-surface-alt border border-light-border dark:border-dark-border focus:outline-none focus:border-accent/50';
  const labelCls = 'text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await onLogin(form.get('email') as string, form.get('password') as string);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className={labelCls}>Email</label>
      <input name="email" type="email" className={inputCls} required />
      <label className={labelCls}>Password</label>
      <input name="password" type="password" className={inputCls} required />
      <button type="submit" className="mt-1 px-3 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90">Sign in</button>
    </form>
  );
}
