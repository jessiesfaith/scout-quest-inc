-- 0018 — The governed agent library, the control gates, and the work-order
-- lifecycle that runs against them.
--
-- Change class: 2 (schema change + new surfaces inside an existing module).
-- No new permission key: everything here is gated by 'IT: Agent Platform',
-- which already exists in lib/permission-keys.ts and in the 0003 policies.
-- No D3. No new secret. No external network.
--
-- WHAT THIS DOES, AND THE ONE THING IT IS CAREFUL ABOUT
--
-- `agents` is ingest-owned. 0015 gave it source in ('manual','spend-policy'),
-- and ingest_agents() upserts on agent_id then retires anything absent from
-- the payload. Its comment is explicit that the retire sweep only touches
-- policy-sourced rows because "anything entered by hand is not this
-- function's to retire." That is the seam this migration uses.
--
-- Library rows get source = 'library'. The retire sweep already spares them.
-- What it did NOT spare is a collision: `on conflict (agent_id) do update`
-- sets source = 'spend-policy' unconditionally, so an agent_id present in
-- BOTH registries would have its governance columns silently emptied and its
-- provenance rewritten on the next sync. asl-gateway was not readable when
-- the library was written, so that collision cannot be ruled out by
-- inspection. Section 6 replaces ingest_agents() to make the two registries
-- reconcile instead of fight.
--
-- ORDERING: run after 0017. Later files tighten earlier ones (HANDOFF §3.1).
-- In the Supabase SQL Editor use the ORANGE "Run without RLS" (HANDOFF §4.3).

-- =====================================================================
-- 1. agents: admit a third provenance, and carry governance
-- =====================================================================

alter table public.agents
  drop constraint if exists agents_source_check;
alter table public.agents
  add constraint agents_source_check
  check (source in ('manual', 'spend-policy', 'library'));

-- Governance columns. These describe the SPEC; the 0015 columns describe the
-- RUN. Keeping them in one table means the Console can show both without a
-- join, and means a spend row can never point at an agent with no spec.
alter table public.agents
  add column if not exists layer          text,
  -- enterprise | department | product
  add column if not exists department     text,
  add column if not exists lifecycle      text,
  -- active | planned | blocked | suspended | retired  (the GOVERNANCE state,
  -- distinct from `status`, which the ingest sets from the policy kill switch)
  add column if not exists risk_ceiling   text,
  -- low | medium | high | critical
  add column if not exists spec_path      text,
  add column if not exists question       text,   -- the one question it answers
  add column if not exists owns_object    text,   -- the one artifact it owns
  add column if not exists consumer       text,   -- §3.8 — who consumes this, this week
  add column if not exists context_pages  text,   -- CTX ids, comma-joined
  add column if not exists output_contract text,  -- CTX-011 contract name
  add column if not exists stop_condition text,
  add column if not exists blocked_reason text,
  add column if not exists iteration_limit int,
  -- The caps the SPEC declares, kept beside the caps the POLICY enforces.
  --
  -- Why both. ingest_agents() lets a spend_policy.yaml sync update the
  -- operational caps of a library agent, because the policy is what the
  -- gateway actually enforces and the screen should show the truth rather
  -- than the aspiration. But that overwrite was silent: the Library tab
  -- computes a declared ceiling from monthly_cap_usd, so a sync could move
  -- that number and leave the screen quietly disagreeing with
  -- agent_registry.yaml. These two columns are seeded from the spec and are
  -- never touched by the ingest, which turns a silent overwrite into a
  -- visible reconciliation item — the one docs/agents/README.md asks for.
  add column if not exists spec_per_run_cap_usd numeric(12,4),
  add column if not exists spec_monthly_cap_usd numeric(12,4);

alter table public.agents
  drop constraint if exists agents_layer_check;
alter table public.agents
  add constraint agents_layer_check
  check (layer is null or layer in ('enterprise', 'department', 'product'));

alter table public.agents
  drop constraint if exists agents_lifecycle_check;
alter table public.agents
  add constraint agents_lifecycle_check
  check (lifecycle is null or lifecycle in
    ('active', 'planned', 'blocked', 'suspended', 'retired'));

alter table public.agents
  drop constraint if exists agents_risk_ceiling_check;
alter table public.agents
  add constraint agents_risk_ceiling_check
  check (risk_ceiling is null or risk_ceiling in
    ('low', 'medium', 'high', 'critical'));

-- 0015's write policy is `has_perm('IT: Agent Platform') and source = 'manual'`.
-- Library rows stay read-only in the UI for the same reason policy rows do:
-- the spec files in docs/agents/ are the source of truth, and an edit here
-- would be overwritten by the next reseed while making the screen disagree
-- with the repo. Editing an agent means editing its spec.
--   (No policy change needed — 'library' <> 'manual' already fails the check.)

-- =====================================================================
-- 2. agent_gates: the deterministic controls
-- =====================================================================
-- Deliberately NOT rows in `agents`. A gate is a rule, not a model: it has no
-- spend, no tokens, no evaluation and no risk ceiling, and the whole
-- architecture turns on that distinction (docs/agents/AGENT_ARCHITECTURE.md
-- §2). Putting them in `agents` would corrupt every count and every cost
-- average on this screen.

create table if not exists public.agent_gates (
  id            uuid primary key default gen_random_uuid(),
  gate_id       text not null unique,
  name          text not null,
  fires_at      text not null,          -- where in the workflow
  checks        text not null,
  on_failure    text not null,
  implemented_as text not null,         -- what makes it deterministic
  owner         text,
  change_class  int not null default 2,
  build_status  text not null default 'specified',
  -- specified | partial | built
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.agent_gates
  drop constraint if exists agent_gates_build_status_check;
alter table public.agent_gates
  add constraint agent_gates_build_status_check
  check (build_status in ('specified', 'partial', 'built'));

alter table public.agent_gates enable row level security;

drop policy if exists "agent_gates_select_access" on public.agent_gates;
create policy "agent_gates_select_access" on public.agent_gates
  for select to authenticated using (public.has_access());

-- NO WRITE POLICY, deliberately. This is a control registry seeded by
-- migration, and `build_status` is the field the Tree tab presents under
-- "read the last column honestly". If a key-holder could set GATE-runtime to
-- 'built', the screen would assert a control that does not exist — the exact
-- overclaim this whole slice is written against. 0015 gave agent_spend and
-- ingest_state no write policy for the same reason: "a mirror nobody can edit
-- is the only kind worth showing next to a tamper-evident original."
-- Changing a gate means editing this migration and re-running it.
drop policy if exists "agent_gates_write_perm" on public.agent_gates;

-- =====================================================================
-- 3. work_orders: the lifecycle columns
-- =====================================================================
-- The table already exists (0003) and is written by the ledger ingest with
-- source = 'asl'. These columns describe a work order run THROUGH THIS
-- SCREEN — the manual rung-2 process the Constitution's cost ladder asks for
-- before anything is automated. Ledger-sourced rows leave them null.

alter table public.work_orders
  add column if not exists risk_tier        text,
  add column if not exists stage            text,
  add column if not exists objective        text,
  add column if not exists audience         text,
  add column if not exists channel          text,
  add column if not exists data_classes     text,
  add column if not exists change_class     text,
  add column if not exists budget_ceiling_usd numeric(12,4),
  add column if not exists requester_email  text,
  add column if not exists approved_by      text,
  add column if not exists approved_at      timestamptz,
  add column if not exists blocked_reason   text,
  add column if not exists closed_at        timestamptz,
  add column if not exists remediation_rounds int not null default 0;

-- D3 refused by the database, not by TypeScript. HANDOFF §1: "No D3
-- (student/patient) data in this app, ever." A check that lives only in a
-- server action is a check an attacker does not run (§5.3), and the two
-- constraints below already establish that this table validates in SQL.
alter table public.work_orders
  drop constraint if exists work_orders_no_d3;
alter table public.work_orders
  add constraint work_orders_no_d3
  check (data_classes is null or data_classes !~* '(^|[^a-z0-9])d3([^a-z0-9]|$)');

alter table public.work_orders
  drop constraint if exists work_orders_risk_tier_check;
alter table public.work_orders
  add constraint work_orders_risk_tier_check
  check (risk_tier is null or risk_tier in
    ('low', 'medium', 'high', 'critical'));

-- The stages are the orch-enterprise state machine, in order. `blocked` and
-- `closed` are terminal. `blocked` is a SUCCESSFUL terminal state: it means a
-- gate did its job.
alter table public.work_orders
  drop constraint if exists work_orders_stage_check;
alter table public.work_orders
  add constraint work_orders_stage_check
  check (stage is null or stage in (
    'intake', 'scope', 'risk', 'context', 'assign', 'execute',
    'validate', 'evaluate', 'adjudicate', 'remediate', 'approve',
    'release', 'audit', 'outcome', 'closed', 'blocked'));

-- Remediation is bounded at 3 rounds (orch-enterprise). Past that it must go
-- to a human, so the database refuses a fourth rather than trusting the app.
alter table public.work_orders
  drop constraint if exists work_orders_remediation_bound;
alter table public.work_orders
  add constraint work_orders_remediation_bound
  check (remediation_rounds >= 0 and remediation_rounds <= 3);

-- wo_code is an identifier and must behave like one. The generator counts
-- existing rows, so two concurrent opens produce the same code and a deleted
-- row makes the next code collide with a live one. A unique index makes that
-- the database's problem rather than the caller's, which is how
-- agent_spend.event_id and work_orders.source_ref already work.
create unique index if not exists work_orders_wo_code_key
  on public.work_orders (wo_code) where wo_code is not null;

create index if not exists work_orders_stage_idx on public.work_orders (stage);
create index if not exists work_orders_agent_idx on public.work_orders (agent);

-- =====================================================================
-- 4. work_order_events: the activity feed, append-only
-- =====================================================================
-- Every stage transition, gate result, evaluator verdict and approval lands
-- here. This is the §5.4 audit trail for the manual process, and it follows
-- the 0008 pattern exactly: BEFORE INSERT forces the timestamp and the
-- author, and there is NO update or delete policy for anyone, including the
-- owner. An activity feed that can be edited is not evidence.

create table if not exists public.work_order_events (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT, not CASCADE. A cascade runs as the system and never consults
  -- this table's policies, so `delete from work_orders` would silently
  -- destroy an append-only history that no policy allows anyone to delete.
  -- 0003 learned this on contracts.team_member_id: "FK cascades bypass RLS."
  -- The consequence is intended: once a work order has any history, it can no
  -- longer be deleted at all. That is what append-only means.
  work_order_id  uuid not null references public.work_orders(id) on delete restrict,
  seq            bigserial,
  kind           text not null,
  -- stage | gate | verdict | approval | escalation | note | block
  from_stage     text,
  to_stage       text,
  actor          text not null,
  -- orchestrator | gate | worker | evaluator | adjudicator | human
  actor_id       text,          -- agent_id or gate_id or email
  outcome        text,          -- pass | conditional_pass | fail | blocked | proceed | …
  detail         text,
  cost_usd       numeric(12,4),
  tokens_in      int,
  tokens_out     int,
  created_by     uuid references public.profiles(id) on delete set null,
  created_by_email text,
  created_at     timestamptz not null default now()
);

create index if not exists woe_wo_idx on public.work_order_events (work_order_id, seq);

alter table public.work_order_events enable row level security;

-- Stamp the author and the time in the database, so neither can be supplied
-- by a caller. Same idiom as 0008's change_log trigger.
create or replace function public.stamp_work_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.created_by := auth.uid();
  -- auth.uid() is null under the service role; fall back to the profile only
  -- when there IS a session, never to a value the caller handed us.
  if auth.uid() is not null then
    new.created_by_email := (select p.email from public.profiles p where p.id = auth.uid());
  else
    new.created_by_email := coalesce(new.created_by_email, 'system');
  end if;
  return new;
end;
$$;

drop trigger if exists work_order_events_stamp on public.work_order_events;
create trigger work_order_events_stamp
  before insert on public.work_order_events
  for each row execute function public.stamp_work_order_event();

drop policy if exists "woe_select_access" on public.work_order_events;
create policy "woe_select_access" on public.work_order_events
  for select to authenticated using (public.has_access());

-- The trigger forces the clock and the author, but a caller could still
-- supply `seq` (bigserial has a default, not a guard) and pin a forged row to
-- the top of any window ordered by it. Column privileges close that: the
-- sequence and the three stamped columns cannot be named in an INSERT at all.
revoke insert (seq, created_by, created_by_email, created_at)
  on public.work_order_events from authenticated, anon;

drop policy if exists "woe_insert_perm" on public.work_order_events;
create policy "woe_insert_perm" on public.work_order_events
  for insert to authenticated
  with check (public.has_perm('IT: Agent Platform'));

-- No update policy. No delete policy. Not for the owner either. This is
-- deliberate and matches change_log and security_reports (0008).

-- =====================================================================
-- 5. advance_work_order: the transition, enforced in SQL
-- =====================================================================
-- A check in a server action is not enforcement (HANDOFF §5.3). PostgREST
-- exposes every function granted to `authenticated`, so the permission check
-- and the legality of the transition both live INSIDE the function body, and
-- EXECUTE is granted to `authenticated` only because a signed-in human is
-- the intended caller — with has_perm() checked here, not upstream.

create or replace function public.advance_work_order(
  p_work_order uuid,
  p_to_stage   text,
  p_actor      text,
  p_actor_id   text default null,
  p_outcome    text default null,
  p_detail     text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from      text;
  v_tier      text;
  v_rounds    int;
  v_allowed   text[];
  v_approved  timestamptz;
begin
  if not public.has_perm('IT: Agent Platform') then
    raise exception 'IT: Agent Platform permission required';
  end if;

  select stage, risk_tier, remediation_rounds, approved_at
    into v_from, v_tier, v_rounds, v_approved
  from public.work_orders
  where id = p_work_order
  for update;

  if not found then
    raise exception 'work order not found';
  end if;

  if v_from in ('closed', 'blocked') then
    raise exception 'work order is terminal (%) and cannot be advanced', v_from;
  end if;

  -- The legal next steps. No agent and no screen may invent an edge; a stage
  -- not listed here cannot be reached, which is what makes this a state
  -- machine rather than a status field.
  v_allowed := case v_from
    when 'intake'     then array['scope', 'blocked']
    when 'scope'      then array['risk', 'blocked']
    when 'risk'       then array['context', 'blocked']
    when 'context'    then array['assign', 'blocked']
    when 'assign'     then array['execute', 'blocked']
    when 'execute'    then array['validate', 'blocked']
    -- No 'execute' edge back from validate. It looked harmless — a failed
    -- contract check should re-run the worker — but the remediation counter
    -- only increments on 'remediate', so validate→execute was an unbounded
    -- re-execution loop that routed straight around the three-round bound.
    -- A failed GATE-contract goes to remediate like every other defect.
    when 'validate'   then array['evaluate', 'remediate', 'blocked']
    when 'evaluate'   then array['adjudicate', 'blocked']
    -- 'approve' is NOT reachable from here. It is reached by
    -- approve_work_order(), which is the only path that records an approver
    -- and enforces aal2. Advancing to it directly stranded the work order:
    -- approve_work_order then refused ("not at stage adjudicate") and release
    -- refused ("requires a recorded approval"), leaving `blocked` as the only
    -- legal move.
    when 'adjudicate' then array['remediate', 'blocked']
    when 'remediate'  then array['execute', 'blocked']
    when 'approve'    then array['release', 'blocked']
    when 'release'    then array['audit', 'blocked']
    when 'audit'      then array['outcome', 'blocked']
    when 'outcome'    then array['closed', 'blocked']
    else array[]::text[]
  end;

  if not (p_to_stage = any(v_allowed)) then
    raise exception 'illegal transition % -> % (allowed: %)',
      v_from, p_to_stage, array_to_string(v_allowed, ', ');
  end if;

  -- Remediation is bounded. The fourth round is refused here rather than in
  -- the app, because an unbounded remediation loop is how a monthly cap
  -- disappears in an afternoon.
  if p_to_stage = 'remediate' then
    if v_rounds >= 3 then
      raise exception
        'remediation limit reached (3) — this work order needs a human decision, not another round';
    end if;
    update public.work_orders
      set remediation_rounds = remediation_rounds + 1
      where id = p_work_order;
  end if;

  -- Release requires a recorded approval. §5.3(d): nothing reaches an
  -- external party without explicit human approval, and an approval that is
  -- not recorded did not happen.
  if p_to_stage = 'release' and v_approved is null then
    raise exception 'release requires a recorded human approval first';
  end if;

  update public.work_orders
     set stage  = p_to_stage,
         status = case
                    when p_to_stage = 'closed'  then 'closed'
                    when p_to_stage = 'blocked' then 'blocked'
                    else 'open'
                  end,
         closed_at = case when p_to_stage in ('closed', 'blocked')
                          then now() else closed_at end
   where id = p_work_order;

  insert into public.work_order_events
    (work_order_id, kind, from_stage, to_stage, actor, actor_id, outcome, detail)
  values
    (p_work_order, 'stage', v_from, p_to_stage,
     coalesce(p_actor, 'human'), p_actor_id, p_outcome, p_detail);

  return p_to_stage;
end;
$$;

-- Approval is its own function because it is the one action §5.3 reserves
-- for a human, and because the approver's identity must come from the
-- session rather than from an argument. A security definer function that
-- takes a user id as an argument can be aimed at anyone (HANDOFF §5.3).
create or replace function public.approve_work_order(
  p_work_order uuid,
  p_note       text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_tier  text;
  v_stage text;
  v_now   timestamptz := now();
begin
  if not public.has_perm('IT: Agent Platform') then
    raise exception 'IT: Agent Platform permission required';
  end if;

  -- A high-consequence action, so require a 2FA-verified session in the
  -- function body — not in TypeScript. PostgREST exposes every function
  -- granted to `authenticated` at /rest/v1/rpc/<name>, so a check that lives
  -- only in a server action is a check an attacker simply does not run
  -- (HANDOFF §5.3). Default to 'aal1' when the claim is absent: fail closed.
  --
  -- NO OWNER BYPASS, deliberately, and this is a tradeoff worth stating.
  -- §4.2 exempts the owner from 2FA to *reach the app* so she can never be
  -- locked out. Approving a work order is a different act: it is the human
  -- authorisation §5.3 requires before anything reaches an external party,
  -- and 0016 already sets exactly this bar for the far smaller act of
  -- printing recovery codes. An owner escape here would be the same shape as
  -- the bypass the 2FA review caught — a strong check on one path and an
  -- open one beside it.
  --
  -- The cost: Jessica must have an authenticator enrolled to approve. That
  -- does not lock her out of the OS (§4.2 still holds for sign-in), only out
  -- of this one action until she enrols at /mfa.
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception
      'Verify with your authenticator before approving a work order.';
  end if;

  select stage, risk_tier into v_stage, v_tier
  from public.work_orders where id = p_work_order for update;

  if not found then raise exception 'work order not found'; end if;
  if v_stage <> 'adjudicate' then
    raise exception 'approval happens after adjudication, not at stage %', v_stage;
  end if;

  select p.email into v_email from public.profiles p where p.id = auth.uid();

  -- Fail closed. 'owner' is not an identity, and this is the most
  -- governance-critical attribution in the slice — §5.3 requires the
  -- approver to come from the session, so no session means no approval.
  if v_email is null then
    raise exception 'no profile for this session — cannot attribute an approval';
  end if;

  update public.work_orders
     set approved_by = coalesce(v_email, 'owner'),
         approved_at = v_now,
         stage       = 'approve'
   where id = p_work_order;

  insert into public.work_order_events
    (work_order_id, kind, from_stage, to_stage, actor, actor_id, outcome, detail)
  values
    (p_work_order, 'approval', v_stage, 'approve', 'human',
     coalesce(v_email, 'owner'), 'approved', p_note);

  return v_now;
end;
$$;

-- ---------------------------------------------------------------------
-- The other door
-- ---------------------------------------------------------------------
-- Everything above is enforced inside these two functions. That is worth
-- nothing while `work_orders` stays directly writable: 0015's wo_write_perm
-- is `for all`, so a PATCH through PostgREST with the publishable browser key
-- could set stage='release', stamp approved_at with any email, and reopen a
-- closed work order — writing nothing to the event feed. The RPC's own
-- comment invokes HANDOFF §5.3; this is what makes it true.
--
-- Column privileges rather than a trigger: PostgREST refuses an UPDATE naming
-- a column the role cannot write, the rule is declarative and visible in
-- information_schema, and a SECURITY DEFINER function still writes them
-- because it runs as the owner. INSERT is untouched — opening a work order
-- must set its own stage and tier.
revoke update (
  stage, status, risk_tier, approved_by, approved_at, closed_at,
  remediation_rounds, wo_code, agent, requester_email, data_classes,
  cost_usd, tokens_in, tokens_out, source
) on public.work_orders from authenticated, anon;

revoke all on function public.advance_work_order(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.approve_work_order(uuid, text) from public, anon;
grant execute on function public.advance_work_order(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.approve_work_order(uuid, text) to authenticated;

-- =====================================================================
-- 6. ingest_agents: reconcile with the library instead of overwriting it
-- =====================================================================
-- Replaces the 0015 version. Two changes, both narrow:
--
--   (a) A row already marked source = 'library' keeps that provenance and
--       keeps every governance column. The policy still updates the
--       OPERATIONAL fields (caps, kill switch, models, product) because
--       those are the policy's to own — which is exactly the reconciliation
--       docs/agents/README.md asks for, done automatically.
--   (b) The retire sweep is unchanged in effect but now says so explicitly:
--       it touches only source = 'spend-policy'.
--
-- Everything else is byte-identical to 0015. Re-running an older file would
-- revert (a) — always finish with the highest number.

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
    -- THE GUARD: a library row keeps its provenance. Without this the next
    -- sync would rewrite `source` and the governance columns would be
    -- orphaned on a row that no longer claims to be governed.
    source           = case when public.agents.source = 'library'
                            then 'library' else 'spend-policy' end,
    synced_at        = now();

  get diagnostics affected = row_count;

  -- Absent from the payload = removed from spend_policy.yaml. Retired, not
  -- deleted: a spend history with a dangling agent_id is worse than a row
  -- marked retired. Only policy-sourced rows are touched — a library row is
  -- governed by its spec file, and a hand-entered row is nobody's to retire.
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

revoke all on function public.ingest_agents(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_agents(jsonb) to service_role;

-- =====================================================================
-- 7. agent_performance: the rollup
-- =====================================================================
-- security_invoker so it runs as the caller and inherits the underlying
-- RLS. Without it a view is a hole straight through row-level security,
-- because a view runs as its owner by default (the 0015 note).

-- Dropped and recreated rather than `create or replace`: replace cannot add a
-- column anywhere except the end, and adding spec_monthly_cap_usd in the
-- middle fails with "cannot change name of view column". A half-applied
-- migration on a live database is a bad afternoon, so this is a drop.
drop view if exists public.agent_performance;

create view public.agent_performance
with (security_invoker = on) as
  select
    a.agent_id,
    a.layer,
    a.department,
    a.lifecycle,
    a.risk_ceiling,
    a.monthly_cap_usd,
    a.spec_monthly_cap_usd,
    count(w.id)                                              as work_orders,
    count(w.id) filter (where w.status = 'open')             as open_wos,
    count(w.id) filter (where w.stage  = 'closed')           as closed_wos,
    count(w.id) filter (where w.stage  = 'blocked')          as blocked_wos,
    coalesce(sum(w.remediation_rounds), 0)                   as remediation_rounds,
    -- THIS MONTH, because it is compared to a MONTHLY cap. An all-time sum
    -- against a monthly ceiling drifts past 100% and stays there, and the
    -- 80/100 lines stop meaning anything after the first month.
    --
    -- Both sources counted: ledger runs populate work_orders.cost_usd, while
    -- the manual process records cost on the event feed. Summing only the
    -- first showed $0.00 on the Performance tab for a work order whose own
    -- card showed $5.00.
    coalesce(sum(w.cost_usd) filter (
      where w.created_at >= date_trunc('month', now())), 0)
      + coalesce((select sum(e.cost_usd) from public.work_order_events e
                  join public.work_orders w2 on w2.id = e.work_order_id
                  where w2.agent = a.agent_id
                    and e.created_at >= date_trunc('month', now())), 0)
                                                             as cost_usd,
    coalesce(sum(w.tokens_in) filter (
      where w.created_at >= date_trunc('month', now())), 0)  as tokens_in,
    coalesce(sum(w.tokens_out) filter (
      where w.created_at >= date_trunc('month', now())), 0)  as tokens_out,
    max(w.created_at)                                        as last_work_order
  from public.agents a
  left join public.work_orders w on w.agent = a.agent_id
  group by a.agent_id, a.layer, a.department, a.lifecycle,
           a.risk_ceiling, a.monthly_cap_usd, a.spec_monthly_cap_usd;

-- =====================================================================
-- 8. Seed the gates
-- =====================================================================

insert into public.agent_gates
  (gate_id, name, fires_at, checks, on_failure, implemented_as, owner, change_class, build_status, sort)
values
  ('GATE-intake', 'Intake validation', 'Before anything runs',
   'Required work-order fields present and valid: product, objective, audience, channel, risk tier, data classification, declared budget, requester, approvals, approved sources, prohibited actions.',
   'Return for correction. Never infer a missing field — a work order missing its risk tier is not a low-risk work order.',
   'Schema validation', 'Security & Compliance', 2, 'specified', 1),

  ('GATE-authz', 'Authorization', 'Before context assembly',
   'Agent registered, enabled, at an approved version; every requested tool on its allowlist; every data class within its declaration; work-order tier at or below the agent risk ceiling.',
   'Deny and log. Never infer a permission.',
   'Registry + allowlist lookup', 'Security & Compliance', 3, 'specified', 2),

  ('GATE-contract', 'Output contract validation', 'On every agent output',
   'Declared CTX-011 schema returned; required fields present; prohibited fields absent; tokens and cost within cap; no unauthorised tool call recorded.',
   'Reject BEFORE evaluation. A malformed output never reaches an evaluator.',
   'JSON-schema validation', 'Engineering', 2, 'specified', 3),

  ('GATE-runtime', 'Runtime monitor', 'During execution',
   'Tool allowlist; data reads within declared classes; destination allowlist; rate limits; per-run spend cap; iteration limit; repeated identical calls.',
   'May terminate execution. May not delete evidence or be overridden by the orchestrator.',
   'Counters + allowlists', 'Engineering', 3, 'specified', 4),

  ('GATE-release', 'Release scan', 'Before anything leaves',
   'Destination approved; links resolve; no secret; no tracking pixel or third-party script; no hidden metadata; NEEDS SOURCE and UNSET markers resolved; alt text present; approvals recorded.',
   'Block. Non-overridable by any agent, including the orchestrator.',
   'Static artifact scan', 'Security & Compliance', 3, 'specified', 5),

  ('GATE-audit', 'Audit write', 'After every step',
   'Writes the §5.4 record: timestamp, agent identity and version, workflow, I/O summary, model and provider, tokens and cost, data classes, change class, approver, context manifest, evaluator verdicts.',
   'A failed audit write is a HALT condition, not a warning. Work that cannot be recorded does not proceed.',
   'Append-only ledger', 'Security & Compliance', 3, 'specified', 6)
on conflict (gate_id) do update set
  name = excluded.name, fires_at = excluded.fires_at, checks = excluded.checks,
  on_failure = excluded.on_failure, implemented_as = excluded.implemented_as,
  owner = excluded.owner, change_class = excluded.change_class,
  build_status = excluded.build_status, sort = excluded.sort;

-- =====================================================================
-- 9. Seed the agent library — the 16 specs in docs/agents/
-- =====================================================================
-- `enabled` and `status` mirror agent_registry.yaml exactly. `lifecycle`
-- carries the governance word, which is the one that explains WHY something
-- is off: 'planned' means no consumer yet, 'blocked' means CHG-001.
--
-- Idempotent: re-running reseeds the governance columns without touching
-- anything the ingest owns. Safe to run again after editing a spec.

insert into public.agents (
  agent_id, role, data_classes, status, registry, owner, enabled,
  per_run_cap_usd, monthly_cap_usd, allowed_models, product, product_id,
  rollback_version, source, synced_at,
  layer, department, lifecycle, risk_ceiling, spec_path, question,
  owns_object, consumer, context_pages, output_contract, stop_condition,
  blocked_reason, iteration_limit, spec_per_run_cap_usd, spec_monthly_cap_usd
) values

-- ---------- Layer 1 — enterprise ----------
('orch-enterprise', 'enterprise orchestration', 'D0, D1, D2', 'disabled',
 'internal', 'jessica', false, 0.05, 15.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'planned', 'critical',
 'docs/agents/enterprise/orch-enterprise.md',
 'What is the next allowed step for this work order?',
 'work-order state',
 'Every workflow, once gates ship; manual routing until then',
 'CTX-001, CTX-002, CTX-003, CTX-010, CTX-011', 'routing decision',
 'The work order reaches closure or blocked.',
 'Activates when GATE-intake and GATE-authz exist (§3.7).', 3, 0.0500, 15.00),

('eval-task-compliance', 'evaluation', 'D0, D1, D2', 'active',
 'internal', 'security-compliance', true, 0.15, 20.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/eval-task-compliance.md',
 'Did the worker do the exact task it was assigned — no more, no less?',
 'task-compliance verdict', 'Every Medium+ work order',
 'CTX-001, CTX-003, CTX-011', 'Verdict',
 'A verdict is emitted with every defect located and evidenced. One pass.',
 null, 1, 0.1500, 20.00),

('eval-factuality', 'evaluation', 'D0, D1, D2', 'active',
 'internal', 'security-compliance', true, 0.60, 45.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/eval-factuality.md',
 'Is every claim in this output supported by the evidence it cites?',
 'factuality verdict', 'Every High+ work order',
 'CTX-001, CTX-008, CTX-011', 'Verdict',
 'Every claim checked against its cited source; body swept for undeclared claims.',
 null, 1, 0.6000, 45.00),

('eval-adversarial', 'evaluation', 'D0, D1, D2', 'active',
 'internal', 'security-compliance', true, 0.75, 45.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/eval-adversarial.md',
 'How could this output fail, mislead, be misread, or be used against us?',
 'adversarial verdict', 'Every High+ work order — holds a veto',
 'CTX-001, CTX-003, CTX-006, CTX-007, CTX-011', 'Verdict',
 'All nine lenses run and every finding located and evidenced. One pass.',
 null, 1, 0.7500, 45.00),

('eval-adjudicator', 'evaluation', 'D0, D1, D2', 'active',
 'internal', 'security-compliance', true, 0.10, 10.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/eval-adjudicator.md',
 'Given these sealed verdicts, what does the decision table say happens next?',
 'adjudication record', 'Every work order with two or more evaluators',
 'CTX-003, CTX-011', 'Adjudication',
 'An outcome from the CTX-003 table is emitted. One pass, never reconsiders.',
 null, 1, 0.1000, 10.00),

('sec-prompt-context', 'security', 'D0, D1, D2', 'disabled',
 'internal', 'security-compliance', false, 0.20, 15.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'planned', 'critical',
 'docs/agents/enterprise/sec-prompt-context.md',
 'Does this context package contain instructions rather than information?',
 'context safety verdict', 'Research agents, once web retrieval is enabled',
 'CTX-001, CTX-002, CTX-011', 'Verdict',
 'Every document in the manifest inspected, verdict emitted. One pass.',
 'Activates when any agent ingests external retrieved content. No agent in the library may reach the open web until then.', 1, 0.2000, 15.00),

('gov-compliance-reviewer', 'governance', 'D0, D1, D2', 'active',
 'internal', 'security-compliance', true, 0.50, 35.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/gov-compliance-reviewer.md',
 'Does this output create a legal, regulatory, privacy, or policy risk?',
 'compliance verdict',
 'Every Critical-tier Education and Soundwiserx output (CTX-003)',
 'CTX-001, CTX-002, CTX-003, CTX-007, CTX-011, CTX-004|CTX-005', 'Verdict',
 'Every applicable domain checked, verdict emitted. One pass.',
 null, 1, 0.5000, 35.00),

('gov-brand-conformance', 'governance', 'D0, D1', 'active',
 'internal', 'jessica', true, 0.30, 25.00, 'asl-default', null, null, null,
 'library', now(),
 'enterprise', null, 'active', 'critical',
 'docs/agents/enterprise/gov-brand-conformance.md',
 'Does this output comply with the approved brand rules for its product?',
 'brand verdict', 'Every Medium+ content output',
 'CTX-001, CTX-006, CTX-011, CTX-004|CTX-005', 'Verdict',
 'Every check run against the loaded brand page, verdict emitted. One pass.',
 null, 1, 0.3000, 25.00),

-- ---------- Layer 2 — Marketing (blocked on CHG-001) ----------
('mkt-brand-messaging', 'marketing', 'D0, D1, D2', 'disabled',
 'internal', 'jessica', false, 0.40, 20.00, 'asl-default', null, null, null,
 'library', now(),
 'department', 'Marketing', 'blocked', 'high',
 'docs/agents/departments/marketing/mkt-brand-messaging.md',
 'What is the approved way to say this?',
 'the brand context pages (CTX-004, CTX-005)',
 'CTX-004 and CTX-005 ship at v0.9 with UNSET fields blocking content',
 'CTX-001, CTX-006, CTX-007, CTX-008, CTX-011', 'Proposal',
 'Named gaps addressed with a proposed diff, or returned as needing human input.',
 'CHG-001 has not been approved — the Marketing department does not exist yet.', 2, 0.4000, 20.00),

('mkt-editorial-planner', 'marketing', 'D0, D1', 'disabled',
 'internal', 'jessica', false, 0.35, 15.00, 'asl-default', null, null, null,
 'library', now(),
 'department', 'Marketing', 'blocked', 'low',
 'docs/agents/departments/marketing/mkt-editorial-planner.md',
 'What should we create, and when?',
 'the editorial calendar',
 'The monthly article and biweekly thought-leadership cadence',
 'CTX-001, CTX-006, CTX-009, CTX-010, CTX-011', 'Plan',
 'Every slot populated with a sourced item or explicitly marked empty with a reason.',
 'CHG-001 has not been approved — the Marketing department does not exist yet.', 2, 0.3500, 15.00),

('mkt-longform-writer', 'marketing', 'D0, D1, D2', 'disabled',
 'internal', 'jessica', false, 1.20, 50.00, 'asl-default', null, null, null,
 'library', now(),
 'department', 'Marketing', 'blocked', 'critical',
 'docs/agents/departments/marketing/mkt-longform-writer.md',
 'What is the draft of this long-form piece?',
 'long-form drafts',
 'Monthly article, pilot articles, book manuscript sections',
 'CTX-001, CTX-002, CTX-006, CTX-007, CTX-008, CTX-009, CTX-011, CTX-004|CTX-005', 'Draft',
 'Every section present or marked NEEDS SOURCE, and the claims array covers the body.',
 'CHG-001 has not been approved — the Marketing department does not exist yet.', 2, 1.2000, 50.00),

('mkt-linkedin-writer', 'marketing', 'D0, D1', 'disabled',
 'internal', 'jessica', false, 0.25, 20.00, 'asl-default', null, null, null,
 'library', now(),
 'department', 'Marketing', 'blocked', 'high',
 'docs/agents/departments/marketing/mkt-linkedin-writer.md',
 'What is the LinkedIn post for this source asset?',
 'LinkedIn drafts',
 'The biweekly thought-leadership cadence',
 'CTX-001, CTX-006, CTX-007, CTX-008, CTX-009, CTX-011, CTX-004|CTX-005', 'Draft',
 'A draft with every claim traced to the source. Two variants maximum.',
 'CHG-001 has not been approved — the Marketing department does not exist yet.', 2, 0.2500, 20.00),

('mkt-speaking-agent', 'marketing', 'D0, D1, D2', 'disabled',
 'internal', 'jessica', false, 0.60, 25.00, 'asl-default', null, null, null,
 'library', now(),
 'department', 'Marketing', 'blocked', 'critical',
 'docs/agents/departments/marketing/mkt-speaking-agent.md',
 'What are the written artifacts for this talk?',
 'speaking artifacts',
 'Live speaking and event work',
 'CTX-001, CTX-006, CTX-007, CTX-008, CTX-009, CTX-011, CTX-004|CTX-005', 'Draft',
 'Every required artifact drafted to the submission requirements, claims sourced or marked.',
 'CHG-001 has not been approved — the Marketing department does not exist yet.', 2, 0.6000, 25.00),

-- ---------- Layer 3 — product ----------
('sqe-pilot-evidence', 'product research', 'D0, D1, D2', 'active',
 'product', 'jessica', true, 0.50, 25.00, 'asl-default',
 'education', (select id from public.products where key = 'education'), null,
 'library', now(),
 'product', null, 'active', 'critical',
 'docs/agents/products/scout-quest-education/sqe-pilot-evidence.md',
 'What do the approved pilot summaries actually support us saying?',
 'the Education pilot claim register',
 'Pilot articles and event content',
 'CTX-001, CTX-002, CTX-004, CTX-006, CTX-007, CTX-008, CTX-011', 'Research',
 'Every finding registered with its sample, boundary and confidence.',
 null, 2, 0.5000, 25.00),

('sqe-standards-alignment', 'product research', 'D0, D1, D2', 'active',
 'product', 'jessica', true, 0.60, 25.00, 'asl-default',
 'education', (select id from public.products where key = 'education'), null,
 'library', now(),
 'product', null, 'active', 'high',
 'docs/agents/products/scout-quest-education/sqe-standards-alignment.md',
 'Which published academic standards does this map to, and how confidently?',
 'the standards alignment map',
 'Product/build scoping and district-facing material',
 'CTX-001, CTX-002, CTX-004, CTX-006, CTX-008, CTX-011', 'Research',
 'Every item mapped, marked as a gap, or marked NEEDS SOURCE.',
 null, 2, 0.6000, 25.00),

('swx-clinical-evidence', 'product research', 'D0, D1', 'active',
 'product', 'jessica', true, 0.80, 30.00, 'asl-default',
 'soundwiserx', (select id from public.products where key = 'soundwiserx'), null,
 'library', now(),
 'product', null, 'active', 'critical',
 'docs/agents/products/soundwiserx/swx-clinical-evidence.md',
 'What does the published literature support, and what does it not?',
 'the clinical evidence register',
 'Clinical evidence and compliance work; clinical-audience content',
 'CTX-001, CTX-002, CTX-005, CTX-006, CTX-007, CTX-008, CTX-011', 'Research',
 'Every question answered from the supplied literature or marked NEEDS SOURCE.',
 null, 2, 0.8000, 30.00)
on conflict (agent_id) do update set
  -- Governance columns are the library's to own and are always refreshed.
  layer           = excluded.layer,
  department      = excluded.department,
  lifecycle       = excluded.lifecycle,
  risk_ceiling    = excluded.risk_ceiling,
  spec_path       = excluded.spec_path,
  question        = excluded.question,
  owns_object     = excluded.owns_object,
  consumer        = excluded.consumer,
  context_pages   = excluded.context_pages,
  output_contract = excluded.output_contract,
  stop_condition  = excluded.stop_condition,
  blocked_reason  = excluded.blocked_reason,
  iteration_limit = excluded.iteration_limit,
  spec_per_run_cap_usd = excluded.spec_per_run_cap_usd,
  spec_monthly_cap_usd = excluded.spec_monthly_cap_usd,
  role            = excluded.role,
  -- Operational columns are refreshed ONLY when the policy has never claimed
  -- this agent. If spend_policy.yaml owns it, the policy's caps and kill
  -- switch win — reseeding a spec must not quietly raise a cap.
  data_classes    = case when public.agents.source = 'spend-policy'
                         then public.agents.data_classes else excluded.data_classes end,
  enabled         = case when public.agents.source = 'spend-policy'
                         then public.agents.enabled else excluded.enabled end,
  status          = case when public.agents.source = 'spend-policy'
                         then public.agents.status else excluded.status end,
  per_run_cap_usd = case when public.agents.source = 'spend-policy'
                         then public.agents.per_run_cap_usd else excluded.per_run_cap_usd end,
  monthly_cap_usd = case when public.agents.source = 'spend-policy'
                         then public.agents.monthly_cap_usd else excluded.monthly_cap_usd end,
  allowed_models  = case when public.agents.source = 'spend-policy'
                         then public.agents.allowed_models else excluded.allowed_models end,
  product         = case when public.agents.source = 'spend-policy'
                         then public.agents.product else excluded.product end,
  product_id      = case when public.agents.source = 'spend-policy'
                         then public.agents.product_id else excluded.product_id end,
  registry        = case when public.agents.source = 'spend-policy'
                         then public.agents.registry else excluded.registry end,
  owner           = case when public.agents.source = 'spend-policy'
                         then public.agents.owner else excluded.owner end,
  source          = case when public.agents.source = 'spend-policy'
                         then 'spend-policy' else 'library' end,
  synced_at       = now();

-- =====================================================================
-- 10. Record the change
-- =====================================================================
-- change_log is append-only and has no delete policy for anyone including
-- the owner (0008). This entry cannot be corrected later, so it is written
-- once and plainly.

-- source_ref makes the replay a no-op: 0015's partial unique index
-- change_log_source_ref_idx fires on it. Without a source_ref there is
-- nothing to conflict on, and change_log has no delete policy for anyone
-- including the owner — so a second run of a "safe to re-run" migration
-- would leave a duplicate nobody can remove.
insert into public.change_log (product, module, tab, change_type, description, source, source_ref)
values (
  'company', 'IT', 'Agent Platform', 'new',
  'Migration 0018 — the governed agent library lands in the OS. 16 agent specs seeded with source=''library'', 6 deterministic gates registered, work-order lifecycle (stage machine, append-only event feed, bounded remediation, SQL-enforced approval), and agent_performance. ingest_agents() replaced so a spend-policy sync reconciles with library rows instead of overwriting their provenance. Class 2. Specs are in docs/agents/; this screen is a mirror and does not edit them.',
  'manual',
  'migration:0018_agent_library'
)
on conflict do nothing;

-- =====================================================================
-- Verification — run after, expect PASS on every line
-- =====================================================================
-- select count(*) = 16 as agents_seeded    from public.agents where source = 'library';
-- select count(*) =  6 as gates_seeded     from public.agent_gates;
-- select count(*) =  9 as enabled_matches_registry
--   from public.agents where source = 'library' and enabled;
-- select round(sum(monthly_cap_usd)) = 260 as enabled_ceiling
--   from public.agents where source = 'library' and enabled;
-- select round(sum(monthly_cap_usd)) = 420 as total_ceiling
--   from public.agents where source = 'library';
-- -- the guard, the trigger, the bound, and the aal2 gate actually deployed:
-- select
--   (select count(*) from pg_constraint where conname = 'agents_source_check') = 1
--   and (select count(*) from pg_trigger where tgname = 'work_order_events_stamp') = 1
--   and (select count(*) from pg_constraint where conname = 'work_orders_remediation_bound') = 1
--   and (select position('''library''' in pg_get_functiondef(oid)) > 0
--          from pg_proc where proname = 'ingest_agents')
--   and (select position('aal2' in pg_get_functiondef(oid)) > 0
--          from pg_proc where proname = 'approve_work_order')
--   as controls_present;
-- -- the other door is shut: expect 0 rows (no UPDATE on governance columns)
-- select count(*) = 0 as governance_columns_locked
--   from information_schema.column_privileges
--  where table_name='work_orders' and privilege_type='UPDATE'
--    and grantee='authenticated'
--    and column_name in ('stage','approved_at','approved_by','status','risk_tier');
-- -- the feed cannot be orphaned: expect 'RESTRICT'
-- select confdeltype = 'r' as events_fk_restrict from pg_constraint
--  where conname like 'work_order_events_work_order_id%';
-- -- gates are not writable: expect 1 (select only)
-- select count(*) = 1 as gates_read_only from pg_policy
--  where polrelid = 'public.agent_gates'::regclass;
-- -- caps agree with the spec? any row here is a reconciliation item, not a bug:
-- select agent_id, spec_monthly_cap_usd as spec, monthly_cap_usd as live
--   from public.agents where source = 'library'
--    and spec_monthly_cap_usd is distinct from monthly_cap_usd;
-- -- work_order_events must be insert-only: expect exactly 2 policies, no update/delete
-- select count(*) = 2 as append_only from pg_policy
--   where polrelid = 'public.work_order_events'::regclass;
