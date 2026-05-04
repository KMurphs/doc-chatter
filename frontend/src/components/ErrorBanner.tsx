import { useState } from 'react';

export function ErrorBanner({ error }: { error: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="px-4 py-2 flex items-start gap-2 shrink-0 max-w-full overflow-hidden">
      <span className="text-sm text-red-500 break-all line-clamp-3 min-w-0">{error}</span>
      <button onClick={() => { navigator.clipboard.writeText(error); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-xs text-red-400 hover:text-red-300 shrink-0 mt-0.5">{copied ? '✓' : '📋'}</button>
    </div>
  );
}
