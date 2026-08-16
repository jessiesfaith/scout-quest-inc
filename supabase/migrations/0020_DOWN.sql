-- 0020_DOWN — remove the seeded worked examples.
--
-- Run this before the first genuine work order is opened, or accept that
-- Performance and the Mind Map are reporting on examples.
--
-- WHY THIS HAS TO BE A MIGRATION AND NOT A BUTTON. work_order_events has no
-- delete policy for anyone, including the owner, and 0019 additionally
-- REVOKEd delete on it. The FK from events to work_orders is RESTRICT, so the
-- events must go first and a cascade cannot do it. Only a session running as
-- the table owner — this file, in the SQL Editor with Role `postgres` — can
-- remove them. That is the append-only guarantee working as designed, not an
-- obstacle to route around.
--
-- Matching is on the [seed:0020] marker in `objective`, never on wo_code
-- ranges or dates: a marker is something this migration put there on purpose,
-- whereas a code range is a guess about what someone else might have created.

begin;

-- Events first — RESTRICT means the parent cannot go while these exist.
delete from public.work_order_events e
using public.work_orders w
where e.work_order_id = w.id
  and w.source = 'manual'
  and w.objective like '%[seed:0020]%';

delete from public.work_orders
where source = 'manual'
  and objective like '%[seed:0020]%';

-- The change_log is append-only too, so the 0020 entry is NOT deleted. A
-- further entry is added instead, which is how this repo corrects a record:
-- "a wrong entry is corrected by adding a further entry, never by rewriting
-- one." created_by_email is trigger-owned and deliberately unnamed.
insert into public.change_log (product, module, tab, change_type, description, source, source_ref)
values (
  'company', 'IT', 'Agent Platform', 'removed',
  'Migration 0020_DOWN — the eight seeded worked examples and their event feeds were removed. The 0020 entry above stands: it is a record that they existed, not a claim that they still do.',
  'manual',
  'migration:0020_DOWN'
)
on conflict do nothing;

commit;

-- Verification — expect both 'true'
-- select 'seeded work orders gone' as check, (count(*) = 0)::text as result
--   from public.work_orders where objective like '%[seed:0020]%'
-- union all select 'their events gone', (count(*) = 0)::text
--   from public.work_order_events e
--   left join public.work_orders w on w.id = e.work_order_id
--   where w.id is null;
