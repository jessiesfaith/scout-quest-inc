import { getViewer } from "@/lib/viewer";
import { OWNER_EMAIL } from "@/lib/constants";
import { OsShell } from "../../shell";
import { RecoveryCodes } from "./recovery-codes";

export const dynamic = "force-dynamic";

type Status = { total: number; remaining: number; generated_at: string | null };

// Personal, not administrative: no permission key gates this, because
// every signed-in person needs to be able to look after their own second
// factor. There is nothing here about anyone else's account.
export default async function AccountSecurityPage() {
  const { supabase, email, isOwner } = await getViewer();

  const { data, error } = await supabase.rpc("mfa_recovery_status");
  // The function returns a single-row table, which PostgREST hands back
  // as an array.
  const status: Status | null = Array.isArray(data) ? (data[0] ?? null) : null;

  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const enrolled = (factorData?.totp ?? []).some((f) => f.status === "verified");

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "My account" },
        { label: "Security" },
      ]}
      lead="Your own two-factor authentication and recovery codes. Nothing on this page affects anyone else's account."
    >
      <h2 className="sec">Two-factor authentication</h2>
      <div className="card" style={{ padding: "15px 17px" }}>
        {enrolled ? (
          <p style={{ margin: 0 }}>
            <span className="badge b-live">active</span> An authenticator app
            is enrolled on this account.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <span className="badge b-plan">not enrolled</span>{" "}
            {email === OWNER_EMAIL
              ? "The owner account signs in with a password alone, by design — so that losing a phone can never lock the company out of its own system. Enrolling anyway is still worth doing."
              : "No authenticator is enrolled yet."}
          </p>
        )}
      </div>

      <h2 className="sec">Recovery codes</h2>
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not read recovery code status: {error.message}. Has migration
          0016 been run?
        </p>
      ) : (
        <RecoveryCodes
          remaining={status?.remaining ?? 0}
          total={status?.total ?? 0}
          generatedAt={status?.generated_at ?? null}
          enrolled={enrolled}
        />
      )}

      <p className="note">
        A recovery code replaces a lost authenticator; it does not replace
        your password and it does not sign you in on its own. If you have run
        out and cannot get in, someone holding{" "}
        <b>IT: Identity &amp; Access</b> can reset two-factor on your account
        from Identity &amp; Access — every reset is recorded there with who
        did it.
      </p>
    </OsShell>
  );
}
