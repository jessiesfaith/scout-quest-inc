import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { getPermissions } from "@/lib/reachable";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";

export const dynamic = "force-dynamic";

type Product = { key: string; name: string; status: string };
type CardFace = { q: string; a: string; d: string };
type Deck = {
  updated: string;
  archetype: { title: string; blurb: string };
  faces: CardFace[];
  tools: string[];
  pros: string[];
  cons: string[];
  forward: string[];
  source: string;
};

// Per-product coding cards — a Paxel-style read of how each product actually
// gets built with AI coding agents. Add an entry keyed by the product's `key`
// once its git history + Claude Code transcripts have been analysed locally.
// Every number is derived from that product's own history.
const CODING_CARDS: Record<string, Deck> = {
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

// The product to show when the URL names none. Fallback order if the
// products table can't be read (mirrors the Products module order).
const DEFAULT_KEY = "education";
const ORDER = ["education", "game", "tutor", "soundwiserx", "ai-bookmark", "other"];

export default async function CodingCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();
  const { product: rawProduct } = await searchParams;

  const { data: products, error } = await supabase
    .from("products")
    .select("key, name, status")
    .returns<Product[]>();

  const list = [...(products ?? [])].sort((a, b) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Pick the URL's product if it's real, else the default, else the first one.
  const selected =
    (rawProduct && list.some((p) => p.key === rawProduct) && rawProduct) ||
    (list.some((p) => p.key === DEFAULT_KEY) ? DEFAULT_KEY : list[0]?.key) ||
    DEFAULT_KEY;

  const selectedName =
    list.find((p) => p.key === selected)?.name ?? "this product";
  const cc = CODING_CARDS[selected];

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/it/coding-cards", held) },
        { label: "Coding Cards" },
      ]}
      lead="How each product actually gets built with AI coding agents — every number derived from its git history and Claude Code session transcripts. Pick a product below. A public copy of the Scout Quest Education deck also lives at /coding-cards.html."
      nav={itNav("/it/coding-cards", held)}
    >
      {error && (
        <p className="note" style={{ color: "var(--danger)" }}>
          Could not load the product list: {error.message}.
        </p>
      )}

      {/* One button per product; the dot marks which ones have cards yet. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {list.map((p) => {
          const on = p.key === selected;
          const hasData = Boolean(CODING_CARDS[p.key]);
          return (
            <Link
              key={p.key}
              href={`/it/coding-cards?product=${p.key}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 13px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: `1px solid ${on ? "var(--a)" : "var(--line)"}`,
                background: on ? "var(--a)" : "var(--card)",
                color: on ? "#fff" : "var(--ink)",
              }}
            >
              {p.name}
              <span
                title={hasData ? "Cards ready" : "No cards yet"}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: hasData
                    ? on
                      ? "#fff"
                      : "var(--ok)"
                    : "var(--line)",
                  opacity: hasData ? 1 : 0.9,
                }}
              />
            </Link>
          );
        })}
      </div>

      {!cc ? (
        <div className="card" style={{ padding: "16px 18px" }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No coding cards generated for <b>{selectedName}</b> yet. Run the
            local session analysis for this product to populate its cards — it
            will then appear here just like Scout Quest Education.
          </p>
        </div>
      ) : (
        <>
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
              Archetype · {selectedName}
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
      )}
    </OsShell>
  );
}
