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
  // Used by the graph's inspector, not by the tree. Optional so the tree's
  // callers are not forced to select columns they do not draw.
  context_pages?: string | null;
  blocked_reason?: string | null;
  /** §3.8 — who consumes this output. The agent's own statement of scope. */
  consumer?: string | null;
};

export type TreeNode = {
  key: string;
  label: string;
  sub?: string;
  kind: "root" | "layer" | "group" | "agent";
  agent?: TreeAgent;
  /**
   * How an area outside the agent's own was reached. `cross` is recorded or
   * declared evidence; `inherited` is structural — the enterprise layer runs
   * everywhere by definition. Keeping them apart matters: one happened, the
   * other is a standing capability.
   */
  tone?: "cross" | "inherited";
  /** Small muted label in the node head — the layer, on the agent tree. */
  tag?: string;
  /** The agent's own declaration of who consumes it, and therefore its scope. */
  scope?: string;
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

// ---------------------------------------------------------------------
// The agent tree — the org tree turned inside out
// ---------------------------------------------------------------------
//
// The company tree asks "who does this area own?". This asks the same
// question from the other end: "what does this agent reach?" — the agent is
// the first level and the areas it touches hang beneath it.
//
// An area is counted as touched for one of four reasons, and the reason is
// always shown, because they are not equally strong:
//
//   its own area  — ownership. Structural, always true.
//   N work orders — recorded. It happened, and the ledger says so.
//   inherited     — structural. Every department and product inherits the
//                   enterprise layer; no area gets its own copy. This is why
//                   an evaluator with no recorded runs still reaches
//                   everywhere, and omitting it made six of the eight
//                   enterprise agents look like they touched nothing.
//   loads CTX-00n — inferred, and the weakest of the four. A product brand
//                   page IS that product's area, so an agent that loads one
//                   can reach into that product's work. It is a capability,
//                   not an event.
//
// Inherited reach is drawn ONLY for an agent that is enabled. A planned or
// suspended agent is not running in any area, and drawing it as though it
// were would make this screen assert a control that does not exist — the
// failure mode 0018's inert REVOKEs and the "GitHub (private)" row already
// are. Their declared scope still shows, so nothing is hidden.
//
// The inference is deliberately narrow. It fires only for pages whose title
// marks them as a brand page, and only when that title names a product that
// actually exists in the data — inventing an area would be worse than
// drawing no line at all.

const LAYER_RANK: Record<string, number> = {
  enterprise: 0,
  department: 1,
  product: 2,
};

/** The area that owns an agent, as a display label. */
export function homeArea(a: TreeAgent): string {
  if (a.layer === "enterprise") return "Enterprise";
  if (a.layer === "department") return a.department ?? "Unassigned";
  if (a.layer === "product") return a.product_name ?? "Company-wide";
  return "Not in the library";
}

type AreaTouch = {
  label: string;
  home: boolean;
  work: number;
  inherited: boolean;
  brandPages: string[];
};

function describeTouch(t: AreaTouch): string {
  const bits: string[] = [];
  if (t.home) bits.push("its own area");
  if (t.work > 0)
    bits.push(`${t.work} work order${t.work === 1 ? "" : "s"} recorded here`);
  if (t.inherited) bits.push("inherits the enterprise layer");
  if (t.brandPages.length)
    bits.push(`may load ${t.brandPages.join(", ")}`);
  return bits.join(" · ");
}

export function buildAgentAreaTree(
  agents: TreeAgent[],
  workOrders: GraphWo[],
): TreeNode[] {
  // Only areas that exist in the data. The brand-page inference is matched
  // against this set so it can never conjure a product.
  const known = new Set<string>();
  for (const a of agents) if (a.product_name) known.add(a.product_name);
  for (const w of workOrders) if (w.product_name) known.add(w.product_name);

  const workByAgent = new Map<string, Map<string, number>>();
  for (const w of workOrders) {
    if (!w.agent || !w.product_name) continue;
    let m = workByAgent.get(w.agent);
    if (!m) workByAgent.set(w.agent, (m = new Map()));
    m.set(w.product_name, (m.get(w.product_name) ?? 0) + 1);
  }

  // Every area that exists in the org — the homes of the agents themselves.
  // "Enterprise" is excluded because it is the layer doing the inheriting,
  // not one of the areas that inherits it, and an area with no agents is not
  // an area yet.
  const inheritingAreas = [
    ...new Set(agents.map(homeArea)),
  ].filter((a) => a !== "Enterprise" && a !== "Not in the library");

  const ordered = [...agents].sort((x, y) => {
    const r =
      (LAYER_RANK[x.layer ?? ""] ?? 3) - (LAYER_RANK[y.layer ?? ""] ?? 3);
    return r !== 0 ? r : x.agent_id.localeCompare(y.agent_id);
  });

  return ordered.map((a) => {
    const home = homeArea(a);
    const touches = new Map<string, AreaTouch>();
    const put = (label: string) => {
      let t = touches.get(label);
      if (!t)
        touches.set(
          label,
          (t = { label, home: false, work: 0, inherited: false, brandPages: [] }),
        );
      return t;
    };
    put(home).home = true;

    for (const [area, n] of workByAgent.get(a.agent_id) ?? [])
      put(area).work += n;

    // The enterprise layer runs in every area — but only if it is switched on.
    if (a.layer === "enterprise" && a.enabled === true)
      for (const area of inheritingAreas) put(area).inherited = true;

    for (const c of parseContextPages(a.context_pages)) {
      const title = CTX_TITLES[c];
      // Brand pages only. Matching every context page by title would let
      // "CTX-002 Data classes" claim a product called "Data".
      if (!title || !title.toLowerCase().startsWith("brand")) continue;
      const hay = title.toLowerCase();
      for (const area of known) {
        if (hay.includes(area.toLowerCase())) put(area).brandPages.push(c);
      }
    }

    // Evidence outranks inheritance in both colour and order: an area where
    // something actually happened should not be buried among eight areas
    // where something merely may.
    const evidenced = (t: AreaTouch) => t.work > 0 || t.brandPages.length > 0;

    const children: TreeNode[] = [...touches.values()]
      .sort((p, q) => {
        if (p.home !== q.home) return p.home ? -1 : 1;
        if (evidenced(p) !== evidenced(q)) return evidenced(p) ? -1 : 1;
        if (p.work !== q.work) return q.work - p.work;
        return p.label.localeCompare(q.label);
      })
      .map((t) => ({
        key: `${a.agent_id}::${t.label}`,
        label: t.label,
        sub: describeTouch(t),
        kind: "group" as const,
        tone: t.home
          ? undefined
          : evidenced(t)
            ? ("cross" as const)
            : ("inherited" as const),
        children: [],
      }));

    return {
      key: a.agent_id,
      label: a.agent_id,
      sub: a.question ?? undefined,
      kind: "agent" as const,
      agent: a,
      tag: a.layer ?? "not in the library",
      scope: a.consumer ?? undefined,
      children,
    };
  });
}

// ---------------------------------------------------------------------
// The graph — the mind-map view of the same facts
// ---------------------------------------------------------------------
//
// Three edge kinds, all of them observations rather than promises:
//
//   owns    — the ownership tree, same facts as buildOrgTree.
//   context — the agent's spec lists this CTX page. Two agents that load
//             the same page are connected THROUGH the page, which is what
//             makes shared context visible without inventing an
//             agent-to-agent edge that the architecture forbids.
//   work    — a recorded work order placed this agent in a product area
//             that is not its home. Evidence, not configuration: the edge
//             exists because it happened, and its weight is the count.
//
// No edge means sequence. That is the pipeline's story, deliberately kept
// on a separate diagram (see tree.tsx).

/** Titles for the CTX pages in docs/agents/context/, keyed by id. */
export const CTX_TITLES: Record<string, string> = {
  "CTX-001": "Enterprise canon",
  "CTX-002": "Data classes",
  "CTX-003": "Risk tiers & gates",
  "CTX-004": "Brand — Scout Quest Education",
  "CTX-005": "Brand — Soundwiserx",
  "CTX-006": "Audiences",
  "CTX-007": "Compliance boundaries",
  "CTX-008": "Evidence & citation",
  "CTX-009": "Channels & cadence",
  "CTX-010": "Budgets & stop conditions",
  "CTX-011": "Output contracts",
};

/**
 * "CTX-001, CTX-004|CTX-005" → ["CTX-001", "CTX-004", "CTX-005"].
 * The pipe means "one of, chosen by product" — for connectivity both count,
 * since the agent can load either.
 */
export function parseContextPages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[,|]/)) {
    const t = token.trim();
    if (/^CTX-\d{3}$/.test(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** The slice of a work order the graph needs — product resolved to a name. */
export type GraphWo = {
  id: string;
  wo_code: string | null;
  title: string;
  agent: string | null;
  stage: string | null;
  status: string;
  product_name: string | null;
};

export type GraphNode = {
  id: string;
  label: string;
  kind: "root" | "layer" | "group" | "agent" | "ctx";
  /** Colours the dot — the layer itself, or the layer a group sits under. */
  layer?: string | null;
  sub?: string;
  agent?: TreeAgent;
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: "owns" | "context" | "work";
  /** work edges: how many work orders back this edge. */
  n?: number;
};

export function buildAgentGraph(
  agents: TreeAgent[],
  workOrders: GraphWo[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byId = new Map<string, GraphNode>();
  const add = (n: GraphNode) => {
    if (!byId.has(n.id)) {
      byId.set(n.id, n);
      nodes.push(n);
    }
  };
  const link = (
    source: string,
    target: string,
    kind: GraphEdge["kind"],
    n?: number,
  ) => edges.push({ source, target, kind, n });

  add({ id: "root", label: "Scout Quest Enterprise", kind: "root" });

  const layerNode = (l: string, label: string) => {
    const id = `layer-${l}`;
    if (!byId.has(id)) {
      add({ id, label, kind: "layer", layer: l });
      link("root", id, "owns");
    }
    return id;
  };
  const groupNode = (layer: "department" | "product", name: string) => {
    const id = `${layer === "department" ? "dept" : "prod"}-${name}`;
    if (!byId.has(id)) {
      const parent = layerNode(
        layer,
        layer === "department" ? "Department" : "Product",
      );
      add({ id, label: name, kind: "group", layer });
      link(parent, id, "owns");
    }
    return id;
  };

  // Where each agent hangs on the ownership tree — needed again below to
  // decide whether a work order counts as leaving home.
  const homeOf = new Map<string, string>();

  for (const a of agents) {
    const filed = (LAYERS as readonly string[]).includes(a.layer ?? "");
    add({
      id: a.agent_id,
      label: a.agent_id,
      kind: "agent",
      layer: filed ? a.layer : "unfiled",
      agent: a,
    });
    let home: string;
    if (a.layer === "enterprise") home = layerNode("enterprise", "Enterprise");
    else if (a.layer === "department")
      home = groupNode("department", a.department ?? "Unassigned");
    else if (a.layer === "product")
      home = groupNode("product", a.product_name ?? "Company-wide");
    else home = layerNode("unfiled", "Not in the library");
    homeOf.set(a.agent_id, home);
    link(home, a.agent_id, "owns");

    for (const c of parseContextPages(a.context_pages)) {
      add({ id: c, label: c, kind: "ctx", sub: CTX_TITLES[c] });
      link(a.agent_id, c, "context");
    }
  }

  // Work-order evidence. Company-wide work orders name no area, and a work
  // order in the agent's own area is already the owns edge — neither draws.
  //
  // Counted in a nested map rather than under a joined string key: a product
  // name is free text and could contain whatever separator was chosen.
  const touches = new Map<string, Map<string, number>>();
  for (const w of workOrders) {
    if (!w.agent || !w.product_name) continue;
    if (!byId.has(w.agent)) continue; // no dot to draw from
    const area = groupNode("product", w.product_name);
    if (homeOf.get(w.agent) === area) continue;
    let byArea = touches.get(w.agent);
    if (!byArea) touches.set(w.agent, (byArea = new Map()));
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  for (const [agentId, byArea] of touches) {
    for (const [area, n] of byArea) link(agentId, area, "work", n);
  }

  return { nodes, edges };
}
