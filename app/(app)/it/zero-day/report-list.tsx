"use client";

import { useState } from "react";

export type Finding = {
  title?: string;
  severity?: string;
  status?: string;
  detail?: string;
  resolution?: string;
};

export type Coverage = { checked?: string[]; not_checked?: string[] };

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

const SEV: Record<string, string> = {
  high: "t-lo",
  medium: "t-med",
  low: "t-hi",
};

const OUTCOME: Record<string, string> = {
  fixed: "b-live",
  "needs-attention": "b-plan",
  "accepted-risk": "b-ready",
  reviewed: "b-reg",
};

function ReportCard({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  // jsonb can arrive as anything; never let one malformed row break the page.
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const confirmed = findings.filter((f) => f.status === "confirmed");
  const checked = report.coverage?.checked ?? [];
  const notChecked = report.coverage?.not_checked ?? [];

  return (
    <div className="rpt">
      <button
        type="button"
        className="rpt-head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>
            {report.title}
          </span>{" "}
          <span className={`badge ${OUTCOME[report.outcome] ?? "b-reg"}`}>
            {report.outcome}
          </span>
          <span className="rpt-meta" style={{ display: "block" }}>
            {report.ran_at_label}
            {report.scope && ` · ${report.scope}`}
            {report.agent_count != null && ` · ${report.agent_count} agents`}
            {` · ${confirmed.length} confirmed finding${confirmed.length === 1 ? "" : "s"}`}
          </span>
        </span>
        <span className="tealtx" style={{ fontSize: 12.5, fontWeight: 700 }}>
          {open ? "Close" : "Open →"}
        </span>
      </button>

      {open && (
        <div className="rpt-body">
          {report.summary && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {report.summary}
            </p>
          )}
          <p className="rpt-meta">
            {report.reviewer && `Reviewed by ${report.reviewer}. `}
            Ran {report.ran_at_label}
            {report.filed_at_label &&
              ` · filed ${report.filed_at_label} (database-stamped)`}
            {report.created_by_email && ` by ${report.created_by_email}`}
            {report.commit_sha && ` · commit ${report.commit_sha}`}
          </p>

          {findings.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {findings.map((f, i) => (
                <div
                  key={i}
                  className={`finding${f.severity === "medium" ? " warnbar" : ""}`}
                >
                  <h3>
                    {f.title}
                    {f.severity && (
                      <span className={`tag ${SEV[f.severity] ?? "t-hi"}`}>
                        {f.severity}
                      </span>
                    )}
                    {f.status === "dismissed" && (
                      <span className="tag t-hi">dismissed on verification</span>
                    )}
                  </h3>
                  {f.detail && <p>{f.detail}</p>}
                  {f.resolution && (
                    <p style={{ color: "var(--ok)", marginTop: 5 }}>
                      Resolved: {f.resolution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="cov">
            <div>
              <h4>Checked in this review</h4>
              {checked.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--warn)" }}>
                  Not recorded — treat this review&apos;s scope as unknown.
                </p>
              ) : (
                <ul>
                  {checked.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 style={{ color: "var(--warn)" }}>
                NOT checked — residual risk
              </h4>
              {notChecked.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--warn)" }}>
                  Not recorded. This does not mean everything was covered.
                </p>
              ) : (
                <ul>
                  {notChecked.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
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
  const [kind, setKind] = useState("all");
  const kinds = Array.from(new Set(reports.map((r) => r.kind)));
  const shown = kind === "all" ? reports : reports.filter((r) => r.kind === kind);

  if (reports.length === 0) {
    return (
      <p className="note">
        No reports archived yet. If work is shipping and this stays empty,
        that itself is worth asking about.
      </p>
    );
  }

  return (
    <>
      {kinds.length > 1 && (
        <div className="chips">
          {["all", ...kinds].map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${kind === k ? " on" : ""}`}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      {shown.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </>
  );
}
