import { Eraser } from '@phosphor-icons/react';
import { ROLL_BONUS_LENGTH, parseRollBonus } from '@quest-fast/shared';
import { Badge } from './ui/badge';
import { Button } from './Button';
import { Field } from './Field';
import { NO_ROLL_BONUS, hasRollBonus, type RollBonusDraft } from '../lib/roll-bonus-draft';

const INVALID = 'Use dado e número com sinal, como +1d4, -1d4 ou +2.';

function invalid(text: string): boolean {
  return text.trim() !== '' && parseRollBonus(text.trim()) === undefined;
}

/**
 * The situational modifiers (Bênção, Perdição, Marca do Caçador) added to
 * every roll from here until cleared: one on the d20 (hit, tests, saves,
 * initiative), one on the damage. Presentational: the screen keeps the text
 * and sends it with each roll; the server rolls it.
 */
export function RollBonusBar({ value, onChange }: { value: RollBonusDraft; onChange: (next: RollBonusDraft) => void }) {
  const active = hasRollBonus(value);
  return (
    <fieldset data-slot="roll-bonus" className="m-0 grid min-w-0 gap-3 rounded-control border border-border bg-card p-3 @container/bonus">
      <legend className="sr-only">Modificadores das próximas rolagens</legend>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p aria-hidden="true" className="m-0 text-small font-semibold text-text-secondary">Modificadores</p>
        {active && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Ativo</Badge>
            <Button variant="ghost" onClick={() => onChange(NO_ROLL_BONUS)} aria-label="Limpar os modificadores">
              <Eraser size={16} aria-hidden="true" /> Limpar
            </Button>
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-3 @min-[20rem]/bonus:grid-cols-2">
        <Field label="No d20" value={value.roll} maxLength={ROLL_BONUS_LENGTH} autoComplete="off" spellCheck={false} inputMode="text"
          placeholder="+1d4" hint="Acerto, testes, salvaguardas e iniciativa" error={invalid(value.roll) ? INVALID : undefined}
          onChange={(event) => onChange({ ...value, roll: event.target.value })} />
        <Field label="No dano" value={value.damage} maxLength={ROLL_BONUS_LENGTH} autoComplete="off" spellCheck={false} inputMode="text"
          placeholder="+1d6" hint="Soma no dano de ataques e magias" error={invalid(value.damage) ? INVALID : undefined}
          onChange={(event) => onChange({ ...value, damage: event.target.value })} />
      </div>
    </fieldset>
  );
}
