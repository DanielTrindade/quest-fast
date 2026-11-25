import type { CombatantView, CombatEffectView } from '@quest-fast/shared';

/** A character at 0 hit points: still in the queue, making death saves. */
export function isDown(combatant: CombatantView): boolean {
  return combatant.deathSaves !== null && combatant.hpCurrent === 0;
}

/** The master, or the player on their own turn, once; the server checks it again. */
export function canRollDeathSave(combatant: CombatantView, { acts, master, active }: { acts: boolean; master: boolean; active: boolean }): boolean {
  return acts && (master || (active && !combatant.deathSaveRolled));
}

/** At 0 hit points nobody starts concentrating; the server refuses it too. */
export function canToggleConcentration(combatant: CombatantView): boolean {
  return combatant.concentrating || combatant.hpCurrent !== 0;
}

/**
 * The server's rule for taking an effect off, on what this viewer sees: the
 * master, the bearer's owner, or the owner of the character it comes from.
 */
export function canRemoveEffect(
  effect: CombatEffectView,
  bearer: Pick<CombatantView, 'ownerId'>,
  viewer: { master: boolean; userId: string; combatants: readonly Pick<CombatantView, 'id' | 'ownerId'>[] },
): boolean {
  if (viewer.master || bearer.ownerId === viewer.userId) return true;
  if (!('sourceCombatantId' in effect) || !effect.sourceCombatantId) return false;
  return viewer.combatants.some((combatant) => combatant.id === effect.sourceCombatantId && combatant.ownerId === viewer.userId);
}

/**
 * Who a combatant's effect may go on, itself first: the master's, anyone in
 * the fight; a player's character, itself and its allies.
 */
export function effectBearers(caster: CombatantView, others: readonly CombatantView[], master: boolean): CombatantView[] {
  return [caster, ...others.filter((other) => master || other.source === 'character')];
}

/** Every hit still waiting on the master, by target, from the whole fight. */
export function pendingDamageCount(combatants: CombatantView[]): number {
  return combatants.reduce((count, combatant) => count + combatant.reminders.filter((reminder) => reminder.kind === 'pendingDamage').length, 0);
}
