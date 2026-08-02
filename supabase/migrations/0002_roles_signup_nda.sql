-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0002
-- Roles + self-serve signup + NDA/privacy acceptance records.
-- Paste this whole block into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0001.
-- BUT: migration 0003 supersedes the has_access() helper and
-- several policies defined here. If you ever re-run this file
-- after 0003 has been applied, re-run 0003 right after it, or
-- access control silently downgrades.
-- ============================================================

-- ---------- Roles ----------

create table if not exists public.roles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;

insert into public.roles (name)
values ('Admin'), ('Member')
on conflict (name) do nothing;

-- ---------- Profiles: role + consent records ----------

alter table public.profiles
  add column if not exists role_id uuid references public.roles (id),
  add column if not exists nda_accepted_at timestamptz,
  add column if not exists nda_version text,
  add column if not exists privacy_accepted_at timestamptz;

-- ---------- Access helper ----------
-- The gate: the owner ALWAYS has access (lockout-proof, password only);
-- everyone else needs a role AND a 2FA-verified session (aal2), so a
-- stolen password alone can never reach data — even via the raw REST API.
-- security definer avoids RLS recursion.

create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_owner
            or (p.role_id is not null
                and (select auth.jwt() ->> 'aal') = 'aal2')
     from public.profiles p
     where p.id = auth.uid()),
    false
  );
$$;

-- ---------- Signup trigger: record consent + owner guarantee ----------
-- Replaces the 0001 version. Consent fields come from signup metadata;
-- acceptance time is stamped server-side at account creation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles
    (id, email, full_name, is_owner, nda_accepted_at, nda_version, privacy_accepted_at)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email = 'jessicadougherty4321@gmail.com',
    case when (new.raw_user_meta_data ->> 'nda_accepted') = 'true' then now() end,
    nullif(new.raw_user_meta_data ->> 'nda_version', ''),
    case when (new.raw_user_meta_data ->> 'privacy_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Owner guarantee: Jessica's account is always the owner. Keyed to
-- auth.users (the identity source), NOT the spoofable profiles.email
-- column — this also demotes any forged row claiming the owner email.
update public.profiles p
set is_owner = (u.email = 'jessicadougherty4321@gmail.com')
from auth.users u
where p.id = u.id
  and p.is_owner is distinct from (u.email = 'jessicadougherty4321@gmail.com');

-- Backfill consent + name for accounts created before this migration ran
-- (their signup metadata is in auth.users; acceptance time = signup time).
update public.profiles p
set full_name = coalesce(p.full_name, nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')),
    nda_version = coalesce(p.nda_version, nullif(u.raw_user_meta_data ->> 'nda_version', '')),
    nda_accepted_at = coalesce(
      p.nda_accepted_at,
      case when u.raw_user_meta_data ->> 'nda_accepted' = 'true' then u.created_at end
    ),
    privacy_accepted_at = coalesce(
      p.privacy_accepted_at,
      case when u.raw_user_meta_data ->> 'privacy_accepted' = 'true' then u.created_at end
    )
from auth.users u
where p.id = u.id;

-- Tighten the 0001 self-insert policy: the fallback insert may only create
-- a bare row for yourself — no self-granted role, no forged email or
-- consent record.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and email = (select auth.jwt() ->> 'email')
    and role_id is null
    and nda_accepted_at is null
    and nda_version is null
    and privacy_accepted_at is null
    and (
      is_owner = false
      or (select auth.jwt() ->> 'email') = 'jessicadougherty4321@gmail.com'
    )
  );

-- ---------- Policies: roles ----------

-- Role names are only visible to people who already have access —
-- pending (role-less) accounts cannot enumerate them.
drop policy if exists "roles_select_authenticated" on public.roles;
drop policy if exists "roles_select_access" on public.roles;
create policy "roles_select_access" on public.roles
  for select to authenticated
  using (public.has_access());

drop policy if exists "roles_insert_owner" on public.roles;
create policy "roles_insert_owner" on public.roles
  for insert to authenticated
  with check (public.is_owner());

drop policy if exists "roles_update_owner" on public.roles;
create policy "roles_update_owner" on public.roles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "roles_delete_owner" on public.roles;
create policy "roles_delete_owner" on public.roles
  for delete to authenticated
  using (public.is_owner());

-- ---------- Policies: profiles ----------
-- Owner may update profiles (assign/clear roles). The with-check keeps
-- is_owner truthful: only the owner email can carry is_owner = true.

drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner" on public.profiles
  for update to authenticated
  using (public.is_owner())
  with check (
    public.is_owner()
    and is_owner = (email = 'jessicadougherty4321@gmail.com')
  );

-- ---------- Policies: team_members ----------
-- Tightened from 0001: reading/adding team members now requires access
-- (owner or an assigned role), not just an account.

drop policy if exists "team_members_select_authenticated" on public.team_members;
drop policy if exists "team_members_insert_authenticated" on public.team_members;

drop policy if exists "team_members_select_access" on public.team_members;
create policy "team_members_select_access" on public.team_members
  for select to authenticated
  using (public.has_access());

drop policy if exists "team_members_insert_access" on public.team_members;
create policy "team_members_insert_access" on public.team_members
  for insert to authenticated
  with check (public.has_access());
