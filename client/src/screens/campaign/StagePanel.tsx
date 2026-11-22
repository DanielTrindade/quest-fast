import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMessageView } from '@quest-fast/shared';
import { ChatToasts, type ChatToast } from '../../components/ChatToasts';
import { api } from '../../lib/api';
import { chatQuery } from '../../lib/chat-cache';
import { TableActionPanel, type StagePanelState } from './TableActionPanel';

const SHOWN_MS = 8_000;
const FADE_MS = 300;
const MAX_TOASTS = 3;

type Shown = { id: string; at: number; leaving: boolean };

const toastable = (message: ChatMessageView | undefined, viewerId: string) =>
  message && message.author.userId !== viewerId && !message.removed ? message : null;

/**
 * The lines from other people that arrive while `active` (the panel folded):
 * at most three at a time, each leaving after about eight seconds with a
 * short fade. Unfolding clears them; a removed line goes at once.
 */
function useChatToasts(campaignId: string, viewerId: string, active: boolean): { toasts: ChatToast[]; latest: string } {
  const queryClient = useQueryClient();
  const chat = useQuery(chatQuery(campaignId, queryClient));
  const messages = chat.data?.messages;
  const newest = messages?.at(-1);
  const [seen, setSeen] = useState<string | undefined>(newest?.id);
  const [shown, setShown] = useState<Shown[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);
  // Render-time, like any derived state: a new newest line, after the first
  // read, from someone else, while folded, becomes a toast.
  if (newest?.id !== seen) {
    setSeen(newest?.id);
    const fresh = seen !== undefined && active ? toastable(newest, viewerId) : null;
    if (fresh) {
      setShown((list) => [...list, { id: fresh.id, at: Date.now(), leaving: false }].slice(-MAX_TOASTS));
      setLatestId(fresh.id);
    }
  }
  // Unfolded, nothing is pending: folding again must not announce an old line.
  if (!active && shown.length > 0) setShown([]);
  if (!active && latestId !== null) setLatestId(null);
  useExpiry(shown, setShown);
  return present(messages ?? [], shown, active ? latestId : null);
}

/** Each toast fades a little before its time is up, then leaves: one timer, for the next change. */
function useExpiry(shown: Shown[], setShown: Dispatch<SetStateAction<Shown[]>>) {
  useEffect(() => {
    if (shown.length === 0) return undefined;
    const due = Math.min(...shown.map(({ at, leaving }) => at + SHOWN_MS - (leaving ? 0 : FADE_MS))) - Date.now();
    const timer = setTimeout(() => setShown((list) => expire(list, Date.now())), Math.max(0, due));
    return () => clearTimeout(timer);
  }, [shown, setShown]);
}

function expire(list: Shown[], now: number): Shown[] {
  return list
    .filter(({ at }) => at + SHOWN_MS > now)
    .map((item) => (!item.leaving && item.at + SHOWN_MS - FADE_MS <= now ? { ...item, leaving: true } : item));
}

/** The toasts and the announcement as the cache has the lines now: a removed one is gone from both. */
function present(messages: readonly ChatMessageView[], shown: Shown[], latestId: string | null): { toasts: ChatToast[]; latest: string } {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const toasts = shown.flatMap(({ id, leaving }) => {
    const message = byId.get(id);
    return message && !message.removed ? [{ message, leaving }] : [];
  });
  const latest = latestId ? byId.get(latestId) : undefined;
  return { toasts, latest: latest && !latest.removed ? `${latest.author.name}: ${latest.body}` : '' };
}

/**
 * The full screen's panel: the table panel with Mapa, folded into a rail on
 * demand, and, while folded, the new chat lines over the map (`overlay` is a
 * corner of the map the stage provides). Screen readers get those lines from
 * a live region here, outside the hidden panel and outside anything inert.
 */
export function StagePanel({ campaignId, isMaster, overlay, ...stage }: Omit<StagePanelState, 'focusChat'> & {
  campaignId: string;
  isMaster: boolean;
  /** A corner over the map, for the chat's lines while folded. */
  overlay: HTMLElement | null;
}) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const currentUserId = me.data?.user.id ?? '';
  const [focusChat, setFocusChat] = useState(0);
  const { toasts, latest } = useChatToasts(campaignId, currentUserId, stage.collapsed);
  const openChat = () => {
    stage.onTabChange('chat');
    stage.onCollapsedChange(false);
    setFocusChat((value) => value + 1);
  };

  return (
    <>
      {/* With the map open, the feed is one of the panel's tabs. */}
      <TableActionPanel campaignId={campaignId} isMaster={isMaster} currentUserId={currentUserId} withFeed
        stage={{ ...stage, focusChat }} className="h-full min-h-0" />
      {overlay && createPortal(<ChatToasts toasts={toasts} onOpen={openChat} />, overlay)}
      <p className="sr-only" aria-live="polite" data-slot="stage-chat-announcer">{latest}</p>
    </>
  );
}
