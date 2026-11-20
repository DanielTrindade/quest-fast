import { ChatsCircle } from '@phosphor-icons/react';
import type { ChatMessageView } from '@quest-fast/shared';
import { cn } from '../lib/utils';

export type ChatToast = { message: ChatMessageView; leaving: boolean };

/**
 * New chat lines over the map while the table panel is put away: at most
 * three, bottom left, on an opaque `surface-secret` so they read over any
 * map (and their contrast can be measured). Each fades after a few seconds (the screen owns the timing). A
 * click on one, or on "Abrir o chat", opens the panel on the chat.
 *
 * Hidden from screen readers and out of the tab order: the chat's own live
 * region, still mounted in the folded panel, already announced each line,
 * and the rail's Chat icon is the way in by keyboard.
 */
export function ChatToasts({ toasts, onOpen, className }: {
  toasts: readonly ChatToast[];
  onOpen: () => void;
  className?: string;
}) {
  if (toasts.length === 0) return null;
  return (
    <div aria-hidden="true" data-slot="chat-toasts" className={cn('pointer-events-none grid max-w-[min(22rem,calc(100%-1.5rem))] justify-items-start gap-1.5', className)}>
      {toasts.map(({ message, leaving }) => (
        <button key={message.id} type="button" tabIndex={-1} data-leaving={leaving || undefined} onClick={onOpen}
          className={cn(
            'pointer-events-auto grid max-w-full cursor-pointer rounded-control border border-border bg-surface-secret px-3 py-1.5 text-left text-small leading-snug elevation-popover [overflow-wrap:anywhere]',
            'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-settle)',
            'transition-opacity data-[leaving]:opacity-0 motion-safe:duration-300 motion-reduce:transition-none',
          )}>
          <span className="line-clamp-2">
            <span className={cn('font-semibold', message.author.master ? 'text-accent-text' : 'text-foreground')}>{message.author.name}</span>
            <span className="text-text-primary">: {message.body}</span>
          </span>
        </button>
      ))}
      <button type="button" tabIndex={-1} onClick={onOpen}
        className="pointer-events-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface-secret px-3 text-micro font-semibold text-accent-text elevation-popover motion-safe:active:scale-[0.97]">
        <ChatsCircle size={14} aria-hidden="true" /> Abrir o chat
      </button>
    </div>
  );
}
