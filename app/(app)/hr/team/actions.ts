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
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/hr/team");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
