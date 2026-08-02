"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

export type ActionState = { error: string | null };

const STATUSES = new Set(["planned", "building", "live"]);

export async function addProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Projects")))
    return { error: "Projects permission required." };

  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const status = String(formData.get("status") ?? "planned");
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  if (!name) return { error: "Give the project a name." };
  if (!STATUSES.has(status))
    return { error: "Status must be planned, building, or live." };
  if (start && end && end < start)
    return { error: "The end date is before the start date." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("projects")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("projects").insert({
    name,
    summary: summary || null,
    status,
    start_date: start || null,
    end_date: end || null,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath("/projects");
  return { error: null };
}

export async function deleteProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Projects")))
    return { error: "Projects permission required." };

  const id = String(formData.get("project_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was deleted — check your permission." };

  revalidatePath("/projects");
  return { error: null };
}
