/**
 * The fixed 5e vocabulary: six abilities, eighteen skills, and the two
 * formulas every derived bonus in the MVP needs. Names stay in English —
 * visible labels are the client's decision.
 */

export const ABILITIES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

export type Ability = (typeof ABILITIES)[number];

export function isAbility(value: unknown): value is Ability {
  return typeof value === 'string' && (ABILITIES as readonly string[]).includes(value);
}

/** 5e scores live between 1 and 30; anything else is data entry noise. */
export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 30;

/** `mod = floor((score - 10) / 2)`, undefined outside the 1–30 band. */
export function abilityModifier(score: number): number | undefined {
  if (!Number.isInteger(score) || score < ABILITY_SCORE_MIN || score > ABILITY_SCORE_MAX) {
    return undefined;
  }
  return Math.floor((score - 10) / 2);
}

/** Each skill is governed by exactly one ability; there is no custom skill. */
export const SKILL_ABILITIES = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
} as const;

export const SKILLS = Object.keys(SKILL_ABILITIES) as [keyof typeof SKILL_ABILITIES, ...(keyof typeof SKILL_ABILITIES)[]];

export type Skill = keyof typeof SKILL_ABILITIES;

export function isSkill(value: unknown): value is Skill {
  return typeof value === 'string' && value in SKILL_ABILITIES;
}

export function skillAbility(skill: Skill): Ability {
  return SKILL_ABILITIES[skill];
}

/** `2 + floor((level - 1) / 4)`, undefined outside the 1–20 band. */
export function proficiencyBonus(level: number): number | undefined {
  if (!Number.isInteger(level) || level < 1 || level > 20) return undefined;
  return 2 + Math.floor((level - 1) / 4);
}