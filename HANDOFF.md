# Scout Quest Inc — Company OS · Session Handoff

*Written 2026-08-02 at the end of the first build session, updated the same
day after slices 12–15 (editing screens, Stage 3 ingest, two-factor
recovery, Finance). Read this top to
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
| Contracts, Departments, Infrastructure, permission-aware nav | `slice-11-os-complete` | 0012, 0013 |
| Editing screens for the 0012 tables | `slice-12-editing` | 0014 |
| Stage 3 ingest (ASL ledger, spend policy, git) | `slice-13-stage3` | 0015 |
| Two-factor recovery codes + owner reset | `slice-14-mfa-recovery` | 0016 |
| Finance: invoices, payments, balances | `slice-15-finance` | 0017 |

### Screens that exist

- **Public site** `/` — Jessica's `index.html`, served verbatim. Sign in,
  request an account, reset password.
- **Dashboard** `/dashboard` — module cards with live counts.
- **HR** — Team (with department assignment), Contracts (private file storage),
  Mission & Values, Constitution.
- **IT** — Identity & Access (role builder + assignment + two-factor reset),
  Agent Platform (library, work orders, model spend, sync status),
  Infrastructure (what the company runs on, by data class), Access Requests,
  Zero-Day (security review archive + reviewer's guide).
- **My account** — Security: your own two-factor state and recovery codes.
  Reached from your email address in the top bar. No permission gates it.
- **Security Tooling** — Change Management, Change Log (append-only).
- **Products** — 6 products × 6 tabs (Plan Board, Build Board, Agents,
  Website, Change Log, Mission & Values — the last now editable with the
  `Products: Mission & Values` key) + consolidated Gantt.
- **Contracts** — company-wide view: NDAs, DPAs/BAAs, district and vendor
  agreements with obligations and an expiring-within-60-days count.
- **Departments** — the Constitution §7 departments with their head counts.
- **Finance** — AR and AP as an invoice register: invoices, part payments,
  outstanding balances and an overdue total. The two keys are separate on
  purpose.
- **Projects** — cross-product work with schedule.
- **Auth flow** — `/mfa` (TOTP), `/pending` (awaiting role), `/reset-password`,
  `/legal/nda`, `/legal/privacy`.

---

## 3. IMMEDIATE ACTIONS OUTSTANDING

### 3.1 Migrations 0001–0013 are applied; **0014–0017 are not**

0001–0013 were verified live on **2026-08-02** by probing the REST API for
the columns each one adds, not just the tables. Re-run the probe in §10
before trusting that line again.

`0014`, `0015`, `0016` and `0017` were written and pushed but have **not**
been pasted into Supabase. Until they run:

| Missing | What breaks |
|---|---|
| 0014 | Recording a company agreement on **Contracts** fails — that is the only one of the three editing screens that needed new SQL, because Departments and Infrastructure already had write policies from 0012. Also missing: the guard that refuses to delete an occupied department, the `company/` storage lane, and the CHECK constraints behind the dropdowns. |
| 0015 | The ingest route returns "has migration 0015 been run?"; Model Spend and Sync status are empty. |
| 0016 | Recovery codes cannot be generated or redeemed; the owner's "Reset 2FA" refuses. |
| 0017 | Finance shows a load error instead of the register. |

Run them **in order**, and finish with the highest number — later files
tighten policies that earlier ones created, so re-running an old file
silently reverts the tightening:

```powershell
Get-Content "supabase\migrations\0014_editing_rights_0012_tables.sql" -Raw | Set-Clipboard
```

```powershell
Get-Content "supabase\migrations\0015_stage3_ingest.sql" -Raw | Set-Clipboard
```

```powershell
Get-Content "supabase\migrations\0016_mfa_recovery.sql" -Raw | Set-Clipboard
```

```powershell
Get-Content "supabase\migrations\0017_finance.sql" -Raw | Set-Clipboard
```

If a dialog offers to "Run and enable RLS", choose the orange **Run without
RLS** — see §4.3.

**0014 note.** It adds CHECK constraints to existing tables. If one fails,
some row already holds a value outside the allowed set — fix that row and
re-run, rather than dropping the constraint.

### 3.2 Vercel environment — two variables the app now needs

**This changed.** Up to slice 11 the app used only the publishable key.
Stage 3 writes rows on behalf of a machine that has no user session and
therefore no RLS identity, so the ingest route needs the service key. See
§5.1 for what is done to keep that from becoming a back door.

1. **Rotate the Supabase secret first.** It was pasted into a chat once and
   until now nothing used it, so rotating was free. It stops being free the
   moment it is in Vercel — rotate, then set the new value.
2. **`SUPABASE_SECRET_KEY`** — the rotated secret, in Vercel only. Never in
   `NEXT_PUBLIC_*`, never in the repo.
3. **`INGEST_TOKEN`** — a fresh random string shared with the publisher:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set it in Vercel, and put the *same* value in `.env.ingest` on the
   machine that runs the publisher. Anything under 32 characters is
   refused. A **different** token already exists in local `.env.local` for
   development; that is intended — local and production should not share
   one.

Without these the ingest route answers 503 and says which variable is
missing. Everything else in the app keeps working.

### 3.3 Other open items

- **2FA on the Supabase and Vercel accounts themselves** (not the app — the
  dashboards). Constitution §5 calls this security-critical. Not done.
- **`NEXT_PUBLIC_SITE_URL`** should be set in Vercel to the live URL so
  password-reset emails point at the deployment rather than the request origin.
- **Supabase is on the FREE plan** — daily backups only, no point-in-time
  recovery. If this app ever holds anything worth more than a day, that is the
  upgrade that matters.
- **The publisher is run by hand.** Nothing schedules it. The Sync status
  table on IT › Agent Platform shows how stale each source is, which is the
  honest version of "we have not automated this yet".

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

### 5.1 The service key, and why it exists now

`lib/supabase/admin.ts` holds a client that **bypasses every RLS policy**.
Three things use it, and all three are places where there is no user to
act as. Keep this list and the one in `admin.ts` in step — it is the only
inventory of what holds this capability:

- **`app/api/ingest/route.ts`** — the publisher is a script, not a person.
  It writes only through migration 0015's `security definer` functions,
  and reads exactly one table directly (`ingest_state`, to answer the
  publisher's "where did I get to?").
- **`app/mfa/actions.ts`** (`redeemRecoveryCode`) and
  **`app/(app)/it/identity-access/actions.ts`** (`resetTwoFactor`) —
  removing an enrolled authenticator needs the Auth admin API; an aal1
  session cannot do it, correctly. Both use it for that API only, never
  for table access. Note `resetTwoFactor` deliberately writes its audit
  row with the *caller's* client, not this one: under the service key
  `auth.uid()` is null, and the trigger that stamps who did it would then
  fall back to a value the caller supplied.

What keeps it contained:

- `import "server-only"` makes importing it from a client component a build
  error, and `scripts/check-client-bundle.mjs` fails the build if the key,
  its variable name, or `INGEST_TOKEN` reaches a browser asset. Both
  secrets are in `SECRET_VARS` in that script — **add new ones there**, the
  guard only checks what the list names.
- The ingest route never composes SQL and never reads a table. Every write
  goes through a `security definer` function from migration 0015, each of
  which writes one table and ignores unexpected keys. `EXECUTE` on those is
  granted to `service_role` only — not `anon`, not `authenticated`.
- What this does **not** protect against: a leaked service key, which can
  write any table without going near those functions. Vercel's environment
  is the only thing guarding that.

### 5.2 The D3 boundary in the ingest

`scripts/ingest/sources.mjs` decides what leaves the governed plane. The
rule when extending it: **if a field could differ between two runs because
of what a student wrote, it does not cross.** Identifiers, counts, costs,
statuses and timestamps do. Step output, run parameters, error detail and
the ledger's `tenant` column do not.

`node scripts/ingest/publish.mjs --dry-run` prints the exact payload and
sends nothing. Read it after any change to that file — checking the
boundary there is far easier than auditing the database afterwards.

**Jessica's ruling on reads:** no role → no data. A signed-in person without a
role sees only `/pending` ("a role will be assigned soon"). This is stricter
than the architecture doc, deliberately.

**Navigation follows the same keys.** `lib/reachable.ts` answers "which keys
does this viewer hold?" in one query, and the dashboard and IT sub-nav use it
to hide links the viewer cannot open. That is a courtesy layer only — RLS and
the per-page `redirect()` are still the real gate. Each dashboard card lists
its screens as *doors* with the keys each one needs; the first door the viewer
can open becomes the card's link. **If you add a page with a permission gate,
add its door too**, or the card will point at a page that bounces them back.

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

The four items that stood here on 2026-08-02 are all built. What replaced
them:

1. **Nothing schedules the publisher.** It runs when someone types the
   command. A Windows Task Scheduler entry or a cron job on the machine
   holding the ledger is the obvious next step; until then read the Sync
   status table before trusting a spend figure.
2. **Postgres ledgers are not supported by the publisher.** It reads
   SQLite through `node:sqlite`. `asl-gateway`'s own README recommends
   Postgres "for anything real" — when that switch happens, `openLedger`
   in `sources.mjs` is the one function that needs a second implementation.
3. **Evaluator verdicts are not mirrored.** `work_orders.confidence` and
   `.review` exist and stay null. The verdict is a governance fact worth
   showing, but it is produced from content, so what crosses needs
   deciding deliberately rather than by adding a column.
4. **Finance is a register, not accounting.** No double entry, no chart of
   accounts, no tax, no multi-currency, no credit notes — an overpayment
   is refused rather than netted off. When those are genuinely needed they
   belong in accounting software this OS reads from.
5. **A recovery-code sheet cannot be reprinted.** By design: only hashes
   are stored. Someone who loses both their phone and their codes needs an
   Identity & Access holder to reset them, which is recorded in
   `mfa_resets`. There is no self-service path out of that, deliberately.
6. **`mfa_resets` has no screen.** The table records every reset and who
   did it, and is readable by Identity & Access holders — but only through
   SQL today. It deserves a panel on that page.

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
                 "security_reports","projects","departments","infrastructure",
                 "ingest_state","agent_spend","invoices","payments",
                 "mfa_recovery_codes","mfa_resets")) {
  try { $r = Invoke-WebRequest -Uri "$base/${t}?select=*&limit=1" -Headers $h -UseBasicParsing
        "OK  $t" } catch { "MISSING $t" }
}
```

Every table should answer `HTTP 200` with `[]` — an empty array proves the
table exists **and** that RLS is refusing anonymous reads. `MISSING projects`
or `MISSING` on a Products table means 0010/0011 still need running;
`MISSING departments` or `MISSING infrastructure` means 0012 does.
`MISSING ingest_state` / `agent_spend` means 0015; `MISSING invoices` /
`payments` means 0017; `MISSING mfa_recovery_codes` / `mfa_resets` means
0016.

0014 adds no tables, so the probe cannot see it. Check it by trying to
**record an agreement on /contracts** — that needs the policy 0014 adds.
Editing a *department* is not a test: those writes worked from 0012, so a
success there would falsely read as "0014 applied".

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
| `lib/supabase/admin.ts` | The service-role client. Two callers only — see §5.1. |
| `lib/ingest-auth.ts` | Bearer-token gate for the ingest route; fails closed. |
| `scripts/ingest/sources.mjs` | **The D3 boundary.** What may leave the governed plane. |
| `scripts/ingest/publish.mjs` | The publisher. `--dry-run` prints without sending. |
| `.env.ingest.example` | What the publisher needs, and how to generate it. |
| `lib/recovery-codes.ts` | Recovery-code generation, normalization and hashing. |
| `lib/reachable.ts` | Which keys the viewer holds, for hiding unreachable links. |
| `app/(app)/it/nav.ts` | The IT sub-nav, filtered by permission. |
| `lib/review-guide.ts` | The honest account of what reviews do and don't cover. |
| `supabase/migrations/` | Run in filename order. Later files tighten earlier ones. |
| `SCOUT_QUEST_INC_DEPLOYMENT_ARCHITECTURE.md` | Schema/auth source of truth. |
| `CLAUDE_CODE_KICKOFF_SCOUT_QUEST_INC_FULL.md` | The full module map and build order. |
| `SCOUT_QUEST_INC_FULL_BUILD_YOUR_PART.md` | Jessica's own click-by-click steps. |
