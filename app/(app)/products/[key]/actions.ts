"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

export type ActionState = { error: string | null };

const STATUSES = new Set(["planned", "building", "live"]);

async function productId(key: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  return { supabase, id: data?.id as string | undefined };
}

function done(key: string) {
  revalidatePath(`/products/${key}`);
  revalidatePath("/products");
  return { error: null };
}

// ---------- Build Board ----------

export async function addArea(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Build Board")))
    return { error: "Products: Build Board permission required." };

  const key = String(formData.get("product_key") ?? "");
  const area = String(formData.get("area") ?? "").trim();
  const status = String(formData.get("status") ?? "planned");
  const note = String(formData.get("note") ?? "").trim();
  if (!area) return { error: "Describe the area." };
  if (!STATUSES.has(status))
    return { error: "Status must be planned, building, or live." };

  const { supabase, id } = await productId(key);
  if (!id) return { error: "Unknown product." };

  // Append after existing rows: `sort` defaults to 0, so without this a new
  // row would jump above every seeded one.
  const { data: last } = await supabase
    .from("product_areas")
    .select("sort")
    .eq("product_id", id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("product_areas").insert({
    product_id: id,
    area,
    status,
    note: note || null,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) return { error: error.message };
  return done(key);
}

export async function setAreaStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Build Board")))
    return { error: "Products: Build Board permission required." };

  const id = String(formData.get("area_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const key = String(formData.get("product_key") ?? "");
  if (!id || !STATUSES.has(status)) return { error: "Bad request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_areas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was saved — check your permission." };
  return done(key);
}

export async function deleteArea(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Build Board")))
    return { error: "Products: Build Board permission required." };

  const id = String(formData.get("area_id") ?? "");
  const key = String(formData.get("product_key") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_areas")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was deleted — check your permission." };
  return done(key);
}

// ---------- Plan Board ----------

export async function addPlanItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Plan Board")))
    return { error: "Products: Plan Board permission required." };

  const key = String(formData.get("product_key") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "planned");
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  if (!title) return { error: "Give the item a title." };
  if (!STATUSES.has(status))
    return { error: "Status must be planned, building, or live." };
  if (start && end && end < start)
    return { error: "The end date is before the start date." };

  const { supabase, id } = await productId(key);
  if (!id) return { error: "Unknown product." };

  const { data: last } = await supabase
    .from("plan_items")
    .select("sort")
    .eq("product_id", id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("plan_items").insert({
    product_id: id,
    title,
    status,
    start_date: start || null,
    end_date: end || null,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) return { error: error.message };
  return done(key);
}

export async function deletePlanItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Plan Board")))
    return { error: "Products: Plan Board permission required." };

  const id = String(formData.get("item_id") ?? "");
  const key = String(formData.get("product_key") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was deleted — check your permission." };
  return done(key);
}

// ---------- Website links ----------

export async function addWebsite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Website")))
    return { error: "Products: Website permission required." };

  const key = String(formData.get("product_key") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!label || !url) return { error: "Label and URL are both required." };

  // Only http(s): a javascript: or data: link here would be a trap for
  // whoever clicks it later.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That is not a valid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    return { error: "Only http and https links are allowed." };

  const { supabase, id } = await productId(key);
  if (!id) return { error: "Unknown product." };

  const { error } = await supabase
    .from("websites")
    .insert({ product_id: id, label, url: parsed.toString() });
  if (error) return { error: error.message };
  return done(key);
}

export async function deleteWebsite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Website")))
    return { error: "Products: Website permission required." };

  const id = String(formData.get("website_id") ?? "");
  const key = String(formData.get("product_key") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("websites")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length)
    return { error: "Nothing was deleted — check your permission." };
  return done(key);
}

// ---------- Product change log ----------

export async function logProductChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await checkPerm("Products: Change Log")))
    return { error: "Products: Change Log permission required." };

  const key = String(formData.get("product_key") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const changeType = String(formData.get("change_type") ?? "update");
  const tab = String(formData.get("tab") ?? "").trim();
  if (!description) return { error: "Describe the change." };
  if (changeType !== "new" && changeType !== "update")
    return { error: "Type must be new or update." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // created_at and the author are stamped by a database trigger.
  const { error } = await supabase.from("change_log").insert({
    product: key,
    module: "Products",
    tab: tab || null,
    change_type: changeType,
    description,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  return done(key);
}
