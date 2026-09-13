/**
 * Client-side validation of a character sheet. The server stays authoritative
 * and validates the raw request again; this module exists so the editor can
 * show an error next to the field before a round trip. Same bounds as the
 * server, same visible language (pt-BR).
 */

import { ABILITIES } from './modifiers.ts';
import { parseDiceExpression } from './dice.ts';
import type { CharacterInput } from './api.ts';

/** Mirrors the server's attack bonus bound. */
const ATTACK_BONUS_LIMIT = 20;

export type CharacterFieldErrors = Partial<
  Record<'name' | 'race' | 'class' | 'level' | 'hp' | 'ac' | 'abilityScores' | 'attacks', string>
>;

/** Empty when the sheet is valid; each key maps to a player-facing message. */
export function validateCharacterInput(input: CharacterInput): CharacterFieldErrors {
  const errors: CharacterFieldErrors = {};

  if (input.name.trim().length === 0) errors.name = 'Informe o nome do personagem.';
  if (input.race.trim().length === 0) errors.race = 'Informe a raça.';
  if (input.class.trim().length === 0) errors.class = 'Informe a classe.';

  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 20) {
    errors.level = 'Nível deve ser um número entre 1 e 20.';
  }
  if (!Number.isInteger(input.hp) || input.hp < 1 || input.hp > 999) {
    errors.hp = 'HP deve ser um número entre 1 e 999.';
  }
  if (!Number.isInteger(input.ac) || input.ac < 0 || input.ac > 40) {
    errors.ac = 'CA deve ser um número entre 0 e 40.';
  }

  if (
    ABILITIES.some(
      (ability) =>
        !Number.isInteger(input.abilityScores[ability]) ||
        input.abilityScores[ability] < 1 ||
        input.abilityScores[ability] > 30,
    )
  ) {
    errors.abilityScores = 'Atributos devem ser números entre 1 e 30.';
  }

  if (
    input.attacks.some(
      (attack) => attack.name.trim().length === 0 || !parseDiceExpression(attack.damage),
    )
  ) {
    errors.attacks = 'Cada ataque precisa de nome e de dano como expressão (ex.: 1d8+3).';
  } else if (
    input.attacks.some(
      (attack) => !Number.isInteger(attack.bonus) || Math.abs(attack.bonus) > ATTACK_BONUS_LIMIT,
    )
  ) {
    errors.attacks = `Bônus de ataque deve ser um número entre -${ATTACK_BONUS_LIMIT} e ${ATTACK_BONUS_LIMIT}.`;
  }

  return errors;
}