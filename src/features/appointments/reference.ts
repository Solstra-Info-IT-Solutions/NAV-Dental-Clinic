import { randomInt } from "node:crypto";

/** Crockford Base32 alphabet: no I, L, O or U, so references are easy to read aloud over the phone. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Random, non-sequential booking reference "NAV-XXXX-XXXX-XX" (10 symbols ≈ 50
 * bits from a CSPRNG). Uniqueness is enforced by the unique index; callers
 * retry on the rare collision.
 */
export function generateReference(): string {
  let symbols = "";
  for (let i = 0; i < 10; i++) symbols += ALPHABET[randomInt(ALPHABET.length)];
  return `NAV-${symbols.slice(0, 4)}-${symbols.slice(4, 8)}-${symbols.slice(8)}`;
}
