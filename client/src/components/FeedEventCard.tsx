import { DiceFive, EyeSlash, FirstAidKit, FlagCheckered, Heartbeat, HeartBreak, Hourglass, Info, Lightning, Skull, Sword } from '@phosphor-icons/react';
import { COMBAT_EVENT_TYPES, type CombatSessionEvent, type RollPayload, type RollSessionEvent, type SessionEvent, type UnknownSessionEvent } from '@quest-fast/shared';
import { ABILITY_LABELS, SKILL_LABELS } from '../lib/5e';
import { attackHeadline, attackOutcome, canRollDamage, damageText, showsAttackRoll } from '../lib/attack-feed';
import { combatEventText, type FightPayload } from '../lib/combat-feed';
import { formatEventTime } from '../lib/format';
import { Button } from './Button';
import { DiceResult } from './DiceResult';
import { Badge } from './ui/badge';

function rollSummary(payload: RollPayload): string {
  const kept = payload.dice.filter((die) => !die.discarded);
  let text = kept.map((die) => `${die.value}`).join(' + ');
  if (payload.modifier !== 0) {
    text += ` ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
  }
  return text;
}

function rollAction(payload: RollPayload): string {
  if (payload.rollKind === 'skill') {
    return `teste de ${payload.skill ? SKILL_LABELS[payload.skill] : ''}`;
  }
  if (payload.rollKind === 'initiative') return 'rolou iniciativa';
  if (payload.rollKind === 'spellAttack') return 'fez um ataque mágico';
  if (payload.rollKind === 'check') return `teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  if (payload.rollKind === 'save' && payload.concentrationDc !== undefined) {
    return `salvaguarda para manter a concentração (CD ${payload.concentrationDc})`;
  }
  if (payload.rollKind === 'save') return `teste de resistência de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
  return `rolou ${payload.expression}`;
}

const combat = 'm-0 flex items-start gap-2 text-foreground [overflow-wrap:anywhere] [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:text-accent-text';

/** Who wrote the event, when, and whether the table may see it. */
function FeedMeta({ event }: { event: SessionEvent }) {
  return (
    <p className="flex [&+[data-slot=dice]]:mt-2 flex-wrap items-center gap-2 text-small text-text-muted">
      <span>{event.userName}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={event.createdAt}>{formatEventTime(event.createdAt)}</time>
      {event.secret && (
        <span data-slot="secret-tag" className="inline-flex items-center gap-1 rounded-control border border-dashed border-input px-2 py-px text-text-secondary">
          <EyeSlash size={14} weight="regular" aria-hidden="true" /> Secreta
        </span>
      )}
    </p>
  );
}

/**
 * An attack: the d20 when this reader may see it, then what came of it — hit
 * or miss, the DC of a save, the damage. Without a target, whoever attacked
 * may roll the damage once it is known to have hit.
 */
function AttackEventCard({ event, onRollDamage, pending }: { event: RollSessionEvent } & DamageActions) {
  const payload = event.payload;
  const headline = attackHeadline(payload);
  const outcome = attackOutcome(payload);
  const damage = damageText(payload);
  return (
    <>
      <FeedMeta event={event} />
      {showsAttackRoll(payload) ? (
        <DiceResult compact label={headline} total={payload.total} decomposition={rollSummary(payload)}
          dice={payload.dice} mode={payload.mode} natural={payload.natural} />
      ) : (
        <p className={combat}><Sword size={16} aria-hidden="true" /><span>{headline}</span></p>
      )}
      {(outcome || payload.critical || damage) && (
        <p data-slot="attack-outcome" data-hit={payload.target?.hit}
          className="m-0 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-foreground [overflow-wrap:anywhere]">
          {outcome && <span className="font-semibold">{outcome}</span>}
          {payload.critical && <Badge variant="accent">Crítico</Badge>}
          {damage && <span>Dano: <strong className="font-semibold tabular-nums">{damage}</strong></span>}
        </p>
      )}
      {onRollDamage && canRollDamage(payload) && (
        <div className="mt-2 [&>[data-slot=button]]:max-w-full [&>[data-slot=button]]:whitespace-normal">
          <Button variant="secondary" disabled={pending} onClick={() => onRollDamage(event.id)}>
            <DiceFive size={18} aria-hidden="true" /> Rolar dano<span className="sr-only"> de {payload.attackName}</span>
          </Button>
        </div>
      )}
    </>
  );
}

function RollEventCard({ event, ...actions }: { event: RollSessionEvent } & DamageActions) {
  const payload = event.payload;
  if (payload.rollKind === 'attack') return <AttackEventCard event={event} {...actions} />;
  const headline =
    payload.rollKind && payload.characterName
      ? `${payload.characterName} ${rollAction(payload)}`
      : `${event.userName} ${rollAction(payload)}`;
  return (
    <>
      <FeedMeta event={event} />
      <DiceResult compact label={headline} total={payload.total} decomposition={rollSummary(payload)}
        dice={payload.dice} mode={payload.mode} natural={payload.natural} />
    </>
  );
}

function FightIcon({ payload }: { payload: FightPayload }) {
  if (payload.kind === 'combat.condition') {
    return payload.action === 'expired' ? <Hourglass size={16} aria-hidden="true" /> : <Lightning size={16} aria-hidden="true" />;
  }
  if (payload.kind === 'combat.deathSave') return <Heartbeat size={16} aria-hidden="true" />;
  if (payload.kind === 'combat.heal') return <FirstAidKit size={16} aria-hidden="true" />;
  if (payload.kind === 'combat.defeated') return <Skull size={16} aria-hidden="true" />;
  return <HeartBreak size={16} aria-hidden="true" />;
}

/** What happened to one combatant: hit points, a condition, a death save. */
function FightEventCard({ event, payload }: { event: CombatSessionEvent; payload: FightPayload }) {
  return (
    <>
      <FeedMeta event={event} />
      <p className={combat}>
        <FightIcon payload={payload} />
        <span>{combatEventText(payload)}</span>
      </p>
    </>
  );
}

/** What happens in a combat; turn changes never reach the feed. */
function CombatEventCard({ event }: { event: CombatSessionEvent }) {
  if (event.type !== 'combat.started' && event.type !== 'combat.ended') {
    return <FightEventCard event={event} payload={event.payload} />;
  }
  if (event.type === 'combat.started') {
    return (
      <>
        <FeedMeta event={event} />
        <p className={combat}>
          <Sword size={16} aria-hidden="true" />
          <span>Combate iniciado: <strong>{event.payload.encounterName}</strong></span>
        </p>
      </>
    );
  }
  const { encounterName, rounds, defeated } = event.payload;
  return (
    <>
      <FeedMeta event={event} />
      <p className={combat}>
        <FlagCheckered size={16} aria-hidden="true" />
        <span>
          Combate encerrado: <strong>{encounterName}</strong>, {rounds} {rounds === 1 ? 'round' : 'rounds'}.
          {' '}
          {defeated.length > 0 ? `Derrotados: ${defeated.map((entry) => entry.name).join(', ')}.` : 'Nenhum derrotado.'}
        </span>
      </p>
    </>
  );
}

/**
 * Any event type the client does not render yet. The feed must not break or
 * go silent when Phase 2 adds `token.moved`/`fog.updated`: a generic row
 * keeps author, time and the type visible until a card exists.
 */
function UnknownEventCard({ event }: { event: UnknownSessionEvent }) {
  return (
    <>
      <FeedMeta event={event} />
      <p className="m-0 flex items-center gap-2 text-small text-text-secondary">
        <Info size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
        <span>Novo tipo de evento: {event.type}</span>
      </p>
    </>
  );
}

/** Discriminates the union in a way a plain `type === 'roll'` check cannot:
 * the unknown branch's `type: string` would also accept `'roll'`. */
function isRollSessionEvent(event: SessionEvent): event is RollSessionEvent {
  return event.type === 'roll';
}

function isCombatSessionEvent(event: SessionEvent): event is CombatSessionEvent {
  return (COMBAT_EVENT_TYPES as readonly string[]).includes(event.type);
}

type DamageActions = {
  /** Only on the reader's own attacks: rolls the damage of one made without a target. */
  onRollDamage?: (eventId: string) => void;
  pending?: boolean;
};

/** Renders a feed event by its type, keeping the secret framing in one place. */
export function FeedEventCard({ event, ...actions }: { event: SessionEvent } & DamageActions) {
  const content = isRollSessionEvent(event)
    ? <RollEventCard event={event} {...actions} />
    : isCombatSessionEvent(event)
      ? <CombatEventCard event={event} />
      : <UnknownEventCard event={event as UnknownSessionEvent} />;
  return event.secret ? <div className="-mx-3 rounded-control border border-dashed border-input bg-surface-secret px-3 py-2">{content}</div> : <>{content}</>;
}