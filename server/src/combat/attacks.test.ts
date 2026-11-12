import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatReminder, FeedResponse, RollPayload, RollResponse, RollSessionEvent, SessionEvent, SocketMessage, StatblockResponse } from '@quest-fast/shared';
import { body, createTestServer, signIn } from '../testing.ts';
import {
  PROFILES,
  byName,
  connect,
  createEncounter,
  encounterOf,
  runningEncounter,
  send,
  setup,
  sheet,
  until,
  type Request,
  type Setup,
} from './test-setup.ts';

/**
 * Attacks during a fight. The running encounter: Goblin 1 (18), Kaelen (15),
 * Bandido (12, hidden), Goblin 2 (10), Mira (5). Goblins have AC 15 and a
 * Cimitarra (+4, 1d6+2); Kaelen gets a longsword (+5, 1d8+3) and AC 15.
 * `Math.random` is fixed so a roll is a known natural 20 or natural 1.
 */

const SWORD = { name: 'Espada longa', bonus: 5, damage: '1d8+3', damageType: 'Cortante' };

/** Every die lands on its highest face: a natural 20, always a critical. */
function natural20(t: TestContext) {
  t.mock.method(Math, 'random', () => 0.999);
}

/** Every die lands on 1: a natural 1, always a miss. */
function natural1(t: TestContext) {
  t.mock.method(Math, 'random', () => 0);
}

async function fight(s?: Setup) {
  const table = s ?? (await setup());
  const armed = await send(table.player, `${table.root}/characters/${table.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [SWORD] });
  assert.equal(armed.status, 200, await armed.clone().text());
  const running = await runningEncounter(table);
  const at = (name: string, action = '') => `${running.path}/combatants/${running.id(name)}${action}`;
  const view = async (request: Request) => encounterOf(await request(running.path));
  return { s: table, ...running, at, view };
}

async function attacked(response: Response) {
  assert.equal(response.status, 200, await response.clone().text());
  return response;
}

async function rolls(s: Setup, request: Request): Promise<RollPayload[]> {
  const { events } = await body<FeedResponse>(await request(`${s.root}/feed`));
  return (events.filter((event) => event.type === 'roll') as RollSessionEvent[])
    .map((event) => event.payload)
    .filter((payload) => payload.rollKind === 'attack');
}

/** Attack events as a reader gets them, oldest first. */
async function attackEvents(s: Setup, request: Request): Promise<RollSessionEvent[]> {
  const { events } = await body<FeedResponse>(await request(`${s.root}/feed`));
  return (events.filter((event) => event.type === 'roll') as RollSessionEvent[]).filter((event) => event.payload.rollKind === 'attack');
}

function pending(reminders: CombatReminder[]) {
  return reminders.filter((reminder) => reminder.kind === 'pendingDamage');
}

test('a hit rolls the damage and leaves it pending on the target, not applied', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));

  const [roll] = await rolls(s, s.master);
  assert.equal(roll?.attackName, 'Espada longa');
  assert.equal(roll?.critical, true);
  assert.deepEqual(roll?.target, { combatantId: id('Goblin 2'), name: 'Goblin 2', source: 'monster', hit: true, ac: 15 });
  // A critical doubles the dice, not the modifier: 2d8+3 at their highest.
  assert.equal(roll?.damage?.expression, '2d8+3');
  assert.equal(roll?.damage?.total, 19);

  const goblin = byName(await view(s.master), 'Goblin 2');
  assert.equal(goblin.hpCurrent, 7);
  const [reminder] = pending(goblin.reminders);
  assert.equal(reminder?.kind === 'pendingDamage' && reminder.amount, 19);
  assert.equal(reminder?.kind === 'pendingDamage' && reminder.critical, true);
  assert.equal(reminder?.kind === 'pendingDamage' && reminder.attackerName, 'Kaelen');
});

test('a miss rolls no damage and leaves nothing pending', async (t) => {
  natural1(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));

  const [roll] = await rolls(s, s.master);
  assert.equal(roll?.target?.hit, false);
  assert.equal(roll?.damage, undefined);
  assert.equal(pending(byName(await view(s.master), 'Goblin 2').reminders).length, 0);
});

test('the master applies a pending damage, adjusted, and it is gone', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));
  const [reminder] = pending(byName(await view(s.master), 'Goblin 2').reminders);
  assert.ok(reminder);

  const applied = await encounterOf(await send(s.master, at('Goblin 2', `/reminders/${reminder.id}/apply`), 'POST', { amount: 3 }));
  const goblin = byName(applied, 'Goblin 2');
  assert.equal(goblin.hpCurrent, 4);
  assert.equal(pending(goblin.reminders).length, 0);
  assert.equal((await send(s.master, at('Goblin 2', `/reminders/${reminder.id}/apply`), 'POST')).status, 404);

  const { events } = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  assert.ok(events.some((event) => event.type === 'combat.damage'));
});

test('without an amount the pending damage is applied whole', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [reminder] = pending(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(reminder?.kind === 'pendingDamage');
  // A critical Cimitarra at its highest: 2d6+2.
  assert.equal(reminder.amount, 14);

  const applied = await encounterOf(await send(s.master, at('Kaelen', `/reminders/${reminder.id}/apply`), 'POST'));
  assert.equal(byName(applied, 'Kaelen').hpCurrent, 24 - 14);
});

test('only the master applies or dismisses a pending damage, even on a player\'s own character', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen'), secret: false }));
  const [reminder] = pending(byName(await view(s.player), 'Kaelen').reminders);
  assert.ok(reminder, 'the owner sees what is pending on their character');

  assert.equal((await send(s.player, at('Kaelen', `/reminders/${reminder.id}/apply`), 'POST')).status, 403);
  assert.equal((await send(s.player, at('Kaelen', `/reminders/${reminder.id}`), 'DELETE')).status, 403);
  const dismissed = await encounterOf(await send(s.master, at('Kaelen', `/reminders/${reminder.id}`), 'DELETE'));
  assert.equal(pending(byName(dismissed, 'Kaelen').reminders).length, 0);
  assert.equal(byName(dismissed, 'Kaelen').hpCurrent, 24);
});

test('a monster\'s attack is secret by default, and so is what it left pending', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen') }));

  assert.equal((await rolls(s, s.master)).length, 1);
  assert.equal((await rolls(s, s.player)).length, 0);
  assert.equal(pending(byName(await view(s.master), 'Kaelen').reminders).length, 1);
  assert.equal(pending(byName(await view(s.player), 'Kaelen').reminders).length, 0);
});

test('a player reads a public monster attack by its totals only', async (t) => {
  natural20(t);
  const { s, at, id } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen'), secret: false }));

  const [master] = await rolls(s, s.master);
  assert.equal(master?.expression, '1d20+4');
  assert.equal(master?.damage?.expression, '2d6+2');

  const [player] = await rolls(s, s.player);
  assert.equal(player?.redacted, true);
  assert.equal(player?.expression, '');
  assert.deepEqual(player?.dice, []);
  assert.equal(player?.modifier, 0);
  assert.equal(player?.total, master?.total);
  assert.equal(player?.damage?.expression, '');
  assert.deepEqual(player?.damage?.dice, []);
  assert.equal(player?.damage?.total, 14);
  // Kaelen is an ally: the table already sees the AC on the sheet.
  assert.equal(player?.target?.ac, 15);
});

test('a player never reads a monster\'s AC, even on their own attack', async (t) => {
  natural20(t);
  const { s, at, id } = await fight();
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));

  const [player] = await rolls(s, s.player);
  assert.equal(player?.target?.hit, true);
  assert.equal(player?.target && 'ac' in player.target, false);
  // A character's own numbers stay open.
  assert.equal(player?.expression, '1d20+5');
  assert.equal(player?.redacted, undefined);
  const [master] = await rolls(s, s.master);
  assert.equal(master?.target?.ac, 15);
});

test('a hidden attacker or target makes the attack the master\'s', async (t) => {
  natural20(t);
  const { s, at, id } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Bandido'), secret: false }));
  assert.equal((await rolls(s, s.master)).length, 1);
  assert.equal((await rolls(s, s.player)).length, 0);
});

test('an attack against a save rolls the damage and leaves it pending with the DC', async (t) => {
  natural20(t);
  const { s, id, path, view } = await fight();
  const shaman = (
    await body<StatblockResponse>(
      await send(s.master, `${s.root}/statblocks`, 'POST', {
        name: 'Goblin xamã',
        size: 'small',
        ac: 12,
        hpAverage: 9,
        hpFormula: '2d6+2',
        initiativeBonus: 0,
        abilityScores: { strength: 8, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 },
        attacks: [{ kind: 'save', name: 'Raio de fogo', dc: 13, saveAbility: 'dexterity', damage: '2d6', damageType: 'Fogo' }],
      }),
    )
  ).statblock;
  const added = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: shaman.id, count: 1, hp: 'average' }),
    201,
  );
  const shamanAt = `${path}/combatants/${byName(added, 'Goblin xamã').id}`;

  assert.equal((await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen'), mode: 'advantage' })).status, 422);
  await attacked(await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [roll] = await rolls(s, s.master);
  assert.deepEqual(roll?.save, { dc: 13, ability: 'dexterity' });
  assert.equal(roll?.damage?.total, 12);
  const [reminder] = pending(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(reminder?.kind === 'pendingDamage');
  assert.deepEqual(reminder.save, { dc: 13, ability: 'dexterity' });
  assert.equal(reminder.critical, false);
});

test('who may attack with whom, and at whom', async () => {
  const { s, at, id, path } = await fight();
  const kaelen = (payload: Record<string, unknown>) => send(s.player, at('Kaelen', '/attack'), 'POST', payload);

  assert.equal((await send(s.otherPlayer, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 403);
  assert.equal((await send(s.player, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0 })).status, 403);
  assert.equal((await send(s.player, at('Bandido', '/attack'), 'POST', { attackIndex: 0 })).status, 404);
  assert.equal((await kaelen({ attackIndex: 0, targetId: id('Bandido') })).status, 404);
  assert.equal((await kaelen({ attackIndex: 0, targetId: id('Kaelen') })).status, 422);
  assert.equal((await kaelen({ attackIndex: 0, secret: true })).status, 403);
  assert.equal((await kaelen({ attackIndex: 3 })).status, 422);
  assert.equal((await kaelen({ attackIndex: 0, mode: 'luck' })).status, 422);
  assert.equal((await send(s.outsider, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 404);
  // A manual combatant has no attacks to roll.
  assert.equal((await send(s.master, at('Bandido', '/attack'), 'POST', { attackIndex: 0 })).status, 422);

  await send(s.master, at('Goblin 2', '/hp'), 'POST', { operation: 'damage', amount: 30 });
  assert.equal((await send(s.master, at('Goblin 2', '/attack'), 'POST', { attackIndex: 0 })).status, 409);

  await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.equal((await kaelen({ attackIndex: 0 })).status, 409);
});

test('no attack before the fight starts, and none a player can tell apart from a missing encounter', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  const added = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 1, hp: 'average' }),
    201,
  );
  const goblinAt = `${path}/combatants/${added.combatants[0]!.id}/attack`;
  assert.equal((await send(s.master, goblinAt, 'POST', { attackIndex: 0 })).status, 409);
  assert.equal((await send(s.player, goblinAt, 'POST', { attackIndex: 0 })).status, 404);
});

test('without a target, the damage is rolled afterwards, once, by who attacked', async (t) => {
  natural20(t);
  const { s, at } = await fight();
  const response = await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 }));
  assert.ok(response);
  const [attack] = await attackEvents(s, s.player);
  assert.ok(attack);
  assert.deepEqual(attack.payload.damageRollable, { expression: '1d8+3', damageType: 'Cortante' });
  assert.equal(attack.payload.target, undefined);

  const damageOf = `${s.root}/rolls/${attack.id}/damage`;
  assert.equal((await send(s.otherPlayer, damageOf, 'POST')).status, 403);
  assert.equal((await send(s.outsider, damageOf, 'POST')).status, 404);
  const rolled = await send(s.player, damageOf, 'POST');
  assert.equal(rolled.status, 201, await rolled.clone().text());
  const { event } = await body<RollResponse>(rolled);
  // The critical comes from the stored attack, not from the request.
  assert.equal(event.payload.critical, true);
  assert.equal(event.payload.damage?.expression, '2d8+3');
  assert.equal(event.payload.damageOf, attack.id);
  assert.equal((await send(s.player, damageOf, 'POST')).status, 409);

  const [stored] = await attackEvents(s, s.player);
  assert.equal(stored?.payload.damageRolled, true);
});

test('a player cannot roll the damage of the master\'s secret attack', async () => {
  const { s, at } = await fight();
  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0 }));
  const [attack] = await attackEvents(s, s.master);
  assert.ok(attack?.secret);
  assert.equal((await send(s.player, `${s.root}/rolls/${attack.id}/damage`, 'POST')).status, 404);
  assert.equal((await send(s.master, `${s.root}/rolls/${attack.id}/damage`, 'POST')).status, 201);
});

test('a player\'s socket gets a public monster attack without its numbers', async (t) => {
  natural20(t);
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const socket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(async () => {
    socket.close();
    await server.close();
  });
  await new Promise((resolve) => socket.once('open', resolve));
  const { at, id } = await fight(s);
  const events: SessionEvent[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'session.event') events.push(message.event);
  });

  await attacked(await send(s.master, at('Goblin 1', '/attack'), 'POST', { attackIndex: 0, targetId: id('Kaelen'), secret: false }));
  await until(() => events.some((event) => event.type === 'roll' && (event as RollSessionEvent).payload.rollKind === 'attack'));
  const roll = events.find((event) => event.type === 'roll' && (event as RollSessionEvent).payload.rollKind === 'attack') as RollSessionEvent;
  assert.equal(roll.payload.redacted, true);
  assert.equal(roll.payload.expression, '');
  assert.equal(roll.payload.damage?.expression, '');
  assert.equal(JSON.stringify(roll.payload).includes('1d20+4'), false);
});
