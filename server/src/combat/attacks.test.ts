import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatReminder, CombatSessionEvent, FeedResponse, RollPayload, RollResponse, RollSessionEvent, SessionEvent, SocketMessage, StatblockResponse } from '@quest-fast/shared';
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

const GIANT_STATBLOCK = {
  name: 'Gigante',
  size: 'huge',
  ac: 15,
  hpAverage: 100,
  hpFormula: '10d12+30',
  initiativeBonus: 0,
  abilityScores: { strength: 25, dexterity: 8, constitution: 18, intelligence: 6, wisdom: 10, charisma: 8 },
  attacks: [{ name: 'Rocha', bonus: 10, damage: '10d100' }],
};

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
  // With the total and a natural 20, the bonus would be one subtraction away.
  assert.equal(master?.total, 24);
  assert.equal(player?.total, 0);
  assert.equal(player && 'natural' in player, false);
  // What the master says at the table stays: hit, critical and damage.
  assert.equal(player?.target?.hit, true);
  assert.equal(player?.critical, true);
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

const SHAMAN = {
  name: 'Goblin xamã',
  size: 'small',
  ac: 12,
  hpAverage: 9,
  hpFormula: '2d6+2',
  initiativeBonus: 0,
  abilityScores: { strength: 8, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 },
  // Proficient in Dexterity saves: +5 instead of the modifier's +1.
  saveBonuses: { dexterity: 5 },
  attacks: [{ kind: 'save', name: 'Raio de fogo', dc: 13, saveAbility: 'dexterity', damage: '2d6', damageType: 'Fogo' }],
};

/** The running fight with a goblin shaman added: it casts a Dexterity save of 2d6. */
async function withShaman() {
  const table = await fight();
  const shaman = (await body<StatblockResponse>(await send(table.s.master, `${table.s.root}/statblocks`, 'POST', SHAMAN))).statblock;
  const added = await encounterOf(
    await send(table.s.master, `${table.path}/combatants`, 'POST', { source: 'statblock', statblockId: shaman.id, count: 1, hp: 'average' }),
    201,
  );
  const shamanId = byName(added, 'Goblin xamã').id;
  return { ...table, shamanId, shamanAt: `${table.path}/combatants/${shamanId}` };
}

test("an attack against a save rolls the target's save: passing halves the pending damage", async (t) => {
  natural20(t);
  const { s, id, view, shamanAt } = await withShaman();

  assert.equal((await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen'), mode: 'advantage' })).status, 422);
  await attacked(await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [roll] = await rolls(s, s.master);
  assert.deepEqual(roll?.save, { dc: 13, ability: 'dexterity' });
  assert.equal(roll?.damage?.total, 12);
  const save = roll?.target?.save;
  assert.ok(save && 'd20' in save && save.d20 === 20 && save.success);
  const [reminder] = pending(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(reminder?.kind === 'pendingDamage');
  assert.equal(reminder.amount, 6);
  assert.deepEqual(reminder.save, { dc: 13, ability: 'dexterity', success: true });
  assert.equal(reminder.critical, false);
});

test('a failed save leaves the whole damage pending', async (t) => {
  natural1(t);
  const { s, id, view, shamanAt } = await withShaman();
  await attacked(await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [reminder] = pending(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(reminder?.kind === 'pendingDamage');
  assert.equal(reminder.amount, 2);
  assert.deepEqual(reminder.save, { dc: 13, ability: 'dexterity', success: false });
});

test('a row that does nothing on a success leaves no damage when the target passes', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  const flame = { kind: 'save', name: 'Chama Sagrada', dc: 13, saveAbility: 'dexterity', damage: '1d8', damageType: 'Radiante', onSave: 'none' };
  assert.equal((await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [flame] })).status, 200);
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));
  assert.deepEqual(pending(byName(await view(s.master), 'Goblin 2').reminders), []);
  assert.equal((await rolls(s, s.master))[0]?.target?.save?.success, true);
});

test("a monster's save reaches a player as passed or failed, never its die or total", async (t) => {
  natural1(t);
  const { s, at, view, shamanId } = await withShaman();
  const breath = { kind: 'save', name: 'Sopro', dc: 12, saveAbility: 'dexterity', damage: '2d6', damageType: 'Fogo' };
  assert.equal((await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [breath] })).status, 200);
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: shamanId }));

  // The copy rolls with the bestiary's +5, not the Dexterity modifier.
  const [master] = await rolls(s, s.master);
  assert.deepEqual(master?.target?.save, { d20: 1, modifier: 5, total: 6, success: false });
  const [player] = await rolls(s, s.player);
  assert.deepEqual(player?.target?.save, { success: false });
  // The damage on the monster is the master's to apply.
  assert.equal(pending(byName(await view(s.master), 'Goblin xamã').reminders)[0]?.amount, 2);
  assert.deepEqual(byName(await view(s.player), 'Goblin xamã').reminders, []);
});

test('Paralyzed fails a Dexterity save without a roll', async (t) => {
  natural20(t);
  const { s, id, at, view, shamanAt } = await withShaman();
  await encounterOf(await send(s.master, at('Kaelen', '/conditions/paralyzed'), 'PUT', {}));
  await attacked(await send(s.master, `${shamanAt}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [roll] = await rolls(s, s.master);
  assert.deepEqual(roll?.target?.save, { outright: true, success: false });
  assert.equal(pending(byName(await view(s.master), 'Kaelen').reminders)[0]?.amount, 12);
});

function saves(reminders: CombatReminder[]) {
  return reminders.filter((reminder) => reminder.kind === 'pendingSave');
}

test('a failed save without damage leaves the effect pending on the target, secret when the attack was', async (t) => {
  natural1(t);
  const { s, at, id, path, view } = await fight();
  const grease = { kind: 'save', name: 'Graxa', dc: 12, saveAbility: 'dexterity', damage: '', notes: 'Cai se falhar' };
  const witch = (
    await body<StatblockResponse>(
      await send(s.master, `${s.root}/statblocks`, 'POST', {
        name: 'Bruxa', size: 'medium', ac: 12, hpAverage: 20, hpFormula: '4d8+2', initiativeBonus: 0,
        abilityScores: { strength: 8, dexterity: 12, constitution: 12, intelligence: 14, wisdom: 14, charisma: 10 },
        attacks: [grease],
      }),
    )
  ).statblock;
  const added = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: witch.id, count: 2, hp: 'average' }),
    201,
  );
  // Out of turn, an attack spends the reaction: each witch casts once.
  const witchAt = (name: string) => `${path}/combatants/${byName(added, name).id}/attack`;

  // A monster's attack is secret by default: the player does not learn of it.
  await attacked(await send(s.master, witchAt('Bruxa 1'), 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [hidden] = saves(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(hidden?.kind === 'pendingSave');
  assert.deepEqual(
    { dc: hidden.dc, ability: hidden.ability, attackName: hidden.attackName, notes: hidden.notes, secret: hidden.secret, failed: hidden.failed },
    { dc: 12, ability: 'dexterity', attackName: 'Graxa', notes: 'Cai se falhar', secret: true, failed: true },
  );
  assert.deepEqual(saves(byName(await view(s.player), 'Kaelen').reminders), []);
  const [roll] = await rolls(s, s.master);
  assert.deepEqual(roll?.save, { dc: 12, ability: 'dexterity' });
  assert.equal(roll?.damage, undefined);
  assert.equal(pending(byName(await view(s.master), 'Kaelen').reminders).length, 0);

  // In the open, the owner sees it and marks it resolved; nobody else may.
  await attacked(await send(s.master, witchAt('Bruxa 2'), 'POST', { attackIndex: 0, targetId: id('Kaelen'), secret: false }));
  const [open] = saves(byName(await view(s.player), 'Kaelen').reminders);
  assert.ok(open?.kind === 'pendingSave' && !open.secret);
  assert.equal((await send(s.otherPlayer, at('Kaelen', `/reminders/${open.id}`), 'DELETE')).status, 403);
  const kaelen = byName(await encounterOf(await send(s.player, at('Kaelen', `/reminders/${open.id}`), 'DELETE')), 'Kaelen');
  assert.deepEqual(saves(kaelen.reminders), []);
  assert.deepEqual(saves(byName(await view(s.master), 'Kaelen').reminders).map((reminder) => reminder.id), [hidden.id]);
  // Its effect is the table's: a player never reads a monster's save on a monster.
  assert.deepEqual(byName(await view(s.player), 'Bruxa 1').reminders, []);
});

test('a passed save without damage leaves nothing on the target', async (t) => {
  natural20(t);
  const { s, at, id, view } = await fight();
  const grease = { kind: 'save', name: 'Graxa', dc: 12, saveAbility: 'dexterity', damage: '' };
  assert.equal((await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [grease] })).status, 200);
  await attacked(await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0, targetId: id('Goblin 2') }));
  assert.deepEqual(saves(byName(await view(s.master), 'Goblin 2').reminders), []);
  const [roll] = await rolls(s, s.player);
  assert.deepEqual(roll?.target?.save, { success: true });
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
  assert.equal(roll.payload.total, 0);
  assert.equal('natural' in roll.payload, false);
  assert.equal(JSON.stringify(roll.payload).includes('1d20+4'), false);
});

test('a pending damage past the manual limit is applied whole, and an adjustment past it is refused', async (t) => {
  natural20(t);
  const { s, id, path, view, at } = await fight();
  const giant = (
    await body<StatblockResponse>(
      await send(s.master, `${s.root}/statblocks`, 'POST', { ...GIANT_STATBLOCK }),
    )
  ).statblock;
  const added = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: giant.id, count: 1, hp: 'average' }),
    201,
  );
  await attacked(await send(s.master, `${path}/combatants/${byName(added, 'Gigante').id}/attack`, 'POST', { attackIndex: 0, targetId: id('Kaelen') }));
  const [reminder] = pending(byName(await view(s.master), 'Kaelen').reminders);
  assert.ok(reminder?.kind === 'pendingDamage');
  // A critical 10d100 at its highest: 20 dice of 100.
  assert.equal(reminder.amount, 2000);

  const refused = await send(s.master, at('Kaelen', `/reminders/${reminder.id}/apply`), 'POST', { amount: 2000 });
  assert.equal(refused.status, 422);
  assert.equal(pending(byName(await view(s.master), 'Kaelen').reminders).length, 1, 'a refusal keeps the reminder');

  const applied = await encounterOf(await send(s.master, at('Kaelen', `/reminders/${reminder.id}/apply`), 'POST'));
  assert.equal(byName(applied, 'Kaelen').hpCurrent, 0);
  const { events } = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  const damage = events.find((event) => event.type === 'combat.damage') as CombatSessionEvent | undefined;
  assert.equal(damage?.payload.kind === 'combat.damage' && damage.payload.amount, 2000);
});

test("a player sees an ally's attacks, never a monster's", async () => {
  const { s, view } = await fight();
  const master = await view(s.master);
  assert.equal(byName(master, 'Goblin 1').attacks[0]?.name, 'Cimitarra');
  assert.equal(byName(master, 'Kaelen').attacks[0]?.name, 'Espada longa');

  const player = await view(s.otherPlayer);
  assert.deepEqual(byName(player, 'Goblin 1').attacks, []);
  assert.equal(byName(player, 'Kaelen').attacks[0]?.name, 'Espada longa');
});
