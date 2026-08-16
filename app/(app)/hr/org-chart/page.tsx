import { getViewer } from "@/lib/viewer";
import { OsShell } from "../../shell";
import { hrNav } from "../nav";

export const dynamic = "force-dynamic";

// The company org chart. This is the *planned* organization — current
// leadership and team, the board and advisors, the proposed President/CBO
// cofounder, and the seats still open. It is a static, at-a-glance view;
// compensation and equity are deliberately kept in the confidential board
// brief and are not surfaced on this screen.

type NodeType =
  | "founder"
  | "proposed"
  | "team"
  | "board"
  | "advisor"
  | "open";

const NODE_STYLE: Record<
  NodeType,
  { border: string; dashed?: boolean; tagBg: string; tagColor: string; bg?: string }
> = {
  founder: { border: "var(--a)", tagBg: "var(--a-soft)", tagColor: "var(--a)" },
  proposed: {
    border: "var(--warn)",
    dashed: true,
    tagBg: "var(--warn-soft)",
    tagColor: "var(--warn)",
  },
  team: { border: "var(--b)", tagBg: "var(--b-soft)", tagColor: "var(--b)" },
  board: { border: "var(--core)", tagBg: "#e8ebf1", tagColor: "var(--core)" },
  advisor: { border: "var(--g)", tagBg: "var(--g-soft)", tagColor: "var(--g)" },
  open: {
    border: "var(--muted)",
    dashed: true,
    tagBg: "#eef1f5",
    tagColor: "var(--muted)",
    bg: "var(--bg)",
  },
};

function Node({
  type,
  role,
  who,
  tag,
}: {
  type: NodeType;
  role: React.ReactNode;
  who: string;
  tag: string;
}) {
  const s = NODE_STYLE[type];
  return (
    <div
      style={{
        background: s.bg ?? "var(--card)",
        border: `1.5px ${s.dashed ? "dashed" : "solid"} ${s.border}`,
        borderRadius: 11,
        padding: "11px 14px",
        width: 216,
        boxShadow: "0 1px 2px rgba(16,24,38,.05)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{role}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
        {who}
      </div>
      <span
        style={{
          display: "inline-block",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 20,
          marginTop: 8,
          background: s.tagBg,
          color: s.tagColor,
        }}
      >
        {tag}
      </span>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
          margin: "20px 0 10px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        {children}
      </div>
    </>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <i
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: color,
          border: dashed ? `1.5px dashed ${color}` : "1px solid rgba(0,0,0,.12)",
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

export default async function OrgChartPage() {
  const { email, isOwner } = await getViewer();

  return (
    <OsShell
      email={email}
      isOwner={isOwner}
      crumbs={[
        { label: "Modules", href: "/dashboard" },
        { label: "HR", href: "/hr/team" },
        { label: "Org Chart" },
      ]}
      nav={hrNav("/hr/org-chart")}
      lead="How Scout Quest Inc is organized — current leadership and team, the board and advisors, the proposed President / CBO cofounder, and the seats still open."
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          margin: "4px 0 18px",
          fontSize: 12.5,
          color: "var(--ink)",
        }}
      >
        <LegendItem color="var(--a)" label="Founder / CEO" />
        <LegendItem color="var(--b)" label="Current team" />
        <LegendItem color="var(--warn)" label="Proposed cofounder" dashed />
        <LegendItem color="var(--core)" label="Board member" />
        <LegendItem color="var(--g)" label="Advisor" />
        <LegendItem color="var(--muted)" label="Open seat" dashed />
      </div>

      <div className="card" style={{ padding: "20px 18px 26px" }}>
        <Row label="Board & Advisory">
          <Node
            type="board"
            role="Board Member — Mathematician"
            who="Governance; quantitative & psychometric rigor for assessment and adaptive-learning design"
            tag="Board"
          />
          <Node
            type="advisor"
            role="GTM Board Advisor"
            who="Commercial strategy; helps recruit & vet future revenue exec"
            tag="Advisor"
          />
          <Node
            type="advisor"
            role="VC Advisor"
            who="Fundraising guidance & investor access"
            tag="Advisor"
          />
        </Row>

        <Row label="Leadership">
          <Node
            type="founder"
            role="CEO — You"
            who="Vision, product, technical direction, fundraising lead"
            tag="Founder"
          />
          <Node
            type="proposed"
            role="President / Chief Business Officer"
            who="Physician partner — capital, partnerships, university & research pipeline"
            tag="Proposed cofounder"
          />
        </Row>

        <Row label="Team & functions">
          <Node
            type="team"
            role={
              <>
                CFO{" "}
                <span style={{ fontWeight: 500, color: "var(--muted)" }}>
                  (support)
                </span>
              </>
            }
            who="Finance, budgeting, financial modeling & fundraising support"
            tag="Current team"
          />
          <Node
            type="team"
            role="CTO"
            who="Enterprise architecture & scale, security/compliance"
            tag="Current team"
          />
          {/* CAIO is nowhere near as legible an acronym as CTO or CFO, so it
              is expanded beside itself using the same muted idiom the CFO
              node already uses. */}
          <Node
            type="team"
            role={
              <>
                CAIO{" "}
                <span style={{ fontWeight: 500, color: "var(--muted)" }}>
                  (Chief AI Officer)
                </span>
              </>
            }
            who="AI/ML build & product engineering"
            tag="Current team"
          />
          <Node
            type="team"
            role="Director, Education Business Operations"
            who="Buyer-side insight, district relationships, classroom implementation"
            tag="Current team"
          />
        </Row>

        <Row label="Open seats">
          <Node
            type="open"
            role="Head of Learning & Efficacy"
            who="Owns outcomes & evidence — proof that the product improves learning"
            tag="Open · advisor or early hire"
          />
          <Node
            type="open"
            role="VP Sales / CRO"
            who="Operational revenue engine — the repeatable sales motion"
            tag="Open · future hire"
          />
        </Row>
      </div>

      <p className="note" style={{ color: "var(--muted)", marginTop: 12 }}>
        Planned organization view. Compensation and equity are held in the
        confidential board brief and are not shown here.
      </p>
    </OsShell>
  );
}
