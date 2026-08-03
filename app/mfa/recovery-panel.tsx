"use client";

import { useState } from "react";
import s from "../landing.module.css";

/**
 * The one-and-only display of a set of recovery codes. Shown after a
 * successful enrolment and after a deliberate regeneration; never again,
 * because only their hashes are stored.
 */
export function CodeSheet({
  codes,
  onDone,
  doneLabel = "I have saved these",
}: {
  codes: string[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const text = codes.join("\n");

  return (
    <div>
      <p className={s.note} style={{ marginTop: 0 }}>
        Save these somewhere that is not your phone. Each one works once, and
        lets you replace a lost authenticator. <b>They will not be shown
        again</b> — only their hashes are kept, so nobody, including the
        owner, can look them up for you later.
      </p>

      <pre
        style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 14,
          lineHeight: 1.9,
          letterSpacing: ".06em",
          margin: "0 0 12px",
          textAlign: "center",
          userSelect: "all",
        }}
      >
        {text}
      </pre>

      <button
        type="button"
        className={`${s.btn}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            // Clipboard access can be refused; the codes are selectable
            // above, so this is a convenience, not the only way out.
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy to clipboard"}
      </button>

      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          margin: "14px 0 10px",
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ width: "auto", marginTop: 3 }}
        />
        <span>I have stored these somewhere safe.</span>
      </label>

      <button
        type="button"
        className={`${s.btn} ${s.btnPrimary}`}
        disabled={!confirmed}
        onClick={onDone}
      >
        {doneLabel}
      </button>
    </div>
  );
}
