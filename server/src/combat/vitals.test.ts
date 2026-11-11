import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { characters } from '@quest-fast/db';
import type { CharacterResponse, EncounterView, FeedResponse, RollSessionEvent } from '@quest-fast/shared';
import { body, createTestServer, signIn } from '../testing.ts';
import {
  PROFILES,
  advance,
  byName,
  collectCombat,
  connect,
  createEncounter,
  encounterOf,
  runningEncounter,
  send,
  setup,
  until,
  type Request,
  type Setup,
} from './test-setup.ts';

/**
 * Hit points, conditions, concentration and death saves during a fight. The
 * running encounter: Goblin 1 (18), Kaelen (15, Rafael's), Bandido (12,
 * hidden), Goblin 2 (10), Mira (5, Bia's); Goblin 1 acts first.
 */

async function fight(s?: Setup) {
  const table = s ?? (await setup());
  const running = await runningEncounter(table);
  const at = (name: string, action = '') => `${running.path}/combatants/${running.id(name)}${action}`;
  return { s: table, ...running, at };
}

function hp(request: Request, path: string, operation: string, amount: number) {
  return send(request, path, 'POST', { operation, amount });
}

async function sheetOf(s: Setup, characterId: string) {
  return (await body<CharacterResponse>(await s.player(`${s.root}/characters/${characterId}`))).character;
}

// --- Hit points -------------------------------------------------------------------

test('the master damages, heals and gives temporary hit points to a monster', async () => {
  const { s, at } = await fight();
  let goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'damage', 3)), 'Goblin 2');
  assert.equal(goblin.hpCurrent, 4);
  goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'heal', 10)), 'Goblin 2');
  assert.equal(goblin.hpCurrent, 7);
  goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'temp', 5)), 'Goblin 2');
  assert.equal(goblin.hpTemp, 5);
  goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'damage', 6)), 'Goblin 2');
  assert.deepEqual([goblin.hpCurrent, goblin.hpTemp], [6, 0]);
});

test('a monster at 0 hit points is defeated, and healing brings it back', async () => {
  const { s, at } = await fight();
  let goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'damage', 50)), 'Goblin 2');
  assert.deepEqual([goblin.hpCurrent, goblin.defeated], [0, true]);
  goblin = byName(await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'heal', 2)), 'Goblin 2');
  assert.deepEqual([goblin.hpCurrent, goblin.defeated], [2, false]);
});

test('a change that changes nothing is refused instead of reaching the whole table', async () => {
  const { s, at, path } = await fight();
  const before = await encounterOf(await s.master(path));
  assert.equal((await hp(s.master, at('Goblin 2', '/hp'), 'heal', 3)).status, 409);
  await hp(s.master, at('Goblin 2', '/hp'), 'temp', 5);
  assert.equal((await hp(s.master, at('Goblin 2', '/hp'), 'temp', 3)).status, 409);
  const after = await encounterOf(await s.master(path));
  assert.equal(after.version, before.version + 1);
});

test('hit points of a character are written on the sheet', async () => {
  const { s, at, path } = await fight();
  await encounterOf(await hp(s.player, at('Kaelen', '/hp'), 'damage', 5));
  assert.equal((await sheetOf(s, s.kaelen.id)).hpCurrent, 19);
  assert.equal(byName(await encounterOf(await s.otherPlayer(path)), 'Kaelen').hpCurrent, 19);
});

test('damage from the master and from the player at the same time both count', async () => {
  const { s, at } = await fight();
  const responses = await Promise.all([
    hp(s.master, at('Kaelen', '/hp'), 'damage', 5),
    hp(s.player, at('Kaelen', '/hp'), 'damage', 3),
  ]);
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal((await sheetOf(s, s.kaelen.id)).hpCurrent, 16);
});

test('a hit point change needs a known operation and an amount within bounds', async () => {
  const { s, at } = await fight();
  for (const payload of [{ operation: 'drain', amount: 3 }, { operation: 'damage', amount: 0 }, { operation: 'damage', amount: 1000 }, { operation: 'damage' }]) {
    assert.equal((await send(s.master, at('Goblin 2', '/hp'), 'POST', payload)).status, 422, JSON.stringify(payload));
  }
});

test('hit points change only while the fight runs', async () => {
  const s = await setup();
  const { at, path } = await fight(s);
  await send(s.master, `${path}/end`, 'POST');
  assert.equal((await hp(s.master, at('Goblin 2', '/hp'), 'damage', 1)).status, 409);

  const prepared = await createEncounter(s, 'Ponte');
  const view = await encounterOf(
    await send(s.master, `${s.base}/${prepared.id}/combatants`, 'POST', { source: 'manual', name: 'Troll', ac: 15, hp: 84 }),
    201,
  );
  const troll = `${s.base}/${prepared.id}/combatants/${byName(view, 'Troll').id}/hp`;
  assert.equal((await hp(s.master, troll, 'damage', 1)).status, 409);
});

// --- Who may do what ---------------------------------------------------------------

test('a player changes only their own character', async () => {
  const { s, at } = await fight();
  const actions: [string, string, unknown][] = [
    ['/hp', 'POST', { operation: 'damage', amount: 1 }],
    ['/conditions/prone', 'PUT', {}],
    ['/concentration', 'PUT', { concentrating: true }],
    ['/death-save', 'POST', { failures: 1 }],
  ];
  for (const [action, method, payload] of actions) {
    assert.equal((await send(s.player, at('Mira', action), method, payload)).status, 403, `${method} Mira${action}`);
    assert.equal((await send(s.player, at('Goblin 2', action), method, payload)).status, 403, `${method} Goblin 2${action}`);
    assert.equal((await send(s.player, at('Bandido', action), method, payload)).status, 404, `${method} Bandido${action}`);
    assert.equal((await send(s.outsider, at('Kaelen', action), method, payload)).status, 404, `outsider ${method}${action}`);
  }
  assert.equal((await send(s.player, at('Mira', '/conditions/prone'), 'DELETE')).status, 403);
  assert.equal((await send(s.player, at('Mira', '/reminders/r1'), 'DELETE')).status, 403);
  assert.equal((await send(s.player, at('Mira', '/concentration-save'), 'POST', { reminderId: 'r1' })).status, 403);
});

// --- Conditions and concentration -----------------------------------------------------

test('a player applies, updates and removes a condition on their character', async () => {
  const { s, at } = await fight();
  let kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/conditions/poisoned'), 'PUT', { roundsLeft: 2 })), 'Kaelen');
  assert.deepEqual(kaelen.conditions, [{ condition: 'poisoned', roundsLeft: 2 }]);
  kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/conditions/exhaustion'), 'PUT', { level: 2 })), 'Kaelen');
  kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/conditions/exhaustion'), 'PUT', { level: 3 })), 'Kaelen');
  assert.deepEqual(kaelen.conditions, [{ condition: 'poisoned', roundsLeft: 2 }, { condition: 'exhaustion', level: 3 }]);
  assert.deepEqual((await sheetOf(s, s.kaelen.id)).conditions, kaelen.conditions);

  kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/conditions/poisoned'), 'DELETE')), 'Kaelen');
  assert.deepEqual(kaelen.conditions, [{ condition: 'exhaustion', level: 3 }]);
  assert.equal((await send(s.player, at('Kaelen', '/conditions/poisoned'), 'DELETE')).status, 409);
  assert.equal((await send(s.player, at('Kaelen', '/conditions/exhaustion'), 'PUT', { level: 3 })).status, 409);
});

test('a condition must be one of the fifteen, with a valid level and duration', async () => {
  const { s, at } = await fight();
  const invalid: [string, unknown][] = [
    ['bloodied', {}],
    ['exhaustion', {}],
    ['exhaustion', { level: 7 }],
    ['prone', { level: 1 }],
    ['prone', { roundsLeft: 0 }],
    ['prone', { roundsLeft: 101 }],
  ];
  for (const [condition, payload] of invalid) {
    assert.equal((await send(s.master, at('Goblin 2', `/conditions/${condition}`), 'PUT', payload)).status, 422, condition);
  }
});

test('the master applies conditions on a monster, and the players see them', async () => {
  const { s, at, path } = await fight();
  await encounterOf(await send(s.master, at('Goblin 2', '/conditions/prone'), 'PUT', {}));
  assert.deepEqual(byName(await encounterOf(await s.player(path)), 'Goblin 2').conditions, [{ condition: 'prone' }]);
});

test('concentration is switched on and off, and a repeated switch is refused', async () => {
  const { s, at } = await fight();
  const kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true })), 'Kaelen');
  assert.equal(kaelen.concentrating, true);
  assert.equal((await sheetOf(s, s.kaelen.id)).concentrating, true);
  assert.equal((await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true })).status, 409);
  assert.equal((await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: 'yes' })).status, 422);
});

// --- Reminders and saves ----------------------------------------------------------------

test('damage while concentrating leaves a Constitution save to roll, and rolling it clears the reminder', async () => {
  const { s, at } = await fight();
  await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });
  // Mira's player sees it too: allies are open to the table.
  const view = await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'damage', 24 - 2));
  const [reminder] = byName(view, 'Kaelen').reminders;
  assert.deepEqual(reminder && { kind: reminder.kind, dc: reminder.kind === 'concentration' && reminder.dc }, { kind: 'concentration', dc: 11 });

  const after = byName(
    await encounterOf(await send(s.player, at('Kaelen', '/concentration-save'), 'POST', { reminderId: reminder!.id })),
    'Kaelen',
  );
  assert.deepEqual(after.reminders, []);
  // Failing the save does not end the concentration on its own.
  assert.equal(after.concentrating, true);

  const feed = await body<FeedResponse>(await s.otherPlayer(`${s.root}/feed`));
  const roll = feed.events.at(-1) as RollSessionEvent;
  assert.deepEqual([roll.payload.rollKind, roll.payload.ability, roll.payload.concentrationDc], ['save', 'constitution', 11]);
  assert.equal((await send(s.player, at('Kaelen', '/concentration-save'), 'POST', { reminderId: reminder!.id })).status, 404);
});

test("a monster's concentration save is the master's secret, with its own Constitution", async () => {
  const { s, at } = await fight();
  await send(s.master, at('Goblin 2', '/concentration'), 'PUT', { concentrating: true });
  const view = await encounterOf(await hp(s.master, at('Goblin 2', '/hp'), 'damage', 2));
  const [reminder] = byName(view, 'Goblin 2').reminders;
  await encounterOf(await send(s.master, at('Goblin 2', '/concentration-save'), 'POST', { reminderId: reminder!.id }));

  const masterFeed = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  const roll = masterFeed.events.at(-1) as RollSessionEvent;
  assert.equal(roll.secret, true);
  assert.equal(roll.payload.modifier, 0);
  const playerFeed = await body<FeedResponse>(await s.player(`${s.root}/feed`));
  assert.equal(playerFeed.events.some((event) => event.id === roll.id), false);
});

test('a reminder is dismissed by its owner or the master, once', async () => {
  const { s, at } = await fight();
  await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });
  const [reminder] = byName(await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'damage', 4)), 'Kaelen').reminders;
  const kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', `/reminders/${reminder!.id}`), 'DELETE')), 'Kaelen');
  assert.deepEqual(kaelen.reminders, []);
  assert.equal((await send(s.master, at('Kaelen', `/reminders/${reminder!.id}`), 'DELETE')).status, 404);
});

test('letting go of concentration drops its pending saves', async () => {
  const { s, at } = await fight();
  await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });
  await hp(s.master, at('Kaelen', '/hp'), 'damage', 4);
  const kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: false })), 'Kaelen');
  assert.deepEqual(kaelen.reminders, []);
});

// --- Death saves -----------------------------------------------------------------------

async function downed(s?: Setup) {
  const table = await fight(s);
  await hp(table.s.master, table.at('Kaelen', '/hp'), 'damage', 24);
  return table;
}

test('damage to a character already down leaves a failure to record', async () => {
  const { s, at, path } = await downed();
  let kaelen = byName(await encounterOf(await s.player(path)), 'Kaelen');
  // The hit that takes a character down is not a failure yet.
  assert.deepEqual(kaelen.reminders, []);

  kaelen = byName(await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'damage', 3)), 'Kaelen');
  const [reminder] = kaelen.reminders;
  assert.equal(reminder?.kind, 'deathFailure');

  kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/death-save'), 'POST', { failures: 2, reminderId: reminder!.id })), 'Kaelen');
  assert.deepEqual(kaelen.deathSaves, { successes: 0, failures: 2 });
  assert.deepEqual(kaelen.reminders, []);
  assert.equal((await send(s.player, at('Kaelen', '/death-save'), 'POST', { failures: 3 })).status, 422);
});

test('a player rolls a death save only on their own turn, once per round', async (t) => {
  const { s, at, path, id } = await downed();
  t.mock.method(Math, 'random', () => 0.5); // 11: a success
  assert.equal((await send(s.player, at('Kaelen', '/death-save'), 'POST')).status, 409);

  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  const kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', '/death-save'), 'POST')), 'Kaelen');
  assert.deepEqual(kaelen.deathSaves, { successes: 1, failures: 0 });
  assert.equal((await send(s.player, at('Kaelen', '/death-save'), 'POST')).status, 409);

  // The master may roll again, to correct a mistake.
  const corrected = byName(await encounterOf(await send(s.master, at('Kaelen', '/death-save'), 'POST')), 'Kaelen');
  assert.deepEqual(corrected.deathSaves, { successes: 2, failures: 0 });
});

test('a natural 20 brings the character back with 1 hit point', async (t) => {
  const { s, at } = await downed();
  t.mock.method(Math, 'random', () => 0.99);
  const kaelen = byName(await encounterOf(await send(s.master, at('Kaelen', '/death-save'), 'POST')), 'Kaelen');
  assert.deepEqual([kaelen.hpCurrent, kaelen.deathSaves], [1, { successes: 0, failures: 0 }]);
  assert.equal((await send(s.master, at('Kaelen', '/death-save'), 'POST')).status, 409);
});

test('a stable character rolls no more, and a hit makes them start over', async () => {
  const { s, at } = await downed();
  s.app.db.update(characters).set({ deathSaves: { successes: 3, failures: 1 } }).where(eq(characters.id, s.kaelen.id)).run();
  assert.equal((await send(s.master, at('Kaelen', '/death-save'), 'POST')).status, 409);
  const kaelen = byName(await encounterOf(await send(s.master, at('Kaelen', '/death-save'), 'POST', { failures: 1 })), 'Kaelen');
  assert.deepEqual(kaelen.deathSaves, { successes: 0, failures: 1 });
});

test('a dead character rolls and records nothing more', async () => {
  const { s, at } = await downed();
  s.app.db.update(characters).set({ deathSaves: { successes: 1, failures: 3 } }).where(eq(characters.id, s.kaelen.id)).run();
  assert.equal((await send(s.master, at('Kaelen', '/death-save'), 'POST')).status, 409);
  assert.equal((await send(s.master, at('Kaelen', '/death-save'), 'POST', { failures: 1 })).status, 409);
});

test('healing a character from 0 clears the death saves', async () => {
  const { s, at } = await downed();
  await send(s.master, at('Kaelen', '/death-save'), 'POST', { failures: 2 });
  const kaelen = byName(await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'heal', 5)), 'Kaelen');
  assert.deepEqual([kaelen.hpCurrent, kaelen.deathSaves], [5, { successes: 0, failures: 0 }]);
});

test('only a character makes death saves, and only while down', async () => {
  const { s, at } = await fight();
  assert.equal((await send(s.master, at('Kaelen', '/death-save'), 'POST')).status, 409);
  await hp(s.master, at('Goblin 2', '/hp'), 'damage', 20);
  assert.equal((await send(s.master, at('Goblin 2', '/death-save'), 'POST')).status, 422);
});

// --- The sheet outside the combat routes ----------------------------------------------------

test('the owner marks conditions and concentration on the sheet; the sheet sets no duration', async () => {
  const { s, at } = await fight();
  await send(s.player, at('Kaelen', '/conditions/poisoned'), 'PUT', { roundsLeft: 3 });
  const response = await send(s.player, `${s.root}/characters/${s.kaelen.id}/state`, 'PATCH', {
    conditions: [{ condition: 'poisoned', roundsLeft: 9 }, { condition: 'prone', roundsLeft: 2 }],
    concentrating: true,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const sheet = (await body<CharacterResponse>(response)).character;
  // A duration already counting in the fight is kept; the sheet adds none.
  assert.deepEqual(sheet.conditions, [{ condition: 'poisoned', roundsLeft: 3 }, { condition: 'prone' }]);
  assert.equal(sheet.concentrating, true);

  for (const conditions of [[{ condition: 'bloodied' }], [{ condition: 'prone' }, { condition: 'prone' }], 'prone']) {
    const refused = await send(s.player, `${s.root}/characters/${s.kaelen.id}/state`, 'PATCH', { conditions });
    assert.equal(refused.status, 422, JSON.stringify(conditions));
  }
});

test('getting back up through the sheet clears the death saves, unless the request sends them', async () => {
  const { s } = await downed();
  const state = `${s.root}/characters/${s.kaelen.id}/state`;
  await send(s.player, state, 'PATCH', { deathSaves: { successes: 1, failures: 2 } });
  let sheet = (await body<CharacterResponse>(await send(s.player, state, 'PATCH', { hpCurrent: 4 }))).character;
  assert.deepEqual(sheet.deathSaves, { successes: 0, failures: 0 });

  await send(s.player, state, 'PATCH', { hpCurrent: 0 });
  sheet = (await body<CharacterResponse>(await send(s.player, state, 'PATCH', { hpCurrent: 4, deathSaves: { successes: 2, failures: 0 } }))).character;
  assert.deepEqual(sheet.deathSaves, { successes: 2, failures: 0 });
});

test('a concentration let go through the sheet takes its pending save with it, for good', async () => {
  const { s, at } = await fight();
  const state = `${s.root}/characters/${s.kaelen.id}/state`;
  await send(s.player, at('Kaelen', '/concentration'), 'PUT', { concentrating: true });
  const [reminder] = byName(await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'damage', 4)), 'Kaelen').reminders;

  await send(s.player, state, 'PATCH', { concentrating: false });
  await send(s.player, state, 'PATCH', { concentrating: true });

  const view = await encounterOf(await s.master(at('Kaelen').replace(/\/combatants\/.*/, '')));
  assert.deepEqual(byName(view, 'Kaelen').reminders, []);
  assert.equal((await send(s.player, at('Kaelen', '/concentration-save'), 'POST', { reminderId: reminder!.id })).status, 404);
});

test('getting back up through the sheet takes the pending death failure with it, for good', async () => {
  const { s, at } = await downed();
  const state = `${s.root}/characters/${s.kaelen.id}/state`;
  const [reminder] = byName(await encounterOf(await hp(s.master, at('Kaelen', '/hp'), 'damage', 3)), 'Kaelen').reminders;

  await send(s.player, state, 'PATCH', { hpCurrent: 4 });
  await send(s.player, state, 'PATCH', { hpCurrent: 0 });

  const failure = await send(s.player, at('Kaelen', '/death-save'), 'POST', { failures: 1, reminderId: reminder!.id });
  assert.equal(failure.status, 404);
});

test('a sheet change waiting for its body never brings back a duration the fight changed meanwhile', async () => {
  const { s, at } = await fight();
  await send(s.player, at('Kaelen', '/conditions/poisoned'), 'PUT', { roundsLeft: 3 });

  // The request starts, and its body arrives only after the master's change.
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const pending = s.player(`${s.root}/characters/${s.kaelen.id}/state`, {
    method: 'PATCH',
    body: stream.readable,
    duplex: 'half',
  } as RequestInit);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await encounterOf(await send(s.master, at('Kaelen', '/conditions/poisoned'), 'PUT', { roundsLeft: 1 }));
  await writer.write(new TextEncoder().encode(JSON.stringify({ conditions: [{ condition: 'poisoned' }, { condition: 'prone' }] })));
  await writer.close();

  const response = await pending;
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual((await body<CharacterResponse>(response)).character.conditions, [{ condition: 'poisoned', roundsLeft: 1 }, { condition: 'prone' }]);
});

test("a change to a character's sheet through one fight reaches every open encounter it is in", async (t) => {
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const masterSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'lia'));
  t.after(async () => {
    masterSocket.close();
    await server.close();
  });
  await new Promise((resolve) => masterSocket.once('open', resolve));
  const { at, path } = await fight(s);
  const prepared = await createEncounter(s, 'Ponte');
  const other = `${s.base}/${prepared.id}`;
  const before = await encounterOf(await send(s.master, `${other}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  const running = await encounterOf(await s.master(path));
  const updates = collectCombat(masterSocket);

  await hp(s.master, at('Kaelen', '/hp'), 'damage', 4);
  await until(() => updates.some((view) => view.id === prepared.id && view.version > before.version));
  // Earlier messages may still be on the wire: only what the hit caused counts.
  const caused = (id: string, version: number) => updates.filter((view) => view.id === id && view.version > version);

  const after = await encounterOf(await s.master(other));
  assert.equal(byName(after, 'Kaelen').hpCurrent, 20);
  assert.equal(after.version, before.version + 1);
  assert.equal(caused(prepared.id, before.version).length, 1);
  // The fight that made the change is published once, as before.
  assert.equal(caused(running.id, running.version).length, 1);
});

// --- Nothing of a monster leaks ------------------------------------------------------------

function monsterSecrets(view: EncounterView, name: string) {
  const monster = byName(view, name);
  return { hpCurrent: monster.hpCurrent, hpTemp: monster.hpTemp, concentrating: monster.concentrating, reminders: monster.reminders };
}

test("a player's socket carries no number, DC nor reminder of a monster", async (t) => {
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const playerSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(async () => {
    playerSocket.close();
    await server.close();
  });
  await new Promise((resolve) => playerSocket.once('open', resolve));
  const { at } = await fight(s);
  const updates = collectCombat(playerSocket);

  await send(s.master, at('Goblin 2', '/concentration'), 'PUT', { concentrating: true });
  await hp(s.master, at('Goblin 2', '/hp'), 'temp', 4);
  await hp(s.master, at('Goblin 2', '/hp'), 'damage', 30);
  await until(() => updates.length >= 3);

  for (const view of updates) {
    assert.deepEqual(monsterSecrets(view, 'Goblin 2'), { hpCurrent: null, hpTemp: null, concentrating: false, reminders: [] });
  }
  assert.equal(byName(updates.at(-1)!, 'Goblin 2').healthBand, 'defeated');
  assert.equal(JSON.stringify(updates).includes('"dc"'), false);
});
