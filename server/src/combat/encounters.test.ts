import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import WebSocket from 'ws';
import { characters, combatants } from '@quest-fast/db';
import type {
  CharacterResponse,
  CombatantView,
  CombatEndedPayload,
  CreatedCampaign,
  EncounterConflictResponse,
  EncounterListResponse,
  EncounterResponse,
  EncounterView,
  FeedResponse,
  SocketMessage,
  StatblockResponse,
} from '@quest-fast/shared';
import { SESSION_COOKIE } from '../auth/session.ts';
import { asUser, body, createTestApp, createTestServer, signIn, type TestApp } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  bia: { discordId: '333', name: 'Bia Souza', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

const GOBLIN = {
  name: 'Goblin',
  size: 'small',
  ac: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  initiativeBonus: 0,
  abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  attacks: [{ name: 'Cimitarra', bonus: 4, damage: '1d6+2' }],
};

function sheet(name: string) {
  return {
    name,
    race: 'Elfo',
    class: 'Ladino',
    level: 3,
    abilityScores: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 12, charisma: 8 },
    hp: 24,
    ac: 15,
    skills: [],
    saves: [],
    attacks: [],
    features: [],
    description: '',
  };
}

type Request = ReturnType<typeof asUser>;

function send(request: Request, path: string, method: string, payload: unknown = {}) {
  return request(path, { method, body: JSON.stringify(payload) });
}

async function setup(app: Pick<TestApp, 'app' | 'db'> = createTestApp(PROFILES)) {
  const master = asUser(app, await signIn(app, 'lia'));
  const player = asUser(app, await signIn(app, 'rafael'));
  const otherPlayer = asUser(app, await signIn(app, 'bia'));
  const outsider = asUser(app, await signIn(app, 'outsider'));
  const campaign = await body<CreatedCampaign>(
    await send(master, '/api/campaigns', 'POST', { name: 'Ecos de Phandalin' }),
  );
  for (const member of [player, otherPlayer]) {
    await send(member, '/api/campaigns/join', 'POST', { code: campaign.inviteCode });
  }
  const root = `/api/campaigns/${campaign.id}`;
  const kaelen = (await body<CharacterResponse>(await send(player, `${root}/characters`, 'POST', sheet('Kaelen')))).character;
  const mira = (await body<CharacterResponse>(await send(otherPlayer, `${root}/characters`, 'POST', sheet('Mira')))).character;
  const goblin = (await body<StatblockResponse>(await send(master, `${root}/statblocks`, 'POST', GOBLIN))).statblock;
  return { app, master, player, otherPlayer, outsider, campaign, root, base: `${root}/encounters`, kaelen, mira, goblin };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function encounterOf(response: Response, status = 200): Promise<EncounterView> {
  assert.equal(response.status, status, await response.clone().text());
  return (await body<EncounterResponse>(response)).encounter;
}

async function createEncounter(s: Setup, name = 'Emboscada na estrada') {
  return encounterOf(await send(s.master, s.base, 'POST', { name }), 201);
}

function byName(encounter: EncounterView, name: string): CombatantView {
  const found = encounter.combatants.find((combatant) => combatant.name === name);
  assert.ok(found, `${name} is in the encounter`);
  return found;
}

/**
 * A ready encounter: Kaelen and Mira, two goblins and a hidden bandit, all
 * with known initiative so the queue is predictable — Goblin 1 (18), Kaelen
 * (15), Bandido (12, hidden), Goblin 2 (10), Mira (5).
 */
async function runningEncounter(s: Setup, { start = true } = {}) {
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id });
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.mira.id });
  await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 2, hp: 'average' });
  let view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', {
      source: 'manual',
      name: 'Bandido',
      ac: 12,
      hp: 11,
      hidden: true,
    }),
    201,
  );
  const values: Record<string, number> = { 'Goblin 1': 18, Kaelen: 15, Bandido: 12, 'Goblin 2': 10, Mira: 5 };
  for (const [name, value] of Object.entries(values)) {
    view = await encounterOf(await send(s.master, `${path}/combatants/${byName(view, name).id}/initiative`, 'POST', { value }));
  }
  if (start) {
    await encounterOf(await send(s.master, `${path}/start`, 'POST'));
    view = await encounterOf(await send(s.master, `${path}/turn`, 'POST', { direction: 'next', expectedActiveCombatantId: null, expectedRound: 0 }));
  }
  return { encounter: view, path, id: (name: string) => byName(view, name).id };
}

async function advance(request: Request, path: string, expected: string | null, round = 1) {
  return send(request, `${path}/turn`, 'POST', { direction: 'next', expectedActiveCombatantId: expected, expectedRound: round });
}

// --- Preparation -----------------------------------------------------------------

test('the master prepares an encounter with a character, numbered copies and a manual combatant', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  assert.equal(encounter.status, 'preparing');
  assert.equal(encounter.round, 0);
  const path = `${s.base}/${encounter.id}/combatants`;

  await encounterOf(await send(s.master, path, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  await encounterOf(await send(s.master, path, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 2, hp: 'average' }), 201);
  const rolled = await encounterOf(
    await send(s.master, path, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 3, hp: 'rolled' }),
    201,
  );
  const view = await encounterOf(
    await send(s.master, path, 'POST', { source: 'manual', name: 'Bandido', ac: 12, hp: 11, size: 'medium', initiative: 9 }),
    201,
  );

  assert.deepEqual(
    view.combatants.map((combatant) => combatant.name),
    // Only the bandit has initiative yet; the rest wait in the order they came.
    ['Bandido', 'Kaelen', 'Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4', 'Goblin 5'],
  );
  const kaelen = byName(view, 'Kaelen');
  assert.equal(kaelen.hpMax, 24);
  assert.equal(kaelen.ac, 15);
  assert.equal(kaelen.ownerId, s.kaelen.ownerId);
  assert.equal(byName(view, 'Goblin 1').hpMax, 7);
  for (const name of ['Goblin 3', 'Goblin 4', 'Goblin 5']) {
    const hp = byName(rolled, name).hpMax!;
    assert.ok(hp >= 2 && hp <= 12, `${name} rolled 2d6 hit points (${hp})`);
  }
  assert.equal(byName(view, 'Bandido').initiative, 9);
});

test('a character joins an encounter only once, and only from this campaign', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}/combatants`;
  await send(s.master, path, 'POST', { source: 'character', characterId: s.kaelen.id });
  assert.equal((await send(s.master, path, 'POST', { source: 'character', characterId: s.kaelen.id })).status, 409);
  assert.equal((await send(s.master, path, 'POST', { source: 'character', characterId: 'missing' })).status, 404);
});

test('invalid combatants are refused with a reason', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}/combatants`;
  const noFormula = (await body<StatblockResponse>(
    await send(s.master, `${s.root}/statblocks`, 'POST', { ...GOBLIN, name: 'Lobo', hpFormula: '' }),
  )).statblock;
  const cases: object[] = [
    { source: 'dragon' },
    { source: 'statblock', statblockId: s.goblin.id, count: 0, hp: 'average' },
    { source: 'statblock', statblockId: s.goblin.id, count: 21, hp: 'average' },
    { source: 'statblock', statblockId: s.goblin.id, count: 1, hp: 'max' },
    { source: 'statblock', statblockId: noFormula.id, count: 1, hp: 'rolled' },
    { source: 'manual', name: '', ac: 12, hp: 5 },
    { source: 'manual', name: 'Bandido', ac: 0, hp: 5 },
    { source: 'manual', name: 'Bandido', ac: 12, hp: 0 },
    { source: 'manual', name: 'Bandido', ac: 12, hp: 5, initiative: 99 },
    { source: 'manual', name: 'Bandido', ac: 12, hp: 5, hidden: 'yes' },
  ];
  for (const payload of cases) {
    const response = await send(s.master, path, 'POST', payload);
    assert.equal(response.status, 422, JSON.stringify(payload));
    assert.ok((await body<{ error: string }>(response)).error.length > 0);
  }
});

test('the master edits, hides and removes combatants in preparation', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s, { start: false });
  let view = await encounterOf(await send(s.master, `${path}/combatants/${id('Goblin 1')}`, 'PATCH', { name: 'Goblin Chefe', hpMax: 12, ac: 17 }));
  const chief = byName(view, 'Goblin Chefe');
  assert.deepEqual([chief.hpMax, chief.hpCurrent, chief.ac], [12, 12, 17]);

  view = await encounterOf(await send(s.master, `${path}/combatants/${id('Goblin 2')}`, 'PATCH', { hidden: true }));
  assert.equal(byName(view, 'Goblin 2').hidden, true);

  const characterEdit = await send(s.master, `${path}/combatants/${id('Kaelen')}`, 'PATCH', { hpMax: 50 });
  assert.equal(characterEdit.status, 422);

  view = await encounterOf(await send(s.master, `${path}/combatants/${id('Mira')}`, 'DELETE'));
  assert.equal(view.combatants.some((combatant) => combatant.name === 'Mira'), false);
  assert.ok(view.version > encounter.version);
});

// --- Visibility ------------------------------------------------------------------

test('an encounter in preparation does not exist for a player', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;

  assert.equal((await s.player(path)).status, 404);
  const list = await body<EncounterListResponse>(await s.player(s.base));
  assert.deepEqual(list.encounters, []);
  // Not even an action reveals it: 404, never 403.
  assert.equal((await send(s.player, `${path}/start`, 'POST')).status, 404);
  assert.equal((await send(s.player, `${path}/combatants`, 'POST', { source: 'manual', name: 'X', ac: 1, hp: 1 })).status, 404);
  assert.equal((await send(s.player, path, 'DELETE')).status, 404);

  const masterList = await body<EncounterListResponse>(await s.master(s.base));
  assert.equal(masterList.encounters.length, 1);
});

test('a player sees allies in full, monsters only by health band, and no hidden combatant', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  s.app.db.update(combatants).set({ hpCurrent: 3 }).where(eq(combatants.id, id('Goblin 2'))).run();

  const view = await encounterOf(await s.player(path));
  assert.deepEqual(
    view.combatants.map((combatant) => combatant.name),
    ['Goblin 1', 'Kaelen', 'Goblin 2', 'Mira'],
  );
  const goblin = byName(view, 'Goblin 2');
  assert.deepEqual(
    [goblin.hpMax, goblin.hpCurrent, goblin.hpTemp, goblin.ac, goblin.initiative, goblin.dexModifier, goblin.tieOrder],
    [null, null, null, null, null, null, null],
  );
  assert.equal(goblin.healthBand, 'bloodied');
  assert.equal(goblin.hasInitiative, true);
  const mira = byName(view, 'Mira');
  assert.deepEqual([mira.hpMax, mira.ac, mira.initiative], [24, 15, 5]);

  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('Bandido'), false);
  assert.equal(serialized.includes(id('Bandido')), false);
  assert.equal((await s.player(`${path}`)).status, 200);
  assert.equal((await send(s.player, `${path}/combatants/${id('Bandido')}/initiative`, 'POST')).status, 404);

  const list = await body<EncounterListResponse>(await s.player(s.base));
  assert.equal(list.encounters[0]!.combatantCount, 4);
});

test("a hidden combatant's turn reaches the player as someone else's turn", async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  await encounterOf(await advance(s.master, path, encounter.activeCombatantId)); // Kaelen
  const hiddenTurn = await encounterOf(await advance(s.master, path, id('Kaelen'))); // Bandido
  assert.equal(hiddenTurn.activeCombatantId, id('Bandido'));

  const view = await encounterOf(await s.player(path));
  assert.equal(view.activeCombatantId, null);
  assert.equal(view.activeHidden, true);
});

test('revealing a hidden combatant shows it to the players', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  await encounterOf(await send(s.master, `${path}/combatants/${id('Bandido')}`, 'PATCH', { hidden: false }));
  const view = await encounterOf(await s.player(path));
  assert.equal(byName(view, 'Bandido').hidden, false);
});

// --- Initiative --------------------------------------------------------------------

test('a player rolls their own initiative once; the master may still override it', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  let view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.mira.id });
  await send(s.master, `${path}/start`, 'POST');
  const kaelen = byName(view, 'Kaelen').id;

  view = await encounterOf(await send(s.player, `${path}/combatants/${kaelen}/initiative`, 'POST'));
  const rolled = byName(view, 'Kaelen').initiative!;
  // d20 + Dexterity 16 (+3).
  assert.ok(rolled >= 4 && rolled <= 23);

  assert.equal((await send(s.player, `${path}/combatants/${kaelen}/initiative`, 'POST')).status, 409);
  view = await encounterOf(await send(s.master, `${path}/combatants/${kaelen}/initiative`, 'POST', { value: 17 }));
  assert.equal(byName(view, 'Kaelen').initiative, 17);

  // The player's roll is public in the feed, with the character's name.
  const feed = await body<FeedResponse>(await s.otherPlayer(`${s.root}/feed`));
  const roll = feed.events.find((event) => event.type === 'roll');
  assert.ok(roll);
  assert.equal((roll.payload as { characterName?: string }).characterName, 'Kaelen');
});

test("the master's monster initiative is secret by default", async () => {
  const s = await setup();
  const encounter = await createEncounter(s, 'Segunda leva');
  const second = `${s.base}/${encounter.id}`;
  await send(s.master, `${second}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 3, hp: 'average' });
  const view = await encounterOf(await send(s.master, `${second}/initiative`, 'POST'));
  assert.ok(view.combatants.every((combatant) => combatant.hasInitiative));
  assert.equal((await send(s.master, `${second}/initiative`, 'POST')).status, 409);

  const masterFeed = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  assert.equal(masterFeed.events.filter((event) => event.secret).length, 3);
  const playerFeed = await body<FeedResponse>(await s.player(`${s.root}/feed`));
  assert.equal(playerFeed.events.length, 0);
});

test('no initiative rolled in preparation reaches a player, even when asked public', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  let view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.mira.id }), 201);
  await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 2, hp: 'average' });

  // A character's roll is public by default, and the master asks for it.
  await encounterOf(await send(s.master, `${path}/combatants/${byName(view, 'Kaelen').id}/initiative`, 'POST', { secret: false }));
  await encounterOf(await send(s.master, `${path}/initiative`, 'POST', { secret: false }));
  const masterFeed = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  assert.equal(masterFeed.events.filter((event) => event.type === 'roll').length, 3);
  assert.ok(masterFeed.events.every((event) => event.secret));
  assert.equal((await body<FeedResponse>(await s.player(`${s.root}/feed`))).events.length, 0);

  // Once the combat runs, a public roll is the table's again.
  await send(s.master, `${path}/start`, 'POST');
  await encounterOf(await send(s.master, `${path}/combatants/${byName(view, 'Mira').id}/initiative`, 'POST'));
  const playerFeed = await body<FeedResponse>(await s.player(`${s.root}/feed`));
  const rolls = playerFeed.events.filter((event) => event.type === 'roll');
  assert.deepEqual(rolls.map((event) => (event.payload as { characterName?: string }).characterName), ['Mira']);
});

test('round 1 waits for every initiative and starts with the highest', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id });
  let view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 1, hp: 'average' }), 201);
  await encounterOf(await send(s.master, `${path}/start`, 'POST'));

  const early = await advance(s.master, path, null, 0);
  assert.equal(early.status, 409);
  assert.match((await body<{ error: string }>(early)).error, /Kaelen/);

  await send(s.master, `${path}/combatants/${byName(view, 'Kaelen').id}/initiative`, 'POST', { value: 4 });
  await send(s.master, `${path}/combatants/${byName(view, 'Goblin').id}/initiative`, 'POST', { value: 12 });
  view = await encounterOf(await advance(s.master, path, null, 0));
  assert.equal(view.round, 1);
  assert.equal(view.activeCombatantId, byName(view, 'Goblin').id);
});

test('ties follow Dexterity, then the order the master sets', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  let view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 3, hp: 'average' }),
    201,
  );
  for (const combatant of view.combatants) {
    view = await encounterOf(await send(s.master, `${path}/combatants/${combatant.id}/initiative`, 'POST', { value: 10 }));
  }
  const ids = ['Goblin 3', 'Goblin 1', 'Goblin 2'].map((name) => byName(view, name).id);
  view = await encounterOf(await send(s.master, `${path}/tie-order`, 'PUT', { combatantIds: ids }));
  assert.deepEqual(view.combatants.map((combatant) => combatant.name), ['Goblin 3', 'Goblin 1', 'Goblin 2']);
  assert.equal((await send(s.master, `${path}/tie-order`, 'PUT', { combatantIds: [ids[0], ids[0]] })).status, 422);
});

// --- Turns -------------------------------------------------------------------------

test('turns go down the queue, skip defeated monsters and wrap into a new round', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  assert.equal(encounter.activeCombatantId, id('Goblin 1'));
  s.app.db.update(combatants).set({ hpCurrent: 0 }).where(eq(combatants.id, id('Goblin 2'))).run();

  const seen: string[] = [];
  let current = encounter;
  for (let step = 0; step < 4; step++) {
    current = await encounterOf(await advance(s.master, path, current.activeCombatantId, current.round));
    seen.push(`${current.round}:${byName(current, current.combatants.find((c) => c.id === current.activeCombatantId)!.name).name}`);
  }
  assert.deepEqual(seen, ['1:Kaelen', '1:Bandido', '1:Mira', '2:Goblin 1']);
  assert.equal(byName(current, 'Goblin 2').defeated, true);

  const back = await encounterOf(
    await send(s.master, `${path}/turn`, 'POST', { direction: 'previous', expectedActiveCombatantId: current.activeCombatantId, expectedRound: current.round }),
  );
  assert.deepEqual([back.round, back.activeCombatantId], [1, id('Mira')]);
});

test('a player ends their own turn, and only their own', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  // Goblin 1 acts: not the player's turn.
  assert.equal((await advance(s.player, path, encounter.activeCombatantId)).status, 403);

  const kaelenTurn = await encounterOf(await advance(s.master, path, encounter.activeCombatantId));
  assert.equal(kaelenTurn.activeCombatantId, id('Kaelen'));
  assert.equal((await advance(s.otherPlayer, path, id('Kaelen'))).status, 403);
  const after = await encounterOf(await advance(s.player, path, id('Kaelen')));
  assert.equal(after.activeCombatantId, null, 'the hidden bandit acts next, unseen by the player');
  assert.equal(after.activeHidden, true);
});

test('a stale turn request answers 409 with the current state', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  await encounterOf(await advance(s.master, path, encounter.activeCombatantId));
  // A double click: the second request still thinks Goblin 1 is acting.
  const stale = await advance(s.master, path, encounter.activeCombatantId);
  assert.equal(stale.status, 409);
  const conflict = await body<EncounterConflictResponse>(stale);
  assert.equal(conflict.encounter.activeCombatantId, id('Kaelen'));
  assert.ok(conflict.error.length > 0);
});

test('with one combatant standing, a repeated turn request does not pass twice', async () => {
  const s = await setup();
  const encounter = await createEncounter(s);
  const path = `${s.base}/${encounter.id}`;
  let view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'character', characterId: s.kaelen.id }), 201);
  view = await encounterOf(await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 1, hp: 'average' }), 201);
  const kaelen = byName(view, 'Kaelen').id;
  await send(s.master, `${path}/combatants/${kaelen}/initiative`, 'POST', { value: 15 });
  await send(s.master, `${path}/combatants/${byName(view, 'Goblin').id}/initiative`, 'POST', { value: 10 });
  s.app.db.update(combatants).set({ hpCurrent: 0 }).where(eq(combatants.id, byName(view, 'Goblin').id)).run();
  await send(s.master, `${path}/start`, 'POST');
  view = await encounterOf(await advance(s.master, path, null, 0));
  assert.deepEqual([view.round, view.activeCombatantId], [1, kaelen]);
  s.app.db.update(characters).set({ conditions: [{ condition: 'poisoned', roundsLeft: 3 }] }).where(eq(characters.id, s.kaelen.id)).run();

  // Kaelen's turn wraps into Kaelen's turn: only the round tells them apart.
  view = await encounterOf(await advance(s.player, path, kaelen, 1));
  assert.deepEqual([view.round, view.activeCombatantId], [2, kaelen]);
  const repeated = await advance(s.player, path, kaelen, 1);
  assert.equal(repeated.status, 409);
  assert.equal((await body<EncounterConflictResponse>(repeated)).encounter.round, 2);
  assert.deepEqual(byName(await encounterOf(await s.master(path)), 'Kaelen').conditions, [
    { condition: 'poisoned', roundsLeft: 2 },
  ]);
});

test('a player cannot go back a turn', async () => {
  const s = await setup();
  const { encounter, path } = await runningEncounter(s);
  const response = await send(s.player, `${path}/turn`, 'POST', {
    direction: 'previous',
    expectedActiveCombatantId: encounter.activeCombatantId,
  });
  assert.equal(response.status, 403);
});

test('durations tick at the end of the affected combatant\'s turn', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  s.app.db
    .update(combatants)
    .set({ conditions: [{ condition: 'prone' }, { condition: 'frightened', roundsLeft: 1 }, { condition: 'poisoned', roundsLeft: 3 }] })
    .where(eq(combatants.id, id('Goblin 1')))
    .run();
  const view = await encounterOf(await advance(s.master, path, encounter.activeCombatantId));
  assert.deepEqual(byName(view, 'Goblin 1').conditions, [
    { condition: 'prone' },
    { condition: 'poisoned', roundsLeft: 2 },
  ]);
});

test('a reinforcement joins mid-fight without moving the turn', async () => {
  const s = await setup();
  const { encounter, path } = await runningEncounter(s);
  let view = await encounterOf(
    await send(s.master, `${path}/combatants`, 'POST', { source: 'statblock', statblockId: s.goblin.id, count: 1, hp: 'average' }),
    201,
  );
  const reinforcement = byName(view, 'Goblin 3');
  assert.equal(reinforcement.initiative, null);
  assert.equal(view.activeCombatantId, encounter.activeCombatantId);

  view = await encounterOf(await send(s.master, `${path}/combatants/${reinforcement.id}/initiative`, 'POST', { value: 16 }));
  assert.deepEqual(
    view.combatants.slice(0, 3).map((combatant) => combatant.name),
    ['Goblin 1', 'Goblin 3', 'Kaelen'],
  );
  assert.equal(view.activeCombatantId, encounter.activeCombatantId);
});

test('removing the active combatant passes the turn to the next one', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  const view = await encounterOf(await send(s.master, `${path}/combatants/${encounter.activeCombatantId}`, 'DELETE'));
  assert.equal(view.activeCombatantId, id('Kaelen'));
  assert.equal(view.round, 1);
});

test('deleting the sheet of the active character passes the turn to the next one', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  const kaelenTurn = await encounterOf(await advance(s.master, path, encounter.activeCombatantId));
  assert.equal(kaelenTurn.activeCombatantId, id('Kaelen'));

  assert.equal((await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'DELETE')).status, 204);
  const view = await encounterOf(await s.master(path));
  assert.equal(view.combatants.some((combatant) => combatant.name === 'Kaelen'), false);
  assert.deepEqual([view.round, view.activeCombatantId], [1, id('Bandido')]);
  assert.ok(view.version > kaelenTurn.version);
  const next = await encounterOf(await advance(s.master, path, id('Bandido')));
  assert.equal(next.activeCombatantId, id('Goblin 2'));
});

test('deleting the sheet of a waiting character keeps the turn where it is', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  assert.equal((await send(s.master, `${s.root}/characters/${s.mira.id}`, 'DELETE')).status, 204);
  const view = await encounterOf(await s.master(path));
  assert.equal(view.combatants.some((combatant) => combatant.name === 'Mira'), false);
  assert.deepEqual([view.round, view.activeCombatantId], [1, id('Goblin 1')]);
  assert.ok(view.version > encounter.version);
});

// --- Start and end -----------------------------------------------------------------

test('a campaign runs one combat at a time', async () => {
  const s = await setup();
  await runningEncounter(s);
  const second = await createEncounter(s, 'Ponte');
  const response = await send(s.master, `${s.base}/${second.id}/start`, 'POST');
  assert.equal(response.status, 409);
});

test('ending a combat leaves a summary for everyone, without the hidden defeated', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  s.app.db.update(combatants).set({ hpCurrent: 0 }).where(eq(combatants.id, id('Goblin 2'))).run();
  s.app.db.update(combatants).set({ hpCurrent: 0 }).where(eq(combatants.id, id('Bandido'))).run();

  const ended = await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.equal(ended.status, 'ended');
  assert.equal(ended.activeCombatantId, null);
  assert.deepEqual(ended.summary, { rounds: 1, defeated: ['Bandido', 'Goblin 2'] });

  const playerView = await encounterOf(await s.player(path));
  assert.deepEqual(playerView.summary, { rounds: 1, defeated: ['Goblin 2'] });

  const playerFeed = await body<FeedResponse>(await s.player(`${s.root}/feed`));
  assert.deepEqual(
    playerFeed.events.map((event) => event.type),
    ['combat.started', 'combat.ended'],
  );
  const summary = playerFeed.events[1]!.payload as CombatEndedPayload;
  assert.deepEqual(summary.defeated, [{ name: 'Goblin 2', hidden: false }]);
  const masterFeed = await body<FeedResponse>(await s.master(`${s.root}/feed`));
  const masterSummary = masterFeed.events.find((event) => event.type === 'combat.ended')!.payload as CombatEndedPayload;
  assert.equal(masterSummary.defeated.length, 2);

  // Ended means read-only.
  assert.equal((await advance(s.master, path, null)).status, 409);
  assert.equal(
    (await send(s.master, `${path}/combatants`, 'POST', { source: 'manual', name: 'X', ac: 10, hp: 1 })).status,
    409,
  );
  assert.equal((await send(s.master, `${s.base}/${ended.id}`, 'DELETE')).status, 204);
});

test('round durations are dropped from character sheets when the combat ends', async () => {
  const s = await setup();
  const { path } = await runningEncounter(s);
  s.app.db
    .update(characters)
    .set({ conditions: [{ condition: 'poisoned', roundsLeft: 2 }] })
    .where(eq(characters.id, s.kaelen.id))
    .run();
  const ended = await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.deepEqual(byName(ended, 'Kaelen').conditions, [{ condition: 'poisoned' }]);
});

// --- RBAC ----------------------------------------------------------------------------

test('a player cannot run the encounter', async () => {
  const s = await setup();
  const { encounter, path, id } = await runningEncounter(s);
  const goblin = id('Goblin 1');
  const forbidden: [string, string, unknown][] = [
    [s.base, 'POST', { name: 'Minha emboscada' }],
    [path, 'PATCH', { name: 'Outro nome' }],
    [path, 'DELETE', undefined],
    [`${path}/end`, 'POST', {}],
    [`${path}/initiative`, 'POST', {}],
    [`${path}/tie-order`, 'PUT', { combatantIds: [goblin] }],
    [`${path}/combatants`, 'POST', { source: 'manual', name: 'Aliado', ac: 10, hp: 5 }],
    [`${path}/combatants/${goblin}`, 'PATCH', { hidden: true }],
    [`${path}/combatants/${goblin}`, 'DELETE', undefined],
    [`${path}/combatants/${goblin}/initiative`, 'POST', {}],
    [`${path}/combatants/${id('Mira')}/initiative`, 'POST', {}],
    [`${path}/combatants/${id('Kaelen')}/initiative`, 'POST', { value: 25 }],
    [`${path}/turn`, 'POST', { direction: 'previous', expectedActiveCombatantId: encounter.activeCombatantId }],
  ];
  for (const [route, method, payload] of forbidden) {
    const response = await send(s.player, route, method, payload);
    assert.equal(response.status, 403, `${method} ${route}`);
  }
  const ended = await createEncounter(s, 'Outro');
  assert.equal((await send(s.player, `${s.base}/${ended.id}/start`, 'POST')).status, 404);
});

test('a non-member gets 404 on every encounter route', async () => {
  const s = await setup();
  const { path, id } = await runningEncounter(s);
  const goblin = id('Goblin 1');
  const routes: [string, string][] = [
    [s.base, 'GET'],
    [s.base, 'POST'],
    [path, 'GET'],
    [path, 'PATCH'],
    [path, 'DELETE'],
    [`${path}/start`, 'POST'],
    [`${path}/end`, 'POST'],
    [`${path}/turn`, 'POST'],
    [`${path}/initiative`, 'POST'],
    [`${path}/tie-order`, 'PUT'],
    [`${path}/combatants`, 'POST'],
    [`${path}/combatants/${goblin}`, 'PATCH'],
    [`${path}/combatants/${goblin}`, 'DELETE'],
    [`${path}/combatants/${goblin}/initiative`, 'POST'],
  ];
  for (const [route, method] of routes) {
    const response = await s.outsider(route, { method, body: method === 'GET' ? undefined : '{}' });
    assert.equal(response.status, 404, `${method} ${route}`);
  }
});

test('every encounter route requires a session', async () => {
  const s = await setup();
  const response = await s.app.app.request(s.base);
  assert.equal(response.status, 401);
});

// --- Realtime --------------------------------------------------------------------------

function connect(port: number, campaignId: string, session: string) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/campaigns/${campaignId}/ws`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
  });
}

/** Every `combat.updated` a socket receives, in order. */
function collectCombat(socket: WebSocket): EncounterView[] {
  const updates: EncounterView[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'combat.updated') updates.push(message.encounter);
  });
  return updates;
}

async function until(check: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for the socket');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('combat.updated reaches each socket projected for its viewer', async (t) => {
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const masterSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'lia'));
  const playerSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(async () => {
    masterSocket.close();
    playerSocket.close();
    await server.close();
  });
  await Promise.all([masterSocket, playerSocket].map((socket) => new Promise((resolve) => socket.once('open', resolve))));
  const masterUpdates = collectCombat(masterSocket);
  const playerUpdates = collectCombat(playerSocket);

  const { path, encounter } = await runningEncounter(s, { start: false });
  await until(() => masterUpdates.length >= 9);
  // Preparation never reaches a player.
  assert.equal(playerUpdates.length, 0);

  await send(s.master, `${path}/start`, 'POST');
  await until(() => playerUpdates.length === 1);
  const playerView = playerUpdates[0]!;
  assert.equal(playerView.id, encounter.id);
  assert.equal(JSON.stringify(playerView).includes('Bandido'), false);
  assert.equal(byName(playerView, 'Goblin 1').hpCurrent, null);
  assert.equal(byName(playerView, 'Goblin 1').ac, null);
  const masterLatest = masterUpdates.at(-1)!;
  assert.equal(masterLatest.version, playerView.version);
  assert.equal(byName(masterLatest, 'Bandido').hpMax, 11);

  // A sheet change of a character in the fight shows up in the encounter.
  await send(s.player, `${s.root}/characters/${s.kaelen.id}/state`, 'PATCH', { hpCurrent: 9 });
  await until(() => playerUpdates.length === 2);
  assert.equal(byName(playerUpdates[1]!, 'Kaelen').hpCurrent, 9);
  assert.ok(playerUpdates[1]!.version > playerView.version);

  // So does a sheet deleted mid-fight: the character leaves the encounter.
  await send(s.player, `${s.root}/characters/${s.kaelen.id}`, 'DELETE');
  await until(() => playerUpdates.length === 3);
  assert.equal(playerUpdates[2]!.combatants.some((combatant) => combatant.name === 'Kaelen'), false);
  assert.ok(playerUpdates[2]!.version > playerUpdates[1]!.version);
});

/** The `encounterId` of every `combat.deleted` a socket receives, in order. */
function collectDeleted(socket: WebSocket): string[] {
  const deleted: string[] = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as SocketMessage;
    if (message.type === 'combat.deleted') deleted.push(message.encounterId);
  });
  return deleted;
}

test('deleting an encounter reaches only the sockets that could see it', async (t) => {
  const server = await createTestServer(PROFILES);
  const s = await setup({ app: server.app, db: server.db });
  const masterSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'lia'));
  const playerSocket = connect(server.port, s.campaign.id, await signIn({ app: server.app }, 'rafael'));
  t.after(async () => {
    masterSocket.close();
    playerSocket.close();
    await server.close();
  });
  await Promise.all([masterSocket, playerSocket].map((socket) => new Promise((resolve) => socket.once('open', resolve))));
  const masterDeleted = collectDeleted(masterSocket);
  const playerDeleted = collectDeleted(playerSocket);

  // An ended combat was in sight of the table: everyone learns it is gone.
  const { encounter: ended, path } = await runningEncounter(s);
  await encounterOf(await send(s.master, `${path}/end`, 'POST'));
  assert.equal((await send(s.master, path, 'DELETE')).status, 204);
  await until(() => masterDeleted.length === 1 && playerDeleted.length === 1);
  assert.deepEqual([masterDeleted[0], playerDeleted[0]], [ended.id, ended.id]);

  // One in preparation never existed for the player, not even its deletion.
  const preparing = await createEncounter(s, 'Covil');
  assert.equal((await send(s.master, `${s.base}/${preparing.id}`, 'DELETE')).status, 204);
  await until(() => masterDeleted.length === 2);
  assert.equal(masterDeleted[1], preparing.id);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(playerDeleted, [ended.id]);
});
