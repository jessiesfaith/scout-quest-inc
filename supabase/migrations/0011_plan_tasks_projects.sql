-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0011
--   * plan_items gain a parent, so a plan row can hold tasks
--     underneath it (the Gantt shows parents collapsed by default).
--   * projects table for the Projects module.
--   * account_requests gains a decision trail.
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003.
-- ============================================================

-- ---------- Plan items can nest one level ----------

alter table public.plan_items
  add column if not exists parent_id uuid
    references public.plan_items (id) on delete cascade;

create index if not exists plan_items_parent_idx
  on public.plan_items (parent_id);

-- ---------- Projects ----------

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  summary     text,
  status      text not null default 'planned',   -- planned | building | live
  start_date  date,
  end_date    date,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "projects_select_access" on public.projects;
create policy "projects_select_access" on public.projects
  for select to authenticated using (public.has_access());

drop policy if exists "projects_write_perm" on public.projects;
create policy "projects_write_perm" on public.projects
  for all to authenticated
  using (public.has_perm('Projects'))
  with check (public.has_perm('Projects'));

-- ---------- Account requests: decision trail ----------

alter table public.account_requests
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references public.profiles (id) on delete set null,
  add column if not exists note text;

-- Approving or declining is a decision, so record who made it and when
-- rather than trusting whatever the client sends.
create or replace function public.stamp_account_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.decided_at := now();
    new.decided_by := auth.uid();
  else
    -- Not a decision: keep the recorded one rather than letting the
    -- caller supply its own decided_at / decided_by.
    new.decided_at := old.decided_at;
    new.decided_by := old.decided_by;
  end if;
  -- The consent record is signed at request time and is never revisable.
  new.nda_accepted := old.nda_accepted;
  new.nda_version := old.nda_version;
  new.privacy_accepted := old.privacy_accepted;
  new.accepted_at := old.accepted_at;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists stamp_account_request_decision on public.account_requests;
create trigger stamp_account_request_decision
  before update on public.account_requests
  for each row execute function public.stamp_account_request_decision();

-- Only these three states are meaningful.
alter table public.account_requests
  drop constraint if exists account_requests_status_check;
alter table public.account_requests
  add constraint account_requests_status_check
  check (status in ('pending', 'approved', 'declined'));
