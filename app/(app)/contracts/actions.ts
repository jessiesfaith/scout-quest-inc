"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import {
  ALLOWED_TYPES,
  COMPANY_CATEGORIES,
  MAX_FILE_BYTES,
  STATUSES,
} from "./vocab";

const PAGE = "/contracts";

export type ContractState = { error: string | null; success: boolean };

// Either key may maintain company agreements: 'Contracts' is the key that
// exists for exactly this, and HR already holds unrestricted write on the
// table. RLS decides the real boundary — this only avoids a round trip.
async function guard() {
  const ok =
    (await checkPerm("Contracts")) || (await checkPerm("HR: HR Contracts"));
  return ok
    ? null
    : "Not saved — the Contracts permission covers company agreements.";
}

// Company files live under the literal `company/` prefix. Migration 0014
// grants 'Contracts' holders write access to that prefix and nothing else,
// so employment files (stored under a team member's uuid) stay out of
// reach. The filename is stripped rather than trusted: a name containing
// `../` would otherwise walk out of the prefix when the key is normalized.
function objectPath(filename: string) {
  const clean = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(-80);
  return `company/${Date.now()}-${clean || "agreement"}`;
}

type Parsed = {
  counterparty: string;
  category: string;
  type: string | null;
  status: string;
  effective_on: string | null;
  expires_on: string | null;
  obligations: string | null;
  team_member_id: null;
};

function readForm(formData: FormData): { error: string } | { values: Parsed } {
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const status = String(formData.get("status") ?? "pending").trim();
  const effectiveOn = String(formData.get("effective_on") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();
  const obligations = String(formData.get("obligations") ?? "").trim();

  if (!counterparty)
    return { error: "Who is the agreement with? A counterparty is required." };
  if (!(COMPANY_CATEGORIES as readonly string[]).includes(category))
    return {
      error:
        "Pick a category. Employment contracts are kept on HR › Contracts, not here.",
    };
  if (!(STATUSES as readonly string[]).includes(status))
    return { error: "Status must be pending or complete." };
  if (effectiveOn && expiresOn && expiresOn < effectiveOn)
    return { error: "The end date is before the start date." };

  return {
    values: {
      counterparty,
      category,
      type: type || null,
      status,
      effective_on: effectiveOn || null,
      expires_on: expiresOn || null,
      obligations: obligations || null,
      // The invariant migration 0014 enforces: a company agreement has a
      // counterparty, never a person. Set explicitly so an update can
      // never leave a stale team member attached.
      team_member_id: null,
    },
  };
}

async function uploadIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: FormDataEntryValue | null,
): Promise<{ error: string } | { path: string | null }> {
  if (!(file instanceof File) || file.size === 0) return { path: null };
  if (file.size > MAX_FILE_BYTES) return { error: "File is larger than 10 MB." };
  if (!ALLOWED_TYPES.has(file.type))
    return { error: "Use a PDF, Word document, or image." };

  const path = objectPath(file.name || "agreement");
  const { error } = await supabase.storage
    .from("contracts")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error)
    return {
      error: `Upload failed: ${error.message}. Has migration 0014 been run?`,
    };
  return { path };
}

export async function createCompanyContract(
  _prev: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();
  const uploaded = await uploadIfPresent(supabase, formData.get("file"));
  if ("error" in uploaded) return { error: uploaded.error, success: false };

  const { data, error } = await supabase
    .from("contracts")
    .insert({ ...parsed.values, file_path: uploaded.path })
    .select("id");

  if (error || !data || data.length === 0) {
    // Never leave an orphaned object behind when the row didn't land.
    if (uploaded.path)
      await supabase.storage.from("contracts").remove([uploaded.path]);
    return {
      error:
        error?.message ??
        "Not saved — the Contracts permission covers company agreements.",
      success: false,
    };
  }

  revalidatePath(PAGE);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function updateCompanyContract(
  _prev: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing agreement.", success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();

  // Read the current file first: replacing one means the old object has to
  // go, and it can only be removed after the row stops pointing at it.
  const { data: existing } = await supabase
    .from("contracts")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const uploaded = await uploadIfPresent(supabase, formData.get("file"));
  if ("error" in uploaded) return { error: uploaded.error, success: false };

  const patch: Record<string, unknown> = { ...parsed.values };
  if (uploaded.path) patch.file_path = uploaded.path;

  const { data, error } = await supabase
    .from("contracts")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error || !data || data.length === 0) {
    if (uploaded.path)
      await supabase.storage.from("contracts").remove([uploaded.path]);
    return {
      error:
        error?.message ??
        "Not saved — you may not have permission for this agreement.",
      success: false,
    };
  }

  if (uploaded.path && existing?.file_path) {
    await supabase.storage.from("contracts").remove([existing.file_path]);
  }

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function deleteCompanyContract(
  _prev: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing agreement.", success: false };

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

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return {
      error: "Not deleted — the agreement may be out of reach.",
      success: false,
    };

  if (existing?.file_path) {
    await supabase.storage.from("contracts").remove([existing.file_path]);
  }

  revalidatePath(PAGE);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
