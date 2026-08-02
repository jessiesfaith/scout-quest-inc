# Claude Code Kickoff — Scout Quest Inc Company OS · Full Build (Stage 2 + Stage 3)

**Goal.** With Stage 1 (sign-in + Team persisting) underway, build **the rest of the company OS** on the same repo/stack: every module made real and data-driven on Supabase, roles/access enforced by RLS, and the seams for live agent data. Ship it in **reviewable slices** — this doc is the whole map so you can see where each slice fits.

**Governance.** Class 3 (auth + data + new surfaces). RLS on from day one for every table. Secrets server-side only. Invite-only. **No D3 (student/patient) data in this app, ever** — company/ops data only (D0–D2). ~$0 spend (free tiers, no cloud-model key). State tradeoffs before any large or destructive move and wait for Jessica's ruling.

**Reference docs (read first):**
- `SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md` — schema, auth, RLS design (source of truth for data model).
- `CLAUDE_CODE_KICKOFF_DEPLOY_STAGE1.md` — Stage 1 skeleton (profiles + team_members + auth). Build on it; don't re-scaffold.
- **Visual reference:** `SCOUT_QUEST_INC_COMPANY_OS.html` (in the repo root) — this is the **full company OS** design mockup, not just the Agent Platform. Despite any older filename, "Agent Platform" is only ONE sub-area inside the IT module; this file contains the entire module map below (IT, HR, all Products, Finance, Contracts, Projects, Departments). Match its layout, navigation model, and styling. Also `index.html` = the marketing/login page.

**Concrete project facts (unchanged from Stage 1):**
- Repo `scout-quest-inc` (private), Next.js (App Router) + `@supabase/supabase-js` + `@supabase/ssr`.
- Supabase URL `https://odovdbxhsrrfpdjobiwj.supabase.co`; publishable key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; **rotated** secret only in Vercel `SUPABASE_SECRET_KEY` (server-only, never `NEXT_PUBLIC_`, never committed).
- Owner (seeded `is_owner = true`): `jessicadougherty4321@gmail.com`.

---

## 0. Architecture recap

- **App:** Next.js App Router on Vercel. Server components/route handlers use the server Supabase client (cookies via `@supabase/ssr`); browser client uses the publishable key.
- **Data + Auth:** Supabase Postgres + Supabase Auth. Public sign-up **disabled** — invite/approval only.
- **Enforcement is two-layered:** RLS is the real gate (a Postgres `has_perm()` helper checks the signed-in user's assigned roles); the UI additionally hides what a role can't use. Never rely on UI hiding alone.
- **Owner bypass:** `is_owner = true` ⇒ full access.

### Module map (what we're building)
```
Modules (landing)
├── IT
│   ├── Agent Platform      → Console · Agent WOs (WO Results) · The Vision
│   ├── Identity & Access   → Roles (builder) · Team (assign roles)
│   └── Security Tooling    → Change Management · Change Log
├── HR                      → Team · HR Contracts · Mission & Values · Scout Quest AI Constitution
├── Products (per product: Education, Game, Tutor, Soundwiserx, AI Bookmark, Other)
│   └── each → Plan Board · Build Board · Agents · Website · Change Log · Mission & Values
├── Finance                 → AR · AP            (Stage 2 = schema + read; entry later)
├── Contracts               → company contracts   (shares `contracts` table)
├── Projects                → cross-product projects
└── Departments             → future modules
```

---

## 1. Database — full schema + RLS (single migration block)

Deliver this as **one SQL block** for Jessica to paste into Supabase → **SQL Editor** → Run. It is additive to Stage 1 (which already created `profiles` and `team_members`). Every `create table` uses `if not exists`; every table gets RLS enabled and policies. Use `security definer` + fixed `search_path` on the helper.

```sql
-- ============ helper: permission check ============
create or replace function public.has_perm(perm text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner)
    or exists (
      select 1
      from role_assignments ra
      join team_members tm on tm.id = ra.team_member_id
      join roles r on r.id = ra.role_id
      where tm.profile_id = auth.uid()
        and (r.permissions ? perm or r.permissions ? 'ALL')
    );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.is_owner);
$$;

-- ============ roles & access ============
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  permissions jsonb not null default '[]'::jsonb,   -- ["Module: Tab", ...] or ["ALL"]
  created_at timestamptz default now()
);
create table if not exists role_assignments (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references team_members(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(team_member_id, role_id)
);

-- ============ products ============
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  status text default 'active',
  created_at timestamptz default now()
);
create table if not exists product_areas (        -- Build Board rows
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  area text not null,
  status text default 'planned',                  -- planned | building | live
  note text,
  sort int default 0,
  updated_at timestamptz default now()
);
create table if not exists websites (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz default now()
);
create table if not exists plan_items (           -- Plan Board (Gantt) rows
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  status text default 'planned',
  sort int default 0,
  updated_at timestamptz default now()
);

-- ============ work orders, change log, agents ============
create table if not exists work_orders (
  id uuid primary key default gen_random_uuid(),
  wo_code text,
  agent text,
  title text not null,
  description text,
  status text default 'open',
  confidence text,
  review text,
  product_id uuid references products(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists change_log (
  id uuid primary key default gen_random_uuid(),
  product text,                                   -- product key or 'company'
  module text,
  tab text,
  change_type text,                               -- new | update
  description text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  agent_id text unique not null,
  role text,
  data_classes text,
  evaluation text,
  status text default 'active'
);

-- ============ contracts (sensitive) ============
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references team_members(id) on delete cascade,
  type text,                                      -- NDA | Contract | ...
  status text default 'pending',                  -- pending | complete
  file_path text,                                 -- private Storage object path
  created_at timestamptz default now()
);

-- ============ mission & values ============
create table if not exists mission_values (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                            -- 'company' or a product key
  purpose text,
  mission text,
  values jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique(scope)
);

-- ============ account-request queue (for the marketing-page Create-account flow) ============
create table if not exists account_requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  nda_accepted boolean default false,
  privacy_accepted boolean default false,
  accepted_at timestamptz,
  status text default 'pending',                  -- pending | approved | declined
  created_at timestamptz default now()
);

-- ============ enable RLS everywhere ============
alter table roles              enable row level security;
alter table role_assignments   enable row level security;
alter table products           enable row level security;
alter table product_areas      enable row level security;
alter table websites           enable row level security;
alter table plan_items         enable row level security;
alter table work_orders        enable row level security;
alter table change_log         enable row level security;
alter table agents             enable row level security;
alter table contracts          enable row level security;
alter table mission_values     enable row level security;
alter table account_requests   enable row level security;

-- ============ policies ============
-- READ: any authenticated user may read the non-sensitive tables.
-- WRITE: gated by has_perm('<Module: Tab>'). Owner bypasses via has_perm/is_owner.
-- Pattern below shown for one table; apply the same shape to each (perm key in comment).

-- roles  (perm: 'IT: Identity & Access')
create policy roles_read   on roles for select to authenticated using (true);
create policy roles_write  on roles for all    to authenticated
  using (has_perm('IT: Identity & Access')) with check (has_perm('IT: Identity & Access'));

-- role_assignments (perm: 'IT: Identity & Access')
create policy ra_read  on role_assignments for select to authenticated using (true);
create policy ra_write on role_assignments for all    to authenticated
  using (has_perm('IT: Identity & Access')) with check (has_perm('IT: Identity & Access'));

-- products / product_areas / websites / plan_items (perm: 'Products: <Board>')
create policy products_read on products for select to authenticated using (true);
create policy products_write on products for all to authenticated
  using (has_perm('Products: Manage')) with check (has_perm('Products: Manage'));
create policy pareas_read on product_areas for select to authenticated using (true);
create policy pareas_write on product_areas for all to authenticated
  using (has_perm('Products: Build Board')) with check (has_perm('Products: Build Board'));
create policy websites_read on websites for select to authenticated using (true);
create policy websites_write on websites for all to authenticated
  using (has_perm('Products: Website')) with check (has_perm('Products: Website'));
create policy plan_read on plan_items for select to authenticated using (true);
create policy plan_write on plan_items for all to authenticated
  using (has_perm('Products: Plan Board')) with check (has_perm('Products: Plan Board'));

-- work_orders (perm: 'IT: Agent Platform')
create policy wo_read on work_orders for select to authenticated using (true);
create policy wo_write on work_orders for all to authenticated
  using (has_perm('IT: Agent Platform')) with check (has_perm('IT: Agent Platform'));

-- change_log (perm: 'Security Tooling: Change Log')  — inserts by any authorized role; no update/delete
create policy cl_read on change_log for select to authenticated using (true);
create policy cl_insert on change_log for insert to authenticated
  with check (has_perm('Security Tooling: Change Log'));

-- agents (perm: 'IT: Agent Platform') — usually generated, read-only to most
create policy agents_read on agents for select to authenticated using (true);
create policy agents_write on agents for all to authenticated
  using (has_perm('IT: Agent Platform')) with check (has_perm('IT: Agent Platform'));

-- mission_values (perm: 'HR: Mission & Values' for company; 'Products: Mission & Values' for products)
create policy mv_read on mission_values for select to authenticated using (true);
create policy mv_write on mission_values for all to authenticated
  using (has_perm('HR: Mission & Values') or has_perm('Products: Mission & Values'))
  with check (has_perm('HR: Mission & Values') or has_perm('Products: Mission & Values'));

-- contracts (SENSITIVE): read/write only for HR/Security roles or Owner.
create policy contracts_read on contracts for select to authenticated
  using (has_perm('HR: HR Contracts') or has_perm('Security Tooling: Change Management'));
create policy contracts_write on contracts for all to authenticated
  using (has_perm('HR: HR Contracts')) with check (has_perm('HR: HR Contracts'));

-- account_requests: readable by owner/HR only; inserts allowed from the public request flow
--   (insert policy runs as the anon/publishable client — restrict columns, not identity).
create policy areq_read on account_requests for select to authenticated
  using (is_owner() or has_perm('HR: Team'));
create policy areq_insert on account_requests for insert to anon, authenticated
  with check (email is not null);
create policy areq_update on account_requests for update to authenticated
  using (is_owner() or has_perm('HR: Team')) with check (is_owner() or has_perm('HR: Team'));
```

> **Contracts Storage.** Create a **private** bucket `contracts`. Access only via signed URLs generated server-side after a `has_perm('HR: HR Contracts')`/owner check. Never expose the bucket publicly; never put file bytes through the browser client with the secret.

> **Permission keys are the contract between UI and RLS.** The role builder writes exactly these `"Module: Tab"` strings into `roles.permissions`. Keep one canonical list (below) and reuse it verbatim in both the checkbox tree and the policies.

**Canonical permission keys:** `ALL`, `IT: Agent Platform`, `IT: Identity & Access`, `Security Tooling: Change Management`, `Security Tooling: Change Log`, `HR: Team`, `HR: HR Contracts`, `HR: Mission & Values`, `HR: Constitution`, `Products: Manage`, `Products: Plan Board`, `Products: Build Board`, `Products: Agents`, `Products: Website`, `Products: Change Log`, `Products: Mission & Values`, `Finance: AR`, `Finance: AP`, `Contracts`, `Projects`.

---

## 2. Stage 2 — modules made real (build in this order)

Each slice = migration already covers the table(s); build the server reads/writes + UI, gate writes behind `has_perm`, and ship behind review.

### 2.1 Identity & Access (do first — everything else leans on it)
- **Roles tab (builder):** a checkbox tree of the canonical permission keys grouped by Module → Tab. Save the checked set as a named role (`roles.name` + `roles.permissions`). Edit and delete roles. "Grant all" writes `["ALL"]`.
- **Team tab (assign):** list `team_members`; assign one or more roles per member (`role_assignments`, many-to-many — a member may appear/hold multiple roles). Unassign removes the row.
- **Enforcement:** after this ships, every other module's writes are gated by the keys assigned here. Add a small server helper `requirePerm(key)` used by route handlers, mirroring `has_perm` — defense in depth, but **RLS remains the real gate**.

### 2.2 HR
- **Team:** already persists from Stage 1 (`team_members`: name, working_on). Keep the "Add member" form. Show each member's contract status via a **DB join** to `contracts` (NDA/Contract → pending/complete) — not JS state.
- **HR Contracts:** add/list contracts per member (`type`, `status`, optional file in the private `contracts` bucket). Status here drives the Team view. Gated by `HR: HR Contracts`.
- **Mission & Values:** edit the company-scope row (`mission_values` where `scope='company'`). Gated by `HR: Mission & Values`.
- **Scout Quest AI Constitution:** render the current Constitution text (v1.3) read-only from a config/markdown asset in the repo (not a table — it's governed elsewhere). Link version history.

### 2.3 Security Tooling
- **Change Management:** a place to record/approve change classes (1/2/3/3+). Minimal: a table view + a "log a change" form that writes to `change_log` with the class noted. Gated by `Security Tooling: Change Management`.
- **Change Log:** company-wide log (`change_log`) with columns product, module, tab, new/update, description, created_by, created_at. Inserts gated by `Security Tooling: Change Log`; **no edit/delete** (append-only for transparency).

### 2.4 Products (repeat the same six tabs per product)
Seed `products` with: `education`, `game`, `tutor`, `soundwiserx`, `ai-bookmark`, `other`. For each product:
- **Plan Board** — Gantt-style rows from `plan_items` (title, start/end, status). Gated by `Products: Plan Board`.
- **Build Board** — tracker rows from `product_areas` (area, status planned|building|live, note). Gated by `Products: Build Board`.
- **Agents** — the product's agent set from `agents` (shared list, filtered/tagged per product). Gated by `Products: Agents`.
- **Website** — links from `websites` (label + url). Gated by `Products: Website`.
- **Change Log** — the product-scoped slice of `change_log` (where `product = <key>`), same columns as the company log. Inserts gated by `Products: Change Log`.
- **Mission & Values** — the product-scope row of `mission_values` (`scope = <key>`). Gated by `Products: Mission & Values`.

### 2.5 Finance / Contracts / Projects (schema + read now, entry later)
- **Finance (AR/AP):** create minimal tables when we start entry; for Stage 2 just stand up the module shell reading empty state, gated by `Finance: AR` / `Finance: AP`. Don't build invoicing yet — note the seam.
- **Contracts module:** company-wide view over the same `contracts` table (sensitive; HR/Security/Owner only).
- **Projects module:** cross-product projects — a `projects` table can wait; stand up the shell.

### 2.6 Account-request approval (ties the marketing page to auth)
The `index.html` "Create account" form records a **pending** request with NDA + Privacy sign-off — it must **not** auto-create a login. Wire it to `account_requests` (insert via the publishable client; `nda_accepted`, `privacy_accepted`, `accepted_at`). In Identity & Access / HR, add an **owner-only** queue to review requests and, on approve, invite the user in Supabase Auth (owner action) and create their `profiles` + `team_members` rows. **Jessica approves who can log in.**

---

## 3. Stage 3 — live agent data (seams, then fill)
- **Work orders + spend:** generated from the ASL ledger rather than hand-entered. Build a server route/ingest that reads the governed ledger output and upserts `work_orders` (and a `spend` table when added). Keep the app read-only over this data; the ledger stays in the governed asl-gateway plane. **No D3 crosses over.**
- **Change log auto-fill:** generate `change_log` rows from git history / merge metadata for product+module+tab context, so transparency isn't manual.
- **Agents mirror:** regenerate `agents` from `spend_policy.yaml` (agent_id, role, data_classes, evaluation, status) rather than hand-keeping.

---

## 4. Constraints & definition of done
- **RLS on** for every table (verify with a non-owner test user: reads succeed on non-sensitive tables; writes fail without the right role; contracts invisible without HR/Security/owner).
- **Secret never** in the browser or git; keep the Stage 1 assertion that `SUPABASE_SECRET_KEY` is absent from the client bundle.
- **No D3** anywhere in this app. No cloud-model key. ~$0 spend.
- **Append-only** change_log (no update/delete policy).
- **Permission keys** identical between the role-builder checkbox tree and the RLS policies.
- **Each slice ships behind review** (same merge/hold rhythm as the platform build). Report back after Identity & Access is green before proceeding to the rest — it's the gate everything else depends on.

**Done =** roles created/assigned in Identity & Access and enforced by RLS across every module; HR Team/Contracts persist with contract status joined into Team; each product's Plan/Build/Agents/Website/Change Log/Mission persist and are gated; company + product change logs append-only; account-request queue approves into real logins (owner-only); Stage 3 ingest seams stubbed and documented. Then the Vercel deploy + a non-owner RLS test close it out.
