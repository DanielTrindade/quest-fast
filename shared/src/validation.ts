/**
 * Client-side validation of a character sheet. The server stays authoritative
 * and validates the raw request again; this module exists so the editor can
 * show an error next to the field before a round trip. Same bounds as the
 * server (`CHARACTER_LIMITS`), same visible language (pt-BR).
 */

import { ABILITIES } from './modifiers.ts';
import { parseDiceExpression } from './dice.ts';
import { CHARACTER_LIMITS as L, COINS, SPELL_SLOT_CAPS, isSpeed } from './sheet.ts';
import type { CharacterInput } from './api.ts';

export type CharacterFieldErrors = Partial<
  Record<
    | 'name'
    | 'race'
    | 'class'
    | 'subclass'
    | 'background'
    | 'alignment'
    | 'level'
    | 'experience'
    | 'hp'
    | 'ac'
    | 'speed'
    | 'initiativeBonus'
    | 'passivePerceptionBonus'
    | 'abilityScores'
    | 'expertise'
    | 'weaponProficiencies'
    | 'toolProficiencies'
    | 'attacks'
    | 'features'
    | 'speciesTraits'
    | 'feats'
    | 'spellBonus'
    | 'spellSlotTotals'
    | 'spells'
    | 'appearance'
    | 'description'
    | 'languages'
    | 'equipment'
    | 'attunedItems'
    | 'coins',
    string
  >
>;

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function tooLong(value: string | undefined, limit: number) {
  return (value ?? '').length > limit;
}

function badList(items: readonly string[] | undefined) {
  return (items ?? []).length > L.listItems || (items ?? []).some((item) => item.length > L.listItem);
}

/** Empty when the sheet is valid; each key maps to a player-facing message. */
export function validateCharacterInput(input: CharacterInput): CharacterFieldErrors {
  const errors: CharacterFieldErrors = {};

  if (input.name.trim().length === 0) errors.name = 'Informe o nome do personagem.';
  else if (input.name.length > L.name) errors.name = `O nome deve ter até ${L.name} caracteres.`;
  if (input.race.trim().length === 0) errors.race = 'Informe a espécie.';
  if (input.class.trim().length === 0) errors.class = 'Informe a classe.';
  if (tooLong(input.subclass, L.shortText)) errors.subclass = `A subclasse deve ter até ${L.shortText} caracteres.`;
  if (tooLong(input.background, L.shortText)) errors.background = `O antecedente deve ter até ${L.shortText} caracteres.`;
  if (tooLong(input.alignment, L.shortText)) errors.alignment = `O alinhamento deve ter até ${L.shortText} caracteres.`;

  if (!inRange(input.level, L.level.min, L.level.max)) {
    errors.level = `Nível deve ser um número entre ${L.level.min} e ${L.level.max}.`;
  }
  if (input.experience !== undefined && !inRange(input.experience, L.experience.min, L.experience.max)) {
    errors.experience = `XP deve ser um número entre ${L.experience.min} e ${L.experience.max}.`;
  }
  if (!inRange(input.hp, L.hp.min, L.hp.max)) {
    errors.hp = `PV máximo deve ser um número entre ${L.hp.min} e ${L.hp.max}.`;
  }
  if (!inRange(input.ac, L.ac.min, L.ac.max)) {
    errors.ac = `CA deve ser um número entre ${L.ac.min} e ${L.ac.max}.`;
  }
  if (input.speed !== undefined && !isSpeed(input.speed)) {
    errors.speed = `Deslocamento deve estar entre ${L.speed.min} e ${L.speed.max} metros.`;
  }
  for (const key of ['initiativeBonus', 'passivePerceptionBonus', 'spellBonus'] as const) {
    const value = input[key];
    if (value !== undefined && !inRange(value, L.adjustment.min, L.adjustment.max)) {
      errors[key] = `O ajuste deve ser um número entre ${L.adjustment.min} e ${L.adjustment.max}.`;
    }
  }

  if (
    ABILITIES.some((ability) => !inRange(input.abilityScores[ability], L.abilityScore.min, L.abilityScore.max))
  ) {
    errors.abilityScores = `Atributos devem ser números entre ${L.abilityScore.min} e ${L.abilityScore.max}.`;
  }

  if ((input.expertise ?? []).some((skill) => !input.skills.includes(skill))) {
    errors.expertise = 'Especialização exige proficiência na perícia.';
  }
  if (tooLong(input.weaponProficiencies, L.proficiencyText)) {
    errors.weaponProficiencies = `Use até ${L.proficiencyText} caracteres.`;
  }
  if (tooLong(input.toolProficiencies, L.proficiencyText)) {
    errors.toolProficiencies = `Use até ${L.proficiencyText} caracteres.`;
  }

  if (input.attacks.length > L.attacks) {
    errors.attacks = `Limite de ${L.attacks} ataques.`;
  } else if (
    input.attacks.some((attack) => attack.name.trim().length === 0 || !parseDiceExpression(attack.damage))
  ) {
    errors.attacks = 'Cada ataque precisa de nome e de dano como expressão (ex.: 1d8+3).';
  } else if (input.attacks.some((attack) => !inRange(attack.bonus, -L.attackBonus, L.attackBonus))) {
    errors.attacks = `Bônus de ataque deve ser um número entre -${L.attackBonus} e ${L.attackBonus}.`;
  } else if (
    input.attacks.some((attack) => tooLong(attack.damageType, L.damageType) || tooLong(attack.notes, L.attackNotes))
  ) {
    errors.attacks = `Tipo de dano até ${L.damageType} caracteres e notas até ${L.attackNotes}.`;
  }

  const listMessage = `Até ${L.listItems} itens, cada um com até ${L.listItem} caracteres.`;
  if (badList(input.features)) errors.features = listMessage;
  if (badList(input.speciesTraits)) errors.speciesTraits = listMessage;
  if (badList(input.feats)) errors.feats = listMessage;

  if (
    input.spellSlotTotals !== undefined &&
    (input.spellSlotTotals.length !== SPELL_SLOT_CAPS.length ||
      input.spellSlotTotals.some((total, circle) => !inRange(total, 0, SPELL_SLOT_CAPS[circle] ?? 0)))
  ) {
    errors.spellSlotTotals = 'Cada círculo aceita de 0 até o número de espaços da ficha.';
  }
  const spells = input.spells ?? [];
  if (spells.length > L.spells) {
    errors.spells = `Limite de ${L.spells} magias.`;
  } else if (spells.some((spell) => !inRange(spell.level, 0, 9) || spell.name.trim().length === 0)) {
    errors.spells = 'Cada magia precisa de nome e de círculo entre 0 (truque) e 9.';
  } else if (
    spells.some(
      (spell) =>
        spell.name.length > L.spellName ||
        spell.castingTime.length > L.spellShortText ||
        spell.range.length > L.spellShortText ||
        spell.notes.length > L.spellNotes,
    )
  ) {
    errors.spells = `Nome até ${L.spellName} caracteres, tempo e alcance até ${L.spellShortText}, notas até ${L.spellNotes}.`;
  }

  if (tooLong(input.appearance, L.appearance)) errors.appearance = `Use até ${L.appearance} caracteres.`;
  if (tooLong(input.description, L.description)) errors.description = `Use até ${L.description} caracteres.`;
  if (tooLong(input.languages, L.languages)) errors.languages = `Use até ${L.languages} caracteres.`;
  if (tooLong(input.equipment, L.equipment)) errors.equipment = `Use até ${L.equipment} caracteres.`;
  const attuned = input.attunedItems ?? [];
  if (attuned.length > L.attunedItems) {
    errors.attunedItems = `Um personagem se sintoniza com até ${L.attunedItems} itens.`;
  } else if (attuned.some((item) => item.trim().length === 0 || item.length > L.attunedItem)) {
    errors.attunedItems = `Cada item sintonizado precisa de nome com até ${L.attunedItem} caracteres.`;
  }
  if (input.coins && COINS.some((coin) => !inRange(input.coins![coin], 0, L.coins))) {
    errors.coins = `Moedas devem ser números entre 0 e ${L.coins}.`;
  }

  return errors;
}
