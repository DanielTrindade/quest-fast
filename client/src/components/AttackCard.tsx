import { DiceFive, Sword } from '@phosphor-icons/react';
import type { Ability } from '@quest-fast/shared';
import { Button } from './Button';
import { ABILITY_LABELS } from '../lib/5e';

type AttackCardProps = {
  name: string; damage: string; damageType?: string; notes?: string; onRoll?: () => void; disabled?: boolean;
} & (
  | { kind?: 'attack'; bonus: number }
  | { kind: 'save'; dc: number; saveAbility: Ability }
);

/**
 * A row of "Armas e truques de dano": hit bonus or save DC, damage with its
 * type, notes. A save is rolled by the target, so it offers no attack roll.
 */
export function AttackCard(props: AttackCardProps) {
  const { name, damage, damageType = '', notes = '', onRoll, disabled = false } = props;
  return <div className="qf-attack">
    <div className="qf-attack__description">
      <p className="qf-attack__name"><Sword size={18} aria-hidden="true" />{name}</p>
      <dl className="qf-attack__stats">
        {props.kind === 'save'
          ? <div><dt>Resistência</dt><dd>{ABILITY_LABELS[props.saveAbility]} — CD {props.dc}</dd></div>
          : <div><dt>Acerto</dt><dd>{props.bonus >= 0 ? '+' : '−'}{Math.abs(props.bonus)}</dd></div>}
        <div><dt>Dano e tipo</dt><dd>{damage}{damageType && <span className="qf-attack__type"> {damageType}</span>}</dd></div>
      </dl>
      {notes && <p className="qf-attack__notes">{notes}</p>}
    </div>
    {onRoll && props.kind !== 'save' && <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Rolar ataque de ${name}`}>
      <DiceFive size={18} aria-hidden="true" />Rolar ataque
    </Button>}
  </div>;
}
