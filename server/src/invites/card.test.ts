import test from 'node:test';
import assert from 'node:assert/strict';
import type { CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';
import { fetchAvatar, renderInviteCard } from './card.ts';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function dimensions(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

test('renders a 1200x630 PNG for a very long name without avatar', async () => {
  const png = await renderInviteCard({
    campaignName: 'A'.repeat(200),
    masterName: 'Lia Martins',
    avatar: undefined,
  });
  assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
  assert.deepEqual(dimensions(png), { width: 1200, height: 630 });
});

test('fetchAvatar returns undefined when the request fails', async () => {
  const result = await fetchAvatar('https://cdn.discordapp.com/avatars/1/a.png', async () => {
    throw new Error('network down');
  });
  assert.equal(result, undefined);
});

test('fetchAvatar refuses hosts other than the Discord CDN without fetching', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response(new Uint8Array(4), { headers: { 'content-type': 'image/png' } });
  }) as typeof fetch;
  assert.equal(await fetchAvatar('https://evil.example/a.png', fetchImpl), undefined);
  assert.equal(await fetchAvatar('http://cdn.discordapp.com/a.png', fetchImpl), undefined);
  assert.equal(await fetchAvatar(null, fetchImpl), undefined);
  assert.equal(called, false);
});

test('fetchAvatar accepts a small png and rejects oversized or non-png bodies', async () => {
  const url = 'https://cdn.discordapp.com/avatars/1/a.png';
  const respond = (bytes: number, type: string) =>
    (async () => new Response(new Uint8Array(bytes), { headers: { 'content-type': type } })) as typeof fetch;
  assert.equal((await fetchAvatar(url, respond(10, 'image/png')))?.byteLength, 10);
  assert.equal(await fetchAvatar(url, respond(2 * 1024 * 1024, 'image/png')), undefined);
  assert.equal(await fetchAvatar(url, respond(10, 'text/html')), undefined);
});

test('the card route serves a PNG for a valid code and 404 otherwise', async () => {
  const a = createTestApp({ lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null } });
  const master = asUser(a, await signIn(a, 'lia'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos', description: '' }) }),
  );

  const ok = await a.app.request(`/api/invites/${campaign.inviteCode}/card.png?v=abc`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/png');
  assert.equal(ok.headers.get('cache-control'), 'public, max-age=86400');
  const png = new Uint8Array(await ok.arrayBuffer());
  assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
  assert.deepEqual(dimensions(png), { width: 1200, height: 630 });

  const missing = await a.app.request('/api/invites/ZZZZZZ/card.png');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Convite inválido.' });

  const rotated = await body<{ inviteCode: string }>(
    await master(`/api/campaigns/${campaign.id}/invite`, { method: 'POST' }),
  );
  assert.notEqual(rotated.inviteCode, campaign.inviteCode);
  assert.equal((await a.app.request(`/api/invites/${campaign.inviteCode}/card.png`)).status, 404);
  assert.equal((await a.app.request(`/api/invites/${rotated.inviteCode}/card.png`)).status, 200);
});
