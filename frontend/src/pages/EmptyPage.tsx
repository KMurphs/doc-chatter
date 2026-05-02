import { useSidebar } from '../App';

export function EmptyPage() {
  const { openSidebar } = useSidebar();
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-5 py-3 md:hidden">
        <span className="cursor-pointer text-lg text-light-muted dark:text-dark-muted hover:text-accent transition-colors" onClick={openSidebar}>☰</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-semibold text-light-text-primary dark:text-dark-text-primary">doc-chatter</div>
        <p className="text-sm text-light-muted dark:text-dark-muted">What paper would you like to explore?</p>
      </div>
    </div>
  );
}
