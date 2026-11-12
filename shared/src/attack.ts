/**
 * Attack rules, pure and shared: the server rolls for real, the client only
 * reads the result. An attack is a d20 test against the target's AC and, on a
 * hit, a damage roll whose dice double on a critical.
 */
import { DICE_COUNT_LIMIT, parseDiceExpression, rollDice, type DieResult, type RollMode, type RollResult } from './dice.ts';

export type AttackHit = RollResult & {
  /** A natural 20 on the kept d20: always hits and doubles the damage dice. */
  critical: boolean;
};

/** The attack roll: `1d20 + bonus`, under advantage or disadvantage when asked. */
export function rollAttackHit(bonus: number, mode: RollMode = 'normal', random: () => number = Math.random): AttackHit {
  const result = rollDice(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, mode, random)!;
  return { ...result, critical: result.natural === 20 };
}

/**
 * D&D 2024 "D20 Test": the attack hits when the total equals or exceeds the
 * AC. A natural 20 always hits and a natural 1 always misses, whatever the
 * bonus.
 */
export function isHit(roll: Pick<RollResult, 'total' | 'natural'>, ac: number): boolean {
  if (roll.natural === 20) return true;
  if (roll.natural === 1) return false;
  return roll.total >= ac;
}

/**
 * The damage of a critical hit: every die is rolled twice, the modifier only
 * once (`2d6+3` becomes `4d6+3`). `undefined` when the expression is invalid
 * or the doubled dice would exceed the dice limit; dropping dice silently
 * would roll less than the rule asks.
 */
export function criticalExpression(expression: string): string | undefined {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return undefined;
  const groups = parsed.groups.map((group) => ({ ...group, count: group.count * 2 }));
  if (groups.reduce((sum, group) => sum + group.count, 0) > DICE_COUNT_LIMIT) return undefined;
  const dice = groups.map((group) => `${group.count}d${group.sides}`).join('+');
  const { modifier } = parsed;
  return modifier === 0 ? dice : `${dice}${modifier > 0 ? '+' : ''}${modifier}`;
}

/** A damage roll, without the damage type the attack adds. */
export type DamageDice = {
  /** As rolled: already doubled on a critical. */
  expression: string;
  dice: DieResult[];
  modifier: number;
  total: number;
};

/**
 * Rolls the damage of an attack. Damage never drops below 0, even when a
 * negative modifier outweighs the dice. `undefined` when the expression is
 * invalid or its critical would exceed the dice limit.
 */
export function rollDamage(expression: string, critical: boolean, random: () => number = Math.random): DamageDice | undefined {
  const rolled = critical ? criticalExpression(expression) : expression;
  if (rolled === undefined) return undefined;
  const result = rollDice(rolled, 'normal', random);
  if (!result) return undefined;
  return { expression: result.expression, dice: result.dice, modifier: result.modifier, total: Math.max(0, result.total) };
}

/** Damage halved by a successful save, rounded down as the rule says. */
export function halfDamage(amount: number): number {
  return Math.floor(amount / 2);
}
