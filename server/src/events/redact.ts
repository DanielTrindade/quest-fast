import type { AttackTarget, CombatEndedPayload, CombatHitPointsPayload, Role, RollPayload, SessionEvent } from '@quest-fast/shared';

const HIT_POINT_EVENTS = new Set(['combat.damage', 'combat.heal', 'combat.defeated']);

/**
 * An attack as a player reads it. A monster's AC never leaves the server, and
 * neither does anything of a monster's attack roll: with its total and a
 * natural 20 (which `critical` also tells), the bonus is one subtraction away.
 * A player keeps what the master says at the table: hit or miss, critical,
 * the damage total and whether a monster passed its save.
 */
function redactTarget(target: AttackTarget): AttackTarget {
  if (target.source === 'character') return target;
  // A monster's save keeps only passed or failed: with the DC, its die and
  // total give the bonus away.
  const { ac: _ac, save, ...rest } = target;
  return { ...rest, ...(save ? { save: { success: save.success } } : {}) };
}

function redactAttack(payload: RollPayload): RollPayload | null {
  let visible = payload;
  if (payload.target) visible = { ...visible, target: redactTarget(payload.target) };
  if (payload.targets) {
    // A target hidden when the area hit it stays out; with none left, the
    // event itself would tell of them.
    const shown = payload.targets.filter((target) => !target.hidden).map(redactTarget);
    if (shown.length === 0) return null;
    visible = { ...visible, targets: shown };
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
    if (payload.rollKind !== 'attack') return event;
    const visible = redactAttack(payload);
    return visible ? ({ ...event, payload: visible } as SessionEvent) : null;
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
