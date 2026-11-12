import { useId, useState } from 'react';
import { EyeSlash } from '@phosphor-icons/react';
import type { Attack, RollMode } from '@quest-fast/shared';
import { contentKeys } from '../lib/content-keys';
import { AttackCard } from './AttackCard';
import { RollModeControl } from './RollModeControl';
import { TargetPicker, type TargetOption } from './TargetPicker';
import { checkLabel } from './ui/segmented';

export type AttackOptions = { targetId: string | null; mode: RollMode; secret: boolean };

/**
 * One combatant's attacks during the fight: a target, the roll mode and, for
 * the master, whether the roll is secret, shared by every attack below. It
 * only asks: the server rolls, compares with the AC and leaves the damage
 * for the master to apply.
 */
export function CombatantAttacks({ name, attacks, targets, master = false, defaultSecret = false, pending = false, onAttack }: {
  /** Who attacks: names the controls for screen readers. */
  name: string;
  attacks: Attack[];
  /** Everyone else this viewer sees. */
  targets: TargetOption[];
  /** Only the master may roll in secret. */
  master?: boolean;
  /** A monster attacks in secret unless the master says otherwise. */
  defaultSecret?: boolean;
  pending?: boolean;
  onAttack: (attackIndex: number, options: AttackOptions) => void;
}) {
  const id = useId();
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState<RollMode>('normal');
  const [secret, setSecret] = useState(defaultSecret);

  if (attacks.length === 0) {
    return <p className="m-0 text-small text-text-secondary">Sem ataques cadastrados: use os dados livres.</p>;
  }
  // A target that left the fight is no longer offered.
  const target = targets.some((candidate) => candidate.id === targetId) ? targetId : '';
  return (
    <fieldset disabled={pending} className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-0 p-0">
      <legend className="sr-only">Ataques de {name}</legend>
      <TargetPicker name={name} targets={targets} value={target} onChange={setTargetId} />
      <RollModeControl value={mode} onChange={setMode} disabled={pending} name={`${id}-mode`} label={`Tipo de rolagem dos ataques de ${name}`} />
      {master && (
        <label className={checkLabel}>
          <input type="checkbox" checked={secret} onChange={(event) => setSecret(event.target.checked)} />
          <EyeSlash size={16} aria-hidden="true" />
          <span>Atacar em segredo (só você vê)</span>
        </label>
      )}
      <ul className="m-0 grid list-none gap-2 p-0" aria-label={`Ataques de ${name}`}>
        {/* Attacks have no id; the server takes the position in the sheet. */}
        {contentKeys(attacks).map(({ item: attack, key }, index) => (
          <li key={key} className="min-w-0">
            <AttackCard {...attack} disabled={pending}
              onRoll={() => onAttack(index, {
                targetId: target || null,
                // Advantage belongs to an attack roll; a save has none.
                mode: attack.kind === 'save' ? 'normal' : mode,
                secret: master && secret,
              })} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
