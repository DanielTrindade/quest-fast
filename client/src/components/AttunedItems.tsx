import { Link } from '@phosphor-icons/react';
import { CHARACTER_LIMITS } from '@quest-fast/shared';

/** Up to three attuned magic items; free slots stay visible, as on the sheet. */
export function AttunedItems({ items }: { items: readonly string[] }) {
  return (
    <ul className="qf-attuned" aria-label="Itens mágicos sintonizados">
      {Array.from({ length: CHARACTER_LIMITS.attunedItems }, (_, index) => {
        const item = items[index];
        return (
          <li key={index} data-empty={!item || undefined}>
            <Link size={16} aria-hidden="true" />
            {item ?? 'Espaço de sintonização livre'}
          </li>
        );
      })}
    </ul>
  );
}
