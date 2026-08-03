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
  // 'company' or a product key. The scope decides which permission applies —
  // matching the RLS policy in migration 0012, so the two can't drift.
  const scope = String(formData.get("scope") ?? "company").trim() || "company";
  const key =
    scope === "company" ? "HR: Mission & Values" : "Products: Mission & Values";

  if (!(await checkPerm(key))) {
    return { error: `${key} permission required.`, saved: false };
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

  // The scope arrives in a hidden field, so it is caller-controlled. Without
  // this check a product editor could upsert rows under invented scopes that
  // no screen ever shows and nobody would think to clean up.
  if (scope !== "company") {
    const { data: product } = await supabase
      .from("products")
      .select("key")
      .eq("key", scope)
      .maybeSingle();
    if (!product) return { error: "Unknown product.", saved: false };
  }

  // Upsert, because a product may not have a row yet — the company row is
  // seeded by 0006 but a newly added product has nothing to update.
  const { data, error } = await supabase
    .from("mission_values")
    .upsert(
      {
        scope,
        purpose: purpose || null,
        mission: mission || null,
        values,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope" },
    )
    .select("id");

  if (error) return { error: error.message, saved: false };
  if (!data || data.length === 0)
    return {
      error:
        "Nothing was saved — the row is out of reach. Has migration 0006 been run?",
      saved: false,
    };

  revalidatePath("/hr/mission-values");
  if (scope !== "company") revalidatePath(`/products/${scope}`);
  return { error: null, saved: true };
}
