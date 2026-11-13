import type { Server } from 'node:http';
import type { ServerType } from '@hono/node-server';
import { WebSocketServer, type WebSocket } from 'ws';
import { and, eq } from 'drizzle-orm';
import { campaignMembers, type Db } from '@quest-fast/db';
import type { Role } from '@quest-fast/shared';
import { SESSION_COOKIE, sessionUser } from '../auth/session.ts';
import type { TokenLocks } from '../scenes/locks.ts';
import type { EventHub } from './hub.ts';
import { INBOUND_MAX_BYTES, receiveFrom } from './inbound.ts';

function sessionIdFromCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === SESSION_COOKIE && rest.length > 0) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function campaignRole(db: Db, campaignId: string, userId: string): Role | undefined {
  const member = db
    .select({ role: campaignMembers.role })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
    .get();
  return member?.role;
}

/**
 * Authorization happens before the upgrade: a socket that fails the session
 * or membership check is destroyed and never joins the room. Same rule as the
 * REST routes — 404-style refusal, no hint that the campaign exists.
 *
 * The socket receives one message, `token.move` (see `inbound.ts`); a frame
 * over `INBOUND_MAX_BYTES` closes it. When the user's last socket in the
 * campaign closes, every lock they held there is abandoned: the token stays
 * where it was last seen.
 */
export function attachWebSocket(server: ServerType, deps: { db: Db; hub: EventHub; locks: TokenLocks }) {
  const httpServer = server as Server;
  const wss = new WebSocketServer({ noServer: true, maxPayload: INBOUND_MAX_BYTES });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const match = /^\/api\/campaigns\/([^/]+)\/ws$/.exec(url.pathname);
    if (!match) return socket.destroy();

    const campaignId = decodeURIComponent(match[1]);
    const sessionId = sessionIdFromCookie(request.headers.cookie);
    const user = sessionId ? sessionUser(deps.db, sessionId) : undefined;
    if (!user) return socket.destroy();

    const role = campaignRole(deps.db, campaignId, user.id);
    if (!role) return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      deps.hub.join(campaignId, { role, userId: user.id }, ws);
      ws.on('message', receiveFrom(deps, { campaignId, role, userId: user.id, socket: ws }));
      // The hub drops the socket first (its own 'close' listener came first),
      // so this asks about the user's other tabs. Their drag goes on; a lock
      // nobody renews runs out by itself.
      ws.on('close', () => {
        if (!deps.hub.connected(campaignId, user.id)) deps.locks.abandon(campaignId, user.id);
      });
      // An oversized or malformed frame: ws closes the socket itself, and an
      // unheard 'error' would take the whole process down.
      ws.on('error', () => {});
      wss.emit('connection', ws, request);
    });
  });
}