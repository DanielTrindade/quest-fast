import type { WebSocket } from 'ws';
import { NOT_A_MEMBER_CLOSE_CODE, type EncounterView, type Role, type SceneView, type SessionEvent, type SocketMessage } from '@quest-fast/shared';
import { redactEvent } from './redact.ts';

export { NOT_A_MEMBER_CLOSE_CODE };

/** Who sits behind a socket: what every projection and redaction needs. */
export type Viewer = { role: Role; userId: string };

type Connection = Viewer & {
  campaignId: string;
  socket: WebSocket;
};

/**
 * One room per campaign, decided at the handshake: a socket never changes
 * campaigns, and the role it carries is the one checked then. Any route that
 * ends or changes a membership must `kick` that user, or the old socket keeps
 * receiving the room as before. The server decides who receives what — secret events reach only
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
  /**
   * Sends `scene.updated` with what `project` returns for each connection;
   * `null` means this viewer may not see the scene (a player, for any scene
   * not open for the table), and nothing is sent.
   */
  publishScene(campaignId: string, project: (viewer: Viewer) => SceneView | null): void;
  /** Sends `scene.closed` to the whole room: the table no longer has that scene open. */
  publishSceneClosed(campaignId: string, sceneId: string): void;
  /** Sends `characters.changed` to the whole room: the roster is public to its members. */
  publishCharactersChanged(campaignId: string): void;
  /**
   * Relays where a dragged token is to each connection whose viewer `canSee`
   * it, but the one that sent it. Never saved; the drop goes through REST.
   */
  publishTokenMoving(
    campaignId: string,
    moving: Omit<Extract<SocketMessage, { type: 'token.moving' }>, 'type'>,
    canSee: (viewer: Viewer) => boolean,
    except?: WebSocket,
  ): void;
  join(campaignId: string, viewer: Viewer, socket: WebSocket): void;
  /** Whether the user still has an open socket in the campaign's room. */
  connected(campaignId: string, userId: string): boolean;
  leave(socket: WebSocket): void;
  /**
   * Drops every socket of the user in the campaign's room at once — the next
   * publish no longer reaches them — and closes each with
   * `NOT_A_MEMBER_CLOSE_CODE`. A reconnect goes through the handshake again.
   */
  kick(campaignId: string, userId: string): void;
};

export function createEventHub(): EventHub {
  const rooms = new Map<string, Set<WebSocket>>();
  const connections = new WeakMap<WebSocket, Connection>();

  function send(campaignId: string, message: (connection: Connection) => SocketMessage | null, except?: WebSocket) {
    const room = rooms.get(campaignId);
    if (!room) return;
    for (const socket of room) {
      if (socket === except) continue;
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

    connected(campaignId, userId) {
      return [...(rooms.get(campaignId) ?? [])].some((socket) => connections.get(socket)?.userId === userId);
    },

    leave(socket) {
      const connection = connections.get(socket);
      if (!connection) return;
      connections.delete(socket);
      rooms.get(connection.campaignId)?.delete(socket);
    },

    kick(campaignId, userId) {
      const room = rooms.get(campaignId);
      if (!room) return;
      for (const socket of [...room]) {
        if (connections.get(socket)?.userId !== userId) continue;
        hub.leave(socket);
        socket.close(NOT_A_MEMBER_CLOSE_CODE, 'not a member');
      }
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

    publishScene(campaignId, project) {
      send(campaignId, (connection) => {
        const scene = project(connection);
        return scene ? { type: 'scene.updated', scene } : null;
      });
    },

    publishSceneClosed(campaignId, sceneId) {
      send(campaignId, () => ({ type: 'scene.closed', sceneId }));
    },

    publishCharactersChanged(campaignId) {
      send(campaignId, () => ({ type: 'characters.changed' }));
    },

    publishTokenMoving(campaignId, moving, canSee, except) {
      send(campaignId, (connection) => (canSee(connection) ? { type: 'token.moving', ...moving } : null), except);
    },

    publishCombatDeleted(campaignId, encounterId, couldSee) {
      send(campaignId, (connection) => (couldSee(connection) ? { type: 'combat.deleted', encounterId } : null));
    },
  };

  return hub;
}
