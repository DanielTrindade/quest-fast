import { DiceFive, Ruler, ShieldWarning, Sword } from '@phosphor-icons/react';
import type { Ability, AttackCost, SaveEffect } from '@quest-fast/shared';
import { Button } from './Button';
import { ABILITY_LABELS } from '../lib/5e';
import { ATTACK_COST_LABELS } from '../lib/combat-labels';

type RowKind =
  | { kind?: 'attack'; bonus: number }
  | { kind: 'save'; dc: number; saveAbility: Ability; onSave?: SaveEffect };

type AttackCardProps = {
  name: string; damage: string; damageType?: string; notes?: string; onRoll?: () => void; disabled?: boolean;
  /** How far it reaches, as the sheet writes it; nothing shows when empty. */
  range?: string;
  /** What using it spends on its user's turn. */
  cost?: AttackCost;
  /** Why the turn has nothing left for it: the button is off and says so. */
  refusal?: string | null;
  /** "Ver alcance": draws the range on the map around its user's token. Absent where there is no map to draw on. */
  rangeToggle?: { shown: boolean; toggle: () => void } | null;
} & RowKind;

/** The row's numbers: hit bonus or DC, damage and type, what a pass leaves, the range, the cost. */
function Details({ row, damage, damageType, range, cost }: { row: RowKind; damage: string; damageType: string; range: string; cost?: AttackCost }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-2 *:min-w-0 [&_dd]:font-mono [&_dd]:tabular-nums [&_dt]:text-micro [&_dt]:text-text-secondary">
      {row.kind === 'save'
        ? <div><dt>Resistência</dt><dd>{ABILITY_LABELS[row.saveAbility]} — CD {row.dc}</dd></div>
        : <div><dt>Acerto</dt><dd>{row.bonus >= 0 ? '+' : '−'}{Math.abs(row.bonus)}</dd></div>}
      {damage
        ? <div><dt>Dano e tipo</dt><dd>{damage}{damageType && <span className="font-sans text-text-secondary"> {damageType}</span>}</dd></div>
        : <div><dt>Dano</dt><dd className="font-sans">Sem dano</dd></div>}
      {row.kind === 'save' && damage && (
        <div><dt>Se passar</dt><dd className="font-sans">{row.onSave === 'none' ? 'Nenhum dano' : 'Metade'}</dd></div>
      )}
      {range && <div><dt>Alcance</dt><dd className="font-sans">{range}</dd></div>}
      {cost && <div><dt>Custo</dt><dd className="font-sans">{ATTACK_COST_LABELS[cost]}</dd></div>}
    </dl>
  );
}

/** An attack roll attacks; a save rolls its damage, or only calls for the save when it deals none. */
function RollButton({ name, save, damage, disabled, onRoll }: {
  name: string; save: boolean; damage: string; disabled: boolean; onRoll: () => void;
}) {
  if (save && !damage) {
    return (
      <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Pedir salvaguarda de ${name}`}>
        <ShieldWarning size={18} aria-hidden="true" />Pedir salvaguarda
      </Button>
    );
  }
  if (save) {
    return (
      <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Rolar dano de ${name}`}>
        <DiceFive size={18} aria-hidden="true" />Rolar dano
      </Button>
    );
  }
  return (
    <Button variant="secondary" disabled={disabled} onClick={onRoll} aria-label={`Atacar com ${name}`}>
      <Sword size={18} aria-hidden="true" />Atacar
    </Button>
  );
}

/**
 * A row of "Armas e truques de dano": hit bonus or save DC, damage with its
 * type, notes. A save is rolled by the target: its button rolls the damage,
 * or only calls for the save when it deals none (Graxa).
 */
export function AttackCard(props: AttackCardProps) {
  const { name, damage, damageType = '', notes = '', range = '', onRoll, cost, refusal = null, rangeToggle = null } = props;
  const disabled = props.disabled === true || refusal !== null;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card p-3">
    <div className="min-w-0 flex-[1_1_160px] [overflow-wrap:anywhere]">
      <p className="flex items-center gap-2 font-semibold"><Sword size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />{name}</p>
      <Details row={props} damage={damage} damageType={damageType} range={range} cost={cost} />
      {notes && <p className="mt-1 text-small text-text-secondary [overflow-wrap:anywhere]">{notes}</p>}
      {onRoll && refusal && <p className="mt-1 text-small text-text-secondary [overflow-wrap:anywhere]">{refusal}</p>}
    </div>
    {(onRoll || rangeToggle) && (
      <div className="flex flex-wrap items-center gap-2">
        {rangeToggle && (
          <Button variant="ghost" aria-pressed={rangeToggle.shown} onClick={rangeToggle.toggle} aria-label={`${rangeToggle.shown ? 'Ocultar' : 'Ver'} alcance de ${name} no mapa`}
            className="aria-pressed:bg-danger-surface aria-pressed:text-danger-text">
            <Ruler size={18} aria-hidden="true" />{rangeToggle.shown ? 'Ocultar alcance' : 'Ver alcance'}
          </Button>
        )}
        {onRoll && <RollButton name={name} save={props.kind === 'save'} damage={damage} disabled={disabled} onRoll={onRoll} />}
      </div>
    )}
  </div>;
}
