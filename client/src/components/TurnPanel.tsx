import { useId, useState, type FormEvent } from 'react';
import { ArrowCounterClockwise, Footprints, HandFist, Lightning, Plus, ShieldChevron, SlidersHorizontal, Sword } from '@phosphor-icons/react';
import { TURN_LIMITS, formatMeters, hasAction, isAttacksPerAction, isSpeed, squaresFor, type TurnView } from '@quest-fast/shared';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Field } from './Field';

/** What may be spent outside an attack, as the server's `/economy` names it. */
export type TurnEconomy = 'action' | 'bonusAction' | 'reaction' | 'dash';

export type TurnPanelProps = {
  name: string;
  turn: TurnView;
  /** It is this combatant's turn: everything but the reaction waits for it. */
  ownTurn: boolean;
  /** The master, or the owner of the character. */
  canAct: boolean;
  /** The master gives back and grants. */
  master: boolean;
  /** The request on its way, if any. */
  pending?: string | null;
  onSpend?: (spend: TurnEconomy) => void;
  onRefund?: (spend: TurnEconomy) => void;
  onGrant?: () => void;
  /**
   * The master adjusts a creature's speed and attacks per action (a
   * character's come from the sheet). `speed` is the base, before conditions.
   */
  adjust?: { speed: number; attacksPerAction: number; onSave: (values: { speed: number; attacksPerAction: number }) => void };
};

/** The creature's numbers the map and the turn read, corrected by the master. */
function Adjust({ name, adjust, busy }: { name: string; adjust: NonNullable<TurnPanelProps['adjust']>; busy: boolean }) {
  const [speed, setSpeed] = useState(String(adjust.speed));
  const [attacks, setAttacks] = useState(String(adjust.attacksPerAction));
  const [errors, setErrors] = useState<{ speed?: string; attacks?: string }>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = { speed: Number(speed.replace(',', '.')), attacksPerAction: Number(attacks) };
    const next = {
      speed: speed.trim() !== '' && isSpeed(values.speed) ? undefined : `Entre ${TURN_LIMITS.speed.min} e ${TURN_LIMITS.speed.max} metros.`,
      attacks: isAttacksPerAction(values.attacksPerAction)
        ? undefined
        : `Entre ${TURN_LIMITS.attacksPerAction.min} e ${TURN_LIMITS.attacksPerAction.max}.`,
    };
    setErrors(next);
    if (!next.speed && !next.attacks) adjust.onSave(values);
  };
  return (
    <details className="group/adjust min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control px-3 font-semibold text-accent-text transition-[background-color] duration-(--duration-quick) hover:bg-muted [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal size={18} aria-hidden="true" /> Ajustar deslocamento e ataques<span className="sr-only"> de {name}</span>
      </summary>
      <form noValidate onSubmit={submit} className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] items-start gap-3 pt-2">
        <Field label="Deslocamento (m)" type="number" inputMode="decimal" min={TURN_LIMITS.speed.min} max={TURN_LIMITS.speed.max} step={1.5}
          value={speed} error={errors.speed} onChange={(event) => setSpeed(event.target.value)} />
        <Field label="Ataques por ação" type="number" min={TURN_LIMITS.attacksPerAction.min} max={TURN_LIMITS.attacksPerAction.max}
          value={attacks} error={errors.attacks} onChange={(event) => setAttacks(event.target.value)} />
        <div className="col-span-full">
          <Button type="submit" variant="secondary" disabled={busy}>Salvar<span className="sr-only"> deslocamento e ataques de {name}</span></Button>
        </div>
      </form>
    </details>
  );
}

type Slot = {
  key: Exclude<TurnEconomy, 'dash'>;
  label: string;
  /** Nothing of it is left to spend. */
  used: boolean;
  /** Something of it was spent and may be given back (the base action, even with a granted one left). */
  spent: boolean;
  icon: typeof Sword;
};

function SlotRow({ slot, usable, master, busy, name, onSpend, onRefund }: {
  slot: Slot;
  usable: boolean;
  master: boolean;
  busy: boolean;
  name: string;
} & Pick<TurnPanelProps, 'onSpend' | 'onRefund'>) {
  const Icon = slot.icon;
  return (
    <li data-used={slot.used}
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-control border border-border bg-card px-3 py-2 data-[used=true]:border-dashed data-[used=true]:bg-surface-secret">
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={18} aria-hidden="true" className={cn(slot.used ? 'text-text-secondary' : 'text-accent-text')} />
        <span className="font-semibold">{slot.label}</span>
        <span className="text-small text-text-secondary">{slot.used ? 'usada' : 'disponível'}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        {!slot.used && onSpend && (
          <Button variant="secondary" disabled={!usable || busy} onClick={() => onSpend(slot.key)}>
            Usar<span className="sr-only"> {slot.label.toLowerCase()} de {name}</span>
          </Button>
        )}
        {slot.spent && master && onRefund && (
          <Button variant="ghost" disabled={busy} onClick={() => onRefund(slot.key)}>
            <ArrowCounterClockwise size={16} aria-hidden="true" /> Devolver<span className="sr-only"> {slot.label.toLowerCase()} de {name}</span>
          </Button>
        )}
      </span>
    </li>
  );
}

function Movement({ turn }: { turn: TurnView }) {
  const total = turn.speed * (1 + turn.dashes);
  const share = total === 0 ? 0 : Math.min(1, turn.movementLeft / total);
  const squares = squaresFor(turn.movementLeft);
  return (
    <div className="grid min-w-0 gap-1">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <Footprints size={18} aria-hidden="true" className="self-center text-accent-text" />
        <span className="font-semibold">Deslocamento</span>
        <span className="tabular-nums">
          restam {formatMeters(turn.movementLeft)} de {formatMeters(total)}
        </span>
        <span className="text-small text-text-secondary tabular-nums">
          ({squares === 1 ? '1 casa' : `${squares} casas`})
        </span>
      </p>
      {/* The line above says it in words; the bar only shows it at a glance. */}
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-secret">
        <div className="h-full rounded-full bg-accent transition-[width] duration-(--duration-settle) ease-settle motion-reduce:transition-none"
          style={{ width: `${share * 100}%` }} />
      </div>
      {turn.speed === 0 && <p className="m-0 text-small text-danger-text">Uma condição prende o deslocamento em 0.</p>}
    </div>
  );
}

/** What an Attack action still owes, and the actions the master granted. */
function Extras({ turn }: { turn: TurnView }) {
  if (turn.attacksLeft === 0 && turn.extraActions === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-small">
      {turn.attacksLeft > 0 && (
        <li className="flex items-center gap-1">
          <HandFist size={16} aria-hidden="true" className="text-accent-text" />
          {turn.attacksLeft === 1 ? 'Falta 1 ataque' : `Faltam ${turn.attacksLeft} ataques`} da ação Atacar
        </li>
      )}
      {turn.extraActions > 0 && (
        <li className="flex items-center gap-1">
          <Plus size={16} aria-hidden="true" className="text-accent-text" />
          {turn.extraActions === 1 ? '1 ação extra' : `${turn.extraActions} ações extras`}
        </li>
      )}
    </ul>
  );
}

/** Dash for whoever acts; undoing it and granting an action for the master. */
function TurnActions({ name, turn, ownTurn, master, pending, busy, spend, onRefund, onGrant }: {
  name: string;
  turn: TurnView;
  ownTurn: boolean;
  master: boolean;
  pending: string | null;
  busy: boolean;
  spend: TurnPanelProps['onSpend'];
} & Pick<TurnPanelProps, 'onRefund' | 'onGrant'>) {
  const refund = master ? onRefund : undefined;
  const grant = master ? onGrant : undefined;
  if (!spend && !grant && !(refund && turn.dashes > 0)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {spend && (
        <Button variant="secondary" disabled={!hasAction(turn) || (!ownTurn && !master) || busy} loading={pending === 'dash'}
          onClick={() => spend('dash')}>
          <Footprints size={18} aria-hidden="true" /> Disparada<span className="sr-only"> de {name}</span>
        </Button>
      )}
      {refund && turn.dashes > 0 && (
        <Button variant="ghost" disabled={busy} onClick={() => refund('dash')}>
          <ArrowCounterClockwise size={16} aria-hidden="true" /> Desfazer Disparada
        </Button>
      )}
      {grant && (
        <Button variant="ghost" disabled={busy} loading={pending === 'grant'} onClick={grant}>
          <Plus size={16} aria-hidden="true" /> Conceder ação<span className="sr-only"> a {name}</span>
        </Button>
      )}
    </div>
  );
}

/**
 * What is left of a combatant's turn: the action, the bonus action and the
 * reaction, the attacks an Attack action still owes and the movement. Whoever
 * may act spends them (on its own turn; the reaction at any time); the master
 * also gives back what was spent and grants an extra action (Action Surge).
 * Presentational: the server counts and refuses, the screen sends.
 */
export function TurnPanel({ name, turn, ownTurn, canAct, master, pending = null, onSpend, onRefund, onGrant, adjust }: TurnPanelProps) {
  const headingId = useId();
  const busy = pending !== null;
  const slots: Slot[] = [
    { key: 'action', label: 'Ação', used: !hasAction(turn), spent: turn.actionUsed, icon: Sword },
    { key: 'bonusAction', label: 'Ação bônus', used: turn.bonusActionUsed, spent: turn.bonusActionUsed, icon: Lightning },
    { key: 'reaction', label: 'Reação', used: turn.reactionUsed, spent: turn.reactionUsed, icon: ShieldChevron },
  ];
  const spend = canAct ? onSpend : undefined;

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-3">
      <h3 id={headingId} className="m-0 font-display text-h2 font-semibold [overflow-wrap:anywhere]">
        {ownTurn ? `Turno de ${name}` : `${name}, fora do turno`}
      </h3>
      <ul className="m-0 grid list-none gap-2 p-0">
        {slots.map((slot) => (
          <SlotRow key={slot.key} slot={slot} name={name} master={master} busy={busy}
            usable={slot.key === 'reaction' || ownTurn || master}
            onSpend={spend} onRefund={onRefund} />
        ))}
      </ul>
      <Extras turn={turn} />
      <Movement turn={turn} />
      <TurnActions name={name} turn={turn} ownTurn={ownTurn} master={master} pending={pending} busy={busy}
        spend={spend} onRefund={onRefund} onGrant={onGrant} />
      <p className="m-0 text-small text-text-secondary">
        {turn.attacksPerAction === 1 ? '1 ataque por ação Atacar.' : `${turn.attacksPerAction} ataques por ação Atacar.`}
        {turn.dashes > 0 && ` Disparada ${turn.dashes === 1 ? 'usada' : `usada ${turn.dashes} vezes`}.`}
      </p>
      {master && adjust && <Adjust key={`${adjust.speed}:${adjust.attacksPerAction}`} name={name} adjust={adjust} busy={busy} />}
    </section>
  );
}
