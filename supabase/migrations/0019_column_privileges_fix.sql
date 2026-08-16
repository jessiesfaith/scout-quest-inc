-- =====================================================================
-- 0019 — make 0018's column privileges actually bind
-- =====================================================================
-- In the Supabase SQL Editor use the ORANGE "Run without RLS" (HANDOFF §4.3).
--
-- THE DEFECT. 0018 protected the governance columns with column-level
-- REVOKEs (its lines 295 and 525). Those statements ran without error and
-- had no effect. In PostgreSQL a column-level REVOKE cannot cut into a
-- TABLE-level GRANT: if a role holds UPDATE on the table, it may update
-- every column regardless of what was revoked column by column. Supabase
-- grants table-wide privileges to `anon` and `authenticated` by default and
-- no migration in this repo changes them, so the revokes were inert from the
-- moment they ran.
--
-- Confirmed on production 2026-08-06, not inferred:
--   has_table_privilege('authenticated','public.work_orders','UPDATE')  -> true
--   has_column_privilege('authenticated','public.work_orders','stage','UPDATE') -> true
--   ... the same for status, approved_at, approved_by, risk_tier,
--       remediation_rounds, and for work_order_events.seq on INSERT
--   raw ACL: postgres=arwdDxtm/postgres | anon=arwdDxtm/postgres | authenticated=arwdDxtm/postgres
--
-- WHAT IT MEANT IN PRACTICE. The RLS policy on work_orders is `for all`, so
-- any holder of a valid session could PATCH the table through PostgREST with
-- the publishable browser key and set stage='release', write approved_at and
-- approved_by with any email, or reopen a closed work order — without
-- calling advance_work_order or approve_work_order, and therefore without
-- the aal2 check, without the stage machine, and writing nothing to the
-- event feed. work_order_events.seq was settable for the same reason, so a
-- forged row could be pinned anywhere in a feed ordered by it.
--
-- The aal2 gate in approve_work_order was real. It was simply not the only
-- door, which is the failure HANDOFF §5.3 names: a check that is enforced in
-- one of its two doors is not enforced.
--
-- THE FIX. Revoke at the table level first, then grant back the columns that
-- should be writable. That is the only ordering in which column privileges
-- bind at all.
--
-- The SECURITY DEFINER functions are unaffected — advance_work_order,
-- approve_work_order and the ingest functions run as the owner, which holds
-- every privilege. That is what makes this safe: it removes the direct path
-- without touching the governed one.

begin;

-- =====================================================================
-- 1. work_orders — no direct UPDATE at all
-- =====================================================================
-- 0018 intended to leave the nineteen non-governance columns updatable. This
-- goes further and revokes UPDATE outright, because the app contains no
-- UPDATE path to work_orders whatsoever — verified by grepping every .ts and
-- .tsx under app/ and lib/ for update/upsert/delete against this table: the
-- only writes anywhere are one INSERT when a work order is opened, and the
-- two RPCs. Granting columns nothing writes would widen the surface for no
-- benefit.
--
-- THE TRADEOFF. If an edit screen is added later it will fail with a
-- permission error until someone adds an explicit column grant here. That is
-- deliberate: it forces the decision about which columns an editor may touch
-- to be made in a migration, in review, rather than inherited silently from
-- a default. Fails closed rather than open.
--
-- INSERT is deliberately NOT touched. Opening a work order must set its own
-- stage, tier and code, exactly as 0018 says.

revoke update on public.work_orders from authenticated, anon;

-- anon has no business writing this table at all.
revoke insert, update, delete on public.work_orders from anon;

-- =====================================================================
-- 2. work_order_events — INSERT only the columns a caller may set
-- =====================================================================
-- Faithful to 0018's intent: the sequence and the three stamped columns
-- cannot be named in an INSERT. Everything else stays insertable, which
-- covers the seven columns actions.ts actually sends.
--
-- created_at, created_by and created_by_email are written by the
-- work_order_events_stamp trigger, which runs regardless of the caller's
-- privileges. seq comes from its bigserial default.

revoke insert on public.work_order_events from authenticated, anon;

grant insert (
  work_order_id, kind, from_stage, to_stage, actor, actor_id,
  outcome, detail, cost_usd, tokens_in, tokens_out
) on public.work_order_events to authenticated;

revoke insert, update, delete on public.work_order_events from anon;

-- =====================================================================
-- 3. The append-only tables — stop relying only on a missing policy
-- =====================================================================
-- change_log, security_reports and work_order_events are append-only, and
-- until now that rested entirely on there being no delete policy. RLS is a
-- real control and this is not a discovered hole — but the table grant says
-- `d` for both roles, so the guarantee has one lock where it could have two.
-- A missing policy is an absence; a revoked privilege is a presence. The
-- second is easier to verify and harder to undo by accident.
--
-- UPDATE is revoked for the same reason: append-only means rows do not
-- change after they are written, and nothing in the app updates them.

revoke update, delete on public.change_log        from authenticated, anon;
revoke update, delete on public.security_reports  from authenticated, anon;
revoke update, delete on public.work_order_events from authenticated, anon;

-- =====================================================================
-- 4. Record it
-- =====================================================================

-- Column list matches 0018 exactly: created_by_email is NOT named, because
-- 0008's stamp_change_log trigger writes it. source_ref makes a replay a
-- no-op via 0015's partial unique index — which matters here because
-- change_log has no delete policy for anyone, so a duplicate is permanent.
insert into public.change_log (
  product, module, tab, change_type, description, source, source_ref
) values (
  'company', 'IT', 'Agent Platform', 'update',
  'Migration 0019 — 0018''s column-level REVOKEs were inert because anon and authenticated held table-level grants, so the work_orders governance columns (stage, status, approved_at, approved_by, risk_tier, remediation_rounds) and work_order_events.seq were directly writable through PostgREST, bypassing approve_work_order''s aal2 gate and the stage machine and leaving no entry on the event feed. Revoked at table level and granted back only the insertable columns. UPDATE and DELETE also revoked on the three append-only tables so that guarantee no longer rests on a missing policy alone. Found by 0018_VERIFY.sql; confirmed with has_column_privilege() rather than information_schema, which reports grants and not effective access.',
  'manual',
  'migration:0019_column_privileges_fix'
)
on conflict do nothing;

commit;

-- =====================================================================
-- Verification — expect 14 rows, every result 'true'
-- =====================================================================
-- Re-run 0018_DIAGNOSE.sql as well: rows 3-10 there must now all be false.
--
-- select 'work_orders.stage not updatable' as check,
--        (not has_column_privilege('authenticated','public.work_orders','stage','UPDATE'))::text as result
-- union all select 'work_orders.status not updatable',
--        (not has_column_privilege('authenticated','public.work_orders','status','UPDATE'))::text
-- union all select 'work_orders.approved_at not updatable',
--        (not has_column_privilege('authenticated','public.work_orders','approved_at','UPDATE'))::text
-- union all select 'work_orders.approved_by not updatable',
--        (not has_column_privilege('authenticated','public.work_orders','approved_by','UPDATE'))::text
-- union all select 'work_orders.risk_tier not updatable',
--        (not has_column_privilege('authenticated','public.work_orders','risk_tier','UPDATE'))::text
-- union all select 'work_orders.remediation_rounds not updatable',
--        (not has_column_privilege('authenticated','public.work_orders','remediation_rounds','UPDATE'))::text
-- union all select 'events.seq not insertable',
--        (not has_column_privilege('authenticated','public.work_order_events','seq','INSERT'))::text
-- union all select 'events.created_by_email not insertable',
--        (not has_column_privilege('authenticated','public.work_order_events','created_by_email','INSERT'))::text
-- union all select 'events.kind STILL insertable (app must work)',
--        has_column_privilege('authenticated','public.work_order_events','kind','INSERT')::text
-- union all select 'events.work_order_id STILL insertable (app must work)',
--        has_column_privilege('authenticated','public.work_order_events','work_order_id','INSERT')::text
-- union all select 'work_orders INSERT still allowed (opening must work)',
--        has_column_privilege('authenticated','public.work_orders','stage','INSERT')::text
-- union all select 'change_log not deletable',
--        (not has_table_privilege('authenticated','public.change_log','DELETE'))::text
-- union all select 'work_order_events not deletable',
--        (not has_table_privilege('authenticated','public.work_order_events','DELETE'))::text
-- union all select 'owner still has full access (RPCs keep working)',
--        has_column_privilege('postgres','public.work_orders','stage','UPDATE')::text;
