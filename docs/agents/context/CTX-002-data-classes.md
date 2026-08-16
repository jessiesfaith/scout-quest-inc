# CTX-002 — Data Classes & Boundaries

> **version** 1.0 · **class** Class 3 to change · **governs** Constitution §5.1,
> `HANDOFF.md` §5.2, `scripts/ingest/sources.mjs`

**Load this page if your work touches data of any kind.** Getting this wrong is the
one failure that cannot be undone by rolling back code.

---

## The four classes

| Class | Name | Examples | Where it may live |
|---|---|---|---|
| **D0** | Public | Published marketing, public website copy, released blog posts, public pricing | Anywhere |
| **D1** | Internal | Roadmaps, editorial calendars, internal drafts, agent specs, aggregate metrics | Company OS (Supabase/Vercel), local |
| **D2** | Confidential | Contracts, financials, partner terms, unreleased strategy, personnel records | Company OS with RLS, local |
| **D3** | **Regulated** | Student PII, learner work product, teacher-identified records tied to students, PHI, screening results, anything COPPA/FERPA/HIPAA covers | **Local governed plane only** |

When classification is uncertain, **default to the higher class**. This is not a
judgment call an agent gets to make in the permissive direction.

---

## The standing prototype rule (§5.1) — non-negotiable

> *"D3 remains on local infrastructure only; cloud tiers (Supabase/Vercel basic) carry
> synthetic `_TEST_` data exclusively."*

And from `HANDOFF.md` §1: *"No D3 (student/patient) data in this app, ever — company
and operations data only."*

The Company OS at `scout-quest-inc.vercel.app` is **D0–D2**. Scout Quest Education's
learner data and Soundwiserx's screening data are **D3** and stay in the governed
`asl-gateway` plane. The link between them runs **one way**: the plane pushes a
metadata summary outward, and nothing in the cloud tier can reach in.

---

## The crossing rule

`scripts/ingest/sources.mjs` states it as: *"a field may cross only if it cannot vary
with what a student or patient wrote."* `HANDOFF.md` §5.2 states the same rule from the
other direction: *"if a field could differ between two runs because of what a student
wrote, it does not cross."* Both apply to agents exactly as they apply to the ingest:

> **A field crosses only if it cannot vary with what a student or patient wrote.**

| Crosses | Does not cross |
|---|---|
| Identifiers, run IDs, work-order codes | Step output |
| Counts, durations, statuses, timestamps | Run parameters and prompts |
| Costs, token counts | Error detail |
| Commit subjects written by engineers about this repo | The ledger's `tenant` column |
| Aggregate, de-identified metrics | Anything a learner typed, said, or was scored on |

The test is **provenance, not shape**. It is not "no free text" — a commit subject is
free text and crosses, because no amount of student input can influence it. Ask: *who
authored this string, and could a learner's work have shaped it?*

---

## What this means for each agent type

**Research agents.** Public and internal sources only (D0–D2). A research agent may
read published literature, competitor sites, public standards documents, and your own
approved internal material. It may **not** read learner records, screening results, or
identified teacher/student data — even to summarise them.

**Content and marketing agents.** Everything they produce is destined for D0. They
therefore may not *receive* D3 at all. A pilot success story is written from an
**approved, de-identified summary** prepared under human review — never from source
records. Aggregate outcomes ("participating classrooms showed X") are fine; a named
student, a classroom small enough to identify a child, or a quoted piece of student
work is not.

**Compliance and evaluation agents.** They review *the output*, not the source data.
An evaluator checking a health claim reads the claim and the cited evidence, not the
patient record behind it.

**Product and planning agents.** D1–D2. A build-board item may say "improve the
screening flow's false-positive rate"; it may not contain the screening results.

---

## Escalation triggers

Halt and escalate immediately (§5.5) if:

- D3 appears in a context manifest that did not declare it
- An output contains something that could re-identify a student, a classroom, or a
  patient — including an unusually specific detail in a "de-identified" story
- A source document turns out to contain regulated data that was not declared
- An agent is asked to send anything to an external destination and cannot confirm the
  data class of what it is sending
- A pilot school, district, or clinic is named alongside an outcome in a way that
  makes individuals inferable

Suspected regulated-data exposure is **Class 3+ / SEV-1**: same-day notification to
Jessica and compliance counsel. Never remediate silently.

---

## Small-number re-identification

A rule that catches people out and is worth stating separately. "De-identified" is not
a property of a field, it is a property of a dataset. *"Three of the four students in
the resource room improved"* identifies children in a way *"the pilot cohort improved"*
does not. When a marketing or research agent reports an outcome from a small group, it
must report the **group size**, and any group under a threshold set by
`CTX-007` requires human review before publication.
