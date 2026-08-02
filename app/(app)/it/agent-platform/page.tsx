import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";

export const dynamic = "force-dynamic";

type WorkOrder = {
  id: string;
  wo_code: string | null;
  agent: string | null;
  title: string;
  description: string | null;
  status: string;
  confidence: string | null;
  review: string | null;
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
  product_id: string | null;
};

const TABS = [
  { id: "console", label: "Console" },
  { id: "wos", label: "Agent Work Orders" },
  { id: "vision", label: "The Vision" },
] as const;

export default async function AgentPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.id === raw)?.id ?? "console";

  const { supabase, email, isOwner } = await getViewer();
  if (!(await checkPerm("IT: Agent Platform"))) redirect("/dashboard");

  const [
    { data: wos, error: wosError },
    { data: agents, error: agentsError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select(
        "id, wo_code, agent, title, description, status, confidence, review, product_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<WorkOrder[]>(),
    supabase
      .from("agents")
      .select("id, agent_id, role, data_classes, evaluation, status, product_id")
      .order("agent_id")
      .returns<Agent[]>(),
    supabase.from("products").select("id, name"),
  ]);

  const productName = new Map(
    (products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const loadError = wosError ?? agentsError ?? productsError;
  const woList = wos ?? [];
  const agentList = agents ?? [];
  const open = woList.filter((w) => w.status === "open").length;

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: "/it/identity-access" },
        { label: "Agent Platform" },
      ]}
      lead="The governed agent library and the work orders they execute. Both are generated from the ASL ledger and the spend policy rather than entered here, so this module is read-only by design."
      nav={[
        { label: "Identity & Access", href: "/it/identity-access" },
        { label: "Agent Platform", href: "/it/agent-platform", on: true },
        { label: "Access Requests", href: "/it/access-requests" },
        { label: "Zero-Day", href: "/it/zero-day" },
      ]}
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
          </div>

          <h2 className="sec">Agent library</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Role</th>
                  <th>Data classes</th>
                  <th>Evaluation</th>
                  <th>Product</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {agentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--muted)" }}>
                      No agents registered. The library mirrors the governed
                      spend policy; the Stage 3 ingest fills it.
                    </td>
                  </tr>
                ) : (
                  agentList.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.agent_id}</code>
                      </td>
                      <td>{a.role ?? "—"}</td>
                      <td>
                        <span
                          className={
                            a.data_classes?.includes("D3") ? "no-d3" : undefined
                          }
                        >
                          {a.data_classes ?? "—"}
                        </span>
                      </td>
                      <td>{a.evaluation ?? "—"}</td>
                      <td>
                        {a.product_id
                          ? (productName.get(a.product_id) ?? "—")
                          : "company-wide"}
                      </td>
                      <td>
                        <span className="badge b-live">{a.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="note">
            D3 (student or patient) data must never appear here — this app
            holds company data only.
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
                  <th>Confidence</th>
                  <th>Review</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {woList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--muted)" }}>
                      No work orders yet. Stage 3 feeds these from the ledger
                      rather than by hand.
                    </td>
                  </tr>
                ) : (
                  woList.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <code>{w.wo_code ?? "—"}</code>
                      </td>
                      <td>{w.agent ?? "—"}</td>
                      <td>
                        {w.title}
                        {w.description && (
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {w.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {w.product_id
                          ? (productName.get(w.product_id) ?? "—")
                          : "—"}
                      </td>
                      <td>{w.confidence ?? "—"}</td>
                      <td>{w.review ?? "—"}</td>
                      <td>
                        <span
                          className={`badge ${w.status === "open" ? "b-ready" : "b-live"}`}
                        >
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                stays separate, by design and by policy.
              </p>
              <p>
                What is not automated yet is stated plainly rather than implied:
                work orders and the agent library are filled by the Stage 3
                ingest, and until that ships these tables stay empty rather
                than being hand-maintained.
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
