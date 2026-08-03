-- ============================================================
-- Scout Quest Inc — Company OS — Migration 0016
-- Recovery from a lost authenticator, without deleting the account.
--
-- Until now, losing a phone meant the owner deleted the auth user and the
-- person signed up again — which also threw away their profile row, their
-- role assignments and their link to a team member. A trap for them and a
-- chore for her.
--
-- WHAT A RECOVERY CODE DOES, AND WHAT IT DOES NOT. Redeeming a code does
-- NOT sign anyone in and does NOT produce a 2FA-verified session. It does
-- exactly one thing: it removes the enrolled authenticator so a new one
-- can be enrolled. The person still needs their password, and still ends
-- up at aal2 through a real TOTP enrolment before they see any data.
-- Access is never granted by the code alone.
--
-- WHY SHA-256 AND NOT BCRYPT. These are not passwords. Each code is 100
-- bits of cryptographic randomness, so there is nothing to guess and no
-- dictionary to run — the slow-hash property that matters for
-- human-chosen secrets buys nothing here, and a fast hash keeps the
-- redemption path cheap enough to rate limit honestly.
--
-- Paste into Supabase → SQL Editor → Run.
-- If a warning dialog appears, choose "Run without RLS".
-- Safe to re-run (idempotent). Requires 0001 and 0003.
-- ============================================================

create table if not exists public.mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Hex sha-256 of the normalized code. The plaintext is shown once, at
  -- generation, and is not recoverable from here by anyone — including
  -- the owner, and including whoever holds the service key.
  code_hash  text not null,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  unique (user_id, code_hash)
);

create index if not exists mfa_recovery_codes_user_idx
  on public.mfa_recovery_codes (user_id)
  where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- No policies at all, deliberately. Not select, not insert, not anything.
-- A person must not be able to read even their own hashes: the set is
-- small and the codes are the second factor, so a readable hash column is
-- an offline attack against exactly the thing this table protects. Every
-- access goes through the security-definer functions below or through the
-- ingest-grade service key on the server.

create table if not exists public.mfa_recovery_attempts (
  id      bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now(),
  ok      boolean not null default false
);

create index if not exists mfa_recovery_attempts_user_idx
  on public.mfa_recovery_attempts (user_id, at desc);

alter table public.mfa_recovery_attempts enable row level security;
-- Same reasoning: no policies. Only the server writes here.

-- ---------- What the person may know about their own codes ----------
-- Counts and dates, never hashes. Runs as definer so it can read a table
-- the caller has no policy on, and is scoped to auth.uid() so it cannot
-- be pointed at anyone else — the usual failure of a definer function is
-- taking a user id as an argument.

create or replace function public.mfa_recovery_status()
returns table (total int, remaining int, generated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where used_at is null)::int,
    max(created_at)
  from public.mfa_recovery_codes
  where user_id = auth.uid();
$$;

revoke all on function public.mfa_recovery_status() from public, anon;
grant execute on function public.mfa_recovery_status() to authenticated;

-- ---------- Issuing a set ----------
-- Replaces any previous set: an old code must stop working the moment a
-- new sheet is printed, or "regenerate" would widen the attack surface
-- instead of resetting it. Called only for the caller's own account.
--
-- THE aal2 CHECK BELOW IS THE WHOLE SECURITY OF THIS FEATURE. Redeeming a
-- code is deliberately allowed at aal1 — that is the point of a recovery
-- code. So if issuing were also allowed at aal1, the two functions would
-- compose into a complete bypass: someone holding only a stolen password
-- could print themselves a sheet, redeem one, unenrol the real
-- authenticator and enrol their own.
--
-- It has to be here rather than in the server action that calls it.
-- PostgREST exposes every function granted to `authenticated` at
-- /rest/v1/rpc/<name>, reachable with the publishable key that ships in
-- the browser bundle — so a check that lives only in TypeScript is a
-- check an attacker simply does not run. Same idiom has_access() and
-- has_perm() use in 0003.

create or replace function public.mfa_recovery_issue(hashes text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  written int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception
      'Verify with your authenticator before generating recovery codes.';
  end if;
  if hashes is null or array_length(hashes, 1) is null then
    raise exception 'no codes supplied';
  end if;
  if array_length(hashes, 1) > 20 then
    raise exception 'too many codes';
  end if;

  delete from public.mfa_recovery_codes where user_id = uid;

  insert into public.mfa_recovery_codes (user_id, code_hash)
  select uid, h from unnest(hashes) as h;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.mfa_recovery_issue(text[]) from public, anon;
grant execute on function public.mfa_recovery_issue(text[]) to authenticated;

-- ---------- Redeeming one ----------
-- Runs for a caller who is signed in but NOT 2FA-verified — that is the
-- whole point, and it is why this function does so little. It consumes a
-- code and reports whether it was valid. Removing the authenticator is a
-- separate step taken by the server afterwards, so a bug here cannot by
-- itself unenrol anybody.
--
-- Rate limited to 10 attempts in 15 minutes. 100-bit codes are not
-- guessable, but a limit also caps how fast a stolen password can be used
-- to grind at the list, and it leaves a record that someone tried.

create or replace function public.mfa_recovery_redeem(hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  recent int;
  hit uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select count(*) into recent
  from public.mfa_recovery_attempts
  where user_id = uid
    and at > now() - interval '15 minutes'
    and ok = false;

  if recent >= 10 then
    raise exception 'Too many attempts. Wait 15 minutes and try again.';
  end if;

  select id into hit
  from public.mfa_recovery_codes
  where user_id = uid
    and code_hash = hash
    and used_at is null
  limit 1;

  if hit is null then
    insert into public.mfa_recovery_attempts (user_id, ok) values (uid, false);
    return false;
  end if;

  update public.mfa_recovery_codes set used_at = now() where id = hit;
  insert into public.mfa_recovery_attempts (user_id, ok) values (uid, true);
  return true;
end;
$$;

revoke all on function public.mfa_recovery_redeem(text) from public, anon;
grant execute on function public.mfa_recovery_redeem(text) to authenticated;

-- ---------- Giving one back ----------
-- Redeeming and unenrolling are two steps and the second can fail — the
-- admin API is a network call. Without this, a failed unenrolment leaves
-- the person one code poorer and still locked out, which is the worst
-- possible moment to lose one.
--
-- Narrow on purpose: own account only, and only a code spent in the last
-- five minutes, so it cannot be used to resurrect a sheet redeemed long
-- ago. It does not create codes and cannot be used to guess one — the
-- caller must already know the plaintext to compute the hash.

create or replace function public.mfa_recovery_unspend(hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hit uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select id into hit
  from public.mfa_recovery_codes
  where user_id = uid
    and code_hash = hash
    and used_at is not null
    and used_at > now() - interval '5 minutes'
  limit 1;

  if hit is null then
    return false;
  end if;

  update public.mfa_recovery_codes set used_at = null where id = hit;
  return true;
end;
$$;

revoke all on function public.mfa_recovery_unspend(text) from public, anon;
grant execute on function public.mfa_recovery_unspend(text) to authenticated;

-- ---------- The owner's side of it ----------
-- Identity & Access gets a "reset two-factor" action. It records who did
-- it and to whom, because removing someone's second factor is the single
-- most useful thing an attacker with an admin session could do, and an
-- unlogged capability of that shape is how it goes unnoticed.

create table if not exists public.mfa_resets (
  id           uuid primary key default gen_random_uuid(),
  target_user  uuid references auth.users (id) on delete set null,
  target_email text,
  reset_by     uuid references auth.users (id) on delete set null,
  reset_by_email text,
  reason       text,
  created_at   timestamptz not null default now()
);

alter table public.mfa_resets enable row level security;

drop policy if exists "mfa_resets_select_admin" on public.mfa_resets;
create policy "mfa_resets_select_admin" on public.mfa_resets
  for select to authenticated
  using (public.has_perm('IT: Identity & Access'));

-- INSERT is allowed for the key holder, and only INSERT: there is no
-- update or delete policy, which is what makes the table append-only.
--
-- The row is written as the caller, NOT through the service key, and that
-- is the point. Under the service key auth.uid() is null, so the trigger
-- below would fall back to whatever the caller passed as reset_by — an
-- audit trail whose actor field is supplied by the actor. Writing as
-- `authenticated` means auth.uid() is the real signed-in person and the
-- trigger can overwrite anything they claim.
drop policy if exists "mfa_resets_insert_admin" on public.mfa_resets;
create policy "mfa_resets_insert_admin" on public.mfa_resets
  for insert to authenticated
  with check (public.has_perm('IT: Identity & Access'));

create or replace function public.stamp_mfa_reset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.reset_by := coalesce(auth.uid(), new.reset_by);
  new.reset_by_email := coalesce(
    (select u.email from auth.users u where u.id = new.reset_by),
    new.reset_by_email
  );
  new.target_email := coalesce(
    (select u.email from auth.users u where u.id = new.target_user),
    new.target_email
  );
  return new;
end;
$$;

drop trigger if exists stamp_mfa_reset on public.mfa_resets;
create trigger stamp_mfa_reset
  before insert on public.mfa_resets
  for each row execute function public.stamp_mfa_reset();
