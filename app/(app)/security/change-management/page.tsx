import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { getPermissions } from "@/lib/reachable";
import { itNav, itCrumbHref } from "../../it/nav";
import { CHANGE_COLUMNS, type ChangeRow } from "../change-log/page";

export const dynamic = "force-dynamic";

// Class definitions come from the Enterprise Constitution §4.
const CLASSES = [
  {
    id: "1",
    name: "Routine",
    rule: "Reversible, low-cost, no regulated data, within budget.",
    gate: "Agent may proceed; logged and evaluated.",
  },
  {
    id: "2",
    name: "Notable",
    rule: "Cross-module impact, new dependencies, moderate cost, or a new workflow.",
    gate: "Department Manager approval.",
  },
  {
    id: "3",
    name: "Governed",
    rule: "Architecture, security, compliance, spend structure, or org design.",
    gate: "Jessica — executive approval.",
  },
  {
    id: "3+",
    name: "High risk",
    rule: "Regulated-data flows to external parties, legal exposure.",
    gate: "Jessica plus external counsel / compliance review.",
  },
];

export default async function ChangeManagementPage() {
  const { supabase, email, isOwner } = await getViewer();
  if (!(await checkPerm("Security Tooling: Change Management"))) {
    redirect("/security/change-log");
  }

  const held = await getPermissions();

  const LIMIT = 50;
  const { data: governed, error, count } = await supabase
    .from("change_log")
    .select(CHANGE_COLUMNS, { count: "exact" })
    .in("change_class", ["3", "3+"])
    .order("created_at", { ascending: false })
    .limit(LIMIT)
    .returns<ChangeRow[]>();

  const shown = governed ?? [];
  const counts = new Map<string, number>();
  for (const row of shown) {
    if (!row.change_class) continue;
    counts.set(row.change_class, (counts.get(row.change_class) ?? 0) + 1);
  }
  const truncated = (count ?? shown.length) > shown.length;

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/security/change-log", held) },
        { label: "Security Tooling", href: "/security/change-log" },
        { label: "Change Management" },
      ]}
      lead="How changes are classified, and every governed change on record. New entries are recorded on the Change Log."
      nav={itNav("/security/change-log", held)}
    >
      <h2 className="sec">Change classes</h2>
      <div className="modgrid">
        {CLASSES.map((c) => (
          <div className="modcard" key={c.id}>
            <h3>
              Class {c.id} <span className="badge b-gov">{c.name}</span>
              {counts.get(c.id) != null && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11.5,
                    color: "var(--muted)",
                  }}
                >
                  {counts.get(c.id)} shown
                </span>
              )}
            </h3>
            <p>{c.rule}</p>
            <div className="open" style={{ color: "var(--warn)" }}>
              {c.gate}
            </div>
          </div>
        ))}
      </div>

      <h2 className="sec">
        Governed changes — class 3 and 3+
        {truncated && (
          <span style={{ textTransform: "none", fontWeight: 400 }}>
            {" "}
            (showing the {LIMIT} most recent of {count})
          </span>
        )}
      </h2>

      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load governed changes: {error.message}. This list is not
          empty — it failed to load.
        </p>
      ) : shown.length === 0 ? (
        <p className="note">
          None recorded yet. Governed work should leave a trail here —{" "}
          <Link href="/security/change-log" className="crumb">
            record one
          </Link>
          .
        </p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Class</th>
                <th>Where</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.id}>
                  <td
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    {new Date(g.created_at)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 16)}
                  </td>
                  <td>
                    <span
                      className={`tag ${g.change_class === "3+" ? "t-lo" : "t-med"}`}
                    >
                      class {g.change_class}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {[g.product, g.module, g.tab].filter(Boolean).join(" › ")}
                  </td>
                  <td>{g.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OsShell>
  );
}
