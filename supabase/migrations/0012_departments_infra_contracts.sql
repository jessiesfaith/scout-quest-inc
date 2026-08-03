-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0012
-- The last three modules from the design's grid:
--   * Contracts as a company module (not only HR): agreements that
--     belong to a vendor, district or partner rather than a person.
--   * Departments.
--   * IT › Infrastructure.
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003 and 0006.
--
-- ORDERING WARNING: this file replaces four policies defined earlier —
-- contracts_select_perm, contracts_write_perm and mv_write_perm from 0003,
-- and contracts_objects_select from 0006. Each replacement TIGHTENS access.
-- Re-running 0003 or 0006 after this file silently reverts those fixes.
-- If you ever re-run an earlier migration, run 0012 again afterwards.
-- ============================================================

-- ---------- Contracts: company agreements, not just employment ----------
-- 0003 assumed every contract belonged to a team member. District
-- agreements, DPAs, BAAs and vendor contracts have no team member, so a
-- counterparty is recorded instead. (team_member_id was already nullable in
-- 0003; this line only makes that guarantee explicit and is a no-op.)

alter table public.contracts
  alter column team_member_id drop not null;

alter table public.contracts
  add column if not exists counterparty text,
  add column if not exists category text not null default 'employment',
  -- employment | vendor | district | dpa-baa | partner | other
  add column if not exists effective_on date,
  add column if not exists expires_on date,
  add column if not exists obligations text;

create index if not exists contracts_category_idx
  on public.contracts (category);

-- The bare 'Contracts' permission key existed in the role builder but no
-- policy consulted it, so checking it granted nothing. It now opens the
-- company-wide view — but ONLY the company's own agreements. Employment
-- contracts stay behind 'HR: HR Contracts': whoever tracks the district
-- and vendor paperwork has no business reading staff NDAs and offers.
drop policy if exists "contracts_select_perm" on public.contracts;
create policy "contracts_select_perm" on public.contracts
  for select to authenticated
  using (
    public.has_perm('HR: HR Contracts')
    or public.has_perm('Security Tooling: Change Management')
    or (public.has_perm('Contracts') and category <> 'employment')
  );

-- Writing stays with HR alone. 'Contracts' is a read key: the company-wide
-- screen ships no way to edit, and `for all` would have handed any holder
-- INSERT, UPDATE and DELETE on every employment contract in the table.
drop policy if exists "contracts_write_perm" on public.contracts;
create policy "contracts_write_perm" on public.contracts
  for all to authenticated
  using (public.has_perm('HR: HR Contracts'))
  with check (public.has_perm('HR: HR Contracts'));

-- The stored files follow the row. Without this, a 'Contracts' holder sees
-- an agreement and its "Open" link, then gets a 403 from the bucket.
-- Storage has no `category` to test, so this grant is deliberately coarser
-- than the row grant above: a 'Contracts' holder who learns an employment
-- contract's exact file_path could fetch the object. They cannot learn it
-- through this app — the row is invisible to them and the download route
-- reads file_path through the same RLS — but treat the two keys as
-- equivalent for bucket contents until a per-object path convention exists.
drop policy if exists "contracts_objects_select" on storage.objects;
create policy "contracts_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and (
      public.has_perm('HR: HR Contracts')
      or public.has_perm('Security Tooling: Change Management')
      or public.has_perm('Contracts')
    )
  );

-- ---------- Mission & Values: the two keys stop overlapping ----------
-- 0003 let either key write any row, so 'Products: Mission & Values'
-- could rewrite the company's mission. Each key now owns its own scope.

drop policy if exists "mv_write_perm" on public.mission_values;
create policy "mv_write_perm" on public.mission_values
  for all to authenticated
  using (
    case when scope = 'company'
      then public.has_perm('HR: Mission & Values')
      else public.has_perm('Products: Mission & Values')
    end
  )
  with check (
    case when scope = 'company'
      then public.has_perm('HR: Mission & Values')
      else public.has_perm('Products: Mission & Values')
    end
  );

-- ---------- Departments ----------

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  summary     text,
  manager     text,
  status      text not null default 'active',   -- active | forming | reserved
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.departments enable row level security;

drop policy if exists "departments_select_access" on public.departments;
create policy "departments_select_access" on public.departments
  for select to authenticated using (public.has_access());

drop policy if exists "departments_write_perm" on public.departments;
create policy "departments_write_perm" on public.departments
  for all to authenticated
  using (public.has_perm('HR: Team'))
  with check (public.has_perm('HR: Team'));

-- People belong to a department.
alter table public.team_members
  add column if not exists department_id uuid
    references public.departments (id) on delete set null;

-- The departments named in the Constitution §7.
insert into public.departments (name, summary, status, sort) values
  ('Product & Design', 'Product direction, design, and the learner experience.', 'active', 1),
  ('Engineering', 'Platform, infrastructure, software, AI, security, data, speech, DevOps, SRE, QA.', 'active', 2),
  ('Security & Compliance', 'Governance, guardrails, audit, and regulatory obligations.', 'active', 3),
  ('Learning Sciences', 'Reserved as a separate future department.', 'reserved', 4)
on conflict (name) do nothing;

-- ---------- IT › Infrastructure ----------

create table if not exists public.infrastructure (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null default 'service',
  -- service | database | hosting | storage | model | integration
  environment  text not null default 'production',
  provider     text,
  data_classes text,
  status       text not null default 'live',    -- live | building | planned | retired
  notes        text,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.infrastructure enable row level security;

drop policy if exists "infrastructure_select_access" on public.infrastructure;
create policy "infrastructure_select_access" on public.infrastructure
  for select to authenticated using (public.has_access());

drop policy if exists "infrastructure_write_perm" on public.infrastructure;
create policy "infrastructure_write_perm" on public.infrastructure
  for all to authenticated
  using (public.has_perm('IT: Agent Platform'))
  with check (public.has_perm('IT: Agent Platform'));

-- What this company OS actually runs on today.
insert into public.infrastructure (name, kind, environment, provider, data_classes, status, notes, sort)
select v.name, v.kind, v.environment, v.provider, v.data_classes, v.status, v.notes, v.sort
from (values
  ('Company OS web app', 'hosting', 'production', 'Vercel', 'D0-D2', 'live', 'Auto-deploys from the master branch.', 1),
  ('Company OS database', 'database', 'production', 'Supabase Postgres', 'D0-D2', 'live', 'Row-level security on every table. Free plan: daily backups, no point-in-time recovery.', 2),
  ('Authentication', 'service', 'production', 'Supabase Auth', 'D1', 'live', 'Email and password plus TOTP two-factor.', 3),
  ('Contracts storage', 'storage', 'production', 'Supabase Storage', 'D2', 'live', 'Private bucket; reachable only through short-lived signed links.', 4),
  ('Source control', 'service', 'production', 'GitHub (private)', 'D0-D2', 'live', 'jessiesfaith/scout-quest-inc', 5),
  ('Governed model plane', 'model', 'local', 'asl-gateway', 'D3', 'live', 'Regulated data stays here and never reaches this OS.', 6)
) as v(name, kind, environment, provider, data_classes, status, notes, sort)
where not exists (
  select 1 from public.infrastructure i where i.name = v.name
);
