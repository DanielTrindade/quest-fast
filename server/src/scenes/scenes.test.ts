import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { assets, scenes } from '@quest-fast/db';
import type { SceneListResponse, SceneResponse, SceneView, SocketMessage } from '@quest-fast/shared';
import { body, createTestServer, signIn, testImageBytes } from '../testing.ts';
import { PROFILES, connect, send, setup, until, type Request, type Setup } from '../combat/test-setup.ts';

function mapForm(fields: { name?: string; image?: Blob | Uint8Array<ArrayBuffer> }) {
  const form = new FormData();
  if (fields.name !== undefined) form.set('name', fields.name);
  if (fields.image) {
    const image = fields.image instanceof Uint8Array ? new Blob([fields.image], { type: 'image/png' }) : fields.image;
    form.set('image', image, 'mapa.png');
  }
  return form;
}

async function png(width = 300, height = 200) {
  return testImageBytes('png', width, height);
}

function upload(request: Request, path: string, form: FormData, method = 'POST') {
  return request(path, { method, body: form });
}

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

async function createScene(s: Setup, name = 'Estrada de Triboar', image?: Uint8Array<ArrayBuffer>) {
  return sceneOf(await upload(s.master, `${s.root}/scenes`, mapForm({ name, image: image ?? (await png()) })), 201);
}

function openScene(s: Setup, sceneId: string | null) {
  return send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId });
}

function storedScene(s: Setup, id: string) {
  return s.app.db.select().from(scenes).where(eq(scenes.id, id)).get();
}

test('the master creates a scene with a snapping grid of 30 cells, closed for the table', async () => {
  const s = await setup();
  const scene = await createScene(s);
  assert.equal(scene.name, 'Estrada de Triboar');
  assert.deepEqual([scene.mapWidth, scene.mapHeight], [300, 200]);
  assert.match(scene.mapUrl, /^\/uploads\/campaigns\/.+\.jpg$/);
  assert.deepEqual(scene.grid, { enabled: true, cellSize: 10, offsetX: 0, offsetY: 0, snap: true });
  assert.equal(scene.active, false);
  assert.equal(scene.version, 0);

  const list = await body<SceneListResponse>(await s.master(`${s.root}/scenes`));
  assert.deepEqual(list.scenes.map((row) => [row.id, row.active]), [[scene.id, false]]);

  const asset = s.app.db.select().from(assets).where(eq(assets.id, storedScene(s, scene.id)!.mapAssetId)).get();
  assert.equal(asset?.mimeType, 'image/jpeg');
});

test('a player neither lists, creates, edits, swaps the map of, deletes nor opens a scene', async () => {
  const s = await setup();
  const scene = await createScene(s);
  const path = `${s.root}/scenes/${scene.id}`;

  assert.equal((await s.player(`${s.root}/scenes`)).status, 403);
  assert.equal((await upload(s.player, `${s.root}/scenes`, mapForm({ name: 'Minha', image: await png() }))).status, 403);
  assert.equal((await openScene({ ...s, master: s.player }, scene.id)).status, 403);

  // A closed scene does not exist for a player.
  assert.equal((await s.player(path)).status, 404);
  assert.equal((await send(s.player, path, 'PATCH', { name: 'Outra' })).status, 404);
  assert.equal((await upload(s.player, `${path}/map`, mapForm({ image: await png() }), 'PUT')).status, 404);
  assert.equal((await s.player(path, { method: 'DELETE' })).status, 404);

  // Open, it is visible but still the master's.
  await sceneOf(await openScene(s, scene.id));
  assert.equal((await s.player(path)).status, 200);
  assert.equal((await send(s.player, path, 'PATCH', { name: 'Outra', grid: { enabled: false } })).status, 403);
  assert.equal((await upload(s.player, `${path}/map`, mapForm({ image: await png(500, 500) }), 'PUT')).status, 403);
  assert.equal((await s.player(path, { method: 'DELETE' })).status, 403);
  assert.equal((await openScene({ ...s, master: s.player }, null)).status, 403);

  const stored = storedScene(s, scene.id)!;
  assert.deepEqual([stored.name, stored.gridEnabled, stored.mapWidth], ['Estrada de Triboar', true, 300]);
});

test('someone outside the campaign gets 404 on every scene route', async () => {
  const s = await setup();
  const scene = await createScene(s);
  await openScene(s, scene.id);
  const path = `${s.root}/scenes/${scene.id}`;
  for (const response of [
    await s.outsider(`${s.root}/scenes`),
    await s.outsider(`${s.root}/scenes/active`),
    await s.outsider(path),
    await send(s.outsider, path, 'PATCH', { name: 'Outra' }),
    await s.outsider(path, { method: 'DELETE' }),
    await upload(s.outsider, `${s.root}/scenes`, mapForm({ name: 'X', image: await png() })),
  ]) {
    assert.equal(response.status, 404);
  }
});

test('the open scene is what a player reads at /active; with none, 204', async () => {
  const s = await setup();
  assert.equal((await s.player(`${s.root}/scenes/active`)).status, 204);
  const first = await createScene(s, 'Estrada');
  const second = await createScene(s, 'Caverna');

  const opened = await sceneOf(await openScene(s, first.id));
  assert.equal(opened.active, true);
  assert.equal(opened.version, 1);
  assert.equal((await sceneOf(await s.player(`${s.root}/scenes/active`))).id, first.id);

  // Opening another closes the first: the player no longer reaches it.
  await sceneOf(await openScene(s, second.id));
  assert.equal((await sceneOf(await s.player(`${s.root}/scenes/active`))).id, second.id);
  assert.equal((await s.player(`${s.root}/scenes/${first.id}`)).status, 404);
  assert.equal(storedScene(s, first.id)!.version, 2);

  assert.equal((await openScene(s, null)).status, 204);
  assert.equal((await s.player(`${s.root}/scenes/active`)).status, 204);
  assert.equal((await openScene(s, 'no-such-scene')).status, 404);
});

test('an upload that is not a map image is refused and nothing is stored', async () => {
  const s = await setup();
  const create = (form: FormData) => upload(s.master, `${s.root}/scenes`, form);

  const notImage = await create(mapForm({ name: 'X', image: new TextEncoder().encode('não sou imagem') }));
  assert.equal(notImage.status, 422);
  assert.match((await body<{ error: string }>(notImage)).error, /não é uma imagem válida/);

  assert.equal((await create(mapForm({ name: 'X' }))).status, 422);
  assert.equal((await create(mapForm({ name: '  ', image: await png() }))).status, 422);
  assert.equal((await create(mapForm({ name: 'X'.repeat(81), image: await png() }))).status, 422);

  const huge = await create(mapForm({ name: 'X', image: await png(8193, 64) }));
  assert.equal(huge.status, 422);
  assert.match((await body<{ error: string }>(huge)).error, /8192/);

  const heavy = await create(mapForm({ name: 'X', image: new Uint8Array(25 * 1024 * 1024 + 1) }));
  assert.equal(heavy.status, 413);
  assert.match((await body<{ error: string }>(heavy)).error, /25 MB/);

  assert.equal(s.app.db.select().from(scenes).all().length, 0);
  assert.equal(s.app.db.select().from(assets).all().length, 0);
});

test('a map wider than 4096 px is stored at 4096', async () => {
  const s = await setup();
  const scene = await createScene(s, 'Mapa grande', await png(6000, 3000));
  assert.deepEqual([scene.mapWidth, scene.mapHeight], [4096, 2048]);
  assert.equal(scene.grid.cellSize, 4096 / 30);
});

test('the master renames the scene and sets its grid; a grid that does not fit is refused', async () => {
  const s = await setup();
  const scene = await createScene(s);
  const path = `${s.root}/scenes/${scene.id}`;

  const edited = await sceneOf(
    await send(s.master, path, 'PATCH', { name: 'Ponte', grid: { cellSize: 20, offsetX: 5, offsetY: 19.5, snap: false } }),
  );
  assert.equal(edited.name, 'Ponte');
  assert.deepEqual(edited.grid, { enabled: true, cellSize: 20, offsetX: 5, offsetY: 19.5, snap: false });
  assert.equal(edited.version, 1);

  for (const grid of [{ cellSize: 7 }, { cellSize: 301 }, { offsetX: 20 }, { offsetY: -1 }, { enabled: 'sim' }]) {
    const response = await send(s.master, path, 'PATCH', { grid });
    assert.equal(response.status, 422, JSON.stringify(grid));
  }
  assert.equal((await send(s.master, path, 'PATCH', { name: '' })).status, 422);
  assert.equal((await send(s.master, path, 'PATCH', {})).status, 422);
  assert.equal(storedScene(s, scene.id)!.version, 1);
});

test('swapping the map keeps the grid in proportion and drops the old asset row', async () => {
  const s = await setup();
  const scene = await createScene(s);
  const path = `${s.root}/scenes/${scene.id}`;
  await sceneOf(await send(s.master, path, 'PATCH', { grid: { cellSize: 20, offsetX: 5 } }));
  const oldAsset = storedScene(s, scene.id)!.mapAssetId;

  const swapped = await sceneOf(await upload(s.master, `${path}/map`, mapForm({ image: await png(600, 400) }), 'PUT'));
  assert.deepEqual([swapped.mapWidth, swapped.mapHeight], [600, 400]);
  assert.deepEqual(swapped.grid, { enabled: true, cellSize: 40, offsetX: 10, offsetY: 0, snap: true });
  assert.notEqual(swapped.mapUrl, scene.mapUrl);
  assert.equal(s.app.db.select().from(assets).where(eq(assets.id, oldAsset)).get(), undefined);

  assert.equal((await upload(s.master, `${path}/map`, mapForm({ image: new Uint8Array([1, 2]) }), 'PUT')).status, 422);
  assert.equal(storedScene(s, scene.id)!.mapWidth, 600);
});

test('deleting a scene removes its map row and, if open, closes the map', async () => {
  const s = await setup();
  const scene = await createScene(s);
  await openScene(s, scene.id);
  const assetId = storedScene(s, scene.id)!.mapAssetId;

  assert.equal((await s.master(`${s.root}/scenes/${scene.id}`, { method: 'DELETE' })).status, 204);
  assert.equal(storedScene(s, scene.id), undefined);
  assert.equal(s.app.db.select().from(assets).where(eq(assets.id, assetId)).get(), undefined);
  assert.equal((await s.player(`${s.root}/scenes/active`)).status, 204);
  assert.equal((await s.master(`${s.root}/scenes/${scene.id}`, { method: 'DELETE' })).status, 404);
});

/** Every scene message a socket receives, in order. */
function collectScenes(socket: ReturnType<typeof connect>) {
  const messages: Extract<SocketMessage, { type: 'scene.updated' | 'scene.closed' }>[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'scene.updated' || message.type === 'scene.closed') messages.push(message);
  });
  return messages;
}

test('a player socket receives only the open scene; closing and deleting it send scene.closed', async () => {
  const server = await createTestServer(PROFILES);
  try {
    const s = await setup(server);
    const masterSocket = connect(server.port, s.campaign.id, await signIn(server, 'lia'));
    const playerSocket = connect(server.port, s.campaign.id, await signIn(server, 'rafael'));
    await Promise.all([masterSocket, playerSocket].map((socket) => new Promise((resolve) => socket.once('open', resolve))));
    const toMaster = collectScenes(masterSocket);
    const toPlayer = collectScenes(playerSocket);

    // A closed scene and its edits reach only the master.
    const first = await createScene(s, 'Estrada');
    await send(s.master, `${s.root}/scenes/${first.id}`, 'PATCH', { name: 'Estrada velha' });
    await until(() => toMaster.length === 2);
    assert.equal(toPlayer.length, 0);

    // Opening it sends it to the table; its edits follow.
    await openScene(s, first.id);
    await send(s.master, `${s.root}/scenes/${first.id}`, 'PATCH', { grid: { enabled: false } });
    await until(() => toPlayer.length === 2);
    assert.deepEqual(
      toPlayer.map((message) => message.type === 'scene.updated' && [message.scene.id, message.scene.version, message.scene.grid.enabled]),
      [[first.id, 2, true], [first.id, 3, false]],
    );

    // Opening another replaces it for the player; the master also learns the first closed.
    const second = await createScene(s, 'Caverna');
    await openScene(s, second.id);
    await until(() => toPlayer.length === 3);
    const last = toPlayer.at(-1)!;
    assert.ok(last.type === 'scene.updated' && last.scene.id === second.id && last.scene.active);
    await until(() => toMaster.some((message) => message.type === 'scene.updated' && message.scene.id === first.id && !message.scene.active));

    // Deleting a closed scene says nothing to the table.
    await s.master(`${s.root}/scenes/${first.id}`, { method: 'DELETE' });
    // Deleting the open one takes it off every screen.
    await s.master(`${s.root}/scenes/${second.id}`, { method: 'DELETE' });
    await until(() => toPlayer.length === 4);
    assert.deepEqual(toPlayer.at(-1), { type: 'scene.closed', sceneId: second.id });
    await until(() => toMaster.at(-1)?.type === 'scene.closed');

    // Closing the map sends scene.closed too.
    const third = await createScene(s, 'Torre');
    await openScene(s, third.id);
    await openScene(s, null);
    await until(() => toPlayer.length === 6);
    assert.deepEqual(toPlayer.at(-1), { type: 'scene.closed', sceneId: third.id });

    masterSocket.close();
    playerSocket.close();
  } finally {
    await server.close();
  }
});
