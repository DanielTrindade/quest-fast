import { MOTION_INTERVAL_MS, MOTION_STALE_MS } from './token-motion';

type Point = { x: number; y: number };

/**
 * While the pointer rests, the last position is sent again this often: it
 * renews the lock (3 s on the server) and keeps the track of whoever watches
 * alive (`MOTION_STALE_MS`), so a pause is not taken for a dropped token.
 */
export const KEEP_ALIVE_MS = MOTION_STALE_MS / 2;

export type MoveThrottleEnvironment = {
  now: () => number;
  setTimer: (run: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
};

const browser: MoveThrottleEnvironment = {
  now: () => performance.now(),
  setTimer: (run, ms) => window.setTimeout(run, ms),
  clearTimer: (id) => window.clearTimeout(id),
};

export type MoveThrottle = {
  /** The pointer moved the token: sent now, or with the next slot, whichever the pace allows. */
  move: (tokenId: string, point: Point) => void;
  /** The drag is over: nothing more goes out, not even a move waiting for its slot (the drop goes by REST). */
  stop: () => void;
};

type Move = { tokenId: string; point: Point };

/**
 * Paces the moves of a dragged token to one every `intervalMs` (about 30 a
 * second), always sending the newest: a pointer that fires at 120 Hz sends
 * no more, and the last position before a pause still goes out. While the
 * pointer rests, that position is sent again every `keepAliveMs` until `stop`.
 */
export function createMoveThrottle(
  send: (tokenId: string, point: Point) => void,
  { intervalMs = MOTION_INTERVAL_MS, keepAliveMs = KEEP_ALIVE_MS, env = browser }: {
    intervalMs?: number; keepAliveMs?: number; env?: MoveThrottleEnvironment;
  } = {},
): MoveThrottle {
  let lastSent = Number.NEGATIVE_INFINITY;
  let pending: Move | null = null;
  let last: Move | null = null;
  let timer: number | null = null;
  /** The timer waits for the next slot (not for a keep-alive). */
  let slot = false;

  const clear = () => {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
    slot = false;
  };

  const flush = () => {
    clear();
    const next = pending ?? last;
    if (!next) return;
    pending = null;
    last = next;
    lastSent = env.now();
    send(next.tokenId, next.point);
    timer = env.setTimer(flush, keepAliveMs);
  };

  return {
    move(tokenId, point) {
      pending = { tokenId, point };
      if (slot) return;
      const wait = lastSent + intervalMs - env.now();
      if (wait <= 0) {
        flush();
        return;
      }
      clear();
      slot = true;
      timer = env.setTimer(flush, wait);
    },
    stop() {
      clear();
      pending = null;
      last = null;
    },
  };
}
