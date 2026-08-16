-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0021
-- Context packs: a mirror of docs/agents/context/, plus the version
-- history that mirror never had.
--
-- WHY THIS EXISTS. scripts/governance/spec-vs-db.mjs states the gap in
-- its own header: "The table stores spec_path but no spec hash, so a row
-- cannot tell you which VERSION of a spec it came from." The same was
-- true of context pages, which had no table at all — they existed only
-- as comma-joined ids in agents.context_pages. So the OS could say
-- "gov-compliance-reviewer loads CTX-003" but could not say what CTX-003
-- said, when it last changed, or what changed in it.
--
-- Two sources of truth, deliberately:
--   * The FILES in docs/agents/context/ are the record. The app reads
--     them off disk, so the "current" text on screen is always exactly
--     what shipped in this deploy — it cannot drift from the build.
--   * These TABLES are the history. A capture stores what a page said at
--     a moment, so two moments can be compared. The files cannot do this
--     alone: git has the history, but the deployed app has no git.
-- The Context tab shows both and flags when they disagree.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003 and 0018.
-- ============================================================

-- ---------- The page, as last captured ----------

create table if not exists public.context_pages (
  id               text primary key,           -- 'CTX-003'
  title            text not null,
  path             text not null,              -- docs/agents/context/CTX-003-...md
  declared_version text,                       -- the "version 1.0" in the header
  sha256           text not null,
  bytes            int  not null default 0,
  lines            int  not null default 0,
  captured_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table public.context_pages enable row level security;

drop policy if exists "ctxp_select_access" on public.context_pages;
create policy "ctxp_select_access" on public.context_pages
  for select to authenticated using (public.has_access());

-- No write policy, deliberately — same idiom as 0018's ingest_state:
-- "a mirror nobody can edit". Captures arrive as generated SQL run in the
-- SQL Editor, which is service_role and bypasses RLS. Editing a context
-- page means editing its file, then re-capturing.

-- ---------- Every captured version ----------

create table if not exists public.context_page_versions (
  id               uuid primary key default gen_random_uuid(),
  page_id          text not null references public.context_pages (id) on delete cascade,
  declared_version text,
  sha256           text not null,
  content          text not null,              -- the full text at capture time
  bytes            int  not null default 0,
  lines            int  not null default 0,
  note             text,                       -- why this capture was taken
  captured_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- One row per distinct content per page: re-capturing an unchanged page is
-- a no-op rather than a pile of identical versions.
create unique index if not exists context_page_versions_page_sha_idx
  on public.context_page_versions (page_id, sha256);

create index if not exists context_page_versions_page_time_idx
  on public.context_page_versions (page_id, captured_at desc);

alter table public.context_page_versions enable row level security;

drop policy if exists "ctxpv_select_access" on public.context_page_versions;
create policy "ctxpv_select_access" on public.context_page_versions
  for select to authenticated using (public.has_access());

-- History is append-only for the same reason change_log is: a version
-- record you can quietly revise is not a version record. No update or
-- delete policy exists, so neither is possible through the API at all —
-- not even for the owner.

-- Force the capture clock, so a caller cannot backdate a version.
create or replace function public.stamp_context_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  if new.captured_at is null then
    new.captured_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists context_page_versions_stamp on public.context_page_versions;
create trigger context_page_versions_stamp
  before insert on public.context_page_versions
  for each row execute function public.stamp_context_version();

-- ---------- Which agents load which page ----------
-- agents.context_pages is a comma-joined text column, with "CTX-004|CTX-005"
-- meaning "whichever brand page matches the product". Splitting that in SQL
-- lets the reverse index be a query rather than something the app derives
-- and could derive differently on a screen someone forgets to update.

-- Split on commas FIRST, then on '|' within each group. A pack is
-- conditional when its own group contains a '|' — which is exactly what
-- parsePacks() in lib/context-packs.ts does. Flattening both separators at
-- once would lose which group a pack came from, and then "conditional"
-- would have to be guessed from the string; two implementations that guess
-- differently is worse than not having the view.
-- security_invoker so the view runs as the CALLER and inherits the RLS on
-- public.agents. Without it a view runs as its owner and RLS is bypassed
-- entirely — which is exactly what shipped here and had to be fixed in
-- 0023. Every other view in this schema carries this option; so does this
-- one now.
create or replace view public.context_page_agents
with (security_invoker = on) as
select
  trim(both from m.pack)        as page_id,
  a.agent_id,
  a.layer,
  a.department,
  a.lifecycle,
  a.risk_ceiling,
  a.spec_path,
  position('|' in g.grp) > 0    as conditional
from public.agents a
cross join lateral unnest(string_to_array(a.context_pages, ',')) as g(grp)
cross join lateral unnest(string_to_array(g.grp, '|'))           as m(pack)
where a.context_pages is not null
  and trim(both from m.pack) ~ '^CTX-[0-9]{3}$';

comment on view public.context_page_agents is
  'Reverse index: one row per (context page, agent that loads it). Derived from agents.context_pages.';

-- ---------- Seed the twelve pages ----------
-- Titles match lib/agent-library.ts CTX_TITLES. Hash/bytes/lines are left
-- at zero until the first capture; the Context tab reports a page with no
-- capture as "never captured" rather than pretending it matches the file.

insert into public.context_pages (id, title, path, declared_version, sha256)
select v.id, v.title, v.path, v.declared_version, ''
from (values
  ('CTX-000', 'Index', 'docs/agents/context/CTX-000-index.md', null),
  ('CTX-001', 'Enterprise canon', 'docs/agents/context/CTX-001-enterprise-canon.md', '1.0'),
  ('CTX-002', 'Data classes', 'docs/agents/context/CTX-002-data-classes.md', '1.0'),
  ('CTX-003', 'Risk tiers & gates', 'docs/agents/context/CTX-003-risk-tiers-and-gates.md', '1.0'),
  ('CTX-004', 'Brand — Scout Quest Education', 'docs/agents/context/CTX-004-brand-scout-quest-education.md', '0.9'),
  ('CTX-005', 'Brand — Soundwiserx', 'docs/agents/context/CTX-005-brand-soundwiserx.md', '0.9'),
  ('CTX-006', 'Audiences', 'docs/agents/context/CTX-006-audiences.md', '0.9'),
  ('CTX-007', 'Compliance boundaries', 'docs/agents/context/CTX-007-compliance-boundaries.md', '1.0'),
  ('CTX-008', 'Evidence & citation', 'docs/agents/context/CTX-008-evidence-and-citation.md', '1.0'),
  ('CTX-009', 'Channels & cadence', 'docs/agents/context/CTX-009-channels-and-cadence.md', '0.9'),
  ('CTX-010', 'Budgets & stop conditions', 'docs/agents/context/CTX-010-budgets-and-stop-conditions.md', '1.0'),
  ('CTX-011', 'Output contracts', 'docs/agents/context/CTX-011-output-contracts.md', '1.0')
) as v(id, title, path, declared_version)
where not exists (
  select 1 from public.context_pages c where c.id = v.id
);
