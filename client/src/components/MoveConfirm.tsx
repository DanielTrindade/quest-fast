import { useEffect, useRef } from 'react';
import { Check, Lightning, X } from '@phosphor-icons/react';
import { formatMeters } from '@quest-fast/shared';
import { Button } from './Button';

export type MoveConfirmProps = {
  /** The token's name. */
  name: string;
  /** "3 casas · 4,5 m". */
  cost: string;
  /** Metres left this turn, before this move. */
  left: number;
  /** The move costs more than what is left. */
  over: boolean;
  /** The master may move without spending (a push, a teleport). */
  onFree?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

/**
 * A move in a fight waits for its confirmation: what it costs, what is left,
 * and confirm or cancel. Past what is left it cannot be confirmed; the master
 * may still move without spending. Focus comes here when it appears, and
 * Escape cancels, so the keyboard confirms as the pointer does.
 */
export function MoveConfirm({ name, cost, left, over, onFree, onConfirm, onCancel, busy = false }: MoveConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (over ? cancelRef : confirmRef).current?.focus({ preventScroll: true });
  }, [over]);

  return (
    <div role="group" aria-label={`Confirmar movimento de ${name}`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      className="pointer-events-auto grid max-w-full min-w-0 gap-2 rounded-panel border border-border-strong bg-popover p-3 text-popover-foreground elevation-popover">
      <p className="m-0 text-small" aria-live="polite">
        <span className="font-semibold [overflow-wrap:anywhere]">{name}</span>: {cost}.{' '}
        <span className={over ? 'font-semibold text-danger-text' : 'text-text-secondary'}>
          {over ? `Passa do que resta (${formatMeters(left)}).` : `Restam ${formatMeters(left)} neste turno.`}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 *:max-w-full">
        <Button ref={confirmRef} disabled={over || busy} loading={busy} onClick={onConfirm}>
          <Check size={18} aria-hidden="true" /> Confirmar movimento
        </Button>
        {onFree && (
          <Button variant="secondary" disabled={busy} onClick={onFree}>
            <Lightning size={18} aria-hidden="true" /> Mover sem gastar
          </Button>
        )}
        <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={onCancel}>
          <X size={18} aria-hidden="true" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
