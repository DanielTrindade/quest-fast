import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssetUploadResponse, CreatedCampaign, SceneResponse, SceneView, StatblockResponse, TokenView } from '@quest-fast/shared';
import { body, testImageBytes, testImageFile } from '../testing.ts';
import { runningEncounter, send, setup, type Request, type Setup } from '../combat/test-setup.ts';

/**
 * How a token looks on the map follows who it stands for: a character at 0
 * is down, a creature of the fight at 0 is defeated, and a creature shows
 * the image of its bestiary entry.
 */

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

async function upload(request: Request, root: string) {
  const form = new FormData();
  form.append('file', await testImageFile('png'));
  const response = await request(`${root}/assets`, { method: 'POST', body: form });
  assert.equal(response.status, 201, await response.clone().text());
  return (await body<AssetUploadResponse>(response)).asset;
}

test('a character at 0 is down and a creature at 0 defeated, for the master and the table alike', async () => {
  const s = await setup();
  const scenePath = await openScene(s);
  const { path, id } = await runningEncounter(s);
  for (const token of [
    { kind: 'character', characterId: s.kaelen.id },
    { kind: 'combatant', combatantId: id('Goblin 1') },
    { kind: 'combatant', combatantId: id('Goblin 2') },
    { kind: 'free', label: 'Carroça', size: 'large' },
  ]) {
    await sceneOf(await send(s.master, `${scenePath}/tokens`, 'POST', { x: 100, y: 100, ...token }), 201);
  }
  const vitality = async (request: Request) => {
    const scene = await sceneOf(await request(scenePath));
    return Object.fromEntries(['Kaelen', 'Goblin 1', 'Goblin 2', 'Carroça'].map((name) => [name, named(scene, name).vitality]));
  };
  assert.deepEqual(await vitality(s.player), { Kaelen: 'up', 'Goblin 1': 'up', 'Goblin 2': 'up', Carroça: 'up' });

  await send(s.master, `${path}/combatants/${id('Goblin 1')}/hp`, 'POST', { operation: 'damage', amount: 30 });
  const down = await send(s.player, `${s.root}/characters/${s.kaelen.id}/state`, 'PATCH', { hpCurrent: 0 });
  assert.equal(down.status, 200, await down.clone().text());

  const expected = { Kaelen: 'down', 'Goblin 1': 'defeated', 'Goblin 2': 'up', Carroça: 'up' };
  assert.deepEqual(await vitality(s.master), expected);
  assert.deepEqual(await vitality(s.player), expected);
});

test('a creature shows its bestiary image, which only the master sets, from this campaign', async () => {
  const s = await setup();
  const scenePath = await openScene(s);
  const { id } = await runningEncounter(s, { start: false });
  await sceneOf(await send(s.master, `${scenePath}/tokens`, 'POST', { x: 100, y: 100, kind: 'combatant', combatantId: id('Goblin 1') }), 201);
  await sceneOf(await send(s.master, `${scenePath}/tokens`, 'POST', { x: 140, y: 100, kind: 'statblock', statblockId: s.goblin.id }), 201);
  const before = await sceneOf(await s.player(scenePath));
  assert.deepEqual(before.tokens.map((token) => token.avatarUrl), [null, null]);

  const image = await upload(s.master, s.root);
  const statblockPath = `${s.root}/statblocks/${s.goblin.id}`;
  const current = (await body<StatblockResponse>(await s.master(statblockPath))).statblock;
  assert.equal(current.imageUrl, null);
  const { id: _id, campaignId: _campaign, createdAt: _created, updatedAt: _updated, imageUrl: _url, imageAssetId: _image, ...input } = current;

  // The bestiary is the master's: a player cannot even read it.
  assert.equal((await send(s.player, statblockPath, 'PATCH', { ...input, imageAssetId: image.id })).status, 403);
  // An image of another campaign is not this one's to use.
  const other = await body<CreatedCampaign>(await send(s.master, '/api/campaigns', 'POST', { name: 'Outra mesa' }));
  const foreign = await upload(s.master, `/api/campaigns/${other.id}`);
  assert.equal((await send(s.master, statblockPath, 'PATCH', { ...input, imageAssetId: foreign.id })).status, 422);

  const updated = await send(s.master, statblockPath, 'PATCH', { ...input, imageAssetId: image.id });
  assert.equal(updated.status, 200, await updated.clone().text());
  assert.equal((await body<StatblockResponse>(updated)).statblock.imageUrl, image.url);
  const after = await sceneOf(await s.player(scenePath));
  assert.deepEqual(after.tokens.map((token) => token.avatarUrl), [image.url, image.url]);

  // Absent keeps it; null takes it away.
  const kept = await body<StatblockResponse>(await send(s.master, statblockPath, 'PATCH', input));
  assert.equal(kept.statblock.imageAssetId, image.id);
  const removed = await body<StatblockResponse>(await send(s.master, statblockPath, 'PATCH', { ...input, imageAssetId: null }));
  assert.equal(removed.statblock.imageUrl, null);
});
