# Work Orders and Tickets — what each one is for

> **version** 1.0 · **class** Class 3 to change · **governs** which record you
> open when something needs doing, and how the two connect

Two records exist because two different things happen. Confusing them is how a
board fills with items nobody can act on.

---

## The one-line rule

> A **work order** commissions an agent to produce something.
> A **ticket** records that something is wrong and must be repaired.

A work order is *forward-looking and budgeted*. A ticket is *backward-looking
and diagnostic*. A work order spends money on model calls. A ticket spends
engineering attention.

---

## Work order — `WO-<PRODUCT>-<NNNN>`

Constitution §2 defines it: **one execution instance of a workflow.** That
definition is the test. If no agent executes, it is not a work order.

A work order carries a risk tier assigned at intake, a declared budget, a
context manifest, and a required number of independent evaluators — all set
before anything runs. It moves through fourteen stages, six of which are
deterministic gates that cost nothing and cannot be prompt-injected:

```
intake → scope → risk → context → assign → execute → validate
       → evaluate → adjudicate → remediate → approve → release → audit → outcome
```

**Open a work order when:** an agent should produce, review, plan or evaluate
something. New capability, new content, a scheduled evaluation run.

**Do not open one for:** a code change a human makes. That is not an execution
instance of a workflow, it has no risk tier, no evaluators and no model spend.

---

## Ticket — `TCK-NNNN`

A defect record. Something in the system is wrong, and a human decides what to
do about it.

A ticket carries a type, a severity, a status, and — when it claims to be done
— **evidence**. It has no budget and no gates, because nothing executes; a
person reads code and changes it.

**Open a ticket when:** something is broken, exposed, misleading, or has
drifted from the document that governs it.

**Do not open one for:** new capability. "Add a Finance export" is not a
defect. It is a plan item, or a work order if an agent builds it.

---

## How they connect — the trace

The two records point at each other, and that is the chain an audit walks:

```
Constitution clause          why the rule exists
      ↓  governs
Context pack (CTX-NNN)       the rule an agent can actually read
      ↓  loaded by
Agent                        the thing that acts
      ↓  runs under
Work order (WO-…)            one execution, with its tier and budget
      ↓  evaluation fails, or a review reads the code
Ticket (TCK-…)               what is wrong
      ↓  repaired by
Commit / migration           the change, and the evidence it worked
```

Both directions occur:

- **Work order → ticket.** A run fails adjudication, or a review of the code
  finds a defect. The work order is the *origin*; the ticket is the *finding*.
- **Ticket → work order.** A repair large enough to need agent work commissions
  one. The ticket is the *reason*; the work order is the *doing*.

A ticket may exist with no work order at all — most do. Every defect found by
reading code rather than by watching a run has no execution behind it, and
recording a fake one to fill the column would be worse than a blank.

---

## Ticket types

What kind of wrong it is. One value, chosen by the **most specific** that fits.

| Type | Use when | Example |
|---|---|---|
| `incident` | It reached production and the exposure window matters — you need to know when it started and when it stopped | The context view leaked 88 rows to anonymous callers |
| `security` | An access-control or exposure defect that has not been shown to be live, or whose harm is potential | A permission key grants more than its name implies |
| `break-fix` | Wrong behaviour: a crash, a wrong result, a broken flow | An agent rename crashes the reader |
| `honesty` | A screen states something it cannot know — an empty result rendered as a confident zero | "0 security reviews" shown to someone RLS hides the archive from |
| `maintenance` | A true-up that keeps records accurate | Two tools count lines by different rules |
| `governance-drift` | Code and the document that governs it disagree | A permission key no policy consults |
| `docs` | The governing document itself is wrong, or prescribes something impossible | A note telling you to edit a migration that cannot change existing rows |

**Tiebreak, stated so it is not re-litigated each time:** `incident` beats
everything. If it was live in production and you need an exposure window, it is
an incident regardless of its other nature — the severity and the links carry
the rest.

`honesty` is its own type rather than a flavour of `break-fix` because this
system has a recurring failure mode worth counting separately: a query the
viewer is not permitted to run returns empty, and the screen renders that as
fact. The code is doing exactly what it was written to do. Only the claim is
wrong.

---

## Ticket statuses

Where it is in its life. These are **not** types — a `security` ticket and a
`docs` ticket move through the same states.

| Status | Meaning |
|---|---|
| `open` | Confirmed, nobody is on it |
| `in-progress` | Someone is working on it |
| `fixed` | The change is written. Requires a commit or migration to point at |
| `verified` | Someone observed it working. **Requires evidence** |
| `unverified` | Raised but never confirmed or refuted. Not a defect yet, and not dismissed |
| `rejected` | Investigated and found not to be real. Kept, because what was considered and dropped is part of the record |
| `accepted-risk` | Real, and deliberately not being fixed. **Requires a reason** |

### Why `fixed` and `verified` are separate

Because on 2026-08-16 they were not, and it mattered.

Migration `0023` fixed a live data leak and carried a self-check to prove it.
The check could never run — a `revoke` two lines earlier made the verifying
read fail, and the error handler reported the failure as an inconclusive
"could not verify". It printed the same reassuring notice whether the fix had
worked or not. The fix was real, but the only actual proof came from probing
the endpoint from outside and getting a 401.

A board where "done" can be claimed on the author's say-so records that as
complete. So the database refuses it: `verified` requires `verified_how`, and
that field must say what was **observed** — a command run, a status code, a
query result — not that someone believes it works.

### Why `unverified` and `rejected` are kept

An archive that stores only what survived cannot show that the process was
honest. In one review, 18 of 24 findings were rejected on trace — that ratio
*is* the evidence that verification does work. Deleting them would leave a
board that looks like every guess was right.

And a lead nobody has checked is not the same as a problem that does not
exist. `unverified` keeps that distinction visible instead of letting silence
become a clean bill of health.

---

## What does not belong on either

- **New capability.** Plan item, or a work order if an agent builds it.
- **A question.** Ask it. A ticket that resolves to "no, that's fine" should
  have been a conversation.
- **A preference.** "I'd rather this were blue" is a plan item.
