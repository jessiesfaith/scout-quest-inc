import { getViewer } from "@/lib/viewer";
import { OsShell } from "../../shell";
import { AddMemberForm } from "./add-member-form";

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
  const { supabase, email, isOwner } = await getViewer();

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
    // this caller may see; without HR/Security permission it reads "—".
    supabase
      .from("contracts")
      .select("team_member_id, type, status")
      .returns<ContractSummary[]>(),
  ]);

  const byMember = new Map<string, ContractSummary[]>();
  for (const c of contracts ?? []) {
    if (!c.team_member_id) continue;
    const list = byMember.get(c.team_member_id) ?? [];
    list.push(c);
    byMember.set(c.team_member_id, list);
  }

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "HR", href: "/hr/team" },
        { label: "Team" },
      ]}
      lead="Everyone in the company, what they are working on, and their contract status. Contract badges are a live join from HR › Contracts — gold is pending, green is complete."
    >
      {contractsError && (
        <p className="note" style={{ color: "var(--danger)" }}>
          Contract badges unavailable: {contractsError.message}. The member
          list below is still accurate.
        </p>
      )}

      <h2 className="sec">Add a team member</h2>
      <AddMemberForm />

      <h2 className="sec">Team</h2>
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load team members: {error.message}
        </p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Working on</th>
                <th>Email</th>
                <th>Contracts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--muted)" }}>
                    No team members yet — add the first one above.
                  </td>
                </tr>
              ) : (
                (members ?? []).map((m) => {
                  const list = byMember.get(m.id) ?? [];
                  return (
                    <tr key={m.id}>
                      <td>
                        <b>{m.name}</b>
                      </td>
                      <td>{m.role ?? "—"}</td>
                      <td>{m.working_on ?? "—"}</td>
                      <td>{m.email ?? "—"}</td>
                      <td>
                        {list.length === 0 ? (
                          "—"
                        ) : (
                          list.map((c, i) => (
                            <span
                              key={i}
                              className={`tag ${c.status === "complete" ? "t-hi" : "t-med"}`}
                              style={{ marginRight: 5 }}
                              title={`${c.type ?? "Contract"} — ${c.status}`}
                            >
                              {c.type ?? "Contract"}
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        <span className="badge b-live">{m.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </OsShell>
  );
}
