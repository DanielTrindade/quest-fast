import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket, { type RawData } from 'ws';
import type { CreatedCampaign, RollResponse, RollSessionEvent, SocketMessage } from '@quest-fast/shared';
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
function collect(socket: WebSocket): RollSessionEvent[] {
  const events: RollSessionEvent[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'session.event') events.push(message.event as RollSessionEvent);
  });
  return events;
}

/**
 * Resolves with the first session event the predicate accepts. Waiting for the
 * message beats sleeping: the tests stop depending on machine speed.
 */
function waitForEvent(
  socket: WebSocket,
  predicate: (event: RollSessionEvent) => boolean = () => true,
  timeoutMs = 2000,
): Promise<RollSessionEvent> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as SocketMessage;
      if (message.type !== 'session.event') return;
      const event = message.event as RollSessionEvent;
      if (!predicate(event)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(event);
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

/** Resolves with the close code once the server ends the connection. */
function waitForClose(socket: WebSocket, timeoutMs = 2000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for the socket to close')), timeoutMs);
    socket.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function memberIdOf(master: ReturnType<typeof asUser>, campaignId: string, name: string) {
  const { members } = await body<{ members: { id: string; name: string }[] }>(
    await master(`/api/campaigns/${campaignId}/members`),
  );
  const member = members.find((candidate) => candidate.name === name);
  if (!member) throw new Error(`member ${name} not found`);
  return member.id;
}

test('a player removed by the master has the socket closed and gets no further event', async (t) => {
  const { server, app, master, campaign } = await appWithCampaign();
  const masterSocket = connect(server.port, campaign.id, await signIn(app, 'lia'));
  const playerSocket = connect(server.port, campaign.id, await signIn(app, 'rafael'));
  t.after(() => shutdown(server, [masterSocket, playerSocket]));
  await Promise.all([waitForOpen(masterSocket), waitForOpen(playerSocket)]);
  const playerEvents = collect(playerSocket);
  const closed = waitForClose(playerSocket);

  const memberId = await memberIdOf(master, campaign.id, 'Rafael Costa');
  const removed = await master(`/api/campaigns/${campaign.id}/members/${memberId}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);

  const masterReceives = waitForEvent(masterSocket, (event) => event.payload.expression === '1d20+3');
  await master(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20+3' }),
  });
  await masterReceives;

  assert.equal(await closed, 4404);
  assert.equal(playerEvents.some((event) => event.payload.expression === '1d20+3'), false);
});

test('a player who leaves the campaign has every open socket of it closed', async (t) => {
  const { server, app, master, player, campaign } = await appWithCampaign();
  // Two tabs of the same player: both must go.
  const tabs = [
    connect(server.port, campaign.id, await signIn(app, 'rafael')),
    connect(server.port, campaign.id, await signIn(app, 'rafael')),
  ];
  const masterSocket = connect(server.port, campaign.id, await signIn(app, 'lia'));
  t.after(() => shutdown(server, [...tabs, masterSocket]));
  await Promise.all([...tabs, masterSocket].map(waitForOpen));
  const closed = Promise.all(tabs.map((tab) => waitForClose(tab)));

  const left = await player(`/api/campaigns/${campaign.id}/members/me`, { method: 'DELETE' });
  assert.equal(left.status, 204);

  assert.deepEqual(await closed, [4404, 4404]);
  // The master stays in the room.
  const masterReceives = waitForEvent(masterSocket);
  await master(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20' }),
  });
  await masterReceives;
  assert.equal(masterSocket.readyState, WebSocket.OPEN);
});
