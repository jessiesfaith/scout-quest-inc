import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";
import { CreateRoleForm, AssignRoleForm } from "./forms";

export const dynamic = "force-dynamic";

type Role = { id: string; name: string };
type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_owner: boolean;
  role_id: string | null;
  nda_version: string | null;
  nda_accepted_at: string | null;
  created_at: string;
};

export default async function AccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: me } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .maybeSingle();
  // Email fallback mirrors the layout gate — owner never loses admin.
  if (!me?.is_owner && user.email !== OWNER_EMAIL) redirect("/dashboard");

  const [{ data: roles, error: rolesError }, { data: people, error }] =
    await Promise.all([
    supabase.from("roles").select("id, name").order("name").returns<Role[]>(),
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, is_owner, role_id, nda_version, nda_accepted_at, created_at",
      )
      .order("created_at", { ascending: true })
      .returns<ProfileRow[]>(),
  ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Admin › Access &amp; roles</h1>
      <p className="mt-1 text-sm text-muted">
        Accounts can be created by anyone, but nobody gets in until you assign
        a role here. You are the owner and always have access.
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Roles</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rolesError ? (
              <span className="text-sm text-danger">
                Could not load roles: {rolesError.message}
              </span>
            ) : (
              <>
                {(roles ?? []).map((r) => (
                  <span
                    key={r.id}
                    className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                  >
                    {r.name}
                  </span>
                ))}
                {(roles ?? []).length === 0 && (
                  <span className="text-sm text-muted">No roles yet.</span>
                )}
              </>
            )}
          </div>
          <div className="mt-4">
            <CreateRoleForm />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {error ? (
            <p className="p-5 text-sm text-danger">
              Could not load accounts: {error.message}. Has migration 0002 been
              run in the Supabase SQL Editor?
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Person</th>
                  <th className="px-5 py-3 font-medium">NDA</th>
                  <th className="px-5 py-3 font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {(people ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium">
                        {p.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted">{p.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      {p.nda_accepted_at ? (
                        <span
                          className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                          title={new Date(p.nda_accepted_at).toLocaleString()}
                        >
                          {p.nda_version ?? "accepted"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.is_owner ? (
                        <span className="rounded bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">
                          OWNER — always has access
                        </span>
                      ) : (
                        <AssignRoleForm
                          profileId={p.id}
                          currentRoleId={p.role_id}
                          roles={roles ?? []}
                        />
                      )}
                      {!p.is_owner && p.role_id && (
                        <div className="mt-1 text-xs text-muted">
                          Current: {roleName.get(p.role_id) ?? "?"}
                        </div>
                      )}
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
