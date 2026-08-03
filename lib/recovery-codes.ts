import { createHash, randomInt } from "node:crypto";

// Recovery codes. Ten of them, each 20 characters of Crockford-style
// base32 in four groups — about 100 bits, which is far past guessable and
// still short enough to read off paper without a mistake.
//
// The alphabet excludes I, L, O and U: the first three are the classic
// misreads against 1 and 0, and dropping U is the cheap way to guarantee
// a code never spells something unfortunate. Normalization on the way in
// maps the confusable characters back, so someone who types "l" instead
// of "1" is not locked out by their own handwriting.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 4;
const GROUP_LEN = 5;
export const CODE_COUNT = 10;

export function generateCode() {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let out = "";
    // randomInt is rejection-sampled, so no modulo bias — which matters
    // here because the alphabet is 32 characters and a naive
    // `randomBytes % 32` would be fine, but only by accident of the size.
    for (let i = 0; i < GROUP_LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(out);
  }
  return groups.join("-");
}

export function generateCodes(count = CODE_COUNT) {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateCode());
  return [...codes];
}

/** Strip formatting and fold the characters people reliably mistype. */
export function normalizeCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
}

/** Hash for storage and comparison. See migration 0016 for why sha-256. */
export function hashCode(input: string) {
  return createHash("sha256").update(normalizeCode(input), "utf8").digest("hex");
}
