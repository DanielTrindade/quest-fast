import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CharacterListResponse,
  CharacterResponse,
  CreatedCampaign,
  RollResponse,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  ana: { discordId: '333', name: 'Ana Beatriz', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

/** The sheet as clients sent it before the official sheet existed. */
const LEGACY_SHEET = {
  name: 'Kaelen',
  race: 'Elfo',
  class: 'Ladino',
  level: 3,
  abilityScores: { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 8, charisma: 13 },
  hp: 24,
  ac: 15,
  skills: ['acrobatics', 'stealth', 'perception'],
  saves: ['dexterity', 'intelligence'],
  attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
  features: ['Ataque furtivo 2d6'],
  description: '',
};

/** Hazin Dan, from the official sheet in rpg_docs. */
const HAZIN = {
  name: 'Hazin Dan',
  race: 'Humano',
  class: 'Bárbaro',
  subclass: 'Berserker',
  background: 'Fazendeiro',
  alignment: 'Caótico e Neutro',
  level: 4,
  experience: 1500,
  size: 'medium',
  abilityScores: { strength: 20, dexterity: 14, constitution: 19, intelligence: 9, wisdom: 12, charisma: 10 },
  hp: 55,
  ac: 17,
  shield: true,
  speed: 9,
  hitDie: 12,
  skills: ['athletics', 'animalHandling', 'acrobatics'],
  expertise: [],
  saves: ['strength', 'constitution'],
  armorTraining: ['light', 'medium', 'shields'],
  weaponProficiencies: 'Armas Simples e Marciais',
  toolProficiencies: 'Carpinteiro',
  attacks: [{ name: 'Machado Grande', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: 'Pesada, duas mãos' }],
  features: ['Fúria', 'Defesa sem Armadura'],
  speciesTraits: ['Eficiente', 'Hábil'],
  feats: ['Atacante Selvagem', 'Robusto'],
  languages: 'Comum, Gigante e Dracônico',
  equipment: '4 Machadinhas\nKit de Aventureiro',
  attunedItems: ['Braceletes de defesa'],
  coins: { cp: 0, sp: 0, ep: 0, gp: 122, pp: 0 },
  description: '',
};

async function appWithCampaign() {
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
  return { master, player, other, outsider, campaign };
}

type Request = ReturnType<typeof asUser>;

async function create(request: Request, campaignId: string, sheet: unknown) {
  const response = await request(`/api/campaigns/${campaignId}/characters`, { method: 'POST', body: JSON.stringify(sheet) });
  return { response, character: response.status === 201 ? (await body<CharacterResponse>(response)).character : undefined };
}

function patchState(request: Request, campaignId: string, characterId: string, state: unknown) {
  return request(`/api/campaigns/${campaignId}/characters/${characterId}/state`, {
    method: 'PATCH',
    body: JSON.stringify(state),
  });
}

function roll(request: Request, campaignId: string, characterId: string, rollBody: unknown) {
  return request(`/api/campaigns/${campaignId}/characters/${characterId}/rolls`, {
    method: 'POST',
    body: JSON.stringify(rollBody),
  });
}

// --- Official sheet fields ------------------------------------------------------

test('creation stores the official sheet and starts the character rested', async () => {
  const { player, campaign } = await appWithCampaign();
  const { response, character } = await create(player, campaign.id, HAZIN);

  assert.equal(response.status, 201);
  assert.ok(character);
  assert.equal(character.subclass, 'Berserker');
  assert.equal(character.background, 'Fazendeiro');
  assert.equal(character.experience, 1500);
  assert.equal(character.hitDie, 12);
  assert.equal(character.shield, true);
  assert.deepEqual(character.armorTraining, ['light', 'medium', 'shields']);
  assert.equal(character.attacks[0]?.damageType, 'Cortante');
  assert.deepEqual(character.speciesTraits, ['Eficiente', 'Hábil']);
  assert.deepEqual(character.attunedItems, ['Braceletes de defesa']);
  assert.equal(character.coins.gp, 122);
  // Rested: full hit points, nothing spent.
  assert.equal(character.hpCurrent, 55);
  assert.equal(character.hpTemp, 0);
  assert.equal(character.hitDiceSpent, 0);
  assert.deepEqual(character.deathSaves, { successes: 0, failures: 0 });
  assert.equal(character.heroicInspiration, false);
  assert.equal(character.spellSlots.length, 9);
});

test('a sheet in the pre-official shape is accepted with the documented defaults', async () => {
  const { player, campaign } = await appWithCampaign();
  const { response, character } = await create(player, campaign.id, LEGACY_SHEET);

  assert.equal(response.status, 201);
  assert.ok(character);
  assert.equal(character.subclass, '');
  assert.equal(character.experience, 0);
  assert.equal(character.size, 'medium');
  assert.equal(character.speed, 9);
  assert.equal(character.hitDie, 8);
  assert.equal(character.spellcastingAbility, null);
  assert.deepEqual(character.expertise, []);
  assert.deepEqual(character.coins, { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  assert.deepEqual(character.attacks[0], { name: 'Adaga', bonus: 7, damage: '1d4+4', damageType: '', notes: '' });
  assert.equal(character.hpCurrent, 24);
});

test('official fields outside their bounds are refused with a message', async () => {
  const { player, campaign } = await appWithCampaign();
  const spell = { level: 1, name: 'Mísseis Mágicos', castingTime: '1 ação', range: '36 m', concentration: false, ritual: false, material: false, notes: '' };
  const invalid: Array<[string, unknown]> = [
    ['negative experience', { ...HAZIN, experience: -1 }],
    ['unknown size', { ...HAZIN, size: 'enorme' }],
    ['hit die that does not exist', { ...HAZIN, hitDie: 20 }],
    ['speed with two decimals', { ...HAZIN, speed: 7.25 }],
    ['expertise without proficiency', { ...HAZIN, expertise: ['stealth'] }],
    ['unknown armor training', { ...HAZIN, armorTraining: ['robe'] }],
    ['a fourth attuned item', { ...HAZIN, attunedItems: ['a', 'b', 'c', 'd'] }],
    ['negative coins', { ...HAZIN, coins: { ...HAZIN.coins, gp: -1 } }],
    ['slot total above the circle cap', { ...HAZIN, spellSlotTotals: [5, 0, 0, 0, 0, 0, 0, 0, 0] }],
    ['spell circle above 9', { ...HAZIN, spells: [{ ...spell, level: 10 }] }],
    ['unknown casting ability', { ...HAZIN, spellcastingAbility: 'luck' }],
    ['attack type too long', { ...HAZIN, attacks: [{ ...HAZIN.attacks[0], damageType: 'x'.repeat(31) }] }],
  ];
  for (const [label, sheet] of invalid) {
    const { response } = await create(player, campaign.id, sheet);
    assert.equal(response.status, 422, label);
    assert.ok((await body<{ error: string }>(response)).error.length > 0, label);
  }
});

// --- Session state ---------------------------------------------------------------

test('the owner changes the session state without touching the rest of the sheet', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, HAZIN);
  assert.ok(character);

  const response = await patchState(player, campaign.id, character.id, {
    hpCurrent: 28,
    hpTemp: 5,
    hitDiceSpent: 1,
    deathSaves: { successes: 1, failures: 2 },
    heroicInspiration: true,
    coins: { cp: 3, sp: 0, ep: 0, gp: 100, pp: 0 },
  });
  assert.equal(response.status, 200);
  const { character: updated } = await body<CharacterResponse>(response);
  assert.equal(updated.hpCurrent, 28);
  assert.equal(updated.hpTemp, 5);
  assert.equal(updated.hitDiceSpent, 1);
  assert.deepEqual(updated.deathSaves, { successes: 1, failures: 2 });
  assert.equal(updated.heroicInspiration, true);
  assert.equal(updated.coins.gp, 100);
  assert.equal(updated.subclass, 'Berserker');
  assert.equal(updated.hp, 55);

  const list = await body<CharacterListResponse>(await player(`/api/campaigns/${campaign.id}/characters`));
  assert.equal(list.characters[0]?.hpCurrent, 28);
  assert.equal(list.characters[0]?.hpTemp, 5);
});

test('only the owner changes the session state, not even the master', async () => {
  const { master, player, other, outsider, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, HAZIN);
  assert.ok(character);

  assert.equal((await patchState(master, campaign.id, character.id, { hpCurrent: 1 })).status, 403);
  assert.equal((await patchState(other, campaign.id, character.id, { hpCurrent: 1 })).status, 403);
  assert.equal((await patchState(outsider, campaign.id, character.id, { hpCurrent: 1 })).status, 404);

  const { character: unchanged } = await body<CharacterResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}`),
  );
  assert.equal(unchanged.hpCurrent, 55);
});

test('session state outside the sheet bounds is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, { ...HAZIN, spellcastingAbility: 'wisdom', spellSlotTotals: [2, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.ok(character);

  const invalid: Array<[string, unknown]> = [
    ['nothing to update', {}],
    ['current hit points above the maximum', { hpCurrent: 56 }],
    ['negative temporary hit points', { hpTemp: -1 }],
    ['more hit dice spent than the level', { hitDiceSpent: 5 }],
    ['a fourth death save failure', { deathSaves: { successes: 0, failures: 4 } }],
    ['more slots spent than the circle total', { spellSlotsSpent: [3, 0, 0, 0, 0, 0, 0, 0, 0] }],
    ['slots spent for a missing circle list', { spellSlotsSpent: [1] }],
    ['negative coins', { coins: { cp: 0, sp: 0, ep: 0, gp: -5, pp: 0 } }],
    ['inspiration that is not a boolean', { heroicInspiration: 'sim' }],
  ];
  for (const [label, state] of invalid) {
    assert.equal((await patchState(player, campaign.id, character.id, state)).status, 422, label);
  }

  const spent = await patchState(player, campaign.id, character.id, { spellSlotsSpent: [2, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.equal(spent.status, 200);
  assert.deepEqual((await body<CharacterResponse>(spent)).character.spellSlots[0], { total: 2, spent: 2 });
});

// --- Editing -------------------------------------------------------------------

test('an edit that lowers the maxima brings the session state within them', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, { ...HAZIN, spellcastingAbility: 'wisdom', spellSlotTotals: [4, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.ok(character);
  await patchState(player, campaign.id, character.id, { hitDiceSpent: 4, spellSlotsSpent: [3, 0, 0, 0, 0, 0, 0, 0, 0] });

  const response = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...HAZIN, hp: 40, level: 3, spellcastingAbility: 'wisdom', spellSlotTotals: [2, 0, 0, 0, 0, 0, 0, 0, 0] }),
  });
  assert.equal(response.status, 200);
  const { character: edited } = await body<CharacterResponse>(response);
  assert.equal(edited.hpCurrent, 40);
  assert.equal(edited.hitDiceSpent, 3);
  assert.deepEqual(edited.spellSlots[0], { total: 2, spent: 2 });
});

test('an edit in the pre-official shape keeps the official fields already stored', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, HAZIN);
  assert.ok(character);

  const { name: _name, ...rest } = LEGACY_SHEET;
  const response = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...rest, name: 'Hazin Dan', skills: HAZIN.skills, hp: 55 }),
  });
  assert.equal(response.status, 200);
  const { character: edited } = await body<CharacterResponse>(response);
  assert.equal(edited.subclass, 'Berserker');
  assert.equal(edited.coins.gp, 122);
  assert.deepEqual(edited.speciesTraits, ['Eficiente', 'Hábil']);
});

test('dropping a skill drops its expertise; expertise without proficiency is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, { ...LEGACY_SHEET, expertise: ['stealth'] });
  assert.ok(character);
  assert.deepEqual(character.expertise, ['stealth']);

  const url = `/api/campaigns/${campaign.id}/characters/${character.id}`;
  const dropped = await player(url, { method: 'PATCH', body: JSON.stringify({ ...LEGACY_SHEET, skills: ['acrobatics'] }) });
  assert.equal(dropped.status, 200);
  assert.deepEqual((await body<CharacterResponse>(dropped)).character.expertise, []);

  const refused = await player(url, { method: 'PATCH', body: JSON.stringify({ ...LEGACY_SHEET, skills: ['acrobatics'], expertise: ['stealth'] }) });
  assert.equal(refused.status, 422);
});

// --- Linked rolls -------------------------------------------------------------

test('initiative rolls the dexterity modifier plus the adjustment, only for the owner', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, HAZIN);
  assert.ok(character);

  const plain = await body<RollResponse>(await roll(player, campaign.id, character.id, { kind: 'initiative', mode: 'advantage' }));
  assert.equal(plain.event.payload.expression, '1d20+2');
  assert.equal(plain.event.payload.rollKind, 'initiative');
  assert.equal(plain.event.payload.dice.length, 2);

  const { character: alert } = await create(player, campaign.id, { ...HAZIN, initiativeBonus: 4 });
  assert.ok(alert);
  const adjusted = await body<RollResponse>(await roll(player, campaign.id, alert.id, { kind: 'initiative' }));
  assert.equal(adjusted.event.payload.expression, '1d20+6');

  assert.equal((await roll(master, campaign.id, character.id, { kind: 'initiative' })).status, 403);
});

test('a spell attack needs a casting ability and follows it', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character: barbarian } = await create(player, campaign.id, HAZIN);
  assert.ok(barbarian);
  assert.equal((await roll(player, campaign.id, barbarian.id, { kind: 'spellAttack' })).status, 422);

  const cleric = { ...HAZIN, abilityScores: { ...HAZIN.abilityScores, wisdom: 16 }, spellcastingAbility: 'wisdom' };
  const { character } = await create(player, campaign.id, cleric);
  assert.ok(character);
  const attack = await body<RollResponse>(await roll(player, campaign.id, character.id, { kind: 'spellAttack' }));
  assert.equal(attack.event.payload.expression, '1d20+5');
  assert.equal(attack.event.payload.rollKind, 'spellAttack');
  assert.equal(attack.event.payload.ability, 'wisdom');

  const { character: focused } = await create(player, campaign.id, { ...cleric, spellBonus: 1 });
  assert.ok(focused);
  const withFocus = await body<RollResponse>(await roll(player, campaign.id, focused.id, { kind: 'spellAttack' }));
  assert.equal(withFocus.event.payload.expression, '1d20+6');
});

test('a skill with expertise adds the proficiency bonus twice', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await create(player, campaign.id, { ...LEGACY_SHEET, expertise: ['stealth'] });
  assert.ok(character);

  // dexterity 18 (+4) plus twice the level-3 proficiency (+2) = +8
  const { event } = await body<RollResponse>(await roll(player, campaign.id, character.id, { kind: 'skill', skill: 'stealth' }));
  assert.equal(event.payload.expression, '1d20+8');
});
