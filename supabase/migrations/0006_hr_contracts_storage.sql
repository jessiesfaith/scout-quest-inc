-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0006
-- HR Contracts: storage policies for the PRIVATE `contracts`
-- bucket, plus the company Mission & Values row.
-- Files are reachable only through server-generated signed URLs
-- after a permission check; the bucket itself stays private.
-- Paste into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0003; create the
-- `contracts` bucket in Storage first (Public OFF).
-- ============================================================

-- ---------- Bucket: private, size-capped, type-restricted ----------
-- Privacy is enforced here, not left to a dashboard checkbox: a public
-- bucket would serve every contract file with no auth and no RLS, making
-- the policies below irrelevant for reads. Creates the bucket if it is
-- missing and forces it private if it already exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts', 'contracts', false, 10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Storage policies (bucket: contracts) ----------
-- storage.objects has RLS on by default in Supabase. Without these
-- policies nobody but the service role can touch the bucket.

drop policy if exists "contracts_objects_select" on storage.objects;
create policy "contracts_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and (
      public.has_perm('HR: HR Contracts')
      or public.has_perm('Security Tooling: Change Management')
    )
  );

drop policy if exists "contracts_objects_insert" on storage.objects;
create policy "contracts_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and public.has_perm('HR: HR Contracts')
  );

drop policy if exists "contracts_objects_update" on storage.objects;
create policy "contracts_objects_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'contracts'
    and public.has_perm('HR: HR Contracts')
  )
  with check (
    bucket_id = 'contracts'
    and public.has_perm('HR: HR Contracts')
  );

drop policy if exists "contracts_objects_delete" on storage.objects;
create policy "contracts_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and public.has_perm('HR: HR Contracts')
  );

-- ---------- Contracts: allow update/delete of the metadata row ----------
-- 0003 created contracts_write_perm as `for all`, which already covers
-- update/delete. Nothing to add — this comment documents the intent.

-- ---------- Company Mission & Values ----------
-- One row, scope='company'. The product-scoped rows arrive with the
-- Products module.

insert into public.mission_values (scope, purpose, mission, "values")
values (
  'company',
  'Build the safe frontier of learning and speech.',
  'Scout Quest Inc is an AI-native studio building education, tutoring, clinical and AI products where safety comes first — for every age — and the ambition reaches all the way to frontier intelligence.',
  '[
     {"title":"Safety first","body":"Every feature ships behind governance, review, and audit — no exceptions."},
     {"title":"Trust by design","body":"Privacy, RLS, and clear data boundaries are the default, not an add-on."},
     {"title":"Real learning","body":"Grounded in learning science and clinical rigor, not hype."},
     {"title":"Frontier ambition","body":"We aim for frontier-scale intelligence, deployed responsibly."}
   ]'::jsonb
)
on conflict (scope) do nothing;
