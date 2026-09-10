import test from 'node:test';
import assert from 'node:assert/strict';
import { assets } from '@quest-fast/db';
import type { AssetUploadResponse, CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';
import { MAX_ASSET_SIZE } from './store.ts';

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

function formWith(file: File | string | null) {
  const form = new FormData();
  if (file !== null) form.append('file', file);
  return form;
}

function upload(request: ReturnType<typeof asUser>, campaignId: string, file: File | string | null) {
  return request(`/api/campaigns/${campaignId}/assets`, { method: 'POST', body: formWith(file) });
}

test('a member uploads an allowed image and it is stored in the campaign', async () => {
  const { a, player, campaign } = await appWithCampaign();

  const response = await upload(
    player,
    campaign.id,
    new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }),
  );
  assert.equal(response.status, 201);

  const { asset } = await body<AssetUploadResponse>(response);
  assert.match(asset.url, new RegExp(`^/uploads/campaigns/${campaign.id}/`));
  assert.match(asset.url, /\.png$/);

  const rows = a.db.select().from(assets).all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.campaignId, campaign.id);
  assert.equal(rows[0]?.mimeType, 'image/png');
});

test('every allowed image type is accepted', async () => {
  const { player, campaign } = await appWithCampaign();
  const types: Array<[string, string]> = [
    ['photo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.webp', 'image/webp'],
    ['photo.gif', 'image/gif'],
  ];

  for (const [name, type] of types) {
    const response = await upload(player, campaign.id, new File([new Uint8Array([1])], name, { type }));
    assert.equal(response.status, 201, type);
  }
});

test('upload requires a session', async () => {
  const { a, campaign } = await appWithCampaign();
  const response = await a.app.request(`/api/campaigns/${campaign.id}/assets`, {
    method: 'POST',
    body: formWith(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })),
  });
  assert.equal(response.status, 401);
});

test('a non-member cannot upload into the campaign', async () => {
  const { outsider, campaign } = await appWithCampaign();
  const response = await upload(
    outsider,
    campaign.id,
    new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }),
  );
  assert.equal(response.status, 404);
});

test('a request without a file is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  assert.equal((await upload(player, campaign.id, null)).status, 422);
  // A non-file field is not a file either.
  assert.equal((await upload(player, campaign.id, 'not-a-file')).status, 422);
});

test('a disallowed mime type is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const type of ['text/plain', 'image/svg+xml', 'application/pdf', '']) {
    const response = await upload(player, campaign.id, new File([new Uint8Array([1])], 'a.bin', { type }));
    assert.equal(response.status, 422, type || '(no type)');
  }
});

test('an empty file is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  const response = await upload(player, campaign.id, new File([], 'empty.png', { type: 'image/png' }));
  assert.equal(response.status, 422);
});

test('a file over the size limit is refused with 413', async () => {
  const { a, player, campaign } = await appWithCampaign();
  const tooBig = new File([new Uint8Array(MAX_ASSET_SIZE + 1)], 'big.png', { type: 'image/png' });

  const response = await upload(player, campaign.id, tooBig);
  assert.equal(response.status, 413);
  assert.equal(a.db.select().from(assets).all().length, 0);
});

test('a body that is not multipart is refused', async () => {
  const { player, campaign } = await appWithCampaign();
  const response = await player(`/api/campaigns/${campaign.id}/assets`, {
    method: 'POST',
    body: JSON.stringify({ file: 'pretend' }),
  });
  assert.equal(response.status, 422);
});
