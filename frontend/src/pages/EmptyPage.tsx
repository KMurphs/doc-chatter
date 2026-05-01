export function EmptyPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="text-3xl font-semibold text-light-text-primary dark:text-dark-text-primary">
        doc-chatter
      </div>
      <p className="text-sm text-light-muted dark:text-dark-muted">
        What paper would you like to explore?
      </p>
    </div>
  );
}
