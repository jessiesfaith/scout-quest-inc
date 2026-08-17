import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type Pack,
  type LoaderAgent,
  diffLines,
  collapseUnchanged,
} from "@/lib/context-packs";

// Context packs — the reference guide. Three screens behind one tab:
//   index    every pack, who loads it, and whether the file still matches
//            the last capture
//   reader   the pack itself, rendered, with CTX and agent ids turned into
//            links so it reads like a wiki
//   compare  a stored version against the file on disk, additions in green
//            and removals struck through
//
// The file on disk is "now" and cannot be wrong: it is what this deploy
// shipped. A stored version is "then". Everything on screen says which of
// the two it is showing, because a governance reader that quietly mixes
// them is worse than one that shows nothing.

export type StoredVersion = {
  id: string;
  page_id: string;
  declared_version: string | null;
  sha256: string;
  content: string;
  lines: number;
  bytes: number;
  note: string | null;
  captured_at: string;
};

export type CapturedPage = {
  id: string;
  sha256: string;
  declared_version: string | null;
  captured_at: string;
};

const GITHUB = "https://github.com/jessiesfaith/scout-quest-inc/blob/master/";

const ctxHref = (id: string) => `/it/agent-platform?tab=context&ctx=${id}`;
const agentHref = (id: string) =>
  `/it/agent-platform?tab=tree&view=map&agent=${encodeURIComponent(id)}`;

/** Escape a string for literal use inside a RegExp. */
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Turn bare and back-ticked identifiers into markdown links, so a reader can
 * follow a reference the way they would in a wiki.
 *
 * Three things are left exactly as written, because a mention inside them is
 * a sample or a literal, not a cross-reference:
 *   - fenced code blocks (``` at column 0 or indented),
 *   - inline code spans whose content is anything other than a bare id —
 *     `CTX-003` becomes a link, `CTX-003-risk-tiers.md` does not,
 *   - existing markdown links.
 *
 * Agent ids come from the database and ultimately from a config file on the
 * governed plane, so they are escaped as regex literals rather than trusted
 * to contain only characters that need no escaping (TCK-0004).
 */
function linkify(md: string, agentIds: string[]) {
  const agentAlt = agentIds.length ? agentIds.map(reEscape).join("|") : null;

  // One tokenizer pass. Anything matched by a "protected" alternative is
  // emitted verbatim; only bare `id` spans and bare words are rewritten.
  const CTX = String.raw`CTX-\d{3}`;
  const tokenRe = new RegExp(
    [
      String.raw`(^[ \t]*\`\`\`[\s\S]*?^[ \t]*\`\`\`[ \t]*$)`, // 1 fenced block
      String.raw`(\[[^\]\n]*\]\([^)\n]*\))`,                   // 2 existing link
      String.raw`\`(${CTX})\``,                                 // 3 `CTX-003` exactly
      agentAlt ? String.raw`\`(${agentAlt})\`` : "(?!x)x",     // 4 `agent-id` exactly
      String.raw`(\`[^\`\n]*\`)`,                              // 5 any other inline code
      String.raw`\b(${CTX})\b`,                                 // 6 bare CTX-003
    ].join("|"),
    "gm",
  );

  return md.replace(tokenRe, (m, fence, link, ctxTick, agentTick, otherCode, ctxBare) => {
    if (fence || link || otherCode) return m;
    if (ctxTick) return `[\`${ctxTick}\`](${ctxHref(ctxTick)})`;
    if (agentTick) return `[\`${agentTick}\`](${agentHref(agentTick)})`;
    if (ctxBare) return `[\`${ctxBare}\`](${ctxHref(ctxBare)})`;
    return m;
  });
}

function MdLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (href && href.startsWith("/")) {
    return (
      <Link href={href} className="crumb">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className="crumb" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

// ---------- index ----------

export function ContextIndex({
  packs,
  loaders,
  captured,
  storeReady,
}: {
  packs: Pack[];
  loaders: Map<string, { agent: LoaderAgent; conditional: boolean }[]>;
  captured: Map<string, CapturedPage>;
  storeReady: boolean;
}) {
  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="n">{packs.length}</div>
          <div className="l">context packs</div>
          <div className="s tealtx">on disk in this deploy</div>
        </div>
        <div className="tile">
          <div className="n">
            {packs.filter((p) => (p.declaredVersion ?? "1") .startsWith("0")).length}
          </div>
          <div className="l">still below v1.0</div>
          <div className="s tealtx">draft — may carry UNSET fields</div>
        </div>
        <div className="tile">
          {(() => {
            // 0021 seeds every page with sha256 = '' so the row exists before
            // its first capture. Those are placeholders, not history — count
            // only rows a capture has actually written (TCK-0005).
            const real = [...captured.values()].filter((c) => c.sha256 !== "").length;
            return (
              <>
                <div
                  className="n"
                  style={{ color: !storeReady ? "var(--muted)" : real ? "var(--ok)" : "var(--warn)" }}
                >
                  {storeReady ? real : "—"}
                </div>
                <div className="l">captured to history</div>
                <div className="s tealtx">
                  {!storeReady
                    ? "run 0021 + 0022"
                    : real === 0
                      ? "no captures yet — run 0022"
                      : real < packs.length
                        ? `${packs.length - real} never captured`
                        : "comparable over time"}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <h2 className="sec">The context library</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Version</th>
              <th>Size</th>
              <th>Loaded by</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => {
              const who = loaders.get(p.id) ?? [];
              const cap = captured.get(p.id);
              const drifted = cap && cap.sha256 !== "" && cap.sha256 !== p.sha256;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={ctxHref(p.id)} className="crumb">
                      <code>{p.id}</code>
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.title}</div>
                  </td>
                  <td>
                    <span
                      className={`badge ${p.declaredVersion?.startsWith("0") ? "b-ready" : "b-live"}`}
                    >
                      v{p.declaredVersion ?? "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {p.lines} lines
                    <div>
                      <code style={{ fontSize: 11 }}>{p.sha256.slice(0, 10)}</code>
                    </div>
                  </td>
                  <td>
                    {who.length === 0 ? (
                      <span style={{ color: "var(--muted)" }}>no agent</span>
                    ) : (
                      <>
                        <b>{who.length}</b>{" "}
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {who
                            .slice(0, 3)
                            .map((w) => w.agent.agent_id)
                            .join(", ")}
                          {who.length > 3 ? ` +${who.length - 3}` : ""}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    {!storeReady ? (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    ) : !cap || cap.sha256 === "" ? (
                      <span className="tag t-med">never captured</span>
                    ) : drifted ? (
                      <span className="tag t-lo">file changed since capture</span>
                    ) : (
                      <span className="tag t-hi">matches capture</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!storeReady && (
        <p className="note" style={{ color: "var(--warn)" }}>
          The version store is not installed, so nothing on this screen has a
          history yet. Run <code>0021_context_pages.sql</code>, then{" "}
          <code>0022_context_capture.sql</code>. After that, re-run{" "}
          <code>node scripts/governance/capture-context.mjs --write</code>{" "}
          whenever a pack changes and paste the file it writes — each capture
          becomes a version you can compare against.
        </p>
      )}

      <p className="note">
        These pages are what agents read before they act, so a change here
        changes behaviour everywhere at once — that is the point of a shared
        context page and the reason it is worth watching. Editing happens in
        the repo, never here: the file is the record and this screen mirrors
        it. Pages below v1.0 are drafts and may still contain{" "}
        <code>UNSET</code> fields that halt an agent rather than being guessed.
      </p>
    </>
  );
}

// ---------- by agent ----------

export function ContextByAgent({
  agents,
  packTitles,
}: {
  agents: LoaderAgent[];
  packTitles: Map<string, string>;
}) {
  const rows = agents
    .filter((a) => a.context_pages)
    .sort((a, b) => (a.layer ?? "").localeCompare(b.layer ?? "") || a.agent_id.localeCompare(b.agent_id));

  return (
    <>
      <h2 className="sec">What each agent reads</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Layer</th>
              <th>Loads</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  No agent declares a context page.
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const groups = (a.context_pages ?? "").split(",").map((g) => g.trim());
                return (
                  <tr key={a.agent_id}>
                    <td>
                      <code>{a.agent_id}</code>
                      {a.spec_path && (
                        <div style={{ fontSize: 11.5 }}>
                          <a
                            href={`${GITHUB}${a.spec_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="crumb"
                          >
                            spec ↗
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {a.layer ?? "—"}
                      {a.department ? ` · ${a.department}` : ""}
                    </td>
                    <td>
                      {groups.map((g, i) => {
                        const members = g.split("|").map((s) => s.trim()).filter(Boolean);
                        const conditional = members.length > 1;
                        return (
                          <span key={i} style={{ marginRight: 6 }}>
                            {members.map((id, k) => (
                              <span key={id}>
                                {k > 0 && (
                                  <span style={{ color: "var(--muted)", fontSize: 11 }}> or </span>
                                )}
                                <Link
                                  href={ctxHref(id)}
                                  className="crumb"
                                  title={packTitles.get(id) ?? id}
                                >
                                  <code>{id}</code>
                                </Link>
                              </span>
                            ))}
                            {conditional && (
                              <span
                                className="tag t-med"
                                style={{ marginLeft: 4, fontSize: 10.5 }}
                              >
                                whichever fits
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="note">
        A pair joined by <code>|</code> in a spec means the agent loads
        whichever brand page matches the work order, so the link is real but
        conditional. Prose in a spec that merely mentions a page is not a load
        — only what is declared here counts.
      </p>
    </>
  );
}

// ---------- reader ----------

export function ContextReader({
  pack,
  loaders,
  versions,
  agentIds,
  storeReady,
}: {
  pack: Pack;
  loaders: { agent: LoaderAgent; conditional: boolean }[];
  versions: StoredVersion[];
  agentIds: string[];
  storeReady: boolean;
}) {
  const latest = versions[0];
  const drifted = latest && latest.sha256 !== pack.sha256;

  return (
    <>
      <div className="ctxhead">
        <div>
          <h2 className="sec" style={{ marginTop: 0 }}>
            {pack.id} — {pack.title}
          </h2>
          <p className="note" style={{ marginTop: 0 }}>
            <span
              className={`badge ${pack.declaredVersion?.startsWith("0") ? "b-ready" : "b-live"}`}
            >
              v{pack.declaredVersion ?? "—"}
            </span>{" "}
            {pack.lines} lines · <code>{pack.sha256.slice(0, 12)}</code> ·{" "}
            <a
              href={`${GITHUB}${pack.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="crumb"
            >
              {pack.path} ↗
            </a>
          </p>
        </div>
      </div>

      {drifted && (
        <p className="note" style={{ color: "var(--warn)" }}>
          This file has changed since its last capture on{" "}
          {new Date(latest.captured_at).toISOString().slice(0, 16).replace("T", " ")} UTC.{" "}
          <Link
            href={`/it/agent-platform?tab=context&ctx=${pack.id}&diff=${latest.sha256}`}
            className="crumb"
          >
            See what changed →
          </Link>
        </p>
      )}

      <div className="ctxgrid">
        <div className="card ctxdoc">
          <div className="constext">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MdLink }}>
              {linkify(pack.content, agentIds)}
            </ReactMarkdown>
          </div>
        </div>

        <div className="ctxside">
          <h3 className="ctxh3">Loaded by ({loaders.length})</h3>
          {loaders.length === 0 ? (
            <p className="note">No agent declares this page.</p>
          ) : (
            <ul className="ctxlist">
              {loaders.map(({ agent, conditional }) => (
                <li key={agent.agent_id}>
                  <Link href={agentHref(agent.agent_id)} className="crumb">
                    <code>{agent.agent_id}</code>
                  </Link>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {agent.layer ?? "—"}
                    {agent.lifecycle ? ` · ${agent.lifecycle}` : ""}
                    {conditional && " · whichever fits"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="note" style={{ fontSize: 11.5 }}>
            Change this page and every agent above changes with it.
          </p>

          <h3 className="ctxh3">History ({versions.length})</h3>
          {!storeReady ? (
            <p className="note" style={{ fontSize: 11.5 }}>
              Version store not installed — run 0021 and 0022.
            </p>
          ) : versions.length === 0 ? (
            <p className="note" style={{ fontSize: 11.5 }}>
              Never captured. Nothing to compare against yet.
            </p>
          ) : (
            <ul className="ctxlist">
              {versions.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/it/agent-platform?tab=context&ctx=${pack.id}&diff=${v.sha256}`}
                    className="crumb"
                  >
                    v{v.declared_version ?? "—"} ·{" "}
                    {new Date(v.captured_at).toISOString().slice(0, 10)}
                  </Link>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    <code>{v.sha256.slice(0, 10)}</code> · {v.lines} lines
                    {v.sha256 === pack.sha256 && " · current"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- compare ----------

export function ContextDiff({
  pack,
  version,
}: {
  pack: Pack;
  version: StoredVersion;
}) {
  const lines = diffLines(version.content, pack.content);
  const identical = lines !== null && lines.every((l) => l.kind === "same");
  const added = lines?.filter((l) => l.kind === "add").length ?? 0;
  const removed = lines?.filter((l) => l.kind === "del").length ?? 0;
  const rows = lines ? collapseUnchanged(lines) : [];

  return (
    <>
      <h2 className="sec">
        {pack.id} — what changed
      </h2>
      <p className="note">
        Comparing the version captured{" "}
        <b>
          {new Date(version.captured_at).toISOString().slice(0, 16).replace("T", " ")} UTC
        </b>{" "}
        (<code>{version.sha256.slice(0, 10)}</code>, v
        {version.declared_version ?? "—"}) against{" "}
        <b>the file in this deploy</b> (<code>{pack.sha256.slice(0, 10)}</code>, v
        {pack.declaredVersion ?? "—"}).{" "}
        <Link href={ctxHref(pack.id)} className="crumb">
          ← back to the page
        </Link>
      </p>

      {lines === null ? (
        <p className="note" style={{ color: "var(--warn)" }}>
          These versions are too large to compare line by line here. They
          differ — compare them in git.
        </p>
      ) : identical ? (
        <p className="note" style={{ color: "var(--ok)" }}>
          Identical. The captured version and the deployed file are the same
          text.
        </p>
      ) : (
        <>
          <p className="note">
            <span className="dfstat dfadd">+{added} added</span>{" "}
            <span className="dfstat dfdel">−{removed} removed</span>
          </p>
          <div className="card">
            <div className="dfwrap">
              {rows.map((r, i) =>
                "gap" in r ? (
                  <div key={i} className="dfgap">
                    ⋯ {r.gap} unchanged {r.gap === 1 ? "line" : "lines"}
                  </div>
                ) : (
                  <div key={i} className={`dfrow df-${r.kind}`}>
                    <span className="dfno">{r.leftNo ?? ""}</span>
                    <span className="dfno">{r.rightNo ?? ""}</span>
                    <span className="dfsign">
                      {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}
                    </span>
                    <span className="dftext">{r.text || "\u00a0"}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
