import { defaultAttackCost, type Ability, type Attack, type AttackCost, type AttackInput, type ImportedAttack, type SaveEffect } from '@quest-fast/shared';

/**
 * Numbers stay text while they are typed: a number state turns the "-" of
 * "-2" into NaN and a cleared field into an undeletable 0.
 */
export type FormAttack = {
  rowId: string;
  name: string;
  /** An attack roll keeps `bonus`; a save keeps `dc` and `saveAbility`. Both stay while the kind is toggled. */
  kind: 'attack' | 'save';
  bonus: string;
  dc: string;
  saveAbility: Ability | '';
  damage: string;
  damageType: string;
  notes: string;
  cost: AttackCost;
  /** Only read on a save with damage. */
  onSave: SaveEffect;
};

/**
 * Identity for the editable rows: rows are added and removed, so the array
 * position is not a stable key. The counter is module-wide because the key
 * only has to be unique among the siblings of one list.
 */
let rowSeq = 0;
export function newRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

/** An empty field is invalid, not a silent zero. */
export function numberValue(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text);
}

export function emptyFormAttack(): FormAttack {
  return { rowId: newRowId(), name: '', kind: 'attack', bonus: '0', dc: '', saveAbility: '', damage: '', damageType: '', notes: '', cost: 'attack', onSave: 'half' };
}

/**
 * A row switched to another kind. A cost still at the old kind's default
 * follows the new one (a save takes the whole action); one chosen by hand
 * stays.
 */
export function withKind(attack: FormAttack, kind: FormAttack['kind']): FormAttack {
  const cost = attack.cost === defaultAttackCost(attack.kind) ? defaultAttackCost(kind) : attack.cost;
  return { ...attack, kind, cost };
}

/** Stored attacks, or imported ones whose blanks (`null`) are left for the editor to fill. */
export function toFormAttacks(attacks: ReadonlyArray<Attack | ImportedAttack>): FormAttack[] {
  return attacks.map((attack) => ({
    rowId: newRowId(),
    name: attack.name,
    kind: attack.kind,
    bonus: attack.kind === 'attack' && attack.bonus !== null ? String(attack.bonus) : '',
    dc: attack.kind === 'save' ? String(attack.dc) : '',
    saveAbility: attack.kind === 'save' ? attack.saveAbility ?? '' : '',
    damage: attack.damage,
    damageType: attack.damageType,
    notes: attack.notes,
    // A row imported from a PDF has no cost: the default of its kind.
    cost: 'cost' in attack ? attack.cost : defaultAttackCost(attack.kind),
    onSave: attack.kind === 'save' && 'onSave' in attack ? attack.onSave : 'half',
  }));
}

export function toAttackInputs(attacks: readonly FormAttack[]): AttackInput[] {
  return attacks.map((attack): AttackInput => {
    const details = {
      name: attack.name,
      damage: attack.damage,
      damageType: attack.damageType.trim(),
      notes: attack.notes.trim(),
      cost: attack.cost,
    };
    return attack.kind === 'save'
      ? { ...details, kind: 'save', dc: numberValue(attack.dc), saveAbility: attack.saveAbility || null, onSave: attack.onSave }
      : { ...details, kind: 'attack', bonus: numberValue(attack.bonus) };
  });
}
