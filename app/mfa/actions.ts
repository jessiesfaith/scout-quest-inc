"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCodes, hashCode } from "@/lib/recovery-codes";

export type IssueState = {
  error: string | null;
  codes: string[] | null;
};

export type RedeemState = {
  error: string | null;
  cleared: boolean;
};

// Issue a fresh sheet. Requires a 2FA-verified session, because otherwise
// a stolen password would be enough to print a set of codes that defeats
// 2FA forever after — the exact door this whole feature must not open.
export async function issueRecoveryCodes(): Promise<IssueState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", codes: null };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2")
    return {
      error: "Verify with your authenticator first, then generate codes.",
      codes: null,
    };

  const codes = generateCodes();
  const { error } = await supabase.rpc("mfa_recovery_issue", {
    hashes: codes.map(hashCode),
  });

  if (error)
    return {
      error: `${error.message} — has migration 0016 been run?`,
      codes: null,
    };

  // The only time the plaintext exists outside the person's hands.
  return { error: null, codes };
}

// Redeem one code. The caller is signed in with a password but has no
// working authenticator, so this runs at aal1 on purpose.
//
// It does not sign anybody in. On success it removes the enrolled TOTP
// factor and nothing else; the page then walks them through enrolling a
// new one, which is what actually produces a 2FA-verified session.
export async function redeemRecoveryCode(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const raw = String(formData.get("code") ?? "");
  if (raw.trim().length === 0)
    return { error: "Enter one of your recovery codes.", cleared: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: "Sign in with your password first.", cleared: false };

  // The database consumes the code and rate limits the attempt. It is
  // scoped to auth.uid(), so this cannot be aimed at another account.
  const { data: valid, error } = await supabase.rpc("mfa_recovery_redeem", {
    hash: hashCode(raw),
  });

  if (error) return { error: error.message, cleared: false };
  if (valid !== true)
    return {
      error: "That code is not valid, or it has already been used.",
      cleared: false,
    };

  // Only now, with a code proven spent, does the factor come off — and
  // only through the admin API, because unenrolling a verified factor is
  // not something an aal1 session is allowed to do (correctly).
  //
  // Everything below can fail on a network call, and a code that was
  // consumed for a reset that did not happen is the worst possible thing
  // to lose: the person is still locked out and now has one fewer way in.
  // So every failure path hands the code back.
  const giveBack = async (message: string): Promise<RedeemState> => {
    await supabase.rpc("mfa_recovery_unspend", { hash: hashCode(raw) });
    return { error: `${message} Your recovery code has not been used.`, cleared: false };
  };

  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(
    user.id,
  );
  if (lookupError) return giveBack(lookupError.message);

  // TOTP only. `factors` reports every enrolled factor type, and a future
  // phone or WebAuthn factor is a different credential that this flow was
  // never authorised to remove — clearing it would quietly strip a second
  // factor the person still had working.
  const totp = (target.user?.factors ?? []).filter(
    (f) => f.factor_type === "totp",
  );

  if (totp.length === 0)
    return giveBack("There is no authenticator enrolled on this account.");

  // Attempt all of them before reporting: returning inside the loop would
  // leave a half-cleared account with one factor gone and one remaining,
  // which is a state nothing else in this flow expects.
  const failures: string[] = [];
  for (const factor of totp) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    });
    if (deleteError) failures.push(deleteError.message);
  }

  if (failures.length === totp.length) return giveBack(failures[0]);
  if (failures.length > 0)
    return {
      // Partially cleared: the code IS spent, because something did come
      // off. Saying so is better than a reassuring message that leaves
      // them wondering why enrolment still fails.
      error: `Some authenticators could not be removed: ${failures.join("; ")}. Ask an Identity & Access holder to reset two-factor on your account.`,
      cleared: false,
    };

  return { error: null, cleared: true };
}
