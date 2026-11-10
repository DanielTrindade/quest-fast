import test from 'node:test';
import assert from 'node:assert/strict';
import type { CreatedCampaign, InvitePreview, MembersResponse } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

async function setup() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ecos', description: 'segredo da mesa' }),
    }),
  );
  const join = (who: typeof player, code: string) =>
    who('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code }) });
  return { a, master, player, outsider, campaign, join };
}

test('an anonymous visitor gets the minimal preview', async () => {
  const { a, campaign } = await setup();
  const response = await a.app.request(`/api/invites/${campaign.inviteCode}`);
  assert.equal(response.status, 200);
  const preview = await body<InvitePreview>(response);
  assert.deepEqual(Object.keys(preview).sort(), ['campaignName', 'code', 'master', 'playerCount', 'viewer']);
  assert.equal(preview.viewer, 'anonymous');
  assert.equal(preview.code, campaign.inviteCode);
  assert.equal(preview.campaignName, 'Ecos');
  assert.deepEqual(preview.master, { name: 'Lia Martins', avatarUrl: null });
  assert.equal(preview.playerCount, 0);
});

test('a lowercase hyphenated code resolves to the normalized code', async () => {
  const { a, campaign } = await setup();
  const typed = `${campaign.inviteCode.slice(0, 3)}-${campaign.inviteCode.slice(3)}`.toLowerCase();
  const response = await a.app.request(`/api/invites/${typed}`);
  assert.equal(response.status, 200);
  assert.equal((await body<InvitePreview>(response)).code, campaign.inviteCode);
});

test('the viewer status follows the session and membership', async () => {
  const { master, player, outsider, campaign, join } = await setup();
  await join(player, campaign.inviteCode);
  const path = `/api/invites/${campaign.inviteCode}`;

  const guest = await body<InvitePreview>(await outsider(path));
  assert.equal(guest.viewer, 'guest');
  assert.equal('campaignId' in guest, false);

  const asPlayer = await body<InvitePreview>(await player(path));
  assert.equal(asPlayer.viewer, 'member');
  assert.equal(asPlayer.campaignId, campaign.id);
  assert.equal(asPlayer.playerCount, 1);

  const asMaster = await body<InvitePreview>(await master(path));
  assert.equal(asMaster.viewer, 'member');
  assert.equal(asMaster.campaignId, campaign.id);
});

test('a removed player sees the invite as blocked', async () => {
  const { master, player, campaign, join } = await setup();
  await join(player, campaign.inviteCode);
  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  const target = members.find((member) => member.name === 'Rafael Costa')!;
  await master(`/api/campaigns/${campaign.id}/members/${target.id}`, { method: 'DELETE' });

  const preview = await body<InvitePreview>(await player(`/api/invites/${campaign.inviteCode}`));
  assert.equal(preview.viewer, 'blocked');
  assert.equal('campaignId' in preview, false);
});

test('an unknown or malformed code is a 404', async () => {
  const { a } = await setup();
  for (const code of ['AAAAAA', 'xx']) {
    const response = await a.app.request(`/api/invites/${code}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await body(response), { error: 'Convite inválido.' });
  }
});

test('only the master rotates the invite', async () => {
  const { player, outsider, campaign, join } = await setup();
  await join(player, campaign.inviteCode);
  const byPlayer = await player(`/api/campaigns/${campaign.id}/invite`, { method: 'POST' });
  assert.equal(byPlayer.status, 403);
  const byOutsider = await outsider(`/api/campaigns/${campaign.id}/invite`, { method: 'POST' });
  assert.equal(byOutsider.status, 404);
});

test('rotating the invite requires a session', async () => {
  const { a, campaign } = await setup();
  const response = await a.app.request(`/api/campaigns/${campaign.id}/invite`, { method: 'POST' });
  assert.equal(response.status, 401);
});

test('rotating invalidates the old code and keeps the members', async () => {
  const { a, master, player, outsider, campaign, join } = await setup();
  await join(player, campaign.inviteCode);

  const rotated = await master(`/api/campaigns/${campaign.id}/invite`, { method: 'POST' });
  assert.equal(rotated.status, 200);
  const { inviteCode } = await body<{ inviteCode: string }>(rotated);
  assert.notEqual(inviteCode, campaign.inviteCode);

  const fresh = await a.app.request(`/api/invites/${inviteCode}`);
  assert.equal(fresh.status, 200);
  assert.equal((await body<InvitePreview>(fresh)).code, inviteCode);
  assert.equal((await a.app.request(`/api/invites/${campaign.inviteCode}`)).status, 404);
  assert.equal((await join(outsider, campaign.inviteCode)).status, 404);
  assert.equal((await join(outsider, inviteCode)).status, 201);

  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members.length, 3);
  assert.ok(members.some((member) => member.name === 'Rafael Costa'));
});

test('joining twice with the same user keeps a single membership', async () => {
  const { master, player, campaign, join } = await setup();
  assert.equal((await join(player, campaign.inviteCode)).status, 201);
  assert.equal((await join(player, campaign.inviteCode)).status, 200);
  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members.filter((member) => member.name === 'Rafael Costa').length, 1);
});
