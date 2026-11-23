/** What the player typed in the modifier bar, kept as text: a half-typed "+1d" must survive a re-render. */
export type RollBonusDraft = { roll: string; damage: string };

export const NO_ROLL_BONUS: RollBonusDraft = { roll: '', damage: '' };

/** Whether anything is added to the next rolls. */
export function hasRollBonus(draft: RollBonusDraft): boolean {
  return draft.roll.trim() !== '' || draft.damage.trim() !== '';
}
