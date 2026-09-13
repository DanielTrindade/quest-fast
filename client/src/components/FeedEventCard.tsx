import { EyeSlash, Info } from '@phosphor-icons/react';
import type { RollPayload, RollSessionEvent, SessionEvent, UnknownSessionEvent } from '@quest-fast/shared';
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

function RollEventCard({ event }: { event: RollSessionEvent }) {
  const payload = event.payload;
  const headline =
    payload.rollKind && payload.characterName
      ? `${payload.characterName} ${rollAction(payload)}`
      : `${event.userName} ${rollAction(payload)}`;
  return (
    <>
      <p className="feed-meta">
        <span>{event.userName}</span>
        <span aria-hidden="true">·</span>
        <time>{formatTime(event.createdAt)}</time>
        {event.secret && (
          <span className="feed-secret-tag">
            <EyeSlash size={14} weight="regular" aria-hidden="true" /> Secreta
          </span>
        )}
      </p>
      <DiceResult compact label={headline} total={payload.total} decomposition={rollSummary(payload)}
        dice={payload.dice} mode={payload.mode} natural={payload.natural} />
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
      <p className="feed-meta">
        <span>{event.userName}</span>
        <span aria-hidden="true">·</span>
        <time>{formatTime(event.createdAt)}</time>
        {event.secret && (
          <span className="feed-secret-tag">
            <EyeSlash size={14} weight="regular" aria-hidden="true" /> Secreta
          </span>
        )}
      </p>
      <p className="qf-feed__unknown-body">
        <Info size={14} aria-hidden="true" />
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

/** Renders a feed event by its type, keeping the secret framing in one place. */
export function FeedEventCard({ event }: { event: SessionEvent }) {
  const content = isRollSessionEvent(event)
    ? <RollEventCard event={event} />
    : <UnknownEventCard event={event} />;
  return event.secret ? <div className="qf-feed__secret">{content}</div> : <>{content}</>;
}