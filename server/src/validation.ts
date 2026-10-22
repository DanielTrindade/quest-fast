import { CHARACTER_LIMITS as L, parseDiceExpression, type Attack } from '@quest-fast/shared';

/**
 * Request parsing shared by the routes. A parser throws `InputError` through
 * `fail`; the route turns it into a 422 with `withInput`. Error messages are
 * player-facing, so they stay in Portuguese.
 */
export class InputError extends Error {}

export function fail(message: string): never {
  throw new InputError(message);
}

export function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function shortText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean.length > 0 && clean.length <= limit ? clean : undefined;
}

/** Sheets and statblocks share the attack rules; only the count differs. */
export function parseAttack(value: unknown): Attack | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const attack = value as Record<string, unknown>;
  const name = shortText(attack.name, L.name);
  const bonus = boundedInteger(attack.bonus, -L.attackBonus, L.attackBonus);
  const damage = shortText(attack.damage, L.damage);
  if (!name || bonus === undefined || !damage) return undefined;
  // Damage is a dice expression: catching a typo now beats a wrong roll later.
  if (!parseDiceExpression(damage)) return undefined;
  const damageType = attack.damageType === undefined ? '' : attack.damageType;
  const notes = attack.notes === undefined ? '' : attack.notes;
  if (typeof damageType !== 'string' || damageType.length > L.damageType) return undefined;
  if (typeof notes !== 'string' || notes.length > L.attackNotes) return undefined;
  return { name, bonus, damage, damageType: damageType.trim(), notes: notes.trim() };
}

export async function withInput<T>(run: () => T | Promise<T>): Promise<T | { inputError: string }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof InputError) return { inputError: error.message };
    throw error;
  }
}

export function isInputError(value: unknown): value is { inputError: string } {
  return typeof value === 'object' && value !== null && 'inputError' in value;
}
