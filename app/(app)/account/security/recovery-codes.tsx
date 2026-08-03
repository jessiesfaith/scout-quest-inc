"use client";

import { useState, useTransition } from "react";
import { issueRecoveryCodes } from "@/app/mfa/actions";

export function RecoveryCodes({
  remaining,
  total,
  generatedAt,
  enrolled,
}: {
  remaining: number;
  total: number;
  generatedAt: string | null;
  /** Is an authenticator actually enrolled? Issuing needs a 2FA-verified
   *  session, which is impossible without one — so the button is hidden
   *  rather than offered and then refused by the database. */
  enrolled: boolean;
}) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await issueRecoveryCodes();
      if (result.codes) setCodes(result.codes);
      else setError(result.error);
    });
  }

  if (codes) {
    const text = codes.join("\n");
    return (
      <div className="formcard">
        <p style={{ marginTop: 0 }}>
          <b>Save these now.</b> Each works once. Only their hashes are
          stored, so this is the only time they can be shown — regenerating
          is the only way to get a readable set again, and it invalidates
          these.
        </p>
        <pre
          style={{
            background: "#f6f8fb",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13.5,
            lineHeight: 1.9,
            letterSpacing: ".06em",
            margin: "0 0 12px",
            userSelect: "all",
          }}
        >
          {text}
        </pre>
        <button
          type="button"
          className="addbtn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          className="addbtn2"
          onClick={() => setCodes(null)}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "15px 17px" }}>
      {total === 0 ? (
        <p style={{ marginTop: 0 }}>
          <span className="badge b-plan">none</span> No recovery codes have
          been generated for this account. Without them, a lost authenticator
          needs an administrator to reset your two-factor.
        </p>
      ) : (
        <p style={{ marginTop: 0 }}>
          <span
            className={`badge ${remaining > 2 ? "b-live" : remaining > 0 ? "b-ready" : "b-plan"}`}
          >
            {remaining} of {total} unused
          </span>{" "}
          {generatedAt &&
            `Generated ${new Date(generatedAt).toLocaleDateString()}.`}
          {remaining === 0 && " Generate a new set before you need one."}
        </p>
      )}

      {!enrolled ? (
        <p className="note" style={{ marginBottom: 0 }}>
          Recovery codes exist to replace a lost authenticator, so there is
          nothing to recover until one is enrolled. Generating a set requires
          a two-factor-verified session — enforced in the database, not just
          here, because otherwise a stolen password alone could print codes
          that defeat two-factor permanently.
        </p>
      ) : (
        <button
          type="button"
          className="addbtn"
          onClick={generate}
          disabled={pending}
        >
          {pending
            ? "Generating…"
            : total === 0
              ? "Generate recovery codes"
              : "Replace with a new set"}
        </button>
      )}
      {enrolled && total > 0 && (
        <p className="note" style={{ marginBottom: 0 }}>
          Generating a new set immediately invalidates every code in the old
          one, used or not.
        </p>
      )}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
