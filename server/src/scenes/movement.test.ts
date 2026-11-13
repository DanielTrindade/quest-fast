import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { characters, scenes } from '@quest-fast/db';
import type { EncounterView, SceneResponse, SceneView, TokenView } from '@quest-fast/shared';
import { body, testImageBytes } from '../testing.ts';
import { advance, byName, encounterOf, runningEncounter, send, setup, type Setup } from '../combat/test-setup.ts';

/**
 * Movement in a fight. A 600 × 400 map has 20 px cells, each 1.5 m. The
 * running encounter: Goblin 1 (18), Kaelen (15), Bandido (12, hidden),
 * Goblin 2 (10), Mira (5); Kaelen walks 9 m (six squares).
 */
const CELL = 20;

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

async function openScene(s: Setup) {
  const form = new FormData();
  form.set('name', 'Estrada de Triboar');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const created = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  await sceneOf(await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id }));
  return `${s.root}/scenes/${created.id}`;
}

function named(scene: SceneView, name: string): TokenView {
  const token = scene.tokens.find((candidate) => candidate.name === name);
  assert.ok(token, `${name} is on the scene`);
  return token;
}

/** A fight on the map: Kaelen's token at the centre of square (2, 2), Goblin 1's at (10, 2). */
async function battle({ round = 1 } = {}) {
  const s = await setup();
  const scene = await openScene(s);
  const running = await runningEncounter(s, { start: round > 0 });
  await sceneOf(await send(s.master, `${scene}/tokens`, 'POST', { kind: 'character', characterId: s.kaelen.id, x: 50, y: 50 }), 201);
  const placed = await sceneOf(
    await send(s.master, `${scene}/tokens`, 'POST', { kind: 'combatant', combatantId: running.id('Goblin 1'), x: 210, y: 50 }),
    201,
  );
  const token = (name: string) => named(placed, name).id;
  const move = (name: string, x: number, y: number, request = s.master, extra: Record<string, unknown> = {}) =>
    send(request, `${scene}/tokens/${token(name)}`, 'PATCH', { x, y, ...extra });
  const view = async (request = s.master) => sceneOf(await request(scene));
  const fight = async (request = s.master): Promise<EncounterView> => encounterOf(await request(running.path));
  return { s, scene, ...running, token, move, view, fight };
}

test("a player moves their character only on its turn, and only as far as its speed", async () => {
  const { s, scene, path, id, token, move, view, fight } = await battle();

  // Goblin 1 acts: Kaelen's token does not move, not even picked up.
  const early = await move('Kaelen', 50, 110, s.player);
  assert.equal(early.status, 403);
  assert.match(((await early.json()) as { error: string }).error, /só na vez dele/);
  assert.equal((await send(s.player, `${scene}/tokens/${token('Kaelen')}/grab`, 'POST')).status, 403);

  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  // Four squares down: 6 m of 9.
  await sceneOf(await move('Kaelen', 50, 50 + 4 * CELL, s.player));
  assert.equal(byName(await fight(s.player), 'Kaelen').turn?.movementLeft, 3);
  assert.deepEqual(named(await view(s.player), 'Kaelen').reach, { speed: 9, left: 3 });

  // Three squares more is 4.5 m: refused, and the token stays.
  const tooFar = await move('Kaelen', 50 + 3 * CELL, 50 + 4 * CELL, s.player);
  assert.equal(tooFar.status, 422);
  assert.match(((await tooFar.json()) as { error: string }).error, /restam 3 m/);
  assert.equal(named(await view(), 'Kaelen').y, 50 + 4 * CELL);

  // A diagonal costs one square: two diagonal squares use up what is left.
  await sceneOf(await move('Kaelen', 50 + 2 * CELL, 50 + 6 * CELL, s.player));
  assert.equal(byName(await fight(), 'Kaelen').turn?.movementLeft, 0);

  // A player never moves for free.
  assert.equal((await move('Kaelen', 50, 50, s.player, { free: true })).status, 403);
});

test("the master's move of the combatant whose turn it is spends its movement, unless it is free", async () => {
  const { s, move, fight } = await battle();
  await sceneOf(await move('Goblin 1', 210 + 2 * CELL, 50));
  const goblin = () => fight().then((view) => byName(view, 'Goblin 1').turn?.movementLeft);
  assert.equal(await goblin(), 6);

  // Pushed by a spell: the master moves it without spending.
  await sceneOf(await move('Goblin 1', 210 + 6 * CELL, 50, s.master, { free: true }));
  assert.equal(await goblin(), 6);
  assert.equal((await move('Goblin 1', 210, 50)).status, 422);

  // Anyone off their turn moves freely in the master's hands.
  await sceneOf(await move('Kaelen', 50, 50 + 8 * CELL));
  assert.equal(byName(await fight(), 'Kaelen').turn?.movementUsed, 0);
});

test('a Dash adds the speed once more', async () => {
  const { s, path, id, move, fight } = await battle();
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  await encounterOf(await send(s.player, `${path}/combatants/${id('Kaelen')}/economy`, 'POST', { spend: 'dash' }));
  // Ten squares: 15 m of 18.
  await sceneOf(await move('Kaelen', 50 + 10 * CELL, 50, s.player));
  assert.equal(byName(await fight(), 'Kaelen').turn?.movementLeft, 3);
});

test('Grappled holds the token where it is', async () => {
  const { s, path, id, move } = await battle();
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  s.app.db.update(characters).set({ conditions: [{ condition: 'grappled' }] }).where(eq(characters.id, s.kaelen.id)).run();
  assert.equal((await move('Kaelen', 50 + CELL, 50, s.player)).status, 422);
  // Staying in place costs nothing.
  assert.equal((await move('Kaelen', 50, 50, s.player)).status, 200);
});

test("a player sees the reach of characters, never a creature's", async () => {
  const { s, view } = await battle();
  const asPlayer = await view(s.player);
  assert.deepEqual(named(asPlayer, 'Kaelen').reach, { speed: 9, left: 9 });
  assert.equal(named(asPlayer, 'Goblin 1').reach, null);
  assert.deepEqual(named(await view(), 'Goblin 1').reach, { speed: 9, left: 9 });
});

test('before round 1 the table places its tokens freely, and the reach is the whole speed', async () => {
  const { s, move, view } = await battle({ round: 0 });
  s.app.db.update(characters).set({ speed: 12 }).where(eq(characters.id, s.kaelen.id)).run();
  await sceneOf(await move('Kaelen', 50 + 15 * CELL, 50, s.player));
  assert.deepEqual(named(await view(s.player), 'Kaelen').reach, { speed: 12, left: 12 });
});

test('a free token has no reach', async () => {
  const { s, scene } = await battle();
  const placed = await sceneOf(await send(s.master, `${scene}/tokens`, 'POST', { kind: 'free', label: 'Barril', size: 'medium', x: 300, y: 300 }), 201);
  assert.equal(named(placed, 'Barril').reach, null);
});

test('small steps off the grid cost every square they enter', async () => {
  const { s, scene, path, id, move, fight } = await battle();
  s.app.db.update(scenes).set({ snapToGrid: false }).where(eq(scenes.id, scene.split('/').at(-1)!)).run();
  await encounterOf(await advance(s.master, path, id('Goblin 1')));

  // Kaelen starts at x = 50 (square 2); 9 m reach square 8, which starts at x = 160.
  let x = 50;
  let refused = 0;
  for (let step = 0; step < 30; step += 1) {
    const response = await move('Kaelen', x + 9, 50, s.player);
    if (response.status === 200) x += 9;
    else refused += 1;
  }
  assert.ok(x < 180, `stopped inside square 8, at x = ${x}`);
  assert.ok(refused > 0);
  assert.equal(byName(await fight(), 'Kaelen').turn?.movementLeft, 0);
});

test('the turn passing lets go of a drag the player began on it', async () => {
  const { s, scene, path, id, token, move, view } = await battle();
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  await sceneOf(await send(s.player, `${scene}/tokens/${token('Kaelen')}/grab`, 'POST'));
  assert.notEqual(named(await view(), 'Kaelen').movingBy, null);

  await encounterOf(await advance(s.master, path, id('Kaelen')));
  assert.equal(named(await view(), 'Kaelen').movingBy, null);
  assert.equal((await move('Kaelen', 50, 70, s.player)).status, 403);
});

test("a move spent on one scene updates the reach on every scene the character is on", async () => {
  const { s, path, id, move } = await battle();
  const form = new FormData();
  form.set('name', 'Mapa da masmorra');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const other = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  const otherPath = `${s.root}/scenes/${other.id}`;
  const placed = await sceneOf(await send(s.master, `${otherPath}/tokens`, 'POST', { kind: 'character', characterId: s.kaelen.id, x: 50, y: 50 }), 201);
  assert.deepEqual(named(placed, 'Kaelen').reach, { speed: 9, left: 9 });

  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  const before = await sceneOf(await s.master(otherPath));
  await sceneOf(await move('Kaelen', 50 + 2 * CELL, 50, s.player));
  const after = await sceneOf(await s.master(otherPath));
  assert.deepEqual(named(after, 'Kaelen').reach, { speed: 9, left: 6 });
  assert.ok(after.version > before.version, 'the other scene has a new version');
});
