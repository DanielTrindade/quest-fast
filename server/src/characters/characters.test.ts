import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CharacterListResponse,
  CharacterResponse,
  CreatedCampaign,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  ana: { discordId: '333', name: 'Ana Beatriz', avatarUrl: null },
  outsider: { discordId: '444', name: 'Pedro Alves', avatarUrl: null },
};

const SHEET = {
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
  description: 'Um espião a serviço da guilda.',
};

async function appWithCampaign() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const other = asUser(a, await signIn(a, 'ana'));
  const outsider = asUser(a, await signIn(a, 'outsider'));

  const created = await master('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Ecos de Phandalin' }),
  });
  const campaign = await body<CreatedCampaign>(created);
  for (const request of [player, other]) {
    await request('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  }
  return { a, master, player, other, outsider, campaign };
}

function postSheet(request: ReturnType<typeof asUser>, campaignId: string, sheet: unknown) {
  return request(`/api/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify(sheet),
  });
}

async function createSheet(request: ReturnType<typeof asUser>, campaignId: string) {
  const response = await postSheet(request, campaignId, SHEET);
  const { character } = await body<CharacterResponse>(response);
  return { response, character };
}

/** A sheet with every ability score set to the same value. */
function withScores(value: number) {
  return {
    strength: value,
    dexterity: value,
    constitution: value,
    intelligence: value,
    wisdom: value,
    charisma: value,
  };
}

test('a member creates a character and becomes its owner', async () => {
  const { player, campaign } = await appWithCampaign();
  const { response, character } = await createSheet(player, campaign.id);

  assert.equal(response.status, 201);
  assert.equal(character.name, 'Kaelen');
  assert.equal(character.campaignId, campaign.id);
  assert.equal(character.ownerName, 'Rafael Costa');
  assert.equal(character.abilityScores.dexterity, 18);
});

test('creation refuses malformed sheets and explains why', async () => {
  const { player, campaign } = await appWithCampaign();

  const invalidBodies: Array<[string, unknown]> = [
    ['empty body', {}],
    ['missing race and class', { name: 'X' }],
    ['level above the ceiling', { ...SHEET, level: 21 }],
    ['ability score above the ceiling', { ...SHEET, abilityScores: { ...SHEET.abilityScores, strength: 31 } }],
    ['attack damage that is not dice', { ...SHEET, attacks: [{ name: 'Adaga', bonus: 7, damage: 'não é dado' }] }],
    ['hp below the floor', { ...SHEET, hp: 0 }],
    ['unknown skill alongside valid ones', { ...SHEET, skills: ['acrobatics', 'acrobatics', 'inexistente'] }],
  ];

  for (const [label, sheet] of invalidBodies) {
    const response = await postSheet(player, campaign.id, sheet);
    assert.equal(response.status, 422, label);
    const { error } = await body<{ error: string }>(response);
    assert.ok(error.length > 0, `${label} should carry an error message`);
  }
});

test('a sheet sitting exactly on every boundary is accepted', async () => {
  const { player, campaign } = await appWithCampaign();

  const atFloor = {
    ...SHEET,
    level: 1,
    hp: 1,
    ac: 0,
    abilityScores: withScores(1),
    name: 'x'.repeat(80),
    class: 'y'.repeat(60),
  };
  const atCeiling = { ...SHEET, level: 20, hp: 999, ac: 40, abilityScores: withScores(30) };

  for (const sheet of [atFloor, atCeiling]) {
    assert.equal((await postSheet(player, campaign.id, sheet)).status, 201, JSON.stringify(sheet));
  }
});

test('values one step outside each boundary are refused', async () => {
  const { player, campaign } = await appWithCampaign();

  const outOfRange: Array<[string, unknown]> = [
    ['level 0', { ...SHEET, level: 0 }],
    ['level 21', { ...SHEET, level: 21 }],
    ['hp 0', { ...SHEET, hp: 0 }],
    ['hp 1000', { ...SHEET, hp: 1000 }],
    ['ac -1', { ...SHEET, ac: -1 }],
    ['ac 41', { ...SHEET, ac: 41 }],
    ['ability 0', { ...SHEET, abilityScores: { ...withScores(10), strength: 0 } }],
    ['ability 31', { ...SHEET, abilityScores: { ...withScores(10), strength: 31 } }],
  ];

  for (const [label, sheet] of outOfRange) {
    assert.equal((await postSheet(player, campaign.id, sheet)).status, 422, label);
  }
});

test('non-integer values are refused instead of silently coerced', async () => {
  const { player, campaign } = await appWithCampaign();

  const nonIntegers: Array<[string, unknown]> = [
    ['fractional level', { ...SHEET, level: 3.5 }],
    ['level as string', { ...SHEET, level: '3' }],
    ['fractional hp', { ...SHEET, hp: 24.5 }],
    ['hp as string', { ...SHEET, hp: '24' }],
    ['boolean ac', { ...SHEET, ac: true }],
    ['fractional ability', { ...SHEET, abilityScores: { ...withScores(10), dexterity: 15.5 } }],
  ];

  for (const [label, sheet] of nonIntegers) {
    assert.equal((await postSheet(player, campaign.id, sheet)).status, 422, label);
  }
});

test('name, race and class cannot be missing or blank', async () => {
  const { player, campaign } = await appWithCampaign();

  const invalidIdentities: Array<[string, unknown]> = [
    ['missing name', { ...SHEET, name: undefined }],
    ['blank name', { ...SHEET, name: '   ' }],
    ['numeric name', { ...SHEET, name: 7 }],
    ['name over the limit', { ...SHEET, name: 'x'.repeat(81) }],
    ['missing race', { ...SHEET, race: undefined }],
    ['blank race', { ...SHEET, race: '  ' }],
    ['race over the limit', { ...SHEET, race: 'x'.repeat(61) }],
    ['blank class', { ...SHEET, class: ' ' }],
    ['class over the limit', { ...SHEET, class: 'x'.repeat(61) }],
  ];

  for (const [label, sheet] of invalidIdentities) {
    assert.equal((await postSheet(player, campaign.id, sheet)).status, 422, label);
  }
});

test('duplicate skills and saves are stored once', async () => {
  const { player, campaign } = await appWithCampaign();

  const response = await postSheet(player, campaign.id, {
    ...SHEET,
    skills: ['stealth', 'stealth', 'acrobatics'],
    saves: ['dexterity', 'dexterity', 'wisdom'],
  });
  assert.equal(response.status, 201);
  const { character } = await body<CharacterResponse>(response);
  assert.deepEqual(character.skills, ['stealth', 'acrobatics']);
  assert.deepEqual(character.saves, ['dexterity', 'wisdom']);
});

test('duplicate features are stored once', async () => {
  const { player, campaign } = await appWithCampaign();

  const response = await postSheet(player, campaign.id, {
    ...SHEET,
    features: ['Ataque furtivo 2d6', 'Ataque furtivo 2d6', 'Visão no escuro'],
  });
  assert.equal(response.status, 201);
  const { character } = await body<CharacterResponse>(response);
  assert.deepEqual(character.features, ['Ataque furtivo 2d6', 'Visão no escuro']);
});

test('the attack list is bounded and every attack is validated', async () => {
  const { player, campaign } = await appWithCampaign();
  const attack = { name: 'Adaga', bonus: 7, damage: '1d4+4' };

  assert.equal((await postSheet(player, campaign.id, { ...SHEET, attacks: Array(11).fill(attack) })).status, 422);
  assert.equal((await postSheet(player, campaign.id, { ...SHEET, attacks: Array(10).fill(attack) })).status, 201);

  const invalidAttacks: Array<[string, unknown]> = [
    ['missing name', { ...attack, name: undefined }],
    ['blank name', { ...attack, name: '  ' }],
    ['bonus above the range', { ...attack, bonus: 21 }],
    ['bonus below the range', { ...attack, bonus: -21 }],
    ['fractional bonus', { ...attack, bonus: 2.5 }],
    ['damage that is not dice', { ...attack, damage: 'dano' }],
    ['missing damage', { ...attack, damage: undefined }],
  ];
  for (const [label, bad] of invalidAttacks) {
    assert.equal((await postSheet(player, campaign.id, { ...SHEET, attacks: [bad] })).status, 422, label);
  }
});

test('description and each feature respect their length limits', async () => {
  const { player, campaign } = await appWithCampaign();

  assert.equal((await postSheet(player, campaign.id, { ...SHEET, description: 'd'.repeat(2000) })).status, 201);
  assert.equal((await postSheet(player, campaign.id, { ...SHEET, description: 'd'.repeat(2001) })).status, 422);
  assert.equal((await postSheet(player, campaign.id, { ...SHEET, features: ['f'.repeat(200)] })).status, 201);
  assert.equal((await postSheet(player, campaign.id, { ...SHEET, features: ['f'.repeat(201)] })).status, 422);
  assert.equal((await postSheet(player, campaign.id, { ...SHEET, features: [42] })).status, 422);
});

test('an avatar that does not exist in the campaign is refused', async () => {
  const { player, campaign } = await appWithCampaign();

  const created = await postSheet(player, campaign.id, { ...SHEET, avatarAssetId: 'does-not-exist' });
  assert.equal(created.status, 422);

  const { character } = await createSheet(player, campaign.id);
  const patched = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...SHEET, avatarAssetId: 'does-not-exist' }),
  });
  assert.equal(patched.status, 422);
});

test('a non-member cannot create a character', async () => {
  const { outsider, campaign } = await appWithCampaign();
  const response = await outsider(`/api/campaigns/${campaign.id}/characters`, {
    method: 'POST',
    body: JSON.stringify(SHEET),
  });
  assert.equal(response.status, 404);
});

test('every campaign member can list and read the sheets', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  for (const request of [master, player]) {
    const list = await body<CharacterListResponse>(await request(`/api/campaigns/${campaign.id}/characters`));
    assert.equal(list.characters.length, 1);
    assert.equal(list.characters[0]?.name, 'Kaelen');
    assert.equal(list.characters[0]?.ownerName, 'Rafael Costa');
    assert.equal(list.characters[0]?.hp, SHEET.hp);
    assert.equal(list.characters[0]?.ac, SHEET.ac);

    const detail = await body<CharacterResponse>(
      await request(`/api/campaigns/${campaign.id}/characters/${character.id}`),
    );
    assert.equal(detail.character.level, 3);
  }
});

test('a non-member does not see the sheets', async () => {
  const { player, outsider, campaign } = await appWithCampaign();
  await createSheet(player, campaign.id);

  assert.equal((await outsider(`/api/campaigns/${campaign.id}/characters`)).status, 404);
});

test('the owner edits the sheet and the new values take effect', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  const updatedBody = { ...SHEET, level: 4, abilityScores: { ...SHEET.abilityScores, dexterity: 20 } };
  const response = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify(updatedBody),
  });
  assert.equal(response.status, 200);
  const { character: updated } = await body<CharacterResponse>(response);
  assert.equal(updated.level, 4);
  assert.equal(updated.abilityScores.dexterity, 20);
});

test('another member, including the master, cannot edit a sheet', async () => {
  const { master, player, other, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  for (const request of [master, other]) {
    const response = await request(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...SHEET, name: 'Hackeado' }),
    });
    assert.equal(response.status, 403);
  }

  const { character: still } = await body<CharacterResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}`),
  );
  assert.equal(still.name, 'Kaelen');
});

test('a non-member cannot edit a sheet', async () => {
  const { player, outsider, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  const response = await outsider(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...SHEET, name: 'Hackeado' }),
  });
  assert.equal(response.status, 404);
});

test('the owner deletes their character', async () => {
  const { player, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  const response = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  const list = await body<CharacterListResponse>(await player(`/api/campaigns/${campaign.id}/characters`));
  assert.deepEqual(list.characters, []);
});

test('the master deletes any character; a player deletes only their own', async () => {
  const { master, player, other, campaign } = await appWithCampaign();
  const rafaelSheet = await createSheet(player, campaign.id);
  const anaSheet = await createSheet(other, campaign.id);

  // A player deleting a colleague's sheet is refused.
  const refused = await player(`/api/campaigns/${campaign.id}/characters/${anaSheet.character.id}`, {
    method: 'DELETE',
  });
  assert.equal(refused.status, 403);

  // The master can delete any of them.
  const masterDelete = await master(`/api/campaigns/${campaign.id}/characters/${rafaelSheet.character.id}`, {
    method: 'DELETE',
  });
  assert.equal(masterDelete.status, 204);
  const list = await body<CharacterListResponse>(await master(`/api/campaigns/${campaign.id}/characters`));
  assert.equal(list.characters.length, 1);
});

test('a character from another campaign cannot be touched by id', async () => {
  const { master, campaign, player } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);
  const otherCampaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Outra mesa' }) }),
  );

  const response = await master(`/api/campaigns/${otherCampaign.id}/characters/${character.id}`);
  assert.equal(response.status, 404);
});

test('the avatar must be an asset of the same campaign', async () => {
  const { player, campaign, a, master } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);

  const form = new FormData();
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }));
  const uploaded = await player(`/api/campaigns/${campaign.id}/assets`, { method: 'POST', body: form });
  assert.equal(uploaded.status, 201);
  const { asset } = await body<{ asset: { id: string; url: string } }>(uploaded);

  const withAvatar = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...SHEET, avatarAssetId: asset.id }),
  });
  assert.equal(withAvatar.status, 200);
  const { character: updated } = await body<CharacterResponse>(withAvatar);
  assert.equal(updated.avatarUrl, asset.url);

  // An asset from another campaign is refused.
  const otherCampaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Outra mesa' }) }),
  );
  const otherUpload = await master(`/api/campaigns/${otherCampaign.id}/assets`, { method: 'POST', body: form });
  const { asset: foreign } = await body<{ asset: { id: string; url: string } }>(otherUpload);
  const refused = await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...SHEET, avatarAssetId: foreign.id }),
  });
  assert.equal(refused.status, 422);
  void a;
});

test('every character route requires a session', async (t) => {
  const { a, player, campaign } = await appWithCampaign();
  const { character } = await createSheet(player, campaign.id);
  const routes: Array<[string, string]> = [
    ['GET', `/api/campaigns/${campaign.id}/characters`],
    ['POST', `/api/campaigns/${campaign.id}/characters`],
    ['GET', `/api/campaigns/${campaign.id}/characters/${character.id}`],
    ['PATCH', `/api/campaigns/${campaign.id}/characters/${character.id}`],
    ['DELETE', `/api/campaigns/${campaign.id}/characters/${character.id}`],
    ['POST', `/api/campaigns/${campaign.id}/characters/${character.id}/rolls`],
  ];
  for (const [method, route] of routes) {
    await t.test(`${method} ${route}`, async () => {
      const response = await a.app.request(route, { method, headers: { 'content-type': 'application/json' } });
      assert.equal(response.status, 401);
    });
  }
});