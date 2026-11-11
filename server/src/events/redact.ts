import type { CombatEndedPayload, CombatHitPointsPayload, Role, SessionEvent } from '@quest-fast/shared';

const HIT_POINT_EVENTS = new Set(['combat.damage', 'combat.heal', 'combat.defeated']);

/**
 * Events are stored whole; what a player may read is decided here, on the
 * feed read and on the live send alike. `null` means the event does not
 * reach this reader at all.
 */
export function redactEvent(event: SessionEvent, role: Role): SessionEvent | null {
  if (role === 'master') return event;
  if (event.secret) return null;
  if (event.type === 'combat.ended') {
    const payload = event.payload as CombatEndedPayload;
    return {
      ...event,
      payload: { ...payload, defeated: payload.defeated.filter((defeated) => !defeated.hidden) },
    } as SessionEvent;
  }
  if (HIT_POINT_EVENTS.has(event.type)) {
    // A monster's numbers are the master's; the band is all a player reads.
    const payload = event.payload as CombatHitPointsPayload;
    if (payload.source === 'character') return event;
    const { amount: _amount, hpCurrent: _hpCurrent, hpMax: _hpMax, ...band } = payload;
    return { ...event, payload: band } as SessionEvent;
  }
  return event;
}
