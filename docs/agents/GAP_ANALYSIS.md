# Agent Architecture — Gap Analysis

**What this is.** A clause-by-clause comparison of the ChatGPT agent-architecture
session (marketing operating system → enterprise agents → security control plane →
"Enterprise Digital Employees") against what Scout Quest Inc **actually has today**:
Enterprise Constitution v1.4, the shipped Company OS on Supabase, and the governed
`asl-gateway` plane.

| Field | Value |
|---|---|
| document_id | `GOV-GAP-001` |
| Status | Draft for executive review |
| Owner | Jessica (Chief Executive) |
| Governs | `docs/agents/**` — the architecture in `AGENT_ARCHITECTURE.md` is the resolution of this analysis |
| Sources compared | ChatGPT session (2026-08-06) · `docs/enterprise-constitution-v1.4.md` · `HANDOFF.md` · `CLAUDE_CODE_KICKOFF_SCOUT_QUEST_INC_FULL.md` · migrations 0001–0017 · `scripts/ingest/sources.mjs` · the two uploaded transcript files. **Note:** the file titled "Graph Engineering" is a compilation of ten *Startup Ideas* episodes; the Graph Engineering episode is only its first section. Quotes below are labelled by episode — "Graph Engineering", "loop engineering", "AI Agents are the new SaaS" — not by filename |

---

## 0. The one-paragraph answer

The session is **architecturally right and quantitatively wrong**. Its three-layer
model (enterprise → department → worker), its single-responsibility rule, its
router-not-decider orchestrator, its blind parallel evaluation, and its refusal to
let a producer grade its own work are all correct, and several of them are things
your Constitution *already says* — §3.5 has required independent evaluation since
v1.1, and `agent-evaluator v0` shipped it to `main` in August. What the session gets
wrong is scale and mechanism: it proposes roughly **ninety agents** for a company
with one human, and it turns deterministic checks that cost nothing into language-model
calls that cost money on every run. Adopt the shape. Reject the headcount. Convert
about a third of its "agents" into gates.

---

## 1. What the session proposed that you already have

This is the most useful finding, and it is worth stating first: **the session
re-derived, from scratch, several things that are already written into your
Constitution or already running in production.** Where that happened, the
Constitution wins — it is the approved artifact and it is more precise.

| Session proposal | You already have | Verdict |
|---|---|---|
| "Context Manifest — task-specific, minimum necessary context" | Constitution §2 glossary: *"Context Manifest — the minimum approved, version-pinned context for one work order."* Note the two words the session missed: **approved** and **version-pinned**. | Already yours; keep your definition |
| "Marketing Work Order with a structured schema, `WO-MKT-0042`" | §2 glossary: *"Work Order — one execution instance of a workflow (`WO-<PRODUCT>-<NNNN>`)."* Plus a live `work_orders` table with `wo_code`, `agent`, `status`, `run_status`, `cost_usd`, `tokens_in/out`, `product_id`, ingested from the ledger. | Already yours, and already shipped |
| "Independent evaluation — evaluators must not simply agree with producers" | §3.5, verbatim: *"Evaluators must not simply agree with producers."* Shipped as `agent-evaluator v0`, register-pinned, fail-closed (`WORKFLOW_NOT_APPROVED`). | Already yours, and already shipped |
| "Enterprise Digital Employees — each with a permanent record: ID, owner, allowed tools, risk level, spend budget, version, status" | The `agents` table already carries `agent_id`, `owner`, `registry`, `data_classes`, `allowed_models`, `per_run_cap_usd`, `monthly_cap_usd`, `rollback_version`, `enabled`, `status`, `product_id`, `source`, `synced_at`. | Already ~70% built. The session proposes no field this table lacks |
| "Immutable history, no silent edits, every change logged" | `change_log` and `security_reports` are append-only with BEFORE INSERT triggers and **no delete policy for anyone, including the owner** (migration 0008). | Already yours, and stricter than proposed |
| "Five operating modes" | §3.6 — Normal, Degraded, Restricted, Offline, Recovery, plus Hypercare criteria. The session lists them back to you because you told it. | Already yours |
| "Agents cannot spend without approval thresholds" | §3.3 and §5.2 — declared monthly budget, 80% warn / 100% hard cutoff / >120% review / >150% suspension, and *"no agent may raise its own cap."* | Already yours, and more precise |
| "Least-privilege access, API key isolation, audit logs for every action" | §5.1 (per-agent declared data classes, denied and logged outside them), §5.3 (structural enforcement via scoped credentials + tool allowlist), §5.4 (immutable audit with model, provider, token count, cost, data classes, change class, approver). | Already yours |

**Implication.** Do not import the session's vocabulary where yours already exists.
Two names for one thing is exactly the duplication §3.11 and `GOV-CANON-001` exist to
prevent. Everything in `docs/agents/**` uses **your** terms.

---

## 2. What the session got right that you did not have

Five genuine additions. All five are adopted in `AGENT_ARCHITECTURE.md`.

**2.1 The orchestrator as a router, not an executive.** Your Constitution describes
departments and managers but never says what an orchestrator may *not* do. The
session's list is good and is adopted nearly verbatim: an orchestrator may not write
content, choose messaging, grade worker quality, override a security decision,
publish, spend, or rewrite a failed output itself. The single most valuable sentence
in the entire session is the negative one: *the orchestrator must never be able to say
"the evaluators disagree, but I think the campaign is good, so proceed."* That becomes
a deterministic decision table, not a judgment call.

**2.2 Blind parallel evaluation with sealed submission.** §3.5 requires *an*
independent evaluator. It does not say evaluators must not see each other's verdicts
before submitting, and it does not say verdicts are immutable once submitted. Both
are real strengthening and both are cheap. Adopted.

**2.3 The adjudicator as a separate, narrow role.** §3.5's pattern is
*Agent → Evaluator → Manager → Approval*, which quietly assumes the manager resolves
evaluator conflict. Splitting adjudication out — a role that compares sealed reports
against a predefined decision table and **may not re-evaluate the asset from scratch** —
removes a real drift path. Adopted.

**2.4 Security as multiple checkpoints rather than one final gate.** §5 states
security *obligations* but locates them nowhere in the workflow. Placing them at
intake, input, runtime, output, release, and post-execution is new and correct.
Adopted as six gates (see §3.2 below for why they are gates and not agents).

**2.5 "No agent should know who comes after it."** Dependency inversion for agent
specs. Each agent returns its contract-defined output to the orchestrator, which
decides the next step. This makes agents swappable without rewriting their prompts.
Adopted, with one correction — see §4.5.

---

## 3. Where the session conflicts with your Constitution

These are the rejections. Each cites the clause it violates.

### 3.1 Ninety agents violates §3.8 (counterweight) — the largest conflict

The session proposes roughly 60 marketing agents, 28 security agents, and an
enterprise layer on top. §3.8 is unambiguous:

> *"Never optimize only for today's prototype — but equally, **never build enterprise
> machinery that has no consumer today**. Do not create a folder, service, agent,
> standard, platform, or workflow until it has a current consumer, owner, or approved
> near-term implementation need; record future needs in the capability map or roadmap
> instead of creating empty structures."*

Ninety agent specifications is ninety documents to version, review, evaluate, budget,
and keep truthful — for a company where §4's human staffing trigger has not yet fired
once. It would also break §3.3 immediately: every workflow must declare a monthly
budget before activation, and you cannot honestly forecast budgets for agents that
have never run.

There is a second reason, independent of governance, from the Graph Engineering
material: *"more agents don't automatically mean better output. Sometimes more agents
mean more noise. Sometimes it means five AI workers confidently repeating the same
wrong idea. Sometimes it means the system spends more time coordinating than
thinking… The goal is actually to make the smallest graph that improves the quality
of work."*

**Resolution.** The full catalog is preserved in `ROADMAP_CATALOG.md` with every agent
marked `active` / `planned` / `rejected` and a named activation trigger. **Sixteen specs are
written; nine are enabled in the registry today** — two are `planned` and five are
blocked on CHG-001. Nothing is lost; nothing is built early.

### 3.2 Making everything an agent violates §3.2 (cost execution ladder)

The session assigns a language model to work that has no judgment in it. Its
"Tool and API Security Agent" does endpoint allowlisting, rate-limit enforcement,
schema validation, and replay prevention. Its "Output Contract Validation" step
checks whether required fields are present. Its "Release Security Agent" checks links
and tracking tags. Its "QA Agent" checks broken links and formatting.

§3.2 requires the **cheapest sufficient rung**. Allowlisting is rung 3 (rules). Schema
validation is rung 3. Link checking is rung 4 (workflow automation). None of them are
rung 10 (cloud model). A model asked to check an allowlist is slower, more expensive,
non-deterministic, and — this is the part that matters — **can be argued out of its
answer by the content it is inspecting.** A regex cannot be prompt-injected.

You already know this: `scripts/check-client-bundle.mjs` guards your most important
security property (no secret reaches the browser) and it is a build script, not an
agent.

**Resolution.** Six checkpoints are specified as **deterministic gates** with no model
in the path: intake validation, authorization, output-contract validation, runtime
monitor, release scan, audit write. They are documented in
`enterprise/GATES.md` and cost nothing per run. Only work requiring judgment —
"is this claim supported by the cited source," "could this be read as a health claim,"
"how would an adversary exploit this" — gets a model.

Rough effect: of the session's ~28 security agents, **six become gates, three become
agents, and nineteen go on the roadmap.**

### 3.3 A marketing data warehouse and knowledge graph risks §5.1 (data boundaries)

The session proposes pulling Google Analytics, Meta, LinkedIn, HubSpot, Salesforce,
Stripe, **teacher surveys, district surveys, pilot schools, and grant applications**
into one marketing warehouse, and building a Marketing Knowledge Graph whose nodes
include *Customers, Teachers, Parents, Students, Districts*.

Students and teachers in identified school contexts are FERPA and COPPA territory —
D3 under §2. §5.1's standing prototype rule is explicit: *"D3 remains on local
infrastructure only; cloud tiers (Supabase/Vercel basic) carry synthetic `_TEST_` data
exclusively."* Your Company OS is D0–D2 by design; `HANDOFF.md` §1 states
*"No D3 (student/patient) data in this app, ever."* A marketing graph with a
`Students` node in the cloud tier is a Class 3+ data-flow change and, as scoped, a
policy violation.

There is also a §3.8 problem: neither the warehouse nor the graph nor the proposed
"Marketing Digital Twin" has a consumer today. You do not yet run HubSpot or
Salesforce.

**Resolution.** Roadmap, not build. If and when it is built, the boundary rule in
`scripts/ingest/sources.mjs` applies unchanged — *"a field may cross only if it cannot
vary with what a student or patient wrote"* — and aggregate,
de-identified marketing metrics are the only thing that crosses. Recorded in
`ROADMAP_CATALOG.md` under `MKT-KG-*` with the Class 3+ gate named.

### 3.4 "Eventually you can automate more as confidence grows" contradicts §5.3

The session's human-approval position is right for now and wrong about the future. It
frames autonomous publishing as something confidence unlocks. §5.3 makes it a
structural prohibition:

> *"No agent may, without explicit human approval: … (d) communicate with external
> parties … Enforcement is structural: agents hold scoped credentials that lack these
> permissions."*

Confidence does not grant a credential. **A constitution amendment does.** Any future
move toward autonomous publishing is a Class 3 change requiring your executive
approval — not a threshold an agent crosses by performing well. Written into
`AGENT_ARCHITECTURE.md` §7 so nobody later reads the session as authorization.

### 3.5 Hidden rubrics and rotating prompts conflict with §3.11 and §10.4

The session recommends keeping evaluator rubrics private from workers, rotating
prompt variants at random, and running unannounced canary tests. The intent is sound —
prevent overfitting to a known test. The mechanism conflicts with your documentation
principles: §3.11 requires documentation to be *version controlled, traceable,
reviewable*; §10.4 requires records to be *auditable* and *protected against
unauthorized modification*.

It also makes an existing problem worse. `lib/review-guide.ts` already admits, honestly:
*"Review criteria are not version-controlled, so the bar can drift."* Randomizing the
criteria makes that drift **unmeasurable** — you lose the ability to tell a real
quality change from a rubric change.

**Resolution.** Rubrics are version-controlled in the repo and excluded from worker
**context manifests**. Secrecy comes from context scoping, not from being unwritten.
Evaluator prompt variants are numbered and committed; if one is selected per run, the
variant ID is recorded on the ledger with the verdict. You keep independence *and*
auditability.

### 3.6 Model diversity is already deferred — the session assumes it ships

The session says *"use different models or model versions for parallel evaluations."*
§3.5's v0 scope clause says the opposite, on the record:

> *"A general mechanism permitting arbitrary author-wired workflows to invoke
> independent evaluation, **and model diversity between producer and evaluator**, are
> deferred as Class 3 ('not yet'), tracked in asl-gateway #32."*

**Resolution.** Every spec that mentions independence says *structural* independence
(different agent specification, different context manifest, sealed submission) and
explicitly records model diversity as **deferred, asl-gateway #32**. No spec may imply
a guarantee that has not shipped. This is the same discipline `lib/review-guide.ts`
applies to review claims.

### 3.7 Twenty-eight security agents conflicts with §4's staffing model

Red Team, Blue Team, Purple Team, Forensics, Incident Commander, Vulnerability
Management, Independent Security Validation — as *separate owners* — describe a
security organization of perhaps fifteen people. Your §4 staffing trigger has not
fired. The session's own best idea here (the fix-verify separation: *"the agent that
fixes a weakness cannot verify the fix"*) survives at any size and is adopted. The org
chart does not.

**Resolution.** Three security-domain model agents (prompt/context inspection,
compliance review, adversarial evaluation) + six deterministic gates + your existing
adversarial review harness. The rest is roadmap with a named trigger: *first paying
district contract, or first D3 flow to a cloud provider.*

### 3.8 Cold outreach needs a harder look than "use selectively"

The session's own summary marks cold outreach ⚠ and moves on. For your business
specifically it is sharper than that: CAN-SPAM governs the email, platform terms of
service govern the LinkedIn scraping, and your buyers are **schools** — outreach into
a district's staff directory sits close enough to FERPA-adjacent data handling to
deserve an explicit rule rather than a caution.

**Resolution.** Outreach agents are `planned`, not active, and their activation
trigger is *"written outreach policy reviewed by counsel"* — not *"we need leads."*

---

## 4. Points where the session is internally inconsistent

Four places where following the session literally would break something.

**4.1 "No agent may call another agent directly" vs. your two-way evaluation.** §3.5
requires that *"the producer also reviews evaluator feedback and must explicitly
accept or contest it before closure"* for Class 2+ changes. The session's Rule 1
forbids the return path that requires. **Resolution:** the return path exists and is
routed *through* the orchestrator — producer and evaluator never address each other,
but a contest round is a legal orchestrator state. Written into the state machine.

**4.2 The adjudicator "may not see worker reasoning" but must "request remediation."**
Remediation instructions that cannot reference what the worker did are not actionable.
**Resolution:** the adjudicator sees the *defect lists* from evaluators (which cite
the output), not the worker's chain of thought. It emits a remediation work order
naming defects, never rewrites.

**4.3 "Never delete relationships" for the knowledge graph is unmaintainable.**
Every correction becomes permanent noise. **Resolution:** relationships are
*superseded with lineage*, not deleted and not immortal — the pattern your `change_log`
already uses.

**4.4 The session grades its own architecture.** Its adopt/reject table was produced
by the same model that proposed the architecture. That is precisely the failure §3.5
and the Graph Engineering material both name: *"a lot of AI research fails because the
same model that writes the answer also grades the answer."* This document is the
independent read. It should itself be evaluated by something other than me before it
is approved — which is the point.

---

## 5. What is missing from the session entirely

Six things your setup needs that the session never mentions.

1. **Per-run and per-month spend caps with automatic cutoff** (§3.3, §5.2). The session
   discusses budget approval thresholds for *ad spend* and never bounds *token* spend.
   For an architecture with ninety agents this is the difference between a marketing
   department and a runaway bill. Every spec in this library declares both caps.
2. **Degraded operation** (§3.6). What happens to a marketing workflow when the model
   provider is down? The session has no answer. Each spec declares its behaviour in
   Restricted and Offline mode.
3. **Provider independence** (§3.4). No spec names a provider; all model access is
   through the AI Service Layer.
4. **Rollback version.** Your `agents` table has `rollback_version` and the session
   never proposes one. Every spec carries it.
5. **Objective stop conditions.** From the loop-engineering material: *"You always have
   this stop condition. You don't want the AI just to loop infinitely. There needs to
   be some sort of result that you converge on."* The session's continuous-learning
   loop has no termination condition at all. Every spec declares one.
6. **Honest limits.** `lib/review-guide.ts` states plainly that *"a review is a strong
   second opinion, not an independent audit,"* that review agents read code but do not
   run it, and that dismissed findings are not retained. The session's evaluation
   architecture claims independence it has not demonstrated. `AGENT_ARCHITECTURE.md` §9
   carries an equivalent limits section, in the same voice.

---

## 6. What the Graph Engineering material adds that the ChatGPT session missed

The second transcript is about workflow shape rather than org design, and it corrects
the session's main bias — building the org chart before the work.

- **Draw the graph before you automate the graph.** *"If the manual version doesn't
  produce way better work, automating it, honestly, will just produce mediocre work
  way faster."* Every activated agent in this library must have been run manually at
  least once, by you, before it is marked `active`. That is now the activation rule.
- **Remove "fake waiting."** Steps that do not depend on each other should not be
  sequenced. The session's marketing pipeline is a single 12-step chain; several legs
  are independent and should fan out.
- **Smallest graph that improves quality.** Stated above; it is the counterweight
  principle arriving from a completely different direction, which is a good sign it is
  right.
- **A file per step is the paper trail.** *"You can see what happened. You can compare
  versions and you can reuse the structure next week."* This is why work-order
  artifacts are markdown files in the repo, not rows in a chat.
- **Workflow before agent.** *"Many agent problems should start actually as workflows.
  A workflow follows a predictable path. An agent decides more dynamically. Founders
  should earn autonomy by starting with a predictable path."* This is the same
  conclusion as §3.2's ladder, and it is the direct justification for the six gates.

---

## 7. Recommendation

Adopt the session's **shape** and reject its **scale**:

1. Three layers — enterprise, department, product. Adopted.
2. Single responsibility — one question, one owned object, one output contract, one
   owner. Adopted. The session's "one page" version is adopted as a length *guideline*
   (~600 words) rather than a rule: the specs here run 540–870 words, and the four
   "one"s are the real test.
3. Orchestrator routes; it never decides, writes, grades, publishes, or spends. Adopted
   with a deterministic decision table.
4. Six deterministic gates, not agents. **This is the largest change from the session
   and the biggest cost saving.**
5. Three blind evaluators + one adjudicator, structurally independent, model diversity
   recorded as deferred.
6. Sixteen specs written, nine enabled today. Everything else on the roadmap, as 29
   grouped entries each with a named activation trigger.
7. Marketing becomes a real department via a drafted Class 3 amendment — unapplied,
   awaiting executive signature.
8. Shared context pages (`context/CTX-*.md`) carry brand, audience, compliance, and
   evidence rules **once**. Agents reference them by ID. This is both a §3.1 reuse
   requirement and the single biggest token saving in the design.

---

## 8. Open items this analysis could not close

Stated rather than guessed — §10.8: enterprise governance *"shall favor documented
decisions over undocumented assumptions"* and *"transparency over ambiguity."*

- **`config/spend_policy.yaml` was not readable from this session.** It lives in
  `asl-gateway`, which is not a connected folder. `agent_registry.yaml` is therefore
  written in the shape `readAgents()` in `scripts/ingest/sources.mjs` expects, but the
  six agents already in the policy have **not** been reconciled against it. Do that
  before any ingest run, or the mirror will disagree with the policy.
- **`agent-ux-researcher` exists in the governed plane** and is referenced here as an
  active Product & Design agent, but its spec was not available to read. The entry in
  `agent_registry.yaml` records only what Jessica stated in conversation, marked as
  such, and points at no file. Reconcile it against the real spec before relying on it.
- **Whether Marketing should hold its own budget line** in `agents.monthly_cap_usd` or
  draw on a department pool is a Class 3 question about budget structure (§4). The
  drafted amendment leaves it as a per-agent cap, which is the conservative reading.
- **Evaluator prompt variants are specified but not written.** They are Class 2
  artifacts and belong in `asl-gateway` next to the evaluator, not in this repo.
