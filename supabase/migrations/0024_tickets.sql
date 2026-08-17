-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0024
-- Tickets: the defect record, and the trace from a defect back through
-- the agent, the work order, the context pack and the Constitution
-- clause that governed it.
--
-- WHY. The OS could show findings that were ALREADY fixed, as prose
-- inside a jsonb blob on a review. Nothing could answer "what is open",
-- "how do we know it is actually fixed", or "what did we look at and
-- decide was not a problem". A live data leak shipped on 2026-08-16 and
-- had no home in this system at all.
--
-- THE RULE THIS SCHEMA ENFORCES. "Fixed" and "verified" are different
-- states and the database will not let them blur. 0023 is the reason:
-- it carried a self-check that could never run, printed a reassuring
-- notice either way, and the fix was only ever confirmed by probing the
-- live endpoint from outside. A status field that can be set to done on
-- the author's say-so reproduces exactly that failure, so:
--   * 'fixed'         requires a commit or a migration to point at
--   * 'verified'      requires evidence of what was actually observed
--   * 'accepted-risk' requires a reason
-- enforced as CHECK constraints, not as UI validation, because the UI is
-- not the gate.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003 and 0007.
-- ============================================================

-- ---------- The ticket ----------

create table if not exists public.tickets (
  id                uuid primary key default gen_random_uuid(),
  ref               text unique not null,          -- TCK-0001
  title             text not null,
  detail            text,

  -- What kind of wrong it is. Defined in
  -- docs/governance/WORK_ORDERS_VS_TICKETS.md, which also states the
  -- tiebreak: 'incident' beats everything, because if it was live in
  -- production the exposure window is the thing you need to know.
  --
  -- 'honesty' is its own type rather than a flavour of break-fix because
  -- this system has a recurring failure where a query the viewer may not
  -- run returns empty and the screen renders that as fact. The code does
  -- exactly what it was written to do; only the claim is wrong.
  type              text not null default 'break-fix'
    check (type in ('incident', 'security', 'break-fix', 'honesty',
                    'maintenance', 'governance-drift', 'docs')),

  severity          text not null default 'medium'
    check (severity in ('high', 'medium', 'low')),

  -- 'unverified' is first class: a lead nobody has confirmed or refuted
  -- is not the same as no problem, and it must not decay into one.
  status            text not null default 'open'
    check (status in ('open', 'in-progress', 'fixed', 'verified',
                      'rejected', 'accepted-risk', 'unverified')),

  source            text,                          -- review | incident | manual
  report_source_key text,                          -- security_reports.source_key
  found_at          timestamptz not null default now(),
  found_by          text,

  fix_commit        text,
  fix_migration     text,
  fixed_at          timestamptz,

  verified_at       timestamptz,
  verified_by       text,
  verified_how      text,                          -- what was OBSERVED, not claimed

  accepted_reason   text,

  -- Demo rows exercise the flow before the real records exist. They are
  -- badged on screen and removable in one statement, so moving the real
  -- documents in later is a data change and never a code change.
  is_demo           boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Completion needs evidence, at the database, or it is just a word.
  constraint tickets_fixed_needs_a_change check (
    status not in ('fixed', 'verified')
    or fix_commit is not null or fix_migration is not null
  ),
  constraint tickets_verified_needs_evidence check (
    status <> 'verified'
    or (verified_how is not null and verified_at is not null)
  ),
  constraint tickets_accepted_needs_a_reason check (
    status <> 'accepted-risk' or accepted_reason is not null
  )
);

create index if not exists tickets_status_idx   on public.tickets (status);
create index if not exists tickets_severity_idx on public.tickets (severity);
create index if not exists tickets_demo_idx     on public.tickets (is_demo);

-- ---------- Ticket references ----------
-- Everything worth tracing to is identified by TEXT in this system: a
-- Constitution clause is '3.5', a context pack 'CTX-003', an agent
-- 'eval-adversarial', a work order 'WO-COMPANY-0001'. None share a key
-- type, so the link is polymorphic by design rather than by laziness.
-- The reference is deliberately NOT a foreign key: a ticket may name a
-- Constitution section that lives in a markdown file, or a commit that
-- this database has never heard of.

create table if not exists public.ticket_links (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  kind       text not null
    check (kind in ('constitution', 'ctx', 'agent', 'work_order',
                    'report', 'migration', 'commit', 'file')),
  ref        text not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (ticket_id, kind, ref)
);

create index if not exists ticket_links_kind_ref_idx on public.ticket_links (kind, ref);

-- ---------- Status history ----------
-- Append-only. A board whose history can be revised cannot answer "when
-- did we know", which is the only question an audit actually asks.

create table if not exists public.ticket_events (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  actor_email text,
  created_at  timestamptz not null default now()
);

create index if not exists ticket_events_ticket_idx
  on public.ticket_events (ticket_id, created_at desc);

-- ---------- Reference numbering ----------

create sequence if not exists public.ticket_ref_seq;

create or replace function public.assign_ticket_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ref is null or new.ref = '' then
    new.ref := 'TCK-' || lpad(nextval('public.ticket_ref_seq')::text, 4, '0');
  end if;
  -- Always overwrite rather than testing for null. A column with a
  -- DEFAULT is filled by the rewriter before any BEFORE trigger sees it,
  -- so `if new.created_at is null` never fires — the bug 0021's
  -- stamp_context_version shipped. Assign unconditionally instead.
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tickets_assign_ref on public.tickets;
create trigger tickets_assign_ref
  before insert on public.tickets
  for each row execute function public.assign_ticket_ref();

create or replace function public.touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();          -- unconditional, per the note above
  new.ref        := old.ref;        -- a reference that can change is not one
  new.found_at   := old.found_at;
  if new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, from_status, to_status, actor_email)
    values (old.id, old.status, new.status,
            (select u.email from auth.users u where u.id = auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch
  before update on public.tickets
  for each row execute function public.touch_ticket();

-- ---------- Row-level security ----------

alter table public.tickets       enable row level security;
alter table public.ticket_links  enable row level security;
alter table public.ticket_events enable row level security;

drop policy if exists "tickets_select_access" on public.tickets;
create policy "tickets_select_access" on public.tickets
  for select to authenticated using (public.has_access());

drop policy if exists "tickets_write_perm" on public.tickets;
create policy "tickets_write_perm" on public.tickets
  for all to authenticated
  using (public.has_perm('Security Tooling: Change Management'))
  with check (public.has_perm('Security Tooling: Change Management'));

drop policy if exists "ticket_links_select_access" on public.ticket_links;
create policy "ticket_links_select_access" on public.ticket_links
  for select to authenticated using (public.has_access());

drop policy if exists "ticket_links_write_perm" on public.ticket_links;
create policy "ticket_links_write_perm" on public.ticket_links
  for all to authenticated
  using (public.has_perm('Security Tooling: Change Management'))
  with check (public.has_perm('Security Tooling: Change Management'));

drop policy if exists "ticket_events_select_access" on public.ticket_events;
create policy "ticket_events_select_access" on public.ticket_events
  for select to authenticated using (public.has_access());

-- ticket_events gets no insert, update or delete policy. The trigger
-- writes it as SECURITY DEFINER; nobody writes it by hand, and nobody
-- edits it afterwards — including the owner.

-- ---------- The trace ----------
-- security_invoker = on. Without it a view runs with its OWNER's rights
-- and ignores RLS on everything it reads — which is precisely how
-- context_page_agents leaked 88 rows to anonymous callers and had to be
-- fixed in 0023. Every view in this schema carries this option.

create or replace view public.ticket_trace
with (security_invoker = on) as
select
  t.ref,
  t.title,
  t.type,
  t.severity,
  t.status,
  t.is_demo,
  l.kind,
  l.ref  as linked_ref,
  l.note as link_note
from public.tickets t
left join public.ticket_links l on l.ticket_id = t.id;

comment on view public.ticket_trace is
  'One row per (ticket, linked thing). The chain a reviewer walks: Constitution clause -> context pack -> agent -> work order -> ticket.';
