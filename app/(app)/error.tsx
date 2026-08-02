"use client";

import "./os.css";
import "./os-extra.css";

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
    <div className="os" style={{ minHeight: "100vh" }}>
      <div className="top">
        <h1>Scout Quest Inc — Company OS</h1>
      </div>
      <div className="wrap">
        <h2 className="sec">Something went wrong</h2>
        <p className="lead">
          This screen hit an error. Your data is fine — try again, and if it
          keeps happening, note what you were doing.
        </p>
        <div className="card">
          <div className="constext">
            <p className="err">{error.message}</p>
            {error.digest && (
              <p className="note">Reference: {error.digest}</p>
            )}
          </div>
        </div>
        <button onClick={reset} className="addbtn">
          Try again
        </button>
      </div>
    </div>
  );
}
