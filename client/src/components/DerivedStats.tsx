import { DiceFive } from '@phosphor-icons/react';
import type { Size } from '@quest-fast/shared';
import { SIZE_LABELS, formatSpeed, signedBonus } from '../lib/sheet-labels';

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
    <dl className="qf-derived">
      <div className="qf-derived__stat">
        <dt>Bônus de proficiência</dt>
        <dd>{signedBonus(proficiency)}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Iniciativa</dt>
        <dd>
          {onRollInitiative ? (
            <button type="button" className="qf-derived__roll" disabled={disabled} onClick={onRollInitiative}
              aria-label={`Rolar iniciativa (${signedBonus(initiative)})`}>
              {signedBonus(initiative)}
              <DiceFive size={16} aria-hidden="true" />
            </button>
          ) : (
            signedBonus(initiative)
          )}
        </dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Deslocamento</dt>
        <dd>{formatSpeed(speed)}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Tamanho</dt>
        <dd>{SIZE_LABELS[size]}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Percepção passiva</dt>
        <dd>{passivePerception}</dd>
      </div>
    </dl>
  );
}
