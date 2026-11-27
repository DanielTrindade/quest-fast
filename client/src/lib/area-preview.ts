import { AREA_LIMITS, type AreaGeometry, type SocketMessage } from '@quest-fast/shared';

type Previewing = Extract<SocketMessage, { type: 'area.previewing' }>;

/** A reference area someone else is drawing, as the map draws it. */
export type ShownPreview = { userId: string; name: string; sceneId: string; area: AreaGeometry; done: boolean };

type Entry = ShownPreview & { receivedAt: number };

/** What the map reads to draw the reference areas of others; the screen feeds it from the socket. */
export type AreaPreviewSource = {
  /** The previews still standing at local time `now`, on this scene. */
  shown(sceneId: string, now: number): ShownPreview[];
  /** Whether a preview still stands at `now`: the canvas keeps drawing to drop it on time. */
  animating(now: number): boolean;
  /** Called on every message, so an idle canvas wakes up. */
  subscribe(listener: () => void): () => void;
};

export type AreaPreviewStore = AreaPreviewSource & {
  push(message: Previewing, receivedAt: number): void;
  /** The connection fell: no clear will arrive for what was being drawn. */
  reset(): void;
};

/**
 * Whether a preview still stands at `now`: one let go stays
 * `previewLingerMs`; one still being drawn goes after `previewStaleMs`
 * without news (its author left, or it went under the fog).
 */
export function previewStands(entry: { done: boolean; receivedAt: number }, now: number): boolean {
  const limit = entry.done ? AREA_LIMITS.previewLingerMs : AREA_LIMITS.previewStaleMs;
  return now - entry.receivedAt <= limit;
}

/** One preview per author, outside React: 30 updates a second never re-render. */
export function createAreaPreviewStore(): AreaPreviewStore {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    push(message, receivedAt) {
      const { userId, name } = message.by;
      if (message.area) entries.set(userId, { userId, name, sceneId: message.sceneId, area: message.area, done: message.done, receivedAt });
      else entries.delete(userId);
      notify();
    },
    reset() {
      if (entries.size === 0) return;
      entries.clear();
      notify();
    },
    shown(sceneId, now) {
      const result: ShownPreview[] = [];
      for (const [userId, entry] of entries) {
        if (!previewStands(entry, now)) entries.delete(userId);
        else if (entry.sceneId === sceneId) result.push({ userId, name: entry.name, sceneId, area: entry.area, done: entry.done });
      }
      return result;
    },
    animating(now) {
      for (const entry of entries.values()) if (previewStands(entry, now)) return true;
      return false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
