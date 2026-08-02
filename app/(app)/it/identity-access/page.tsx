import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { RolesPanel, type Role } from "./role-builder";
import { TeamPanel, type Member, type ProfileOption } from "./team-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "IT › Identity & Access — Scout Quest Inc",
};

type AssignmentRow = { id: string; team_member_id: string; role_id: string };

export default async function IdentityAccessPage() {
  if (!(await checkPerm("IT: Identity & Access"))) redirect("/dashboard");

  const supabase = await createClient();
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
    // Profiles list feeds the account-linking dropdown. RLS scopes this to
    // what the caller may see (the owner sees all).
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
  // reads as false security state on the very screen used to audit it.
  const loadError =
    rolesError ?? membersError ?? assignmentsError ?? profilesError;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">IT › Identity &amp; Access</h1>
      <p className="mt-1 text-sm text-muted">
        Roles are sets of &ldquo;Module: Tab&rdquo; permissions enforced by the
        database. Assign them to team members below — a member&apos;s roles
        only apply once their login account is linked.
      </p>

      {loadError ? (
        <p className="mt-8 text-sm text-danger">
          Could not load: {loadError.message}. Has migration 0003 been run?
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Roles
            </h2>
            <RolesPanel roles={roles ?? []} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Team — assign roles &amp; link accounts
            </h2>
            <TeamPanel
              members={memberRows}
              roles={roles ?? []}
              profiles={profiles ?? []}
            />
          </section>
        </div>
      )}
    </div>
  );
}
