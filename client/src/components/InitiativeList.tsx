import { useId, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, DiceFive, DotsThree, Eye, EyeSlash, Skull, Trash } from '@phosphor-icons/react';
import { ENCOUNTER_LIMITS, type CombatantView } from '@quest-fast/shared';
import { Button } from './Button';
import { Input } from './Input';
import { HEALTH_BAND_LABELS, conditionLabel, tiedWith } from '../lib/combat-labels';

export type InitiativeActions = {
  /** Rolls on the server; the list only asks. */
  onRoll?: (combatantId: string) => void;
  onAssign?: (combatantId: string, value: number) => void;
  onToggleHidden?: (combatantId: string, hidden: boolean) => void;
  onRemove?: (combatantId: string) => void;
  onMoveTie?: (combatantId: string, direction: 'up' | 'down') => void;
};

type RowProps = InitiativeActions & {
  combatant: CombatantView;
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
      {!combatant.hasInitiative && <span>Aguardando iniciativa</span>}
    </p>
  );
}

function Vitals({ combatant }: { combatant: CombatantView }) {
  if (combatant.hpCurrent === null || combatant.hpMax === null) {
    return <p data-band={combatant.healthBand} className="m-0 text-small font-semibold text-text-secondary data-[band=bloodied]:text-danger-text data-[band=defeated]:text-danger-text">{HEALTH_BAND_LABELS[combatant.healthBand]}</p>;
  }
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

/** The master's controls: setting initiative while it is missing, ties, then "Ajustar". */
function MasterActions({ combatant, busy, tie, onMoveTie, ...actions }: InitiativeActions & {
  combatant: CombatantView;
  busy: boolean;
  tie: { up: boolean; down: boolean };
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
      <Adjust combatant={combatant} busy={busy} {...actions} />
    </div>
  );
}

function InitiativeRow({ combatant, active, own, master, editable, busy, tie, ...actions }: RowProps) {
  // A player rolls their own initiative, once.
  const playerRolls = !master && editable && own && !combatant.hasInitiative && !!actions.onRoll;

  return (
    <li aria-current={active ? 'step' : undefined} data-defeated={combatant.defeated || undefined} data-hidden={combatant.hidden || undefined}
      className="group/row grid min-w-0 gap-3 rounded-panel border border-border bg-card px-4 py-3 edge-raised transition-[border-color,box-shadow] duration-(--duration-quick) ease-settle aria-[current=step]:border-accent-text aria-[current=step]:shadow-[inset_4px_0_0_var(--color-accent-text),inset_0_1px_0_var(--color-edge-light)] data-hidden:border-dashed data-hidden:bg-surface-secret">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <Score combatant={combatant} />
        <div className="grid min-w-0 flex-[1_1_10rem] gap-1">
          <p className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere] group-data-defeated/row:text-text-secondary group-data-defeated/row:line-through">{combatant.name}</p>
          <Tags combatant={combatant} active={active} own={own} />
        </div>
        <Vitals combatant={combatant} />
      </div>

      {combatant.conditions.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={`Condições de ${combatant.name}`}>
          {combatant.conditions.map((condition) => <li key={condition.condition} className="rounded-control border border-input bg-background px-2 py-0.5 text-small text-foreground">{conditionLabel(condition)}</li>)}
        </ul>
      )}

      {master && editable && <MasterActions combatant={combatant} busy={busy} tie={tie} {...actions} />}
      {playerRolls && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => actions.onRoll!(combatant.id)}>
            <DiceFive size={18} aria-hidden="true" /> Rolar iniciativa
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * The initiative queue as the server sent it: already in order and already
 * projected for the viewer (a player's copy has no monster numbers and no
 * hidden combatant). The list shows and asks; it neither sorts nor decides
 * who may see what. Ties are reordered with Antes/Depois, one step at a time.
 */
export function InitiativeList({ combatants, activeCombatantId, viewerId, master, editable = true, busyId = null, ...actions }: InitiativeActions & {
  combatants: CombatantView[];
  activeCombatantId: string | null;
  viewerId: string;
  master: boolean;
  /** False once the encounter has ended: read-only for everyone. */
  editable?: boolean;
  /** The combatant with a request in flight. */
  busyId?: string | null;
}) {
  if (combatants.length === 0) {
    return <p className="text-text-secondary">Nenhum combatente no encontro ainda.</p>;
  }
  return (
    <ol className="m-0 grid min-w-0 list-none gap-2 p-0" aria-label="Ordem de iniciativa">
      {combatants.map((combatant, index) => (
        <InitiativeRow
          key={combatant.id}
          combatant={combatant}
          active={combatant.id === activeCombatantId}
          own={combatant.ownerId === viewerId}
          master={master}
          editable={editable}
          busy={busyId === combatant.id}
          tie={master ? tiedWith(combatants, index) : { up: false, down: false }}
          {...actions}
        />
      ))}
    </ol>
  );
}
