"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

export type ActionState = {
  error: string | null;
  saved: boolean;
};

export type ValueItem = { title: string; body: string };

export async function saveMissionValues(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("HR: Mission & Values"))) {
    return { error: "Mission & Values permission required.", saved: false };
  }

  const purpose = String(formData.get("purpose") ?? "").trim();
  const mission = String(formData.get("mission") ?? "").trim();

  // Values arrive as parallel title/body fields; blank pairs are dropped.
  const titles = formData.getAll("value_title").map(String);
  const bodies = formData.getAll("value_body").map(String);
  const values: ValueItem[] = titles
    .map((title, i) => ({
      title: title.trim(),
      body: (bodies[i] ?? "").trim(),
    }))
    .filter((v) => v.title || v.body);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mission_values")
    .update({
      purpose: purpose || null,
      mission: mission || null,
      values,
      updated_at: new Date().toISOString(),
    })
    .eq("scope", "company")
    .select("id");

  if (error) return { error: error.message, saved: false };
  if (!data || data.length === 0)
    return {
      error:
        "Nothing was saved — the company row is missing or out of reach. Has migration 0006 been run?",
      saved: false,
    };

  revalidatePath("/hr/mission-values");
  return { error: null, saved: true };
}
