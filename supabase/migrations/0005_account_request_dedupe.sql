-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0005
-- One open account request per email: repeat submissions from the
-- public request form no longer pile duplicates into the owner's
-- queue (the API treats the unique violation as success).
-- Paste into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent). Requires 0003.
-- ============================================================

-- Normalize existing rows so the index can be built.
update public.account_requests
set email = lower(trim(email))
where email is distinct from lower(trim(email));

-- Collapse any pre-existing duplicate pending rows, keeping the oldest.
delete from public.account_requests a
using public.account_requests b
where a.status = 'pending'
  and b.status = 'pending'
  and a.email = b.email
  and a.created_at > b.created_at;

create unique index if not exists account_requests_pending_email_idx
  on public.account_requests (email)
  where status = 'pending';
