import type { WebSocket } from 'ws';
import type { Db } from '@quest-fast/db';
import { clampToMap, validateAreaGeometry, type ClientSocketMessage } from '@quest-fast/shared';
import type { TokenLocks } from '../scenes/locks.ts';
import { previewAudience } from '../scenes/preview.ts';
import { movingAudience } from '../scenes/tokens.ts';
import type { EventHub, Viewer } from './hub.ts';

/** Largest message a client may send; a `token.move` is well under 100 bytes, an `area.preview` under 300. */
export const INBOUND_MAX_BYTES = 1024;

/** Messages a socket may send per second; the rest of the second is dropped. */
export const INBOUND_PER_SECOND = 40;

const ID_MAX = 64;

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
}

/** A `token.move` or an `area.preview` as it arrived, or null for anything else. */
export function parseClientMessage(raw: string): ClientSocketMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.type === 'area.preview') {
    const { sceneId, area, done } = message;
    if (!isId(sceneId) || (done !== undefined && typeof done !== 'boolean')) return null;
    if (area === null) return { type: 'area.preview', sceneId, area: null, done: done ?? false };
    const read = validateAreaGeometry(area);
    return 'geometry' in read ? { type: 'area.preview', sceneId, area: read.geometry, done: done ?? false } : null;
  }
  const { type, tokenId, x, y } = message;
  if (type !== 'token.move' || !isId(tokenId)) return null;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { type, tokenId, x, y };
}

/** Counts a socket's messages in one-second windows. */
export function createRateLimit(perSecond = INBOUND_PER_SECOND, now = Date.now) {
  let windowStart = 0;
  let used = 0;
  return () => {
    const time = now();
    if (time - windowStart >= 1000) {
      windowStart = time;
      used = 0;
    }
    used += 1;
    return used <= perSecond;
  };
}

/**
 * What the server does with what a client sends, never saved: a
 * `token.move`, only from whoever holds the token's lock, relayed to whoever
 * sees the token; an `area.preview` on the scene open for the table, relayed
 * to whoever may see the area. Anything else is ignored without an answer,
 * as is a message past the rate.
 */
export function receiveFrom(
  deps: { db: Db; hub: EventHub; locks: TokenLocks },
  connection: Viewer & { campaignId: string; socket: WebSocket },
) {
  const allowed = createRateLimit();
  // Where this socket's reference area last was: a clear goes to whoever could see it there.
  const preview: PreviewState = { last: null };
  return (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
    if (isBinary || !allowed()) return;
    const message = parseClientMessage(data.toString());
    if (!message) return;
    if (message.type === 'area.preview') {
      relayPreview(deps, connection, message, preview);
      return;
    }

    const lock = deps.locks.holder(message.tokenId);
    if (!lock || lock.userId !== connection.userId || lock.campaignId !== connection.campaignId) return;
    const { x, y } = clampToMap(message.x, message.y, lock.mapWidth, lock.mapHeight);
    const audience = movingAudience(deps.db, connection.campaignId, message.tokenId, { x, y });
    if (!audience) return;
    // Hidden meanwhile (on the map or in the encounter): the PATCH would be a
    // 404 for this sender, so the socket cannot move it either. The fog never
    // stops the sender: the master sees every token, a player only moves a
    // character's, which shows under the fog.
    if (!audience(connection)) {
      deps.locks.release(message.tokenId, connection.userId);
      return;
    }
    deps.locks.move(message.tokenId, connection.userId, x, y);
    deps.hub.publishTokenMoving(connection.campaignId, { tokenId: message.tokenId, x, y, ts: Date.now() }, audience, connection.socket);
  };
}

type PreviewState = { last: { x: number; y: number } | null };

/**
 * Relays a reference area to whoever may see it, the sender excepted. A
 * clear goes to whoever could see it where it last was, so it tells nobody
 * else that an area existed.
 */
function relayPreview(
  deps: { db: Db; hub: EventHub },
  connection: Viewer & { campaignId: string; socket: WebSocket },
  message: Extract<ClientSocketMessage, { type: 'area.preview' }>,
  state: PreviewState,
) {
  const { area } = message;
  const at = area ? { x: area.x, y: area.y } : state.last;
  if (!at) return;
  const audience = previewAudience(deps.db, connection, message.sceneId, at);
  if (!audience) return;
  const clamped = area ? { ...area, ...clampToMap(area.x, area.y, audience.map.width, audience.map.height) } : null;
  state.last = clamped && !message.done ? { x: clamped.x, y: clamped.y } : null;
  deps.hub.publishAreaPreview(
    connection.campaignId,
    {
      sceneId: message.sceneId,
      by: { userId: connection.userId, name: audience.name },
      area: clamped,
      done: message.done,
      ts: Date.now(),
    },
    audience.canSee,
    connection.socket,
  );
}
