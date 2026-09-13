import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedResponse, SocketMessage } from '@quest-fast/shared';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const MAX_BACKOFF_MS = 10_000;

/**
 * Connects to the campaign room and merges pushed events into the feed cache.
 * On a lost connection the feed is refetched from the server once the socket
 * is back: pushed events are a hint, never the source of truth.
 */
export function useCampaignSocket(campaignId: string): SocketStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let timer: number | undefined;
    let attempts = 0;

    const connect = () => {
      setStatus('connecting');
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/api/campaigns/${campaignId}/ws`);

      socket.onopen = () => {
        const reconnected = attempts > 0;
        attempts = 0;
        setStatus('connected');
        // Recover any events missed while offline.
        if (reconnected) queryClient.invalidateQueries({ queryKey: ['feed', campaignId] });
      };

      socket.onmessage = (event) => {
        let message: SocketMessage;
        try {
          message = JSON.parse(event.data as string) as SocketMessage;
        } catch {
          return;
        }
        if (message.type !== 'session.event') return;
        const pushed = message.event;
        queryClient.setQueryData<FeedResponse>(['feed', campaignId], (current) => {
          if (!current) return { events: [pushed], nextCursor: null };
          if (current.events.some((existing) => existing.id === pushed.id)) return current;
          return { ...current, events: [...current.events, pushed] };
        });
        // The table should notice a new sheet without reloading; the roll
        // that follows creation carries the event that refreshes everyone.
        // Only a roll event points back at a sheet: a Phase 2 event such as a
        // token move must not trigger a characters refetch.
        if (pushed.type === 'roll') {
          queryClient.invalidateQueries({ queryKey: ['characters', campaignId] });
        }
      };

      socket.onclose = () => {
        if (closed) return;
        setStatus('disconnected');
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
  }, [campaignId, queryClient]);

  return status;
}