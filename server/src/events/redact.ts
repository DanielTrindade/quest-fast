import type { CombatEndedPayload, CombatHitPointsPayload, Role, RollPayload, SessionEvent } from '@quest-fast/shared';

const HIT_POINT_EVENTS = new Set(['combat.damage', 'combat.heal', 'combat.defeated']);

/**
 * An attack as a player reads it. A monster's AC never leaves the server, and
 * neither does anything of a monster's attack roll: with its total and a
 * natural 20 (which `critical` also tells), the bonus is one subtraction away.
 * A player keeps what the master says at the table: hit or miss, critical,
 * and the damage total.
 */
function redactAttack(payload: RollPayload): RollPayload {
  let visible = payload;
  if (payload.target && payload.target.source !== 'character' && payload.target.ac !== undefined) {
    const { ac: _ac, ...target } = payload.target;
    visible = { ...visible, target };
  }
  if (payload.attackerSource === 'monster') {
    const { damageRollable: _rollable, natural: _natural, ...rest } = visible;
    visible = {
      ...rest,
      expression: '',
      dice: [],
      modifier: 0,
      total: 0,
      ...(rest.damage ? { damage: { ...rest.damage, expression: '', dice: [], modifier: 0 } } : {}),
      redacted: true,
    };
  }
  return visible;
}

/**
 * Events are stored whole; what a player may read is decided here, on the
 * feed read and on the live send alike. `null` means the event does not
 * reach this reader at all.
 */
export function redactEvent(event: SessionEvent, role: Role): SessionEvent | null {
  if (role === 'master') return event;
  if (event.secret) return null;
  if (event.type === 'roll') {
    const payload = event.payload as RollPayload;
    return payload.rollKind === 'attack' ? ({ ...event, payload: redactAttack(payload) } as SessionEvent) : event;
  }
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
