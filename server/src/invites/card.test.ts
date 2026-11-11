import test from 'node:test';
import assert from 'node:assert/strict';
import type { CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';
import { Resvg } from '@resvg/resvg-js';
import { buildAvatarUrl } from '../auth/discord.ts';
import { cardInitials, createCardProvider, fetchAvatar, renderInviteCard, sanitizeCardText, staticAvatarUrl } from './card.ts';

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

function tinyPng(): Uint8Array {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c33"/></svg>';
  return new Resvg(svg).render().asPng();
}

test('renders a PNG with a valid avatar', async () => {
  const png = await renderInviteCard({ campaignName: 'Ecos', masterName: 'Lia Martins', avatar: tinyPng() });
  assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
  assert.deepEqual(dimensions(png), { width: 1200, height: 630 });
});

test('a corrupt avatar falls back to initials instead of failing', async () => {
  const png = await renderInviteCard({
    campaignName: 'Ecos',
    masterName: 'Lia Martins',
    avatar: new Uint8Array([...PNG_SIGNATURE, 1, 2, 3]),
  });
  assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
  assert.deepEqual(dimensions(png), { width: 1200, height: 630 });
});

test('fetchAvatar rejects a png content-type whose bytes are not an image', async () => {
  const fetchImpl = (async () =>
    new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'image/png' } })) as typeof fetch;
  assert.equal(await fetchAvatar('https://cdn.discordapp.com/a.png', fetchImpl), undefined);
});

test('fetchAvatar stops reading a chunked body over the limit', async () => {
  const chunk = new Uint8Array(256 * 1024);
  chunk.set(PNG_SIGNATURE);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
      sent += 1;
      if (sent > 100) controller.close();
    },
  });
  const fetchImpl = (async () => new Response(body, { headers: { 'content-type': 'image/png' } })) as typeof fetch;
  assert.equal(await fetchAvatar('https://cdn.discordapp.com/a.png', fetchImpl), undefined);
  assert.ok(sent < 10);
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
    (async () => new Response(Uint8Array.from({ length: bytes }, (_, i) => PNG_SIGNATURE[i] ?? 0), { headers: { 'content-type': type } })) as typeof fetch;
  assert.equal((await fetchAvatar(url, respond(10, 'image/png')))?.byteLength, 10);
  assert.equal(await fetchAvatar(url, respond(2 * 1024 * 1024, 'image/png')), undefined);
  assert.equal(await fetchAvatar(url, respond(10, 'text/html')), undefined);
});

test('staticAvatarUrl swaps animated and webp extensions for png on the Discord CDN only', () => {
  const base = 'https://cdn.discordapp.com/avatars/1/a_x';
  assert.equal(staticAvatarUrl(`${base}.gif`), `${base}.png`);
  assert.equal(staticAvatarUrl(`${base}.gif?size=256`), `${base}.png?size=256`);
  assert.equal(staticAvatarUrl(`${base}.png`), `${base}.png`);
  assert.equal(staticAvatarUrl(`${base}.webp`), `${base}.png`);
  assert.equal(staticAvatarUrl('https://evil.example/a.gif'), 'https://evil.example/a.gif');
});

test('fetchAvatar asks for the png variant of an animated avatar', async () => {
  const url = buildAvatarUrl('123', 'a_animated');
  assert.ok(url?.endsWith('.gif'));
  let requested = '';
  const fetchImpl = (async (input: string) => {
    requested = input;
    return new Response(Uint8Array.from(PNG_SIGNATURE), { headers: { 'content-type': 'image/png' } });
  }) as unknown as typeof fetch;
  const result = await fetchAvatar(url, fetchImpl);
  assert.equal(requested, 'https://cdn.discordapp.com/avatars/123/a_animated.png');
  assert.ok(result);
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

test('concurrent requests for the same card share one avatar download and one render', async () => {
  let downloads = 0;
  let renders = 0;
  const provider = createCardProvider({
    fetchAvatar: async () => {
      downloads += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return undefined;
    },
    renderCard: async () => {
      renders += 1;
      return new Uint8Array([1]);
    },
  });
  const source = { campaignName: 'Ecos', masterName: 'Lia', masterAvatarUrl: 'https://cdn.discordapp.com/a.png' };
  const results = await Promise.all([provider.get('ABC123', 'v1', source), provider.get('ABC123', 'v1', source), provider.get('ABC123', 'v1', source)]);
  assert.equal(downloads, 1);
  assert.equal(renders, 1);
  assert.equal(results[0], results[2]);
  await provider.get('ABC123', 'v1', source);
  assert.equal(renders, 1);
});

test('a failed render is not cached', async () => {
  let renders = 0;
  const provider = createCardProvider({
    fetchAvatar: async () => undefined,
    renderCard: async () => {
      renders += 1;
      if (renders === 1) throw new Error('boom');
      return new Uint8Array([1]);
    },
  });
  const source = { campaignName: 'Ecos', masterName: 'Lia', masterAvatarUrl: null };
  await assert.rejects(provider.get('ABC123', 'v1', source));
  await provider.get('ABC123', 'v1', source);
  assert.equal(renders, 2);
});

test('sanitizeCardText drops glyphs the fonts cannot draw and keeps Latin text', () => {
  assert.equal(sanitizeCardText('Mesa 🐉 do Dragão', 'Mesa sem nome'), 'Mesa do Dragão');
  assert.equal(sanitizeCardText('Wiśniewska 🎲', 'Mestre'), 'Wiśniewska');
  assert.equal(sanitizeCardText('🐉🎲', 'Mesa sem nome'), 'Mesa sem nome');
  assert.equal(sanitizeCardText('田中太郎', 'Mestre'), 'Mestre');
  assert.equal(sanitizeCardText('  Ecos   de	Fogo  ', 'Mesa sem nome'), 'Ecos de Fogo');
  assert.equal(sanitizeCardText('Ordem – “Alfa”', 'Mesa sem nome'), 'Ordem – “Alfa”');
});

test('cardInitials stays inside the drawable set', () => {
  assert.equal(cardInitials('Lia Martins'), 'LM');
  assert.equal(cardInitials('Mestre'), 'M');
});

test('renders valid PNGs for emoji, Latin Extended and CJK names', async () => {
  for (const [campaignName, masterName] of [
    ['Mesa 🐉 do Dragão', 'Wiśniewska 🎲'],
    ['🐉', '田中太郎'],
  ]) {
    const png = await renderInviteCard({ campaignName, masterName, avatar: undefined });
    assert.deepEqual([...png.slice(0, 8)], PNG_SIGNATURE);
    assert.deepEqual(dimensions(png), { width: 1200, height: 630 });
  }
});

test('the card cache is keyed by code and version', async () => {
  let renders = 0;
  const provider = createCardProvider({
    fetchAvatar: async () => undefined,
    renderCard: async () => new Uint8Array([++renders]),
  });
  const source = { campaignName: 'Ecos', masterName: 'Lia', masterAvatarUrl: null };
  const first = await provider.get('AAAAAA', 'v1', source);
  const second = await provider.get('BBBBBB', 'v1', source);
  assert.notEqual(first[0], second[0]);
  assert.equal(renders, 2);
});

test('sanitizeCardText keeps Latin-1 and Latin Extended-A and drops the rest', () => {
  assert.equal(sanitizeCardText('Łukasz Paweł', 'Mestre'), 'Łukasz Paweł');
  assert.equal(sanitizeCardText('Łódź Đorđe', 'Mesa sem nome'), 'Łódź Đorđe');
  assert.equal(sanitizeCardText('Việt ǅ', 'Mesa sem nome'), 'Vit');
});

test('cardInitials draws Latin Extended-A letters', () => {
  assert.equal(cardInitials('Łukasz Paweł'), 'ŁP');
});
