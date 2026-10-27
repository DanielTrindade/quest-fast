import type { DeathSaves } from './sheet.ts';

/**
 * Pure combat rules (D&D 2024). The server applies them inside a transaction;
 * the client only displays the result.
 */

export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const EXHAUSTION_MAX = 6;

export const ENCOUNTER_STATUSES = ['preparing', 'active', 'ended'] as const;
export const COMBATANT_SOURCES = ['character', 'statblock', 'manual'] as const;

export type ActiveCondition = {
  condition: Condition;
  /** Only for `exhaustion`: 1 to 6. */
  level?: number;
  /** Rounds left; absent means no duration. */
  roundsLeft?: number;
};

export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

export function isActiveCondition(value: unknown): value is ActiveCondition {
  if (typeof value !== 'object' || value === null) return false;
  const { condition, level, roundsLeft } = value as Record<string, unknown>;
  if (!isCondition(condition)) return false;
  if (roundsLeft !== undefined && !isPositiveInteger(roundsLeft)) return false;
  if (condition === 'exhaustion') return isPositiveInteger(level) && level <= EXHAUSTION_MAX;
  return level === undefined;
}

/**
 * Runs at the end of the affected combatant's turn: durations lose one round
 * and the ones that reach zero expire. Conditions without duration stay.
 */
export function tickConditions(conditions: readonly ActiveCondition[]): {
  remaining: ActiveCondition[];
  expired: ActiveCondition[];
} {
  const remaining: ActiveCondition[] = [];
  const expired: ActiveCondition[] = [];
  for (const active of conditions) {
    if (active.roundsLeft === undefined) remaining.push(active);
    else if (active.roundsLeft <= 1) expired.push(active);
    else remaining.push({ ...active, roundsLeft: active.roundsLeft - 1 });
  }
  return { remaining, expired };
}

export type InitiativeEntry = {
  initiative: number | null;
  dexModifier: number;
  tieOrder: number;
};

/**
 * The initiative queue: highest first, ties broken by Dexterity and then by
 * the order the master set. Combatants without initiative are left out.
 */
export function sortInitiative<T extends InitiativeEntry>(combatants: readonly T[]): (T & { initiative: number })[] {
  return combatants
    .filter((combatant): combatant is T & { initiative: number } => combatant.initiative !== null)
    .sort((a, b) => b.initiative - a.initiative || b.dexModifier - a.dexModifier || a.tieOrder - b.tieOrder);
}

export type TurnEntry = { id: string; defeated: boolean };
export type TurnState = { activeId: string | null; round: number };

/**
 * The next combatant standing in the queue; passing the end starts a new
 * round. A missing active combatant (none yet, or removed) hands the turn to
 * the first one standing in the current round. Whoever builds the queue
 * decides `defeated`: a character at 0 hit points still takes turns.
 */
export function nextTurn(order: readonly TurnEntry[], activeId: string | null, round: number): TurnState {
  const current = order.findIndex((entry) => entry.id === activeId);
  if (current === -1) {
    const first = order.find((entry) => !entry.defeated);
    return { activeId: first?.id ?? activeId, round };
  }
  for (let step = 1; step <= order.length; step++) {
    const index = current + step;
    const entry = order[index % order.length];
    if (!entry.defeated) return { activeId: entry.id, round: index >= order.length ? round + 1 : round };
  }
  return { activeId, round };
}

/** Undoes `nextTurn`. The first turn of round 1 has nothing before it. */
export function previousTurn(order: readonly TurnEntry[], activeId: string | null, round: number): TurnState {
  const current = order.findIndex((entry) => entry.id === activeId);
  if (current === -1) return { activeId, round };
  for (let step = 1; step <= order.length; step++) {
    const index = current - step;
    if (index < 0 && round <= 1) return { activeId, round };
    const entry = order[(index + order.length) % order.length];
    if (!entry.defeated) return { activeId: entry.id, round: index < 0 ? round - 1 : round };
  }
  return { activeId, round };
}

export type QueueEntry = InitiativeEntry & {
  id: string;
  source: (typeof COMBATANT_SOURCES)[number];
  hpCurrent: number;
};

/**
 * A monster or manual combatant at 0 hit points is out of the fight; a
 * character at 0 still takes turns (death saving throws).
 */
export function isDefeated(combatant: Pick<QueueEntry, 'source' | 'hpCurrent'>): boolean {
  return combatant.source !== 'character' && combatant.hpCurrent <= 0;
}

/** The queue `nextTurn` and `previousTurn` walk: initiative order, defeated marked. */
export function turnQueue(combatants: readonly QueueEntry[]): TurnEntry[] {
  return sortInitiative(combatants).map((combatant) => ({ id: combatant.id, defeated: isDefeated(combatant) }));
}

export const HEALTH_BANDS = ['unhurt', 'wounded', 'bloodied', 'defeated'] as const;
export type HealthBand = (typeof HEALTH_BANDS)[number];

/** What a player sees of a monster instead of its hit points. */
export function healthBand(hpCurrent: number, hpMax: number): HealthBand {
  if (hpCurrent <= 0 || hpMax <= 0) return 'defeated';
  if (hpCurrent >= hpMax) return 'unhurt';
  return hpCurrent * 2 <= hpMax ? 'bloodied' : 'wounded';
}

/** Constitution save to keep concentration: half the damage, from 10 to 30. */
export function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

const DEATH_SAVES_MAX = 3;

export type DeathSaveOutcome = {
  saves: DeathSaves;
  status: 'pending' | 'stable' | 'dead' | 'revived';
  /** Only when a natural 20 brings the character back. */
  hpCurrent?: number;
};

/** One death saving throw from the d20 face rolled on the server. */
export function deathSaveOutcome(d20: number, saves: DeathSaves): DeathSaveOutcome {
  if (d20 === 20) return { saves: { successes: 0, failures: 0 }, status: 'revived', hpCurrent: 1 };
  const next = { ...saves };
  if (d20 >= 10) next.successes = Math.min(DEATH_SAVES_MAX, next.successes + 1);
  else next.failures = Math.min(DEATH_SAVES_MAX, next.failures + (d20 === 1 ? 2 : 1));
  if (next.failures >= DEATH_SAVES_MAX) return { saves: next, status: 'dead' };
  if (next.successes >= DEATH_SAVES_MAX) return { saves: next, status: 'stable' };
  return { saves: next, status: 'pending' };
}

/**
 * Names for `count` copies of a creature in an encounter. A lone one keeps the
 * plain name; numbering continues after the highest copy already there, and
 * the plain name counts as copy 1.
 */
export function numberCopies(name: string, count: number, existingNames: readonly string[]): string[] {
  let highest = 0;
  for (const existing of existingNames) highest = Math.max(highest, copyNumber(existing, name) ?? 0);
  if (count === 1 && highest === 0) return [name];
  return Array.from({ length: count }, (_, index) => `${name} ${highest + index + 1}`);
}

/**
 * Which copy of `creature` a name is: the plain name is copy 1, `Goblin 3` is
 * copy 3, anything else is not a copy (`null`). Only the creature's own name
 * tells a number apart from the name itself: `Construto 7` is copy 7 of
 * `Construto`, but copy 1 of `Construto 7`.
 */
export function copyNumber(name: string, creature: string): number | null {
  if (name === creature) return 1;
  if (!name.startsWith(`${creature} `)) return null;
  const suffix = name.slice(creature.length + 1);
  return /^\d+$/.test(suffix) ? Number(suffix) : null;
}

export type CopyEntry = {
  id: string;
  name: string;
  hidden: boolean;
  /** Only numbered creatures give way; a name the master typed stays. */
  renamable: boolean;
};

/**
 * Names for `count` copies joining an encounter, so that what a player sees
 * never hints at a hidden combatant. Visible copies number after the visible
 * ones only — a hidden copy leaves no gap. A hidden copy holding one of those
 * names gives it up and takes a number after every name, so the master never
 * sees two combatants with the same name. Hidden copies number after every
 * name. Revealing a copy is placing it again as one visible copy.
 */
export function placeCopies(
  name: string,
  count: number,
  hidden: boolean,
  existing: readonly CopyEntry[],
): { names: string[]; renamed: { id: string; name: string }[] } {
  const allNames = existing.map((entry) => entry.name);
  if (hidden) return { names: numberCopies(name, count, allNames), renamed: [] };

  const names = numberCopies(name, count, existing.filter((entry) => !entry.hidden).map((entry) => entry.name));
  const displaced = existing.filter((entry) => entry.hidden && entry.renamable && names.includes(entry.name));
  const fresh = numberCopies(name, displaced.length, [...allNames, ...names]);
  return { names, renamed: displaced.map((entry, index) => ({ id: entry.id, name: fresh[index]! })) };
}

/** Bounds of a bestiary entry, shared by the server parser and the editor. */
export const STATBLOCK_LIMITS = {
  name: 80,
  creatureType: 60,
  speed: 60,
  hpFormula: 30,
  text: 4000,
  ac: { min: 1, max: 40 },
  hp: { min: 1, max: 999 },
  initiativeBonus: { min: -10, max: 20 },
  attacks: 20,
} as const;

/** Bounds of an encounter and its combatants, shared by the server and the setup form. */
export const ENCOUNTER_LIMITS = {
  name: 80,
  /** Copies of one statblock added at once. */
  copies: 20,
  combatants: 60,
  initiative: { min: -10, max: 50 },
} as const;

/** Challenge ratings of the 5e scale, as written in a statblock. */
export const CHALLENGE_RATINGS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, index) => String(index + 1))];

export function isChallengeRating(value: unknown): value is string {
  return typeof value === 'string' && CHALLENGE_RATINGS.includes(value);
}
