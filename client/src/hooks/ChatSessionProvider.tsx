import { useMemo, useState, type ReactNode } from 'react';
import type { ChatMessageView } from '@quest-fast/shared';
import { ChatSessionContext, type ChatSession } from './useChatSession';

/** Keyed by the campaign where it is mounted: another campaign starts clean. */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const [lastReadId, setLastReadId] = useState<string | null | undefined>(undefined);
  const [fullscreen, setFullscreen] = useState(false);
  const value = useMemo<ChatSession>(
    () => ({ draft, setDraft, replyTo, setReplyTo, lastReadId, setLastReadId, fullscreen, setFullscreen }),
    [draft, replyTo, lastReadId, fullscreen],
  );
  return <ChatSessionContext value={value}>{children}</ChatSessionContext>;
}
