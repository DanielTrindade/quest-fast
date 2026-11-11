import type { Context as HonoContext } from 'hono';
import type { Context } from '../context.ts';

export type AttemptLimiterOptions = {
  limit?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
};

export type AttemptLimiter = ReturnType<typeof createAttemptLimiter>;

export function createAttemptLimiter({
  limit = 20,
  windowMs = 10 * 60_000,
  maxKeys = 10_000,
  now = Date.now,
}: AttemptLimiterOptions = {}) {
  const failures = new Map<string, number[]>();

  function recent(key: string): number[] {
    const cutoff = now() - windowMs;
    const kept = (failures.get(key) ?? []).filter((at) => at > cutoff);
    if (kept.length > 0) failures.set(key, kept);
    else failures.delete(key);
    return kept;
  }

  return {
    /** Seconds until any of the keys may try again; 0 when none is blocked. */
    retryAfter(keys: string[]): number {
      let seconds = 0;
      for (const key of keys) {
        const kept = recent(key);
        if (kept.length < limit) continue;
        seconds = Math.max(seconds, Math.ceil((kept[kept.length - limit] + windowMs - now()) / 1000));
      }
      return seconds;
    },

    fail(keys: string[]): void {
      for (const key of keys) {
        const kept = [...recent(key), now()].slice(-limit);
        // Re-inserting keeps the map ordered by last failure, so the memory
        // cap below evicts whoever has been quiet the longest.
        failures.delete(key);
        failures.set(key, kept);
      }
      if (failures.size <= maxKeys) return;
      for (const key of [...failures.keys()]) recent(key);
      for (const key of failures.keys()) {
        if (failures.size <= maxKeys) break;
        failures.delete(key);
      }
    },
  };
}

/**
 * The origin budget is keyed by the socket address. Forwarded headers are
 * forgeable, so they only count when the operator declares a trusted proxy;
 * then the last hop is the one that proxy appended.
 */
export function originKey(c: HonoContext<Context>): string {
  const forwarded = c.var.deps.env.trustProxy
    ? c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
    : undefined;
  return `ip:${forwarded || c.env?.incoming?.socket.remoteAddress || 'unknown'}`;
}

export function tooManyAttempts(c: HonoContext<Context>, seconds: number) {
  c.header('Retry-After', String(seconds));
  return c.json({ error: 'Muitas tentativas com código inválido. Aguarde alguns minutos e tente de novo.' }, 429);
}
