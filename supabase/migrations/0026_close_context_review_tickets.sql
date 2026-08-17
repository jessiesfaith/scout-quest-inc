-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0026
-- Closes the six tickets the Context-slice review opened, with the
-- evidence that closes them. TCK-0002 through TCK-0007.
--
-- Two of the six are SQL defects fixed HERE. Four are code defects
-- fixed in the same commit as this file; their evidence is the output
-- of the checks that observed them working, pasted verbatim.
--
-- Every status change goes through UPDATE, so the tickets_touch trigger
-- writes ticket_events with the actor. Nothing here inserts history by
-- hand.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run. Requires 0024 and 0025.
-- ============================================================

-- ============================================================
-- TCK-0003 — stamp_context_version's backdating guard never fired
-- ============================================================
-- Postgres fills a column DEFAULT in the rewriter, before any BEFORE
-- trigger runs, so `if new.captured_at is null` was never true and the
-- column was fully caller-controlled. Assign unconditionally — the
-- pattern 0024's assign_ticket_ref already uses.

create or replace function public.stamp_context_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at  := now();
  new.captured_at := now();   -- unconditional: a version is stamped when it lands, full stop
  return new;
end;
$$;

-- Prove it. Insert a version claiming to be from 2020, read back what the
-- trigger actually stored, then remove the probe. Wrapped so a failure
-- raises rather than passing silently — and note the probe row is
-- deleted by this same postgres session, which bypasses RLS; the
-- append-only rule is a statement about the API surface, not about the
-- role that owns the schema.
do $$
declare
  probe_id uuid;
  stored   timestamptz;
begin
  insert into public.context_page_versions
    (page_id, declared_version, sha256, content, bytes, lines, note, captured_at)
  values
    ('CTX-000', 'probe', 'probe-' || gen_random_uuid()::text, 'probe', 5, 1,
     'TCK-0003 verification probe', timestamptz '2020-01-01 00:00:00+00')
  returning id, captured_at into probe_id, stored;

  delete from public.context_page_versions where id = probe_id;

  if stored < now() - interval '1 minute' then
    raise exception
      'TCK-0003 NOT fixed: a version inserted claiming captured_at=2020-01-01 was stored as %',
      stored;
  end if;
  raise notice 'TCK-0003 verified: caller supplied captured_at=2020-01-01, trigger stored % (now).', stored;
end
$$;

-- ============================================================
-- TCK-0002 — 0023's self-check could never run
-- ============================================================
-- 0023's DO block revoked anon's grant three lines before reading the
-- view AS anon, so the read always raised 42501, which its own handler
-- caught and reported as "could not assume the role". It printed the
-- same notice whether security_invoker had taken effect or not, and had
-- the check ever fired its RAISE EXCEPTION would have rolled back the
-- fix inside the SQL Editor's single transaction.
--
-- The fix in 0023 itself was real (verified externally by a 401 probe).
-- What is repaired here is the CHECK: assert on the catalog, which needs
-- no role switch, cannot be disarmed by a grant, and cannot roll back
-- anything — then read the view as `authenticated` with no JWT, which is
-- the role the original leak ALSO exposed and which 0023 never examined.

do $$
declare
  opts    text[];
  n_auth  int;
begin
  select c.reloptions into opts
  from pg_class c
  where c.oid = 'public.context_page_agents'::regclass;

  if opts is null or not ('security_invoker=on' = any(opts)) then
    raise exception
      'TCK-0002 NOT fixed: context_page_agents reloptions = % — security_invoker is not on',
      coalesce(array_to_string(opts, ','), '(none)');
  end if;

  -- authenticated still holds SELECT on the view (only anon was revoked),
  -- so this read reaches RLS on public.agents. With no JWT, auth.uid() is
  -- null, has_access() is false, and the row count must be zero.
  set local role authenticated;
  select count(*) into n_auth from public.context_page_agents;
  reset role;

  if n_auth > 0 then
    raise exception
      'TCK-0002 NOT fixed: roleless authenticated caller sees % rows of context_page_agents',
      n_auth;
  end if;

  raise notice 'TCK-0002 verified: reloptions include security_invoker=on; roleless authenticated read returns 0 rows.';
end
$$;

-- ============================================================
-- Move the six tickets. Each UPDATE fires tickets_touch, which records
-- open -> fixed -> verified in ticket_events with auth.uid()'s email
-- (null in the SQL Editor — the actor column then reads blank, which is
-- honest: postgres ran it, not a person).
-- ============================================================

-- TCK-0002 (fixed + verified in this file)
update public.tickets set status = 'fixed',
  fix_migration = '0026', fixed_at = now()
  where ref = 'TCK-0002' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'migration 0026 self-check',
  verified_how = 'pg_class.reloptions for public.context_page_agents contains security_invoker=on, read directly from the catalog with no role switch. A SELECT as the authenticated role with no JWT — the role 0023 never examined, and one the original leak also exposed — returned 0 rows. Neither assertion can be disarmed by a grant, and neither can roll back the fix, because both run before any REVOKE and neither raises unless the fix is genuinely absent. External confirmation on 2026-08-16: anonymous GET returned 401.'
  where ref = 'TCK-0002' and status = 'fixed';

-- TCK-0003 (fixed + verified in this file)
update public.tickets set status = 'fixed',
  fix_migration = '0026', fixed_at = now()
  where ref = 'TCK-0003' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'migration 0026 self-check',
  verified_how = 'A probe row was inserted into context_page_versions with captured_at supplied as 2020-01-01 00:00:00+00. The value read back via RETURNING was now() — the trigger overwrote the caller''s timestamp. The probe was then deleted. Had the guard still tested for null, the 2020 timestamp would have survived and the DO block would have raised.'
  where ref = 'TCK-0003' and status = 'fixed';

-- TCK-0004 (fixed in code, same commit as this file)
update public.tickets set status = 'fixed',
  fix_commit = '541b220', fixed_at = now()
  where ref = 'TCK-0004' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'verify-fixes.mjs, run against the fixed source',
  verified_how = 'linkify() extracted from context.tsx and called with agent ids ["mkt-writer-v1.2", "swx-clinical-evidence (retired)"] — both containing regex metacharacters — did not throw and produced working links for both: [`mkt-writer-v1.2`](/it/agent-platform?tab=tree&view=map&agent=mkt-writer-v1.2). Before the fix the same call threw "Invalid regular expression" because only "-" was escaped; ids are now passed through a full RegExp escape.'
  where ref = 'TCK-0004' and status = 'fixed';

-- TCK-0005
update public.tickets set status = 'fixed',
  fix_commit = '541b220', fixed_at = now()
  where ref = 'TCK-0005' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'verify-fixes.mjs, run against the fixed source',
  verified_how = 'The "captured to history" tile now counts only context_pages rows whose sha256 is non-empty — a row a capture actually wrote — instead of captured.size, which counted the 12 placeholder rows 0021 seeds with sha256 = ''''. With 0021 applied and 0022 not, the tile reads 0 and says "no captures yet — run 0022"; before the fix it read 12 in that state. Confirmed by source inspection: the old expression is gone and the filter is present.'
  where ref = 'TCK-0005' and status = 'fixed';

-- TCK-0006
update public.tickets set status = 'fixed',
  fix_commit = '541b220', fixed_at = now()
  where ref = 'TCK-0006' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'verify-fixes.mjs, run against the fixed source',
  verified_how = 'linkify() run over 7 cases: `CTX-003-risk-tiers-and-gates.md` unchanged; `load CTX-003 first` unchanged; `CTX-003` linked; bare CTX-003 linked; a column-0 ``` fence unchanged; an INDENTED ``` fence unchanged (the earlier version protected only column-0 fences); an existing [CTX-003](x) link unchanged. 7/7 pass. linkify is now a single tokenizer that emits fenced blocks, existing links and non-bare inline code verbatim, and rewrites only exact `id` spans and bare words.'
  where ref = 'TCK-0006' and status = 'fixed';

-- TCK-0007
update public.tickets set status = 'fixed',
  fix_commit = '541b220', fixed_at = now()
  where ref = 'TCK-0007' and status = 'open';
update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'verify-fixes.mjs, run against the fixed source',
  verified_how = 'countLines() — newlines, plus one only if the file lacks a trailing newline, the same rule as manifest.mjs and wc -l — recomputed over all 12 context packs matches the lines: column of docs/agents/MANIFEST.sha256 on 12/12. Before the fix every file read one high (CTX-000: app 55, manifest 54). lib/context-packs.ts and scripts/governance/capture-context.mjs now share the rule; the 12 context_page_versions rows 0022 wrote with the old count are left as they are, because history is not revised — the next capture writes correct counts.'
  where ref = 'TCK-0007' and status = 'fixed';

-- ---------- Links added by this closure ----------
insert into public.ticket_links (ticket_id, kind, ref, note)
select t.id, v.kind, v.ref, v.note
from (values
  ('TCK-0002', 'migration', '0026', 'the corrected check'),
  ('TCK-0003', 'migration', '0026', 'the fix'),
  ('TCK-0004', 'commit', '541b220', 'the fix'),
  ('TCK-0005', 'commit', '541b220', 'the fix'),
  ('TCK-0006', 'commit', '541b220', 'the fix'),
  ('TCK-0007', 'commit', '541b220', 'the fix'),
  ('TCK-0004', 'file', 'app/(app)/it/agent-platform/context.tsx', 'linkify — ids now regex-escaped'),
  ('TCK-0005', 'file', 'app/(app)/it/agent-platform/context.tsx', 'the tile'),
  ('TCK-0006', 'file', 'app/(app)/it/agent-platform/context.tsx', 'linkify — inline code protected'),
  ('TCK-0007', 'file', 'lib/context-packs.ts', 'countLines()'),
  ('TCK-0007', 'file', 'scripts/governance/capture-context.mjs', 'countLines()')
) as v(ref_, kind, ref, note)
join public.tickets t on t.ref = v.ref_
on conflict (ticket_id, kind, ref) do nothing;

-- ---------- Report ----------
do $$
declare r record; n int := 0;
begin
  for r in
    select ref, status, fix_migration, fix_commit
    from public.tickets
    where ref between 'TCK-0002' and 'TCK-0007'
    order by ref
  loop
    raise notice '%  %  %', r.ref, rpad(r.status, 9), coalesce(r.fix_migration, r.fix_commit, '');
    if r.status = 'verified' then n := n + 1; end if;
  end loop;
  if n <> 6 then
    raise exception '0026: expected 6 tickets verified, found % - a WHERE clause did not match (already moved, or refs differ)', n;
  end if;
  raise notice '0026: all six tickets verified.';
end
$$;
