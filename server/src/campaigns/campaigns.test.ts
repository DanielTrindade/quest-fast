import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CampaignDetail,
  CampaignMember,
  CampaignsResponse,
  CreatedCampaign,
  MembersResponse,
} from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

/** A master with one campaign, a player inside, and someone outside. */
async function appWithCampaign() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));

  const created = await master('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Ecos de Phandalin', description: 'A mesa de terça.' }),
  });
  const campaign = await body<CreatedCampaign>(created);
  await player('/api/campaigns/join', {
    method: 'POST',
    body: JSON.stringify({ code: campaign.inviteCode }),
  });

  return { a, master, player, outsider, campaign };
}

async function memberOf(
  request: ReturnType<typeof asUser>,
  campaignId: string,
  name: string,
): Promise<CampaignMember> {
  const { members } = await body<MembersResponse>(await request(`/api/campaigns/${campaignId}/members`));
  const target = members.find((member) => member.name === name);
  if (!target) throw new Error(`member ${name} not found`);
  return target;
}

test('creating a campaign makes the creator master and returns the code', async () => {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const response = await master('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Ecos de Phandalin', description: 'A mesa de terça.' }),
  });

  assert.equal(response.status, 201);
  const campaign = await body<CreatedCampaign>(response);
  assert.equal(campaign.role, 'master');
  assert.match(campaign.inviteCode, /^[A-Z2-9]{6}$/);
});

test('a campaign requires a name', async () => {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  for (const invalid of [{}, { name: '   ' }, { name: 'x'.repeat(81) }]) {
    const response = await master('/api/campaigns', { method: 'POST', body: JSON.stringify(invalid) });
    assert.equal(response.status, 422, JSON.stringify(invalid));
  }
});

test('the listing brings only the campaigns the user belongs to', async () => {
  const { master, player, outsider } = await appWithCampaign();

  assert.equal((await body<CampaignsResponse>(await master('/api/campaigns'))).campaigns.length, 1);
  assert.equal((await body<CampaignsResponse>(await player('/api/campaigns'))).campaigns.length, 1);
  assert.deepEqual((await body<CampaignsResponse>(await outsider('/api/campaigns'))).campaigns, []);
});

test('joining with a valid code creates a player membership', async () => {
  const { player, campaign } = await appWithCampaign();
  const detail = await body<CampaignDetail>(await player(`/api/campaigns/${campaign.id}`));
  assert.equal(detail.role, 'player');
});

test('an invalid code does not change membership', async () => {
  const { outsider } = await appWithCampaign();
  const response = await outsider('/api/campaigns/join', {
    method: 'POST',
    body: JSON.stringify({ code: 'ZZZZZZ' }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual((await body<CampaignsResponse>(await outsider('/api/campaigns'))).campaigns, []);
});

test('a malformed code is refused before the query', async () => {
  const { outsider } = await appWithCampaign();
  for (const code of ['', 'ABC', 'MES@42', 'MESA4O']) {
    const response = await outsider('/api/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    assert.equal(response.status, 422, code);
  }
});

test('joining again with the same code does not duplicate membership', async () => {
  const { player, campaign } = await appWithCampaign();
  const repeated = await player('/api/campaigns/join', {
    method: 'POST',
    body: JSON.stringify({ code: campaign.inviteCode }),
  });

  assert.equal(repeated.status, 200);
  const { members } = await body<MembersResponse>(await player(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members.length, 2);
});

test('the invite code is not exposed to a player', async () => {
  const { master, player, campaign } = await appWithCampaign();

  const masterView = await body<CampaignDetail>(await master(`/api/campaigns/${campaign.id}`));
  assert.ok(masterView.inviteCode);

  const playerView = await body<CampaignDetail>(await player(`/api/campaigns/${campaign.id}`));
  assert.equal('inviteCode' in playerView, false);
  assert.equal(JSON.stringify(playerView).includes(campaign.inviteCode), false);
});

test('the member list brings name, role and join date', async () => {
  const { player, campaign } = await appWithCampaign();
  const { members } = await body<MembersResponse>(await player(`/api/campaigns/${campaign.id}/members`));

  assert.equal(members.length, 2);
  assert.deepEqual(
    members.map((m) => [m.name, m.role]).sort(),
    [
      ['Lia Martins', 'master'],
      ['Rafael Costa', 'player'],
    ].sort(),
  );
  // The date travels as ISO 8601; formatting for the table is the client's job.
  assert.ok(
    members.every((m) => !Number.isNaN(Date.parse(m.joinedAt))),
    `invalid dates: ${members.map((m) => m.joinedAt).join(', ')}`,
  );
});

test('the member list starts with the master, even for joins in the same second', async () => {
  const a = createTestApp({ ...PROFILES, fourth: { discordId: '444', name: 'Pedro Alves', avatarUrl: null } });
  const master = asUser(a, await signIn(a, 'lia'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos' }) }),
  );

  for (const code of ['rafael', 'outsider', 'fourth']) {
    const player = asUser(a, await signIn(a, code));
    await player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  }

  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members[0].role, 'master');
  assert.deepEqual(
    members.slice(1).map((member) => member.role),
    ['player', 'player', 'player'],
  );
});

test('the member order is stable across calls', async () => {
  const { master, campaign } = await appWithCampaign();
  const first = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  const second = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.deepEqual(
    first.members.map((member) => member.id),
    second.members.map((member) => member.id),
  );
});

// --- RBAC: what each role must NOT be able to do -------------------------

test('a non-member reads neither the campaign nor the members', async () => {
  const { outsider, campaign } = await appWithCampaign();

  for (const route of [`/api/campaigns/${campaign.id}`, `/api/campaigns/${campaign.id}/members`]) {
    const response = await outsider(route);
    // 404, not 403: confirming the campaign exists is already a leak.
    assert.equal(response.status, 404, route);
    const text = JSON.stringify(await response.json());
    assert.equal(text.includes('Ecos de Phandalin'), false, route);
    assert.equal(text.includes(campaign.inviteCode), false, route);
  }
});

test('a non-member cannot remove a member', async () => {
  const { master, outsider, campaign } = await appWithCampaign();
  const target = await memberOf(master, campaign.id, 'Rafael Costa');

  const response = await outsider(`/api/campaigns/${campaign.id}/members/${target.id}`, { method: 'DELETE' });
  assert.equal(response.status, 404);
  assert.equal(
    (await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`))).members.length,
    2,
  );
});

test('a player cannot remove another member', async () => {
  const a = createTestApp({ ...PROFILES, fourth: { discordId: '444', name: 'Pedro Alves', avatarUrl: null } });
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const other = asUser(a, await signIn(a, 'fourth'));

  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Baróvia' }) }),
  );
  for (const request of [player, other]) {
    await request('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  }

  const target = await memberOf(master, campaign.id, 'Pedro Alves');
  const response = await player(`/api/campaigns/${campaign.id}/members/${target.id}`, { method: 'DELETE' });

  assert.equal(response.status, 403);
  assert.equal(
    (await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`))).members.length,
    3,
  );
});

test('the master removes a player, who loses access to the campaign', async () => {
  const { master, player, campaign } = await appWithCampaign();
  const target = await memberOf(master, campaign.id, 'Rafael Costa');

  const response = await master(`/api/campaigns/${campaign.id}/members/${target.id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal((await player(`/api/campaigns/${campaign.id}`)).status, 404);
});

test('the master cannot be removed', async () => {
  const { master, campaign } = await appWithCampaign();
  const target = await memberOf(master, campaign.id, 'Lia Martins');

  const response = await master(`/api/campaigns/${campaign.id}/members/${target.id}`, { method: 'DELETE' });
  assert.equal(response.status, 409);
});

test('a player leaves the campaign and loses access', async () => {
  const { player, campaign } = await appWithCampaign();

  assert.equal((await player(`/api/campaigns/${campaign.id}/members/me`, { method: 'DELETE' })).status, 204);
  assert.equal((await player(`/api/campaigns/${campaign.id}`)).status, 404);
});

test('the master does not leave their own campaign', async () => {
  const { master, campaign } = await appWithCampaign();

  const response = await master(`/api/campaigns/${campaign.id}/members/me`, { method: 'DELETE' });
  assert.equal(response.status, 409);
  assert.equal((await master(`/api/campaigns/${campaign.id}`)).status, 200);
});

test('removing a member of another campaign by id does not work', async () => {
  const { master, campaign } = await appWithCampaign();
  const other = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Outra mesa' }) }),
  );
  const target = await memberOf(master, campaign.id, 'Rafael Costa');

  // The member exists but belongs to another campaign: the route must not reach them.
  const response = await master(`/api/campaigns/${other.id}/members/${target.id}`, { method: 'DELETE' });
  assert.equal(response.status, 404);
  assert.equal(
    (await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`))).members.length,
    2,
  );
});

test('every campaign route requires a session', async (t) => {
  const { a, campaign } = await appWithCampaign();
  const routes: Array<[string, string]> = [
    ['GET', `/api/campaigns`],
    ['POST', `/api/campaigns`],
    ['POST', `/api/campaigns/join`],
    ['GET', `/api/campaigns/${campaign.id}`],
    ['GET', `/api/campaigns/${campaign.id}/members`],
    ['DELETE', `/api/campaigns/${campaign.id}/members/me`],
    ['DELETE', `/api/campaigns/${campaign.id}/members/anything`],
  ];

  for (const [method, route] of routes) {
    await t.test(`${method} ${route}`, async () => {
      const response = await a.app.request(route, { method, headers: { 'content-type': 'application/json' } });
      assert.equal(response.status, 401);
    });
  }
});
