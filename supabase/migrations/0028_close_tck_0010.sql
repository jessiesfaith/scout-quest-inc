-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0028
-- Closes TCK-0010: expired and expiring contracts were colour-coded
-- backwards on the Company Contracts screen.
--
-- Fixed in code (see fix_commit). This file records the evidence and
-- moves the ticket; it changes no schema.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run. Requires 0025.
-- ============================================================

update public.tickets set status = 'fixed',
  fix_commit = 'ce2340d', fixed_at = now()
  where ref = 'TCK-0010' and status = 'open';

update public.tickets set status = 'verified',
  verified_at = now(), verified_by = 'source inspection against os.css',
  verified_how = 'app/(app)/contracts/editor.tsx now renders a lapsed agreement with class t-lo and an expiring one with t-med. os.css defines .t-lo as background var(--danger) with white text and .t-med as var(--warn-soft)/var(--warn); .t-hi (green) is no longer used for either state. This matches every other consumer in the app: hr/team and hr/contracts give a COMPLETE contract t-hi and pending t-med; zero-day gives HIGH severity t-lo; change-log gives class 3+ t-lo. Before the fix, expired was t-hi (green) and expiring was t-lo (red) - an agreement past its end date read as resolved and one with 45 days left read as an emergency.'
  where ref = 'TCK-0010' and status = 'fixed';

insert into public.ticket_links (ticket_id, kind, ref, note)
select t.id, v.kind, v.ref, v.note
from (values
  ('TCK-0010', 'commit', 'ce2340d', 'the fix'),
  ('TCK-0010', 'file', 'app/(app)/contracts/editor.tsx', 'the two chips')
) as v(ref_, kind, ref, note)
join public.tickets t on t.ref = v.ref_
on conflict (ticket_id, kind, ref) do nothing;

do $$
declare s text;
begin
  select status into s from public.tickets where ref = 'TCK-0010';
  if s is distinct from 'verified' then
    raise exception '0028: TCK-0010 is % - expected verified (already moved, or the ref differs)', coalesce(s, 'missing');
  end if;
  raise notice '0028: TCK-0010 verified.';
end
$$;
