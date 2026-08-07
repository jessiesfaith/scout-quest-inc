# CTX-003 — Risk Tiers & Gates

> **version** 1.0 · **class** Class 3 to change · **governs** which checks fire, how
> many evaluators run, and who approves

Risk is assigned at intake, **before any agent runs**. The tier is a property of the
work order, not a negotiation. An agent may raise a tier mid-run by escalating; no
agent, and not the orchestrator, may lower one.

---

## The four tiers

| Tier | Description | Examples |
|---|---|---|
| **Low** | Internal, reversible, no external audience, no regulated data | Internal brainstorm, draft outline, summary of approved analytics, a build-board item |
| **Medium** | Public but routine, or mutates persistent internal data | A LinkedIn post from approved source material, website copy update, editorial calendar change, a schema-free content draft |
| **High** | Public with commitment, spends money, or makes a claim | Paid advertising, outbound email, partner or district communication, a claim about outcomes, a published article, pilot recruitment, conference abstract |
| **Critical** | Regulated data, health claims, legal, financial, or irreversible | Anything touching D3, a Soundwiserx clinical or screening claim, investor disclosure, legal or policy statement, crisis communication, anything to or about minors |

**Tier floors that override the table above.** Regardless of how routine the work
looks:

- Anything touching D3 → **Critical**
- Any Soundwiserx statement a reader could take as a health, diagnostic, or screening-accuracy claim → **Critical**
- Any outcome claim about students, classrooms, or patients → **Critical**
- Any external communication (email, DM, outreach) → **High** minimum
- Any spend of real money → **High** minimum

---

## The six gates

Gates are **deterministic**. No language model sits in a gate. This is Constitution
§3.2 rung 3 (rules), not rung 10 (cloud model) — gates cost nothing per run, return
the same answer every time, and **cannot be prompt-injected by the content they
inspect**. Full specifications in `../enterprise/GATES.md`.

| Gate | Fires | Checks | On failure |
|---|---|---|---|
| `GATE-intake` | Before anything | Required work-order fields present, requester authorised, product and channel valid, budget declared, tier assigned | Return for correction. Never infer a missing field |
| `GATE-authz` | Before context assembly | Agent registered and enabled, version approved, requested tools on its allowlist, data classes within its declaration, tier within its risk ceiling | Deny and log. Never infer a permission |
| `GATE-contract` | On every agent output | Required schema returned, required fields present, prohibited fields absent, token and cost within cap, no unauthorised tool call recorded | Reject before evaluation. A structurally invalid output is never evaluated |
| `GATE-runtime` | During execution | Tool allowlist, data reads, destination allowlist, rate limits, spend thresholds, loop and repeat detection | May terminate execution. Cannot delete evidence |
| `GATE-release` | Before anything leaves | Destination approved, links resolve, no secrets, no tracking pixels, no hidden metadata, no unreviewed personal data, required approvals recorded | Block. Non-overridable by the orchestrator |
| `GATE-audit` | After every step | Writes the §5.4 record: timestamp, agent identity and version, workflow, I/O summary, model and provider, tokens and cost, data classes, change class, approver | Append-only. Failure to write is a halt condition |

---

## Evaluation intensity by tier

Structurally independent evaluators, submitting **sealed** (see `../enterprise/orch-enterprise.md`).

| Tier | Evaluation required |
|---|---|
| **Low** | `GATE-contract` only. No model evaluator — a Low-tier internal draft does not earn a cloud-model review |
| **Medium** | `eval-task-compliance` + one domain evaluator appropriate to the output |
| **High** | `eval-task-compliance` + `eval-factuality` + `eval-adversarial`, sealed and parallel |
| **Critical** | All three above + `gov-compliance-reviewer`, **plus human approval**, plus `GATE-release` |

**The adversarial evaluator has a veto.** If `eval-adversarial` fails an output, the
work order does not proceed automatically even when every other evaluator passes.
Resolution requires remediation or an explicit, recorded human acceptance.

---

## Evaluator agreement rules

Applied by `eval-adjudicator` as a **decision table**, not a judgment:

| Situation | Result |
|---|---|
| All pass | `proceed` |
| Pass + conditional pass | `remediate` the named issues; re-run **only** the affected checks |
| Pass + fail | `human_required`. No automatic proceed |
| All fail, different reasons | `remediate` with **all** findings, not the easiest one |
| All pass but adversarial fails | `human_required` — **veto, non-overridable** |
| Any compliance fail | `blocked` — **non-overridable** (`gov-compliance-reviewer`) |
| Verdict set incomplete | `blocked` — fail closed |
| Same defect surviving the 3rd remediation round | `human_required` |
| Repeated disagreement across work orders | Escalate the **policy**, not the asset — the rubric, work order, or source evidence is ambiguous |

---

## Human approval matrix

| Tier | Approver |
|---|---|
| Low | Automatic after `GATE-contract` |
| Medium | Department Manager (today: Jessica) |
| High | Jessica, with the evaluator reports attached |
| Critical | Jessica **+ counsel or clinical review** where §4 Class 3+ applies |

Approval is recorded on the append-only ledger with the approver's identity before the
next gate opens. An approval that is not recorded did not happen.

---

## What no gate can be talked out of

`GATE-release` and the compliance path are **non-overridable by any agent, including
the orchestrator**. Constitution §4's executive override is Jessica's alone, and per
the Owner Override protocol: safe-direction actions (halt, freeze, tighten, revoke)
are instant and unilateral; risk-increasing overrides are password-gated, logged,
time-boxed, and reviewed. **No override is silent.**
