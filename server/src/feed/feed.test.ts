import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket, { type RawData } from 'ws';
import type { CreatedCampaign, RollResponse, SessionEvent, SocketMessage } from '@quest-fast/shared';
import { SESSION_COOKIE } from '../auth/session.ts';
import { asUser, body, createTestServer, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(port: number, campaignId: string, session: string) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/campaigns/${campaignId}/ws`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
  });
}

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
}

/** Session events as they arrive, in order, for later negative assertions. */
function collect(socket: WebSocket): SessionEvent[] {
  const events: SessionEvent[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'session.event') events.push(message.event);
  });
  return events;
}

/**
 * Resolves with the first session event the predicate accepts. Waiting for the
 * message beats sleeping: the tests stop depending on machine speed.
 */
function waitForEvent(
  socket: WebSocket,
  predicate: (event: SessionEvent) => boolean = () => true,
  timeoutMs = 2000,
): Promise<SessionEvent> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as SocketMessage;
      if (message.type !== 'session.event' || !predicate(message.event)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message.event);
    };
    timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('timed out waiting for a session event'));
    }, timeoutMs);
    socket.on('message', onMessage);
  });
}

/** Closes the sockets and only then the server, so a failure cannot hang the run. */
async function shutdown(server: { close: () => Promise<void> }, sockets: WebSocket[]) {
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.close();
  }
  await server.close();
}

async function appWithCampaign() {
  const server = await createTestServer(PROFILES);
  const app = { app: server.app, db: server.db, hub: server.hub };
  const master = asUser(app, await signIn(app, 'lia'));
  const player = asUser(app, await signIn(app, 'rafael'));
  const outsider = asUser(app, await signIn(app, 'outsider'));

  const created = await master('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Ecos de Phandalin' }),
  });
  const campaign = await body<CreatedCampaign>(created);
  await player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });

  return { server, app, master, player, outsider, campaign };
}

test('a member socket receives the roll events of the campaign', async (t) => {
  const { server, player, campaign } = await appWithCampaign();
  const masterSocket = connect(server.port, campaign.id, await signIn({ app: server.app }, 'lia'));
  const playerSocket = connect(server.port, campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(() => shutdown(server, [masterSocket, playerSocket]));
  await Promise.all([waitForOpen(masterSocket), waitForOpen(playerSocket)]);

  const masterReceives = waitForEvent(masterSocket);
  const playerReceives = waitForEvent(playerSocket);
  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '1d20+4' }),
    }),
  );

  const [masterEvent, playerEvent] = await Promise.all([masterReceives, playerReceives]);
  assert.equal(masterEvent.id, event.id);
  assert.equal(playerEvent.id, event.id);
  assert.equal(playerEvent.payload.expression, '1d20+4');
});

test('a player socket never receives a secret roll; the master socket does', async (t) => {
  const { server, master, player, campaign } = await appWithCampaign();
  const masterSocket = connect(server.port, campaign.id, await signIn({ app: server.app }, 'lia'));
  const playerSocket = connect(server.port, campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(() => shutdown(server, [masterSocket, playerSocket]));
  await Promise.all([waitForOpen(masterSocket), waitForOpen(playerSocket)]);
  const playerEvents = collect(playerSocket);

  // Confirm the player's connection works before probing the secret filter.
  const probe = waitForEvent(playerSocket);
  await player(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20' }),
  });
  await probe;

  const masterSecret = waitForEvent(masterSocket, (event) => event.secret);
  const { event: secret } = await body<RollResponse>(
    await master(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '1d20+7', secret: true }),
    }),
  );
  assert.equal((await masterSecret).id, secret.id);

  // Anything wrongly broadcast would have arrived with the master's copy.
  await delay(100);
  assert.equal(playerEvents.some((event) => event.id === secret.id), false);
  assert.equal(playerEvents.some((event) => event.secret), false);
  assert.equal(playerEvents.some((event) => event.payload.total === secret.payload.total), false);
});

test('a non-member connection is refused and no event is delivered', async (t) => {
  const { server, campaign } = await appWithCampaign();
  const outsiderSession = await signIn({ app: server.app }, 'outsider');
  const socket = connect(server.port, campaign.id, outsiderSession);
  t.after(() => shutdown(server, [socket]));

  // The server destroys the socket before the upgrade: `open` must not fire.
  const outcome = await Promise.race([
    new Promise<string>((resolve) => socket.once('open', () => resolve('open'))),
    new Promise<string>((resolve) => socket.once('error', () => resolve('error'))),
    new Promise<string>((resolve) => socket.once('close', () => resolve('close'))),
  ]);
  assert.notEqual(outcome, 'open');
});

test('events are not delivered to sockets of other campaigns', async (t) => {
  const { server, app, master, player, campaign } = await appWithCampaign();
  const otherCampaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Baróvia' }) }),
  );
  await player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: otherCampaign.inviteCode }) });

  const playerSocket = connect(server.port, campaign.id, await signIn(app, 'rafael'));
  t.after(() => shutdown(server, [playerSocket]));
  await waitForOpen(playerSocket);
  const received = collect(playerSocket);

  // Prove the socket is live in its own room before checking the other one.
  const probe = waitForEvent(playerSocket, (event) => event.payload.expression === '1d20');
  await player(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20' }),
  });
  await probe;

  // The same player is a member, but this roll happens in a different room.
  await player(`/api/campaigns/${otherCampaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20+9' }),
  });
  await delay(200);

  assert.equal(received.some((event) => event.payload.expression === '1d20+9'), false);
  assert.equal(received.some((event) => event.payload.expression === '1d20'), true);
});
