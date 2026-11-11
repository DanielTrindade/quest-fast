import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import type { CreatedCampaign, MembersResponse } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn, testEnv } from '../testing.ts';
import { clientNetwork, createAttemptLimiter } from './attempt-limiter.ts';

const PROFILES = {
  lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', name: 'Rafael Costa', avatarUrl: null },
  outsider: { discordId: '333', name: 'Ana Estranha', avatarUrl: null },
};

const LIMIT = 20;
const WINDOW_MS = 10 * 60_000;
const MESSAGE = { error: 'Muitas tentativas com código inválido. Aguarde alguns minutos e tente de novo.' };

function from(ip: string): RequestInit {
  return { headers: { 'x-forwarded-for': ip } };
}

async function setup({ trustProxy = true, serveClient = false } = {}) {
  const clock = { now: 1_000_000 };
  const clientDir = mkdtempSync(joinPath(tmpdir(), 'qf-limit-'));
  writeFileSync(joinPath(clientDir, 'index.html'), '<html><head><title>Quest Fast</title></head><body></body></html>');
  const a = createTestApp(PROFILES, {
    env: { ...testEnv, trustProxy, clientDir },
    serveClient,
    inviteAttempts: { now: () => clock.now },
  });
  const master = asUser(a, await signIn(a, 'lia'));
  const player = asUser(a, await signIn(a, 'rafael'));
  const outsider = asUser(a, await signIn(a, 'outsider'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos' }) }),
  );
  const join = (who: typeof player, code: string, ip: string) =>
    who('/api/campaigns/join', { method: 'POST', body: JSON.stringify({ code }), ...from(ip) });
  const valid = `/api/invites/${campaign.inviteCode}`;
  return { a, clock, master, player, outsider, campaign, join, valid };
}

async function exhaust(request: (index: number) => Response | Promise<Response>) {
  for (let i = 0; i < LIMIT; i++) assert.equal((await request(i)).status, 404, `attempt ${i + 1}`);
}

test('the limit is exact: the 20th invalid code is still a 404, the next request is a 429', async () => {
  const { a, valid } = await setup();
  await exhaust(() => a.app.request('/api/invites/AAAAAA', from('10.0.0.1')));

  const blocked = await a.app.request('/api/invites/AAAAAA', from('10.0.0.1'));
  assert.equal(blocked.status, 429);
  assert.deepEqual(await body(blocked), MESSAGE);
  assert.equal(blocked.headers.get('retry-after'), '600');

  // A valid code answers the same, so the block is not a discovery oracle.
  assert.equal((await a.app.request(valid, from('10.0.0.1'))).status, 429);
  assert.equal((await a.app.request(`${valid}/card.png`, from('10.0.0.1'))).status, 429);
});

test('a valid code keeps working for another address', async () => {
  const { a, valid } = await setup();
  await exhaust(() => a.app.request('/api/invites/AAAAAA', from('10.0.0.1')));
  assert.equal((await a.app.request(valid, from('10.0.0.1'))).status, 429);
  assert.equal((await a.app.request(valid, from('10.0.0.2'))).status, 200);
});

test('alternating codes and routes shares one budget per address', async () => {
  const { a, outsider, join, valid } = await setup({ serveClient: true });
  const codes = ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE'];
  for (const code of codes) {
    assert.equal((await a.app.request(`/api/invites/${code}`, from('10.0.0.1'))).status, 404);
    assert.equal((await a.app.request(`/api/invites/${code}/card.png`, from('10.0.0.1'))).status, 404);
    assert.equal((await a.app.request(`/invite/${code}`, from('10.0.0.1'))).status, 200);
    assert.equal((await join(outsider, code, '10.0.0.1')).status, 404);
  }

  assert.equal((await a.app.request(valid, from('10.0.0.1'))).status, 429);
  assert.equal((await a.app.request(`${valid}/card.png`, from('10.0.0.1'))).status, 429);
  assert.equal((await join(outsider, 'FFFFFF', '10.0.0.1')).status, 429);

  const page = await a.app.request(`/invite/${valid.split('/').at(-1)}`, from('10.0.0.1'));
  assert.equal(page.status, 429);
  assert.equal(page.headers.get('retry-after'), '600');
  const html = await page.text();
  assert.match(html, /<title>Quest Fast<\/title>/);
  assert.doesNotMatch(html, /Ecos/);
});

test('a limited join does not create a membership, even with the right code', async () => {
  const { master, outsider, campaign, join } = await setup();
  await exhaust(() => join(outsider, 'AAAAAA', '10.0.0.1'));

  const blocked = await join(outsider, campaign.inviteCode, '10.0.0.1');
  assert.equal(blocked.status, 429);
  assert.deepEqual(await body(blocked), MESSAGE);

  const { members } = await body<MembersResponse>(await master(`/api/campaigns/${campaign.id}/members`));
  assert.equal(members.length, 1);
});

test('the join budget follows the user across addresses, and spares other users', async () => {
  const { player, outsider, campaign, join } = await setup();
  await exhaust((i) => join(outsider, 'AAAAAA', `10.0.1.${i}`));

  assert.equal((await join(outsider, campaign.inviteCode, '10.0.9.9')).status, 429);
  assert.equal((await join(player, campaign.inviteCode, '10.0.9.9')).status, 201);
});

test('a malformed code and a missing session keep their own answers and cost nothing', async () => {
  const { a, outsider, campaign, join } = await setup();
  for (let i = 0; i < LIMIT + 5; i++) {
    assert.equal((await join(outsider, 'xx', '10.0.0.1')).status, 422);
    const anonymous = await a.app.request('/api/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'AAAAAA' }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(anonymous.status, 401);
  }
  assert.equal((await join(outsider, campaign.inviteCode, '10.0.0.1')).status, 201);
});

test('the window slides: the block lifts once the oldest failure expires', async () => {
  const { a, clock, valid } = await setup();
  await exhaust(() => {
    clock.now += 1000;
    return a.app.request('/api/invites/AAAAAA', from('10.0.0.1'));
  });

  clock.now += WINDOW_MS - LIMIT * 1000;
  const blocked = await a.app.request(valid, from('10.0.0.1'));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '1');

  clock.now += 1000;
  assert.equal((await a.app.request(valid, from('10.0.0.1'))).status, 200);
  // Only one failure left the window, so a single new one blocks again.
  assert.equal((await a.app.request('/api/invites/AAAAAA', from('10.0.0.1'))).status, 404);
  assert.equal((await a.app.request(valid, from('10.0.0.1'))).status, 429);
});

test('without a trusted proxy a forged X-Forwarded-For does not buy a new budget', async () => {
  const { a, valid } = await setup({ trustProxy: false });
  await exhaust((i) => a.app.request('/api/invites/AAAAAA', from(`10.0.2.${i}`)));
  assert.equal((await a.app.request(valid, from('10.0.3.1'))).status, 429);
});

test('without a trusted proxy the budget is keyed by the socket address', async () => {
  const { a, valid } = await setup({ trustProxy: false });
  const socket = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } }) as never;
  await exhaust(() => a.app.request('/api/invites/AAAAAA', from('10.0.3.1'), socket('192.0.2.1')));
  assert.equal((await a.app.request(valid, {}, socket('192.0.2.1'))).status, 429);
  assert.equal((await a.app.request(valid, {}, socket('192.0.2.2'))).status, 200);
});

test('behind a trusted proxy only the hop it appended counts', async () => {
  const { a, valid } = await setup();
  await exhaust((i) => a.app.request('/api/invites/AAAAAA', from(`10.0.4.${i}, 203.0.113.7`)));
  assert.equal((await a.app.request(valid, from('1.1.1.1, 203.0.113.7'))).status, 429);
});

test('IPv6 addresses share the budget of their /64, from the proxy or the socket', async () => {
  const proxied = await setup();
  await exhaust((i) => proxied.a.app.request('/api/invites/AAAAAA', from(`2001:db8:1234:5678::${(i + 1).toString(16)}`)));
  assert.equal((await proxied.a.app.request(proxied.valid, from('2001:db8:1234:5678:aaaa:bbbb:cccc:dddd'))).status, 429);
  assert.equal((await proxied.a.app.request(proxied.valid, from('2001:db8:1234:5679::1'))).status, 200);

  const direct = await setup({ trustProxy: false });
  const socket = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } }) as never;
  await exhaust((i) => direct.a.app.request('/api/invites/AAAAAA', {}, socket(`2001:db8:1234:5678::${(i + 1).toString(16)}`)));
  assert.equal((await direct.a.app.request(direct.valid, {}, socket('2001:db8:1234:5678::ffff'))).status, 429);
  assert.equal((await direct.a.app.request(direct.valid, {}, socket('2001:db8:1234:5679::1'))).status, 200);
});

test('only IPv6 is grouped by prefix', () => {
  assert.equal(clientNetwork('2001:db8:1234:5678::1'), '2001:db8:1234:5678::/64');
  assert.equal(clientNetwork('2001:0DB8:1234:5678:1:2:3:4'), '2001:db8:1234:5678::/64');
  assert.equal(clientNetwork('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(clientNetwork('::1'), '0:0:0:0::/64');
  assert.equal(clientNetwork('fe80::1%eth0'), 'fe80:0:0:0::/64');
  assert.equal(clientNetwork('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(clientNetwork('203.0.113.7'), '203.0.113.7');
  assert.equal(clientNetwork('unknown'), 'unknown');
});

test('the limiter forgets expired keys and caps how many it holds', () => {
  let now = 0;
  const limiter = createAttemptLimiter({ limit: 2, windowMs: 1000, maxKeys: 3, now: () => now });
  for (const key of ['a', 'b', 'c']) {
    limiter.fail([key]);
    limiter.fail([key]);
    now += 1;
  }
  assert.ok(limiter.retryAfter(['a']) > 0);

  limiter.fail(['d']);
  // Over the cap, the key that failed longest ago is the one dropped.
  assert.equal(limiter.retryAfter(['a']), 0);
  assert.ok(limiter.retryAfter(['b']) > 0);
  assert.ok(limiter.retryAfter(['c']) > 0);

  now += 1000;
  assert.equal(limiter.retryAfter(['b', 'c', 'd']), 0);
});
