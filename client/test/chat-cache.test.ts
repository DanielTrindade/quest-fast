import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import type { ChatMessageView } from '@quest-fast/shared';
import { chatKey, mergeChatMessage, prependChatPage, reconcile, removeChatMessage, unreadSince, type ChatCache } from '../src/lib/chat-cache.ts';

const CAMPAIGN = 'c1';

function message(id: string, userId = 'u-bruna', extra: Partial<ChatMessageView> = {}): ChatMessageView {
  return {
    id,
    campaignId: CAMPAIGN,
    author: { userId, name: userId, master: false, character: null },
    body: `texto ${id}`,
    mentions: [],
    replyTo: null,
    removed: false,
    createdAt: '2026-11-20T22:00:00.000Z',
    ...extra,
  };
}

function seeded(messages: ChatMessageView[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData<ChatCache>(chatKey(CAMPAIGN), { messages, nextCursor: null });
  return queryClient;
}

const read = (queryClient: QueryClient) => queryClient.getQueryData<ChatCache>(chatKey(CAMPAIGN))!;

test('the same message from the answer and from the socket is one line', () => {
  const queryClient = seeded([message('m1')]);
  mergeChatMessage(queryClient, CAMPAIGN, message('m2'));
  mergeChatMessage(queryClient, CAMPAIGN, message('m2'));
  assert.deepEqual(read(queryClient).messages.map(({ id }) => id), ['m1', 'm2']);
});

test('a removal wipes the text and every quote of it', () => {
  const queryClient = seeded([message('m1'), message('m2', 'u-caio', { replyTo: { id: 'm1', authorName: 'Bruna', body: 'texto m1' } })]);
  removeChatMessage(queryClient, CAMPAIGN, 'm1');
  const [removed, reply] = read(queryClient).messages;
  assert.equal(removed!.body, null);
  assert.equal(removed!.removed, true);
  assert.equal(reply!.replyTo!.body, null);
});

test('a late answer never brings back a removed text', () => {
  const queryClient = seeded([message('m1')]);
  // The master removed it before the sender's answer arrived.
  removeChatMessage(queryClient, CAMPAIGN, 'm2');
  mergeChatMessage(queryClient, CAMPAIGN, message('m2'));
  const late = read(queryClient).messages.find(({ id }) => id === 'm2')!;
  assert.equal(late.body, null);
  // And a removed line already on screen stays removed.
  removeChatMessage(queryClient, CAMPAIGN, 'm1');
  mergeChatMessage(queryClient, CAMPAIGN, message('m1'));
  assert.equal(read(queryClient).messages[0]!.body, null);
});

test('an older page goes on top without repeating the live tail', () => {
  const queryClient = seeded([message('m3'), message('m4')]);
  prependChatPage(queryClient, CAMPAIGN, { messages: [message('m1'), message('m2'), message('m3')], nextCursor: 'm1' });
  assert.deepEqual(read(queryClient).messages.map(({ id }) => id), ['m1', 'm2', 'm3', 'm4']);
  assert.equal(read(queryClient).nextCursor, 'm1');
});

test('nothing is merged before the chat was read once', () => {
  const queryClient = new QueryClient();
  mergeChatMessage(queryClient, CAMPAIGN, message('m1'));
  removeChatMessage(queryClient, CAMPAIGN, 'm1');
  assert.equal(queryClient.getQueryData(chatKey(CAMPAIGN)), undefined);
});

test('unread counts other people after the last read line, with mentions', () => {
  const me = 'u-rafael';
  const list = [
    message('m1'),
    message('m2', me),
    message('m3'),
    message('m4', 'u-caio', { mentions: [{ userId: me, start: 0, end: 7 }] }),
    message('m5', 'u-caio', { removed: true, body: null }),
  ];
  assert.deepEqual(unreadSince(list, 'm1', me), { count: 2, mention: true });
  assert.deepEqual(unreadSince(list, 'm4', me), { count: 0, mention: false });
  assert.deepEqual(unreadSince(list, undefined, me), { count: 0, mention: false });
  // Read while empty: all that came after counts.
  assert.deepEqual(unreadSince(list, null, me), { count: 3, mention: true });
  assert.deepEqual(unreadSince(list, 'gone', me), { count: 0, mention: false });
});

const quoting = (id: string, target: string) => message(id, 'u-caio', { replyTo: { id: target, authorName: 'Bruna', body: `texto ${target}` } });

test('a quote of a removed line never comes back with a late answer or page', () => {
  const queryClient = seeded([message('m1'), quoting('m2', 'm1')]);
  removeChatMessage(queryClient, CAMPAIGN, 'm1');
  // B already known, answered again late; and C, new, quoting the removed A.
  mergeChatMessage(queryClient, CAMPAIGN, quoting('m2', 'm1'));
  mergeChatMessage(queryClient, CAMPAIGN, quoting('m3', 'm1'));
  // An older page that still quotes it.
  prependChatPage(queryClient, CAMPAIGN, { messages: [quoting('m0', 'm1')], nextCursor: null });
  for (const line of read(queryClient).messages.filter(({ replyTo }) => replyTo?.id === 'm1')) assert.equal(line.replyTo!.body, null, line.id);
});

test('a first page that was out during a removal does not undo it', () => {
  const queryClient = seeded([message('m1'), message('m2')]);
  // The GET left, the socket removed m1, then the stale answer lands.
  removeChatMessage(queryClient, CAMPAIGN, 'm1');
  const stale = { messages: [message('m1'), quoting('m2', 'm1')], nextCursor: null };
  const next = reconcile(read(queryClient), stale);
  assert.equal(next.messages[0]!.body, null);
  assert.equal(next.messages[1]!.replyTo!.body, null);
  assert.deepEqual(next.removedIds, ['m1']);
  // And after that refetch, an old send answer still finds the removal.
  queryClient.setQueryData(chatKey(CAMPAIGN), next);
  mergeChatMessage(queryClient, CAMPAIGN, message('m1'));
  assert.equal(read(queryClient).messages[0]!.body, null);
});

test('lines that arrived while the first page was out stay at its end', () => {
  const later = message('m9', 'u-bruna', { createdAt: '2026-11-20T22:05:00.000Z' });
  const next = reconcile({ messages: [message('m1'), later], nextCursor: null }, { messages: [message('m1'), message('m2')], nextCursor: 'm1' });
  assert.deepEqual(next.messages.map(({ id }) => id), ['m1', 'm2', 'm9']);
  assert.equal(next.nextCursor, 'm1');
});

