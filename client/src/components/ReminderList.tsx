import { Brain, DiceFive, Skull } from '@phosphor-icons/react';
import type { CombatReminder } from '@quest-fast/shared';
import { Button } from './Button';

export type ReminderActions = {
  onRollSave?: (reminderId: string) => void;
  onRecordFailure?: (reminderId: string, failures: 1 | 2) => void;
  onDismiss?: (reminderId: string) => void;
};

function text(reminder: CombatReminder): string {
  switch (reminder.kind) {
    case 'concentration':
      return `Salvaguarda de Constituição para manter a concentração: CD ${reminder.dc}.`;
    case 'deathFailure':
      return 'Sofreu dano caído: marque uma falha no teste contra a morte, ou duas se foi um crítico.';
    case 'pendingDamage':
      return `Dano pendente de ${reminder.attackerName}: ${reminder.amount}${reminder.damageType ? ` ${reminder.damageType.toLowerCase()}` : ''}, aguardando o mestre.`;
  }
}

/**
 * What a hit left for the table to resolve. Nothing here is applied on its
 * own: the one who rolls, marks or dismisses decides. Without actions, the
 * list only tells the rest of the table what is pending.
 */
export function ReminderList({ name, reminders, pending = false, onRollSave, onRecordFailure, onDismiss }: ReminderActions & {
  /** Whose reminders: names the controls for screen readers. */
  name: string;
  reminders: CombatReminder[];
  pending?: boolean;
}) {
  if (reminders.length === 0) return null;
  return (
    <ul className="m-0 grid list-none gap-2 p-0" aria-label={`Pendências de ${name}`}>
      {reminders.map((reminder) => (
        <li key={reminder.id} data-kind={reminder.kind}
          className="group/reminder grid min-w-0 gap-2 rounded-control border border-border-strong bg-background px-3 py-2">
          <p className="m-0 flex items-start gap-2 text-small text-foreground">
            {reminder.kind === 'concentration'
              ? <Brain size={18} aria-hidden="true" className="mt-0.5 flex-none text-accent-text" />
              : <Skull size={18} aria-hidden="true" className="mt-0.5 flex-none text-danger-text" />}
            <span className="min-w-0 [overflow-wrap:anywhere]">{text(reminder)}</span>
          </p>
          {(onRollSave || onRecordFailure || onDismiss) && (
            <div className="flex flex-wrap items-center gap-2 *:max-w-full [&>[data-slot=button]]:whitespace-normal">
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
              {onDismiss && (
                <Button variant="ghost" disabled={pending} onClick={() => onDismiss(reminder.id)}>
                  Dispensar<span className="sr-only"> o lembrete de {name}</span>
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
