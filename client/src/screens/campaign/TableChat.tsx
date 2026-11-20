import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMessageView } from '@quest-fast/shared';
import { ChatPanel } from '../../components/ChatPanel';
import { useCampaignSocketStatus } from '../../hooks/useCampaignSocket';
import { useChatSession } from '../../hooks/useChatSession';
import { useNotify } from '../../hooks/use-notify';
import { ApiError, api } from '../../lib/api';
import { chatQuery, mergeChatMessage, prependChatPage, removeChatMessage } from '../../lib/chat-cache';
import type { ChatMember } from '../../lib/chat-compose';

/** A refused send keeps the text; the reason shows under the field. */
function sendFailure(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Sem conexão: a mensagem não saiu. Tente de novo.';
}

/** Who the composer may mention: every other member, with the active character's name. */
function useChatMembers(campaignId: string, viewerId: string): ChatMember[] {
  const members = useQuery({ queryKey: ['members', campaignId], queryFn: () => api.members(campaignId) });
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => api.characters(campaignId) });
  return (members.data?.members ?? [])
    .filter(({ userId }) => userId !== viewerId)
    .map(({ userId, name }) => ({
      userId,
      name,
      characterName: characters.data?.characters.find((character) => character.ownerId === userId && character.active)?.name ?? null,
    }));
}

/** The chat of the table, wired: the cache, the socket's lines and the session's draft. */
export function TableChat({ campaignId, viewerId, isMaster }: { campaignId: string; viewerId: string; isMaster: boolean }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const status = useCampaignSocketStatus();
  const session = useChatSession();
  const chat = useQuery(chatQuery(campaignId));
  const members = useChatMembers(campaignId, viewerId);
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(() => new Set());

  const loadMore = useMutation({
    mutationFn: (cursor: string) => api.chat(campaignId, cursor),
    onSuccess: (page) => prependChatPage(queryClient, campaignId, page),
  });

  const send = useMutation({
    mutationFn: ({ body, replyToId }: { body: string; replyToId?: string; source: 'draft' | 'reaction' }) =>
      api.sendChat(campaignId, { body, ...(replyToId ? { replyToId } : {}) }),
    onSuccess: ({ message }, { source }) => {
      mergeChatMessage(queryClient, campaignId, message);
      if (source === 'draft') session.setDraft('');
      session.setReplyTo(null);
    },
  });

  const remove = useMutation({
    mutationFn: (message: ChatMessageView) => api.removeChat(campaignId, message.id),
    onMutate: (message) => setRemovingIds((ids) => new Set(ids).add(message.id)),
    onSuccess: (_, message) => {
      removeChatMessage(queryClient, campaignId, message.id);
      if (session.replyTo?.id === message.id) session.setReplyTo(null);
    },
    onError: (error) => notify({ variant: 'error', title: error instanceof ApiError ? error.message : 'Não foi possível remover a mensagem.' }),
    onSettled: (_, __, message) => setRemovingIds((ids) => {
      const next = new Set(ids);
      next.delete(message.id);
      return next;
    }),
  });

  const nextCursor = chat.data?.nextCursor ?? null;
  // A reply to a line removed meanwhile quotes it as removed, never its old text.
  const replyTo = session.replyTo && chat.data?.messages.find(({ id }) => id === session.replyTo!.id);

  return (
    <ChatPanel messages={chat.data?.messages ?? []} viewerId={viewerId} viewerMaster={isMaster} members={members}
      state={chat.isPending ? 'loading' : chat.isError ? 'error' : 'ready'}
      loadError={chat.isError ? 'Não foi possível carregar o chat.' : null}
      onRetry={() => { void chat.refetch(); }}
      hasMore={nextCursor !== null}
      onLoadMore={() => { if (nextCursor && !loadMore.isPending) loadMore.mutate(nextCursor); }}
      loadingMore={loadMore.isPending}
      loadMoreError={loadMore.isError ? 'Não foi possível carregar mensagens anteriores.' : null}
      status={status}
      draft={session.draft}
      onDraftChange={(draft) => {
        if (send.isError) send.reset();
        session.setDraft(draft);
      }}
      replyTo={replyTo ?? session.replyTo}
      onReply={(message) => {
        session.setReplyTo(message);
        if (message) session.fieldRef.current?.focus();
      }}
      onSend={(body, source) => send.mutate({ body, source, ...(session.replyTo ? { replyToId: session.replyTo.id } : {}) })}
      sending={send.isPending}
      sendError={send.isError ? sendFailure(send.error) : null}
      onRemove={(message) => remove.mutate(message)}
      removingIds={removingIds}
      fieldRef={session.fieldRef} />
  );
}
