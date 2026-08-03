import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeIngest } from "@/lib/ingest-auth";

export const dynamic = "force-dynamic";

// Stage 3 ingest. The governed local plane pushes metadata here; nothing
// pulls. See migration 0015 for why, and for what is allowed to cross.
//
// The route is deliberately thin. It authenticates, checks the shape, and
// hands the payload to one security-definer function per source. It never
// composes SQL, never reads a table, and never touches a table the
// functions do not name — so the blast radius of a bug here is the four
// tables those functions write, not the whole database the service key
// could otherwise reach.

const SOURCES = {
  "asl-runs": "ingest_work_orders",
  "asl-spend": "ingest_agent_spend",
  agents: "ingest_agents",
  git: "ingest_change_log",
} as const;

type Source = keyof typeof SOURCES;

// A ceiling on one request, not on a sync: the publisher pages through the
// ledger and calls repeatedly, advancing the cursor each time. Without a
// limit a single post could hold a database transaction open for minutes.
const MAX_ITEMS = 1000;

function isSource(value: unknown): value is Source {
  return typeof value === "string" && value in SOURCES;
}

// A deployment with a token but no service key is misconfigured, not
// broken. Saying so beats the bare 500 that an uncaught throw produces:
// the publisher prints whatever comes back, and "500" with an empty body
// sends whoever is setting this up looking in the wrong place.
function adminOr503() {
  try {
    return { client: createAdminClient() };
  } catch (error) {
    return {
      response: NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Ingest is not configured.",
        },
        { status: 503 },
      ),
    };
  }
}

/** Where did this source get to? The publisher asks before it reads. */
export async function GET(request: Request) {
  const auth = authorizeIngest(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const source = new URL(request.url).searchParams.get("source");
  if (!isSource(source))
    return NextResponse.json(
      { error: `source must be one of: ${Object.keys(SOURCES).join(", ")}` },
      { status: 400 },
    );

  const admin = adminOr503();
  if (admin.response) return admin.response;
  const supabase = admin.client;

  const { data, error } = await supabase
    .from("ingest_state")
    .select("source, cursor, last_ingest_at, last_count, last_note")
    .eq("source", source)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { source, cursor: data?.cursor ?? null, state: data ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = authorizeIngest(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Require JSON explicitly. A form-encoded or text/plain body is the one
  // shape a browser can send cross-origin without a preflight, so refusing
  // it removes the only way this endpoint could be reached by a page the
  // user happens to be visiting.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json"))
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null)
    return NextResponse.json({ error: "Body must be an object." }, { status: 400 });

  const { source, items, cursor, note } = body as Record<string, unknown>;

  if (!isSource(source))
    return NextResponse.json(
      { error: `source must be one of: ${Object.keys(SOURCES).join(", ")}` },
      { status: 400 },
    );

  if (!Array.isArray(items))
    return NextResponse.json({ error: "items must be an array." }, { status: 400 });

  if (items.length > MAX_ITEMS)
    return NextResponse.json(
      { error: `Send at most ${MAX_ITEMS} items per request.` },
      { status: 413 },
    );

  if (cursor !== undefined && cursor !== null && typeof cursor !== "string")
    return NextResponse.json({ error: "cursor must be a string." }, { status: 400 });

  const admin = adminOr503();
  if (admin.response) return admin.response;
  const supabase = admin.client;

  let written = 0;

  if (items.length > 0) {
    const { data, error } = await supabase.rpc(SOURCES[source], {
      payload: items,
    });
    if (error)
      return NextResponse.json(
        { error: error.message, hint: "Has migration 0015 been run?" },
        { status: 500 },
      );
    written = typeof data === "number" ? data : 0;
  }

  // The cursor moves even on an empty batch: "I looked and there was
  // nothing new" is exactly as useful to record as "I wrote 40 rows", and
  // it is what makes the sync-status line on IT › Agent Platform honest
  // rather than stuck at the last non-empty run.
  const { error: markError } = await supabase.rpc("ingest_mark", {
    p_source: source,
    p_cursor: typeof cursor === "string" ? cursor : null,
    p_count: written,
    p_note: typeof note === "string" ? note.slice(0, 200) : null,
  });

  if (markError)
    return NextResponse.json(
      { error: markError.message, written, hint: "Rows landed; the cursor did not." },
      { status: 500 },
    );

  return NextResponse.json(
    { source, received: items.length, written },
    { headers: { "cache-control": "no-store" } },
  );
}
