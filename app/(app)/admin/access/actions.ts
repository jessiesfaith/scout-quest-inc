"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";

export type ActionState = {
  error: string | null;
};

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .maybeSingle();

  // Same email fallback as the layout gate — the owner is never locked out
  // of admin, even if the profiles read fails. RLS still backstops writes.
  const ok = profile?.is_owner === true || user.email === OWNER_EMAIL;
  return { supabase, ok };
}

export async function createRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required." };

  const { supabase, ok } = await requireOwner();
  if (!ok) return { error: "Only the owner can create roles." };

  const { error } = await supabase.from("roles").insert({ name });
  if (error) return { error: error.message };

  revalidatePath("/admin/access");
  return { error: null };
}

export async function assignRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profileId = String(formData.get("profile_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!profileId) return { error: "Missing profile." };

  const { supabase, ok } = await requireOwner();
  if (!ok) return { error: "Only the owner can assign roles." };

  const { error } = await supabase
    .from("profiles")
    .update({ role_id: roleId || null })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin/access");
  return { error: null };
}
