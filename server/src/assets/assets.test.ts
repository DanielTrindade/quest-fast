import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { assets } from '@quest-fast/db';
import type { AssetUploadResponse, CharacterResponse, CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn, testEnv } from '../testing.ts';
import { MAX_ASSET_SIZE, createDiskAssetStore, createR2AssetStore } from './store.ts';

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

// --- Serving what was uploaded ----------------------------------------------

/** A valid 1x1 PNG: the bytes read back must be exactly these. */
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
  test(`an uploaded image is served back at its URL, byte for byte (${pathStyle} UPLOADS_DIR)`, async (t) => {
    const { a, player, campaign } = await appWithDiskUploads(t, pathStyle);
    const uploaded = await upload(player, campaign.id, new File([PNG], 'avatar.png', { type: 'image/png' }));
    assert.equal(uploaded.status, 201);
    const { asset } = await body<AssetUploadResponse>(uploaded);

    const response = await a.app.request(asset.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG);
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
  assert.match(asset.url, /\/[0-9a-f-]{36}\.png$/);
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
