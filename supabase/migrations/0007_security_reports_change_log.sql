-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0007
-- Security Tooling + the IT › Zero-Day review archive.
--   * security_reports: every adversarial/eval review an agent runs,
--     archived by date and time so it can be reviewed any time.
--   * change_log gains change_class (1 | 2 | 3 | 3+) for Change
--     Management; the table stays append-only.
-- Paste into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0003.
-- ============================================================

-- ---------- Change Management: class on the change log ----------

alter table public.change_log
  add column if not exists change_class text;

-- ---------- Seeded roles get real permissions ----------
-- 0002 created Admin and Member with empty permission sets, so assigning
-- them let a person in but let them do nothing. Only fills them in if
-- they are still empty — never overwrites a role you have edited.

update public.roles
set permissions = '["ALL"]'::jsonb
where name = 'Admin' and permissions = '[]'::jsonb;

update public.roles
set permissions = '["HR: Team", "Security Tooling: Change Log"]'::jsonb
where name = 'Member' and permissions = '[]'::jsonb;

-- ---------- Security / eval report archive ----------

create table if not exists public.security_reports (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  kind          text not null default 'adversarial-review',
  -- adversarial-review | dependency-scan | secret-scan | probe | manual
  scope         text,          -- what was under review (slice, commit, area)
  commit_sha    text,
  ran_at        timestamptz not null default now(),
  agent_count   int,
  reviewer      text,          -- who/what produced it
  outcome       text not null default 'reviewed',
  -- reviewed | fixed | accepted-risk | needs-attention
  summary       text,
  findings      jsonb not null default '[]'::jsonb,
  -- [{title, severity, status: confirmed|dismissed, detail, resolution}]
  coverage      jsonb not null default '{}'::jsonb,
  -- {checked: [...], not_checked: [...]}
  created_by    uuid references public.profiles (id) on delete set null
                default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists security_reports_ran_at_idx
  on public.security_reports (ran_at desc);

alter table public.security_reports enable row level security;

-- Readable by anyone who can run the agent platform or manage change;
-- written by the agent platform (where evals are produced).
drop policy if exists "security_reports_select" on public.security_reports;
create policy "security_reports_select" on public.security_reports
  for select to authenticated
  using (
    public.has_perm('IT: Agent Platform')
    or public.has_perm('Security Tooling: Change Management')
  );

drop policy if exists "security_reports_insert" on public.security_reports;
create policy "security_reports_insert" on public.security_reports
  for insert to authenticated
  with check (
    public.has_perm('IT: Agent Platform')
    and created_by = (select auth.uid())
  );

-- Reports are an audit trail: no update policy at all, and deletes are
-- limited to the owner (mistaken entries), never bulk-editable.
drop policy if exists "security_reports_delete_owner" on public.security_reports;
create policy "security_reports_delete_owner" on public.security_reports
  for delete to authenticated
  using (public.is_owner());

-- ---------- Seed: the reviews already run on this codebase ----------
-- Real history, so the archive is useful from the first visit. Each row
-- records what the review covered and what it deliberately did not.

insert into public.security_reports
  (title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select * from (values
  (
    'Access control: signup, roles, mandatory 2FA',
    'adversarial-review',
    'Migration 0002 + signup/MFA/pending/admin screens',
    timestamptz '2026-08-02 04:20:00+00',
    26,
    'Claude Code — 4 finder lenses, adversarial verifiers',
    'fixed',
    'Two real security holes found and fixed before merge: 2FA was enforced only in the app, so a stolen password could read data straight from the REST API; and a self-inserted profile row could grant itself a role.',
    '[
      {"title":"2FA (aal2) never enforced at the data layer","severity":"high","status":"confirmed","detail":"has_access() checked identity and role only, so a password-only session reached all app data via PostgREST.","resolution":"has_access() now requires an aal2 session for every non-owner."},
      {"title":"Self-inserted profile row could carry a role","severity":"medium","status":"confirmed","detail":"The Stage 1 self-insert policy constrained only id and is_owner, leaving role_id, email and consent columns writable.","resolution":"profiles_insert_self tightened to reject role_id, forged email and forged consent."},
      {"title":"Owner guarantee keyed to spoofable profiles.email","severity":"medium","status":"confirmed","detail":"A forged row claiming the owner email would have been promoted on re-run.","resolution":"Owner flag now keyed to auth.users."},
      {"title":"Re-running 0001 silently reverts the tightening","severity":"medium","status":"confirmed","detail":"Migrations are pasted by hand, so an out-of-order re-run loosens policies with no error.","resolution":"Ordering warnings added to every migration header."}
    ]'::jsonb,
    '{"checked":["RLS policy logic","privilege escalation paths","auth flow and redirect loops","consent record integrity","migration re-run ordering"],"not_checked":["dependency CVEs","runtime penetration testing","Supabase platform internals"]}'::jsonb
  ),
  (
    'Full-build schema and permission model',
    'adversarial-review',
    'Migration 0003 — roles, has_perm, all module tables',
    timestamptz '2026-08-02 05:05:00+00',
    20,
    'Claude Code — SQL/security/app-compat lenses',
    'fixed',
    'Found a privilege-escalation path inherited from the spec: anyone with HR: Team could re-point a team member''s account link to themselves and inherit any role, including full access.',
    '[
      {"title":"HR: Team could inherit any role via account re-link","severity":"high","status":"confirmed","detail":"team_members writes were unrestricted per column, and permissions resolve through team_members.profile_id.","resolution":"Guard trigger: only the owner or IT: Identity & Access may set or change the account link."},
      {"title":"Deleting a team member silently destroyed contract records","severity":"medium","status":"confirmed","detail":"FK cascades bypass RLS entirely.","resolution":"contracts FK changed to on delete restrict."},
      {"title":"change_log author could be forged","severity":"medium","status":"confirmed","detail":"created_by was free-form on insert.","resolution":"Bound to auth.uid() in the insert policy."}
    ]'::jsonb,
    '{"checked":["every RLS policy","helper function correctness","privilege escalation","migration idempotency and ordering","app compatibility in the deploy window"],"not_checked":["dependency CVEs","load and performance","Supabase platform internals"]}'::jsonb
  ),
  (
    'Identity & Access screen',
    'adversarial-review',
    'Roles builder, assignment, account linking',
    timestamptz '2026-08-02 06:15:00+00',
    13,
    'Claude Code — key-parity/correctness/regression lenses',
    'fixed',
    'Permission keys verified byte-identical between the UI and the database. Found a silent no-op: an Identity & Access holder linking an account got a success message while nothing was written.',
    '[
      {"title":"Account linking silently no-oped for IA holders","severity":"high","status":"confirmed","detail":"The row was invisible to the update under the HR: Team-only write policy, so zero rows changed and PostgREST returned no error.","resolution":"Migration 0004 grants IA holders team_members writes; every mutating action now treats a zero-row write as an error."},
      {"title":"Access screen hid query failures","severity":"medium","status":"confirmed","detail":"Failed lookups rendered as an empty access picture on the very screen used to audit access.","resolution":"All four queries surface errors."}
    ]'::jsonb,
    '{"checked":["permission key parity UI vs RLS","server action guards","zero-row write detection","stale references after refactor"],"not_checked":["dependency CVEs","browser-level XSS fuzzing"]}'::jsonb
  ),
  (
    'Public site serving and auth endpoints',
    'adversarial-review',
    'index.html served directly + login/request/reset handlers',
    timestamptz '2026-08-02 07:30:00+00',
    22,
    'Claude Code — auth-security/wiring/regression lenses',
    'fixed',
    'Found a login-CSRF: any website could silently sign a visitor''s browser into an attacker-controlled account, because the auth endpoints accepted cross-site form posts. Confirmed by firing the attack at the running server.',
    '[
      {"title":"Login CSRF via text/plain form post","severity":"high","status":"confirmed","detail":"POST handlers had no origin check and parsed JSON regardless of content type, so a cross-site form could plant a session.","resolution":"All mutating handlers require same-origin headers and application/json; attack re-tested and now returns 403."},
      {"title":"Reset page accepted any signed-in session","severity":"high","status":"confirmed","detail":"Anyone on an unlocked browser could set a new password without knowing the old one.","resolution":"Requires a recovery-issued session."},
      {"title":"Auth errors enumerated accounts","severity":"medium","status":"confirmed","detail":"Upstream messages distinguished unknown email from wrong password.","resolution":"Generic error text."},
      {"title":"Duplicate account requests","severity":"medium","status":"confirmed","detail":"Repeat submits piled rows into the approval queue.","resolution":"Migration 0005 unique index; API treats the conflict as success."}
    ]'::jsonb,
    '{"checked":["CSRF on every mutating endpoint","session fixation","account enumeration","open redirect","reset-flow authorization","security headers","form wiring against the real HTML"],"not_checked":["dependency CVEs","DoS and rate-limit tuning beyond Supabase defaults","third-party CDN script integrity"]}'::jsonb
  ),
  (
    'HR slice: contracts, private files, mission, constitution',
    'adversarial-review',
    'Migration 0006 + HR screens and file storage',
    timestamptz '2026-08-02 08:40:00+00',
    27,
    'Claude Code — storage-security/correctness/ops lenses',
    'fixed',
    'Bucket privacy depended on a dashboard checkbox rather than code, and contract uploads would have failed above 1 MB because of a framework body limit the UI did not account for.',
    '[
      {"title":"Bucket privacy was an unasserted manual step","severity":"high","status":"confirmed","detail":"A public bucket would serve every contract file with no auth and no RLS; nothing in code would detect it.","resolution":"Migration 0006 creates and force-privates the bucket in SQL, with a size cap and mime allowlist."},
      {"title":"Uploads over 1 MB silently rejected","severity":"high","status":"confirmed","detail":"Server action body limit defaults to 1 MB while the UI advertised 10 MB.","resolution":"Body limit raised to 12 MB."},
      {"title":"Unvalidated id could escape the storage prefix","severity":"medium","status":"confirmed","detail":"The team member id was interpolated raw into the object key.","resolution":"UUID validation before the key is built."},
      {"title":"Empty content type bypassed the file-type allowlist","severity":"medium","status":"confirmed","detail":"A falsy check skipped validation entirely.","resolution":"Unknown types now rejected; bucket enforces the list too."},
      {"title":"Removing a value row saved the wrong text","severity":"low","status":"confirmed","detail":"Uncontrolled inputs keyed by index reused DOM nodes after removal.","resolution":"Controlled rows with stable keys."}
    ]'::jsonb,
    '{"checked":["private file access paths","signed URL scope and lifetime","path traversal in object keys","file type and size enforcement","RLS on storage objects","form and server action correctness","migration idempotency"],"not_checked":["malware scanning of uploaded files","dependency CVEs","content inspection of stored documents"]}'::jsonb
  )
) as seed(title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
where not exists (
  select 1 from public.security_reports r where r.title = seed.title
);
