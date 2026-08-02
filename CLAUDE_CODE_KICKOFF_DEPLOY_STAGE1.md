# Claude Code Kickoff — Scout Quest Inc Company OS, Deploy Stage 1 (skeleton)

Build the Scout Quest Inc company OS as a real, deployable app in a **new repo**, proving the whole loop end to end: **sign in → add a team member → reload → still there.** Everything else is this pattern repeated, so build this carefully and cleanly. Class 3 change — state tradeoffs before large moves and wait for Jessica's ruling.

Design reference: `SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md` (schema, auth, RLS). Visual reference: the `agent-platform-dashboard` HTML (match its layout + styling).

## Concrete project facts
- **New repo:** create `scout-quest-inc` (private) — e.g. `gh repo create jessiesfaith/scout-quest-inc --private --source . --push` after scaffolding. This is a fresh repo, not part of scoutquest or asl-gateway.
- **Framework:** Next.js (App Router) + `@supabase/supabase-js` + `@supabase/ssr`.
- **Supabase project URL:** `https://odovdbxhsrrfpdjobiwj.supabase.co`
- **Owner (seed `is_owner = true`):** `jessicadougherty4321@gmail.com`

## Environment variables (new-style Supabase keys)
Create `.env.local` (git-ignored) and, later, the same in Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=https://odovdbxhsrrfpdjobiwj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_1GsbXCUCjI5V56bN9kf-mQ_hMyJoZcT
SUPABASE_SECRET_KEY=        # Jessica pastes the ROTATED sb_secret_... here — server-only, never in git or the client bundle
```
- The publishable key is browser-safe (goes in `NEXT_PUBLIC_...`). The secret key is server-only and **must never** be `NEXT_PUBLIC_`, committed, or logged. If Stage 1 doesn't need the secret, don't use it at all yet.

## Do this
1. **Scaffold** the Next.js app; add Supabase client (browser client with the publishable key; a server client for server components/route handlers).
2. **Migrations (Stage 1 only):** `profiles` and `team_members` per the architecture doc. **Enable RLS on both.** Deliver the SQL as a single block for Jessica to paste into Supabase → **SQL Editor** → Run (no DB password needed).
3. **Auth:** a `/login` page (email + password) using Supabase Auth. Middleware redirects unauthenticated users to `/login`. On first load, ensure a `profiles` row exists for the signed-in user; seed `is_owner = true` when the email is `jessicadougherty4321@gmail.com`.
4. **HR › Team screen:** reads `team_members` live from Supabase; an "Add member" form that **inserts** to the DB. No in-memory state — it must persist across reload.
5. **RLS (Stage 1):** authenticated users may `select` + `insert` `team_members`; `profiles` readable by the owner and by self. Leave the seam for finer permission gating in Stage 2 — don't build the full role system yet.

## Constraints
- **Secret never in the browser or git** — add an asserted check that `sb_secret` / `SUPABASE_SECRET_KEY` does not appear in the client bundle.
- **RLS on** for every table created.
- **No D3** in this app. No cloud-model key. ~$0 spend.
- Minimal — this is the skeleton, not the whole OS. No roles/contracts/work-orders/products yet.

## Definition of done
`scout-quest-inc` repo pushed; app runs locally; the migration SQL block is ready for Jessica; sign-in works with the owner account; adding a team member persists across reload; RLS on; secret provably absent from the client bundle. Then report back for the merge/hold call — and Jessica does the Vercel deploy (I'll give her the click-by-click) — before Stage 2 (roles + the rest of the tables).
