-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0023
-- SECURITY FIX: context_page_agents leaked the whole agent library
-- to anonymous callers.
--
-- WHAT HAPPENED. 0021 created public.context_page_agents without
-- `security_invoker = on`. A Postgres view runs with the privileges of the
-- role that OWNS it — the postgres role that ran the migration — not the
-- caller. So row-level security on public.agents, which the view reads,
-- was never consulted. The base table correctly returned nothing to an
-- anonymous request; the view over it returned all 88 rows.
--
-- The publishable key ships in every browser bundle by design, and the
-- repository is public, so this was reachable by anyone:
--   GET /rest/v1/context_page_agents?select=*
-- exposing every agent_id, its layer and department, its lifecycle and
-- risk ceiling, its spec_path, and the full map of which governance page
-- each agent loads.
--
-- Every other view in this schema already does this correctly —
-- agent_spend_summary and agent_spend_monthly (0015), invoice_balances
-- (0017) and agent_performance (0018) are all declared
-- `with (security_invoker = on)`. 0021 simply failed to follow the
-- convention the codebase had already set.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0021.
-- ============================================================

-- The fix. security_invoker makes the view execute as the caller, so the
-- RLS on public.agents applies exactly as it does to a direct read.
alter view public.context_page_agents set (security_invoker = on);

-- Defence in depth: PostgREST exposes anything the anon role may select,
-- and Supabase grants select on public objects by default. Even with
-- security_invoker on, anon has no business holding the grant — a future
-- view definition that forgets the option would leak again.
revoke all on public.context_page_agents from anon;

-- ---------- Prove it, rather than assume it ----------
-- If the view still runs as its owner, this raises instead of leaving a
-- silent hole. set_config with is_local = true is confined to this
-- transaction, so the role change does not outlive the statement.
do $$
declare
  visible_to_anon int;
begin
  set local role anon;
  select count(*) into visible_to_anon from public.context_page_agents;
  reset role;

  if visible_to_anon > 0 then
    raise exception
      'context_page_agents still exposes % rows to anon - security_invoker did not take effect',
      visible_to_anon;
  end if;

  raise notice 'context_page_agents: anon sees 0 rows. Fixed.';
exception
  when insufficient_privilege then
    -- Some managed roles cannot SET ROLE anon. Not being able to run the
    -- check is not the same as the check passing, so say so plainly.
    reset role;
    raise notice 'Could not assume the anon role to verify. Confirm by hand: an anonymous GET on /rest/v1/context_page_agents must return [].';
end
$$;
