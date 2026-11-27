import test from 'node:test';
import assert from 'node:assert/strict';
import type WebSocket from 'ws';
import type { SceneResponse, SceneView, SocketMessage } from '@quest-fast/shared';
import { body, createTestServer, signIn, testImageBytes } from '../testing.ts';
import { PROFILES, connect, send, setup, until, type Setup } from '../combat/test-setup.ts';

/** A 600 × 400 map; open for the table unless `open` is false. */
async function scene(s: Setup, open = true) {
  const form = new FormData();
  form.set('name', 'Clareira');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const response = await s.master(`${s.root}/scenes`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const created: SceneView = (await body<SceneResponse>(response)).scene;
  if (open) assert.equal((await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id })).status, 200);
  return { scene: created, path: `${s.root}/scenes/${created.id}` };
}

type Preview = Extract<SocketMessage, { type: 'area.previewing' }>;

function previews(socket: WebSocket): Preview[] {
  const received: Preview[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'area.previewing') received.push(message);
  });
  return received;
}

const sphere = (x: number, y: number) => ({ shape: 'sphere', size: 6, width: 1.5, x, y, angle: 0 });

/** A real server with the master's and two players' sockets, always closed at the end. */
async function withSockets(run: (s: Setup, sockets: { lia: WebSocket; rafael: WebSocket; bia: WebSocket }) => Promise<void>) {
  const server = await createTestServer(PROFILES, {});
  const open: WebSocket[] = [];
  try {
    const s = await setup(server);
    const socketOf = async (code: keyof typeof PROFILES) => {
      const socket = connect(server.port, s.campaign.id, await signIn(server, code));
      open.push(socket);
      await new Promise((resolve) => socket.once('open', resolve));
      return socket;
    };
    await run(s, { lia: await socketOf('lia'), rafael: await socketOf('rafael'), bia: await socketOf('bia') });
  } finally {
    for (const socket of open) socket.terminate();
    await server.close();
  }
}

test('a player draws a reference area and the table watches it, never the author', async () => {
  await withSockets(async (s, { lia, rafael, bia }) => {
    const { scene: opened } = await scene(s);
    const toMaster = previews(lia);
    const toOther = previews(bia);
    const toSelf = previews(rafael);
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(100, 100), done: false }));
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(900, 120), done: true }));
    await until(() => toMaster.length === 2 && toOther.length === 2);
    assert.deepEqual(toOther.map((preview) => [preview.area?.x, preview.area?.y, preview.done]), [[100, 100, false], [600, 120, true]], 'the origin is kept on the map');
    assert.deepEqual(toMaster[0]!.by, { userId: toMaster[0]!.by.userId, name: 'Rafael Costa' });
    assert.equal(toSelf.length, 0);
  });
});

test('a reference area only travels on the scene open for the table, and never one that breaks the rules', async () => {
  await withSockets(async (s, { lia, rafael }) => {
    const { scene: closed } = await scene(s, false);
    const { scene: opened } = await scene(s);
    const toMaster = previews(lia);
    // The master's other scene, a bad shape, a bad message: all dropped.
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: closed.id, area: sphere(100, 100), done: false }));
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: { ...sphere(100, 100), size: 2 }, done: false }));
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(100, 100), done: 'yes' }));
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(200, 200), done: false }));
    await until(() => toMaster.length === 1);
    assert.equal(toMaster[0]!.area?.x, 200);
  });
});

test('under the fog a master reference area stops reaching the player, and its clear too', async () => {
  await withSockets(async (s, { lia, rafael }) => {
    const { scene: opened, path } = await scene(s);
    await send(s.master, path, 'PATCH', { fogEnabled: true });
    await send(s.master, `${path}/fog`, 'POST', { mode: 'reveal', shape: { kind: 'rect', x: 0, y: 0, width: 300, height: 400 } });
    const toPlayer = previews(rafael);
    const preview = (area: ReturnType<typeof sphere> | null, done = false) =>
      lia.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area, done }));

    preview(sphere(100, 100));
    preview(sphere(500, 100));
    preview(null);
    // Back in the revealed room, then cleared there.
    preview(sphere(200, 100));
    preview(null);
    await until(() => toPlayer.length === 3);
    assert.deepEqual(toPlayer.map((message) => message.area?.x ?? null), [100, 200, null]);

    // A player's area shows under the fog.
    const toMaster = previews(lia);
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(500, 100), done: false }));
    await until(() => toMaster.length === 1);
  });
});

test('a reference area let go can still be cleared for whoever sees it', async () => {
  await withSockets(async (s, { lia, rafael }) => {
    const { scene: opened } = await scene(s);
    const toMaster = previews(lia);
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(100, 100), done: true }));
    rafael.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: null, done: false }));
    await until(() => toMaster.length === 2);
    assert.deepEqual(toMaster.map((message) => [message.area?.x ?? null, message.done]), [[100, true], [null, false]]);
  });
});

test('the fog is checked where the area goes out, kept on the map', async () => {
  await withSockets(async (s, { lia, rafael }) => {
    const { scene: opened, path } = await scene(s);
    await send(s.master, path, 'PATCH', { fogEnabled: true });
    await send(s.master, `${path}/fog`, 'POST', { mode: 'reveal', shape: { kind: 'all' } });
    const toPlayer = previews(rafael);
    // Past the right edge: it goes out at (600, 100), which is revealed.
    lia.send(JSON.stringify({ type: 'area.preview', sceneId: opened.id, area: sphere(900, 100), done: false }));
    await until(() => toPlayer.length === 1);
    assert.equal(toPlayer[0]!.area?.x, 600);
  });
});
