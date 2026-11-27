import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { combatants } from '@quest-fast/db';
import type { FeedResponse, RollSessionEvent, SummonSheetInput } from '@quest-fast/shared';
import { body } from '../testing.ts';
import { advance, byName, createEncounter, encounterOf, runningEncounter, send, setup, type Request, type Setup } from './test-setup.ts';

const SPIRIT: SummonSheetInput = {
  name: 'Espírito do Construto',
  size: 'medium',
  ac: 16,
  hp: 40,
  speed: 9,
  initiativeBonus: 0,
  attacks: [{ name: 'Pancada', kind: 'attack', bonus: 6, damage: '1d8+4', damageType: 'contundente' }],
};

const WITH_SUMMONER = (summonerId: string) => ({ summonerId, initiativeMode: 'withSummoner', concentration: false, rounds: null });

/** The fight running, Goblin 1 acting; Kaelen (Rafael's) and Mira (Bia's) in it. */
async function fight() {
  const s = await setup();
  const running = await runningEncounter(s);
  const summon = (request: Request, payload: Record<string, unknown> = {}) =>
    send(request, `${running.path}/combatants`, 'POST', {
      source: 'summon',
      sheet: SPIRIT,
      summon: WITH_SUMMONER(running.id('Kaelen')),
      ...payload,
    });
  const at = (combatantId: string, action = '') => `${running.path}/combatants/${combatantId}${action}`;
  return { s, ...running, summon, at };
}

/** Rafael summons the spirit from Kaelen; its id. */
async function spiritOf(f: Awaited<ReturnType<typeof fight>>) {
  return byName(await encounterOf(await f.summon(f.s.player), 201), SPIRIT.name).id;
}

async function attackEvents(s: Setup, request: Request): Promise<RollSessionEvent[]> {
  const { events } = await body<FeedResponse>(await request(`${s.root}/feed`));
  return (events.filter((event) => event.type === 'roll') as RollSessionEvent[]).filter((event) => event.payload.rollKind === 'attack');
}

test('a player summons from their own character: it acts right after it, open to the whole table', async () => {
  const f = await fight();
  const view = await encounterOf(await f.summon(f.s.player), 201);
  const spirit = byName(view, SPIRIT.name);
  assert.equal(spirit.ownerId, f.s.kaelen.ownerId);
  assert.deepEqual(spirit.summon, {
    summonerId: f.id('Kaelen'),
    initiativeMode: 'withSummoner',
    concentration: false,
    roundsLeft: null,
    editableByController: true,
  });
  // The player sees an ally's initiative, not a monster's.
  assert.deepEqual(
    view.combatants.map((combatant) => [combatant.name, combatant.initiative]),
    [['Goblin 1', null], ['Kaelen', 15], [SPIRIT.name, 15], ['Goblin 2', null], ['Mira', 5]],
  );
  const asMaster = await encounterOf(await f.s.master(f.path));
  assert.deepEqual(
    asMaster.combatants.map((combatant) => [combatant.name, combatant.initiative]),
    [['Goblin 1', 18], ['Kaelen', 15], [SPIRIT.name, 15], ['Bandido', 12], ['Goblin 2', 10], ['Mira', 5]],
  );
  assert.notEqual(spirit.turn, null);

  // Another player sees an ally whole, but its turn is its controller's.
  const asBia = byName(await encounterOf(await f.s.otherPlayer(f.path)), SPIRIT.name);
  assert.deepEqual([asBia.ac, asBia.speed, asBia.initiative, asBia.attacks.length], [16, 9, 15, 1]);
  assert.equal(asBia.turn, null);
  assert.notEqual(asBia.summon, null);
});

test('a player summons only from their own character, in the running fight, and controls it', async () => {
  const f = await fight();
  const fromMira = await f.summon(f.s.player, { summon: WITH_SUMMONER(f.id('Mira')) });
  assert.equal(fromMira.status, 403);
  const fromGoblin = await f.summon(f.s.player, { summon: WITH_SUMMONER(f.id('Goblin 1')) });
  assert.equal(fromGoblin.status, 403);
  const noSummoner = await f.summon(f.s.player, { summon: { summonerId: null, initiativeMode: 'own', concentration: false, rounds: null } });
  assert.equal(noSummoner.status, 403);
  const forBia = await f.summon(f.s.player, { controllerId: f.s.mira.ownerId });
  assert.equal(forBia.status, 403);
  const statblock = await send(f.s.player, `${f.path}/combatants`, 'POST', { source: 'statblock', statblockId: f.s.goblin.id, count: 1, hp: 'average' });
  assert.equal(statblock.status, 403);

  const outsider = await f.summon(f.s.outsider);
  assert.equal(outsider.status, 404);

  // A fight in preparation does not exist for a player.
  const preparing = await createEncounter(f.s, 'Covil');
  const early = await send(f.s.player, `${f.s.base}/${preparing.id}/combatants`, 'POST', {
    source: 'summon',
    sheet: SPIRIT,
    summon: WITH_SUMMONER(f.id('Kaelen')),
  });
  assert.equal(early.status, 404);

  const master = await encounterOf(await f.s.master(f.path));
  assert.equal(master.combatants.some((combatant) => combatant.name === SPIRIT.name), false);
});

test('the simple sheet and the link are checked, in Portuguese', async () => {
  const f = await fight();
  const badSheet = await f.summon(f.s.player, { sheet: { ...SPIRIT, ac: 0 } });
  assert.equal(badSheet.status, 422);
  assert.match(((await badSheet.json()) as { error: string }).error, /CA/);
  const badRounds = await f.summon(f.s.player, { summon: { ...WITH_SUMMONER(f.id('Kaelen')), rounds: 0 } });
  assert.equal(badRounds.status, 422);
  const notConcentrating = await f.summon(f.s.player, { summon: { ...WITH_SUMMONER(f.id('Kaelen')), concentration: true } });
  assert.equal(notConcentrating.status, 409);
  assert.match(((await notConcentrating.json()) as { error: string }).error, /não está concentrando/);

  await encounterOf(await send(f.s.player, f.at(f.id('Kaelen'), '/concentration'), 'PUT', { concentrating: true }));
  const held = byName(
    await encounterOf(await f.summon(f.s.player, { summon: { ...WITH_SUMMONER(f.id('Kaelen')), concentration: true, rounds: 10 } }), 201),
    SPIRIT.name,
  );
  assert.deepEqual([held.summon?.concentration, held.summon?.roundsLeft], [true, 10]);
});

test('a summoner keeps at most 12 summons at once', async () => {
  const f = await fight();
  for (let count = 0; count < 12; count++) await encounterOf(await f.summon(f.s.player, { sheet: { ...SPIRIT, name: `Zumbi ${count}` } }), 201);
  const thirteenth = await f.summon(f.s.player, { sheet: { ...SPIRIT, name: 'Zumbi 12' } });
  assert.equal(thirteenth.status, 422);
  assert.match(((await thirteenth.json()) as { error: string }).error, /12 invocações/);
});

test("a player does not act with another player's summon", async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  const attempts: [string, string, unknown][] = [
    ['/attack', 'POST', { attackIndex: 0, targetId: f.id('Goblin 1') }],
    ['/hp', 'POST', { operation: 'damage', amount: 3 }],
    ['/conditions/prone', 'PUT', {}],
    ['/economy', 'POST', { spend: 'action' }],
    ['/initiative', 'POST', {}],
    ['', 'PATCH', { name: 'Meu agora' }],
    ['', 'DELETE', {}],
  ];
  for (const [action, method, payload] of attempts) {
    const response = await send(f.s.otherPlayer, f.at(spirit, action), method, payload);
    assert.equal(response.status, action === '/initiative' ? 409 : 403, `${method} ${action}`);
  }
  const intact = byName(await encounterOf(await f.s.master(f.path)), SPIRIT.name);
  assert.deepEqual([intact.hpCurrent, intact.conditions, intact.turn?.actionUsed], [40, [], false]);
});

test('the controller attacks with the summon: its numbers are the table’s, the monster’s AC is not', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  // Out of its turn the attack is a reaction, as for a character.
  const attacked = await send(f.s.player, f.at(spirit, '/attack'), 'POST', { attackIndex: 0, targetId: f.id('Goblin 1') });
  assert.equal(attacked.status, 200, await attacked.clone().text());
  assert.equal(byName(await encounterOf(attacked), SPIRIT.name).turn?.reactionUsed, true);

  for (const reader of [f.s.player, f.s.otherPlayer]) {
    const [event] = await attackEvents(f.s, reader);
    assert.equal(event.secret, false);
    assert.equal(event.payload.attackerSource, 'character');
    assert.equal(event.payload.redacted, undefined);
    assert.notEqual(event.payload.total, 0);
    assert.equal(event.payload.target?.ac, undefined);
  }
  const [asMaster] = await attackEvents(f.s, f.s.master);
  assert.equal(asMaster.payload.target?.ac, 15);
});

test('the controller ends the turn of the summon, right after the summoner’s', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  let view = await encounterOf(await advance(f.s.master, f.path, f.id('Goblin 1')));
  assert.equal(view.activeCombatantId, f.id('Kaelen'));
  view = await encounterOf(await advance(f.s.player, f.path, f.id('Kaelen')));
  assert.equal(view.activeCombatantId, spirit);
  const byBia = await advance(f.s.otherPlayer, f.path, spirit);
  assert.equal(byBia.status, 403);
  // The hidden bandit acts next: the player sees only that someone does.
  view = await encounterOf(await advance(f.s.player, f.path, spirit));
  assert.deepEqual([view.activeCombatantId, view.activeHidden], [null, true]);
  assert.equal((await encounterOf(await f.s.master(f.path))).activeCombatantId, f.id('Bandido'));
});

test('a summon acting with its summoner has no roll of its own; one on its own turn is rolled by its controller', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  const typed = await send(f.s.master, f.at(spirit, '/initiative'), 'POST', { value: 20 });
  assert.equal(typed.status, 409);
  assert.match(((await typed.json()) as { error: string }).error, /age junto/);

  const own = byName(
    await encounterOf(await f.summon(f.s.player, { sheet: { ...SPIRIT, name: 'Lobo' }, summon: { ...WITH_SUMMONER(f.id('Kaelen')), initiativeMode: 'own' } }), 201),
    'Lobo',
  );
  assert.equal(own.hasInitiative, false);
  const rolled = byName(await encounterOf(await send(f.s.player, f.at(own.id, '/initiative'), 'POST', {})), 'Lobo');
  assert.equal(rolled.hasInitiative, true);
  const again = await send(f.s.player, f.at(own.id, '/initiative'), 'POST', {});
  assert.equal(again.status, 409);
});

test('before round 1, a summon acting with its summoner waits on it, and the bulk roll leaves allies to their players', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  let view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  const kaelen = byName(view, 'Kaelen').id;
  view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', {
      source: 'statblock',
      statblockId: s.goblin.id,
      count: 1,
      hp: 'average',
      controllerId: s.kaelen.ownerId,
      summon: WITH_SUMMONER(kaelen),
    }),
    201,
  );
  await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', {
      source: 'manual',
      name: 'Lobo',
      ac: 13,
      hp: 11,
      controllerId: s.kaelen.ownerId,
      summon: { ...WITH_SUMMONER(kaelen), initiativeMode: 'own' },
    }),
    201,
  );
  assert.equal((await send(s.master, `${path}/initiative`, 'POST', {})).status, 409);
  await encounterOf(await send(s.master, `${path}/start`, 'POST'));

  const missing = await advance(s.master, path, null, 0);
  assert.equal(missing.status, 409);
  assert.match(((await missing.json()) as { error: string }).error, /^Falta iniciativa: Kaelen, Lobo\.$/);
});

test('the master gives a bestiary creature to a player, who acts with it but does not edit it, and takes it back', async () => {
  const f = await fight();
  let view = await encounterOf(
    await send(f.s.master, `${f.path}/combatants`, 'POST', {
      source: 'statblock',
      statblockId: f.s.goblin.id,
      count: 1,
      hp: 'average',
      controllerId: f.s.kaelen.ownerId,
    }),
    201,
  );
  const ally = byName(view, 'Goblin 3');
  assert.deepEqual([ally.ownerId, ally.summon?.editableByController], [f.s.kaelen.ownerId, false]);
  assert.equal(byName(await encounterOf(await f.s.otherPlayer(f.path)), 'Goblin 3').ac, 15);

  const rename = await send(f.s.player, f.at(ally.id), 'PATCH', { name: 'Amigo' });
  assert.equal(rename.status, 403);
  await encounterOf(await send(f.s.player, f.at(ally.id, '/economy'), 'POST', { spend: 'reaction' }));

  view = await encounterOf(await send(f.s.master, f.at(ally.id), 'PATCH', { controllerId: null }));
  assert.equal(byName(view, 'Goblin 3').ownerId, null);
  const asPlayer = byName(await encounterOf(await f.s.player(f.path)), 'Goblin 3');
  assert.deepEqual([asPlayer.ac, asPlayer.attacks, asPlayer.turn, asPlayer.summon], [null, [], null, null]);
  const after = await send(f.s.player, f.at(ally.id, '/economy'), 'POST', { spend: 'action' });
  assert.equal(after.status, 403);
});

test('only a player of the campaign controls a creature, and a controlled creature is never hidden', async () => {
  const f = await fight();
  const masterId = (await body<{ user: { id: string } }>(await f.s.master('/api/auth/me'))).user.id;
  const outsiderId = (await body<{ user: { id: string } }>(await f.s.outsider('/api/auth/me'))).user.id;
  for (const controllerId of [masterId, outsiderId, 'nobody']) {
    const response = await send(f.s.master, f.at(f.id('Goblin 2')), 'PATCH', { controllerId });
    assert.equal(response.status, 422, controllerId);
  }
  const onCharacter = await send(f.s.master, f.at(f.id('Mira')), 'PATCH', { controllerId: f.s.kaelen.ownerId });
  assert.equal(onCharacter.status, 422);

  const hiddenGiven = await send(f.s.master, f.at(f.id('Bandido')), 'PATCH', { controllerId: f.s.kaelen.ownerId });
  assert.equal(hiddenGiven.status, 422);
  const hiddenAdded = await send(f.s.master, `${f.path}/combatants`, 'POST', {
    source: 'manual', name: 'Sombra', ac: 12, hp: 9, hidden: true, controllerId: f.s.kaelen.ownerId,
  });
  assert.equal(hiddenAdded.status, 422);
  await encounterOf(await send(f.s.master, f.at(f.id('Goblin 2')), 'PATCH', { controllerId: f.s.kaelen.ownerId }));
  const hide = await send(f.s.master, f.at(f.id('Goblin 2')), 'PATCH', { hidden: true });
  assert.equal(hide.status, 422);
});

test('the controller edits the sheet of a summon they made, nothing else, and dismisses it', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  const edited = byName(
    await encounterOf(
      await send(f.s.player, f.at(spirit), 'PATCH', {
        name: 'Espírito (nível 4)',
        ac: 17,
        hpMax: 50,
        attacks: [{ name: 'Pancada', kind: 'attack', bonus: 7, damage: '1d8+5' }],
      }),
    ),
    'Espírito (nível 4)',
  );
  assert.deepEqual([edited.ac, edited.hpMax, edited.hpCurrent, edited.attacks[0]?.kind === 'attack' && edited.attacks[0].bonus], [17, 50, 40, 7]);

  for (const payload of [{ controllerId: f.s.mira.ownerId }, { summon: WITH_SUMMONER(f.id('Mira')) }, { hidden: false }]) {
    const response = await send(f.s.player, f.at(spirit), 'PATCH', payload);
    assert.equal(response.status, 403, JSON.stringify(payload));
  }
  const removeMira = await send(f.s.player, f.at(f.id('Goblin 1')), 'DELETE');
  assert.equal(removeMira.status, 403);

  const view = await encounterOf(await send(f.s.player, f.at(spirit), 'DELETE'));
  assert.equal(view.combatants.some((combatant) => combatant.id === spirit), false);
});

test('a summon whose summoner leaves keeps its count and acts on its own', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  const view = await encounterOf(await send(f.s.master, f.at(f.id('Kaelen')), 'DELETE'));
  const left = byName(view, SPIRIT.name);
  assert.deepEqual([left.initiative, left.summon?.summonerId, left.summon?.initiativeMode], [15, null, 'own']);
  const row = f.s.app.db.select().from(combatants).where(eq(combatants.id, spirit)).get();
  assert.equal(row?.initiative, 15);
});

test('a summon moved to its own turn by the master keeps its count', async () => {
  const f = await fight();
  const spirit = await spiritOf(f);
  const view = await encounterOf(
    await send(f.s.master, f.at(spirit), 'PATCH', { summon: { ...WITH_SUMMONER(f.id('Kaelen')), initiativeMode: 'own' } }),
  );
  assert.deepEqual([byName(view, SPIRIT.name).initiative, byName(view, SPIRIT.name).summon?.initiativeMode], [15, 'own']);
  const self = await send(f.s.master, f.at(spirit), 'PATCH', { summon: WITH_SUMMONER(spirit) });
  assert.equal(self.status, 422);
});

test('a player who leaves the campaign hands their summons back to the master', async () => {
  const f = await fight();
  await spiritOf(f);
  const left = await send(f.s.player, `${f.s.root}/members/me`, 'DELETE');
  assert.equal(left.status, 204);
  const spirit = byName(await encounterOf(await f.s.otherPlayer(f.path)), SPIRIT.name);
  assert.deepEqual([spirit.ownerId, spirit.ac, spirit.turn], [null, null, null]);
});
