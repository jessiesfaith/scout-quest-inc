import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { OsShell } from "../shell";

export const dynamic = "force-dynamic";

// Home — "a company built from modules", ported from the design.
const MODULES = [
  {
    href: "/it/identity-access",
    tone: "live",
    title: "IT",
    badge: { label: "Live", cls: "b-live" },
    body: "The agent platform, identity and access, and security tooling.",
    parts: ["Agent Platform", "Identity & access", "Security tooling"],
  },
  {
    href: "/hr/team",
    tone: "live",
    title: "HR",
    badge: { label: "Live", cls: "b-live" },
    body: "Team, contracts, mission and values, and the Constitution.",
    parts: ["Team", "HR Contracts", "Mission & Values", "Constitution"],
  },
  {
    href: "/security/change-management",
    tone: "live",
    title: "Security Tooling",
    badge: { label: "Live", cls: "b-live" },
    body: "Change classification and the append-only change log.",
    parts: ["Change Management", "Change Log"],
  },
  {
    href: "/products",
    tone: "live",
    title: "Products",
    badge: { label: "Live", cls: "b-live" },
    body: "Each product with its own plan board, build board, agents, website, and change log.",
    parts: ["Education", "Game", "Tutor", "Soundwiserx", "AI Bookmark"],
  },
  {
    href: null,
    tone: "soon",
    title: "Finance",
    badge: { label: "Planned", cls: "b-plan" },
    body: "AR and AP once entry begins.",
    parts: ["AR", "AP"],
  },
  {
    href: null,
    tone: "grow",
    title: "Projects",
    badge: { label: "Planned", cls: "b-plan" },
    body: "Cross-product projects.",
    parts: ["Roadmap"],
  },
];

export default async function HomePage() {
  const { supabase, email, isOwner } = await getViewer();

  const [{ count: members }, { count: reports }, { count: changes }] =
    await Promise.all([
      supabase.from("team_members").select("*", { count: "exact", head: true }),
      supabase
        .from("security_reports")
        .select("*", { count: "exact", head: true }),
      supabase.from("change_log").select("*", { count: "exact", head: true }),
    ]);

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[{ label: "Modules" }]}
      lead="Scout Quest Inc runs as a set of modules on one governed company OS — shared roles and access, an append-only change log, and every table behind row-level security."
    >
      <h2 className="sec">Scout Quest Inc — a company built from modules</h2>

      <div className="tiles" style={{ marginBottom: 22 }}>
        <div className="tile">
          <div className="n">{members ?? 0}</div>
          <div className="l">team members</div>
          <div className="s tealtx">HR › Team</div>
        </div>
        <div className="tile">
          <div className="n">{changes ?? 0}</div>
          <div className="l">change log entries</div>
          <div className="s tealtx">append-only</div>
        </div>
        <div className="tile">
          <div className="n">{reports ?? 0}</div>
          <div className="l">security reviews</div>
          <div className="s tealtx">IT › Zero-Day</div>
        </div>
      </div>

      <div className="modgrid">
        {MODULES.map((m) => {
          const inner = (
            <>
              <h3>
                {m.title}{" "}
                <span className={`badge ${m.badge.cls}`}>{m.badge.label}</span>
              </h3>
              <p>{m.body}</p>
              <div className="parts">
                {m.parts.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
              {m.href && <div className="open">Open →</div>}
            </>
          );
          return m.href ? (
            <Link
              key={m.title}
              href={m.href}
              className={`modcard ${m.tone} clickable`}
              style={{ display: "block", color: "inherit" }}
            >
              {inner}
            </Link>
          ) : (
            <div key={m.title} className={`modcard ${m.tone}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </OsShell>
  );
}
