# Agent Platform — session state

**Session date:** 2026-08-06 · **Repo:** `C:\dev\scoutquestaiinc`

> **Placement note.** This session was told to read and then update
> `scout-quest/agent-platform-session-state.md` and
> `scout-quest/agent-architecture-decisions.md`. Neither file exists in this
> repo or in the other connected folder (`Soundwiserx.com`), and a `Grep` for
> both filenames across the whole repo returns nothing. This file was written
> beside `HANDOFF.md` instead. **If `scout-quest/` lives somewhere else, say
> where and this should move there.**
>
> It is deliberately NOT under `docs/agents/` or `docs/governance/`: those two
> directories are the corpus hashed by `MANIFEST.sha256`, and a session log
> that changes every session would make ordinary note-taking look like
> governance drift.

Work in this session was done against `HANDOFF.md` and
`docs/agents/GAP_ANALYSIS.md`, which were readable.

---

## 1. Where the branches actually are

The previous session's notes described this differently. What is true, by
`git rev-parse` and `git for-each-ref`:

| Ref | Commit | Note |
|---|---|---|
| `origin/master` = `master` | `d0b008d` | Coding Cards hub |
| `feat/hr-org-chart` = `origin/feat/hr-org-chart` = **HEAD** | `bb2181b` | constitution v1.4 + HR constitution page; already pushed |
| `feat/agent-library` | `8edc8b0` | **new this session**, branched from `origin/master` |
| ~~`feat/agent-platform`~~ | — | deleted this session |

`feat/agent-platform` was **not** debris from a failed commit. It pointed at
`d0b008d` — byte-identical to `origin/master` — so it was a stale label, and
deleting it lost nothing. All the agent-platform work was, and still is,
uncommitted in the working tree on `feat/hr-org-chart`.

`git log master..feat/hr-org-chart` is exactly one commit, `bb2181b`.
`c5dff15` (Org Chart screen) is already in master via PR #1.

## 2. Step 1 — debris cleared

The two commands as written both fail, and did:

- `git worktree prune` printed nothing. The worktree carried
  `.git/worktrees/wt/locked` containing `initializing`, and prune skips
  locked worktrees.
- `git branch -D feat/agent-platform` was refused: the branch was checked
  out in that worktree (`+` in `git branch -a`).

The worktree's `.git` file pointed at `/sessions/rcw-01jkxmsz…/…`, a previous
session's sandbox that no longer resolves — so it was orphaned, not merely
stale. Before removing it, its readable files were compared against this
working tree: every difference was ordinary `origin/master` content that
`feat/hr-org-chart` lacks (`public/coding-cards.html`, `app/icon.svg`,
`docs/enterprise-constitution-v1.3.md`, `next.config.ts`). Nothing unique was
in it.

Cleared: unlocked the worktree, removed `.git/worktrees/wt`, deleted stale
`HEAD.lock` / `index.lock` / `refs/heads/feat/agent-platform.lock`, then
`git branch -d` (lowercase — it was merged). `git worktree list` now shows
one worktree.

## 3. Step 2 — 0018 confirmed, and it found a real hole

`0018_VERIFY.sql` was run against production on 2026-08-06. **18 of 20
passed.** Everything structural held: the `aal2` gate is present in the
deployed `approve_work_order`, both `advance_work_order` state-machine checks
match, the ingest guard protects library rows, the D3 CHECK exists, the
append-only policies are `r`+`a`, the FK is RESTRICT, and the seed counts and
ceilings are exact.

**Two failed, and they were a genuine vulnerability — now fixed by 0019.**

`governance columns not directly writable` and `seq not caller-settable` both
returned `false`. 0018 protected those columns with column-level `REVOKE`
(its lines 295 and 525). Those statements ran without error and **had no
effect**: in PostgreSQL a column-level REVOKE cannot cut into a table-level
GRANT, and Supabase grants table-wide privileges to `anon` and
`authenticated` by default. Confirmed with `has_column_privilege()`, and by
the raw ACL: `postgres=arwdDxtm/postgres | anon=arwdDxtm/postgres |
authenticated=arwdDxtm/postgres`.

What it meant: the RLS policy on `work_orders` is `for all`, so anyone with a
valid session could PATCH the table through PostgREST with the publishable
browser key — set `stage='release'`, write `approved_at` and `approved_by`
with any email, reopen a closed work order — without calling
`approve_work_order`, therefore without the `aal2` check, without the stage
machine, and writing nothing to the event feed. `work_order_events.seq` was
settable for the same reason, so a forged row could be pinned anywhere in a
feed ordered by it.

The `aal2` gate was real. It simply was not the only door — the §5.3 failure,
in the same shape a previous review found: *a state machine enforced in only
one of its two doors.*

**`0019_column_privileges_fix.sql` was written and applied.** It revokes at
the table level first, then grants back only the insertable columns — the
only ordering in which column privileges bind. Its 14-row verification
returned all `true`, including the two controls proving the app's INSERT
paths still work. The `SECURITY DEFINER` RPCs are unaffected: they run as
owner.

Also in 0019, going slightly beyond restoring 0018's intent: `UPDATE` and
`DELETE` revoked on `change_log`, `security_reports` and
`work_order_events`. Append-only rested entirely on there being no delete
*policy*; it now also rests on a revoked *privilege*. A missing policy is an
absence, a revoked grant is a presence, and the second is easier to verify.

**Re-run `0018_VERIFY.sql` after 0019 — expect 20 of 20.** The two checks
were rewritten to use `has_column_privilege()` (see §7).

The §4.4 route, if the clipboard hand-off is not available:

    Set-Clipboard -Value ([System.IO.File]::ReadAllText("C:\dev\scoutquestaiinc\supabase\migrations\0018_VERIFY.sql", [System.Text.Encoding]::UTF8))

Use the orange **Run without RLS** (§4.3).

*(The REST probe named in the original instructions was never run: this
sandbox has no network egress — `403 from proxy after CONNECT` for Supabase
and github.com alike, no DNS. It was moot; rows 1–6 of VERIFY are the same
counts.)*

## 4. Step 3 — slice committed, NOT pushed

`feat/agent-library` was branched from `origin/master` rather than committed
on `feat/hr-org-chart`, so that merging it to master carries the slice **and
nothing else** — no cherry-pick needed. `bb2181b` stays where it is.

Built with a temporary index (`GIT_INDEX_FILE`) so the dirty working tree was
never touched; `git status` still shows the same 17 entries it did at the
start, and HEAD is still `feat/hr-org-chart`.

`git diff --name-only origin/master feat/agent-library` was diffed against the
requested path list: **exact match, 47 files, nothing extra, nothing missing.**
`app/(app)/it/nav.ts` was left alone and is still identical to
`origin/master`. `os-extra.css` was checked specifically for org-chart
leakage: 262 lines added, 0 removed, every class prefixed `t*` / `p*` / `wo*`.

Verified on the branch itself, in a throwaway worktree: `tsc --noEmit` exits
0, `eslint` on the new files is clean.

**Not pushed** — no git credentials in the sandbox and no egress:

    git push -u origin feat/agent-library

**Merging `feat/agent-library` to master carries only the slice.** This is
the difference from the original plan, which would have carried `bb2181b`
too.

## 5. Steps 4 and 6 — built

Second commit, `8edc8b0`:

- `docs/agents/MANIFEST.sha256` — 39 documents, one line each: path, sha256,
  line count, bytes. `git diff` on it is the drift report.
- `scripts/governance/manifest.mjs` — regenerate (`--write`) and compare.
  Hashes over CRLF-normalised bytes so a Windows checkout cannot invent
  drift. Tested: content change, added file and removed file each detected,
  exit 1 on drift and 0 when clean, and one hash cross-checked against
  `sha256sum`.
- `scripts/governance/spec-vs-db.mjs` — spec-vs-database, both directions
  (UNSEEDED / DANGLING / ID-MISMATCH). Detects specs by the `agent_id` row in
  the header table, which finds exactly the 16 seeded specs and excludes
  `_TEMPLATE.md` by its placeholder rather than by name.
- `scripts/governance/append-only.mjs` — high-water mark for `change_log`,
  `security_reports`, `work_order_events`. Watermark stored in
  `scripts/governance/`, deliberately outside the manifest corpus.
- `supabase/migrations/0018_DOWN.sql` — HANDOFF §8.

**The manifest depends on a discipline:** regenerate it in the same commit
that reseeds the database. Then `git log` on the manifest is the reseed
history and `git diff` answers "has a spec changed since the last reseed?"

The two DB scripts could not be executed here (no egress). They are syntax
checked; their first run needs `node scripts/governance/append-only.mjs --write`
to establish a baseline.

## 6. Step 5 — agent-ux-researcher NOT resolved, and the framing needs revisiting

The instruction offered two possibilities: stale ingest, or an agent running
without a `spend_policy.yaml` entry. `GAP_ANALYSIS.md` §8 records a third,
and it is the one the documents support:

> **`agent-ux-researcher` exists in the governed plane** and is referenced here as an
> active Product & Design agent, but its spec was not available to read. The entry in
> `agent_registry.yaml` records only what Jessica stated in conversation, marked as
> such, and points at no file. Reconcile it against the real spec before relying on it.

The registry entry says so itself: `sq_spec: "<lives in asl-gateway — not
readable from this session>"`, `sq_source: "Jessica's account in
conversation — NOT read from the spec"`.

The arithmetic is consistent with that: 22 rows = 16 `source='library'` (the
16 specs in `docs/agents/`, splitting 8/5/3) + the 6 `spend-policy` rows from
the 2026-08-02 ingest (HANDOFF §3.3). There is no
`docs/agents/departments/product-design/` at all.

**Checking Console › Sync status first cannot discriminate between the two
hypotheses.** `readAgents()` in `scripts/ingest/sources.mjs` reads only the
`agents:` map of `spend_policy.yaml` — it never reads `agent_registry.yaml`.
So a perfectly fresh sync would still omit an agent that is absent from the
policy. Sync status tells you how old the agents source is; it does not tell
you what is in it.

**The one check that does discriminate** — in `asl-gateway`, which is not a
connected folder:

    is `agent-ux-researcher` a key under `agents:` in config/spend_policy.yaml?

- **Present** → stale ingest. Re-run `node scripts/ingest/publish.mjs --source agents`
  (use `--dry-run` first). The count should go 6 → 7.
- **Absent** → the §5.2 problem, not a display problem: an agent operating
  outside the registry that bounds its spend and data classes. Re-running the
  publisher would change nothing.

Left in Product & Design. Not moved. Nothing edited.

## 7. Defects found and fixed

**The big one: 0018's column REVOKEs were inert.** See §3. Found by running
VERIFY, not by reading code — the two `false` rows were the only reason
anybody looked. Fixed in 0019.

**My own VERIFY checks used the wrong instrument, twice over.** Those two
checks read `information_schema.column_privileges`, which reports *grants*
and not *effective access*, so it cannot see a table-level grant overriding a
column-level revoke. They are now `has_column_privilege()`, which composes
both and answers the question actually being asked. The right instrument
would have described the hole precisely on the first run instead of leaving
it ambiguous for a round trip.

**A `change_log` INSERT with 8 columns and 7 values**, in the first draft of
both 0019 and `0018_DOWN.sql`. `created_by_email` should not be named at all
— 0008's `stamp_change_log` trigger writes it, and 0018 gets this right. The
first 0019 run failed on it. Nothing was applied: the script is wrapped in
`begin`/`commit` and the error aborted the transaction. Every `change_log`
insert across all three files is now arity-checked programmatically.



**`0018_VERIFY.sql` — five checks could pass by vanishing.** `events FK`,
`ingest guard`, `approval requires aal2` and both `advance_work_order` checks
selected from `pg_constraint` / `pg_proc` as bare projections. A missing
object yields *no row* rather than `false`, so a missing function produced 19
rows of `true` and nothing false to notice. All five are now aggregates. The
FK check also used `like` without bounding the match, so two matching
constraints would have produced 21 rows; it now requires exactly one, and
requires it to be `RESTRICT`. `pg_proc` lookups are namespace-qualified.

Both `position()` needles were confirmed against the migration source
character for character, including the three spaces in
`when 'validate'   then` (0018 lines 368 and 376).

**`0018_DOWN.sql` — first draft missed two things**, caught by enumerating
every `create`/`add` in 0018 and diffing against the script: the indexes
`work_orders_agent_idx` and `work_orders_stage_idx`, and the fourteen columns
0018 adds to `work_orders`. `data_classes` and `change_class` look
pre-existing but are not — those matches are `agents.data_classes` (0003) and
`change_log.change_class` (0007), different tables. The column drops are
included but commented out, with the tradeoff written next to them.

**Watermark placement.** Storing it under `docs/` would have made ordinary
row growth register as governance-document drift.

**`agent_gates` has no write policy *by design*, not by omission.** 0018 says
so in a comment: a key-holder who could set `GATE-runtime` to `'built'` would
make the screen assert a control that does not exist. The VERIFY check
asserting exactly one policy is therefore correct as written.

## 8. Still open — NOT decided here

Surfaced only, as instructed:

- **CHG-001** — Marketing department, unapplied Class 3. Marketing's five
  agents stay disabled.
- **Read-access model A vs B.**
- **Marketing budget structure** — per-agent cap vs department pool. GAP §8
  notes the drafted amendment leaves it per-agent as the conservative reading.
- **The department manager.**
- **CTX-005 regulatory posture is UNSET** and blocks all Soundwiserx external
  content. Needs facts, not drafting.

From HANDOFF §3.4, still outstanding and unrelated to this session: 2FA on
the Supabase and Vercel dashboards themselves, `NEXT_PUBLIC_SITE_URL`, and
Supabase still on the free plan (daily backups, no PITR).

## 9. Next session starts here

1. Re-run `0018_VERIFY.sql` — expect **20 of 20** now that 0019 is applied.
2. Open a test work order in the UI. 0019 is the one change that could
   plausibly affect that path; the verification says INSERT is untouched, but
   an actual open is the honest check.
3. `git push -u origin feat/agent-library`.
4. Establish the append-only baseline: `node scripts/governance/append-only.mjs --write`.
5. Run `node scripts/governance/spec-vs-db.mjs` — first real execution.
6. Answer the `spend_policy.yaml` question in §6. Connecting
   `C:\dev\asl-gateway` would let this be checked directly, and would also
   close the `spend_policy.yaml` reconciliation GAP §8 has been carrying.
7. Say where `scout-quest/` lives so this file can move there.

**Worth carrying forward as a rule.** The column-privilege defect was
invisible to code review — the migration reads correctly, ran without error,
and its comment describes exactly the attack it fails to prevent. It was only
found by asking the deployed database. That is the argument HANDOFF §3.1
already makes about `mfa_recovery_issue` and `aal2`, now with a second
instance: **a control that was never queried after deployment is a control
nobody has evidence for.** Anywhere else a privilege, policy or function body
is the enforcement, `has_*_privilege()` and `pg_get_functiondef()` are the
instruments — not `information_schema`, and not the migration source.
