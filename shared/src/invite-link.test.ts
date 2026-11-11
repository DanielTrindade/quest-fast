import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_PATH_PREFIX,
  invitePath,
  invitePreviewText,
  loginFailurePath,
  safeReturnPath,
  whatsAppShareUrl,
} from './invite-link.ts';

test('builds the invite path from the code', () => {
  assert.equal(INVITE_PATH_PREFIX, '/invite/');
  assert.equal(invitePath('K7M2QX'), '/invite/K7M2QX');
});

test('preview text names the table and the master', () => {
  assert.deepEqual(invitePreviewText('A Maldição de Strahd', 'Marina'), {
    title: 'A Maldição de Strahd',
    description: 'Marina está reunindo o grupo. Tem um lugar na mesa esperando por você.',
  });
});

test('WhatsApp share url carries the encoded message', () => {
  const url = whatsAppShareUrl('Strahd', 'https://x/invite/AB');
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(url.slice('https://wa.me/?text='.length)), 'Bora jogar Strahd? 🎲 https://x/invite/AB');
});

test('safeReturnPath accepts only same-origin paths', () => {
  assert.equal(safeReturnPath('/invite/ABC?join=1'), '/invite/ABC?join=1');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '', 42, '/a\nb', '/a\u007fb', undefined]) {
    assert.equal(safeReturnPath(bad), undefined);
  }
  assert.equal(safeReturnPath('/' + 'a'.repeat(511)), '/' + 'a'.repeat(511));
  assert.equal(safeReturnPath('/' + 'a'.repeat(512)), undefined);
});

test('loginFailurePath keeps invite returns and falls back to login', () => {
  assert.equal(loginFailurePath('/invite/AB?join=1'), '/invite/AB?join=1&error=discord');
  assert.equal(loginFailurePath('/invite/AB'), '/invite/AB?error=discord');
  assert.equal(loginFailurePath('/campaigns/x'), '/login?error=discord&next=%2Fcampaigns%2Fx');
  assert.equal(loginFailurePath(undefined), '/login?error=discord');
});
