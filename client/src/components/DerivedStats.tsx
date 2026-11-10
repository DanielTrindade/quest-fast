import { DiceFive } from '@phosphor-icons/react';
import type { Size } from '@quest-fast/shared';
import { SIZE_LABELS, formatSpeed, signedBonus } from '../lib/sheet-labels';
import { statGrid, statRoll, statTile, statValue } from './sheet-styles';

/** The row under the header of the official sheet. Values come derived. */
export function DerivedStats({ proficiency, initiative, speed, size, passivePerception, onRollInitiative, disabled = false }: {
  proficiency: number;
  initiative: number;
  speed: number;
  size: Size;
  passivePerception: number;
  onRollInitiative?: () => void;
  disabled?: boolean;
}) {
  return (
    <dl className={statGrid}>
      <div className={statTile}>
        <dt>Bônus de proficiência</dt>
        <dd className={statValue}>{signedBonus(proficiency)}</dd>
      </div>
      <div className={statTile}>
        <dt>Iniciativa</dt>
        <dd className={statValue}>
          {onRollInitiative ? (
            <button type="button" className={statRoll} disabled={disabled} onClick={onRollInitiative}
              aria-label={`Rolar iniciativa (${signedBonus(initiative)})`}>
              {signedBonus(initiative)}
              <DiceFive size={16} aria-hidden="true" />
            </button>
          ) : (
            signedBonus(initiative)
          )}
        </dd>
      </div>
      <div className={statTile}>
        <dt>Deslocamento</dt>
        <dd className={statValue}>{formatSpeed(speed)}</dd>
      </div>
      <div className={statTile}>
        <dt>Tamanho</dt>
        <dd className={statValue}>{SIZE_LABELS[size]}</dd>
      </div>
      <div className={statTile}>
        <dt>Percepção passiva</dt>
        <dd className={statValue}>{passivePerception}</dd>
      </div>
    </dl>
  );
}
