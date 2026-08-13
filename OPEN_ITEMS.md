# Open items — adversarial review, August 2026

## What this is, and how much to trust it

A cross-slice review ran against the whole Company OS on 2026-08-02. Every
earlier review looked at **one slice** in isolation, so none of them could see
problems that only appear when the modules are assembled. This pass was aimed
squarely at those.

**The review did not finish.** It hit a weekly usage limit partway through:
**4 of 5 finder lenses completed**, and of the 60 verification agents, **only
the first few ran** — the rest died before reporting. That has two consequences
you need to hold onto while reading this file:

- Only **two** findings were independently verified by both a skeptic told to
  refute them and a tracer told to walk a real user through the code.
- Everything else is **raised but unverified**. The tooling recorded most of
  them as "rejected", but that label is wrong — it is what the script produces
  when both verifiers fail to run. **Treat them as unconfirmed leads, not as
  dismissed and not as confirmed.**

I re-checked the two verified findings against the current tree
(`feat/hr-org-chart`, migrations through 0020) before writing this, and both
still stand — no later migration fixes either. I also verified the badge-colour
item myself. Everything under "Unverified" I have *not* re-checked.

**Coverage gap:** the fifth lens — the complete authentication and onboarding
journey (request account → approve → create login → first sign-in → 2FA → role
→ app, plus revocation and password reset) — never ran at all. That area got
no coverage in this pass.

---

## Verified — fix these first

### 1. HIGH · The `Contracts` key can read every employment contract *file*

`supabase/migrations/0012_departments_infra_contracts.sql` (storage policy)

Migration 0012 deliberately splits the two contract keys. The row policy
`contracts_select_perm` gives a `Contracts` holder only rows
`where category <> 'employment'`, on the stated rule that whoever tracks
vendor and district paperwork has no business reading staff NDAs and offers.

But `contracts_objects_select` on `storage.objects` grants `has_perm('Contracts')`
SELECT on **every object in the bucket**, with no category test. I wrote a
comment in that migration arguing this was acceptable because the file path
could not be discovered through the app. That argument is wrong:
`storage.objects` SELECT is exactly what the Storage **list** endpoint checks,
so a holder can enumerate the bucket directly with their own session and then
mint a signed URL for anything they find. No path guessing is needed.

Worse, the exposure is total rather than partial: the only upload path
(`app/(app)/hr/contracts/actions.ts`) never sets `category`, and the column
defaults to `'employment'` — so *every* file in the bucket is an employment
contract. The coarse storage grant exposes 100% of what the row policy was
written to protect and 0% of what a `Contracts` holder is entitled to.

This cannot be fixed in `app/` — the publishable key is public by design and
RLS is the whole gate.

**Fix, in SQL, either:**
- add a category test to `contracts_objects_select` via a correlated
  `exists` against `public.contracts` on `objects.name = contracts.file_path`; or
- move employment files into a separate bucket gated on `HR: HR Contracts`
  alone, which is simpler to reason about and harder to get wrong later.

### 2. HIGH · A delegated Identity & Access admin sees false links, and one Save destroys them

`supabase/migrations/0001_stage1_profiles_team_members.sql` (profiles SELECT)
plus `app/(app)/it/identity-access/team-panel.tsx`

`profiles` has exactly one SELECT policy, written in 0001 and **never widened**:
`id = auth.uid() or is_owner()`.

Three separate places grant `IT: Identity & Access` the account-linking
capability — the `guard_team_member_profile_link` trigger in 0003, the whole of
migration 0004, and `linkAccount` in the app. But the profile being linked *to*
is read through that 0001 policy. So a non-owner IA holder's picker returns
exactly one row: **their own**.

Two failures follow:

- **The capability is owner-only in practice.** Delegating access
  administration does not work; the admin cannot link anyone but themselves,
  the new hire's roles never resolve, and they sit on `/pending` indefinitely.
  Nothing errors — the UPDATE is fine, the *list* is empty.
- **Worse, it silently unlinks people.** For a member the owner already linked,
  the `<select>` has `defaultValue={profile_id}` matching no rendered option, so
  the browser falls back to the first one — "— no linked account —". The row
  *displays* as unlinked while the warning text is suppressed because
  `profile_id` is truthy. Pressing Save on that row for any reason writes
  `profile_id = null`. RLS and the guard trigger both pass, the action reports
  success, and that person loses every permission on their next request.

So the screen whose job is auditing access asserts that nobody in the company
has a working login, and repairing anything on it quietly revokes access.

**Fix:** widen the profiles read, e.g. add
`or public.has_perm('IT: Identity & Access')` to `profiles_select_self_or_owner`.
A full picker also makes `defaultValue` match, which resolves the destructive
half at the same time.

### 3. MEDIUM · Expired and expiring contracts are colour-coded backwards

`app/(app)/contracts/editor.tsx` — the `expired` / `expiring` chips

`t-hi` is green (`--ok`) and `t-lo` is solid red (`--danger`). Every other
screen uses them that way: a *complete* contract is `t-hi`, a *high-severity*
finding is `t-lo`, a *class 3+* change is `t-lo`.

On this screen they are inverted — an already-lapsed agreement gets the green
chip and a merely-expiring one gets the red chip. Scanning the list, the rows
that need attention look resolved and the ones with 45 days left look urgent.
The red "already past their end date" tile above the table disagrees with the
green rows underneath it, and the rows are what gets scanned.

This is mine, from the original contracts screen; it survived the rewrite into
`editor.tsx`. **Fix:** swap the two class names.

---

## Unverified leads

Raised by the finder lenses but never independently checked. Roughly ordered by
claimed severity. Verify before acting — and equally, do not assume any of them
is false.

### Cascade deletes that bypass RLS

Postgres runs `ON DELETE CASCADE` as a system referential action, so it is
**not** filtered by the child table's RLS. The codebase already knows this
(0008's header says so) but applied the lesson only to `change_log`.

- **`HR: Team` can wipe every role assignment.** `team_members_write_perm` is
  `for all`, so it covers DELETE, and `role_assignments.team_member_id`
  cascades. Deleting a person removes role assignments that only
  `IT: Identity & Access` is permitted to touch. A bulk delete could lock every
  non-owner out of the company.
- **`Products: Manage` cascade-destroys three other keys' data.** It has no app
  surface at all, but via the API deleting a product cascades away
  `product_areas`, `websites` and `plan_items` — each individually gated behind
  a different Products key. Tagged agents also have `product_id` set to null and
  silently reappear as "company-wide" on every other product.

### Reads are far wider than the screens suggest

Every `*_select_access` policy is `using (has_access())` — satisfied by any
2FA'd role-holder. That includes `roles` (with its `permissions` jsonb),
`role_assignments`, `team_members`, `agents`, `work_orders`, `change_log` and
more. The *screens* are gated on keys, but the *data* is not: anyone with any
role can read the entire permission matrix directly from the API — which role
carries `ALL`, who holds it, and which profile it resolves through.

`lib/reachable.ts` is honest that navigation is only a courtesy layer. The open
question is whether the read policies were meant to be this wide.

- Related: **`Security Tooling: Change Management` reads every employment
  contract.** 0012 applied its privacy rule to `Contracts` but left this key as
  an unconditional read of the whole table, plus the storage bucket and the
  download route.
- Related: **`HR: Team` is written as a peer of the owner** on
  `account_requests` — it sees every applicant's name, email, NDA version and
  consent timestamps, including declined applicants who never joined, and can
  flip any decision. Meanwhile the IA administrator cannot see that queue at all.

### Append-only is not as sealed as the screen claims

- **Re-running 0007 resurrects the DELETE policy on `security_reports`.** 0008
  drops it; nothing stops 0007 from being pasted again. 0007 and 0008 carry no
  ordering warning (0012 got one; they did not).
- **Twelve screens tell you to re-run a migration** as the diagnosis for *any*
  failure — "Has migration 0006 been run?" — and every migration they name is
  already applied. Following that advice on a transient error is how the above
  happens. This copy needs to change now that the schema is complete.
- **`Products: Change Log` can write unscoped entries.** The insert policy
  constrains only the author, not `product`, `module` or `change_class`, so a
  product contributor can forge what reads as a class-3 executive-approved
  company change on the Security screen.
- **Seeded reviews are permanently unattributed.** 0008's "filed by migration"
  backfill runs *before* 0009 and 0013 insert the rows it was written for, so
  every archived review shows no author on the one screen whose purpose is
  recording who filed what.

### Consent records

- **Anyone can forge an `account_requests` consent record.** The public insert
  policy constrains only `email is not null and status = 'pending'` — the NDA
  flags, version and `accepted_at` are all caller-supplied, and the publishable
  key is in every browser by design. 0011's freeze trigger then makes the
  forgery permanently uncorrectable.
- **The freeze trigger silently makes 0005's email normalisation a no-op**, so
  case-variant duplicate requests can never be repaired.
- **`name` is not in the frozen set**, so the person a locked consent record
  names can still be rewritten.

### Screens that state things they cannot know

- **The dashboard "security reviews" tile shows a confident `0`** to anyone RLS
  hides the archive from — most of the company — and also swallows query errors.
  A suppressed count, a failed query and a genuinely empty archive are
  pixel-identical. Same shape on **HR › Team**, which renders "—" for contracts
  a viewer is not permitted to read, under a lead promising a live join.
- **Company Contracts tiles label a per-viewer subset as company totals**, and
  the risk tiles flip to green when the viewer's *filtered* slice is empty.
- **Both permission helpers turn a query failure into "you are not allowed".**
  `checkPerm` and `getPermissions` discard the error and return false/empty, so
  a transient Supabase blip is indistinguishable from having been revoked — the
  user gets redirected with no error shown anywhere.

### Keys and columns that do nothing

- **`HR: Constitution` and `Products: Agents` grant nothing anywhere** — no RLS
  policy and no app check names either. Both screens they refer to are open to
  every role-holder. Ticking or unticking those boxes changes nothing in either
  direction, while the role builder implies they will start working later.
- **`team_members.status` is inert end to end.** Nothing writes it, no access
  helper reads it, and HR › Team hard-codes the green "Live" badge regardless of
  value — so a row reading "departed" is green and that person keeps every
  permission.
- **`IT: Agent Platform` silently carries write on the Infrastructure
  inventory**, including the row that labels the governed model plane `D3`,
  while the page tells that key's holders editing is not built.
- **No unique constraint on `team_members.profile_id`**, so one login can be
  linked to several member rows; off-boarding the visible one does not revoke
  access.
- **The Infrastructure note tells IT to edit migration 0012**, but 0012's seed
  is guarded on `name` with no `on conflict do update` — re-running it cannot
  change an existing row, and renaming one creates a duplicate.

---

## Also worth confirming

- **Migration state.** I verified against the live database that 0010, 0011,
  0012 and 0013 are applied. I did **not** verify 0014–0020. Commit `a5aa295`
  claims 0014–0017 are applied, but 0012 was *not* applied when I probed on
  2026-08-02 even though 0014 depends on its tables — so that record and the
  database disagreed at least once. Worth re-probing before trusting it.
- **The repo is PUBLIC on GitHub** (`jessiesfaith/scout-quest-inc`). The
  original kickoff specified a private repo. No secrets are exposed —
  `.env.local` was never committed and no `sb_secret_` material appears in any
  commit — but the full source, migrations and Constitution are world-readable.
- **Still outstanding from earlier sessions:** 2FA on the Supabase and Vercel
  accounts themselves, `NEXT_PUBLIC_SITE_URL` set in Vercel, and the free-plan
  backup limitation (daily only, no point-in-time recovery).

## Re-running the review

The unfinished pass is worth completing once usage resets — particularly the
authentication-journey lens, which produced nothing.

```
Workflow({scriptPath: "C:\\Users\\Jessica\\.claude\\projects\\C--dev-scoutquestaiinc\\f0c47887-331a-4f96-80e4-e55744c894da\\workflows\\scripts\\whole-os-final-pass-wf_ee5b6bc9-f65.js", resumeFromRunId: "wf_ee5b6bc9-f65"})
```

Completed agents replay from cache, so a resume re-runs only what died. Note
the script's context block says "0001-0013 applied" — update it to match the
real state before resuming.
