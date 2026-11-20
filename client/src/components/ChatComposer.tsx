import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { PaperPlaneRight, X } from '@phosphor-icons/react';
import { CHAT_LIMITS, type ChatMessageView } from '@quest-fast/shared';
import { CHAT_REACTIONS, chatCounter, insertMention, mentionCandidates, mentionQuery, type ChatCounter, type ChatMember } from '../lib/chat-compose';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Textarea } from './ui/textarea';

const reaction = 'inline-flex size-9 cursor-pointer items-center justify-center rounded-control text-[1.125rem] leading-none transition-[background-color,scale] duration-(--duration-quick) ease-settle hover:bg-surface-secret motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The `@` combobox of the field: which members match what is typed before the
 * caret, which one is active, and the keys that move, pick and close it.
 */
function useMentions({ draft, members, onDraftChange, field }: {
  draft: string;
  members: readonly ChatMember[];
  onDraftChange: (draft: string) => void;
  field: RefObject<HTMLTextAreaElement | null>;
}) {
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const query = mentionQuery(draft, caret);
  const candidates = query && query.start !== dismissed ? mentionCandidates(members, query.query) : [];
  const current = Math.min(active, candidates.length - 1);

  const pick = (member: ChatMember) => {
    if (!query) return;
    const next = insertMention(draft, query.start, caret, member.name);
    onDraftChange(next.text);
    setCaret(next.caret);
    setActive(0);
    requestAnimationFrame(() => field.current?.setSelectionRange(next.caret, next.caret));
  };

  /** True when the key belonged to the open list. */
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (candidates.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      setActive((current + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') pick(candidates[current]!);
    else if (event.key === 'Escape') setDismissed(query!.start);
    else return false;
    event.preventDefault();
    return true;
  };

  return {
    candidates,
    current,
    pick,
    onKey,
    moved: (position: number) => setCaret(position),
    typed: (position: number) => {
      setCaret(position);
      setActive(0);
      setDismissed(null);
    },
  };
}

function Reactions({ disabled, onSend }: { disabled: boolean; onSend: (emoji: string) => void }) {
  return (
    <div role="group" aria-label="Reações rápidas" className="flex flex-wrap gap-0.5">
      {CHAT_REACTIONS.map(({ emoji, label }) => (
        <button key={emoji} type="button" className={reaction} disabled={disabled} aria-label={`Enviar ${label}`} onClick={() => onSend(emoji)}>
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}

function Replying({ replyTo, onCancel }: { replyTo: ChatMessageView; onCancel: () => void }) {
  return (
    <div data-slot="chat-replying" className="flex min-w-0 items-center gap-2 rounded-control bg-surface-secret py-1 pr-1 pl-2 text-micro text-text-secondary">
      <p className="m-0 min-w-0 flex-1 truncate">
        Respondendo a <span className="font-semibold text-foreground">{replyTo.author.name}</span>
        {replyTo.body !== null && <>: {replyTo.body}</>}
      </p>
      <button type="button" aria-label="Cancelar resposta" onClick={onCancel}
        className="inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-control hover:bg-card hover:text-foreground">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function MemberList({ id, candidates, current, onPick }: { id: string; candidates: readonly ChatMember[]; current: number; onPick: (member: ChatMember) => void }) {
  return (
    <ul id={id} role="listbox" aria-label="Membros da campanha"
      className="absolute right-0 bottom-full left-0 z-10 m-0 mb-1 grid max-h-56 list-none overflow-y-auto rounded-panel border border-input bg-popover p-1 elevation-popover">
      {candidates.map((member, index) => (
        <li key={member.userId} id={`${id}-${member.userId}`} role="option" aria-selected={index === current}
          className="flex min-w-0 cursor-pointer items-baseline gap-2 rounded-control px-2 py-1.5 text-small aria-selected:bg-surface-secret"
          // Mouse down, so the field keeps its focus and its caret.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(member);
          }}>
          <span className="min-w-0 truncate font-semibold text-foreground">{member.name}</span>
          {member.characterName && <span className="min-w-0 truncate text-micro text-text-muted">{member.characterName}</span>}
        </li>
      ))}
    </ul>
  );
}

function Footer({ hintId, counterId, counter, error, offline }: {
  hintId: string; counterId: string; counter: ChatCounter; error: string | null; offline: boolean;
}) {
  const shownHint = error ?? (offline ? 'Sem conexão com a mesa' : null);
  return (
    <div className="flex min-w-0 items-start justify-between gap-2 text-micro">
      <p id={hintId} className={cn('m-0 min-w-0', shownHint ? 'text-danger-text' : 'sr-only')} role={error ? 'alert' : undefined}>
        {shownHint ?? 'Enter envia, Shift+Enter quebra a linha.'}
      </p>
      {counter.shown && (
        <p id={counterId} data-tone={counter.tone} className="m-0 ml-auto flex-none font-mono tabular-nums text-text-secondary data-[tone=warn]:text-danger-text">
          {counter.length}/{CHAT_LIMITS.maxLength}
          <span className="sr-only"> caracteres</span>
        </p>
      )}
    </div>
  );
}

/**
 * Where a message is written: quick reactions, the reply being written, a
 * field that grows to about four lines and the send button. Enter sends,
 * Shift+Enter breaks the line, Esc cancels the reply. `@` opens the members
 * as a combobox. The draft and the reply are the screen's, so they survive
 * a tab switch and entering or leaving the full screen.
 */
export function ChatComposer({ draft, onDraftChange, replyTo, onCancelReply, members, onSend, sending = false, error = null, offline = false, fieldRef }: {
  draft: string;
  onDraftChange: (draft: string) => void;
  replyTo: ChatMessageView | null;
  onCancelReply: () => void;
  members: readonly ChatMember[];
  /** A reaction or the typed text, trimmed; the caller clears the draft once it is accepted. */
  onSend: (body: string, source: 'draft' | 'reaction') => void;
  sending?: boolean;
  error?: string | null;
  offline?: boolean;
  /** The screen focuses the field through it (opening the chat from the map). */
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const id = useId();
  const listId = `${id}-members`;
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  const field = fieldRef ?? ownRef;
  const mentions = useMentions({ draft, members, onDraftChange, field });
  const open = mentions.candidates.length > 0;
  const counter = chatCounter(draft);
  const canSend = !offline && !sending && draft.trim().length > 0 && !counter.over;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || mentions.onKey(event)) return;
    if (event.key === 'Escape' && replyTo) {
      event.preventDefault();
      onCancelReply();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend(draft.trim(), 'draft');
    }
  };

  return (
    <div data-slot="chat-composer" className="grid min-w-0 gap-2 border-t border-border pt-2">
      <Reactions disabled={offline || sending} onSend={(emoji) => onSend(emoji, 'reaction')} />
      {replyTo && <Replying replyTo={replyTo} onCancel={onCancelReply} />}
      <div className="relative flex min-w-0 items-end gap-2">
        {open && <MemberList id={listId} candidates={mentions.candidates} current={mentions.current} onPick={mentions.pick} />}
        <Textarea ref={field} rows={1} value={draft} disabled={offline}
          aria-label="Mensagem para a mesa" placeholder={offline ? 'Sem conexão com a mesa' : 'Mensagem para a mesa'}
          role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${mentions.candidates[mentions.current]!.userId}` : undefined}
          aria-describedby={cn(`${id}-hint`, counter.shown && `${id}-counter`)}
          aria-invalid={counter.over || undefined}
          className="field-sizing-content max-h-28 min-h-10 flex-1 resize-none py-2"
          onChange={(event) => {
            onDraftChange(event.target.value);
            mentions.typed(event.target.selectionStart);
          }}
          onSelect={(event) => mentions.moved(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown} />
        <Button type="button" variant="primary" aria-label="Enviar mensagem" className="size-10 flex-none p-0" disabled={!canSend} loading={sending}
          onClick={() => onSend(draft.trim(), 'draft')}>
          <PaperPlaneRight size={18} aria-hidden="true" />
        </Button>
      </div>
      <Footer hintId={`${id}-hint`} counterId={`${id}-counter`} counter={counter} error={error} offline={offline} />
    </div>
  );
}
