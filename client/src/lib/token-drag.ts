import type { MoveThrottle } from './move-throttle';

type Point = { x: number; y: number };

export type TokenDragDeps = {
  /** Asks the server for the lock. */
  grab: (tokenId: string) => Promise<void>;
  /** Saves the position, which also releases the lock. */
  save: (tokenId: string, point: Point) => Promise<void>;
  /** Paces the live moves; stopped when a gesture ends. */
  throttle: MoveThrottle;
  /** The gesture was refused (the lock, or the drop): the token goes back and the viewer is told why. */
  refused: (tokenId: string, error: unknown) => void;
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
};

export type TokenDragController = {
  /** A token with a gesture still settling: it cannot be grabbed or stepped again until then. */
  settling: (tokenId: string) => boolean;
  /** The token being dragged now, if any. */
  active: () => string | null;
  grab: (tokenId: string, origin: Point) => void;
  drag: (tokenId: string, point: Point) => void;
  drop: (tokenId: string, point: Point) => void;
  cancel: (tokenId: string) => void;
  /** The token left the viewer's scene mid-drag (hidden, removed): nothing more is sent. */
  lost: (tokenId: string) => void;
};

/**
 * The drag of tokens: the lock on the first move, its position paced over
 * the socket while held, saved on the drop. A token holds one gesture until
 * that gesture's drop is answered, so a late answer never saves over, or
 * releases the lock of, the next gesture on the same token.
 */
export function createTokenDrag({ grab, save, throttle, refused }: TokenDragDeps): TokenDragController {
  let current: Gesture | null = null;
  const settling = new Set<string>();

  const finish = (gesture: Gesture) => {
    settling.delete(gesture.tokenId);
  };

  const end = (gesture: Gesture) => {
    if (current === gesture) {
      current = null;
      throttle.stop();
    }
  };

  /** The gesture is over and the lock is held: save the drop, or put the token back. */
  const settle = (gesture: Gesture) => {
    const { tokenId, dropped } = gesture;
    const request = gesture.cancelled || !dropped
      ? save(tokenId, gesture.origin).catch(() => {})
      : save(tokenId, dropped).catch((error: unknown) => refused(tokenId, error));
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
    settling: (tokenId) => settling.has(tokenId),
    active: () => current?.tokenId ?? null,

    grab(tokenId, origin) {
      if (settling.has(tokenId)) return;
      const gesture: Gesture = { tokenId, origin, granted: false, latest: null, dropped: null, cancelled: false };
      // A gesture left without a drop goes back: its token must not stay held.
      if (current) cancel(current.tokenId);
      current = gesture;
      settling.add(tokenId);
      grab(tokenId).then(
        () => {
          gesture.granted = true;
          if (gesture.cancelled || gesture.dropped) settle(gesture);
          else if (current === gesture) throttle.move(tokenId, gesture.latest ?? origin);
        },
        (error: unknown) => {
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

    drop(tokenId, point) {
      const gesture = current;
      if (gesture?.tokenId !== tokenId) return;
      end(gesture);
      gesture.dropped = point;
      if (gesture.granted) settle(gesture);
    },

    cancel,
    lost: cancel,
  };
}
