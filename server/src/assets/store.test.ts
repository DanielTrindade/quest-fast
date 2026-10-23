import test from 'node:test';
import assert from 'node:assert/strict';
import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { createR2AssetStore, type R2Config } from './store.ts';

const CONFIG: R2Config = {
  accountId: 'account',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'quest-fast-assets',
  publicUrl: 'https://cdn.example.com',
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

test('a failed R2 upload rejects instead of returning a URL that does not exist', async () => {
  const store = createR2AssetStore(CONFIG, { send: async () => { throw new Error('R2 indisponível'); } });
  await assert.rejects(store.save('campaign-1', new Uint8Array([1]), 'image/png'), /R2 indisponível/);
});
