import { useId, useState } from 'react';
import { Brain, DiceFive, Skull, Sword } from '@phosphor-icons/react';
import { COMBAT_LIMITS, halfDamage, type CombatReminder, type PendingDamage } from '@quest-fast/shared';
import { ABILITY_LABELS } from '../lib/5e';
import { Button } from './Button';
import { Input } from './ui/input';

export type ReminderActions = {
  onRollSave?: (reminderId: string) => void;
  onRecordFailure?: (reminderId: string, failures: 1 | 2) => void;
  onDismiss?: (reminderId: string) => void;
  /**
   * The master only: applies a pending damage. Without an amount, the server
   * applies the roll whole, even past the limit of a typed amount.
   */
  onApplyDamage?: (reminderId: string, amount?: number) => void;
};

/** "Dano pendente: 14 cortante (crítico) de Goblin 1 com Cimitarra." */
function damageText(reminder: PendingDamage): string {
  const type = reminder.damageType ? ` ${reminder.damageType.toLowerCase()}` : ' de dano';
  const critical = reminder.critical ? ' (crítico)' : '';
  const save = reminder.save ? ` CD ${reminder.save.dc} de ${ABILITY_LABELS[reminder.save.ability]}: metade se passar.` : '';
  return `Dano pendente: ${reminder.amount}${type}${critical} de ${reminder.attackerName} com ${reminder.attackName}.${save}`;
}

function text(reminder: CombatReminder, resolves: boolean): string {
  switch (reminder.kind) {
    case 'concentration':
      return `Salvaguarda de Constituição para manter a concentração: CD ${reminder.dc}.`;
    case 'deathFailure':
      return 'Sofreu dano caído: marque uma falha no teste contra a morte, ou duas se foi um crítico.';
    case 'pendingDamage':
      return resolves ? damageText(reminder) : `${damageText(reminder)} Aguardando o mestre.`;
  }
}

function Icon({ kind }: { kind: CombatReminder['kind'] }) {
  if (kind === 'concentration') return <Brain size={18} aria-hidden="true" className="mt-0.5 flex-none text-accent-text" />;
  if (kind === 'pendingDamage') return <Sword size={18} aria-hidden="true" className="mt-0.5 flex-none text-danger-text" />;
  return <Skull size={18} aria-hidden="true" className="mt-0.5 flex-none text-danger-text" />;
}

/**
 * The master's controls on a pending damage: the amount, adjustable for a
 * resistance; "Metade" for a save the target passed; apply or drop it. An
 * untouched amount goes as the roll, whole.
 */
function DamageControls({ name, reminder, pending, onApply, onDismiss }: {
  name: string;
  reminder: PendingDamage;
  pending: boolean;
  onApply: (amount?: number) => void;
  onDismiss?: () => void;
}) {
  const id = useId();
  const [amount, setAmount] = useState(String(reminder.amount));
  const { min, max } = COMBAT_LIMITS.hpAmount;
  const value = Number(amount);
  const untouched = value === reminder.amount;
  const valid = untouched || (amount.trim() !== '' && Number.isInteger(value) && value >= min && value <= max);
  const half = halfDamage(reminder.amount);
  return (
    <>
      <label htmlFor={id} className="grid flex-[0_0_6rem] gap-1 text-small text-text-secondary">
        Quantidade
        <Input id={id} type="number" inputMode="numeric" min={min} value={amount}
          disabled={pending} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <Button variant="secondary" disabled={!valid || pending} onClick={() => onApply(untouched ? undefined : value)}>
        <Sword size={18} aria-hidden="true" /> Aplicar<span className="sr-only"> o dano em {name}</span>
      </Button>
      {reminder.save && half >= min && half <= max && (
        <Button variant="ghost" disabled={pending} onClick={() => onApply(half)}>
          Metade<span className="sr-only"> do dano em {name}</span>
        </Button>
      )}
      {onDismiss && (
        <Button variant="ghost" disabled={pending} onClick={onDismiss}>
          Descartar<span className="sr-only"> o dano em {name}</span>
        </Button>
      )}
    </>
  );
}

/**
 * What a hit left for the table to resolve. Nothing here is applied on its
 * own: the one who rolls, marks or dismisses decides. Without actions, the
 * list only tells the rest of the table what is pending. A pending damage is
 * the master's alone: the owner of the character sees it waiting.
 */
export function ReminderList({ name, reminders, pending = false, onRollSave, onRecordFailure, onDismiss, onApplyDamage }: ReminderActions & {
  /** Whose reminders: names the controls for screen readers. */
  name: string;
  reminders: CombatReminder[];
  pending?: boolean;
}) {
  if (reminders.length === 0) return null;
  return (
    <ul className="m-0 grid list-none gap-2 p-0" aria-label={`Pendências de ${name}`}>
      {reminders.map((reminder) => {
        const resolvesDamage = reminder.kind === 'pendingDamage' && !!onApplyDamage;
        // Only who applies a pending damage may drop it.
        const dismiss = reminder.kind === 'pendingDamage' && !onApplyDamage ? undefined : onDismiss;
        const hasActions =
          resolvesDamage ||
          (reminder.kind === 'concentration' && !!onRollSave) ||
          (reminder.kind === 'deathFailure' && !!onRecordFailure) ||
          !!dismiss;
        return (
          <li key={reminder.id} data-kind={reminder.kind}
            className="group/reminder grid min-w-0 gap-2 rounded-control border border-border-strong bg-background px-3 py-2">
            <p className="m-0 flex items-start gap-2 text-small text-foreground">
              <Icon kind={reminder.kind} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{text(reminder, resolvesDamage)}</span>
            </p>
            {hasActions && (
              <div className="flex flex-wrap items-end gap-2 *:max-w-full [&>[data-slot=button]]:whitespace-normal">
                {reminder.kind === 'concentration' && onRollSave && (
                  <Button variant="secondary" disabled={pending} onClick={() => onRollSave(reminder.id)}>
                    <DiceFive size={18} aria-hidden="true" /> Rolar salvaguarda<span className="sr-only"> de {name}</span>
                  </Button>
                )}
                {reminder.kind === 'deathFailure' && onRecordFailure && (
                  <>
                    <Button variant="secondary" disabled={pending} onClick={() => onRecordFailure(reminder.id, 1)}>
                      Uma falha<span className="sr-only"> para {name}</span>
                    </Button>
                    <Button variant="secondary" disabled={pending} onClick={() => onRecordFailure(reminder.id, 2)}>
                      Duas falhas<span className="sr-only"> para {name}</span>
                    </Button>
                  </>
                )}
                {reminder.kind === 'pendingDamage' && onApplyDamage ? (
                  <DamageControls name={name} reminder={reminder} pending={pending}
                    onApply={(amount) => onApplyDamage(reminder.id, amount)}
                    onDismiss={dismiss && (() => dismiss(reminder.id))} />
                ) : (
                  dismiss && (
                    <Button variant="ghost" disabled={pending} onClick={() => dismiss(reminder.id)}>
                      Dispensar<span className="sr-only"> o lembrete de {name}</span>
                    </Button>
                  )
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
