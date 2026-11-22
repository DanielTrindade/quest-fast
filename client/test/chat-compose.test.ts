import test from 'node:test';
import assert from 'node:assert/strict';
import { chatCounter, insertMention, mentionCandidates, mentionQuery, unreadLabel } from '../src/lib/chat-compose.ts';

const members = [
  { userId: 'a', name: 'Ana Clara', characterName: 'Lyra' },
  { userId: 'b', name: 'Ana', characterName: null },
  { userId: 'c', name: 'Bruno', characterName: 'Thorin' },
];

test('an @ at the start of a word opens the mention query up to the caret', () => {
  assert.deepEqual(mentionQuery('oi @an', 6), { start: 3, query: 'an' });
  assert.deepEqual(mentionQuery('@', 1), { start: 0, query: '' });
  assert.deepEqual(mentionQuery('oi @Ana Cl', 10), { start: 3, query: 'Ana Cl' });
});

test('an @ inside a word, past a line break or too far back is not a mention', () => {
  assert.equal(mentionQuery('email@ana', 9), null);
  assert.equal(mentionQuery('@ana\nmais', 9), null);
  assert.equal(mentionQuery(`@${'a'.repeat(33)}`, 34), null);
  assert.equal(mentionQuery('sem arroba', 10), null);
});

test('candidates start with the query, ignoring case, shortest first', () => {
  assert.deepEqual(mentionCandidates(members, 'an').map(({ userId }) => userId), ['b', 'a']);
  assert.deepEqual(mentionCandidates(members, 'ANA C').map(({ userId }) => userId), ['a']);
  assert.deepEqual(mentionCandidates(members, '').map(({ userId }) => userId), ['b', 'c', 'a']);
  assert.deepEqual(mentionCandidates(members, 'zé'), []);
});

test('picking a member replaces the query and leaves the caret after a space', () => {
  assert.deepEqual(insertMention('oi @an tudo', 3, 6, 'Ana Clara'), { text: 'oi @Ana Clara tudo', caret: 14 });
  assert.deepEqual(insertMention('@b', 0, 2, 'Bruno'), { text: '@Bruno ', caret: 7 });
});

test('the counter shows from 240, warns from 290 and flags past 300', () => {
  assert.equal(chatCounter('a'.repeat(239)).shown, false);
  assert.deepEqual(chatCounter('a'.repeat(240)), { shown: true, tone: 'normal', length: 240, over: false });
  assert.equal(chatCounter('a'.repeat(290)).tone, 'warn');
  assert.equal(chatCounter('a'.repeat(301)).over, true);
  assert.equal(chatCounter('👍🏽'.repeat(300)).over, false);
});

test('the unread label says how many and whether the reader was mentioned', () => {
  assert.equal(unreadLabel(1, false), '1 mensagem nova');
  assert.equal(unreadLabel(3, true), '3 mensagens novas, com menção a você');
});
