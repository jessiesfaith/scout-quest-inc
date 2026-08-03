"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

const KEY = "HR: Team";
const STATUSES = new Set(["active", "forming", "reserved"]);

export type DepartmentState = { error: string | null; success: boolean };

async function guard() {
  const ok = await checkPerm(KEY);
  return ok ? null : `Not saved — the ${KEY} permission covers departments.`;
}

type Values = {
  name: string;
  summary: string | null;
  manager: string | null;
  status: string;
  sort: number;
};

function readForm(formData: FormData): { error: string } | { values: Values } {
  const name = String(formData.get("name") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const manager = String(formData.get("manager") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const sortRaw = String(formData.get("sort") ?? "").trim();

  if (!name) return { error: "A department needs a name." };
  if (!STATUSES.has(status))
    return { error: "Status must be active, forming or reserved." };
  // An empty box means "leave it at the end", not "zero".
  const sort = sortRaw === "" ? 0 : Number(sortRaw);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999)
    return { error: "Order must be a whole number between 0 and 9999." };

  return {
    values: {
      name,
      summary: summary || null,
      manager: manager || null,
      status,
      sort,
    },
  };
}

// Postgres reports the unique index by name; the raw message is unhelpful.
function friendly(message: string) {
  if (message.includes("departments_name_key"))
    return "A department with that name already exists.";
  return message;
}

export async function createDepartment(
  _prev: DepartmentState,
  formData: FormData,
): Promise<DepartmentState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .insert(parsed.values)
    .select("id");

  if (error) return { error: friendly(error.message), success: false };
  // RLS refuses by returning no rows rather than by erroring.
  if (!data || data.length === 0)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  revalidatePath("/departments");
  revalidatePath("/hr/team");
  return { error: null, success: true };
}

export async function updateDepartment(
  _prev: DepartmentState,
  formData: FormData,
): Promise<DepartmentState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing department.", success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update(parsed.values)
    .eq("id", id)
    .select("id");

  if (error) return { error: friendly(error.message), success: false };
  if (!data || data.length === 0)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  revalidatePath("/departments");
  revalidatePath("/hr/team");
  return { error: null, success: true };
}

export async function deleteDepartment(
  _prev: DepartmentState,
  formData: FormData,
): Promise<DepartmentState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing department.", success: false };

  const supabase = await createClient();
  // The database refuses to delete an occupied department (migration 0014).
  // Checking here as well turns that exception into a sentence worth
  // reading, and catches the common case before a round trip.
  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id);

  if (count && count > 0)
    return {
      error: `${count} ${count === 1 ? "person is" : "people are"} still in this department. Move them on HR › Team first.`,
      success: false,
    };

  const { data, error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return {
      error: `Not deleted — ${KEY} permission required.`,
      success: false,
    };

  revalidatePath("/departments");
  revalidatePath("/hr/team");
  return { error: null, success: true };
}
