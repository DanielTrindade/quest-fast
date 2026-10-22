import type { Attack, AttackInput } from '@quest-fast/shared';

/**
 * Numbers stay text while they are typed: a number state turns the "-" of
 * "-2" into NaN and a cleared field into an undeletable 0.
 */
export type FormAttack = { rowId: string; name: string; bonus: string; damage: string; damageType: string; notes: string };

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

export function toFormAttacks(attacks: readonly Attack[]): FormAttack[] {
  return attacks.map((attack) => ({ rowId: newRowId(), ...attack, bonus: String(attack.bonus) }));
}

export function toAttackInputs(attacks: readonly FormAttack[]): AttackInput[] {
  return attacks.map((attack) => ({
    name: attack.name,
    bonus: numberValue(attack.bonus),
    damage: attack.damage,
    damageType: attack.damageType.trim(),
    notes: attack.notes.trim(),
  }));
}
