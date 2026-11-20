import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ChatMessageView } from '@quest-fast/shared';

/**
 * What the chat keeps outside its panel: the draft, the reply being written,
 * the last line read and the field to focus. It lives at the campaign's
 * level, so a tab switch, entering or leaving the full screen (where the
 * panel mounts somewhere else) and going to another screen and back lose
 * none of it. Unread is this browser tab's only: the server has no "read".
 */
export type ChatSession = {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  replyTo: ChatMessageView | null;
  setReplyTo: Dispatch<SetStateAction<ChatMessageView | null>>;
  /** `undefined` until the chat is read once; `null` when it was read empty. */
  lastReadId: string | null | undefined;
  setLastReadId: (id: string | null) => void;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
};

export const ChatSessionContext = createContext<ChatSession | null>(null);

export function useChatSession(): ChatSession {
  const session = useContext(ChatSessionContext);
  if (!session) throw new Error('useChatSession outside ChatSessionProvider');
  return session;
}
