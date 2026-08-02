# Scout Quest Inc — Company OS · Session Handoff

*Written 2026-08-02 at the end of the first build session. Read this top to
bottom before touching anything; the "Rules that were learned the hard way"
section will save you from repeating mistakes that cost real time.*

---

## 1. What this is

The internal operating system for **Scout Quest Inc** — an AI platform studio.
One governed app on Supabase where HR, IT, Security, Products, Finance and
Projects all live, with roles and permissions enforced by the database rather
than the interface.

| Thing | Value |
|---|---|
| Local repo | `C:\dev\scoutquestaiinc` (note: folder name ≠ repo name, intentional) |
| GitHub | `jessiesfaith/scout-quest-inc` — **private** |
| Live app | `scout-quest-inc.vercel.app` (auto-deploys on push to `master`) |
| Supabase project | `https://odovdbxhsrrfpdjobiwj.supabase.co` (named `scout-quest-ai-inc` in the dashboard, **FREE** plan) |
| Owner account | `jessicadougherty4321@gmail.com` |
| Stack | Next.js 16 (App Router) · `@supabase/ssr` · Tailwind (marketing) + ported CSS (OS) |

**Governance:** Class 3 change. RLS on every table from day one. Secrets
server-side only. Invite-only. **No D3 (student/patient) data in this app,
ever** — company and operations data only.

---

## 2. Current state — what is done

Every module in the original kickoff is built. Git tags mark each shipped
slice, so `git checkout slice-06-hr` gets you that point exactly.

| Slice | Tag | Migration |
|---|---|---|
| Stage 1 skeleton (auth, Team persists) | `slice-01-stage1-skeleton` | 0001 |
| Access control (NDA, roles, 2FA) | `slice-02-access-control` | 0002 |
| Full schema + permission model | `slice-03-full-schema` | 0003 |
| Identity & Access screen | `slice-04-identity-access` | 0004 |
| Serve `index.html` directly, wire auth | `slice-05-serve-html` | 0005 |
| HR (contracts, mission, constitution) | `slice-06-hr` | 0006 |
| Security Tooling + Zero-Day archive | `slice-07-security-zeroday` | 0007, 0008, 0009 |
| Company OS design adopted | `slice-08-os-design` | — |
| Products module | `slice-09-products` | 0010 |
| Gantt tasks + Finance/Projects/Agent Platform/Access Requests | `slice-10-remaining-modules` | 0011 |

### Screens that exist

- **Public site** `/` — Jessica's `index.html`, served verbatim. Sign in,
  request an account, reset password.
- **Dashboard** `/dashboard` — module cards with live counts.
- **HR** — Team, Contracts (private file storage), Mission & Values, Constitution.
- **IT** — Identity & Access (role builder + assignment), Agent Platform,
  Access Requests, Zero-Day (security review archive + reviewer's guide).
- **Security Tooling** — Change Management, Change Log (append-only).
- **Products** — 6 products × 6 tabs (Plan Board, Build Board, Agents,
  Website, Change Log, Mission & Values) + consolidated Gantt.
- **Finance** — AR/AP shell, deliberately no data model.
- **Projects** — cross-product work with schedule.
- **Auth flow** — `/mfa` (TOTP), `/pending` (awaiting role), `/reset-password`,
  `/legal/nda`, `/legal/privacy`.

---

## 3. IMMEDIATE ACTIONS OUTSTANDING

### 3.1 Migrations 0010 and 0011 have NOT been run

Everything through **0009 is applied and verified live**. `0010` and `0011`
were written and pushed but not yet pasted into Supabase.

Until they run: Products screens will error or show empty, `/projects` will
fail, and Access Requests will complain about missing columns.

**To run them:** open `supabase/migrations/0010_products_module.sql`, copy the
whole file, paste into Supabase → SQL Editor → New query → Run. Then the same
for `0011_plan_tasks_projects.sql`. In order.

A fast way to hand the file over without GitHub links:

```powershell
Get-Content "supabase\migrations\0010_products_module.sql" -Raw | Set-Clipboard
```

### 3.2 Other open items

- **2FA on the Supabase and Vercel accounts themselves** (not the app — the
  dashboards). Constitution §5 calls this security-critical. Not done.
- **`NEXT_PUBLIC_SITE_URL`** should be set in Vercel to the live URL so
  password-reset emails point at the deployment rather than the request origin.
- **Supabase is on the FREE plan** — daily backups only, no point-in-time
  recovery. If this app ever holds anything worth more than a day, that is the
  upgrade that matters.
- **Rotate the Supabase secret** if it was ever pasted in a chat. The app does
  not use it (`SUPABASE_SECRET_KEY` is referenced nowhere), so rotating is free.

---

## 4. Rules that were learned the hard way

**Do not violate these. Each one cost real time to discover.**

### 4.1 Two hand-built HTML files drive ALL visual design — never recreate them

- **`index.html`** (repo root) **IS** the live marketing site. `app/route.ts`
  serves it verbatim and injects `public/login-wire.js`, which binds the
  page's existing form ids (`lg-signin`/`em`/`pw`, `lg-create`/`cname`/`cemail`/
  `cnda`/`cpriv`, `lg-reset`/`remail`) to real auth. If Jessica changes the
  HTML, **do not convert it** — only update the wire script if those ids move.
- **`SCOUT_QUEST_INC_COMPANY_OS.html`** (repo root) is the design source for
  the signed-in OS. `scripts/extract-os-css.mjs` extracts its `<style>` and
  scopes every rule under `.os` into `app/(app)/os.css`. Re-run that script
  after design changes. Screens reuse her classes (`.card`, `.tile`,
  `.modcard`, `.badge`, `.tag`, `.finding`, `.crumbs`) with live data.

This was the single biggest mistake of the session: screens were hand-built
from the written spec because the design file could not be found, instead of
stopping to ask for it. **If a spec cites a visual reference you cannot
locate, stop and ask.**

### 4.2 The owner must never be locked out

`jessicadougherty4321@gmail.com` gets in with **email + password alone** —
exempt from the 2FA requirement, exempt from needing a role. Enforced in three
places: the SQL owner guarantee keyed to `auth.users`, an email fallback in
`app/(app)/layout.tsx`, and the same fallback in permission checks. Do not
"tidy" any of these away.

### 4.3 Supabase SQL Editor: always click the ORANGE "Run without RLS"

Its green "Run and enable RLS" button appends a malformed statement and fails
with `relation "an" does not exist`. Every migration enables RLS itself. This
cost several rounds before it was identified.

### 4.4 Testing gotchas

- Jessica has repeatedly tested login by opening `index.html` **as a file**
  (`file:///C:/dev/...`). The wire script never loads there, so nothing works.
  Always confirm she is on `localhost:3000` or the Vercel URL.
- She is not signed into GitHub in every browser window, so links to the
  private repo 404 for her. **Paste code and SQL into chat, or use
  `Set-Clipboard`.**

### 4.5 PowerShell will corrupt UTF-8

`Get-Content -Raw | ... | Set-Content` mangles em-dashes into `â€"`. Use Node
for text rewriting, or `[System.IO.File]::ReadAllText/WriteAllText` with an
explicit UTF8 encoding.

---

## 5. How the permission model works

Read `supabase/migrations/0003_full_schema_permissions.sql` — it is the heart
of the app.

- **`has_access()`** — may this person see the app at all? Owner always;
  everyone else needs a role **and** a 2FA-verified (`aal2`) session. Enforced
  in the database, so a stolen password cannot read data through the REST API.
- **`has_perm('Module: Tab')`** — may they write this thing? Owner always;
  everyone else needs a role carrying that key (or `ALL`).
- **Permission keys** live in `lib/permission-keys.ts` and must stay
  **byte-identical** to the strings in the RLS policies. A mismatch is a
  checkbox that silently grants nothing.
- **Roles** carry a `permissions` jsonb array; **`role_assignments`** links
  them to `team_members`; a member's roles only apply once their
  `profile_id` is linked (guarded by a database trigger).

**Jessica's ruling on reads:** no role → no data. A signed-in person without a
role sees only `/pending` ("a role will be assigned soon"). This is stricter
than the architecture doc, deliberately.

---

## 6. Append-only records

Two things cannot be edited or deleted by anyone, including the owner:

- **`change_log`** — Security Tooling › Change Log.
- **`security_reports`** — IT › Zero-Day.

Both have BEFORE INSERT triggers forcing `created_at` and the author, so
entries cannot be backdated or misattributed, and `security_reports` has no
delete policy at all. If you are tempted to add one, don't — that was a
deliberate fix from a review.

---

## 7. The review methodology (and its honest limits)

Every slice shipped after an adversarial review run through the `Workflow`
tool: several finder agents on different lenses, then **separate verifier
agents** that never saw the finder's reasoning and are told to *refute* the
claim, defaulting to rejection. Only survivors get fixed. These reviews caught
genuinely serious things — a login-CSRF that could plant a session in a
visitor's browser, 2FA that was enforced only in the UI, a privilege
escalation via account re-linking, uploads that would have silently failed
over 1 MB, a Gantt that drew bars under the wrong month.

**Add a "guide-accuracy" or "truthfulness" lens when a slice makes claims to
the user.** On the Zero-Day slice that lens audited the reviewer's guide
against what the harness actually does and found it overstating in five
places. That was more valuable than the code lenses. The honest position now
documented in `lib/review-guide.ts`:

- The engineer writes both finder and verifier prompts, including a "don't
  flag this" list — so a review is a **strong second opinion, not an
  independent audit**.
- Review agents read code; they do not run it.
- Dismissed findings are not retained.
- "Fixed" means the code changed and the build passed — **not** that the
  migration ran on the live database.
- Review criteria are not version-controlled, so the bar can drift.

---

## 8. Reverting

- **Code:** Vercel keeps every deployment — Instant Rollback is one click.
  Or `git checkout <tag>`; tags are listed in §2.
- **Database:** migrations are **forward-only — there are no down scripts.**
  Rolling code back does not undo a migration. Append-only tables cannot be
  cleared at all, by design.
- Going forward, write a matching down-script for any migration that drops or
  tightens something, and name the migration number in the change-log entry so
  code and schema can be paired later.

---

## 9. What is left

1. **Stage 3 ingest seams** — feed `work_orders` and `agents` from the ASL
   ledger; generate `change_log` entries from git history. The tables and
   read-only screens already exist and are waiting for data.
2. **Finance data model** — when money actually moves through this OS. The
   shell and permissions are live; the Constitution's counterweight principle
   says don't build the machinery before there's a consumer.
3. **Departments module** — named in the design's module grid, not built.
4. **Nice-to-haves surfaced by reviews but not done:** permission-aware
   navigation (links are visible to everyone and pages redirect instead),
   in-app 2FA recovery for a lost authenticator (today: owner deletes the user
   and re-creates them), and product-scoped Mission & Values editing (the
   company one is editable; product ones are read-only).

---

## 10. Resuming in a new session

Open the new session in `C:\dev\scoutquestaiinc` and say something like:

> Read HANDOFF.md, README.md, SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md and
> CLAUDE_CODE_KICKOFF_SCOUT_QUEST_INC_FULL.md, then confirm which migrations
> are applied before doing anything.

Verifying applied migrations without the dashboard — read-only, no writes:

```powershell
$h = @{ apikey = "sb_publishable_1GsbXCUCjI5V56bN9kf-mQ_hMyJoZcT" }
$base = "https://odovdbxhsrrfpdjobiwj.supabase.co/rest/v1"
foreach ($t in @("profiles","team_members","roles","role_assignments","products",
                 "product_areas","plan_items","websites","work_orders","change_log",
                 "agents","contracts","mission_values","account_requests",
                 "security_reports","projects")) {
  try { $r = Invoke-WebRequest -Uri "$base/${t}?select=*&limit=1" -Headers $h -UseBasicParsing
        "OK  $t" } catch { "MISSING $t" }
}
```

Every table should answer `HTTP 200` with `[]` — an empty array proves the
table exists **and** that RLS is refusing anonymous reads. `MISSING projects`
or `MISSING` on a Products table means 0010/0011 still need running.

**Do not attempt to run migrations yourself.** The app holds only the
publishable (browser) key; creating tables needs the secret key or the database
password, neither of which is in this repo — deliberately. Migrations are
always a paste by Jessica.

---

## 11. Key files

| File | Why it matters |
|---|---|
| `index.html` | The live public site. Do not recreate. |
| `SCOUT_QUEST_INC_COMPANY_OS.html` | The OS design source. Do not recreate. |
| `scripts/extract-os-css.mjs` | Regenerates `app/(app)/os.css` from the design. |
| `scripts/check-client-bundle.mjs` | Postbuild guard — fails the build if a secret reaches the browser. |
| `proxy.ts` | Session refresh + auth redirects (Next 16's successor to middleware). |
| `app/(app)/layout.tsx` | The gate: auth → 2FA → role. |
| `app/(app)/shell.tsx` | The OS chrome (top bar, breadcrumbs, sub-nav). |
| `lib/permission-keys.ts` | Canonical keys — must match the RLS policies exactly. |
| `lib/review-guide.ts` | The honest account of what reviews do and don't cover. |
| `supabase/migrations/` | Run in filename order. Later files tighten earlier ones. |
| `SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md` | Schema/auth source of truth. |
| `CLAUDE_CODE_KICKOFF_SCOUT_QUEST_INC_FULL.md` | The full module map and build order. |
| `SCOUT_QUEST_INC_FULL_BUILD_YOUR_PART.md` | Jessica's own click-by-click steps. |
