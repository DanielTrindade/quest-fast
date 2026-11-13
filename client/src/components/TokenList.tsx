import { useId, useState, type KeyboardEvent } from 'react';
import { Eye, EyeSlash, HandGrabbing, Trash } from '@phosphor-icons/react';
import type { TokenView } from '@quest-fast/shared';
import { SIZE_LABELS } from '../lib/sheet-labels';
import { TOKEN_KIND_LABELS, canMoveToken } from '../lib/token-labels';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { TokenDisc } from './TokenDisc';

const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export type TokenListProps = {
  tokens: readonly TokenView[];
  viewerId: string | null;
  master: boolean;
  selectedId: string | null;
  onSelect: (tokenId: string | null) => void;
  /** An arrow on a selected token the viewer may move: one cell that way. */
  onStep: (tokenId: string, direction: { x: number; y: number }) => void;
  /** The master only. */
  onToggleHidden?: (tokenId: string, hidden: boolean) => void;
  /** The master only, in two steps. */
  onRemove?: (tokenId: string) => void;
  /** Tokens with a request on the way. */
  busyIds?: ReadonlySet<string>;
};

function RemoveToken({ token, busy, onRemove }: { token: TokenView; busy: boolean; onRemove: (tokenId: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
        <Trash size={18} aria-hidden="true" /> Remover<span className="sr-only"> {token.name} do mapa</span>
      </Button>
    );
  }
  return (
    <span role="group" aria-label={`Remover ${token.name} do mapa?`}
      className="flex max-w-full min-w-0 flex-wrap items-center gap-2 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
      <Button variant="danger" disabled={busy} onClick={() => onRemove(token.id)}>Remover {token.name}</Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Manter</Button>
    </span>
  );
}

function TokenRow({ token, selected, own, movable, master, busy, helpId, onSelect, onStep, onToggleHidden, onRemove, viewerId }: {
  token: TokenView;
  selected: boolean;
  own: boolean;
  movable: boolean;
  master: boolean;
  busy: boolean;
  helpId: string;
  viewerId: string | null;
} & Pick<TokenListProps, 'onSelect' | 'onStep' | 'onToggleHidden' | 'onRemove'>) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = ARROWS[event.key];
    if (!direction || !movable || busy) return;
    event.preventDefault();
    if (!selected) onSelect(token.id);
    onStep(token.id, direction);
  };
  return (
    <li data-selected={selected} className={cn(
      'grid min-w-0 gap-2 rounded-panel border border-border bg-card p-2 transition-[border-color,box-shadow] duration-(--duration-quick) ease-settle',
      selected && 'border-ring shadow-[inset_3px_0_0_var(--color-focus-ring)]',
      token.hidden && 'border-dashed bg-surface-secret',
    )}>
      <button type="button" aria-pressed={selected} aria-describedby={movable ? helpId : undefined}
        onClick={() => onSelect(selected ? null : token.id)} onKeyDown={onKeyDown}
        className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-control px-1 text-left outline-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <TokenDisc token={token} />
        <span className="grid min-w-0 gap-0.5">
          <span className="font-semibold [overflow-wrap:anywhere] text-foreground">{token.name}</span>
          <TokenTags token={token} own={own} viewerId={viewerId} />
        </span>
      </button>
      {master && <MasterActions token={token} busy={busy} onToggleHidden={onToggleHidden} onRemove={onRemove} />}
    </li>
  );
}

function TokenTags({ token, own, viewerId }: { token: TokenView; own: boolean; viewerId: string | null }) {
  const movingBy = token.movingBy && token.movingBy.userId !== viewerId ? token.movingBy.name : null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-small text-text-secondary [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">
      <span>{TOKEN_KIND_LABELS[token.kind]}</span>
      <span>{SIZE_LABELS[token.size]}</span>
      {own && <span className="font-semibold text-accent-text">Seu personagem</span>}
      {token.hidden && <span><EyeSlash size={14} aria-hidden="true" /> Escondido</span>}
      {movingBy && <span><HandGrabbing size={14} aria-hidden="true" /> {movingBy} está movendo</span>}
    </span>
  );
}

function MasterActions({ token, busy, onToggleHidden, onRemove }: {
  token: TokenView;
  busy: boolean;
} & Pick<TokenListProps, 'onToggleHidden' | 'onRemove'>) {
  if (!onToggleHidden && !onRemove) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 *:max-w-full">
      {onToggleHidden && (
        <Button variant="ghost" disabled={busy} onClick={() => onToggleHidden(token.id, !token.hidden)}>
          {token.hidden ? <Eye size={18} aria-hidden="true" /> : <EyeSlash size={18} aria-hidden="true" />}
          {token.hidden ? 'Revelar' : 'Esconder'}
          <span className="sr-only"> {token.name}</span>
        </Button>
      )}
      {onRemove && <RemoveToken token={token} busy={busy} onRemove={onRemove} />}
    </div>
  );
}

/**
 * The tokens of the scene in DOM: the accessible side of the canvas. A row
 * selects its token (the map rings it); with the token selected, the arrows
 * move it one cell, for whoever may move it. The master also hides, reveals
 * and removes. Presentational: the screen does the requests.
 */
export function TokenList({ tokens, viewerId, master, selectedId, onSelect, onStep, onToggleHidden, onRemove, busyIds }: TokenListProps) {
  const headingId = useId();
  const helpId = useId();
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-2">
      <h2 id={headingId} className="m-0 flex items-baseline gap-2 font-display text-h2 font-semibold">
        Tokens <span className="font-sans text-small font-normal text-text-secondary tabular-nums">{tokens.length}</span>
      </h2>
      <p id={helpId} className="sr-only">Com o token selecionado, as setas o movem uma casa.</p>
      {tokens.length === 0 ? (
        <p className="m-0 text-small text-text-secondary">
          {master ? 'Nenhum token nesta cena. Ponha personagens, o encontro ou criaturas do bestiário no mapa.' : 'Nenhum token à vista no mapa.'}
        </p>
      ) : (
        <ul className="m-0 grid max-h-[min(60vh,36rem)] min-w-0 list-none gap-2 overflow-y-auto overscroll-contain p-1">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} viewerId={viewerId} master={master} helpId={helpId}
              selected={token.id === selectedId}
              own={token.kind === 'character' && viewerId !== null && token.ownerId === viewerId}
              movable={canMoveToken(token, viewerId, master)}
              busy={busyIds?.has(token.id) ?? false}
              onSelect={onSelect} onStep={onStep} onToggleHidden={onToggleHidden} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}
