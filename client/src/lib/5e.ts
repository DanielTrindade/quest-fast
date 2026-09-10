import type { Ability, RollMode, Skill } from '@quest-fast/shared';

/** Visible labels stay in Portuguese — this is what the table reads. */
export const ABILITY_LABELS: Record<Ability, string> = {
  strength: 'Força',
  dexterity: 'Destreza',
  constitution: 'Constituição',
  intelligence: 'Inteligência',
  wisdom: 'Sabedoria',
  charisma: 'Carisma',
};

export const ABILITY_ABBREVIATIONS: Record<Ability, string> = {
  strength: 'FOR',
  dexterity: 'DES',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'SAB',
  charisma: 'CAR',
};

export const SKILL_LABELS: Record<Skill, string> = {
  acrobatics: 'Acrobacia',
  animalHandling: 'Adestrar Animais',
  arcana: 'Arcanismo',
  athletics: 'Atletismo',
  deception: 'Enganação',
  history: 'História',
  insight: 'Intuição',
  intimidation: 'Intimidação',
  investigation: 'Investigação',
  medicine: 'Medicina',
  nature: 'Natureza',
  perception: 'Percepção',
  performance: 'Atuação',
  persuasion: 'Persuasão',
  religion: 'Religião',
  sleightOfHand: 'Prestidigitação',
  stealth: 'Furtividade',
  survival: 'Sobrevivência',
};

export const ROLL_MODE_LABELS: Record<RollMode, string> = {
  normal: 'Normal',
  advantage: 'Vantagem',
  disadvantage: 'Desvantagem',
};

/** A signed bonus reads "+4" and "-1"; zero stays "+0". */
export function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

/** The total face value, excluding any discarded die. */
export function diceTotal(dice: { value: number; discarded?: boolean }[], modifier: number): number {
  return dice.reduce((sum, die) => sum + (die.discarded ? 0 : die.value), 0) + modifier;
}