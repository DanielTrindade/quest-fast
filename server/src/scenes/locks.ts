import { LOCK_TTL_MS, canGrab, type Role, type TokenLock } from '@quest-fast/shared';

/** A token being dragged: who holds it, where, and the last position they sent. */
export type HeldLock = TokenLock & {
  campaignId: string;
  sceneId: string;
  tokenId: string;
  userName: string;
  /** The holder's role: a player who no longer sees the token loses the drag. */
  role: Role;
  /** Bounds the moves are clamped to. */
  mapWidth: number;
  mapHeight: number;
  /** Last position received over the socket; null until the first move. */
  last: { x: number; y: number } | null;
};

export type GrabRequest = Omit<HeldLock, 'expiresAt' | 'last'>;

export type GrabResult = { ok: true; lock: HeldLock } | { ok: false; holder: HeldLock };

/**
 * The token locks of the whole server, in memory (a single process). A lock
 * lives `ttlMs` after the grab or the last move. One that runs out, or whose
 * holder's socket closes, is *abandoned*: the handler saves the last position
 * received and tells the table. A drop by `PATCH` releases it quietly, since
 * the route saves and publishes itself.
 *
 * Reading a lock never runs the handler: a read happens inside a request's
 * transaction, and saving or publishing there could outlive a rollback. An
 * expired lock found by a read binds no one, and its handler runs on the next
 * turn of the event loop, after that transaction.
 */
export type TokenLocks = {
  grab(request: GrabRequest): GrabResult;
  /** Renews the lock and keeps the position; null when `userId` does not hold it. */
  move(tokenId: string, userId: string, x: number, y: number): HeldLock | null;
  /** The live lock on a token, if any. */
  holder(tokenId: string): HeldLock | undefined;
  /** Drops `userId`'s lock without the handler. */
  release(tokenId: string, userId: string): void;
  /** Drops any lock on a token that no longer exists, without the handler. */
  clear(tokenId: string): void;
  /** Drops every lock on a scene's tokens, without the handler: its map changed. */
  clearScene(sceneId: string): void;
  /** Abandons every lock `userId` holds in the campaign: their socket closed. */
  abandon(campaignId: string, userId: string): void;
  onAbandon(handler: (lock: HeldLock) => void): void;
};

export function createTokenLocks({ ttlMs = LOCK_TTL_MS, now = Date.now } = {}): TokenLocks {
  const locks = new Map<string, { lock: HeldLock; timer: NodeJS.Timeout }>();
  const handlers: ((lock: HeldLock) => void)[] = [];

  function drop(tokenId: string): HeldLock | undefined {
    const held = locks.get(tokenId);
    if (!held) return undefined;
    clearTimeout(held.timer);
    locks.delete(tokenId);
    return held.lock;
  }

  function abandoned(tokenId: string) {
    const lock = drop(tokenId);
    if (!lock) return;
    for (const handler of handlers) handler(lock);
  }

  /** Like `abandoned`, but the handler waits for the current call stack to finish. */
  function abandonLater(tokenId: string) {
    const lock = drop(tokenId);
    if (!lock) return;
    setImmediate(() => {
      for (const handler of handlers) handler(lock);
    });
  }

  function keep(lock: HeldLock) {
    const previous = locks.get(lock.tokenId);
    if (previous) clearTimeout(previous.timer);
    const timer = setTimeout(() => abandoned(lock.tokenId), Math.max(0, lock.expiresAt - now()));
    // A lock must never keep the process (or a test run) alive.
    timer.unref();
    locks.set(lock.tokenId, { lock, timer });
  }

  function live(tokenId: string): HeldLock | undefined {
    const held = locks.get(tokenId);
    if (!held) return undefined;
    // The timer may lag behind the clock; an expired lock binds no one.
    if (now() >= held.lock.expiresAt) {
      abandonLater(tokenId);
      return undefined;
    }
    return held.lock;
  }

  return {
    grab(request) {
      const current = live(request.tokenId);
      if (current && !canGrab(current, request.userId, now())) return { ok: false, holder: current };
      const lock: HeldLock = { ...request, expiresAt: now() + ttlMs, last: current?.last ?? null };
      keep(lock);
      return { ok: true, lock };
    },

    move(tokenId, userId, x, y) {
      const current = live(tokenId);
      if (!current || current.userId !== userId) return null;
      const lock = { ...current, expiresAt: now() + ttlMs, last: { x, y } };
      keep(lock);
      return lock;
    },

    holder: live,

    release(tokenId, userId) {
      if (locks.get(tokenId)?.lock.userId === userId) drop(tokenId);
    },

    clear(tokenId) {
      drop(tokenId);
    },

    clearScene(sceneId) {
      for (const { lock } of [...locks.values()]) {
        if (lock.sceneId === sceneId) drop(lock.tokenId);
      }
    },

    abandon(campaignId, userId) {
      for (const { lock } of [...locks.values()]) {
        if (lock.campaignId === campaignId && lock.userId === userId) abandoned(lock.tokenId);
      }
    },

    onAbandon(handler) {
      handlers.push(handler);
    },
  };
}
