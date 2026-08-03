#!/usr/bin/env node
// Stage 3 publisher. Runs on the governed local plane, reads the ledger,
// posts metadata to the company OS. One direction only.
//
//   node scripts/ingest/publish.mjs --dry-run
//   node scripts/ingest/publish.mjs --source agents
//   node scripts/ingest/publish.mjs
//
// Configuration comes from the environment, or from a .env.ingest file
// beside the repo root:
//
//   OS_INGEST_URL   https://scout-quest-inc.vercel.app/api/ingest
//   INGEST_TOKEN    the same long random string set in Vercel
//   ASL_DB          path to the ledger, e.g. C:\\dev\\asl-gateway\\asl.db
//   ASL_POLICY      path to config/spend_policy.yaml
//   GIT_REPO        repo whose history feeds the change log (default: cwd)
//
// --dry-run prints exactly what would be sent and posts nothing. Use it
// before the first real run, and after changing anything in sources.mjs:
// reading the payload is the only way to confirm the D3 boundary holds,
// and it is much easier to check here than in the database afterwards.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readAgents, readRuns, readSpend, readCommits } from "./sources.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const BATCH = 500; // under the route's 1000-item ceiling, with room to spare

// ---------------------------------------------------------------------

function loadEnvFile(name) {
  const path = resolve(REPO_ROOT, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    // The real environment wins: a stale file must never quietly override
    // what an operator just exported.
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadEnvFile(".env.ingest");
loadEnvFile(".env.local");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const DRY = process.argv.includes("--dry-run");
const ONLY = arg("source");
const VERBOSE = process.argv.includes("--verbose");

const CONFIG = {
  url: process.env.OS_INGEST_URL,
  token: process.env.INGEST_TOKEN,
  db: process.env.ASL_DB,
  policy: process.env.ASL_POLICY,
  repo: process.env.GIT_REPO || REPO_ROOT,
};

const warnings = [];
const warn = (message) => {
  if (!warnings.includes(message)) warnings.push(message);
};

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------

async function getCursor(source) {
  if (DRY) return null;
  const response = await fetch(`${CONFIG.url}?source=${source}`, {
    headers: { authorization: `Bearer ${CONFIG.token}` },
  });
  if (!response.ok) {
    const body = await response.text();
    fail(`GET cursor for ${source} failed (${response.status}): ${body}`);
  }
  return (await response.json()).cursor ?? null;
}

async function post(source, items, cursor, note) {
  if (DRY) {
    console.log(`\n--- ${source}: ${items.length} item(s) that WOULD be sent ---`);
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
    if (items.length > 3) console.log(`… and ${items.length - 3} more`);
    console.log(`cursor would advance to: ${cursor}`);
    return { written: 0 };
  }

  const response = await fetch(CONFIG.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${CONFIG.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ source, items, cursor, note }),
  });

  const body = await response.text();
  if (!response.ok) fail(`POST ${source} failed (${response.status}): ${body}`);
  return JSON.parse(body);
}

/** Read → post → repeat while a full batch keeps coming back. */
async function pump(source, read, note) {
  let cursor = await getCursor(source);
  let total = 0;
  let rounds = 0;

  for (;;) {
    const { items, cursor: next } = read(cursor);
    if (items.length === 0) {
      // Still mark the run, so "last checked" is truthful on an idle sync.
      if (rounds === 0) await post(source, [], cursor, note);
      break;
    }

    const result = await post(source, items, next, note);
    const written = result.written ?? 0;
    total += written;
    rounds += 1;
    if (VERBOSE)
      console.log(`  ${source}: ${items.length} read, ${written} written`);

    // The cursor advances whether or not every item landed, so a silent
    // shortfall would be skipped forever. For asl-spend and git a
    // shortfall is normal — both use ON CONFLICT DO NOTHING and re-send
    // rows already filed — but for the others it means the SQL rejected
    // something, and that is worth saying out loud rather than burying.
    // Not in a dry run, where nothing is written by definition.
    if (!DRY && written < items.length && source !== "asl-spend" && source !== "git")
      warn(
        `${source}: sent ${items.length} but ${written} were written — the rest were rejected and the cursor has moved past them.`,
      );

    // A cursor that did not move would loop forever.
    if (items.length < BATCH || next === cursor) {
      cursor = next;
      break;
    }
    cursor = next;
  }

  console.log(
    `${source.padEnd(10)} ${DRY ? "dry run" : `${total} row(s) written`}`,
  );
}

// ---------------------------------------------------------------------

const SOURCES = {
  agents: async () => {
    if (!CONFIG.policy) fail("ASL_POLICY is not set — cannot read spend_policy.yaml.");
    // The whole registry every time, not a delta. ingest_agents relies on
    // that: it upserts what it is given and retires any policy-sourced
    // agent absent from the payload, which only works if absence really
    // means "no longer in spend_policy.yaml". A handful of rows, so there
    // is nothing to gain from sending less.
    const items = readAgents(CONFIG.policy, warn);
    const result = await post("agents", items, "full", "spend_policy.yaml");
    console.log(
      `agents     ${DRY ? "dry run" : `${result.written ?? 0} row(s) written`}`,
    );
  },

  "asl-runs": () => {
    if (!CONFIG.db) fail("ASL_DB is not set — cannot read the ledger.");
    if (!CONFIG.policy) fail("ASL_POLICY is not set — needed for product attribution.");
    return pump(
      "asl-runs",
      (cursor) => readRuns(CONFIG.db, CONFIG.policy, cursor, BATCH, warn),
      "runner_event",
    );
  },

  "asl-spend": () => {
    if (!CONFIG.db) fail("ASL_DB is not set — cannot read the ledger.");
    return pump(
      "asl-spend",
      (cursor) => readSpend(CONFIG.db, cursor, BATCH, warn),
      "metering",
    );
  },

  git: () =>
    pump("git", (cursor) => readCommits(CONFIG.repo, cursor, BATCH), "git log"),
};

async function main() {
  if (!DRY) {
    if (!CONFIG.url) fail("OS_INGEST_URL is not set.");
    if (!CONFIG.token) fail("INGEST_TOKEN is not set.");
  }

  const names = ONLY && ONLY !== true ? [ONLY] : Object.keys(SOURCES);
  for (const name of names) {
    if (!SOURCES[name])
      fail(`Unknown source "${name}". Try: ${Object.keys(SOURCES).join(", ")}`);
  }

  if (DRY) console.log("DRY RUN — nothing will be sent.\n");

  for (const name of names) {
    try {
      await SOURCES[name]();
    } catch (error) {
      // One unreachable source must not stop the others: a missing ledger
      // on a laptop should still let the git sync run.
      console.error(`${name.padEnd(10)} SKIPPED — ${error.message}`);
    }
  }

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`  · ${w}`);
  }
}

main().catch((error) => fail(error.stack ?? String(error)));
