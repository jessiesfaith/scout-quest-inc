#!/usr/bin/env node
// Governance drift control (d): capture context pages into history.
// Rung 3 — deterministic, no model, no spend.
//
//   node scripts/governance/capture-context.mjs            # report only
//   node scripts/governance/capture-context.mjs --write     # emit SQL
//
// The FILES in docs/agents/context/ are the record. This script takes a
// snapshot of what they say right now and emits the SQL to store it, so
// the deployed app has something to compare against later. The app has no
// git, so git history alone cannot answer "what changed in CTX-003?" for
// someone reading the Context tab.
//
// Re-capturing an unchanged page is a no-op: the unique index on
// (page_id, sha256) in 0021 refuses a duplicate, and the emitted SQL is
// written so that is not an error.
//
// Exit 0 = nothing to capture, or SQL written. Exit 2 = could not run.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, basename } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CTX_DIR = join(REPO_ROOT, "docs", "agents", "context");
const OUT = join(REPO_ROOT, "supabase", "migrations", "0022_context_capture.sql");

const write = process.argv.includes("--write");

/** Hash over CRLF-normalised UTF-8 bytes — same rule as MANIFEST.sha256. */
function hash(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

/** The `> **version** 1.0` line each pack carries in its header blockquote. */
function declaredVersion(text) {
  const m = text.match(/\*\*version\*\*\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m ? m[1] : null;
}

/** First `# CTX-003 — Title` heading, minus the id. */
function title(text, id) {
  const m = text.match(/^#\s*(.+)$/m);
  if (!m) return id;
  return m[1].replace(new RegExp(`^${id}\\s*[—–-]\\s*`), "").trim();
}

const sqlStr = (v) =>
  v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;

let files;
try {
  files = readdirSync(CTX_DIR)
    .filter((f) => /^CTX-\d{3}.*\.md$/.test(f))
    .sort();
} catch (err) {
  console.error(`capture-context: cannot read ${CTX_DIR} — ${err.message}`);
  process.exit(2);
}

if (files.length === 0) {
  console.error("capture-context: no CTX pages found.");
  process.exit(2);
}

const pages = files.map((f) => {
  const path = join(CTX_DIR, f);
  const raw = readFileSync(path, "utf8");
  const norm = raw.replace(/\r\n/g, "\n");
  const id = basename(f).slice(0, 7); // CTX-003
  return {
    id,
    title: title(norm, id),
    path: `docs/agents/context/${f}`,
    declared_version: declaredVersion(norm),
    sha256: hash(raw),
    bytes: Buffer.byteLength(norm, "utf8"),
    lines: norm.split("\n").length,
    content: norm,
  };
});

console.log(`capture-context: ${pages.length} context pages\n`);
for (const p of pages) {
  console.log(
    `  ${p.id}  v${(p.declared_version ?? "—").padEnd(4)} ${String(p.lines).padStart(4)} lines  ${p.sha256.slice(0, 12)}  ${p.title}`,
  );
}

if (!write) {
  console.log(`\nReport only. Re-run with --write to emit ${basename(OUT)}.`);
  process.exit(0);
}

const lines = [];
lines.push("-- ============================================================");
lines.push("-- Scout Quest Inc — Company OS — Migration 0022");
lines.push("-- A capture of docs/agents/context/ — GENERATED, do not hand-edit.");
lines.push("--");
lines.push("--   node scripts/governance/capture-context.mjs --write");
lines.push("--");
lines.push("-- Re-running is safe: a page whose text has not changed since its");
lines.push("-- last capture is skipped by the unique index on (page_id, sha256),");
lines.push("-- so this file only ever ADDS versions. It never edits or removes");
lines.push("-- one — history that can be revised is not history.");
lines.push("--");
lines.push("-- Paste into Supabase → SQL Editor → Run.");
lines.push("-- If a warning dialog appears, choose \"Run without RLS\".");
lines.push("-- Requires 0021.");
lines.push("-- ============================================================");
lines.push("");

for (const p of pages) {
  lines.push(`-- ---------- ${p.id} — ${p.title} ----------`);
  lines.push(`insert into public.context_pages (id, title, path, declared_version, sha256, bytes, lines, captured_at)`);
  lines.push(`values (${sqlStr(p.id)}, ${sqlStr(p.title)}, ${sqlStr(p.path)}, ${sqlStr(p.declared_version)}, ${sqlStr(p.sha256)}, ${p.bytes}, ${p.lines}, now())`);
  lines.push(`on conflict (id) do update set`);
  lines.push(`  title = excluded.title,`);
  lines.push(`  path = excluded.path,`);
  lines.push(`  declared_version = excluded.declared_version,`);
  lines.push(`  sha256 = excluded.sha256,`);
  lines.push(`  bytes = excluded.bytes,`);
  lines.push(`  lines = excluded.lines,`);
  lines.push(`  captured_at = now();`);
  lines.push("");
  lines.push(`insert into public.context_page_versions (page_id, declared_version, sha256, content, bytes, lines, note)`);
  lines.push(`values (${sqlStr(p.id)}, ${sqlStr(p.declared_version)}, ${sqlStr(p.sha256)}, ${sqlStr(p.content)}, ${p.bytes}, ${p.lines}, 'capture-context.mjs')`);
  lines.push(`on conflict (page_id, sha256) do nothing;`);
  lines.push("");
}

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`\ncapture-context: wrote ${OUT}`);
console.log("Paste it into the Supabase SQL Editor to store this capture.");
