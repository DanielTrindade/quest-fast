import { generateInviteCode } from '@quest-fast/shared';

const MAX_ATTEMPTS = 5;

// Drizzle wraps driver errors; the SQLite "UNIQUE constraint failed" text only
// survives in the cause chain.
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes('UNIQUE')) return true;
  }
  return false;
}

/**
 * The code is unique by index in the database. A collision is unlikely, but
 * the retry keeps the write deterministic instead of erroring at the master.
 */
export function withUniqueCode<T>(attempt: (code: string) => T, generate: () => string = generateInviteCode): T {
  for (let tries = 1; ; tries++) {
    try {
      return attempt(generate());
    } catch (error) {
      if (!isUniqueViolation(error) || tries === MAX_ATTEMPTS) throw error;
    }
  }
}
