"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import { KINDS, STATUSES } from "./vocab";

// 0012 keyed infrastructure writes to this permission; keep them together.
const KEY = "IT: Agent Platform";
const PAGE = "/it/infrastructure";

export type InfraState = { error: string | null; success: boolean };

async function guard() {
  const ok = await checkPerm(KEY);
  return ok ? null : `Not saved — the ${KEY} permission covers this inventory.`;
}

type Values = {
  name: string;
  kind: string;
  environment: string;
  provider: string | null;
  data_classes: string | null;
  status: string;
  notes: string | null;
  sort: number;
};

function readForm(formData: FormData): { error: string } | { values: Values } {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const environment = String(formData.get("environment") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const dataClasses = String(formData.get("data_classes") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const sortRaw = String(formData.get("sort") ?? "").trim();

  if (!name) return { error: "A component needs a name." };
  if (!(KINDS as readonly string[]).includes(kind))
    return { error: `Kind must be one of: ${KINDS.join(", ")}.` };
  if (!(STATUSES as readonly string[]).includes(status))
    return { error: `Status must be one of: ${STATUSES.join(", ")}.` };
  if (!environment)
    return { error: "An environment is required (production, local, …)." };

  const sort = sortRaw === "" ? 0 : Number(sortRaw);
  if (!Number.isInteger(sort) || sort < 0 || sort > 9999)
    return { error: "Order must be a whole number between 0 and 9999." };

  return {
    values: {
      name,
      kind,
      environment,
      provider: provider || null,
      data_classes: dataClasses || null,
      status,
      notes: notes || null,
      sort,
    },
  };
}

export async function createInfrastructure(
  _prev: InfraState,
  formData: FormData,
): Promise<InfraState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("infrastructure")
    .insert(parsed.values)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function updateInfrastructure(
  _prev: InfraState,
  formData: FormData,
): Promise<InfraState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing component.", success: false };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("infrastructure")
    .update(parsed.values)
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: `Not saved — ${KEY} permission required.`, success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function deleteInfrastructure(
  _prev: InfraState,
  formData: FormData,
): Promise<InfraState> {
  const denied = await guard();
  if (denied) return { error: denied, success: false };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing component.", success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("infrastructure")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return {
      error: `Not deleted — ${KEY} permission required.`,
      success: false,
    };

  revalidatePath(PAGE);
  return { error: null, success: true };
}
