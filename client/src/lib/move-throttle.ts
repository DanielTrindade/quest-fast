import { MOTION_INTERVAL_MS } from './token-motion';

type Point = { x: number; y: number };

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
  /** The drag is over: a move still waiting for its slot is dropped (the drop goes by REST). */
  stop: () => void;
};

/**
 * Paces the moves of a dragged token to one every `intervalMs` (about 30 a
 * second), always sending the newest: a pointer that fires at 120 Hz sends
 * no more, and the last position before a pause still goes out.
 */
export function createMoveThrottle(
  send: (tokenId: string, point: Point) => void,
  { intervalMs = MOTION_INTERVAL_MS, env = browser }: { intervalMs?: number; env?: MoveThrottleEnvironment } = {},
): MoveThrottle {
  let lastSent = Number.NEGATIVE_INFINITY;
  let pending: { tokenId: string; point: Point } | null = null;
  let timer: number | null = null;

  const flush = () => {
    timer = null;
    if (!pending) return;
    const { tokenId, point } = pending;
    pending = null;
    lastSent = env.now();
    send(tokenId, point);
  };

  return {
    move(tokenId, point) {
      pending = { tokenId, point };
      if (timer !== null) return;
      const wait = lastSent + intervalMs - env.now();
      if (wait <= 0) flush();
      else timer = env.setTimer(flush, wait);
    },
    stop() {
      pending = null;
      if (timer !== null) env.clearTimer(timer);
      timer = null;
    },
  };
}
