import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// The service-role client. It bypasses row-level security completely.
// Three callers, all of them places where there is no user session to act
// as, so no RLS identity exists to write with:
//
//   1. app/api/ingest/route.ts — the publisher is a script, not a person.
//   2. app/mfa/actions.ts (redeemRecoveryCode) — unenrolling a verified
//      factor needs the admin API; an aal1 session cannot, correctly.
//   3. app/(app)/it/identity-access/actions.ts (resetTwoFactor) — same
//      admin API, for someone else's account.
//
// Keep that list accurate. It is the only inventory of what holds this
// capability, and a comment claiming "exactly one caller" while three
// exist is worse than no comment.
//
// Rules that keep this from becoming the back door that undoes the rest of
// the app's access control:
//
//   * `import "server-only"` makes importing this from a client component
//     a build error, and scripts/check-client-bundle.mjs fails the build
//     if the key or even its variable name reaches a browser asset. Two
//     independent controls, because the cost of this one leaking is every
//     table in the database.
//   * The ingest route's writes all go through the security-definer
//     functions in migration 0015, each of which touches one table. It
//     does read one table directly — `ingest_state`, to answer the
//     publisher's "where did I get to?" — and that is the only read.
//   * The two 2FA callers use it for the Auth admin API only, never for
//     table access.
//   * No session is persisted and no token refreshed — this client must
//     never end up holding a user's identity alongside its own.
//
// Before this existed the app used only the publishable key, and that was
// worth keeping for as long as it lasted. It stopped being possible when
// data had to arrive from outside a browser.

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set for ingest.",
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
