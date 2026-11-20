import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatSession } from '../../hooks/useChatSession';
import { chatQuery, unreadSince, type ChatUnread } from '../../lib/chat-cache';

/**
 * The unread count beside the Chat tab. While the chat is in sight, every new
 * line counts as read; the first page read is the baseline, so the history
 * never shows as unread.
 */
export function useChatUnread(campaignId: string, viewerId: string, visible: boolean): ChatUnread | null {
  const { lastReadId, setLastReadId } = useChatSession();
  const queryClient = useQueryClient();
  const chat = useQuery(chatQuery(campaignId, queryClient));
  const messages = chat.data?.messages;
  const newest = messages?.at(-1)?.id ?? null;
  const settled = messages !== undefined;
  // The mark lives in the campaign's session, above this screen, so it is
  // written after the render that saw the new line.
  useEffect(() => {
    if (settled && (visible || lastReadId === undefined) && newest !== lastReadId) setLastReadId(newest);
  }, [settled, visible, newest, lastReadId, setLastReadId]);
  if (!messages || visible) return null;
  const unread = unreadSince(messages, lastReadId, viewerId);
  return unread.count > 0 ? unread : null;
}
