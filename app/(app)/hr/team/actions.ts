"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AddMemberState = {
  error: string | null;
  success: boolean;
};

export async function addTeamMember(
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const workingOn = String(formData.get("working_on") ?? "").trim();

  if (!name) {
    return { error: "Name is required.", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in.", success: false };
  }

  const { error } = await supabase.from("team_members").insert({
    name,
    role: role || null,
    email: email || null,
    working_on: workingOn || null,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/hr/team");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export type SetDepartmentState = { error: string | null };

export async function setDepartment(
  _prev: SetDepartmentState,
  formData: FormData,
): Promise<SetDepartmentState> {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim();
  if (!memberId) return { error: "Missing team member." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS decides whether this is allowed; a silent zero-row update is a
  // refusal, not a success, so ask for the id back and check.
  const { data, error } = await supabase
    .from("team_members")
    .update({ department_id: departmentId || null })
    .eq("id", memberId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Not saved — you do not have permission (HR: Team)." };

  revalidatePath("/hr/team");
  revalidatePath("/departments");
  return { error: null };
}
