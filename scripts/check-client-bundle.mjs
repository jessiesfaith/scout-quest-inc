// Asserts that no server-side secret reaches the browser.
// Scans every asset Next.js serves to the client (.next/static) for:
//   1. an actual sb_secret_... key value (prefix followed by key material),
//   2. the name of any server-only secret variable,
//   3. the literal value of each of those variables, when one is set.
// The bare string "sb_secret_" alone is NOT flagged: @supabase/supabase-js
// ships a key-format validator (`e.startsWith("sb_secret_")`) that legitimately
// contains the prefix with no key material after it.
// Runs automatically after `npm run build` (postbuild). Exits 1 on any hit.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = join(process.cwd(), ".next", "static");
const KEY_VALUE_PATTERN = /sb_secret_[A-Za-z0-9_-]{4,}/;

// Every variable that must stay server-side. Add to this list whenever a
// new one is introduced — the guard is only as good as the list, and a
// secret nobody added here is a secret nothing is checking.
const SECRET_VARS = [
  "SUPABASE_SECRET_KEY", // service role: bypasses every RLS policy
  "INGEST_TOKEN", // Stage 3 publisher's bearer token
];

// Pick up the real values (if set) so their literal absence is asserted too.
// .env.local is read directly — this script runs outside Next's env loading.
const envFile = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
  : "";

function secretValue(name) {
  const fromEnv = process.env[name];
  const raw = fromEnv || (envFile.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1] ?? "");
  // Strip surrounding quotes. Next.js honours KEY="value" in .env files, so
  // without this the check would compare against a string that includes the
  // quote characters, never match anything in the bundle, and report OK for
  // a secret it had in fact never looked for.
  return raw.trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
}

const secrets = SECRET_VARS.map((name) => ({ name, value: secretValue(name) }));

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let files = 0;
const hits = [];

for (const file of walk(CLIENT_DIR)) {
  files++;
  const content = readFileSync(file, "utf8");

  const keyMatch = content.match(KEY_VALUE_PATTERN);
  if (keyMatch) hits.push({ file, needle: keyMatch[0] });

  for (const { name, value } of secrets) {
    if (content.includes(name)) hits.push({ file, needle: name });
    // A short value would match half the bundle by coincidence; a real
    // token is long, and refusing to check a short one is safer than
    // failing the build on a false positive.
    if (value && value.length >= 16 && content.includes(value))
      hits.push({ file, needle: `<the literal ${name} value>` });
  }
}

if (files === 0) {
  console.error(
    "check-client-bundle: no files found in .next/static — run `next build` first.",
  );
  process.exit(1);
}

if (hits.length > 0) {
  console.error("SECRET LEAK: forbidden strings found in the client bundle:");
  for (const { file, needle } of hits) console.error(`  ${needle} in ${file}`);
  process.exit(1);
}

const checked = secrets.filter((s) => s.value.length >= 16).map((s) => s.name);
console.log(
  `check-client-bundle: OK — scanned ${files} client asset(s); no sb_secret_ key material, no reference to ${SECRET_VARS.join(" / ")}${
    checked.length ? `, literal value absent for ${checked.join(", ")}` : ""
  }.`,
);
