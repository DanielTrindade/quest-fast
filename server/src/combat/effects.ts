import { and, eq, ne } from 'drizzle-orm';
import { characters, combatants, encounters, type EncounterRow } from '@quest-fast/db';
import { effectiveHpMax, hpAfterMaxChange, type CombatEffect } from '@quest-fast/shared';
import { loadEncounter, type Executor, type LoadedCombatant } from './state.ts';

/**
 * Writes a combatant's effects. A change of the hit point maximum moves the
 * current hit points with it (Aid, 2024): up by what an effect adds, and down
 * only to what is left when it ends. A character's live on its sheet, whose
 * id joins `touched` so its other encounters are published too. Pass a
 * combatant as loaded after the last write to it in this transaction.
 */
export function writeEffects(tx: Executor, combatant: LoadedCombatant, effects: CombatEffect[], touched: Set<string>) {
  const { row } = combatant;
  tx.update(combatants).set({ effects }).where(eq(combatants.id, row.id)).run();
  const hpMax = effectiveHpMax(combatant.hpMaxBase, effects);
  const hpCurrent = hpAfterMaxChange(combatant.hpCurrent, combatant.hpMax, hpMax);
  if (hpCurrent === combatant.hpCurrent) return;
  if (row.characterId) {
    // Raised from 0, a character starts the death saves over, as with any healing.
    const rose = combatant.hpCurrent === 0 && hpCurrent > 0;
    tx.update(characters)
      .set({ hpCurrent, ...(rose ? { deathSaves: { successes: 0, failures: 0 } } : {}), updatedAt: new Date() })
      .where(eq(characters.id, row.characterId))
      .run();
    touched.add(row.characterId);
  } else {
    tx.update(combatants).set({ hpCurrent }).where(eq(combatants.id, row.id)).run();
  }
}

/**
 * What the running fight's effects add to a character's hit point maximum
 * (Aid): a sheet edited mid-fight keeps it, instead of cutting the bonus.
 */
export function hpMaxBonusOf(tx: Executor, characterId: string): number {
  return tx
    .select({ effects: combatants.effects })
    .from(combatants)
    .innerJoin(encounters, eq(encounters.id, combatants.encounterId))
    .where(and(eq(combatants.characterId, characterId), eq(encounters.status, 'active')))
    .all()
    .reduce((sum, { effects }) => sum + effectiveHpMax(0, effects), 0);
}

/** Takes every effect off, as when the combatant leaves the fight or the fight ends. */
export function clearEffects(tx: Executor, combatant: LoadedCombatant, touched: Set<string>) {
  if (combatant.effects.length > 0) writeEffects(tx, combatant, [], touched);
}

/**
 * Drops for good the effects whose concentration is gone: the source stopped
 * concentrating (by the button, by falling, on the sheet) or left the fight.
 * Filtering on read is not enough: concentrating again would bring them back.
 */
export function settleEffects(tx: Executor, encounter: EncounterRow, touched: Set<string>) {
  const loaded = loadEncounter(tx, encounter);
  const concentrating = new Set(loaded.combatants.filter((combatant) => combatant.concentrating).map((combatant) => combatant.row.id));
  for (const combatant of loaded.combatants) {
    const kept = combatant.effects.filter(
      (effect) => !effect.concentration || (effect.sourceCombatantId !== undefined && concentrating.has(effect.sourceCombatantId)),
    );
    if (kept.length !== combatant.effects.length) writeEffects(tx, combatant, kept, touched);
  }
}

/**
 * For a change to a sheet outside the fight routes: the open encounters the
 * character is in drop what its concentration held up. Returns the sheets
 * whose hit points that moved (an ally losing Aid), so the caller publishes
 * their encounters too.
 */
export function settleCharacterEffects(tx: Executor, campaignId: string, characterId: string): Set<string> {
  const touched = new Set<string>();
  const open = tx
    .select({ encounter: encounters })
    .from(encounters)
    .innerJoin(combatants, eq(combatants.encounterId, encounters.id))
    .where(and(eq(encounters.campaignId, campaignId), ne(encounters.status, 'ended'), eq(combatants.characterId, characterId)))
    .all();
  for (const { encounter } of open) settleEffects(tx, encounter, touched);
  return touched;
}
