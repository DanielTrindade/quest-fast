import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CharacterResponse,
  CreatedCampaign,
  FeedResponse,
  RollResponse,
  SessionEvent,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

async function appWithCampaign() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));

  const created = await master('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Ecos de Phandalin' }),
  });
  const campaign = await body<CreatedCampaign>(created);
  await player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  return { a, master, player, outsider, campaign };
}

const SHEET = {
  name: 'Kaelen',
  race: 'Elfo',
  class: 'Ladino',
  level: 3,
  abilityScores: { strength: 18, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 12, charisma: 13 },
  hp: 24,
  ac: 15,
  skills: ['acrobatics', 'stealth'],
  saves: ['dexterity', 'wisdom'],
  attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
  features: [],
  description: '',
};

async function sheetOf(request: ReturnType<typeof asUser>, campaignId: string) {
  const response = await request(`/api/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify(SHEET),
  });
  const { character } = await body<CharacterResponse>(response);
  return character;
}

async function lastFeed(request: ReturnType<typeof asUser>, campaignId: string): Promise<SessionEvent[]> {
  return (await body<FeedResponse>(await request(`/api/campaigns/${campaignId}/feed`))).events;
}

// --- Free roll ---------------------------------------------------------------

test('a free roll is computed on the server and published to the feed', async () => {
  const { player, campaign } = await appWithCampaign();
  const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20+5' }),
  });

  assert.equal(response.status, 201);
  const { event } = await body<RollResponse>(response);
  assert.equal(event.type, 'roll');
  assert.equal(event.secret, false);
  assert.equal(event.userName, 'Rafael Costa');
  assert.equal(event.payload.kind, 'roll');
  assert.equal(event.payload.expression, '1d20+5');
  assert.equal(event.payload.modifier, 5);
  assert.equal(event.payload.dice.length, 1);
  assert.equal(event.payload.total, event.payload.dice[0]!.value + 5);
  assert.equal(event.payload.rollKind, undefined);

  const feed = await lastFeed(player, campaign.id);
  assert.equal(feed.length, 1);
  assert.equal(feed[0]!.id, event.id);
});

test('a multi-die expression is rolled as a group', async () => {
  const { player, campaign } = await appWithCampaign();
  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '2d6+3' }),
    }),
  );
  assert.equal(event.payload.dice.length, 2);
  assert.equal(event.payload.total, event.payload.dice.reduce((sum, die) => sum + die.value, 0) + 3);
});

test('an invalid expression is refused and nothing reaches the feed', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const expression of ['', 'abc', 'd20', '1d0', '2d6+']) {
    const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression }),
    });
    assert.equal(response.status, 422, expression);
  }
  assert.deepEqual(await lastFeed(player, campaign.id), []);
});

test('advantage and disadvantage roll two d20 and keep the right one', async () => {
  const { player, campaign } = await appWithCampaign();
  const advantage = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '1d20+2', mode: 'advantage' }),
    }),
  );
  assert.equal(advantage.event.payload.mode, 'advantage');
  assert.equal(advantage.event.payload.dice.length, 2);
  assert.equal(advantage.event.payload.dice.filter((die) => die.discarded).length, 1);
  const kept = advantage.event.payload.dice.filter((die) => !die.discarded)[0]!;
  assert.equal(advantage.event.payload.total, kept.value + 2);

  const disadvantage = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '1d20', mode: 'disadvantage' }),
    }),
  );
  assert.equal(disadvantage.event.payload.mode, 'disadvantage');
});

test('advantage on anything but a single d20 is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const expression of ['2d6', '2d20', '1d6']) {
    const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression, mode: 'advantage' }),
    });
    assert.equal(response.status, 422, expression);
  }
});

test('an unknown roll mode is refused instead of falling back to normal', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const mode of ['adv', 'Advantage', 'disadvantage ', 5, true, {}]) {
    const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '1d20', mode }),
    });
    assert.equal(response.status, 422, JSON.stringify(mode));
  }
  assert.deepEqual(await lastFeed(player, campaign.id), []);
});

test('a normal mode may be stated explicitly', async () => {
  const { player, campaign } = await appWithCampaign();
  const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20', mode: 'normal' }),
  });
  assert.equal(response.status, 201);
  assert.equal((await body<RollResponse>(response)).event.payload.mode, 'normal');
});

test('the expression is trimmed before it is rolled and published', async () => {
  const { player, campaign } = await appWithCampaign();
  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ expression: '  1d20+5  ' }),
    }),
  );
  assert.equal(event.payload.expression, '1d20+5');
  assert.equal(event.payload.modifier, 5);
});

// --- Secret roll --------------------------------------------------------------

test('a player cannot roll secretly', async () => {
  const { player, campaign } = await appWithCampaign();
  const response = await player(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20', secret: true }),
  });
  assert.equal(response.status, 403);
});

test('the master rolls secretly and the result stays out of the player feed', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const response = await master(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20+3', secret: true }),
  });
  assert.equal(response.status, 201);
  const { event } = await body<RollResponse>(response);
  assert.equal(event.secret, true);

  const masterFeed = await lastFeed(master, campaign.id);
  assert.equal(masterFeed.some((e) => e.id === event.id), true);

  const playerFeed = await lastFeed(player, campaign.id);
  assert.equal(playerFeed.some((e) => e.id === event.id), false);
  // No trace at all: not even the secret flag or the total of the secret roll.
  assert.equal(playerFeed.some((e) => e.secret), false);
  assert.equal(playerFeed.some((e) => e.payload.total === event.payload.total), false);
});

// --- Rolls linked to a sheet ---------------------------------------------------

test('a linked attack uses the stored bonus', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'attack', attackIndex: 0 }),
    }),
  );
  assert.equal(event.payload.rollKind, 'attack');
  assert.equal(event.payload.characterId, character.id);
  assert.equal(event.payload.characterName, 'Kaelen');
  assert.equal(event.payload.attackName, 'Adaga');
  assert.equal(event.payload.expression, '1d20+7');
  assert.equal(event.payload.modifier, 7);
});

test('a linked ability check uses the current ability modifier', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'check', ability: 'strength' }),
    }),
  );
  assert.equal(event.payload.ability, 'strength');
  assert.equal(event.payload.expression, '1d20+4'); // strength 18
});

test('a saving throw adds proficiency when the sheet is proficient', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  const proficient = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'save', ability: 'wisdom' }),
    }),
  );
  // wisdom 12 -> +1, proficient at level 3 -> +2 => 1d20+3
  assert.equal(proficient.event.payload.expression, '1d20+3');

  const notProficient = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'save', ability: 'strength' }),
    }),
  );
  // strength 18 -> +4, not proficient => 1d20+4
  assert.equal(notProficient.event.payload.expression, '1d20+4');
});

test('an edited sheet changes the linked roll', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);
  await player(`/api/campaigns/${campaign.id}/characters/${character.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...SHEET, abilityScores: { ...SHEET.abilityScores, strength: 20 } }),
  });

  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'check', ability: 'strength' }),
    }),
  );
  assert.equal(event.payload.expression, '1d20+5'); // strength 20
});

test('a linked roll with advantage uses the higher of two d20', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  const { event } = await body<RollResponse>(
    await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'attack', attackIndex: 0, advantage: true }),
    }),
  );
  assert.equal(event.payload.mode, 'advantage');
  assert.equal(event.payload.dice.length, 2);
});

test('only the owner rolls from a sheet', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  const response = await master(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ kind: 'check', ability: 'strength' }),
  });
  assert.equal(response.status, 403);
});

test('a non-member cannot roll in a campaign', async () => {
  const { outsider, campaign } = await appWithCampaign();
  const response = await outsider(`/api/campaigns/${campaign.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ expression: '1d20' }),
  });
  assert.equal(response.status, 404);
});

test('an invalid linked roll is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);

  for (const bad of [
    { kind: 'attack', attackIndex: 9 },
    { kind: 'attack' },
    { kind: 'check', ability: 'inexistent' },
    { kind: 'nope' },
  ]) {
    const response = await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
      method: 'POST',
      body: JSON.stringify(bad),
    });
    assert.equal(response.status, 422, JSON.stringify(bad));
  }
});

// --- Feed ----------------------------------------------------------------------

test('the feed returns events oldest first', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const expression of ['1d20', '1d20+1', '1d20+2']) {
    await player(`/api/campaigns/${campaign.id}/rolls`, { method: 'POST', body: JSON.stringify({ expression }) });
  }
  const feed = await lastFeed(player, campaign.id);
  assert.equal(feed.length, 3);
  assert.deepEqual(
    feed.map((event) => event.payload.expression),
    ['1d20', '1d20+1', '1d20+2'],
  );
});

test('a linked roll is published to the feed identifying the character', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const character = await sheetOf(player, campaign.id);
  await player(`/api/campaigns/${campaign.id}/characters/${character.id}/rolls`, {
    method: 'POST',
    body: JSON.stringify({ kind: 'attack', attackIndex: 0 }),
  });

  const feed = await lastFeed(master, campaign.id);
  assert.equal(feed.length, 1);
  assert.equal(feed[0]!.payload.characterName, 'Kaelen');
  assert.equal(feed[0]!.payload.rollKind, 'attack');
});