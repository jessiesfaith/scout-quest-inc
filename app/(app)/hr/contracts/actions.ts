"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

const HR_CONTRACTS = "HR: HR Contracts";
const PAGE = "/hr/contracts";

export type ActionState = {
  error: string | null;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function guard() {
  const ok = await checkPerm(HR_CONTRACTS);
  return ok ? null : "HR Contracts permission required.";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Object key: <team_member_id>/<timestamp>-<sanitized name>. Keeps one
// member's files together and never trusts client input: the id must be a
// real uuid (a value like "../other-bucket" would otherwise escape the
// prefix when the storage URL is normalized), and the filename is stripped
// to a safe character set.
function objectPath(teamMemberId: string, filename: string) {
  const clean = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(-80);
  return `${teamMemberId}/${Date.now()}-${clean}`;
}

export async function addContract(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const teamMemberId = String(formData.get("team_member_id") ?? "");
  const type = String(formData.get("type") ?? "").trim();
  const status = String(formData.get("status") ?? "pending").trim();
  const file = formData.get("file");

  if (!teamMemberId || !UUID_RE.test(teamMemberId))
    return { error: "Pick a team member." };
  if (!type) return { error: "Contract type is required." };
  if (status !== "pending" && status !== "complete")
    return { error: "Status must be pending or complete." };

  const supabase = await createClient();
  let filePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES)
      return { error: "File is larger than 10 MB." };
    // Require a known type — an empty content type must not slip past the
    // allowlist (the bucket rejects it at the storage layer anyway).
    if (!ALLOWED_TYPES.has(file.type))
      return { error: "Use a PDF, Word document, or image." };

    filePath = objectPath(teamMemberId, file.name || "contract");
    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      return {
        error: `Upload failed: ${uploadError.message}. Is the private "contracts" bucket created and migration 0006 run?`,
      };
    }
  }

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      team_member_id: teamMemberId,
      type,
      status,
      file_path: filePath,
    })
    .select("id");

  if (error || !data || data.length === 0) {
    // Don't leave an orphaned file behind if the row didn't land.
    if (filePath) await supabase.storage.from("contracts").remove([filePath]);
    return { error: error?.message ?? "Could not save the contract." };
  }

  revalidatePath(PAGE);
  revalidatePath("/hr/team");
  return { error: null };
}

export async function setContractStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const id = String(formData.get("contract_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Missing contract." };
  if (status !== "pending" && status !== "complete")
    return { error: "Status must be pending or complete." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was saved — the contract may be out of reach." };

  revalidatePath(PAGE);
  revalidatePath("/hr/team");
  return { error: null };
}

export async function deleteContract(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const id = String(formData.get("contract_id") ?? "");
  if (!id) return { error: "Missing contract." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("contracts")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0)
    return { error: "Nothing was deleted — the contract may be out of reach." };

  if (existing?.file_path) {
    await supabase.storage.from("contracts").remove([existing.file_path]);
  }

  revalidatePath(PAGE);
  revalidatePath("/hr/team");
  return { error: null };
}
