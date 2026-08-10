-- 0020 — Eight worked examples through the work-order lifecycle.
--
-- Change class: 1 (data only — no schema, no policy, no function, no grant).
-- No D3. No new secret. No external network.
--
-- WHY THIS EXISTS. The Work Orders tab has been empty since 0018 shipped, so
-- three screens have had nothing to say: the tab itself, Performance (every
-- column zero), and the Mind Map's cross-area edges, which are drawn ONLY
-- from work orders and so could never appear. The lifecycle was specified and
-- never demonstrated.
--
-- WHAT THESE ARE, SAID PLAINLY. They are worked examples, not a record of
-- work that happened. Every one is source='manual', which is what the screen
-- already means by "entered by hand", and each carries the marker
--   [seed:0020]
-- at the end of its objective so it can be told from real work at a glance
-- and found with one query. Delete them with 0020_DOWN.sql before the first
-- genuine work order is opened, or leave them and accept that Performance is
-- reporting on examples.
--
-- THE ONE THING THIS IS CAREFUL ABOUT. work_order_events is append-only by
-- design: no update policy, no delete policy, not for the owner either, and
-- the FK from events to work_orders is RESTRICT precisely so that deleting a
-- work order cannot silently destroy history. That makes this migration's
-- events genuinely permanent through the app — only a migration running as
-- the table owner can remove them. So the event inserts below are guarded on
-- "this work order has no events yet" rather than on conflict: re-running
-- must not append a second copy of a feed that can never be edited down.
--
-- ORDERING: run after 0019. In the Supabase SQL Editor the Role dropdown
-- beside Run must be `postgres` (the orange "Run without RLS" button named in
-- older notes no longer exists).

begin;

-- =====================================================================
-- 1. The work orders
-- =====================================================================
-- wo_code follows the generator in actions.ts exactly: WO-<PRODUCT KEY
-- UPPERCASED>-<NNNN>, or WO-OPS-<NNNN> when the work order is company-wide.
-- Numbers start at 9001 so they cannot collide with codes the app generates,
-- which count up from 0001.
--
-- Stages are spread deliberately across the machine rather than all sitting
-- at intake: one closed, one blocked (which is a SUCCESSFUL terminal state —
-- a gate did its job), one mid-remediation, and the rest live at the stages
-- where a human actually has to look.

insert into public.work_orders (
  wo_code, agent, title, description, objective, status, stage, risk_tier,
  audience, channel, data_classes, budget_ceiling_usd, requester_email,
  remediation_rounds, source, product_id, created_at, closed_at,
  approved_by, approved_at, cost_usd
) values

-- ---------- Education ----------
('WO-EDUCATION-9001', 'sqe-pilot-evidence',
 'What do the spring pilot summaries support us claiming?',
 'Register every claim the approved pilot summaries will carry, with its sample, boundary and confidence.',
 'Register every claim the approved pilot summaries will carry, with its sample, boundary and confidence. No claim leaves without a named boundary. [seed:0020]',
 'open', 'evaluate', 'high',
 'Teachers', 'Blog', 'D0, D1', 2.50, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'education'),
 now() - interval '6 days', null, null, null, 0.4180),

('WO-EDUCATION-9002', 'sqe-standards-alignment',
 'Which published standards does the Grade 4 quest map to?',
 'Map each activity to a published standard, or mark it a gap.',
 'Map each activity to a published standard, mark it a gap, or mark it NEEDS SOURCE. Confidence recorded per mapping. [seed:0020]',
 'closed', 'closed', 'medium',
 'District curriculum leads', 'Deck', 'D0, D1', 1.80, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'education'),
 now() - interval '21 days', now() - interval '14 days',
 'jessicadougherty4321@gmail.com', now() - interval '15 days', 1.2140),

-- An enterprise evaluator doing work inside a product area. This is the row
-- that makes the Mind Map's cross-area edge appear at all.
('WO-EDUCATION-9003', 'eval-factuality',
 'Factuality pass on the district one-pager',
 'Check every claim in the one-pager against its cited source.',
 'Check every claim against its cited source and sweep the body for undeclared claims. [seed:0020]',
 'open', 'adjudicate', 'high',
 'District curriculum leads', 'One-pager', 'D0, D1', 1.20, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'education'),
 now() - interval '3 days', null, null, null, 0.6900),

-- ---------- Soundwiserx ----------
('WO-SOUNDWISERX-9001', 'swx-clinical-evidence',
 'What does the literature support for the parent explainer?',
 'Answer each question from the supplied literature or mark it NEEDS SOURCE.',
 'Answer each question from the supplied literature or mark it NEEDS SOURCE. Nothing inferred beyond what is cited. [seed:0020]',
 'open', 'execute', 'critical',
 'Parents', 'Explainer', 'D0, D1', 3.00, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'soundwiserx'),
 now() - interval '2 days', null, null, null, 0.2050),

-- Blocked, and blocked correctly: CTX-005's regulatory posture is UNSET, and
-- GAP §8 records that this blocks all Soundwiserx external content. A gate
-- refusing this is the system working, not failing.
('WO-SOUNDWISERX-9002', 'swx-clinical-evidence',
 'Clinical-audience summary for the practitioner page',
 'Summarise the evidence register for a clinical audience.',
 'Summarise the evidence register for a clinical audience, within the CTX-005 boundaries. [seed:0020]',
 'open', 'blocked', 'critical',
 'Clinicians', 'Website', 'D0, D1', 3.00, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'soundwiserx'),
 now() - interval '9 days', null, null, null, 0.0000),

-- A second cross-area row, this time an enterprise governance agent working
-- inside Soundwiserx.
('WO-SOUNDWISERX-9003', 'gov-compliance-reviewer',
 'Compliance review of the parent explainer draft',
 'Check the draft for legal, regulatory, privacy and policy risk.',
 'Check every applicable domain and emit a verdict. Health claims get no benefit of the doubt. [seed:0020]',
 'open', 'validate', 'critical',
 'Parents', 'Explainer', 'D0, D1', 2.00, 'jessicadougherty4321@gmail.com',
 0, 'manual', (select id from public.products where key = 'soundwiserx'),
 now() - interval '1 day', null, null, null, 0.1120),

-- ---------- Company-wide ----------
('WO-OPS-9001', 'gov-brand-conformance',
 'Brand pass on the volunteer recruitment post',
 'Check the post against the approved brand rules for its product.',
 'Run every check against the loaded brand page and emit a verdict. [seed:0020]',
 'open', 'remediate', 'medium',
 'Prospective volunteers', 'LinkedIn', 'D0', 0.80, 'jessicadougherty4321@gmail.com',
 1, 'manual', null,
 now() - interval '5 days', null, null, null, 0.3400),

('WO-OPS-9002', 'eval-task-compliance',
 'Did the changelog summary do the task it was given?',
 'Confirm the summary covers exactly the commits in range, no more and no less.',
 'Confirm the summary covers exactly the commits in range — no scope expansion, no omission. [seed:0020]',
 'open', 'intake', 'low',
 'Internal', 'Change log', 'D0', 0.30, 'jessicadougherty4321@gmail.com',
 0, 'manual', null,
 now() - interval '4 hours', null, null, null, 0.0000)

on conflict (wo_code) do nothing;

-- =====================================================================
-- 2. The activity feeds
-- =====================================================================
-- Guarded on "no events yet" for the reason in the header: this table cannot
-- be edited down, so a second run must add nothing rather than append a
-- duplicate history.
--
-- created_by_email is NOT named in these inserts. The 0018 trigger
-- stamp_work_order_event() writes it, and naming a trigger-owned column is
-- exactly the arity mistake that aborted an earlier migration. Run from the
-- SQL Editor there is no JWT, so these land with a null author and the screen
-- renders them as "system" — which is honest: no person recorded them.

insert into public.work_order_events
  (work_order_id, kind, from_stage, to_stage, actor, actor_id, outcome, detail, cost_usd)
select w.id, e.kind, e.from_stage, e.to_stage, e.actor, e.actor_id, e.outcome, e.detail, e.cost_usd
from public.work_orders w
join (values
  -- WO-EDUCATION-9001 — walked to evaluation
  ('WO-EDUCATION-9001', 1, 'stage',  null,        'intake',    'gate',         'GATE-intake',          'pass',  'Every required field present. Objective states a boundary, so intake did not have to infer one.', null::numeric),
  ('WO-EDUCATION-9001', 2, 'stage',  'intake',    'scope',     'orchestrator', 'orch-enterprise',      'proceed','Belongs to Education. Two adjacent asks about tutor pricing were NOT folded in.', null),
  ('WO-EDUCATION-9001', 3, 'stage',  'scope',     'risk',      'orchestrator', 'orch-enterprise',      'proceed','High: outcome claims about students, published externally.', null),
  ('WO-EDUCATION-9001', 4, 'stage',  'risk',      'context',   'orchestrator', 'orch-enterprise',      'proceed','Manifest pinned: CTX-001, CTX-002, CTX-004, CTX-006, CTX-007, CTX-008, CTX-011.', null),
  ('WO-EDUCATION-9001', 5, 'gate',   'context',   'assign',    'gate',         'GATE-authz',           'pass',  'sqe-pilot-evidence is registered, enabled, ceiling critical covers High.', null),
  ('WO-EDUCATION-9001', 6, 'stage',  'assign',    'execute',   'worker',       'sqe-pilot-evidence',   'pass',  'Nine claims registered, each with sample size, boundary and confidence. Two returned NEEDS SOURCE rather than being estimated.', 0.4180),
  ('WO-EDUCATION-9001', 7, 'gate',   'execute',   'validate',  'gate',         'GATE-contract',        'pass',  'Research contract returned and mechanically valid.', null),
  ('WO-EDUCATION-9001', 8, 'stage',  'validate',  'evaluate',  'orchestrator', 'orch-enterprise',      'proceed','High tier: three sealed evaluators required. Two have reported.', null),
  ('WO-EDUCATION-9001', 9, 'verdict', null,       null,        'evaluator',    'eval-task-compliance', 'pass',  'Did the assigned task. No scope expansion.', 0.0900),
  ('WO-EDUCATION-9001', 10,'verdict', null,       null,        'evaluator',    'eval-factuality',      'conditional_pass','Seven of nine claims fully sourced. Two marked NEEDS SOURCE, which is the correct behaviour, but they must not reach a draft.', 0.2100),

  -- WO-EDUCATION-9002 — the complete path, start to finish
  ('WO-EDUCATION-9002', 1, 'stage',  null,        'intake',    'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-EDUCATION-9002', 2, 'stage',  'intake',    'scope',     'orchestrator', 'orch-enterprise',      'proceed','In scope for Education.', null),
  ('WO-EDUCATION-9002', 3, 'stage',  'scope',     'risk',      'orchestrator', 'orch-enterprise',      'proceed','Medium: district-facing, no outcome claim.', null),
  ('WO-EDUCATION-9002', 4, 'stage',  'risk',      'context',   'orchestrator', 'orch-enterprise',      'proceed','CTX-001, CTX-002, CTX-004, CTX-006, CTX-008, CTX-011 pinned.', null),
  ('WO-EDUCATION-9002', 5, 'gate',   'context',   'assign',    'gate',         'GATE-authz',           'pass',  'sqe-standards-alignment, ceiling high, covers Medium.', null),
  ('WO-EDUCATION-9002', 6, 'stage',  'assign',    'execute',   'worker',       'sqe-standards-alignment','pass','Every activity mapped, gapped, or marked NEEDS SOURCE. Four gaps found and named.', 0.5900),
  ('WO-EDUCATION-9002', 7, 'gate',   'execute',   'validate',  'gate',         'GATE-contract',        'pass',  'Contract valid.', null),
  ('WO-EDUCATION-9002', 8, 'stage',  'validate',  'evaluate',  'orchestrator', 'orch-enterprise',      'proceed','Medium tier: two evaluators.', null),
  ('WO-EDUCATION-9002', 9, 'verdict', null,       null,        'evaluator',    'eval-task-compliance', 'pass',  'Exactly the assigned task.', 0.0800),
  ('WO-EDUCATION-9002', 10,'verdict', null,       null,        'evaluator',    'gov-brand-conformance','pass',  'Conforms to the Education brand page.', 0.1400),
  ('WO-EDUCATION-9002', 11,'stage',  'evaluate',  'adjudicate','adjudicator',  'eval-adjudicator',     'pass',  'Both verdicts pass. CTX-003 table says proceed to approval.', 0.0940),
  ('WO-EDUCATION-9002', 12,'approval', 'adjudicate','approve', 'human',        'jessicadougherty4321@gmail.com','pass','Approved. The four named gaps are acceptable for a district audience because each is labelled as a gap.', null),
  ('WO-EDUCATION-9002', 13,'gate',   'approve',   'release',   'gate',         'GATE-release',         'pass',  'Destination, links, metadata and approvals all clear.', null),
  ('WO-EDUCATION-9002', 14,'gate',   'release',   'audit',     'gate',         'GATE-audit',           'pass',  'Approved action matches actual action. Record written.', null),
  ('WO-EDUCATION-9002', 15,'stage',  'audit',     'outcome',   'human',        'jessicadougherty4321@gmail.com','pass','Objective met. Lesson: naming a gap is more useful to a district than filling it badly.', null),
  ('WO-EDUCATION-9002', 16,'stage',  'outcome',   'closed',    'human',        'jessicadougherty4321@gmail.com','pass','Closed.', null),

  -- WO-EDUCATION-9003 — enterprise evaluator working inside a product
  ('WO-EDUCATION-9003', 1, 'stage',  null,        'intake',    'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-EDUCATION-9003', 2, 'stage',  'intake',    'scope',     'orchestrator', 'orch-enterprise',      'proceed','Enterprise evaluator, Education work. Allowed: the layer is inherited by every area.', null),
  ('WO-EDUCATION-9003', 3, 'stage',  'scope',     'risk',      'orchestrator', 'orch-enterprise',      'proceed','High: external, district audience.', null),
  ('WO-EDUCATION-9003', 4, 'stage',  'risk',      'context',   'orchestrator', 'orch-enterprise',      'proceed','CTX-001, CTX-008, CTX-011 pinned.', null),
  ('WO-EDUCATION-9003', 5, 'gate',   'context',   'assign',    'gate',         'GATE-authz',           'pass',  'eval-factuality registered and enabled.', null),
  ('WO-EDUCATION-9003', 6, 'stage',  'assign',    'execute',   'worker',       'eval-factuality',      'pass',  'Every claim checked against its cited source. Three unsupported, located and evidenced.', 0.5300),
  ('WO-EDUCATION-9003', 7, 'gate',   'execute',   'validate',  'gate',         'GATE-contract',        'pass',  'Verdict contract valid.', null),
  ('WO-EDUCATION-9003', 8, 'stage',  'validate',  'evaluate',  'orchestrator', 'orch-enterprise',      'proceed','Three sealed evaluators, all reported.', null),
  ('WO-EDUCATION-9003', 9, 'verdict', null,       null,        'evaluator',    'eval-adversarial',     'fail',  'Two of the three unsupported claims would read as outcome claims about named students. Veto held.', 0.1600),
  ('WO-EDUCATION-9003', 10,'stage',  'evaluate',  'adjudicate','adjudicator',  'eval-adjudicator',     null,    'Adversarial veto present. CTX-003 says remediate, not approve. Awaiting the decision.', null),

  -- WO-SOUNDWISERX-9001 — mid-execution
  ('WO-SOUNDWISERX-9001', 1, 'stage', null,       'intake',    'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-SOUNDWISERX-9001', 2, 'stage', 'intake',   'scope',     'orchestrator', 'orch-enterprise',      'proceed','Soundwiserx, parent audience.', null),
  ('WO-SOUNDWISERX-9001', 3, 'stage', 'scope',    'risk',      'orchestrator', 'orch-enterprise',      'proceed','Critical: a health claim to a parent audience. Tier may be raised later, never lowered.', null),
  ('WO-SOUNDWISERX-9001', 4, 'stage', 'risk',     'context',   'orchestrator', 'orch-enterprise',      'proceed','CTX-005 pinned at v0.9. Its regulatory posture is UNSET and that is recorded here on purpose.', null),
  ('WO-SOUNDWISERX-9001', 5, 'gate',  'context',  'assign',    'gate',         'GATE-authz',           'pass',  'swx-clinical-evidence, ceiling critical.', null),
  ('WO-SOUNDWISERX-9001', 6, 'note',  null,       null,        'worker',       'swx-clinical-evidence',null,    'Running. Eleven questions posed to the supplied literature; four answered so far.', 0.2050),

  -- WO-SOUNDWISERX-9002 — blocked, and correctly so
  ('WO-SOUNDWISERX-9002', 1, 'stage', null,       'intake',    'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-SOUNDWISERX-9002', 2, 'stage', 'intake',   'scope',     'orchestrator', 'orch-enterprise',      'proceed','Soundwiserx, clinical audience.', null),
  ('WO-SOUNDWISERX-9002', 3, 'stage', 'scope',    'risk',      'orchestrator', 'orch-enterprise',      'proceed','Critical: clinical audience, external publication.', null),
  ('WO-SOUNDWISERX-9002', 4, 'block', 'risk',     'blocked',   'gate',         'GATE-intake',          'blocked','CTX-005 regulatory posture is UNSET. GAP-ANALYSIS §8 blocks all Soundwiserx external content until it is answered with facts. This is a successful block: the gate refused work that had no approved boundary to run inside.', null),

  -- WO-SOUNDWISERX-9003 — awaiting contract validation
  ('WO-SOUNDWISERX-9003', 1, 'stage', null,       'intake',    'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-SOUNDWISERX-9003', 2, 'stage', 'intake',   'scope',     'orchestrator', 'orch-enterprise',      'proceed','Enterprise governance agent, Soundwiserx work.', null),
  ('WO-SOUNDWISERX-9003', 3, 'stage', 'scope',    'risk',      'orchestrator', 'orch-enterprise',      'proceed','Critical: health claims.', null),
  ('WO-SOUNDWISERX-9003', 4, 'stage', 'risk',     'context',   'orchestrator', 'orch-enterprise',      'proceed','CTX-005 and CTX-007 pinned.', null),
  ('WO-SOUNDWISERX-9003', 5, 'gate',  'context',  'assign',    'gate',         'GATE-authz',           'pass',  'gov-compliance-reviewer, ceiling critical.', null),
  ('WO-SOUNDWISERX-9003', 6, 'stage', 'assign',   'execute',   'worker',       'gov-compliance-reviewer','pass','Every applicable domain checked. Two findings, both located.', 0.1120),
  ('WO-SOUNDWISERX-9003', 7, 'note',  'execute',  'validate',  'gate',         'GATE-contract',        null,    'Awaiting contract check.', null),

  -- WO-OPS-9001 — one remediation round, which is the interesting column
  ('WO-OPS-9001', 1, 'stage', null,      'intake',   'gate',         'GATE-intake',          'pass',  'Fields complete.', null),
  ('WO-OPS-9001', 2, 'stage', 'intake',  'scope',    'orchestrator', 'orch-enterprise',      'proceed','Company-wide recruitment content.', null),
  ('WO-OPS-9001', 3, 'stage', 'scope',   'risk',     'orchestrator', 'orch-enterprise',      'proceed','Medium: external, no health or outcome claim.', null),
  ('WO-OPS-9001', 4, 'stage', 'risk',    'context',  'orchestrator', 'orch-enterprise',      'proceed','CTX-001, CTX-006, CTX-011 pinned.', null),
  ('WO-OPS-9001', 5, 'gate',  'context', 'assign',   'gate',         'GATE-authz',           'pass',  'gov-brand-conformance, ceiling critical.', null),
  ('WO-OPS-9001', 6, 'stage', 'assign',  'execute',  'worker',       'gov-brand-conformance','pass',  'Checks run against the loaded brand page.', 0.2200),
  ('WO-OPS-9001', 7, 'gate',  'execute', 'validate', 'gate',         'GATE-contract',        'fail',  'Verdict returned prose where the contract requires a located defect list.', null),
  ('WO-OPS-9001', 8, 'stage', 'validate','remediate','worker',       'gov-brand-conformance','pass',  'Round 1 of 3. Defects relocated to the contract shape. Two of three rounds remain before this must go to a human.', 0.1200),

  -- WO-OPS-9002 — just opened
  ('WO-OPS-9002', 1, 'stage', null,      'intake',   'gate',         'GATE-intake',          'pass',  'Fields complete. Low tier: GATE-contract only, no cloud-model review earned.', null)
) as e(code, ord, kind, from_stage, to_stage, actor, actor_id, outcome, detail, cost_usd)
  on e.code = w.wo_code
where w.source = 'manual'
  and not exists (
    select 1 from public.work_order_events x where x.work_order_id = w.id
  )
order by e.code, e.ord;

-- =====================================================================
-- 3. Record it, the way this repo records anything structural
-- =====================================================================
-- created_by_email is deliberately absent: 0008's stamp_change_log trigger
-- owns it.

insert into public.change_log (product, module, tab, change_type, description, source, source_ref)
values (
  'company', 'IT', 'Agent Platform', 'new',
  'Migration 0020 — eight worked examples seeded through the work-order lifecycle so the Work Orders tab, Performance, and the Mind Map''s cross-area edges have something to show. These are EXAMPLES, not a record of work performed: every one is source=''manual'' and carries [seed:0020] in its objective. One is closed through the full path, one is blocked by GATE-intake on CTX-005''s UNSET regulatory posture, one carries an adversarial veto awaiting adjudication, one is mid-remediation. Their event feeds are append-only and cannot be removed through the app; use 0020_DOWN.sql before real work begins. Class 1, data only.',
  'manual',
  'migration:0020_work_order_seed'
)
on conflict do nothing;

commit;

-- =====================================================================
-- Verification — expect every row 'true'
-- =====================================================================
-- select 'work orders seeded (8)' as check, (count(*) = 8)::text as result
--   from public.work_orders where objective like '%[seed:0020]%'
-- union all select 'events seeded (62)', (count(*) = 62)::text
--   from public.work_order_events e
--   join public.work_orders w on w.id = e.work_order_id
--   where w.objective like '%[seed:0020]%'
-- union all select 'one closed', (count(*) = 1)::text
--   from public.work_orders where objective like '%[seed:0020]%' and stage = 'closed'
-- union all select 'one blocked', (count(*) = 1)::text
--   from public.work_orders where objective like '%[seed:0020]%' and stage = 'blocked'
-- union all select 'no D3 anywhere', (count(*) = 0)::text
--   from public.work_orders where objective like '%[seed:0020]%'
--     and data_classes ~* '(^|[^a-z0-9])d3([^a-z0-9]|$)'
-- union all select 'cross-area rows present (3)', (count(*) = 3)::text
--   from public.work_orders w join public.agents a on a.agent_id = w.agent
--   where w.objective like '%[seed:0020]%' and a.layer = 'enterprise'
--     and w.product_id is not null;
