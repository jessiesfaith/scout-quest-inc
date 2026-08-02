import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { RolesPanel, type Role } from "./role-builder";
import { TeamPanel, type Member, type ProfileOption } from "./team-panel";

export const dynamic = "force-dynamic";

type AssignmentRow = { id: string; team_member_id: string; role_id: string };

export default async function IdentityAccessPage() {
  const { supabase, email, isOwner } = await getViewer();
  if (!(await checkPerm("IT: Identity & Access"))) redirect("/dashboard");

  const [
    { data: roles, error: rolesError },
    { data: members, error: membersError },
    { data: assignments, error: assignmentsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, permissions")
      .order("name")
      .returns<Role[]>(),
    supabase
      .from("team_members")
      .select("id, name, working_on, profile_id")
      .order("created_at", { ascending: true })
      .returns<Omit<Member, "assignments">[]>(),
    supabase
      .from("role_assignments")
      .select("id, team_member_id, role_id")
      .returns<AssignmentRow[]>(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("email")
      .returns<ProfileOption[]>(),
  ]);

  const byMember = new Map<string, { id: string; role_id: string }[]>();
  for (const a of assignments ?? []) {
    const list = byMember.get(a.team_member_id) ?? [];
    list.push({ id: a.id, role_id: a.role_id });
    byMember.set(a.team_member_id, list);
  }

  const memberRows: Member[] = (members ?? []).map((m) => ({
    ...m,
    assignments: byMember.get(m.id) ?? [],
  }));

  // Any failed query must surface — a partial view of the access system
  // reads as false security state on the screen used to audit it.
  const loadError =
    rolesError ?? membersError ?? assignmentsError ?? profilesError;

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: "/it/identity-access" },
        { label: "Identity & Access" },
      ]}
      lead="Create roles as sets of permissions (checkboxes over modules and tabs), then assign roles to team members. A member can hold more than one role. Roles only take effect once the member's login account is linked."
    >
      {loadError ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load: {loadError.message}. Has migration 0003 been run?
        </p>
      ) : (
        <>
          <h2 className="sec">Roles</h2>
          <RolesPanel roles={roles ?? []} />

          <h2 className="sec">Assign roles &amp; link accounts</h2>
          <TeamPanel
            members={memberRows}
            roles={roles ?? []}
            profiles={profiles ?? []}
          />
        </>
      )}
    </OsShell>
  );
}
