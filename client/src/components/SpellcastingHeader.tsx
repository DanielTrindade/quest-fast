import { DiceFive } from '@phosphor-icons/react';
import { signedBonus } from '../lib/sheet-labels';
import { cn } from '../lib/utils';
import { statGrid, statRoll, statTile, statValue } from './sheet-styles';

/** Casting ability and what derives from it; the spell attack rolls for the owner. */
export function SpellcastingHeader({ abilityLabel, modifier, saveDc, attackBonus, onRollAttack, disabled = false }: {
  abilityLabel: string;
  modifier: number;
  saveDc: number;
  attackBonus: number;
  onRollAttack?: () => void;
  disabled?: boolean;
}) {
  return (
    <dl className={statGrid}>
      <div className={statTile}>
        <dt>Atributo de conjuração</dt>
        <dd className={cn(statValue, 'font-sans text-body')}>{abilityLabel}</dd>
      </div>
      <div className={statTile}>
        <dt>Modificador de conjuração</dt>
        <dd className={statValue}>{signedBonus(modifier)}</dd>
      </div>
      <div className={statTile}>
        <dt>CD para evitar sua magia</dt>
        <dd className={statValue}>{saveDc}</dd>
      </div>
      <div className={statTile}>
        <dt>Ataque mágico</dt>
        <dd className={statValue}>
          {onRollAttack ? (
            <button type="button" className={statRoll} disabled={disabled} onClick={onRollAttack}
              aria-label={`Rolar ataque mágico (${signedBonus(attackBonus)})`}>
              {signedBonus(attackBonus)}
              <DiceFive size={16} aria-hidden="true" />
            </button>
          ) : (
            signedBonus(attackBonus)
          )}
        </dd>
      </div>
    </dl>
  );
}
