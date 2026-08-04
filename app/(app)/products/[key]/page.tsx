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
import { MissionValuesForm } from "../../hr/mission-values/form";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "plan", label: "Plan Board" },
  { id: "build", label: "Build Board" },
  { id: "agents", label: "Agents" },
  { id: "website", label: "Website" },
  { id: "changelog", label: "Change Log" },
  { id: "cards", label: "Coding Cards" },
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

// Coding Cards — a Paxel-style read of how each product actually gets built
// with AI coding agents. Keyed by product `key`; fill an entry once its
// session data has been analysed. Every number is derived from that product's
// git history + Claude Code session transcripts (analysed locally).
type CardFace = { q: string; a: string; d: string };
type ProductCards = {
  updated: string;
  archetype: { title: string; blurb: string };
  faces: CardFace[];
  tools: string[];
  pros: string[];
  cons: string[];
  forward: string[];
  source: string;
};

const CODING_CARDS: Record<string, ProductCards> = {
  education: {
    updated: "2026-08-04",
    archetype: {
      title: "The Architect",
      blurb:
        "You plan first, codify your decisions into durable agent-state memory, and build scaffolding that compounds. You don't pair with one agent — you run fleets: 36 multi-agent workflows spawning 788 subagent sessions, then you review the output and ship.",
    },
    faces: [
      { q: "Model you lean on", a: "Opus 5, almost always", d: "~68% of agent turns ran on Claude Opus 5. Opus 4.8 (14%), Fable 5 (13%) and Sonnet 5 (4%) filled the gaps." },
      { q: "Go-to prompt", a: "“approved”", d: "Your most-typed message (13x), just ahead of “done” (12) and “go” (11). You review, then release." },
      { q: "Most productive", a: "Night owl", d: "Over a third of commits land between 10 PM and 2 AM, peaking around midnight." },
      { q: "Prompt length", a: "Straight to the point", d: "Median 11 words; nearly half are under 10. The essays come only when it counts (top 10% run 170+ words)." },
      { q: "Politeness", a: "All business", d: "Across 293 prompts: zero thank-yous and exactly one “please.” Just the work." },
      { q: "Biggest crash-out", a: "You don't", d: "Not one all-caps message in 293 prompts. Your version of frustration is a calm re-scope." },
      { q: "Agents you run", a: "Fleets, not pairs", d: "36 workflows spawning 788 subagent sessions. One adversarial review fanned out to 55 agents at once." },
      { q: "How you verify", a: "In a real browser", d: "235 preview-eval runs + live browser automation to test 3D scenes a headless tab can't render, plus multi-agent review." },
      { q: "How you see your agent", a: "A team you manage", d: "Task lists, structured handoffs, durable agent-state, “pick up where last session left off.” Less tool, more org chart." },
      { q: "How much you shipped", a: "80,466 lines", d: "Across 456 commits in ~10 weeks, continuously deployed to a live product." },
      { q: "When you ship most", a: "Wednesdays", d: "115 commits on Wednesdays; your single biggest day was 56 commits on June 2." },
      { q: "Hands-on per session", a: "40 prompts, one sitting", d: "Your busiest session ran 40 back-and-forth turns without stopping." },
    ],
    tools: [
      "Bash · 8,137", "Read · 4,253", "Edit · 2,031", "Write · 1,377",
      "Grep · 1,144", "PowerShell · 877", "StructuredOutput · 814",
      "Preview-eval · 235", "Glob · 178", "Workflow · 40", "Browser · 112", "WebSearch · 59",
    ],
    pros: [
      "Elite context engineering: agent-state memory + handoffs mean sessions compound instead of starting cold.",
      "Real verification discipline: browser preview-eval + adversarial multi-agent review caught real bugs, not vibe-shipped.",
      "High-leverage orchestration: 36 workflows and 788 subagents mean you scale yourself, not just your prompts.",
      "Decisive operating loop: terse approvals + continuous deploy = a genuinely tight ship into a live product.",
      "Security baked in early: RLS, audit logging, retention, anti-exfiltration - rare for a solo build, essential for K-12.",
    ],
    cons: [
      "No automated safety net: no test suite, lint, or CI - regressions rely on you remembering to review.",
      "Giant single-file pages: student.html alone has 162 revisions; 100k-line files are hard to diff and edit safely.",
      "Bus factor of one: 455 of 456 commits are yours; the durable docs help, but knowledge is concentrated.",
      "Intense, late cadence: midnight peaks and 56-commit days are great for a sprint, a burnout risk over months.",
      "Terse prompts can under-specify: nearly half are under 10 words, occasionally leaving the agent to guess.",
    ],
    forward: [
      "Add a thin test net: a few Playwright smoke tests + a deploy-time CI check, so reviews focus on logic not regressions.",
      "Codify the adversarial review as a reusable skill/command so every feature gets the same rigor automatically.",
      "Finish the Next.js consolidation (this app) to retire the giant HTML files - cleaner diffs and multi-agent edits.",
      "Track agent cost per feature so the fleet stays economical as the workflows scale.",
      "Append one-line acceptance criteria to terse prompts (“...and it must still pass X”) to cut re-work.",
    ],
    source:
      "Generated locally from git history (456 commits, May 19 - Jul 26 2026) + Claude Code transcripts (845 session files, Jun 20 - Aug 4 2026). Not YC's official Paxel output; nothing was sent to YC. Model names shown as they appear in the logs.",
  },
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

  const [canBuild, canPlan, canSite, canLog, canMission] = await Promise.all([
    checkPerm("Products: Build Board"),
    checkPerm("Products: Plan Board"),
    checkPerm("Products: Website"),
    checkPerm("Products: Change Log"),
    checkPerm("Products: Mission & Values"),
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

      {tab === "mission" && canMission && (
        <>
          <MissionValuesForm
            scope={key}
            purpose={mission?.purpose ?? ""}
            mission={mission?.mission ?? ""}
            values={values}
          />
          <p className="note">
            Product-specific, nested under the company{" "}
            <Link href="/hr/mission-values" className="crumb">
              Mission &amp; Values
            </Link>
            .
          </p>
        </>
      )}

      {tab === "mission" && !canMission && (
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
            Read-only — editing needs the Products: Mission &amp; Values
            permission. Product-specific, nested under the company{" "}
            <Link href="/hr/mission-values" className="crumb">
              Mission &amp; Values
            </Link>
            .
          </p>
        </>
      )}

      {tab === "cards" &&
        (() => {
          const cc = CODING_CARDS[key];
          if (!cc) {
            return (
              <>
                <h2 className="sec">Coding Cards</h2>
                <p className="lead">
                  How this product actually gets built with AI coding agents.
                </p>
                <div className="card" style={{ padding: "16px 18px" }}>
                  <p style={{ margin: 0, color: "var(--muted)" }}>
                    No coding cards generated for {product.name} yet. Run the
                    local session analysis for this product to populate this tab.
                  </p>
                </div>
              </>
            );
          }
          return (
            <>
              <h2 className="sec">Coding Cards — {product.name}</h2>
              <p className="lead">
                How this product actually gets built with AI coding agents. Same
                format across every product; every number is real, derived from
                its git history and Claude Code session transcripts.
              </p>

              <div
                className="card"
                style={{ padding: "16px 18px", borderLeft: "4px solid var(--a)" }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  Archetype
                </div>
                <div style={{ fontSize: 24, fontWeight: 750, margin: "4px 0 6px" }}>
                  {cc.archetype.title}
                </div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
                  {cc.archetype.blurb}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                {cc.faces.map((f, i) => (
                  <div key={i} className="card" style={{ padding: "15px 16px" }}>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: ".07em",
                        textTransform: "uppercase",
                        color: "var(--a)",
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      {f.q}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 750,
                        lineHeight: 1.2,
                        marginBottom: 6,
                      }}
                    >
                      {f.a}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{f.d}</div>
                  </div>
                ))}
              </div>

              <h2 className="sec" style={{ marginTop: 20 }}>
                Toolchain, by call volume
              </h2>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cc.tools.map((t, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: "3px 9px",
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                        color: "var(--ink)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <h2 className="sec" style={{ marginTop: 20 }}>
                The honest read
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  { label: "Pros", items: cc.pros, color: "var(--ok)" },
                  { label: "Watch-outs", items: cc.cons, color: "var(--warn)" },
                  { label: "Going forward", items: cc.forward, color: "var(--a)" },
                ].map((col) => (
                  <div
                    key={col.label}
                    className="card"
                    style={{ padding: "14px 16px", borderTop: `3px solid ${col.color}` }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6, color: col.color }}>
                      {col.label}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {col.items.map((x, i) => (
                        <li
                          key={i}
                          style={{ fontSize: 13, margin: "7px 0", color: "var(--muted)", lineHeight: 1.5 }}
                        >
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="note">
                {cc.source} Last analysed {cc.updated}.
              </p>
            </>
          );
        })()}
    </OsShell>
  );
}
