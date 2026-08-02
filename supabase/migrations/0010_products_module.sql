-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0010
-- Products module: tag agents to a product, and seed Scout Quest
-- Education's real content from the design so the boards are not
-- empty on first open.
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0003.
-- ============================================================

-- ---------- Agents can belong to a product ----------
-- The agent library is shared; product_id tags which product an agent
-- serves. Null means company-wide.

alter table public.agents
  add column if not exists product_id uuid references public.products (id) on delete set null;

-- ---------- Build Board: Scout Quest Education ----------

insert into public.product_areas (product_id, area, status, note, sort)
select p.id, v.area, v.status, v.note, v.sort
from public.products p
cross join (values
  ('Student app — Today''s Quest / My Quest / cards', 'live', 'core learner surface', 1),
  ('Exercises and labs (atom-builder, cell-explorer, math-lab)', 'building', 'library growing', 2),
  ('Parent — Family View', 'live', 'progress, comms, docs', 3),
  ('Parent control panel (time / goals / safety)', 'planned', 'WO-002 (UX Designer)', 4),
  ('Teacher surface', 'live', null, 5),
  ('District surface', 'live', null, 6),
  ('Admin Console (billing / AR / AP / contracts / audit)', 'live', 'scoutquest.education/admin.html', 7),
  ('Governed backend (ASL, Runner, Evaluator)', 'live', 'on main', 8),
  ('Agents (exgen live; tutor / summarize queued)', 'building', 'specs done, pipelines next', 9),
  ('Content safety / teacher upload pipeline', 'planned', 'scan and sandbox', 10),
  ('Identity and rostering (district integration)', 'planned', 'Clever / ClassLink / LTI', 11),
  ('Data residency / global hosting', 'building', 'local-first design', 12)
) as v(area, status, note, sort)
where p.key = 'education'
  and not exists (
    select 1 from public.product_areas x
    where x.product_id = p.id and x.area = v.area
  );

-- ---------- Plan Board: Scout Quest Education ----------

insert into public.plan_items (product_id, title, start_date, end_date, status, sort)
select p.id, v.title, v.start_date::date, v.end_date::date, v.status, v.sort
from public.products p
cross join (values
  ('Governed backend', '2026-08-01', '2026-08-31', 'live', 1),
  ('Live surfaces (student / parent / teacher / district)', '2026-08-01', '2026-09-30', 'live', 2),
  ('Admin Console', '2026-08-01', '2026-09-30', 'live', 3),
  ('Agents (exgen, tutor, summarize)', '2026-08-01', '2026-10-31', 'building', 4),
  ('Parent control panel (WO-002)', '2026-09-01', '2026-10-31', 'planned', 5),
  ('Content safety / upload pipeline', '2026-10-01', '2026-11-30', 'planned', 6),
  ('District rostering', '2026-11-01', '2026-12-31', 'planned', 7)
) as v(title, start_date, end_date, status, sort)
where p.key = 'education'
  and not exists (
    select 1 from public.plan_items x
    where x.product_id = p.id and x.title = v.title
  );

-- ---------- Websites: Scout Quest Education ----------

insert into public.websites (product_id, label, url)
select p.id, v.label, v.url
from public.products p
cross join (values
  ('Main site', 'https://www.scoutquest.education'),
  ('Admin Console', 'https://www.scoutquest.education/admin.html'),
  ('Student', 'https://www.scoutquest.education/student.html'),
  ('Parent', 'https://www.scoutquest.education/parent.html'),
  ('Teacher', 'https://www.scoutquest.education/teacher.html'),
  ('District', 'https://www.scoutquest.education/district.html')
) as v(label, url)
where p.key = 'education'
  and not exists (
    select 1 from public.websites x
    where x.product_id = p.id and x.url = v.url
  );

-- ---------- Mission and values: Scout Quest Education ----------

insert into public.mission_values (scope, purpose, mission, "values")
values (
  'education',
  'Scout Quest Education',
  'Give every student a patient, adaptive guide — and every teacher a trustworthy one.',
  '[{"title":"Teacher in control","body":"The teacher stays the authority; the AI assists and never overrides."},
    {"title":"Evidence-based pedagogy","body":"Reading and learning science drive every exercise."},
    {"title":"Accessible by default","body":"WCAG-AA, dyslexia-friendly, multilingual — no student left out."},
    {"title":"Student privacy (FERPA)","body":"Records stay protected; regulated data stays local."},
    {"title":"Safety-first","body":"Every exercise is independently evaluated before it reaches a student."}]'::jsonb
)
on conflict (scope) do nothing;

-- ---------- Consolidated plan rows for the other products ----------

insert into public.plan_items (product_id, title, start_date, end_date, status, sort)
select p.id, v.title, v.start_date::date, v.end_date::date, v.status, 1
from public.products p
join (values
  ('game',        'Scout Quest Game — in design',  '2026-09-01', '2026-12-31', 'planned'),
  ('tutor',       'Scout Quest Tutor — designing', '2026-08-01', '2026-12-31', 'building'),
  ('soundwiserx', 'Soundwiserx — building infra',  '2026-08-01', '2026-12-31', 'building'),
  ('ai-bookmark', 'AI Bookmark — planned',         '2026-09-01', '2026-11-30', 'planned')
) as v(key, title, start_date, end_date, status) on v.key = p.key
where not exists (
  select 1 from public.plan_items x
  where x.product_id = p.id and x.title = v.title
);
