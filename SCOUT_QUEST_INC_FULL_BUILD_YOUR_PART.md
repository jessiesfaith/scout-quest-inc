# Scout Quest Inc — Full Build: Your Part & Next Steps
*The click-by-click for the pieces only you can do, and the order everything happens in. Give the companion `CLAUDE_CODE_KICKOFF_SCOUT_QUEST_INC_FULL.md` to Claude Code; this doc is for you.*

---

## The sequence, in one line
Finish login (Stage 1) → **you run the full migration SQL** → **you create the contracts Storage bucket** → Claude Code builds **Identity & Access** → **you make a non-owner test user** to verify RLS → Claude Code builds the rest module-by-module → Vercel deploy → test.

---

## Step 1 — Confirm Stage 1 is green
Before the rest: sign in with your owner account, go to **HR → Team**, add a member, reload — it should still be there. If yes, Stage 1 is done and everything else is this pattern repeated.

## Step 2 — Run the full migration SQL
1. Claude Code will hand you **one SQL block** (from the full spec).
2. Supabase → **SQL Editor** → **New query** → paste → **Run**. (No DB password needed.)
3. It creates the remaining tables (roles, products, work orders, change log, contracts, etc.), turns **RLS on** for all of them, adds the `has_perm()` helper, and the policies.
4. If it re-runs, it's safe — tables use `if not exists`.

## Step 3 — Create the private Contracts storage bucket
1. Supabase → **Storage** → **New bucket**.
2. Name: `contracts`. **Public: OFF** (keep it private). Create.
3. That's it — files are only ever reached through server-generated signed URLs after a permission check. Never make this bucket public.

## Step 4 — Seed the products (one small SQL paste)
Run this in **SQL Editor** so the six products exist for their tabs:
```sql
insert into products (key, name) values
  ('education','Scout Quest Education'),
  ('game','Scout Quest Game'),
  ('tutor','Scout Quest Tutor'),
  ('soundwiserx','Soundwiserx'),
  ('ai-bookmark','AI Bookmark'),
  ('other','Other')
on conflict (key) do nothing;
```

## Step 5 — After Identity & Access ships: make a non-owner test user (RLS check)
This proves the permission system actually gates — the most important safety test.
1. Supabase → **Authentication → Users → Add user** → a throwaway email + password (e.g. `test@scoutquest.education`). This user is **not** the owner and has **no roles** yet.
2. Sign in as that user in the app. You should be able to **read** the non-sensitive lists but **not** add/edit anything, and **not** see contracts.
3. In **IT → Identity & Access**, as the owner, create a role (e.g. "Product Editor" with `Products: Build Board`) and assign it to that test member. Sign back in as the test user — now Build Board edits should work, and nothing else. 
4. When done, you can disable/delete the test user in Supabase.

## Step 6 — Approvals: how people get accounts
Public sign-up stays **OFF**. The marketing page's "Create account" only files a **request** (with NDA + Privacy sign-off). To approve someone:
- Review the request in the owner-only queue (Claude Code builds this), then
- Supabase → **Authentication → Users → Add user** with their email → they're in. (Their profile/team row gets created on first sign-in.)
You decide who logs in.

## Step 7 — Deploy / redeploy on Vercel
If not already deployed: **vercel.com → Add New → Project → import `scout-quest-inc`** → set the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` — the last one **without** `NEXT_PUBLIC_`) → Deploy. After that, every push auto-deploys, so new modules go live as Claude Code merges them.

## Step 8 — Test loop per module
For each new module: do the thing (add a role, a contract, a build-board row, a change-log entry) → **reload** → it persists → and a user without that permission can't do it. That's the whole proof.

---

## What I still owe you (say the word)
- The exact **Vercel click-by-click** once the skeleton is green (if you haven't deployed yet).
- Wiring the **index.html** login/create-account/reset forms to real Supabase Auth (Claude Code does this; I can spec the exact request-storage shape if needed).

## Reminders
- **Rotate** the Supabase secret you pasted in chat earlier if you haven't; it belongs only in Vercel's `SUPABASE_SECRET_KEY`.
- **No student/patient (D3) data** in this app — company/ops data only. That stays in the governed asl-gateway plane.
- Build ships in **reviewable slices**; Identity & Access is the gate — review it before the rest.
