import { useState, type RefObject } from 'react';
import type { ChatMessageView } from '@quest-fast/shared';
import type { SocketStatus } from '../lib/campaign-socket';
import type { ChatMember } from '../lib/chat-compose';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { ChatComposer } from './ChatComposer';
import { ChatLine } from './ChatLine';
import { FeedFollow } from './FeedFollow';
import { Skeleton } from './Skeleton';

const NEW_MESSAGES = ['nova mensagem', 'novas mensagens'] as const;
const SKELETON_WIDTHS = ['72%', '48%', '86%', '60%', '38%'];

const STATUS_LABEL: Record<SocketStatus, string> = { connected: 'ao vivo', connecting: 'conectando', disconnected: 'reconectando' };

/** What a new message says to a screen reader; the list itself is not live. */
function announcement(message: ChatMessageView): string {
  return `${message.author.name}: ${message.body ?? 'mensagem removida'}`;
}

export type ChatPanelProps = {
  messages: readonly ChatMessageView[];
  viewerId: string;
  viewerMaster: boolean;
  members: readonly ChatMember[];
  state: 'loading' | 'error' | 'ready';
  loadError?: string | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  status: SocketStatus;
  draft: string;
  onDraftChange: (draft: string) => void;
  replyTo: ChatMessageView | null;
  onReply: (message: ChatMessageView | null) => void;
  onSend: (body: string, source: 'draft' | 'reaction') => void;
  sending?: boolean;
  sendError?: string | null;
  onRemove: (message: ChatMessageView) => void;
  removingIds?: ReadonlySet<string>;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
};

/**
 * What the live region says: only a line that arrives after the first read,
 * from someone else. The history that loads is the baseline, even when it is
 * empty, and a line removed after it was announced takes its text out too.
 */
function useAnnouncement(messages: readonly ChatMessageView[], viewerId: string, ready: boolean): string {
  const newest = messages.at(-1);
  const [heard, setHeard] = useState<{ ready: boolean; id: string | undefined; text: string }>({ ready, id: newest?.id, text: '' });
  if (ready && !heard.ready) setHeard({ ready, id: newest?.id, text: '' });
  else if (ready && newest?.id !== heard.id) {
    setHeard({ ready, id: newest?.id, text: newest && newest.author.userId !== viewerId ? announcement(newest) : '' });
  }
  return messages.find(({ id }) => id === heard.id)?.removed ? '' : heard.text;
}

/** The list, or what stands in for it while it loads, fails or is empty. */
function ChatBody(props: ChatPanelProps) {
  const { messages, viewerId, viewerMaster, state } = props;
  if (state === 'loading') {
    return (
      <div className="grid content-start gap-3 py-2" aria-busy="true">
        {SKELETON_WIDTHS.map((width) => <Skeleton key={width} width={width} label="Carregando mensagens…" />)}
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className="grid content-start justify-items-start gap-3 py-2">
        <p className="m-0 text-small text-danger-text">{props.loadError ?? 'Não foi possível carregar o chat.'}</p>
        <Button variant="secondary" onClick={props.onRetry}>Tentar novamente</Button>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div data-slot="chat-empty" className="grid content-center gap-1 px-2 py-6 text-center text-small text-text-secondary">
        <p className="m-0 font-semibold text-foreground">A mesa ainda não falou nada.</p>
        <p className="m-0">O que você mandar aqui aparece para todos da campanha. Rolagens ficam no Feed.</p>
      </div>
    );
  }
  const newest = messages.at(-1)!;
  return (
    <FeedFollow fill ids={messages.map(({ id }) => id)} followId={newest.author.userId === viewerId ? newest.id : undefined} newLabel={NEW_MESSAGES}
      hasMore={props.hasMore} onLoadMore={props.onLoadMore} loadingMore={props.loadingMore} loadMoreError={props.loadMoreError}>
      <ol className="m-0 grid list-none gap-px p-0">
        {messages.map((message) => (
          <ChatLine key={message.id} message={message} viewerId={viewerId}
            canRemove={viewerMaster || message.author.userId === viewerId}
            removing={props.removingIds?.has(message.id)}
            onReply={props.onReply} onRemove={props.onRemove} />
        ))}
      </ol>
    </FeedFollow>
  );
}

/**
 * The table chat: a live column of running lines and the composer pinned
 * under it. The list scrolls inside, follows the end and counts what arrived
 * while the reader was above. Only talk lives here; the game stays in the
 * feed. Presentational: the screen owns the messages, the draft and the reply.
 */
export function ChatPanel(props: ChatPanelProps) {
  const { status, className } = props;
  const announced = useAnnouncement(props.messages, props.viewerId, props.state === 'ready');

  return (
    <section aria-label="Chat da mesa" data-slot="chat-panel"
      className={cn('grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1', className)}>
      <p className="m-0 flex justify-end text-micro text-text-muted">
        <span data-slot="chat-status" data-status={status} className="data-[status=connected]:text-success-text">{STATUS_LABEL[status]}</span>
      </p>
      <ChatBody {...props} />
      <ChatComposer draft={props.draft} onDraftChange={props.onDraftChange} replyTo={props.replyTo}
        onCancelReply={() => props.onReply(null)} members={props.members} onSend={props.onSend}
        sending={props.sending} error={props.sendError} offline={status === 'disconnected'} fieldRef={props.fieldRef} />
      <p className="sr-only" aria-live="polite" data-slot="chat-announcer">{announced}</p>
    </section>
  );
}
