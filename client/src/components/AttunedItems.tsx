import { Link } from '@phosphor-icons/react';
import { CHARACTER_LIMITS } from '@quest-fast/shared';

/**
 * The slots themselves are the identity: the sheet always shows exactly
 * `CHARACTER_LIMITS.attunedItems` positions, and a filled slot keeps its
 * position when another one changes.
 */
const SLOTS = Array.from({ length: CHARACTER_LIMITS.attunedItems }, (_, position) => `attuned-${position + 1}`);

/** Up to three attuned magic items; free slots stay visible, as on the sheet. */
export function AttunedItems({ items }: { items: readonly string[] }) {
  return (
    <ul className="qf-attuned" aria-label="Itens mágicos sintonizados">
      {SLOTS.map((slot, position) => {
        const item = items[position];
        return (
          <li key={slot} data-empty={!item || undefined}>
            <Link size={16} aria-hidden="true" />
            {item ?? 'Espaço de sintonização livre'}
          </li>
        );
      })}
    </ul>
  );
}
