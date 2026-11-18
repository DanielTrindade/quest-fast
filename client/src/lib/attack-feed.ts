import type { AttackTarget, RollPayload } from '@quest-fast/shared';
import { ABILITY_LABELS } from './5e';

/**
 * How an attack reads in the feed. The server already left out what this
 * reader may not see (a monster's AC, the dice of a monster's attack); the
 * text only says what came.
 */

/** "Kaelen atacou Goblin 2 com Espada longa", "Goblin xamã usou Raio de fogo em Elara". */
export function attackHeadline(payload: RollPayload): string {
  const who = payload.characterName ?? '';
  const weapon = payload.attackName ?? '';
  if (payload.damageOf) return `Dano de ${who} com ${weapon}`;
  if (payload.save) return payload.target ? `${who} usou ${weapon} em ${payload.target.name}` : `${who} usou ${weapon}`;
  return payload.target ? `${who} atacou ${payload.target.name} com ${weapon}` : `${who} atacou com ${weapon}`;
}

/**
 * "Passou (17)", "Falhou (8)", "Falhou sem rolar"; only "Passou" or "Falhou"
 * when the reader may not see the numbers (a monster's save, for a player).
 */
export function saveOutcome(save: NonNullable<AttackTarget['save']>): string {
  const word = save.success ? 'Passou' : 'Falhou';
  if ('outright' in save && save.outright) return 'Falhou sem rolar';
  return 'total' in save ? `${word} (${save.total})` : word;
}

/** "Acertou (CA 15)", "Errou", "CD 13 de Destreza · Falhou (8)"; nothing without a target or DC. */
export function attackOutcome(payload: RollPayload): string | null {
  if (payload.save) {
    const dc = `CD ${payload.save.dc} de ${ABILITY_LABELS[payload.save.ability]}`;
    const call = isSaveCall(payload) ? `${dc}, sem dano` : dc;
    return payload.target?.save ? `${call} · ${saveOutcome(payload.target.save)}` : call;
  }
  if (payload.damageOf || !payload.target) return null;
  const ac = payload.target.ac === undefined ? '' : ` (CA ${payload.target.ac})`;
  return `${payload.target.hit ? 'Acertou' : 'Errou'}${ac}`;
}

/**
 * "14 cortante (2d6+2)", or "14 cortante" when the dice were left out. The
 * damage type is written lower-case, as a sentence reads it.
 */
export function damageText(payload: RollPayload): string | null {
  const { damage } = payload;
  if (!damage) return null;
  const type = damage.damageType ? ` ${damage.damageType.toLowerCase()}` : ' de dano';
  const dice = damage.expression ? ` (${damage.expression})` : '';
  return `${damage.total}${type}${dice}`;
}

/** A save without damage (Graxa): nothing was rolled, the target makes the save. */
export function isSaveCall(payload: RollPayload): boolean {
  return !!payload.save && !payload.damage && !payload.damageOf;
}

/** Whether the attack roll itself (the d20) is there to show. */
export function showsAttackRoll(payload: RollPayload): boolean {
  return !payload.save && !payload.damageOf && !payload.redacted;
}

/** Without a target, whoever attacked may still roll the damage, once. */
export function canRollDamage(payload: RollPayload): boolean {
  return !!payload.damageRollable && !payload.damageRolled;
}
