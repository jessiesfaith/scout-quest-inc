export type PlanRow = {
  product_id?: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
};

const BAR: Record<string, string> = {
  live: "bl",
  building: "bb",
  planned: "bp",
};

// Renders the design's Gantt. The month ticks and the bars must share one
// coordinate system, or a bar drawn under "Jan" can actually mean February:
// the scale is whole months (each tick an equal share), so the bars are
// positioned in the same whole-month domain rather than against the raw
// min/max of the dates.
export function Gantt({ rows }: { rows: PlanRow[] }) {
  const dated = rows.filter((r) => r.start_date && r.end_date);
  if (dated.length === 0) {
    return (
      <p className="note">
        No dated plan items yet. Add them on a product&apos;s Plan Board and
        they appear here.
      </p>
    );
  }

  const times = dated.map((r) => ({
    s: Date.parse(r.start_date!),
    e: Date.parse(r.end_date!),
    row: r,
  }));
  const minRaw = Math.min(...times.map((t) => t.s));
  const maxRaw = Math.max(...times.map((t) => t.e));

  // Domain: first day of the earliest month → first day of the month after
  // the latest, so every tick covers exactly the span it labels.
  const domainStart = Date.UTC(
    new Date(minRaw).getUTCFullYear(),
    new Date(minRaw).getUTCMonth(),
    1,
  );
  const lastMonth = new Date(maxRaw);
  const domainEnd = Date.UTC(
    lastMonth.getUTCFullYear(),
    lastMonth.getUTCMonth() + 1,
    1,
  );
  const domain = Math.max(domainEnd - domainStart, 1);

  const months: { label: string; start: number; end: number }[] = [];
  let y = new Date(domainStart).getUTCFullYear();
  let m = new Date(domainStart).getUTCMonth();
  // Bounded by construction, but cap anyway so a mistyped year cannot
  // render thousands of ticks.
  while (Date.UTC(y, m, 1) < domainEnd && months.length < 60) {
    const start = Date.UTC(y, m, 1);
    const end = Date.UTC(y, m + 1, 1);
    months.push({
      label: new Date(start).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      start,
      end,
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

  return (
    <>
      <div className="gscale">
        {months.map((mo) => (
          <span key={`${mo.start}`}>
            {multiYear
              ? `${mo.label} ${String(new Date(mo.start).getUTCFullYear()).slice(2)}`
              : mo.label}
          </span>
        ))}
      </div>
      {times.map((t, i) => {
        const leftPct = ((t.s - domainStart) / domain) * 100;
        const rawWidth = ((t.e - t.s) / domain) * 100;
        // Clamp inside the track: an unclamped left of 100% puts the bar
        // past the right edge, where overflow:hidden erases it entirely.
        const left = Math.min(Math.max(leftPct, 0), 98);
        const width = Math.min(Math.max(rawWidth, 2), 100 - left);
        return (
          <div className="grow" key={`${t.row.title}-${i}`}>
            <div className="glabel">{t.row.title}</div>
            <div className="gtrack">
              <div
                className={`gbar ${BAR[t.row.status] ?? "bp"}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${t.row.start_date} → ${t.row.end_date} · ${t.row.status}`}
              >
                {t.row.status}
              </div>
            </div>
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
      </div>
    </>
  );
}
