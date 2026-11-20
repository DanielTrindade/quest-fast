import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_LIMITS, chatLength, chatSegments, findMentions, isEmote, normalizeChatBody, validateChatBody } from './chat.ts';

const ids = (body: string, members: { userId: string; name: string }[]) =>
  findMentions(body, members).map(({ userId, start, end }) => `${userId}:${body.slice(start, end)}`);

test('a message is trimmed and keeps its inner line breaks', () => {
  assert.deepEqual(validateChatBody('  cheguei\r\nfoi mal  '), { body: 'cheguei\nfoi mal' });
  assert.equal(normalizeChatBody('\n oi \n'), 'oi');
});

test('empty, blank and non-text messages are refused', () => {
  for (const value of ['', '   ', '\n\t', undefined, 42, null]) assert.ok('error' in validateChatBody(value), String(value));
});

test('the limit counts characters as people do', () => {
  assert.ok('body' in validateChatBody('a'.repeat(CHAT_LIMITS.maxLength)));
  assert.ok('error' in validateChatBody('a'.repeat(CHAT_LIMITS.maxLength + 1)));
  // An emoji is two UTF-16 units but one character for the limit.
  assert.equal(chatLength('🎲é'), 2);
  assert.ok('body' in validateChatBody('🎲'.repeat(CHAT_LIMITS.maxLength)));
});

test('only emoji, up to the limit, is an emote', () => {
  assert.ok(isEmote('😂'));
  assert.ok(isEmote('💀 💀 💀'));
  assert.ok(isEmote('🫡👍🏽🏳️‍🌈'));
  assert.ok(isEmote('🇧🇷'));
  assert.ok(!isEmote('😂'.repeat(CHAT_LIMITS.emoteMax + 1)));
  assert.ok(!isEmote('kkk 😂'));
  assert.ok(!isEmote('20'));
  assert.ok(!isEmote(''));
});

test('a mention names the member, ignoring case and punctuation after it', () => {
  const members = [{ userId: 'u1', name: 'Bruna' }, { userId: 'u2', name: 'Caio' }];
  assert.deepEqual(ids('@bruna, olha isso. @Caio!', members), ['u1:@bruna', 'u2:@Caio']);
});

test('a longer name wins over one that starts it', () => {
  const members = [{ userId: 'ana', name: 'Ana' }, { userId: 'clara', name: 'Ana Clara' }];
  assert.deepEqual(ids('@Ana Clara chegou', members), ['clara:@Ana Clara']);
  assert.deepEqual(ids('@Ana chegou', members), ['ana:@Ana']);
  assert.deepEqual(ids('@Ana Clarinha chegou', members), ['ana:@Ana']);
});

test('a name inside a longer word is not a mention', () => {
  const members = [{ userId: 'ana', name: 'Ana' }];
  assert.deepEqual(ids('@Anabela e email@Ana', members), []);
});

test('members with the same name are mentioned together', () => {
  const members = [{ userId: 'a', name: 'Lucas' }, { userId: 'b', name: 'lucas' }];
  assert.deepEqual(ids('valeu @Lucas', members), ['a:@Lucas', 'b:@Lucas']);
});

test('a 32-character name with no spaces is mentioned whole', () => {
  const name = 'xX_DestruidorDeMundos_1234567_Xx';
  assert.equal(name.length, 32);
  assert.deepEqual(ids(`@${name} rolou 1`, [{ userId: 'd', name }]), [`d:@${name}`]);
});

test('names with accents and emoji are mentioned', () => {
  const members = [{ userId: 'j', name: 'João Ávila' }, { userId: 'f', name: 'Fê 🐉' }];
  assert.deepEqual(ids('@joão ávila e @Fê 🐉 bora', members), ['j:@joão ávila', 'f:@Fê 🐉']);
});

test('a lone @ or an unknown name mentions no one', () => {
  assert.deepEqual(ids('@ @ninguém', [{ userId: 'a', name: 'Ana' }]), []);
});

test('segments cut the text at its mentions once', () => {
  const body = 'oi @Lucas e @Ana';
  const mentions = findMentions(body, [{ userId: 'a', name: 'Lucas' }, { userId: 'b', name: 'Lucas' }, { userId: 'c', name: 'Ana' }]);
  assert.deepEqual(chatSegments(body, mentions), [
    { text: 'oi ', mention: false },
    { text: '@Lucas', mention: true },
    { text: ' e ', mention: false },
    { text: '@Ana', mention: true },
  ]);
  assert.deepEqual(chatSegments('sem menção', []), [{ text: 'sem menção', mention: false }]);
});

test('segments ignore ranges outside the text', () => {
  assert.deepEqual(chatSegments('oi', [{ userId: 'x', start: 1, end: 9 }]), [{ text: 'oi', mention: false }]);
});
