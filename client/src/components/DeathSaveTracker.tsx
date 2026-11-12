import { useId, useState } from 'react';
import { DiceFive } from '@phosphor-icons/react';
import { deathSaveStatus, type DeathSaves as DeathSavesValue, type RollMode } from '@quest-fast/shared';
import { Button } from './Button';
import { DeathSaves } from './DeathSaves';
import { RollModeControl } from './RollModeControl';
import { DEATH_STATUS_LABELS } from '../lib/combat-labels';

/**
 * A character at 0 hit points during a fight: the saves so far, the state
 * they add up to and, when it may be rolled, the roll, with advantage or
 * disadvantage when a feature or a spell grants it. The server rolls and
 * decides whether this player may roll now; the tracker only asks.
 */
export function DeathSaveTracker({ name, deathSaves, canRoll = false, pending = false, onRoll }: {
  name: string;
  deathSaves: DeathSavesValue;
  /** The master, or the player on their own turn. */
  canRoll?: boolean;
  pending?: boolean;
  onRoll?: (mode: RollMode) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<RollMode>('normal');
  const status = deathSaveStatus(deathSaves);
  return (
    <DeathSaves value={deathSaves} label={`Salvaguardas contra a morte de ${name}`}>
      <p data-status={status}
        className="m-0 text-small font-semibold text-danger-text data-[status=stable]:text-success-text">
        {DEATH_STATUS_LABELS[status]}
      </p>
      {status === 'pending' && canRoll && onRoll && (
        <div className="grid min-w-0 justify-items-start gap-2 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
          <RollModeControl value={mode} onChange={setMode} disabled={pending} name={`${id}-mode`}
            label={`Tipo de rolagem do teste contra a morte de ${name}`} />
          <Button variant="secondary" disabled={pending} onClick={() => onRoll(mode)}>
            <DiceFive size={18} aria-hidden="true" /> Teste contra a morte<span className="sr-only"> de {name}</span>
          </Button>
        </div>
      )}
    </DeathSaves>
  );
}
