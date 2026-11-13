import test from 'node:test';
import assert from 'node:assert/strict';
import { NOT_A_MEMBER_CLOSE_CODE } from '@quest-fast/shared';
import { openCampaignSocket, type CampaignSocketHandlers, type SocketEnvironment, type SocketLike, type SocketStatus } from '../src/lib/campaign-socket.ts';

function fakeEnvironment() {
  const sockets: (SocketLike & { closed: boolean; sent: string[] })[] = [];
  const timers = new Map<number, { run: () => void; ms: number }>();
  let next = 1;
  const env: SocketEnvironment = {
    connect: () => {
      const socket = {
        onopen: null, onmessage: null, onclose: null, onerror: null, closed: false, sent: [] as string[],
        close() { this.closed = true; },
        send(data: string) { this.sent.push(data); },
      } as SocketLike & { closed: boolean; sent: string[] };
      sockets.push(socket);
      return socket;
    },
    setTimer: (run, ms) => {
      const id = next++;
      timers.set(id, { run, ms });
      return id;
    },
    clearTimer: (id) => {
      if (id !== undefined) timers.delete(id);
    },
  };
  const fire = () => {
    const pending = [...timers.entries()];
    timers.clear();
    for (const [, timer] of pending) timer.run();
  };
  return { env, sockets, timers, fire };
}

function recorder() {
  const calls = { statuses: [] as SocketStatus[], reconnected: 0, revoked: 0 };
  const handlers: CampaignSocketHandlers = {
    onStatus: (status) => calls.statuses.push(status),
    onReconnected: () => { calls.reconnected += 1; },
    onMessage: () => {},
    onRevoked: () => { calls.revoked += 1; },
  };
  return { calls, handlers };
}

test('a dropped connection reconnects with backoff and asks to recover what was missed', () => {
  const { env, sockets, timers, fire } = fakeEnvironment();
  const { calls, handlers } = recorder();
  openCampaignSocket('ws://test/api/campaigns/c1/ws', handlers, env);

  sockets[0].onopen?.();
  sockets[0].onclose?.({ code: 1006 });
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].ms, 1000);

  fire();
  assert.equal(sockets.length, 2);
  sockets[1].onopen?.();
  assert.equal(calls.reconnected, 1);
  assert.deepEqual(calls.statuses, ['connecting', 'connected', 'disconnected', 'connecting', 'connected']);
});

test('losing membership stops for good: no retry, and the screen is told once', () => {
  const { env, sockets, timers } = fakeEnvironment();
  const { calls, handlers } = recorder();
  openCampaignSocket('ws://test/api/campaigns/c1/ws', handlers, env);

  sockets[0].onopen?.();
  sockets[0].onclose?.({ code: NOT_A_MEMBER_CLOSE_CODE });

  assert.equal(timers.size, 0);
  assert.equal(sockets.length, 1);
  assert.equal(calls.revoked, 1);
  assert.equal(calls.statuses.at(-1), 'disconnected');
});

test('disposing cancels a pending retry and closes the socket', () => {
  const { env, sockets, timers, fire } = fakeEnvironment();
  const { handlers } = recorder();
  const socket = openCampaignSocket('ws://test/api/campaigns/c1/ws', handlers, env);

  sockets[0].onclose?.({ code: 1006 });
  assert.equal(timers.size, 1);
  socket.close();

  assert.equal(timers.size, 0);
  fire();
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].closed, true);
});

test('moves go out only while the connection is open', () => {
  const { env, sockets } = fakeEnvironment();
  const { handlers } = recorder();
  const socket = openCampaignSocket('ws://test/api/campaigns/c1/ws', handlers, env);
  const move = { type: 'token.move', tokenId: 't1', x: 10, y: 20 } as const;

  assert.equal(socket.send(move), false);
  sockets[0].onopen?.();
  assert.equal(socket.send(move), true);
  assert.deepEqual(sockets[0].sent.map((data) => JSON.parse(data)), [move]);

  sockets[0].onclose?.({ code: 1006 });
  assert.equal(socket.send(move), false);
  socket.close();
});
