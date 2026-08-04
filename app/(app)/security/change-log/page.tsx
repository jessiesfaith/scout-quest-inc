import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { getPermissions } from "@/lib/reachable";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../../it/nav";
import { LogChangeForm } from "./form";

export const dynamic = "force-dynamic";

export type ChangeRow = {
  id: string;
  product: string | null;
  module: string | null;
  tab: string | null;
  change_type: string | null;
  change_class: string | null;
  description: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  source: string | null;
  source_ref: string | null;
  authored_at: string | null;
};

export const CHANGE_COLUMNS =
  "id, product, module, tab, change_type, change_class, description, created_by, created_by_email, created_at, source, source_ref, authored_at";

const CLASS_TAG: Record<string, string> = {
  "1": "t-hi",
  "2": "t-hi",
  "3": "t-med",
  "3+": "t-lo",
};

export default async function ChangeLogPage() {
  const { supabase, email, isOwner } = await getViewer();

  const canGov = await checkPerm("Security Tooling: Change Management");
  const canWrite =
    (await checkPerm("Security Tooling: Change Log")) || canGov;

  const held = await getPermissions();

  // Attribution reads from the row's own snapshot column: profiles are
  // visible only to self and the owner, and it survives account deletion.
  const { data: entries, error } = await supabase
    .from("change_log")
    .select(CHANGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ChangeRow[]>();

  // A git sync files a batch of commits within the same second, so filing
  // order says nothing useful about them. Re-sort by when each change
  // actually happened. The 200-row window is still chosen by filing time —
  // ordering on an expression is not something PostgREST can do — so a
  // very old commit synced today appears, correctly, near the bottom.
  const rows = [...(entries ?? [])].sort((a, b) =>
    (b.authored_at ?? b.created_at).localeCompare(a.authored_at ?? a.created_at),
  );

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/security/change-log", held) },
        { label: "Security Tooling", href: "/security/change-log" },
        { label: "Change Log" },
      ]}
      lead="Append-only record of what changed, where, and who recorded it. There is no edit or delete path — not in the app, and not in the database — and the filing timestamp and author are stamped server-side, so neither can be set by whoever files the entry. Entries tagged git are generated from commit history: their date is the commit's, and their author is a commit author rather than a signed-in person. Showing the most recent 200."
      nav={itNav("/security/change-log", held)}
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {error.message}. Has migration 0007 been run?
        </p>
      ) : (
        <>
          {canGov && (
            <p className="note">
              Governed changes (class 3 / 3+) have their own view:{" "}
              <Link href="/security/change-management" className="crumb">
                Change Management →
              </Link>
            </p>
          )}

          {canWrite && (
            <>
              <h2 className="sec">Log a change</h2>
              <LogChangeForm />
            </>
          )}

          <h2 className="sec">Change log</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Where</th>
                  <th>Change</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => (
                    <tr key={e.id}>
                      <td
                        style={{
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {/* When the change happened, which for a commit is
                            its author date rather than the moment the sync
                            filed it. created_at stays the forced, unforgeable
                            one and is shown underneath when they differ. */}
                        {new Date(e.authored_at ?? e.created_at)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)}
                        {e.authored_at &&
                          e.authored_at.slice(0, 10) !==
                            e.created_at.slice(0, 10) && (
                            <div style={{ fontSize: 10.5 }}>
                              filed {e.created_at.slice(0, 10)}
                            </div>
                          )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {[e.product, e.module, e.tab].filter(Boolean).join(" › ") ||
                          "—"}
                      </td>
                      <td>
                        {e.change_type && (
                          <span className="tag t-hi" style={{ marginRight: 5 }}>
                            {e.change_type}
                          </span>
                        )}
                        {e.change_class && (
                          <span
                            className={`tag ${CLASS_TAG[e.change_class] ?? "t-hi"}`}
                          >
                            class {e.change_class}
                          </span>
                        )}
                        <div style={{ marginTop: 4 }}>{e.description}</div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {e.created_by_email ?? "—"}
                        {e.source === "git" && (
                          <div style={{ fontSize: 10.5 }}>
                            <span className="tag t-lo">git</span>{" "}
                            <code>{e.source_ref?.slice(0, 7)}</code>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OsShell>
  );
}
