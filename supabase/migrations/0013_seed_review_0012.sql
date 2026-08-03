-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0013
-- Files the adversarial review of the final module slice into the
-- Zero-Day archive, so IT › Zero-Day shows it alongside the others.
-- Guarded by source_key, so re-running is a no-op.
-- Paste into Supabase → SQL Editor → Run.
-- Requires 0007, 0008 and 0012.
-- ============================================================

insert into public.security_reports
  (source_key, title, kind, scope, ran_at, agent_count, reviewer, outcome, summary, findings, coverage)
select
  'review-0012-company-modules',
  'Contracts, Departments, Infrastructure and permission-aware navigation',
  'adversarial-review',
  'Migration 0012 + the Contracts, Departments and IT Infrastructure screens, the dashboard door model, and the HR department picker',
  timestamptz '2026-08-02 18:40:00+00',
  40,
  'Claude Code - four finder lenses (authorization, runtime correctness, navigation contract, migration safety) plus two independent verifiers per finding, one told to refute and one told to trace a concrete user',
  'fixed',
  'Six real defects found and fixed before merge. The serious one: activating the previously-dead Contracts permission key handed its holders full write access - including DELETE - over every employment contract, because the policy it was added to was declared "for all". Eighteen of the twenty-four raised findings were rejected by the verifiers as misreadings.',
  '[{"title":"Contracts key silently gained DELETE on employment contracts","severity":"high","status":"confirmed","detail":"The bare Contracts key was OR-ed into contracts_write_perm, which is declared for all, so any holder could insert, update or delete any contract row by calling PostgREST directly with their own session. The screen it was built for has no write affordance at all.","resolution":"Write access returned to HR: HR Contracts alone. Contracts is now a read key."},
    {"title":"Contracts key could read every employment contract","severity":"medium","status":"confirmed","detail":"The company-wide read grant had no row predicate, so whoever tracks vendor and district paperwork also read staff NDAs and offers on a table 0003 marked sensitive.","resolution":"The read grant is now scoped to category <> employment. HR keeps the full view."},
    {"title":"Department dropdown reverted after every save","severity":"high","status":"confirmed","detail":"Submitting a form bound to a server action makes React reset the form, so a select using defaultValue snapped back to its page-load value until revalidation landed - it looked like the save had failed.","resolution":"The select is controlled, re-synced during render when the saved value changes."},
    {"title":"Expiring within 60 days counted agreements that had already lapsed","severity":"medium","status":"confirmed","detail":"The filter had an upper bound but no lower bound, so a contract that expired years ago counted as expiring soon and the tile could never reach zero.","resolution":"Lapsed and expiring are now separate counts, compared as date strings so no timezone can shift them a day."},
    {"title":"The IT breadcrumb bounced most viewers of the new Infrastructure page","severity":"medium","status":"confirmed","detail":"Infrastructure is readable by anyone with a role, but its IT crumb was hardcoded to Identity & Access, which redirects anyone without that key straight back to the dashboard.","resolution":"The crumb resolves to the viewer first reachable IT screen, or is left unlinked."},
    {"title":"Mission & Values accepted any scope from a hidden form field","severity":"medium","status":"confirmed","detail":"The scope arrives from the client, so a product editor could create rows under invented scopes that no screen displays.","resolution":"Non-company scopes are checked against the products table before the write."},
    {"title":"Re-running 0003 or 0006 would silently revert these fixes","severity":"low","status":"confirmed","detail":"0012 replaces four policies defined in earlier files, and migrations here are pasted by hand with no runner to enforce order.","resolution":"Ordering warning added to the 0012 header naming all four policies."}]'::jsonb,
  '{"checked":["new and rewritten RLS policies in 0012","privilege reach of the newly-activated Contracts key","the claim that a visible link is always openable","server action write paths and zero-row detection","behaviour of every new screen before 0012 is applied","migration idempotence and ordering against 0003, 0006 and 0010"],
    "not_checked":["dependency vulnerabilities","runtime penetration testing against the deployed app","Supabase platform internals","whether the seeded infrastructure and department rows are factually current","anything outside this slice"]}'::jsonb
where not exists (
  select 1 from public.security_reports
  where source_key = 'review-0012-company-modules'
);
