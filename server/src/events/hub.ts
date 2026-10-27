import type { WebSocket } from 'ws';
import type { EncounterView, Role, SessionEvent, SocketMessage } from '@quest-fast/shared';
import { redactEvent } from './redact.ts';

/** Who sits behind a socket: what every projection and redaction needs. */
export type Viewer = { role: Role; userId: string };

type Connection = Viewer & {
  campaignId: string;
  socket: WebSocket;
};

/**
 * One room per campaign, decided at the handshake: a socket never changes
 * campaigns. The server decides who receives what — secret events reach only
 * masters, over the socket exactly as in the feed read, and an encounter goes
 * out as each viewer may see it.
 */
export type EventHub = {
  publish(campaignId: string, event: SessionEvent): void;
  /**
   * Sends `combat.updated` with what `project` returns for each connection;
   * `null` means this viewer may not know the encounter, and nothing is sent.
   */
  publishCombat(campaignId: string, project: (viewer: Viewer) => EncounterView | null): void;
  /** Sends `combat.deleted` to each connection whose viewer `couldSee` the encounter. */
  publishCombatDeleted(campaignId: string, encounterId: string, couldSee: (viewer: Viewer) => boolean): void;
  join(campaignId: string, viewer: Viewer, socket: WebSocket): void;
  leave(socket: WebSocket): void;
};

export function createEventHub(): EventHub {
  const rooms = new Map<string, Set<WebSocket>>();
  const connections = new WeakMap<WebSocket, Connection>();

  function send(campaignId: string, message: (connection: Connection) => SocketMessage | null) {
    const room = rooms.get(campaignId);
    if (!room) return;
    for (const socket of room) {
      const connection = connections.get(socket);
      if (!connection || socket.readyState !== socket.OPEN) continue;
      const outgoing = message(connection);
      if (outgoing) socket.send(JSON.stringify(outgoing));
    }
  }

  const hub: EventHub = {
    join(campaignId, viewer, socket) {
      connections.set(socket, { campaignId, role: viewer.role, userId: viewer.userId, socket });
      let room = rooms.get(campaignId);
      if (!room) {
        room = new Set();
        rooms.set(campaignId, room);
      }
      room.add(socket);
      socket.on('close', () => hub.leave(socket));
    },

    leave(socket) {
      const connection = connections.get(socket);
      if (!connection) return;
      connections.delete(socket);
      rooms.get(connection.campaignId)?.delete(socket);
    },

    publish(campaignId, event) {
      send(campaignId, (connection) => {
        const visible = redactEvent(event, connection.role);
        return visible ? { type: 'session.event', event: visible } : null;
      });
    },

    publishCombat(campaignId, project) {
      send(campaignId, (connection) => {
        const encounter = project(connection);
        return encounter ? { type: 'combat.updated', encounter } : null;
      });
    },

    publishCombatDeleted(campaignId, encounterId, couldSee) {
      send(campaignId, (connection) => (couldSee(connection) ? { type: 'combat.deleted', encounterId } : null));
    },
  };

  return hub;
}
