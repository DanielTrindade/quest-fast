import { NOT_A_MEMBER_CLOSE_CODE, type SocketMessage } from '@quest-fast/shared';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const MAX_BACKOFF_MS = 10_000;

export type CampaignSocketHandlers = {
  onStatus: (status: SocketStatus) => void;
  /** Fired when the connection comes back, so missed events can be recovered. */
  onReconnected: () => void;
  onMessage: (message: SocketMessage) => void;
  /** The server said the viewer is no longer a member: no retry brings that back. */
  onRevoked: () => void;
};

/** The minimum of a WebSocket this loop uses, so a test can drive it. */
export type SocketLike = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: (() => void) | null;
  close: () => void;
};

export type SocketEnvironment = {
  connect: (url: string) => SocketLike;
  setTimer: (run: () => void, ms: number) => number;
  clearTimer: (id: number | undefined) => void;
};

const browser: SocketEnvironment = {
  connect: (url) => new WebSocket(url) as unknown as SocketLike,
  setTimer: (run, ms) => window.setTimeout(run, ms),
  clearTimer: (id) => window.clearTimeout(id),
};

export function campaignSocketUrl(campaignId: string): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/api/campaigns/${campaignId}/ws`;
}

/**
 * Owns the socket, the reconnect backoff and the teardown of one campaign
 * room. The returned disposer is the only way out: nothing the socket opens
 * outlives it. A transient drop reconnects with backoff; losing membership
 * does not, because the next handshake would be refused the same way.
 */
export function openCampaignSocket(url: string, handlers: CampaignSocketHandlers, env: SocketEnvironment = browser): () => void {
  let socket: SocketLike | null = null;
  let closed = false;
  let timer: number | undefined;
  let attempts = 0;

  const connect = () => {
    handlers.onStatus('connecting');
    socket = env.connect(url);

    socket.onopen = () => {
      const reconnected = attempts > 0;
      attempts = 0;
      handlers.onStatus('connected');
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

    socket.onclose = (event) => {
      if (closed) return;
      handlers.onStatus('disconnected');
      if (event.code === NOT_A_MEMBER_CLOSE_CODE) {
        closed = true;
        handlers.onRevoked();
        return;
      }
      attempts += 1;
      const backoff = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
      timer = env.setTimer(connect, backoff);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();
  return () => {
    closed = true;
    env.clearTimer(timer);
    socket?.close();
  };
}
