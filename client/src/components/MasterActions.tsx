import { useId, useState, type ReactNode } from 'react';
import { Crosshair, Sword } from '@phosphor-icons/react';
import type { CombatantView } from '@quest-fast/shared';
import { Button } from './Button';
import { CombatantControls } from './CombatantControls';
import { EmptyState } from './EmptyState';
import type { InitiativeActions } from './InitiativeList';
import { ReminderList } from './ReminderList';
import { SelectField } from './SelectField';
import { pendingDamageCount } from '../lib/combatant-state';

export type MasterFight = {
  name: string;
  combatants: CombatantView[];
  activeCombatantId: string | null;
  busyIds: readonly string[];
  actions: InitiativeActions;
};

function PendingDamage({ combatants, busyIds, actions }: Pick<MasterFight, 'combatants' | 'busyIds' | 'actions'>) {
  const targets = combatants
    .map((combatant) => ({ combatant, reminders: combatant.reminders.filter((reminder) => reminder.kind === 'pendingDamage') }))
    .filter(({ reminders }) => reminders.length > 0);
  const titleId = useId();
  if (targets.length === 0) return null;
  const { onApplyDamage, onDismissReminder } = actions;
  const busy = new Set(busyIds);
  return (
    <section aria-labelledby={titleId} className="grid min-w-0 gap-3">
      <h3 id={titleId} className="m-0 flex items-baseline justify-between gap-2 font-display text-h2 font-semibold">
        Dano pendente
        <span className="font-mono text-small font-semibold text-danger-text tabular-nums">{pendingDamageCount(combatants)}</span>
      </h3>
      <ul className="m-0 grid list-none gap-3 p-0">
        {targets.map(({ combatant, reminders }) => (
          <li key={combatant.id}
            className="grid min-w-0 gap-2 rounded-control border border-danger-text/40 bg-danger-surface px-3 py-2 motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-settle) motion-safe:ease-settle motion-safe:starting:translate-y-1 starting:opacity-0">
            <p className="m-0 text-small font-semibold [overflow-wrap:anywhere]">Em {combatant.name}</p>
            <ReminderList name={combatant.name} reminders={reminders} master pending={busy.has(combatant.id)}
              onApplyDamage={onApplyDamage && ((reminderId, amount) => onApplyDamage(combatant.id, reminderId, amount))}
              onDismiss={onDismissReminder && ((reminderId) => onDismissReminder(combatant.id, reminderId))} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function optionLabel(combatant: CombatantView, activeId: string | null): string {
  const marks = [combatant.id === activeId && 'vez atual', combatant.hidden && 'escondido', combatant.defeated && 'derrotado'].filter(Boolean);
  return marks.length > 0 ? `${combatant.name} (${marks.join(', ')})` : combatant.name;
}

/**
 * The master's Ações tab: the hits waiting to be applied, from the whole
 * fight, then one combatant opened up. It follows whose turn it is until
 * the master picks someone else; "Voltar para a vez" follows again.
 */
export function MasterActions({ fight, emptyAction }: {
  /** Null when no fight is in progress. */
  fight: MasterFight | null;
  /** Where encounters are prepared and started. */
  emptyAction: ReactNode;
}) {
  // Null follows the turn.
  const [pickedId, setPickedId] = useState<string | null>(null);

  if (!fight || fight.combatants.length === 0) {
    return (
      <EmptyState icon={Sword} title="Nenhum combate em andamento"
        description="Inicie um encontro no Preparo. Aqui ficam o turno, o dano pendente e as ações de quem está na vez. A rolagem secreta fica na aba Dados."
        action={emptyAction} />
    );
  }

  const { combatants, activeCombatantId, busyIds, actions } = fight;
  const picked = combatants.find((combatant) => combatant.id === pickedId);
  const selected = picked ?? combatants.find((combatant) => combatant.id === activeCombatantId) ?? combatants[0]!;
  const following = !picked;
  const activeName = combatants.find((combatant) => combatant.id === activeCombatantId)?.name;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PendingDamage combatants={combatants} busyIds={busyIds} actions={actions} />

      <section aria-label="Combatente escolhido" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <SelectField label="Combatente" value={selected.id}
          onChange={(id) => setPickedId(id === activeCombatantId ? null : id)}>
          {combatants.map((combatant) => (
            <option key={combatant.id} value={combatant.id}>{optionLabel(combatant, activeCombatantId)}</option>
          ))}
        </SelectField>
        {!following && activeName && (
          <div className="[&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
            <Button variant="ghost" onClick={() => setPickedId(null)}>
              <Crosshair size={18} aria-hidden="true" /> Voltar para a vez de {activeName}
            </Button>
          </div>
        )}
        <div className="rounded-panel border border-border bg-background p-3 data-hidden:border-dashed data-hidden:bg-surface-secret"
          data-hidden={selected.hidden || undefined}>
          <CombatantControls key={selected.id} combatant={selected} master active={selected.id === activeCombatantId}
            targets={combatants.filter((combatant) => combatant.id !== selected.id)}
            busy={busyIds.includes(selected.id)} damageReminders={false} actions={actions} />
        </div>
      </section>
    </div>
  );
}
