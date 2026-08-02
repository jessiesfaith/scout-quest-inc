"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
