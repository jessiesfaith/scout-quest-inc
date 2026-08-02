import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OWNER_EMAIL } from "@/lib/constants";
import { OsShell } from "../../shell";
import { Decide } from "./forms";

export const dynamic = "force-dynamic";

type Request = {
  id: string;
  name: string | null;
  email: string;
  nda_accepted: boolean;
  nda_version: string | null;
  privacy_accepted: boolean;
  accepted_at: string | null;
  status: string;
  note: string | null;
  decided_at: string | null;
  created_at: string;
};

const BADGE: Record<string, string> = {
  pending: "b-ready",
  approved: "b-live",
  declined: "b-reg",
};

export default async function AccessRequestsPage() {
  const { supabase, email, isOwner } = await getViewer();
  const allowed = isOwner || (await checkPerm("HR: Team"));
  if (!allowed) redirect("/dashboard");

  const { data: requests, error } = await supabase
    .from("account_requests")
    .select(
      "id, name, email, nda_accepted, nda_version, privacy_accepted, accepted_at, status, note, decided_at, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<Request[]>();

  const list = requests ?? [];
  const pending = list.filter((r) => r.status === "pending");

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: "/it/identity-access" },
        { label: "Access Requests" },
      ]}
      lead="People who asked for an account from the public site. The consent badges record what the request form submitted at sign-up — treat them as the person's own assertion, not independent proof. Deciding here records your decision; it does not create a login."
      nav={[
        { label: "Identity & Access", href: "/it/identity-access" },
        { label: "Agent Platform", href: "/it/agent-platform" },
        { label: "Access Requests", href: "/it/access-requests", on: true },
        { label: "Zero-Day", href: "/it/zero-day" },
      ]}
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load requests: {error.message}. Has migration 0011 been
          run?
        </p>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="n" style={{ color: pending.length ? "var(--b)" : "var(--ok)" }}>
                {pending.length}
              </div>
              <div className="l">awaiting your decision</div>
            </div>
            <div className="tile">
              <div className="n">{list.length}</div>
              <div className="l">requests received</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Person</th>
                  <th>Consent</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--muted)" }}>
                      No requests yet.
                    </td>
                  </tr>
                ) : (
                  list.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)" }}>
                        {new Date(r.created_at).toISOString().slice(0, 10)}
                      </td>
                      <td>
                        <b>{r.name ?? "—"}</b>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {r.email}
                        </div>
                      </td>
                      <td>
                        {r.nda_accepted ? (
                          <span className="tag t-hi" style={{ marginRight: 5 }}>
                            NDA {r.nda_version ?? ""}
                          </span>
                        ) : (
                          <span className="tag t-lo" style={{ marginRight: 5 }}>
                            no NDA
                          </span>
                        )}
                        {r.privacy_accepted ? (
                          <span className="tag t-hi">privacy</span>
                        ) : (
                          <span className="tag t-lo">no privacy</span>
                        )}
                        {r.accepted_at && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            signed {new Date(r.accepted_at).toISOString().slice(0, 10)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${BADGE[r.status] ?? "b-reg"}`}>
                          {r.status}
                        </span>
                        {r.note && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {r.note}
                          </div>
                        )}
                      </td>
                      <td>
                        <Decide
                          requestId={r.id}
                          status={r.status}
                          note={r.note}
                        />
                        {r.decided_at && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            decided{" "}
                            {new Date(r.decided_at).toISOString().slice(0, 10)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="note">
            To actually grant access after approving: Supabase → Authentication
            → Users → Add user with their email, then link and assign a role in{" "}
            <a href="/it/identity-access" className="crumb">
              Identity &amp; Access
            </a>
            . Creating logins needs an admin key this app deliberately does not
            hold, so that step stays with you.
            {!isOwner && (
              <>
                {" "}
                Only {OWNER_EMAIL} can create the login itself.
              </>
            )}
          </p>
        </>
      )}
    </OsShell>
  );
}
