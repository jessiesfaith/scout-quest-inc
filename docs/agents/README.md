# Agent Library

The shared enterprise agent library referred to in Enterprise Constitution §7. Agent
specifications, the context pages they reference, the registry, and the roadmap.

**Start here:** `AGENT_ARCHITECTURE.md` — how the whole thing fits together.

---

## Layout

```
docs/agents/
├── AGENT_ARCHITECTURE.md    the design (read first)
├── GAP_ANALYSIS.md          ChatGPT session vs. what Scout Quest Inc actually has
├── ROADMAP_CATALOG.md       the full ~90-agent catalog, with activation triggers
├── agent_registry.yaml      machine-readable index — reconcile with spend_policy.yaml
├── _TEMPLATE.md             spec template
│
├── context/                 CTX-000…011 — referenced by ID, never restated
├── enterprise/              GATES.md + 8 enterprise agents
├── departments/marketing/   charter + 5 agents (blocked on CHG-001)
└── products/
    ├── scout-quest-education/   2 agents
    └── soundwiserx/             1 agent
```

Related: `../governance/CHG-001-marketing-department.md` — the unapplied Class 3 change.

## The three ideas

**1. Context pages carry the facts; specs carry the job.** A spec references
`CTX-004` — it does not restate the brand voice. Restating it means paying cloud-model
prices (§3.2 rung 10) to reproduce a file that already exists (rung 1). It also means
two copies that can disagree.

**2. Not everything is an agent.** Gates are deterministic and cost nothing. Roles are
humans with decision rights. A check that could be a regex must be a regex — it is
cheaper, deterministic, and cannot be prompt-injected by what it inspects.

**3. Reuse before duplication.** One compliance reviewer profiled by a context page, not
one per product. One long-form writer, not one per asset type. Adding a product means
writing a context page, not cloning the library.

## Status today

| | |
|---|---|
| Specs written | **16** |
| Enabled in the registry | **9** (5 more blocked on CHG-001; 2 planned; 1 pre-existing) |
| Deterministic gates | **6** — specified, not built (`GATE-audit` partial: `change_log` and `security_reports` already ship append-only) |
| Context pages | **11** (`CTX-001`–`CTX-011`) plus the `CTX-000` index; several carry `UNSET` fields |
| Roadmap | 29 grouped entries, each with a named activation trigger |
| Declared ceiling | $420/month total · **$260/month enabled** |

## Reading order

**To understand the design:** `AGENT_ARCHITECTURE.md` → `context/CTX-000-index.md` →
`enterprise/GATES.md`.

**To understand what changed from the ChatGPT session:** `GAP_ANALYSIS.md` §0 and §3,
then `ROADMAP_CATALOG.md`.

**To use an agent this week:** its spec → the `CTX` pages it lists → `CTX-011` for the
output contract.

## Before anything runs

1. **Reconcile `agent_registry.yaml` with `config/spend_policy.yaml`** in asl-gateway.
   That file is what the Company OS mirrors; this one is the governance source of truth.
   They must agree. asl-gateway was not readable when this library was written.
2. **Do not hand-seed the `agents` table.** It is ingest-owned
   (`source = 'spend-policy'`) and the next sync would overwrite the rows.
3. **Fill the blocking `UNSET` fields.** Soundwiserx regulatory posture blocks *all*
   Soundwiserx external content. `departments/marketing/mkt-brand-messaging.md` lists
   them in priority order.
4. **Decide CHG-001.** The five marketing agents are written but cannot activate until
   the department exists.

## Changing something

| Change | Class |
|---|---|
| A spec's wording | 1 |
| A new agent, a new context page, an editorial rule | 2 |
| `CTX-001`, `CTX-002`, `CTX-003`, `CTX-005`, `CTX-007`, `CTX-010` · any status → active · any cap · a mission or claim rule · a gate · a department | **3** |
| Any regulated-data flow to an external party | **3+** |

When in doubt, classify upward (§4).
