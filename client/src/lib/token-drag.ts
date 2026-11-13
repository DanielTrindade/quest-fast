import type { MoveThrottle } from './move-throttle';

type Point = { x: number; y: number };

/** A drop waiting for confirmation: the lock stays and the table sees the token there. */
export type HeldMove = Point & { tokenId: string };

export type TokenDragDeps = {
  /** Asks the server for the lock. */
  grab: (tokenId: string) => Promise<void>;
  /** Saves the position, which also releases the lock; `free` is the master's move without spending. */
  save: (tokenId: string, point: Point, options?: { free?: boolean }) => Promise<void>;
  /** Paces the live moves; stopped when a gesture ends. */
  throttle: MoveThrottle;
  /** The gesture was refused (the lock, or the drop): the token goes back and the viewer is told why. */
  refused: (tokenId: string, error: unknown) => void;
  /** A drop held for confirmation appeared or ended (null). */
  onHeld?: (held: HeldMove | null) => void;
  /** A gesture is over for good: saved, put back, refused or forgotten. */
  onSettled?: (tokenId: string) => void;
};

/** One drag, from the press to the server's answer about the drop. */
type Gesture = {
  tokenId: string;
  /** Where the token was saved: a cancelled drag goes back there. */
  origin: Point;
  granted: boolean;
  latest: Point | null;
  /** Dropped before the lock arrived: saved once it does. */
  dropped: Point | null;
  /** Cancelled (or its token gone) before the lock arrived: put back once it does, which releases it. */
  cancelled: boolean;
  /** Dropped and waiting for confirmation (a move in a fight). */
  held: Point | null;
  /** The confirmed move spends nothing (the master's choice). */
  free: boolean;
  /** Over without a word to the server: a late answer changes nothing. */
  forgotten: boolean;
};

export type TokenDragController = {
  /** A token with a gesture still settling: it cannot be grabbed or stepped again until then. */
  settling: (tokenId: string) => boolean;
  /** The token being dragged now, if any. */
  active: () => string | null;
  grab: (tokenId: string, origin: Point) => void;
  drag: (tokenId: string, point: Point) => void;
  /** `hold`: the move waits for `confirm` (a fight counts it); the lock stays meanwhile. */
  drop: (tokenId: string, point: Point, options?: { hold?: boolean }) => void;
  /** Saves the held move. */
  confirm: (tokenId: string, options?: { free?: boolean }) => void;
  /** Puts the token back, held or mid-drag, and releases the lock. */
  cancel: (tokenId: string) => void;
  /** The token left the viewer's scene mid-drag (hidden, removed): nothing more is sent. */
  lost: (tokenId: string) => void;
  /**
   * The server already let go of the lock (the turn passed): the gesture ends
   * here, with nothing sent — putting the token back would be refused too.
   */
  forget: (tokenId: string) => void;
  /** The gesture holds the lock (it was granted). */
  granted: (tokenId: string) => boolean;
};

/**
 * The drag of tokens: the lock on the first move, its position paced over
 * the socket while held, saved on the drop — or, in a fight, held where it
 * was dropped until confirmed. A token holds one gesture until that gesture's
 * drop is answered, so a late answer never saves over, or releases the lock
 * of, the next gesture on the same token.
 */
export function createTokenDrag({ grab, save, throttle, refused, onHeld, onSettled }: TokenDragDeps): TokenDragController {
  let current: Gesture | null = null;
  const settling = new Set<string>();

  const finish = (gesture: Gesture) => {
    settling.delete(gesture.tokenId);
    onSettled?.(gesture.tokenId);
  };

  const release = (gesture: Gesture) => {
    if (!gesture.held) return;
    gesture.held = null;
    onHeld?.(null);
  };

  const end = (gesture: Gesture) => {
    if (current === gesture) {
      current = null;
      throttle.stop();
    }
    release(gesture);
  };

  /** The gesture is over and the lock is held: save the drop, or put the token back. */
  const settle = (gesture: Gesture) => {
    const { tokenId, dropped } = gesture;
    const back = () => save(tokenId, gesture.origin).catch(() => {});
    const request = gesture.cancelled || !dropped
      ? back()
      : save(tokenId, dropped, gesture.free ? { free: true } : undefined).catch((error: unknown) => {
        refused(tokenId, error);
        // Refused (past what is left, say): the lock is still ours; going back releases it.
        return back();
      });
    void request.finally(() => finish(gesture));
  };

  const cancel = (tokenId: string) => {
    const gesture = current;
    if (gesture?.tokenId !== tokenId) return;
    end(gesture);
    gesture.cancelled = true;
    if (gesture.granted) settle(gesture);
  };

  return {
    // A held drag may be picked up again to adjust it.
    settling: (tokenId) => settling.has(tokenId) && !(current?.held && current.tokenId === tokenId),
    active: () => current?.tokenId ?? null,

    grab(tokenId, origin) {
      if (current?.held && current.tokenId === tokenId) {
        // Adjusting the held move: the same lock, the same origin.
        release(current);
        return;
      }
      if (settling.has(tokenId)) return;
      const gesture: Gesture = { tokenId, origin, granted: false, latest: null, dropped: null, cancelled: false, held: null, free: false, forgotten: false };
      // A gesture left without a drop goes back: its token must not stay held.
      if (current) cancel(current.tokenId);
      current = gesture;
      settling.add(tokenId);
      grab(tokenId).then(
        () => {
          if (gesture.forgotten) return;
          gesture.granted = true;
          if (gesture.cancelled || gesture.dropped) settle(gesture);
          else if (current === gesture) throttle.move(tokenId, gesture.latest ?? origin);
        },
        (error: unknown) => {
          if (gesture.forgotten) return;
          end(gesture);
          finish(gesture);
          // Already put back by the viewer (a pinch), or gone: nothing to say.
          if (!gesture.cancelled) refused(tokenId, error);
        },
      );
    },

    drag(tokenId, point) {
      const gesture = current;
      if (gesture?.tokenId !== tokenId) return;
      gesture.latest = point;
      if (gesture.granted) throttle.move(tokenId, point);
    },

    drop(tokenId, point, options) {
      const gesture = current;
      if (gesture?.tokenId !== tokenId) return;
      if (options?.hold) {
        // The table keeps seeing it there, and the lock stays alive, until confirmed.
        gesture.held = point;
        gesture.latest = point;
        if (gesture.granted) throttle.move(tokenId, point);
        onHeld?.({ tokenId, ...point });
        return;
      }
      end(gesture);
      gesture.dropped = point;
      if (gesture.granted) settle(gesture);
    },

    confirm(tokenId, options) {
      const gesture = current;
      if (gesture?.tokenId !== tokenId || !gesture.held) return;
      const point = gesture.held;
      end(gesture);
      gesture.dropped = point;
      gesture.free = options?.free === true;
      if (gesture.granted) settle(gesture);
    },

    cancel,
    lost: cancel,

    forget(tokenId) {
      const gesture = current;
      if (gesture?.tokenId !== tokenId) return;
      end(gesture);
      // A grant still on its way finds the gesture over and puts nothing back.
      gesture.forgotten = true;
      finish(gesture);
    },

    granted: (tokenId) => current?.tokenId === tokenId && current.granted,
  };
}
