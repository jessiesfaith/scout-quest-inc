"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

export type ActionState = { error: string | null };

const CLASSES = new Set(["1", "2", "3", "3+"]);

// The log is append-only by design: entries can be added but never edited
// or removed, so the record of what changed stays trustworthy.
export async function logChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const canWrite =
    (await checkPerm("Security Tooling: Change Log")) ||
    (await checkPerm("Security Tooling: Change Management"));
  if (!canWrite) return { error: "Change Log permission required." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Describe the change." };

  const changeClass = String(formData.get("change_class") ?? "").trim();
  if (changeClass && !CLASSES.has(changeClass))
    return { error: "Class must be 1, 2, 3, or 3+." };

  const changeType = String(formData.get("change_type") ?? "update").trim();
  if (changeType !== "new" && changeType !== "update")
    return { error: "Type must be new or update." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // created_at and created_by_email are stamped by a database trigger —
  // they are deliberately not settable from here.
  const { data, error } = await supabase
    .from("change_log")
    .insert({
      product: String(formData.get("product") ?? "company").trim() || "company",
      module: String(formData.get("module") ?? "").trim() || null,
      tab: String(formData.get("tab") ?? "").trim() || null,
      change_type: changeType,
      change_class: changeClass || null,
      description,
      created_by: user.id,
    })
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was recorded — you may lack permission." };

  revalidatePath("/security/change-log");
  revalidatePath("/security/change-management");
  return { error: null };
}
