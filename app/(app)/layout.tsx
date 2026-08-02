import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { OWNER_EMAIL } from "@/lib/constants";

export const metadata = {
  title: "Scout Quest Inc — Company OS",
};

// Gate only. The visual shell lives in shell.tsx and is rendered per
// screen, because the design gives every screen its own breadcrumb trail.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const profile = await ensureProfile(supabase, user);
  // Email fallback keeps the owner in even if the profiles read fails
  // (e.g. a deploy that outruns its migration) — lockout-proof by design.
  const isOwner = (profile?.is_owner ?? false) || user.email === OWNER_EMAIL;

  // The owner always gets in with password only.
  // Everyone else: mandatory TOTP 2FA, then a role assigned by an admin.
  if (!isOwner) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel !== "aal2") {
      redirect("/mfa");
    }
    // Access comes from either the legacy single role or a role
    // assignment made in Identity & Access — same rule the database uses.
    let hasRole = Boolean(profile?.role_id);
    if (!hasRole) {
      const { data: assigned } = await supabase
        .from("team_members")
        .select("id, role_assignments(id)")
        .eq("profile_id", user.id)
        .limit(1);
      hasRole = (assigned ?? []).some(
        (m: { role_assignments?: unknown[] }) =>
          (m.role_assignments ?? []).length > 0,
      );
    }
    if (!hasRole) redirect("/pending");
  }

  return <>{children}</>;
}
