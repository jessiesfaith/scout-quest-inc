# Scout Quest Inc — Company OS

Internal operating system for Scout Quest Inc. Stage 1 skeleton: sign in → add a
team member → reload → still there. Every later module repeats this pattern.

**Stack:** Next.js (App Router) · Supabase (Auth + Postgres with RLS) · Tailwind.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values. The publishable
   key is browser-safe; `SUPABASE_SECRET_KEY` is server-only, never
   `NEXT_PUBLIC_`, never committed. Stage 1 does not use it.
3. Run the Stage 1 migration: paste
   [supabase/migrations/0001_stage1_profiles_team_members.sql](supabase/migrations/0001_stage1_profiles_team_members.sql)
   into Supabase → SQL Editor → Run.
4. Create your user: Supabase → Authentication → Users → Add user
   (email + password, auto-confirm). The owner account is seeded
   `is_owner = true` by the migration trigger.
5. `npm run dev` → http://localhost:3000 → sign in from the landing page.

## Stage 1 guarantees

- **RLS on** for every table (`profiles`, `team_members`).
- **Secret never in the browser:** `npm run build` runs
  `scripts/check-client-bundle.mjs` (postbuild), which fails the build if
  `sb_secret` or `SUPABASE_SECRET_KEY` appears anywhere in `.next/static`.
- `is_owner` is decided in SQL (signup trigger + RLS check) — the client cannot
  self-escalate.

## Structure

- `index.html` — landing-page design reference (not served; `app/page.tsx` is
  the converted version — edit the app, not the HTML)
- `app/page.tsx` + `app/landing.module.css` — public landing with the sign-in
  card (email + password, Supabase Auth → `/dashboard`)
- `proxy.ts` — session refresh + auth redirect (Next 16 successor to middleware)
- `lib/supabase/` — browser and server Supabase clients
- `app/(app)/` — authenticated shell (sidebar, topbar); dashboard at
  `/dashboard`
- `app/(app)/hr/team/` — HR › Team: live list + Add member (server action insert)
- `supabase/migrations/` — SQL to paste into the Supabase SQL Editor

## Stage 2 seam

Roles & permissions, contracts, work orders, products. The `team_members` RLS
policies are the seam: replace the two Stage 1 policies with role-based ones;
tables and app code stay.
