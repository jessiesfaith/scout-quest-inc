import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { CHANGE_COLUMNS, type ChangeRow } from "../change-log/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Tooling › Change Management — Scout Quest Inc",
};

// Class definitions come from the Enterprise Constitution — this screen
// shows how work is classified and what each class requires.
const CLASSES = [
  {
    id: "1",
    name: "Routine",
    rule: "Reversible, no new surface. Ship it and log it.",
    gate: "No approval needed.",
  },
  {
    id: "2",
    name: "Notable",
    rule: "Changes behaviour people rely on, still reversible.",
    gate: "Review before merge; record the entry.",
  },
  {
    id: "3",
    name: "Governed",
    rule: "Auth, data model, permissions, or a new external surface.",
    gate: "State tradeoffs, get the owner's ruling, review before merge.",
  },
  {
    id: "3+",
    name: "High risk",
    rule: "Anything touching regulated data or hard to reverse.",
    gate: "Owner ruling required, plus an independent review on record.",
  },
];

export default async function ChangeManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  if (!(await checkPerm("Security Tooling: Change Management"))) {
    redirect("/security/change-log");
  }

  const LIMIT = 50;
  // count: "exact" gives the true total even though only LIMIT rows come
  // back, so the per-class tallies aren't quietly capped.
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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">
        Security Tooling › Change Management
      </h1>
      <p className="mt-1 text-sm text-muted">
        How changes are classified, and every governed change on record. New
        entries are recorded on{" "}
        <Link href="/security/change-log" className="text-accent hover:underline">
          Change Log
        </Link>
        .
      </p>

      <div className="mt-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CLASSES.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Class {c.id}
                </span>
                <span className="text-sm font-semibold">{c.name}</span>
                {counts.get(c.id) != null && (
                  <span className="ml-auto text-xs text-muted">
                    {counts.get(c.id)} shown
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted">{c.rule}</p>
              <p className="mt-1 text-xs text-gold">{c.gate}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Governed changes (class 3 and 3+)
            {truncated && (
              <span className="ml-2 font-normal normal-case text-muted">
                — showing the {LIMIT} most recent of {count}
              </span>
            )}
          </div>
          {error ? (
            <p className="p-5 text-sm text-danger">
              Could not load governed changes: {error.message}. This list is
              not empty — it failed to load.
            </p>
          ) : shown.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              None recorded yet. Governed work should leave a trail here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((g) => (
                <li key={g.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        g.change_class === "3+"
                          ? "bg-danger/15 text-danger"
                          : "bg-gold/15 text-gold"
                      }`}
                    >
                      class {g.change_class}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(g.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted">
                      {[g.product, g.module, g.tab].filter(Boolean).join(" › ")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">{g.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
