import { ClockCounterClockwise } from '@phosphor-icons/react';
import { Button } from './ui/button';

const PRESETS = [4, 6, 8, 10, 12, 20, 100] as const;

/**
 * Quick dice: the most common rolls at a table as one-tap pills plus a way to
 * bring back the last expression. A pill fills the roller's expression; it
 * does not roll. Presents only: the roller decides the rules.
 */
export function QuickDice({ onPick, lastExpression, disabled = false }: {
  onPick: (expression: string) => void;
  lastExpression?: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Atalhos de dados">
      {PRESETS.map((sides) => (
        <Button key={sides} variant="secondary" size="sm" className="min-h-10 min-w-11 px-2 font-mono font-semibold" disabled={disabled}
          onClick={() => onPick(`1d${sides}`)} aria-label={`Usar 1d${sides}`}>
          d{sides}
        </Button>
      ))}
      <Button variant="ghost" size="sm" className="ml-auto min-h-10 border-dashed border-input" disabled={disabled || !lastExpression}
        onClick={() => lastExpression && onPick(lastExpression)}>
        <ClockCounterClockwise size={16} aria-hidden="true" />
        {lastExpression ? <>Repetir <span className="font-mono tabular-nums">{lastExpression}</span></> : 'Repetir última'}
      </Button>
    </div>
  );
}
