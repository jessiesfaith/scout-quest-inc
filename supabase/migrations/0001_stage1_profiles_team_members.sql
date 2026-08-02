-- ============================================================
-- Scout Quest Inc — Company OS — Stage 1 migration
-- Tables: profiles, team_members. RLS ON for both.
-- Paste this whole block into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent) — BUT: migrations 0002 and 0003
-- tighten policies, helpers, and the trigger defined here. If
-- you ever re-run this file, re-run 0002 AND 0003 right after
-- it (in that order), or access control silently reverts to
-- the looser Stage 1 rules.
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  is_owner   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  email      text,
  status     text not null default 'active',
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- RLS on ----------

alter table public.profiles enable row level security;
alter table public.team_members enable row level security;

-- ---------- Helper ----------
-- security definer so profiles policies can consult profiles without
-- infinite RLS recursion.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_owner from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------- Policies: profiles ----------
-- Readable by self and by the owner.

drop policy if exists "profiles_select_self_or_owner" on public.profiles;
create policy "profiles_select_self_or_owner" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_owner());

-- A user may create their own row. is_owner=true is only accepted for the
-- owner email, so the client cannot self-escalate.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and (
      is_owner = false
      or (select auth.jwt() ->> 'email') = 'jessicadougherty4321@gmail.com'
    )
  );

-- ---------- Policies: team_members ----------
-- Stage 1: any authenticated user may read and add team members.
-- Stage 2 seam: replace these two policies with role-based ones
-- (e.g. using public.has_permission('hr.team.write')) — table stays as is.

drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_authenticated" on public.team_members
  for select to authenticated
  using (true);

drop policy if exists "team_members_insert_authenticated" on public.team_members;
create policy "team_members_insert_authenticated" on public.team_members
  for insert to authenticated
  with check (true);

-- ---------- Auto-create profile on signup ----------
-- Owner flag is decided here in SQL, never trusted from the client.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_owner)
  values (
    new.id,
    new.email,
    new.email = 'jessicadougherty4321@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Backfill ----------
-- Covers users that already existed before this migration ran.

insert into public.profiles (id, email, is_owner)
select u.id, u.email, u.email = 'jessicadougherty4321@gmail.com'
from auth.users u
on conflict (id) do nothing;
