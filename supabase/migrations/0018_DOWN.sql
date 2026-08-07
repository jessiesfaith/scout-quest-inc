-- =====================================================================
-- 0018 DOWN — reverses 0018_agent_library.sql
-- =====================================================================
-- HANDOFF §8 asks for a matching down-script wherever a migration drops or
-- tightens something. 0018 does three of those: it drops agents_source_check
-- and widens it, it drops and recreates the agent_performance view, and it
-- REPLACES ingest_agents(). The third is the one that makes a down-script
-- necessary rather than merely tidy — dropping 0018's ingest_agents without
-- restoring 0015's would leave the Stage 3 publisher with no function to
-- call, and the failure would not appear until the next sync.
--
-- In the Supabase SQL Editor use the ORANGE "Run without RLS" (HANDOFF §4.3).
--
-- ---------------------------------------------------------------------
-- READ THIS BEFORE RUNNING. Three of these steps destroy data.
-- ---------------------------------------------------------------------
--
--   1. work_order_events is DROPPED. That table is append-only with no
--      delete policy for any role, which means its contents are the only
--      tamper-evident record of who moved which work order and when.
--      Dropping the table is DDL and bypasses the guarantee completely.
--      There is no way to reconstruct it. If those events matter, copy them
--      somewhere first — this script will not do it for you, because a
--      script that quietly stashes an audit trail somewhere else is worse
--      than one that makes you decide.
--
--   2. The 16 library agent rows are DELETED. They are re-seedable by
--      re-running 0018, so this is recoverable — but any spend or run rows
--      in agent_spend that reference those agent_ids will be left pointing
--      at agents that no longer exist. There is no FK, so nothing will stop
--      it. Check first if the ledger sync has ever run against them.
--
--   3. work_orders keeps its 0018 COLUMN VALUES but loses the constraints
--      that made them legal. Deliberate: dropping a check constraint cannot
--      fail, but nulling the columns would throw away real work-order state.
--      The consequence is that after this runs, work_orders may hold stage
--      and risk_tier values that nothing validates. Re-running 0018 will
--      re-add the constraints, and they will be validated against those rows
--      at that point — so a row holding an out-of-range value will make the
--      re-run fail loudly. That is the intended behaviour.
--
-- The change_log entry 0018 wrote CANNOT be removed. change_log has no
-- delete policy for anyone including the owner (migration 0008) and this
-- script does not use DDL to work around that. Section 11 appends a revert
-- entry instead, which is what an append-only log is supposed to look like
-- when something is undone.
-- =====================================================================

begin;

-- =====================================================================
-- 1. agent_performance — created by 0018 only; no prior version exists
-- =====================================================================
-- Confirmed by grepping every migration: 0018 is the only file that
-- mentions agent_performance, so its `drop view if exists` was defensive
-- and there is nothing to restore here.

drop view if exists public.agent_performance;

-- =====================================================================
-- 2. ingest_agents — restore the 0015 body verbatim
-- =====================================================================
-- This is the reason the file exists. 0015's version overwrites provenance
-- with 'spend-policy' unconditionally; 0018's reconciles with library rows.
-- Going back means going back to the overwrite.

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
    source           = 'spend-policy',
    synced_at        = now();

  get diagnostics affected = row_count;

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

-- 0015's grants, restored with it. A restored function with 0018's grants
-- would be a different security posture wearing the old body.
revoke all on function public.ingest_agents(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_agents(jsonb) to service_role;

-- =====================================================================
-- 3. The work-order lifecycle functions — 0018-only, plain drops
-- =====================================================================

drop function if exists public.advance_work_order(uuid, text, text, text, text, text);
drop function if exists public.approve_work_order(uuid, text);

-- =====================================================================
-- 4. work_order_events — see warning 1 above
-- =====================================================================

drop trigger if exists work_order_events_stamp on public.work_order_events;
drop function if exists public.stamp_work_order_event();
drop table if exists public.work_order_events;

-- =====================================================================
-- 5. work_orders — drop the constraints and indexes 0018 added
-- =====================================================================
-- All four constraints and all three indexes are new in 0018 (verified
-- against every earlier migration), so dropping restores the prior state
-- exactly. work_orders itself is from 0003; 0015 added the ingest columns
-- and work_orders_source_check, and neither is touched here.

alter table public.work_orders drop constraint if exists work_orders_no_d3;
alter table public.work_orders drop constraint if exists work_orders_risk_tier_check;
alter table public.work_orders drop constraint if exists work_orders_stage_check;
alter table public.work_orders drop constraint if exists work_orders_remediation_bound;
drop index if exists public.work_orders_wo_code_key;
drop index if exists public.work_orders_agent_idx;
drop index if exists public.work_orders_stage_idx;

-- ---------------------------------------------------------------------
-- 5b. The work_orders COLUMNS 0018 added — deliberately left in place.
-- ---------------------------------------------------------------------
-- All fourteen are new in 0018. `data_classes` and `change_class` look like
-- exceptions but are not: the pre-0018 occurrences of those names are
-- agents.data_classes (0003) and change_log.change_class (0007), different
-- tables entirely. Checked column by column before writing this.
--
-- THE TRADEOFF, since dropping them is defensible too. Keeping the columns
-- leaves schema residue: nullable columns nothing writes and nothing
-- validates, which a later reader may mistake for live structure. Dropping
-- them destroys every work order that was run through this screen — the
-- objective, the approval, the stage it reached. The events table is already
-- being dropped above, so the columns are the only remaining record of that
-- work. Residue is recoverable; the record is not.
--
-- If you have decided you want a clean schema and accept losing that
-- history, uncomment this. It is left commented so the loss is a decision
-- somebody makes, not something this file does on their behalf.
--
-- alter table public.work_orders
--   drop column if exists risk_tier,
--   drop column if exists stage,
--   drop column if exists objective,
--   drop column if exists audience,
--   drop column if exists channel,
--   drop column if exists data_classes,
--   drop column if exists change_class,
--   drop column if exists budget_ceiling_usd,
--   drop column if exists requester_email,
--   drop column if exists approved_by,
--   drop column if exists approved_at,
--   drop column if exists blocked_reason,
--   drop column if exists closed_at,
--   drop column if exists remediation_rounds;

-- =====================================================================
-- 6. agent_gates — created by 0018, dropped whole
-- =====================================================================

drop policy if exists "agent_gates_select_access" on public.agent_gates;
drop table if exists public.agent_gates;

-- =====================================================================
-- 7. The seeded library rows — BEFORE the constraint is narrowed
-- =====================================================================
-- Order matters. Narrowing agents_source_check back to two values while
-- 'library' rows are still present makes the ALTER fail on validation.

delete from public.agents where source = 'library';

-- =====================================================================
-- 8. agents_source_check — back to the pre-0018 two values
-- =====================================================================

alter table public.agents
  drop constraint if exists agents_source_check;
alter table public.agents
  add constraint agents_source_check
  check (source in ('manual', 'spend-policy'));

-- =====================================================================
-- 9. The governance constraints 0018 added to agents
-- =====================================================================

alter table public.agents drop constraint if exists agents_layer_check;
alter table public.agents drop constraint if exists agents_lifecycle_check;
alter table public.agents drop constraint if exists agents_risk_ceiling_check;

-- =====================================================================
-- 10. The governance columns
-- =====================================================================
-- Dropped last so that steps 7-9 can still read them if this script is run
-- in pieces rather than as one transaction.

alter table public.agents
  drop column if exists layer,
  drop column if exists department,
  drop column if exists lifecycle,
  drop column if exists risk_ceiling,
  drop column if exists spec_path,
  drop column if exists question,
  drop column if exists owns_object,
  drop column if exists consumer,
  drop column if exists context_pages,
  drop column if exists output_contract,
  drop column if exists stop_condition,
  drop column if exists blocked_reason,
  drop column if exists iteration_limit,
  drop column if exists spec_per_run_cap_usd,
  drop column if exists spec_monthly_cap_usd;

-- =====================================================================
-- 11. Record the revert — append, never delete
-- =====================================================================

-- Column list matches 0018 exactly: created_by_email is NOT named, because
-- 0008's stamp_change_log trigger writes it.
insert into public.change_log (
  product, module, tab, change_type, description, source, source_ref
) values (
  'company', 'IT', 'Agent Platform', 'removed',
  'Migration 0018 reverted by 0018_DOWN.sql. The 16 library agent rows, the 6 gates, the work-order lifecycle constraints and functions, agent_performance, and the work_order_events table and its contents were removed. ingest_agents() restored to its 0015 body, which overwrites provenance with ''spend-policy'' instead of reconciling. The 0018 entry above this one is left in place: change_log has no delete policy for anyone, and this is what that looks like when something is undone.',
  'manual',
  'migration:0018_DOWN'
)
on conflict do nothing;

commit;

-- =====================================================================
-- Verification after running this
-- =====================================================================
-- Expect exactly 6 rows, every result 'true'. Same aggregate discipline as
-- 0018_VERIFY.sql: a missing object must report false, not vanish.
--
-- select 'library rows gone'        as check, (count(*) = 0)::text as result
--   from public.agents where source = 'library'
-- union all select 'agent_gates gone',
--   (count(*) = 0)::text from pg_class
--   where relname = 'agent_gates' and relnamespace = 'public'::regnamespace
-- union all select 'work_order_events gone',
--   (count(*) = 0)::text from pg_class
--   where relname = 'work_order_events' and relnamespace = 'public'::regnamespace
-- union all select 'agent_performance gone',
--   (count(*) = 0)::text from pg_class
--   where relname = 'agent_performance' and relnamespace = 'public'::regnamespace
-- union all select 'ingest_agents is the 0015 body',
--   (count(*) = 1)::text from pg_proc
--   where pronamespace = 'public'::regnamespace and proname = 'ingest_agents'
--     and position('''library''' in pg_get_functiondef(oid)) = 0
-- union all select 'revert recorded in change_log',
--   (count(*) = 1)::text from public.change_log
--   where source_ref = 'migration:0018_DOWN';
