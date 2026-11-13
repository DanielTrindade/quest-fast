import type { CombatantView } from '@quest-fast/shared';

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

/** Every hit still waiting on the master, by target, from the whole fight. */
export function pendingDamageCount(combatants: CombatantView[]): number {
  return combatants.reduce((count, combatant) => count + combatant.reminders.filter((reminder) => reminder.kind === 'pendingDamage').length, 0);
}
