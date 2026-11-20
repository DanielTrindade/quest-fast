import { memo } from 'react';
import { ArrowBendUpLeft, ArrowElbowDownRight, Trash } from '@phosphor-icons/react';
import { chatSegments, isEmote, type ChatMessageView } from '@quest-fast/shared';
import { formatEventTime } from '../lib/format';
import { cn } from '../lib/utils';
import { TokenDisc } from './TokenDisc';

// Closed to no width until hover or focus reaches the line (a focused button
// opens its own line), and always open on a touch screen.
const lineAction = 'inline-flex h-8 w-0 overflow-hidden group-hover:w-8 group-focus-within:w-8 pointer-coarse:w-8 [&>svg]:hidden group-hover:[&>svg]:block group-focus-within:[&>svg]:block pointer-coarse:[&>svg]:block cursor-pointer items-center justify-center rounded-control text-text-secondary transition-[color,background-color,scale] duration-(--duration-quick) ease-settle hover:bg-surface-secret hover:text-foreground motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';

/** The text with its mentions highlighted; each piece is keyed by where it starts. */
function Highlighted({ body, mentions }: { body: string; mentions: ChatMessageView['mentions'] }) {
  let offset = 0;
  return chatSegments(body, mentions).map((segment) => {
    const at = offset;
    offset += segment.text.length;
    return segment.mention
      ? <span key={at} className="font-semibold text-accent-text">{segment.text}</span>
      : <span key={at}>{segment.text}</span>;
  });
}

/** The quoted message of a reply, in one line. */
function Quote({ quote }: { quote: NonNullable<ChatMessageView['replyTo']> }) {
  return (
    <p data-slot="chat-quote" className="m-0 flex min-w-0 items-center gap-1 text-micro text-text-muted">
      <span className="sr-only">Em resposta a </span>
      <ArrowElbowDownRight size={12} aria-hidden="true" className="flex-none" />
      {/* One run of text: cut by the ellipsis, nothing inside it sticks out of the line. */}
      <span className={cn('min-w-0 truncate', quote.body === null && 'italic')}>
        {`${quote.authorName} ${quote.body ?? 'Mensagem removida'}`}
      </span>
    </p>
  );
}

/**
 * One message of the table chat, as a running line: time (shown on hover or
 * focus, always there for screen readers), the token of the author's active
 * character, the Mestre badge, the account's name and the text. A line that
 * mentions the reader is tinted. Reply and remove show on hover or focus,
 * and always on a touch screen.
 */
export const ChatLine = memo(function ChatLine({ message, viewerId, canRemove, removing = false, onReply, onRemove }: {
  message: ChatMessageView;
  viewerId: string;
  canRemove: boolean;
  removing?: boolean;
  onReply: (message: ChatMessageView) => void;
  onRemove: (message: ChatMessageView) => void;
}) {
  const { author } = message;
  const mentionsMe = !message.removed && message.mentions.some(({ userId }) => userId === viewerId);
  const emote = message.body !== null && isEmote(message.body);

  return (
    <li data-slot="chat-line" data-mention={mentionsMe || undefined}
      className={cn(
        'group relative flex min-w-0 items-start gap-1 rounded-control py-1 pr-1 pl-2 text-small leading-snug [overflow-wrap:anywhere]',
        'transition-[opacity,translate] duration-(--duration-settle) ease-settle motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0',
        'focus-within:bg-surface-secret hover:bg-surface-secret',
        'data-[mention]:bg-accent/12 data-[mention]:shadow-[inset_2px_0_0_var(--color-accent-text)] data-[mention]:hover:bg-accent/18 data-[mention]:focus-within:bg-accent/18',
      )}>
      <div className="min-w-0 flex-1">
        {message.replyTo && <Quote quote={message.replyTo} />}
        <p className="m-0 min-w-0">
          <time dateTime={message.createdAt}
            className="sr-only mr-1.5 font-mono text-micro text-text-muted tabular-nums group-hover:not-sr-only group-focus-within:not-sr-only">
            {formatEventTime(message.createdAt)}
          </time>
          {author.character && (
            // At 20 px initials would be unreadable: the piece and its band are enough beside the name.
            <TokenDisc className="mr-1.5 inline-flex size-5 align-[-0.3em]"
              token={{ kind: 'character', avatarUrl: author.character.avatarUrl, initials: '', hidden: false }} />
          )}
          {author.master && (
            <span className="mr-1.5 inline-block rounded-sm bg-accent px-1 align-[0.1em] text-micro leading-normal font-semibold text-accent-fg">Mestre</span>
          )}
          <span className={cn('font-semibold', author.master ? 'text-accent-text' : 'text-foreground')}>
            {author.name}
            {author.character && <span className="sr-only"> (joga com {author.character.name})</span>}
          </span>
          {': '}
          {message.body === null
            ? <em className="text-text-muted">Mensagem removida</em>
            : emote
              ? (
                // Drawn large for the eye, read once for the screen reader.
                <span data-slot="chat-emote" className="block py-0.5 text-[2rem] leading-none">
                  <span aria-hidden="true">{message.body}</span>
                  <span className="sr-only">{message.body}</span>
                </span>
              )
              : (
                <span className="whitespace-pre-wrap text-text-primary"><Highlighted body={message.body} mentions={message.mentions} /></span>
              )}
        </p>
      </div>
      {/* In the flow, never over the text. */}
      {!message.removed && (
        <div data-slot="chat-line-actions" className="-my-0.5 flex flex-none">
          <button type="button" className={lineAction} aria-label={`Responder a ${author.name}`} onClick={() => onReply(message)}>
            <ArrowBendUpLeft size={16} aria-hidden="true" />
          </button>
          {canRemove && (
            <button type="button" className={cn(lineAction, 'hover:text-danger-text')} disabled={removing}
              aria-label={`Remover a mensagem de ${author.name}`} onClick={() => onRemove(message)}>
              <Trash size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
});
