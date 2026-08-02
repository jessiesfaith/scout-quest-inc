import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { OsShell } from "../shell";
import { Gantt, type PlanRow } from "./gantt";

export const dynamic = "force-dynamic";

type Product = { id: string; key: string; name: string; status: string };

// Badges mirror the design's product cards.
const BLURB: Record<string, { badge: string; cls: string; text: string; parts: string[] }> = {
  education: {
    badge: "Live",
    cls: "b-live",
    text: "The K-12 classroom learning product — surfaces, admin console, and the build tracker.",
    parts: ["Build Board", "Admin Console", "Student · Parent", "Teacher · District"],
  },
  game: {
    badge: "In design",
    cls: "b-ready",
    text: "The standalone game experience.",
    parts: ["Quests", "Labs", "Rewards"],
  },
  tutor: {
    badge: "In design",
    cls: "b-ready",
    text: "Direct-to-parent adaptive tutor — the wedge (parent and kid control panels).",
    parts: ["Parent panel", "Kid panel", "agent-tutor"],
  },
  soundwiserx: {
    badge: "Planned",
    cls: "b-ready",
    text: "Clinical speech product — PHI, local model only.",
    parts: ["agent-speech-eval", "Clinician review"],
  },
  "ai-bookmark": {
    badge: "Planned",
    cls: "b-ready",
    text: "Bookmark intelligence — consumer.",
    parts: ["agent-bookmark"],
  },
  other: {
    badge: "Portfolio",
    cls: "b-plan",
    text: "Other builds in the portfolio.",
    parts: ["Align (Fascia)", "Copilot pipeline"],
  },
};

const TONE: Record<string, string> = {
  education: "live",
  game: "soon",
  tutor: "soon",
  soundwiserx: "soon",
  "ai-bookmark": "soon",
  other: "portfolio",
};

// The design lists products in this order; `created_at` ties because the
// seed inserted them in one statement, so sort explicitly.
const ORDER = [
  "education",
  "game",
  "tutor",
  "soundwiserx",
  "ai-bookmark",
  "other",
];

export default async function ProductsPage() {
  const { supabase, email, isOwner } = await getViewer();

  const [{ data: products, error }, { data: plans, error: plansError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, key, name, status")
        .returns<Product[]>(),
      // Only top-level items become tasks under a product here; nesting
      // them further would list a task twice on the consolidated chart.
      supabase
        .from("plan_items")
        .select("id, product_id, title, start_date, end_date, status")
        .is("parent_id", null)
        .order("sort")
        .order("id")
        .returns<PlanRow[]>(),
    ]);

  const list = [...(products ?? [])].sort((a, b) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const nameById = new Map(list.map((p) => [p.id, p.name]));

  // Consolidated view: one bar per product spanning its plan items, with
  // those items as collapsible tasks underneath.
  const spans = new Map<string, PlanRow>();
  for (const row of plans ?? []) {
    if (!row.product_id) continue;
    const cur = spans.get(row.product_id);
    if (!cur) {
      spans.set(row.product_id, {
        id: row.product_id,
        title: nameById.get(row.product_id) ?? "",
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
        children: [row],
      });
      continue;
    }
    cur.children!.push(row);
    if (row.start_date && (!cur.start_date || row.start_date < cur.start_date))
      cur.start_date = row.start_date;
    if (row.end_date && (!cur.end_date || row.end_date > cur.end_date))
      cur.end_date = row.end_date;
    if (row.status === "live") cur.status = "live";
    else if (row.status === "building" && cur.status !== "live")
      cur.status = "building";
  }

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules", href: "/dashboard" }, { label: "Products" }]}
      lead="Each product is a sub-module with its own surfaces. Scout Quest Education is live today."
    >
      {error ? (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load products: {error.message}. Has migration 0003 been run?
        </p>
      ) : (
        <>
          <h2 className="sec">Products</h2>
          <div className="modgrid">
            {list.map((p) => {
              const b = BLURB[p.key] ?? {
                badge: p.status,
                cls: "b-reg",
                text: "",
                parts: [],
              };
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.key}`}
                  className={`modcard ${TONE[p.key] ?? "soon"} clickable`}
                  style={{ display: "block", color: "inherit" }}
                >
                  <h3>
                    {p.name} <span className={`badge ${b.cls}`}>{b.badge}</span>
                  </h3>
                  <p>{b.text}</p>
                  <div className="parts">
                    {b.parts.map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                  <div className="open">Open →</div>
                </Link>
              );
            })}
          </div>

          <h2 className="sec">Consolidated Gantt — all products</h2>
          {plansError ? (
            <p className="note" style={{ color: "var(--danger)" }}>
              Could not load plan items: {plansError.message}. This chart is
              not empty — it failed to load.
            </p>
          ) : (
            <Gantt
              rows={ORDER.map((k) =>
                spans.get(list.find((p) => p.key === k)?.id ?? ""),
              ).filter((r): r is PlanRow => Boolean(r))}
            />
          )}
        </>
      )}
    </OsShell>
  );
}
