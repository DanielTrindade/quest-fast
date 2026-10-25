/**
 * Dice expressions and rolling, pure and shared: the client uses the same
 * parser for preview, the server rolls for real. The client is never the
 * source of truth — the server decides the result, this module only says how.
 */

/** One `NdM` term of an expression: `count` dice of `sides` faces. */
export type DiceGroup = {
  count: number;
  sides: number;
};

export type ParsedDice = {
  /** In the order written; `1d8+3+1d6` has two groups. */
  groups: DiceGroup[];
  /** Every constant term summed: `1d8+3+1d6-1` has modifier 2. */
  modifier: number;
};

// A term is `NdM` or a whole number. No space around `d`: `2 d6` is a typo,
// while `1d20 + 4` (space around the sign) is common enough to accept.
const FIRST_TERM = /^\s*(\d+)[dD](\d+)/y;
const NEXT_TERM = /\s*([+-])\s*(\d+)(?:[dD](\d+))?/y;
const TRAILING_SPACE = /\s*$/y;

/** Bounds keep a typo from flooding the table with dice or a huge modifier. */
export const DICE_COUNT_LIMIT = 100;
export const DICE_SIDES_LIMIT = 100;
export const DICE_MODIFIER_LIMIT = 100;
/** Terms (dice groups and constants) in one expression. */
export const DICE_TERMS_LIMIT = 10;

/**
 * Parses a sum of terms that starts with a dice group: `1d20`, `1d8+3`,
 * `1d8 + 3 + 1d6`. Constants may be added or subtracted; dice groups are only
 * added, since a negative die has no meaning at the table. Returns `undefined`
 * when the input cannot be a roll; the caller decides the message to show.
 *
 * The limits apply to the whole expression: the dice of every group together,
 * and the summed modifier, so splitting a roll into terms cannot dodge them.
 */
export function parseDiceExpression(input: string): ParsedDice | undefined {
  FIRST_TERM.lastIndex = 0;
  const first = FIRST_TERM.exec(input);
  if (!first) return undefined;
  const groups: DiceGroup[] = [{ count: Number(first[1]), sides: Number(first[2]) }];
  let modifier = 0;
  let terms = 1;
  let position = FIRST_TERM.lastIndex;

  for (;;) {
    NEXT_TERM.lastIndex = position;
    const term = NEXT_TERM.exec(input);
    if (!term) break;
    position = NEXT_TERM.lastIndex;
    if (++terms > DICE_TERMS_LIMIT) return undefined;
    const [, sign, amount, sides] = term;
    if (sides === undefined) {
      const value = Number(amount);
      if (value > DICE_MODIFIER_LIMIT) return undefined;
      modifier += sign === '-' ? -value : value;
    } else {
      if (sign === '-') return undefined;
      groups.push({ count: Number(amount), sides: Number(sides) });
    }
  }

  TRAILING_SPACE.lastIndex = position;
  TRAILING_SPACE.exec(input);
  if (TRAILING_SPACE.lastIndex !== input.length) return undefined;

  if (groups.some((group) => group.count < 1 || group.sides < 2 || group.sides > DICE_SIDES_LIMIT)) return undefined;
  if (groups.reduce((sum, group) => sum + group.count, 0) > DICE_COUNT_LIMIT) return undefined;
  if (modifier < -DICE_MODIFIER_LIMIT || modifier > DICE_MODIFIER_LIMIT) return undefined;
  return { groups, modifier };
}

/**
 * Whether the expression is a single d20 test (`1d20`, `1d20+5`): the only
 * kind of roll advantage and disadvantage apply to.
 */
export function isSingleD20(parsed: ParsedDice): boolean {
  const [group, ...rest] = parsed.groups;
  return rest.length === 0 && group!.count === 1 && group!.sides === 20;
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

const ROLL_MODES: readonly RollMode[] = ['normal', 'advantage', 'disadvantage'];

export function isRollMode(value: unknown): value is RollMode {
  return typeof value === 'string' && (ROLL_MODES as readonly string[]).includes(value);
}

export type DieResult = {
  value: number;
  sides: number;
  /** The d20 left out of the total: present only under advantage/disadvantage. */
  discarded?: boolean;
};

export type RollResult = {
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: RollMode;
  /** A d20 result of exactly 1 or 20, from the kept die when there is one. */
  natural?: 1 | 20;
};

function rollDie(sides: number, random: () => number): number {
  return Math.floor(random() * sides) + 1;
}

/**
 * Rolls the expression and computes the total. `random` is injectable for
 * deterministic tests; production uses the default `Math.random`.
 *
 * Returns `undefined` when the expression is invalid or the mode does not
 * apply — advantage and disadvantage only make sense on a single d20.
 */
export function rollDice(input: string, mode: RollMode = 'normal', random: () => number = Math.random): RollResult | undefined {
  const parsed = parseDiceExpression(input);
  if (!parsed) return undefined;
  if (mode !== 'normal' && !isSingleD20(parsed)) return undefined;

  const { groups, modifier } = parsed;
  const dice: DieResult[] = [];

  if (mode === 'normal') {
    for (const { count, sides } of groups) {
      for (let i = 0; i < count; i++) dice.push({ value: rollDie(sides, random), sides });
    }
  } else {
    const first = rollDie(20, random);
    const second = rollDie(20, random);
    const keep = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
    // A tie would otherwise mark both dice as kept; exactly one survives.
    let kept = false;
    for (const value of [first, second]) {
      if (!kept && value === keep) {
        dice.push({ value, sides: 20 });
        kept = true;
      } else {
        dice.push({ value, sides: 20, discarded: true });
      }
    }
  }

  // Discarded dice stay out of the total: advantage keeps the higher only.
  const total = dice.reduce((sum, die) => sum + (die.discarded ? 0 : die.value), 0) + modifier;
  const kept = dice.find((die) => !die.discarded) ?? dice[0]!;
  const natural: 1 | 20 | undefined =
    kept.sides === 20 ? (kept.value === 20 ? 20 : kept.value === 1 ? 1 : undefined) : undefined;

  return { expression: input, dice, modifier, total, mode, natural };
}