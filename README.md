# Scout Quest Inc — Company OS

Internal operating system for Scout Quest Inc. Core loop: sign in → add a team
member → reload → still there. Access model: anyone can create an account
(signing the NDA + privacy notice electronically), but nobody enters until the
owner assigns them a role; non-owner accounts also require TOTP 2FA. The owner
account always gets in with just email + password — lockout-proof by design.

**Stack:** Next.js (App Router) · Supabase (Auth + Postgres with RLS) · Tailwind.

## Two hand-built HTML files drive the look — do not recreate them

**`index.html`** at the repo root **is** the live marketing site, served
verbatim by `app/route.ts` at `/`. Edit that file directly; every save shows
up on the next request. The app injects exactly one thing:
`public/login-wire.js`, which binds the page's existing form ids
(`lg-signin`, `lg-create`, `lg-reset`) to real Supabase auth. If those ids
change in the HTML, update the wire script to match.

**`SCOUT_QUEST_INC_COMPANY_OS.html`** at the repo root is the design source
for the signed-in Company OS. Its stylesheet is extracted and scoped under
`.os` by `scripts/extract-os-css.mjs` into `app/(app)/os.css`:

```bash
node scripts/extract-os-css.mjs
```

The OS screens can't be served verbatim like the marketing page — they read
and write the database — so the app reuses the design's markup and classes
(`.card`, `.tile`, `.modcard`, `.badge`, `.tag`, `.finding`, `.crumbs`) with
live data. When the design changes, re-run the script and adjust markup;
never redesign the screens from scratch.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values. The publishable
   key is browser-safe; `SUPABASE_SECRET_KEY` is server-only, never
   `NEXT_PUBLIC_`, never committed. Nothing uses it yet.
3. Run the migrations **in order** — paste each into Supabase → SQL Editor →
   Run every file in `supabase/migrations/` in filename order — currently
   `0001` … `0011`, and any later ones as they land (see
   [supabase/migrations/](supabase/migrations/)). Re-running an older file
   loosens what a later one tightened, so always re-run the later ones after
   it. Migrate before deploying app code that expects the schema.
   `0006` creates the private `contracts` storage bucket (and forces it
   private if it already exists), so no dashboard step is needed.
   If Supabase warns about row-level security, choose **"Run without RLS"** —
   the migrations enable it themselves, and Supabase's auto-added statement
   is malformed for this schema.
4. Supabase → Authentication → Sign In / Providers → Email: **Confirm email
   OFF** for the private beta (accounts are created by the owner, so there is
   no self-signup to confirm; password reset has its own flow at
   `/reset-password`). Multi-Factor: TOTP enabled (default).
5. `npm run dev` → http://localhost:3000 → sign in from the page's sign-in
   box.

## Access model

- **Owner** (`is_owner`, guaranteed by migration for the owner email): always
  in with password only; sees IT › Identity & Access.
- **Everyone else:** request an account from the site's sign-in box (name +
  email + NDA/privacy consent, recorded as an electronic signature in
  `account_requests`) → the owner reviews and creates the login in Supabase →
  they enroll TOTP 2FA at `/mfa` → they wait at `/pending` until the owner
  assigns a role in IT › Identity & Access.
- Enforced in the database, not just the UI: `has_access()` requires
  owner OR (role assigned AND an aal2 session), so a stolen password without
  the 2FA device gets nothing from the REST API either. Writes additionally
  require the matching `has_perm('Module: Tab')` key.
- Lost 2FA device: the owner deletes the user in Supabase → Authentication →
  Users and re-creates them. (In-app recovery is a later stage.)

## Guarantees

- **RLS on** for every table (`profiles`, `team_members`, `roles`).
- **Secret never in the browser:** `npm run build` runs
  `scripts/check-client-bundle.mjs` (postbuild), which fails the build if
  `sb_secret` or `SUPABASE_SECRET_KEY` appears anywhere in `.next/static`.
- `is_owner` is decided in SQL (trigger keyed to auth.users + RLS checks) —
  the client cannot self-escalate, and self-inserted profile rows cannot
  carry a role or a forged consent record.

## Structure

- `index.html` — **the live public site**, hand-authored; edit it directly
- `app/route.ts` — serves `index.html` at `/` and injects the login wiring
- `public/login-wire.js` — binds the page's form ids to Supabase auth
- `app/auth/` — `login`, `request-account`, `reset`, `signout` route handlers
  (all same-origin-checked)
- `app/reset-password/` — sets a new password from a reset-email link
- `proxy.ts` — session refresh + auth redirect (Next 16 successor to middleware)
- `lib/supabase/` — browser and server Supabase clients
- `lib/permission-keys.ts` — canonical permission keys (must match the RLS
  policies byte for byte)
- `app/legal/` — NDA and privacy notice (ported from Scout Quest Education)
- `app/mfa/` — TOTP enrollment + verification
- `app/pending/` — signed-in, role-less waiting room
- `app/(app)/` — authenticated shell (sidebar); dashboard at `/dashboard`
- `app/(app)/hr/team/` — HR › Team: live list + Add member
- `app/(app)/it/identity-access/` — roles builder, role assignment, account
  linking (needs `IT: Identity & Access`)
- `supabase/migrations/` — SQL to paste into the Supabase SQL Editor, in order

## Architecture doc & deliberate deviations

[SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md](SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md)
is the schema/auth source of truth. The live migrations implement it as a
superset with four deliberate deviations (all owner-ruled or review-driven):

1. **Strict reads** — the doc says any authenticated user can read
   non-sensitive tables; the owner ruled stricter: no role → no reads,
   role-less users see only the awaiting-role page (`has_access()` gates
   every non-sensitive select).
2. **In-app 2FA** — mandatory TOTP for non-owner accounts (owner exempt,
   anti-lockout ruling), enforced at the RLS layer via the `aal` claim —
   on top of the doc's account-level 2FA requirement for Supabase/Vercel.
3. **Consent records** — `profiles` carries NDA/privacy acceptance columns
   (electronic signature at account request); the doc's `name` is
   `full_name` here.
4. **Review hardening** — account-link guard trigger on
   `team_members.profile_id`, delete-restricted `contracts` FK, and
   `change_log.created_by` bound to the real author.

## Stage 2/3 remainder

Identity & Access screen (roles builder + assignment + account-request
queue), then contracts, boards, work orders, change log, mission/values per
module — schema already live via migration 0003. Stage 3: ledger/git ingest
seams.
