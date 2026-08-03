-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0015
-- Stage 3: the seams that let real activity flow into this OS.
--
-- Three sources, all PUSHED from where they live, never pulled:
--   * the ASL ledger (metering + runner_event, SQLite or Postgres on the
--     governed local plane) → work_orders and agent_spend
--   * config/spend_policy.yaml                                → agents
--   * git history                                              → change_log
--
-- WHY PUSH. The governed plane is local by constitutional rule (§5.1) and
-- this OS runs on Vercel. Vercel cannot reach the ledger, and giving it a
-- route in would be the exact inversion the boundary exists to prevent.
-- A local publisher reads the ledger and posts a metadata-only summary
-- outward. The data flows one way, from the trusted side to the less
-- trusted one.
--
-- WHAT MAY CROSS. Identifiers, counts, costs, statuses and timestamps.
-- Never: step output, run parameters, error detail, prompts, or anything
-- else that carries content. D3 does not enter this database, and the
-- ingest functions below hold that line by only having columns for the
-- things that are allowed — a publisher that sends more is ignored rather
-- than trusted.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003, 0008 and 0010.
-- ============================================================

-- ---------- Where each source got to ----------
-- The publisher is stateless; the cursor lives here so that re-pointing it
-- at a new machine, or running it twice, resumes rather than replays.

create table if not exists public.ingest_state (
  source          text primary key,   -- 'asl-runs' | 'asl-spend' | 'agents' | 'git'
  cursor          text,               -- opaque to this OS: a ledger seq, a commit sha
  last_ingest_at  timestamptz,
  last_count      int not null default 0,
  last_note       text
);

alter table public.ingest_state enable row level security;

drop policy if exists "ingest_state_select_access" on public.ingest_state;
create policy "ingest_state_select_access" on public.ingest_state
  for select to authenticated using (public.has_access());

-- No write policy for `authenticated`, deliberately. The only writer is
-- the ingest route, which holds the service key and bypasses RLS. A
-- signed-in person cannot rewind or forge a cursor through the REST API.

-- ---------- work_orders: where a row came from ----------

alter table public.work_orders
  add column if not exists workflow_id text,
  add column if not exists run_status  text,
  add column if not exists cost_usd    numeric(14,6),
  add column if not exists tokens_in   bigint,
  add column if not exists tokens_out  bigint,
  add column if not exists started_at  timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists source      text not null default 'manual',
  add column if not exists source_ref  text,
  add column if not exists synced_at   timestamptz;

alter table public.work_orders
  drop constraint if exists work_orders_source_check;
alter table public.work_orders
  add constraint work_orders_source_check check (source in ('manual','asl'));

-- The idempotency key. A run id is unique in the ledger, so re-sending the
-- same run updates its row instead of adding a second one.
create unique index if not exists work_orders_source_ref_idx
  on public.work_orders (source_ref)
  where source_ref is not null;

-- Ingested rows are a mirror, not a workspace. Editing one in the app
-- would be silently undone by the next sync, which is worse than being
-- unable to edit it at all — so the write policy now stops at rows this
-- OS owns. (Replaces the 0003 policy; re-running 0003 reverts this.)
drop policy if exists "wo_write_perm" on public.work_orders;
create policy "wo_write_perm" on public.work_orders
  for all to authenticated
  using (public.has_perm('IT: Agent Platform') and source = 'manual')
  with check (public.has_perm('IT: Agent Platform') and source = 'manual');

-- ---------- agent_spend: the metering ledger, mirrored ----------
-- Named agent_spend, not spend: Finance will want that word for money the
-- company owes and is owed. This is model spend, and it is a MIRROR — the
-- authoritative, hash-chained ledger stays on the governed plane. Nothing
-- here is evidence; it is a view for people who cannot open that database.
--
-- Rows are signed events, not balances (RESERVE +estimate, ADJUST +delta,
-- RELEASE -estimate), exactly as the ledger stores them. Summing is the
-- only correct way to read it; taking the last row would report an
-- estimate as an actual.

create table if not exists public.agent_spend (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null unique,  -- the ledger's own id: idempotency
  seq          bigint not null,       -- ledger position, for cursoring
  ts           timestamptz not null,
  agent_id     text,
  workflow_id  text,
  model        text,
  kind         text not null,         -- RESERVE | ADJUST | RELEASE
  tokens_in    bigint not null default 0,
  tokens_out   bigint not null default 0,
  cost_usd     numeric(14,8) not null default 0,
  product      text,
  environment  text,
  ingested_at  timestamptz not null default now()
);

-- Deliberately absent: the ledger's `tenant` and `feature` columns. Tenant
-- can identify a school or a cohort, which is exactly the kind of context
-- that turns aggregate spend into something about people. Cost per agent
-- and per workflow answers the questions this OS needs to answer.

create index if not exists agent_spend_seq_idx on public.agent_spend (seq);
create index if not exists agent_spend_agent_idx on public.agent_spend (agent_id, ts);

alter table public.agent_spend enable row level security;

drop policy if exists "agent_spend_select_access" on public.agent_spend;
create policy "agent_spend_select_access" on public.agent_spend
  for select to authenticated using (public.has_access());

-- No write policy for `authenticated`: a mirror nobody can edit is the
-- only kind worth showing next to a tamper-evident original.

-- ---------- agents: the registry, mirrored from spend_policy.yaml ----------

alter table public.agents
  add column if not exists registry         text,
  add column if not exists owner            text,
  add column if not exists enabled          boolean,
  add column if not exists per_run_cap_usd  numeric(12,4),
  add column if not exists monthly_cap_usd  numeric(12,4),
  add column if not exists allowed_models   text,
  add column if not exists product          text,
  add column if not exists rollback_version text,
  add column if not exists source           text not null default 'manual',
  add column if not exists synced_at        timestamptz;

alter table public.agents
  drop constraint if exists agents_source_check;
alter table public.agents
  add constraint agents_source_check check (source in ('manual','spend-policy'));

drop policy if exists "agents_write_perm" on public.agents;
create policy "agents_write_perm" on public.agents
  for all to authenticated
  using (public.has_perm('IT: Agent Platform') and source = 'manual')
  with check (public.has_perm('IT: Agent Platform') and source = 'manual');

-- ---------- change_log: entries generated from git ----------
-- created_at stays forced by the 0008 trigger — it means "when this
-- entered the log" and must not become forgeable just because a new
-- writer exists. The commit's own date goes in authored_at, the same
-- split security_reports already makes between ran_at and filed_at.

alter table public.change_log
  add column if not exists source      text not null default 'manual',
  add column if not exists source_ref  text,
  add column if not exists authored_at timestamptz;

alter table public.change_log
  drop constraint if exists change_log_source_check;
alter table public.change_log
  add constraint change_log_source_check check (source in ('manual','git'));

create unique index if not exists change_log_source_ref_idx
  on public.change_log (source_ref)
  where source_ref is not null;

-- Provenance is stamped, not accepted. Three new columns arrived on an
-- append-only table whose whole value is that its entries cannot be
-- forged, and nothing yet stopped a signed-in person with the Change Log
-- key from inserting source='git' with a made-up commit sha. Two things
-- would go wrong: an entry would falsely read as generated from history,
-- and — because source_ref is uniquely indexed — squatting a real sha
-- would make the git sync silently skip that commit forever.
--
-- The rule is the same one 0008 applies to the clock and the author: if
-- there is a signed-in caller, the values are overwritten rather than
-- trusted. auth.uid() is null only for the ingest path, which reaches
-- this table exclusively through ingest_change_log().
--
-- ORDERING: this REPLACES stamp_change_log() from 0008. Re-running 0008
-- after this file reverts it — re-run 0015 afterwards.

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

  if auth.uid() is not null then
    new.source := 'manual';
    new.source_ref := null;
    new.authored_at := null;
  end if;

  return new;
end;
$$;

-- ---------- The ingest surface ----------
-- The route holds the service key, which bypasses RLS on everything. That
-- is a large capability to hand a single HTTP handler, so the handler does
-- not use it directly: every write goes through one of the three functions
-- below, and they are the only things it calls. Each accepts one shape,
-- writes one table, and ignores any key it was not expecting.
--
-- EXECUTE is granted to service_role alone. The publishable key that the
-- browser holds carries the `anon` role and cannot reach these at all —
-- worth stating because the usual mistake with security definer functions
-- is leaving them callable by the public.
--
-- What this does NOT defend against: a leaked service key, which can
-- write any table directly and does not need these functions. The
-- functions narrow what the ingest ROUTE can do if the route is tricked;
-- protecting the key itself is Vercel's environment and nothing else.

create or replace function public.ingest_work_orders(payload jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'ingest_work_orders expects a JSON array';
  end if;

  insert into public.work_orders (
    wo_code, workflow_id, agent, title, status, run_status,
    cost_usd, tokens_in, tokens_out, started_at, finished_at,
    product_id, source, source_ref, synced_at
  )
  select
    r->>'wo_code',
    r->>'workflow_id',
    r->>'agent',
    coalesce(nullif(r->>'title', ''), r->>'wo_code', 'Work order'),
    coalesce(nullif(r->>'status', ''), 'open'),
    r->>'run_status',
    nullif(r->>'cost_usd', '')::numeric,
    nullif(r->>'tokens_in', '')::bigint,
    nullif(r->>'tokens_out', '')::bigint,
    nullif(r->>'started_at', '')::timestamptz,
    nullif(r->>'finished_at', '')::timestamptz,
    -- Attribution by product key, resolved here so the publisher never
    -- needs to know this database's uuids.
    (select p.id from public.products p where p.key = r->>'product'),
    'asl',
    r->>'source_ref',
    now()
  from jsonb_array_elements(payload) as r
  where coalesce(r->>'source_ref', '') <> ''
  on conflict (source_ref) where source_ref is not null
  do update set
    workflow_id = excluded.workflow_id,
    agent       = excluded.agent,
    title       = excluded.title,
    status      = excluded.status,
    run_status  = excluded.run_status,
    cost_usd    = excluded.cost_usd,
    tokens_in   = excluded.tokens_in,
    tokens_out  = excluded.tokens_out,
    started_at  = excluded.started_at,
    finished_at = excluded.finished_at,
    product_id  = excluded.product_id,
    -- Claim the row for the ledger. Without this, a hand-entered row whose
    -- source_ref happened to match a run id would keep source='manual' and
    -- stay editable through wo_write_perm while displaying ledger figures.
    source      = 'asl',
    synced_at   = now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.ingest_agent_spend(payload jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'ingest_agent_spend expects a JSON array';
  end if;

  -- do nothing, not do update: the source ledger is append-only and its
  -- rows are hash-chained. A replayed event must land identically or not
  -- at all; an UPDATE path here would be a way to rewrite mirrored history.
  insert into public.agent_spend (
    event_id, seq, ts, agent_id, workflow_id, model, kind,
    tokens_in, tokens_out, cost_usd, product, environment
  )
  select
    r->>'event_id',
    (r->>'seq')::bigint,
    (r->>'ts')::timestamptz,
    r->>'agent_id',
    r->>'workflow_id',
    r->>'model',
    upper(coalesce(r->>'kind', 'ADJUST')),
    coalesce(nullif(r->>'tokens_in', '')::bigint, 0),
    coalesce(nullif(r->>'tokens_out', '')::bigint, 0),
    coalesce(nullif(r->>'cost_usd', '')::numeric, 0),
    r->>'product',
    r->>'environment'
  from jsonb_array_elements(payload) as r
  where coalesce(r->>'event_id', '') <> ''
    and coalesce(r->>'seq', '') <> ''
    and coalesce(r->>'ts', '') <> ''
  on conflict (event_id) do nothing;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.ingest_agents(payload jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'ingest_agents expects a JSON array';
  end if;

  insert into public.agents (
    agent_id, role, data_classes, status, registry, owner, enabled,
    per_run_cap_usd, monthly_cap_usd, allowed_models, product,
    rollback_version, product_id, source, synced_at
  )
  select
    r->>'agent_id',
    r->>'role',
    r->>'data_classes',
    -- The policy's kill switch is the truth about whether an agent runs.
    case when coalesce((r->>'enabled')::boolean, true)
         then 'active' else 'disabled' end,
    r->>'registry',
    r->>'owner',
    coalesce((r->>'enabled')::boolean, true),
    nullif(r->>'per_run_cap_usd', '')::numeric,
    nullif(r->>'monthly_cap_usd', '')::numeric,
    r->>'allowed_models',
    r->>'product',
    r->>'rollback_version',
    (select p.id from public.products p where p.key = r->>'product'),
    'spend-policy',
    now()
  from jsonb_array_elements(payload) as r
  where coalesce(r->>'agent_id', '') <> ''
  on conflict (agent_id) do update set
    role             = excluded.role,
    data_classes     = excluded.data_classes,
    status           = excluded.status,
    registry         = excluded.registry,
    owner            = excluded.owner,
    enabled          = excluded.enabled,
    per_run_cap_usd  = excluded.per_run_cap_usd,
    monthly_cap_usd  = excluded.monthly_cap_usd,
    allowed_models   = excluded.allowed_models,
    product          = excluded.product,
    rollback_version = excluded.rollback_version,
    product_id       = excluded.product_id,
    source           = 'spend-policy',
    synced_at        = now();

  get diagnostics affected = row_count;

  -- The publisher sends the WHOLE registry every time, so an agent absent
  -- from the payload has been removed from spend_policy.yaml. An upsert
  -- alone would leave it on the screen looking live forever.
  --
  -- Retired, not deleted: the row is referenced by nothing, but it is the
  -- only record that the agent ever existed, and a spend history with a
  -- dangling agent_id is worse than a row marked retired. Only
  -- policy-sourced rows are touched — anything entered by hand is not
  -- this function's to retire.
  update public.agents a
  set enabled = false,
      status  = 'retired',
      synced_at = now()
  where a.source = 'spend-policy'
    and a.status <> 'retired'
    and not exists (
      select 1
      from jsonb_array_elements(payload) as r
      where r->>'agent_id' = a.agent_id
    );

  return affected;
end;
$$;

create or replace function public.ingest_change_log(payload jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'ingest_change_log expects a JSON array';
  end if;

  -- do nothing: the change log is append-only for everyone including this
  -- path. Re-running the git sync must never rewrite an entry already
  -- filed. created_at is still stamped by the 0008 trigger.
  insert into public.change_log (
    product, module, tab, change_type, description,
    created_by_email, source, source_ref, authored_at
  )
  select
    coalesce(nullif(r->>'product', ''), 'company'),
    r->>'module',
    r->>'tab',
    coalesce(nullif(r->>'change_type', ''), 'update'),
    r->>'description',
    -- Attribution as text, and honest about being a commit author rather
    -- than a signed-in person.
    nullif(r->>'author', ''),
    'git',
    r->>'source_ref',
    nullif(r->>'authored_at', '')::timestamptz
  from jsonb_array_elements(payload) as r
  where coalesce(r->>'source_ref', '') <> ''
    and coalesce(r->>'description', '') <> ''
  on conflict (source_ref) where source_ref is not null
  do nothing;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.ingest_mark(
  p_source text,
  p_cursor text,
  p_count  int,
  p_note   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ingest_state (source, cursor, last_ingest_at, last_count, last_note)
  values (p_source, p_cursor, now(), coalesce(p_count, 0), p_note)
  on conflict (source) do update set
    cursor         = excluded.cursor,
    last_ingest_at = now(),
    last_count     = excluded.last_count,
    last_note      = excluded.last_note;
end;
$$;

-- Only the service role. Not anon (the key the browser holds), and not
-- authenticated (any signed-in person) — either would turn these into a
-- way to write tables the caller has no permission for.
revoke all on function public.ingest_work_orders(jsonb) from public, anon, authenticated;
revoke all on function public.ingest_agent_spend(jsonb) from public, anon, authenticated;
revoke all on function public.ingest_agents(jsonb)      from public, anon, authenticated;
revoke all on function public.ingest_change_log(jsonb)  from public, anon, authenticated;
revoke all on function public.ingest_mark(text, text, int, text) from public, anon, authenticated;

grant execute on function public.ingest_work_orders(jsonb) to service_role;
grant execute on function public.ingest_agent_spend(jsonb) to service_role;
grant execute on function public.ingest_agents(jsonb)      to service_role;
grant execute on function public.ingest_change_log(jsonb)  to service_role;
grant execute on function public.ingest_mark(text, text, int, text) to service_role;

-- ---------- Reading the mirror ----------
-- PostgREST cannot GROUP BY, so the two questions anyone actually asks of
-- a spend ledger get views. Both are `security_invoker`, which makes them
-- run as the caller and inherit agent_spend's RLS — without it a view is
-- a hole straight through row-level security, because a view runs as its
-- owner by default.

create or replace view public.agent_spend_summary
with (security_invoker = on) as
  select
    agent_id,
    product,
    -- RESERVE + ADJUST - RELEASE. Summing signed rows is the only correct
    -- reading; the ledger never updates a balance in place.
    sum(cost_usd)                      as cost_usd,
    sum(tokens_in)                     as tokens_in,
    sum(tokens_out)                    as tokens_out,
    count(*) filter (where kind = 'RESERVE') as reservations,
    min(ts)                            as first_seen,
    max(ts)                            as last_seen
  from public.agent_spend
  group by agent_id, product;

create or replace view public.agent_spend_monthly
with (security_invoker = on) as
  select
    date_trunc('month', ts)::date as month,
    agent_id,
    sum(cost_usd)                 as cost_usd
  from public.agent_spend
  group by 1, 2;

-- ---------- Seed the cursors so the screen has something to say ----------

insert into public.ingest_state (source, last_note) values
  ('asl-runs',  'never run'),
  ('asl-spend', 'never run'),
  ('agents',    'never run'),
  ('git',       'never run')
on conflict (source) do nothing;
