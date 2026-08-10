import Link from "next/link";
import {
  buildOrgTree,
  buildAgentAreaTree,
  lifecycleBadge,
  STAGES,
  ACTOR_LABEL,
  type TreeAgent,
  type TreeNode,
  type GraphWo,
} from "@/lib/agent-library";
import { AgentGraph } from "./graph";

export const TREE_VIEWS = [
  { id: "map", label: "Mind Map" },
  { id: "company", label: "Company Tree" },
  { id: "agent", label: "Agent Tree" },
] as const;

export type TreeView = (typeof TREE_VIEWS)[number]["id"];

// The relationship view. Three diagrams, deliberately separate:
//
//   1. The MIND MAP — the same ownership facts as the tree, plus the two
//      connections a tree cannot draw: a shared context page, and an agent
//      working outside its own area.
//   2. The ORG TREE — who exists and who owns them.
//   3. The PIPELINE — what happens in what order.
//
// Keeping them apart is not a layout preference. An org chart drawn as a
// call graph implies that a department agent hands work to its neighbour,
// and the architecture forbids exactly that: no agent knows who comes after
// it, every output returns to the orchestrator, and the orchestrator decides
// the next step. One diagram showing both would teach the wrong model. The
// map obeys the same rule — it has no agent → agent edge at all; agents meet
// only through a page or an area.
//
// Everything except the map is a server component: pure rendering from
// props, no client JS. The tree is nested lists with CSS connectors (styles
// in os-extra.css) rather than a charting library — it prints, it is
// searchable, and it adds no dependency. The map is the one interactive
// piece, and it stays below the fold of its own section so the tree remains
// the thing you can read without JavaScript.

const KIND_CLASS: Record<TreeNode["kind"], string> = {
  root: "tn-root",
  layer: "tn-layer",
  group: "tn-group",
  agent: "tn-agent",
};

function Node({ node }: { node: TreeNode }) {
  const a = node.agent;
  return (
    <li className="tnode">
      <div
        className={`tnbox ${KIND_CLASS[node.kind]}${
          node.tone ? ` tn-${node.tone}` : ""
        }`}
      >
        <div className="tnhead">
          <span className="tnlabel">
            {node.kind === "agent" ? <code>{node.label}</code> : node.label}
          </span>
          {node.tag && <span className="tntag">{node.tag}</span>}
          {a && (
            <>
              <span className={`badge ${lifecycleBadge(a.lifecycle)}`}>
                {a.lifecycle ?? a.source}
              </span>
              {a.risk_ceiling && (
                <span className="tnceil" title="Risk ceiling — the highest tier it may be assigned">
                  ≤ {a.risk_ceiling}
                </span>
              )}
            </>
          )}
        </div>
        {node.sub && <div className="tnsub">{node.sub}</div>}
        {a?.owns_object && (
          <div className="tnowns">
            owns: <b>{a.owns_object}</b>
          </div>
        )}
        {/* The agent's own words on who consumes it. Inherited reach says an
            enterprise agent runs everywhere; this says under what conditions,
            which is the part the areas below cannot carry. */}
        {node.scope && (
          <div className="tnscope">
            runs for: <b>{node.scope}</b>
          </div>
        )}
        {/* Shown for exactly the agents whose inherited reach is withheld, so
            the absence is explained rather than looking like an oversight. */}
        {a && a.enabled === false && a.blocked_reason && (
          <div className="tnwhy">not running: {a.blocked_reason}</div>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="tlist">
          {node.children.map((c) => (
            <Node key={c.key} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AgentTree({
  agents,
  gates,
  workOrders,
  view,
}: {
  agents: TreeAgent[];
  gates: {
    gate_id: string;
    name: string;
    fires_at: string;
    implemented_as: string;
    build_status: string;
    on_failure: string;
  }[];
  workOrders: GraphWo[];
  view: TreeView;
}) {
  const tree = buildOrgTree(agents);
  const counts = {
    enterprise: agents.filter((a) => a.layer === "enterprise").length,
    department: agents.filter((a) => a.layer === "department").length,
    product: agents.filter((a) => a.layer === "product").length,
    enabled: agents.filter((a) => a.enabled).length,
  };

  const agentTree = buildAgentAreaTree(agents, workOrders);
  const reachOut = agentTree.filter((n) =>
    n.children.some((c) => c.tone),
  ).length;
  const evidenced = agentTree.filter((n) =>
    n.children.some((c) => c.tone === "cross"),
  ).length;
  const areas = new Set(agentTree.flatMap((n) => n.children.map((c) => c.label)));

  const nav = (
    <div className="chips subnav">
      {TREE_VIEWS.map((v) => (
        <Link
          key={v.id}
          href={`/it/agent-platform?tab=tree&view=${v.id}`}
          className={`chip${view === v.id ? " on" : ""}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );

  if (view === "map")
    return (
      <>
        {nav}
        <h2 className="sec">The map</h2>

        <p className="note" style={{ marginTop: 0 }}>
          Enterprise at the centre, then departments and products, then the
          agents themselves — the same ownership the Company Tree states in
          words. What that tree cannot show is here: a <b>context page</b> that
          several agents all load, and an agent that has <b>worked in an area
          other than its own</b>. There is deliberately no agent-to-agent line
          anywhere on it. Agents do not hand work to each other, so drawing one
          would be inventing a relationship the architecture forbids.
        </p>

        <AgentGraph agents={agents} workOrders={workOrders} />
      </>
    );

  if (view === "agent")
    return (
      <>
        {nav}
        <h2 className="sec">What each agent reaches</h2>

        <p className="note" style={{ marginTop: 0 }}>
          The Company Tree read downward — an area, then the agents it owns.
          This is the same fact from the other end: the <b>agent</b> is the
          first level, and beneath it sits every <b>area it touches</b>. The
          line under each area says why it is there, because the reasons are
          not equally strong — ownership and inheritance are structural, a work
          order is recorded evidence, and a brand page is only a capability.
        </p>

        <div className="tiles">
          <div className="tile">
            <div className="n">{agents.length}</div>
            <div className="l">agents</div>
          </div>
          <div className="tile">
            <div className="n">{reachOut}</div>
            <div className="l">reach beyond their own area</div>
          </div>
          <div className="tile">
            <div className="n" style={{ color: evidenced > 0 ? "var(--warn)" : undefined }}>
              {evidenced}
            </div>
            <div className="l">…on recorded or declared evidence</div>
          </div>
          <div className="tile">
            <div className="n">{areas.size}</div>
            <div className="l">distinct areas touched</div>
          </div>
        </div>

        <div className="card">
          {agentTree.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No agents registered. Run migration 0018 to seed the library.
            </p>
          ) : (
            <ul className="tlist troot">
              {agentTree.map((n) => (
                <Node key={n.key} node={n} />
              ))}
            </ul>
          )}
        </div>

        <p className="legend">
          <span>
            <i className="tnkey tnkey-home" /> the area that owns it
          </span>
          <span>
            <i className="tnkey tnkey-cross" /> reaches it on recorded or
            declared evidence
          </span>
          <span>
            <i className="tnkey tnkey-inherited" /> inherits — the enterprise
            layer runs in every area
          </span>
        </p>

        <p className="note">
          <b>Every department and product inherits the enterprise layer</b> — no
          area gets its own copy of an evaluator. That is why an enterprise
          agent with no recorded runs still reaches everywhere, shown as the
          dashed boxes. <b>A dashed box is a standing capability; an amber one
          is something that happened.</b> Keeping them apart is the whole point:
          a shared agent working in a product area is the design working, and
          the library stays at sixteen agents precisely because Education and
          Soundwiserx reuse them rather than cloning them.
        </p>

        <p className="note">
          <b>Inherited reach is shown only for an agent that is enabled.</b> A
          planned or suspended agent is not running in any area, so drawing it
          as though it were would make this screen assert a control that does
          not exist. Those agents show their own area and the reason they are
          held, and nothing more.
        </p>

        <p className="note">
          Work-order counts come from the {workOrders.length} most recent work
          orders on this database. With none recorded, no area here rests on
          observed runs — the amber boxes are all declared brand-page reach.
          Absence is absence of evidence, not evidence of absence.
        </p>
      </>
    );

  return (
    <>
      {nav}
      <h2 className="sec">Who exists, and who owns them</h2>

      <div className="tiles">
        <div className="tile">
          <div className="n">{counts.enterprise}</div>
          <div className="l">enterprise</div>
        </div>
        <div className="tile">
          <div className="n">{counts.department}</div>
          <div className="l">department</div>
        </div>
        <div className="tile">
          <div className="n">{counts.product}</div>
          <div className="l">product</div>
        </div>
        <div className="tile">
          <div className="n">{gates.length}</div>
          <div className="l">gates (no model, no spend)</div>
        </div>
      </div>

      <div className="card">
        {agents.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No agents registered. Run migration 0018 to seed the library.
          </p>
        ) : (
          <ul className="tlist troot">
            <Node node={tree} />
          </ul>
        )}
      </div>

      <p className="legend">
        <span>
          <span className="badge b-live">active</span> has a consumer and is running
        </span>
        <span>
          <span className="badge b-plan">planned</span> spec written, no consumer yet (§3.8)
        </span>
        <span>
          <span className="badge b-reg">blocked</span> waiting on a governance decision
        </span>
      </p>

      <p className="note">
        A product does not get its own copy of a shared job — it gets a context
        page, and a shared agent loads it. That is why Education has two agents
        and Soundwiserx one, rather than fifteen each. Adding a third product
        means writing one context page, not cloning the library.
      </p>

      <h2 className="sec">What happens in what order</h2>

      <p className="note" style={{ marginTop: 0 }}>
        This is <b>not</b> the tree above rearranged. The tree says who exists;
        this says what a single work order passes through. No agent knows who
        comes after it — every output returns to the orchestrator, which
        decides the next step. That is what keeps an agent swappable.
      </p>

      <div className="card">
        <ol className="pipeline">
          {STAGES.filter((s) => s.id !== "closed" && s.id !== "blocked").map(
            (s) => (
              <li key={s.id} className={`pstage p-${s.actor}`}>
                <div className="phead">
                  <span className="plabel">{s.label}</span>
                  <span className="pactor">{ACTOR_LABEL[s.actor]}</span>
                  {s.gate && <code className="pgate">{s.gate}</code>}
                </div>
                <div className="pexit">{s.exit}</div>
              </li>
            ),
          )}
        </ol>
      </div>

      <p className="legend">
        <span>
          <i className="pkey p-gate" /> deterministic gate — a rule, $0 per run
        </span>
        <span>
          <i className="pkey p-orchestrator" /> orchestrator — routes, never decides
        </span>
        <span>
          <i className="pkey p-worker" /> worker agent
        </span>
        <span>
          <i className="pkey p-evaluator" /> evaluator — sealed, independent
        </span>
        <span>
          <i className="pkey p-human" /> human
        </span>
      </p>

      <h2 className="sec">The gates</h2>

      <p className="note" style={{ marginTop: 0 }}>
        A gate is not an agent. It is a rule: no model, nothing to prompt, the
        same answer every time, and — the part that matters — it cannot be
        argued out of its answer by the content it is inspecting. Roughly
        nineteen of the ninety agents the source session proposed collapsed
        into these six.
      </p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Gate</th>
              <th>Fires</th>
              <th>Implemented as</th>
              <th>On failure</th>
              <th>Built?</th>
            </tr>
          </thead>
          <tbody>
            {gates.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No gates registered — migration 0018 has not been run.
                </td>
              </tr>
            ) : (
              gates.map((g) => (
                <tr key={g.gate_id}>
                  <td>
                    <code>{g.gate_id}</code>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {g.name}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{g.fires_at}</td>
                  <td style={{ fontSize: 12 }}>{g.implemented_as}</td>
                  <td style={{ fontSize: 12 }}>{g.on_failure}</td>
                  <td>
                    <span
                      className={`badge ${
                        g.build_status === "built"
                          ? "b-live"
                          : g.build_status === "partial"
                            ? "b-ready"
                            : "b-reg"
                      }`}
                    >
                      {g.build_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="note">
        <b>Read the last column honestly.</b> Only <code>GATE-authz</code> and{" "}
        <code>GATE-audit</code> are even partial, and they are partial because
        RLS, the scoped-credential boundary and the append-only tables already
        do part of the job. The other four are specified and not built. Until
        they are, the stage buttons on Work Orders are a human walking the
        state machine by hand — which is rung 2 of the cost ladder, and is the
        rung the Constitution asks you to start on.
      </p>
    </>
  );
}
