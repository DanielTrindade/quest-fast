/**
 * The official D&D 2024 character sheet: its fixed vocabulary, the bounds both
 * the server parser and the client validator enforce, and the derived values
 * every screen and every linked roll computes the same way.
 */

import { abilityModifier, proficiencyBonus, skillAbility, type Ability, type Skill } from './modifiers.ts';

/** One source for every bound, so the server and the editor never drift. */
export const CHARACTER_LIMITS = {
  name: 80,
  shortText: 60,
  description: 2000,
  appearance: 1000,
  languages: 200,
  equipment: 2000,
  proficiencyText: 200,
  level: { min: 1, max: 20 },
  abilityScore: { min: 1, max: 30 },
  hp: { min: 1, max: 999 },
  hpTemp: { min: 0, max: 999 },
  ac: { min: 0, max: 40 },
  experience: { min: 0, max: 355000 },
  speed: { min: 0, max: 60 },
  adjustment: { min: -10, max: 10 },
  attacks: 10,
  attackBonus: 20,
  damage: 30,
  damageType: 30,
  attackNotes: 120,
  listItems: 30,
  listItem: 200,
  spells: 60,
  spellName: 80,
  spellShortText: 30,
  spellNotes: 120,
  attunedItems: 3,
  attunedItem: 80,
  coins: 999999,
  deathSaves: 3,
} as const;

export const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type Size = (typeof SIZES)[number];

export const HIT_DICE = [6, 8, 10, 12] as const;
export type HitDie = (typeof HIT_DICE)[number];

export const ARMOR_TRAINING = ['light', 'medium', 'heavy', 'shields'] as const;
export type ArmorTraining = (typeof ARMOR_TRAINING)[number];

/** Boxes per spell circle on the official sheet (1st to 9th). */
export const SPELL_SLOT_CAPS = [4, 3, 3, 3, 3, 2, 2, 1, 1] as const;

export const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
export type Coin = (typeof COINS)[number];
export type Coins = Record<Coin, number>;

export type DeathSaves = { successes: number; failures: number };
export type SpellSlot = { total: number; spent: number };

export type Spell = {
  /** 0 is a cantrip. */
  level: number;
  name: string;
  castingTime: string;
  range: string;
  concentration: boolean;
  ritual: boolean;
  material: boolean;
  notes: string;
};

export type ProficiencyLevel = 'none' | 'proficient' | 'expert';

export function isSize(value: unknown): value is Size {
  return typeof value === 'string' && (SIZES as readonly string[]).includes(value);
}

export function isHitDie(value: unknown): value is HitDie {
  return typeof value === 'number' && (HIT_DICE as readonly number[]).includes(value);
}

export function isArmorTraining(value: unknown): value is ArmorTraining {
  return typeof value === 'string' && (ARMOR_TRAINING as readonly string[]).includes(value);
}

/** Meters with at most one decimal place (9, 7.5, 10.5), as the sheet writes them. */
export function isSpeed(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CHARACTER_LIMITS.speed.min &&
    value <= CHARACTER_LIMITS.speed.max &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
  );
}

export function emptyCoins(): Coins {
  return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}

export function emptySpellSlots(): SpellSlot[] {
  return SPELL_SLOT_CAPS.map(() => ({ total: 0, spent: 0 }));
}

/** The part of a sheet the derived values read. */
export type SheetRules = {
  abilityScores: Record<Ability, number>;
  level: number;
  skills: readonly Skill[];
  expertise: readonly Skill[];
  saves: readonly Ability[];
  initiativeBonus: number;
  passivePerceptionBonus: number;
  spellcastingAbility: Ability | null;
  spellBonus: number;
};

function modifierOf(sheet: Pick<SheetRules, 'abilityScores'>, ability: Ability): number {
  return abilityModifier(sheet.abilityScores[ability]) ?? 0;
}

function proficiencyOf(sheet: Pick<SheetRules, 'level'>): number {
  return proficiencyBonus(sheet.level) ?? 0;
}

/** Expertise only counts on top of proficiency, as the rules define it. */
export function skillProficiency(sheet: Pick<SheetRules, 'skills' | 'expertise'>, skill: Skill): ProficiencyLevel {
  if (!sheet.skills.includes(skill)) return 'none';
  return sheet.expertise.includes(skill) ? 'expert' : 'proficient';
}

/** Ability modifier plus none, one or two times the proficiency bonus. */
export function skillBonus(sheet: Pick<SheetRules, 'abilityScores' | 'level' | 'skills' | 'expertise'>, skill: Skill): number {
  const multiplier = { none: 0, proficient: 1, expert: 2 }[skillProficiency(sheet, skill)];
  return modifierOf(sheet, skillAbility(skill)) + multiplier * proficiencyOf(sheet);
}

export function saveBonus(sheet: Pick<SheetRules, 'abilityScores' | 'level' | 'saves'>, ability: Ability): number {
  return modifierOf(sheet, ability) + (sheet.saves.includes(ability) ? proficiencyOf(sheet) : 0);
}

/** Dexterity modifier plus the adjustment for feats and items (e.g. Alert). */
export function initiative(sheet: Pick<SheetRules, 'abilityScores' | 'initiativeBonus'>): number {
  return modifierOf(sheet, 'dexterity') + sheet.initiativeBonus;
}

export function passivePerception(sheet: Pick<SheetRules, 'abilityScores' | 'level' | 'skills' | 'expertise' | 'passivePerceptionBonus'>): number {
  return 10 + skillBonus(sheet, 'perception') + sheet.passivePerceptionBonus;
}

/** `8 + proficiency + modifier + adjustment`; null for a character who does not cast. */
export function spellSaveDc(sheet: Pick<SheetRules, 'abilityScores' | 'level' | 'spellcastingAbility' | 'spellBonus'>): number | null {
  if (!sheet.spellcastingAbility) return null;
  return 8 + proficiencyOf(sheet) + modifierOf(sheet, sheet.spellcastingAbility) + sheet.spellBonus;
}

/** `proficiency + modifier + adjustment`; null for a character who does not cast. */
export function spellAttackBonus(sheet: Pick<SheetRules, 'abilityScores' | 'level' | 'spellcastingAbility' | 'spellBonus'>): number | null {
  if (!sheet.spellcastingAbility) return null;
  return proficiencyOf(sheet) + modifierOf(sheet, sheet.spellcastingAbility) + sheet.spellBonus;
}

export type HitPoints = { hpCurrent: number; hpTemp: number };

/** Temporary hit points soak damage first; current hit points never go below 0. */
export function applyDamage(state: HitPoints, amount: number): HitPoints {
  const damage = Math.max(0, Math.floor(amount));
  const soaked = Math.min(state.hpTemp, damage);
  return { hpTemp: state.hpTemp - soaked, hpCurrent: Math.max(0, state.hpCurrent - (damage - soaked)) };
}

/** Healing restores current hit points up to the maximum and never adds temporary ones. */
export function applyHealing(state: HitPoints, amount: number, hpMax: number): HitPoints {
  const healing = Math.max(0, Math.floor(amount));
  return { hpTemp: state.hpTemp, hpCurrent: Math.min(hpMax, state.hpCurrent + healing) };
}

export type SessionState = {
  hpCurrent: number;
  hitDiceSpent: number;
  spellSlots: SpellSlot[];
};

/**
 * After an edit changes the maxima, the session state must still fit them:
 * current hit points up to the new maximum, spent hit dice up to the level,
 * spent slots up to each circle's new total.
 */
export function fitStateToSheet(
  state: SessionState,
  sheet: { hp: number; level: number; spellSlotTotals: readonly number[] },
): SessionState {
  return {
    hpCurrent: Math.min(state.hpCurrent, sheet.hp),
    hitDiceSpent: Math.min(state.hitDiceSpent, sheet.level),
    spellSlots: SPELL_SLOT_CAPS.map((_, circle) => {
      const total = sheet.spellSlotTotals[circle] ?? 0;
      return { total, spent: Math.min(state.spellSlots[circle]?.spent ?? 0, total) };
    }),
  };
}
