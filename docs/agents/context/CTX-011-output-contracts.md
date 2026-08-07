# CTX-011 — Output Contracts

> **version** 1.0 · **class** Class 2 to change · **enforced by** `GATE-contract`
> (deterministic — no model)

Every agent returns a **contract-defined output** to the orchestrator. It does not
address the next agent, does not choose the next step, and does not know who comes
after it. That is the dependency-inversion rule: the orchestrator decides routing, so
agents stay swappable.

`GATE-contract` validates **mechanically** — schema shape, required fields, prohibited
fields, caps. It does not judge quality. A structurally invalid output is rejected
**before** any evaluator sees it, because evaluating a malformed output wastes a
cloud-model call on a problem a regex already found.

---

## The envelope — every output carries it

```yaml
work_order:      WO-<PRODUCT>-<NNNN>
agent_id:        <registry id>
agent_version:   <semver>
context_manifest:                 # page IDs with pinned versions
  - CTX-001@1.0
  - CTX-004@0.9
status:          complete | partial | halted
stop_reason:     stop_condition_met | iteration_limit | cap_reached | halted_escalation | blocked_unset_field
tokens_in:       <int>
tokens_out:      <int>
cost_usd:        <decimal>
data_classes:    [D0, D1]         # what this run actually touched
change_class:    1 | 2 | 3 | 3+
escalations:     []               # non-empty means a human must look
open_gaps:       []               # every <!-- NEEDS SOURCE --> and <!-- UNSET -->
payload:         <contract below>
```

**`status: partial` is a legitimate, successful result.** An agent that halts on an
`UNSET` field or a missing source has done its job correctly. Only `halted_escalation`
signals a problem, and even then the problem is usually upstream.

**`escalations` is not optional garnish.** A non-empty `escalations` array blocks
automatic progression at every tier, including Low.

---

## Contracts

### `Research` — research and evidence agents

```yaml
payload:
  question:        <the question as assigned, restated>
  findings:
    - claim:       <one claim>
      type:        fact | assumption | opinion
      confidence:  high | medium | low | unsupported
      sources:
        - citation: "[Author, Year — Title](URL)"
          tier:     1 | 2 | 3 | 4
          accessed: YYYY-MM-DD
          stale:    true | false
      falsified_by: <only for assumptions — what would disprove this>
  contradictions:  []   # where sources disagree — never silently resolved
  not_found:       []   # what was searched for and not found. Required, may not be empty-by-omission
  sources_consulted: <int>
```

`not_found` is required. A research output that reports only what it found, with no
account of what it looked for and missed, is unfalsifiable.

### `Draft` — content and writing agents

```yaml
payload:
  asset_type:      article | linkedin_post | newsletter | abstract | outline | script |
                   chapter | white_paper | one_sheet
  audience:        <exactly one, from CTX-006>
  channel:         <from CTX-009>
  brand_context:   CTX-004 | CTX-005      # exactly one. Never both — see below
  title:           <string>
  body:            <markdown>
  claims:
    - claim:       <any factual or outcome claim made in the body>
      source:      <citation, or NEEDS_SOURCE>
      derived_from: <work order or source asset, if repurposed>
  cta:             <string or null>
  alt_text:        {}    # required for every referenced image — CTX-007
  word_count:      <int>
```

**`brand_context` is single-valued.** An asset that would need both brand pages is a
structural problem the brand pages do not cover: it escalates to `mkt-brand-messaging`
(`CTX-006` cross-audience rule), it is not resolved by loading both.

The `claims` array is what makes a draft reviewable. `eval-factuality` checks the array
against the body — **a claim in the body but absent from the array is a
`GATE-contract` failure**, because it means the agent made a claim it did not notice
making.

### `Proposal` — a diff to a governed document

For agents that propose changes to a context page or governed doc rather than producing
an asset. A human applies the diff; the agent never edits the page.

```yaml
payload:
  target:          <the document and field being changed>
  target_version:  <pinned version of the document as read>
  changes:
    - field:       <field or section>
      current:     <verbatim current text, or UNSET>
      proposed:    <proposed text, or null if unresolvable>
      basis:       <the approved source or recorded human decision it derives from>
      change_class: 1 | 2 | 3 | 3+
      unresolved:  true | false   # true = needs human input, `proposed` stays null
  out_of_scope:    []
```

`basis` may not be the agent's own knowledge. A change with no approved source or
recorded human decision behind it is `unresolved: true` with `proposed: null` — which is
the expected outcome for most `UNSET` fields and is a successful result.

### `Plan` — planning and product agents

```yaml
payload:
  scope:           <what this plan covers>
  items:
    - title:       <string>
      rationale:   <why — one sentence>
      evidence:    <citation or work-order reference, or null>
      effort:      s | m | l
      depends_on:  []
      risk_tier:   low | medium | high | critical
      change_class: 1 | 2 | 3 | 3+
  sequencing_rationale: <string>
  out_of_scope:    []
  tradeoffs:       []   # §9.7 — required if the plan creates technical debt
```

### `Verdict` — evaluators

```yaml
payload:
  evaluator_id:    <registry id>
  lens:            task_compliance | factuality | adversarial | compliance | brand | security
  variant_id:      <the numbered rubric variant used>
  verdict:         pass | conditional_pass | fail
  confidence:      high | medium | low
  defects:
    - severity:    critical | high | medium | low
      location:    <where in the output>
      defect:      <what is wrong>
      evidence:    <why — the specific basis>
      remediation: <what would fix it>
  did_not_check:   []   # scope this evaluator could not cover. Required
  sealed:          true
```

**A verdict is a defect list, not a score.** §3.5's shipped guarantee is
*"verdict validated-not-trusted (a defect list, not a score)."* A number invites a
threshold; a defect list forces someone to read what is wrong.

`did_not_check` is required and follows the `lib/review-guide.ts` doctrine —
**cap verification, but log what you drop.** An evaluator that silently narrowed its
scope reads as full coverage when it was not.

`sealed: true` means the evaluator saw no other evaluator's verdict before submitting.
Once submitted, a verdict is **immutable** — revision requires a formal reconsideration
work order, not an edit.

### `Adjudication` — the adjudicator only

```yaml
payload:
  verdicts_received: []            # evaluator ids, all of them
  agreement:         unanimous_pass | unanimous_fail | split | adversarial_veto
  rule_applied:      <the row of the CTX-003 decision table>
  outcome:           proceed | remediate | human_required | blocked
  remediation_defects: []          # cited from verdicts, never authored here
  escalation_reason: <string or null>
```

The adjudicator **never authors a defect**. Everything in `remediation_defects` is
quoted from a verdict. If the adjudicator thinks something is wrong that no evaluator
found, the correct move is to escalate — not to add it.

---

## Prohibited fields — rejected by `GATE-contract` in any payload

- Raw D3 in any form, including quoted, excerpted, or described as anonymised
- Credentials, tokens, keys, connection strings, or any secret
- A next-agent assignment, a routing instruction, or a message to another agent
- A self-assessed quality score (`quality: 9/10`) — quality is the evaluators' output
- A URL the agent did not observe — constructed and plausible-looking URLs are
  fabrication (`CTX-008`)
- An approval, sign-off, or acceptance. Only humans approve (§5.3)
- A modification to another agent's output

---

## Why mechanical validation comes first

From the gap analysis: a model asked to check whether required fields are present is
slower, more expensive, non-deterministic, and **can be argued out of its answer by the
content it is inspecting**. A schema validator cannot be prompt-injected. Constitution
§3.2 rung 3 exists for exactly this, and `scripts/check-client-bundle.mjs` is the
existing proof — the most important security property in the repo is guarded by a build
script, not an agent.
