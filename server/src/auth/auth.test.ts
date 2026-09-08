import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { users } from '@quest-fast/db';
import type { MeResponse } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn } from '../testing.ts';
import { buildAvatarUrl } from './discord.ts';

const LIA = { discordId: '111', name: 'Lia Martins', avatarUrl: null };
const RAFAEL = { discordId: '222', name: 'Rafael Costa', avatarUrl: null };

function app() {
  return createTestApp({ 'code-lia': LIA, 'code-rafael': RAFAEL });
}

function stateCookie(response: Response) {
  return response.headers.getSetCookie()[0].split(';')[0].split('=')[1];
}

test('first access creates the account and starts the session', async () => {
  const a = app();
  const session = await signIn(a, 'code-lia');

  const response = await asUser(a, session)('/api/auth/me');
  assert.equal(response.status, 200);
  assert.equal((await body<MeResponse>(response)).user.name, 'Lia Martins');
});

test('the callback redirects to the campaign listing', async () => {
  const a = app();
  const start = await a.app.request('/api/auth/discord');
  const state = stateCookie(start);
  const callback = await a.app.request(`/api/auth/discord/callback?code=code-lia&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/campaigns');
});

test('a later access recognizes the account and does not duplicate the user', async () => {
  const a = app();
  await signIn(a, 'code-lia');
  await signIn(a, 'code-lia');

  const accounts = a.db.select().from(users).where(eq(users.discordId, '111')).all();
  assert.equal(accounts.length, 1);
});

test('name and avatar are refreshed on every login', async () => {
  const a = createTestApp({
    first: LIA,
    second: { ...LIA, name: 'Lia, a Bardo', avatarUrl: 'https://cdn/x.png' },
  });
  await signIn(a, 'first');
  await signIn(a, 'second');

  const account = a.db.select().from(users).where(eq(users.discordId, '111')).get();
  assert.equal(account?.name, 'Lia, a Bardo');
  assert.equal(account?.avatarUrl, 'https://cdn/x.png');
});

test('authorization declined on Discord creates no session', async () => {
  const a = app();
  const start = await a.app.request('/api/auth/discord');
  const state = stateCookie(start);

  const callback = await a.app.request(`/api/auth/discord/callback?error=access_denied&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  assert.equal(callback.headers.get('location'), '/login?error=discord');
  assert.equal(
    callback.headers.getSetCookie().some((c) => c.startsWith('qf_session=') && !c.startsWith('qf_session=;')),
    false,
  );
  assert.equal(a.db.select().from(users).all().length, 0);
});

test('a callback with a mismatched state is refused', async () => {
  const a = app();
  await a.app.request('/api/auth/discord');
  const callback = await a.app.request('/api/auth/discord/callback?code=code-lia&state=forged', {
    headers: { cookie: 'qf_oauth_state=another-value' },
  });
  assert.equal(callback.headers.get('location'), '/login?error=discord');
  assert.equal(a.db.select().from(users).all().length, 0);
});

test('a callback without the state cookie is refused', async () => {
  const a = app();
  const callback = await a.app.request('/api/auth/discord/callback?code=code-lia&state=anything');
  assert.equal(callback.headers.get('location'), '/login?error=discord');
  assert.equal(a.db.select().from(users).all().length, 0);
});

test('a data route without a session answers 401 and exposes nothing', async () => {
  const a = app();
  for (const route of ['/api/auth/me', '/api/campaigns']) {
    const response = await a.app.request(route);
    assert.equal(response.status, 401, route);
    assert.deepEqual(await response.json(), { error: 'Não autenticado.' });
  }
});

test('an invalid session is treated as no session at all', async () => {
  const a = app();
  const response = await asUser(a, 'session-that-does-not-exist')('/api/campaigns');
  assert.equal(response.status, 401);
});

test('logout invalidates the session on the server', async () => {
  const a = app();
  const session = await signIn(a, 'code-lia');
  const request = asUser(a, session);

  assert.equal((await request('/api/auth/me')).status, 200);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 204);
  // The same cookie, presented again, no longer works: the session is gone.
  assert.equal((await request('/api/auth/me')).status, 401);
});

test('the session persists across requests from the same browser', async () => {
  const a = app();
  const session = await signIn(a, 'code-lia');
  const request = asUser(a, session);
  for (let i = 0; i < 3; i++) assert.equal((await request('/api/auth/me')).status, 200);
});

test('the session cookie is HttpOnly', async () => {
  const a = app();
  const start = await a.app.request('/api/auth/discord');
  const state = stateCookie(start);
  const callback = await a.app.request(`/api/auth/discord/callback?code=code-lia&state=${state}`, {
    headers: { cookie: `qf_oauth_state=${state}` },
  });
  const cookie = callback.headers.getSetCookie().find((c) => c.startsWith('qf_session='));
  assert.match(cookie ?? '', /HttpOnly/i);
});

test('the Discord avatar becomes a URL, and a missing hash becomes null', () => {
  assert.equal(buildAvatarUrl('123', 'abc'), 'https://cdn.discordapp.com/avatars/123/abc.png');
  assert.equal(buildAvatarUrl('123', 'a_animated'), 'https://cdn.discordapp.com/avatars/123/a_animated.gif');
  assert.equal(buildAvatarUrl('123', null), null);
});
