import { EyeSlash, FlagCheckered, Info, Sword } from '@phosphor-icons/react';
import type { CombatSessionEvent, RollPayload, RollSessionEvent, SessionEvent, UnknownSessionEvent } from '@quest-fast/shared';
import { ABILITY_LABELS, SKILL_LABELS } from '../lib/5e';
import { formatTime } from '../lib/format';
import { DiceResult } from './DiceResult';

function rollSummary(payload: RollPayload): string {
  const kept = payload.dice.filter((die) => !die.discarded);
  let text = kept.map((die) => `${die.value}`).join(' + ');
  if (payload.modifier !== 0) {
    text += ` ${payload.modifier > 0 ? '+' : '−'} ${Math.abs(payload.modifier)}`;
  }
  return text;
}

function rollAction(payload: RollPayload): string {
  if (payload.rollKind === 'attack') return `atacou com ${payload.attackName}`;
  if (payload.rollKind === 'skill') {
    return `teste de ${payload.skill ? SKILL_LABELS[payload.skill] : ''}`;
  }
  if (payload.rollKind === 'initiative') return 'rolou iniciativa';
  if (payload.rollKind === 'spellAttack') return 'fez um ataque mágico';
  if (payload.rollKind === 'check') return `teste de ${payload.ability ? ABILITY_LABELS[payload.ability] : ''}`;
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
      <time>{formatTime(event.createdAt)}</time>
      {event.secret && (
        <span className="inline-flex items-center gap-1 rounded-control border border-dashed border-input px-2 py-px text-text-secondary">
          <EyeSlash size={14} weight="regular" aria-hidden="true" /> Secreta
        </span>
      )}
    </p>
  );
}

function RollEventCard({ event }: { event: RollSessionEvent }) {
  const payload = event.payload;
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

/** The start and the summary of a combat; turn changes never reach the feed. */
function CombatEventCard({ event }: { event: CombatSessionEvent }) {
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
  return event.type === 'combat.started' || event.type === 'combat.ended';
}

/** Renders a feed event by its type, keeping the secret framing in one place. */
export function FeedEventCard({ event }: { event: SessionEvent }) {
  const content = isRollSessionEvent(event)
    ? <RollEventCard event={event} />
    : isCombatSessionEvent(event)
      ? <CombatEventCard event={event} />
      : <UnknownEventCard event={event as UnknownSessionEvent} />;
  return event.secret ? <div className="-mx-3 rounded-control border border-dashed border-input bg-surface-secret px-3 py-2">{content}</div> : <>{content}</>;
}