import test from 'node:test';
import assert from 'node:assert/strict';
import { initials } from './initials.ts';

test('first and last lettered word', () => {
  assert.equal(initials('Aleksandra Wiśniewska-Kowalczyk'), 'AW');
  assert.equal(initials('Jo'), 'J');
  assert.equal(initials('Nguyễn Thị Phương Thảo'), 'NT');
});

test('emoji, flags and numbers never become an initial', () => {
  assert.equal(initials('🐉 Drako Fumegante'), 'DF');
  assert.equal(initials('🇧🇷 Bruno'), 'B');
  assert.equal(initials('Aventureiro 10'), 'A');
  assert.equal(initials('🐉'), '🐉');
  assert.equal(initials('  '), '?');
});

test('scripts without case keep a single letter', () => {
  assert.equal(initials('محمد العلي'), 'م');
});

test('skipped words fall back to every lettered word', () => {
  const connective = (word: string) => word.length <= 2;
  assert.equal(initials('A névoa de Baróvia', connective), 'NB');
  assert.equal(initials('de e da', connective), 'DD');
});
