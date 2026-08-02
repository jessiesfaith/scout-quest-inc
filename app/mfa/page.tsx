"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import s from "../landing.module.css";

type Mode = "loading" | "enroll" | "verify" | "error";

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const didInit = useRef(false);

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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className={s.page}>
      <section className={s.login} style={{ minHeight: "100vh" }}>
        <div className={s.wrap}>
          <h2>
            {mode === "verify"
              ? "Two-factor verification"
              : "Set up two-factor authentication"}
          </h2>
          <p>
            {mode === "verify"
              ? "Enter the 6-digit code from your authenticator app."
              : "Two-factor authentication is required for team accounts."}
          </p>

          <div className={s.loginBox}>
            {mode === "loading" && (
              <p style={{ margin: 0, color: "#8fa2b8", fontSize: 14 }}>
                Loading…
              </p>
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
