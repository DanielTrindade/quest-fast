import { and, eq, or, sql } from 'drizzle-orm';
import { encounters, tokens, type TokenRow } from '@quest-fast/db';
import { movementCost, spendMovement, type SquareGrid, type TurnView } from '@quest-fast/shared';
import type { Deps } from '../context.ts';
import { projectEncounter, turnOf } from '../combat/projection.ts';
import { findEncounter, loadEncounter, type Executor, type LoadedCombatant } from '../combat/state.ts';
import { budgetOf, writeBudget } from '../combat/turn.ts';
import type { Viewer } from '../events/hub.ts';

/** A token's combatant in the campaign's running fight, once round 1 began. */
export type Fighter = {
  encounterId: string;
  combatant: LoadedCombatant;
  turn: TurnView;
  /** It is this combatant's turn. */
  active: boolean;
};

/** Who fights in the campaign's running encounter, by their token's origin. */
export type Fight = { byCharacter: Map<string, Fighter>; byCombatant: Map<string, Fighter> };

/**
 * The running encounter of a campaign as the map reads it, or null when none
 * runs or round 1 has not begun: until then the table places its tokens freely.
 */
export function runningFight(db: Executor, campaignId: string): Fight | null {
  const encounter = db
    .select()
    .from(encounters)
    .where(and(eq(encounters.campaignId, campaignId), eq(encounters.status, 'active')))
    .get();
  if (!encounter || encounter.round === 0) return null;
  const loaded = loadEncounter(db, encounter);
  const fight: Fight = { byCharacter: new Map(), byCombatant: new Map() };
  for (const combatant of loaded.combatants) {
    const fighter = {
      encounterId: encounter.id,
      combatant,
      turn: turnOf(combatant),
      active: encounter.activeCombatantId === combatant.row.id,
    };
    fight.byCombatant.set(combatant.row.id, fighter);
    if (combatant.row.characterId) fight.byCharacter.set(combatant.row.characterId, fighter);
  }
  return fight;
}

/** The fighter behind a token: its character's combatant, or its own combatant. */
export function fighterOf(fight: Fight | null, row: Pick<TokenRow, 'characterId' | 'combatantId'>): Fighter | null {
  if (!fight) return null;
  return (row.characterId && fight.byCharacter.get(row.characterId)) || (row.combatantId && fight.byCombatant.get(row.combatantId)) || null;
}

/** A change to a fighter's turn reaches the combat screens too. */
export function bumpEncounter(db: Executor, encounterId: string) {
  db.update(encounters).set({ version: sql`${encounters.version} + 1` }).where(eq(encounters.id, encounterId)).run();
}

export type MoveRule =
  | { ok: true; spends: Fighter | null }
  | { ok: false; status: 403 | 422; error: string };

/**
 * Whether a viewer may move a fighter's token now, and whether the move
 * spends its turn. A player moves only on their own turn; the master moves
 * anyone, and moving the combatant whose turn it is spends its movement
 * unless the master says it is free (a push, a teleport). Outside a fight,
 * nothing is counted.
 */
export function moveRule(fighter: Fighter | null, viewer: Viewer, free: boolean): MoveRule {
  if (!fighter) return { ok: true, spends: null };
  if (viewer.role !== 'master') {
    if (free) return { ok: false, status: 403, error: 'Só o mestre move sem gastar o deslocamento.' };
    if (!fighter.active) return { ok: false, status: 403, error: 'Em combate, você move o seu personagem só na vez dele.' };
    return { ok: true, spends: fighter };
  }
  return { ok: true, spends: fighter.active && !free ? fighter : null };
}

/** Spends a confirmed move from `from` to `to`, refused past what is left. */
export function spendMove(
  tx: Executor,
  fighter: Fighter,
  from: { x: number; y: number },
  to: { x: number; y: number },
  grid: SquareGrid,
): string | null {
  const cost = movementCost(from, to, grid);
  const result = spendMovement(budgetOf(fighter.combatant.row), cost, fighter.turn.speed);
  if (!result.ok) return result.error;
  writeBudget(tx, fighter.combatant.row.id, result.budget);
  bumpEncounter(tx, fighter.encounterId);
  return null;
}

/** The encounter as each connection may see it, after a move spent a turn. */
export function publishEncounter(deps: Pick<Deps, 'db' | 'hub'>, campaignId: string, encounterId: string) {
  const encounter = findEncounter(deps.db, campaignId, encounterId);
  if (!encounter) return;
  const loaded = loadEncounter(deps.db, encounter);
  deps.hub.publishCombat(campaignId, (viewer) => projectEncounter(loaded, viewer));
}

/** The tokens that stand for a combatant: its own, and its character's on any scene. */
function tokensOf(db: Executor, combatantId: string, characterId: string | null): string[] {
  const where = characterId ? or(eq(tokens.combatantId, combatantId), eq(tokens.characterId, characterId)) : eq(tokens.combatantId, combatantId);
  return db.select({ id: tokens.id }).from(tokens).where(where).all().map(({ id }) => id);
}

/**
 * The turn passed: a player still dragging the token of whoever had it lets
 * go, and the token goes back to where it is saved. Without this, a drag
 * begun on their turn would keep moving it on the next one. The master's
 * drags stay: the master moves anyone at any time.
 */
export function releaseTurnDrags(deps: Pick<Deps, 'db' | 'locks'>, combatant: { id: string; characterId: string | null }) {
  for (const tokenId of tokensOf(deps.db, combatant.id, combatant.characterId)) {
    const holder = deps.locks.holder(tokenId);
    if (holder && holder.role !== 'master') deps.locks.clear(tokenId);
  }
}
