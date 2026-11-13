import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ClientSocketMessage } from '@quest-fast/shared';
import { campaignSocketUrl, openCampaignSocket, type CampaignSocket, type SocketStatus } from '../lib/campaign-socket';
import { mergeEncounter, removeEncounter } from '../lib/combat-cache';
import { mergeFeedEvent } from '../lib/feed-cache';
import { closeScene, mergeScene, scenesKey } from '../lib/scene-cache';
import { createMotionStore, type TokenMotionSource } from '../lib/token-motion';

export type { SocketStatus } from '../lib/campaign-socket';

/**
 * The campaign layout owns the one socket, so every screen stays live; the
 * screens that show the connection read its status from here.
 */
export const CampaignSocketStatus = createContext<SocketStatus>('connecting');

export function useCampaignSocketStatus(): SocketStatus {
  return useContext(CampaignSocketStatus);
}

/**
 * What the map needs of the socket: sending the position of the token being
 * dragged, and where the tokens others drag are. Outside the Query cache, so
 * 30 moves a second never re-render a screen.
 */
export type CampaignChannel = {
  /** False when the socket is down: the move is lost, the drop still goes by REST. */
  send: (message: ClientSocketMessage) => boolean;
  motion: TokenMotionSource;
};

const offline: CampaignChannel = { send: () => false, motion: createMotionStore() };

export const CampaignSocketChannel = createContext<CampaignChannel>(offline);

export function useCampaignChannel(): CampaignChannel {
  return useContext(CampaignSocketChannel);
}

/**
 * Connects to the campaign room and merges pushed events into the feed cache,
 * encounter updates into the combat cache and scene updates into the scenes.
 * Only while `enabled`: the layout passes whether the campaign answered, so a
 * campaign that is missing or not the viewer's never opens a socket that would
 * retry forever behind the error.
 * On a lost connection the feed is refetched from the server once the socket
 * is back: pushed events are a hint, never the source of truth.
 */
export function useCampaignSocket(campaignId: string, enabled: boolean): { status: SocketStatus; channel: CampaignChannel } {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const socket = useRef<CampaignSocket | null>(null);
  // One store per campaign: another campaign's drags never show here.
  const motion = useMemo(() => {
    void campaignId;
    return createMotionStore();
  }, [campaignId]);
  const channel = useMemo<CampaignChannel>(() => ({
    send: (message) => socket.current?.send(message) ?? false,
    motion,
  }), [motion]);

  useEffect(() => {
    if (!enabled) return undefined;
    const opened = openCampaignSocket(campaignSocketUrl(campaignId), {
      onStatus: setStatus,
      onReconnected: () => {
        queryClient.invalidateQueries({ queryKey: ['feed', campaignId] });
        // Combat updates missed while offline are not replayed either.
        queryClient.invalidateQueries({ queryKey: ['encounters', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['encounter', campaignId] });
        // A fight changes the sheets too, and those changes were missed with it.
        queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['character', campaignId] });
        // The map may have opened, closed or changed meanwhile.
        queryClient.invalidateQueries({ queryKey: scenesKey(campaignId) });
      },
      // Asking again turns the lost membership into the campaign's 404, which
      // the screen shows; that also switches this socket off.
      onRevoked: () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
      onMessage: (message) => {
        if (message.type === 'combat.updated') mergeEncounter(queryClient, campaignId, message.encounter);
        else if (message.type === 'combat.deleted') removeEncounter(queryClient, campaignId, message.encounterId);
        else if (message.type === 'session.event') mergeFeedEvent(queryClient, campaignId, message.event);
        else if (message.type === 'scene.updated') {
          // A token no one is moving rests where the scene says: its drag is over.
          for (const token of message.scene.tokens) if (!token.movingBy) motion.clear(token.id);
          mergeScene(queryClient, campaignId, message.scene);
        } else if (message.type === 'scene.closed') closeScene(queryClient, campaignId, message.sceneId);
        else if (message.type === 'token.moving') motion.push(message, performance.now());
      },
    });
    socket.current = opened;
    return () => {
      socket.current = null;
      opened.close();
    };
  }, [campaignId, enabled, queryClient, motion]);

  // While the campaign is still loading the screens show "connecting"; when it
  // failed, the error replaces them and the status is never read.
  return { status: enabled ? status : 'connecting', channel };
}
