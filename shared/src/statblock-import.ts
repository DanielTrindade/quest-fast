/**
 * An NPC written on the official 2024 character sheet, turned into a bestiary
 * statblock. The PDF is read by the same parser as a player's sheet
 * (`sheet-import.ts`); this module only maps the sheet onto the statblock and
 * says what the master still has to review. Pure, so the client previews it
 * and the tests pin it down.
 */

import { ABILITIES, SKILLS, abilityModifier, type Ability, type Skill } from './modifiers.ts';
import type { StatblockInput } from './api.ts';
import { STATBLOCK_LIMITS as S } from './combat.ts';
import { parseDiceExpression } from './dice.ts';
import type { ImportedAttack, ImportedSheet, SheetImportResult } from './sheet-import.ts';
import { saveBonus, skillBonus, skillProficiency, spellAttackBonus, spellSaveDc } from './sheet.ts';

/** What the editor reads: attacks may still have blanks (`null`) to fill. */
export type ImportedStatblock = Omit<StatblockInput, 'attacks'> & { attacks: ImportedAttack[] };

export type StatblockImportResult = {
  input: ImportedStatblock;
  /** In Portuguese, for the master to review before saving. */
  warnings: string[];
};

/** Names shown in the composed text; the client owns the Portuguese labels. */
export type StatblockImportLabels = {
  abilities: Record<Ability, string>;
  skills: Record<Skill, string>;
};

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** "9 m", "7,5 m": the sheet stores meters; the statblock keeps free text. */
function speedText(meters: number) {
  return `${String(meters).replace('.', ',')} m`;
}

/** Hit dice by level and Constitution, as an NPC statblock writes them: `3d10+6`. */
function hpFormula(sheet: ImportedSheet): string {
  const constitution = abilityModifier(sheet.abilityScores.constitution) ?? 0;
  const bonus = constitution * sheet.level;
  const formula = `${sheet.level}d${sheet.hitDie}${bonus === 0 ? '' : signed(bonus)}`;
  return formula.length <= S.hpFormula && parseDiceExpression(formula) ? formula : '';
}

function clamp(value: number, { min, max }: { min: number; max: number }) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Traits read like the statblock's header lines, then the sheet's own lists:
 * class and level, saving throws and skills with their bonuses, languages,
 * then class features, species traits and feats.
 */
function traitsText(sheet: ImportedSheet, labels: StatblockImportLabels): string {
  const classLine = [sheet.class, String(sheet.level)].join(' ') + (sheet.subclass ? ` (${sheet.subclass})` : '');
  const saves = ABILITIES.filter((ability) => sheet.saves.includes(ability))
    .map((ability) => `${labels.abilities[ability]} ${signed(saveBonus(sheet, ability))}`);
  const skills = SKILLS.filter((skill) => skillProficiency(sheet, skill) !== 'none')
    .map((skill) => `${labels.skills[skill]} ${signed(skillBonus(sheet, skill))}`);
  return [
    `Classe: ${classLine}`,
    saves.length > 0 ? `Salvaguardas: ${saves.join(', ')}` : '',
    skills.length > 0 ? `Perícias: ${skills.join(', ')}` : '',
    sheet.languages ? `Idiomas: ${sheet.languages}` : '',
    ...sheet.features,
    ...sheet.speciesTraits,
    ...sheet.feats,
  ].filter(Boolean).join('\n');
}

/** Spellcasting is not an attack roll the bestiary can roll: it goes to the actions text. */
function actionsText(sheet: ImportedSheet, labels: StatblockImportLabels): string {
  if (!sheet.spellcastingAbility && sheet.spells.length === 0) return '';
  const header = sheet.spellcastingAbility
    ? `Conjuração (${labels.abilities[sheet.spellcastingAbility]}): CD ${spellSaveDc(sheet)}, ${signed(spellAttackBonus(sheet) ?? 0)} para acertar com magias.`
    : 'Conjuração.';
  const byCircle = new Map<number, string[]>();
  for (const spell of sheet.spells) byCircle.set(spell.level, [...(byCircle.get(spell.level) ?? []), spell.name]);
  const lines = [...byCircle.entries()].sort(([a], [b]) => a - b).map(([circle, names]) => {
    const slots = sheet.spellSlotTotals[circle - 1];
    const label = circle === 0 ? 'Truques' : `${circle}º círculo${slots ? ` (${slots} espaços)` : ''}`;
    return `${label}: ${names.join(', ')}`;
  });
  return [header, ...lines].join('\n');
}

/** Text past the statblock limit is cut, and the cut is named in a warning. */
function fit(label: string, text: string, max: number, warnings: string[]) {
  if (text.length <= max) return text;
  warnings.push(`${label} passou de ${max} caracteres e foi cortado. Revise antes de salvar.`);
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Maps a sheet read from the official PDF onto a statblock. The sheet's own
 * warnings come first, then what only the statblock lacks: the challenge
 * rating (the sheet has none) and anything cut or clamped to its limits.
 */
export function statblockFromSheet({ input: sheet, warnings: sheetWarnings }: SheetImportResult, labels: StatblockImportLabels): StatblockImportResult {
  const warnings = [...sheetWarnings];

  const ac = clamp(sheet.ac, S.ac);
  if (ac !== sheet.ac) warnings.push(`CA ${sheet.ac} fora do limite do bestiário (${S.ac.min} a ${S.ac.max}); ficou ${ac}.`);
  const hpAverage = clamp(sheet.hp, S.hp);
  if (hpAverage !== sheet.hp) warnings.push(`PV ${sheet.hp} fora do limite do bestiário (${S.hp.min} a ${S.hp.max}); ficou ${hpAverage}.`);
  const initiativeBonus = clamp(sheet.initiativeBonus, S.initiativeBonus);
  if (initiativeBonus !== sheet.initiativeBonus) {
    warnings.push(`Ajuste de iniciativa ${signed(sheet.initiativeBonus)} fora do limite do bestiário; ficou ${signed(initiativeBonus)}.`);
  }

  const attacks = sheet.attacks.slice(0, S.attacks);
  if (sheet.attacks.length > S.attacks) {
    warnings.push(`A ficha tem ${sheet.attacks.length} ataques; o bestiário guarda ${S.attacks}. Os demais ficaram de fora.`);
  }

  warnings.push('A ficha não tem nível de desafio. Escolha o ND antes de salvar, se quiser usá-lo.');

  return {
    input: {
      name: fit('O nome', sheet.name, S.name, warnings),
      size: sheet.size,
      creatureType: fit('A espécie', sheet.race, S.creatureType, warnings),
      challengeRating: '',
      ac,
      hpAverage,
      hpFormula: hpFormula(sheet),
      speed: speedText(sheet.speed),
      initiativeBonus,
      abilityScores: { ...sheet.abilityScores },
      attacks,
      traits: fit('O texto de traços', traitsText(sheet, labels), S.text, warnings),
      actions: fit('O texto de conjuração', actionsText(sheet, labels), S.text, warnings),
      reactions: '',
    },
    warnings,
  };
}
