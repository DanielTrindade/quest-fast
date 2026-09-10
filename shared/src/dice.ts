/**
 * Dice expressions and rolling, pure and shared: the client uses the same
 * parser for preview, the server rolls for real. The client is never the
 * source of truth — the server decides the result, this module only says how.
 */

export type ParsedDice = {
  count: number;
  sides: number;
  modifier: number;
};

// No space around `d`: `2 d6` is a typo, while `1d20 + 4` (space after the
// sign) is common enough to accept.
const EXPRESSION = /^\s*(\d+)[dD](\d+)\s*([+-]\s*\d+)?\s*$/;

/** Bounds keep a typo from flooding the table with dice or a huge modifier. */
export const DICE_COUNT_LIMIT = 100;
export const DICE_SIDES_LIMIT = 100;
export const DICE_MODIFIER_LIMIT = 100;

/**
 * Parses `NdM` with an optional signed modifier, or returns `undefined` when
 * the input cannot be a roll. The caller decides the message to show.
 */
export function parseDiceExpression(input: string): ParsedDice | undefined {
  const match = EXPRESSION.exec(input);
  if (!match) return undefined;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3].replace(/\s+/g, '')) : 0;
  if (count < 1 || count > DICE_COUNT_LIMIT) return undefined;
  if (sides < 2 || sides > DICE_SIDES_LIMIT) return undefined;
  if (modifier < -DICE_MODIFIER_LIMIT || modifier > DICE_MODIFIER_LIMIT) return undefined;
  return { count, sides, modifier };
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

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
  if (mode !== 'normal' && (parsed.count !== 1 || parsed.sides !== 20)) return undefined;

  const { count, sides, modifier } = parsed;
  const dice: DieResult[] = [];

  if (mode === 'normal') {
    for (let i = 0; i < count; i++) dice.push({ value: rollDie(sides, random), sides });
  } else {
    const first = rollDie(sides, random);
    const second = rollDie(sides, random);
    const keep = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
    // A tie would otherwise mark both dice as kept; exactly one survives.
    let kept = false;
    for (const value of [first, second]) {
      if (!kept && value === keep) {
        dice.push({ value, sides });
        kept = true;
      } else {
        dice.push({ value, sides, discarded: true });
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