import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { OsShell } from "../shell";

export const dynamic = "force-dynamic";

type Department = {
  id: string;
  name: string;
  summary: string | null;
  manager: string | null;
  status: string;
};
type Member = {
  id: string;
  name: string;
  role: string | null;
  department_id: string | null;
};

const BADGE: Record<string, string> = {
  active: "b-live",
  forming: "b-ready",
  reserved: "b-plan",
};

export default async function DepartmentsPage() {
  const { supabase, email, isOwner } = await getViewer();

  const [{ data: departments, error }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, name, summary, manager, status")
        .order("sort")
        .order("id")
        .returns<Department[]>(),
      supabase
        .from("team_members")
        .select("id, name, role, department_id")
        .order("name")
        .returns<Member[]>(),
    ]);

  const list = departments ?? [];
  const byDept = new Map<string, Member[]>();
  for (const m of members ?? []) {
    if (!m.department_id) continue;
    const arr = byDept.get(m.department_id) ?? [];
    arr.push(m);
    byDept.set(m.department_id, arr);
  }
  const unassigned = (members ?? []).filter((m) => !m.department_id);

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Departments" }]}
      lead="Each department has a manager overseeing people and agents that consume shared enterprise services, with evaluation and reporting flowing upward. Departments expand into their own modules as they grow."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load departments: {error.message}. Has migration 0012 been
          run?
        </p>
      ) : (
        <>
          {membersError && (
            <p className="note" style={{ color: "var(--danger)" }}>
              People could not be loaded: {membersError.message}. Head counts
              below are not reliable.
            </p>
          )}

          <div className="modgrid">
            {list.map((d) => {
              const people = byDept.get(d.id) ?? [];
              return (
                <div className="modcard" key={d.id}>
                  <h3>
                    {d.name}{" "}
                    <span className={`badge ${BADGE[d.status] ?? "b-reg"}`}>
                      {d.status}
                    </span>
                  </h3>
                  <p>{d.summary ?? "—"}</p>
                  <div className="parts">
                    <span>
                      {people.length} {people.length === 1 ? "person" : "people"}
                    </span>
                    {d.manager && <span>Manager: {d.manager}</span>}
                  </div>
                  {people.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12.5 }}>
                      {people.map((p) => (
                        <div key={p.id} style={{ color: "var(--muted)" }}>
                          {p.name}
                          {p.role ? ` — ${p.role}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {list.length === 0 && (
            <p className="note">
              No departments recorded — run migration 0012 to seed the ones
              named in the Constitution.
            </p>
          )}

          <h2 className="sec">Not yet in a department</h2>
          {unassigned.length === 0 ? (
            <p className="note">Everyone on the team is assigned.</p>
          ) : (
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td style={{ color: "var(--muted)" }}>{m.role ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">
            Department membership is set on a person&apos;s record under{" "}
            <Link href="/hr/team" className="crumb">
              HR › Team
            </Link>
            . The organisational model is defined in §7 of the{" "}
            <Link href="/hr/constitution" className="crumb">
              Constitution
            </Link>
            .
          </p>
        </>
      )}
    </OsShell>
  );
}
