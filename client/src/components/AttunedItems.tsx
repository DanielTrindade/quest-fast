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
    <ul aria-label="Itens mágicos sintonizados" className="m-0 grid list-none p-0">
      {SLOTS.map((slot, position) => {
        const item = items[position];
        return (
          <li key={slot} data-empty={!item || undefined} className="group flex min-h-10 items-center gap-2 border-b border-border px-2 py-1 [overflow-wrap:anywhere] data-empty:text-small data-empty:text-text-muted">
            <Link size={16} aria-hidden="true" className="shrink-0 text-accent-text group-data-empty:text-text-muted" />
            {item ?? 'Espaço de sintonização livre'}
          </li>
        );
      })}
    </ul>
  );
}
