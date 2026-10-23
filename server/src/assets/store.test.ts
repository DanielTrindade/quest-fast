import test from 'node:test';
import assert from 'node:assert/strict';
import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { readEnv } from '../env.ts';
import { createR2AssetStore, type R2Config } from './store.ts';

const CONFIG: R2Config = {
  accountId: 'account',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'quest-fast-assets',
  publicUrl: 'https://cdn.example.com',
};

/** The variables readEnv needs, for building a config the way startup does. */
const DISCORD = {
  DISCORD_CLIENT_ID: 'id',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
};
const R2_ENV = {
  ASSET_STORAGE: 'r2',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'quest-fast-assets',
};

/** Records every command instead of reaching Cloudflare. */
function fakeClient() {
  const sent: PutObjectCommand[] = [];
  return { sent, client: { send: async (command: PutObjectCommand) => void sent.push(command) } };
}

test('an R2 upload puts the bytes in the bucket under the campaign path', async () => {
  const { sent, client } = fakeClient();
  const store = createR2AssetStore(CONFIG, client);
  const bytes = new Uint8Array([1, 2, 3]);

  const stored = await store.save('campaign-1', bytes, 'image/webp');

  assert.match(stored.path, /^campaigns\/campaign-1\/[0-9a-f-]{36}\.webp$/);
  assert.equal(stored.url, `https://cdn.example.com/${stored.path}`);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.input, {
    Bucket: 'quest-fast-assets',
    Key: stored.path,
    Body: bytes,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  });
});

test('an R2 URL is the public base plus the stored path', () => {
  const store = createR2AssetStore(CONFIG, fakeClient().client);
  assert.equal(store.urlFor('campaigns/c/a.png'), 'https://cdn.example.com/campaigns/c/a.png');
});

test('an accepted public URL keeps the stored path in the pathname', async () => {
  for (const R2_PUBLIC_URL of ['https://cdn.example.com', 'https://cdn.example.com/avatars/']) {
    const { r2 } = readEnv({ ...DISCORD, ...R2_ENV, R2_PUBLIC_URL });
    const store = createR2AssetStore(r2!, fakeClient().client);
    const stored = await store.save('campaign-1', new Uint8Array([1]), 'image/png');
    const url = new URL(stored.url);
    assert.equal(url.pathname, `${new URL(R2_PUBLIC_URL).pathname.replace(/\/$/, '')}/${stored.path}`, R2_PUBLIC_URL);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
  }
  for (const R2_PUBLIC_URL of ['https://cdn.example.com?download=1', 'https://cdn.example.com#assets']) {
    assert.throws(() => readEnv({ ...DISCORD, ...R2_ENV, R2_PUBLIC_URL }), /Invalid R2_PUBLIC_URL/, R2_PUBLIC_URL);
  }
});

test('a failed R2 upload rejects instead of returning a URL that does not exist', async () => {
  const store = createR2AssetStore(CONFIG, { send: async () => { throw new Error('R2 indisponível'); } });
  await assert.rejects(store.save('campaign-1', new Uint8Array([1]), 'image/png'), /R2 indisponível/);
});
