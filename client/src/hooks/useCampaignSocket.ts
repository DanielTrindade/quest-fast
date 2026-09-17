import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SocketMessage } from '@quest-fast/shared';
import { mergeFeedEvent } from '../lib/feed-cache';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const MAX_BACKOFF_MS = 10_000;

type CampaignSocketHandlers = {
  onStatus: (status: SocketStatus) => void;
  /** Fired when the connection comes back, so missed events can be recovered. */
  onReconnected: () => void;
  onMessage: (message: SocketMessage) => void;
};

/**
 * Owns the socket, the reconnect backoff and the teardown of one campaign
 * room. Returning its disposer from the hook's effect puts the lifecycle in a
 * single place: nothing the socket opens outlives the connection.
 */
function openCampaignSocket(campaignId: string, handlers: CampaignSocketHandlers): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let timer: number | undefined;
  let attempts = 0;

  const connect = () => {
    handlers.onStatus('connecting');
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${scheme}://${window.location.host}/api/campaigns/${campaignId}/ws`);

    socket.onopen = () => {
      const reconnected = attempts > 0;
      attempts = 0;
      handlers.onStatus('connected');
      // Recover any events missed while offline.
      if (reconnected) handlers.onReconnected();
    };

    socket.onmessage = (event) => {
      let message: SocketMessage;
      try {
        message = JSON.parse(event.data as string) as SocketMessage;
      } catch {
        return;
      }
      handlers.onMessage(message);
    };

    socket.onclose = () => {
      if (closed) return;
      handlers.onStatus('disconnected');
      attempts += 1;
      const backoff = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
      timer = window.setTimeout(connect, backoff);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    socket?.close();
  };
}

/**
 * Connects to the campaign room and merges pushed events into the feed cache.
 * On a lost connection the feed is refetched from the server once the socket
 * is back: pushed events are a hint, never the source of truth.
 */
export function useCampaignSocket(campaignId: string): SocketStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    return openCampaignSocket(campaignId, {
      onStatus: setStatus,
      onReconnected: () => queryClient.invalidateQueries({ queryKey: ['feed', campaignId] }),
      onMessage: (message) => {
        if (message.type !== 'session.event') return;
        mergeFeedEvent(queryClient, campaignId, message.event);
      },
    });
  }, [campaignId, queryClient]);

  return status;
}
