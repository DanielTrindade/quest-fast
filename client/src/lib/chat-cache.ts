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

export function chatQuery(campaignId: string) {
  return { queryKey: chatKey(campaignId), queryFn: (): Promise<ChatCache> => api.chat(campaignId) };
}

const blank = (message: ChatMessageView): ChatMessageView => ({ ...message, body: null, mentions: [], removed: true });

/** A message from the socket or from the sender's answer; the same id twice is one line. */
export function mergeChatMessage(queryClient: QueryClient, campaignId: string, message: ChatMessageView): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return undefined;
    const incoming = current.removedIds?.includes(message.id) ? blank(message) : message;
    if (current.messages.some(({ id }) => id === message.id)) {
      return { ...current, messages: current.messages.map((existing) => existing.id === message.id && !existing.removed ? incoming : existing) };
    }
    return { ...current, messages: [...current.messages, incoming] };
  });
}

/**
 * A removed message loses its text here too, and so does every quote of it:
 * nothing of what was removed stays on screen.
 */
export function removeChatMessage(queryClient: QueryClient, campaignId: string, messageId: string): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return undefined;
    return {
      ...current,
      removedIds: current.removedIds?.includes(messageId) ? current.removedIds : [...(current.removedIds ?? []), messageId],
      messages: current.messages.map((message) => {
        if (message.id === messageId) return blank(message);
        if (message.replyTo?.id === messageId) return { ...message, replyTo: { ...message.replyTo, body: null } };
        return message;
      }),
    };
  });
}

/** An older page goes on top; lines already there (the live tail) are not repeated. */
export function prependChatPage(queryClient: QueryClient, campaignId: string, page: ChatPageResponse): void {
  queryClient.setQueryData<ChatCache>(chatKey(campaignId), (current) => {
    if (!current) return page;
    const known = new Set(current.messages.map(({ id }) => id));
    const removed = new Set(current.removedIds ?? []);
    const older = page.messages.filter(({ id }) => !known.has(id)).map((message) => removed.has(message.id) ? blank(message) : message);
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
