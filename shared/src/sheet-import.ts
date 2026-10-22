/**
 * Reads the official D&D 2024 sheet in Portuguese (the fillable PDF the table
 * uses) into a `CharacterInput`. Pure: the client extracts the form fields of
 * the PDF and this module only decides what each one means. The result is a
 * draft for the editor, never saved as is — the player reviews it and the
 * usual validation runs on submit.
 *
 * The PDF names its fields generically ("Caixa de texto 1_4"), so the map
 * below was built from where each field sits on the page next to the printed
 * labels. The Portuguese sheet orders some skills differently from the
 * English one (Stealth before Sleight of Hand, Insight before Animal
 * Handling, Performance before Deception).
 */

import type { CharacterInput } from './api.ts';
import { ABILITIES, SKILLS, abilityModifier, proficiencyBonus, skillAbility, type Ability, type Skill } from './modifiers.ts';
import {
  ARMOR_TRAINING,
  CHARACTER_LIMITS,
  COINS,
  HIT_DICE,
  SPELL_SLOT_CAPS,
  emptyCoins,
  skillBonus,
  type ArmorTraining,
  type Coin,
  type HitDie,
  type Size,
  type Spell,
} from './sheet.ts';

/** Field name to value, as the PDF reader returns them: text or a checkbox. */
export type PdfFieldValues = Record<string, string | boolean>;

/** Every optional part of the input filled, so the editor gets a full draft. */
export type ImportedSheet = Required<Omit<CharacterInput, 'avatarAssetId'>>;

export type SheetImportResult = {
  input: ImportedSheet;
  /** What could not be read as written, in Portuguese, for the player to review. */
  warnings: string[];
};

/** Overlapping widgets on the same spot: the first one filled wins. */
type FieldRef = string | readonly string[];

const NUMBER = 'Números Centralizados HV';
const CHECK = 'Caixa de seleção';
const TEXT = 'Caixa de texto';

/** `base` for the first field of a family, `base_n` for the others. */
function nth(base: string, n: number): string {
  return n === 1 ? base : `${base}_${n}`;
}

function nths(base: string, n: number | readonly number[]): FieldRef {
  return typeof n === 'number' ? nth(base, n) : n.map((each) => nth(base, each));
}

const FIELDS = {
  name: 'Esquerda Centro Single 12',
  background: 'Esquerda Centro Single 12_2',
  class: 'Esquerda Centro Single 12_3',
  subclass: 'Esquerda Centro Single 12_4',
  species: 'Esquerda Centro Single 12_5',
  level: `${NUMBER} 8 Single_2`,
  experience: `${NUMBER} 8 Single_3`,
  ac: `${NUMBER} 8 Single_4`,
  shield: `${CHECK} 1`,
  hpCurrent: 'Esquerda baixo 12',
  hpMax: 'Esquerda baixo 12_5',
  hitDice: 'Esquerda baixo 12_3',
  initiative: `${NUMBER} 12 Single_2`,
  speed: `${NUMBER} 12 Single_3`,
  size: `${NUMBER} 10 Single`,
  passivePerception: `${NUMBER} 12 Single_4`,
  classFeatures: ['Multi esquerda 10', 'Multi esquerda 10_2'],
  speciesTraits: 'Multi esquerda 10_3',
  feats: 'Multi esquerda 10_4',
  weapons: 'Multi esquerda 10_5',
  tools: 'Multi esquerda 10_6',
  spellcastingAbility: `${TEXT} 4`,
  spellAttack: `${TEXT} 1_33`,
  appearance: `${TEXT} 6`,
  description: `${TEXT} 6_2`,
  languages: `${TEXT} 6_3`,
  equipment: `${TEXT} 6_4`,
  alignment: `${TEXT} 8`,
  attuned: [`${TEXT} 7`, `${TEXT} 7_2`, `${TEXT} 7_3`],
} as const;

const SCORE_FIELDS: Record<Ability, string> = {
  strength: `${NUMBER} 8 Single_15`,
  dexterity: `${NUMBER} 8 Single_13`,
  constitution: `${NUMBER} 8 Single_11`,
  intelligence: `${NUMBER} 8 Single_5`,
  wisdom: `${NUMBER} 8 Single_7`,
  charisma: `${NUMBER} 8 Single_9`,
};

/** The proficiency checkbox and the bonus written beside it. */
const SAVE_FIELDS: Record<Ability, { check: string; bonus: string }> = {
  strength: { check: `${CHECK} 4_23`, bonus: 'Single centro baixo 6_18' },
  dexterity: { check: `${CHECK} 4_18`, bonus: 'Single centro baixo 6_20' },
  constitution: { check: `${CHECK} 4_22`, bonus: 'Single centro baixo 6_24' },
  intelligence: { check: `${CHECK} 4`, bonus: 'Single centro baixo 6' },
  wisdom: { check: `${CHECK} 4_7`, bonus: 'Single centro baixo 6_7' },
  charisma: { check: `${CHECK} 4_13`, bonus: 'Single centro baixo 6_13' },
};

const SKILL_FIELDS: Record<Skill, { check: string; bonus: string }> = {
  athletics: { check: `${CHECK} 4_24`, bonus: 'Single centro baixo 6_19' },
  acrobatics: { check: `${CHECK} 4_19`, bonus: 'Single centro baixo 6_21' },
  stealth: { check: `${CHECK} 4_20`, bonus: 'Single centro baixo 6_22' },
  sleightOfHand: { check: `${CHECK} 4_21`, bonus: 'Single centro baixo 6_23' },
  arcana: { check: `${CHECK} 4_2`, bonus: 'Single centro baixo 6_2' },
  history: { check: `${CHECK} 4_3`, bonus: 'Single centro baixo 6_3' },
  investigation: { check: `${CHECK} 4_4`, bonus: 'Single centro baixo 6_4' },
  nature: { check: `${CHECK} 4_5`, bonus: 'Single centro baixo 6_5' },
  religion: { check: `${CHECK} 4_6`, bonus: 'Single centro baixo 6_6' },
  insight: { check: `${CHECK} 4_8`, bonus: 'Single centro baixo 6_8' },
  animalHandling: { check: `${CHECK} 4_9`, bonus: 'Single centro baixo 6_9' },
  medicine: { check: `${CHECK} 4_10`, bonus: 'Single centro baixo 6_10' },
  perception: { check: `${CHECK} 4_11`, bonus: 'Single centro baixo 6_11' },
  survival: { check: `${CHECK} 4_12`, bonus: 'Single centro baixo 6_12' },
  performance: { check: `${CHECK} 4_14`, bonus: 'Single centro baixo 6_14' },
  deception: { check: `${CHECK} 4_15`, bonus: 'Single centro baixo 6_15' },
  intimidation: { check: `${CHECK} 4_16`, bonus: 'Single centro baixo 6_16' },
  persuasion: { check: `${CHECK} 4_17`, bonus: 'Single centro baixo 6_17' },
};

const ARMOR_FIELDS: Record<ArmorTraining, string> = {
  light: `${CHECK} 3_2`,
  medium: `${CHECK} 3_3`,
  heavy: `${CHECK} 3_4`,
  shields: `${CHECK} 3_5`,
};

const COIN_FIELDS: Record<Coin, string> = {
  cp: `${TEXT} 5`,
  sp: `${TEXT} 5_2`,
  ep: `${TEXT} 5_3`,
  gp: `${TEXT} 5_4`,
  pp: `${TEXT} 5_5`,
};

/** Totals of the 1st to 9th circle, three columns of three on page 2. */
const SLOT_TOTAL_FIELDS = ['Text1', 'Text10', 'Text11', 'Text12', 'Text13', 'Text14', 'Text15', 'Text16', 'Text17'];

/** The six rows of "Armas e truques de dano", top to bottom. */
const ATTACK_ROWS = (
  [
    [4, 3, 1, 2],
    [8, 7, 5, 6],
    [12, 11, 9, 10],
    [[16, 20, 28], [15, 19, 27], [13, 17, 25], [14, 18, 26]],
    [24, 23, 21, 22],
    [32, 31, 29, 30],
  ] as const
).map(([name, bonus, damage, notes]) => ({
  name: nths(`${TEXT} 1`, name),
  bonus: nths(`${TEXT} 1`, bonus),
  damage: nths(`${TEXT} 1`, damage),
  notes: nths(`${TEXT} 1`, notes),
}));

/**
 * The thirty rows of "Truques e magias preparadas", top to bottom:
 * circle, name, casting time, range, notes, and the first of the three
 * concentration/ritual/material checkboxes.
 */
const SPELL_ROWS = (
  [
    [1, 1, 1, 2, 3, 2],
    [2, 4, 2, 5, 6, 5],
    [3, 7, 3, 8, 9, 8],
    [4, 10, 4, 11, 12, 11],
    [5, 13, 5, 14, 15, 14],
    [6, 16, 6, 17, 18, 17],
    [7, 19, 7, 20, [21, 90, 92], 20],
    [8, 22, 8, 23, [24, 67, 91], 23],
    [9, 25, 9, 26, 68, 26],
    [10, 27, 10, 28, 69, 29],
    [11, 29, 11, 30, 70, 32],
    [12, 31, 12, 32, 71, 35],
    [13, 33, 13, 34, 72, 38],
    [14, 35, 14, 36, 73, 41],
    [[15, 30, 31], [37, 93, 95], [15, 30, 31], [38, 94, 96], 74, 44],
    [32, 97, 32, 98, 75, 47],
    [16, 39, 16, 40, 76, 50],
    [17, 41, 17, 42, 77, 53],
    [18, 43, 18, 44, 78, 56],
    [19, 45, 19, 46, 79, 59],
    [20, 47, 20, 48, 80, 62],
    [21, 49, 21, 50, 81, 65],
    [22, 51, 22, 52, 82, 68],
    [23, 53, 23, 54, 83, 71],
    [24, 55, 24, 56, 84, 74],
    [25, 57, 25, 58, 85, 77],
    [26, 59, 26, 60, 86, 80],
    [27, 61, 27, 62, 87, 83],
    [28, 63, 28, 64, 88, 86],
    [29, 65, 29, 66, 89, 89],
  ] as const
).map(([level, name, castingTime, range, notes, check]) => ({
  level: nths('Círculo e Tempo de Conjuração', level),
  name: nths('Magias Esq', name),
  castingTime: nths(`${TEXT} 3`, castingTime),
  range: nths('Magias Esq', range),
  notes: nths('Magias Esq', notes),
  concentration: nth(`${CHECK} 1`, check),
  ritual: nth(`${CHECK} 1`, check + 1),
  material: nth(`${CHECK} 1`, check + 2),
}));

/**
 * PDF names escape non-ASCII bytes as `#xx` ("N#C3#BAmeros"); some readers
 * decode them and some do not, so both spellings map to the same name.
 */
export function normalizePdfFieldName(name: string): string {
  try {
    return decodeURIComponent(name.replace(/%/g, '%25').replace(/#([0-9a-fA-F]{2})/g, '%$1'));
  } catch {
    return name;
  }
}

/** Lowercase without accents, for matching what players type. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** The first signed integer in the text, accepting the typographic minus. */
function parseInteger(text: string): number | undefined {
  const match = /([+\-−–]?)\s*(\d+)/.exec(text);
  if (!match) return undefined;
  const value = Number(match[2]);
  return match[1] && match[1] !== '+' ? -value : value;
}

/** Thousands written with a dot or a space ("1.500") are still one number. */
function parseCount(text: string): number | undefined {
  const digits = text.replace(/[.\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : undefined;
}

/** Meters as the sheet writes them ("9m", "10,5 m"); feet are converted. */
function parseSpeed(text: string): number | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(ft|p[eé]s)?/i.exec(text);
  if (!match) return undefined;
  const value = Number(match[1]!.replace(',', '.'));
  // 5 ft = 1.5 m, the conversion the 2024 Portuguese books use.
  return match[2] ? Math.round(value / 5) * 1.5 : value;
}

const SIZE_WORDS: Record<string, Size> = {
  miudo: 'tiny',
  minusculo: 'tiny',
  tiny: 'tiny',
  pequeno: 'small',
  small: 'small',
  medio: 'medium',
  medium: 'medium',
  grande: 'large',
  large: 'large',
  enorme: 'huge',
  huge: 'huge',
  imenso: 'gargantuan',
  colossal: 'gargantuan',
  gargantuan: 'gargantuan',
};

const ABILITY_WORDS: Record<string, Ability> = {
  forca: 'strength',
  for: 'strength',
  strength: 'strength',
  str: 'strength',
  destreza: 'dexterity',
  des: 'dexterity',
  dexterity: 'dexterity',
  dex: 'dexterity',
  constituicao: 'constitution',
  con: 'constitution',
  constitution: 'constitution',
  inteligencia: 'intelligence',
  int: 'intelligence',
  intelligence: 'intelligence',
  sabedoria: 'wisdom',
  sab: 'wisdom',
  wisdom: 'wisdom',
  wis: 'wisdom',
  carisma: 'charisma',
  car: 'charisma',
  charisma: 'charisma',
  cha: 'charisma',
};

/**
 * Free text lists on the sheet are separated by semicolons or lines. A stray
 * ")" or "." left between separators is not an item; an item longer than the
 * platform allows is cut, and `onCut` names it for the warning.
 */
function splitList(text: string, onCut: (item: string) => void): string[] {
  const max = CHARACTER_LIMITS.listItem;
  return text
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter((item) => /[\p{L}\p{N}]/u.test(item))
    .map((item) => {
      if (item.length <= max) return item;
      onCut(item);
      return `${item.slice(0, max - 1).trimEnd()}…`;
    });
}

// `1d8+3 Cortante`: the dice part is the damage, the rest is its type.
const DAMAGE = /^\s*(\d+\s*[dD]\s*\d+(?:\s*[+-]\s*\d+)?)\s*[,;:\-–]?\s*(.*)$/;

// Players often write a cantrip as "Truque: Raio de Fogo" instead of circle 0.
const CANTRIP_PREFIX = /^truque\b\s*:?\s*/i;

/**
 * Returns `null` when the fields are not those of the official Portuguese
 * sheet, so the caller can say the file is not supported instead of filling
 * the editor with defaults.
 */
export function sheetFromOfficialPdf(raw: PdfFieldValues): SheetImportResult | null {
  const fields = new Map(Object.entries(raw).map(([name, value]) => [normalizePdfFieldName(name), value]));

  const known = [FIELDS.name, FIELDS.level, FIELDS.ac, ...Object.values(SCORE_FIELDS), ...SLOT_TOTAL_FIELDS];
  if (known.filter((name) => fields.has(name)).length < known.length - 2) return null;

  const text = (ref: FieldRef): string => {
    for (const name of typeof ref === 'string' ? [ref] : ref) {
      const value = fields.get(name);
      if (typeof value === 'string' && value.trim()) return value.replace(/\r\n?/g, '\n').trim();
    }
    return '';
  };
  const checked = (name: string) => fields.get(name) === true;
  const warnings: string[] = [];
  const cutItems: string[] = [];
  const list = (ref: FieldRef) => splitList(text(ref), (item) => cutItems.push(item));

  const level = parseInteger(text(FIELDS.level)) ?? 1;
  const proficiency = proficiencyBonus(level) ?? 2;

  const missingScores: Ability[] = [];
  const abilityScores = Object.fromEntries(
    ABILITIES.map((ability) => {
      const score = parseInteger(text(SCORE_FIELDS[ability]));
      if (score === undefined) missingScores.push(ability);
      return [ability, score ?? 10];
    }),
  ) as Record<Ability, number>;
  if (missingScores.length > 0) warnings.push('Alguns valores de atributo estavam vazios e ficaram em 10.');
  const modifier = (ability: Ability) => abilityModifier(abilityScores[ability]) ?? 0;

  // The checkbox says trained; a bonus of twice the proficiency says expertise,
  // which the sheet has no box for.
  const skills = SKILLS.filter((skill) => checked(SKILL_FIELDS[skill].check));
  const expertise = skills.filter((skill) => {
    const bonus = parseInteger(text(SKILL_FIELDS[skill].bonus));
    return bonus !== undefined && bonus - modifier(skillAbility(skill)) === 2 * proficiency;
  });
  const saves = ABILITIES.filter((ability) => checked(SAVE_FIELDS[ability].check));

  // The sheet writes the totals; the platform stores only the adjustment on
  // top of what it derives, and drops one that does not fit its bounds.
  const adjustment = (written: number | undefined, derived: number) => {
    if (written === undefined) return 0;
    const value = written - derived;
    return value >= -10 && value <= 10 ? value : 0;
  };

  const sizeText = text(FIELDS.size);
  const size = SIZE_WORDS[fold(sizeText)] ?? 'medium';
  if (sizeText && !SIZE_WORDS[fold(sizeText)]) warnings.push(`Tamanho "${sizeText}" não reconhecido; ficou Médio.`);

  const hitDiceText = text(FIELDS.hitDice);
  const hitDieSides = Number(/d\s*(\d+)/i.exec(hitDiceText)?.[1]);
  const hitDie = (HIT_DICE as readonly number[]).includes(hitDieSides) ? (hitDieSides as HitDie) : 8;
  if (hitDiceText && hitDie !== hitDieSides) warnings.push(`Dado de vida "${hitDiceText}" não reconhecido; ficou d8.`);

  // The maximum is what the platform stores; a current value above it means
  // the maximum on the PDF is out of date.
  const hpValues = [text(FIELDS.hpMax), text(FIELDS.hpCurrent)].map(parseInteger).filter((hp) => hp !== undefined);
  const hp = hpValues.length > 0 ? Math.max(...hpValues) : 10;

  const spellcastingText = text(FIELDS.spellcastingAbility);
  const spellcastingAbility = ABILITY_WORDS[fold(spellcastingText)] ?? null;
  if (spellcastingText && !spellcastingAbility) {
    warnings.push(`Atributo de conjuração "${spellcastingText}" não reconhecido.`);
  }

  const attacks = ATTACK_ROWS.flatMap((row) => {
    const name = text(row.name);
    if (!name) return [];
    const damageText = text(row.damage);
    const damage = DAMAGE.exec(damageText);
    const bonusText = text(row.bonus);
    // "CD 13" is a save DC, not an attack bonus.
    const bonus = /\b(cd|dc)\b/i.test(bonusText) ? 0 : parseInteger(bonusText) ?? 0;
    return [{
      name,
      bonus,
      damage: damage ? damage[1]!.replace(/\s+/g, '') : damageText,
      damageType: damage ? damage[2]!.trim() : '',
      notes: text(row.notes),
    }];
  });

  const guessedCircle: string[] = [];
  const spells = SPELL_ROWS.flatMap((row): Spell[] => {
    let name = text(row.name);
    if (!name) return [];
    let level = parseInteger(text(row.level));
    if (CANTRIP_PREFIX.test(name)) {
      name = name.replace(CANTRIP_PREFIX, '');
      level = 0;
    }
    if (level === undefined) {
      guessedCircle.push(name);
      level = 1;
    }
    return [{
      level,
      name,
      castingTime: text(row.castingTime),
      range: text(row.range),
      concentration: checked(row.concentration),
      ritual: checked(row.ritual),
      material: checked(row.material),
      notes: text(row.notes),
    }];
  });
  if (guessedCircle.length > 0) {
    warnings.push(`Sem círculo na ficha, ficaram no 1º: ${guessedCircle.join(', ')}.`);
  }

  const coins = emptyCoins();
  for (const coin of COINS) coins[coin] = parseCount(text(COIN_FIELDS[coin])) ?? 0;

  const sheet = { abilityScores, level, skills, expertise };
  const features = FIELDS.classFeatures.flatMap((field) => list(field));
  const speciesTraits = list(FIELDS.speciesTraits);
  const feats = list(FIELDS.feats);
  if (cutItems.length > 0) {
    const names = cutItems.map((item) => `"${item.split(':')[0]!.slice(0, 40).trim()}"`).join(', ');
    warnings.push(`Itens com mais de ${CHARACTER_LIMITS.listItem} caracteres foram cortados: ${names}.`);
  }

  return {
    input: {
      name: text(FIELDS.name),
      race: text(FIELDS.species),
      class: text(FIELDS.class),
      subclass: text(FIELDS.subclass),
      background: text(FIELDS.background),
      alignment: text(FIELDS.alignment),
      level,
      experience: parseCount(text(FIELDS.experience)) ?? 0,
      size,
      abilityScores,
      hp,
      ac: parseInteger(text(FIELDS.ac)) ?? 10,
      shield: checked(FIELDS.shield),
      speed: parseSpeed(text(FIELDS.speed)) ?? 9,
      hitDie,
      initiativeBonus: adjustment(parseInteger(text(FIELDS.initiative)), modifier('dexterity')),
      passivePerceptionBonus: adjustment(
        parseInteger(text(FIELDS.passivePerception)),
        10 + skillBonus(sheet, 'perception'),
      ),
      skills,
      expertise,
      saves,
      armorTraining: ARMOR_TRAINING.filter((training) => checked(ARMOR_FIELDS[training])),
      weaponProficiencies: text(FIELDS.weapons),
      toolProficiencies: text(FIELDS.tools),
      attacks,
      features,
      speciesTraits,
      feats,
      spellcastingAbility,
      spellBonus: spellcastingAbility
        ? adjustment(parseInteger(text(FIELDS.spellAttack)), proficiency + modifier(spellcastingAbility))
        : 0,
      spellSlotTotals: SPELL_SLOT_CAPS.map((cap, circle) =>
        Math.min(cap, Math.max(0, parseInteger(text(SLOT_TOTAL_FIELDS[circle]!)) ?? 0)),
      ),
      spells,
      appearance: text(FIELDS.appearance),
      description: text(FIELDS.description),
      languages: text(FIELDS.languages),
      equipment: text(FIELDS.equipment),
      attunedItems: FIELDS.attuned.map((field) => text(field)).filter(Boolean),
      coins,
    },
    warnings,
  };
}
