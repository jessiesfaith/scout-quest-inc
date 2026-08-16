#!/usr/bin/env node
// Governance drift control, rung 3: deterministic, no model, no spend.
//
//   node scripts/governance/manifest.mjs           # compare, exit 1 on drift
//   node scripts/governance/manifest.mjs --write   # regenerate the manifest
//
// The point of this file is that it produces NO report of its own. It
// rewrites docs/agents/MANIFEST.sha256, and `git diff` on that manifest is
// the drift report — one line per governance document, so a changed line
// names the document that changed and shows the old and new hash side by
// side. There is nothing to interpret and nothing to trust.
//
// DISCIPLINE THIS DEPENDS ON: regenerate the manifest in the SAME commit
// that reseeds the database. Then `git log` on the manifest is the reseed
// history, and `git diff` answers "has a spec changed since the last
// reseed?" — which is the question spec-vs-db.mjs cannot answer on its own,
// because the database records no spec hash.
//
// Hashes are taken over CRLF-normalised bytes. A Windows checkout with
// core.autocrlf=true would otherwise produce different hashes for identical
// content, which would make the manifest report drift that does not exist.
// `bytes` is likewise the normalised length, so the two columns always agree.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MANIFEST = join(REPO_ROOT, "docs", "agents", "MANIFEST.sha256");

// The governed corpus: every document that describes how agents may behave.
//
// docs/enterprise-constitution-v*.md is deliberately NOT here. Its version
// lives in its filename, so a change to it already appears in git as a
// rename rather than an invisible content edit. This manifest exists for
// documents whose content can change underneath a stable filename — which
// is exactly the failure it is meant to catch.
const GOVERNED_ROOTS = ["docs/agents", "docs/governance"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collect() {
  const rows = [];
  for (const root of GOVERNED_ROOTS) {
    for (const full of walk(join(REPO_ROOT, root))) {
      const path = relative(REPO_ROOT, full).split(sep).join("/");
      if (path === "docs/agents/MANIFEST.sha256") continue; // cannot hash itself
      // Normalise line endings before hashing; see the header note.
      const raw = readFileSync(full).toString("utf8").replace(/\r\n/g, "\n");
      const bytes = Buffer.byteLength(raw, "utf8");
      // Line count = newlines, +1 for a final line with no trailing newline.
      const newlines = (raw.match(/\n/g) || []).length;
      const lines = raw.length === 0 ? 0 : raw.endsWith("\n") ? newlines : newlines + 1;
      const sha = createHash("sha256").update(raw, "utf8").digest("hex");
      rows.push({ path, sha, lines, bytes });
    }
  }
  rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return rows;
}

function render(rows) {
  const header = [
    "# Governance document manifest. Regenerate with:",
    "#   node scripts/governance/manifest.mjs --write",
    "#",
    "# One line per governed document, sorted by path, so `git diff` on this",
    "# file IS the drift report. Hashes are over CRLF-normalised UTF-8 bytes.",
    "# Columns: path  sha256  lines  bytes",
    `# ${rows.length} documents.`,
    "",
  ].join("\n");
  const body = rows
    .map((r) => `${r.path}\tsha256:${r.sha}\tlines:${r.lines}\tbytes:${r.bytes}`)
    .join("\n");
  return `${header}${body}\n`;
}

const write = process.argv.includes("--write");
const next = render(collect());

if (write) {
  writeFileSync(MANIFEST, next, "utf8");
  console.log(`manifest written: ${relative(REPO_ROOT, MANIFEST)}`);
  console.log("`git diff` on it is the drift report.");
  process.exit(0);
}

let current;
try {
  current = readFileSync(MANIFEST, "utf8");
} catch {
  console.error("MANIFEST.sha256 is missing. Create it with --write.");
  process.exit(1);
}

if (current === next) {
  console.log("governance manifest: no drift.");
  process.exit(0);
}

// Name the documents rather than dumping a diff — the diff is git's job.
const parse = (text) =>
  new Map(
    text
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const [path, sha] = l.split("\t");
        return [path, sha];
      }),
  );
const before = parse(current);
const after = parse(next);

for (const [path, sha] of after) {
  if (!before.has(path)) console.error(`ADDED    ${path}`);
  else if (before.get(path) !== sha) console.error(`CHANGED  ${path}`);
}
for (const path of before.keys()) {
  if (!after.has(path)) console.error(`REMOVED  ${path}`);
}
console.error("");
console.error("Governance documents drifted from the manifest.");
console.error("If the change is intended, reseed the database and rerun with --write");
console.error("in the same commit. If it is not, you have found what this check is for.");
process.exit(1);
