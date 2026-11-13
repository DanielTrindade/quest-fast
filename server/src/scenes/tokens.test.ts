import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import type WebSocket from 'ws';
import { tokens } from '@quest-fast/db';
import type { SceneResponse, SceneView, SocketMessage, TokenLockedResponse, TokenView } from '@quest-fast/shared';
import { body, createTestServer, signIn, testImageBytes } from '../testing.ts';
import { createTokenLocks } from './locks.ts';
import { PROFILES, connect, runningEncounter, send, setup, until, type Request, type Setup } from '../combat/test-setup.ts';

/** A 600 × 400 map: the default grid has 20 px cells. */
async function openScene(s: Setup) {
  const form = new FormData();
  form.set('name', 'Estrada de Triboar');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const created = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  await sceneOf(await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id }));
  return { scene: created, path: `${s.root}/scenes/${created.id}` };
}

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

function add(s: Setup, path: string, input: Record<string, unknown>, request: Request = s.master) {
  return send(request, `${path}/tokens`, 'POST', { x: 100, y: 100, ...input });
}

function named(scene: SceneView, name: string): TokenView {
  const token = scene.tokens.find((candidate) => candidate.name === name);
  assert.ok(token, `${name} is on the scene`);
  return token;
}

function names(scene: SceneView) {
  return scene.tokens.map((token) => token.name).sort();
}

function stored(s: Setup, tokenId: string) {
  return s.app.db.select().from(tokens).where(eq(tokens.id, tokenId)).get();
}

/** Every message a socket receives, in order. */
function collect(socket: WebSocket): SocketMessage[] {
  const messages: SocketMessage[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as SocketMessage));
  return messages;
}

function opened(...sockets: WebSocket[]) {
  return Promise.all(sockets.map((socket) => new Promise((resolve) => socket.once('open', resolve))));
}

function moving(messages: SocketMessage[]) {
  return messages.flatMap((message) => (message.type === 'token.moving' ? [[message.tokenId, message.x, message.y]] : []));
}

type Server = Awaited<ReturnType<typeof createTestServer>>;

/**
 * A real server with sockets that are always closed at the end, even when an
 * assertion fails: an open socket would keep `server.close` waiting forever.
 */
async function withServer(
  options: Parameters<typeof createTestServer>[1],
  run: (server: Server, s: Setup, socketOf: (code: keyof typeof PROFILES) => Promise<WebSocket>) => Promise<void>,
) {
  const server = await createTestServer(PROFILES, options);
  const sockets: WebSocket[] = [];
  try {
    const s = await setup(server);
    await run(server, s, async (code) => {
      const socket = connect(server.port, s.campaign.id, await signIn(server, code));
      sockets.push(socket);
      await opened(socket);
      return socket;
    });
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
}

function lastScene(messages: SocketMessage[]): SceneView | undefined {
  return messages.flatMap((message) => (message.type === 'scene.updated' ? [message.scene] : [])).at(-1);
}

test('the master adds a character, a combatant, a bestiary creature and a free token, snapped to the grid', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const { id } = await runningEncounter(s, { start: false });

  let scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id, x: 33, y: 47 }), 201);
  const kaelen = named(scene, 'Kaelen');
  assert.deepEqual(
    { kind: kaelen.kind, size: kaelen.size, initials: kaelen.initials, ownerId: kaelen.ownerId, x: kaelen.x, y: kaelen.y, hidden: kaelen.hidden },
    { kind: 'character', size: 'medium', initials: 'K', ownerId: kaelen.ownerId, x: 30, y: 50, hidden: false },
  );
  assert.ok(kaelen.ownerId);
  assert.equal(kaelen.movingBy, null);

  scene = await sceneOf(await add(s, path, { kind: 'combatant', combatantId: id('Goblin 1'), x: 41, y: 41 }), 201);
  assert.deepEqual([named(scene, 'Goblin 1').kind, named(scene, 'Goblin 1').size], ['combatant', 'small']);

  scene = await sceneOf(await add(s, path, { kind: 'statblock', statblockId: s.goblin.id }), 201);
  const free = scene.tokens.find((token) => token.statblockId === s.goblin.id)!;
  assert.deepEqual([free.kind, free.name, free.size], ['free', 'Goblin', 'small']);

  // A large free token goes to the junction between four cells.
  scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Carroça', size: 'large', x: 133, y: 151 }), 201);
  assert.deepEqual([named(scene, 'Carroça').x, named(scene, 'Carroça').y], [140, 160]);
  assert.equal(scene.version, 5);
});

test('a character and a combatant go on a scene once; a character in an encounter keeps its own token', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const { id } = await runningEncounter(s, { start: false });

  await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
  assert.equal((await add(s, path, { kind: 'character', characterId: s.kaelen.id })).status, 409);
  // Kaelen's combatant is Kaelen: the same token.
  assert.equal((await add(s, path, { kind: 'combatant', combatantId: id('Kaelen') })).status, 409);
  const mira = await sceneOf(await add(s, path, { kind: 'combatant', combatantId: id('Mira') }), 201);
  assert.equal(named(mira, 'Mira').kind, 'character');

  await sceneOf(await add(s, path, { kind: 'combatant', combatantId: id('Goblin 1') }), 201);
  assert.equal((await add(s, path, { kind: 'combatant', combatantId: id('Goblin 1') })).status, 409);
});

test('a token the request cannot place is refused and nothing is stored', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  for (const [input, status] of [
    [{ kind: 'character', characterId: 'missing' }, 404],
    [{ kind: 'combatant', combatantId: 'missing' }, 404],
    [{ kind: 'statblock', statblockId: 'missing' }, 404],
    [{ kind: 'free', label: '', size: 'medium' }, 422],
    [{ kind: 'free', label: 'x'.repeat(41), size: 'medium' }, 422],
    [{ kind: 'free', label: 'Barril', size: 'enorme' }, 422],
    [{ kind: 'free', label: 'Barril', size: 'medium', x: 'meio' }, 422],
    [{ kind: 'free', label: 'Barril', size: 'medium', x: Number.NaN }, 422],
    [{ kind: 'monster' }, 422],
  ] as const) {
    assert.equal((await add(s, path, input)).status, status, JSON.stringify(input));
  }
  assert.equal(s.app.db.select().from(tokens).all().length, 0);
});

test('a token dropped off the map rests on its edge', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Barril', size: 'medium', x: -500, y: 9000 }), 201);
  assert.deepEqual([named(scene, 'Barril').x, named(scene, 'Barril').y], [0, 400]);
});

test('a scene holds at most 200 tokens', async () => {
  const s = await setup();
  const { scene, path } = await openScene(s);
  for (let index = 0; index < 200; index += 1) {
    s.app.db.insert(tokens).values({ id: `t${index}`, sceneId: scene.id, kind: 'free', label: 'Barril', size: 'medium', x: 10, y: 10 }).run();
  }
  assert.equal((await add(s, path, { kind: 'free', label: 'Barril', size: 'medium' })).status, 422);
});

test('placing the encounter puts every combatant not yet on the scene in a row, characters as themselves', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const { encounter } = await runningEncounter(s, { start: false });
  await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id, x: 500, y: 300 }), 201);

  const scene = await sceneOf(await send(s.master, `${path}/tokens/encounter`, 'POST', { encounterId: encounter.id, x: 30, y: 30 }), 201);
  assert.deepEqual(names(scene), ['Bandido', 'Goblin 1', 'Goblin 2', 'Kaelen', 'Mira']);
  // Kaelen stays where it was; the others line up one cell apart.
  assert.deepEqual([named(scene, 'Kaelen').x, named(scene, 'Kaelen').y], [510, 310]);
  const row = scene.tokens.filter((token) => token.name !== 'Kaelen').map((token) => [token.x, token.y]);
  assert.deepEqual(row, [[30, 30], [50, 30], [70, 30], [90, 30]]);
  assert.equal(named(scene, 'Mira').kind, 'character');

  // Nothing left to place.
  assert.equal((await send(s.master, `${path}/tokens/encounter`, 'POST', { encounterId: encounter.id, x: 30, y: 30 })).status, 409);
  assert.equal((await send(s.master, `${path}/tokens/encounter`, 'POST', { encounterId: 'missing', x: 30, y: 30 })).status, 404);
});

test('a player neither adds, hides, renames nor removes a token', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Barril', size: 'medium' }), 201);
  const barrel = named(scene, 'Barril');
  const { encounter } = await runningEncounter(s, { start: false });

  assert.equal((await add(s, path, { kind: 'character', characterId: s.kaelen.id }, s.player)).status, 403);
  assert.equal((await send(s.player, `${path}/tokens/encounter`, 'POST', { encounterId: encounter.id, x: 1, y: 1 })).status, 403);
  assert.equal((await send(s.player, `${path}/tokens/${barrel.id}`, 'PATCH', { hidden: true })).status, 403);
  assert.equal((await send(s.player, `${path}/tokens/${barrel.id}`, 'PATCH', { label: 'Meu barril' })).status, 403);
  assert.equal((await s.player(`${path}/tokens/${barrel.id}`, { method: 'DELETE' })).status, 403);
  assert.deepEqual(
    { hidden: stored(s, barrel.id)?.hidden, label: stored(s, barrel.id)?.label },
    { hidden: false, label: 'Barril' },
  );
});

test('on a scene not open for the table, every token route is a 404 for a player; outside the campaign, for anyone', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
  const kaelen = named(scene, 'Kaelen');
  await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: null });

  for (const request of [s.player, s.outsider]) {
    for (const response of [
      await add(s, path, { kind: 'free', label: 'Barril', size: 'medium' }, request),
      await send(request, `${path}/tokens/${kaelen.id}/grab`, 'POST'),
      await send(request, `${path}/tokens/${kaelen.id}`, 'PATCH', { x: 300, y: 300 }),
      await request(`${path}/tokens/${kaelen.id}`, { method: 'DELETE' }),
    ]) {
      assert.equal(response.status, 404);
    }
  }
  assert.deepEqual([stored(s, kaelen.id)?.x, stored(s, kaelen.id)?.y], [kaelen.x, kaelen.y]);
});

test("a player moves their own character's token, not someone else's nor one they do not see", async () => {
  const s = await setup();
  const { path } = await openScene(s);
  await add(s, path, { kind: 'character', characterId: s.kaelen.id });
  await add(s, path, { kind: 'character', characterId: s.mira.id });
  await add(s, path, { kind: 'free', label: 'Barril', size: 'medium' });
  let scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Armadilha', size: 'medium' }), 201);
  const trap = named(scene, 'Armadilha');
  await send(s.master, `${path}/tokens/${trap.id}`, 'PATCH', { hidden: true });

  scene = await sceneOf(await send(s.player, `${path}/tokens/${named(scene, 'Kaelen').id}`, 'PATCH', { x: 205, y: 333 }));
  assert.deepEqual([named(scene, 'Kaelen').x, named(scene, 'Kaelen').y], [210, 330]);

  for (const [token, status] of [
    [named(scene, 'Mira'), 403],
    [named(scene, 'Barril'), 403],
    [trap, 404],
  ] as const) {
    assert.equal((await send(s.player, `${path}/tokens/${token.id}`, 'PATCH', { x: 500, y: 300 })).status, status, token.name);
    assert.equal((await send(s.player, `${path}/tokens/${token.id}/grab`, 'POST')).status, status, token.name);
    assert.notEqual(stored(s, token.id)?.x, 510);
  }
});

test("a player's scene never carries a hidden token nor the token of a hidden combatant", async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const { encounter } = await runningEncounter(s, { start: false });
  let scene = await sceneOf(await send(s.master, `${path}/tokens/encounter`, 'POST', { encounterId: encounter.id, x: 30, y: 30 }), 201);
  await send(s.master, `${path}/tokens/${named(scene, 'Goblin 2').id}`, 'PATCH', { hidden: true });

  scene = await sceneOf(await s.master(path));
  assert.deepEqual(names(scene), ['Bandido', 'Goblin 1', 'Goblin 2', 'Kaelen', 'Mira']);
  assert.equal(named(scene, 'Goblin 2').hidden, true);

  // The bandit is hidden in the encounter; Goblin 2, on the map.
  for (const read of [await s.player(path), await s.player(`${s.root}/scenes/active`)]) {
    assert.deepEqual(names(await sceneOf(read)), ['Goblin 1', 'Kaelen', 'Mira']);
  }
});

test('the master hides, reveals, renames a free token and removes tokens', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  let scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Barril', size: 'medium' }), 201);
  const barrel = named(scene, 'Barril');
  scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);

  scene = await sceneOf(await send(s.master, `${path}/tokens/${barrel.id}`, 'PATCH', { hidden: true, label: 'Barril de pólvora' }));
  assert.deepEqual([named(scene, 'Barril de pólvora').hidden, named(scene, 'Barril de pólvora').initials], [true, 'BP']);
  assert.equal((await send(s.master, `${path}/tokens/${named(scene, 'Kaelen').id}`, 'PATCH', { label: 'Outro' })).status, 422);
  assert.equal((await send(s.master, `${path}/tokens/${barrel.id}`, 'PATCH', {})).status, 422);
  assert.equal((await send(s.master, `${path}/tokens/${barrel.id}`, 'PATCH', { hidden: 'sim' })).status, 422);

  scene = await sceneOf(await s.master(`${path}/tokens/${barrel.id}`, { method: 'DELETE' }));
  assert.deepEqual(names(scene), ['Kaelen']);
  assert.equal((await s.master(`${path}/tokens/${barrel.id}`, { method: 'DELETE' })).status, 404);
});

test('a grabbed token is locked for everyone else until the drop', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  let scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
  const kaelen = named(scene, 'Kaelen');
  const token = `${path}/tokens/${kaelen.id}`;

  scene = await sceneOf(await send(s.player, `${token}/grab`, 'POST'));
  assert.deepEqual(named(scene, 'Kaelen').movingBy, { userId: kaelen.ownerId, name: 'Rafael Costa' });
  // Grabbing again is the same drag.
  await sceneOf(await send(s.player, `${token}/grab`, 'POST'));

  const second = await send(s.master, `${token}/grab`, 'POST');
  assert.equal(second.status, 409);
  const conflict = await body<TokenLockedResponse>(second);
  assert.equal(conflict.movingBy.name, 'Rafael Costa');
  assert.match(conflict.error, /Rafael Costa está movendo/);
  assert.equal((await send(s.master, token, 'PATCH', { x: 500, y: 300 })).status, 409);
  // Hiding is not moving: the master still may.
  await sceneOf(await send(s.master, token, 'PATCH', { hidden: true }));
  await sceneOf(await send(s.master, token, 'PATCH', { hidden: false }));

  scene = await sceneOf(await send(s.player, token, 'PATCH', { x: 250, y: 250 }));
  assert.equal(named(scene, 'Kaelen').movingBy, null);
  await sceneOf(await send(s.master, `${token}/grab`, 'POST'));
});

test('token.move is relayed to whoever sees the token, only from the holder of its lock', () =>
  withServer({}, async (_server, s, socketOf) => {
    const { path } = await openScene(s);
    await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
    const scene = await sceneOf(await add(s, path, { kind: 'free', label: 'Armadilha', size: 'medium' }), 201);
    const kaelen = named(scene, 'Kaelen');
    const trap = named(scene, 'Armadilha');
    await send(s.master, `${path}/tokens/${trap.id}`, 'PATCH', { hidden: true });

    const masterSocket = await socketOf('lia');
    const playerSocket = await socketOf('rafael');
    const otherSocket = await socketOf('bia');
    const [toMaster, toPlayer, toOther] = [masterSocket, playerSocket, otherSocket].map(collect);
    const move = (socket: WebSocket, tokenId: string, x: number, y: number) => socket.send(JSON.stringify({ type: 'token.move', tokenId, x, y }));

    await sceneOf(await send(s.player, `${path}/tokens/${kaelen.id}/grab`, 'POST'));
    // Without the lock, nothing goes out.
    move(otherSocket, kaelen.id, 60, 60);
    move(playerSocket, kaelen.id, 70, 80);
    // Off the map, clamped.
    move(playerSocket, kaelen.id, 9000, -5);
    await until(() => moving(toOther).length === 2 && moving(toMaster).length === 2);
    assert.deepEqual(moving(toOther), [[kaelen.id, 70, 80], [kaelen.id, 600, 0]]);
    assert.deepEqual(moving(toMaster), moving(toOther));
    // The sender does not hear itself.
    assert.deepEqual(moving(toPlayer), []);

    // A hidden token's moves reach the master only.
    await sceneOf(await send(s.master, `${path}/tokens/${trap.id}/grab`, 'POST'));
    move(masterSocket, trap.id, 100, 100);
    move(playerSocket, kaelen.id, 90, 90);
    await until(() => moving(toOther).length === 3);
    assert.deepEqual(moving(toOther).at(-1), [kaelen.id, 90, 90]);
    assert.deepEqual(moving(toPlayer), []);
    // Nothing was saved.
    assert.deepEqual([stored(s, kaelen.id)?.x, stored(s, trap.id)?.x], [kaelen.x, trap.x]);
  }));

test("closing the holder's socket saves the last position received and frees the token", () =>
  withServer({}, async (_server, s, socketOf) => {
    const { path } = await openScene(s);
    const scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
    const kaelen = named(scene, 'Kaelen');

    const toMaster = collect(await socketOf('lia'));
    const playerSocket = await socketOf('rafael');
    await sceneOf(await send(s.player, `${path}/tokens/${kaelen.id}/grab`, 'POST'));
    playerSocket.send(JSON.stringify({ type: 'token.move', tokenId: kaelen.id, x: 333, y: 205 }));
    await until(() => moving(toMaster).length === 1);
    playerSocket.close();

    await until(() => lastScene(toMaster)?.tokens[0]?.movingBy === null && lastScene(toMaster)?.tokens[0]?.x !== kaelen.x);
    assert.deepEqual([lastScene(toMaster)!.tokens[0].x, lastScene(toMaster)!.tokens[0].y], [330, 210]);
    assert.deepEqual([stored(s, kaelen.id)?.x, stored(s, kaelen.id)?.y], [330, 210]);
    await sceneOf(await send(s.master, `${path}/tokens/${kaelen.id}/grab`, 'POST'));
  }));

test('a lock with no move in time frees the token where it was last seen', () =>
  withServer({ locks: createTokenLocks({ ttlMs: 100 }) }, async (_server, s, socketOf) => {
    const { path } = await openScene(s);
    const scene = await sceneOf(await add(s, path, { kind: 'character', characterId: s.kaelen.id }), 201);
    const kaelen = named(scene, 'Kaelen');
    const playerSocket = await socketOf('rafael');

    await sceneOf(await send(s.player, `${path}/tokens/${kaelen.id}/grab`, 'POST'));
    playerSocket.send(JSON.stringify({ type: 'token.move', tokenId: kaelen.id, x: 251, y: 251 }));
    await until(() => stored(s, kaelen.id)?.x === 250);
    assert.equal(named(await sceneOf(await s.master(path)), 'Kaelen').movingBy, null);
    await sceneOf(await send(s.master, `${path}/tokens/${kaelen.id}/grab`, 'POST'));
  }));

test('a frame over 1 KB closes the socket', () =>
  withServer({}, async (_server, _s, socketOf) => {
    const socket = await socketOf('rafael');
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));
    socket.send('x'.repeat(2048));
    assert.equal(await closed, 1009);
  }));

test('the combat changes the map: a hidden, removed or deleted combatant takes its token along', () =>
  withServer({}, async (_server, s, socketOf) => {
    const { path } = await openScene(s);
    const { encounter, id } = await runningEncounter(s, { start: false });
    const combat = `${s.base}/${encounter.id}`;
    await sceneOf(await send(s.master, `${path}/tokens/encounter`, 'POST', { encounterId: encounter.id, x: 30, y: 30 }), 201);
    const toPlayer = collect(await socketOf('rafael'));

    await send(s.master, `${combat}/combatants/${id('Goblin 1')}`, 'PATCH', { hidden: true });
    await until(() => lastScene(toPlayer) !== undefined && !names(lastScene(toPlayer)!).includes('Goblin 1'));
    assert.deepEqual(names(lastScene(toPlayer)!), ['Goblin 2', 'Kaelen', 'Mira']);

    await s.master(`${combat}/combatants/${id('Goblin 2')}`, { method: 'DELETE' });
    await until(() => !names(lastScene(toPlayer)!).includes('Goblin 2'));
    assert.deepEqual(names(await sceneOf(await s.master(path))), ['Bandido', 'Goblin 1', 'Kaelen', 'Mira']);

    // Deleting the encounter takes its monsters off; the characters stay.
    assert.equal((await s.master(combat, { method: 'DELETE' })).status, 204);
    assert.deepEqual(names(await sceneOf(await s.master(path))), ['Kaelen', 'Mira']);

    // A sheet change shows on its token; deleting the character removes it.
    const sheetVersion = lastScene(toPlayer)!.version;
    const edit = await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...(await sheetOf(s, s.kaelen.id)), name: 'Kaelen Folha' });
    assert.equal(edit.status, 200, await edit.clone().text());
    await until(() => lastScene(toPlayer)!.version > sheetVersion);
    assert.ok(names(lastScene(toPlayer)!).includes('Kaelen Folha'));
    await s.player(`${s.root}/characters/${s.kaelen.id}`, { method: 'DELETE' });
    await until(() => !names(lastScene(toPlayer)!).includes('Kaelen Folha'));
    assert.deepEqual(names(lastScene(toPlayer)!), ['Mira']);
  }));

test('swapping the map moves the tokens in proportion', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  await add(s, path, { kind: 'free', label: 'Barril', size: 'medium', x: 590, y: 390 });
  const form = new FormData();
  form.set('image', new Blob([await testImageBytes('png', 300, 200)], { type: 'image/png' }), 'mapa.png');
  const scene = await sceneOf(await s.master(`${path}/map`, { method: 'PUT', body: form }));
  assert.deepEqual([named(scene, 'Barril').x, named(scene, 'Barril').y], [295, 195]);
});

async function sheetOf(s: Setup, characterId: string) {
  const { character } = await body<{ character: Record<string, unknown> }>(await s.player(`${s.root}/characters/${characterId}`));
  const { id: _id, ownerId: _owner, avatarUrl: _url, createdAt: _created, updatedAt: _updated, ...sheet } = character;
  return sheet;
}
