/**
 * The code is read aloud at the table. The alphabet leaves out characters
 * that get confused when spoken or read: O and 0, I and 1, L.
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 6;

/** Separators that show up when someone copies the code by hand. */
const SEPARATORS = /[\s-]+/g;

/**
 * Largest multiple of the alphabet that fits in a byte. Drawing above this
 * and taking the remainder would bias the first letters of the alphabet.
 */
const UNBIASED_LIMIT = Math.floor(256 / INVITE_ALPHABET.length) * INVITE_ALPHABET.length;

/** Uses Web Crypto, present in Node and in the browser: `shared/` runs on both. */
export function generateInviteCode(): string {
  let code = '';
  const buffer = new Uint8Array(INVITE_CODE_LENGTH);
  while (code.length < INVITE_CODE_LENGTH) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}

/**
 * Returns the code in canonical form, or `undefined` when the input cannot be
 * a code. The caller decides which error to show.
 */
export function normalizeInviteCode(input: string): string | undefined {
  const candidate = input.replace(SEPARATORS, '').toUpperCase();
  if (candidate.length !== INVITE_CODE_LENGTH) return undefined;
  for (const char of candidate) {
    if (!INVITE_ALPHABET.includes(char)) return undefined;
  }
  return candidate;
}
