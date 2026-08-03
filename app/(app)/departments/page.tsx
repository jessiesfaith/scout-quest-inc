import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../shell";
import { AddDepartmentForm, DepartmentCard, type Department } from "./editor";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  name: string;
  role: string | null;
  department_id: string | null;
};

export default async function DepartmentsPage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();
  const canEdit = can(held, "HR: Team");

  const [{ data: departments, error }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, name, summary, manager, status, sort")
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

          {canEdit && <AddDepartmentForm />}

          <div className="modgrid">
            {list.map((d) => (
              <DepartmentCard
                key={d.id}
                department={d}
                people={byDept.get(d.id) ?? []}
                canEdit={canEdit}
              />
            ))}
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
            .{" "}
            {canEdit
              ? "A department cannot be deleted while anyone is still assigned to it."
              : "Read-only here — the HR: Team permission covers changes."}
          </p>
        </>
      )}
    </OsShell>
  );
}
