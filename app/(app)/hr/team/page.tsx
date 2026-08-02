import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./add-member-form";

// Live data on every request — the list must reflect the DB, not a cache.
export const dynamic = "force-dynamic";

type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  working_on: string | null;
  status: string;
  created_at: string;
};

type ContractSummary = {
  team_member_id: string | null;
  type: string | null;
  status: string;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const [
    { data: members, error },
    { data: contracts, error: contractsError },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name, role, email, working_on, status, created_at")
      .order("created_at", { ascending: true })
      .returns<TeamMember[]>(),
    // Contract status comes from the DB, not JS state. RLS decides what
    // this caller may see: without HR/Security permission the query
    // returns nothing and the column simply reads "—".
    supabase
      .from("contracts")
      .select("team_member_id, type, status")
      .returns<ContractSummary[]>(),
  ]);

  const contractsByMember = new Map<string, ContractSummary[]>();
  for (const c of contracts ?? []) {
    if (!c.team_member_id) continue;
    const list = contractsByMember.get(c.team_member_id) ?? [];
    list.push(c);
    contractsByMember.set(c.team_member_id, list);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">HR › Team</h1>
      <p className="mt-1 text-sm text-muted">
        Team members live from Supabase — additions persist across reload.
        Contract badges come from{" "}
        <Link href="/hr/contracts" className="text-accent hover:underline">
          HR › Contracts
        </Link>
        ; gold means pending, green means complete.
      </p>

      <div className="mt-8 space-y-6">
        {contractsError && (
          <p className="rounded-2xl border border-danger/40 bg-surface p-4 text-sm text-danger">
            Contract badges are unavailable: {contractsError.message}. The
            member list below is still accurate.
          </p>
        )}

        <AddMemberForm />

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {error ? (
            <p className="p-5 text-sm text-danger">
              Could not load team members: {error.message}. Has the Stage 1
              migration been run in the Supabase SQL Editor?
            </p>
          ) : !members || members.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No team members yet — add the first one above.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Working on</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Contracts</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-5 py-3 font-medium">{m.name}</td>
                    <td className="px-5 py-3 text-muted">{m.role ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      {m.working_on ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted">{m.email ?? "—"}</td>
                    <td className="px-5 py-3">
                      {(() => {
                        const list = contractsByMember.get(m.id) ?? [];
                        if (list.length === 0)
                          return <span className="text-muted">—</span>;
                        return (
                          <div className="flex flex-wrap gap-1">
                            {list.map((c, i) => (
                              <span
                                key={i}
                                title={`${c.type ?? "Contract"} — ${c.status}`}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  c.status === "complete"
                                    ? "bg-success/10 text-success"
                                    : "bg-gold/15 text-gold"
                                }`}
                              >
                                {c.type ?? "Contract"}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
