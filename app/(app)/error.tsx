"use client";

// Without this, an unhandled error in any app screen replaces the whole
// UI with Next's bare error page — no nav, no way back.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This screen hit an error. Your data is fine — try again, and if it
        keeps happening, note what you were doing.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-danger">{error.message}</p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
