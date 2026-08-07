# Scout Quest Education — Product Agents

| Field | Value |
|---|---|
| Product key | `education` |
| Compliance class | COPPA · FERPA · accessibility |
| Data | Learner data is **D3** and stays in the governed `asl-gateway` plane |
| Brand context | `CTX-004` |
| Active product agents | 2 |

---

## What is deliberately **not** here

This is the reuse-first principle (§3.1) doing real work, and it is why this folder has
two agents rather than fifteen.

| Job | Handled by | Not a separate Education agent because |
|---|---|---|
| Writing articles, pilot pieces, book sections | `mkt-longform-writer` + `CTX-004` | The writing discipline is identical; the *product* difference is a context page |
| LinkedIn posts | `mkt-linkedin-writer` + `CTX-004` | Same |
| Conference abstracts, talks | `mkt-speaking-agent` + `CTX-004` | Same |
| COPPA / FERPA review | `gov-compliance-reviewer` + `CTX-007` + `CTX-004` | The review discipline is identical; the boundary is a context page |
| Brand conformance | `gov-brand-conformance` + `CTX-004` | Same |
| Customer / UX research | `agent-ux-researcher` (existing, governed plane) | Already exists. Reuse it |
| Editorial planning | `mkt-editorial-planner` | One calendar, one owner |

**The pattern.** A product does not get its own copy of a shared job. It gets a
**context page**, and the shared agent loads it. Adding a third product means writing
one new context page, not cloning twelve agents.

## The two that are genuinely Education-specific

| Agent | Answers | Why it can't be shared |
|---|---|---|
| `sqe-standards-alignment` | *Which standards does this map to?* | State academic standards are a domain nothing else in the enterprise touches |
| `sqe-pilot-evidence` | *What do the pilots actually show?* | Sits closest to the D3 boundary in the whole library and needs a spec that says so precisely |

## The D3 line for this product

**No agent in this library reads learner data.** Ever. Pilot findings reach agents only
as an **approved, de-identified, human-reviewed summary** — the crossing rule in
`CTX-002`: a field crosses only if it cannot vary with what a student wrote.

`sqe-pilot-evidence` is the agent that sits on this line, and its spec is written
tightly for that reason.

## Active work this supports (August 2026)

Product and build · research and evidence · compliance · branding and content for
events, pilot articles, book, and speaking.
