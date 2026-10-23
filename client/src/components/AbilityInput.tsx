import { abilityModifier, type Ability } from '@quest-fast/shared';
import { ABILITY_LABELS, signed } from '../lib/5e';

/** An ability score typed as text, with its modifier following what is typed. */
export function AbilityInput({ ability, value, invalid, onChange }: {
  ability: Ability;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const modifier = abilityModifier(Number(value));
  return (
    <div className="qf-ability-input">
      <label>
        <span>{ABILITY_LABELS[ability]}</span>
        <input
          type="number"
          min={1}
          max={30}
          inputMode="numeric"
          value={value}
          aria-invalid={invalid || undefined}
          aria-label={`${ABILITY_LABELS[ability]} (modificador ${modifier === undefined ? 'indefinido' : signed(modifier)})`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <output aria-hidden="true">{modifier === undefined ? '?' : signed(modifier)}</output>
    </div>
  );
}
