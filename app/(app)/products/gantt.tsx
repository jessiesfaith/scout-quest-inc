"use client";

import { useState } from "react";

export type PlanRow = {
  id?: string;
  product_id?: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  /** Tasks underneath this row. Hidden until the row is expanded. */
  children?: PlanRow[];
};

const BAR: Record<string, string> = {
  live: "bl",
  building: "bb",
  planned: "bp",
};

// The month ticks and the bars must share one coordinate system, or a bar
// drawn under "Jan" can actually mean February: the scale is whole months
// (each tick an equal share), so bars are positioned in that same
// whole-month domain rather than against the raw min/max of the dates.
function layout(rows: PlanRow[]) {
  const flat: PlanRow[] = [];
  for (const r of rows) {
    flat.push(r);
    for (const c of r.children ?? []) flat.push(c);
  }
  const dated = flat.filter((r) => r.start_date && r.end_date);
  if (dated.length === 0) return null;

  const stamps = dated.map((r) => ({
    s: Date.parse(r.start_date!),
    e: Date.parse(r.end_date!),
  }));
  const minRaw = Math.min(...stamps.map((t) => t.s));
  const maxRaw = Math.max(...stamps.map((t) => t.e));

  const min = new Date(minRaw);
  const max = new Date(maxRaw);
  const domainStart = Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1);
  const domainEnd = Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 1);
  const domain = Math.max(domainEnd - domainStart, 1);

  const months: { key: number; label: string }[] = [];
  let y = new Date(domainStart).getUTCFullYear();
  let m = new Date(domainStart).getUTCMonth();
  // Bounded by construction; capped anyway so a mistyped year cannot
  // render thousands of ticks.
  while (Date.UTC(y, m, 1) < domainEnd && months.length < 60) {
    const start = Date.UTC(y, m, 1);
    months.push({
      key: start,
      label: new Date(start).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  const multiYear =
    new Date(domainStart).getUTCFullYear() !==
    new Date(domainEnd - 1).getUTCFullYear();

  return { domainStart, domain, months, multiYear };
}

function Bar({
  row,
  domainStart,
  domain,
}: {
  row: PlanRow;
  domainStart: number;
  domain: number;
}) {
  if (!row.start_date || !row.end_date) {
    return (
      <div className="gtrack">
        <span
          style={{
            fontSize: 10.5,
            color: "var(--muted)",
            paddingLeft: 8,
            lineHeight: "22px",
          }}
        >
          no dates
        </span>
      </div>
    );
  }
  const s = Date.parse(row.start_date);
  const e = Date.parse(row.end_date);
  const leftPct = ((s - domainStart) / domain) * 100;
  const rawWidth = ((e - s) / domain) * 100;
  // Clamp inside the track: an unclamped left of 100% puts the bar past
  // the right edge, where overflow:hidden erases it entirely.
  const left = Math.min(Math.max(leftPct, 0), 98);
  const width = Math.min(Math.max(rawWidth, 2), 100 - left);

  return (
    <div className="gtrack">
      <div
        className={`gbar ${BAR[row.status] ?? "bp"}`}
        style={{ left: `${left}%`, width: `${width}%` }}
        title={`${row.start_date} → ${row.end_date} · ${row.status}`}
      >
        {row.status}
      </div>
    </div>
  );
}

export function Gantt({
  rows,
  emptyMessage = "No dated items yet. Add dates and they appear here.",
}: {
  rows: PlanRow[];
  emptyMessage?: string;
}) {
  // Every parent starts collapsed; tasks appear only when asked for.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const geo = layout(rows);
  if (!geo) {
    return <p className="note">{emptyMessage}</p>;
  }
  const { domainStart, domain, months, multiYear } = geo;

  return (
    <>
      <div className="gscale">
        {months.map((mo) => (
          <span key={mo.key}>
            {multiYear
              ? `${mo.label} ${String(new Date(mo.key).getUTCFullYear()).slice(2)}`
              : mo.label}
          </span>
        ))}
      </div>

      {rows.map((row, i) => {
        const key = row.id ?? `${row.title}-${i}`;
        const kids = row.children ?? [];
        const expanded = open[key] ?? false;

        return (
          <div key={key}>
            <div className="grow">
              <div className="glabel">
                {kids.length > 0 ? (
                  <button
                    type="button"
                    className="gtoggle"
                    aria-expanded={expanded}
                    onClick={() => setOpen({ ...open, [key]: !expanded })}
                    title={
                      expanded
                        ? "Hide tasks"
                        : `Show ${kids.length} task${kids.length === 1 ? "" : "s"}`
                    }
                  >
                    <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                    {row.title}
                    <span className="gcount">{kids.length}</span>
                  </button>
                ) : (
                  <span style={{ paddingLeft: 15 }}>{row.title}</span>
                )}
              </div>
              <Bar row={row} domainStart={domainStart} domain={domain} />
            </div>

            {expanded &&
              kids.map((kid, j) => (
                <div className="grow gchild" key={kid.id ?? `${key}-${j}`}>
                  <div className="glabel">{kid.title}</div>
                  <Bar row={kid} domainStart={domainStart} domain={domain} />
                </div>
              ))}
          </div>
        );
      })}

      <div className="glegend">
        <span>
          <i style={{ background: "var(--ok)" }} />
          Live / done
        </span>
        <span>
          <i style={{ background: "var(--b)" }} />
          Building
        </span>
        <span>
          <i style={{ background: "var(--g)" }} />
          Planned
        </span>
        <span style={{ color: "var(--muted)" }}>
          Rows with a ▸ hold tasks — click to expand.
        </span>
      </div>
    </>
  );
}
