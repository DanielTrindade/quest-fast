import { healthBand, isDefeated, type CombatantView, type EncounterView } from '@quest-fast/shared';
import type { Viewer } from '../events/hub.ts';
import { queueOrder, type LoadedCombatant, type LoadedEncounter } from './state.ts';

function defeated(combatant: LoadedCombatant): boolean {
  return isDefeated({ source: combatant.row.source, hpCurrent: combatant.hpCurrent });
}

function projectCombatant(combatant: LoadedCombatant, master: boolean): CombatantView {
  const { row } = combatant;
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
    concentrating: combatant.concentrating,
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
    combatants: visible.map((combatant) => projectCombatant(combatant, master)),
    summary:
      encounter.status === 'ended'
        ? {
            rounds: encounter.round,
            defeated: visible.filter(defeated).map((combatant) => combatant.name),
          }
        : null,
  };
}
