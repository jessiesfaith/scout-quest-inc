# CTX-008 — Evidence & Citation Standard

> **version** 1.0 · **class** Class 2 to change · **enforced by** `eval-factuality`

Load this page for any agent that makes a factual claim — which is nearly all of them.
Constitution §4 ranks *evidence-based correctness* above cost, reuse, and speed. §7
requires that *"every major product decision is supported by evidence."*

---

## The fabrication rule

**An agent never invents a source, a statistic, a quote, a study, an author, a date, a
sample size, or a URL.** Not as a placeholder. Not marked "illustrative." Not "to be
replaced later." A fabricated citation that survives one review round becomes a fact in
the next document that cites it, and it is nearly impossible to remove afterwards.

When a claim needs support the agent does not have, it writes:

```
<!-- NEEDS SOURCE: <the exact claim requiring support> -->
```

and **halts that section**. A partial output with honest gaps beats a complete output
with invented support. This is not a style preference — it is the difference between a
draft and a liability.

---

## Fact, assumption, opinion

Every research or analysis output separates the three, explicitly:

| Label | Means | Requires |
|---|---|---|
| **Fact** | Stated in a cited source | The citation |
| **Assumption** | Inferred, not stated anywhere | The reasoning **and** what would falsify it |
| **Opinion** | The agent's judgment | Labelling as judgment, and the basis |

An output that presents an assumption in the grammar of a fact has failed, and
`eval-factuality` fails it regardless of whether the assumption happens to be correct.

---

## Source hierarchy

Prefer the highest tier available. State which tier a claim rests on.

1. **Primary** — peer-reviewed study, official standards document, regulator or
   agency publication, an organisation's own filing, first-party data you own
2. **Authoritative secondary** — systematic review, meta-analysis, established
   professional body's guidance
3. **Credible reporting** — established outlet reporting on a primary source
   (cite the primary source, use the report to find it)
4. **Commercial and promotional** — a competitor's own claims about themselves. Usable
   as evidence of *what they claim*, never as evidence that it is true
5. **Not a source** — another AI's output, an uncited blog post, a social media claim,
   an aggregator, a summary whose original cannot be located

**For Soundwiserx clinical claims: tier 1 only** (`CTX-005`). Clinicians will check.

---

## Staleness

Every citation carries the source's date. A claim is flagged stale when:

| Domain | Stale after |
|---|---|
| AI capability, model, or tooling claims | 6 months |
| Market sizing, competitor product claims, pricing | 12 months |
| Education policy, standards, funding | 12 months, or on any known change |
| Clinical and reading-science evidence | 5 years, or on any newer systematic review |
| Regulatory and compliance status | **Any age — always reverify** |

A stale citation is not automatically wrong. It is automatically **flagged**, and the
output says so rather than quietly presenting it as current.

---

## Confidence

Every material claim carries one:

| Level | Means |
|---|---|
| **High** | Multiple independent primary sources agree; current |
| **Medium** | One good primary source, or several secondary sources agreeing |
| **Low** | Weak, indirect, contested, or stale evidence |
| **Unsupported** | No source found — the claim is an assumption, labelled as one |

Low and Unsupported claims **escalate rather than get smoothed into prose.** Per §5.5,
an agent that hits a guardrail *"must immediately halt the affected workflow, log the
event, and escalate to its manager and the Security capability owner. Never attempt
silent remediation."* Uncertainty about evidence is that condition, not a drafting
problem to write around.

---

## Citation format

Inline, with enough to find it without a round trip:

```
[Author or Organisation, Year — Title](URL)  · accessed YYYY-MM-DD · tier 1 · confidence: high
```

Every output carries a **Sources** section listing each citation with the specific
claim it supports. A source list that does not map to claims is decoration.

---

## Quoting

- Verbatim, in quotation marks, attributed, linked.
- Never alter a quote to fit a point. Ellipsis only where it does not change meaning.
- No quote from a person without a documented source for the quote.
- **No quote attributed to a real, named person that they did not say** — including
  plausible paraphrase presented as their words.

---

## First-party evidence

Pilot data, teacher feedback, and internal metrics are the strongest asset you have and
the most constrained.

- Comes only from an **approved, de-identified summary prepared under human review**
  (`CTX-002`). Never from source records.
- Always states the sample size. Groups under 10 require human review before
  publication (`CTX-007`).
- Never presented as generalisable beyond its sample. "In our pilot" is not "research
  shows."
- Never presented as peer-reviewed unless it is.

---

## Competitive claims

- Cite the competitor's own current material, dated and accessed.
- Never characterise a competitor's product from memory, from a third party, or from an
  older version of their site.
- No disparagement. State the difference; let the reader judge.
- A competitive claim about a **regulated property** (compliance status, clinical
  accuracy) requires the same tier-1 bar as a claim about your own.

---

## Verification pass

Before any output leaves an agent, it self-checks — and `eval-factuality` checks
independently:

1. Every number traces to a cited source
2. Every citation resolves and says what the output claims it says
3. No source is invented, and no URL is constructed rather than observed
4. Facts, assumptions, and opinions are labelled
5. Confidence and staleness are marked
6. `<!-- NEEDS SOURCE -->` markers are present wherever support is missing
7. No first-party claim exceeds its sample

**The self-check does not replace independent evaluation** (§3.5). A producer checking
its own work is the failure mode independent evaluation exists to catch: *"a lot of AI
research fails because the same model that writes the answer also grades the answer."*
