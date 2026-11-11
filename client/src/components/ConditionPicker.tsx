import { useId, useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { COMBAT_LIMITS, CONDITIONS, EXHAUSTION_MAX, type ActiveCondition, type Condition } from '@quest-fast/shared';
import { Button } from './Button';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';
import { CONDITION_LABELS, conditionLabel } from '../lib/combat-labels';

const LEVELS = Array.from({ length: EXHAUSTION_MAX }, (_, index) => index + 1);
const field = 'grid min-w-0 gap-1 text-small text-text-secondary';

/**
 * The conditions on a combatant, each removable, and a form to apply one.
 * Applying one already there updates its level or duration. It only asks;
 * the server keeps one entry per condition.
 */
export function ConditionPicker({ name, conditions, durations = true, pending = false, onApply, onRemove }: {
  /** Whose conditions: names the controls for screen readers. */
  name: string;
  conditions: ActiveCondition[];
  /** Durations count rounds of a fight; the sheet sets none. */
  durations?: boolean;
  pending?: boolean;
  onApply: (condition: ActiveCondition) => void;
  onRemove: (condition: Condition) => void;
}) {
  const id = useId();
  const [condition, setCondition] = useState<Condition>(
    () => CONDITIONS.find((candidate) => !conditions.some((active) => active.condition === candidate)) ?? CONDITIONS[0],
  );
  const [level, setLevel] = useState('1');
  const [rounds, setRounds] = useState('');
  const { min, max } = COMBAT_LIMITS.conditionRounds;
  const roundsValue = Number(rounds);
  const roundsValid = rounds.trim() === '' || (Number.isInteger(roundsValue) && roundsValue >= min && roundsValue <= max);
  const applied = conditions.some((active) => active.condition === condition);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!roundsValid) return;
    onApply({
      condition,
      ...(condition === 'exhaustion' ? { level: Number(level) } : {}),
      ...(durations && rounds.trim() !== '' ? { roundsLeft: roundsValue } : {}),
    });
    setRounds('');
  };

  return (
    <div className="grid min-w-0 gap-3">
      {conditions.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={`Condições de ${name}`}>
          {conditions.map((active) => (
            <li key={active.condition}
              className="inline-flex min-h-9 items-center gap-1 rounded-control border border-input bg-background ps-2 text-small text-foreground">
              {conditionLabel(active)}
              <button type="button" disabled={pending} onClick={() => onRemove(active.condition)}
                aria-label={`Remover ${CONDITION_LABELS[active.condition]} de ${name}`}
                className="inline-grid size-9 cursor-pointer place-items-center rounded-control text-text-secondary transition-[background-color,color] duration-(--duration-quick) hover:not-disabled:bg-muted hover:not-disabled:text-foreground disabled:cursor-not-allowed disabled:opacity-60">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-small text-text-secondary">Sem condições.</p>
      )}

      <form onSubmit={submit} aria-label={`Aplicar condição em ${name}`}
        className="flex min-w-0 flex-wrap items-end gap-2 [&>[data-slot=button]]:flex-auto">
        <label htmlFor={`${id}-condition`} className={`${field} flex-[2_1_9rem]`}>
          Condição
          <NativeSelect id={`${id}-condition`} value={condition} disabled={pending}
            onChange={(event) => setCondition(event.target.value as Condition)}>
            {CONDITIONS.map((option) => <option key={option} value={option}>{CONDITION_LABELS[option]}</option>)}
          </NativeSelect>
        </label>
        {condition === 'exhaustion' && (
          <label htmlFor={`${id}-level`} className={`${field} flex-[0_0_5.5rem]`}>
            Nível
            <NativeSelect id={`${id}-level`} value={level} disabled={pending} onChange={(event) => setLevel(event.target.value)}>
              {LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
            </NativeSelect>
          </label>
        )}
        {durations && (
          <label htmlFor={`${id}-rounds`} className={`${field} flex-[1_1_7rem]`}>
            Rodadas
            <Input id={`${id}-rounds`} type="number" inputMode="numeric" min={min} max={max} placeholder="Sem duração"
              value={rounds} disabled={pending} aria-invalid={!roundsValid || undefined}
              onChange={(event) => setRounds(event.target.value)} />
          </label>
        )}
        <Button type="submit" variant="secondary" disabled={pending || !roundsValid}>
          {applied ? 'Atualizar' : 'Aplicar'}<span className="sr-only"> {CONDITION_LABELS[condition]} em {name}</span>
        </Button>
      </form>
    </div>
  );
}
