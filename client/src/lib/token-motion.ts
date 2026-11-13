/**
 * Where a token someone else is dragging should be drawn. The server relays
 * `token.moving` about 30 times a second (one every `MOTION_INTERVAL_MS`),
 * stamped with its clock; the network adds jitter. Drawing each message as it
 * arrives stutters, so the receiver draws slightly in the past — one interval
 * plus the jitter allowance — and interpolates between the two samples around
 * that moment. With reduced motion, the token jumps to the newest sample.
 */

/** The sender's pace: about 30 moves a second. */
export const MOTION_INTERVAL_MS = 33;
/** The network's lateness the buffer absorbs. */
export const MOTION_JITTER_MS = 30;
/** How far in the past the receiver draws. */
export const MOTION_DELAY_MS = MOTION_INTERVAL_MS + MOTION_JITTER_MS;
/** A drag silent for this long is over (dropped, or its sender gone): the token goes back to its saved place. */
export const MOTION_STALE_MS = 1000;
/** Samples kept per token: far more than the delay needs. */
const KEEP = 16;

type Point = { x: number; y: number };
type Sample = Point & { at: number };

export type MotionTrack = {
  samples: Sample[];
  /** Local clock minus the server's, from the least delayed sample seen. */
  offset: number;
  /** Local time the newest sample arrived. */
  lastReceived: number;
};

export function createTrack(): MotionTrack {
  return { samples: [], offset: Number.POSITIVE_INFINITY, lastReceived: Number.NEGATIVE_INFINITY };
}

/** Adds a `token.moving` (`ts` is the server's clock) received at `receivedAt` (the local one). */
export function pushSample(track: MotionTrack, sample: Point & { ts: number }, receivedAt: number): void {
  track.offset = Math.min(track.offset, receivedAt - sample.ts);
  track.lastReceived = Math.max(track.lastReceived, receivedAt);
  const entry = { x: sample.x, y: sample.y, at: sample.ts };
  // Messages may arrive out of order; the track stays sorted by the server's time.
  let index = track.samples.length;
  while (index > 0 && track.samples[index - 1].at > entry.at) index -= 1;
  track.samples.splice(index, 0, entry);
  if (track.samples.length > KEEP) track.samples.splice(0, track.samples.length - KEEP);
}

/**
 * The position to draw at local time `now`, or null when the track is empty
 * or stale. Never extrapolates: past the newest sample, it holds there.
 */
export function positionAt(track: MotionTrack, now: number, { reducedMotion = false } = {}): Point | null {
  const { samples } = track;
  if (samples.length === 0 || now - track.lastReceived > MOTION_STALE_MS) return null;
  const last = samples[samples.length - 1];
  if (reducedMotion) return { x: last.x, y: last.y };
  const renderAt = now - track.offset - MOTION_DELAY_MS;
  if (renderAt <= samples[0].at) return { x: samples[0].x, y: samples[0].y };
  if (renderAt >= last.at) return { x: last.x, y: last.y };
  let after = 1;
  while (samples[after].at < renderAt) after += 1;
  const from = samples[after - 1];
  const to = samples[after];
  const t = to.at === from.at ? 1 : (renderAt - from.at) / (to.at - from.at);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** What the map reads to draw tokens in motion; the screen feeds it from the socket. */
export type TokenMotionSource = {
  positionOf(tokenId: string, now: number, options?: { reducedMotion?: boolean }): Point | null;
  /** Whether any token is still moving at `now`: the canvas keeps drawing while one is. */
  animating(now: number): boolean;
  /** Called on every new sample, so an idle canvas wakes up. */
  subscribe(listener: () => void): () => void;
};

export type TokenMotionStore = TokenMotionSource & {
  push(message: Point & { tokenId: string; ts: number }, receivedAt: number): void;
  /** Forgets a token's drag: the saved position (`scene.updated`) wins from here. */
  clear(tokenId: string): void;
};

/** One track per token, outside React: 30 updates a second never re-render. */
export function createMotionStore(): TokenMotionStore {
  const tracks = new Map<string, MotionTrack>();
  const listeners = new Set<() => void>();
  return {
    push(message, receivedAt) {
      let track = tracks.get(message.tokenId);
      if (!track) {
        track = createTrack();
        tracks.set(message.tokenId, track);
      }
      pushSample(track, message, receivedAt);
      for (const listener of listeners) listener();
    },
    clear(tokenId) {
      tracks.delete(tokenId);
    },
    positionOf(tokenId, now, options) {
      const track = tracks.get(tokenId);
      if (!track) return null;
      const position = positionAt(track, now, options);
      if (!position) tracks.delete(tokenId);
      return position;
    },
    animating(now) {
      for (const track of tracks.values()) {
        if (now - track.lastReceived <= MOTION_STALE_MS) return true;
      }
      return false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
