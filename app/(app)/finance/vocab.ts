// Shared by the server actions and the forms. Its own module because a
// "use server" file may only export async functions. The same strings are
// CHECK constraints in migration 0017 — keep the two in step.

export const DIRECTIONS = ["receivable", "payable"] as const;
export type Direction = (typeof DIRECTIONS)[number];

// What a person may choose. `sent` belongs here — marking an invoice sent
// is a decision, and it is the gate that lets a payment be recorded.
export const SETTABLE_STATUSES = ["draft", "sent", "void"] as const;

// What the database works out for itself from the payment rows. These are
// accepted on a form submission (the edit panel shows the row's current
// status, so a no-op save resubmits one of these) but never written —
// updateInvoice drops the key and lets the trigger own it.
export const COMPUTED_STATUSES = ["part-paid", "paid"] as const;

export const ALL_STATUSES = [
  ...SETTABLE_STATUSES,
  ...COMPUTED_STATUSES,
] as const;

export const METHODS = ["transfer", "card", "cheque", "other"] as const;

// A cent amount, after $ , and whitespace are stripped. Validated on the
// STRING rather than on the parsed number: `Math.round(n * 100) !== n * 100`
// looks like a cent check but compares against a binary float product, and
// rejects about one in eight legitimate two-decimal amounts — 1200.10 and
// 1000.07 among them.
export const CENTS_RE = /^\d{1,11}(\.\d{1,2})?$/;

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!CENTS_RE.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const STATUS_TAG: Record<string, string> = {
  draft: "t-lo",
  sent: "t-med",
  "part-paid": "t-med",
  paid: "t-hi",
  void: "t-lo",
};

export function money(amount: number | string | null, currency = "USD") {
  if (amount == null) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}
