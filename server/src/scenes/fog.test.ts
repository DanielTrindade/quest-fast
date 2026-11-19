import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import type WebSocket from 'ws';
import { scenes } from '@quest-fast/db';
import type { FogOperation, SceneResponse, SceneView, SocketMessage } from '@quest-fast/shared';
import { body, createTestServer, signIn, testImageBytes } from '../testing.ts';
import { PROFILES, connect, runningEncounter, send, setup, until, type Request, type Setup } from '../combat/test-setup.ts';

/** A 600 × 400 map, open for the table. */
async function openScene(s: Setup) {
  const form = new FormData();
  form.set('name', 'Cripta de Phandalin');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const created = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  await sceneOf(await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id }));
  return { scene: created, path: `${s.root}/scenes/${created.id}` };
}

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

function fog(request: Request, path: string, operation: FogOperation | Record<string, unknown>) {
  return send(request, `${path}/fog`, 'POST', operation);
}

const revealRect = (x: number, y: number, width: number, height: number): FogOperation => ({
  mode: 'reveal',
  shape: { kind: 'rect', x, y, width, height },
});

/** The scene as the player receives it over REST. */
async function playerView(s: Setup, request: Request = s.player) {
  return sceneOf(await request(`${s.root}/scenes/active`));
}

function names(scene: SceneView) {
  return scene.tokens.map((token) => token.name).sort();
}

/**
 * Kaelen at the left, in the room the tests reveal (0–200 × 0–200); a goblin
 * of the encounter and a free trap at the right, under the fog.
 */
async function crypt(s: Setup) {
  const opened = await openScene(s);
  const { id } = await runningEncounter(s, { start: false });
  const add = async (input: Record<string, unknown>) => sceneOf(await send(s.master, `${opened.path}/tokens`, 'POST', input), 201);
  await add({ kind: 'character', characterId: s.kaelen.id, x: 100, y: 100 });
  await add({ kind: 'combatant', combatantId: id('Goblin 1'), x: 450, y: 100 });
  const scene = await add({ kind: 'free', label: 'Armadilha', size: 'medium', x: 450, y: 300 });
  return { ...opened, scene };
}

test('a player neither turns the fog on nor reveals; on a closed scene it does not exist', async () => {
  const s = await setup();
  const { path } = await crypt(s);

  for (const request of [s.player, s.otherPlayer]) {
    assert.equal((await send(request, path, 'PATCH', { fogEnabled: true })).status, 403);
    assert.equal((await fog(request, path, revealRect(0, 0, 100, 100))).status, 403);
  }
  for (const response of [await send(s.outsider, path, 'PATCH', { fogEnabled: true }), await fog(s.outsider, path, revealRect(0, 0, 100, 100))]) {
    assert.equal(response.status, 404);
  }
  await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: null });
  assert.equal((await fog(s.player, path, revealRect(0, 0, 100, 100))).status, 404);
  assert.equal((await send(s.player, path, 'PATCH', { fogEnabled: true })).status, 404);

  const row = s.app.db.select().from(scenes).where(eq(scenes.id, path.split('/').at(-1)!)).get()!;
  assert.deepEqual([row.fogEnabled, row.fogRevealed], [false, []]);
});

test('a broken operation or toggle is refused and changes nothing', async () => {
  const s = await setup();
  const { path, scene } = await crypt(s);
  for (const operation of [{}, { mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [1, 1]] } }, revealRect(0, 0, 0, 10)]) {
    const response = await fog(s.master, path, operation);
    assert.equal(response.status, 422);
    assert.match((await body<{ error: string }>(response)).error, /fog/);
  }
  assert.equal((await send(s.master, path, 'PATCH', { fogEnabled: 'sim' })).status, 422);
  const after = await sceneOf(await s.master(path));
  assert.equal(after.version, scene.version);
});

test('with the fog on a player receives no creature under it, and a reveal brings it in', async () => {
  const s = await setup();
  const { path } = await crypt(s);
  assert.deepEqual(names(await playerView(s)), ['Armadilha', 'Goblin 1', 'Kaelen'], 'fog off: everything shows');

  let master = await sceneOf(await send(s.master, path, 'PATCH', { fogEnabled: true }));
  assert.deepEqual(master.fog, { enabled: true, revealed: [] });
  assert.deepEqual(names(master), ['Armadilha', 'Goblin 1', 'Kaelen'], 'the master sees every token');
  const player = await playerView(s);
  assert.deepEqual(names(player), ['Kaelen'], 'a character shows even under the fog');
  assert.deepEqual(player.fog, { enabled: true, revealed: [] });

  master = await sceneOf(await fog(s.master, path, revealRect(0, 0, 200, 200)));
  assert.equal(master.fog.revealed.length, 1);
  assert.deepEqual(names(await playerView(s)), ['Kaelen'], 'the room with Kaelen only');

  await sceneOf(await fog(s.master, path, revealRect(400, 50, 100, 100)));
  assert.deepEqual(names(await playerView(s, s.otherPlayer)), ['Goblin 1', 'Kaelen'], 'the goblin room revealed');

  await sceneOf(await fog(s.master, path, { mode: 'hide', shape: { kind: 'polygon', points: [[420, 70], [480, 70], [480, 130], [420, 130]] } }));
  assert.deepEqual(names(await playerView(s)), ['Kaelen'], 'hidden again around the goblin');

  await sceneOf(await fog(s.master, path, { mode: 'reveal', shape: { kind: 'all' } }));
  assert.deepEqual(names(await playerView(s)), ['Armadilha', 'Goblin 1', 'Kaelen']);
});

test('a token under the fog does not exist for a player, not even to move or grab', async () => {
  const s = await setup();
  const { path } = await crypt(s);
  await send(s.master, path, 'PATCH', { fogEnabled: true });
  const trap = (await sceneOf(await s.master(path))).tokens.find((token) => token.name === 'Armadilha')!;
  assert.equal((await send(s.player, `${path}/tokens/${trap.id}`, 'PATCH', { x: 100, y: 100 })).status, 404);
  assert.equal((await send(s.player, `${path}/tokens/${trap.id}/grab`, 'POST')).status, 404);
});

test('turning the fog off keeps what was revealed', async () => {
  const s = await setup();
  const { path } = await crypt(s);
  await send(s.master, path, 'PATCH', { fogEnabled: true });
  const revealed = (await sceneOf(await fog(s.master, path, revealRect(0, 0, 200, 200)))).fog.revealed;
  assert.deepEqual((await sceneOf(await send(s.master, path, 'PATCH', { fogEnabled: false }))).fog, { enabled: false, revealed });
  assert.deepEqual((await sceneOf(await send(s.master, path, 'PATCH', { fogEnabled: true }))).fog, { enabled: true, revealed });
});

test('swapping the map scales the fog with the grid', async () => {
  const s = await setup();
  const { path } = await crypt(s);
  await fog(s.master, path, revealRect(0, 0, 200, 100));
  const form = new FormData();
  form.set('image', new Blob([await testImageBytes('png', 1200, 800)], { type: 'image/png' }), 'mapa.png');
  const swapped = await sceneOf(await s.master(`${path}/map`, { method: 'PUT', body: form }));
  const xs = swapped.fog.revealed[0]![0]!.map(([x]) => x);
  const ys = swapped.fog.revealed[0]![0]!.map(([, y]) => y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 400, 0, 200]);
});

function collect(socket: WebSocket): SocketMessage[] {
  const messages: SocketMessage[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as SocketMessage));
  return messages;
}

function moving(messages: SocketMessage[]) {
  return messages.flatMap((message) => (message.type === 'token.moving' ? [[message.x, message.y]] : []));
}

function lastScene(messages: SocketMessage[]): SceneView | undefined {
  return messages.flatMap((message) => (message.type === 'scene.updated' ? [message.scene] : [])).at(-1);
}

test('the socket keeps a creature under the fog from a player: its moves there and the scene', async () => {
  const server = await createTestServer(PROFILES, {});
  const sockets: WebSocket[] = [];
  try {
    const s = await setup(server);
    const { path } = await crypt(s);
    await send(s.master, path, 'PATCH', { fogEnabled: true });
    await fog(s.master, path, revealRect(0, 0, 300, 400));
    const goblin = (await sceneOf(await s.master(path))).tokens.find((token) => token.name === 'Goblin 1')!;

    for (const code of ['lia', 'rafael'] as const) {
      const socket = connect(server.port, s.campaign.id, await signIn(server, code));
      sockets.push(socket);
      await new Promise((resolve) => socket.once('open', resolve));
    }
    const [masterSocket, playerSocket] = sockets as [WebSocket, WebSocket];
    const toPlayer = collect(playerSocket);
    const move = (x: number, y: number) => masterSocket.send(JSON.stringify({ type: 'token.move', tokenId: goblin.id, x, y }));

    await sceneOf(await send(s.master, `${path}/tokens/${goblin.id}/grab`, 'POST'));
    // Out of the fog into the revealed room, then back under the fog.
    move(500, 100);
    move(250, 100);
    move(200, 150);
    move(350, 150);
    move(150, 200);
    await until(() => moving(toPlayer).length === 3);
    assert.deepEqual(moving(toPlayer), [[250, 100], [200, 150], [150, 200]], 'only the moves inside the revealed area');

    // Dropped in the revealed room, the goblin joins the player's scene.
    await sceneOf(await send(s.master, `${path}/tokens/${goblin.id}`, 'PATCH', { x: 150, y: 200 }));
    await until(() => lastScene(toPlayer)?.tokens.some((token) => token.id === goblin.id) === true);

    // Hiding the room takes it away again, with no other step.
    await fog(s.master, path, { mode: 'hide', shape: { kind: 'all' } });
    await until(() => lastScene(toPlayer)?.fog.revealed.length === 0);
    assert.deepEqual(names(lastScene(toPlayer)!), ['Kaelen']);
  } finally {
    for (const socket of sockets) socket.terminate();
    await server.close();
  }
});
