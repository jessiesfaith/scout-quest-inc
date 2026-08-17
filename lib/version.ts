// What is actually deployed right now.
//
// This exists because the question "is the code I am looking at the code that
// is running?" had no answer on 2026-08-06: a merge to master was made, the
// live site still served the previous build, and the only way to tell was to
// count sub-tabs. A footer that names the build turns that into a glance.
//
// TWO KINDS OF FACT, AND THEY ARE NOT EQUAL.
//
//   APP_VERSION and SCHEMA_VERSION are CLAIMS. A human types them. They can be
//   wrong, and the only thing keeping them right is
//   scripts/governance/version-check.mjs, which refuses to pass if
//   SCHEMA_VERSION disagrees with the migrations on disk.
//
//   commit, branch, env and builtAt are EVIDENCE. Vercel injects them at build
//   time from the git ref it actually built. Nobody types them and nobody can
//   edit them without changing what was built.
//
// The footer shows both and the distinction matters: if you are reconciling
// this system against reality, the commit sha is the thing to trust. The
// version number is a label for humans.

import pkg from "../package.json";

/** Human-facing release label. Bump in package.json, not here. */
export const APP_VERSION: string = pkg.version;

/**
 * The highest migration this code expects to be applied.
 *
 * Hand-maintained ON PURPOSE, and then checked. Deriving it by reading
 * supabase/migrations/ at runtime would mean shipping that directory into the
 * serverless bundle and trusting the filesystem; deriving it at build time
 * would mean a codegen step. Both are more machinery than a constant plus a
 * deterministic check that fails loudly.
 *
 * If you add a migration, bump this and run:
 *   node scripts/governance/version-check.mjs
 */
export const SCHEMA_VERSION = "0028";

export type BuildInfo = {
  version: string;
  schema: string;
  /** Short commit sha, or null when not built by Vercel. */
  commit: string | null;
  branch: string | null;
  /** "production" | "preview" | "development" | null */
  env: string | null;
  builtAt: string | null;
};

/**
 * Read once, at module load, on the server.
 *
 * VERCEL_* are build-time environment variables Vercel sets from the git ref
 * it built. They are NOT prefixed NEXT_PUBLIC_, so they never reach the
 * browser bundle — this must only be called from a server component.
 */
export function buildInfo(): BuildInfo {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return {
    version: APP_VERSION,
    schema: SCHEMA_VERSION,
    commit: sha ? sha.slice(0, 7) : null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env: process.env.VERCEL_ENV ?? null,
    // Set at build, so it is the build time rather than the request time.
    builtAt: process.env.VERCEL ? new Date().toISOString() : null,
  };
}

/**
 * One line, for the footer.
 *
 * Local development says so plainly rather than inventing a commit, because a
 * footer that claims a build identity it does not have is worse than one that
 * admits it is local.
 */
export function buildLabel(b: BuildInfo): string {
  const parts = [`v${b.version}`, `schema ${b.schema}`];
  if (b.commit) {
    parts.push(b.branch ? `${b.commit} on ${b.branch}` : b.commit);
  } else {
    parts.push("local dev — not a deployed build");
  }
  if (b.env && b.env !== "production") parts.push(b.env);
  return parts.join(" · ");
}
