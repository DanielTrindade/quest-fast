import { useId } from 'react';
import { Brain, DiceFive, Eye, EyeSlash } from '@phosphor-icons/react';
import type { CombatantView } from '@quest-fast/shared';
import { canRollDeathSave, canToggleConcentration, isDown } from '../lib/combatant-state';
import { ArmorShield } from './ArmorShield';
import { Button } from './Button';
import { CombatantAttacks } from './CombatantAttacks';
import { ConditionChips, ConditionPicker } from './ConditionPicker';
import { DeathSaveTracker } from './DeathSaveTracker';
import { HealthBand } from './HealthBand';
import { HpAdjuster } from './HpAdjuster';
import { HpMeter } from './HpMeter';
import type { InitiativeActions } from './InitiativeList';
import { ReminderList } from './ReminderList';

type Part = { combatant: CombatantView; master: boolean; active: boolean; busy: boolean; actions: InitiativeActions };

/** Binds a queue handler to this combatant. */
function bind<A extends unknown[]>(id: string, handler: ((combatantId: string, ...args: A) => void) | undefined) {
  return handler && ((...args: A) => handler(id, ...args));
}

function Vitals({ combatant }: { combatant: CombatantView }) {
  const { hpCurrent, hpMax, hpTemp } = combatant;
  if (hpCurrent === null || hpMax === null) return <HealthBand band={combatant.healthBand} />;
  return (
    <div className="grid min-w-0 gap-1">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-small text-text-secondary">
        <span>Pontos de vida</span>
        <span data-down={hpCurrent === 0 || undefined} className="font-mono text-body font-semibold text-foreground tabular-nums data-down:text-danger-text">
          {hpCurrent}<span className="text-text-secondary">/{hpMax}</span>
          {!!hpTemp && <span className="text-text-secondary"> +{hpTemp}<span className="sr-only"> temporários</span></span>}
        </span>
      </p>
      <HpMeter current={hpCurrent} max={hpMax} temp={hpTemp ?? 0} />
    </div>
  );
}

function Head({ combatant, active, nameId }: { combatant: CombatantView; active: boolean; nameId: string }) {
  return (
    <header className="flex min-w-0 items-start gap-3">
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid min-w-0 gap-0.5">
          <h3 id={nameId} className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere]">{combatant.name}</h3>
          <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-small text-text-secondary [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">
            {active && <span className="font-semibold text-accent-text">Vez atual</span>}
            {combatant.hidden && <span><EyeSlash size={14} aria-hidden="true" /> Escondido</span>}
            {combatant.concentrating && <span><Brain size={14} aria-hidden="true" /> Concentrando</span>}
            {!combatant.hasInitiative && <span>Aguardando iniciativa</span>}
          </p>
        </div>
        <Vitals combatant={combatant} />
      </div>
      {combatant.ac !== null && <ArmorShield value={combatant.ac} size="md" />}
    </header>
  );
}

/** Death saves of a character down, and what a hit left to resolve. */
function Pending({ combatant, master, active, busy, actions, damageReminders }: Part & { damageReminders: boolean }) {
  const { id, name } = combatant;
  const reminders = damageReminders ? combatant.reminders : combatant.reminders.filter((reminder) => reminder.kind !== 'pendingDamage');
  const { onRecordFailure } = actions;
  return (
    <>
      {isDown(combatant) && combatant.deathSaves && (
        <DeathSaveTracker name={name} deathSaves={combatant.deathSaves} pending={busy}
          canRoll={canRollDeathSave(combatant, { acts: true, master, active })} onRoll={bind(id, actions.onDeathSave)} />
      )}
      <ReminderList name={name} reminders={reminders} pending={busy} master={master}
        onRollSave={bind(id, actions.onConcentrationSave)}
        onRecordFailure={onRecordFailure && ((reminderId, failures) => onRecordFailure(id, failures, reminderId))}
        onDismiss={bind(id, actions.onDismissReminder)}
        onApplyDamage={master ? bind(id, actions.onApplyDamage) : undefined} />
    </>
  );
}

/** The player rolls their own initiative here; the master rolls the creatures' from the queue. */
function OwnInitiative({ combatant, master, busy, actions }: Part) {
  const { onRoll } = actions;
  if (master || combatant.hasInitiative || !onRoll) return null;
  return (
    <div>
      <Button variant="secondary" disabled={busy} onClick={() => onRoll(combatant.id)}>
        <DiceFive size={18} aria-hidden="true" /> Rolar iniciativa<span className="sr-only"> de {combatant.name}</span>
      </Button>
    </div>
  );
}

function Attacks({ combatant, targets, master, busy, actions }: Part & { targets: CombatantView[] }) {
  const { onAttack } = actions;
  if (!onAttack || isDown(combatant) || combatant.defeated) return null;
  return (
    <div className="grid min-w-0 gap-2">
      <h4 className="m-0 text-small font-semibold text-text-secondary">Atacar</h4>
      <CombatantAttacks name={combatant.name} attacks={combatant.attacks} targets={targets} master={master}
        defaultSecret={master && combatant.source !== 'character'} pending={busy}
        onAttack={(attackIndex, options) => onAttack(combatant.id, attackIndex, options)} />
    </div>
  );
}

function HitPointsAndConditions({ combatant, busy, actions }: Part) {
  const { onHitPoints, onConcentration, onApplyCondition } = actions;
  if (!onHitPoints && !onConcentration && !onApplyCondition) return null;
  const { id, name, hpCurrent, hpMax } = combatant;
  return (
    <div className="grid min-w-0 gap-3 border-t border-border pt-4">
      <h4 className="m-0 text-small font-semibold text-text-secondary">Pontos de vida e condições</h4>
      {onHitPoints && (
        <HpAdjuster name={name} pending={busy} full={hpCurrent !== null && hpMax !== null && hpCurrent >= hpMax}
          onApply={(operation, amount) => onHitPoints(id, operation, amount)} />
      )}
      {onConcentration && canToggleConcentration(combatant) && (
        <div className="min-w-0 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
          <Button variant="ghost" aria-pressed={combatant.concentrating} disabled={busy}
            onClick={() => onConcentration(id, !combatant.concentrating)}>
            <Brain size={18} aria-hidden="true" />
            {combatant.concentrating ? 'Encerrar concentração' : 'Marcar concentração'}
            <span className="sr-only"> de {name}</span>
          </Button>
        </div>
      )}
      {onApplyCondition && (
        <ConditionPicker name={name} conditions={combatant.conditions} listed={false} pending={busy}
          onApply={(condition) => onApplyCondition(id, condition)} />
      )}
    </div>
  );
}

function HideToggle({ combatant, master, busy, actions }: Part) {
  const { onToggleHidden } = actions;
  if (!master || !onToggleHidden) return null;
  return (
    <div className="[&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
      <Button variant="ghost" disabled={busy} onClick={() => onToggleHidden(combatant.id, !combatant.hidden)}>
        {combatant.hidden ? <Eye size={18} aria-hidden="true" /> : <EyeSlash size={18} aria-hidden="true" />}
        {combatant.hidden ? 'Revelar para a mesa' : 'Esconder da mesa'}
        <span className="sr-only"> {combatant.name}</span>
      </Button>
    </div>
  );
}

/**
 * One combatant opened up for whoever acts on it at the table: the player's
 * own character, or the one the master picked. The same pieces as its card
 * in the initiative queue, unfolded, and with the same rules: the handlers
 * come from the fight, and the server checks every request again.
 * `damageReminders` leaves out the pending damage when the panel already
 * lists every hit waiting on the master.
 */
export function CombatantControls({ combatant, targets, master, active, busy = false, damageReminders = true, actions }: {
  combatant: CombatantView;
  /** Everyone else this viewer sees: who it may attack. */
  targets: CombatantView[];
  master: boolean;
  /** Whether it is this combatant's turn. */
  active: boolean;
  busy?: boolean;
  damageReminders?: boolean;
  actions: InitiativeActions;
}) {
  const nameId = useId();
  const part: Part = { combatant, master, active, busy, actions };
  return (
    <section aria-labelledby={nameId} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Head combatant={combatant} active={active} nameId={nameId} />
      <ConditionChips name={combatant.name} conditions={combatant.conditions} pending={busy} onRemove={bind(combatant.id, actions.onRemoveCondition)} />
      <Pending {...part} damageReminders={damageReminders} />
      <OwnInitiative {...part} />
      <Attacks {...part} targets={targets} />
      <HitPointsAndConditions {...part} />
      <HideToggle {...part} />
    </section>
  );
}
