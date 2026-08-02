"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import s from "../landing.module.css";

type Mode = "loading" | "form" | "error";

// True when the access token's amr claim shows a recovery (reset-link)
// sign-in. Read-only inspection of our own token — the server re-validates
// everything that matters.
function tokenHasRecovery(accessToken: string): boolean {
  try {
    const payload = JSON.parse(
      atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { amr?: { method?: string }[] };
    return (payload.amr ?? []).some((m) => m.method === "recovery");
  } catch {
    return false;
  }
}

// Lands here from the password-reset email. The browser client exchanges
// the code in the URL for a recovery session, then the user sets a new
// password. Must be opened in the same browser the reset was requested in
// (the PKCE verifier cookie lives there).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const supabase = createClient();
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(
            `${error.message} — request a new link, and open it in the same browser you asked from.`,
          );
          setMode("error");
          return;
        }
        setMode("form");
        return;
      }
      // No code in the URL. Only continue if this session actually came
      // from a recovery link — otherwise any signed-in visitor (including
      // someone on a borrowed, unlocked browser) could change the password
      // here without knowing the current one. The auth-method claim lives
      // in the access token, not on the user object.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && tokenHasRecovery(session.access_token)) {
        setMode("form");
      } else {
        setError(
          "This page only works from a password-reset email link. Request one from the sign-in box.",
        );
        setMode("error");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className={s.page}>
      <section className={s.login} style={{ minHeight: "100vh" }}>
        <div className={s.wrap}>
          <h2>Set a new password</h2>
          <p>Choose a new password for your Scout Quest Inc account.</p>
          <div className={s.loginBox}>
            {mode === "loading" && (
              <p style={{ margin: 0, color: "#8fa2b8", fontSize: 14 }}>
                Checking your reset link…
              </p>
            )}
            {mode === "error" && (
              <p className={`${s.note} ${s.noteError}`} style={{ margin: 0 }}>
                {error}
              </p>
            )}
            {mode === "form" && (
              <form onSubmit={handleSubmit}>
                <label htmlFor="npw">New password</label>
                <input
                  id="npw"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <label htmlFor="npw2">Confirm new password</label>
                <input
                  id="npw2"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="submit"
                  className={`${s.btn} ${s.btnPrimary}`}
                  disabled={pending}
                >
                  {pending ? "Saving…" : "Save new password"}
                </button>
                {error && (
                  <p className={`${s.note} ${s.noteError}`}>{error}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
