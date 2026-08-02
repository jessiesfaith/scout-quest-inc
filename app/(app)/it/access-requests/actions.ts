"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { OWNER_EMAIL } from "@/lib/constants";

export type ActionState = { error: string | null };

// Deciding on a request never creates a login — the owner still invites the
// person in Supabase. This records the decision so the queue stays honest.
export async function decideRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const allowed =
    user.email === OWNER_EMAIL || (await checkPerm("HR: Team"));
  if (!allowed) return { error: "Only the owner or HR: Team can decide requests." };

  const id = String(formData.get("request_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return { error: "Missing request." };
  if (status !== "approved" && status !== "declined" && status !== "pending")
    return { error: "Status must be approved, declined, or pending." };

  // decided_at and decided_by are stamped by a database trigger.
  const { data, error } = await supabase
    .from("account_requests")
    .update({ status, note: note || null })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was saved — check your permission." };

  revalidatePath("/it/access-requests");
  return { error: null };
}
