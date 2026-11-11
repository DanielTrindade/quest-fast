import test from 'node:test';
import assert from 'node:assert/strict';
import type { BansResponse, CreatedCampaign, MembersResponse } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

const BANNED_MESSAGE = 'Você não pode entrar nesta mesa. Fale com quem te chamou.';

async function appWithRemovedPlayer() {
  const a = createTestApp(PROFILES);
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));

  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos', description: '' }) }),
  );
  const join = () =>
    player('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code: campaign.inviteCode }) });
  await join();

  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  const target = members.find((member) => member.name === 'Rafael Costa')!;
  return { a, master, player, outsider, campaign, target, join };
}

async function removeTarget() {
  const ctx = await appWithRemovedPlayer();
  const removed = await ctx.master(`/api/campaigns/${ctx.campaign.id}/members/${ctx.target.id}`, {
    method: 'DELETE',
  });
  assert.equal(removed.status, 204);
  return ctx;
}

test('a player removed by the master cannot rejoin with the code', async () => {
  const { master, campaign, join } = await removeTarget();

  const response = await join();
  assert.equal(response.status, 403);
  assert.deepEqual(await body(response), { error: BANNED_MESSAGE });

  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members.some((member) => member.name === 'Rafael Costa'), false);
});

test('a player who left on their own can rejoin', async () => {
  const { player, campaign, join } = await appWithRemovedPlayer();
  const left = await player(`/api/campaigns/${campaign.id}/members/me`, { method: 'DELETE' });
  assert.equal(left.status, 204);
  assert.equal((await join()).status, 201);
});

test('the master lists the banned players', async () => {
  const { master, campaign, target } = await removeTarget();
  const response = await master(`/api/campaigns/${campaign.id}/bans`);
  assert.equal(response.status, 200);
  const { bans } = await body<BansResponse>(response);
  assert.equal(bans.length, 1);
  assert.equal(bans[0]?.userId, target.userId);
  assert.equal(bans[0]?.name, 'Rafael Costa');
  assert.equal(typeof bans[0]?.bannedAt, 'string');
});

test('a non-member gets 404 listing or releasing bans', async () => {
  const { outsider, campaign, target } = await removeTarget();
  assert.equal((await outsider(`/api/campaigns/${campaign.id}/bans`)).status, 404);
  assert.equal(
    (await outsider(`/api/campaigns/${campaign.id}/bans/${target.userId}`, { method: 'DELETE' })).status,
    404,
  );
});

test('listing bans requires authentication', async () => {
  const { a, campaign } = await removeTarget();
  assert.equal((await a.app.request(`/api/campaigns/${campaign.id}/bans`)).status, 401);
});

test('a player cannot list or release bans', async () => {
  const { player, campaign, target } = await appWithRemovedPlayer();
  assert.equal((await player(`/api/campaigns/${campaign.id}/bans`)).status, 403);
  assert.equal(
    (await player(`/api/campaigns/${campaign.id}/bans/${target.userId}`, { method: 'DELETE' })).status,
    403,
  );
});

test('releasing a ban lets the player rejoin; releasing twice is 404', async () => {
  const { master, campaign, target, join } = await removeTarget();
  const url = `/api/campaigns/${campaign.id}/bans/${target.userId}`;

  assert.equal((await master(url, { method: 'DELETE' })).status, 204);
  assert.equal((await join()).status, 201);

  const again = await master(url, { method: 'DELETE' });
  assert.equal(again.status, 404);
  assert.deepEqual(await body(again), { error: 'Bloqueio não encontrado.' });
});
