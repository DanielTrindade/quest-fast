import { and, asc, eq, sql } from 'drizzle-orm';
import {
  characters,
  combatants,
  encounters,
  type CharacterRow,
  type CombatantRow,
  type Db,
  type EncounterRow,
} from '@quest-fast/db';
import { sortInitiative, turnQueue, type ActiveCondition, type QueueEntry, type TurnEntry } from '@quest-fast/shared';

/** The database or an open transaction: the helpers here run inside both. */
export type Executor = Pick<Db, 'select' | 'insert' | 'update' | 'delete'>;

type SheetColumns = Pick<
  CharacterRow,
  | 'name'
  | 'ownerId'
  | 'size'
  | 'hp'
  | 'hpCurrent'
  | 'hpTemp'
  | 'ac'
  | 'conditions'
  | 'concentrating'
  | 'abilityScores'
  | 'initiativeBonus'
>;

/**
 * A combatant with the values that count resolved: a character's come from
 * its sheet (the single source of truth), everyone else's from the row.
 */
export type LoadedCombatant = {
  row: CombatantRow;
  sheet: SheetColumns | null;
  name: string;
  ownerId: string | null;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  hpTemp: number;
  conditions: ActiveCondition[];
  concentrating: boolean;
};

export type LoadedEncounter = { encounter: EncounterRow; combatants: LoadedCombatant[] };

const sheetColumns = {
  name: characters.name,
  ownerId: characters.ownerId,
  size: characters.size,
  hp: characters.hp,
  hpCurrent: characters.hpCurrent,
  hpTemp: characters.hpTemp,
  ac: characters.ac,
  conditions: characters.conditions,
  concentrating: characters.concentrating,
  abilityScores: characters.abilityScores,
  initiativeBonus: characters.initiativeBonus,
};

function resolve(row: CombatantRow, sheet: SheetColumns | null): LoadedCombatant {
  if (sheet) {
    return {
      row,
      sheet,
      name: sheet.name,
      ownerId: sheet.ownerId,
      ac: sheet.ac,
      hpMax: sheet.hp,
      hpCurrent: sheet.hpCurrent,
      hpTemp: sheet.hpTemp,
      conditions: sheet.conditions,
      concentrating: sheet.concentrating,
    };
  }
  return {
    row,
    sheet: null,
    name: row.name,
    ownerId: null,
    ac: row.ac ?? 0,
    hpMax: row.hpMax ?? 0,
    hpCurrent: row.hpCurrent ?? 0,
    hpTemp: row.hpTemp ?? 0,
    conditions: row.conditions ?? [],
    concentrating: row.concentrating ?? false,
  };
}

export function findEncounter(db: Executor, campaignId: string, encounterId: string): EncounterRow | undefined {
  return db
    .select()
    .from(encounters)
    .where(and(eq(encounters.id, encounterId), eq(encounters.campaignId, campaignId)))
    .get();
}

/** Combatants in the order they were added; the queue order is derived. */
export function loadEncounter(db: Executor, encounter: EncounterRow): LoadedEncounter {
  const rows = db
    .select({ combatant: combatants, sheet: sheetColumns })
    .from(combatants)
    .leftJoin(characters, eq(characters.id, combatants.characterId))
    .where(eq(combatants.encounterId, encounter.id))
    .orderBy(asc(combatants.createdAt), asc(sql`${combatants}.rowid`))
    .all();
  return {
    encounter,
    combatants: rows.map(({ combatant, sheet }) =>
      resolve(combatant, combatant.source === 'character' && sheet?.ownerId ? (sheet as SheetColumns) : null),
    ),
  };
}

function queueEntry(combatant: LoadedCombatant): QueueEntry & { combatant: LoadedCombatant } {
  const { row } = combatant;
  return {
    id: row.id,
    source: row.source,
    hpCurrent: combatant.hpCurrent,
    initiative: row.initiative,
    dexModifier: row.dexModifier,
    tieOrder: row.tieOrder,
    combatant,
  };
}

/** Initiative order first, then whoever is still without initiative, as added. */
export function queueOrder(loaded: LoadedEncounter): LoadedCombatant[] {
  const ranked = sortInitiative(loaded.combatants.map(queueEntry)).map((entry) => entry.combatant);
  const waiting = loaded.combatants.filter((combatant) => combatant.row.initiative === null);
  return [...ranked, ...waiting];
}

export function turnOrder(loaded: LoadedEncounter): TurnEntry[] {
  return turnQueue(loaded.combatants.map(queueEntry));
}
