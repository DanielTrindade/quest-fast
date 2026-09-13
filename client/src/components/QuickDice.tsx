import { ClockCounterClockwise } from '@phosphor-icons/react';

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
    <div className="qf-quickdice" role="group" aria-label="Atalhos de dados">
      {PRESETS.map((sides) => (
        <button key={sides} type="button" className="qf-quickdice__die" disabled={disabled}
          onClick={() => onPick(`1d${sides}`)} aria-label={`Usar 1d${sides}`}>
          d{sides}
        </button>
      ))}
      <button type="button" className="qf-quickdice__repeat" disabled={disabled || !lastExpression}
        onClick={() => lastExpression && onPick(lastExpression)}>
        <ClockCounterClockwise size={16} aria-hidden="true" />
        {lastExpression ? <>Repetir <span className="qf-quickdice__last">{lastExpression}</span></> : 'Repetir última'}
      </button>
    </div>
  );
}
