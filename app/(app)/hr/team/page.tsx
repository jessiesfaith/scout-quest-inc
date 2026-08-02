import { createClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./add-member-form";

// Live data on every request — the list must reflect the DB, not a cache.
export const dynamic = "force-dynamic";

type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, name, role, email, status, created_at")
    .order("created_at", { ascending: true })
    .returns<TeamMember[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">HR › Team</h1>
      <p className="mt-1 text-sm text-muted">
        Team members live from Supabase — additions persist across reload.
      </p>

      <div className="mt-8 space-y-6">
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
                  <th className="px-5 py-3 font-medium">Email</th>
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
                    <td className="px-5 py-3 text-muted">{m.email ?? "—"}</td>
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
