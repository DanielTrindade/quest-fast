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
import {
  classAttacksPerAction,
  effectiveAc,
  effectiveHpMax,
  initiativeOf,
  saveBonus,
  sortInitiative,
  storedAttack,
  turnQueue,
  type Ability,
  type ActiveCondition,
  type Attack,
  type CombatEffect,
  type QueueEntry,
  type TurnEntry,
} from '@quest-fast/shared';

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
  | 'deathSaves'
  | 'level'
  | 'saves'
  | 'abilityScores'
  | 'initiativeBonus'
  | 'attacks'
  | 'speed'
  | 'class'
  | 'subclass'
  | 'attacksPerAction'
>;

/**
 * A combatant with the values that count resolved: a character's come from
 * its sheet (the single source of truth), everyone else's from the row.
 */
export type LoadedCombatant = {
  row: CombatantRow;
  sheet: SheetColumns | null;
  name: string;
  /** Who acts with it besides the master: the sheet's owner, or the controller of a summon (#114). */
  ownerId: string | null;
  /** Before the effects: the sheet's or the row's. */
  acBase: number;
  /** Under the effects (Shield of Faith): what an attack must reach. */
  ac: number;
  /** Before the effects: the sheet's or the row's. */
  hpMaxBase: number;
  /** Under the effects (Aid): what healing stops at. */
  hpMax: number;
  hpCurrent: number;
  hpTemp: number;
  conditions: ActiveCondition[];
  /** Always on the row: an effect belongs to this fight. */
  effects: CombatEffect[];
  concentrating: boolean;
  /** Walking speed in metres, before effects and conditions. */
  speed: number;
  /** Attacks of one Attack action: the sheet's (or its class and level), or the row's. */
  attacksPerAction: number;
};

export type LoadedEncounter = { encounter: EncounterRow; combatants: LoadedCombatant[] };

/** The attacks a combatant fights with: its sheet's for a character, its statblock copy otherwise. */
export function attacksOf(combatant: LoadedCombatant): Attack[] {
  const attacks = combatant.sheet ? combatant.sheet.attacks : combatant.row.attacks;
  return attacks.map(storedAttack);
}

/**
 * What a combatant adds to a saving throw: a character's sheet decides; a
 * copy from the bestiary keeps the modifiers it was copied with. A row stored
 * before them knows only its Constitution.
 */
export function saveModifierOf(combatant: LoadedCombatant, ability: Ability): number {
  if (combatant.sheet) return saveBonus(combatant.sheet, ability);
  const stored = combatant.row.saveModifiers[ability];
  if (stored !== undefined) return stored;
  return ability === 'constitution' ? combatant.row.constitutionModifier : 0;
}

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
  deathSaves: characters.deathSaves,
  level: characters.level,
  saves: characters.saves,
  abilityScores: characters.abilityScores,
  initiativeBonus: characters.initiativeBonus,
  attacks: characters.attacks,
  speed: characters.speed,
  class: characters.class,
  subclass: characters.subclass,
  attacksPerAction: characters.attacksPerAction,
};

function resolve(row: CombatantRow, sheet: SheetColumns | null): LoadedCombatant {
  if (sheet) {
    return {
      row,
      sheet,
      name: sheet.name,
      ownerId: sheet.ownerId,
      acBase: sheet.ac,
      ac: effectiveAc(sheet.ac, row.effects),
      hpMaxBase: sheet.hp,
      hpMax: effectiveHpMax(sheet.hp, row.effects),
      hpCurrent: sheet.hpCurrent,
      hpTemp: sheet.hpTemp,
      conditions: sheet.conditions,
      effects: row.effects,
      concentrating: sheet.concentrating,
      speed: sheet.speed,
      attacksPerAction: sheet.attacksPerAction ?? classAttacksPerAction(sheet.class, sheet.subclass, sheet.level),
    };
  }
  return {
    row,
    sheet: null,
    name: row.name,
    ownerId: row.controllerId,
    acBase: row.ac ?? 0,
    ac: effectiveAc(row.ac ?? 0, row.effects),
    hpMaxBase: row.hpMax ?? 0,
    hpMax: effectiveHpMax(row.hpMax ?? 0, row.effects),
    hpCurrent: row.hpCurrent ?? 0,
    hpTemp: row.hpTemp ?? 0,
    conditions: row.conditions ?? [],
    effects: row.effects,
    concentrating: row.concentrating ?? false,
    speed: row.speed,
    attacksPerAction: row.attacksPerAction,
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
    followsId: followsIdOf(row),
    combatant,
  };
}

/** The summoner a summon acts right after, or null when it rolls its own initiative. */
export function followsIdOf(row: Pick<CombatantRow, 'initiativeMode' | 'summonerId'>): string | null {
  return row.initiativeMode === 'withSummoner' ? row.summonerId : null;
}

/** The initiative a combatant acts on: its summoner's when it acts with it. */
export function effectiveInitiative(loaded: LoadedEncounter, combatant: LoadedCombatant): number | null {
  const entries = loaded.combatants.map(queueEntry);
  return initiativeOf(entries.find((entry) => entry.id === combatant.row.id)!, entries);
}

/** Initiative order first, then whoever is still without initiative, as added. */
export function queueOrder(loaded: LoadedEncounter): LoadedCombatant[] {
  const ranked = sortInitiative(loaded.combatants.map(queueEntry)).map((entry) => entry.combatant);
  const placed = new Set(ranked);
  const waiting = loaded.combatants.filter((combatant) => !placed.has(combatant));
  return [...ranked, ...waiting];
}

/**
 * Who must still roll before round 1: a summon acting with its summoner
 * waits on the summoner's roll, so it is not listed itself.
 */
export function missingInitiative(loaded: LoadedEncounter): LoadedCombatant[] {
  const ids = new Set(loaded.combatants.map((combatant) => combatant.row.id));
  return loaded.combatants.filter((combatant) => {
    const follows = followsIdOf(combatant.row);
    return combatant.row.initiative === null && !(follows && ids.has(follows));
  });
}

export function turnOrder(loaded: LoadedEncounter): TurnEntry[] {
  return turnQueue(loaded.combatants.map(queueEntry));
}
