// Reading the governed plane, and the git history alongside it.
//
// THE RULE: a field may cross only if it cannot vary with what a student
// or patient wrote. Identifiers, counts, costs, statuses and timestamps
// qualify. Step output, run parameters, prompts, error detail and the
// ledger's `tenant` column do not, and none of them are read here.
//
// Note what that rule does and does not say. It is not "no free text" —
// `readCommits` sends commit subjects, which are free text. They are
// written by the engineers working on this repo about this repo, so no
// amount of student input can reach them. The test is provenance, not
// shape: ask who authored the string and whether a learner's work could
// have influenced it. Costs and token counts vary with content too, and
// they cross, because an aggregate the company must account for is not
// the content.
//
// See migration 0015 for why the boundary exists at all, and run
// `publish.mjs --dry-run` to read exactly what a change here would send.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { parse as parseYaml } from "yaml";

// The ASL registry names products its own way; this OS has its own keys.
// An unmapped name is left to resolve to null rather than guessed at —
// a work order filed against the wrong product is worse than one filed
// against none.
export const PRODUCT_KEYS = {
  "scout-quest-education": "education",
  soundwiserx: "soundwiserx",
  aibookmark: "ai-bookmark",
};

export function mapProduct(aslName, warn) {
  if (!aslName) return null;
  const key = PRODUCT_KEYS[aslName];
  if (!key && warn) warn(`no product mapping for "${aslName}" — left unattributed`);
  return key ?? null;
}

function openLedger(dbPath) {
  // Read-only, always. This process has no business writing to a
  // hash-chained append-only ledger, and the flag makes that structural
  // rather than a promise.
  return new DatabaseSync(dbPath, { readOnly: true });
}

// ---------------------------------------------------------------------
// agents ← config/spend_policy.yaml
// ---------------------------------------------------------------------

export function readAgents(policyPath, warn) {
  const doc = parseYaml(readFileSync(policyPath, "utf8"));
  const agents = doc?.agents ?? {};

  return Object.entries(agents).map(([agentId, a]) => ({
    agent_id: agentId,
    // `registry` says which of the two AI systems an agent belongs to;
    // it is the closest thing the policy has to a role.
    role: a?.registry === "internal" ? "internal governance" : "product",
    data_classes: Array.isArray(a?.data_classes) ? a.data_classes.join(", ") : null,
    registry: a?.registry ?? null,
    owner: a?.owner ?? null,
    enabled: a?.enabled !== false,
    per_run_cap_usd: a?.per_run_cap_usd ?? null,
    monthly_cap_usd: a?.monthly_cap_usd ?? null,
    allowed_models: Array.isArray(a?.allowed_models)
      ? a.allowed_models.join(", ")
      : null,
    rollback_version:
      a?.rollback_version == null ? null : String(a.rollback_version),
    product: mapProduct(a?.product, warn),
  }));
}

/** Which product each workflow bills to, derived from its agents. */
function workflowProducts(policyPath, warn) {
  const doc = parseYaml(readFileSync(policyPath, "utf8"));
  const agents = doc?.agents ?? {};
  const workflows = doc?.workflows ?? {};
  const out = {};

  for (const [wfId, wf] of Object.entries(workflows)) {
    for (const agentId of wf?.agents ?? []) {
      const product = mapProduct(agents[agentId]?.product, warn);
      if (product) {
        out[wfId] = product;
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// work_orders ← runner_event
// ---------------------------------------------------------------------

// One row per run, folded from that run's step events. The events carry a
// `detail` column and step ids that can echo content, so neither is read.
//
// The cursor picks WHICH RUNS to report, not which events to add up. A run
// is long-lived — it can pause on a human gate for a day and resume — so
// its events routinely straddle two syncs. Aggregating only the events
// after the cursor would produce a partial total, and ingest_work_orders
// upserts totals by assignment (`cost_usd = excluded.cost_usd`), so that
// partial would REPLACE the real figure rather than add to it: a resumed
// run's cost would appear to drop.
//
// So: find the runs touched since the cursor, then aggregate each one's
// complete history. Every payload therefore carries whole-run totals and
// the upsert is idempotent no matter how the events were split up.
const RUNS_SQL = `
  select
    run_id,
    max(workflow_id)                          as workflow_id,
    min(ts)                                   as started_at,
    max(ts)                                   as last_ts,
    max(seq)                                  as last_seq,
    sum(cost_usd)                             as cost_usd,
    sum(tokens_in)                            as tokens_in,
    sum(tokens_out)                           as tokens_out,
    sum(case when outcome = 'RUN_COMPLETED' then 1 else 0 end) as completed,
    sum(case when outcome = 'RUN_HALTED'    then 1 else 0 end) as halted,
    sum(case when outcome = 'RUN_PAUSED'    then 1 else 0 end) as paused,
    sum(case when outcome = 'RUN_RESUMED'   then 1 else 0 end) as resumed,
    group_concat(distinct agent_id)           as agents
  from runner_event
  where run_id in (
    select distinct run_id from runner_event where seq > ?
  )
  group by run_id
  order by max(seq)
  limit ?
`;

function runStatus(row) {
  if (row.completed > 0) return { status: "done", run_status: "COMPLETED" };
  if (row.halted > 0) return { status: "blocked", run_status: "HALTED" };
  // A pause that was never resumed is still waiting on a human gate.
  if (row.paused > row.resumed) return { status: "open", run_status: "PAUSED" };
  return { status: "open", run_status: "RUNNING" };
}

/** Turn `reading_exercise_generation` into `Reading exercise generation`. */
function humanize(workflowId) {
  if (!workflowId) return "Work order";
  const words = workflowId.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function readRuns(dbPath, policyPath, cursor, limit, warn) {
  const db = openLedger(dbPath);
  try {
    const products = workflowProducts(policyPath, warn);
    const after = Number(cursor ?? 0) || 0;
    const rows = db.prepare(RUNS_SQL).all(after, limit);

    let maxSeq = after;
    const items = rows.map((r) => {
      const { status, run_status } = runStatus(r);
      if (r.last_seq > maxSeq) maxSeq = r.last_seq;
      return {
        source_ref: r.run_id,
        wo_code: r.run_id,
        workflow_id: r.workflow_id,
        title: humanize(r.workflow_id),
        agent: r.agents || null,
        status,
        run_status,
        cost_usd: r.cost_usd ?? 0,
        tokens_in: r.tokens_in ?? 0,
        tokens_out: r.tokens_out ?? 0,
        started_at: r.started_at ?? null,
        finished_at: run_status === "COMPLETED" ? (r.last_ts ?? null) : null,
        product: products[r.workflow_id] ?? null,
      };
    });

    return { items, cursor: String(maxSeq) };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------
// agent_spend ← metering
// ---------------------------------------------------------------------

// tenant and feature are in the ledger and are deliberately not selected:
// tenant can identify a school or cohort, and feature names the step,
// which leaks workflow shape without adding anything the OS needs.
const SPEND_SQL = `
  select seq, event_id, ts, agent_id, workflow_id, model, kind,
         tokens_in, tokens_out, cost_usd, product, environment
  from metering
  where seq > ?
  order by seq
  limit ?
`;

export function readSpend(dbPath, cursor, limit, warn) {
  const db = openLedger(dbPath);
  try {
    const after = Number(cursor ?? 0) || 0;
    const rows = db.prepare(SPEND_SQL).all(after, limit);

    let maxSeq = after;
    const items = rows.map((r) => {
      if (r.seq > maxSeq) maxSeq = r.seq;
      return {
        event_id: r.event_id,
        seq: r.seq,
        ts: r.ts,
        agent_id: r.agent_id,
        workflow_id: r.workflow_id,
        model: r.model,
        kind: r.kind,
        tokens_in: r.tokens_in ?? 0,
        tokens_out: r.tokens_out ?? 0,
        cost_usd: r.cost_usd ?? 0,
        product: mapProduct(r.product, warn),
        environment: r.environment,
      };
    });

    return { items, cursor: String(maxSeq) };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------
// change_log ← git history
// ---------------------------------------------------------------------

// Which module a commit touched, inferred from the paths it changed. The
// company change log is organised by module, and a commit that lands in
// app/(app)/hr belongs against HR whatever its subject line says.
const PATH_MODULES = [
  [/^app\/\(app\)\/hr\//, "HR"],
  [/^app\/\(app\)\/it\//, "IT"],
  [/^app\/\(app\)\/security\//, "Security Tooling"],
  [/^app\/\(app\)\/products\//, "Products"],
  [/^app\/\(app\)\/finance\//, "Finance"],
  [/^app\/\(app\)\/contracts\//, "Contracts"],
  [/^app\/\(app\)\/departments\//, "Departments"],
  [/^app\/\(app\)\/projects\//, "Projects"],
  [/^supabase\/migrations\//, "IT"],
  [/^app\/api\/ingest\//, "IT"],
];

// ASCII record and unit separators. Neither can appear in a commit
// subject, an author name or a path, so splitting on them cannot be
// confused by content — which a newline or a pipe character absolutely
// can be. The record separator leads each entry rather than trailing it,
// because --name-only prints its file list *after* the formatted line:
// leading separators keep each commit's files inside that commit's chunk.
const RECORD = "\x1e";
const FIELD = "\x1f";

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function moduleFor(files) {
  for (const [pattern, label] of PATH_MODULES) {
    if (files.some((f) => pattern.test(f))) return label;
  }
  return null;
}

export function readCommits(repo, cursor, limit) {
  // `cursor..HEAD` lists only what is new. If the cursor commit is gone —
  // a rebase, a fresh clone — fall back to the most recent `limit`
  // commits rather than replaying the whole history; the unique index on
  // source_ref means anything already filed is skipped anyway.
  let range = [];
  if (cursor) {
    try {
      git(repo, ["cat-file", "-e", `${cursor}^{commit}`]);
      range = [`${cursor}..HEAD`];
    } catch {
      range = [];
    }
  }

  // %s is the subject alone — one line, no body. The body is skipped on
  // purpose: it is where commit messages carry pasted logs and stack
  // traces, and this OS only wants the headline.
  //
  // NO --max-count. git applies it during traversal, which runs
  // newest-first, and --reverse only flips the output afterwards — so
  // `--max-count=N --reverse A..HEAD` returns the N NEWEST commits printed
  // oldest-first, not the N oldest. Paging on that would advance the
  // cursor to HEAD while skipping everything older, and those commits
  // would never be seen again. Take the whole range and slice the oldest
  // N here, where "oldest" means what it says.
  const format = RECORD + ["%H", "%an", "%aI", "%s"].join(FIELD);
  const raw = git(repo, [
    "log",
    `--pretty=format:${format}`,
    "--name-only",
    "--reverse",
    ...range,
  ]);

  const items = [];
  let newest = cursor ?? null;

  for (const chunk of raw.split(RECORD)) {
    if (!chunk.trim()) continue;
    // Stop at the batch size rather than asking git for it, so the cursor
    // only ever advances over commits actually pushed.
    if (items.length >= limit) break;

    // Line 0 is the formatted header; every line after it is a changed
    // path, courtesy of --name-only.
    const [header, ...fileLines] = chunk.split("\n");
    const [sha, author, authoredAt, subject] = header.split(FIELD);
    if (!sha || !subject) continue;

    const files = fileLines.map((l) => l.trim()).filter(Boolean);

    items.push({
      source_ref: sha,
      product: "company",
      module: moduleFor(files),
      tab: null,
      // A commit is a change that happened; "new" stays reserved for
      // entries a person files about something being introduced.
      change_type: "update",
      description: subject.trim(),
      author,
      authored_at: authoredAt,
    });
    newest = sha;
  }

  return { items, cursor: newest };
}
