import test from 'node:test';
import assert from 'node:assert/strict';
import { encounters, combatants } from '@quest-fast/db';
import {
  STATBLOCK_LIMITS,
  type CreatedCampaign,
  type StatblockListResponse,
  type StatblockResponse,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

const GOBLIN = {
  name: 'Goblin',
  size: 'small',
  creatureType: 'Humanoide (goblinoide)',
  challengeRating: '1/4',
  ac: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  speed: '9 m',
  initiativeBonus: 0,
  abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  attacks: [{ name: 'Cimitarra', bonus: 4, damage: '1d6+2', damageType: 'Cortante' }],
  traits: 'Fuga Ágil.',
  actions: '',
  reactions: '',
};

async function appWithCampaign() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));
  const created = await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos de Phandalin' }) });
  const campaign = await body<CreatedCampaign>(created);
  await player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  const base = `/api/campaigns/${campaign.id}/statblocks`;
  return { a, master, player, outsider, campaign, base };
}

function send(request: ReturnType<typeof asUser>, path: string, method: string, payload: unknown) {
  return request(path, { method, body: JSON.stringify(payload) });
}

async function createGoblin(request: ReturnType<typeof asUser>, base: string, overrides: object = {}) {
  const response = await send(request, base, 'POST', { ...GOBLIN, ...overrides });
  assert.equal(response.status, 201);
  return (await body<StatblockResponse>(response)).statblock;
}

test('the master creates a statblock and reads it back', async () => {
  const { master, base, campaign } = await appWithCampaign();
  const created = await createGoblin(master, base);
  assert.equal(created.campaignId, campaign.id);
  assert.equal(created.name, 'Goblin');
  assert.deepEqual(created.attacks, [{ kind: 'attack', name: 'Cimitarra', bonus: 4, damage: '1d6+2', damageType: 'Cortante', notes: '' }]);

  const read = await master(`${base}/${created.id}`);
  assert.equal(read.status, 200);
  assert.deepEqual((await body<StatblockResponse>(read)).statblock, created);
});

test('missing optional fields take their defaults', async () => {
  const { master, base } = await appWithCampaign();
  const created = await createGoblin(master, base, {
    creatureType: undefined,
    challengeRating: undefined,
    hpFormula: undefined,
    speed: undefined,
    initiativeBonus: undefined,
    size: undefined,
    attacks: undefined,
    traits: undefined,
    actions: undefined,
    reactions: undefined,
  });
  assert.equal(created.size, 'medium');
  assert.equal(created.hpFormula, '');
  assert.equal(created.initiativeBonus, 0);
  assert.deepEqual(created.attacks, []);
});

test('the list is alphabetical and carries only the summary', async () => {
  const { master, base } = await appWithCampaign();
  await createGoblin(master, base, { name: 'Ogro', challengeRating: '2', ac: 11, hpAverage: 59 });
  await createGoblin(master, base);
  const response = await master(base);
  assert.equal(response.status, 200);
  const { statblocks } = await body<StatblockListResponse>(response);
  assert.deepEqual(
    statblocks.map(({ id: _id, ...summary }) => summary),
    [
      { name: 'Goblin', size: 'small', creatureType: 'Humanoide (goblinoide)', challengeRating: '1/4', ac: 15, hpAverage: 7 },
      { name: 'Ogro', size: 'small', creatureType: 'Humanoide (goblinoide)', challengeRating: '2', ac: 11, hpAverage: 59 },
    ],
  );
});

test('the master edits a statblock with the full body', async () => {
  const { master, base } = await appWithCampaign();
  const created = await createGoblin(master, base);
  const response = await send(master, `${base}/${created.id}`, 'PATCH', { ...GOBLIN, name: 'Goblin Chefe', hpAverage: 21 });
  assert.equal(response.status, 200);
  const { statblock } = await body<StatblockResponse>(response);
  assert.equal(statblock.name, 'Goblin Chefe');
  assert.equal(statblock.hpAverage, 21);
  assert.equal(statblock.createdAt, created.createdAt);
});

test('the master deletes a statblock', async () => {
  const { master, base } = await appWithCampaign();
  const created = await createGoblin(master, base);
  assert.equal((await master(`${base}/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await master(`${base}/${created.id}`)).status, 404);
});

test('deleting a statblock keeps the combatants copied from it', async () => {
  const { a, master, base, campaign } = await appWithCampaign();
  const created = await createGoblin(master, base);
  a.db.insert(encounters).values({ id: 'e1', campaignId: campaign.id, name: 'Emboscada' }).run();
  a.db
    .insert(combatants)
    .values({ id: 'm1', encounterId: 'e1', source: 'statblock', statblockId: created.id, name: 'Goblin', ac: 15, hpMax: 7, hpCurrent: 7 })
    .run();
  assert.equal((await master(`${base}/${created.id}`, { method: 'DELETE' })).status, 204);
  const row = a.db.select().from(combatants).get();
  assert.equal(row?.name, 'Goblin');
  assert.equal(row?.statblockId, null);
});

test('invalid statblocks are refused with a reason', async () => {
  const { master, base } = await appWithCampaign();
  const long = 'x'.repeat(STATBLOCK_LIMITS.text + 1);
  const cases: object[] = [
    { name: '   ' },
    { name: 'x'.repeat(STATBLOCK_LIMITS.name + 1) },
    { ac: 0 },
    { ac: 15.5 },
    { hpAverage: 0 },
    { hpAverage: '7' },
    { hpFormula: 'muitos' },
    { challengeRating: '1/3' },
    { size: 'enorme' },
    { initiativeBonus: 21 },
    { abilityScores: { ...GOBLIN.abilityScores, dexterity: 31 } },
    { abilityScores: { strength: 8 } },
    { attacks: [{ name: 'Mordida', bonus: 4, damage: 'forte' }] },
    { attacks: Array(STATBLOCK_LIMITS.attacks + 1).fill({ name: 'Mordida', bonus: 4, damage: '1d6' }) },
    { attacks: 'Mordida' },
    { traits: long },
    { actions: long },
    { reactions: long },
    { speed: 'x'.repeat(STATBLOCK_LIMITS.speed + 1) },
  ];
  for (const overrides of cases) {
    const response = await send(master, base, 'POST', { ...GOBLIN, ...overrides });
    assert.equal(response.status, 422, JSON.stringify(overrides));
    assert.equal(typeof (await body<{ error: string }>(response)).error, 'string');
  }
});

test('a player cannot list, read, create, edit or delete the bestiary', async () => {
  const { master, player, base } = await appWithCampaign();
  const created = await createGoblin(master, base);
  const attempts = [
    player(base),
    player(`${base}/${created.id}`),
    send(player, base, 'POST', GOBLIN),
    send(player, `${base}/${created.id}`, 'PATCH', GOBLIN),
    player(`${base}/${created.id}`, { method: 'DELETE' }),
  ];
  for (const response of await Promise.all(attempts)) assert.equal(response.status, 403);
  assert.equal((await master(`${base}/${created.id}`)).status, 200, 'nothing was deleted');
});

test('a non-member gets 404 on every bestiary route', async () => {
  const { master, outsider, base } = await appWithCampaign();
  const created = await createGoblin(master, base);
  const attempts = [
    outsider(base),
    outsider(`${base}/${created.id}`),
    send(outsider, base, 'POST', GOBLIN),
    send(outsider, `${base}/${created.id}`, 'PATCH', GOBLIN),
    outsider(`${base}/${created.id}`, { method: 'DELETE' }),
  ];
  for (const response of await Promise.all(attempts)) assert.equal(response.status, 404);
});

test('a statblock from another campaign cannot be reached by id', async () => {
  const { master, base } = await appWithCampaign();
  const other = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Maldição de Strahd' }) }),
  );
  const foreign = await createGoblin(master, `/api/campaigns/${other.id}/statblocks`);
  assert.equal((await master(`${base}/${foreign.id}`)).status, 404);
  assert.equal((await send(master, `${base}/${foreign.id}`, 'PATCH', GOBLIN)).status, 404);
  assert.equal((await master(`${base}/${foreign.id}`, { method: 'DELETE' })).status, 404);
});

test('every bestiary route requires a session', async (t) => {
  const { a, master, base } = await appWithCampaign();
  const created = await createGoblin(master, base);
  const routes: Array<[string, string]> = [
    ['GET', base],
    ['POST', base],
    ['GET', `${base}/${created.id}`],
    ['PATCH', `${base}/${created.id}`],
    ['DELETE', `${base}/${created.id}`],
  ];
  for (const [method, route] of routes) {
    await t.test(`${method} ${route}`, async () => {
      const response = await a.app.request(route, { method, headers: { 'content-type': 'application/json' } });
      assert.equal(response.status, 401);
    });
  }
});
