import Link from "next/link";
import "./os.css";
import "./os-extra.css";

// The Company OS shell, ported from design/agent_platform_dashboard.html.
// The design is a single page that shows/hides `.screen` divs; here each
// screen is a route, so the breadcrumb trail is passed in per page.

export type Crumb = { label: string; href?: string };

export type SubNavItem = { label: string; href: string; on?: boolean };

export function OsShell({
  email,
  isOwner,
  crumbs,
  lead,
  nav,
  children,
}: {
  email: string;
  isOwner: boolean;
  crumbs: Crumb[];
  lead?: string;
  /** Sibling screens within the same module. */
  nav?: SubNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="os" style={{ minHeight: "100vh" }}>
      <div className="top">
        {/* The company mark returns to the public marketing site. */}
        <Link
          href="/"
          className="navlink"
          title="View the public Scout Quest Inc site"
          style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg,#16b8a6,#0f766e)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"
                fill="#04211d"
              />
            </svg>
          </span>
          <h1 style={{ color: "#eef2f7" }}>Scout Quest Inc — Company OS</h1>
        </Link>
        <span className="dot" aria-hidden="true" />
        <span className="pill">Live</span>
        {/* The signed-in identity doubles as the way into your own
            account settings — two-factor and recovery codes. */}
        <Link
          href="/account/security"
          className="who"
          title="Your account security"
          style={{ textDecoration: "none" }}
        >
          {email}
          {isOwner && " · Owner"}
        </Link>
        <form action="/auth/signout" method="post" style={{ marginLeft: 12 }}>
          <button
            type="submit"
            className="navlink"
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 8,
              padding: "6px 12px",
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="wrap">
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} style={{ display: "contents" }}>
              {i > 0 && <span className="sep">›</span>}
              {c.href ? (
                <Link href={c.href} className="crumb">
                  {c.label}
                </Link>
              ) : (
                <span className="crumb cur">{c.label}</span>
              )}
            </span>
          ))}
        </div>
        {nav && nav.length > 0 && (
          <div className="i2nav">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`i2tab${n.on ? " on" : ""}`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
