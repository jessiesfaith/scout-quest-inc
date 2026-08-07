# CHG-001 — Create the Marketing Department

| Field | Value |
|---|---|
| `change_id` | `CHG-001` |
| **Change class** | **Class 3** — org design (§4) |
| Authority required | Jessica (executive approval) |
| **Status** | **`proposed` — UNAPPLIED** |
| Proposed | 2026-08-06 |
| Approved | — |
| Prepared by | Claude (Cowork session), at Jessica's direction |
| Reversible | Yes — see §7 |

> **Nothing in this document has been applied.** No migration has been run, no
> constitution text changed, no permission key added. To approve, change `Status` to
> `approved`, record the date, and execute §3–§5 in order.
>
> **Why this is not self-approved.** Jessica instructed the creation of a Marketing
> department in conversation. §10.3 requires delegated authority to be *documented*, and
> §10.8 favours *"documented decisions over undocumented assumptions."* An amendment
> whose only approval record is a chat message is the undocumented assumption. This
> document is the record.

---

## 1. What is proposed

Create **Marketing** as a department under Constitution §7, with its own module in the
Company OS, its own permission keys, and five active agents.

## 2. Why a department rather than a capability

§2 defines a **capability** as a reusable function with an owner and an interface
contract. It has no staff, no approval queue, no org-chart position — and, decisively,
**no way to hold role-scoped human access**.

The requirement is a marketing dashboard and content management that **team members can
use with limited access to the rest of the site**. Permissions in this app are keyed by
permission strings — mostly `Module: Tab`, with two bare company-wide keys
(`Contracts`, `Projects`) — and enforced in RLS (`lib/permission-keys.ts`, migration
0003). Scoped human access requires its own keys grouped under a module; a module
requires an owning department.

A capability cannot deliver the stated requirement. A department can.

**Counterweight test (§3.8).** Marketing has a consumer today: a monthly article, a
biweekly thought-leadership cadence, live speaking events, pilot articles, and book work
in progress across two products. This is not machinery built ahead of need.

## 3. Constitution amendment (§7)

Current text:

> *"Current first departments: Product & Design, Engineering, Security & Compliance
> (Learning Sciences reserved as a separate future department)."*

Proposed:

> *"Current first departments: Product & Design, Engineering, Security & Compliance,
> **Marketing** (Learning Sciences reserved as a separate future department).
> **Marketing owns brand, editorial, and external communications across all products;
> its Department Manager holds approval authority for Medium-tier marketing output.
> All external publication remains subject to §5.3(d) — no agent communicates with
> external parties without explicit human approval.**"*

Changelog entry to add to the v1.4 header:

> *v1.5 (pending): §7 adds Marketing as a fourth active department per CHG-001.
> Class 3 change; executive approval recorded in CHG-001. No change to §5.3 action
> boundaries — Marketing agents draft, humans publish.*

**Note.** v1.4 is itself `Draft — pending attorney review`. This amendment is
independent of that review (org structure, not legal governance) but should be folded
into the same approval pass rather than creating a second draft lineage.

## 4. Database change — migration `0018_marketing_department.sql`

**Not written and not run.** When approved, it does exactly two things:

```sql
-- 1. The department row. Matches the 0012 seed pattern.
insert into public.departments (name, summary, status, sort) values
  ('Marketing',
   'Brand, editorial, and external communications across all products.',
   'active', 4)
on conflict (name) do nothing;

-- 2. Bump Learning Sciences to sort 5 so ordering stays stable.
update public.departments set sort = 5 where name = 'Learning Sciences';
```

RLS on `departments` already exists (0012) — writes are gated by `HR: Team`. No new
policy is required for the row itself.

**Per `HANDOFF.md` §3.1:** always finish with the highest migration number; later files
tighten earlier ones. And per §4.3 — in the Supabase SQL Editor, click the **orange
"Run without RLS"**.

## 5. Permission keys — Class 3, and the part that needs care

Adding a module means adding keys to `lib/permission-keys.ts` **and** writing matching
RLS policies. `HANDOFF.md` §5 is explicit: *"Permission keys live in
`lib/permission-keys.ts` and must stay byte-identical to the strings in the RLS
policies. A mismatch is a checkbox that silently grants nothing."*

Proposed keys:

```ts
{
  module: "Marketing",
  keys: [
    "Marketing: Dashboard",   // read the module
    "Marketing: Calendar",    // editorial calendar
    "Marketing: Content",     // drafts and assets
    "Marketing: Brand",       // brand pages — should be tightly held
    "Marketing: Events",      // speaking and conference
  ],
}
```

**Access model for limited-access team members.** A `Marketing Contributor` role holding
`Marketing: Dashboard` + `Marketing: Content` and nothing else. Under the existing model
that person:

- Passes `has_access()` — they have a role and a 2FA-verified session
- Sees only the Marketing module in navigation (`lib/reachable.ts` hides the rest)
- Can write only marketing tables
- **Can still read every non-sensitive table**, because the 0003 read policies are
  `using (public.has_access())` — not per-module

**That last point is the one to decide.** Contracts and HR data are already gated
separately (0006, 0012, 0014). But a marketing contractor would be able to read
products, projects, departments, work orders, and the change log.

Two options:

| Option | Effect | Class |
|---|---|---|
| **A — accept it** | Contractor sees company operational data but not contracts, HR, or finance. Simplest; no change to the existing model | 3 (as scoped here) |
| **B — per-module read gating** | Read policies become permission-aware. Genuinely tighter, but it touches **every table's read policy** — a large, risky change to the heart of the app | 3, and substantially larger |

**Recommendation: A now, B when a real external contributor is onboarded.** §3.8 —
do not rebuild the read model before someone needs it. But **decide deliberately**, and
if the answer is A, the person's contract should reflect what they can see (§10.6).

Also required when the module is built: **add the Marketing doors** to the dashboard
card, or the card will link to a page that bounces the viewer back (`HANDOFF.md` §5).

## 6. Marketing module screens — Class 2, separate work

The dashboard is a follow-on build, not part of this change:

- **Calendar** — the editorial calendar (`mkt-editorial-planner`'s owned object)
- **Content** — drafts by status, with the work order and evaluator verdicts attached
- **Brand** — `CTX-004` / `CTX-005` rendered read-only, `UNSET` fields flagged
- **Events** — speaking pipeline
- **Spend** — marketing agent spend against cap, reading `agent_spend_summary`

Follow `SCOUT_QUEST_INC_COMPANY_OS.html` for layout and reuse the existing classes
(`.card`, `.tile`, `.modcard`, `.badge`). **Do not recreate the design** —
`HANDOFF.md` §4.1.

## 7. Reversibility

- **Constitution:** revert the §7 sentence. Git history holds v1.4.
- **Department row:** deletable — but note the trigger
  `departments_block_occupied_delete` (added by **0014**, not 0012, and verified in the
  `HANDOFF.md` §3.1 catalog query) refuses the delete if team members are assigned.
  Reassign first.
- **Permission keys:** removable from `lib/permission-keys.ts`; the RLS policies need
  dropping in a follow-on migration. **Migrations are forward-only — there are no down
  scripts** (`HANDOFF.md` §8). Write the down-script for the policy change at the same
  time as the up.
- **Agent specs:** `status: retired` in `agent_registry.yaml`. Specs are never deleted —
  §3.11, documentation is an enterprise asset.

## 8. Change-log entry (on approval)

```
product:     company
module:      HR
tab:         Departments
change_type: new
description: CHG-001 — Marketing created as a department under Constitution §7.
             Class 3, executive approval. Adds migration 0018 and the Marketing
             permission-key group. Agent specs in docs/agents/departments/marketing/.
```

`change_log` is append-only and cannot be edited or deleted by anyone including the
owner (migration 0008). Get the wording right before inserting.

## 9. Decisions required from Jessica

1. **Approve or decline** the department (§3).
2. **Read-access model** — option A or B (§5).
3. **Budget structure** — per-agent caps as specified (ceiling **$130/month**), or a
   department pool? Pool is a Class 3 spend-structure change (§4); per-agent is the
   conservative reading and what the specs currently declare.
4. **Manager** — confirm Jessica holds it, or name a delegate. §10.3: delegated
   authority must be documented, not assumed.
