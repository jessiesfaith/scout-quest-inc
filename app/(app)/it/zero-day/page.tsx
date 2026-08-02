import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { ReportList, type Report } from "./report-list";
import { ReviewGuide } from "./guide";

export const dynamic = "force-dynamic";

export default async function ZeroDayPage() {
  const { supabase, email, isOwner } = await getViewer();
  const canRead =
    (await checkPerm("IT: Agent Platform")) ||
    (await checkPerm("Security Tooling: Change Management"));
  if (!canRead) redirect("/dashboard");

  const { data: reports, error } = await supabase
    .from("security_reports")
    .select(
      "id, title, kind, scope, commit_sha, ran_at, filed_at, agent_count, reviewer, created_by_email, outcome, summary, findings, coverage",
    )
    .order("ran_at", { ascending: false })
    .returns<(Report & { filed_at: string | null })[]>();

  // Format on the server: locale formatting inside a client component
  // renders differently on server and client and warns.
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  };

  const list: Report[] = (reports ?? []).map((r) => ({
    ...r,
    ran_at_label: fmt(r.ran_at) ?? "unknown time",
    filed_at_label: fmt(r.filed_at),
  }));

  const openItems = list.filter((r) => r.outcome === "needs-attention").length;
  const confirmed = list.reduce(
    (n, r) =>
      n +
      (Array.isArray(r.findings) ? r.findings : []).filter(
        (f) => f.status === "confirmed",
      ).length,
    0,
  );

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: "/it/identity-access" },
        { label: "Zero-Day" },
      ]}
      lead="Security and evaluation reviews run on this codebase, archived by date and time. Entries cannot be edited or deleted once filed — not by anyone, including you. Reports are filed by hand today, so an empty stretch means no review was filed, not that nothing needed one."
      nav={[
        { label: "Identity & Access", href: "/it/identity-access" },
        { label: "Agent Platform", href: "/it/agent-platform" },
        { label: "Access Requests", href: "/it/access-requests" },
        { label: "Zero-Day", href: "/it/zero-day", on: true },
      ]}
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load reports: {error.message}. Has migration 0007 been run?
        </p>
      ) : (
        <div className="zd-grid">
          <div>
            <div className="tiles" style={{ marginBottom: 18 }}>
              <div className="tile">
                <div className="n">{list.length}</div>
                <div className="l">reviews archived</div>
              </div>
              <div className="tile">
                <div className="n">{confirmed}</div>
                <div className="l">confirmed findings</div>
              </div>
              <div className="tile">
                <div className="n" style={{ color: openItems > 0 ? "var(--danger)" : "var(--ok)" }}>
                  {openItems}
                </div>
                <div className="l">need your attention</div>
              </div>
            </div>

            <ReportList reports={list} />
          </div>

          <ReviewGuide />
        </div>
      )}
    </OsShell>
  );
}
