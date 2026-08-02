# Scout Quest Inc — Company OS

Internal operating system for Scout Quest Inc. Core loop: sign in → add a team
member → reload → still there. Access model: anyone can create an account
(signing the NDA + privacy notice electronically), but nobody enters until the
owner assigns them a role; non-owner accounts also require TOTP 2FA. The owner
account always gets in with just email + password — lockout-proof by design.

**Stack:** Next.js (App Router) · Supabase (Auth + Postgres with RLS) · Tailwind.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values. The publishable
   key is browser-safe; `SUPABASE_SECRET_KEY` is server-only, never
   `NEXT_PUBLIC_`, never committed. Nothing uses it yet.
3. Run the migrations **in order** — paste each into Supabase → SQL Editor →
   Run:
   1. [supabase/migrations/0001_stage1_profiles_team_members.sql](supabase/migrations/0001_stage1_profiles_team_members.sql)
   2. [supabase/migrations/0002_roles_signup_nda.sql](supabase/migrations/0002_roles_signup_nda.sql)
   (If you ever re-run 0001, re-run 0002 after it — 0002 tightens policies
   0001 creates. Always migrate before deploying app code that expects it.)
4. Supabase → Authentication → Sign In / Providers → Email: signups enabled;
   turn **Confirm email OFF** for the private beta (the app handles the ON
   case with a "check your email" message, but there is no reset/confirm page
   yet). Multi-Factor: TOTP enabled (default).
5. `npm run dev` → http://localhost:3000 → sign in from the landing page, or
   create an account at `/signup`.

## Access model

- **Owner** (`is_owner`, guaranteed by migration for the owner email): always
  in with password only; sees Admin › Access & roles.
- **Everyone else:** create account at `/signup` (legal name + NDA + privacy
  consent recorded as an electronic signature) → enroll TOTP 2FA at `/mfa` →
  wait at `/pending` until the owner assigns a role at `/admin/access`.
- Enforced in the database, not just the UI: `has_access()` requires
  owner OR (role assigned AND an aal2 session), so a stolen password without
  the 2FA device gets nothing from the REST API either.
- Lost 2FA device: the owner deletes the user in Supabase → Authentication →
  Users; they sign up again. (In-app recovery is a later stage.)

## Guarantees

- **RLS on** for every table (`profiles`, `team_members`, `roles`).
- **Secret never in the browser:** `npm run build` runs
  `scripts/check-client-bundle.mjs` (postbuild), which fails the build if
  `sb_secret` or `SUPABASE_SECRET_KEY` appears anywhere in `.next/static`.
- `is_owner` is decided in SQL (trigger keyed to auth.users + RLS checks) —
  the client cannot self-escalate, and self-inserted profile rows cannot
  carry a role or a forged consent record.

## Structure

- `index.html` — landing-page design reference (not served; `app/page.tsx` is
  the converted version — edit the app, not the HTML)
- `app/page.tsx` + `app/landing.module.css` — public landing with the sign-in
  card (email + password, Supabase Auth → `/dashboard`)
- `proxy.ts` — session refresh + auth redirect (Next 16 successor to middleware)
- `lib/supabase/` — browser and server Supabase clients
- `app/signup/` — account creation with NDA/privacy consent (NDA checkbox
  unlocks only after opening the NDA)
- `app/legal/` — NDA and privacy notice (ported from Scout Quest Education)
- `app/mfa/` — TOTP enrollment + verification
- `app/pending/` — signed-in, role-less waiting room
- `app/(app)/` — authenticated shell (sidebar, topbar); dashboard at
  `/dashboard`
- `app/(app)/hr/team/` — HR › Team: live list + Add member (server action insert)
- `app/(app)/admin/access/` — owner-only: create roles, assign/revoke access
- `supabase/migrations/` — SQL to paste into the Supabase SQL Editor, in order

## Stage 2 seam

Contracts, work orders, products — new tables gate on `public.has_access()`
(or finer per-role checks layered on `roles`); the shell and auth flow stay.
