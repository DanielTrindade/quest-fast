import { effectiveSpeed, healthBand, isDefeated, movementLeft, pendingReminders, type CombatantView, type EncounterView, type TurnView } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';
import { attacksOf, queueOrder, type LoadedCombatant, type LoadedEncounter } from './state.ts';

function defeated(combatant: LoadedCombatant): boolean {
  return isDefeated({ source: combatant.row.source, hpCurrent: combatant.hpCurrent });
}

/** What is left of a combatant's turn, as the server counts it. */
export function turnOf(combatant: LoadedCombatant): TurnView {
  const { row } = combatant;
  const speed = effectiveSpeed(combatant.speed, combatant.conditions);
  const budget = {
    actionUsed: row.actionUsed,
    bonusActionUsed: row.bonusActionUsed,
    reactionUsed: row.reactionUsed,
    attacksLeft: row.attacksLeft,
    extraActions: row.extraActions,
    dashes: row.dashes,
    movementUsed: row.movementUsed,
  };
  return { ...budget, speed, movementLeft: movementLeft(budget, speed), attacksPerAction: combatant.attacksPerAction };
}

function projectCombatant(combatant: LoadedCombatant, viewer: Viewer, round: number): CombatantView {
  const { row } = combatant;
  const master = viewer.role === 'master';
  // Allies are open to the whole table; a monster's numbers are the master's.
  const known = master || row.source === 'character';
  return {
    id: row.id,
    source: row.source,
    characterId: row.characterId,
    ownerId: combatant.ownerId,
    name: combatant.name,
    size: combatant.sheet?.size ?? row.size,
    hidden: master && row.hidden,
    initiative: known ? row.initiative : null,
    hasInitiative: row.initiative !== null,
    dexModifier: master ? row.dexModifier : null,
    tieOrder: master ? row.tieOrder : null,
    ac: known ? combatant.ac : null,
    hpMax: known ? combatant.hpMax : null,
    hpCurrent: known ? combatant.hpCurrent : null,
    hpTemp: known ? combatant.hpTemp : null,
    healthBand: healthBand(combatant.hpCurrent, combatant.hpMax),
    defeated: defeated(combatant),
    conditions: combatant.conditions,
    concentrating: known && combatant.concentrating,
    deathSaves: combatant.sheet?.deathSaves ?? null,
    deathSaveRolled: !!combatant.sheet && row.deathSaveRound === round,
    // A pending damage from a secret attack would give the roll away.
    reminders: known
      ? pendingReminders(row.reminders, combatant).filter((reminder) => master || reminder.kind !== 'pendingDamage' || !reminder.secret)
      : [],
    // A statblock's attacks give its bonus and damage away.
    attacks: known ? attacksOf(combatant) : [],
    speed: known ? combatant.speed : null,
    attacksPerAction: known ? combatant.attacksPerAction : null,
    // The turn is the master's and the owner's to manage, not the table's.
    turn: master || (combatant.ownerId !== null && combatant.ownerId === viewer.userId) ? turnOf(combatant) : null,
  };
}

/**
 * The encounter as one viewer may see it — the only shape that leaves the
 * server, over REST and over the socket. A player gets nothing of an
 * encounter in preparation (`null`), nothing of a hidden combatant, and only
 * the health band of a monster.
 */
export function projectEncounter(loaded: LoadedEncounter, viewer: Viewer): EncounterView | null {
  const { encounter } = loaded;
  const master = viewer.role === 'master';
  if (!master && encounter.status === 'preparing') return null;

  const visible = queueOrder(loaded).filter((combatant) => master || !combatant.row.hidden);
  const active = loaded.combatants.find((combatant) => combatant.row.id === encounter.activeCombatantId);
  const activeHidden = !master && active?.row.hidden === true;

  return {
    id: encounter.id,
    campaignId: encounter.campaignId,
    name: encounter.name,
    status: encounter.status,
    round: encounter.round,
    activeCombatantId: activeHidden ? null : encounter.activeCombatantId,
    activeHidden,
    version: encounter.version,
    createdAt: encounter.createdAt.toISOString(),
    startedAt: encounter.startedAt?.toISOString() ?? null,
    endedAt: encounter.endedAt?.toISOString() ?? null,
    combatants: visible.map((combatant) => projectCombatant(combatant, viewer, encounter.round)),
    summary:
      encounter.status === 'ended'
        ? {
            rounds: encounter.round,
            defeated: visible.filter(defeated).map((combatant) => combatant.name),
          }
        : null,
  };
}
