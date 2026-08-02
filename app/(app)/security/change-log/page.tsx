import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { LogChangeForm } from "./form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Tooling › Change Log — Scout Quest Inc",
};

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

const CLASS_STYLE: Record<string, string> = {
  "1": "bg-accent-soft text-accent",
  "2": "bg-accent-soft text-accent",
  "3": "bg-gold/15 text-gold",
  "3+": "bg-danger/15 text-danger",
};

export default async function ChangeLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const canWrite =
    (await checkPerm("Security Tooling: Change Log")) ||
    (await checkPerm("Security Tooling: Change Management"));

  // Attribution reads from the row's own snapshot column: profiles are
  // visible only to self and the owner, so a lookup would show "—" to
  // everyone else, and it survives the author's account being deleted.
  const { data: entries, error } = await supabase
    .from("change_log")
    .select(CHANGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ChangeRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">
        Security Tooling › Change Log
      </h1>
      <p className="mt-1 text-sm text-muted">
        Append-only record of what changed, where, and who recorded it. There
        is no edit or delete path — not in the app, and not in the database —
        and the timestamp and author are stamped server-side, so neither can
        be set by whoever files the entry. Showing the most recent 200.
      </p>

      {error ? (
        <p className="mt-8 text-sm text-danger">
          Could not load: {error.message}. Has migration 0007 been run?
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {canWrite && <LogChangeForm />}

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {(entries ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted">No entries yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Where</th>
                    <th className="px-5 py-3 font-medium">Change</th>
                    <th className="px-5 py-3 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {(entries ?? []).map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border align-top last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {[e.product, e.module, e.tab]
                          .filter(Boolean)
                          .join(" › ") || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {e.change_type && (
                            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                              {e.change_type}
                            </span>
                          )}
                          {e.change_class && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                CLASS_STYLE[e.change_class] ??
                                "bg-surface-raised text-muted"
                              }`}
                            >
                              class {e.change_class}
                            </span>
                          )}
                        </div>
                        <div className="mt-1">{e.description}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {e.created_by_email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
