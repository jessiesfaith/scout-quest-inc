-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0003 (Full build)
-- Whole-OS schema: permission-based roles, products, boards,
-- work orders, change log, agents, contracts, mission/values,
-- account-request queue. RLS ON for every table.
-- Ruling (Jessica, 2026-08-02): no role → no reads; role-less
-- signed-in users see only the awaiting-role page.
-- Paste this whole block into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0001 + 0002.
-- This file SUPERSEDES 0002's has_access() and several policies:
-- if 0001 or 0002 is ever re-run, re-run 0003 immediately after.
-- Transitional note: legacy profiles.role_id still grants READS
-- (has_access); WRITES need the new permission model — so hold off
-- assigning roles until the Identity & Access screen ships.
-- ============================================================

-- ---------- Roles gain permission sets ----------
-- 0002 created roles(id, name, created_at); the full model stores the
-- checked permission keys ("Module: Tab" strings, or ["ALL"]).

alter table public.roles
  add column if not exists permissions jsonb not null default '[]'::jsonb;

-- ---------- Team members link to accounts ----------
-- role_assignments attach to team_members; has_perm() resolves the
-- signed-in user through team_members.profile_id.

alter table public.team_members
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists working_on text;

-- Off-boarding fix: deleting an auth user must not be blocked by rows
-- they created.
alter table public.team_members
  drop constraint if exists team_members_created_by_fkey;
alter table public.team_members
  add constraint team_members_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

create table if not exists public.role_assignments (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid references public.team_members (id) on delete cascade,
  role_id        uuid references public.roles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (team_member_id, role_id)
);

-- ---------- Products & boards ----------

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text not null,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);

insert into public.products (key, name) values
  ('education',   'Scout Quest Education'),
  ('game',        'Scout Quest Game'),
  ('tutor',       'Scout Quest Tutor'),
  ('soundwiserx', 'Soundwiserx'),
  ('ai-bookmark', 'AI Bookmark'),
  ('other',       'Other')
on conflict (key) do nothing;

create table if not exists public.product_areas (   -- Build Board rows
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  area       text not null,
  status     text not null default 'planned',       -- planned | building | live
  note       text,
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.websites (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  label      text not null,
  url        text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_items (      -- Plan Board (Gantt) rows
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete cascade,
  title      text not null,
  start_date date,
  end_date   date,
  status     text not null default 'planned',
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Work orders, change log, agents ----------

create table if not exists public.work_orders (
  id          uuid primary key default gen_random_uuid(),
  wo_code     text,
  agent       text,
  title       text not null,
  description text,
  status      text not null default 'open',
  confidence  text,
  review      text,
  product_id  uuid references public.products (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.change_log (
  id          uuid primary key default gen_random_uuid(),
  product     text,                                 -- product key or 'company'
  module      text,
  tab         text,
  change_type text,                                 -- new | update
  description text not null,
  created_by  uuid references public.profiles (id) on delete set null
              default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.agents (
  id           uuid primary key default gen_random_uuid(),
  agent_id     text unique not null,
  role         text,
  data_classes text,
  evaluation   text,
  status       text not null default 'active'
);

-- ---------- Contracts (sensitive) ----------
-- Files live in the PRIVATE Storage bucket `contracts` (Jessica creates
-- it in the dashboard); this table stores metadata + object path only.

create table if not exists public.contracts (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT (not cascade): FK cascades bypass RLS, so deleting a team
  -- member must never silently destroy sensitive contract records —
  -- contracts are removed first, by someone with the contracts perm.
  team_member_id uuid references public.team_members (id) on delete restrict,
  type           text,                              -- NDA | Contract | ...
  status         text not null default 'pending',   -- pending | complete
  file_path      text,
  created_at     timestamptz not null default now()
);

-- ---------- Mission & values ----------

create table if not exists public.mission_values (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null unique,                  -- 'company' or a product key
  purpose    text,
  mission    text,
  "values"   jsonb not null default '[]'::jsonb,    -- quoted: VALUES is reserved
  updated_at timestamptz not null default now()
);

-- ---------- Account-request queue ----------
-- The marketing page's "Create account" files a request here; it never
-- creates a login. Jessica approves, then invites in Supabase Auth.

create table if not exists public.account_requests (
  id               uuid primary key default gen_random_uuid(),
  name             text,
  email            text not null,
  nda_accepted     boolean not null default false,
  nda_version      text,
  privacy_accepted boolean not null default false,
  accepted_at      timestamptz,
  status           text not null default 'pending', -- pending | approved | declined
  created_at       timestamptz not null default now()
);

-- ---------- RLS on everywhere ----------

alter table public.roles             enable row level security;  -- (already on)
alter table public.role_assignments  enable row level security;
alter table public.products          enable row level security;
alter table public.product_areas     enable row level security;
alter table public.websites          enable row level security;
alter table public.plan_items        enable row level security;
alter table public.work_orders       enable row level security;
alter table public.change_log        enable row level security;
alter table public.agents            enable row level security;
alter table public.contracts         enable row level security;
alter table public.mission_values    enable row level security;
alter table public.account_requests  enable row level security;

-- ---------- Helpers ----------
-- has_access(): may this user see the app at all? Owner always (password
-- only, lockout-proof). Everyone else: 2FA-verified session (aal2) AND a
-- role — via the new role_assignments, or the legacy 0002 profiles.role_id
-- (honored until Identity & Access migrates it, so nobody loses access
-- the moment this migration runs).

create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_owner
            or ((select auth.jwt() ->> 'aal') = 'aal2'
                and (p.role_id is not null
                     or exists (
                       select 1
                       from public.team_members tm
                       join public.role_assignments ra on ra.team_member_id = tm.id
                       where tm.profile_id = p.id
                     )))
     from public.profiles p
     where p.id = auth.uid()),
    false
  );
$$;

-- has_perm(perm): may this user WRITE this module/tab? Owner always;
-- everyone else needs aal2 + a role carrying the key (or 'ALL').
-- The permission keys are the contract between the role builder UI and
-- these policies — keep them identical on both sides.

create or replace function public.has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.is_owner from public.profiles p where p.id = auth.uid()), false)
    or (
      (select auth.jwt() ->> 'aal') = 'aal2'
      and exists (
        select 1
        from public.role_assignments ra
        join public.team_members tm on tm.id = ra.team_member_id
        join public.roles r on r.id = ra.role_id
        where tm.profile_id = auth.uid()
          and (r.permissions ? perm or r.permissions ? 'ALL')
      )
    );
$$;

-- ---------- Guard: account-linking is privileged ----------
-- team_members.profile_id decides whose permissions a member's roles
-- feed. Without this guard, an 'HR: Team' holder could repoint a row's
-- profile_id to themselves and inherit any role (incl. ALL). Only the
-- owner or 'IT: Identity & Access' may set or change the link.

create or replace function public.guard_team_member_profile_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.profile_id is not null)
     or (tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id)
  then
    -- auth.uid() is null for SQL-editor / service-role operations; end
    -- users always carry a uid and are gated by RLS before this fires.
    if auth.uid() is not null
       and not (public.is_owner() or public.has_perm('IT: Identity & Access'))
    then
      raise exception
        'Linking a team member to an account requires IT: Identity & Access';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_team_member_profile_link on public.team_members;
create trigger guard_team_member_profile_link
  before insert or update on public.team_members
  for each row execute function public.guard_team_member_profile_link();

-- ---------- Policies ----------
-- READ: has_access() everywhere non-sensitive (Jessica's ruling: role-less
-- users see nothing but the awaiting-role page). WRITE: has_perm(key).
-- Owner bypasses both via the helpers.

-- Defensive: retire every pre-0003 policy name on team_members so a
-- half-ordered re-run of older files can't leave permissive leftovers.
drop policy if exists "team_members_select_authenticated" on public.team_members;
drop policy if exists "team_members_insert_authenticated" on public.team_members;

-- roles / role_assignments (perm: 'IT: Identity & Access')
drop policy if exists "roles_select_access" on public.roles;
create policy "roles_select_access" on public.roles
  for select to authenticated using (public.has_access());

drop policy if exists "roles_insert_owner" on public.roles;
drop policy if exists "roles_update_owner" on public.roles;
drop policy if exists "roles_delete_owner" on public.roles;
drop policy if exists "roles_write_perm" on public.roles;
create policy "roles_write_perm" on public.roles
  for all to authenticated
  using (public.has_perm('IT: Identity & Access'))
  with check (public.has_perm('IT: Identity & Access'));

drop policy if exists "ra_select_access" on public.role_assignments;
create policy "ra_select_access" on public.role_assignments
  for select to authenticated using (public.has_access());

drop policy if exists "ra_write_perm" on public.role_assignments;
create policy "ra_write_perm" on public.role_assignments
  for all to authenticated
  using (public.has_perm('IT: Identity & Access'))
  with check (public.has_perm('IT: Identity & Access'));

-- products family
drop policy if exists "products_select_access" on public.products;
create policy "products_select_access" on public.products
  for select to authenticated using (public.has_access());
drop policy if exists "products_write_perm" on public.products;
create policy "products_write_perm" on public.products
  for all to authenticated
  using (public.has_perm('Products: Manage'))
  with check (public.has_perm('Products: Manage'));

drop policy if exists "pareas_select_access" on public.product_areas;
create policy "pareas_select_access" on public.product_areas
  for select to authenticated using (public.has_access());
drop policy if exists "pareas_write_perm" on public.product_areas;
create policy "pareas_write_perm" on public.product_areas
  for all to authenticated
  using (public.has_perm('Products: Build Board'))
  with check (public.has_perm('Products: Build Board'));

drop policy if exists "websites_select_access" on public.websites;
create policy "websites_select_access" on public.websites
  for select to authenticated using (public.has_access());
drop policy if exists "websites_write_perm" on public.websites;
create policy "websites_write_perm" on public.websites
  for all to authenticated
  using (public.has_perm('Products: Website'))
  with check (public.has_perm('Products: Website'));

drop policy if exists "plan_select_access" on public.plan_items;
create policy "plan_select_access" on public.plan_items
  for select to authenticated using (public.has_access());
drop policy if exists "plan_write_perm" on public.plan_items;
create policy "plan_write_perm" on public.plan_items
  for all to authenticated
  using (public.has_perm('Products: Plan Board'))
  with check (public.has_perm('Products: Plan Board'));

-- work_orders (perm: 'IT: Agent Platform')
drop policy if exists "wo_select_access" on public.work_orders;
create policy "wo_select_access" on public.work_orders
  for select to authenticated using (public.has_access());
drop policy if exists "wo_write_perm" on public.work_orders;
create policy "wo_write_perm" on public.work_orders
  for all to authenticated
  using (public.has_perm('IT: Agent Platform'))
  with check (public.has_perm('IT: Agent Platform'));

-- change_log: append-only (insert, no update/delete policies)
drop policy if exists "cl_select_access" on public.change_log;
create policy "cl_select_access" on public.change_log
  for select to authenticated using (public.has_access());
drop policy if exists "cl_insert_perm" on public.change_log;
create policy "cl_insert_perm" on public.change_log
  for insert to authenticated
  with check (
    (
      public.has_perm('Security Tooling: Change Log')
      or public.has_perm('Products: Change Log')
    )
    -- author is always the real caller — no forged attribution
    and created_by = (select auth.uid())
  );

-- agents (perm: 'IT: Agent Platform')
drop policy if exists "agents_select_access" on public.agents;
create policy "agents_select_access" on public.agents
  for select to authenticated using (public.has_access());
drop policy if exists "agents_write_perm" on public.agents;
create policy "agents_write_perm" on public.agents
  for all to authenticated
  using (public.has_perm('IT: Agent Platform'))
  with check (public.has_perm('IT: Agent Platform'));

-- mission_values
drop policy if exists "mv_select_access" on public.mission_values;
create policy "mv_select_access" on public.mission_values
  for select to authenticated using (public.has_access());
drop policy if exists "mv_write_perm" on public.mission_values;
create policy "mv_write_perm" on public.mission_values
  for all to authenticated
  using (
    public.has_perm('HR: Mission & Values')
    or public.has_perm('Products: Mission & Values')
  )
  with check (
    public.has_perm('HR: Mission & Values')
    or public.has_perm('Products: Mission & Values')
  );

-- contracts (SENSITIVE): no blanket read — HR/Security/owner only.
drop policy if exists "contracts_select_perm" on public.contracts;
create policy "contracts_select_perm" on public.contracts
  for select to authenticated
  using (
    public.has_perm('HR: HR Contracts')
    or public.has_perm('Security Tooling: Change Management')
  );
drop policy if exists "contracts_write_perm" on public.contracts;
create policy "contracts_write_perm" on public.contracts
  for all to authenticated
  using (public.has_perm('HR: HR Contracts'))
  with check (public.has_perm('HR: HR Contracts'));

-- account_requests: the ONE anon-writable table (the public request
-- form). Requests are readable/manageable by owner or HR: Team only.
drop policy if exists "areq_insert_public" on public.account_requests;
create policy "areq_insert_public" on public.account_requests
  for insert to anon, authenticated
  with check (
    email is not null
    and status = 'pending'
  );
drop policy if exists "areq_select_perm" on public.account_requests;
create policy "areq_select_perm" on public.account_requests
  for select to authenticated
  using (public.is_owner() or public.has_perm('HR: Team'));
drop policy if exists "areq_update_perm" on public.account_requests;
create policy "areq_update_perm" on public.account_requests
  for update to authenticated
  using (public.is_owner() or public.has_perm('HR: Team'))
  with check (public.is_owner() or public.has_perm('HR: Team'));

-- team_members writes upgrade to the permission key (reads stay on
-- has_access from 0002).
drop policy if exists "team_members_insert_access" on public.team_members;
drop policy if exists "team_members_write_perm" on public.team_members;
create policy "team_members_write_perm" on public.team_members
  for all to authenticated
  using (public.has_perm('HR: Team'))
  with check (public.has_perm('HR: Team'));
