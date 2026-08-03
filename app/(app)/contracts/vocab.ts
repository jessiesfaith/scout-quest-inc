// Company agreements only. 'employment' is deliberately absent: those are a
// person's record and live behind HR › Contracts, and migration 0014's RLS
// refuses to let a 'Contracts' holder create or touch one. Offering the
// option here would produce a form that fails at the database.
export const COMPANY_CATEGORIES = [
  "vendor",
  "district",
  "dpa-baa",
  "partner",
  "other",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  employment: "Employment",
  vendor: "Vendor",
  district: "District",
  "dpa-baa": "DPA / BAA",
  partner: "Partner",
  other: "Other",
};

export const STATUSES = ["pending", "complete"] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
