import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Brain, DiceFive, DotsThree, Eye, EyeSlash, Heartbeat, Skull, Sword, Trash } from '@phosphor-icons/react';
import {
  ENCOUNTER_LIMITS,
  type ActiveCondition,
  type CombatantView,
  type Condition,
  type HpOperation,
  type RollMode,
} from '@quest-fast/shared';
import { Button } from './Button';
import { CombatantAttacks, type AttackOptions } from './CombatantAttacks';
import { ConditionChips, ConditionPicker } from './ConditionPicker';
import { DeathSaveTracker } from './DeathSaveTracker';
import { HealthBand } from './HealthBand';
import { HpAdjuster } from './HpAdjuster';
import { Input } from './Input';
import { ReminderList } from './ReminderList';
import { tiedWith } from '../lib/combat-labels';

export type InitiativeActions = {
  /** Rolls on the server; the list only asks. */
  onRoll?: (combatantId: string) => void;
  onAssign?: (combatantId: string, value: number) => void;
  onToggleHidden?: (combatantId: string, hidden: boolean) => void;
  onRemove?: (combatantId: string) => void;
  onMoveTie?: (combatantId: string, direction: 'up' | 'down') => void;
  /** During the fight: the master on anyone, a player on their own character. */
  onHitPoints?: (combatantId: string, operation: HpOperation, amount: number) => void;
  onApplyCondition?: (combatantId: string, condition: ActiveCondition) => void;
  onRemoveCondition?: (combatantId: string, condition: Condition) => void;
  onConcentration?: (combatantId: string, concentrating: boolean) => void;
  onDeathSave?: (combatantId: string, mode: RollMode) => void;
  onRecordFailure?: (combatantId: string, failures: 1 | 2, reminderId: string) => void;
  onConcentrationSave?: (combatantId: string, reminderId: string) => void;
  onDismissReminder?: (combatantId: string, reminderId: string) => void;
  /** The master on anyone, a player with their own character, at anyone they see. */
  onAttack?: (combatantId: string, attackIndex: number, options: AttackOptions) => void;
  /** The master only. Without an amount, the pending damage goes in whole. */
  onApplyDamage?: (combatantId: string, reminderId: string, amount?: number) => void;
};

type RowProps = InitiativeActions & {
  combatant: CombatantView;
  /** Everyone else in the queue: who this combatant may attack. */
  targets: CombatantView[];
  active: boolean;
  own: boolean;
  master: boolean;
  editable: boolean;
  busy: boolean;
  tie: { up: boolean; down: boolean };
};

const score = 'inline-grid size-11 flex-none place-items-center rounded-full border border-border-strong bg-background font-mono text-h2 leading-none font-semibold text-foreground tabular-nums edge-inset group-aria-[current=step]/row:border-accent-text group-aria-[current=step]/row:text-accent-text';

function Score({ combatant }: { combatant: CombatantView }) {
  if (combatant.initiative !== null) {
    return <span className={score}><span className="sr-only">Iniciativa </span>{combatant.initiative}</span>;
  }
  // A player knows a monster rolled, not what it rolled.
  const [symbol, text] = combatant.hasInitiative ? ['•', 'Iniciativa definida'] : ['–', 'Sem iniciativa'];
  return (
    <span className={score}>
      <span aria-hidden="true">{symbol}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Tags({ combatant, active, own }: { combatant: CombatantView; active: boolean; own: boolean }) {
  return (
    <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-small text-text-secondary [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">
      {active && <span className="font-semibold text-accent-text">Vez atual</span>}
      {own && <span>Seu personagem</span>}
      {combatant.hidden && (
        <span>
          <EyeSlash size={14} aria-hidden="true" /> Escondido
        </span>
      )}
      {/* Without numbers the health band already says it. */}
      {combatant.defeated && combatant.hpCurrent !== null && (
        <span>
          <Skull size={14} aria-hidden="true" /> Derrotado
        </span>
      )}
      {combatant.concentrating && (
        <span>
          <Brain size={14} aria-hidden="true" /> Concentrando
        </span>
      )}
      {!combatant.hasInitiative && <span>Aguardando iniciativa</span>}
    </p>
  );
}

/** A character at 0 hit points: still in the queue, making death saves. */
function down(combatant: CombatantView): boolean {
  return combatant.deathSaves !== null && combatant.hpCurrent === 0;
}

function Vitals({ combatant }: { combatant: CombatantView }) {
  if (combatant.hpCurrent === null || combatant.hpMax === null) return <HealthBand band={combatant.healthBand} />;
  return (
    <dl className="m-0 flex gap-4 *:grid *:min-w-10 *:justify-items-end [&_dd]:m-0 [&_dd]:font-mono [&_dd]:tabular-nums [&_dt]:text-micro [&_dt]:text-text-secondary">
      <div>
        <dt>CA</dt>
        <dd>{combatant.ac}</dd>
      </div>
      <div>
        <dt>PV</dt>
        <dd>
          {combatant.hpCurrent}
          <span className="text-small text-text-secondary">/{combatant.hpMax}</span>
          {!!combatant.hpTemp && <span className="text-small text-text-secondary"> +{combatant.hpTemp}<span className="sr-only"> temporários</span></span>}
        </dd>
      </div>
    </dl>
  );
}

function AssignInitiative({ combatant, busy, onAssign }: {
  combatant: CombatantView;
  busy: boolean;
  onAssign: (combatantId: string, value: number) => void;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const { min, max } = ENCOUNTER_LIMITS.initiative;
  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onAssign(combatant.id, parsed);
    setValue('');
  };

  return (
    <form className="flex max-w-full min-w-0 gap-1" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>Iniciativa de {combatant.name}</label>
      <Input className="w-24 min-w-14 shrink" id={id} type="number" inputMode="numeric" min={min} max={max}
        placeholder="Valor" value={value} onChange={(event) => setValue(event.target.value)} />
      <Button type="submit" variant="secondary" disabled={!valid || busy}>
        Definir<span className="sr-only"> iniciativa de {combatant.name}</span>
      </Button>
    </form>
  );
}

function RemoveCombatant({ combatant, busy, onRemove }: {
  combatant: CombatantView;
  busy: boolean;
  onRemove: (combatantId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
        <Trash size={18} aria-hidden="true" /> Remover<span className="sr-only"> {combatant.name}</span>
      </Button>
    );
  }
  return (
    <span className="flex max-w-full min-w-0 flex-wrap items-center gap-2 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:min-w-0 [&>[data-slot=button]]:text-center [&>[data-slot=button]]:whitespace-normal [&>[data-slot=button]]:[overflow-wrap:anywhere]" role="group" aria-label={`Remover ${combatant.name}?`}>
      <Button variant="danger" disabled={busy} onClick={() => onRemove(combatant.id)}>Remover {combatant.name}</Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>Manter</Button>
    </span>
  );
}

/** Rare corrections, folded so the queue reads at a glance. */
function Adjust({ combatant, busy, onRoll, onAssign, onToggleHidden, onRemove }: InitiativeActions & {
  combatant: CombatantView;
  busy: boolean;
}) {
  const rolled = combatant.hasInitiative;
  return (
    <details className="group/more min-w-0 open:basis-full">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control px-3 font-semibold text-accent-text transition-[background-color] duration-(--duration-quick) hover:bg-muted [&::-webkit-details-marker]:hidden">
        <DotsThree size={18} aria-hidden="true" /> Ajustar<span className="sr-only"> {combatant.name}</span>
      </summary>
      <div className="flex flex-wrap items-center gap-2 pt-2 *:max-w-full [&>[data-slot=button]]:whitespace-normal">
        {rolled && onRoll && (
          <Button variant="secondary" disabled={busy} onClick={() => onRoll(combatant.id)}>
            <DiceFive size={18} aria-hidden="true" /> Rolar de novo<span className="sr-only"> a iniciativa de {combatant.name}</span>
          </Button>
        )}
        {rolled && onAssign && <AssignInitiative combatant={combatant} busy={busy} onAssign={onAssign} />}
        {onToggleHidden && (
          <Button variant="ghost" disabled={busy} onClick={() => onToggleHidden(combatant.id, !combatant.hidden)}>
            {combatant.hidden ? <Eye size={18} aria-hidden="true" /> : <EyeSlash size={18} aria-hidden="true" />}
            {combatant.hidden ? 'Revelar' : 'Esconder'}
            <span className="sr-only"> {combatant.name}</span>
          </Button>
        )}
        {onRemove && <RemoveCombatant combatant={combatant} busy={busy} onRemove={onRemove} />}
      </div>
    </details>
  );
}

/**
 * The master's controls on one line: setting initiative while it is missing,
 * ties, the fight panel, then "Ajustar". An opened panel takes the whole line.
 */
function MasterActions({ combatant, busy, tie, fight, onMoveTie, ...actions }: InitiativeActions & {
  combatant: CombatantView;
  busy: boolean;
  tie: { up: boolean; down: boolean };
  fight: ReactNode;
}) {
  const { onRoll, onAssign } = actions;
  const missing = !combatant.hasInitiative;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {missing && onRoll && (
        <Button variant="secondary" disabled={busy} onClick={() => onRoll(combatant.id)}>
          <DiceFive size={18} aria-hidden="true" /> Rolar<span className="sr-only"> iniciativa de {combatant.name}</span>
        </Button>
      )}
      {missing && onAssign && <AssignInitiative combatant={combatant} busy={busy} onAssign={onAssign} />}
      {onMoveTie && tie.up && (
        <Button variant="ghost" disabled={busy} onClick={() => onMoveTie(combatant.id, 'up')}>
          <ArrowUp size={18} aria-hidden="true" /> Antes<span className="sr-only"> no empate: {combatant.name}</span>
        </Button>
      )}
      {onMoveTie && tie.down && (
        <Button variant="ghost" disabled={busy} onClick={() => onMoveTie(combatant.id, 'down')}>
          <ArrowDown size={18} aria-hidden="true" /> Depois<span className="sr-only"> no empate: {combatant.name}</span>
        </Button>
      )}
      {fight}
      <Adjust combatant={combatant} busy={busy} {...actions} />
    </div>
  );
}

/**
 * Hit points, concentration and conditions, folded like "Ajustar". A
 * player's own character opens unfolded: it is the card they act on.
 */
function FightPanel({ combatant, busy, startOpen, onHitPoints, onConcentration, onApplyCondition }: InitiativeActions & {
  combatant: CombatantView;
  busy: boolean;
  startOpen: boolean;
}) {
  const { id, name } = combatant;
  if (!onHitPoints && !onConcentration && !onApplyCondition) return null;
  return (
    <details open={startOpen} className="group/fight min-w-0 open:basis-full">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control px-3 font-semibold text-accent-text transition-[background-color] duration-(--duration-quick) hover:bg-muted [&::-webkit-details-marker]:hidden">
        <Heartbeat size={18} aria-hidden="true" /> PV e condições<span className="sr-only"> de {name}</span>
      </summary>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pt-2">
        {onHitPoints && (
          <HpAdjuster name={name} pending={busy}
            full={combatant.hpCurrent !== null && combatant.hpMax !== null && combatant.hpCurrent >= combatant.hpMax}
            onApply={(operation, amount) => onHitPoints(id, operation, amount)} />
        )}
        {/* At 0 hit points nobody starts concentrating; the server refuses it too. */}
        {onConcentration && (combatant.concentrating || combatant.hpCurrent !== 0) && (
          <div className="min-w-0 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
            <Button variant="ghost" aria-pressed={combatant.concentrating} disabled={busy}
              onClick={() => onConcentration(id, !combatant.concentrating)}>
              <Brain size={18} aria-hidden="true" />
              {combatant.concentrating ? 'Encerrar concentração' : 'Marcar concentração'}
              <span className="sr-only"> de {name}</span>
            </Button>
          </div>
        )}
        {/* The chips are on the card already: here, only the form to apply one. */}
        {onApplyCondition && (
          <ConditionPicker name={name} conditions={combatant.conditions} listed={false} pending={busy}
            onApply={(condition) => onApplyCondition(id, condition)} />
        )}
      </div>
    </details>
  );
}

/**
 * The combatant's attacks, folded like "PV e condições". Someone down does
 * not attack; a manual combatant has none and says so.
 */
function AttackPanel({ combatant, targets, master, busy, onAttack }: InitiativeActions & {
  combatant: CombatantView;
  targets: CombatantView[];
  master: boolean;
  busy: boolean;
}) {
  const { id, name } = combatant;
  if (!onAttack || down(combatant) || combatant.defeated) return null;
  return (
    <details className="group/attacks min-w-0 open:basis-full">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control px-3 font-semibold text-accent-text transition-[background-color] duration-(--duration-quick) hover:bg-muted [&::-webkit-details-marker]:hidden">
        <Sword size={18} aria-hidden="true" /> Ataques<span className="sr-only"> de {name}</span>
      </summary>
      <div className="pt-2">
        <CombatantAttacks name={name} attacks={combatant.attacks} targets={targets} master={master}
          defaultSecret={master && combatant.source !== 'character'} pending={busy}
          onAttack={(attackIndex, options) => onAttack(id, attackIndex, options)} />
      </div>
    </details>
  );
}

/**
 * What the table has to resolve on this combatant: the death saves of a
 * character down, and the reminders a hit left. Everyone sees them; only who
 * acts on the combatant gets the buttons.
 */
function Pending({ combatant, acts, master, canRoll, busy, onDeathSave, onConcentrationSave, onRecordFailure, onDismissReminder, onApplyDamage }: InitiativeActions & {
  combatant: CombatantView;
  acts: boolean;
  master: boolean;
  /** The master, or the player on their own turn; the server checks it again. */
  canRoll: boolean;
  busy: boolean;
}) {
  const { id, name } = combatant;
  const when = <T,>(handler: T | undefined) => (acts ? handler : undefined);
  const rollSave = when(onConcentrationSave);
  const recordFailure = when(onRecordFailure);
  const dismiss = when(onDismissReminder);
  const applyDamage = master ? when(onApplyDamage) : undefined;
  return (
    <>
      {down(combatant) && (
        <DeathSaveTracker name={name} deathSaves={combatant.deathSaves!} pending={busy}
          canRoll={canRoll} onRoll={onDeathSave && ((mode) => onDeathSave(id, mode))} />
      )}
      <ReminderList name={name} reminders={combatant.reminders} pending={busy} master={master}
        onRollSave={rollSave && ((reminderId) => rollSave(id, reminderId))}
        onRecordFailure={recordFailure && ((reminderId, failures) => recordFailure(id, failures, reminderId))}
        onDismiss={dismiss && ((reminderId) => dismiss(id, reminderId))}
        onApplyDamage={applyDamage && ((reminderId, amount) => applyDamage(id, reminderId, amount))} />
    </>
  );
}

function InitiativeRow({ combatant, targets, active, own, master, editable, busy, tie, ...actions }: RowProps) {
  const acts = editable && (master || own);

  return (
    <li aria-current={active ? 'step' : undefined} data-defeated={combatant.defeated || undefined} data-hidden={combatant.hidden || undefined}
      className="group/row grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-panel border border-border bg-card px-4 py-3 edge-raised transition-[border-color,box-shadow] duration-(--duration-quick) ease-settle aria-[current=step]:border-accent-text aria-[current=step]:shadow-[inset_4px_0_0_var(--color-accent-text),inset_0_1px_0_var(--color-edge-light)] data-hidden:border-dashed data-hidden:bg-surface-secret">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <Score combatant={combatant} />
        <div className="grid min-w-0 flex-[1_1_10rem] gap-1">
          <p className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere] group-data-defeated/row:text-text-secondary group-data-defeated/row:line-through">{combatant.name}</p>
          <Tags combatant={combatant} active={active} own={own} />
        </div>
        <Vitals combatant={combatant} />
      </div>

      {/* Always on the card, so the table reads them at a glance; removable for whoever acts. */}
      <ConditionChips name={combatant.name} conditions={combatant.conditions} pending={busy}
        onRemove={acts && actions.onRemoveCondition ? (condition) => actions.onRemoveCondition!(combatant.id, condition) : undefined} />
      <Pending combatant={combatant} acts={acts} master={master} canRoll={acts && (master || (active && !combatant.deathSaveRolled))} busy={busy} {...actions} />

      <RowActions combatant={combatant} targets={targets} own={own} master={master} editable={editable} busy={busy} tie={tie} {...actions} />
    </li>
  );
}

/** What this viewer may do on the combatant: the master's line, or a player's own controls. */
function RowActions({ combatant, targets, own, master, editable, busy, tie, ...actions }: Omit<RowProps, 'active'>) {
  // The master acts on anyone; a player only on their own character.
  const acts = editable && (master || own);
  const fight = acts ? (
    <>
      <FightPanel combatant={combatant} busy={busy} startOpen={own && !master} {...actions} />
      <AttackPanel combatant={combatant} targets={targets} master={master} busy={busy} {...actions} />
    </>
  ) : null;
  if (master && editable) return <MasterActions combatant={combatant} busy={busy} tie={tie} fight={fight} {...actions} />;
  // A player rolls their own initiative, once.
  const playerRolls = acts && !combatant.hasInitiative && !!actions.onRoll;
  return (
    <>
      {fight}
      {playerRolls && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => actions.onRoll!(combatant.id)}>
            <DiceFive size={18} aria-hidden="true" /> Rolar iniciativa
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * The initiative queue as the server sent it: already in order and already
 * projected for the viewer (a player's copy has no monster numbers and no
 * hidden combatant). The list shows and asks; it neither sorts nor decides
 * who may see what. Ties are reordered with Antes/Depois, one step at a time.
 */
export function InitiativeList({ combatants, activeCombatantId, viewerId, master, editable = true, busyIds = [], ...actions }: InitiativeActions & {
  combatants: CombatantView[];
  activeCombatantId: string | null;
  viewerId: string;
  master: boolean;
  /** False once the encounter has ended: read-only for everyone. */
  editable?: boolean;
  /** Combatants with a request in flight: each stays busy until its own requests settle. */
  busyIds?: readonly string[];
}) {
  if (combatants.length === 0) {
    return <p className="text-text-secondary">Nenhum combatente no encontro ainda.</p>;
  }
  const busy = new Set(busyIds);
  return (
    <ol className="m-0 grid min-w-0 list-none gap-2 p-0" aria-label="Ordem de iniciativa">
      {combatants.map((combatant, index) => (
        <InitiativeRow
          key={combatant.id}
          combatant={combatant}
          targets={combatants.filter((other) => other.id !== combatant.id)}
          active={combatant.id === activeCombatantId}
          own={combatant.ownerId === viewerId}
          master={master}
          editable={editable}
          busy={busy.has(combatant.id)}
          tie={master ? tiedWith(combatants, index) : { up: false, down: false }}
          {...actions}
        />
      ))}
    </ol>
  );
}
