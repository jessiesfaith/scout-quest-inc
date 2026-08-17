-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0027
-- Closes the two open HIGH tickets that had been open since 2 August:
--   TCK-0008  the Contracts key could read every employment contract FILE
--   TCK-0009  a delegated Identity & Access admin saw false account links
--             and one Save unlinked people
--
-- Both are access-control changes. Both are asserted in-migration by a
-- check that raises if the fix is absent, and both are then re-verified
-- from OUTSIDE the database before the ticket moves to verified — the
-- migration marks them 'fixed'; a separate observation marks them
-- 'verified'. That two-step is the whole point of the ticket model.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run. Requires 0014 and 0024.
--
-- ORDERING WARNING: this file replaces contracts_objects_select (from
-- 0006, tightened in 0012) and TIGHTENS it further. Re-running 0006 or
-- 0012 afterwards silently widens it again. If you ever re-run either,
-- run 0027 again straight after.
-- ============================================================

-- ============================================================
-- TCK-0008 — storage read scoped by path, like the writes already are
-- ============================================================
-- 0012 gave the bare 'Contracts' key SELECT on every object in the
-- bucket, arguing the file path could not be discovered through the app.
-- That was wrong: storage.objects SELECT is what the Storage LIST
-- endpoint checks, so a holder could enumerate the bucket directly and
-- mint a signed URL for anything in it. And because the HR upload path
-- never sets category (it defaults to 'employment'), every file in the
-- bucket was an employment contract — the coarse grant exposed 100% of
-- what the row policy protected.
--
-- 0014 already established the path convention for WRITES: employment
-- files live under `<team_member_id>/`, company files under `company/`,
-- and 'company' is not a uuid so the two can never collide. This applies
-- the same test to reads. HR: HR Contracts and Security Tooling: Change
-- Management keep the whole bucket, exactly as before.

drop policy if exists "contracts_objects_select" on storage.objects;
create policy "contracts_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and (
      public.has_perm('HR: HR Contracts')
      or public.has_perm('Security Tooling: Change Management')
      or (public.has_perm('Contracts') and name like 'company/%')
    )
  );

-- Prove the policy text is what shipped. RLS on storage.objects cannot
-- be exercised as a role from here without a JWT that holds the key, so
-- assert on the catalog: the SELECT policy for the bucket must contain
-- the path predicate. The external probe below is the behavioural check.
do $$
declare
  qual text;
begin
  select pg_get_expr(p.polqual, p.polrelid) into qual
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and p.polname = 'contracts_objects_select';

  if qual is null then
    raise exception 'TCK-0008 NOT fixed: contracts_objects_select policy is missing';
  end if;
  if position('company/%' in qual) = 0 then
    raise exception 'TCK-0008 NOT fixed: contracts_objects_select does not test the company/ path. qual = %', qual;
  end if;
  raise notice 'TCK-0008: contracts_objects_select now reads: %', qual;
end
$$;

-- ============================================================
-- TCK-0009 — a picker that shows every account, without consent data
-- ============================================================
-- profiles has exactly one SELECT policy, from 0001, never widened:
--   id = auth.uid() or is_owner()
-- Three later migrations granted IT: Identity & Access the power to LINK
-- an account to a team member, but the profile being linked TO is read
-- through that 0001 policy. A non-owner IA holder's picker therefore
-- returned one row — their own. Two failures followed: delegation did not
-- work, and worse, a member the owner had already linked rendered as
-- "— no linked account —" (defaultValue matched no option), so pressing
-- Save on that row wrote profile_id = null and revoked their access.
--
-- profiles also carries consent records (nda_accepted_at, nda_version,
-- privacy_accepted_at). RLS is row-level and cannot hide columns, and an
-- access admin linking accounts has no need of consent timestamps. So the
-- base table stays exactly as locked as 0001 left it, and the widened
-- surface is a FUNCTION that projects three columns and gates itself:
--
--   security definer  so it can read past the 0001 policy — but ONLY for
--                     the three columns it returns, and ONLY after its own
--                     has_perm check passes. It is not a general bypass:
--                     a caller cannot ask it for nda_accepted_at, because
--                     the function does not return that column.
--   its own gate      the same has_perm the link trigger and 0004 use, so
--                     one key governs both reading the picker and writing
--                     the link. Everyone else gets zero rows, not an error.
--
-- This is the bounded shape 0023's lesson calls for: security_definer is
-- dangerous when it hands a whole table to every caller; it is the right
-- tool when it hands three columns to one key.

create or replace function public.account_directory()
returns table (id uuid, email text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name
  from public.profiles p
  where public.is_owner() or public.has_perm('IT: Identity & Access')
  order by p.email;
$$;

comment on function public.account_directory() is
  'id, email, full_name of every login, for IT > Identity & Access to link accounts. Gated on that key; deliberately excludes consent columns.';

revoke all on function public.account_directory() from public, anon;
grant execute on function public.account_directory() to authenticated;

-- Prove the gate: as authenticated with no JWT, has_perm and is_owner are
-- both false, so the function must return nothing. And the base table's
-- policy set must be unchanged — this migration adds no policy to it.
do $$
declare
  n_fn  int;
  n_pol int;
begin
  set local role authenticated;
  select count(*) into n_fn from public.account_directory();
  reset role;
  if n_fn > 0 then
    raise exception 'TCK-0009 NOT safe: roleless authenticated got % rows from account_directory()', n_fn;
  end if;

  select count(*) into n_pol from pg_policy p
  join pg_class c on c.oid = p.polrelid
  where c.relname = 'profiles' and p.polcmd = 'r';
  raise notice 'TCK-0009: account_directory() returns 0 rows to a roleless caller; profiles keeps its % SELECT policy/policies unchanged.', n_pol;
end
$$;

-- ============================================================
-- Move the tickets to FIXED. Not verified — that requires observing the
-- behaviour from outside, which happens after this runs and is recorded
-- by 0028.
-- ============================================================

update public.tickets set status = 'fixed',
  fix_migration = '0027', fixed_at = now()
  where ref = 'TCK-0008' and status = 'open';

update public.tickets set status = 'fixed',
  fix_migration = '0027', fixed_at = now()
  where ref = 'TCK-0009' and status = 'open';

insert into public.ticket_links (ticket_id, kind, ref, note)
select t.id, v.kind, v.ref, v.note
from (values
  ('TCK-0008', 'migration', '0027', 'the fix — SELECT scoped to company/ for the Contracts key'),
  ('TCK-0008', 'migration', '0014', 'established the company/ path convention for writes'),
  ('TCK-0009', 'migration', '0027', 'the fix — account_directory() function, gated on the IA key'),
  ('TCK-0009', 'file', 'app/(app)/it/identity-access/page.tsx', 'now reads account_directory()'),
  ('TCK-0009', 'file', 'app/(app)/it/identity-access/team-panel.tsx', 'picker guards against a value not in the list')
) as v(ref_, kind, ref, note)
join public.tickets t on t.ref = v.ref_
on conflict (ticket_id, kind, ref) do nothing;

do $$
declare n int;
begin
  select count(*) into n from public.tickets
  where ref in ('TCK-0008', 'TCK-0009') and status = 'fixed';
  if n <> 2 then
    raise exception '0027: expected TCK-0008 and TCK-0009 to be fixed, found % — already moved, or refs differ', n;
  end if;
  raise notice '0027: TCK-0008 and TCK-0009 are fixed. Not yet verified — that needs an external observation.';
end
$$;
