import type { CombatantView } from '@quest-fast/shared';
import { HEALTH_BAND_LABELS } from '../lib/combat-labels';
import { checkLabel } from './ui/segmented';

export type TargetOption = Pick<CombatantView, 'id' | 'name' | 'healthBand' | 'hpCurrent' | 'hpMax' | 'defeated'>;

/** "3/7 PV" for whoever sees the numbers, "Muito ferido" otherwise. */
function stateLabel(target: TargetOption): string {
  if (target.defeated) return HEALTH_BAND_LABELS.defeated;
  return target.hpCurrent !== null && target.hpMax !== null ? `${target.hpCurrent}/${target.hpMax} PV` : HEALTH_BAND_LABELS[target.healthBand];
}

/**
 * Who an attack is aimed at, from the combatants this viewer sees. None is
 * for cover, or a target the app does not know about. An attack roll takes
 * one; a save row (an area: Bola de Fogo) takes as many as it reaches.
 */
export function TargetPicker({ name, targets, value, onChange }: {
  /** Who attacks: names the group for screen readers. */
  name: string;
  targets: TargetOption[];
  /** The chosen targets' ids, in the order they were ticked. */
  value: string[];
  onChange: (targetIds: string[]) => void;
}) {
  const chosen = new Set(value);
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((ticked) => ticked !== id));
  return (
    <fieldset className="m-0 grid min-w-0 gap-1 border-0 p-0">
      <legend className="mb-1 text-small font-semibold text-text-secondary">Alvos de {name}</legend>
      {targets.length === 0 ? (
        <p className="m-0 text-small text-text-secondary">Ninguém mais no combate.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-x-4 p-0">
          {targets.map((target) => (
            <li key={target.id} className="min-w-0">
              <label className={checkLabel}>
                <input type="checkbox" checked={chosen.has(target.id)}
                  onChange={(event) => toggle(target.id, event.target.checked)} />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="text-foreground">{target.name}</span> — {stateLabel(target)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-small text-text-secondary">
        {value.length === 0 ? 'Sem alvo.' : value.length === 1 ? '1 alvo.' : `${value.length} alvos: só uma salvaguarda em área usa mais de um.`}
      </p>
    </fieldset>
  );
}
