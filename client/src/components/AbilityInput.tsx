import { abilityModifier, type Ability } from '@quest-fast/shared';
import { ABILITY_LABELS, signed } from '../lib/5e';
import { Input } from './ui/input';

/** An ability score typed as text, with its modifier following what is typed. */
export function AbilityInput({ ability, value, invalid, onChange }: {
  ability: Ability;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const modifier = abilityModifier(Number(value));
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-panel border border-border-strong bg-card p-3 edge-raised">
      <label className="grid gap-1 text-small">
        <span>{ABILITY_LABELS[ability]}</span>
        <Input
          className="bg-background"
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
      <output aria-hidden="true" className="min-w-8 font-mono text-h2 tabular-nums">{modifier === undefined ? '?' : signed(modifier)}</output>
    </div>
  );
}
