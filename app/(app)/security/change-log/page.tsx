import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
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
};

export const CHANGE_COLUMNS =
  "id, product, module, tab, change_type, change_class, description, created_by, created_by_email, created_at";

const CLASS_TAG: Record<string, string> = {
  "1": "t-hi",
  "2": "t-hi",
  "3": "t-med",
  "3+": "t-lo",
};

export default async function ChangeLogPage() {
  const { supabase, email, isOwner } = await getViewer();

  const canWrite =
    (await checkPerm("Security Tooling: Change Log")) ||
    (await checkPerm("Security Tooling: Change Management"));

  // Attribution reads from the row's own snapshot column: profiles are
  // visible only to self and the owner, and it survives account deletion.
  const { data: entries, error } = await supabase
    .from("change_log")
    .select(CHANGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ChangeRow[]>();

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "Security Tooling", href: "/security/change-management" },
        { label: "Change Log" },
      ]}
      lead="Append-only record of what changed, where, and who recorded it. There is no edit or delete path — not in the app, and not in the database — and the timestamp and author are stamped server-side, so neither can be set by whoever files the entry. Showing the most recent 200."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {error.message}. Has migration 0007 been run?
        </p>
      ) : (
        <>
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
                {(entries ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  (entries ?? []).map((e) => (
                    <tr key={e.id}>
                      <td
                        style={{
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {new Date(e.created_at)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)}
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
