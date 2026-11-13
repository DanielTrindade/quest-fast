import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { characters, combatants } from '@quest-fast/db';
import type { StatblockResponse } from '@quest-fast/shared';
import { body } from '../testing.ts';
import { GOBLIN, byName, encounterOf, runningEncounter, send, setup, sheet } from './test-setup.ts';

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
});
