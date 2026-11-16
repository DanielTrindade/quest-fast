import test from 'node:test';
import assert from 'node:assert/strict';
import type { CastSpellResponse, CharacterResponse, CreatedCampaign, FeedResponse, SpellCastPayload } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  ana: { discordId: '333', name: 'Ana Beatriz', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

const spell = { castingTime: '1 ação', range: '45 m', material: false, notes: '' };
const SPELLS = [
  { ...spell, level: 0, name: 'Raio de Fogo', concentration: false, ritual: false },
  { ...spell, level: 3, name: 'Bola de Fogo', concentration: false, ritual: false },
  { ...spell, level: 2, name: 'Imobilizar Pessoa', concentration: true, ritual: false },
  { ...spell, level: 1, name: 'Detectar Magia', concentration: true, ritual: true },
];

/** Lyra, a wizard with 4/3/2 slots of the 1st to 3rd circle. */
const LYRA = {
  name: 'Lyra Ventoclaro',
  race: 'Elfa',
  class: 'Maga',
  level: 5,
  abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 12, charisma: 10 },
  hp: 28,
  ac: 12,
  skills: [],
  saves: ['intelligence', 'wisdom'],
  attacks: [],
  features: [],
  description: '',
  spellcastingAbility: 'intelligence',
  spellSlotTotals: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  spells: SPELLS,
};

async function table() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const other = asUser(a, await signIn(a, 'ana'));
  const outsider = asUser(a, await signIn(a, 'outsider'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos de Phandalin' }) }),
  );
  for (const request of [player, other]) {
    await request('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  }
  const created = await player(`/api/campaigns/${campaign.id}/characters`, { method: 'POST', body: JSON.stringify(LYRA) });
  assert.equal(created.status, 201, await created.clone().text());
  const lyra = (await body<CharacterResponse>(created)).character;
  const cast = (request: typeof master, payload: unknown) =>
    request(`/api/campaigns/${campaign.id}/characters/${lyra.id}/cast`, { method: 'POST', body: JSON.stringify(payload) });
  const feed = async (request: typeof master) =>
    (await body<FeedResponse>(await request(`/api/campaigns/${campaign.id}/feed`))).events.filter((event) => event.type === 'spell.cast');
  return { master, player, other, outsider, campaign, lyra, cast, feed };
}

test('casting spends the chosen slot, takes up concentration and tells the whole table', async () => {
  const { player, other, lyra, cast, feed } = await table();

  const fireball = await cast(player, { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 });
  assert.equal(fireball.status, 201, await fireball.clone().text());
  const answer = await body<CastSpellResponse>(fireball);
  assert.deepEqual(answer.character.spellSlots.slice(0, 3), [{ total: 4, spent: 0 }, { total: 3, spent: 0 }, { total: 2, spent: 1 }]);
  assert.equal(answer.character.concentrating, false);
  assert.deepEqual(answer.event.payload, {
    kind: 'spell.cast', characterId: lyra.id, characterName: 'Lyra Ventoclaro', spellName: 'Bola de Fogo', spellLevel: 3, circle: 3, concentration: false,
  } satisfies SpellCastPayload);

  const hold = await body<CastSpellResponse>(await cast(player, { spellIndex: 2, spellName: 'Imobilizar Pessoa', circle: 3 }));
  assert.equal(hold.character.spellSlots[2]!.spent, 2);
  assert.equal(hold.character.concentrating, true);

  const ritual = await body<CastSpellResponse>(await cast(player, { spellIndex: 3, spellName: 'Detectar Magia', ritual: true }));
  assert.equal(ritual.event.payload.circle, null);
  assert.deepEqual(ritual.character.spellSlots, hold.character.spellSlots);

  // Another player reads every cast in the feed.
  assert.deepEqual((await feed(other)).map((event) => (event.payload as SpellCastPayload).spellName), ['Bola de Fogo', 'Imobilizar Pessoa', 'Detectar Magia']);
});

test('a circle below the spell, a spent circle, a cantrip or a stale list are refused, spending nothing', async () => {
  const { player, cast, feed } = await table();
  const refused: Array<[string, unknown]> = [
    ['circle below the spell', { spellIndex: 1, spellName: 'Bola de Fogo', circle: 2 }],
    ['circle without slots', { spellIndex: 1, spellName: 'Bola de Fogo', circle: 4 }],
    ['cantrip', { spellIndex: 0, spellName: 'Raio de Fogo', circle: 1 }],
    ['ritual of a spell that is not one', { spellIndex: 1, spellName: 'Bola de Fogo', ritual: true }],
    ['no circle nor ritual', { spellIndex: 1, spellName: 'Bola de Fogo' }],
    ['missing spell', { spellIndex: 9, spellName: 'Desejo', circle: 3 }],
    ['list edited meanwhile', { spellIndex: 1, spellName: 'Relâmpago', circle: 3 }],
  ];
  for (const [label, payload] of refused) {
    assert.equal((await cast(player, payload)).status, 422, label);
  }
  await cast(player, { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 });
  await cast(player, { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 });
  assert.equal((await cast(player, { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 })).status, 422);
  assert.equal((await feed(player)).length, 2);
});

test('only the owner casts from the sheet; who is not a member does not find it', async () => {
  const { master, other, outsider, cast, feed } = await table();
  const fireball = { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 };
  assert.equal((await cast(other, fireball)).status, 403);
  assert.equal((await cast(master, fireball)).status, 403);
  assert.equal((await cast(outsider, fireball)).status, 404);
  assert.equal((await feed(master)).length, 0);
});

test('a character at 0 hit points cannot cast', async () => {
  const { player, campaign, lyra, cast } = await table();
  const down = await player(`/api/campaigns/${campaign.id}/characters/${lyra.id}/state`, { method: 'PATCH', body: JSON.stringify({ hpCurrent: 0 }) });
  assert.equal(down.status, 200);
  assert.equal((await cast(player, { spellIndex: 1, spellName: 'Bola de Fogo', circle: 3 })).status, 422);
});
