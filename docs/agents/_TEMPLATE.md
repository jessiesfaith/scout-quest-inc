# <AGENT-ID> — <Name>

> **The scope rule.** One question, one owned object, one output contract, one owner.
> Needing a second of any of them means this is two agents — split it. Target ~600
> words; a spec that needs far more is usually failing the scope rule, not the length
> one. (`AGENT_ARCHITECTURE.md` §3.)

| Field | Value |
|---|---|
| `agent_id` | `<kebab-id>` — must match `agent_registry.yaml` and the `agents` table |
| Layer | enterprise \| department \| product |
| Department | <name, or —> |
| Product | <key, or —> |
| Owner | <human accountable> |
| Version | `0.1.0` |
| `rollback_version` | <last known-good, or null> |
| Status | active \| planned \| blocked \| suspended \| retired |
| Registry | internal \| product |
| Consumer today (§3.8) | **<who consumes this output this week — required for `active`>** |

## The one question this agent answers

> *<A single question. If you need "and", it is two agents.>*

## Owns exactly one object

<The one artifact this agent is the sole owner of. §"one owner principle".>

## Must not

- <Explicit prohibitions — the adjacent jobs it must hand off rather than absorb>
- <Include the §5.3 boundaries that apply>

## Context (`CTX-*`, referenced not restated)

`CTX-001` · `<others>`

## Input

<Work-order fields it requires. It never infers a missing one — it returns for correction.>

## Output

Contract: `<Research | Draft | Proposal | Plan | Verdict | Adjudication>` from `CTX-011`.

## Stop condition (objective — `CTX-010`)

<Checkable by a gate without a model.>

## Limits

| | |
|---|---|
| Risk ceiling | low \| medium \| high \| critical |
| Data classes | D0–D<n>. **Never D3** unless explicitly justified |
| `per_run_cap_usd` | <decimal> |
| `monthly_cap_usd` | <decimal> |
| Iteration limit | <int> |
| Allowed tools | <allowlist> |
| Prohibited tools | publishing · payment · identity · external comms · production deploy (§5.3) |

## Evaluation

Per `CTX-003` by tier. Evaluators: <list>.

*Evaluator specs only:* state independence as **structural** and record that **model
diversity is deferred — asl-gateway #32**. Producing agents omit this; they are
evaluated, not evaluators.

## Operating modes (§3.6)

Normal: runs · Degraded: <behaviour> · Restricted: <suspended \| essential> ·
Offline: suspended · Recovery: suspended

## Escalate and halt when

- <Trigger> · a required `CTX` field is `UNSET` · a source cannot be verified ·
  D3 appears · a compliance boundary is reached

## KPIs

<2–4, measurable without a model.>

## Change class to modify this spec

Class <1|2|3>
