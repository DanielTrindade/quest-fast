import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { assets } from '@quest-fast/db';
import type { AssetUploadResponse, CharacterResponse, CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn, testEnv, testImageFile } from '../testing.ts';
import { normalizeAvatar } from './image.ts';
import { MAX_ASSET_SIZE, createDiskAssetStore, createMemoryAssetStore, createR2AssetStore, type AssetStore } from './store.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

async function appWithCampaign(options?: Parameters<typeof createTestApp>[1]) {
  const a = createTestApp(PROFILES, options);
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

/** Counts what reaches the store, to prove a refused upload never does. */
function countingStore() {
  const inner = createMemoryAssetStore();
  const saved: Array<{ buffer: Uint8Array; mimeType: string }> = [];
  const store: AssetStore = {
    save(campaignId, buffer, mimeType) {
      saved.push({ buffer, mimeType });
      return inner.save(campaignId, buffer, mimeType);
    },
    urlFor: inner.urlFor,
  };
  return { store, saved };
}

test('a member uploads an image and the server stores its own WebP copy', async () => {
  const { store, saved } = countingStore();
  const { a, player, campaign } = await appWithCampaign({ assets: store });

  const response = await upload(player, campaign.id, await testImageFile('png'));
  assert.equal(response.status, 201);

  const { asset } = await body<AssetUploadResponse>(response);
  assert.match(asset.url, new RegExp(`^/uploads/campaigns/${campaign.id}/`));
  assert.match(asset.url, /\.webp$/);

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.mimeType, 'image/webp');
  const rows = a.db.select().from(assets).all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.campaignId, campaign.id);
  assert.equal(rows[0]?.mimeType, 'image/webp');
  assert.equal(rows[0]?.size, saved[0]?.buffer.byteLength);
});

test('every allowed image type is accepted', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const format of ['png', 'jpeg', 'webp', 'gif'] as const) {
    const response = await upload(player, campaign.id, await testImageFile(format));
    assert.equal(response.status, 201, format);
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

test('a file that is not an image is refused even when the browser calls it image/png', async () => {
  const { store, saved } = countingStore();
  const { a, player, campaign } = await appWithCampaign({ assets: store });
  const fakes = [
    new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }),
    new File(['<?php system($_GET["c"]); ?>'], 'avatar.png', { type: 'image/png' }),
    new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'a.svg', {
      type: 'image/svg+xml',
    }),
  ];

  for (const fake of fakes) {
    const response = await upload(player, campaign.id, fake);
    assert.equal(response.status, 422, fake.name);
    const { error } = await body<{ error: string }>(response);
    assert.match(error, /não é uma imagem válida/);
  }
  assert.equal(saved.length, 0);
  assert.equal(a.db.select().from(assets).all().length, 0);
});

test('the type the browser sends is ignored when the file is a real image', async () => {
  const { player, campaign } = await appWithCampaign();
  for (const type of ['text/plain', 'application/octet-stream', '']) {
    const response = await upload(player, campaign.id, await testImageFile('png', type));
    assert.equal(response.status, 201, type || '(no type)');
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

// --- Serving what was uploaded ----------------------------------------------

/** A valid 1x1 PNG. */
const PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
));

/** An app whose uploads go to a real directory, removed when the test ends. */
async function appWithDiskUploads(t: test.TestContext, pathStyle: 'absolute' | 'relative') {
  const dir = await mkdtemp(join(tmpdir(), 'qf-uploads-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const uploadsDir = pathStyle === 'absolute' ? dir : relative(process.cwd(), dir);
  return appWithCampaign({ assets: createDiskAssetStore(uploadsDir), env: { ...testEnv, uploadsDir } });
}

for (const pathStyle of ['absolute', 'relative'] as const) {
  test(`the stored image is served back at its URL, byte for byte (${pathStyle} UPLOADS_DIR)`, async (t) => {
    const { a, player, campaign } = await appWithDiskUploads(t, pathStyle);
    const uploaded = await upload(player, campaign.id, new File([PNG], 'avatar.png', { type: 'image/png' }));
    assert.equal(uploaded.status, 201);
    const { asset } = await body<AssetUploadResponse>(uploaded);

    const response = await a.app.request(asset.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    const stored = await normalizeAvatar(PNG);
    assert.ok(stored.ok);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), stored.image.buffer);
  });
}

test('a missing upload is a 404, not the SPA page', async (t) => {
  const clientDir = await mkdtemp(join(tmpdir(), 'qf-client-'));
  t.after(() => rm(clientDir, { recursive: true, force: true }));
  await writeFile(join(clientDir, 'index.html'), '<!doctype html><title>SPA</title>');
  const uploadsDir = await mkdtemp(join(tmpdir(), 'qf-uploads-'));
  t.after(() => rm(uploadsDir, { recursive: true, force: true }));
  const { app } = createTestApp(PROFILES, {
    assets: createDiskAssetStore(uploadsDir),
    env: { ...testEnv, uploadsDir, clientDir },
    serveClient: true,
  });

  // The SPA itself still answers its own routes.
  assert.match(await (await app.request('/campanhas')).text(), /<title>SPA<\/title>/);

  for (const url of ['/uploads/campaigns/nope/missing.png', '/uploads/', '/uploads/campaigns']) {
    const response = await app.request(url);
    assert.equal(response.status, 404, url);
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /html/, url);
  }
});

test('with R2 on, the upload and the avatar on the sheet point at the bucket', async () => {
  const sent: unknown[] = [];
  const assetStore = createR2AssetStore(
    { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicUrl: 'https://cdn.example.com' },
    { send: async (command) => void sent.push(command) },
  );
  const { player, campaign } = await appWithCampaign({ assets: assetStore });

  const uploaded = await upload(player, campaign.id, new File([PNG], 'avatar.png', { type: 'image/png' }));
  assert.equal(uploaded.status, 201);
  const { asset } = await body<AssetUploadResponse>(uploaded);
  assert.ok(asset.url.startsWith(`https://cdn.example.com/campaigns/${campaign.id}/`), asset.url);
  assert.match(asset.url, /\/[0-9a-f-]{36}\.webp$/);
  assert.equal(sent.length, 1);

  const created = await player(`/api/campaigns/${campaign.id}/characters`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Kaelen', race: 'Elfo', class: 'Ladino', level: 3,
      abilityScores: { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 8, charisma: 13 },
      hp: 24, ac: 15, skills: [], saves: [], attacks: [], features: [], description: '',
      avatarAssetId: asset.id,
    }),
  });
  assert.equal(created.status, 201);
  const { character } = await body<CharacterResponse>(created);
  assert.equal(character.avatarUrl, asset.url);
});

test('a storage failure is a 502 with a message, and no asset row is left behind', async () => {
  const failing = createR2AssetStore(
    { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b', publicUrl: 'https://cdn.example.com' },
    { send: async () => { throw new Error('R2 fora do ar'); } },
  );
  const { a, player, campaign } = await appWithCampaign({ assets: failing });

  const response = await upload(player, campaign.id, new File([PNG], 'avatar.png', { type: 'image/png' }));
  assert.equal(response.status, 502);
  const { error } = await body<{ error: string }>(response);
  assert.match(error, /Não foi possível guardar a imagem/);
  assert.equal(a.db.select().from(assets).all().length, 0);
});
