import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPermissions } from "@/lib/reachable";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";
import { AgentTree, TREE_VIEWS } from "./tree";
import {
  OpenWorkOrder,
  WorkOrderCard,
  type Wo,
  type WoEvent,
  type WoAgent,
} from "./work-orders";
import { lifecycleBadge, tierTag } from "@/lib/agent-library";

export const dynamic = "force-dynamic";

type WorkOrder = {
  id: string;
  wo_code: string | null;
  agent: string | null;
  title: string;
  description: string | null;
  status: string;
  run_status: string | null;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  started_at: string | null;
  finished_at: string | null;
  source: string;
  product_id: string | null;
  created_at: string;
};
type Agent = {
  id: string;
  agent_id: string;
  role: string | null;
  data_classes: string | null;
  evaluation: string | null;
  status: string;
  registry: string | null;
  owner: string | null;
  enabled: boolean | null;
  per_run_cap_usd: number | null;
  monthly_cap_usd: number | null;
  allowed_models: string | null;
  source: string;
  synced_at: string | null;
  product_id: string | null;
  layer: string | null;
  department: string | null;
  lifecycle: string | null;
  risk_ceiling: string | null;
  spec_path: string | null;
  question: string | null;
  owns_object: string | null;
  consumer: string | null;
  context_pages: string | null;
  output_contract: string | null;
  stop_condition: string | null;
  blocked_reason: string | null;
  spec_per_run_cap_usd: number | null;
  spec_monthly_cap_usd: number | null;
};
type SpendRow = {
  agent_id: string | null;
  product: string | null;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  reservations: number | null;
  last_seen: string | null;
};
type IngestState = {
  source: string;
  cursor: string | null;
  last_ingest_at: string | null;
  last_count: number;
  last_note: string | null;
};
type Gate = {
  gate_id: string;
  name: string;
  fires_at: string;
  checks: string;
  on_failure: string;
  implemented_as: string;
  build_status: string;
  sort: number;
};
type Perf = {
  agent_id: string;
  layer: string | null;
  department: string | null;
  lifecycle: string | null;
  risk_ceiling: string | null;
  monthly_cap_usd: number | null;
  work_orders: number;
  open_wos: number;
  closed_wos: number;
  blocked_wos: number;
  remediation_rounds: number;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  last_work_order: string | null;
};

const TABS = [
  { id: "console", label: "Console" },
  { id: "library", label: "Agent Library" },
  { id: "tree", label: "Tree" },
  { id: "wos", label: "Work Orders" },
  { id: "perf", label: "Performance" },
  { id: "spend", label: "Model Spend" },
  { id: "vision", label: "The Vision" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  "asl-runs": "Work orders ← runner_event",
  "asl-spend": "Model spend ← metering",
  agents: "Agent library ← spend_policy.yaml",
  git: "Change log ← git history",
};

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(Math.abs(Number(n)) < 1 ? 4 : 2)}`;

function ago(iso: string | null) {
  if (!iso) return "never";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AgentPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    wo?: string;
    agent?: string;
  }>;
}) {
  const {
    tab: raw,
    view: rawView,
    wo: focusWo,
    agent: focusAgent,
  } = await searchParams;
  const tab = TABS.find((t) => t.id === raw)?.id ?? "console";
  const view = TREE_VIEWS.find((v) => v.id === rawView)?.id ?? "map";

  const { supabase, email, isOwner } = await getViewer();
  if (!(await checkPerm("IT: Agent Platform"))) redirect("/dashboard");
  const held = await getPermissions();
  const canWrite = isOwner || held.has("IT: Agent Platform") || held.has("ALL");

  const [
    { data: wos, error: wosError },
    { data: agents, error: agentsError },
    { data: products, error: productsError },
    { data: spend, error: spendError },
    { data: ingest },
    { data: gates },
    { data: perf },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, wo_code, agent, title, description, objective, status, stage, risk_tier, audience, channel, data_classes, budget_ceiling_usd, requester_email, approved_by, approved_at, remediation_rounds, run_status, cost_usd, tokens_in, tokens_out, started_at, finished_at, source, product_id, created_at, closed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("agents")
      .select(
        "id, agent_id, role, data_classes, evaluation, status, registry, owner, enabled, per_run_cap_usd, monthly_cap_usd, allowed_models, source, synced_at, product_id, layer, department, lifecycle, risk_ceiling, spec_path, question, owns_object, consumer, context_pages, output_contract, stop_condition, blocked_reason, spec_per_run_cap_usd, spec_monthly_cap_usd",
      )
      .order("agent_id")
      .returns<Agent[]>(),
    supabase.from("products").select("id, name"),
    supabase
      .from("agent_spend_summary")
      .select("agent_id, product, cost_usd, tokens_in, tokens_out, reservations, last_seen")
      .order("cost_usd", { ascending: false })
      .returns<SpendRow[]>(),
    // Sync status is a courtesy: if 0015 has not been run the rest of the
    // page must still render, so this error is swallowed rather than
    // folded into loadError.
    supabase
      .from("ingest_state")
      .select("source, cursor, last_ingest_at, last_count, last_note")
      .order("source")
      .returns<IngestState[]>(),
    // 0018 tables — same treatment. The page predates them and must still
    // render if the migration has not been pasted yet.
    supabase
      .from("agent_gates")
      .select("gate_id, name, fires_at, checks, on_failure, implemented_as, build_status, sort")
      .order("sort")
      .returns<Gate[]>(),
    supabase.from("agent_performance").select("*").returns<Perf[]>(),
    supabase
      .from("work_order_events")
      .select(
        "id, work_order_id, seq, kind, from_stage, to_stage, actor, actor_id, outcome, detail, cost_usd, created_by_email, created_at",
      )
      .order("seq", { ascending: false })
      .limit(500)
      .returns<WoEvent[]>(),
  ]);

  const productName = new Map(
    (products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const loadError = wosError ?? agentsError ?? productsError;
  const woList = (wos ?? []) as unknown as (WorkOrder & Wo)[];
  const agentList = agents ?? [];
  const spendList = spend ?? [];
  const gateList = gates ?? [];
  const perfList = perf ?? [];
  const eventList = events ?? [];
  const open = woList.filter((w) => w.status === "open").length;
  const totalSpend = spendList.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  // Keyed on `layer`, not on `source`. A spec-governed agent that ALSO
  // appears in spend_policy.yaml keeps source='spend-policy' (the policy
  // claimed the agent_id first, and the agents ingest has already run against
  // production). Filtering on source would drop exactly those agents from the
  // one tab that exists to show them.
  const library = agentList.filter((a) => a.layer != null);
  const notSeeded = library.length === 0;
  const enabledCeiling = library
    .filter((a) => a.enabled)
    .reduce((s, a) => s + Number(a.spec_monthly_cap_usd ?? a.monthly_cap_usd ?? 0), 0);
  // A library agent whose live cap no longer matches its spec. Not a bug —
  // the spend policy is what the gateway enforces — but it means the repo and
  // the running system disagree, and that is worth seeing rather than
  // averaging away.
  const capDrift = library.filter(
    (a) =>
      a.spec_monthly_cap_usd != null &&
      Number(a.spec_monthly_cap_usd) !== Number(a.monthly_cap_usd ?? 0),
  );
  // A governed agent the spend policy also claims. Not a fault — but its
  // operational fields are the policy's, so the repo is no longer the whole
  // story for it, and that is worth naming rather than blending in.
  const policyClaimed = library.filter((a) => a.source === "spend-policy");

  // Deep link from a dot on the map. Filtered here rather than in the query
  // so the tiles above keep counting the whole database — a filtered view
  // that also moves the totals makes it impossible to tell what you are
  // looking at.
  const shown = focusWo
    ? woList.filter((w) => w.id === focusWo)
    : focusAgent
      ? woList.filter((w) => w.agent === focusAgent)
      : woList;
  const focusMissed = (focusWo != null || focusAgent != null) && shown.length === 0;

  const eventsByWo = new Map<string, WoEvent[]>();
  for (const e of eventList) {
    const arr = eventsByWo.get(e.work_order_id);
    if (arr) arr.push(e);
    else eventsByWo.set(e.work_order_id, [e]);
  }

  const woAgents: WoAgent[] = agentList.map((a) => ({
    agent_id: a.agent_id,
    risk_ceiling: a.risk_ceiling,
    lifecycle: a.lifecycle,
    enabled: a.enabled,
    blocked_reason: a.blocked_reason,
  }));

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/it/agent-platform", held) },
        { label: "Agent Platform" },
      ]}
      lead="The governed agent library and the work orders they execute. Rows sourced from the ASL ledger and the spend policy are a mirror: the database refuses to let anyone edit them, because the next sync would overwrite the change anyway. Library rows mirror the specs in docs/agents/ and are read-only here for the same reason — editing an agent means editing its spec. Rows marked 'entered by hand' are this module's own. Model spend is mirrored and never editable."
      nav={itNav("/it/agent-platform", held)}
    >
      <div className="g2nav">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/it/agent-platform?tab=${t.id}`}
            className={`g2tab${tab === t.id ? " on" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {loadError && (
        <p className="note" style={{ color: "var(--danger)" }}>
          Some data failed to load: {loadError.message}. Anything empty below
          may not actually be empty.
        </p>
      )}

      {notSeeded && tab !== "vision" && (
        <p className="note" style={{ color: "var(--warn)" }}>
          <b>No library agents found.</b> Migration{" "}
          <code>0018_agent_library.sql</code> has not been run on this database
          yet, so the Library, Tree, Work Orders and Performance tabs will be
          empty or partial. The specs themselves are in{" "}
          <code>docs/agents/</code> either way — this screen is a mirror of
          them, not the record.
        </p>
      )}

      {tab === "console" && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="n">{agentList.length}</div>
              <div className="l">agents registered</div>
            </div>
            <div className="tile">
              <div className="n">{woList.length}</div>
              <div className="l">work orders</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: open > 0 ? "var(--b)" : "var(--ok)" }}>
                {open}
              </div>
              <div className="l">open</div>
            </div>
            <div className="tile">
              <div className="n">{usd(totalSpend)}</div>
              <div className="l">model spend, all time</div>
            </div>
          </div>

          <h2 className="sec">Agent library</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Registry</th>
                  <th>Data classes</th>
                  <th>Models</th>
                  <th>Caps (run / month)</th>
                  <th>Owner</th>
                  <th>Product</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {agentList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: "var(--muted)" }}>
                      No agents registered. Run migration 0018 to seed the
                      governed library, and the Stage 3 publisher to mirror the
                      spend policy.
                    </td>
                  </tr>
                ) : (
                  agentList.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.agent_id}</code>
                        {a.role && (
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {a.role}
                          </div>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {a.registry ?? "—"}
                      </td>
                      <td>
                        <span
                          className={
                            a.data_classes?.includes("D3") ? "no-d3" : undefined
                          }
                        >
                          {a.data_classes ?? "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{a.allowed_models ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {usd(a.per_run_cap_usd)} / {usd(a.monthly_cap_usd)}
                      </td>
                      <td>{a.owner ?? "—"}</td>
                      <td>
                        {a.product_id
                          ? (productName.get(a.product_id) ?? "—")
                          : "company-wide"}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            a.enabled === false ? "b-reg" : "b-live"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="note">
            An agent marked <b>disabled</b> is stopped enterprise-wide by the
            policy&apos;s kill switch, not by anything in this screen. D3
            (student or patient) data never appears here — an agent may be
            <i> allowed</i> to touch D3 on the governed plane, and this column
            records that permission, not any data.
          </p>

          <h2 className="sec">Sync status</h2>
          {!ingest ? (
            <p className="note">
              No sync record — migration 0015 has not been run on this
              database yet.
            </p>
          ) : (
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Last sync</th>
                    <th>Rows written</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {ingest.map((s) => (
                    <tr key={s.source}>
                      <td>{SOURCE_LABEL[s.source] ?? s.source}</td>
                      <td
                        style={{
                          color: s.last_ingest_at ? undefined : "var(--muted)",
                        }}
                      >
                        {ago(s.last_ingest_at)}
                      </td>
                      <td>{s.last_ingest_at ? s.last_count : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        <code>{s.cursor ?? "—"}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">
            The publisher is run by hand — nothing schedules it. Read the last
            sync before trusting a spend figure. Library rows do not appear
            here because they are seeded by migration, not synced; their record
            is the spec file in <code>docs/agents/</code>.
          </p>
        </>
      )}

      {tab === "library" && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="n">{library.length}</div>
              <div className="l">specs in the library</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: "var(--ok)" }}>
                {library.filter((a) => a.enabled).length}
              </div>
              <div className="l">enabled</div>
            </div>
            <div className="tile">
              <div className="n">
                {library.filter((a) => a.lifecycle === "blocked").length}
              </div>
              <div className="l">blocked on a decision</div>
            </div>
            <div className="tile">
              <div className="n">{usd(enabledCeiling)}</div>
              <div className="l">declared monthly ceiling, enabled</div>
            </div>
          </div>

          {policyClaimed.length > 0 && (
            <p className="note">
              <b>
                {policyClaimed.length} governed agent
                {policyClaimed.length === 1 ? " is" : "s are"} also in the spend
                policy.
              </b>{" "}
              Their governance comes from <code>docs/agents/</code> and their
              caps and kill switch come from <code>spend_policy.yaml</code> in
              asl-gateway, which is what the gateway enforces. Both are shown;
              where they disagree, the drift note below says so.
              {policyClaimed.map((a) => (
                <code key={a.id} style={{ marginRight: 8 }}>
                  {a.agent_id}
                </code>
              ))}
            </p>
          )}

          {capDrift.length > 0 && (
            <p className="note" style={{ color: "var(--warn)" }}>
              <b>
                {capDrift.length} agent{capDrift.length === 1 ? "" : "s"} run
                {capDrift.length === 1 ? "s" : ""} under a cap its spec does not
                declare.
              </b>{" "}
              The spend policy in <code>asl-gateway</code> is what the gateway
              actually enforces, so this screen shows its figure — but the repo
              and the running system disagree, and that is a reconciliation
              item, not a rounding difference.
              {capDrift.map((a) => (
                <span key={a.id} style={{ display: "block", marginTop: 4 }}>
                  <code>{a.agent_id}</code> — spec{" "}
                  {usd(a.spec_monthly_cap_usd)}, live {usd(a.monthly_cap_usd)}
                </span>
              ))}
            </p>
          )}

          <h2 className="sec">Governed specifications</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Answers one question</th>
                  <th>Owns</th>
                  <th>Layer</th>
                  <th>Ceiling</th>
                  <th>Cap / month</th>
                  <th>Contract</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {library.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: "var(--muted)" }}>
                      Migration 0018 has not been run.
                    </td>
                  </tr>
                ) : (
                  library.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.agent_id}</code>
                        {a.spec_path && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {a.spec_path}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5 }}>{a.question ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.owns_object ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {a.layer ?? "—"}
                        {a.department ? ` · ${a.department}` : ""}
                      </td>
                      <td>
                        {a.risk_ceiling ? (
                          <span className={`tag ${tierTag(a.risk_ceiling)}`}>
                            {a.risk_ceiling}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {usd(a.spec_monthly_cap_usd)}
                        {a.spec_monthly_cap_usd != null &&
                          Number(a.spec_monthly_cap_usd) !==
                            Number(a.monthly_cap_usd ?? 0) && (
                            <div style={{ color: "var(--warn)", fontSize: 11 }}>
                              running at {usd(a.monthly_cap_usd)}
                            </div>
                          )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {a.output_contract ?? "—"}
                      </td>
                      <td>
                        <span className={`badge ${lifecycleBadge(a.lifecycle)}`}>
                          {a.lifecycle ?? "—"}
                        </span>
                        {a.blocked_reason && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            {a.blocked_reason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="note">
            <b>Read-only, deliberately.</b> The specs in{" "}
            <code>docs/agents/</code> are the record; this table mirrors them.
            An edit here would be silently reverted the next time the library
            is reseeded, and worse, the screen would disagree with the repo in
            the meantime. Changing an agent means changing its spec file and
            re-running the seed — which is also what leaves a git history.
          </p>

          <h2 className="sec">Consumers</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Who consumes this output, this week (§3.8)</th>
                  <th>Context pages</th>
                </tr>
              </thead>
              <tbody>
                {library.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code>{a.agent_id}</code>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{a.consumer ?? "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>
                      {a.context_pages ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            An agent with no named consumer is not activated — it goes on the
            roadmap. That rule is what keeps this list at sixteen rather than
            ninety.
          </p>
        </>
      )}

      {tab === "tree" && (
        <AgentTree
          agents={agentList.map((a) => ({
            agent_id: a.agent_id,
            layer: a.layer,
            department: a.department,
            lifecycle: a.lifecycle,
            risk_ceiling: a.risk_ceiling,
            question: a.question,
            owns_object: a.owns_object,
            product_name: a.product_id
              ? (productName.get(a.product_id) ?? null)
              : null,
            monthly_cap_usd: a.monthly_cap_usd,
            enabled: a.enabled,
            source: a.source,
            context_pages: a.context_pages,
            blocked_reason: a.blocked_reason,
            consumer: a.consumer,
          }))}
          gates={gateList}
          view={view}
          tiers={Object.fromEntries(woList.map((w) => [w.id, w.risk_tier]))}
          workOrders={woList.map((w) => ({
            id: w.id,
            wo_code: w.wo_code,
            title: w.title,
            agent: w.agent,
            stage: w.stage,
            status: w.status,
            product_name: w.product_id
              ? (productName.get(w.product_id) ?? null)
              : null,
          }))}
        />
      )}

      {tab === "wos" && (
        <>
          {/* Arriving from a dot on the map. `agent` narrows the list;
              `wo` additionally names one card, which opens with its feed
              already expanded so the entries above and below are readable
              without a second click. A stale link — an agent or work order
              that no longer exists — says so rather than rendering an empty
              page that looks like "nothing has happened". */}
          {(focusAgent || focusWo) && (
            <p className="note wofocus">
              {focusAgent ? (
                <>
                  Showing work orders for <code>{focusAgent}</code>.{" "}
                </>
              ) : (
                <>Showing one work order. </>
              )}
              <Link href="/it/agent-platform?tab=wos" className="crumb">
                Show all
              </Link>{" "}
              ·{" "}
              <Link href="/it/agent-platform?tab=tree" className="crumb">
                Back to the map
              </Link>
            </p>
          )}

          <div className="tiles">
            <div className="tile">
              <div className="n">{woList.length}</div>
              <div className="l">work orders</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: open > 0 ? "var(--b)" : "var(--ok)" }}>
                {open}
              </div>
              <div className="l">open</div>
            </div>
            <div className="tile">
              <div className="n">
                {woList.filter((w) => w.stage === "blocked").length}
              </div>
              <div className="l">blocked (a gate did its job)</div>
            </div>
            <div className="tile">
              <div className="n">{eventList.length}</div>
              <div className="l">activity entries</div>
            </div>
          </div>

          {canWrite && (
            <OpenWorkOrder agents={woAgents} products={products ?? []} />
          )}

          {focusMissed && (
            <p className="note" style={{ color: "var(--warn)" }}>
              <b>That link no longer resolves.</b>{" "}
              {focusWo
                ? "The work order it names is not in the most recent 200, or has been removed."
                : `No work order names ${focusAgent}.`}{" "}
              Nothing is filtered below.
            </p>
          )}

          <h2 className="sec">Live</h2>
          {shown.filter((w) => w.status === "open").length === 0 ? (
            <p className="note">
              No open work orders. Opening one walks it through the
              orchestrator&apos;s state machine by hand — which is rung 2 of the
              cost ladder, and the rung the Constitution asks you to start on
              before automating anything.
            </p>
          ) : (
            shown
              .filter((w) => w.status === "open")
              .map((w) => (
                <WorkOrderCard
                  key={w.id}
                  wo={w as Wo}
                  events={eventsByWo.get(w.id) ?? []}
                  canWrite={canWrite}
                  focused={w.id === focusWo}
                  productName={
                    w.product_id ? (productName.get(w.product_id) ?? null) : null
                  }
                />
              ))
          )}

          <h2 className="sec">Closed and blocked</h2>
          {shown.filter((w) => w.status !== "open").length === 0 ? (
            <p className="note">Nothing closed yet.</p>
          ) : (
            shown
              .filter((w) => w.status !== "open")
              .slice(0, 25)
              .map((w) => (
                <WorkOrderCard
                  key={w.id}
                  wo={w as Wo}
                  events={eventsByWo.get(w.id) ?? []}
                  canWrite={canWrite}
                  focused={w.id === focusWo}
                  productName={
                    w.product_id ? (productName.get(w.product_id) ?? null) : null
                  }
                />
              ))
          )}

          <p className="note">
            The activity feed is <b>append-only</b> — no update policy, no
            delete policy, not for the owner either. Same guarantee as the
            Change Log and the Zero-Day archive. An activity feed that can be
            edited is not evidence, and a wrong entry is corrected by adding a
            further entry, never by rewriting one.
          </p>
        </>
      )}

      {tab === "perf" && (
        <>
          <h2 className="sec">Per-agent</h2>
          {perfList.length === 0 ? (
            <p className="note">
              Nothing to show — migration 0018 has not been run, or no work
              orders have been opened.
            </p>
          ) : (
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Layer</th>
                    <th>Work orders</th>
                    <th>Open</th>
                    <th>Closed</th>
                    <th>Blocked</th>
                    <th>Remediation</th>
                    <th>Spend / cap</th>
                    <th>Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {perfList
                    .slice()
                    .sort((a, b) => b.work_orders - a.work_orders)
                    .map((p) => {
                      const cap = Number(p.monthly_cap_usd ?? 0);
                      const spent = Number(p.cost_usd ?? 0);
                      const pct = cap > 0 ? (spent / cap) * 100 : 0;
                      return (
                        <tr key={p.agent_id}>
                          <td>
                            <code>{p.agent_id}</code>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>
                            {p.layer ?? "—"}
                            {p.department ? ` · ${p.department}` : ""}
                          </td>
                          <td>{p.work_orders}</td>
                          <td>{p.open_wos}</td>
                          <td>{p.closed_wos}</td>
                          <td
                            style={
                              p.blocked_wos > 0 ? { color: "var(--warn)" } : undefined
                            }
                          >
                            {p.blocked_wos}
                          </td>
                          <td>{p.remediation_rounds}</td>
                          <td
                            style={
                              pct >= 100
                                ? { color: "var(--danger)" }
                                : pct >= 80
                                  ? { color: "var(--warn)" }
                                  : undefined
                            }
                          >
                            {usd(spent)} / {cap > 0 ? usd(cap) : "—"}
                            {cap > 0 && (
                              <span
                                style={{ fontSize: 11, color: "var(--muted)" }}
                              >
                                {" "}
                                ({Math.round(pct)}%)
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>
                            {ago(p.last_work_order)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <p className="note">
            <b>Thresholds (§5.2):</b> 80% warn and notify the manager · 100%
            hard cutoff · &gt;120% workflow review · &gt;150% suspension. No
            agent may raise its own cap. Amber and red above are the 80% and
            100% lines — but note that the cutoff itself lives in{" "}
            <code>GATE-runtime</code>, which is <b>specified and not built</b>.
            Today these numbers are a report, not a wall.
          </p>

          <p className="note">
            <b>Blocked is not a failure column.</b> A blocked work order means a
            gate refused to let something through, which is the system working.
            The column worth worrying about is remediation: three rounds on one
            work order means the brief or the source evidence was wrong, not
            the agent.
          </p>
        </>
      )}

      {tab === "spend" && (
        <>
          <h2 className="sec">Model spend</h2>
          {spendError ? (
            <p className="note">
              Spend is unavailable: {spendError.message}
            </p>
          ) : spendList.length === 0 ? (
            <p className="note">
              No metering rows. The ledger&apos;s spend sync has deliberately
              not been run against production — the only ledger on disk is a
              test database.
            </p>
          ) : (
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Product</th>
                    <th>Cost</th>
                    <th>Tokens in / out</th>
                    <th>Reservations</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {spendList.map((s) => (
                    <tr key={`${s.agent_id}-${s.product}`}>
                      <td>
                        <code>{s.agent_id ?? "—"}</code>
                      </td>
                      <td>{s.product ?? "—"}</td>
                      <td>{usd(s.cost_usd)}</td>
                      <td style={{ fontSize: 12 }}>
                        {s.tokens_in ?? 0} / {s.tokens_out ?? 0}
                      </td>
                      <td>{s.reservations ?? 0}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {ago(s.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">
            Mirrored from the governed ledger and never editable. Summing
            signed rows is the only correct reading — the ledger never updates
            a balance in place.
          </p>
        </>
      )}

      {tab === "vision" && (
        <>
          <h2 className="sec">The Vision</h2>
          <div className="card">
            <div className="constext">
              <p>
                One governed platform, many products. Every capability is built
                once — safely — then reused across everything from classrooms
                to clinics.
              </p>
              <p>
                Agents execute work orders under a spend cap and a declared set
                of data classes. Every run is evaluated by something other than
                the agent that produced it, and the verdict lands on an
                append-only ledger before any gate opens.
              </p>
              <p>
                Regulated data never leaves local infrastructure. This company
                OS holds company and operations data only — the governed plane
                stays separate, by design and by policy. The link between them
                runs one way: the plane pushes a metadata summary outward, and
                nothing here can reach in.
              </p>
              <p>
                What is not automated yet is stated plainly rather than
                implied. The evaluator&apos;s verdicts are not mirrored here,
                and the publisher is run by hand rather than on a schedule — so
                the sync timestamps on the Console tab are worth reading before
                trusting a number on this page.
              </p>
              <p>
                <b>And what is not built yet.</b>{" "}
                {gateList.length > 0 ? (
                  <>
                    {gateList.filter((g) => g.build_status !== "built").length}{" "}
                    of the {gateList.length} gates are not built.
                  </>
                ) : (
                  <>None of the gates are built.</>
                )}{" "}
                The work-order stages on this screen are a human walking the
                state machine by hand, and no evaluator quorum is enforced —
                the tier tells you how many verdicts are required, and nothing
                checks that they arrived. That is rung 2 of the cost ladder,
                deliberately: the manual version has to be better than what it
                replaces before any of it is worth automating.
              </p>
            </div>
          </div>
          <p className="note">
            The governing rules live in{" "}
            <Link href="/hr/constitution" className="crumb">
              HR › Scout Quest AI Constitution
            </Link>
            . The agent specifications, the context library and the gap
            analysis live in <code>docs/agents/</code> in the repo.
          </p>
        </>
      )}
    </OsShell>
  );
}
