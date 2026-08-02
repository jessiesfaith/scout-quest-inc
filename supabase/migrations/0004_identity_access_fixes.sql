-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0004
-- Identity & Access fix: IA holders can actually manage team
-- members. 0003's write policy required 'HR: Team' only, so an
-- 'IT: Identity & Access' holder's account-link update matched
-- zero rows and silently no-oped — even though the guard trigger
-- explicitly permits IA to set the link. Not an escalation: IA
-- holders administer the role builder and could grant themselves
-- 'HR: Team' anyway.
-- Paste into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0003; if 0003 is ever
-- re-run, re-run this file right after it.
-- ============================================================

drop policy if exists "team_members_write_perm" on public.team_members;
create policy "team_members_write_perm" on public.team_members
  for all to authenticated
  using (
    public.has_perm('HR: Team')
    or public.has_perm('IT: Identity & Access')
  )
  with check (
    public.has_perm('HR: Team')
    or public.has_perm('IT: Identity & Access')
  );
