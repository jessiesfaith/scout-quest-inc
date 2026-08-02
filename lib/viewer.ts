import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { OWNER_EMAIL } from "@/lib/constants";

// Every OS screen needs the same three facts about who is looking.
// The (app) layout already enforces auth, 2FA, and role — this just
// supplies the identity for the shell.
export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const profile = await ensureProfile(supabase, user);
  const isOwner = (profile?.is_owner ?? false) || user.email === OWNER_EMAIL;

  return { supabase, user, email: user.email ?? "", isOwner };
}
