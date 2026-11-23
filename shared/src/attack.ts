/**
 * Attack rules, pure and shared: the server rolls for real, the client only
 * reads the result. An attack is a d20 test against the target's AC and, on a
 * hit, a damage roll whose dice double on a critical.
 */
import { DICE_COUNT_LIMIT, parseDiceExpression, rollDice, type DieResult, type RollMode, type RollResult } from './dice.ts';
import type { AbilityScores, Attack } from './api.ts';
import { bonusFits, rollBonus, rollTest, type BonusRoll, type ParsedBonus } from './roll-bonus.ts';
import type { ActiveCondition } from './combat.ts';
import { ABILITIES, abilityModifier, type Ability } from './modifiers.ts';
import { defaultAttackCost, isAttackCost } from './turn.ts';

export type AttackHit = RollResult & {
  /** A natural 20 on the kept d20: always hits and doubles the damage dice. */
  critical: boolean;
  /** The situational modifier, in the total; the natural stays the d20's. */
  bonus?: BonusRoll;
};

/**
 * The attack roll: `1d20 + bonus`, under advantage or disadvantage when
 * asked, plus the situational modifier (Bênção) when there is one.
 */
export function rollAttackHit(bonus: number, mode: RollMode = 'normal', random: () => number = Math.random, extra?: ParsedBonus): AttackHit {
  const result = rollTest(bonus, mode, extra, random);
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
  /** With the situational modifier, never below 0. */
  total: number;
  /** The situational modifier (Marca do Caçador), its dice doubled on a critical too. */
  bonus?: BonusRoll;
};

/**
 * Rolls the damage of an attack, with the situational modifier when there is
 * one: on a critical every die doubles, the modifier's too. Damage never
 * drops below 0, even when a negative modifier outweighs the dice.
 * `undefined` when the expression is invalid or the dice, doubled or with the
 * modifier, would exceed the limit.
 */
export function rollDamage(expression: string, critical: boolean, random: () => number = Math.random, extra?: ParsedBonus): DamageDice | undefined {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return undefined;
  if (extra && !bonusFits({ dice: parsed.groups.reduce((sum, group) => sum + group.count, 0), modifier: parsed.modifier }, extra, critical)) return undefined;
  const rolled = critical ? criticalExpression(expression) : expression;
  if (rolled === undefined) return undefined;
  const result = rollDice(rolled, 'normal', random);
  if (!result) return undefined;
  const bonus = extra ? rollBonus(extra, { critical }, random) : undefined;
  const total = Math.max(0, result.total + (bonus?.total ?? 0));
  return { expression: result.expression, dice: result.dice, modifier: result.modifier, total, ...(bonus ? { bonus } : {}) };
}

/**
 * Whether a row deals damage. An attack roll always does; a save may only
 * impose its effect (Graxa, Fogo das Fadas), with the damage left empty.
 */
export function hasDamage(attack: { damage: string }): boolean {
  return attack.damage.trim().length > 0;
}

/**
 * The roll of a save without damage: nothing was rolled. The feed shows the
 * DC and the target, never a total.
 */
export function noRoll(): RollResult {
  return { expression: '', dice: [], modifier: 0, total: 0, mode: 'normal' };
}

/** Damage halved by a successful save, rounded down as the rule says. */
export function halfDamage(amount: number): number {
  return Math.floor(amount / 2);
}

/** An attack as some older row stored it: without a kind, a damage type, notes, a range or a cost. */
type Optional = 'kind' | 'damageType' | 'notes' | 'range' | 'cost' | 'onSave';
// Distributes over the kinds, so each keeps its own fields.
export type StoredAttack = Attack extends infer Row ? (Row extends Attack ? Omit<Row, Optional> & Partial<Pick<Row, Optional & keyof Row>> : never) : never;

/**
 * A stored attack with every field filled: rows stored before the save DC
 * have no kind (attack rolls), rows stored before the cost read as the
 * default of their kind, and rows stored before the range have none.
 */
export function storedAttack(stored: StoredAttack): Attack {
  const kind = stored.kind ?? 'attack';
  return {
    ...stored,
    kind,
    damageType: stored.damageType ?? '',
    notes: stored.notes ?? '',
    range: stored.range ?? '',
    cost: isAttackCost(stored.cost) ? stored.cost : defaultAttackCost(kind),
    ...(kind === 'save' ? { onSave: 'onSave' in stored && isSaveEffect(stored.onSave) ? stored.onSave : 'half' } : {}),
  } as Attack;
}

// --- Saving throws against a row --------------------------------------------------

/** What a target that passes the save takes: half the damage (Bola de Fogo) or none (Chama Sagrada). */
export const SAVE_EFFECTS = ['half', 'none'] as const;
export type SaveEffect = (typeof SAVE_EFFECTS)[number];

export function isSaveEffect(value: unknown): value is SaveEffect {
  return typeof value === 'string' && (SAVE_EFFECTS as readonly string[]).includes(value);
}

/** The saves a creature is proficient in, with the book's bonus; the others use the ability modifier. */
export type SaveBonuses = Partial<Record<Ability, number>>;

/** A creature's six save modifiers: the book's bonus where it has one, the ability modifier otherwise. */
export function saveModifiers(scores: AbilityScores, bonuses: SaveBonuses): Record<Ability, number> {
  return Object.fromEntries(
    ABILITIES.map((ability) => [ability, bonuses[ability] ?? abilityModifier(scores[ability]) ?? 0]),
  ) as Record<Ability, number>;
}

/** Paralyzed, Petrified, Stunned and Unconscious fail Strength and Dexterity saves (2024). */
const FAILS_STR_DEX = new Set(['paralyzed', 'petrified', 'stunned', 'unconscious']);

/**
 * Whether the save fails without a roll. A creature at 0 hit points is
 * Unconscious even when the condition was not marked.
 */
export function failsSaveOutright(ability: Ability, conditions: readonly ActiveCondition[], down: boolean): boolean {
  if (ability !== 'strength' && ability !== 'dexterity') return false;
  return down || conditions.some((active) => FAILS_STR_DEX.has(active.condition));
}

/**
 * What the target's conditions do to a save that is rolled (2024): Exhaustion
 * takes 2 per level off every D20 Test, and Restrained gives disadvantage on
 * Dexterity saves. Failing outright (`failsSaveOutright`) comes first.
 */
export function saveConditions(ability: Ability, conditions: readonly ActiveCondition[]): { mode: RollMode; penalty: number } {
  const exhaustion = conditions.find((active) => active.condition === 'exhaustion')?.level ?? 0;
  const restrained = ability === 'dexterity' && conditions.some((active) => active.condition === 'restrained');
  return { mode: restrained ? 'disadvantage' : 'normal', penalty: 2 * exhaustion };
}

/**
 * A saving throw the server rolled. `modifier` already takes the penalty
 * off; `d20` is the face kept, and under disadvantage `rolls` keeps both.
 * `outright`: failed without a roll, so the die is absent.
 */
export type SaveRoll =
  | {
    outright?: undefined;
    d20: number;
    modifier: number;
    total: number;
    success: boolean;
    mode?: Exclude<RollMode, 'normal'>;
    rolls?: [number, number];
    /** Exhaustion: what came off the modifier. */
    penalty?: number;
  }
  | { outright: true; success: false };

/**
 * `1d20 + modifier` against the DC, under what the target's conditions
 * impose: it passes on a total equal or above it. A natural 20 or 1 decides
 * nothing here: in 2024 only an attack roll has that rule.
 */
export function rollSave(
  modifier: number,
  dc: number,
  outright: boolean,
  random: () => number = Math.random,
  { mode, penalty }: { mode: RollMode; penalty: number } = { mode: 'normal', penalty: 0 },
): SaveRoll {
  if (outright) return { outright: true, success: false };
  const applied = modifier - penalty;
  const result = rollDice(`1d20${applied >= 0 ? '+' : ''}${applied}`, mode, random)!;
  const kept = result.dice.find((die) => !die.discarded) ?? result.dice[0]!;
  return {
    d20: kept.value,
    modifier: applied,
    total: result.total,
    success: result.total >= dc,
    ...(mode === 'normal' ? {} : { mode, rolls: [result.dice[0]!.value, result.dice[1]!.value] as [number, number] }),
    ...(penalty > 0 ? { penalty } : {}),
  };
}

/** The damage a target takes after its save: all on a failure; half, or none, on a success. */
export function damageAfterSave(amount: number, success: boolean, effect: SaveEffect): number {
  if (!success) return amount;
  return effect === 'half' ? halfDamage(amount) : 0;
}
