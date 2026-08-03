import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPermissions } from "@/lib/reachable";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";

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

const TABS = [
  { id: "console", label: "Console" },
  { id: "wos", label: "Agent Work Orders" },
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
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.id === raw)?.id ?? "console";

  const { supabase, email, isOwner } = await getViewer();
  if (!(await checkPerm("IT: Agent Platform"))) redirect("/dashboard");
  const held = await getPermissions();

  const [
    { data: wos, error: wosError },
    { data: agents, error: agentsError },
    { data: products, error: productsError },
    { data: spend, error: spendError },
    { data: ingest },
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, wo_code, agent, title, description, status, run_status, cost_usd, tokens_in, tokens_out, started_at, finished_at, source, product_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<WorkOrder[]>(),
    supabase
      .from("agents")
      .select(
        "id, agent_id, role, data_classes, evaluation, status, registry, owner, enabled, per_run_cap_usd, monthly_cap_usd, allowed_models, source, synced_at, product_id",
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
  ]);

  const productName = new Map(
    (products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const loadError = wosError ?? agentsError ?? productsError;
  const woList = wos ?? [];
  const agentList = agents ?? [];
  const spendList = spend ?? [];
  const open = woList.filter((w) => w.status === "open").length;
  const totalSpend = spendList.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/it/agent-platform", held) },
        { label: "Agent Platform" },
      ]}
      lead="The governed agent library and the work orders they execute. Rows sourced from the ASL ledger and the spend policy are a mirror: the database refuses to let anyone edit them, because the next sync would overwrite the change anyway. Rows marked 'entered by hand' are this module's own and remain writable with the IT: Agent Platform key. Model spend is mirrored and never editable."
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
                      No agents registered. The library mirrors the governed
                      spend policy; run the Stage 3 publisher to fill it.
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
            The publisher runs on the governed local plane and pushes
            metadata outward — this OS cannot reach the ledger, deliberately.
            A stale timestamp means the publisher has not run, not that
            nothing happened.
          </p>
        </>
      )}

      {tab === "wos" && (
        <>
          <h2 className="sec">Agent work orders</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>WO</th>
                  <th>Agent</th>
                  <th>Title</th>
                  <th>Product</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {woList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--muted)" }}>
                      No work orders yet. These come from the ledger; run the
                      Stage 3 publisher on the machine that holds it.
                    </td>
                  </tr>
                ) : (
                  woList.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <code>{w.wo_code ?? "—"}</code>
                        {w.source === "manual" && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            entered by hand
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{w.agent ?? "—"}</td>
                      <td>
                        {w.title}
                        {w.description && (
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {w.description}
                          </div>
                        )}
                        {w.started_at && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {new Date(w.started_at).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td>
                        {w.product_id
                          ? (productName.get(w.product_id) ?? "—")
                          : "—"}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {w.tokens_in == null && w.tokens_out == null
                          ? "—"
                          : `${w.tokens_in ?? 0} in / ${w.tokens_out ?? 0} out`}
                      </td>
                      <td style={{ fontSize: 12 }}>{usd(w.cost_usd)}</td>
                      <td>
                        <span
                          className={`badge ${
                            w.status === "open"
                              ? "b-ready"
                              : w.status === "blocked"
                                ? "b-plan"
                                : "b-live"
                          }`}
                          title={w.run_status ?? undefined}
                        >
                          {w.run_status ?? w.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="note">
            One row per run. Step output, run parameters and error detail stay
            on the governed plane and are never sent here — what crosses is
            the identifier, the counts and the outcome.
          </p>
        </>
      )}

      {tab === "spend" && (
        <>
          <h2 className="sec">Model spend by agent</h2>
          {spendError ? (
            <p className="note" style={{ color: "var(--danger)" }}>
              Could not load spend: {spendError.message}. Has migration 0015
              been run?
            </p>
          ) : (
            <>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Product</th>
                      <th>Runs metered</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                      <th>Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spendList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: "var(--muted)" }}>
                          Nothing metered yet.
                        </td>
                      </tr>
                    ) : (
                      spendList.map((r) => (
                        <tr key={`${r.agent_id}-${r.product}`}>
                          <td>
                            <code>{r.agent_id ?? "—"}</code>
                          </td>
                          <td>{r.product ?? "unattributed"}</td>
                          <td>{r.reservations ?? 0}</td>
                          <td style={{ fontSize: 12 }}>
                            {(r.tokens_in ?? 0) + (r.tokens_out ?? 0)}
                          </td>
                          <td>
                            <b>{usd(r.cost_usd)}</b>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>
                            {r.last_seen
                              ? new Date(r.last_seen).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="note">
                A mirror of the governed metering ledger, not the ledger
                itself. The authoritative, hash-chained record lives on the
                local plane; these numbers are for people who cannot open it.
                Costs are the sum of signed events — a reservation, then an
                adjustment to the real cost — so a run in flight shows its
                estimate until it settles.
              </p>
            </>
          )}
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
            </div>
          </div>
          <p className="note">
            The governing rules live in{" "}
            <Link href="/hr/constitution" className="crumb">
              HR › Scout Quest AI Constitution
            </Link>
            .
          </p>
        </>
      )}
    </OsShell>
  );
}
