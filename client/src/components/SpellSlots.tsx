import type { SpellSlot } from '@quest-fast/shared';
import { circleLabel } from '../lib/sheet-labels';
import { cn } from '../lib/utils';
import { sheetItem } from './sheet-styles';
import { sheetEmpty } from './layout-styles';

// A filled pip is a slot still available; spending it empties the circle.
const pip = 'inline-grid shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 before:size-4 before:rounded-full before:border-2 before:border-accent-text before:bg-accent-text before:transition-[background-color,border-color] before:duration-(--duration-quick) before:ease-settle before:content-[""] aria-pressed:before:border-input aria-pressed:before:bg-transparent data-spent:before:border-input data-spent:before:bg-transparent';

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
  if (circles.length === 0) return <p className={sheetEmpty}>Sem espaços de magia.</p>;

  const setSpent = (level: number, spent: number) =>
    onChange?.(slots.map((slot, index) => (index + 1 === level ? spent : slot.spent)));

  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2 p-0">
      {circles.map(({ level, total, spent }) => (
        <li key={level} className={sheetItem}>
          <span className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-small">
            <span>{circleLabel(level)}</span>
            <span className="font-mono text-text-secondary tabular-nums">{total - spent} de {total} livres</span>
          </span>
          <span className="flex flex-wrap gap-1">
            {Array.from({ length: total }, (_, index) => {
              const isSpent = index < spent;
              // The last spent pip clears itself; any other marks up to it.
              const next = isSpent && spent === index + 1 ? index : index + 1;
              return editable ? (
                <button key={index} type="button" className={cn(pip, 'size-9 cursor-pointer focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-60')} aria-pressed={isSpent} disabled={pending}
                  aria-label={`Gastar espaço ${index + 1} do ${circleLabel(level)}`} onClick={() => setSpent(level, next)} />
              ) : (
                <span key={index} className={cn(pip, 'size-6')} data-spent={isSpent || undefined} aria-hidden="true" />
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
