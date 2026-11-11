import type { HealthBand as Band } from '@quest-fast/shared';
import { HEALTH_BAND_LABELS } from '../lib/combat-labels';

const FILLED: Record<Band, number> = { unhurt: 3, wounded: 2, bloodied: 1, defeated: 0 };
const NOTCHES = [0, 1, 2] as const;

/**
 * What a player sees of a monster instead of its hit points: the band in
 * words, and three notches that empty as it takes damage. The words carry the
 * meaning; the notches are only a glance.
 */
export function HealthBand({ band }: { band: Band }) {
  return (
    <p data-slot="health-band" data-band={band}
      className="m-0 inline-flex items-center gap-2 text-small font-semibold whitespace-nowrap text-text-secondary data-[band=bloodied]:text-danger-text data-[band=defeated]:text-danger-text data-[band=unhurt]:text-success-text">
      <span className="flex gap-0.5" aria-hidden="true">
        {NOTCHES.map((notch) => (
          <span key={notch} data-filled={notch < FILLED[band] || undefined}
            className="h-2 w-3 rounded-[2px] bg-current opacity-25 data-filled:opacity-100" />
        ))}
      </span>
      {HEALTH_BAND_LABELS[band]}
    </p>
  );
}
