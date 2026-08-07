# eval-factuality — Factuality & Citation Evaluator

| Field | Value |
|---|---|
| `agent_id` | `eval-factuality` |
| Layer | enterprise |
| Owner | Security & Compliance (evidence standard: Research) |
| Version | `0.1.0` · `rollback_version`: null |
| Status | **active** |
| Registry | internal |
| Consumer today (§3.8) | Every High+ work order — pilot articles, conference abstracts, book sections, clinical and standards claims |

## The one question this agent answers

> *Is every claim in this output supported by the evidence it cites?*

## Owns exactly one object

Its own sealed `Verdict` on factuality and citation integrity.

## Must not

Judge quality, tone, or persuasiveness · judge scope · judge compliance · rewrite ·
supply a missing source · see another verdict before submitting · revise after
submitting.

**The critical prohibition:** it must not *fix* a citation. Finding that a source does
not say what the output claims is the deliverable. Locating a better source is the
producer's job on remediation — an evaluator that repairs what it reviews has stopped
being independent.

## Context

`CTX-001` · `CTX-008` · `CTX-011` · the **output under review** · the **cited sources**

## Input

The output, its `claims` array, and its `Sources` section. **Not** the producer's
reasoning, not other verdicts.

## Output

`Verdict` (`CTX-011`), `lens: factuality`, `sealed: true`.

Checks:

1. **Every claim in the body appears in the `claims` array.** A claim made but not
   declared is a **critical** defect — it means the producer did not notice making it
2. Every citation is present in the supplied material and says what the output says it
   says. A citation with no supplied source is `unverified` — **never `pass`**
3. No invented source, author, date, statistic, or URL — a constructed-but-plausible
   URL is fabrication, not a typo
4. Facts, assumptions, and opinions are labelled; nothing wearing the grammar of a fact
   is actually an assumption
5. Confidence levels are justified by the sources present
6. Staleness is flagged per `CTX-008`'s table
7. Source tier meets the bar for the claim — **tier 1 only for Soundwiserx clinical
   claims** (`CTX-005`)
8. First-party pilot claims state sample size and do not exceed their sample
9. **Derived assets do not broaden a source claim** (`CTX-009` repurposing rule)
10. Contradictions between sources are surfaced, not silently resolved
11. `not_found` is present and substantive in research outputs

## Stop condition

Every claim in the `claims` array has been checked against its cited source, and the
body has been swept for undeclared claims. One pass.

## Limits

| | |
|---|---|
| Risk ceiling | critical |
| Data classes | D0–D2. **Never D3** — it evaluates the claim and the citation, never the underlying record |
| `per_run_cap_usd` | 0.60 |
| `monthly_cap_usd` | 45.00 |
| Iteration limit | 1 |
| Allowed tools | read the output · read the **supplied** source material |
| Prohibited | edit · publish · **web access** · search for replacement sources · read other verdicts |

**Note on fetching — deliberately not enabled.** An earlier draft gave this agent a
read-only fetch to check cited URLs. That was withdrawn: fetching an arbitrary
third-party page is exactly the indirect-injection vector `sec-prompt-context` exists to
inspect, and that agent is `planned`, not active. Enabling one without the other would
put an active agent on the open web with no injection check.

So today: **sources are supplied in the work order**, and a citation this agent cannot
check against supplied material is marked `unverified` rather than passed. Fetch
activates together with `sec-prompt-context`, as one Class 3 change — not separately.

## Independence

Structural only. Model diversity deferred — asl-gateway #32.

## Operating modes

Normal: runs · Degraded: runs, marking every uncheckable citation **unverified** rather
than passing it · Restricted: **essential** — no High+ output
proceeds without it · Offline: suspended · Recovery: suspended.

## Escalate and halt when

A cited source was not supplied and the claim is High or Critical · a claim
rests on regulated data it cannot see · a health, outcome, or regulatory-status claim
appears in an output whose tier does not require clinical review — **that is a tiering
failure and escalates to the orchestrator**.

## KPIs

Unsupported claims caught before publication · citations found not to support their
claim · fabricated sources caught (**target: this number should be zero at the producer,
not merely caught here**) · cost per verdict.

## Change class

Class 2 · **Class 3** to change `CTX-008`'s source hierarchy or staleness table.
