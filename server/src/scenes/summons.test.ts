import test from 'node:test';
import assert from 'node:assert/strict';
import type { CombatSummonPayload, EncounterView, FeedResponse, SceneResponse, SceneView, SummonSheetInput, TokenView } from '@quest-fast/shared';
import { body, testImageBytes } from '../testing.ts';
import { advance, byName, encounterOf, runningEncounter, send, setup, type Request, type Setup } from '../combat/test-setup.ts';

/**
 * Summons on the map and how they leave the fight (#114). A 600 × 400 map
 * has 20 px cells. The running encounter: Goblin 1 (18, acting), Kaelen (15,
 * Rafael's), Bandido (12, hidden), Goblin 2 (10), Mira (5, Bia's).
 */
const CELL = 20;

const SPIRIT: SummonSheetInput = {
  name: 'Espírito',
  size: 'medium',
  ac: 16,
  hp: 40,
  speed: 9,
  initiativeBonus: 0,
  attacks: [{ name: 'Pancada', kind: 'attack', bonus: 6, damage: '1d8+4' }],
};

async function sceneOf(response: Response, status = 200): Promise<SceneView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<SceneResponse>(response)).scene;
}

function named(scene: SceneView, name: string): TokenView | undefined {
  return scene.tokens.find((candidate) => candidate.name === name);
}

async function summonEvents(s: Setup, request: Request): Promise<CombatSummonPayload[]> {
  const { events } = await body<FeedResponse>(await request(`${s.root}/feed`));
  return events.filter((event) => event.type === 'combat.summon').map((event) => event.payload as CombatSummonPayload);
}

/** The fight on the open map, Kaelen's token at (50, 50). */
async function battle() {
  const s = await setup();
  const form = new FormData();
  form.set('name', 'Estrada');
  form.set('image', new Blob([await testImageBytes('png', 600, 400)], { type: 'image/png' }), 'mapa.png');
  const created = await sceneOf(await s.master(`${s.root}/scenes`, { method: 'POST', body: form }), 201);
  await sceneOf(await send(s.master, `${s.root}/scenes/active`, 'PUT', { sceneId: created.id }));
  const scene = `${s.root}/scenes/${created.id}`;
  const running = await runningEncounter(s);
  await sceneOf(await send(s.master, `${scene}/tokens`, 'POST', { kind: 'character', characterId: s.kaelen.id, x: 50, y: 50 }), 201);
  const at = (combatantId: string, action = '') => `${running.path}/combatants/${combatantId}${action}`;
  const summon = async (link: Record<string, unknown> = {}, sheet: Partial<SummonSheetInput> = {}) => {
    const view = await encounterOf(
      await send(s.player, `${running.path}/combatants`, 'POST', {
        source: 'summon',
        sheet: { ...SPIRIT, ...sheet },
        summon: { summonerId: running.id('Kaelen'), initiativeMode: 'withSummoner', concentration: false, rounds: null, ...link },
      }),
      201,
    );
    return byName(view, sheet.name ?? SPIRIT.name).id;
  };
  const view = async (request: Request = s.master) => sceneOf(await request(scene));
  const fight = async (request: Request = s.master): Promise<EncounterView> => encounterOf(await request(running.path));
  const concentrate = (on: boolean) => send(s.player, at(running.id('Kaelen'), '/concentration'), 'PUT', { concentrating: on });
  return { s, scene, ...running, at, summon, view, fight, concentrate };
}

test('a summon appears beside its summoner on the open map, and the feed says who summoned it', async () => {
  const b = await battle();
  await b.summon();
  const spirit = named(await b.view(), SPIRIT.name);
  assert.ok(spirit, 'the summon has a token');
  assert.deepEqual([spirit.kind, spirit.x, spirit.y, spirit.ownerId], ['combatant', 50 + CELL, 50, b.s.kaelen.ownerId]);

  // The next one takes the next free cell around Kaelen.
  await b.summon({}, { name: 'Lobo' });
  const wolf = named(await b.view(), 'Lobo')!;
  assert.deepEqual([wolf.x, wolf.y], [50, 50 + CELL]);

  const joined = (await summonEvents(b.s, b.s.otherPlayer)).map((event) => [event.action, event.name, event.summonerName]);
  assert.deepEqual(joined.sort(), [['joined', SPIRIT.name, 'Kaelen'], ['joined', 'Lobo', 'Kaelen']].sort());
});

test('the controller moves the summon on its turn; nobody else does', async () => {
  const b = await battle();
  const spirit = await b.summon();
  const token = named(await b.view(), SPIRIT.name)!.id;
  const move = (request: Request, x: number) => send(request, `${b.scene}/tokens/${token}`, 'PATCH', { x, y: 50 });

  // Goblin 1 acts: the summon waits for its turn.
  const early = await move(b.s.player, 50 + 2 * CELL);
  assert.equal(early.status, 403);
  assert.match(((await early.json()) as { error: string }).error, /só na vez dele/);

  await encounterOf(await advance(b.s.master, b.path, b.id('Goblin 1')));
  await encounterOf(await advance(b.s.player, b.path, b.id('Kaelen')));
  assert.equal((await move(b.s.otherPlayer, 50 + 2 * CELL)).status, 403);
  assert.equal((await send(b.s.otherPlayer, `${b.scene}/tokens/${token}/grab`, 'POST')).status, 403);
  await sceneOf(await move(b.s.player, 50 + 3 * CELL));
  assert.equal(byName(await b.fight(b.s.player), SPIRIT.name).turn?.movementLeft, 6);
  // An ally's reach is the table's.
  assert.deepEqual(named(await b.view(b.s.otherPlayer), SPIRIT.name)?.reach, { speed: 9, left: 6 });
  assert.equal(byName(await b.fight(), SPIRIT.name).id, spirit);
});

test('taking the control back lets go of the drag, and the token is the master’s again', async () => {
  const b = await battle();
  const spirit = await b.summon();
  const token = named(await b.view(), SPIRIT.name)!.id;
  await encounterOf(await advance(b.s.master, b.path, b.id('Goblin 1')));
  await encounterOf(await advance(b.s.player, b.path, b.id('Kaelen')));
  await sceneOf(await send(b.s.player, `${b.scene}/tokens/${token}/grab`, 'POST'));
  assert.notEqual(named(await b.view(), SPIRIT.name)?.movingBy, null);

  await encounterOf(await send(b.s.master, b.at(spirit), 'PATCH', { controllerId: null }));
  const after = named(await b.view(), SPIRIT.name)!;
  assert.deepEqual([after.movingBy, after.ownerId], [null, null]);
  assert.equal((await send(b.s.player, `${b.scene}/tokens/${token}`, 'PATCH', { x: 50 + 2 * CELL, y: 50 })).status, 403);
});

test('under the fog the table still sees a creature a player controls, and its controller anchors an area on it', async () => {
  const b = await battle();
  await b.summon();
  await sceneOf(await send(b.s.master, b.scene, 'PATCH', { fogEnabled: true }));
  assert.ok(named(await b.view(b.s.otherPlayer), SPIRIT.name), 'an ally shows under the fog');

  const token = named(await b.view(), SPIRIT.name)!.id;
  const area = { shape: 'sphere', size: 3, name: 'Aura', tint: 'amber', x: 60, y: 60, anchorTokenId: token };
  assert.equal((await send(b.s.otherPlayer, `${b.scene}/areas`, 'POST', area)).status, 403);
  assert.equal((await send(b.s.player, `${b.scene}/areas`, 'POST', area)).status, 201);
});

test('a summon held by concentration leaves when the summoner stops concentrating; one without stays', async () => {
  const b = await battle();
  await encounterOf(await b.concentrate(true));
  await b.summon({ concentration: true });
  await b.summon({ concentration: false }, { name: 'Esqueleto' });
  assert.ok(named(await b.view(), SPIRIT.name));

  const view = await encounterOf(await b.concentrate(false));
  assert.equal(view.combatants.some((combatant) => combatant.name === SPIRIT.name), false);
  assert.ok(view.combatants.some((combatant) => combatant.name === 'Esqueleto'));
  assert.equal(named(await b.view(), SPIRIT.name), undefined, 'its token went with it');
  const left = (await summonEvents(b.s, b.s.otherPlayer)).filter((event) => event.action === 'left');
  assert.deepEqual(left.map((event) => [event.name, event.reason]), [[SPIRIT.name, 'concentration']]);
});

test('concentration ended on the sheet takes the summon and its token away too', async () => {
  const b = await battle();
  await encounterOf(await b.concentrate(true));
  await b.summon({ concentration: true });
  const before = await b.view();

  const patched = await send(b.s.player, `${b.s.root}/characters/${b.s.kaelen.id}/state`, 'PATCH', { concentrating: false });
  assert.equal(patched.status, 200, await patched.clone().text());
  assert.equal((await b.fight()).combatants.some((combatant) => combatant.name === SPIRIT.name), false);
  const after = await b.view();
  assert.equal(named(after, SPIRIT.name), undefined);
  assert.ok(after.version > before.version, 'the map has a new version');
});

test('a summon acting when its concentration ends passes the turn on', async () => {
  const b = await battle();
  await encounterOf(await b.concentrate(true));
  const spirit = await b.summon({ concentration: true });
  await encounterOf(await advance(b.s.master, b.path, b.id('Goblin 1')));
  let view = await encounterOf(await advance(b.s.player, b.path, b.id('Kaelen')));
  assert.equal(view.activeCombatantId, spirit);

  // The master drops Kaelen's concentration in the summon's turn.
  view = await encounterOf(await send(b.s.master, b.at(b.id('Kaelen'), '/concentration'), 'PUT', { concentrating: false }));
  assert.equal(view.activeCombatantId, b.id('Bandido'));
});

test('a summon with a duration leaves after its last turn', async () => {
  const b = await battle();
  const spirit = await b.summon({ rounds: 1 });
  await encounterOf(await advance(b.s.master, b.path, b.id('Goblin 1')));
  await encounterOf(await advance(b.s.player, b.path, b.id('Kaelen')));
  const view = await encounterOf(await advance(b.s.player, b.path, spirit));
  assert.equal(view.combatants.some((combatant) => combatant.id === spirit), false);
  assert.equal((await b.fight()).activeCombatantId, b.id('Bandido'));
  const [left] = (await summonEvents(b.s, b.s.player)).filter((event) => event.action === 'left');
  assert.equal(left.reason, 'duration');
});

test('a longer duration counts down at the end of each of its own turns', async () => {
  const b = await battle();
  const spirit = await b.summon({ rounds: 2 });
  await encounterOf(await advance(b.s.master, b.path, b.id('Goblin 1')));
  await encounterOf(await advance(b.s.player, b.path, b.id('Kaelen')));
  const view = await encounterOf(await advance(b.s.player, b.path, spirit));
  assert.equal(byName(view, SPIRIT.name).summon?.roundsLeft, 1);
});

test('the end of the fight takes the summons and their tokens; a creature only handed to a player stays', async () => {
  const b = await battle();
  await b.summon();
  await encounterOf(await send(b.s.master, b.at(b.id('Goblin 2')), 'PATCH', { controllerId: b.s.kaelen.ownerId }));
  const ended = await encounterOf(await send(b.s.master, `${b.path}/end`, 'POST'));
  assert.equal(ended.combatants.some((combatant) => combatant.name === SPIRIT.name), false);
  assert.ok(ended.combatants.some((combatant) => combatant.name === 'Goblin 2'));
  assert.equal(named(await b.view(), SPIRIT.name), undefined);
  const [left] = (await summonEvents(b.s, b.s.master)).filter((event) => event.action === 'left');
  assert.equal(left.reason, 'ended');
});

test('dismissing a summon is told to the table', async () => {
  const b = await battle();
  const spirit = await b.summon();
  await encounterOf(await send(b.s.player, b.at(spirit), 'DELETE'));
  assert.equal(named(await b.view(), SPIRIT.name), undefined);
  const [left] = (await summonEvents(b.s, b.s.otherPlayer)).filter((event) => event.action === 'left');
  assert.deepEqual([left.name, left.reason], [SPIRIT.name, 'dismissed']);
});

test('a player who leaves the campaign hands the token back too', async () => {
  const b = await battle();
  await b.summon();
  assert.equal((await send(b.s.player, `${b.s.root}/members/me`, 'DELETE')).status, 204);
  assert.equal(named(await b.view(), SPIRIT.name)?.ownerId, null);
});
