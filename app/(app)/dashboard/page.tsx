import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { getPermissions, can } from "@/lib/reachable";
import { OsShell } from "../shell";

export const dynamic = "force-dynamic";

// Home — "a company built from modules", from the design.
//
// A module lists its screens as `doors`: the first one the viewer can open
// becomes the card's link. Landing on a page that immediately redirects is
// the thing this replaces, so a door's `needs` must match the gate on the
// page it points at. `needs: []` means any signed-in member with a role.
type Door = { href: string; needs: string[] };

const MODULES: {
  tone: string;
  title: string;
  badge: { label: string; cls: string };
  body: string;
  parts: string[];
  doors: Door[];
}[] = [
  {
    tone: "live",
    title: "HR",
    badge: { label: "Live", cls: "b-live" },
    body: "People and teams, contracts, mission and values, and the Constitution.",
    parts: ["Team", "Org Chart", "HR Contracts", "Mission & Values", "Constitution"],
    doors: [{ href: "/hr/team", needs: [] }],
  },
  {
    tone: "live",
    title: "IT",
    badge: { label: "Live", cls: "b-live" },
    body: "The systems that run the company — including the agent platform.",
    parts: ["Agent Platform", "Infrastructure", "Identity & access", "Zero-Day"],
    doors: [
      { href: "/it/identity-access", needs: ["IT: Identity & Access"] },
      { href: "/it/agent-platform", needs: ["IT: Agent Platform"] },
      { href: "/it/access-requests", needs: ["HR: Team"] },
      { href: "/it/infrastructure", needs: [] },
    ],
  },
  {
    tone: "live",
    title: "Products",
    badge: { label: "Live", cls: "b-live" },
    body: "Each product with its plan board, build board, agents, website and change log.",
    parts: ["Education", "Game", "Tutor", "Soundwiserx", "AI Bookmark"],
    doors: [{ href: "/products", needs: [] }],
  },
  {
    tone: "live",
    title: "Security Tooling",
    badge: { label: "Live", cls: "b-live" },
    body: "Change classification and the append-only change log.",
    parts: ["Change Management", "Change Log"],
    doors: [
      {
        href: "/security/change-management",
        needs: ["Security Tooling: Change Management"],
      },
      { href: "/security/change-log", needs: [] },
    ],
  },
  {
    tone: "live",
    title: "Contracts",
    badge: { label: "Live", cls: "b-live" },
    body: "Every agreement in one place, tied to compliance obligations.",
    parts: ["NDAs", "DPAs / BAAs", "District agreements", "Vendors"],
    doors: [
      {
        href: "/contracts",
        needs: [
          "Contracts",
          "HR: HR Contracts",
          "Security Tooling: Change Management",
        ],
      },
    ],
  },
  {
    tone: "live",
    title: "Projects",
    badge: { label: "Live", cls: "b-live" },
    body: "Cross-product work with its own schedule.",
    parts: ["Schedule", "Status"],
    doors: [{ href: "/projects", needs: [] }],
  },
  {
    tone: "portfolio",
    title: "Departments",
    badge: { label: "Expanding", cls: "b-plan" },
    body: "Each department becomes a module with its own roles, teams, and agents.",
    parts: ["Product & Design", "Engineering", "Security & Compliance"],
    doors: [{ href: "/departments", needs: [] }],
  },
  {
    tone: "live",
    title: "Finance",
    badge: { label: "Live", cls: "b-live" },
    body: "An invoice register: what customers owe, what the company owes, and what is overdue.",
    parts: ["AR — receivable", "AP — payable", "Payments"],
    doors: [{ href: "/finance", needs: ["Finance: AR", "Finance: AP"] }],
  },
];

export default async function HomePage() {
  const { supabase, email, isOwner } = await getViewer();
  const held = await getPermissions();

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
          const door = m.doors.find(
            (d) => d.needs.length === 0 || can(held, ...d.needs),
          );
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
              {door ? (
                <div className="open">Open →</div>
              ) : (
                <div className="open" style={{ color: "var(--muted)" }}>
                  Needs {m.doors[0].needs[0]}
                </div>
              )}
            </>
          );

          return door ? (
            <Link
              key={m.title}
              href={door.href}
              className={`modcard ${m.tone} clickable`}
              style={{ display: "block", color: "inherit" }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={m.title}
              className={`modcard ${m.tone}`}
              style={{ opacity: 0.65 }}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </OsShell>
  );
}
