import { DiceFive } from '@phosphor-icons/react';
import { deathSaveStatus, type DeathSaves as DeathSavesValue } from '@quest-fast/shared';
import { Button } from './Button';
import { DeathSaves } from './DeathSaves';
import { DEATH_STATUS_LABELS } from '../lib/combat-labels';

/**
 * A character at 0 hit points during a fight: the saves so far, the state
 * they add up to and, when it may be rolled, the roll. The server rolls and
 * decides whether this player may roll now; the tracker only asks.
 */
export function DeathSaveTracker({ name, deathSaves, canRoll = false, pending = false, onRoll }: {
  name: string;
  deathSaves: DeathSavesValue;
  /** The master, or the player on their own turn. */
  canRoll?: boolean;
  pending?: boolean;
  onRoll?: () => void;
}) {
  const status = deathSaveStatus(deathSaves);
  return (
    <DeathSaves value={deathSaves} label={`Salvaguardas contra a morte de ${name}`}>
      <p data-status={status}
        className="m-0 text-small font-semibold text-danger-text data-[status=stable]:text-success-text">
        {DEATH_STATUS_LABELS[status]}
      </p>
      {status === 'pending' && canRoll && onRoll && (
        <Button variant="secondary" disabled={pending} onClick={onRoll}>
          <DiceFive size={18} aria-hidden="true" /> Teste contra a morte<span className="sr-only"> de {name}</span>
        </Button>
      )}
    </DeathSaves>
  );
}
