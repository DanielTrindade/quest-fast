import { DiceFive } from '@phosphor-icons/react';
import { cn } from '../lib/utils';

function signed(value: number) {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * A skill with its total bonus, optionally rollable by the owner. Presents
 * only: the bonus is computed by the domain and authorized by the server.
 * Training is marked by the chip's edge and the bonus colour, and spelled out
 * for assistive technology.
 */
export function SkillChip({ label, bonus, trained = false, onRoll, disabled = false }: {
  label: string;
  bonus: number;
  trained?: boolean;
  onRoll?: () => void;
  disabled?: boolean;
}) {
  const className = cn('inline-flex min-w-0 items-center gap-2 rounded-full border bg-card px-2 py-1 text-small text-foreground',
    trained ? 'border-input' : 'border-border');
  const content = (
    <>
      <span className="inline-flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
        {label}
        {trained && <span className="sr-only">, treinada</span>}
      </span>
      <span className={cn('font-mono tabular-nums', trained ? 'font-semibold text-accent-text' : 'text-text-secondary')}>
        <span className="sr-only">Bônus </span>
        {signed(bonus)}
      </span>
    </>
  );
  if (!onRoll) return <span className={className}>{content}</span>;
  return (
    <button type="button" className={cn(className, 'min-h-10 cursor-pointer px-3 text-start edge-raised transition-[background-color,border-color,transform] duration-(--duration-quick) ease-settle hover:not-disabled:border-input hover:not-disabled:bg-muted motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted disabled:shadow-none [&>svg]:shrink-0 [&>svg]:text-text-muted')} disabled={disabled} onClick={onRoll}
      aria-label={`Rolar teste de ${label} (${signed(bonus)})`}>
      {content}
      <DiceFive size={16} aria-hidden="true" />
    </button>
  );
}
