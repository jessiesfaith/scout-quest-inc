import type { SupabaseClient, User } from "@supabase/supabase-js";
import { OWNER_EMAIL } from "@/lib/constants";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_owner: boolean;
  role_id: string | null;
};

// The DB trigger creates the profile on signup; this is the app-side fallback
// so a session that predates the trigger still gets a row on first load.
// is_owner is enforced by RLS + the trigger — a non-owner cannot self-escalate.
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<Profile | null> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_owner, role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing;
  // A failed read (e.g. schema behind code) is not a missing row — don't
  // fire a doomed insert on top of it.
  if (selectError) return null;

  const { data: created } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      is_owner: user.email === OWNER_EMAIL,
    })
    .select("id, email, full_name, is_owner, role_id")
    .maybeSingle();

  return created;
}
