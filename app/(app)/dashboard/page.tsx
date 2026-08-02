import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Stage 1 skeleton — auth, database, and the HR › Team loop.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/hr/team"
          className="rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-muted">
            HR › Team
          </div>
          <div className="mt-2 text-3xl font-semibold text-accent">
            {count ?? 0}
          </div>
          <div className="mt-1 text-sm text-muted">
            team member{count === 1 ? "" : "s"}
          </div>
        </Link>

        <div className="rounded-2xl border border-dashed border-border p-5 text-muted/60">
          <div className="text-xs font-medium uppercase tracking-wider">
            Contracts
          </div>
          <div className="mt-2 text-sm">Stage 2</div>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-5 text-muted/60">
          <div className="text-xs font-medium uppercase tracking-wider">
            Work orders
          </div>
          <div className="mt-2 text-sm">Stage 2</div>
        </div>
      </div>
    </div>
  );
}
