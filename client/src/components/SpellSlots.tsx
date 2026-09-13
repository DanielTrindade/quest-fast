import type { SpellSlot } from '@quest-fast/shared';
import { circleLabel } from '../lib/sheet-labels';

/**
 * Spell slots per circle: a filled pip is available, a hollow one is spent.
 * The owner toggles pips; circles without slots are left out.
 */
export function SpellSlots({ slots, editable = false, pending = false, onChange }: {
  slots: readonly SpellSlot[];
  editable?: boolean;
  pending?: boolean;
  onChange?: (spent: number[]) => void;
}) {
  const circles = slots.map((slot, index) => ({ ...slot, level: index + 1 })).filter((slot) => slot.total > 0);
  if (circles.length === 0) return <p className="qf-sheet-empty">Sem espaços de magia.</p>;

  const setSpent = (level: number, spent: number) =>
    onChange?.(slots.map((slot, index) => (index + 1 === level ? spent : slot.spent)));

  return (
    <ul className="qf-slots">
      {circles.map(({ level, total, spent }) => (
        <li key={level}>
          <span className="qf-slots__head">
            <span>{circleLabel(level)}</span>
            <span>{total - spent} de {total} livres</span>
          </span>
          <span className="qf-slots__pips">
            {Array.from({ length: total }, (_, index) => {
              const isSpent = index < spent;
              // The last spent pip clears itself; any other marks up to it.
              const next = isSpent && spent === index + 1 ? index : index + 1;
              return editable ? (
                <button key={index} type="button" className="qf-slots__pip" aria-pressed={isSpent} disabled={pending}
                  aria-label={`Gastar espaço ${index + 1} do ${circleLabel(level)}`} onClick={() => setSpent(level, next)} />
              ) : (
                <span key={index} className="qf-slots__pip" data-spent={isSpent || undefined} aria-hidden="true" />
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
