# Enterprise Gates — Deterministic Controls

> **These are not agents.** No language model sits in a gate. Constitution §3.2 puts
> rules at rung 3 and cloud models at rung 10 — a gate that could be a regex must be a
> regex. Gates are free per run, return the same answer every time, and **cannot be
> prompt-injected by the content they inspect.**

This file absorbs the security checkpoints the ChatGPT session proposed as agents —
six of them become the gates below, and a further nineteen go to the roadmap. The reasoning is in `../GAP_ANALYSIS.md` §3.2. The existing proof that this
works is `scripts/check-client-bundle.mjs` — the most important security property in
the repo (no secret reaches the browser) is guarded by a build script.

| Gate | Implemented as | Owner | Change class |
|---|---|---|---|
| `GATE-intake` | Schema validation on the work order | Security & Compliance | 2 |
| `GATE-authz` | Registry + allowlist lookup | Security & Compliance | 3 |
| `GATE-contract` | JSON-schema validation on agent output | Engineering | 2 |
| `GATE-runtime` | Counters, allowlists, spend meter | Engineering | 3 |
| `GATE-release` | Static scan of the final artifact | Security & Compliance | 3 |
| `GATE-audit` | Append-only ledger write | Security & Compliance | 3 |

---

## `GATE-intake` — before anything runs

**Passes when** every required work-order field is present and valid: work-order ID,
product, objective, audience, channel, risk tier, data classification, declared budget,
requester, required approvals, approved source materials, prohibited actions.

**On failure:** return the work order for correction. **Never infer a missing field.**
A work order missing its risk tier is not a low-risk work order.

**Why deterministic:** field presence is a schema check. Asking a model whether a form
is complete is paying rung-10 prices for rung-3 work.

## `GATE-authz` — before context assembly

**Passes when** the requested agent is registered in `agent_registry.yaml`, `enabled`,
at an approved version; every requested tool is on its allowlist; every data class in
the context manifest is within its declaration; and the work order's risk tier is at or
below the agent's `risk_ceiling`.

**On failure:** deny and log. **Never infer a permission.** A high-tier task may not be
assigned to a medium-ceiling agent, regardless of urgency (§4 — speed is last).

**Why deterministic:** this is a lookup against a registry. §5.3's *"enforcement is
structural"* means the credential itself lacks the permission — the gate is the second
layer, not the only one.

## `GATE-contract` — on every agent output

**Passes when** the declared `CTX-011` schema is returned, required fields are present,
prohibited fields are absent, tokens and cost are within cap, and no unauthorised tool
call was recorded during the run.

**On failure:** reject **before** evaluation. A malformed output never reaches an
evaluator — spending a cloud-model call on a problem a validator already found is the
ladder inverted.

**This gate does not judge quality.** Quality is what evaluators are for. A beautifully
written draft missing its `claims` array fails here, and correctly so: a claim in the
body but absent from the array means the agent made a claim it did not notice making.

## `GATE-runtime` — during execution

**Terminates on** a tool call outside the allowlist · a data read outside the declared
classes · an external destination not on the destination allowlist · rate limits ·
per-run spend cap · iteration limit · repeated identical tool calls · the same denied
request more than twice.

**Powers:** may terminate execution. **May not** delete evidence, suppress an alert, or
be overridden by the orchestrator.

**Why deterministic:** counters and allowlists. A model watching for runaway behaviour
is itself a runaway cost, and — the real argument — a monitor that reads the content it
is monitoring is a monitor that can be talked out of firing.

## `GATE-release` — before anything leaves

**Passes when** the destination is approved · every link resolves · no secret, key, or
token appears · no tracking pixel, tag, or third-party script was added · no hidden
metadata, comments, or revision history remain · every `<!-- NEEDS SOURCE -->` and
`<!-- UNSET -->` marker is resolved or explicitly accepted by a human · alt text is
present on every image (`CTX-007`) · required approvals are recorded on the ledger.

**Mandatory before:** publishing · sending email · launching ads · opening a form ·
distributing a file · updating a CRM · any external communication.

**Non-overridable by any agent, including the orchestrator.** Only Jessica's documented
override applies, and per the Owner Override protocol no override is silent.

**Note.** §5.3(d) already means no agent holds a publishing credential. This gate
guards the *human's* final action — it is the last thing that reads the artifact before
a person clicks send.

## `GATE-audit` — after every step

**Writes** the §5.4 record: timestamp · agent identity and version · workflow ·
input/output summaries · model and provider · token count and cost · data classes
touched · change class · approver (if any) · context manifest with pinned versions ·
evaluator verdicts and their variant IDs.

**Append-only, tamper-evident.** This mirrors what already ships: `change_log` and
`security_reports` have BEFORE INSERT triggers forcing timestamp and author, and
**no delete policy for anyone, including the owner** (migration 0008).

**A failed audit write is a halt condition,** not a warning. Work that cannot be
recorded does not proceed — §10.4 requires records to be auditable, and §10.8 favours
*"documented decisions over undocumented assumptions."*

---

## Where the gates sit

```
work order
   │
   ▼
GATE-intake ──fail──▶ return for correction
   │
   ▼
risk tier assigned (CTX-003)  ── never lowered afterwards
   │
   ▼
GATE-authz ──fail──▶ deny + log
   │
   ▼
context manifest assembled (page IDs + pinned versions, not pasted text)
   │
   ▼
sec-prompt-context  ── the one model in the security path (PLANNED — and until it
   │                     exists, no agent specified in THIS library may reach the
   │                     open web. agent-ux-researcher lives in asl-gateway and its
   │                     spec was not readable; verify it separately)
   │
   ▼
worker agent ◀──── GATE-runtime watches throughout
   │
   ▼
GATE-contract ──fail──▶ reject, do not evaluate
   │
   ▼
sealed parallel evaluators (count by tier)
   │
   ▼
eval-adjudicator  ── decision table, no judgment
   │
   ├── remediate ──▶ back to worker with defect list
   │
   ▼
human approval (tier-dependent)
   │
   ▼
GATE-release ──fail──▶ block (non-overridable)
   │
   ▼
human publishes  ── no agent holds this credential
   │
   ▼
GATE-audit (fires after every step above, not only here)
```

## Open implementation note

These gates are **specified, not built**. Constitution §3.7: a capability exists only
with an Overview, a named owner, an interface contract, and a consuming product —
*"anything short of this is 'planned,' and agents must not assume it is available."*
Today the enforcement that actually exists is: RLS in Supabase, the scoped-credential
boundary, `check-client-bundle.mjs`, the ingest's D3 boundary in `sources.mjs`, and
`agent-evaluator v0`'s fail-closed register. Building the gates is Class 2–3 work
tracked in `../ROADMAP_CATALOG.md`.
