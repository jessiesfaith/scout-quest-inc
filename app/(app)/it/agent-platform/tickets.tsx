import Link from "next/link";

// Tickets — the defect record, and the trace behind each one.
//
// Two screens behind one tab:
//   board   every ticket, filterable by status and type, with the counts
//           that answer "what is outstanding?" before the detail
//   trace   one ticket, its evidence, its status history, and every
//           governance object it touches — Constitution clause, context
//           pack, agent, work order, migration, commit — each a working
//           link where the OS has a screen for it
//
// What a ticket is (and is not) is defined in
// docs/governance/WORK_ORDERS_VS_TICKETS.md. This screen renders that
// definition; it does not restate it.

export type Ticket = {
  id: string;
  ref: string;
  title: string;
  detail: string | null;
  type: string;
  severity: string;
  status: string;
  source: string | null;
  found_at: string | null;
  found_by: string | null;
  fix_commit: string | null;
  fix_migration: string | null;
  fixed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verified_how: string | null;
  accepted_reason: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketLink = {
  ticket_id: string;
  kind: string;
  ref: string;
  note: string | null;
};

export type TicketEvent = {
  ticket_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  actor_email: string | null;
  created_at: string;
};

const GITHUB = "https://github.com/jessiesfaith/scout-quest-inc/blob/master/";
const GITHUB_COMMIT = "https://github.com/jessiesfaith/scout-quest-inc/commit/";

// Order carries meaning here: it is roughly "how much does this need me".
export const STATUSES = [
  "open",
  "in-progress",
  "unverified",
  "fixed",
  "verified",
  "accepted-risk",
  "rejected",
] as const;

export const TYPES = [
  "incident",
  "security",
  "break-fix",
  "honesty",
  "maintenance",
  "governance-drift",
  "docs",
] as const;

const STATUS_TAG: Record<string, string> = {
  open: "t-lo",
  "in-progress": "t-med",
  unverified: "t-med",
  fixed: "t-med",
  verified: "t-hi",
  "accepted-risk": "t-hi",
  rejected: "t-hi",
};

const SEV_TAG: Record<string, string> = { high: "t-lo", medium: "t-med", low: "t-hi" };

const TYPE_BADGE: Record<string, string> = {
  incident: "b-reg",
  security: "b-reg",
  "break-fix": "b-ready",
  honesty: "b-plan",
  maintenance: "b-plan",
  "governance-drift": "b-plan",
  docs: "b-plan",
};

const KIND_LABEL: Record<string, string> = {
  constitution: "Constitution",
  ctx: "Context pack",
  agent: "Agent",
  work_order: "Work order",
  report: "Review",
  migration: "Migration",
  commit: "Commit",
  file: "File",
};

// The trace reads top-down in governance order, whatever order the links
// were inserted in.
const KIND_ORDER = ["constitution", "ctx", "agent", "work_order", "report", "migration", "commit", "file"];

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";

/**
 * Where a linked thing lives in the OS. Returns null when there is no
 * screen for it — the trace then shows the reference as text rather than
 * inventing a dead link.
 */
export function linkHref(
  kind: string,
  ref: string,
  woIdByCode: Map<string, string>,
): { href: string; external: boolean } | null {
  switch (kind) {
    case "ctx":
      return { href: `/it/agent-platform?tab=context&ctx=${encodeURIComponent(ref)}`, external: false };
    case "agent":
      return {
        href: `/it/agent-platform?tab=tree&view=map&agent=${encodeURIComponent(ref)}`,
        external: false,
      };
    case "work_order": {
      const id = woIdByCode.get(ref);
      return id ? { href: `/it/agent-platform?tab=wos&wo=${encodeURIComponent(id)}`, external: false } : null;
    }
    case "constitution":
      return { href: "/hr/constitution", external: false };
    case "report":
      return { href: "/it/zero-day", external: false };
    case "migration": {
      // Refs are the four-digit number; the file carries a suffix. GitHub's
      // tree view is the closest thing to a stable link that survives it.
      return {
        href: `https://github.com/jessiesfaith/scout-quest-inc/tree/master/supabase/migrations`,
        external: true,
      };
    }
    case "commit":
      return /^[0-9a-f]{7,40}$/.test(ref) && ref !== "demo-commit"
        ? { href: `${GITHUB_COMMIT}${ref}`, external: true }
        : null;
    case "file":
      return { href: `${GITHUB}${ref}`, external: true };
    default:
      return null;
  }
}

function TicketRef({ t }: { t: Ticket }) {
  return (
    <Link href={`/it/agent-platform?tab=tickets&tck=${t.ref}`} className="crumb">
      <code>{t.ref}</code>
    </Link>
  );
}

// ---------- board ----------

export function TicketBoard({
  tickets,
  status,
  type,
  showDemo,
  nowMs,
}: {
  tickets: Ticket[];
  status: string | null;
  type: string | null;
  showDemo: boolean;
  /** Server clock at render, so "age" is computed once, not per render. */
  nowMs: number;
}) {
  const real = tickets.filter((t) => !t.is_demo);
  const demoCount = tickets.length - real.length;
  const base = showDemo ? tickets : real;

  const counts = {
    open: base.filter((t) => t.status === "open" || t.status === "in-progress").length,
    openHigh: base.filter(
      (t) => (t.status === "open" || t.status === "in-progress") && t.severity === "high",
    ).length,
    unverified: base.filter((t) => t.status === "unverified").length,
    fixedNotVerified: base.filter((t) => t.status === "fixed").length,
    verified: base.filter((t) => t.status === "verified").length,
  };

  // Age of the oldest open high, in days. Risk that is invisible on the
  // home screen is not being managed.
  const oldestHigh = base
    .filter((t) => (t.status === "open" || t.status === "in-progress") && t.severity === "high")
    .map((t) => t.found_at ?? t.created_at)
    .sort()[0];
  const oldestDays = oldestHigh
    ? Math.floor((nowMs - new Date(oldestHigh).getTime()) / 86_400_000)
    : null;

  const shown = base
    .filter((t) => !status || t.status === status)
    .filter((t) => !type || t.type === type)
    .sort((a, b) => {
      const s = STATUSES.indexOf(a.status as never) - STATUSES.indexOf(b.status as never);
      if (s !== 0) return s;
      const sev = ["high", "medium", "low"];
      const v = sev.indexOf(a.severity) - sev.indexOf(b.severity);
      if (v !== 0) return v;
      return a.ref.localeCompare(b.ref);
    });

  const q = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    p.set("tab", "tickets");
    const s = "status" in over ? over.status : status;
    const ty = "type" in over ? over.type : type;
    const d = "demo" in over ? over.demo : showDemo ? "1" : null;
    if (s) p.set("status", s);
    if (ty) p.set("type", ty);
    if (d) p.set("demo", d);
    return `/it/agent-platform?${p.toString()}`;
  };

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="n" style={{ color: counts.openHigh ? "var(--danger)" : "var(--ok)" }}>
            {counts.openHigh}
          </div>
          <div className="l">open · high</div>
          <div className="s tealtx">
            {oldestDays === null
              ? "none outstanding"
              : oldestDays === 0
                ? "oldest opened today"
                : `oldest is ${oldestDays}d old`}
          </div>
        </div>
        <div className="tile">
          <div className="n">{counts.open}</div>
          <div className="l">open · all severities</div>
          <div className="s tealtx">confirmed, not yet fixed</div>
        </div>
        <div className="tile">
          <div className="n" style={{ color: counts.unverified ? "var(--warn)" : "var(--ok)" }}>
            {counts.unverified}
          </div>
          <div className="l">unverified</div>
          <div className="s tealtx">raised, never confirmed or refuted</div>
        </div>
        <div className="tile">
          <div className="n" style={{ color: counts.fixedNotVerified ? "var(--warn)" : "var(--ok)" }}>
            {counts.fixedNotVerified}
          </div>
          <div className="l">fixed, awaiting evidence</div>
          <div className="s tealtx">{counts.verified} verified</div>
        </div>
      </div>

      <div className="tkfilters">
        <span className="tkfl">Status</span>
        <Link href={q({ status: null })} className={`chip${!status ? " on" : ""}`}>
          all
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={q({ status: s })} className={`chip${status === s ? " on" : ""}`}>
            {s}
          </Link>
        ))}
      </div>
      <div className="tkfilters">
        <span className="tkfl">Type</span>
        <Link href={q({ type: null })} className={`chip${!type ? " on" : ""}`}>
          all
        </Link>
        {TYPES.map((t) => (
          <Link key={t} href={q({ type: t })} className={`chip${type === t ? " on" : ""}`}>
            {t}
          </Link>
        ))}
        <Link
          href={`/it/agent-platform?tab=tickets&view=register${showDemo ? "&demo=1" : ""}`}
          className="chip"
          style={{ marginLeft: "auto" }}
          title="Every ticket with what is wrong and what was done, printed in full."
        >
          register ↓
        </Link>
        {demoCount > 0 && (
          <Link
            href={q({ demo: showDemo ? null : "1" })}
            className={`chip${showDemo ? " on" : ""}`}
            title="Demo tickets exercise the trace with placeholder evidence. They are flagged in the database and removable in one statement."
          >
            {showDemo ? "hiding demo" : `show ${demoCount} demo`}
          </Link>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Type</th>
              <th>Sev</th>
              <th>Status</th>
              <th>Found</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--muted)" }}>
                  {tickets.length === 0
                    ? "No tickets recorded. Run migrations 0024 and 0025."
                    : "Nothing matches these filters."}
                </td>
              </tr>
            ) : (
              shown.map((t) => (
                <tr key={t.id} style={t.is_demo ? { opacity: 0.7 } : undefined}>
                  <td>
                    <TicketRef t={t} />
                    {t.is_demo && (
                      <div>
                        <span className="tag t-med" style={{ fontSize: 10 }}>demo</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <b>{t.title}</b>
                  </td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[t.type] ?? "b-reg"}`}>{t.type}</span>
                  </td>
                  <td>
                    <span className={`tag ${SEV_TAG[t.severity] ?? "t-med"}`}>{t.severity}</span>
                  </td>
                  <td>
                    <span className={`tag ${STATUS_TAG[t.status] ?? "t-med"}`}>{t.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {day(t.found_at ?? t.created_at)}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {t.status === "verified" ? (
                      <span style={{ color: "var(--ok)" }}>observed</span>
                    ) : t.status === "fixed" ? (
                      <span style={{ color: "var(--warn)" }}>
                        {t.fix_migration ? `migration ${t.fix_migration}` : t.fix_commit ? `commit ${t.fix_commit.slice(0, 7)}` : "change named"}
                        , not yet observed
                      </span>
                    ) : t.status === "accepted-risk" ? (
                      <span style={{ color: "var(--muted)" }}>reason recorded</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="note">
        <b>fixed</b> means a change is written and named. <b>verified</b> means
        someone observed it working — the database refuses that status without a
        record of what was observed. The two are separate because on 2026-08-16
        they were not, and it mattered: a migration fixed a live leak and carried
        a self-check that could never run, printing the same reassuring notice
        either way. See{" "}
        <a
          href={`${GITHUB}docs/governance/WORK_ORDERS_VS_TICKETS.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="crumb"
        >
          Work Orders vs Tickets ↗
        </a>
        .
      </p>
    </>
  );
}

// ---------- trace ----------

export function TicketTrace({
  ticket,
  links,
  events,
  woIdByCode,
  agentIds,
  ctxIds,
}: {
  ticket: Ticket;
  links: TicketLink[];
  events: TicketEvent[];
  woIdByCode: Map<string, string>;
  agentIds: Set<string>;
  ctxIds: Set<string>;
}) {
  const t = ticket;
  const grouped = new Map<string, TicketLink[]>();
  for (const l of links) {
    const arr = grouped.get(l.kind) ?? [];
    arr.push(l);
    grouped.set(l.kind, arr);
  }
  const kinds = [...grouped.keys()].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>
        <Link href="/it/agent-platform?tab=tickets" className="crumb">
          ← all tickets
        </Link>
      </p>

      <div className="card" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ fontSize: 15, fontWeight: 700 }}>{t.ref}</code>
          <span className={`badge ${TYPE_BADGE[t.type] ?? "b-reg"}`}>{t.type}</span>
          <span className={`tag ${SEV_TAG[t.severity] ?? "t-med"}`}>{t.severity}</span>
          <span className={`tag ${STATUS_TAG[t.status] ?? "t-med"}`}>{t.status}</span>
          {t.is_demo && (
            <span className="tag t-med" title="Placeholder evidence — exercises the trace only">
              demo
            </span>
          )}
        </div>
        <h2 className="sec" style={{ marginTop: 10, marginBottom: 8, textTransform: "none", letterSpacing: 0, fontSize: 17 }}>
          {t.title}
        </h2>
        {t.detail && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{t.detail}</p>}
      </div>

      <div className="tkgrid">
        <div>
          <h2 className="sec">Trace</h2>
          <div className="card">
            {kinds.length === 0 ? (
              <p className="note" style={{ padding: "12px 16px", margin: 0 }}>
                Nothing linked. A ticket found by reading code often has no work
                order — that blank is honest, not missing.
              </p>
            ) : (
              <table>
                <tbody>
                  {kinds.map((kind) => (
                    <tr key={kind}>
                      <td style={{ width: 130, color: "var(--muted)", fontSize: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {KIND_LABEL[kind] ?? kind}
                      </td>
                      <td>
                        {(grouped.get(kind) ?? []).map((l) => {
                          const target = linkHref(kind, l.ref, woIdByCode);
                          // A link the OS cannot resolve is shown, not hidden —
                          // and marked, so nobody mistakes it for a live one.
                          const dangling =
                            (kind === "agent" && !agentIds.has(l.ref)) ||
                            (kind === "ctx" && !ctxIds.has(l.ref)) ||
                            (kind === "work_order" && !woIdByCode.has(l.ref));
                          const label = kind === "constitution" ? `§${l.ref}` : l.ref;
                          return (
                            <div key={l.ref} style={{ marginBottom: 5 }}>
                              {target && !dangling ? (
                                target.external ? (
                                  <a href={target.href} target="_blank" rel="noopener noreferrer" className="crumb">
                                    <code>{label}</code> ↗
                                  </a>
                                ) : (
                                  <Link href={target.href} className="crumb">
                                    <code>{label}</code>
                                  </Link>
                                )
                              ) : (
                                <code title={dangling ? "Referenced, but no such record exists in the OS today" : "No screen for this yet"}>
                                  {label}
                                </code>
                              )}
                              {dangling && (
                                <span className="tag t-med" style={{ marginLeft: 6, fontSize: 10 }}>
                                  not in OS
                                </span>
                              )}
                              {l.note && (
                                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{l.note}</span>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="sec">History</h2>
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <td style={{ width: 130, color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>Found</td>
                  <td style={{ fontSize: 13 }}>
                    {stamp(t.found_at)}
                    {t.found_by && <div style={{ fontSize: 12, color: "var(--muted)" }}>by {t.found_by}</div>}
                    {t.source && <div style={{ fontSize: 12, color: "var(--muted)" }}>source: {t.source}</div>}
                  </td>
                </tr>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{day(e.created_at)}</td>
                    <td style={{ fontSize: 13 }}>
                      {e.from_status ? (
                        <>
                          <span className={`tag ${STATUS_TAG[e.from_status] ?? "t-med"}`}>{e.from_status}</span>{" "}
                          →{" "}
                        </>
                      ) : null}
                      <span className={`tag ${STATUS_TAG[e.to_status] ?? "t-med"}`}>{e.to_status}</span>
                      {e.actor_email && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{e.actor_email}</span>
                      )}
                      {e.note && <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.note}</div>}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ fontSize: 12, color: "var(--muted)" }}>
                      No status changes since it was filed. Every change is
                      recorded by a database trigger and cannot be edited afterwards.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="sec">Evidence</h2>
          <div className="card" style={{ padding: "12px 16px" }}>
            <dl className="tkdl">
              <dt>Fix</dt>
              <dd>
                {t.fix_migration || t.fix_commit ? (
                  <>
                    {t.fix_migration && <div>migration <code>{t.fix_migration}</code></div>}
                    {t.fix_commit && (
                      <div>
                        commit{" "}
                        {linkHref("commit", t.fix_commit, woIdByCode) ? (
                          <a href={linkHref("commit", t.fix_commit, woIdByCode)!.href} target="_blank" rel="noopener noreferrer" className="crumb">
                            <code>{t.fix_commit.slice(0, 7)}</code> ↗
                          </a>
                        ) : (
                          <code>{t.fix_commit}</code>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{stamp(t.fixed_at)}</div>
                  </>
                ) : (
                  <span style={{ color: "var(--muted)" }}>none recorded</span>
                )}
              </dd>

              <dt>Verified</dt>
              <dd>
                {t.status === "verified" ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {stamp(t.verified_at)}
                      {t.verified_by && ` · ${t.verified_by}`}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 13, whiteSpace: "pre-wrap" }}>{t.verified_how}</div>
                  </>
                ) : t.status === "fixed" ? (
                  <span style={{ color: "var(--warn)" }}>
                    Not yet. A change is named above; nobody has recorded observing it work.
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>—</span>
                )}
              </dd>

              {t.status === "accepted-risk" && (
                <>
                  <dt>Accepted because</dt>
                  <dd style={{ fontSize: 13 }}>{t.accepted_reason}</dd>
                </>
              )}
            </dl>
          </div>
          <p className="note" style={{ fontSize: 12 }}>
            Evidence records what was <b>observed</b> — a command run, a response
            code, a query result — not that someone believes the fix works.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------- register ----------
// Every ticket, what is wrong, and what was done about it — read verbatim
// from the record, so this is the board printed rather than a summary of
// it. Grouped by status (worst first), then severity, then ref. The
// solution box is honest about its own absence: an unverified claim has
// no solution because writing one would invent a fix for something that
// may not exist.

const REGISTER_ORDER = ["verified", "fixed", "in-progress", "open", "unverified", "accepted-risk", "rejected"] as const;
const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const REGISTER_SECTIONS: { status: string; title: string; intro: string | null }[] = [
  {
    status: "verified",
    title: "Verified — real, fixed, and proven",
    intro:
      "Each was found by a review, independently confirmed by a second agent told to disprove it, fixed, and then observed working. The observation is the solution text.",
  },
  {
    status: "fixed",
    title: "Fixed — awaiting evidence",
    intro:
      "The change is written and named. Kept separate from verified on purpose: on 2026-08-16 a migration fixed a live leak and carried a self-check that could never run, printing the same reassuring notice either way. Fixed is a claim; verified is an observation.",
  },
  { status: "in-progress", title: "In progress", intro: null },
  { status: "open", title: "Open — confirmed, not yet fixed", intro: null },
  {
    status: "unverified",
    title: "Unverified — raised, never checked",
    intro:
      "Claims from a review that hit a usage limit before its verifiers ran. Each names a file and line. In completed reviews roughly a third to a half of such claims are rejected on trace, so expect a similar split here. Until checked, they are neither defects nor dismissed.",
  },
  {
    status: "accepted-risk",
    title: "Accepted risk",
    intro: "Real, and deliberately not being fixed. The reason is recorded on each — an unexplained accepted risk is indistinguishable from a forgotten one.",
  },
  {
    status: "rejected",
    title: "Rejected — investigated and found not real",
    intro:
      "Kept, not deleted. What was considered and dropped is part of the record, and the ratio of rejected to confirmed is the evidence that verification does work.",
  },
];

function fixRefOf(t: Ticket) {
  return t.fix_migration ? `migration ${t.fix_migration}` : t.fix_commit ? `commit ${t.fix_commit.slice(0, 7)}` : null;
}

function RegisterCard({ t }: { t: Ticket }) {
  const fix = fixRefOf(t);
  return (
    <div className={`rgcard rg-${t.severity}`} id={t.ref}>
      <div className="rghead">
        <TicketRef t={t} />
        <span className={`badge ${TYPE_BADGE[t.type] ?? "b-reg"}`}>{t.type}</span>
        <span className={`tag ${SEV_TAG[t.severity] ?? "t-med"}`}>{t.severity}</span>
        <span className={`tag ${STATUS_TAG[t.status] ?? "t-med"}`}>{t.status}</span>
        {t.is_demo && <span className="tag t-med">demo</span>}
        <span className="rgtitle">{t.title}</span>
      </div>

      <div className="rglbl">What is wrong</div>
      <p className="rgp">{t.detail ?? <span className="rgnone">No detail recorded.</span>}</p>

      {t.status === "verified" ? (
        <>
          <div className="rglbl rg-ok">Solution — fixed in {fix ?? "—"}, and observed working</div>
          <p className="rgp">{t.verified_how}</p>
          {(t.verified_by || t.verified_at) && (
            <div className="rgmeta">
              {t.verified_at ? stamp(t.verified_at) : ""}
              {t.verified_by ? ` · ${t.verified_by}` : ""}
            </div>
          )}
        </>
      ) : t.status === "fixed" ? (
        <>
          <div className="rglbl rg-warn">Solution — fixed in {fix ?? "—"}</div>
          <p className="rgp rgnone">
            Change is written and named. Nobody has yet recorded observing it work, so it is not verified.
          </p>
        </>
      ) : t.status === "accepted-risk" ? (
        <>
          <div className="rglbl">Not being fixed, because</div>
          <p className="rgp">{t.accepted_reason}</p>
        </>
      ) : t.status === "rejected" ? (
        <>
          <div className="rglbl">Outcome</div>
          <p className="rgp rgnone">Investigated and found not to be a real defect. Kept for the record.</p>
        </>
      ) : t.status === "unverified" ? (
        <>
          <div className="rglbl">Solution</div>
          <p className="rgp rgnone">
            None yet — this claim has not been confirmed or refuted. Verify before acting; do not assume it is false.
          </p>
        </>
      ) : (
        <>
          <div className="rglbl rg-warn">Solution</div>
          <p className="rgp rgnone">Confirmed real. Not fixed yet.</p>
        </>
      )}
    </div>
  );
}

export function TicketRegister({ tickets, showDemo }: { tickets: Ticket[]; showDemo: boolean }) {
  const real = tickets.filter((t) => !t.is_demo);
  const demo = tickets.filter((t) => t.is_demo);
  const sorted = [...real].sort(
    (a, b) =>
      REGISTER_ORDER.indexOf(a.status as never) - REGISTER_ORDER.indexOf(b.status as never) ||
      (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) ||
      a.ref.localeCompare(b.ref),
  );
  const counts: Record<string, number> = {};
  for (const t of real) counts[t.status] = (counts[t.status] ?? 0) + 1;

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>
        <Link href="/it/agent-platform?tab=tickets" className="crumb">
          ← board
        </Link>{" "}
        · Every ticket, what is wrong, and what was done about it. Text is the
        ticket record itself — <em>what is wrong</em> is its detail, <em>solution</em> is
        its recorded evidence — not a summary.
      </p>

      <div className="tiles">
        {[
          ["verified", "verified — fixed and observed working"],
          ["fixed", "fixed — change named, not yet observed"],
          ["open", "open — confirmed, not yet fixed"],
          ["unverified", "unverified — raised, never checked"],
        ].map(([k, l]) => (
          <div className="tile" key={k}>
            <div className="n">{counts[k] ?? 0}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      {REGISTER_SECTIONS.map((s) => {
        const rows = sorted.filter((t) => t.status === s.status);
        if (rows.length === 0) return null;
        return (
          <div key={s.status}>
            <h2 className="sec">
              {s.title} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({rows.length})</span>
            </h2>
            {s.intro && <p className="note">{s.intro}</p>}
            {rows.map((t) => (
              <RegisterCard key={t.id} t={t} />
            ))}
          </div>
        );
      })}

      {demo.length > 0 && (
        <div>
          <h2 className="sec">
            Demo <span style={{ color: "var(--muted)", fontWeight: 400 }}>({demo.length})</span>
          </h2>
          <p className="note">
            Numbered in the 9000s so they never collide with a real ticket. They exist to
            walk the trace — Constitution → context pack → agent → work order — before
            real records fill it.{" "}
            {!showDemo && (
              <Link href="/it/agent-platform?tab=tickets&view=register&demo=1" className="crumb">
                Show them
              </Link>
            )}
          </p>
          {showDemo && demo.map((t) => <RegisterCard key={t.id} t={t} />)}
        </div>
      )}
    </>
  );
}
