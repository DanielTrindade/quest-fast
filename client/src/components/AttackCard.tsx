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
 * type, notes. A save is rolled by the target: its button rolls the damage.
 */
export function AttackCard(props: AttackCardProps) {
  const { name, damage, damageType = '', notes = '', onRoll, disabled = false } = props;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card p-3">
    <div className="min-w-0 flex-[1_1_160px] [overflow-wrap:anywhere]">
      <p className="flex items-center gap-2 font-semibold"><Sword size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />{name}</p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-2 *:min-w-0 [&_dd]:font-mono [&_dd]:tabular-nums [&_dt]:text-micro [&_dt]:text-text-secondary">
        {props.kind === 'save'
          ? <div><dt>Resistência</dt><dd>{ABILITY_LABELS[props.saveAbility]} — CD {props.dc}</dd></div>
          : <div><dt>Acerto</dt><dd>{props.bonus >= 0 ? '+' : '−'}{Math.abs(props.bonus)}</dd></div>}
        <div><dt>Dano e tipo</dt><dd>{damage}{damageType && <span className="font-sans text-text-secondary"> {damageType}</span>}</dd></div>
      </dl>
      {notes && <p className="mt-1 text-small text-text-secondary [overflow-wrap:anywhere]">{notes}</p>}
    </div>
    {onRoll && (props.kind === 'save'
      ? <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Rolar dano de ${name}`}>
        <DiceFive size={18} aria-hidden="true" />Rolar dano
      </Button>
      : <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Atacar com ${name}`}>
        <Sword size={18} aria-hidden="true" />Atacar
      </Button>)}
  </div>;
}
