// Extracts the <style> block from the design reference and scopes every
// rule under `.os`, so the dashboard's element selectors (body, table, th,
// code…) cannot leak into the public site or the legal/auth pages.
// Run after updating design/agent_platform_dashboard.html:
//   node scripts/extract-os-css.mjs
import { readFileSync, writeFileSync } from "node:fs";

// Jessica saves the design at the repo root, same as index.html for the
// public site. Edit that file; re-run this script to pick up style changes.
const SRC = "SCOUT_QUEST_INC_COMPANY_OS.html";
const OUT = "app/(app)/os.css";
const ROOT = ".os";

const html = readFileSync(SRC, "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/);
if (!style) {
  console.error("No <style> block found in", SRC);
  process.exit(1);
}

const css = style[1];

// Split top-level rules, keeping @media/@keyframes blocks intact.
function splitRules(input) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        rules.push(input.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  const tail = input.slice(start).trim();
  if (tail) rules.push(tail);
  return rules;
}

function scopeSelector(sel) {
  return sel
    .split(",")
    .map((one) => {
      const s = one.trim();
      if (!s) return s;
      // :root carries the design tokens — move them onto the scope root.
      if (s === ":root") return ROOT;
      // html/body styling applies to the app shell container instead.
      if (s === "html" || s === "body" || s === "html,body") return ROOT;
      if (s === "*") return `${ROOT} *`;
      if (s.startsWith(ROOT)) return s;
      return `${ROOT} ${s}`;
    })
    .join(", ");
}

function scopeRule(rule) {
  const trimmed = rule.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("@keyframes") || trimmed.startsWith("@font-face")) {
    return trimmed; // no selectors to scope
  }

  if (trimmed.startsWith("@media") || trimmed.startsWith("@supports")) {
    const open = trimmed.indexOf("{");
    const prelude = trimmed.slice(0, open + 1);
    const body = trimmed.slice(open + 1, trimmed.lastIndexOf("}"));
    return `${prelude}\n${splitRules(body).map(scopeRule).join("\n")}\n}`;
  }

  const open = trimmed.indexOf("{");
  if (open === -1) return trimmed;
  const sel = trimmed.slice(0, open);
  const body = trimmed.slice(open);
  return `${scopeSelector(sel)} ${body}`;
}

const scoped = splitRules(css).map(scopeRule).filter(Boolean).join("\n");

const header = `/* GENERATED — do not edit by hand.
 * Source: ${SRC} (Jessica's Company OS design)
 * Regenerate: node scripts/extract-os-css.mjs
 * Every rule is scoped under \`${ROOT}\` so the design's element selectors
 * stay inside the app shell.
 */\n\n`;

writeFileSync(OUT, header + scoped + "\n", "utf8");
console.log(
  `extract-os-css: wrote ${OUT} (${scoped.split("\n").length} rules-ish) from ${SRC}`,
);
