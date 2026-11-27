import { eq } from 'drizzle-orm';
import { combatants, encounters, type CombatantRow } from '@quest-fast/db';
import { nextTurn, startTurnEffects, summonsEnding, type CombatSessionEvent, type SummonEnd } from '@quest-fast/shared';
import { recordCombatEvent } from '../events/feed.ts';
import { scenesShowing } from '../scenes/store.ts';
import { clearEffects, recordEndedEffects, settleCharacterEffects, writeEffects, type Actor, type EndedEffect } from './effects.ts';
import { effectiveInitiative, findEncounter, followsIdOf, loadEncounter, turnOrder, type Executor, type LoadedCombatant, type LoadedEncounter } from './state.ts';
import { beginTurn } from './turn.ts';

/**
 * How a combatant leaves a fight, whoever asks: the turn passes on, its ties
 * to its summons go, and (#114) summons whose concentration went with it
 * leave too. Shared by the combat routes and the sheet routes, which change
 * concentration from outside the fight.
 */

/**
 * Passes the turn on when the active combatant is about to leave. Runs before
 * the combatant goes, so its position in the queue is still known. Returns
 * the effects that ended as the next turn began (Shield), for the feed.
 */
export function handOffTurn(tx: Executor, loaded: LoadedEncounter, combatantId: string, touched = new Set<string>()): EndedEffect[] {
  const { encounter } = loaded;
  if (encounter.activeCombatantId !== combatantId) return [];
  const next = nextTurn(turnOrder(loaded), encounter.activeCombatantId, encounter.round);
  const activeId = next.activeId === combatantId ? null : next.activeId;
  tx.update(encounters).set({ activeCombatantId: activeId, round: next.round }).where(eq(encounters.id, encounter.id)).run();
  beginTurn(tx, activeId);
  const taking = loaded.combatants.find((combatant) => combatant.row.id === activeId);
  return taking ? startEffectsOf(tx, taking, touched) : [];
}

/** The bearer's turn begins: what lasted until then (Shield) ends, and is returned. */
export function startEffectsOf(tx: Executor, combatant: LoadedCombatant, touched: Set<string>): EndedEffect[] {
  const { remaining, expired } = startTurnEffects(combatant.effects);
  if (expired.length > 0) writeEffects(tx, combatant, remaining, touched);
  return expired.map((effect) => ({ bearer: combatant, effect }));
}

/**
 * A summon acting with a combatant about to leave keeps the count it had and
 * acts on its own from then on; every tie to the one leaving goes. A summon
 * held by its concentration leaves in `settleSummons`, which follows.
 */
export function releaseSummons(tx: Executor, loaded: LoadedEncounter, leavingId: string) {
  for (const combatant of loaded.combatants) {
    if (combatant.row.summonerId !== leavingId) continue;
    const following = followsIdOf(combatant.row) === leavingId;
    tx.update(combatants)
      .set({
        summonerId: null,
        ...(following ? { initiativeMode: 'own' as const, initiative: effectiveInitiative(loaded, combatant) } : {}),
      })
      .where(eq(combatants.id, combatant.row.id))
      .run();
  }
}

/**
 * A combatant leaves the fight: its effects end (Aid's hit points go), the
 * turn passes on if it was its, its summons are released, and the row goes
 * with its tokens. Pass the encounter as loaded after the last write to it.
 */
export function endCombatant(tx: Executor, loaded: LoadedEncounter, combatant: LoadedCombatant, touched: Set<string>): EndedEffect[] {
  clearEffects(tx, combatant, touched);
  const ended = handOffTurn(tx, loaded, combatant.row.id, touched);
  releaseSummons(tx, loaded, combatant.row.id);
  tx.delete(combatants).where(eq(combatants.id, combatant.row.id)).run();
  return ended;
}

/**
 * A summon (#114): came in tied to a summoner, or from the simple sheet. A
 * creature the master only handed to a player is not one: it stays when the
 * fight ends.
 */
export function isSummon(row: Pick<CombatantRow, 'summoned'>): boolean {
  return row.summoned;
}

/**
 * The feed's line for a summon coming in or going. A hidden one's stays the
 * master's, and so does one in an encounter still in preparation, which the
 * table does not know about.
 */
export function recordSummon(
  tx: Executor,
  campaignId: string,
  actor: Actor,
  summon: LoadedCombatant,
  change: { action: 'joined'; summonerName?: string } | { action: 'left'; reason: SummonEnd },
): CombatSessionEvent {
  const status = tx.select({ status: encounters.status }).from(encounters).where(eq(encounters.id, summon.row.encounterId)).get()?.status;
  return recordCombatEvent(tx, {
    campaignId,
    userId: actor.userId,
    userName: actor.userName,
    secret: summon.row.hidden || status === 'preparing',
    payload: {
      kind: 'combat.summon',
      encounterId: summon.row.encounterId,
      combatantId: summon.row.id,
      name: summon.name,
      source: summon.row.source,
      ...change,
    },
  });
}

/** What leaving the fight left to tell and to publish. */
export type Settled = {
  events: CombatSessionEvent[];
  ended: EndedEffect[];
  /** Scenes that showed a token of a summon that left. */
  scenes: string[];
};

/**
 * Every summon whose concentration is gone leaves the fight: its summoner
 * stopped concentrating (the button, a fall, the sheet, a new spell) or left.
 * Removing one may end another held by it, so the whole chain is read first.
 */
export function settleSummons(tx: Executor, campaignId: string, encounterId: string, actor: Actor, touched: Set<string>): Settled {
  const settled: Settled = { events: [], ended: [], scenes: [] };
  const first = loadEncounter(tx, findEncounter(tx, campaignId, encounterId)!);
  const ending = summonsEnding(
    first.combatants.map((combatant) => ({
      id: combatant.row.id,
      summonerId: combatant.row.summonerId,
      concentration: combatant.row.summonConcentration,
      concentrating: combatant.concentrating,
    })),
  );
  if (ending.length === 0) return settled;
  settled.scenes = scenesShowing(tx, { combatantIds: ending });
  for (const id of ending) {
    const loaded = loadEncounter(tx, findEncounter(tx, campaignId, encounterId)!);
    const summon = loaded.combatants.find((combatant) => combatant.row.id === id);
    if (!summon) continue;
    settled.ended.push(...endCombatant(tx, loaded, summon, touched));
    settled.events.push(recordSummon(tx, campaignId, actor, summon, { action: 'left', reason: 'concentration' }));
  }
  return settled;
}

/**
 * For a change to a sheet outside the fight routes (#112, #114): in the open
 * encounters the character is in, the summons its concentration held up
 * leave, and so do the effects. Returns the events to publish, the sheets
 * whose hit points moved (an ally losing Aid) and the scenes that lost a
 * summon's token; the caller publishes the character's encounters.
 */
export function settleCharacterConcentration(
  tx: Executor,
  campaignId: string,
  characterId: string,
  actor: Actor,
): { touched: Set<string>; events: CombatSessionEvent[]; scenes: string[] } {
  const touched = new Set<string>();
  const events: CombatSessionEvent[] = [];
  const ended: EndedEffect[] = [];
  const scenes = new Set<string>();
  const open = tx
    .select({ encounterId: combatants.encounterId, status: encounters.status })
    .from(combatants)
    .innerJoin(encounters, eq(encounters.id, combatants.encounterId))
    .where(eq(combatants.characterId, characterId))
    .all()
    .filter(({ status }) => status !== 'ended');
  for (const { encounterId } of open) {
    const settled = settleSummons(tx, campaignId, encounterId, actor, touched);
    events.push(...settled.events);
    ended.push(...settled.ended);
    for (const id of settled.scenes) scenes.add(id);
  }
  events.push(...recordEndedEffects(tx, campaignId, actor, ended));
  const effects = settleCharacterEffects(tx, campaignId, characterId, actor);
  for (const id of effects.touched) touched.add(id);
  events.push(...effects.events);
  return { touched, events, scenes: [...scenes] };
}
