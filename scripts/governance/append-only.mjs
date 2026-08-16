#!/usr/bin/env node
// Governance drift control (b): append-only monotonicity. Rung 3 —
// deterministic, no model, no spend.
//
//   node scripts/governance/append-only.mjs           # compare, exit 1 on decrease
//   node scripts/governance/append-only.mjs --write   # record the new high-water mark
//
// change_log, security_reports and work_order_events have NO delete policy
// for anyone, including the owner (migrations 0007, 0008, 0018). Their row
// counts are therefore monotonic by construction. A count that has DECREASED
// is not a data-quality problem to reconcile — it is evidence that something
// reached the database outside the policy layer, which is the service key,
// the SQL Editor, or the Supabase dashboard. Treat it as a security event.
//
// WHY A PLAIN COUNT IS THE RIGHT INSTRUMENT HERE, AND ONLY HERE. A count
// carries no information about content, so it cannot be fooled into
// reporting healthy content — it can only be fooled about quantity. Against
// a table that may only grow, "did the number go down" is the whole
// question, and no cheaper instrument answers it.
//
// WHAT IT DOES NOT CATCH, stated plainly: a delete followed by an insert
// leaves the count unchanged. This check detects NET REMOVAL, not tampering.
// A tamper-evident instrument would need a hash chain over row contents,
// which is a different and more expensive control (rung 3 still, but real
// work) and is not what this file is. Do not cite a passing run here as
// evidence that nothing was altered.
//
// The watermark lives beside this script rather than under docs/, and that
// is deliberate: docs/agents/ and docs/governance/ are the corpus hashed by
// MANIFEST.sha256, so a watermark stored there would make ordinary row
// growth show up as governance-document drift and train everyone to ignore
// the manifest.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local).
// Read-only against the database: it issues GETs and nothing else.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WATERMARK = resolve(import.meta.dirname, "watermark.json");

const TABLES = ["change_log", "security_reports", "work_order_events"];

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
  process.exit(2); // 2 = could not run, distinct from 1 = a count went down
}

async function count(table) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const range = res.headers.get("content-range"); // e.g. "0-0/1234"
  if (!res.ok && res.status !== 206) throw new Error(`${table}: REST ${res.status}`);
  const total = range && range.split("/")[1];
  if (!total || total === "*") throw new Error(`${table}: no exact count in content-range`);
  return Number(total);
}

const current = {};
try {
  for (const t of TABLES) current[t] = await count(t);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(2);
}

const write = process.argv.includes("--write");
let previous = null;
if (existsSync(WATERMARK)) previous = JSON.parse(readFileSync(WATERMARK, "utf8"));

if (!previous) {
  if (!write) {
    console.error("No watermark recorded yet. Establish one with --write.");
    for (const t of TABLES) console.error(`  ${t.padEnd(20)} ${current[t]}`);
    process.exit(2);
  }
  writeFileSync(
    WATERMARK,
    `${JSON.stringify({ observed_at: new Date().toISOString(), counts: current }, null, 2)}\n`,
    "utf8",
  );
  console.log("watermark established:");
  for (const t of TABLES) console.log(`  ${t.padEnd(20)} ${current[t]}`);
  process.exit(0);
}

const decreased = [];
for (const t of TABLES) {
  const was = previous.counts?.[t];
  if (typeof was !== "number") continue; // new table joins at its current count
  if (current[t] < was) decreased.push({ table: t, was, now: current[t] });
}

console.log(`watermark from ${previous.observed_at}`);
for (const t of TABLES) {
  const was = previous.counts?.[t];
  const delta = typeof was === "number" ? current[t] - was : null;
  const sign = delta === null ? "new" : delta === 0 ? "same" : delta > 0 ? `+${delta}` : `${delta}`;
  console.log(`  ${t.padEnd(20)} ${String(current[t]).padStart(7)}  (${sign})`);
}

if (decreased.length > 0) {
  console.error("");
  console.error("APPEND-ONLY VIOLATION — a monotonic table lost rows:");
  for (const d of decreased) console.error(`  ${d.table}: ${d.was} -> ${d.now}`);
  console.error("");
  console.error("These tables have no delete policy for any role. Rows did not go");
  console.error("through the policy layer. Check service-key use, the SQL Editor and");
  console.error("dashboard access before doing anything else, and do NOT rerun with");
  console.error("--write: that would overwrite the evidence with the lower number.");
  process.exit(1);
}

if (write) {
  writeFileSync(
    WATERMARK,
    `${JSON.stringify({ observed_at: new Date().toISOString(), counts: current }, null, 2)}\n`,
    "utf8",
  );
  console.log("watermark advanced.");
}
process.exit(0);
