import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { checkPerm } from "@/lib/permissions";
import { OsShell } from "../../shell";
import { Gantt, type PlanRow } from "../gantt";
import {
  AddAreaForm,
  AreaStatus,
  DeleteArea,
  AddPlanForm,
  DeletePlanItem,
  AddWebsiteForm,
  DeleteWebsite,
  LogProductChangeForm,
} from "./forms";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "plan", label: "Plan Board" },
  { id: "build", label: "Build Board" },
  { id: "agents", label: "Agents" },
  { id: "website", label: "Website" },
  { id: "changelog", label: "Change Log" },
  { id: "mission", label: "Mission & Values" },
] as const;

type Tab = (typeof TABS)[number]["id"];

type Product = { id: string; key: string; name: string; status: string };
type Area = {
  id: string;
  area: string;
  status: string;
  note: string | null;
  sort: number;
};
type PlanItem = PlanRow & { id: string; parent_id: string | null };
type Website = { id: string; label: string; url: string };
type Agent = {
  id: string;
  agent_id: string;
  role: string | null;
  data_classes: string | null;
  evaluation: string | null;
  status: string;
  product_id: string | null;
};
type Change = {
  id: string;
  tab: string | null;
  change_type: string | null;
  description: string;
  created_by_email: string | null;
  created_at: string;
};
type Mission = {
  purpose: string | null;
  mission: string | null;
  values: { title: string; body: string }[] | null;
};

const STATUS_BADGE: Record<string, string> = {
  live: "b-live",
  building: "b-ready",
  planned: "b-plan",
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { key } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === rawTab)?.id ?? "plan") as Tab;

  const { supabase, email, isOwner } = await getViewer();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, key, name, status")
    .eq("key", key)
    .maybeSingle<Product>();
  // A failed lookup is not a missing product — saying "not found" would
  // send you hunting for the wrong problem.
  if (productError) throw new Error(`Could not load product: ${productError.message}`);
  if (!product) notFound();

  const [
    { data: areas, error: areasError },
    { data: plans, error: plansError },
    { data: sites, error: sitesError },
    { data: agents, error: agentsError },
    { data: changes, error: changesError },
    { data: mission, error: missionError },
  ] = await Promise.all([
    // Secondary sort by id: `sort` defaults to 0, so ties would otherwise
    // leave row order up to the database.
    supabase
      .from("product_areas")
      .select("id, area, status, note, sort")
      .eq("product_id", product.id)
      .order("sort")
      .order("id")
      .returns<Area[]>(),
    supabase
      .from("plan_items")
      .select("id, title, start_date, end_date, status, parent_id")
      .eq("product_id", product.id)
      .order("sort")
      .order("id")
      .returns<PlanItem[]>(),
    supabase
      .from("websites")
      .select("id, label, url")
      .eq("product_id", product.id)
      .order("created_at")
      .order("id")
      .returns<Website[]>(),
    // Agents tagged to this product, plus company-wide ones (null product):
    // the library is shared, so filtering strictly would hide most of it.
    supabase
      .from("agents")
      .select("id, agent_id, role, data_classes, evaluation, status, product_id")
      .or(`product_id.eq.${product.id},product_id.is.null`)
      .order("agent_id")
      .returns<Agent[]>(),
    supabase
      .from("change_log")
      .select("id, tab, change_type, description, created_by_email, created_at")
      .eq("product", key)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<Change[]>(),
    supabase
      .from("mission_values")
      .select("purpose, mission, values")
      .eq("scope", key)
      .maybeSingle<Mission>(),
  ]);

  const [canBuild, canPlan, canSite, canLog] = await Promise.all([
    checkPerm("Products: Build Board"),
    checkPerm("Products: Plan Board"),
    checkPerm("Products: Website"),
    checkPerm("Products: Change Log"),
  ]);

  // Any failed query must say so — "empty" and "failed" look identical
  // otherwise, and this is the screen used to judge build progress.
  const loadError =
    areasError ?? plansError ?? sitesError ?? agentsError ?? changesError ?? missionError;

  // Nest tasks under their parent so the Gantt can collapse them.
  const planList = plans ?? [];
  const tasksByParent = new Map<string, PlanItem[]>();
  for (const p of planList) {
    if (!p.parent_id) continue;
    const list = tasksByParent.get(p.parent_id) ?? [];
    list.push(p);
    tasksByParent.set(p.parent_id, list);
  }
  const planTree = planList
    .filter((p) => !p.parent_id)
    .map((p) => ({ ...p, children: tasksByParent.get(p.id) ?? [] }));

  // Table rows follow the tree, so a task always sits directly under its
  // own parent — sorting by `sort` alone would strand new tasks at the
  // bottom, indented beneath an unrelated row.
  const planRows = planTree.flatMap((p) => [
    { row: p as PlanItem, childCount: p.children.length },
    ...p.children.map((c) => ({ row: c, childCount: 0 })),
  ]);

  const areaList = areas ?? [];
  const counts = {
    live: areaList.filter((a) => a.status === "live").length,
    building: areaList.filter((a) => a.status === "building").length,
    planned: areaList.filter((a) => a.status === "planned").length,
  };
  const values = Array.isArray(mission?.values) ? mission.values : [];

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "Products", href: "/products" },
        { label: product.name },
      ]}
    >
      <div className="g2nav">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/products/${key}?tab=${t.id}`}
            className={`g2tab${tab === t.id ? " on" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {loadError && (
        <p className="note" style={{ color: "var(--danger)" }}>
          Some data failed to load: {loadError.message}. Anything showing as
          empty below may not actually be empty — has migration 0010 been run?
        </p>
      )}

      {tab === "plan" && (
        <>
          <h2 className="sec">Plan Board</h2>
          <p className="lead">
            The schedule for {product.name}. Bars are positioned from each
            item&apos;s start and end dates.
          </p>
          <Gantt rows={planTree} />

          {canPlan && (
            <>
              <h2 className="sec">Add a plan item or task</h2>
              <AddPlanForm
                productKey={key}
                parents={planList
                  .filter((p) => !p.parent_id)
                  .map((p) => ({ id: p.id, title: p.title }))}
              />
            </>
          )}

          {planList.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    {canPlan && <th />}
                  </tr>
                </thead>
                <tbody>
                  {planRows.map(({ row: p, childCount }) => (
                    <tr key={p.id}>
                      <td style={p.parent_id ? { paddingLeft: 30 } : undefined}>
                        {p.parent_id && (
                          <span style={{ color: "var(--muted)" }}>↳ </span>
                        )}
                        {p.title}
                        {childCount > 0 && (
                          <span className="gcount" style={{ marginLeft: 6 }}>
                            {childCount} task{childCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td>{p.start_date ?? "—"}</td>
                      <td>{p.end_date ?? "—"}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[p.status] ?? "b-reg"}`}>
                          {p.status}
                        </span>
                      </td>
                      {canPlan && (
                        <td>
                          <DeletePlanItem
                            id={p.id}
                            productKey={key}
                            childCount={childCount}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "build" && (
        <>
          <h2 className="sec">Build Board — progress by area</h2>
          <p className="lead">
            Where the {product.name} build stands, area by area. Phases:
            planned → building → live.
          </p>
          <div className="tiles">
            <div className="tile">
              <div className="n grn">{counts.live}</div>
              <div className="l">Live</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: "var(--b)" }}>
                {counts.building}
              </div>
              <div className="l">Building</div>
            </div>
            <div className="tile">
              <div className="n" style={{ color: "var(--g)" }}>
                {counts.planned}
              </div>
              <div className="l">Planned</div>
            </div>
          </div>

          {canBuild && (
            <>
              <h2 className="sec">Add an area</h2>
              <AddAreaForm productKey={key} />
            </>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Notes</th>
                  {canBuild && <th />}
                </tr>
              </thead>
              <tbody>
                {areaList.length === 0 ? (
                  <tr>
                    <td colSpan={canBuild ? 4 : 3} style={{ color: "var(--muted)" }}>
                      No areas yet.
                    </td>
                  </tr>
                ) : (
                  areaList.map((a) => (
                    <tr key={a.id}>
                      <td>{a.area}</td>
                      <td>
                        {canBuild ? (
                          <AreaStatus
                            areaId={a.id}
                            status={a.status}
                            productKey={key}
                          />
                        ) : (
                          <span className={`badge ${STATUS_BADGE[a.status] ?? "b-reg"}`}>
                            {a.status}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{a.note ?? "—"}</td>
                      {canBuild && (
                        <td>
                          <DeleteArea id={a.id} productKey={key} />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {canBuild && (
            <p className="note">
              Click a status badge to move it forward: planned → building →
              live → planned.
            </p>
          )}
        </>
      )}

      {tab === "agents" && (
        <>
          <h2 className="sec">Agents</h2>
          <p className="lead">
            Agents serving {product.name}. The library is generated from the
            governed spend policy rather than kept by hand, so this list is
            read-only here.
          </p>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Role</th>
                  <th>Data classes</th>
                  <th>Evaluation</th>
                  <th>Scope</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(agents ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--muted)" }}>
                      The agent library is empty. It is generated from the
                      governed spend policy rather than entered here.
                    </td>
                  </tr>
                ) : (
                  (agents ?? []).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <code>{a.agent_id}</code>
                      </td>
                      <td>{a.role ?? "—"}</td>
                      <td>
                        {a.data_classes ? (
                          <span
                            className={
                              a.data_classes.includes("D3") ? "no-d3" : undefined
                            }
                          >
                            {a.data_classes}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{a.evaluation ?? "—"}</td>
                      <td>
                        <span
                          className={`badge ${a.product_id ? "b-gov" : "b-reg"}`}
                        >
                          {a.product_id ? product.name : "company-wide"}
                        </span>
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
        </>
      )}

      {tab === "website" && (
        <>
          <h2 className="sec">Website &amp; links</h2>
          {canSite && <AddWebsiteForm productKey={key} />}
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>URL</th>
                  {canSite && <th />}
                </tr>
              </thead>
              <tbody>
                {(sites ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={canSite ? 3 : 2} style={{ color: "var(--muted)" }}>
                      No links yet.
                    </td>
                  </tr>
                ) : (
                  (sites ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>{s.label}</td>
                      <td>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.url.replace(/^https?:\/\//, "")} ↗
                        </a>
                      </td>
                      {canSite && (
                        <td>
                          <DeleteWebsite id={s.id} productKey={key} />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="note">Links open in a new tab.</p>
        </>
      )}

      {tab === "changelog" && (
        <>
          <h2 className="sec">Change log — {product.name}</h2>
          {canLog && <LogProductChangeForm productKey={key} />}
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Tab</th>
                  <th>Change</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {(changes ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      Nothing recorded for this product yet.
                    </td>
                  </tr>
                ) : (
                  (changes ?? []).map((c) => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)" }}>
                        {new Date(c.created_at).toISOString().replace("T", " ").slice(0, 16)}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {c.tab ?? "—"}
                      </td>
                      <td>
                        {c.change_type && (
                          <span className="tag t-hi" style={{ marginRight: 5 }}>
                            {c.change_type}
                          </span>
                        )}
                        {c.description}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {c.created_by_email ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "mission" && (
        <>
          <h2 className="sec">Mission</h2>
          <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>
              {mission?.mission ?? "Not written yet."}
            </p>
          </div>
          <h2 className="sec">Values &amp; focus</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Value</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                {values.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ color: "var(--muted)" }}>
                      None recorded for this product.
                    </td>
                  </tr>
                ) : (
                  values.map((v, i) => (
                    <tr key={i}>
                      <td>
                        <b>{v.title}</b>
                      </td>
                      <td>{v.body}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="note">
            Product-specific, nested under the company{" "}
            <Link href="/hr/mission-values" className="crumb">
              Mission &amp; Values
            </Link>
            .
          </p>
        </>
      )}
    </OsShell>
  );
}
