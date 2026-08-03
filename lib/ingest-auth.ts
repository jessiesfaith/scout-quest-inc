import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// The publisher is a script on the governed plane, not a browser, so the
// gate is a bearer token rather than a session. Deliberate properties:
//
//   * Fail closed. With INGEST_TOKEN unset the route rejects everything.
//     An ingest endpoint that silently opens when a variable is missing is
//     how a staging deploy ends up world-writable.
//   * Constant-time comparison. `===` on a secret leaks its prefix through
//     timing to anyone who can measure a few thousand requests.
//   * No cookies are read anywhere on this route, so a browser that is
//     signed in carries no ambient authority to it — there is nothing for
//     a cross-site request to ride on.

export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

export function authorizeIngest(request: Request): AuthResult {
  const expected = process.env.INGEST_TOKEN;
  if (!expected || expected.length < 32) {
    return {
      ok: false,
      status: 503,
      error:
        "Ingest is not configured on this deployment (INGEST_TOKEN missing or too short).",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return { ok: false, status: 401, error: "Missing bearer token." };

  // Compare fixed-width digests rather than the tokens themselves.
  // timingSafeEqual throws outright on a length mismatch, so it cannot be
  // handed two raw tokens; hashing first makes both operands exactly 32
  // bytes and removes the need for any length branch.
  //
  // To be precise about what this does and does not hide: the CONTENT of
  // the token is compared in constant time, so no prefix leaks. The
  // token's LENGTH is not hidden — hashing is not constant-time in its
  // input size, and nothing here could hide it anyway. That is fine: the
  // token is a fixed-length random string whose length is not a secret,
  // and it is stated rather than glossed over because a comment claiming
  // more than the code delivers is how the next person stops checking.
  const presented = createHash("sha256").update(match[1], "utf8").digest();
  const secret = createHash("sha256").update(expected, "utf8").digest();

  if (!timingSafeEqual(presented, secret))
    return { ok: false, status: 401, error: "Bad token." };

  return { ok: true };
}
