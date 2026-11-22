import type { QueryClient } from '@tanstack/react-query';
import type { ChatMessageView, ChatPageResponse } from '@quest-fast/shared';
import { api } from './api';

/**
 * The chat as the client keeps it: the server's pages, plus the ids removed
 * while this tab watched. A removal can arrive before the message itself (the
 * socket outran the sender's HTTP answer), and it must win when that late
 * answer lands.
 */
export type ChatCache = ChatPageResponse & { removedIds?: readonly string[] };

export const chatKey = (campaignId: string) => ['chat', campaignId] as const;

/**
 * The first page, reconciled with what this tab already knows: a removal that
 * reached the socket while the request was out wins over the answer, and lines
 * that arrived meanwhile stay at the end.
 */
export function chatQuery(campaignId: string, queryClient: QueryClient) {
  return {
    queryKey: chatKey(campaignId),
    queryFn: async (): Promise<ChatCache> => {
      const page = await api.chat(campaignId);
      // Read after the answer, not before: what came by the socket meanwhile counts.
      return reconcile(queryClient.getQueryData<ChatCache>(chatKey(campaignId)), page);
    },
  };
}

const blank = (message: ChatMessageView): ChatMessageView => ({ ...message, body: null, mentions: [], removed: true });

/** A message as this tab may show it: nothing of a removed line, nor of its quote. */
function redact(message: ChatMessageView, removed: ReadonlySet<string>): ChatMessageView {
  const own = removed.has(message.id) && !message.removed ? blank(message) : message;
  if (own.replyTo && own.replyTo.body !== null && removed.has(own.replyTo.id)) return { ...own, replyTo: { ...own.replyTo, body: null } };
  return own;
}

const removedOf = (cache: ChatCache | undefined): ReadonlySet<string> => new Set(cache?.removedIds ?? []);

export function reconcile(current: ChatCache | undefined, page: ChatPageResponse): ChatCache {
  const removed = removedOf(current);
  const known = new Set(page.messages.map(({ id }) => id));
  const newest = page.messages.at(-1)?.createdAt ?? '';
  const tail = (current?.messages ?? []).filter(({ id, createdAt }) => !known.has(id) && createdAt >= newest);
  return {
    messages: [...page.messages, ...tail].map((message) => redact(message, removed)),
    nextCursor: page.nextCursor,
    ...(current?.removedIds ? { removedIds: current.removedIds } : {}),
  };
}

/** A message from the socket or from the sender's answer; the same id twice is one line. */
export function mergeChatMessage(queryClient: QueryClient, campaignId: string, message: ChatMessageView): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return undefined;
    const incoming = redact(message, removedOf(current));
    if (current.messages.some(({ id }) => id === message.id)) {
      return { ...current, messages: current.messages.map((existing) => existing.id === message.id && !existing.removed ? incoming : existing) };
    }
    return { ...current, messages: [...current.messages, incoming] };
  });
}

/**
 * A removed message loses its text here too, and so does every quote of it:
 * nothing of what was removed stays on screen. The id is kept, so a late
 * answer, page or quote never brings it back.
 */
export function removeChatMessage(queryClient: QueryClient, campaignId: string, messageId: string): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return undefined;
    const removedIds = current.removedIds?.includes(messageId) ? current.removedIds : [...(current.removedIds ?? []), messageId];
    const removed = new Set(removedIds);
    return { ...current, removedIds, messages: current.messages.map((message) => redact(message, removed)) };
  });
}

/** An older page goes on top; lines already there (the live tail) are not repeated. */
export function prependChatPage(queryClient: QueryClient, campaignId: string, page: ChatPageResponse): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return page;
    const known = new Set(current.messages.map(({ id }) => id));
    const removed = removedOf(current);
    const older = page.messages.filter(({ id }) => !known.has(id)).map((message) => redact(message, removed));
    return { ...current, messages: [...older, ...current.messages], nextCursor: page.nextCursor };
  });
}

export type ChatUnread = { count: number; mention: boolean };

/**
 * What arrived after the last line the reader saw, from other people.
 * `undefined` is "not read yet" (nothing counts); `null` is "read while the
 * chat was empty" (everything counts). A last-read id no longer in the list
 * (a refetch dropped it) counts nothing: better to miss a count than to light
 * up the whole history.
 */
export function unreadSince(messages: readonly ChatMessageView[], lastReadId: string | null | undefined, viewerId: string): ChatUnread {
  if (lastReadId === undefined) return { count: 0, mention: false };
  const index = lastReadId === null ? -1 : messages.findIndex(({ id }) => id === lastReadId);
  if (lastReadId !== null && index < 0) return { count: 0, mention: false };
  const fresh = messages.slice(index + 1).filter((message) => message.author.userId !== viewerId && !message.removed);
  return { count: fresh.length, mention: fresh.some((message) => message.mentions.some(({ userId }) => userId === viewerId)) };
}
