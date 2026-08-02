-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0008
-- Audit integrity for the append-only records. Append-only is
-- worth little if the clock or the author can be forged, or if
-- a single call can wipe the archive.
-- Paste into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0007.
-- ============================================================

-- ---------- Author snapshot ----------
-- created_by points at profiles, which cascades from auth.users. Deleting
-- a person silently NULLed their name off every entry they ever filed —
-- an UPDATE that bypasses RLS because referential actions run as the
-- system. Snapshot the identity as immutable text so the record survives.

alter table public.change_log
  add column if not exists created_by_email text;

alter table public.security_reports
  add column if not exists created_by_email text,
  add column if not exists filed_at timestamptz not null default now(),
  add column if not exists source_key text;

create unique index if not exists security_reports_source_key_idx
  on public.security_reports (source_key)
  where source_key is not null;

-- ---------- Forced clock + author ----------
-- default now() only applies when the column is omitted; PostgREST
-- inserts exactly the keys it is handed, so a caller could backdate an
-- entry. A BEFORE INSERT trigger cannot be skipped.

create or replace function public.stamp_change_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_by_email := coalesce(
    (select u.email from auth.users u where u.id = new.created_by),
    new.created_by_email
  );
  return new;
end;
$$;

drop trigger if exists stamp_change_log on public.change_log;
create trigger stamp_change_log
  before insert on public.change_log
  for each row execute function public.stamp_change_log();

-- Reports may legitimately record when a review ran, so ran_at stays
-- caller-supplied — but filed_at (when it entered the archive) is forced,
-- and the two are shown together so a mismatch is visible.
create or replace function public.stamp_security_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.filed_at := now();
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_by_email := coalesce(
    (select u.email from auth.users u where u.id = new.created_by),
    new.created_by_email
  );
  return new;
end;
$$;

drop trigger if exists stamp_security_report on public.security_reports;
create trigger stamp_security_report
  before insert on public.security_reports
  for each row execute function public.stamp_security_report();

-- ---------- The archive is not deletable ----------
-- An owner-scoped delete let one call wipe every report, and
-- delete-then-reinsert is an edit with extra steps. Truly append-only.

drop policy if exists "security_reports_delete_owner" on public.security_reports;

-- ---------- Change class is constrained ----------

alter table public.change_log
  drop constraint if exists change_log_change_class_check;
alter table public.change_log
  add constraint change_log_change_class_check
  check (change_class is null or change_class in ('1', '2', '3', '3+'));

-- ---------- Change Management may write the log ----------
-- The screen offered the form to Change Management holders while the
-- policy accepted only Change Log / Products: Change Log — the insert
-- failed with a raw database error.

drop policy if exists "cl_insert_perm" on public.change_log;
create policy "cl_insert_perm" on public.change_log
  for insert to authenticated
  with check (
    (
      public.has_perm('Security Tooling: Change Log')
      or public.has_perm('Products: Change Log')
      or public.has_perm('Security Tooling: Change Management')
    )
    and created_by = (select auth.uid())
  );

-- ---------- Attribution is readable ----------
-- profiles are visible only to self and the owner, so the log's "By"
-- column read "—" for everyone else. The snapshot column above fixes it
-- for new rows; backfill the ones already written.

update public.change_log c
set created_by_email = u.email
from auth.users u
where c.created_by = u.id
  and c.created_by_email is null;

update public.security_reports r
set created_by_email = u.email
from auth.users u
where r.created_by = u.id
  and r.created_by_email is null;

-- Seeded reviews were filed by the migration, not a person.
update public.security_reports
set created_by_email = coalesce(created_by_email, 'filed by migration')
where created_by is null;
