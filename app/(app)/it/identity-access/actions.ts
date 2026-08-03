"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPerm, ALL_PERMISSION_KEYS, ALL_KEY } from "@/lib/permissions";

const IA_PERM = "IT: Identity & Access";
const PAGE = "/it/identity-access";

export type ActionState = {
  error: string | null;
};

// App-layer guard for friendly errors — RLS is the real gate underneath.
async function guard() {
  const ok = await checkPerm(IA_PERM);
  return ok ? null : "Identity & Access permission required.";
}

function parsePermissions(formData: FormData): string[] | { error: string } {
  if (formData.get("grant_all") === "on") return [ALL_KEY];
  const picked = formData
    .getAll("perm")
    .map(String)
    .filter((k) => ALL_PERMISSION_KEYS.includes(k));
  if (picked.length === 0)
    return { error: "Check at least one permission (or Grant all)." };
  return picked;
}

export async function createRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required." };

  const permissions = parsePermissions(formData);
  if (!Array.isArray(permissions)) return { error: permissions.error };

  const supabase = await createClient();
  const { error } = await supabase.from("roles").insert({ name, permissions });
  if (error) return { error: error.message };

  revalidatePath(PAGE);
  return { error: null };
}

export async function updateRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const roleId = String(formData.get("role_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!roleId || !name) return { error: "Role and name are required." };

  const permissions = parsePermissions(formData);
  if (!Array.isArray(permissions)) return { error: permissions.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .update({ name, permissions })
    .eq("id", roleId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was saved — the role may be out of reach." };

  revalidatePath(PAGE);
  return { error: null };
}

export async function deleteRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const roleId = String(formData.get("role_id") ?? "");
  if (!roleId) return { error: "Missing role." };

  const supabase = await createClient();
  // Assignments cascade with the role (FK on delete cascade).
  const { data, error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was deleted — the role may be out of reach." };

  revalidatePath(PAGE);
  return { error: null };
}

export async function assignRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const teamMemberId = String(formData.get("team_member_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!teamMemberId || !roleId)
    return { error: "Pick a role to assign." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_assignments")
    .insert({ team_member_id: teamMemberId, role_id: roleId });
  if (error) {
    if (error.code === "23505")
      return { error: "That member already holds this role." };
    return { error: error.message };
  }

  revalidatePath(PAGE);
  return { error: null };
}

export async function unassignRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const assignmentId = String(formData.get("assignment_id") ?? "");
  if (!assignmentId) return { error: "Missing assignment." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_assignments")
    .delete()
    .eq("id", assignmentId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was removed — the assignment may be out of reach." };

  revalidatePath(PAGE);
  return { error: null };
}

export async function linkAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const teamMemberId = String(formData.get("team_member_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  if (!teamMemberId) return { error: "Missing team member." };

  const supabase = await createClient();
  // The DB guard trigger re-checks this privilege server-side. The
  // .select() makes an RLS-filtered zero-row update a visible error
  // instead of a silent fake success.
  const { data, error } = await supabase
    .from("team_members")
    .update({ profile_id: profileId || null })
    .eq("id", teamMemberId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return {
      error:
        "No change was saved — you may lack permission to edit team members (migration 0004 grants it to Identity & Access holders).",
    };

  revalidatePath(PAGE);
  return { error: null };
}

// ---------------------------------------------------------------------
// Two-factor reset
// ---------------------------------------------------------------------

// The last resort when someone has lost their authenticator AND run out of
// recovery codes. It replaces the old procedure — deleting the auth user
// and asking them to sign up again — which also destroyed their profile,
// their role assignments and the link to their team member record.
//
// This does NOT sign anyone in and does NOT grant a session. It removes
// the enrolled factor, so the next time that person signs in with their
// password they are walked through enrolling a new authenticator. Without
// the password it is worth nothing.
//
// It is still the most dangerous button on this screen: whoever holds
// Identity & Access can strip a colleague's second factor. So every use is
// written to `mfa_resets` before the factor is touched, by a trigger that
// stamps the actor from auth.uid() rather than from anything the caller
// sends.
export async function resetTwoFactor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const profileId = String(formData.get("profile_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!profileId) return { error: "This member has no linked account." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) return { error: "Not signed in." };

  // Record the intent first. If the audit write fails, nothing happens —
  // an untraceable reset is worse than a reset that did not occur.
  //
  // Written as the caller, not with the service key, and deliberately: the
  // stamp_mfa_reset trigger takes the actor from auth.uid(), which is null
  // under the service key. Writing as the signed-in person is what makes
  // the actor field something they cannot choose. RLS admits it through
  // mfa_resets_insert_admin (migration 0016).
  const { data: logged, error: logError } = await supabase
    .from("mfa_resets")
    .insert({ target_user: profileId, reason: reason || null })
    .select("id");

  if (logError)
    return {
      error: `Not reset — the audit entry failed (${logError.message}). Has migration 0016 been run?`,
    };
  // A refusal by RLS is zero rows, not an error.
  if (!logged || logged.length === 0)
    return {
      error: `Not reset — the audit entry was refused. ${IA_PERM} permission required.`,
    };

  const admin = createAdminClient();
  const { data: target, error: lookupError } =
    await admin.auth.admin.getUserById(profileId);
  if (lookupError) return { error: lookupError.message };

  // TOTP only — see the same reasoning in app/mfa/actions.ts. Removing a
  // factor type this flow was not asked about is not a favour.
  const totp = (target.user?.factors ?? []).filter(
    (f) => f.factor_type === "totp",
  );
  if (totp.length === 0)
    return { error: "That account has no authenticator enrolled." };

  const failures: string[] = [];
  for (const factor of totp) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: profileId,
    });
    if (deleteError) failures.push(deleteError.message);
  }

  revalidatePath(PAGE);
  if (failures.length > 0)
    return {
      error: `Audit entry recorded, but the reset failed: ${failures.join("; ")}`,
    };

  return { error: null };
}
