# Scout Quest Enterprise — Agent Architecture

| Field | Value |
|---|---|
| `document_id` | `GOV-AGENT-001` |
| Status | Draft for executive review |
| Owner | Jessica (Chief Executive) |
| Inherits | Enterprise Constitution v1.4 · `GOV-CANON-001` |
| Governs | `docs/agents/**` |
| Change class | **Class 3** — architecture and org design |

**Precedence.** The Constitution governs. This document says how agents implement it.
Where they conflict, the Constitution wins and this document is the bug. Where a context
page and an agent spec conflict, the **context page** wins.

---

## 1. Three layers

```
Enterprise    ── orchestration, evaluation, security, compliance, brand
      │          Every department inherits these. No department gets its own copy.
      ▼
Department    ── Marketing (proposed, CHG-001) · Product & Design · Engineering
      │          · Security & Compliance
      ▼
Product       ── Scout Quest Education · Soundwiserx
                 ONLY what cannot be shared. Everything else is a shared agent
                 plus a product context page.
```

**The rule that keeps this small.** A product does not get its own copy of a shared job.
It gets a **context page**. Adding a third product means writing one `CTX` file, not
cloning twelve agents. This is §3.1 reuse-first, and it is why Education has two product
agents and Soundwiserx has one rather than fifteen each.

---

## 2. Agents, gates, and roles — three different things

The single biggest correction this architecture makes to the source session.

| | What it is | Cost per run | Examples |
|---|---|---|---|
| **Gate** | Deterministic rule. No model | **$0** | Schema validation, allowlists, spend meters, link checking, secret scanning |
| **Agent** | A model, because the work needs judgment | Rung 10 | Writing, research, evaluation, injection detection, compliance reading |
| **Role** | A human with decision rights | — | Department Manager, executive approval, clinical review, counsel |

§3.2's ladder puts rules at rung 3 and cloud models at rung 10. **A check that could be
a regex must be a regex** — it is cheaper, deterministic, and cannot be argued out of
its answer by the content it is inspecting. That last property is not a nicety: a
model-based allowlist checker is a prompt-injection target; `scripts/check-client-bundle.mjs`
is not.

The session made all three of these "agents." Separating them moved six checkpoints to gates
and nineteen more to the roadmap, and removed most of the recurring cost.

---

## 3. What an agent is

Constitution §2: *"a logical AI role defined by a specification (role, responsibilities,
inputs, outputs, tools, permissions, evaluation, manager, escalation, documentation).
**An agent is NOT a permanently running process**; it executes only when assigned
work."*

Every agent has **one** of each:

| One | Meaning |
|---|---|
| Question | One question it answers. If you need "and", it is two agents |
| Owned object | One artifact it is the sole author of |
| Output contract | One schema from `CTX-011` |
| Owner | One accountable human |
| Risk ceiling | One tier — the highest it may be **assigned**. Individual work orders may sit below it |
| Stop condition | One objective, checkable termination |
| Scope | **If a spec needs a second question, a second owned object, or a second output contract, it is two agents.** The length guideline is ~600 words; the specs here run 540–870 and are longer than the rule wants. Length is the smoke, not the fire — the four "one"s above are the test |

---

## 4. The workflow

```
work order → GATE-intake → risk tier → GATE-authz → context manifest
   → sec-prompt-context → worker agent (GATE-runtime throughout)
   → GATE-contract → sealed parallel evaluation → adjudication
   → [remediation ⟳ ≤3] → human approval → GATE-release → human publishes
   → GATE-audit (after every step above)
```

Full detail: `enterprise/GATES.md`. Tier-dependent evaluation counts: `CTX-003`.

**Three properties worth naming:**

- **No agent knows who comes after it.** Each returns its contract output to the
  orchestrator, which routes. Agents stay swappable; coupling stays visible.
- **The one backward edge** is §3.5's two-way evaluation — the producer must accept or
  contest evaluator feedback before closure on Class 2+. It runs *through* the
  orchestrator; producer and evaluator never address each other.
- **Remediation is bounded.** Three rounds, then a human. An unbounded remediation loop
  is how a monthly cap disappears in an afternoon.

---

## 5. Context manifests — the token discipline

Constitution §2: *"the minimum approved, version-pinned context for one work order."*

The orchestrator lists **page IDs and versions**. It does not paste text. An agent
receives only the pages its spec declares.

This is simultaneously:

- **A security property** — least privilege (§5.1). A graphic agent has no contact data
  to leak because it never had any
- **The largest recurring cost saving** — `CTX-010`. An agent restating the brand voice
  in its prompt is paying rung-10 prices to reproduce a rung-1 file
- **The drift control** — one brand fact, one place. Tightening the Soundwiserx boundary
  is one file edit that takes effect across every agent, rather than five specs that can
  disagree

The library: `context/CTX-000-index.md`.

---

## 6. Independence — stated precisely

Evaluation independence today is **structural**:

- A different agent specification
- A **different context manifest** — `eval-adversarial` never sees the brief, so it
  reads the output as a stranger would
- Sealed submission — no evaluator sees another's verdict before submitting
- Immutable after submission — revision needs a reconsideration work order

**Not yet:** model diversity between producer and evaluator. Deferred as Class 3,
tracked in **asl-gateway #32** (§3.5 v0 scope). **No spec, document, or output may imply
otherwise.**

Rubrics are **version-controlled and excluded from worker context manifests**. Secrecy
comes from context scoping, not from being unwritten — the session proposed randomising
rubrics, which conflicts with §3.11/§10.4 and would make the drift `lib/review-guide.ts`
already warns about unmeasurable. `GAP_ANALYSIS.md` §3.5.

---

## 7. What agents may never do

Constitution §5.3, restated because it is the load-bearing boundary:

> No agent may, without explicit human approval: **(a)** deploy to production ·
> **(b)** modify permissions or identity records · **(c)** delete or bulk-modify
> persistent data · **(d)** communicate with external parties · **(e)** execute financial
> transactions · **(f)** modify this constitution or any security/compliance control.
>
> *"Enforcement is structural: agents hold scoped credentials that lack these
> permissions."*

**On autonomous publishing.** The source session frames it as something confidence
eventually unlocks. It is not. Confidence does not grant a credential — **a Class 3
constitution amendment does.** This paragraph exists so that nobody later reads the
session as authorisation.

---

## 8. Adding an agent

1. **Ask §3.1's question:** can this be a shared enterprise capability instead? Usually
   the answer is *an existing agent plus a context page.*
2. **Ask §3.8's question:** who consumes this output this week? No answer → roadmap.
3. **Ask the ladder question:** is this rung 3 (a gate)? Rung 1 (a context page)? Only
   then rung 10.
4. **Run it manually.** If the manual version is not clearly better than what you do
   today, automating it produces mediocre work faster.
5. Write the spec from `_TEMPLATE.md`. One question, one owned object, one contract.
6. Add to `agent_registry.yaml` **and** to `config/spend_policy.yaml` in asl-gateway —
   both, with identical `agent_id` and caps.
7. Declare the workflow budget (§3.3) before activation.
8. Class 2 (new agent) or Class 3 (new department, new data class, cap structure).

---

## 9. Honest limits

Per the doctrine in `lib/review-guide.ts`, stated in the same voice:

- **The gates are specified, not built.** §3.7: a capability exists only with an
  overview, an owner, an interface contract, and a consuming product; *"anything short
  of this is 'planned,' and agents must not assume it is available."* What actually
  enforces today: Supabase RLS, scoped credentials, `check-client-bundle.mjs`, the
  `sources.mjs` D3 boundary, and `agent-evaluator v0`'s fail-closed register.
- **Evaluation is a strong second opinion, not an independent audit.** The same person
  writes producer and evaluator prompts, including what counts as a defect.
- **Model diversity has not shipped.** asl-gateway #32.
- **`CTX-007` has not been reviewed by counsel,** and Constitution v1.4 §10 is itself in
  draft pending attorney review. A compliance pass means *no written boundary was
  crossed* — not that an output is lawful.
- **Several context pages carry `UNSET` fields,** most consequentially Soundwiserx
  regulatory posture. Agents halt on them. That is correct behaviour and it will block
  real work until a human fills them.
- **`config/spend_policy.yaml` was not readable** when the registry was written. The six
  agents already in it are unreconciled. Reconcile before any ingest run.
- **No agent in this library has run.** Every cap is an estimate, every KPI is a target,
  and the first month of real runs should be treated as calibration.

---

## 10. Sources

`GAP_ANALYSIS.md` records the clause-by-clause comparison against the ChatGPT session
and the two podcast transcripts, including what was rejected and why.
