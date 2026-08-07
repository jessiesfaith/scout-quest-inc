# Agent Roadmap Catalog

**What this is.** The full agent catalog proposed in the ChatGPT session, preserved
with a disposition and — where it survives — a **named activation trigger**.

**Why it exists.** Constitution §3.8: *"record future needs in the capability map or
roadmap instead of creating empty structures."* This is that roadmap. Nothing from the
session is lost; nothing is built before it has a consumer.

**Totals — and why one number here is deliberately vague.** The session proposed roughly
ninety agent *names*, many of them synonyms for one job (three names for brand
governance, four for long-form writing, two for orchestration). What that resolved to:

- **16 specs written**, 9 enabled in the registry today — countable, and it reconciles
  with `agent_registry.yaml`
- **6 became deterministic gates** — countable, `enterprise/GATES.md`
- **4 rejected outright**, with reasons below
- **Everything else is on the roadmap**, as **29 grouped entries** each carrying a named
  activation trigger

The roadmap's *agent* headcount is not stated, because it depends entirely on whether
the session's overlapping names count as one agent or four. A precise-looking figure
there would be false precision, and this document's whole argument is against that.

**The two activation conditions.** An agent moves `planned` → `active` only when both
hold:

1. It has a **named consumer this week** (§3.8)
2. **Jessica has run the job manually at least once** — *"if the manual version doesn't
   produce way better work, automating it, honestly, will just produce mediocre work way
   faster"*

---

## Dispositions

| | Meaning |
|---|---|
| ✅ **Built** | Spec written in this library |
| 🔒 **Gate** | Deterministic control, not an agent — `enterprise/GATES.md` |
| 🕓 **Planned** | Roadmap with a named trigger |
| ♻️ **Absorbed** | Covered by an existing agent + a context page (§3.1 reuse-first) |
| ❌ **Rejected** | Conflicts with the Constitution — reason given |

---

## Enterprise / orchestration

| Proposed | Disposition | Note |
|---|---|---|
| Chief Marketing Agent / Marketing Workflow Orchestrator | ✅ `orch-enterprise` | One orchestrator, enterprise-level. A per-department orchestrator is machinery for one department (§3.8) |
| Marketing Director Agent | ❌ | Prioritisation, budget, and approval are §4 human decision rights. It is a **role**, documented in `departments/marketing/README.md`. A spec would describe authority no agent can hold |
| Evaluation Adjudicator | ✅ `eval-adjudicator` | |
| Executive Reporting Agent | 🕓 | **Trigger:** first board or investor reporting cycle. Until then it is rung 1–5 work — reading dashboards that already exist |

## Evaluation

| Proposed | Disposition | Note |
|---|---|---|
| Task Compliance Evaluator | ✅ | |
| Factuality Evaluator | ✅ | |
| Adversarial Evaluator | ✅ | Holds a veto |
| Quality Evaluator | ♻️ | Absorbed into task-compliance + brand + adversarial. A standalone "is it good" evaluator has no rubric that is not already one of the three |
| Compliance Evaluator | ✅ `gov-compliance-reviewer` | One agent, profiled by `CTX-007` + product page |
| Brand Evaluator | ✅ `gov-brand-conformance` | |
| Outcome Evaluator | 🕓 | **Trigger:** first channel with real attribution data. Evaluating "will this achieve the objective" with no outcome data is opinion |
| Security Evaluator | ✅ `sec-prompt-context` (planned) + 🔒 gates | |

## Security (28 proposed)

| Proposed | Disposition |
|---|---|
| Preflight Security · Tool/API Security · Runtime Monitor · Release Security · Output security · Post-execution audit | 🔒 **Gates** — `enterprise/GATES.md`. See `GAP_ANALYSIS.md` §3.2 |
| Prompt & Context Security | ✅ `sec-prompt-context` — the one that stays a model, because prompt injection is adversarial natural language |
| Identity & Access · Agent Authorization · Secrets · Data Classification · DLP · Behavioral Baseline | 🔒 Gates or existing controls (RLS, scoped credentials, `check-client-bundle.mjs`, the `sources.mjs` D3 boundary) |
| Application Security · Dependency & Supply Chain · Infrastructure Security | 🕓 **Trigger:** first external contributor with commit access, or first production D3 flow. Today: the adversarial review harness in `lib/review-guide.ts` |
| Red Team · Blue Team · Purple Team | 🕓 **Trigger:** first paying district contract. The existing harness — finders + independent refuters — is the honest current version |
| Vulnerability Management · Remediation · Independent Validation | 🕓 **Trigger:** more than ~10 open findings at once. **The fix-verify separation is adopted now** as a rule: the agent that fixes may not verify |
| Incident Detection · Containment · Forensics · Recovery | 🕓 **Trigger:** first SEV-1, or first regulated-data flow. §5.5 already binds behaviour; the org does not exist |
| Privacy Security | ♻️ Absorbed into `gov-compliance-reviewer` + `CTX-007` |
| Security Policy / Technical / Adversarial Evaluators · Security Adjudicator | ♻️ Absorbed — the general evaluators handle security lenses at this scale |

**Why 28 → 3 + 6 gates.** §4's human staffing trigger has not fired once. Twenty-eight
security agents describe an organisation of fifteen people. The session's best security
ideas — multiple checkpoints, fix-verify separation, fail-closed, non-overridable
blocks — are **all adopted**. The org chart is not.

## Marketing — Strategy & Research

| Proposed | Disposition | Trigger |
|---|---|---|
| Strategy Agent · Product Positioning · Audience Segmentation | 🕓 | Validated ICP research exists (`CTX-006` is `UNSET`). Strategy from unvalidated personas is fiction |
| Market Research · Competitor · Trend Research | 🕓 | A monthly competitive review Jessica has run manually twice |
| Customer / Teacher / Parent / Student / District Research | ♻️ | `agent-ux-researcher` exists. Extend it with context pages |
| Grant Opportunity · District Research · Education Standards | 🕓 / ✅ | Standards → ✅ `sqe-standards-alignment`. Grants → first grant cycle |

## Marketing — Brand & Content

| Proposed | Disposition | Trigger |
|---|---|---|
| Brand Governance · Messaging · Style Guide | ✅ `mkt-brand-messaging` | Three names for one job |
| Storytelling · Visual Identity | 🕓 | Visual identity is `UNSET` — a human decision, not an agent's |
| Editorial Planner | ✅ | |
| Long-form Writer · Article Writer · Book Writer · White Paper | ✅ `mkt-longform-writer` | One agent, per-manuscript context page. Split only if chapter continuity actually breaks |
| LinkedIn Writer | ✅ | |
| TED Talk Agent · Podcast Agent · Conference Agent | ✅ `mkt-speaking-agent` | |
| Newsletter Writer · Substack | 🕓 | An active newsletter with subscribers |
| Video Script · YouTube | 🕓 | Enough video volume to outgrow manual scripting. YouTube **is** an approved channel (`CTX-009`); the agent is what is missing, not the channel |
| TikTok · Instagram · Shorts | 🕓 | The channel becomes active — `CTX-009` marks all three inactive today |
| Image Prompt · Graphic Designer · Infographic · Loom | 🕓 | Approved visual identity exists |

## Marketing — Distribution & Campaign

| Proposed | Disposition | Reason / trigger |
|---|---|---|
| Social Scheduler · Campaign Launcher · Publishing Agent | ❌ | §5.3(d) — no agent communicates externally. Agents draft, humans publish. Autonomous publishing is a **Class 3 constitution change**, not a confidence threshold |
| Campaign Planner | 🕓 | A campaign exists with a declared budget (§3.3) |
| Paid Ads Manager · Meta · Google · Experiment · A/B Testing | 🕓 | A declared ad budget. §3.3 requires one before activation |
| SEO Agent | 🕓 | Owned content volume makes it worth optimising |
| Email Campaign · Follow-up · Outreach · Partner Outreach · PR | 🕓 | **A written outreach policy reviewed by counsel** — not demand for leads (`CTX-007`) |
| Website Agent | 🕓 | `index.html` is hand-built and must not be recreated (`HANDOFF.md` §4.1) |

## Marketing — Community, Sales, Analytics

| Proposed | Disposition | Trigger |
|---|---|---|
| Community Manager · Discord · Facebook Group · Teacher/Parent/District/Investor Community | 🕓 | A community exists with enough volume to be unmanageable manually |
| Event Manager · Volunteer · Hackathon | ♻️ / 🕓 | Event *artifacts* → `mkt-speaking-agent`. Event *operations* → when an event outgrows manual |
| Partnership Manager | 🕓 | Second active partnership |
| CRM · Proposal · Demo Scheduling · Customer Success | 🕓 | A CRM exists. There isn't one |
| Grant Writer · District Proposal | 🕓 | First grant or district proposal cycle. **Guardrail pre-committed:** never invents statistics, never exaggerates outcomes, references approved financials only |
| KPI · Attribution · Forecast · Dashboard · Campaign ROI | 🕓 | Real analytics data. Forecasting with no history is a random number with a confidence interval |

## Knowledge & Memory

| Proposed | Disposition | Note |
|---|---|---|
| Marketing Knowledge Graph Agent | 🕓 **Class 3+** | As scoped in the session (nodes for *Students, Teachers, Parents, Districts*) it pulls D3 into the cloud tier — §5.1 violation. Any build re-scopes to D0–D2 with the `sources.mjs` crossing rule. `GAP_ANALYSIS.md` §3.3 |
| Marketing Memory Agent | ♻️ | The work-order artifacts **are** the memory — a file per step, version-controlled, comparable, reusable. That is rung 1, and it is already how the repo works |
| Marketing Data Warehouse | 🕓 **Class 3+** | Presumes HubSpot, Salesforce, Stripe — none are run. Same D3 concern |
| Marketing Digital Twin | 🕓 | Requires the warehouse, the graph, and real history. Roadmap item, not a near-term need |

## Governance

| Proposed | Disposition |
|---|---|
| QA Agent | 🔒 `GATE-release` (mechanical) + ♻️ `gov-brand-conformance` (judgment). Splitting these is the §3.2 saving in miniature |
| Compliance Agent | ✅ `gov-compliance-reviewer` |
| Legal Review Agent | ❌ **as an agent.** Legal review is a human with a licence (§4 Class 3+). `gov-compliance-reviewer` **routes to** it; it does not perform it |
| Campaign Registry · Experiment Registry · Asset Library · Playbooks | 🕓 **not agents** — data structures. Build when there is something to put in them |

---

## Concepts adopted immediately, without an agent

Free, and worth taking today:

1. **Fix-verify separation** — whoever fixes a finding may not verify the fix
2. **Sealed verdicts** — evaluators submit before seeing each other; immutable after
3. **Fail closed** — missing evidence, missing verdict, or an uncovered case → `blocked`
4. **Non-overridable blocks** — compliance and release cannot be argued past
5. **Dependency inversion** — no agent knows who comes after it
6. **One object, one owner** — no artifact has two authors
7. **Draw the graph before automating it** — the manual run is the activation gate
8. **Remove fake waiting** — independent steps fan out; nothing queues artificially
9. **Objective stop conditions** — checkable without a model, or it is not a condition
10. **Log what you drop** — `did_not_check` is required on every verdict
11. **Smallest graph that improves quality** — the counterweight principle, arriving from
    workflow design rather than governance

---

## Review cadence

Reviewed **quarterly** with the Constitution (§ review cadence), and whenever an
activation trigger fires. A trigger that has fired and been ignored for a quarter is
itself a finding.
