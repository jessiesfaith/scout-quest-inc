import { createClient } from "@/lib/supabase/server";
import { OWNER_EMAIL } from "@/lib/constants";
import { ALL_KEY, ALL_PERMISSION_KEYS } from "@/lib/permission-keys";

// Which permission keys does the viewer hold? One round trip, so screens can
// decide what to show without asking has_perm() once per link. RLS is still
// the real gate — this only stops the interface offering doors that will
// slam shut.
export async function getPermissions(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  // The owner holds everything, including keys added later.
  if (user.email === OWNER_EMAIL) return new Set([ALL_KEY, ...ALL_PERMISSION_KEYS]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_owner) return new Set([ALL_KEY, ...ALL_PERMISSION_KEYS]);

  const { data: rows } = await supabase
    .from("team_members")
    .select("role_assignments(roles(permissions))")
    .eq("profile_id", user.id);

  const held = new Set<string>();
  type Row = {
    role_assignments?: { roles?: { permissions?: unknown } | null }[] | null;
  };
  for (const row of (rows ?? []) as Row[]) {
    for (const ra of row.role_assignments ?? []) {
      const perms = ra.roles?.permissions;
      if (!Array.isArray(perms)) continue;
      for (const p of perms) if (typeof p === "string") held.add(p);
    }
  }

  if (held.has(ALL_KEY)) return new Set([ALL_KEY, ...ALL_PERMISSION_KEYS]);
  return held;
}

export function can(held: Set<string>, ...keys: string[]) {
  if (held.has(ALL_KEY)) return true;
  return keys.some((k) => held.has(k));
}
