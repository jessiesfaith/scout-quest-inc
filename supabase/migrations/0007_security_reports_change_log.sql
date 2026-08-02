-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0007
-- Security Tooling + the IT › Zero-Day review archive (schema).
--   * security_reports: every adversarial/eval review an agent runs,
--     archived by date and time so it can be reviewed any time.
--   * change_log gains change_class (1 | 2 | 3 | 3+) for Change
--     Management; the table stays append-only.
-- The historical review rows are seeded separately in 0009.
-- Paste into Supabase → SQL Editor → Run.
-- If Supabase warns about RLS, choose "Run without RLS" — this file
-- enables it itself, and Supabase's auto-added statement is wrong.
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
  scope         text,
  commit_sha    text,
  ran_at        timestamptz not null default now(),
  agent_count   int,
  reviewer      text,
  outcome       text not null default 'reviewed',
  summary       text,
  findings      jsonb not null default '[]'::jsonb,
  coverage      jsonb not null default '{}'::jsonb,
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

-- Reports are an audit trail: no update policy at all. 0008 removes the
-- delete policy entirely, making the archive truly append-only.
drop policy if exists "security_reports_delete_owner" on public.security_reports;
create policy "security_reports_delete_owner" on public.security_reports
  for delete to authenticated
  using (public.is_owner());
