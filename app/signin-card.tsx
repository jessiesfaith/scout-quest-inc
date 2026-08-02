"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import s from "./landing.module.css";

export function SignInCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className={s.login} id="signin">
      <h3>Sign in to the studio</h3>
      <p className={s.loginSub}>Team access to the Scout Quest company OS.</p>
      <form onSubmit={handleSubmit}>
        <div className={s.field}>
          <label htmlFor="signin-email">Work email</label>
          <input
            id="signin-email"
            type="email"
            required
            placeholder="you@scoutquest.education"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={s.field}>
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className={`${s.btn} ${s.btnPrimary}`}
          type="submit"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        {error && <div className={`${s.note} ${s.noteError}`}>{error}</div>}
      </form>
      <div className={s.alt}>
        New to the team? <a href="#careers">Request access →</a>
      </div>
      <div className={s.note}>Invite-only during private beta.</div>
    </div>
  );
}
