#!/usr/bin/env node
// Governance drift control (a): spec-vs-database. Rung 3 — deterministic,
// no model, no spend.
//
//   node scripts/governance/spec-vs-db.mjs
//
// The `agents` table was seeded from docs/agents/ by migration 0018. The
// screen reads the TABLE, not the files. So a spec can change on disk, or a
// spec can be added, and the OS goes on showing the governance it was last
// seeded with — silently, and with no error anywhere.
//
// WHAT THIS CAN AND CANNOT PROVE. The table stores `spec_path` but no spec
// hash, so a row cannot tell you which VERSION of a spec it came from. This
// check therefore proves set membership only, in both directions:
//
//   UNSEEDED  a spec file exists that no library row points at
//   DANGLING  a library row points at a spec file that is not on disk
//
// For "the spec changed since it was seeded", the instrument is
// MANIFEST.sha256 under git — see manifest.mjs. The two are complementary
// and neither replaces the other. Saying so is the point: an instrument
// that overstates what it measured is worse than no instrument.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).
// Read-only: it issues GETs and nothing else.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

function loadEnvFile(name) {
  const path = resolve(REPO_ROOT, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnvFile(".env.local");

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).");
  process.exit(2); // 2 = could not run, distinct from 1 = drift found
}

// --- specs on disk -------------------------------------------------------
// A spec is a document that declares an agent_id in its header table. The
// template declares a placeholder (`<kebab-id>`) and is excluded by that
// same rule rather than by name, so renaming the template cannot break this.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".md")) out.push(full);
  }
  return out;
}

const specs = new Map(); // spec_path -> agent_id
for (const full of walk(join(REPO_ROOT, "docs", "agents"))) {
  const text = readFileSync(full, "utf8");
  const m = /^\|\s*`agent_id`\s*\|\s*`([^`]+)`/m.exec(text);
  if (!m) continue;
  const id = m[1];
  if (id.includes("<")) continue; // placeholder in the template
  specs.set(relative(REPO_ROOT, full).split(sep).join("/"), id);
}

// --- library rows in the database ---------------------------------------
const res = await fetch(
  `${URL_BASE}/rest/v1/agents?select=agent_id,spec_path&source=eq.library`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
);
if (!res.ok) {
  console.error(`REST ${res.status}: ${await res.text()}`);
  process.exit(2);
}
const rows = await res.json();

// --- compare, both directions -------------------------------------------
const byPath = new Map(rows.map((r) => [r.spec_path, r.agent_id]));
const problems = [];

for (const [path, id] of specs) {
  if (!byPath.has(path)) problems.push(`UNSEEDED  ${id.padEnd(26)} ${path}`);
  else if (byPath.get(path) !== id)
    problems.push(`ID-MISMATCH  spec says ${id}, row says ${byPath.get(path)}  ${path}`);
}
for (const [path, id] of byPath) {
  if (path === null) problems.push(`NO-SPEC-PATH  ${id} is a library row with a null spec_path`);
  else if (!specs.has(path)) problems.push(`DANGLING  ${String(id).padEnd(26)} ${path}`);
}

console.log(`specs on disk: ${specs.size}   library rows: ${rows.length}`);
if (problems.length === 0) {
  console.log("spec-vs-database: every spec has a row and every row has a spec.");
  console.log("NOTE: this proves membership, not freshness. For freshness see");
  console.log("      git diff docs/agents/MANIFEST.sha256");
  process.exit(0);
}
for (const p of problems) console.error(p);
console.error("");
console.error("The OS reads the table, so anything listed above is governance the");
console.error("screen is showing wrongly — or a spec it is not showing at all.");
process.exit(1);
