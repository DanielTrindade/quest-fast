import type { CombatEndedPayload, Role, SessionEvent } from '@quest-fast/shared';

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
  return event;
}
