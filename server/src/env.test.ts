import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidEnv, readEnv } from './env.ts';

const DISCORD = {
  DISCORD_CLIENT_ID: 'id',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
};

const R2 = {
  ASSET_STORAGE: 'r2',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'quest-fast-assets',
  R2_PUBLIC_URL: 'https://cdn.example.com',
};

test('uploads stay on disk unless ASSET_STORAGE asks for R2', () => {
  assert.equal(readEnv(DISCORD).r2, undefined);
  assert.equal(readEnv({ ...DISCORD, ASSET_STORAGE: 'disk' }).r2, undefined);
  assert.equal(readEnv({ ...DISCORD, ASSET_STORAGE: ' ' }).r2, undefined);
  // R2 variables alone do not switch the storage: the choice is explicit.
  const { ASSET_STORAGE: _storage, ...variables } = R2;
  assert.equal(readEnv({ ...DISCORD, ...variables }).r2, undefined);
});

test('ASSET_STORAGE=r2 reads every R2 variable', () => {
  assert.deepEqual(readEnv({ ...DISCORD, ...R2 }).r2, {
    accountId: 'account',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    bucket: 'quest-fast-assets',
    publicUrl: 'https://cdn.example.com',
  });
});

test('a trailing slash on the public URL is dropped', () => {
  assert.equal(readEnv({ ...DISCORD, ...R2, R2_PUBLIC_URL: 'https://cdn.example.com/avatars//' }).r2?.publicUrl, 'https://cdn.example.com/avatars');
});

test('ASSET_STORAGE=r2 without a variable names what is missing', () => {
  for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const) {
    assert.throws(() => readEnv({ ...DISCORD, ...R2, [name]: '' }), (error) =>
      error instanceof InvalidEnv && error.message.includes(name), name);
  }
});

test('an unknown storage or a public URL that is not http(s) is refused', () => {
  assert.throws(() => readEnv({ ...DISCORD, ASSET_STORAGE: 's3' }), /Invalid ASSET_STORAGE/);
  for (const url of ['cdn.example.com', 'ftp://cdn.example.com', 'https://', '/uploads']) {
    assert.throws(() => readEnv({ ...DISCORD, ...R2, R2_PUBLIC_URL: url }), /Invalid R2_PUBLIC_URL/, url);
  }
});
