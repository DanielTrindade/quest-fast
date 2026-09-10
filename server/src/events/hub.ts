import type { WebSocket } from 'ws';
import type { Role, SessionEvent, SocketMessage } from '@quest-fast/shared';

type Connection = {
  campaignId: string;
  role: Role;
  socket: WebSocket;
};

/**
 * One room per campaign, decided at the handshake: a socket never changes
 * campaigns. The server decides who receives what — secret events reach only
 * masters, over the socket exactly as in the feed read.
 */
export type EventHub = {
  publish(campaignId: string, event: SessionEvent): void;
  join(campaignId: string, role: Role, socket: WebSocket): void;
  leave(socket: WebSocket): void;
};

export function createEventHub(): EventHub {
  const rooms = new Map<string, Set<WebSocket>>();
  const connections = new WeakMap<WebSocket, Connection>();

  const hub: EventHub = {
    join(campaignId, role, socket) {
      connections.set(socket, { campaignId, role, socket });
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
      const room = rooms.get(campaignId);
      if (!room) return;
      const message: SocketMessage = { type: 'session.event', event };
      for (const socket of room) {
        const connection = connections.get(socket);
        if (!connection) continue;
        if (event.secret && connection.role !== 'master') continue;
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      }
    },
  };

  return hub;
}