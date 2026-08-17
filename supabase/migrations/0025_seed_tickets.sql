-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0025
-- Seeds the ticket board with everything currently known.
--
-- Three groups, deliberately distinguished:
--
--   REAL, VERIFIED    one ticket: the data leak that shipped to the live
--                     database on 2026-08-16, with the evidence that it
--                     is closed.
--   REAL, OPEN        defects confirmed by adversarial review — a finder
--                     raised it and an independent agent, told to refute
--                     it, could not.
--   UNVERIFIED        leads raised by a review that ran out of budget
--                     before its verifiers ran. NOT confirmed and NOT
--                     dismissed. They carry status 'unverified' so they
--                     cannot quietly decay into "not a problem".
--
-- Plus two DEMO tickets that exercise the full trace — Constitution
-- clause -> context pack -> agent -> work order -> ticket — using rows
-- that already exist. They are flagged is_demo and removable with:
--   delete from public.tickets where is_demo;
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run: every insert is guarded on ref. Requires 0024.
-- ============================================================

-- ---------- helper: insert a ticket once, by ref ----------

create or replace function public.seed_ticket(
  p_ref text, p_title text, p_detail text, p_type text, p_severity text,
  p_status text, p_source text, p_found_at timestamptz, p_found_by text,
  p_fix_commit text, p_fix_migration text, p_fixed_at timestamptz,
  p_verified_at timestamptz, p_verified_by text, p_verified_how text,
  p_is_demo boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.tickets where ref = p_ref;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.tickets
    (ref, title, detail, type, severity, status, source, found_at, found_by,
     fix_commit, fix_migration, fixed_at, verified_at, verified_by, verified_how, is_demo)
  values
    (p_ref, p_title, p_detail, p_type, p_severity, p_status, p_source, p_found_at, p_found_by,
     p_fix_commit, p_fix_migration, p_fixed_at, p_verified_at, p_verified_by, p_verified_how, p_is_demo)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.seed_link(p_ref text, p_kind text, p_target text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_links (ticket_id, kind, ref, note)
  select t.id, p_kind, p_target, p_note
  from public.tickets t
  where t.ref = p_ref
  on conflict (ticket_id, kind, ref) do nothing;
end;
$$;

-- ============================================================
-- REAL — verified
-- ============================================================

select public.seed_ticket(
  'TCK-0001',
  'context_page_agents leaked the agent library to anonymous callers',
  'Migration 0021 created the view without security_invoker. A Postgres view runs with the privileges of its OWNER, not the caller, so row-level security on public.agents was never consulted. An anonymous GET with the publishable key returned all 88 rows: every agent_id, layer, department, lifecycle, risk ceiling and spec_path, plus the full map of which context pack each agent loads. The base table refused anonymous reads correctly the entire time; the view over it did not. Exposure was not limited to anonymous callers - a signed-in user with no role assigned could read it too, because an owner-rights view never consults the authenticated policy either.',
  'incident', 'high', 'verified', 'incident',
  timestamptz '2026-08-16 19:20:00+00', 'anonymous endpoint probe after 0021/0022 were applied',
  null, '0023', timestamptz '2026-08-16 19:40:00+00',
  timestamptz '2026-08-16 19:55:00+00', 'anonymous endpoint probe',
  'GET /rest/v1/context_page_agents?select=* with the publishable key returned HTTP 401 after the fix, where it had returned 88 rows before it. All four other views (agent_spend_summary, agent_spend_monthly, agent_performance, invoice_balances) and all three base tables returned 0 rows in the same sweep. Verified from outside the database, not by the migration''s own self-check - which was itself defective, see TCK-0002.',
  false
);

select public.seed_link('TCK-0001', 'migration', '0021', 'introduced the defect');
select public.seed_link('TCK-0001', 'migration', '0023', 'the fix');
select public.seed_link('TCK-0001', 'commit', 'f303e0c', 'fix committed');
select public.seed_link('TCK-0001', 'file', 'supabase/migrations/0021_context_pages.sql', 'view definition, fixed at source');
select public.seed_link('TCK-0001', 'constitution', '3.12', 'Legal and Governance by Design');

-- ============================================================
-- REAL — open. Confirmed by adversarial review 2026-08-16.
-- ============================================================

select public.seed_ticket('TCK-0002',
  'The security fix in 0023 carries a self-check that can never run',
  'The DO block revokes anon''s access three lines before trying to read the view AS anon, so the read always raises 42501, which the handler catches and reports as "could not assume the anon role". It prints the same reassuring notice whether security_invoker took effect or not. Had the check ever fired, the bare RAISE EXCEPTION would have aborted the script - and because the SQL Editor runs a paste as one transaction, the proof would have rolled back the fix on exactly the run where it was needed. The check also only ever examined anon, while the original leak exposed the view to every role.',
  'security', 'high', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - sql lens, confirmed by three independent verifiers',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0002', 'migration', '0023', 'the defective self-check');
select public.seed_link('TCK-0002', 'file', 'supabase/migrations/0023_fix_context_view_rls.sql', 'lines 39-67');
select public.seed_link('TCK-0002', 'constitution', '3.5', 'Independent evaluation - a check that cannot fail is not one');

select public.seed_ticket('TCK-0003',
  'Context page versions can be backdated - the guard never fires',
  'stamp_context_version reads "Force the capture clock, so a caller cannot backdate a version", but the guard is `if new.captured_at is null`. Postgres applies a column DEFAULT during query rewriting, before any BEFORE trigger runs, so captured_at is never null by the time the trigger sees it. The column is fully caller-controlled. Fix by assigning unconditionally rather than testing for null - the pattern 0024 uses.',
  'security', 'medium', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - generated-sql lens',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0003', 'migration', '0021', 'stamp_context_version');
select public.seed_link('TCK-0003', 'ctx', 'CTX-003', 'version history is what makes a Class 3 change auditable');

select public.seed_ticket('TCK-0004',
  'An agent rename crashes the Context reader',
  'linkify builds a RegExp by joining every agent_id into one alternation, escaping only the hyphen. Agent ids are not authored in this repo: scripts/ingest/sources.mjs maps each key of config/spend_policy.yaml - a file on the governed plane - straight into agent_id, and ingest_agents inserts it after only a non-empty check. Renaming an agent to something containing a regex metacharacter, such as mkt-writer-v1.2 or swx-clinical-evidence (retired), throws when the reader renders. No attacker required.',
  'break-fix', 'medium', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - render lens',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0004', 'file', 'app/(app)/it/agent-platform/context.tsx', 'linkify, agentRe construction');
select public.seed_link('TCK-0004', 'agent', 'mkt-linkedin-writer', 'ingested agent id, not authored here');

select public.seed_ticket('TCK-0005',
  'The "captured to history" tile counts seeded rows, not captures',
  'The tile reads from context_pages, which 0021 seeds with twelve rows carrying an empty sha256 and no version history at all. Between running 0021 and 0022 the tile therefore claimed twelve pages were captured when zero were. It counts the existence of a row, not the existence of a capture.',
  'honesty', 'medium', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - render lens',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0005', 'file', 'app/(app)/it/agent-platform/context.tsx', 'ContextIndex tiles');

select public.seed_ticket('TCK-0006',
  'linkify rewrites inside inline code spans, shredding them',
  'The only exclusion is a fenced code block at column zero. An inline code span whose content is a CTX id plus other characters falls through to the bare-id branch and gets a markdown link spliced into the middle of it. Latent: no document on disk triggers it today, which is exactly why it will not be noticed when one does.',
  'break-fix', 'medium', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - render lens',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0006', 'file', 'app/(app)/it/agent-platform/context.tsx', 'linkify');

select public.seed_ticket('TCK-0007',
  'The app counts one more line than MANIFEST.sha256 does, on every file',
  'manifest.mjs counts newlines and adds one only when the file does not end in a newline. capture-context.mjs and lib/context-packs.ts both use split("\n").length, which counts the empty string after a trailing newline. Every governed document ends in a newline, so the two rules differ by exactly one, always. The sha256 and bytes agree across all three tools - only the line count does not. Drift detection keys on the hash, so this misleads a human reconciling the screen against the manifest but cannot mask real drift.',
  'maintenance', 'low', 'open', 'review',
  timestamptz '2026-08-16 20:30:00+00', 'adversarial review - generated-sql lens',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0007', 'file', 'scripts/governance/capture-context.mjs', 'line 78');
select public.seed_link('TCK-0007', 'file', 'lib/context-packs.ts', 'line 63');

-- ---------- Verified earlier, still open ----------

select public.seed_ticket('TCK-0008',
  'The Contracts key can read every employment contract FILE',
  'Migration 0012 scoped the Contracts key away from employment ROWS, on the stated rule that vendor-paperwork duty confers no right to read staff NDAs and offers. The storage policy on the contracts bucket has no matching category test, and storage.objects SELECT is what the Storage list endpoint checks - so a holder can enumerate the bucket with their own session and mint a signed URL for anything in it. Because the only upload path never sets a category and the column defaults to employment, every file in the bucket is an employment contract: the grant exposes all of what the row policy protects and none of what the key is entitled to.',
  'incident', 'high', 'open', 'review',
  timestamptz '2026-08-16 18:00:00+00', 'cross-slice review, confirmed by two independent verifiers',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0008', 'migration', '0012', 'contracts_objects_select');
select public.seed_link('TCK-0008', 'constitution', '3.12', 'Legal and Governance by Design');

select public.seed_ticket('TCK-0009',
  'A delegated access admin sees false account links, and one Save destroys them',
  'profiles has one SELECT policy, written in 0001 and never widened: id = auth.uid() or is_owner(). Three later places grant IT: Identity & Access the account-linking capability, but the profile being linked TO is read through that policy, so a non-owner admin''s picker returns only themselves. Every other member displays as "no linked account" while the warning text is suppressed because profile_id is truthy. Pressing Save on such a row writes profile_id = null and silently revokes that person''s access. The screen for auditing access misreports it and breaks it on contact.',
  'security', 'high', 'open', 'review',
  timestamptz '2026-08-16 18:00:00+00', 'cross-slice review, confirmed by two independent verifiers',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0009', 'migration', '0001', 'profiles_select_self_or_owner');
select public.seed_link('TCK-0009', 'file', 'app/(app)/it/identity-access/team-panel.tsx', 'LinkAccountForm');

select public.seed_ticket('TCK-0010',
  'Expired and expiring contracts are colour-coded backwards',
  'On the company Contracts screen a lapsed agreement gets the green chip and a merely-expiring one gets the red chip - inverted from every other screen in the app, where t-hi is green for good and t-lo is red for bad. Scanning the list, the rows needing attention look resolved. Confirmed by reading os.css and every other consumer of those classes.',
  'honesty', 'medium', 'open', 'manual',
  timestamptz '2026-08-16 18:10:00+00', 'checked directly against os.css and all call sites',
  null, null, null, null, null, null, false);
select public.seed_link('TCK-0010', 'file', 'app/(app)/contracts/editor.tsx', 'expired / expiring chips');

-- ============================================================
-- UNVERIFIED — raised, never confirmed or refuted.
-- The review that produced these hit a usage limit before its verifiers
-- ran. Recorded so they cannot silently become "not a problem".
-- ============================================================

select public.seed_ticket('TCK-0011', 'HR: Team can delete a person, cascading away every role assignment',
  'team_members_write_perm is FOR ALL, so it covers DELETE, and role_assignments cascades. Referential actions run as the system and are not filtered by the child table''s RLS, so deleting people removes assignments only IT: Identity & Access is permitted to touch. A bulk delete could lock out every non-owner.',
  'security', 'high', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);
select public.seed_link('TCK-0011', 'migration', '0004', 'team_members_write_perm');

select public.seed_ticket('TCK-0012', 'Re-running 0007 resurrects the DELETE policy on the review archive',
  '0008 drops security_reports_delete_owner and the Zero-Day screen then promises entries cannot be deleted by anyone. Nothing stops 0007 being pasted again, and neither 0007 nor 0008 carries an ordering warning. Twelve screens actively instruct the operator to re-run a migration as the diagnosis for any failure.',
  'security', 'high', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);
select public.seed_link('TCK-0012', 'migration', '0007', 'security_reports_delete_owner');

select public.seed_ticket('TCK-0013', 'Anyone can forge an account_requests consent record',
  'The public insert policy constrains only that email is not null and status is pending. The NDA flags, version and accepted_at are all caller-supplied, and the publishable key is in every browser by design. 0011''s freeze trigger then makes the forgery permanently uncorrectable.',
  'security', 'high', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);
select public.seed_link('TCK-0013', 'migration', '0003', 'areq_insert_public');

select public.seed_ticket('TCK-0014', 'The dashboard security-reviews tile reads 0 for most of the company',
  'The tile counts security_reports, which RLS restricts to two keys. For everyone else PostgREST returns 0 with no error, so the home screen states as fact that no review has ever been run. The destructuring also drops the error, so a failed query renders identically.',
  'honesty', 'high', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);
select public.seed_link('TCK-0014', 'file', 'app/(app)/dashboard/page.tsx', 'count tiles');

select public.seed_ticket('TCK-0015', 'Products: Manage cascade-deletes data governed by three other keys',
  'The key has no app surface at all, but via the API deleting a product cascades away product_areas, websites and plan_items - each gated behind a different Products key. Tagged agents also have product_id nulled and reappear as company-wide everywhere.',
  'security', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0016', 'Every role-holder can read the whole permission matrix through the API',
  'Every *_select_access policy is has_access(), which any 2FA''d role-holder satisfies - including on roles (with its permissions jsonb), role_assignments and team_members. The screens are gated on keys; the data is not.',
  'security', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0017', 'Security Tooling: Change Management reads every employment contract',
  '0012 applied its privacy rule to the Contracts key but left this one as an unconditional read of the whole table, plus the storage bucket and the download route.',
  'security', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0018', 'Products: Change Log can forge a class-3 company change',
  'The insert policy constrains only the author, not product, module or change_class, so a product contributor can write what reads on the Security screen as an executive-approved company change.',
  'security', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0019', 'The consent-freeze trigger makes 0005''s email normalisation a no-op',
  'The trigger restores the old email on every update with no role guard, so 0005''s repair statement writes the old value straight back. Case-variant duplicate requests can never be normalised.',
  'maintenance', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0020', 'Both permission helpers turn a query failure into "you are not allowed"',
  'checkPerm and getPermissions discard the error and return false or an empty set, so a transient Supabase failure is indistinguishable from a revocation. The user is redirected with no error shown anywhere.',
  'honesty', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0021', 'Two permission keys grant nothing anywhere in the system',
  'HR: Constitution and Products: Agents appear in no RLS policy and no app check. Both screens they name are open to every role-holder, so ticking or unticking the boxes changes nothing in either direction.',
  'governance-drift', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0022', 'team_members.status is inert end to end',
  'Nothing writes it, no access helper reads it, and HR / Team hard-codes the green Live badge regardless of value. A row reading "departed" is green and that person keeps every permission.',
  'break-fix', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0023', 'One login can be linked to several team member rows',
  'There is no unique constraint on team_members.profile_id, and permission resolution matches ANY row. Off-boarding the visible row does not revoke access if a duplicate carries the role.',
  'security', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0024', 'Twelve screens blame every failure on an unapplied migration',
  'Each names a migration that is now applied. Following that instruction on a transient error re-runs an older file and can silently revert a later security tightening.',
  'honesty', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0025', 'HR / Team shows "no contracts on file" to viewers forbidden from reading contracts',
  'The page is open to every role-holder and joins contracts with no permission check. RLS returns an empty array, which renders identically to genuinely having none, under a lead promising a live join.',
  'honesty', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0026', 'Company Contracts tiles label a per-viewer subset as company totals',
  'All four tiles count the RLS-filtered result, and the two risk tiles turn green when the viewer''s filtered slice is empty - an all-clear derived from rows they were forbidden to count.',
  'honesty', 'medium', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0027', 'HR: Team is written as a peer of the owner on account requests',
  'It sees every applicant''s name, email, NDA version and consent timestamps - including declined applicants who never joined - and can flip any decision. The access administrator cannot see the queue at all.',
  'security', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0028', 'Seeded reviews are permanently unattributed',
  '0008''s "filed by migration" backfill runs before 0009 and 0013 insert the rows it was written for, so every archived review shows no author on the one screen whose purpose is recording who filed what.',
  'maintenance', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0029', 'The name on a frozen consent record can still be rewritten',
  'The freeze trigger restores every consent column except name, which is what the queue renders in bold above the badges.',
  'maintenance', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0030', 'IT: Agent Platform silently carries write on the infrastructure inventory',
  'Including the row that labels the governed model plane D3, while the page tells that key''s holders editing is not built.',
  'governance-drift', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0031', 'Reverting a decided account request can surface a raw database error',
  'Moving an older declined row back to pending collides with the partial unique index when a newer pending row exists, and the screen shows the duplicate-key error with no explanation.',
  'break-fix', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

select public.seed_ticket('TCK-0032', 'The Infrastructure note prescribes an edit that cannot work',
  'It tells IT to change the inventory by editing migration 0012, but the seed is guarded on name with no conflict update - re-running cannot change an existing row, and renaming creates a duplicate.',
  'docs', 'low', 'unverified', 'review', timestamptz '2026-08-16 18:00:00+00', 'cross-slice review - verifier never ran', null, null, null, null, null, null, false);

-- ============================================================
-- DEMO — exercises the full trace against rows that already exist.
-- Remove with:  delete from public.tickets where is_demo;
-- ============================================================

select public.seed_ticket('TCK-9001',
  'DEMO — Soundwiserx clinical claim shipped without a second evaluator',
  'A worked example, not a real defect. Follow the chain: Constitution 3.5 requires independent evaluation; CTX-003 turns that into a decision table setting how many evaluators a Critical-tier output needs; eval-adversarial is one of the agents that loads CTX-003; WO-SOUNDWISERX-9001 is the work order it ran under. This ticket exists so the trace can be walked end to end before real records are in.',
  'governance-drift', 'high', 'open', 'manual',
  timestamptz '2026-08-16 21:00:00+00', 'demo data',
  null, null, null, null, null, null, true);
select public.seed_link('TCK-9001', 'constitution', '3.5', 'Independent evaluation');
select public.seed_link('TCK-9001', 'ctx', 'CTX-003', 'sets evaluator count by tier');
select public.seed_link('TCK-9001', 'ctx', 'CTX-005', 'Soundwiserx brand and claim rules');
select public.seed_link('TCK-9001', 'agent', 'eval-adversarial', 'loads CTX-003');
select public.seed_link('TCK-9001', 'agent', 'gov-compliance-reviewer', 'owns the compliance verdict');
select public.seed_link('TCK-9001', 'work_order', 'WO-SOUNDWISERX-9001', 'the run in question');

select public.seed_ticket('TCK-9002',
  'DEMO — Education pilot evidence cited a source outside the approved set',
  'A second worked example, closed rather than open, so the board shows both ends of the lifecycle and the verified state can be seen carrying real evidence rather than a claim.',
  'break-fix', 'medium', 'verified', 'manual',
  timestamptz '2026-08-16 21:00:00+00', 'demo data',
  'demo-commit', null, timestamptz '2026-08-16 21:10:00+00',
  timestamptz '2026-08-16 21:20:00+00', 'demo data',
  'Demo evidence. A real entry here records what was OBSERVED - a command run, a response code, a query result - not that someone believes the fix works.',
  true);
select public.seed_link('TCK-9002', 'constitution', '3.11', 'Documentation as an Enterprise Asset');
select public.seed_link('TCK-9002', 'ctx', 'CTX-008', 'Evidence and citation standard');
select public.seed_link('TCK-9002', 'agent', 'sqe-pilot-evidence', 'the agent that produced the output');
select public.seed_link('TCK-9002', 'work_order', 'WO-EDUCATION-9001', 'the run in question');

-- The seed helpers exist only to make this file re-runnable. Drop them so
-- they cannot be mistaken for part of the application's surface.
drop function if exists public.seed_ticket(text, text, text, text, text, text, text, timestamptz, text, text, text, timestamptz, timestamptz, text, text, boolean);
drop function if exists public.seed_link(text, text, text, text);
