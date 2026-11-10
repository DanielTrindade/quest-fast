import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CreatedCampaign } from '@quest-fast/shared';
import { asUser, body, createTestApp, signIn, testEnv } from '../testing.ts';
import { cardVersion, inviteMetaTags } from './meta.ts';

const INDEX = '<!doctype html><html><head><title>quest-fast</title></head><body><div id="root"></div></body></html>';

const PROFILES = { lia: { discordId: '111', name: 'Lia Martins', avatarUrl: null } };

function metaContent(html: string, property: string): string | undefined {
  return html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1];
}

test('user-controlled names are HTML-escaped in the tags', () => {
  const html = inviteMetaTags({
    appUrl: 'http://localhost',
    code: 'K7M2QX',
    title: 'Mesa "<b>&"',
    description: "d'<i>",
    imageVersion: 'abc12345',
  });
  assert.ok(html.includes('&quot;&lt;b&gt;&amp;'));
  assert.ok(!html.includes('<b>'));
  assert.ok(!html.includes('<i>'));
});

test('the tags carry the preview, the absolute image and the url', () => {
  const html = inviteMetaTags({
    appUrl: 'https://quest.example',
    code: 'K7M2QX',
    title: 'T',
    description: 'D',
    imageVersion: 'abc12345',
  });
  assert.equal(metaContent(html, 'og:image'), 'https://quest.example/api/invites/K7M2QX/card.png?v=abc12345');
  assert.equal(metaContent(html, 'og:url'), 'https://quest.example/invite/K7M2QX');
  assert.equal(metaContent(html, 'og:image:width'), '1200');
  assert.equal(metaContent(html, 'twitter:card'), 'summary_large_image');
});

test('cardVersion changes when the card inputs change', () => {
  const record = { campaignId: 'c', code: 'K7M2QX', campaignName: 'A', masterName: 'M', masterAvatarUrl: null, playerCount: 0 };
  assert.match(cardVersion(record), /^[0-9a-f]{8}$/);
  assert.notEqual(cardVersion(record), cardVersion({ ...record, campaignName: 'B' }));
  assert.equal(cardVersion(record), cardVersion({ ...record, playerCount: 5 }));
});

test('GET /invite/:code injects the preview into the SPA page', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qf-client-'));
  writeFileSync(join(dir, 'index.html'), INDEX);
  const a = createTestApp(PROFILES, { env: { ...testEnv, clientDir: dir }, serveClient: true });
  const master = asUser(a, await signIn(a, 'lia'));
  const campaign = await body<CreatedCampaign>(
    await master('/api/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Ecos de Strahd', description: '' }) }),
  );

  const response = await a.app.request(`/invite/${campaign.inviteCode}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  const html = await response.text();
  assert.ok(html.includes('<div id="root">'));
  assert.ok(metaContent(html, 'og:title')?.includes('Ecos de Strahd'));
  assert.match(metaContent(html, 'og:image') ?? '', /^http:\/\/localhost\/api\/invites\/[A-Z0-9]+\/card\.png\?v=/);

  const unknown = await a.app.request('/invite/XXXXXX');
  assert.equal(unknown.status, 200);
  const generic = await unknown.text();
  assert.equal(metaContent(generic, 'og:title'), 'Quest Fast');
  assert.ok(!generic.includes('Ecos de Strahd'));
  assert.equal(metaContent(generic, 'og:image'), undefined);

  const spa = await a.app.request('/campaigns');
  assert.equal(await spa.text(), INDEX);
});
