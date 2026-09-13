import { DiceFive } from '@phosphor-icons/react';
import { signedBonus } from '../lib/sheet-labels';

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
    <dl className="qf-derived qf-spellcasting">
      <div className="qf-derived__stat">
        <dt>Atributo de conjuração</dt>
        <dd>{abilityLabel}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Modificador de conjuração</dt>
        <dd>{signedBonus(modifier)}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>CD para evitar sua magia</dt>
        <dd>{saveDc}</dd>
      </div>
      <div className="qf-derived__stat">
        <dt>Ataque mágico</dt>
        <dd>
          {onRollAttack ? (
            <button type="button" className="qf-derived__roll" disabled={disabled} onClick={onRollAttack}
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
