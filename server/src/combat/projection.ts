import { effectiveSpeed, healthBand, isDefeated, isOpenToTable, isSecretReminder, movementLeft, pendingReminders, type CombatantView, type EncounterView, type SummonView, type TurnView } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';
import { attacksOf, effectiveInitiative, queueOrder, type LoadedCombatant, type LoadedEncounter } from './state.ts';

function defeated(combatant: LoadedCombatant): boolean {
  return isDefeated({ source: combatant.row.source, hpCurrent: combatant.hpCurrent });
}

/** What is left of a combatant's turn, as the server counts it. */
export function turnOf(combatant: LoadedCombatant): TurnView {
  const { row } = combatant;
  // Movement already walked stays spent when an effect slows it down.
  const speed = effectiveSpeed(combatant.speed, combatant.conditions, combatant.effects);
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

/** A summon's tie, or null for a combatant summoned by nobody and acting on its own for good. */
function summonOf(combatant: LoadedCombatant): SummonView | null {
  const { row } = combatant;
  if (!row.summonerId && row.initiativeMode === 'own' && !row.summonConcentration && row.roundsLeft === null && !row.controllerId) return null;
  return {
    summonerId: row.summonerId,
    initiativeMode: row.initiativeMode,
    concentration: row.summonConcentration,
    roundsLeft: row.roundsLeft,
    editableByController: row.controllerId !== null && row.createdBy === row.controllerId,
  };
}

function projectCombatant(loaded: LoadedEncounter, combatant: LoadedCombatant, viewer: Viewer): CombatantView {
  const { row } = combatant;
  const { round } = loaded.encounter;
  const master = viewer.role === 'master';
  // Allies (characters and the creatures players control, #114) are open to
  // the whole table; a monster's numbers are the master's, except its hit
  // points, which the table follows (#111).
  const known = master || isOpenToTable({ source: row.source, controllerId: row.controllerId });
  const initiative = effectiveInitiative(loaded, combatant);
  return {
    id: row.id,
    source: row.source,
    characterId: row.characterId,
    ownerId: combatant.ownerId,
    name: combatant.name,
    size: combatant.sheet?.size ?? row.size,
    hidden: master && row.hidden,
    initiative: known ? initiative : null,
    hasInitiative: initiative !== null,
    dexModifier: master ? row.dexModifier : null,
    tieOrder: master ? row.tieOrder : null,
    ac: known ? combatant.ac : null,
    hpMax: combatant.hpMax,
    hpCurrent: combatant.hpCurrent,
    hpTemp: combatant.hpTemp,
    healthBand: healthBand(combatant.hpCurrent, combatant.hpMax),
    defeated: defeated(combatant),
    conditions: combatant.conditions,
    // Of a monster's effects, the table learns what is on it, not the numbers.
    effects: known ? combatant.effects : combatant.effects.map(({ id, name }) => ({ id, name })),
    concentrating: known && combatant.concentrating,
    deathSaves: combatant.sheet?.deathSaves ?? null,
    deathSaveRolled: !!combatant.sheet && row.deathSaveRound === round,
    // What a secret attack left behind would give the roll away.
    reminders: known
      ? pendingReminders(row.reminders, combatant).filter((reminder) => master || !isSecretReminder(reminder))
      : [],
    // A statblock's attacks give its bonus and damage away.
    attacks: known ? attacksOf(combatant) : [],
    speed: known ? combatant.speed : null,
    attacksPerAction: known ? combatant.attacksPerAction : null,
    // The turn is the master's and the owner's to manage, not the table's.
    turn: master || (combatant.ownerId !== null && combatant.ownerId === viewer.userId) ? turnOf(combatant) : null,
    summon: known ? summonOf(combatant) : null,
  };
}

/**
 * The encounter as one viewer may see it — the only shape that leaves the
 * server, over REST and over the socket. A player gets nothing of an
 * encounter in preparation (`null`), nothing of a hidden combatant, and of a
 * monster only its hit points and conditions: no AC, attacks or initiative.
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
    combatants: visible.map((combatant) => projectCombatant(loaded, combatant, viewer)),
    summary:
      encounter.status === 'ended'
        ? {
            rounds: encounter.round,
            defeated: visible.filter(defeated).map((combatant) => combatant.name),
          }
        : null,
  };
}
