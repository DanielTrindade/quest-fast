import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import WebSocket from 'ws';
import { chatMessages, users } from '@quest-fast/db';
import { CHAT_LIMITS, type ChatMessageResponse, type ChatPageResponse, type CreatedCampaign, type SocketMessage } from '@quest-fast/shared';
import { SESSION_COOKIE } from '../auth/session.ts';
import { asUser, body, createTestApp, createTestServer, signIn } from '../testing.ts';
import type { AttemptLimiterOptions } from '../invites/attempt-limiter.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael', avatarUrl: null },
  bruna: { discordId: '444', name: 'Bruna', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

type Request = ReturnType<typeof asUser>;

async function join(owner: Request, others: Request[]) {
  const campaign = await body<CreatedCampaign>(await owner('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos de Phandalin' }) }));
  for (const member of others) await member('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  return campaign;
}

async function setup(chatRate?: AttemptLimiterOptions) {
  const app = createTestApp(PROFILES, { chatRate });
  const master = asUser(app, await signIn(app, 'lia'));
  const player = asUser(app, await signIn(app, 'rafael'));
  const other = asUser(app, await signIn(app, 'bruna'));
  const outsider = asUser(app, await signIn(app, 'outsider'));
  const campaign = await join(master, [player, other]);
  const chat = `/api/campaigns/${campaign.id}/chat`;
  const send = (as: Request, text: string, replyToId?: string) =>
    as(chat, { method: 'POST', body: JSON.stringify({ body: text, ...(replyToId ? { replyToId } : {}) }) });
  return { app, master, player, other, outsider, campaign, chat, send };
}

/** Rows straight into the table, all in the same second unless told otherwise. */
function seed(db: ReturnType<typeof createTestApp>['db'], campaignId: string, userId: string, total: number, at = new Date('2026-11-20T20:00:00Z')) {
  const ids: string[] = [];
  for (let i = 0; i < total; i++) {
    const id = randomUUID();
    ids.push(id);
    db.insert(chatMessages).values({ id, campaignId, userId, body: `msg ${i}`, mentions: [], createdAt: at }).run();
  }
  return ids;
}

const userId = (db: ReturnType<typeof createTestApp>['db'], name: string) =>
  db.select({ id: users.id }).from(users).where(eq(users.name, name)).get()!.id;

test('a non-member gets 404 to read, send and remove', async () => {
  const { player, outsider, chat, send } = await setup();
  const { message } = await body<ChatMessageResponse>(await send(player, 'cheguei'));

  assert.equal((await outsider(chat)).status, 404);
  assert.equal((await send(outsider, 'oi')).status, 404);
  assert.equal((await outsider(`${chat}/${message.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await outsider('/api/campaigns/nope/chat')).status, 404);
});

test('a member sends and every member reads it, with author, badge and mentions', async () => {
  const { master, player, other, chat, send } = await setup();
  const sent = await send(master, '  @rafael e @Bruna, rolem iniciativa  ');
  assert.equal(sent.status, 201);
  const { message } = await body<ChatMessageResponse>(sent);
  assert.equal(message.body, '@rafael e @Bruna, rolem iniciativa');
  assert.equal(message.author.name, 'Lia Martins');
  assert.equal(message.author.master, true);
  assert.equal(message.author.character, null);
  assert.deepEqual(message.mentions.map(({ start, end }) => message.body!.slice(start, end)), ['@rafael', '@Bruna']);

  for (const reader of [player, other, master]) {
    const page = await body<ChatPageResponse>(await reader(chat));
    assert.deepEqual(page.messages.map(({ id }) => id), [message.id]);
    assert.equal(page.nextCursor, null);
  }
});

test('the token beside the name is the active character of the author', async () => {
  const { player, campaign, chat, send } = await setup();
  const created = await player(`/api/campaigns/${campaign.id}/characters`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Thorin', race: 'Anão', class: 'Guerreiro', level: 3, hp: 30, ac: 16,
      abilityScores: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 11, charisma: 8 },
      skills: [], saves: [], attacks: [], features: [],
    }),
  });
  assert.equal(created.status, 201);
  await send(player, 'cheguei');
  const [message] = (await body<ChatPageResponse>(await player(chat))).messages;
  assert.equal(message!.author.master, false);
  assert.deepEqual(message!.author.character, { name: 'Thorin', avatarUrl: null });
});

test('mentions keep their place after the member is renamed', async () => {
  const { app, master, chat, send } = await setup();
  await send(master, 'vez do @Rafael');
  app.db.update(users).set({ name: 'Rafa' }).where(eq(users.id, userId(app.db, 'Rafael'))).run();
  const [message] = (await body<ChatPageResponse>(await master(chat))).messages;
  assert.equal(message!.body!.slice(message!.mentions[0]!.start, message!.mentions[0]!.end), '@Rafael');
});

test('an empty, blank or too long message is refused, and so is a reply to another campaign', async () => {
  const { master, player, send } = await setup();
  for (const text of ['', '    ', 'a'.repeat(CHAT_LIMITS.maxLength + 1)]) {
    const refused = await send(player, text);
    assert.equal(refused.status, 422, JSON.stringify(text));
    assert.ok((await body<{ error: string }>(refused)).error);
  }
  assert.equal((await send(player, 'a'.repeat(CHAT_LIMITS.maxLength))).status, 201);

  const elsewhere = await join(master, []);
  const { message: foreign } = await body<ChatMessageResponse>(
    await master(`/api/campaigns/${elsewhere.id}/chat`, { method: 'POST', body: JSON.stringify({ body: 'outra mesa' }) }),
  );
  assert.equal((await send(player, 'respondendo', foreign.id)).status, 422);
  // Not a member of that campaign: its chat does not exist for the player.
  assert.equal((await player(`/api/campaigns/${elsewhere.id}/chat`)).status, 404);
});

test('a malformed reply is refused', async () => {
  const { player, chat } = await setup();
  assert.equal((await player(chat, { method: 'POST', body: JSON.stringify({ body: 'oi', replyToId: 5 }) })).status, 422);
  assert.equal((await player(chat, { method: 'POST', body: 'não é json' })).status, 422);
});

test('a reply quotes the message, and says when it was removed', async () => {
  const { master, player, chat, send } = await setup();
  const { message: original } = await body<ChatMessageResponse>(await send(master, 'quem pegou a chave?'));
  const { message: reply } = await body<ChatMessageResponse>(await send(player, 'eu', original.id));
  assert.deepEqual(reply.replyTo, { id: original.id, authorName: 'Lia Martins', body: 'quem pegou a chave?' });

  assert.equal((await master(`${chat}/${original.id}`, { method: 'DELETE' })).status, 204);
  const page = await body<ChatPageResponse>(await player(chat));
  assert.deepEqual(page.messages[1]!.replyTo, { id: original.id, authorName: 'Lia Martins', body: null });
});

test('a player removes their own message, not another player\'s; the master removes any', async () => {
  const { app, master, player, other, chat, send } = await setup();
  const { message: mine } = await body<ChatMessageResponse>(await send(player, 'kkkk @Bruna'));
  const { message: theirs } = await body<ChatMessageResponse>(await send(other, 'segredo bobo'));

  assert.equal((await player(`${chat}/${theirs.id}`, { method: 'DELETE' })).status, 403);
  assert.equal((await player(`${chat}/${mine.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await master(`${chat}/${theirs.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await player(`${chat}/${randomUUID()}`, { method: 'DELETE' })).status, 404);

  const raw = await (await other(chat)).text();
  assert.ok(!raw.includes('kkkk') && !raw.includes('segredo bobo'), 'removed text is never sent');
  const page = JSON.parse(raw) as ChatPageResponse;
  for (const message of page.messages) {
    assert.equal(message.removed, true);
    assert.equal(message.body, null);
    assert.deepEqual(message.mentions, []);
  }
  // The text is gone from the database too, not just hidden.
  const stored = app.db.select({ body: chatMessages.body }).from(chatMessages).all();
  assert.deepEqual(stored.map(({ body: text }) => text), ['', '']);
});

test('the history pages back with a stable order even within the same second', async () => {
  const { app, master, campaign, chat } = await setup();
  const ids = seed(app.db, campaign.id, userId(app.db, 'Lia Martins'), CHAT_LIMITS.pageSize + 10);

  const first = await body<ChatPageResponse>(await master(chat));
  assert.deepEqual(first.messages.map(({ id }) => id), ids.slice(10));
  assert.equal(first.nextCursor, ids[10]);

  const second = await body<ChatPageResponse>(await master(`${chat}?cursor=${first.nextCursor}`));
  assert.deepEqual(second.messages.map(({ id }) => id), ids.slice(0, 10));
  assert.equal(second.nextCursor, null);

  // A cursor from another campaign, or one that fell out of the history, ends the history.
  assert.deepEqual(await body<ChatPageResponse>(await master(`${chat}?cursor=${randomUUID()}`)), { messages: [], nextCursor: null });
});

test('the message past the retained limit deletes the oldest one, and its quote with it', async () => {
  const { app, master, player, campaign, chat, send } = await setup();
  const ids = seed(app.db, campaign.id, userId(app.db, 'Lia Martins'), CHAT_LIMITS.retained, new Date('2026-11-20T19:00:00Z'));
  const quoting = await body<ChatMessageResponse>(await send(player, 'lembra disso?', ids[1]));
  assert.equal(quoting.message.replyTo?.id, ids[1]);

  const total = () => app.db.select({ n: count() }).from(chatMessages).where(eq(chatMessages.campaignId, campaign.id)).get()!.n;
  assert.equal(total(), CHAT_LIMITS.retained);
  const kept = (id: string) => app.db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.id, id)).get();
  assert.equal(kept(ids[0]!), undefined);
  assert.ok(kept(ids[1]!));

  await send(master, 'mais uma');
  assert.equal(kept(ids[1]!), undefined);
  const page = await body<ChatPageResponse>(await player(chat));
  const reply = page.messages.find(({ id }) => id === quoting.message.id);
  assert.equal(reply?.replyTo, null);
});

test('a message over the rate limit gets 429, and the next one after the window goes', async () => {
  let clock = 1_000_000;
  const { player, other, send } = await setup({ now: () => clock });
  for (let i = 0; i < CHAT_LIMITS.rateLimit; i++) assert.equal((await send(player, `msg ${i}`)).status, 201);
  // A refused message does not count.
  assert.equal((await send(other, '')).status, 422);

  const blocked = await send(player, 'mais uma');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.match((await body<{ error: string }>(blocked)).error, /espere/);
  // Each person has their own budget.
  assert.equal((await send(other, 'eu posso')).status, 201);

  clock += CHAT_LIMITS.rateWindowMs + 1;
  assert.equal((await send(player, 'agora vai')).status, 201);
});

function connect(port: number, campaignId: string, session: string) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/campaigns/${campaignId}/ws`, { headers: { cookie: `${SESSION_COOKIE}=${session}` } });
}

function next(socket: WebSocket, type: SocketMessage['type']): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 2000);
    const onMessage = (data: WebSocket.RawData) => {
      const raw = data.toString();
      if ((JSON.parse(raw) as SocketMessage).type !== type) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(raw);
    };
    socket.on('message', onMessage);
  });
}

test('every member socket receives the message, and the removal without its text', async (t) => {
  const server = await createTestServer(PROFILES);
  const app = { app: server.app };
  const masterSession = await signIn(app, 'lia');
  const playerSession = await signIn(app, 'rafael');
  const master = asUser(app, masterSession);
  const player = asUser(app, playerSession);
  const campaign = await join(master, [player]);
  const sockets = [connect(server.port, campaign.id, masterSession), connect(server.port, campaign.id, playerSession)];
  t.after(async () => {
    for (const socket of sockets) socket.close();
    await server.close();
  });
  await Promise.all(sockets.map((socket) => new Promise((resolve) => socket.once('open', resolve))));

  const arriving = sockets.map((socket) => next(socket, 'chat.message'));
  const { message } = await body<ChatMessageResponse>(
    await player(`/api/campaigns/${campaign.id}/chat`, { method: 'POST', body: JSON.stringify({ body: 'nat 1 de novo 💀' }) }),
  );
  for (const raw of await Promise.all(arriving)) {
    const pushed = JSON.parse(raw) as Extract<SocketMessage, { type: 'chat.message' }>;
    assert.deepEqual(pushed.message, message);
  }

  const removal = sockets.map((socket) => next(socket, 'chat.removed'));
  await player(`/api/campaigns/${campaign.id}/chat/${message.id}`, { method: 'DELETE' });
  for (const raw of await Promise.all(removal)) {
    assert.deepEqual(JSON.parse(raw), { type: 'chat.removed', messageId: message.id });
    assert.ok(!raw.includes('nat 1'));
  }
});
