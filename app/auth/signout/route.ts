import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Sign-out is posted from our own <form>, so it arrives urlencoded rather
  // than JSON — check the origin headers only. Blocks cross-site forced
  // logout without breaking the form.
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const sameOrigin =
    (!site || site === "same-origin") &&
    (!origin || origin === new URL(request.url).origin);
  if (!sameOrigin) {
    return NextResponse.json({ error: "Bad request." }, { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), {
    status: 302,
  });
}
