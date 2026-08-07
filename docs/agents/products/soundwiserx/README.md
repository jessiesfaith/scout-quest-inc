# Soundwiserx — Product Agents

| Field | Value |
|---|---|
| Product key | `soundwiserx` |
| Compliance class | HIPAA-adjacent · health-claim boundaries · accessibility |
| Data | PHI and screening results are **D3** and stay in the governed `asl-gateway` plane |
| Brand context | `CTX-005` |
| Active product agents | 1 |

---

## The standing rule for this product

**Soundwiserx output defaults to Critical tier** (`CTX-003`). Anything a reasonable
reader could take as a clinical, diagnostic, screening-accuracy, or outcome claim
requires human clinical **and** legal review before it goes anywhere.

`CTX-005` is loaded with `CTX-007` for every Soundwiserx work order. There is no
Soundwiserx work order where `CTX-007` is optional.

## Blocking issue — read this first

`CTX-005` marks **regulatory posture as `UNSET`**, along with the product description,
age range, setting, administrator, and output form.

**Until a human fills those, no Soundwiserx external content can be approved.** Every
content agent will halt on them, which is the design working — but it means the highest
priority for this product is not an agent, it is a `mkt-brand-messaging` work order with
Jessica supplying the facts.

## What is deliberately **not** here

| Job | Handled by | Not a separate Soundwiserx agent because |
|---|---|---|
| Articles, book sections | `mkt-longform-writer` + `CTX-005` | Writing discipline is identical; the product difference is a context page |
| LinkedIn | `mkt-linkedin-writer` + `CTX-005` | Same — with the note that short-form compression is where a screening claim most easily becomes a diagnostic one |
| Conference abstracts, talks | `mkt-speaking-agent` + `CTX-005` | Same |
| HIPAA and health-claim review | `gov-compliance-reviewer` + `CTX-007` + `CTX-005` | One review discipline; the boundary is a context page |
| Brand conformance | `gov-brand-conformance` + `CTX-005` | Same |

This is §3.1 reuse-first. **The strictness lives in the context page, not in duplicated
agents** — which also means tightening the Soundwiserx boundary is one file edit that
takes effect everywhere, rather than five specs that can drift apart.

## The one that is genuinely Soundwiserx-specific

`swx-clinical-evidence` — the clinical and reading-science literature is a domain with
its own source hierarchy (tier 1 only), its own vocabulary, and an audience of
clinicians who will check the citations.

## Not built: `swx-product-planner`

Product and build work is real today, but planning it does not yet need an agent. It is
rung 2 (manual) on the cost ladder and §3.8 says do not build ahead of need. When the
build board outgrows manual planning, the spec is a copy of the Education pattern with
`CTX-005` swapped in.
