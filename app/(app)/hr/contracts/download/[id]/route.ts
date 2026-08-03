import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkPerm } from "@/lib/permissions";

// Contract files never leave the private bucket by URL. This handler
// checks the permission, then mints a short-lived signed URL and
// redirects to it — the link dies in 60 seconds and cannot be shared.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const canRead =
    (await checkPerm("HR: HR Contracts")) ||
    (await checkPerm("Security Tooling: Change Management")) ||
    (await checkPerm("Contracts"));
  if (!canRead) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // RLS on `contracts` is the real gate: a row the caller may not read
  // simply isn't returned.
  const { data: contract } = await supabase
    .from("contracts")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (!contract?.file_path) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(contract.file_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Could not open the file." },
      { status: 400 },
    );
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
