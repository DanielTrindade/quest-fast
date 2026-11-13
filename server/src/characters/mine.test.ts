import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CharacterListResponse,
  CharacterResponse,
  CreatedCampaign,
  MyCharacterListResponse,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  ana: { discordId: '333', name: 'Ana Beatriz', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

const SHEET = {
  race: 'Elfo',
  class: 'Ladino',
  level: 3,
  abilityScores: { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 8, charisma: 13 },
  hp: 24,
  ac: 15,
  skills: ['stealth'],
  saves: ['dexterity'],
  attacks: [],
  features: [],
};

type Request = ReturnType<typeof asUser>;

async function campaignOf(master: Request, name: string, players: Request[]) {
  const created = await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name }) });
  const campaign = await body<CreatedCampaign>(created);
  for (const request of players) {
    await request('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  }
  return campaign;
}

async function setup() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const other = asUser(a, await signIn(a, 'ana'));
  const outsider = asUser(a, await signIn(a, 'outsider'));
  const phandalin = await campaignOf(master, 'Ecos de Phandalin', [player, other]);
  const quinta = await campaignOf(master, 'Mesa de quinta', [player]);
  return { a, master, player, other, outsider, phandalin, quinta };
}

async function create(request: Request, campaignId: string, name: string) {
  const response = await request(`/api/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify({ ...SHEET, name }),
  });
  assert.equal(response.status, 201);
  return (await body<CharacterResponse>(response)).character;
}

function activate(request: Request, campaignId: string, characterId: string) {
  return request(`/api/campaigns/${campaignId}/characters/${characterId}/activate`, { method: 'POST' });
}

async function mine(request: Request) {
  const response = await request('/api/me/characters');
  assert.equal(response.status, 200);
  return (await body<MyCharacterListResponse>(response)).characters;
}

async function activeIn(request: Request, campaignId: string) {
  const response = await request(`/api/campaigns/${campaignId}/characters`);
  const { characters } = await body<CharacterListResponse>(response);
  return characters.filter((character) => character.active).map((character) => character.name).sort();
}

test('the account gallery lists only my characters, from every campaign, with the campaign name', async () => {
  const { player, other, master, phandalin, quinta } = await setup();
  await create(player, phandalin.id, 'Kaelen');
  await create(player, quinta.id, 'Elara');
  await create(other, phandalin.id, 'Lyra');
  await create(master, phandalin.id, 'Capitã Brisa');

  const characters = await mine(player);
  assert.deepEqual(
    characters.map((character) => [character.name, character.campaignName]).sort(),
    [['Elara', 'Mesa de quinta'], ['Kaelen', 'Ecos de Phandalin']],
  );
  assert.ok(characters.every((character) => character.ownerName === 'Rafael Costa'));
  assert.deepEqual((await mine(other)).map((character) => character.name), ['Lyra']);
});

test('a player who belongs to no campaign has an empty gallery', async () => {
  const { outsider } = await setup();
  assert.deepEqual(await mine(outsider), []);
});

test('the account gallery requires a session', async () => {
  const { a } = await setup();
  const response = await a.app.request('/api/me/characters');
  assert.equal(response.status, 401);
});

test('a character of a campaign the player left leaves the gallery', async () => {
  const { player, phandalin, quinta } = await setup();
  await create(player, phandalin.id, 'Kaelen');
  await create(player, quinta.id, 'Elara');

  assert.equal((await player(`/api/campaigns/${quinta.id}/members/me`, { method: 'DELETE' })).status, 204);

  assert.deepEqual((await mine(player)).map((character) => character.name), ['Kaelen']);
});

test('the first character of a player in a campaign starts active and the next ones wait', async () => {
  const { player, other, phandalin, quinta } = await setup();
  const kaelen = await create(player, phandalin.id, 'Kaelen');
  const brom = await create(player, phandalin.id, 'Brom');
  const elara = await create(player, quinta.id, 'Elara');
  const lyra = await create(other, phandalin.id, 'Lyra');

  assert.equal(kaelen.active, true);
  assert.equal(brom.active, false);
  assert.equal(elara.active, true);
  assert.equal(lyra.active, true);
  assert.deepEqual(await activeIn(player, phandalin.id), ['Kaelen', 'Lyra']);
});

test('activating a character puts the previous one of the same campaign aside', async () => {
  const { player, phandalin, quinta } = await setup();
  await create(player, phandalin.id, 'Kaelen');
  const brom = await create(player, phandalin.id, 'Brom');
  await create(player, quinta.id, 'Elara');

  const response = await activate(player, phandalin.id, brom.id);
  assert.equal(response.status, 200);
  assert.equal((await body<CharacterResponse>(response)).character.active, true);

  const active = (await mine(player)).filter((character) => character.active).map((character) => character.name).sort();
  assert.deepEqual(active, ['Brom', 'Elara']);
});

test('activating the character already active changes nothing', async () => {
  const { player, phandalin } = await setup();
  const kaelen = await create(player, phandalin.id, 'Kaelen');

  assert.equal((await activate(player, phandalin.id, kaelen.id)).status, 200);
  assert.deepEqual(await activeIn(player, phandalin.id), ['Kaelen']);
});

test('only the owner activates a character', async (t) => {
  const { master, other, outsider, player, phandalin } = await setup();
  await create(player, phandalin.id, 'Kaelen');
  const brom = await create(player, phandalin.id, 'Brom');

  await t.test('another player cannot', async () => {
    assert.equal((await activate(other, phandalin.id, brom.id)).status, 403);
  });
  await t.test('the master cannot', async () => {
    assert.equal((await activate(master, phandalin.id, brom.id)).status, 403);
  });
  await t.test('someone outside the campaign does not even find it', async () => {
    assert.equal((await activate(outsider, phandalin.id, brom.id)).status, 404);
  });
  await t.test('a character of another campaign is not found through this one', async () => {
    const elsewhere = await campaignOf(master, 'Outra mesa', [player]);
    assert.equal((await activate(player, elsewhere.id, brom.id)).status, 404);
  });
  assert.deepEqual(await activeIn(player, phandalin.id), ['Kaelen']);
});

test('activations at the same time still leave a single active character', async () => {
  const { player, phandalin } = await setup();
  const created = [];
  for (const name of ['Kaelen', 'Brom', 'Tobias', 'Ilse']) created.push(await create(player, phandalin.id, name));

  const responses = await Promise.all(created.map((character) => activate(player, phandalin.id, character.id)));
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal((await activeIn(player, phandalin.id)).length, 1);
});

test('deleting the active character does not pick another one for the player', async () => {
  const { player, phandalin } = await setup();
  const kaelen = await create(player, phandalin.id, 'Kaelen');
  await create(player, phandalin.id, 'Brom');

  const removed = await player(`/api/campaigns/${phandalin.id}/characters/${kaelen.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
  assert.deepEqual(await activeIn(player, phandalin.id), []);

  const tobias = await create(player, phandalin.id, 'Tobias');
  assert.equal(tobias.active, true);
});
