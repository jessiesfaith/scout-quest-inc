"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";
import {
  ALL_STATUSES,
  COMPUTED_STATUSES,
  DIRECTIONS,
  METHODS,
  parseAmount,
} from "./vocab";

const PAGE = "/finance";

export type FinanceState = { error: string | null; success: boolean };

// The key follows the direction, matching the split in migration 0017:
// chasing what customers owe and authorising what the company pays are
// different jobs, and one person holding both is a decision somebody
// should make deliberately rather than inherit from a schema.
function keyFor(direction: string) {
  return direction === "payable" ? "Finance: AP" : "Finance: AR";
}

async function guard(direction: string) {
  const key = keyFor(direction);
  return (await checkPerm(key)) ? null : `Not saved — ${key} permission required.`;
}

type InvoiceValues = {
  direction: string;
  reference: string | null;
  counterparty: string;
  product_id: string | null;
  description: string | null;
  amount: number;
  due_on: string | null;
  issued_on: string;
  status: string;
  notes: string | null;
};

function readInvoice(
  formData: FormData,
): { error: string } | { values: InvoiceValues } {
  const direction = String(formData.get("direction") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const status = String(formData.get("status") ?? "draft").trim();
  const issuedOn = String(formData.get("issued_on") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!(DIRECTIONS as readonly string[]).includes(direction))
    return { error: "Pick receivable or payable." };
  if (!counterparty) return { error: "Who is this invoice with?" };
  // Computed statuses are accepted here and dropped by updateInvoice: the
  // edit form shows the row's real status, so a no-op save resubmits it.
  if (!(ALL_STATUSES as readonly string[]).includes(status))
    return { error: "That is not a status this register uses." };

  // Validated on the string, not on the parsed float — the column is
  // numeric(14,2) and anything finer would be truncated at insert time.
  const amount = parseAmount(amountRaw);
  if (amount === null)
    return {
      error:
        "Enter an amount greater than zero, to the cent — for example 1200 or 1200.50.",
    };
  if (amount > 99_999_999)
    return { error: "That amount is larger than this register handles." };

  const issued = issuedOn || new Date().toISOString().slice(0, 10);
  if (dueOn && dueOn < issued)
    return { error: "The due date is before the issue date." };

  return {
    values: {
      direction,
      reference: reference || null,
      counterparty,
      product_id: productId || null,
      description: description || null,
      amount,
      issued_on: issued,
      due_on: dueOn || null,
      status,
      notes: notes || null,
    },
  };
}

export async function createInvoice(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const parsed = readInvoice(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const denied = await guard(parsed.values.direction);
  if (denied) return { error: denied, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert(parsed.values)
    .select("id");

  if (error)
    return {
      error: `${error.message} — has migration 0017 been run?`,
      success: false,
    };
  if (!data || data.length === 0)
    return { error: "Not saved — permission refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function updateInvoice(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing invoice.", success: false };

  const parsed = readInvoice(formData);
  if ("error" in parsed) return { error: parsed.error, success: false };

  const denied = await guard(parsed.values.direction);
  if (denied) return { error: denied, success: false };

  const supabase = await createClient();

  const patch: Record<string, unknown> = { ...parsed.values };

  // part-paid and paid belong to the database. Dropping the key rather
  // than rejecting the save is what lets the edit form show the row's
  // real status: resubmitting it is a no-op, and the trigger recomputes
  // afterwards regardless. draft, sent and void still go through, so
  // voiding — and un-voiding — remain deliberate acts.
  if ((COMPUTED_STATUSES as readonly string[]).includes(parsed.values.status))
    delete patch.status;

  // Reducing an amount below what has already been paid would make the
  // balance negative, and the tiles sum balances — one negative row would
  // net money off the company's total. The database refuses it too
  // (0017's invoices_guard_amount); this is the readable version.
  const { data: balance } = await supabase
    .from("invoice_balances")
    .select("paid")
    .eq("id", id)
    .maybeSingle();

  if (balance && parsed.values.amount < Number(balance.paid))
    return {
      error: `${Number(balance.paid).toFixed(2)} has already been paid against this invoice. Remove a payment before reducing it below that.`,
      success: false,
    };

  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: "Not saved — permission refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function deleteInvoice(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id) return { error: "Missing invoice.", success: false };

  const denied = await guard(direction);
  if (denied) return { error: denied, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: "Not deleted — permission refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function recordPayment(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const paidOn = String(formData.get("paid_on") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!invoiceId) return { error: "Missing invoice.", success: false };

  const denied = await guard(direction);
  if (denied) return { error: denied, success: false };

  const amount = parseAmount(amountRaw);
  if (amount === null)
    return {
      error: "Enter a payment greater than zero, to the cent.",
      success: false,
    };
  if (method && !(METHODS as readonly string[]).includes(method))
    return { error: "Unknown payment method.", success: false };

  const supabase = await createClient();

  // Overpayment is almost always a typo, and this register has no credit
  // note to net it off with — so it is refused rather than absorbed.
  const { data: invoice } = await supabase
    .from("invoice_balances")
    .select("balance, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoice?.status === "draft")
    return {
      error: "Mark the invoice as sent before recording a payment against it.",
      success: false,
    };
  if (invoice && Number(invoice.balance) < amount)
    return {
      error: `That is more than the ${Number(invoice.balance).toFixed(2)} still outstanding.`,
      success: false,
    };

  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount,
      method: method || null,
      reference: reference || null,
      paid_on: paidOn || new Date().toISOString().slice(0, 10),
    })
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: "Not saved — permission refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}

export async function deletePayment(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const id = String(formData.get("payment_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id) return { error: "Missing payment.", success: false };

  const denied = await guard(direction);
  if (denied) return { error: denied, success: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message, success: false };
  if (!data || data.length === 0)
    return { error: "Not deleted — permission refused.", success: false };

  revalidatePath(PAGE);
  return { error: null, success: true };
}
