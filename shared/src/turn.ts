/**
 * Pure rules of a combatant's turn on the map (D&D 2024): its action economy,
 * its Extra Attack and its movement on a grid of 1.5 m squares. The server
 * applies them inside a transaction; the client only shows what they allow.
 */
import type { ActiveCondition } from './combat.ts';
import { tokenCells, type GridSettings } from './battlefield.ts';
import type { Size } from './sheet.ts';

/** One square of the grid, in metres, diagonals included (2024 rule). */
export const SQUARE_METERS = 1.5;

/** Bounds of what the master or the sheet may set. */
export const TURN_LIMITS = {
  attacksPerAction: { min: 1, max: 8 },
  /** Metres, as on a sheet (`isSpeed` checks a value). */
  speed: { min: 0, max: 60 },
  /** A combatant without a speed (added by hand) walks this far. */
  defaultSpeed: 9,
} as const;

/** Floating point leaves 4.499…: anything this close to a square counts as it. */
const EPSILON = 1e-6;

type Point = { x: number; y: number };

// --- Distance ------------------------------------------------------------------

/**
 * Squares between two token positions (centres, in map pixels). Every square
 * costs the same, diagonals included, so the distance is the larger of the
 * columns and the rows crossed. Positions off the grid round to the nearest
 * square.
 */
export function squaresBetween(from: Point, to: Point, cellSize: number): number {
  const columns = Math.round(Math.abs(to.x - from.x) / cellSize);
  const rows = Math.round(Math.abs(to.y - from.y) / cellSize);
  return Math.max(columns, rows);
}

/** What moving from `from` to `to` costs, in metres. */
export function movementCost(from: Point, to: Point, cellSize: number): number {
  return squaresBetween(from, to, cellSize) * SQUARE_METERS;
}

/** Whole squares `meters` of movement still cover. */
export function squaresFor(meters: number): number {
  return Math.max(0, Math.floor(meters / SQUARE_METERS + EPSILON));
}

/**
 * Every square the token can reach with `meters` left, in any direction and
 * diagonals included: its own footprint grown by that many squares on each
 * side, cut at the map's edge. In map pixels.
 */
export function reachArea(
  token: Point & { size: Size },
  meters: number,
  grid: Pick<GridSettings, 'cellSize'>,
  map: { width: number; height: number },
): { left: number; top: number; right: number; bottom: number; squares: number } {
  const squares = squaresFor(meters);
  const half = (tokenCells(token.size) / 2 + squares) * grid.cellSize;
  return {
    left: Math.max(0, token.x - half),
    top: Math.max(0, token.y - half),
    right: Math.min(map.width, token.x + half),
    bottom: Math.min(map.height, token.y + half),
    squares,
  };
}

/** Metres written the Brazilian way: "4,5 m", "9 m". */
export function formatMeters(meters: number): string {
  const rounded = Math.round(meters * 10) / 10;
  return `${String(rounded).replace('.', ',')} m`;
}

// --- Speed ---------------------------------------------------------------------

/**
 * The walking speed in a bestiary entry's free text: the first number in
 * metres ("9 m, voo 18 m" → 9), or in feet turned into metres ("30 ft" → 9).
 * Null when the text has no number.
 */
export function speedFromText(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(m\b|metros?|ft|feet|pés|pes)?/i.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] ?? 'm').toLowerCase();
  const meters = unit === 'm' || unit.startsWith('metro') ? value : (value / 5) * SQUARE_METERS;
  return Math.min(TURN_LIMITS.speed.max, meters);
}

/**
 * The speed a combatant has under its conditions: Grappled and Restrained
 * hold it at 0; each level of Exhaustion takes 1.5 m (2024).
 */
export function effectiveSpeed(speed: number, conditions: readonly ActiveCondition[]): number {
  if (conditions.some(({ condition }) => condition === 'grappled' || condition === 'restrained')) return 0;
  const exhaustion = conditions.find(({ condition }) => condition === 'exhaustion')?.level ?? 0;
  return Math.max(0, speed - exhaustion * SQUARE_METERS);
}

// --- Extra Attack --------------------------------------------------------------

/** Lower case, no accents: "Guerreiro", "guerreiro" and "GUERREIRO" are one class. */
function normalise(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const MARTIAL = ['barbaro', 'barbarian', 'monge', 'monk', 'paladino', 'paladin', 'patrulheiro', 'ranger'];

/**
 * Attacks one Attack action makes for a single-classed character, from the
 * sheet's class, subclass and level (2024): Fighter 2/3/4 at 5/11/20;
 * Barbarian, Monk, Paladin and Ranger 2 at 5; Bard of Valor or of Swords and
 * Bladesinger Wizard 2 at 6. The sheet's own value overrides this for feats,
 * invocations, multiclassing and homebrew.
 */
export function classAttacksPerAction(className: string, subclass: string, level: number): number {
  const name = normalise(className);
  const sub = normalise(subclass);
  if (name.startsWith('guerreir') || name === 'fighter') {
    if (level >= 20) return 4;
    if (level >= 11) return 3;
    return level >= 5 ? 2 : 1;
  }
  if (MARTIAL.includes(name)) return level >= 5 ? 2 : 1;
  const valorBard = (name === 'bardo' || name === 'bard') && /bravura|valor|espada|sword/.test(sub);
  const bladesinger = (name === 'mago' || name === 'wizard') && /lamina|blade/.test(sub);
  return (valorBard || bladesinger) && level >= 6 ? 2 : 1;
}

export function isAttacksPerAction(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= TURN_LIMITS.attacksPerAction.min && value <= TURN_LIMITS.attacksPerAction.max;
}


// --- Action economy ------------------------------------------------------------

/** What a combatant spent in its current turn (the reaction, since its last turn began). */
export type TurnBudget = {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  /** Attacks still owed by an Attack action already begun. */
  attacksLeft: number;
  /** Actions granted on top of the one (Action Surge, Haste); spent after it. */
  extraActions: number;
  /** Dash actions taken: each adds the speed once more. */
  dashes: number;
  /** Metres already moved. */
  movementUsed: number;
};

export const TURN_SPENDS = ['action', 'bonusAction', 'reaction', 'attack', 'dash'] as const;
export type TurnSpend = (typeof TURN_SPENDS)[number];

export function isTurnSpend(value: unknown): value is TurnSpend {
  return typeof value === 'string' && (TURN_SPENDS as readonly string[]).includes(value);
}

/** A turn that just began: everything back. */
export function freshTurn(): TurnBudget {
  return { actionUsed: false, bonusActionUsed: false, reactionUsed: false, attacksLeft: 0, extraActions: 0, dashes: 0, movementUsed: 0 };
}

/** Whether an action is still there: the turn's own, or a granted one. */
export function hasAction(budget: TurnBudget): boolean {
  return !budget.actionUsed || budget.extraActions > 0;
}

function takeAction(budget: TurnBudget): TurnBudget {
  return budget.actionUsed ? { ...budget, extraActions: budget.extraActions - 1 } : { ...budget, actionUsed: true };
}

/** What is refused, in the words the table reads. */
const REFUSED: Record<TurnSpend, string> = {
  action: 'A ação deste turno já foi usada.',
  bonusAction: 'A ação bônus deste turno já foi usada.',
  reaction: 'A reação já foi usada nesta rodada.',
  attack: 'Não há ataque nem ação sobrando neste turno.',
  dash: 'Disparada usa a ação, que já foi gasta neste turno.',
};

/**
 * Spends one thing from the turn. An attack first takes the ones an Attack
 * action already owes, then starts a new Attack action (spending an action)
 * that owes `attacksPerAction - 1` more.
 */
export function spendTurn(
  budget: TurnBudget,
  spend: TurnSpend,
  attacksPerAction: number,
): { ok: true; budget: TurnBudget } | { ok: false; error: string } {
  const refused = { ok: false as const, error: REFUSED[spend] };
  switch (spend) {
    case 'bonusAction':
      return budget.bonusActionUsed ? refused : { ok: true, budget: { ...budget, bonusActionUsed: true } };
    case 'reaction':
      return budget.reactionUsed ? refused : { ok: true, budget: { ...budget, reactionUsed: true } };
    case 'attack':
      if (budget.attacksLeft > 0) return { ok: true, budget: { ...budget, attacksLeft: budget.attacksLeft - 1 } };
      if (!hasAction(budget)) return refused;
      return { ok: true, budget: { ...takeAction(budget), attacksLeft: attacksPerAction - 1 } };
    case 'dash':
      if (!hasAction(budget)) return refused;
      return { ok: true, budget: { ...takeAction(budget), attacksLeft: 0, dashes: budget.dashes + 1 } };
    case 'action':
      if (!hasAction(budget)) return refused;
      // Another action ends an Attack action that still owed attacks.
      return { ok: true, budget: { ...takeAction(budget), attacksLeft: 0 } };
  }
}

/**
 * The master gives something back: the action (ending an Attack action that
 * still owed attacks), the bonus action, the reaction or a Dash (its action
 * comes back with it).
 */
export function refundTurn(budget: TurnBudget, spend: Exclude<TurnSpend, 'attack'>): TurnBudget {
  switch (spend) {
    case 'bonusAction':
      return { ...budget, bonusActionUsed: false };
    case 'reaction':
      return { ...budget, reactionUsed: false };
    case 'dash':
      if (budget.dashes === 0) return budget;
      return { ...budget, actionUsed: false, dashes: budget.dashes - 1 };
    case 'action':
      return { ...budget, actionUsed: false, attacksLeft: 0 };
  }
}

/** The master grants one more action this turn (Action Surge, Haste). */
export function grantAction(budget: TurnBudget): TurnBudget {
  return { ...budget, extraActions: budget.extraActions + 1 };
}

/** Metres still to walk this turn: the speed once, plus once per Dash, less what was walked. */
export function movementLeft(budget: Pick<TurnBudget, 'dashes' | 'movementUsed'>, speed: number): number {
  return Math.max(0, speed * (1 + budget.dashes) - budget.movementUsed);
}

/** Spends a move of `cost` metres, refused past what is left. */
export function spendMovement(
  budget: TurnBudget,
  cost: number,
  speed: number,
): { ok: true; budget: TurnBudget } | { ok: false; error: string } {
  const left = movementLeft(budget, speed);
  if (cost > left + EPSILON) {
    return { ok: false, error: `O movimento custa ${formatMeters(cost)} e restam ${formatMeters(left)} neste turno.` };
  }
  return { ok: true, budget: { ...budget, movementUsed: budget.movementUsed + cost } };
}
