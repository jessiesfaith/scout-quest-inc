-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0017
-- Finance: a real receivables and payables ledger behind the shell.
--
-- SCOPE, STATED PLAINLY. This is an invoice register, not an accounting
-- system. It answers: who owes us, what do we owe, what is overdue, and
-- what has been paid. It does NOT do double-entry, a chart of accounts,
-- tax, multi-currency, or revenue recognition — and it should not grow
-- into them here. When those are needed, they belong in accounting
-- software that this OS reads from, not in a table someone added on a
-- Tuesday.
--
-- The Constitution's counterweight principle argues against building
-- finance machinery before money moves. Built anyway, on request, kept to
-- the smallest shape that is genuinely useful and hard to misread.
--
-- The one invariant worth stating: an invoice's OUTSTANDING BALANCE is
-- never stored. It is computed as amount - sum(payments) by the
-- invoice_balances view, so there is no second copy of it to fall out of
-- date. `status` is a stored summary of that same arithmetic, kept in
-- step by triggers on both tables — a cache, not a second source of
-- truth, and if the two ever disagree the balance is the one to believe.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003.
-- ============================================================

-- ---------- Invoices, both directions ----------
-- One table, not two. An invoice we send and a bill we receive differ by
-- a single field — which way the money goes — and splitting them would
-- duplicate every column, every policy and every screen in order to
-- express that one bit.

create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null,               -- receivable | payable
  reference     text,                        -- our number, or theirs
  counterparty  text not null,
  -- Ties a line of revenue to what produced it. Optional: overheads and
  -- vendor bills belong to the company, not a product.
  product_id    uuid references public.products (id) on delete set null,
  -- The agreement it bills against, when there is one. RESTRICT, matching
  -- the reasoning in 0003: a cascade would run as the system and bypass
  -- RLS, and silently destroying financial records is not something a
  -- contract deletion should be able to do.
  contract_id   uuid references public.contracts (id) on delete restrict,
  description   text,
  -- Money is numeric, never float. A cent lost to binary rounding is a
  -- reconciliation someone spends an afternoon on.
  amount        numeric(14,2) not null,
  currency      text not null default 'USD',
  issued_on     date not null default current_date,
  due_on        date,
  status        text not null default 'draft',
  -- draft | sent | part-paid | paid | void
  -- A person sets draft, sent and void. part-paid and paid are computed
  -- from the payment rows by the triggers below and are not chosen by
  -- hand — a status that can disagree with the money is a status nobody
  -- can trust.
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
                default auth.uid()
);

alter table public.invoices
  drop constraint if exists invoices_direction_check;
alter table public.invoices
  add constraint invoices_direction_check
  check (direction in ('receivable','payable'));

alter table public.invoices
  drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft','sent','part-paid','paid','void'));

-- A negative invoice is a credit note, which this register does not model.
-- Refusing it is better than rendering a total that quietly nets off.
alter table public.invoices
  drop constraint if exists invoices_amount_check;
alter table public.invoices
  add constraint invoices_amount_check check (amount > 0);

alter table public.invoices
  drop constraint if exists invoices_due_check;
alter table public.invoices
  add constraint invoices_due_check
  check (due_on is null or due_on >= issued_on);

create index if not exists invoices_direction_status_idx
  on public.invoices (direction, status);
create index if not exists invoices_due_idx
  on public.invoices (due_on)
  where status in ('sent','part-paid');

-- ---------- Payments ----------
-- Several against one invoice, because part payment is normal and
-- overwriting an "amount paid" field loses the history of how it got
-- there.

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  amount      numeric(14,2) not null,
  paid_on     date not null default current_date,
  method      text,                            -- transfer | card | cheque | other
  reference   text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
              default auth.uid()
);

-- Cascade here is deliberate and is the opposite call to contracts: a
-- payment has no meaning without its invoice, and leaving orphans behind
-- would make every total wrong. Deleting the invoice is itself gated by
-- RLS, so the cascade cannot be reached by someone who could not already
-- delete both.

alter table public.payments
  drop constraint if exists payments_amount_check;
alter table public.payments
  add constraint payments_amount_check check (amount > 0);

create index if not exists payments_invoice_idx on public.payments (invoice_id);

-- ---------- Status follows the money ----------
-- Recomputed from the payment rows in the database, so it holds however
-- the rows were written — through the screen, through the REST API, or by
-- hand in the SQL editor.
--
-- It has to fire on BOTH tables. A trigger on payments alone leaves
-- status stale whenever the invoice's own amount changes: raise a paid
-- $100 invoice to $150 and it keeps saying "paid" against a $50 balance,
-- which is exactly the disagreement between status and payments that
-- deriving the balance was meant to make impossible.
--
-- draft and void are left alone: an unsent invoice that receives a
-- payment is a mistake worth seeing rather than papering over, and a
-- voided one stays voided until somebody deliberately un-voids it.

create or replace function public.recalc_invoice(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total  numeric(14,2);
  state  text;
  paid   numeric(14,2);
  wanted text;
begin
  select i.amount, i.status into total, state
  from public.invoices i where i.id = target;

  if total is null or state in ('draft','void') then
    return;
  end if;

  select coalesce(sum(p.amount), 0) into paid
  from public.payments p where p.invoice_id = target;

  wanted := case
    when paid >= total then 'paid'
    when paid > 0      then 'part-paid'
    else 'sent'
  end;

  -- Only write when it actually changes. The invoices trigger below fires
  -- on a status change, so an unconditional UPDATE here would re-enter it
  -- once more on every call; this makes the recursion terminate at depth
  -- one instead of relying on it settling by luck.
  if wanted is distinct from state then
    update public.invoices set status = wanted where id = target;
  end if;
end;
$$;

create or replace function public.recalc_invoice_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- NEW is unassigned in a DELETE trigger and OLD in an INSERT trigger,
  -- so the row that exists is chosen by TG_OP rather than by coalescing
  -- across both.
  if tg_op = 'DELETE' then
    perform public.recalc_invoice(old.invoice_id);
    return old;
  end if;

  perform public.recalc_invoice(new.invoice_id);
  -- An UPDATE that moved the payment to a different invoice leaves the
  -- old one stale otherwise.
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.recalc_invoice(old.invoice_id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_recalc_invoice on public.payments;
create trigger payments_recalc_invoice
  after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_from_payment();

create or replace function public.recalc_invoice_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_invoice(new.id);
  return new;
end;
$$;

drop trigger if exists invoices_recalc_status on public.invoices;
create trigger invoices_recalc_status
  after update on public.invoices
  for each row
  when (old.amount is distinct from new.amount
        or old.status is distinct from new.status)
  execute function public.recalc_invoice_from_invoice();

-- ---------- A balance can never go negative ----------
-- invoice_balances.balance is amount - paid, and the screen's tiles SUM
-- that column. One invoice edited down below what has already been paid
-- would therefore net money off every other invoice's total, quietly
-- understating what the company is owed. Refused at the table, because
-- the screen is not the only way to write it.

create or replace function public.invoices_guard_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid numeric(14,2);
begin
  if new.amount >= coalesce(old.amount, 0) then
    return new;   -- raising an amount can never strand a payment
  end if;

  select coalesce(sum(p.amount), 0) into paid
  from public.payments p where p.invoice_id = new.id;

  if new.amount < paid then
    raise exception
      'Cannot reduce this invoice to %: % has already been paid against it. Remove a payment first.',
      new.amount, paid
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_guard_amount on public.invoices;
create trigger invoices_guard_amount
  before update of amount on public.invoices
  for each row execute function public.invoices_guard_amount();

-- ---------- What is outstanding ----------
-- security_invoker so the view runs as the caller and inherits the
-- policies below. Without it a view is a hole straight through RLS.

create or replace view public.invoice_balances
with (security_invoker = on) as
  select
    i.id,
    i.direction,
    i.reference,
    i.counterparty,
    i.product_id,
    i.contract_id,
    i.description,
    i.amount,
    i.currency,
    i.issued_on,
    i.due_on,
    i.status,
    i.notes,
    i.created_at,
    coalesce(p.paid, 0)            as paid,
    i.amount - coalesce(p.paid, 0) as balance,
    (
      i.status in ('sent','part-paid')
      and i.due_on is not null
      and i.due_on < current_date
    )                              as overdue
  from public.invoices i
  left join (
    select invoice_id, sum(amount) as paid
    from public.payments
    group by invoice_id
  ) p on p.invoice_id = i.id;

-- ---------- Access ----------
-- The two Finance keys already existed in the role builder and granted
-- nothing, exactly as the bare 'Contracts' key did before 0012. They now
-- mean something, and they are split by direction on purpose: whoever
-- chases customer payments has no reason to be able to create a payable
-- to an arbitrary counterparty, which is the classic route for money to
-- leave a company quietly.

alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists "invoices_select_perm" on public.invoices;
create policy "invoices_select_perm" on public.invoices
  for select to authenticated
  using (
    (direction = 'receivable' and public.has_perm('Finance: AR'))
    or (direction = 'payable' and public.has_perm('Finance: AP'))
  );

drop policy if exists "invoices_write_perm" on public.invoices;
create policy "invoices_write_perm" on public.invoices
  for all to authenticated
  using (
    (direction = 'receivable' and public.has_perm('Finance: AR'))
    or (direction = 'payable' and public.has_perm('Finance: AP'))
  )
  with check (
    (direction = 'receivable' and public.has_perm('Finance: AR'))
    or (direction = 'payable' and public.has_perm('Finance: AP'))
  );

-- Payments inherit their invoice's side. Written as an EXISTS against
-- invoices rather than duplicating the key check, so the two can never
-- drift apart — and note it reads `public.invoices` directly, which means
-- the subquery is itself subject to the policy above.
drop policy if exists "payments_select_perm" on public.payments;
create policy "payments_select_perm" on public.payments
  for select to authenticated
  using (
    exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  );

drop policy if exists "payments_write_perm" on public.payments;
create policy "payments_write_perm" on public.payments
  for all to authenticated
  using (
    exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  )
  with check (
    exists (select 1 from public.invoices i where i.id = payments.invoice_id)
  );
