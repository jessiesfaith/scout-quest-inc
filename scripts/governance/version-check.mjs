#!/usr/bin/env node
// Keeps the footer's claims honest. Rung 3 — deterministic, no model, no spend.
//
//   node scripts/governance/version-check.mjs
//
// The footer shows two hand-typed values and three machine-supplied ones.
// The machine-supplied ones (commit, branch, env) cannot be wrong: Vercel
// injects them from the ref it built. The hand-typed ones can, and a version
// footer that lies is worse than no version footer — it converts "I don't
// know what's deployed" into "I confidently know the wrong thing".
//
// So SCHEMA_VERSION is checked against the migrations actually on disk.
// APP_VERSION needs no check: lib/version.ts reads it from package.json
// rather than restating it, so there is nothing to drift.
//
// Exit 0 = agrees. Exit 1 = drifted. Exit 2 = could not run.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const VERSION_TS = join(REPO_ROOT, "lib", "version.ts");
const MIGRATIONS = join(REPO_ROOT, "supabase", "migrations");

let declared;
try {
  const src = readFileSync(VERSION_TS, "utf8");
  const m = /export const SCHEMA_VERSION\s*=\s*"(\d+)"/.exec(src);
  if (!m) {
    console.error("Could not find SCHEMA_VERSION in lib/version.ts.");
    process.exit(2);
  }
  declared = m[1];
} catch (e) {
  console.error(`Could not read lib/version.ts: ${e.message}`);
  process.exit(2);
}

// Highest numeric prefix in the migrations directory.
//
// Helper files share their migration's number by convention — 0018_VERIFY,
// 0018_DOWN and 0018_DIAGNOSE all belong to 0018_agent_library — so taking
// the max prefix across every .sql file gives the same answer as trying to
// classify which files are "real" migrations, without needing a rule about
// naming that a future file could quietly break.
let files;
try {
  files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
} catch (e) {
  console.error(`Could not read supabase/migrations: ${e.message}`);
  process.exit(2);
}

const numbered = files
  .map((f) => ({ file: f, n: /^(\d{4})_/.exec(f)?.[1] }))
  .filter((x) => x.n);

if (numbered.length === 0) {
  console.error("No numbered migrations found.");
  process.exit(2);
}

const highest = numbered.reduce((a, b) => (b.n > a.n ? b : a)).n;
const atHighest = numbered.filter((x) => x.n === highest).map((x) => x.file).sort();

console.log(`declared SCHEMA_VERSION : ${declared}`);
console.log(`highest migration       : ${highest}`);
for (const f of atHighest) console.log(`                          ${f}`);

if (declared === highest) {
  console.log("\nversion-check: the footer's schema claim matches the migrations on disk.");
  process.exit(0);
}

console.error("");
console.error(`version-check: MISMATCH — lib/version.ts says ${declared}, disk says ${highest}.`);
console.error("");
if (declared < highest) {
  console.error("A migration was added without bumping SCHEMA_VERSION. The footer is");
  console.error("understating the schema, so anyone reconciling this system would");
  console.error(`conclude ${declared} is deployed when the code expects ${highest}.`);
  console.error(`Fix: set SCHEMA_VERSION = "${highest}" in lib/version.ts.`);
} else {
  console.error("SCHEMA_VERSION is ahead of every migration on disk. Either a migration");
  console.error("file was deleted, or the constant was bumped before the migration was");
  console.error("written. The second is the dangerous one: the footer would claim a");
  console.error("schema that does not exist.");
}
process.exit(1);
