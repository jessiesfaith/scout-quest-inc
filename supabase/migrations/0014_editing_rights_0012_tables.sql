-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0014
-- Editing rights for the three tables 0012 introduced.
--
-- Departments and Infrastructure already had write policies; what was
-- missing was the screens. Those are code, not SQL. The one thing that
-- genuinely needed the database is Contracts: 0012 deliberately made
-- 'Contracts' a READ-ONLY key so that activating it could not hand its
-- holders DELETE on every employment contract. Now that the company
-- Contracts screen can edit, that key needs write access — but only ever
-- to the company's own agreements, never to a person's.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003, 0006 and 0012.
--
-- ORDERING WARNING: like 0012, this file adds policies that a re-run of
-- 0003, 0006 or 0012 would not restore. Always finish with the highest
-- numbered migration.
-- ============================================================

-- ---------- Contracts: company agreements become editable ----------
-- A separate policy rather than a wider `contracts_write_perm`, because
-- RLS policies OR together: HR keeps unrestricted write through the
-- existing policy, and this one grants 'Contracts' holders a strictly
-- narrower slice. Two invariants are enforced on BOTH sides of the
-- policy, which is what makes them hold:
--
--   category <> 'employment'   a Contracts holder can neither read, edit,
--                              nor create an employment contract, and
--                              (because `with check` applies to the NEW
--                              row) cannot relabel a vendor agreement into
--                              one, or a company agreement out of their
--                              own reach.
--   team_member_id is null     a company agreement belongs to a
--                              counterparty, not a person. Without this a
--                              holder could attach a vendor row to a
--                              named employee, which is how a row that
--                              nobody meant to be personnel data ends up
--                              rendered on HR screens.
--
-- UPDATE checks `using` against the old row and `with check` against the
-- new one, so both directions across the employment boundary are closed.

drop policy if exists "contracts_write_company" on public.contracts;
create policy "contracts_write_company" on public.contracts
  for all to authenticated
  using (
    public.has_perm('Contracts')
    and category <> 'employment'
    and team_member_id is null
  )
  with check (
    public.has_perm('Contracts')
    and category <> 'employment'
    and team_member_id is null
  );

-- Category is now user-supplied through a form rather than typed by hand
-- in SQL, so the set it may hold stops being a comment and becomes a
-- constraint. Existing rows are checked when this runs; if it fails, some
-- row carries a category outside the list and should be corrected first.
alter table public.contracts
  drop constraint if exists contracts_category_check;
alter table public.contracts
  add constraint contracts_category_check
  check (category in ('employment','vendor','district','dpa-baa','partner','other'));

alter table public.contracts
  drop constraint if exists contracts_status_check;
alter table public.contracts
  add constraint contracts_status_check
  check (status in ('pending','complete'));

-- A contract that expires before it takes effect is a data-entry slip, and
-- the expiring-soon counts on the Contracts screen quietly mislead when one
-- is present. Rows where either date is null are unaffected.
alter table public.contracts
  drop constraint if exists contracts_dates_check;
alter table public.contracts
  add constraint contracts_dates_check
  check (effective_on is null or expires_on is null or expires_on >= effective_on);

-- ---------- Contracts storage: a lane for company files ----------
-- 0012's select policy is deliberately coarse — storage has no `category`
-- column to test, so a 'Contracts' holder can read any object in the
-- bucket whose path they can guess. Read access was accepted at that
-- width. WRITE access at that width would be materially worse: it would
-- let a vendor-paperwork holder overwrite or delete the stored file of an
-- employment contract they cannot even see.
--
-- So writes are scoped by path instead. Employment files are stored under
-- `<team_member_id>/…` (a uuid prefix, set by the HR screen); company
-- files go under the literal prefix `company/`. A 'Contracts' holder may
-- write only inside `company/`, which no employment file can occupy —
-- 'company' is not a uuid. HR's existing policies are unchanged and still
-- cover the whole bucket.

drop policy if exists "contracts_objects_insert_company" on storage.objects;
create policy "contracts_objects_insert_company" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and name like 'company/%'
    and public.has_perm('Contracts')
  );

drop policy if exists "contracts_objects_update_company" on storage.objects;
create policy "contracts_objects_update_company" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'contracts'
    and name like 'company/%'
    and public.has_perm('Contracts')
  )
  with check (
    bucket_id = 'contracts'
    and name like 'company/%'
    and public.has_perm('Contracts')
  );

drop policy if exists "contracts_objects_delete_company" on storage.objects;
create policy "contracts_objects_delete_company" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and name like 'company/%'
    and public.has_perm('Contracts')
  );

-- ---------- Departments: deleting one must not orphan people ----------
-- team_members.department_id is `on delete set null`, so deleting an
-- occupied department succeeds silently and quietly empties everyone's
-- department. That is a destructive no-warning outcome triggered by a
-- single button, so it is refused in the database rather than only in the
-- screen — the REST API is reachable without going through the screen.

create or replace function public.departments_block_occupied_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  occupants int;
begin
  select count(*) into occupants
  from public.team_members
  where department_id = old.id;

  if occupants > 0 then
    raise exception
      'Cannot delete department "%": % % still assigned. Move them to another department on HR > Team first.',
      old.name, occupants, case when occupants = 1 then 'person is' else 'people are' end
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists departments_block_occupied_delete on public.departments;
create trigger departments_block_occupied_delete
  before delete on public.departments
  for each row execute function public.departments_block_occupied_delete();

-- ---------- Infrastructure: the vocabularies the forms offer ----------
-- Same reasoning as the contract categories: once a screen writes these,
-- the comment describing the allowed values has to become a constraint or
-- it becomes fiction.

alter table public.infrastructure
  drop constraint if exists infrastructure_kind_check;
alter table public.infrastructure
  add constraint infrastructure_kind_check
  check (kind in ('service','database','hosting','storage','model','integration'));

alter table public.infrastructure
  drop constraint if exists infrastructure_status_check;
alter table public.infrastructure
  add constraint infrastructure_status_check
  check (status in ('live','building','planned','retired'));

alter table public.departments
  drop constraint if exists departments_status_check;
alter table public.departments
  add constraint departments_status_check
  check (status in ('active','forming','reserved'));
