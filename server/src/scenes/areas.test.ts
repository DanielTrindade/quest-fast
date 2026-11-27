import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { sceneAreas } from '@quest-fast/db';
import { AREA_LIMITS, type AreaView, type SceneResponse, type SceneView } from '@quest-fast/shared';
import { body, testImageBytes } from '../testing.ts';
import { send, setup, type Request, type Setup } from '../combat/test-setup.ts';

/** A 600 × 400 map open for the table: the default grid has 20 px cells, 1,5 m each. */
async function openScene(s: Setup) {
  const form = new FormData();
  form.set('name', 'Clareira');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const created = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  await sceneOf(await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id }));
  return { scene: created, path: `${s.root}/scenes/${created.id}` };
}

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

const WEB = { shape: 'cube', size: 6, x: 101, y: 99, angle: 0, name: 'Teia', color: 'slate' };

function addArea(request: Request, path: string, input: Record<string, unknown> = {}) {
  return send(request, `${path}/areas`, 'POST', { ...WEB, ...input });
}

function named(scene: SceneView, name: string): AreaView {
  const area = scene.areas.find((candidate) => candidate.name === name);
  assert.ok(area, `${name} is on the scene`);
  return area;
}

async function playerView(s: Setup, request: Request = s.player) {
  return sceneOf(await request(`${s.root}/scenes/active`));
}

const areaNames = (scene: SceneView) => scene.areas.map((area) => area.name).sort();

test('an area rests on a grid intersection and reaches the table with its creator', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const scene = await sceneOf(await addArea(s.master, path), 201);
  const web = named(scene, 'Teia');
  assert.deepEqual([web.x, web.y], [100, 100]);
  assert.equal(web.createdBy.name, 'Lia Martins');
  assert.equal(web.shape, 'cube');
  assert.equal(web.width, 1.5);
  assert.deepEqual(areaNames(await playerView(s)), ['Teia']);
});

test('a player adds their own area and only they or the master change it', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const scene = await sceneOf(await addArea(s.player, path, { shape: 'sphere', size: 6, name: 'Bola de Fogo', color: 'crimson' }), 201);
  const fireball = named(scene, 'Bola de Fogo');
  assert.equal(fireball.createdBy.name, 'Rafael Costa');

  // Another player cannot move, rename nor remove it.
  assert.equal((await send(s.otherPlayer, `${path}/areas/${fireball.id}`, 'PATCH', { x: 200, y: 200 })).status, 403);
  assert.equal((await send(s.otherPlayer, `${path}/areas/${fireball.id}`, 'PATCH', { name: 'Minha' })).status, 403);
  assert.equal((await send(s.otherPlayer, `${path}/areas/${fireball.id}`, 'DELETE')).status, 403);

  const moved = named(await sceneOf(await send(s.player, `${path}/areas/${fireball.id}`, 'PATCH', { x: 219, y: 181 })), 'Bola de Fogo');
  assert.deepEqual([moved.x, moved.y], [220, 180]);
  // The master removes any area.
  assert.deepEqual(areaNames(await sceneOf(await send(s.master, `${path}/areas/${fireball.id}`, 'DELETE'))), []);
});

test('only the master hides an area, and a player never receives a hidden one', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  assert.equal((await addArea(s.player, path, { hidden: true })).status, 403);
  const own = named(await sceneOf(await addArea(s.player, path, { name: 'Névoa' }), 201), 'Névoa');
  assert.equal((await send(s.player, `${path}/areas/${own.id}`, 'PATCH', { hidden: true })).status, 403);

  const trap = named(await sceneOf(await addArea(s.master, path, { name: 'Glifo', hidden: true }), 201), 'Glifo');
  assert.equal(trap.hidden, true);
  assert.deepEqual(areaNames(await playerView(s)), ['Névoa']);
  // A player cannot tell a hidden area from a missing one.
  assert.equal((await send(s.player, `${path}/areas/${trap.id}`, 'PATCH', { name: 'x' })).status, 404);
  assert.equal((await send(s.player, `${path}/areas/${trap.id}`, 'DELETE')).status, 404);

  await sceneOf(await send(s.master, `${path}/areas/${trap.id}`, 'PATCH', { hidden: false }));
  assert.deepEqual(areaNames(await playerView(s)), ['Glifo', 'Névoa']);
});

test('a non-member gets 404, and a player sees no area of a scene not open for the table', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const web = named(await sceneOf(await addArea(s.master, path), 201), 'Teia');
  assert.equal((await addArea(s.outsider, path)).status, 404);
  assert.equal((await send(s.outsider, `${path}/areas/${web.id}`, 'DELETE')).status, 404);

  assert.equal((await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: null })).status, 204);
  assert.equal((await addArea(s.player, path)).status, 404);
  assert.equal((await send(s.player, `${path}/areas/${web.id}`, 'DELETE')).status, 404);
});

test('an area that does not fit the rules is refused', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  for (const bad of [{ size: 2 }, { shape: 'star' }, { color: '#ff0000' }, { name: '' }, { x: 'a' }]) {
    assert.equal((await addArea(s.player, path, bad)).status, 422, JSON.stringify(bad));
  }
  const web = named(await sceneOf(await addArea(s.player, path), 201), 'Teia');
  assert.equal((await send(s.player, `${path}/areas/${web.id}`, 'PATCH', {})).status, 422);
  assert.equal((await send(s.player, `${path}/areas/${web.id}`, 'PATCH', { x: 10 })).status, 422);
});

test('a scene holds at most the limit of areas', async () => {
  const s = await setup();
  const { scene, path } = await openScene(s);
  const first = named(await sceneOf(await addArea(s.master, path), 201), 'Teia');
  s.app.db
    .insert(sceneAreas)
    .values(
      Array.from({ length: AREA_LIMITS.perScene - 1 }, (_, index) => ({
        id: `area-${index}`,
        sceneId: scene.id,
        shape: 'sphere' as const,
        size: 3,
        width: 1.5,
        x: 100,
        y: 100,
        name: `Área ${index}`,
        color: 'azure' as const,
        createdBy: first.createdBy.userId,
      })),
    )
    .run();
  assert.equal((await addArea(s.master, path)).status, 422);
});

test('an area follows its token, shows only with it, and goes with it', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const add = async (input: Record<string, unknown>) => sceneOf(await send(s.master, `${path}/tokens`, 'POST', input), 201);
  await add({ kind: 'character', characterId: s.kaelen.id, x: 100, y: 100 });
  await add({ kind: 'character', characterId: s.mira.id, x: 300, y: 100 });
  const scene = await add({ kind: 'free', label: 'Sacerdote', size: 'medium', x: 500, y: 300 });
  const token = (name: string) => scene.tokens.find((candidate) => candidate.name === name)!;
  const guardians = { shape: 'sphere', size: 4.5, name: 'Espírito Guardião', color: 'amber' };

  // A player anchors only on their own character.
  assert.equal((await addArea(s.player, path, { ...guardians, anchorTokenId: token('Mira').id })).status, 403);
  assert.equal((await addArea(s.player, path, { ...guardians, anchorTokenId: token('Sacerdote').id })).status, 403);
  assert.equal((await addArea(s.player, path, { ...guardians, anchorTokenId: 'nope' })).status, 404);
  const own = named(await sceneOf(await addArea(s.player, path, { ...guardians, anchorTokenId: token('Kaelen').id }), 201), 'Espírito Guardião');
  assert.deepEqual([own.x, own.y, own.anchorTokenId], [110, 110, token('Kaelen').id]);
  assert.equal((await send(s.player, `${path}/areas/${own.id}`, 'PATCH', { x: 200, y: 200 })).status, 422);

  // Moving the token moves the area.
  await sceneOf(await send(s.player, `${path}/tokens/${token('Kaelen').id}`, 'PATCH', { x: 150, y: 150 }));
  const followed = named(await playerView(s), 'Espírito Guardião');
  assert.deepEqual([followed.x, followed.y], [150, 150]);

  // The master's area on a hidden token stays hidden with it.
  await sceneOf(await addArea(s.master, path, { ...guardians, name: 'Aura', anchorTokenId: token('Sacerdote').id }), 201);
  assert.deepEqual(areaNames(await playerView(s)), ['Aura', 'Espírito Guardião']);
  await sceneOf(await send(s.master, `${path}/tokens/${token('Sacerdote').id}`, 'PATCH', { hidden: true }));
  assert.deepEqual(areaNames(await playerView(s)), ['Espírito Guardião']);

  // Removing the token removes the areas on it.
  const after = await sceneOf(await send(s.master, `${path}/tokens/${token('Sacerdote').id}`, 'DELETE'));
  assert.deepEqual(areaNames(after), ['Espírito Guardião']);
});

test('under the fog, an area of the master hides like a monster and a player area shows', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  await sceneOf(await addArea(s.master, path, { name: 'Escuridão', x: 450, y: 300 }), 201);
  await sceneOf(await addArea(s.master, path, { name: 'Luz', x: 100, y: 100 }), 201);
  await sceneOf(await addArea(s.player, path, { name: 'Bola de Fogo', x: 450, y: 300 }), 201);
  await sceneOf(await send(s.master, path, 'PATCH', { fogEnabled: true }));
  await sceneOf(await send(s.master, `${path}/fog`, 'POST', { mode: 'reveal', shape: { kind: 'rect', x: 0, y: 0, width: 200, height: 200 } }));

  const seen = await playerView(s);
  assert.deepEqual(areaNames(seen), ['Bola de Fogo', 'Luz']);
  const master = await sceneOf(await s.master(path));
  assert.deepEqual(areaNames(master), ['Bola de Fogo', 'Escuridão', 'Luz']);
  // A player cannot remove what they do not see.
  assert.equal((await send(s.player, `${path}/areas/${named(master, 'Escuridão').id}`, 'DELETE')).status, 404);
});

test('a swapped map moves the origins in proportion and keeps the measures', async () => {
  const s = await setup();
  const { path } = await openScene(s);
  const web = named(await sceneOf(await addArea(s.master, path, { x: 300, y: 200 }), 201), 'Teia');
  const form = new FormData();
  form.set('image', new Blob([await testImageBytes('png', 1200, 800)], { type: 'image/png' }), 'mapa.png');
  const swapped = named(await sceneOf(await s.master(`${path}/map`, { method: 'PUT', body: form })), 'Teia');
  assert.deepEqual([swapped.x, swapped.y, swapped.size], [600, 400, web.size]);
  const stored = s.app.db.select().from(sceneAreas).where(eq(sceneAreas.id, web.id)).get();
  assert.equal(stored?.x, 600);
});
