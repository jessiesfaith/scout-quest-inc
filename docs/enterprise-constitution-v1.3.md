# SCOUT QUEST ENTERPRISE — ENTERPRISE CONSTITUTION
## Version 1.3 (Approved)

| Field | Value |
|---|---|
| Document type | Enterprise governance (Document A — Constitution) |
| document_id | GOV-CONST-001 |
| Owner | Jessica (Chief Executive) |
| Status | **Approved — effective 2026-07-27** |
| Review cadence | Quarterly, or after any Class 3 change |
| Companion documents | `Enterprise Current State` (Document B) · `GOV-CANON-001` (vocabulary & precedence) |
| Changelog | v1.3 (2026-08-01): §3.5 gains a v0-scope clause — independent evaluation ships only for workflows registered and digest-pinned in `config/approved_workflows.yaml`; general author-wired evaluation and producer/evaluator model diversity are deferred as Class 3 "not yet" (asl-gateway #32). Records that agent-evaluator v0 merged to `main` @ `b6f6044`. v1.2 (2026-07-27, per Canon approvals A2/A3): §3.2 ladder reordered — existing approved content is rung 1; human gate may be required at any rung; §3.6 adopts five operating modes (adds Restricted). v1.1: glossary, decision rights, risk guardrails, measurable standards; split Current State into Document B. v1.0: archived, superseded |

This is the durable governance constitution for Scout Quest Enterprise. It is not a coding prompt. All recommendations, architecture changes, folder structures, agents, workflows, and implementations produced by any AI assistant (Claude Code, ChatGPT, or others) must remain aligned with this document. The rules are assistant-agnostic. Vocabulary and document precedence are governed by GOV-CANON-001. Deviations require approval per Section 4.

---

## 1. MISSION AND OPERATING MODEL

Scout Quest Enterprise is an AI-native enterprise, not a traditional software company. AI agents perform most operational work; human leaders provide governance, strategy, oversight, ethics, approvals, and executive decisions.

The enterprise must support rapid scaling while maintaining security, operability, maintainability, cost-efficient AI operations, modular architecture, enterprise governance, compliance, and investor readiness. Architecture must always favor long-term maintainability over short-term convenience — balanced by the counterweight principle in Section 3.8.

## 2. GLOSSARY

These terms are used precisely throughout all enterprise documents (full term map: GOV-CANON-001 §2). Do not use them interchangeably.

| Term | Definition |
|---|---|
| **Capability** | A named, reusable business or technical function with an owner, an interface contract, and at least one consuming product. |
| **Platform** | A group of related capabilities delivered as a shared enterprise service. |
| **Service** | A running technical implementation that exposes one or more capabilities. |
| **Agent** | A logical AI role defined by a specification (role, responsibilities, inputs, outputs, tools, permissions, evaluation, manager, escalation, documentation). An agent is NOT a permanently running process; it executes only when assigned work. |
| **Workflow** | A defined, versioned pipeline of steps, executed by agents, humans, or automation, that produces a business outcome. |
| **Work Order** | One execution instance of a workflow (`WO-<PRODUCT>-<NNNN>`). |
| **Context Manifest** | The minimum approved, version-pinned context for one work order. |
| **Framework** | A documented standard plus templates that govern how a class of work is done. |
| **Regulated data (D3)** | Any data subject to COPPA, FERPA, or HIPAA, including student PII and PHI. |

## 3. CORE PRINCIPLES

### 3.1 Reuse-first hierarchy
Shared capabilities → shared enterprise services → reusable agents → reusable workflows → multiple products. Every product consumes enterprise capabilities; products own as little duplicated functionality as possible. Before proposing any new folder, department, workflow, platform, capability, or agent, ask: **"Can this become a shared enterprise capability instead?"**

### 3.2 Cost execution ladder *(amended v1.2)*
Token efficiency is a first-class architectural requirement. For any task, use the cheapest sufficient rung, in this order:

1. Existing approved content
2. Manual
3. Rules
4. Workflow automation
5. Database lookup
6. Retrieval
7. Cached output
8. Small local model
9. Larger local model
10. Cloud model
11. Human decision

AI is used only when it provides measurable value. **Human approval may be mandatory at any rung** based on Risk Tier, Change Class, policy, or law — rung 11 is where work falls to a human specialist, not the only place human authority appears.

### 3.3 Cost budgets (measurable rule)
Every workflow must declare an expected monthly token/API budget before activation. Exceeding budget by more than 20% in a month triggers automatic manager review; exceeding by more than 50% triggers automatic suspension pending approval. Per-agent hard spend caps are defined in the Risk Guardrails (Section 5).

### 3.4 Provider independence
No application may depend directly on a specific LLM provider. All model access flows through the AI Service Layer; providers must be replaceable. Scout Quest Education will ultimately support district-hosted AI through a District AI Service Layer.

### 3.5 Independent evaluation *(amended v1.3)*
An "important workflow" is any workflow that (a) produces customer-facing output, (b) mutates persistent data, (c) spends above its declared budget threshold, or (d) touches regulated data. Every important workflow requires evaluation by an evaluator that is independent of the producing agent — a different agent specification, model, or human. Evaluators must not simply agree with producers. Standard pattern: Agent → Evaluator → Manager → Approval. Two-way evaluation (the producer also reviews evaluator feedback and must explicitly accept or contest it before closure) is the standard for Class 2+ changes. Evaluation intensity scales with Risk Tier (GOV-CANON-001 §2).

**v0 implementation scope (2026-08-01).** In v0, independent evaluation is available only to workflows registered and digest-pinned in `config/approved_workflows.yaml`; each such workflow is human-reviewed and fingerprinted. Evaluation triggered by any unregistered or modified workflow is refused — fail-closed and non-overridable (`WORKFLOW_NOT_APPROVED`); a missing register also refuses. The independence guarantees — structural independence, verdict validated-not-trusted (a defect list, not a score), verdict recorded on the append-only ledger before any gate, fail-closed throughout — hold **within this boundary**. A general mechanism permitting arbitrary author-wired workflows to invoke independent evaluation, and model diversity between producer and evaluator, are deferred as Class 3 ("not yet"), tracked in asl-gateway #32. This clause exists so the Constitution matches what shipped on `main`; the general §3.5 principle above remains the target state.

### 3.6 Degraded operation *(amended v1.2)*
Products must continue operating during AI, speech, provider, network, local-model, or cloud outages. Every capability must define five operating modes plus recovery discipline: **Normal** (all services within thresholds), **Degraded** (impaired dependencies; core operations continue via fallback), **Restricted** (essential approved functions only; high-risk or AI-dependent functions disabled — including when a required security control is impaired, model behavior is anomalous, or compliance evidence is incomplete; when a required security control fails, affected functions enter Restricted or Offline rather than continue insecurely), **Offline** (no external services; approved local functions continue), and **Recovery** (gradual restoration with validation and reconciliation), plus **Hypercare criteria** for elevated monitoring after changes and recoveries.

### 3.7 Definition of done for capabilities
A capability exists only when it has: (1) an Overview.md, (2) a named owner, (3) an interface contract, and (4) at least one consuming product. Anything short of this is "planned," and agents must not assume it is available.

### 3.8 Counterweight principle
Never optimize only for today's prototype — but equally, **never build enterprise machinery that has no consumer today**. Do not create a folder, service, agent, standard, platform, or workflow until it has a current consumer, owner, or approved near-term implementation need; record future needs in the capability map or roadmap instead of creating empty structures. Shared platforms are extracted when a second product needs the same function. If a recommendation creates technical debt, explain the tradeoff before implementing.

## 4. DECISION RIGHTS AND CHANGE CLASSIFICATION

All changes are classified before execution. When in doubt, classify upward.

| Class | Definition | Examples | Authority |
|---|---|---|---|
| **Class 1** | Reversible, low-cost, no regulated data, within budget | Doc edits, refactors within a module, new cached content, bug fixes | Agent may proceed; logged and evaluated per Section 3.5 |
| **Class 2** | Cross-module impact, new dependencies, moderate cost, or new workflow | New agent spec, new workflow, schema change, new third-party library | Department Manager approval |
| **Class 3** | Architecture, security, compliance, spend structure, or org design | New platform, provider change, data-flow change involving regulated data, department creation, this document | Jessica (executive approval) |
| **Class 3+** | Regulated-data flows to external parties, legal exposure | New cloud LLM receiving student PII/PHI, new BAA, new district data agreement | Jessica + external counsel / compliance review |

**Conflict-resolution priority order.** When principles collide, apply this order: (1) Compliance and safety of regulated data, (2) Security, (3) Operability, (4) Evidence-based correctness, (5) Cost minimization, (6) Reuse and modularity, (7) Speed of delivery.

**Executive override.** Jessica holds a documented override authority per the Owner Override & Break-Glass Protocol: safe-direction actions (halt, freeze, tighten, revoke) are instant and unilateral; risk-increasing overrides are password-gated, logged, time-boxed, and reviewed. No override is silent.

**Human staffing trigger.** Human staffing in a department expands when its approval queue exceeds 20 pending items or 5 business days median wait for two consecutive weeks, or when a Class 3 risk requires dedicated human ownership.

## 5. AI RISK GUARDRAILS

These guardrails bind every agent, workflow, and assistant. No workflow bypasses them. (Implementation plan: see `AI Risk Guardrails Implementation Plan`.)

### 5.1 Data boundaries
Regulated data (student PII, PHI, COPPA-covered child data) must never be sent to any cloud LLM provider without a signed BAA (HIPAA) or an executed district data agreement (FERPA/COPPA), and never without Class 3+ approval of the specific data flow recorded in the approved-flow register. Default handling of regulated data uses local models or de-identified data. Agents operate under least-privilege data access: each agent specification declares the data classes it may read and write, and access outside that declaration is denied and logged. **Prototype-phase standing rule (2026): D3 remains on local infrastructure only; cloud tiers (Supabase/Vercel basic) carry synthetic `_TEST_` data exclusively.**

### 5.2 Spend limits
Every agent has a hard per-run and per-month API spend cap with automatic cutoff. Every workflow has a declared monthly budget (Section 3.3). No agent may raise its own cap; cap changes are Class 2 (within department budget) or Class 3 (budget structure). Thresholds: 80% warn and notify manager · 100% hard cutoff · >120% workflow review · >150% suspension.

### 5.3 Action boundaries
No agent may, without explicit human approval: (a) deploy to production, (b) modify permissions or identity records, (c) delete or bulk-modify persistent data, (d) communicate with external parties, (e) execute financial transactions, or (f) modify this constitution or any security/compliance control. Enforcement is structural: agents hold scoped credentials that lack these permissions, and each agent spec carries a tool allowlist.

### 5.4 Audit trail
Every agent action is logged with: timestamp, agent identity and version, workflow, input/output summaries, model and provider used, token count and cost, data classes touched, change class, and approver (if any). Audit logs are immutable (append-only, tamper-evident) and retained per compliance requirements (HIPAA: 6 years).

### 5.5 Incident response
Any agent that detects a possible compliance breach, data leak, or guardrail violation must immediately halt the affected workflow, log the event, and escalate to its manager and the Security capability owner. Never attempt silent remediation. Suspected regulated-data exposure is always Class 3+ (SEV-1): same-day notification to Jessica and compliance counsel.

## 6. COMPLIANCE OBLIGATIONS

Current: COPPA, FERPA, HIPAA (Soundwiserx), privacy, accessibility. Future: SOC 2, ISO 27001, NIST, additional regulations as markets require. Compliance controls must be built as reusable enterprise capabilities, not per-product patches. Each product's compliance class is recorded in the Current State document.

## 7. ORGANIZATIONAL MODEL

Departments consist of a Department Manager overseeing logical AI agents that consume shared enterprise services, with evaluation and reporting flowing upward. Roles are enduring and fillable by humans or agents; agent specs live in the shared enterprise agent library and carry a registry class (internal | product) per GOV-CANON-001 §8. Current first departments: Product & Design, Engineering, Security & Compliance (Learning Sciences reserved as a separate future department). Engineering spans platform, infrastructure, software, AI, security, data, speech, DevOps, SRE, QA, automation, architecture, and research disciplines. Every major product decision is supported by evidence, drawing on user research, learning science, reading science, phonics, speech, learning disabilities, accessibility, AI literacy, and educational-effectiveness research.

## 8. DOCUMENTATION AND ASSISTANT CONDUCT

Documentation is Markdown-first, Obsidian-first, Git-first. Documents are enterprise knowledge: avoid duplication and reference existing documents whenever possible. New and generated documents land in the zone's `99 Inbox` before deliberate filing. AI coding assistants must reuse, reference, link, organize, and refactor rather than duplicate; preserve history; recommend improvements; and never reorganize major architecture without Class 3 approval. Code is edited only in `C:\Dev` Git clones — never in the vault.

## 9. STANDING RULES FOR ALL RECOMMENDATIONS

1. Prefer enterprise reuse over product duplication.
2. Prefer modularity over convenience.
3. Operate within declared cost budgets (Section 3.3) and the execution ladder (Section 3.2).
4. Preserve future scalability; assume growth from prototype to enterprise — subject to the counterweight principle (Section 3.8).
5. Classify every change (Section 4) before acting; when in doubt, classify upward.
6. Apply the conflict-resolution priority order when principles collide.
7. If a recommendation creates technical debt, state the tradeoff before implementing.
8. Before proposing anything new, ask: "Can this become a shared enterprise capability instead?"

— End of Constitution v1.3 —
