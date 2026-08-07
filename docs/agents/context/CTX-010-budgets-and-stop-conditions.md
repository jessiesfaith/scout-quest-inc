# CTX-010 — Budgets, Stop Conditions & Degraded Operation

> **version** 1.0 · **class** Class 3 to change (spend structure — §4) ·
> **governs** Constitution §3.2, §3.3, §3.6, §5.2

Load this page in every agent's context. It is short on purpose: an agent that has to
think hard about its budget is already over it.

---

## Spend caps

Every agent declares a **per-run** and a **monthly** cap (§5.2). Both are *specified* to
be enforced at `GATE-runtime`, not by the agent's cooperation — **but `GATE-runtime` is
not built yet** (`../enterprise/GATES.md`). Until it is, caps are honoured by the agent
and checked by a human afterwards, which is exactly the weak form §5.2 exists to
replace. Treat a declared cap as a commitment you are keeping, not a wall that stops
you.

| Threshold | What happens |
|---|---|
| 80% of monthly cap | Warn, notify manager |
| 100% | **Hard cutoff** |
| >120% of workflow budget | Workflow review |
| >150% | **Suspension pending approval** |

> **"No agent may raise its own cap."** (§5.2)

Cap changes are Class 2 within a department budget, Class 3 for budget structure. An
agent that hits its cap **halts and reports**; it does not degrade quality to fit, and
it does not silently truncate its work to squeeze under.

---

## The cost ladder, applied

§3.2 in practice, in the order an agent should think:

1. **Is this already written down?** A context page, an approved document, a previous
   work-order artifact. Rung 1 — free. Check before generating.
2. **Is this a rule?** Allowlist, schema check, format check, threshold. Rung 3 —
   a gate, not an agent.
3. **Is this a lookup?** Database, registry, existing ledger row. Rung 5.
4. **Is this retrieval?** Fetch and cite rather than recall and hope. Rung 6 — and it
   is also better evidence practice (`CTX-008`).
5. **Has this exact thing been produced before?** Rung 7 — reuse the cached output.
6. Only then: a model. Rung 10.

> *"AI is used only when it provides measurable value."*

The single biggest saving available is rung 1. An agent that restates the brand voice
in its prompt instead of referencing `CTX-004` is paying cloud-model prices to
reproduce a file that already exists. That is what this context library is for.

---

## Stop conditions

Every agent declares an **objective** stop condition. Not "when the output is good" —
something checkable by a gate without a model.

Acceptable stop conditions look like:

- The declared output schema is satisfied and `GATE-contract` passes
- N sources have been gathered and each resolves
- Every section of the required outline is present or explicitly marked
  `<!-- NEEDS SOURCE -->`
- Two consecutive iterations produce no new findings
- The declared iteration limit is reached

Unacceptable: "until the draft is good," "until confident," "until the research is
complete." Those are not conditions, they are hopes, and they are how an agent burns a
monthly cap in one afternoon.

**Iteration limits are hard.** An agent that reaches its limit without satisfying its
stop condition returns what it has, marked incomplete, with the reason. That is a
successful run with a partial result — not a failure to be retried automatically.

---

## Loop and repeat safety

`GATE-runtime` terminates execution on:

- Repeated identical or near-identical tool calls
- Iteration count above the declared limit
- Spend above the per-run cap
- An agent requesting a tool or data class outside its declaration
- An agent requesting the same denied thing more than twice

Termination writes an audit record and escalates. It never deletes evidence.

---

## Behaviour in each operating mode (§3.6)

Every agent specification declares its behaviour in all five. The defaults:

| Mode | Default agent behaviour |
|---|---|
| **Normal** | Runs as specified |
| **Degraded** | Runs if its dependencies are available; falls back to rung 1–7 work (existing content, lookup, retrieval, cache) where a model is unavailable; states what it could not do |
| **Restricted** | **Suspended** unless the agent is explicitly marked essential. High-risk and AI-dependent functions are disabled — including when a required security control is impaired, model behaviour is anomalous, or compliance evidence is incomplete |
| **Offline** | Suspended. No agent in this library has an approved local-only path today |
| **Recovery** | Suspended until validation completes. Runs only under an explicit recovery work order |

**No agent may change the operating mode.** A mode change is a Security Orchestrator
recommendation and, for enterprise-wide changes, follows the incident-authority matrix.

---

## Budget declaration for a new workflow

Before activation (§3.3), a workflow declares:

- Expected runs per month
- Expected tokens per run
- Expected monthly cost
- The named consumer of its output ← **this is the §3.8 test**
- Its objective stop condition

A workflow without a named consumer is not activated. It goes on the roadmap.
