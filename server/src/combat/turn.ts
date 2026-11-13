import { eq } from 'drizzle-orm';
import { combatants, type CombatantRow } from '@quest-fast/db';
import { freshTurn, type TurnBudget } from '@quest-fast/shared';
import type { Executor } from './state.ts';

/** The turn columns of a combatant, as the `shared/` rules count them. */
export function budgetOf(row: CombatantRow): TurnBudget {
  return {
    actionUsed: row.actionUsed,
    bonusActionUsed: row.bonusActionUsed,
    reactionUsed: row.reactionUsed,
    attacksLeft: row.attacksLeft,
    extraActions: row.extraActions,
    dashes: row.dashes,
    movementUsed: row.movementUsed,
  };
}

export function writeBudget(tx: Executor, combatantId: string, budget: TurnBudget) {
  tx.update(combatants).set(budget).where(eq(combatants.id, combatantId)).run();
}

/** A combatant's turn begins: its action, bonus action, reaction and movement are back. */
export function beginTurn(tx: Executor, combatantId: string | null) {
  if (combatantId) writeBudget(tx, combatantId, freshTurn());
}
