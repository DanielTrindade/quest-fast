import type { CombatantView } from '@quest-fast/shared';
import { HEALTH_BAND_LABELS } from '../lib/combat-labels';
import { SelectField } from './SelectField';

export type TargetOption = Pick<CombatantView, 'id' | 'name' | 'healthBand' | 'hpCurrent' | 'hpMax' | 'defeated'>;

/** "Goblin 2 — 3/7 PV" for whoever sees the numbers, "Goblin 2 — Muito ferido" otherwise. */
function optionLabel(target: TargetOption): string {
  const state =
    target.hpCurrent !== null && target.hpMax !== null ? `${target.hpCurrent}/${target.hpMax} PV` : HEALTH_BAND_LABELS[target.healthBand];
  return `${target.name} — ${target.defeated ? HEALTH_BAND_LABELS.defeated : state}`;
}

/**
 * Who an attack is aimed at, from the combatants this viewer sees. "Sem alvo"
 * is for cover, or a target the app does not know about. The label stays
 * neutral: an attack roll then leaves the damage for later, but a save
 * attack rolls its damage at once.
 */
export function TargetPicker({ name, targets, value, onChange }: {
  /** Who attacks: names the field for screen readers. */
  name: string;
  targets: TargetOption[];
  /** The target's id, or empty for no target. */
  value: string;
  onChange: (targetId: string) => void;
}) {
  return (
    <SelectField label={`Alvo de ${name}`} value={value} onChange={onChange}>
      <option value="">Sem alvo</option>
      {targets.map((target) => (
        <option key={target.id} value={target.id}>{optionLabel(target)}</option>
      ))}
    </SelectField>
  );
}
