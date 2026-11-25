import test from 'node:test';
import assert from 'node:assert/strict';
import type { CharacterResponse, CombatEffect, CombatEffectPayload, CombatReminder, CombatSessionEvent, EncounterView, FeedResponse, RollPayload, RollSessionEvent } from '@quest-fast/shared';
import { body } from '../testing.ts';
import { advance, byName, createEncounter, encounterOf, runningEncounter, send, setup, sheet, type Request, type Setup } from './test-setup.ts';

/**
 * Temporary effects during a fight (#112). The running encounter: Goblin 1
 * (18), Kaelen (15, Rafael's), Bandido (12, hidden), Goblin 2 (10), Mira (5,
 * Bia's); Goblin 1 acts first.
 */

async function fight() {
  const s = await setup();
  const running = await runningEncounter(s);
  const at = (name: string, action = '') => `${running.path}/combatants/${running.id(name)}${action}`;
  const put = (request: Request, name: string, effect: Record<string, unknown>) => send(request, at(name, '/effects'), 'POST', effect);
  return { s, ...running, at, put };
}

const SHIELD_OF_FAITH = { name: 'Escudo da Fé', modifiers: { ac: { mode: 'add', value: 2 } }, duration: 'encounter' };
const AID = { name: 'Auxílio', modifiers: { hpMax: 5 }, duration: 'none' };

function effectOf(view: EncounterView, combatant: string, name: string) {
  return byName(view, combatant).effects.find((effect) => effect.name === name);
}

async function sheetOf(s: Setup, characterId: string) {
  return (await body<CharacterResponse>(await s.player(`${s.root}/characters/${characterId}`))).character;
}

// --- Who may ---------------------------------------------------------------------------

test('a player puts an effect on their own character, and on an ally only from their character', async () => {
  const { s, id, put } = await fight();
  assert.equal((await put(s.player, 'Kaelen', SHIELD_OF_FAITH)).status, 200);
  assert.equal((await put(s.player, 'Mira', SHIELD_OF_FAITH)).status, 403);
  const view = await encounterOf(await put(s.player, 'Mira', { ...SHIELD_OF_FAITH, sourceCombatantId: id('Kaelen') }));
  assert.equal((effectOf(view, 'Mira', 'Escudo da Fé') as CombatEffect).sourceCombatantId, id('Kaelen'));
  // Not on a monster, and not in the name of someone else's character.
  assert.equal((await put(s.player, 'Goblin 2', { ...SHIELD_OF_FAITH, sourceCombatantId: id('Kaelen') })).status, 403);
  assert.equal((await put(s.player, 'Kaelen', { ...AID, sourceCombatantId: id('Mira') })).status, 403);
  assert.equal((await put(s.master, 'Goblin 2', { ...AID, sourceCombatantId: id('Goblin 1') })).status, 200);
});

test('an effect is taken off by the master, the bearer and whoever it comes from', async () => {
  const { s, id, at, put } = await fight();
  const remove = (request: Request, bearer: string, view: EncounterView, name: string) =>
    send(request, at(bearer, `/effects/${effectOf(view, bearer, name)!.id}`), 'DELETE');

  let view = await encounterOf(await put(s.player, 'Mira', { ...SHIELD_OF_FAITH, sourceCombatantId: id('Kaelen') }));
  view = await encounterOf(await put(s.master, 'Mira', AID));
  // Rafael put Shield of Faith on Mira, not Aid.
  assert.equal((await remove(s.player, 'Mira', view, 'Auxílio')).status, 403);
  view = await encounterOf(await remove(s.player, 'Mira', view, 'Escudo da Fé'));
  assert.equal(effectOf(view, 'Mira', 'Escudo da Fé'), undefined);
  // Bia removes what is on her own character.
  view = await encounterOf(await remove(s.otherPlayer, 'Mira', view, 'Auxílio'));
  assert.deepEqual(byName(view, 'Mira').effects, []);

  view = await encounterOf(await put(s.master, 'Goblin 2', AID));
  assert.equal((await remove(s.player, 'Goblin 2', view, 'Auxílio')).status, 403);
  assert.equal((await send(s.master, at('Goblin 2', '/effects/nope'), 'DELETE')).status, 404);
});

test('replacing an effect counts as taking the old one off', async () => {
  const { s, id, put } = await fight();
  await encounterOf(await put(s.master, 'Mira', SHIELD_OF_FAITH));
  assert.equal((await put(s.player, 'Mira', { ...SHIELD_OF_FAITH, sourceCombatantId: id('Kaelen') })).status, 403);
  const view = await encounterOf(await put(s.master, 'Mira', { ...SHIELD_OF_FAITH, modifiers: { ac: { mode: 'add', value: 3 } } }));
  assert.equal(byName(view, 'Mira').effects.length, 1);
  assert.deepEqual((effectOf(view, 'Mira', 'Escudo da Fé') as CombatEffect).modifiers, { ac: { mode: 'add', value: 3 } });
});

test('a non-member gets 404, and a player cannot reach a hidden combatant', async () => {
  const { s, put, at } = await fight();
  assert.equal((await put(s.outsider, 'Kaelen', SHIELD_OF_FAITH)).status, 404);
  assert.equal((await send(s.outsider, at('Kaelen', '/effects/any'), 'DELETE')).status, 404);
  assert.equal((await put(s.player, 'Bandido', SHIELD_OF_FAITH)).status, 404);
});

test('an effect that is wrong, or put outside the fight, is refused', async () => {
  const { s, put, path } = await fight();
  const refused = await put(s.master, 'Kaelen', { ...SHIELD_OF_FAITH, modifiers: {} });
  assert.equal(refused.status, 422);
  assert.match((await body<{ error: string }>(refused)).error, /mudar/);
  await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.equal((await put(s.master, 'Kaelen', SHIELD_OF_FAITH)).status, 409);
});

// --- What the table sees --------------------------------------------------------------

test('a player sees an ally effect whole, and only the name of one on a monster', async () => {
  const { s, put, path } = await fight();
  await encounterOf(await put(s.master, 'Goblin 2', { name: 'Pele de Pedra', modifiers: { resistances: ['slashing'] }, duration: 'encounter' }));
  await encounterOf(await put(s.player, 'Kaelen', SHIELD_OF_FAITH));
  const seen = await encounterOf(await s.otherPlayer(path));
  const stoneskin = effectOf(seen, 'Goblin 2', 'Pele de Pedra')!;
  assert.deepEqual(Object.keys(stoneskin).sort(), ['id', 'name']);
  assert.deepEqual((effectOf(seen, 'Kaelen', 'Escudo da Fé') as CombatEffect).modifiers, SHIELD_OF_FAITH.modifiers);
  const master = await encounterOf(await s.master(path));
  assert.deepEqual((effectOf(master, 'Goblin 2', 'Pele de Pedra') as CombatEffect).modifiers, { resistances: ['slashing'] });
});

// --- Hit point maximum ----------------------------------------------------------------

test('Aid raises the maximum and the current hit points, and its end cuts only the excess', async () => {
  const { s, at, put } = await fight();
  let view = await encounterOf(await put(s.master, 'Kaelen', AID));
  assert.deepEqual([byName(view, 'Kaelen').hpMax, byName(view, 'Kaelen').hpCurrent], [29, 29]);
  const sheet = await sheetOf(s, s.kaelen.id);
  // The sheet keeps its maximum: the effect lives in the fight.
  assert.deepEqual([sheet.hp, sheet.hpCurrent], [24, 29]);

  view = await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 3 }));
  view = await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'heal', amount: 10 }));
  assert.equal(byName(view, 'Kaelen').hpCurrent, 29);
  view = await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 10 }));
  view = await encounterOf(await send(s.master, at('Kaelen', `/effects/${effectOf(view, 'Kaelen', 'Auxílio')!.id}`), 'DELETE'));
  // 19 of 29 stays 19 of 24.
  assert.deepEqual([byName(view, 'Kaelen').hpMax, byName(view, 'Kaelen').hpCurrent], [24, 19]);

  view = await encounterOf(await put(s.master, 'Goblin 2', AID));
  assert.deepEqual([byName(view, 'Goblin 2').hpMax, byName(view, 'Goblin 2').hpCurrent], [12, 12]);
  view = await encounterOf(await send(s.master, at('Goblin 2', `/effects/${effectOf(view, 'Goblin 2', 'Auxílio')!.id}`), 'DELETE'));
  assert.deepEqual([byName(view, 'Goblin 2').hpMax, byName(view, 'Goblin 2').hpCurrent], [7, 7]);
});

test('Aid on a character at 0 brings it back and starts the death saves over', async () => {
  const { s, at, put } = await fight();
  await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 24 }));
  await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 1 }));
  const view = await encounterOf(await put(s.master, 'Kaelen', AID));
  assert.equal(byName(view, 'Kaelen').hpCurrent, 5);
  assert.deepEqual((await sheetOf(s, s.kaelen.id)).deathSaves, { successes: 0, failures: 0 });
});

test('the end of the fight takes every effect off, and a character leaving takes Aid with it', async () => {
  const { s, path, at, put } = await fight();
  await encounterOf(await put(s.master, 'Kaelen', AID));
  await encounterOf(await put(s.master, 'Mira', AID));
  await encounterOf(await send(s.master, at('Mira'), 'DELETE'));
  assert.equal((await sheetOf(s, s.mira.id)).hpCurrent, 24);
  const view = await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.deepEqual(byName(view, 'Kaelen').effects, []);
  assert.equal((await sheetOf(s, s.kaelen.id)).hpCurrent, 24);
});

// --- Duration ---------------------------------------------------------------------------

test('rounds run out at the end of the bearer turn, and Shield when its next turn begins', async () => {
  const { s, path, id, put } = await fight();
  await encounterOf(await put(s.master, 'Goblin 1', { ...SHIELD_OF_FAITH, duration: 'rounds', roundsLeft: 1 }));
  await encounterOf(await put(s.master, 'Kaelen', { name: 'Escudo', modifiers: { ac: { mode: 'add', value: 5 } }, duration: 'untilTurnStart' }));
  await encounterOf(await put(s.master, 'Kaelen', { ...AID, duration: 'rounds', roundsLeft: 2 }));
  // Goblin 1 ends its turn; Kaelen's begins.
  let view = await encounterOf(await advance(s.master, path, id('Goblin 1')));
  assert.deepEqual(byName(view, 'Goblin 1').effects, []);
  assert.equal(effectOf(view, 'Kaelen', 'Escudo'), undefined);
  assert.equal((effectOf(view, 'Kaelen', 'Auxílio') as CombatEffect).roundsLeft, 2);
  view = await encounterOf(await advance(s.master, path, id('Kaelen')));
  assert.equal((effectOf(view, 'Kaelen', 'Auxílio') as CombatEffect).roundsLeft, 1);
});

// --- Concentration ----------------------------------------------------------------------

const BLESS_ON = (source: string) => ({
  name: 'Bênção',
  modifiers: { resistances: ['fire'] },
  duration: 'rounds',
  roundsLeft: 10,
  sourceCombatantId: source,
  concentration: true,
});

test('a concentration effect needs its source concentrating, and ends with it for good', async () => {
  const { s, id, at, put } = await fight();
  assert.equal((await put(s.player, 'Mira', BLESS_ON(id('Kaelen')))).status, 409);
  await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true }));
  let view = await encounterOf(await put(s.player, 'Mira', BLESS_ON(id('Kaelen'))));
  assert.ok(effectOf(view, 'Mira', 'Bênção'));
  await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: false }));
  view = await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true }));
  assert.equal(effectOf(view, 'Mira', 'Bênção'), undefined);
});

test('falling, the sheet and leaving the fight end the concentration effects too', async () => {
  const { s, id, at, put, path } = await fight();
  const concentrate = () => send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });

  await encounterOf(await concentrate());
  await encounterOf(await put(s.player, 'Mira', BLESS_ON(id('Kaelen'))));
  let view = await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'damage', amount: 30 }));
  assert.equal(effectOf(view, 'Mira', 'Bênção'), undefined);

  await encounterOf(await send(s.master, at('Kaelen', '/hp'), 'POST', { operation: 'heal', amount: 10 }));
  await encounterOf(await concentrate());
  await encounterOf(await put(s.player, 'Mira', BLESS_ON(id('Kaelen'))));
  const state = await s.player(`${s.root}/characters/${s.kaelen.id}/state`, { method: 'PATCH', body: JSON.stringify({ concentrating: false }) });
  assert.equal(state.status, 200, await state.clone().text());
  view = await encounterOf(await s.master(path));
  assert.equal(effectOf(view, 'Mira', 'Bênção'), undefined);

  await encounterOf(await send(s.master, at('Goblin 1', '/concentration'), 'PUT', { concentrating: true }));
  await encounterOf(await put(s.master, 'Goblin 2', BLESS_ON(id('Goblin 1'))));
  view = await encounterOf(await send(s.master, at('Goblin 1'), 'DELETE'));
  assert.deepEqual(byName(view, 'Goblin 2').effects, []);
});

// --- The numbers the fight uses --------------------------------------------------------

const SWORD = { name: 'Espada longa', bonus: 5, damage: '1d8+3', damageType: 'Cortante', range: '1,5 m' };

async function armedFight() {
  const table = await fight();
  const armed = await send(table.s.player, `${table.s.root}/characters/${table.s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [SWORD] });
  assert.equal(armed.status, 200, await armed.clone().text());
  return table;
}

async function lastAttack(s: Setup): Promise<RollPayload | undefined> {
  const { events } = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  return (events.filter((event) => event.type === 'roll') as RollSessionEvent[])
    .map((event) => event.payload)
    .filter((payload) => payload.rollKind === 'attack')
    .at(-1);
}

function pendingOf(view: EncounterView, name: string) {
  return byName(view, name).reminders.filter((reminder): reminder is Extract<CombatReminder, { kind: 'pendingDamage' }> => reminder.kind === 'pendingDamage');
}

test('an attack must reach the armor class under the effects', async (t) => {
  // Every die lands on 11: the goblin's 11 + 4 reaches Kaelen's 15, not 17.
  t.mock.method(Math, 'random', () => 10.5 / 20);
  const { s, id, at, put } = await armedFight();
  let view = await encounterOf(await put(s.master, 'Kaelen', SHIELD_OF_FAITH));
  assert.equal(byName(view, 'Kaelen').ac, 17);
  view = await encounterOf(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const attack = await lastAttack(s);
  assert.deepEqual([attack?.target?.hit, attack?.target?.ac], [false, 17]);
  assert.deepEqual(pendingOf(view, 'Kaelen'), []);
});

test('the speed of the turn follows the effects; the base speed stays as it was', async () => {
  const { s, put, path } = await fight();
  let view = await encounterOf(await put(s.master, 'Kaelen', { name: 'Passos Longos', modifiers: { speed: { mode: 'add', value: 3 } }, duration: 'encounter' }));
  assert.deepEqual([byName(view, 'Kaelen').turn?.speed, byName(view, 'Kaelen').speed], [12, 9]);
  await encounterOf(await put(s.master, 'Kaelen', { name: 'Lentidão', modifiers: { speed: { mode: 'half' } }, duration: 'encounter' }));
  view = await encounterOf(await s.player(path));
  assert.deepEqual([byName(view, 'Kaelen').turn?.speed, byName(view, 'Kaelen').turn?.movementLeft], [6, 6]);
});

test('a resistance halves the pending damage, which the master still adjusts', async (t) => {
  // Every die on its highest face: a critical 2d8 + 3 = 19.
  t.mock.method(Math, 'random', () => 0.999);
  const { s, id, at, put, path } = await armedFight();
  await encounterOf(await put(s.master, 'Goblin 2', { name: 'Pele de Pedra', modifiers: { resistances: ['slashing'] }, duration: 'encounter' }));
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  await encounterOf(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));
  let view = await encounterOf(await s.master(path));
  const [damage] = pendingOf(view, 'Goblin 2');
  assert.deepEqual([damage?.amount, damage?.rolled, damage?.adjustment], [9, 19, 'resistant']);
  // A player still reads nothing of a monster's pending damage.
  assert.deepEqual(byName(await encounterOf(await s.player(path)), 'Goblin 2').reminders, []);
  view = await encounterOf(await send(s.master, at('Goblin 2', `/reminders/${damage!.id}/apply`), 'POST', { amount: 6 }));
  assert.equal(byName(view, 'Goblin 2').hpCurrent, 1);
});

test('an immunity leaves the pending damage at 0, which the master adjusts or dismisses', async (t) => {
  t.mock.method(Math, 'random', () => 0.999);
  const { s, id, at, put, path } = await armedFight();
  await encounterOf(await put(s.master, 'Goblin 2', { name: 'Forma Etérea', modifiers: { immunities: ['slashing'] }, duration: 'encounter' }));
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  await encounterOf(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));
  const [damage] = pendingOf(await encounterOf(await s.master(path)), 'Goblin 2');
  assert.deepEqual([damage?.amount, damage?.rolled, damage?.adjustment], [0, 19, 'immune']);
  assert.equal((await send(s.master, at('Goblin 2', `/reminders/${damage!.id}/apply`), 'POST')).status, 409);
  const view = await encounterOf(await send(s.master, at('Goblin 2', `/reminders/${damage!.id}/apply`), 'POST', { amount: 2 }));
  assert.equal(byName(view, 'Goblin 2').hpCurrent, 5);
});

test('the sheet edited mid-fight keeps what Aid adds to the maximum', async () => {
  const { s, put } = await fight();
  await encounterOf(await put(s.master, 'Kaelen', AID));
  const state = (hpCurrent: number) =>
    s.player(`${s.root}/characters/${s.kaelen.id}/state`, { method: 'PATCH', body: JSON.stringify({ hpCurrent }) });
  assert.equal((await state(28)).status, 200);
  assert.equal((await state(30)).status, 422);
  assert.equal((await state(29)).status, 200);
  const edited = await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), hp: 20 });
  assert.equal(edited.status, 200, await edited.clone().text());
  // A smaller sheet maximum still keeps Aid's 5 on top.
  assert.equal((await sheetOf(s, s.kaelen.id)).hpCurrent, 25);
});

// --- The feed ---------------------------------------------------------------------------

async function effectEvents(s: Setup, request: Request): Promise<CombatEffectPayload[]> {
  const { events } = await body<FeedResponse>(await request(`${s.root}/feed`));
  return (events.filter((event) => event.type === 'combat.effect') as CombatSessionEvent[])
    .map((event) => event.payload as CombatEffectPayload);
}

test('the feed tells an effect put on, taken off and run out, by name only', async () => {
  const { s, id, at, put, path } = await fight();
  await encounterOf(await put(s.master, 'Goblin 1', { name: 'Pele de Pedra', modifiers: { resistances: ['slashing'] }, duration: 'rounds', roundsLeft: 1 }));
  let view = await encounterOf(await put(s.master, 'Kaelen', SHIELD_OF_FAITH));
  await encounterOf(await send(s.master, at('Kaelen', `/effects/${effectOf(view, 'Kaelen', 'Escudo da Fé')!.id}`), 'DELETE'));
  await encounterOf(await send(s.master, at('Bandido', '/effects'), 'POST', AID));
  view = await encounterOf(await advance(s.master, path, id('Goblin 1')));

  const seen = (events: CombatEffectPayload[]) => events.map(({ name, action, effect }) => `${name} ${action} ${effect.name}`);
  assert.deepEqual(seen(await effectEvents(s, s.otherPlayer)), [
    'Goblin 1 applied Pele de Pedra',
    'Kaelen applied Escudo da Fé',
    'Kaelen removed Escudo da Fé',
    'Goblin 1 expired Pele de Pedra',
  ]);
  // The master also reads the hidden bandit's.
  assert.ok(seen(await effectEvents(s, s.master)).includes('Bandido applied Auxílio'));
  const [first] = await effectEvents(s, s.otherPlayer);
  assert.deepEqual(Object.keys(first!.effect).sort(), ['id', 'name']);
});

// --- Sheets changed outside the fight -------------------------------------------------

const HELD_AID = (source: string) => ({ name: 'Auxílio', modifiers: { hpMax: 5 }, duration: 'encounter', sourceCombatantId: source, concentration: true });

test('deleting the source sheet ends what its concentration held up, at once', async () => {
  const { s, id, at, put, path } = await fight();
  await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true }));
  await encounterOf(await put(s.player, 'Mira', HELD_AID(id('Kaelen'))));
  const deleted = await s.player(`${s.root}/characters/${s.kaelen.id}`, { method: 'DELETE' });
  assert.ok(deleted.status < 300, await deleted.clone().text());
  const view = await encounterOf(await s.master(path));
  assert.deepEqual(byName(view, 'Mira').effects, []);
  assert.deepEqual([byName(view, 'Mira').hpMax, byName(view, 'Mira').hpCurrent], [24, 24]);
});

test('an ally who loses Aid on the sheet path is republished in its other encounters', async () => {
  const { s, id, at, put } = await fight();
  const other = await createEncounter(s, 'Patrulha');
  const otherPath = `${s.base}/${other.id}`;
  await encounterOf(await send(s.master, `${otherPath}/combatants`, 'POST', { source: 'character', characterId: s.mira.id }), 201);
  await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true }));
  await encounterOf(await put(s.player, 'Mira', HELD_AID(id('Kaelen'))));
  const before = await encounterOf(await s.master(otherPath));
  assert.equal(byName(before, 'Mira').hpCurrent, 29);

  const state = await s.player(`${s.root}/characters/${s.kaelen.id}/state`, { method: 'PATCH', body: JSON.stringify({ concentrating: false }) });
  assert.equal(state.status, 200, await state.clone().text());
  const after = await encounterOf(await s.master(otherPath));
  assert.equal(byName(after, 'Mira').hpCurrent, 24);
  // A new version: the clients that hold the other encounter are told.
  assert.ok(after.version > before.version);
});
