# CTX-000 — Context Library Index

**Why this exists.** Constitution §3.2 puts *"existing approved content"* at rung 1 of
the cost execution ladder — cheaper than every other option including manual work. A
context page is rung-1 content: written once, approved once, referenced by ID
thereafter. An agent that restates the brand voice in its own prompt is paying cloud-model
prices (rung 10) to reproduce something already written down.

**The rule.** An agent specification **references** context pages by ID. It does not
restate their contents. If two agents need the same fact, that fact belongs on a
context page, not in two prompts. If a spec and a context page disagree, the context
page wins.

**Context manifests.** Per Constitution §2, a Context Manifest is *"the minimum
approved, version-pinned context for one work order."* The orchestrator assembles it
by listing page IDs plus their versions — not by pasting text. An agent receives only
the pages its specification declares. A LinkedIn writer does not receive the budget
page; a compliance reviewer does not receive the channel cadence page.

---

## Pages

| ID | Page | Covers | Typical consumers |
|---|---|---|---|
| `CTX-001` | Enterprise Canon | Constitution digest, vocabulary, change classes, conflict-resolution order, standing rules | Every agent |
| `CTX-002` | Data Classes & Boundaries | D0–D3, the crossing rule, what may leave the governed plane | Every agent that touches data |
| `CTX-003` | Risk Tiers & Gates | Risk tiering, which gates fire, evaluation counts by tier, approval matrix | Orchestrator, gates, evaluators |
| `CTX-004` | Scout Quest Education — Brand & Product | Mission, voice, product facts, prohibited claims | Any agent producing Education output |
| `CTX-005` | Soundwiserx — Brand & Product | Mission, voice, clinical positioning, claim boundaries | Any agent producing Soundwiserx output |
| `CTX-006` | Audiences | Teachers, parents, districts, clinicians, investors, volunteers — what each cares about, what each must never be told | Content, research, outreach agents |
| `CTX-007` | Compliance Boundaries | COPPA, FERPA, HIPAA, CAN-SPAM, endorsement/testimonial rules, accessibility | Compliance reviewer, every publishing path |
| `CTX-008` | Evidence & Citation Standard | What counts as a source, confidence labelling, fact/assumption separation, the fabrication rule | Every research and writing agent |
| `CTX-009` | Channels & Cadence | Approved channels, publishing rhythm, what each channel is for | Editorial planner, writers, campaign agents |
| `CTX-010` | Budgets & Stop Conditions | Spend caps, the cost ladder in practice, objective stop conditions, degraded/offline behaviour | Orchestrator, every agent |
| `CTX-011` | Output Contracts | The schemas agents must return; mechanical validation rules | Every agent, `GATE-contract` |

---

## Versioning

Each page carries a `version` in its header. A context manifest pins the version. A page
change is at least Class 1. **The Class 3 pages — canonical list, and each page's own
header must match it — are `CTX-001`, `CTX-002`, `CTX-003`, `CTX-005`, `CTX-007`, and
`CTX-010`**, because each moves a canon, data, risk, compliance, or spend boundary (§4).
`CTX-004` is Class 2, rising to Class 3 for its mission or claim rules.

## Completeness

Pages marked `<!-- UNSET -->` in a field are incomplete on purpose. An agent that
encounters `UNSET` in a field it needs must **halt and escalate**, not fill the gap
from its own knowledge. Guessing a brand fact and guessing a compliance boundary are
the same failure with different blast radii (§5.5: *"never attempt silent
remediation"*).
