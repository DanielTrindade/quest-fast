import type { AttackTarget, RollPayload } from '@quest-fast/shared';
import { ABILITY_LABELS } from './5e';

/**
 * How an attack reads in the feed. The server already left out what this
 * reader may not see (a monster's AC, the dice of a monster's attack); the
 * text only says what came.
 */

/**
 * Who a save row reached: `targets` on an area, `target` on one stored
 * before the area existed.
 */
export function saveTargets(payload: RollPayload): AttackTarget[] {
  if (payload.targets) return payload.targets;
  return payload.save && payload.target ? [payload.target] : [];
}

/** "Goblin 1", "Goblin 1 e Kaelen", "Goblin 1, Goblin 2 e Kaelen". */
function names(targets: AttackTarget[]): string {
  const all = targets.map((target) => target.name);
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} e ${all.at(-1)}`;
}

/**
 * "Kaelen atacou Goblin 2 com Espada longa", "Goblin xamã usou Raio de fogo
 * em Elara", "Elara usou Bola de Fogo em 4 alvos".
 */
export function attackHeadline(payload: RollPayload): string {
  const who = payload.characterName ?? '';
  const weapon = payload.attackName ?? '';
  if (payload.damageOf) return `Dano de ${who} com ${weapon}`;
  if (payload.save) {
    const reached = saveTargets(payload);
    if (reached.length === 0) return `${who} usou ${weapon}`;
    return `${who} usou ${weapon} em ${reached.length > 3 ? `${reached.length} alvos` : names(reached)}`;
  }
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

/**
 * "Acertou (CA 15)", "Errou", "CD 13 de Destreza · Falhou (8)"; nothing
 * without a target or DC. An area tells each target apart (`targetOutcome`).
 */
export function attackOutcome(payload: RollPayload): string | null {
  if (payload.save) {
    const dc = `CD ${payload.save.dc} de ${ABILITY_LABELS[payload.save.ability]}`;
    const call = isSaveCall(payload) ? `${dc}, sem dano` : dc;
    const [only, ...others] = saveTargets(payload);
    return only?.save && others.length === 0 ? `${call} · ${saveOutcome(only.save)}` : call;
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
  // The situational modifier's dice after the attack's own: "(2d8+3 +2d6)".
  const rolled = [damage.expression, damage.bonus?.expression].filter(Boolean).join(' ');
  const dice = rolled ? ` (${rolled})` : '';
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

/** One target of an area: "Goblin 1: Falhou (8), 28 de dano", "Goblin 2: Passou, sem dano". */
export function targetOutcome(target: AttackTarget): string {
  const save = target.save ? saveOutcome(target.save) : 'Atingido';
  if (target.damage === undefined) return `${target.name}: ${save}`;
  return `${target.name}: ${save}, ${target.damage === 0 ? 'sem dano' : `${target.damage} de dano`}`;
}
