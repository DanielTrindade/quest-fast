/**
 * The situational modifier a player adds when rolling: Bênção (+1d4),
 * Perdição (-1d4), a +2 the master grants, Marca do Caçador (+1d6 on the
 * damage). The client sends its text, never its result: the server parses,
 * checks the limits against the whole roll and rolls it apart, so the feed
 * shows its dice next to the roll's.
 *
 * Unlike a free expression, a modifier may subtract dice: a negative die has
 * no meaning as a roll of its own, but Perdição takes one away from a test.
 */
import { DICE_COUNT_LIMIT, DICE_MODIFIER_LIMIT, DICE_SIDES_LIMIT, DICE_TERMS_LIMIT, rollDice, type DieResult, type RollMode, type RollResult } from './dice.ts';

/** One `NdM` term of a modifier, added or subtracted. */
export type BonusGroup = { count: number; sides: number; sign: 1 | -1 };

export type ParsedBonus = { groups: BonusGroup[]; modifier: number };

/** A die of the modifier; a subtracted one counts against the total. */
export type BonusDie = DieResult & { negative?: true };

/** The modifier as rolled: added to the roll's total, shown apart in the feed. */
export type BonusRoll = { expression: string; dice: BonusDie[]; modifier: number; total: number };

/** What a request may carry: on the d20 (hit, tests, saves, initiative) and on the damage. */
export type RollBonusInput = { roll?: string; damage?: string };

/** A modifier is short: a few terms at the table, never a paragraph. */
export const ROLL_BONUS_LENGTH = 40;

// The first term may go without a sign (`1d4-1`); the others need one.
const TERM = /\s*([+-])?\s*(\d+)(?:[dD](\d+))?/y;
const TRAILING_SPACE = /\s*$/y;

/**
 * Parses a sum of terms with signs: `+1d4`, `-1d4`, `+2`, `1d4-1`. Each
 * term is checked against the dice limits here; the whole roll is checked
 * again by whoever adds it (`bonusFits`). `undefined` when the text cannot
 * be a modifier.
 */
export function parseRollBonus(input: string): ParsedBonus | undefined {
  if (input.length > ROLL_BONUS_LENGTH) return undefined;
  const groups: BonusGroup[] = [];
  let modifier = 0;
  let terms = 0;
  let position = 0;
  for (;;) {
    TERM.lastIndex = position;
    const term = TERM.exec(input);
    if (!term) break;
    const [, sign, amount, sides] = term;
    // Only the first term may go without its sign.
    if (sign === undefined && terms > 0) break;
    position = TERM.lastIndex;
    if (++terms > DICE_TERMS_LIMIT) return undefined;
    const negative = sign === '-';
    if (sides === undefined) {
      modifier += negative ? -Number(amount) : Number(amount);
    } else {
      groups.push({ count: Number(amount), sides: Number(sides), sign: negative ? -1 : 1 });
    }
  }
  TRAILING_SPACE.lastIndex = position;
  TRAILING_SPACE.exec(input);
  if (terms === 0 || TRAILING_SPACE.lastIndex !== input.length) return undefined;
  if (groups.some((group) => group.count < 1 || group.sides < 2 || group.sides > DICE_SIDES_LIMIT)) return undefined;
  if (diceIn(groups) > DICE_COUNT_LIMIT || Math.abs(modifier) > DICE_MODIFIER_LIMIT) return undefined;
  return { groups, modifier };
}

function diceIn(groups: readonly { count: number }[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

/**
 * Whether the roll with its modifier stays within the limits of one
 * expression: the dice of both together (doubled on a critical, as the
 * modifier's damage dice double too) and their summed constant.
 */
export function bonusFits(base: { dice: number; modifier: number }, bonus: ParsedBonus, critical = false): boolean {
  const factor = critical ? 2 : 1;
  return (base.dice + diceIn(bonus.groups)) * factor <= DICE_COUNT_LIMIT
    && Math.abs(base.modifier + bonus.modifier) <= DICE_MODIFIER_LIMIT;
}

/** `+1d4`, `-1d4+2`, `+2d6` (a critical's doubled dice): the modifier as rolled. */
function bonusExpression(groups: readonly BonusGroup[], modifier: number): string {
  const terms = groups.map((group) => `${group.sign < 0 ? '-' : '+'}${group.count}d${group.sides}`);
  if (modifier !== 0) terms.push(`${modifier < 0 ? '-' : '+'}${Math.abs(modifier)}`);
  return terms.join('');
}

/** Rolls the modifier; on a critical its dice double, its constant does not. */
export function rollBonus(bonus: ParsedBonus, { critical = false } = {}, random: () => number = Math.random): BonusRoll {
  const groups = bonus.groups.map((group) => ({ ...group, count: critical ? group.count * 2 : group.count }));
  const dice: BonusDie[] = [];
  for (const group of groups) {
    for (let i = 0; i < group.count; i++) {
      const value = Math.floor(random() * group.sides) + 1;
      dice.push(group.sign < 0 ? { value, sides: group.sides, negative: true } : { value, sides: group.sides });
    }
  }
  const total = dice.reduce((sum, die) => sum + (die.negative ? -die.value : die.value), 0) + bonus.modifier;
  return { expression: bonusExpression(groups, bonus.modifier), dice, modifier: bonus.modifier, total };
}

/**
 * A d20 test (`1d20 + modifier`) with the situational modifier, if any. The
 * natural 1 or 20 is the d20's alone; the total takes the modifier, and may
 * drop below 0.
 */
export function rollTest(
  modifier: number,
  mode: RollMode = 'normal',
  bonus?: ParsedBonus,
  random: () => number = Math.random,
): RollResult & { bonus?: BonusRoll } {
  const result = rollDice(`1d20${modifier >= 0 ? '+' : ''}${modifier}`, mode, random)!;
  if (!bonus) return result;
  const rolled = rollBonus(bonus, {}, random);
  return { ...result, total: result.total + rolled.total, bonus: rolled };
}

const INVALID = 'Modificador inválido. Use dado e número com sinal, como +1d4, -1d4 ou +2.';

/**
 * The modifiers a request carries, read once before anything is rolled or
 * spent. Absent or empty fields add nothing; anything else that is not a
 * modifier refuses the whole request.
 */
export function readRollBonus(value: unknown): { roll?: ParsedBonus; damage?: ParsedBonus } | { error: string } {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object') return { error: INVALID };
  const read: { roll?: ParsedBonus; damage?: ParsedBonus } = {};
  for (const key of ['roll', 'damage'] as const) {
    const text = (value as Record<string, unknown>)[key];
    if (text === undefined || text === null) continue;
    if (typeof text !== 'string') return { error: INVALID };
    if (text.trim() === '') continue;
    const parsed = parseRollBonus(text.trim());
    if (!parsed) return { error: INVALID };
    read[key] = parsed;
  }
  return read;
}

/** The message for a roll whose modifier takes it past the dice limits. */
export const BONUS_TOO_BIG = `Com o modificador, a rolagem passa do limite de ${DICE_COUNT_LIMIT} dados ou de ${DICE_MODIFIER_LIMIT} no número.`;
