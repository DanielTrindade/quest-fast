import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { characters, combatants } from '@quest-fast/db';
import type { StatblockResponse } from '@quest-fast/shared';
import { body } from '../testing.ts';
import { GOBLIN, advance, byName, encounterOf, runningEncounter, send, setup, sheet } from './test-setup.ts';

test("a player sees their own character's turn, and no one else's", async () => {
  const s = await setup();
  const { path } = await runningEncounter(s);

  const asPlayer = await encounterOf(await s.player(path));
  const kaelen = byName(asPlayer, 'Kaelen');
  assert.deepEqual(kaelen.turn, {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksLeft: 0,
    extraActions: 0,
    dashes: 0,
    movementUsed: 0,
    speed: 9,
    movementLeft: 9,
    attacksPerAction: 1,
  });
  // An ally's turn is theirs and the master's; a monster's is the master's alone.
  assert.equal(byName(asPlayer, 'Mira').turn, null);
  const goblin = byName(asPlayer, 'Goblin 1');
  assert.deepEqual([goblin.turn, goblin.speed, goblin.attacksPerAction], [null, null, null]);

  const asMaster = await encounterOf(await s.master(path));
  for (const combatant of asMaster.combatants) assert.notEqual(combatant.turn, null, combatant.name);
});

test("a character's turn reads the sheet: its speed, conditions and attacks per action", async () => {
  const s = await setup();
  const { path } = await runningEncounter(s);
  s.app.db.update(characters)
    .set({ speed: 12, attacksPerAction: 3, conditions: [{ condition: 'exhaustion', level: 2 }] })
    .where(eq(characters.id, s.kaelen.id))
    .run();

  const kaelen = byName(await encounterOf(await s.master(path)), 'Kaelen');
  assert.equal(kaelen.speed, 12);
  assert.equal(kaelen.attacksPerAction, 3);
  // Two levels of Exhaustion take 3 m.
  assert.deepEqual([kaelen.turn?.speed, kaelen.turn?.movementLeft], [9, 9]);

  // Without the sheet's own value, a level 3 rogue makes one attack.
  s.app.db.update(characters).set({ attacksPerAction: null }).where(eq(characters.id, s.kaelen.id)).run();
  assert.equal(byName(await encounterOf(await s.master(path)), 'Kaelen').attacksPerAction, 1);
});

test('a combatant from the bestiary keeps the speed and multiattack of its row', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  s.app.db.update(combatants).set({ speed: 6, attacksPerAction: 2, movementUsed: 4.5 }).where(eq(combatants.id, id('Goblin 1'))).run();

  const goblin = byName(await encounterOf(await s.master(path)), 'Goblin 1');
  assert.deepEqual([goblin.speed, goblin.attacksPerAction, goblin.turn?.movementLeft], [6, 2, 1.5]);
});

test('the sheet takes attacks per action, or null to read them from the class', async () => {
  const s = await setup();
  const path = `${s.root}/characters`;
  const refused = await send(s.player, path, 'POST', { ...sheet('Borin'), attacksPerAction: 0 });
  assert.equal(refused.status, 422);
  assert.match(((await refused.json()) as { error: string }).error, /Ataques por ação/);

  const created = await send(s.player, path, 'POST', { ...sheet('Borin'), attacksPerAction: 2 });
  assert.equal(created.status, 201);
  const borin = ((await created.json()) as { character: { id: string; attacksPerAction: number | null } }).character;
  assert.equal(borin.attacksPerAction, 2);
  assert.equal(s.kaelen.attacksPerAction, null);
});

test('a bestiary entry stores its multiattack, 1 when not sent', async () => {
  const s = await setup();
  const path = `${s.root}/statblocks`;
  assert.equal(s.goblin.attacksPerAction, 1);

  assert.equal((await send(s.master, path, 'POST', { ...GOBLIN, name: 'Ogro', attacksPerAction: 9 })).status, 422);
  const ogre = (await body<StatblockResponse>(await send(s.master, path, 'POST', { ...GOBLIN, name: 'Ogro', attacksPerAction: 2 }))).statblock;
  assert.equal(ogre.attacksPerAction, 2);

  // The bestiary editor does not send it: an edit keeps the multiattack stored.
  const edited = (await body<StatblockResponse>(await send(s.master, `${path}/${ogre.id}`, 'PATCH', { ...GOBLIN, name: 'Ogro', ac: 11 }))).statblock;
  assert.deepEqual([edited.ac, edited.attacksPerAction], [11, 2]);
});

// --- Spending the turn -------------------------------------------------------------

const SWORD = { name: 'Espada longa', bonus: 5, damage: '1d8+3', damageType: 'Cortante' };

/** The running encounter with Kaelen armed, on Kaelen's turn (Goblin 1 has passed). */
async function kaelensTurn() {
  const s = await setup();
  const armed = await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [SWORD] });
  assert.equal(armed.status, 200, await armed.clone().text());
  const running = await runningEncounter(s);
  await encounterOf(await advance(s.master, running.path, running.id('Goblin 1')));
  const at = (name: string, action = '') => `${running.path}/combatants/${running.id(name)}${action}`;
  const turnOf = async (name: string) => byName(await encounterOf(await s.master(running.path)), name).turn!;
  return { s, ...running, at, turnOf };
}

test('on its own turn an attack spends the action; past the attacks of one Attack action it is refused', async () => {
  const { s, at, turnOf } = await kaelensTurn();
  assert.equal((await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 200);
  const turn = await turnOf('Kaelen');
  assert.deepEqual([turn.actionUsed, turn.attacksLeft], [true, 0]);

  // A level 3 rogue makes one attack: a second needs another action.
  const second = await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 });
  assert.equal(second.status, 422);
  assert.match(((await second.json()) as { error: string }).error, /Não há ataque nem ação/);

  // Action Surge: the master grants one more action.
  await encounterOf(await send(s.master, at('Kaelen', '/economy'), 'POST', { grant: 'action' }));
  assert.equal((await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 200);
});

test('Extra Attack lets one Attack action hit as many times as the sheet allows', async () => {
  const { s, at, turnOf } = await kaelensTurn();
  s.app.db.update(characters).set({ attacksPerAction: 2 }).where(eq(characters.id, s.kaelen.id)).run();
  for (let attack = 0; attack < 2; attack += 1) {
    assert.equal((await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 200);
  }
  assert.equal((await turnOf('Kaelen')).attacksLeft, 0);
  assert.equal((await send(s.player, at('Kaelen', '/attack'), 'POST', { attackIndex: 0 })).status, 422);
});

test('out of turn an attack is an opportunity attack: it spends the reaction, once a round', async () => {
  const s = await setup();
  const armed = await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'PATCH', { ...sheet('Kaelen'), attacks: [SWORD] });
  assert.equal(armed.status, 200);
  const { path, id } = await runningEncounter(s);
  const attack = () => send(s.player, `${path}/combatants/${id('Kaelen')}/attack`, 'POST', { attackIndex: 0 });

  assert.equal((await attack()).status, 200);
  const kaelen = byName(await encounterOf(await s.master(path)), 'Kaelen').turn!;
  assert.deepEqual([kaelen.reactionUsed, kaelen.actionUsed], [true, false]);
  assert.equal((await attack()).status, 422);
});

test('an attack rolled from the sheet in a running fight spends the turn too', async () => {
  const { s, turnOf } = await kaelensTurn();
  const roll = () => send(s.player, `${s.root}/characters/${s.kaelen.id}/rolls`, 'POST', { kind: 'attack', attackIndex: 0 });
  assert.equal((await roll()).status, 201);
  assert.equal((await turnOf('Kaelen')).actionUsed, true);
  const refused = await roll();
  assert.equal(refused.status, 422);
  // Checks and saves are not actions.
  assert.equal((await send(s.player, `${s.root}/characters/${s.kaelen.id}/rolls`, 'POST', { kind: 'check', ability: 'dexterity' })).status, 201);
});

test('a player spends their own action and bonus action on their turn, and only the reaction off it', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  const economy = (payload: unknown, request = s.player) => send(request, `${path}/combatants/${id('Kaelen')}/economy`, 'POST', payload);

  // Goblin 1 acts: Kaelen may only react.
  assert.equal((await economy({ spend: 'action' })).status, 403);
  assert.equal((await economy({ spend: 'reaction' })).status, 200);
  assert.equal((await economy({ spend: 'reaction' })).status, 422);

  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  // A new turn of their own gives the reaction back.
  let kaelen = byName(await encounterOf(await s.player(path)), 'Kaelen').turn!;
  assert.equal(kaelen.reactionUsed, false);
  assert.equal((await economy({ spend: 'bonusAction' })).status, 200);
  assert.equal((await economy({ spend: 'dash' })).status, 200);
  kaelen = byName(await encounterOf(await s.player(path)), 'Kaelen').turn!;
  assert.deepEqual([kaelen.bonusActionUsed, kaelen.actionUsed, kaelen.dashes, kaelen.movementLeft], [true, true, 1, 18]);

  // Giving back and granting are the master's.
  assert.equal((await economy({ refund: 'dash' })).status, 403);
  assert.equal((await economy({ grant: 'action' })).status, 403);
  assert.equal((await economy({ refund: 'dash' }, s.master)).status, 200);
  kaelen = byName(await encounterOf(await s.player(path)), 'Kaelen').turn!;
  assert.deepEqual([kaelen.actionUsed, kaelen.dashes], [false, 0]);

  // Someone else's combatant is not theirs to spend; a hidden one does not exist.
  assert.equal((await send(s.player, `${path}/combatants/${id('Mira')}/economy`, 'POST', { spend: 'reaction' })).status, 403);
  assert.equal((await send(s.player, `${path}/combatants/${id('Bandido')}/economy`, 'POST', { spend: 'reaction' })).status, 404);
  assert.equal((await economy({ spend: 'teleport' })).status, 422);
});

test('the next turn starts whole', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  s.app.db.update(combatants)
    .set({ actionUsed: true, bonusActionUsed: true, reactionUsed: true, dashes: 1, movementUsed: 6, extraActions: 2 })
    .where(eq(combatants.id, id('Kaelen')))
    .run();
  await encounterOf(await advance(s.master, path, id('Goblin 1')));
  const kaelen = byName(await encounterOf(await s.master(path)), 'Kaelen').turn!;
  assert.deepEqual(
    [kaelen.actionUsed, kaelen.bonusActionUsed, kaelen.reactionUsed, kaelen.dashes, kaelen.movementUsed, kaelen.extraActions],
    [false, false, false, 0, 0, 0],
  );
});

test("a bestiary copy reads its speed from the entry's text; the master corrects it, never a character's", async () => {
  const s = await setup();
  const wolf = (await body<StatblockResponse>(
    await send(s.master, `${s.root}/statblocks`, 'POST', { ...GOBLIN, name: 'Lobo', speed: '12 m, natação 6 m', attacksPerAction: 2 }),
  )).statblock;
  const { path, id } = await runningEncounter(s, { start: false });
  const view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: wolf.id, count: 1, hp: 'average' }),
    201,
  );
  const lobo = byName(view, 'Lobo');
  assert.deepEqual([lobo.speed, lobo.attacksPerAction], [12, 2]);

  const edited = await encounterOf(await send(s.master, `${path}/combatants/${lobo.id}`, 'PATCH', { speed: 15, attacksPerAction: 3 }));
  assert.deepEqual([byName(edited, 'Lobo').speed, byName(edited, 'Lobo').attacksPerAction], [15, 3]);
  assert.equal((await send(s.master, `${path}/combatants/${lobo.id}`, 'PATCH', { speed: 61 })).status, 422);
  assert.equal((await send(s.master, `${path}/combatants/${id('Kaelen')}`, 'PATCH', { speed: 12 })).status, 422);
});
