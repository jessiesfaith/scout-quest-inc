// Asserts the Supabase secret never reaches the browser.
// Scans every asset Next.js serves to the client (.next/static) for:
//   1. an actual sb_secret_... key value (prefix followed by key material),
//   2. the SUPABASE_SECRET_KEY variable name,
//   3. the literal secret value from the environment, when one is set.
// The bare string "sb_secret_" alone is NOT flagged: @supabase/supabase-js
// ships a key-format validator (`e.startsWith("sb_secret_")`) that legitimately
// contains the prefix with no key material after it.
// Runs automatically after `npm run build` (postbuild). Exits 1 on any hit.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = join(process.cwd(), ".next", "static");
const KEY_VALUE_PATTERN = /sb_secret_[A-Za-z0-9_-]{4,}/;

// Pick up the real secret (if set) so we can assert its literal absence too.
// .env.local is read directly — this script runs outside Next's env loading.
let secretValue = process.env.SUPABASE_SECRET_KEY ?? "";
if (!secretValue && existsSync(".env.local")) {
  const match = readFileSync(".env.local", "utf8").match(
    /^SUPABASE_SECRET_KEY=(.+)$/m,
  );
  if (match) secretValue = match[1].trim();
}

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
  if (content.includes("SUPABASE_SECRET_KEY"))
    hits.push({ file, needle: "SUPABASE_SECRET_KEY" });
  if (secretValue && content.includes(secretValue))
    hits.push({ file, needle: "<the literal SUPABASE_SECRET_KEY value>" });
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

console.log(
  `check-client-bundle: OK — scanned ${files} client asset(s); no sb_secret_ key material, no SUPABASE_SECRET_KEY reference${secretValue ? ", secret value confirmed absent" : ""}.`,
);
