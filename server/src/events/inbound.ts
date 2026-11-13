import type { WebSocket } from 'ws';
import type { Db } from '@quest-fast/db';
import { clampToMap, type ClientSocketMessage } from '@quest-fast/shared';
import type { TokenLocks } from '../scenes/locks.ts';
import { movingAudience } from '../scenes/tokens.ts';
import type { EventHub, Viewer } from './hub.ts';

/** Largest message a client may send; a `token.move` is well under 100 bytes. */
export const INBOUND_MAX_BYTES = 1024;

/** Messages a socket may send per second; the rest of the second is dropped. */
export const INBOUND_PER_SECOND = 40;

/** A `token.move` as it arrived, or null for anything else. */
export function parseClientMessage(raw: string): ClientSocketMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { type, tokenId, x, y } = value as Record<string, unknown>;
  if (type !== 'token.move' || typeof tokenId !== 'string' || tokenId.length === 0 || tokenId.length > 64) return null;
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
 * What the server does with what a client sends: only `token.move`, only
 * from whoever holds the token's lock, relayed to whoever sees the token and
 * never saved. Anything else is ignored without an answer, as is a message
 * past the rate.
 */
export function receiveFrom(
  deps: { db: Db; hub: EventHub; locks: TokenLocks },
  connection: Viewer & { campaignId: string; socket: WebSocket },
) {
  const allowed = createRateLimit();
  return (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
    if (isBinary || !allowed()) return;
    const message = parseClientMessage(data.toString());
    if (!message) return;

    const lock = deps.locks.holder(message.tokenId);
    if (!lock || lock.userId !== connection.userId || lock.campaignId !== connection.campaignId) return;
    const { x, y } = clampToMap(message.x, message.y, lock.mapWidth, lock.mapHeight);
    const audience = movingAudience(deps.db, connection.campaignId, message.tokenId);
    if (!audience) return;
    // Hidden meanwhile (on the map or in the encounter): the PATCH would be a
    // 404 for this sender, so the socket cannot move it either.
    if (!audience(connection)) {
      deps.locks.release(message.tokenId, connection.userId);
      return;
    }
    deps.locks.move(message.tokenId, connection.userId, x, y);
    deps.hub.publishTokenMoving(connection.campaignId, { tokenId: message.tokenId, x, y, ts: Date.now() }, audience, connection.socket);
  };
}
