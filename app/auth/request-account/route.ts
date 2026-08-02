import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/same-origin";
import { NDA_VERSION } from "@/lib/constants";

// Files an account request for the owner to review. Never creates a login.
// Consent is recorded with the NDA version and a server-side timestamp;
// RLS only allows status='pending' inserts from the public.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad request." }, { status: 403 });
  }

  let body: { name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // One open request per email — repeat submits are a no-op, not a pile of
  // duplicate rows in the owner's queue. (Anon cannot read the table, so
  // this dedupe runs against the insert's own unique failure below.)
  const { error } = await supabase.from("account_requests").insert({
    name: name || null,
    email,
    nda_accepted: true,
    nda_version: NDA_VERSION,
    privacy_accepted: true,
    accepted_at: new Date().toISOString(),
    status: "pending",
  });

  // 23505 = unique violation: a pending request for this email already
  // exists. Answer as success — resubmitting is harmless from the user's
  // point of view and the owner already has the request.
  if (error && error.code !== "23505") {
    return NextResponse.json(
      { error: "Could not send the request. Try again later." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
