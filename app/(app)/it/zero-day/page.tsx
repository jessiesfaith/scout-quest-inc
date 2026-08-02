import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { ReportList, type Report } from "./report-list";
import { ReviewGuide } from "./guide";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "IT › Zero-Day — Scout Quest Inc",
};

export default async function ZeroDayPage() {
  const canRead =
    (await checkPerm("IT: Agent Platform")) ||
    (await checkPerm("Security Tooling: Change Management"));
  if (!canRead) redirect("/dashboard");

  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("security_reports")
    .select(
      "id, title, kind, scope, commit_sha, ran_at, filed_at, agent_count, reviewer, created_by_email, outcome, summary, findings, coverage",
    )
    .order("ran_at", { ascending: false })
    .returns<(Report & { filed_at: string | null })[]>();

  // Format dates on the server: locale formatting inside a client
  // component renders differently on server and client and warns.
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

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold">IT › Zero-Day</h1>
      <p className="mt-1 text-sm text-muted">
        Security and evaluation reviews run on this codebase, archived by date
        and time. Entries cannot be edited or deleted once filed — not by
        anyone, including you. Reports are filed by hand today, so an empty
        stretch means no review was filed, not that nothing needed one.
      </p>

      {error ? (
        <p className="mt-8 text-sm text-danger">
          Could not load reports: {error.message}. Has migration 0007 been
          run?
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-2xl font-semibold text-accent">
                  {list.length}
                </div>
                <div className="text-xs text-muted">reviews archived</div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-2xl font-semibold">
                  {list.reduce(
                    (n, r) =>
                      n +
                      (Array.isArray(r.findings) ? r.findings : []).filter(
                        (f) => f.status === "confirmed",
                      ).length,
                    0,
                  )}
                </div>
                <div className="text-xs text-muted">confirmed findings</div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div
                  className={`text-2xl font-semibold ${
                    openItems > 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {openItems}
                </div>
                <div className="text-xs text-muted">need your attention</div>
              </div>
            </div>

            <ReportList reports={list} />
          </div>

          <ReviewGuide />
        </div>
      )}
    </div>
  );
}
