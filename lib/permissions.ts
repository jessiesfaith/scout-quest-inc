import { createClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";

export { ALL_KEY, PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from "@/lib/permission-keys";

// Server-side permission check mirroring the SQL helper — defense in depth;
// RLS remains the real gate. The owner (by flag or email fallback) passes.
export async function checkPerm(perm: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (user.email === OWNER_EMAIL) return true;

  const { data } = await supabase.rpc("has_perm", { perm });
  return data === true;
}
