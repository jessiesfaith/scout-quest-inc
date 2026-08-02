import { readFile } from "node:fs/promises";
import path from "node:path";

// The public site IS Jessica's hand-built index.html at the repo root —
// served verbatim, never converted. She edits the file; this route picks
// up every save. The only modification: one injected <script> that wires
// her sign-in / request-account / reset forms (by their element ids) to
// real Supabase auth. See public/login-wire.js for the id contract.

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), "index.html"),
    "utf8",
  );

  const wired = html.replace(
    "</body>",
    `<script src="/login-wire.js" defer></script>\n</body>`,
  );

  return new Response(wired, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
