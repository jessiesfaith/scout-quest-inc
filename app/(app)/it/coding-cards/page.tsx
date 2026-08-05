import { getViewer } from "@/lib/viewer";
import { getPermissions } from "@/lib/reachable";
import { OsShell } from "../../shell";
import { itNav, itCrumbHref } from "../nav";

export const dynamic = "force-dynamic";

// Coding Cards — a Paxel-style read of how the product actually gets built
// with AI coding agents. Every number is derived from its git history +
// Claude Code session transcripts (analysed locally).
type CardFace = { q: string; a: string; d: string };

const UPDATED = "2026-08-04";
const ARCHETYPE = {
  title: "The Architect",
  blurb:
    "You plan first, codify your decisions into durable agent-state memory, and build scaffolding that compounds. You don't pair with one agent — you run fleets: 36 multi-agent workflows spawning 788 subagent sessions, then you review the output and ship.",
};
const FACES: CardFace[] = [
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
];
const TOOLS = [
  "Bash · 8,137", "Read · 4,253", "Edit · 2,031", "Write · 1,377",
  "Grep · 1,144", "PowerShell · 877", "StructuredOutput · 814",
  "Preview-eval · 235", "Glob · 178", "Workflow · 40", "Browser · 112", "WebSearch · 59",
];
const PROS = [
  "Elite context engineering: agent-state memory + handoffs mean sessions compound instead of starting cold.",
  "Real verification discipline: browser preview-eval + adversarial multi-agent review caught real bugs, not vibe-shipped.",
  "High-leverage orchestration: 36 workflows and 788 subagents mean you scale yourself, not just your prompts.",
  "Decisive operating loop: terse approvals + continuous deploy = a genuinely tight ship into a live product.",
  "Security baked in early: RLS, audit logging, retention, anti-exfiltration - rare for a solo build, essential for K-12.",
];
const CONS = [
  "No automated safety net: no test suite, lint, or CI - regressions rely on you remembering to review.",
  "Giant single-file pages: student.html alone has 162 revisions; 100k-line files are hard to diff and edit safely.",
  "Bus factor of one: 455 of 456 commits are yours; the durable docs help, but knowledge is concentrated.",
  "Intense, late cadence: midnight peaks and 56-commit days are great for a sprint, a burnout risk over months.",
  "Terse prompts can under-specify: nearly half are under 10 words, occasionally leaving the agent to guess.",
];
const FORWARD = [
  "Add a thin test net: a few Playwright smoke tests + a deploy-time CI check, so reviews focus on logic not regressions.",
  "Codify the adversarial review as a reusable skill/command so every feature gets the same rigor automatically.",
  "Finish the Next.js consolidation (this app) to retire the giant HTML files - cleaner diffs and multi-agent edits.",
  "Track agent cost per feature so the fleet stays economical as the workflows scale.",
  "Append one-line acceptance criteria to terse prompts (“...and it must still pass X”) to cut re-work.",
];
const SOURCE =
  "Generated locally from git history (456 commits, May 19 - Jul 26 2026) + Claude Code transcripts (845 session files, Jun 20 - Aug 4 2026). Not YC's official Paxel output; nothing was sent to YC. Model names shown as they appear in the logs.";

export default async function CodingCardsPage() {
  const { email, isOwner } = await getViewer();
  const held = await getPermissions();

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "IT", href: itCrumbHref("/it/coding-cards", held) },
        { label: "Coding Cards" },
      ]}
      lead="How Scout Quest Education actually gets built with AI coding agents — every number derived from its git history and Claude Code session transcripts. A public copy also lives at /coding-cards.html."
      nav={itNav("/it/coding-cards", held)}
    >
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
          {ARCHETYPE.title}
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          {ARCHETYPE.blurb}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {FACES.map((f, i) => (
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
          {TOOLS.map((t, i) => (
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
          { label: "Pros", items: PROS, color: "var(--ok)" },
          { label: "Watch-outs", items: CONS, color: "var(--warn)" },
          { label: "Going forward", items: FORWARD, color: "var(--a)" },
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
        {SOURCE} Last analysed {UPDATED}.
      </p>
    </OsShell>
  );
}
