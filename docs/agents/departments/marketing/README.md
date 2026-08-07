# Marketing Department — Charter

> **Status: proposed, not created.** Creating a department is a Class 3 change (§4 —
> org design) and Constitution §7 names only Product & Design, Engineering, Security &
> Compliance, and Learning Sciences (reserved). The change package is in
> `../../../governance/CHG-001-marketing-department.md` and is **unapplied**, awaiting
> executive approval. Everything below describes the department this repo will have
> once that is signed.

| Field | Value |
|---|---|
| Department | Marketing |
| Manager | Jessica (human role, agent-assisted — **not an agent**) |
| Inherits | Enterprise Constitution v1.4 · `../../context/CTX-001` |
| Agents | 5 written, **0 activatable** until CHG-001 is approved |
| Permission keys | `Marketing: Dashboard` · `Marketing: Content` · `Marketing: Calendar` · `Marketing: Brand` · `Marketing: Events` |

---

## Why a department and not a capability

A **capability** (§2) is a reusable function with an owner and an interface contract.
It has no staff, no approval queue, and no place in the org chart.

Marketing needs all three. Specifically it needs **role-scoped human access**: a
contractor or team member who can see the marketing dashboard and content, and nothing
else in the Company OS. Permissions in this app are keyed by permission strings —
mostly `Module: Tab` — and enforced in RLS. A capability cannot hold scoped human
access; only a module can, and a module needs a department to own it. That is the whole
argument.

## What the manager owns — and why it is not an agent

The Department Manager is a **role**, filled today by Jessica. It is deliberately not an
agent specification. Prioritisation, budget allocation, and approval authority are §4
decision rights held by a human; writing a "Marketing Director Agent" spec would
describe an authority no agent can hold and invite exactly the drift the architecture
exists to prevent.

The manager owns: quarterly priorities · budget within the department cap · campaign and
publication approval · the human approval decisions in `CTX-003` · the staffing trigger
in §4 (queue >20 pending, or >5 business days median wait for two consecutive weeks).

## The five agents (written; none activatable yet)

| Agent | Answers | Owns |
|---|---|---|
| `mkt-brand-messaging` | *What do we say we are?* | The brand pages `CTX-004` and `CTX-005` |
| `mkt-editorial-planner` | *What should we create, and when?* | The editorial calendar |
| `mkt-longform-writer` | *What is the article / chapter / pilot piece?* | Long-form drafts |
| `mkt-linkedin-writer` | *What is the LinkedIn post?* | LinkedIn drafts |
| `mkt-speaking-agent` | *What is the talk?* | Speaking and conference artifacts |

**One object, one owner.** No two agents own the same artifact. The planner does not
write; the writers do not plan; the brand agent does not produce campaign copy; nobody
publishes.

## Deliberately not built yet

The rest of the source session's marketing agents are in `../../ROADMAP_CATALOG.md`
with named activation triggers. §3.8: *"never build
enterprise machinery that has no consumer today."* Notably absent and staying absent:

- **Paid ads agents** — no declared ad budget (§3.3 requires one before activation)
- **Outreach and cold email agents** — trigger is *a written outreach policy reviewed by
  counsel*, not demand for leads (`CTX-007`)
- **Social scheduler / publisher** — no agent publishes (§5.3(d)), so a scheduler has
  nothing to do
- **Marketing knowledge graph, data warehouse, digital twin** — no consumer today, and
  as scoped in the source session they would pull D3 into the cloud tier (§5.1). See
  `../../GAP_ANALYSIS.md` §3.3
- **Instagram, TikTok, X, Facebook agents** — no active channel (`CTX-009`)

## The activation rule

An agent moves from `planned` to `active` only when **both** hold:

1. It has a **named consumer this week** (§3.8), and
2. **Jessica has run the job manually at least once.**

The second is the graph-engineering rule: *"if the manual version doesn't produce way
better work, automating it, honestly, will just produce mediocre work way faster."* An agent
automating a job nobody has done by hand is automating a guess.

## Workflow

Marketing work runs the standard enterprise path — `../../enterprise/GATES.md`. No
marketing-specific shortcut exists. In particular: **nothing publishes without human
approval**, and `GATE-release` is non-overridable by the department.

## Budget

<!-- UNSET: department monthly token budget. Required by §3.3 before any workflow
     activates. Per-agent caps are declared in each spec as the conservative reading;
     whether Marketing draws on a department pool instead is a Class 3 question about
     spend structure (§4). -->

Sum of the five agents' declared monthly caps: **$130.00**. This is a ceiling,
not a forecast.

## Dashboard

The Marketing module in the Company OS. Reads the editorial calendar, work-order status,
publication history, and spend against cap. **Read-only over agent data**, consistent
with the Agent Platform pattern. Build is Class 2 and tracked in
`../../../governance/CHG-001-marketing-department.md` §6.
