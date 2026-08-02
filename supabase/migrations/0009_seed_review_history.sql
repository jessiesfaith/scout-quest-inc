-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0009
-- Seeds the Zero-Day archive with the reviews already run on this
-- codebase, so it is useful from the first visit.
-- Plain inserts, guarded by source_key (added in 0008) so re-running
-- is a no-op rather than a pile of duplicates.
-- Paste into Supabase → SQL Editor → Run.
-- Requires 0007 and 0008.
-- ============================================================

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-0002-access-control',
  'Access control: signup, roles, mandatory 2FA',
  'adversarial-review',
  'Migration 0002 + signup, MFA, pending and admin screens',
  timestamptz '2026-08-02 04:20:00+00',
  26,
  'Claude Code - finder lenses plus adversarial verifiers',
  'fixed',
  'Two real security holes found and fixed before merge: 2FA was enforced only in the app, so a stolen password could read data straight from the REST API; and a self-inserted profile row could grant itself a role.',
  '[{"title":"2FA never enforced at the data layer","severity":"high","status":"confirmed","detail":"has_access() checked identity and role only, so a password-only session reached all app data through the REST API.","resolution":"has_access() now requires a 2FA-verified session for every non-owner."},
    {"title":"Self-inserted profile row could carry a role","severity":"medium","status":"confirmed","detail":"The Stage 1 self-insert policy constrained only id and is_owner, leaving role, email and consent columns writable.","resolution":"Policy tightened to reject a self-granted role, forged email and forged consent."},
    {"title":"Owner guarantee keyed to a spoofable column","severity":"medium","status":"confirmed","detail":"A forged row claiming the owner email would have been promoted to owner on re-run.","resolution":"Owner flag now keyed to the auth identity."},
    {"title":"Re-running an older migration reverts the tightening","severity":"medium","status":"confirmed","detail":"Migrations are pasted by hand, so an out-of-order re-run loosens policies with no error.","resolution":"Ordering warnings added to every migration header."}]'::jsonb,
  '{"checked":["RLS policy logic","privilege escalation paths","auth flow and redirect loops","consent record integrity","migration re-run ordering"],
    "not_checked":["dependency vulnerabilities","runtime penetration testing","Supabase platform internals"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-0002-access-control'
);

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-0003-full-schema',
  'Full-build schema and permission model',
  'adversarial-review',
  'Migration 0003 - roles, permissions, all module tables',
  timestamptz '2026-08-02 05:05:00+00',
  20,
  'Claude Code - SQL, security and compatibility lenses',
  'fixed',
  'Found a privilege-escalation path inherited from the spec: anyone with the HR Team permission could re-point a team member account link to themselves and inherit any role, including full access.',
  '[{"title":"HR Team permission could inherit any role","severity":"high","status":"confirmed","detail":"Team member writes were unrestricted per column, and permissions resolve through the account link.","resolution":"Guard trigger: only the owner or Identity and Access may set or change an account link."},
    {"title":"Deleting a team member destroyed contract records","severity":"medium","status":"confirmed","detail":"Foreign key cascades bypass row-level security entirely.","resolution":"Contracts link changed to restrict deletion."},
    {"title":"Change log author could be forged","severity":"medium","status":"confirmed","detail":"The author column was free-form on insert.","resolution":"Bound to the real caller in the insert policy."}]'::jsonb,
  '{"checked":["every RLS policy","helper function correctness","privilege escalation","migration idempotency and ordering","app compatibility during the deploy window"],
    "not_checked":["dependency vulnerabilities","load and performance","Supabase platform internals"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-0003-full-schema'
);

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-identity-access',
  'Identity and Access screen',
  'adversarial-review',
  'Roles builder, role assignment, account linking',
  timestamptz '2026-08-02 06:15:00+00',
  13,
  'Claude Code - key parity, correctness and regression lenses',
  'fixed',
  'Permission keys verified identical between the interface and the database. Found a silent no-op: linking an account reported success while nothing was written.',
  '[{"title":"Account linking silently did nothing","severity":"high","status":"confirmed","detail":"The row was invisible to the update under the write policy, so zero rows changed and no error was returned.","resolution":"Migration 0004 grants the permission; every mutating action now treats a zero-row write as an error."},
    {"title":"Access screen hid query failures","severity":"medium","status":"confirmed","detail":"Failed lookups rendered as an empty access picture on the very screen used to audit access.","resolution":"All queries surface their errors."}]'::jsonb,
  '{"checked":["permission key parity between interface and database","server action guards","zero-row write detection","stale references after refactor"],
    "not_checked":["dependency vulnerabilities","browser-level cross-site scripting fuzzing"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-identity-access'
);

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-public-site-auth',
  'Public site serving and auth endpoints',
  'adversarial-review',
  'index.html served directly plus login, request and reset handlers',
  timestamptz '2026-08-02 07:30:00+00',
  22,
  'Claude Code - auth security, wiring and regression lenses',
  'fixed',
  'Found a login forgery: any website could silently sign a visitor browser into an attacker-controlled account, because the auth endpoints accepted cross-site form posts. Confirmed by firing the attack at the running server, then re-firing it to prove the fix.',
  '[{"title":"Cross-site login forgery","severity":"high","status":"confirmed","detail":"Auth endpoints had no origin check and accepted any content type, so a form on any site could plant a session in a visitor browser.","resolution":"All mutating handlers now require same-origin headers and JSON; the attack returns 403."},
    {"title":"Reset page accepted any signed-in session","severity":"high","status":"confirmed","detail":"Anyone on an unlocked browser could set a new password without knowing the old one.","resolution":"Requires a session issued by a reset link."},
    {"title":"Auth errors revealed which emails exist","severity":"medium","status":"confirmed","detail":"Upstream messages distinguished an unknown email from a wrong password.","resolution":"Generic error text."},
    {"title":"Duplicate account requests","severity":"medium","status":"confirmed","detail":"Repeat submissions piled rows into the approval queue.","resolution":"Unique index; the API treats a repeat as success."}]'::jsonb,
  '{"checked":["cross-site request forgery on every mutating endpoint","session fixation","account enumeration","open redirects","reset flow authorization","security headers","form wiring against the real page"],
    "not_checked":["dependency vulnerabilities","denial of service and rate limits beyond platform defaults","third-party script integrity"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-public-site-auth'
);

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-hr-slice',
  'HR slice: contracts, private files, mission, constitution',
  'adversarial-review',
  'Migration 0006 plus HR screens and file storage',
  timestamptz '2026-08-02 08:40:00+00',
  27,
  'Claude Code - storage security, correctness and operations lenses',
  'fixed',
  'Bucket privacy depended on a dashboard checkbox rather than code, and contract uploads would have failed above 1 MB because of a framework limit the interface did not account for.',
  '[{"title":"Bucket privacy was an unenforced manual step","severity":"high","status":"confirmed","detail":"A public bucket would serve every contract file with no authentication and no row-level security, and nothing in code would detect it.","resolution":"The migration now creates and forces the bucket private, with a size cap and file-type list."},
    {"title":"Uploads over 1 MB silently rejected","severity":"high","status":"confirmed","detail":"The server action body limit defaults to 1 MB while the interface advertised 10 MB.","resolution":"Limit raised."},
    {"title":"Unvalidated id could escape the storage folder","severity":"medium","status":"confirmed","detail":"The team member id was placed straight into the storage path.","resolution":"Identifier validated before the path is built."},
    {"title":"Empty file type bypassed the allowed-types check","severity":"medium","status":"confirmed","detail":"A falsy check skipped validation entirely.","resolution":"Unknown types rejected; the bucket enforces the list too."},
    {"title":"Removing a value row saved the wrong text","severity":"low","status":"confirmed","detail":"Uncontrolled inputs reused page elements after removal.","resolution":"Controlled rows with stable keys."}]'::jsonb,
  '{"checked":["private file access paths","signed link scope and lifetime","path traversal in storage keys","file type and size enforcement","row-level security on stored objects","form and server action correctness","migration idempotency"],
    "not_checked":["malware scanning of uploaded files","dependency vulnerabilities","content inspection of stored documents"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-hr-slice'
);

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-security-zeroday',
  'Security Tooling and the Zero-Day archive itself',
  'adversarial-review',
  'Migrations 0007 and 0008 plus the change log and archive screens',
  timestamptz '2026-08-02 12:10:00+00',
  29,
  'Claude Code - integrity, correctness and guide-accuracy lenses',
  'fixed',
  'A lens auditing the truthfulness of this page own reviewer guide found it overstating what the review process does; the guide was rewritten to say what is actually true. Separately, the append-only promise was thinner than advertised.',
  '[{"title":"Entries could be backdated","severity":"high","status":"confirmed","detail":"Timestamps were supplied by whoever filed the entry, so an append-only log could still be made to lie about when something happened.","resolution":"Database triggers force the clock and the author on every insert."},
    {"title":"The archive could be wiped by one call","severity":"medium","status":"confirmed","detail":"An owner-scoped delete meant delete-then-reinsert was an edit with extra steps.","resolution":"The delete policy was removed entirely."},
    {"title":"Deleting an account erased its attribution","severity":"medium","status":"confirmed","detail":"Removing a person blanked their name from every entry they had ever filed, bypassing row-level security.","resolution":"Author snapshotted as text at insert time."},
    {"title":"The reviewer guide overstated the process","severity":"high","status":"confirmed","detail":"It claimed independent grading, retained dismissed findings, and outcome verification that the process does not actually perform.","resolution":"Guide rewritten: reviews are a strong second opinion, not an independent audit, and the limits are stated plainly."}]'::jsonb,
  '{"checked":["append-only guarantees","timestamp and author integrity","policy gaps on the archive","truthfulness of the reviewer guide against the real process","screen correctness"],
    "not_checked":["dependency vulnerabilities","whether migrations were applied to the live database","platform configuration"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-security-zeroday'
);
