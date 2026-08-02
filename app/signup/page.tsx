"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NDA_VERSION } from "@/lib/constants";
import s from "../landing.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // The NDA checkbox stays disabled until the NDA has been opened.
  const [ndaOpened, setNdaOpened] = useState(false);
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!ndaAgreed || !privacyAgreed) {
      setError("Please agree to the NDA and the privacy notice.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          nda_accepted: "true",
          nda_version: NDA_VERSION,
          privacy_accepted: "true",
        },
      },
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    if (!data.session) {
      // Email confirmation is on — the account exists but needs the link.
      setConfirmEmailSent(true);
      setPending(false);
      return;
    }

    router.push("/mfa");
    router.refresh();
  }

  return (
    <div className={s.page}>
      <section className={s.login} style={{ minHeight: "100vh" }}>
        <div className={s.wrap}>
          <h2>Create your account</h2>
          <p>
            Scout Quest Inc is invite-only. Create an account, then an admin
            assigns your role before you can enter.
          </p>

          {confirmEmailSent ? (
            <div className={s.loginBox}>
              <p style={{ margin: 0, color: "#dbe6f2", fontSize: 14 }}>
                Almost there — check <b>{email}</b> for a confirmation link,
                then <Link href="/#login">sign in</Link>.
              </p>
            </div>
          ) : (
            <form className={s.loginBox} onSubmit={handleSubmit}>
              <label htmlFor="first">Legal first name</label>
              <input
                id="first"
                required
                autoComplete="given-name"
                placeholder="Ada"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <label htmlFor="last">Legal last name</label>
              <input
                id="last"
                required
                autoComplete="family-name"
                placeholder="Lovelace"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@scoutquest.inc"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />

              <div className={s.consent}>
                <label
                  className={`${s.consentRow} ${!ndaOpened ? s.consentLocked : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={!ndaOpened}
                    checked={ndaAgreed}
                    onChange={(e) => setNdaAgreed(e.target.checked)}
                  />
                  <span>
                    I have read and agree to the{" "}
                    <a
                      href="/legal/nda"
                      target="_blank"
                      rel="noopener"
                      onClick={() => setNdaOpened(true)}
                      onAuxClick={() => setNdaOpened(true)}
                      onContextMenu={() => setNdaOpened(true)}
                    >
                      Non-Disclosure Agreement
                    </a>{" "}
                    ({NDA_VERSION}), and the name above is my legal name.
                  </span>
                </label>
                {!ndaOpened && (
                  <p className={s.consentHint}>
                    Open the NDA link to enable this checkbox.
                  </p>
                )}
                <label className={s.consentRow}>
                  <input
                    type="checkbox"
                    checked={privacyAgreed}
                    onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  />
                  <span>
                    I have read the{" "}
                    <a href="/legal/privacy" target="_blank" rel="noopener">
                      privacy notice
                    </a>
                    .
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className={`${s.btn} ${s.btnPrimary}`}
                disabled={pending || !ndaAgreed || !privacyAgreed}
              >
                {pending ? "Creating account…" : "Create account"}
              </button>
              {error && <p className={`${s.note} ${s.noteError}`}>{error}</p>}
              <p className={s.note}>
                Your name, email, NDA version, and acceptance time are recorded
                as your electronic signature. Already have an account?{" "}
                <Link href="/#login">Sign in</Link>.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
