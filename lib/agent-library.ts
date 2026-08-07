// The agent library's shared vocabulary — stages, actors, tiers, and the
// shape of the tree.
//
// Pure constants only: this file is imported by client components AND by the
// server action, and a "use server" file may only export async functions.
// Same reason app/(app)/it/infrastructure/vocab.ts exists.
//
// THE STAGE LIST IS THE STATE MACHINE in
// docs/agents/enterprise/orch-enterprise.md, and the same strings are a CHECK
// constraint and a transition table in migration 0018. Three copies, and they
// must stay byte-identical — a stage the database refuses is a button that
// throws, and a stage the database allows but this file omits is a work order
// that disappears from the screen.

export const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const LIFECYCLES = [
  "active",
  "planned",
  "blocked",
  "suspended",
  "retired",
] as const;

export const LAYERS = ["enterprise", "department", "product"] as const;

export type Stage =
  | "intake" | "scope" | "risk" | "context" | "assign" | "execute"
  | "validate" | "evaluate" | "adjudicate" | "remediate" | "approve"
  | "release" | "audit" | "outcome" | "closed" | "blocked";

export type Actor =
  | "orchestrator" | "gate" | "worker" | "evaluator" | "adjudicator" | "human";

export type StageDef = {
  id: Stage;
  label: string;
  /** Who acts at this stage. */
  actor: Actor;
  /** The gate that fires here, if any. */
  gate?: string;
  /** What must be true to leave. */
  exit: string;
  /** Where it can legally go next — mirrors advance_work_order()'s table. */
  next: Stage[];
};

export const STAGES: StageDef[] = [
  { id: "intake", label: "Intake", actor: "gate", gate: "GATE-intake",
    exit: "Every required work-order field is present and valid.",
    next: ["scope", "blocked"] },
  { id: "scope", label: "Scope validation", actor: "orchestrator",
    exit: "The request belongs to this department. Scope is not expanded because a task is related.",
    next: ["risk", "blocked"] },
  { id: "risk", label: "Risk classification", actor: "orchestrator",
    exit: "A tier is assigned. It may be raised later; it may never be lowered.",
    next: ["context", "blocked"] },
  { id: "context", label: "Context assembly", actor: "orchestrator",
    exit: "A manifest of CTX page ids and pinned versions — minimum necessary, not pasted text.",
    next: ["assign", "blocked"] },
  { id: "assign", label: "Agent selection", actor: "gate", gate: "GATE-authz",
    exit: "The agent is registered, enabled, and its risk ceiling covers this tier.",
    next: ["execute", "blocked"] },
  { id: "execute", label: "Worker execution", actor: "worker",
    exit: "The agent's stop condition is met, or its iteration limit is reached.",
    next: ["validate", "blocked"] },
  { id: "validate", label: "Output validation", actor: "gate", gate: "GATE-contract",
    exit: "The declared CTX-011 contract is returned and mechanically valid.",
    // No edge back to 'execute'. It looked right — a failed contract check
    // should re-run the worker — but the remediation counter only increments
    // on 'remediate', so this was an unbounded re-execution loop routing
    // around the three-round bound. A failed check goes to remediate.
    next: ["evaluate", "remediate", "blocked"] },
  { id: "evaluate", label: "Sealed evaluation", actor: "evaluator",
    exit: "Every assigned evaluator has submitted. A partial set is a halt, not a quorum.",
    next: ["adjudicate", "blocked"] },
  { id: "adjudicate", label: "Adjudication", actor: "adjudicator",
    exit: "An outcome from the CTX-003 decision table.",
    // 'approve' is NOT here. It is reached only by approve_work_order(),
    // which records the approver and enforces aal2; advancing to it directly
    // stranded the work order with no legal move but 'blocked'.
    next: ["remediate", "blocked"] },
  { id: "remediate", label: "Remediation", actor: "worker",
    exit: "Named defects addressed. Bounded at three rounds, then a human.",
    next: ["execute", "blocked"] },
  { id: "approve", label: "Human approval", actor: "human",
    exit: "Recorded on the event feed with the approver's identity. An approval that is not recorded did not happen.",
    next: ["release", "blocked"] },
  { id: "release", label: "Release scan", actor: "gate", gate: "GATE-release",
    exit: "Destination, links, secrets, metadata and approvals all clear.",
    next: ["audit", "blocked"] },
  { id: "audit", label: "Post-execution audit", actor: "gate", gate: "GATE-audit",
    exit: "Approved action matches actual action; the record is written.",
    next: ["outcome", "blocked"] },
  { id: "outcome", label: "Outcome evaluation", actor: "human",
    exit: "Did it achieve the objective? Lessons captured.",
    next: ["closed", "blocked"] },
  { id: "closed", label: "Closed", actor: "human", exit: "Terminal.", next: [] },
  { id: "blocked", label: "Blocked", actor: "gate",
    exit: "Terminal — and a SUCCESSFUL one. It means a gate did its job.",
    next: [] },
];

export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));
export const LIVE_STAGES = STAGES.filter(
  (s) => s.id !== "closed" && s.id !== "blocked",
);

/**
 * Ordinal for progress display. Terminal stages sit outside the track, so a
 * blocked work order has no index of its own — pass the stage it blocked AT
 * (the `from_stage` of its last event) to place the marker. Without that,
 * every blocked work order rendered as never-started, which loses the one
 * fact that makes a block readable: which gate refused it.
 */
export function stageIndex(
  stage: string | null,
  blockedAt?: string | null,
): number {
  const s = stage === "blocked" ? (blockedAt ?? null) : stage;
  if (!s) return -1;
  if (s === "closed") return LIVE_STAGES.length;
  return LIVE_STAGES.findIndex((x) => x.id === s);
}

export const ACTOR_LABEL: Record<Actor, string> = {
  orchestrator: "Orchestrator",
  gate: "Gate (deterministic)",
  worker: "Worker agent",
  evaluator: "Evaluator",
  adjudicator: "Adjudicator",
  human: "Human",
};

// How many independent evaluators a tier requires — CTX-003. Shown next to
// the work order so the cost of a tier is visible when it is chosen, not
// after.
export const EVALUATORS_BY_TIER: Record<RiskTier, string[]> = {
  low: [],
  medium: ["eval-task-compliance", "gov-brand-conformance"],
  high: ["eval-task-compliance", "eval-factuality", "eval-adversarial"],
  critical: [
    "eval-task-compliance",
    "eval-factuality",
    "eval-adversarial",
    "gov-compliance-reviewer",
  ],
};

export const TIER_NOTE: Record<RiskTier, string> = {
  low: "GATE-contract only. A Low-tier internal draft does not earn a cloud-model review.",
  medium: "Two evaluators, sealed and parallel.",
  high: "Three evaluators, sealed and parallel. The adversarial verdict holds a veto.",
  critical:
    "Full panel plus human approval. Anything touching D3, any health claim, any outcome claim about students.",
};

/** Badge class for a lifecycle value, using the ported design's vocabulary. */
export function lifecycleBadge(lifecycle: string | null): string {
  switch (lifecycle) {
    case "active": return "b-live";
    case "planned": return "b-plan";
    case "blocked": return "b-reg";
    case "suspended": return "b-reg";
    case "retired": return "b-reg";
    default: return "b-reg";
  }
}

export function tierTag(tier: string | null): string {
  switch (tier) {
    case "low": return "t-hi";      // green — least consequence
    case "medium": return "t-med";
    case "high": return "t-med";
    case "critical": return "t-lo"; // red
    default: return "t-med";
  }
}

// ---------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------

export type TreeAgent = {
  agent_id: string;
  layer: string | null;
  department: string | null;
  lifecycle: string | null;
  risk_ceiling: string | null;
  question: string | null;
  owns_object: string | null;
  product_name?: string | null;
  monthly_cap_usd: number | null;
  enabled: boolean | null;
  source: string;
};

export type TreeNode = {
  key: string;
  label: string;
  sub?: string;
  kind: "root" | "layer" | "group" | "agent";
  agent?: TreeAgent;
  children: TreeNode[];
};

/**
 * The ORG tree: who belongs to what. Grouped by layer, then by department
 * (layer 2) or product (layer 3).
 *
 * Deliberately not the same thing as the workflow pipeline. The org tree
 * answers "who exists and who owns them"; the pipeline answers "what happens
 * in what order". Conflating them is how an org chart starts implying a call
 * graph — which the architecture explicitly forbids, since no agent knows who
 * comes after it.
 */
export function buildOrgTree(agents: TreeAgent[]): TreeNode {
  const byLayer = (l: string) => agents.filter((a) => a.layer === l);

  const enterprise = byLayer("enterprise");
  const department = byLayer("department");
  const product = byLayer("product");
  const unfiled = agents.filter(
    (a) => !a.layer || !(LAYERS as readonly string[]).includes(a.layer),
  );

  const agentNode = (a: TreeAgent): TreeNode => ({
    key: a.agent_id,
    label: a.agent_id,
    sub: a.question ?? undefined,
    kind: "agent",
    agent: a,
    children: [],
  });

  const groupBy = (list: TreeAgent[], pick: (a: TreeAgent) => string) => {
    const map = new Map<string, TreeAgent[]>();
    for (const a of list) {
      const k = pick(a);
      const arr = map.get(k);
      if (arr) arr.push(a);
      else map.set(k, [a]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  };

  const children: TreeNode[] = [];

  if (enterprise.length) {
    children.push({
      key: "layer-enterprise",
      label: "Enterprise",
      sub: "Every department inherits these. No department gets its own copy.",
      kind: "layer",
      children: enterprise.map(agentNode),
    });
  }

  if (department.length) {
    children.push({
      key: "layer-department",
      label: "Department",
      sub: "Owns a business function. Has a manager, an approval queue, and scoped human access.",
      kind: "layer",
      children: groupBy(department, (a) => a.department ?? "Unassigned").map(
        ([dept, list]) => ({
          key: `dept-${dept}`,
          label: dept,
          sub: `${list.length} agent${list.length === 1 ? "" : "s"}`,
          kind: "group" as const,
          children: list.map(agentNode),
        }),
      ),
    });
  }

  if (product.length) {
    children.push({
      key: "layer-product",
      label: "Product",
      sub: "Only what cannot be shared. Everything else is a shared agent plus a product context page.",
      kind: "layer",
      children: groupBy(product, (a) => a.product_name ?? "Company-wide").map(
        ([prod, list]) => ({
          key: `prod-${prod}`,
          label: prod,
          sub: `${list.length} agent${list.length === 1 ? "" : "s"}`,
          kind: "group" as const,
          children: list.map(agentNode),
        }),
      ),
    });
  }

  if (unfiled.length) {
    children.push({
      key: "layer-unfiled",
      label: "Not in the library",
      sub: "Mirrored from the spend policy or entered by hand — no governance layer declared.",
      kind: "layer",
      children: unfiled.map(agentNode),
    });
  }

  return {
    key: "root",
    label: "Scout Quest Enterprise",
    sub: "Enterprise Constitution v1.4",
    kind: "root",
    children,
  };
}
