import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/same-origin";

// Sign-in endpoint for the wired index.html form. Uses the server client
// so the session lands in cookies (what the app + proxy read).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Bad request." }, { status: 403 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Generic message: upstream text distinguishes "user not found" from
    // "wrong password" on some paths, which enumerates accounts.
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
