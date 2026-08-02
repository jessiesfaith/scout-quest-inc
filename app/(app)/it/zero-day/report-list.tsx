"use client";

import { useState } from "react";

export type Finding = {
  title?: string;
  severity?: string;
  status?: string;
  detail?: string;
  resolution?: string;
};

export type Coverage = {
  checked?: string[];
  not_checked?: string[];
};

export type Report = {
  id: string;
  title: string;
  kind: string;
  scope: string | null;
  commit_sha: string | null;
  ran_at: string;
  ran_at_label: string;
  filed_at_label: string | null;
  agent_count: number | null;
  reviewer: string | null;
  created_by_email: string | null;
  outcome: string;
  summary: string | null;
  findings: Finding[] | null;
  coverage: Coverage | null;
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-gold/15 text-gold",
  low: "bg-accent-soft text-accent",
};

const OUTCOME_STYLE: Record<string, string> = {
  fixed: "bg-success/10 text-success",
  "needs-attention": "bg-danger/15 text-danger",
  "accepted-risk": "bg-gold/15 text-gold",
  reviewed: "bg-accent-soft text-accent",
};

function ReportCard({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  // jsonb can arrive as anything; never let one malformed row break the page.
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const confirmed = findings.filter((f) => f.status === "confirmed");
  const checked = report.coverage?.checked ?? [];
  const notChecked = report.coverage?.not_checked ?? [];

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 p-5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{report.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                OUTCOME_STYLE[report.outcome] ?? "bg-accent-soft text-accent"
              }`}
            >
              {report.outcome}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted">
            {report.ran_at_label}
            {report.scope && <> · {report.scope}</>}
            {report.agent_count != null && <> · {report.agent_count} agents</>}
            {" · "}
            {confirmed.length} confirmed finding
            {confirmed.length === 1 ? "" : "s"}
          </div>
        </div>
        <span className="shrink-0 text-xs text-accent">
          {open ? "Close" : "Open"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-5">
          {report.summary && (
            <p className="text-sm text-muted">{report.summary}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            {report.reviewer && <>Reviewed by {report.reviewer}. </>}
            Ran {report.ran_at_label}
            {report.filed_at_label && (
              <>
                {" "}
                · filed {report.filed_at_label} (database-stamped)
              </>
            )}
            {report.created_by_email && <> by {report.created_by_email}</>}
            {report.commit_sha && <> · commit {report.commit_sha}</>}
          </p>

          {findings.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Findings
              </h3>
              {findings.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-raised p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{f.title}</span>
                    {f.severity && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          SEVERITY_STYLE[f.severity] ?? "bg-accent-soft text-accent"
                        }`}
                      >
                        {f.severity}
                      </span>
                    )}
                    {f.status === "dismissed" && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                        dismissed on verification
                      </span>
                    )}
                  </div>
                  {f.detail && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {f.detail}
                    </p>
                  )}
                  {f.resolution && (
                    <p className="mt-2 text-xs leading-relaxed text-success">
                      Resolved: {f.resolution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Checked in this review
              </h3>
              {checked.length === 0 ? (
                <p className="mt-2 text-xs text-gold">
                  Not recorded — treat this review&apos;s scope as unknown.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 pl-4">
                  {checked.map((c) => (
                    <li key={c} className="list-disc text-xs text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold">
                NOT checked — residual risk
              </h3>
              {notChecked.length === 0 ? (
                <p className="mt-2 text-xs text-gold">
                  Not recorded. This does not mean everything was covered —
                  see the reviewer&apos;s guide for the standing limits.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 pl-4">
                  {notChecked.map((c) => (
                    <li key={c} className="list-disc text-xs text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">
                Plus the standing limits in the reviewer&apos;s guide, which
                apply to every review.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportList({ reports }: { reports: Report[] }) {
  const [kind, setKind] = useState<string>("all");
  const kinds = Array.from(new Set(reports.map((r) => r.kind)));
  const shown =
    kind === "all" ? reports : reports.filter((r) => r.kind === kind);

  if (reports.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        No reports archived yet. Reviews appear here automatically as they are
        filed — if this stays empty while work is shipping, that itself is
        worth asking about.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["all", ...kinds].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                kind === k
                  ? "bg-accent text-background"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      {shown.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  );
}
