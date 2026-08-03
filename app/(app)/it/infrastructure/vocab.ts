// Shared by the server action and the form. Its own module because a
// "use server" file may only export async functions, and the form needs
// these lists to build its selects. The same strings are enforced as CHECK
// constraints in migration 0014 — keep the three in step.

export const KINDS = [
  "service",
  "database",
  "hosting",
  "storage",
  "model",
  "integration",
] as const;

export const STATUSES = ["live", "building", "planned", "retired"] as const;

// Free text in the database (a new environment shouldn't need a migration),
// but the form offers the ones already in use.
export const ENVIRONMENTS = ["production", "staging", "local"] as const;
