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

function Score({ combatant }: { combatant: CombatantView }) {
  if (combatant.initiative !== null) {
    return <span className="qf-initiative__score"><span className="sr-only">Iniciativa </span>{combatant.initiative}</span>;
  }
  // A player knows a monster rolled, not what it rolled.
  const [symbol, text] = combatant.hasInitiative ? ['•', 'Iniciativa definida'] : ['–', 'Sem iniciativa'];
  return (
    <span className="qf-initiative__score">
      <span aria-hidden="true">{symbol}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Tags({ combatant, active, own }: { combatant: CombatantView; active: boolean; own: boolean }) {
  return (
    <p className="qf-initiative__tags">
      {active && <span className="qf-initiative__tag qf-initiative__tag--turn">Vez atual</span>}
      {own && <span className="qf-initiative__tag">Seu personagem</span>}
      {combatant.hidden && (
        <span className="qf-initiative__tag">
          <EyeSlash size={14} aria-hidden="true" /> Escondido
        </span>
      )}
      {/* Without numbers the health band already says it. */}
      {combatant.defeated && combatant.hpCurrent !== null && (
        <span className="qf-initiative__tag">
          <Skull size={14} aria-hidden="true" /> Derrotado
        </span>
      )}
      {!combatant.hasInitiative && <span className="qf-initiative__tag">Aguardando iniciativa</span>}
    </p>
  );
}

function Vitals({ combatant }: { combatant: CombatantView }) {
  if (combatant.hpCurrent === null || combatant.hpMax === null) {
    return <p className="qf-initiative__band" data-band={combatant.healthBand}>{HEALTH_BAND_LABELS[combatant.healthBand]}</p>;
  }
  return (
    <dl className="qf-initiative__stats">
      <div>
        <dt>CA</dt>
        <dd>{combatant.ac}</dd>
      </div>
      <div>
        <dt>PV</dt>
        <dd>
          {combatant.hpCurrent}
          <span className="qf-initiative__max">/{combatant.hpMax}</span>
          {!!combatant.hpTemp && <span className="qf-initiative__temp"> +{combatant.hpTemp}<span className="sr-only"> temporários</span></span>}
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
    <form className="qf-initiative__assign" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>Iniciativa de {combatant.name}</label>
      <Input id={id} type="number" inputMode="numeric" min={min} max={max}
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
    <span className="qf-initiative__confirm" role="group" aria-label={`Remover ${combatant.name}?`}>
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
    <details className="qf-initiative__more">
      <summary>
        <DotsThree size={18} aria-hidden="true" /> Ajustar<span className="sr-only"> {combatant.name}</span>
      </summary>
      <div className="qf-initiative__more-body">
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
    <div className="qf-initiative__actions">
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
  const classes = ['qf-initiative__item'];
  if (active) classes.push('is-active');
  if (combatant.defeated) classes.push('is-defeated');
  if (combatant.hidden) classes.push('is-hidden');
  // A player rolls their own initiative, once.
  const playerRolls = !master && editable && own && !combatant.hasInitiative && !!actions.onRoll;

  return (
    <li className={classes.join(' ')} aria-current={active ? 'step' : undefined}>
      <div className="qf-initiative__main">
        <Score combatant={combatant} />
        <div className="qf-initiative__identity">
          <p className="qf-initiative__name">{combatant.name}</p>
          <Tags combatant={combatant} active={active} own={own} />
        </div>
        <Vitals combatant={combatant} />
      </div>

      {combatant.conditions.length > 0 && (
        <ul className="qf-initiative__conditions" aria-label={`Condições de ${combatant.name}`}>
          {combatant.conditions.map((condition) => <li key={condition.condition}>{conditionLabel(condition)}</li>)}
        </ul>
      )}

      {master && editable && <MasterActions combatant={combatant} busy={busy} tie={tie} {...actions} />}
      {playerRolls && (
        <div className="qf-initiative__actions">
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
    return <p className="qf-initiative__empty">Nenhum combatente no encontro ainda.</p>;
  }
  return (
    <ol className="qf-initiative" aria-label="Ordem de iniciativa">
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
