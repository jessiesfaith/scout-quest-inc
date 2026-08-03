"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { issueRecoveryCodes, redeemRecoveryCode } from "./actions";
import { CodeSheet } from "./recovery-panel";
import s from "../landing.module.css";

type Mode = "loading" | "enroll" | "verify" | "error" | "codes";

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const didInit = useRef(false);

  const [redeem, redeemAction, redeeming] = useActionState(redeemRecoveryCode, {
    error: null,
    cleared: false,
  });

  // The factor is gone; the page has to start over as a fresh enrolment.
  // A full reload rather than a state reset, because the init effect is
  // deliberately once-only and Supabase's factor list is now stale.
  useEffect(() => {
    if (redeem.cleared) window.location.reload();
  }, [redeem.cleared]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // createClient() returns the shared browser singleton — cheap to call.
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        setMode("error");
        return;
      }

      const verified = factors.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }

      // Clear stale half-finished enrollments, then start a fresh one.
      for (const f of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data: enrollData, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Authenticator app",
        });
      if (enrollError) {
        setError(enrollError.message);
        setMode("error");
        return;
      }

      const rawQr = enrollData.totp.qr_code;
      setQr(
        rawQr.startsWith("<")
          ? `data:image/svg+xml;utf-8,${encodeURIComponent(rawQr)}`
          : rawQr,
      );
      setSecret(enrollData.totp.secret);
      setFactorId(enrollData.id);
      setMode("enroll");
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    // A brand-new authenticator means a brand-new sheet of recovery
    // codes, issued before the person leaves this page — the moment they
    // navigate away is the moment they can no longer be given any.
    if (mode === "enroll") {
      const result = await issueRecoveryCodes();
      if (result.codes) {
        setCodes(result.codes);
        setMode("codes");
        setPending(false);
        return;
      }
      // Failing to issue codes must not block the sign-in that just
      // succeeded; they can generate a set later from Account security.
      setError(
        `Two-factor is active, but recovery codes could not be created: ${result.error}`,
      );
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className={s.page}>
      <section className={s.login} style={{ minHeight: "100vh" }}>
        <div className={s.wrap}>
          <h2>
            {mode === "codes"
              ? "Save your recovery codes"
              : mode === "verify"
                ? "Two-factor verification"
                : "Set up two-factor authentication"}
          </h2>
          <p>
            {mode === "codes"
              ? "Two-factor authentication is now active on your account."
              : mode === "verify"
                ? "Enter the 6-digit code from your authenticator app."
                : "Two-factor authentication is required for team accounts."}
          </p>

          <div className={s.loginBox}>
            {mode === "loading" && (
              <p style={{ margin: 0, color: "#8fa2b8", fontSize: 14 }}>
                Loading…
              </p>
            )}

            {mode === "codes" && codes && (
              <CodeSheet
                codes={codes}
                doneLabel="Continue to the Company OS"
                onDone={() => {
                  router.push("/dashboard");
                  router.refresh();
                }}
              />
            )}

            {mode === "error" && (
              <p className={`${s.note} ${s.noteError}`} style={{ margin: 0 }}>
                {error ?? "Something went wrong."}
              </p>
            )}

            {(mode === "enroll" || mode === "verify") && (
              <form onSubmit={handleSubmit}>
                {mode === "enroll" && (
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    {qr && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qr}
                        alt="Scan this QR code with your authenticator app"
                        style={{
                          width: 180,
                          height: 180,
                          background: "#fff",
                          borderRadius: 12,
                          padding: 8,
                        }}
                      />
                    )}
                    <p
                      style={{
                        fontSize: 12,
                        color: "#8fa2b8",
                        margin: "10px 0 0",
                        wordBreak: "break-all",
                      }}
                    >
                      Scan with Google Authenticator, 1Password, Authy, etc. —
                      or enter the key manually: <b>{secret}</b>
                    </p>
                  </div>
                )}

                <label htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="123456"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="submit"
                  className={`${s.btn} ${s.btnPrimary}`}
                  disabled={pending || code.trim().length !== 6}
                >
                  {pending
                    ? "Verifying…"
                    : mode === "enroll"
                      ? "Activate 2FA"
                      : "Verify"}
                </button>
                {error && (
                  <p className={`${s.note} ${s.noteError}`}>{error}</p>
                )}
              </form>
            )}

            {mode === "verify" && !showRecovery && (
              <button
                type="button"
                className={s.note}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textDecoration: "underline",
                }}
                onClick={() => setShowRecovery(true)}
              >
                Lost your authenticator?
              </button>
            )}

            {mode === "verify" && showRecovery && (
              <form action={redeemAction} style={{ marginTop: 6 }}>
                <label htmlFor="recovery">Recovery code</label>
                <input
                  id="recovery"
                  name="code"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                  style={{ letterSpacing: ".06em" }}
                />
                <button
                  type="submit"
                  className={s.btn}
                  disabled={redeeming}
                >
                  {redeeming ? "Checking…" : "Use recovery code"}
                </button>
                <p className={s.note} style={{ marginBottom: 0 }}>
                  This does not sign you in. A valid code removes the
                  authenticator you lost so you can set up a new one — you
                  will still be asked to scan a fresh QR code.
                </p>
                {redeem.error && (
                  <p className={`${s.note} ${s.noteError}`}>{redeem.error}</p>
                )}
              </form>
            )}

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className={s.note}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Cancel and sign out
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
