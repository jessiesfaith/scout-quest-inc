// The canonical permission keys — the contract between the role builder UI
// and the RLS policies in supabase/migrations/0003_full_schema_permissions.sql.
// These strings must stay byte-identical on both sides.
// Pure constants only: this file is imported by client components.

export const ALL_KEY = "ALL";

export const PERMISSION_GROUPS: { module: string; keys: string[] }[] = [
  {
    module: "IT",
    keys: ["IT: Agent Platform", "IT: Identity & Access"],
  },
  {
    module: "Security Tooling",
    keys: ["Security Tooling: Change Management", "Security Tooling: Change Log"],
  },
  {
    module: "HR",
    keys: ["HR: Team", "HR: HR Contracts", "HR: Mission & Values", "HR: Constitution"],
  },
  {
    module: "Products",
    keys: [
      "Products: Manage",
      "Products: Plan Board",
      "Products: Build Board",
      "Products: Agents",
      "Products: Website",
      "Products: Change Log",
      "Products: Mission & Values",
    ],
  },
  {
    module: "Finance",
    keys: ["Finance: AR", "Finance: AP"],
  },
  {
    module: "Company",
    keys: ["Contracts", "Projects"],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.keys);
