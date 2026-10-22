import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePdfFieldName, sheetFromOfficialPdf, type PdfFieldValues } from './sheet-import.ts';
import { validateCharacterInput } from './validation.ts';

// Field names as the PDF stores them, non-ASCII bytes escaped as `#xx`.
const NUMBER = 'N#C3#BAmeros Centralizados HV';
const CHECK = 'Caixa de sele#C3#A7#C3#A3o';

/** The fields every official sheet has, with scores of 10, plus the given values. */
function sheet(values: PdfFieldValues = {}): PdfFieldValues {
  const empty: PdfFieldValues = { 'Esquerda Centro Single 12': '' };
  for (const n of [2, 3, 4]) empty[`${NUMBER} 8 Single_${n}`] = '';
  for (const n of [5, 7, 9, 11, 13, 15]) empty[`${NUMBER} 8 Single_${n}`] = '10';
  for (const name of ['Text1', 'Text10', 'Text11', 'Text12', 'Text13', 'Text14', 'Text15', 'Text16', 'Text17']) {
    empty[name] = '';
  }
  return { ...empty, ...values };
}

// Hazin Dan, level 4 barbarian, as written on the table's sheet.
const hazin = sheet({
  'Esquerda Centro Single 12': 'Hazin Dan',
  'Esquerda Centro Single 12_2': 'Fazendeiro',
  'Esquerda Centro Single 12_3': 'Barbaro',
  'Esquerda Centro Single 12_4': 'Berserker',
  'Esquerda Centro Single 12_5': 'Humano',
  [`${NUMBER} 8 Single_2`]: '4',
  [`${NUMBER} 8 Single_3`]: '1.500',
  [`${NUMBER} 8 Single_4`]: '17',
  [`${NUMBER} 8 Single_15`]: '20',
  [`${NUMBER} 8 Single_13`]: '14',
  [`${NUMBER} 8 Single_11`]: '19',
  [`${NUMBER} 8 Single_5`]: '9',
  [`${NUMBER} 8 Single_7`]: '12',
  [`${NUMBER} 8 Single_9`]: '10',
  [`${NUMBER} 12 Single_2`]: '+2',
  [`${NUMBER} 12 Single_3`]: '9m',
  [`${NUMBER} 10 Single`]: 'Médio',
  [`${NUMBER} 12 Single_4`]: '11',
  'Esquerda baixo 12': '55',
  'Esquerda baixo 12_5': '55',
  'Esquerda baixo 12_3': 'D12 + 2',
  [`${CHECK} 4_23`]: true,
  [`${CHECK} 4_22`]: true,
  [`${CHECK} 4_24`]: true,
  [`${CHECK} 4_19`]: true,
  [`${CHECK} 4_9`]: true,
  [`${CHECK} 3_2`]: true,
  [`${CHECK} 3_3`]: true,
  [`${CHECK} 3_5`]: true,
  'Multi esquerda 10': 'Furia; Defesa sem Armadura;\r\nSentido de Perigo; )',
  'Multi esquerda 10_4': 'Atacante Selvagem; Robusto',
  'Caixa de texto 5_4': '122',
});

test('field names read the same escaped or decoded', () => {
  assert.equal(normalizePdfFieldName('N#C3#BAmeros Centralizados HV 8 Single_2'), 'Números Centralizados HV 8 Single_2');
  assert.equal(normalizePdfFieldName('Números Centralizados HV 8 Single_2'), 'Números Centralizados HV 8 Single_2');
  assert.equal(normalizePdfFieldName('50% #ZZ'), '50% #ZZ');
});

test('a PDF that is not the official sheet is not imported', () => {
  assert.equal(sheetFromOfficialPdf({}), null);
  assert.equal(sheetFromOfficialPdf({ CharacterName: 'Hazin', STR: '20' }), null);
});

test('reads identity, combat and abilities from the official sheet', () => {
  const { input, warnings } = sheetFromOfficialPdf(hazin)!;
  assert.equal(input.name, 'Hazin Dan');
  assert.equal(input.race, 'Humano');
  assert.equal(input.class, 'Barbaro');
  assert.equal(input.subclass, 'Berserker');
  assert.equal(input.background, 'Fazendeiro');
  assert.equal(input.level, 4);
  assert.equal(input.experience, 1500);
  assert.equal(input.ac, 17);
  assert.equal(input.hp, 55);
  assert.equal(input.hitDie, 12);
  assert.equal(input.speed, 9);
  assert.equal(input.size, 'medium');
  assert.deepEqual(input.abilityScores, {
    strength: 20, dexterity: 14, constitution: 19, intelligence: 9, wisdom: 12, charisma: 10,
  });
  assert.deepEqual(input.saves, ['strength', 'constitution']);
  assert.deepEqual(input.armorTraining, ['light', 'medium', 'shields']);
  assert.equal(input.coins.gp, 122);
  assert.deepEqual(warnings, []);
  assert.deepEqual(validateCharacterInput(input), {});
});

test('skills follow the order of the Portuguese sheet', () => {
  // Box 4_9 is the second wisdom row: "Lidar com animais", after "Intuição".
  assert.deepEqual(sheetFromOfficialPdf(hazin)!.input.skills, ['acrobatics', 'animalHandling', 'athletics']);
  const { input } = sheetFromOfficialPdf(sheet({
    [`${CHECK} 4_20`]: true,
    [`${CHECK} 4_8`]: true,
    [`${CHECK} 4_14`]: true,
  }))!;
  assert.deepEqual(input.skills, ['insight', 'performance', 'stealth']);
});

test('a written bonus of twice the proficiency marks expertise', () => {
  const { input } = sheetFromOfficialPdf(sheet({
    [`${NUMBER} 8 Single_2`]: '4',
    [`${NUMBER} 8 Single_5`]: '18',
    [`${CHECK} 4_2`]: true,
    'Single centro baixo 6_2': '+6',
    [`${CHECK} 4_3`]: true,
    'Single centro baixo 6_3': '+8',
    // Twice the bonus without the box is a typo, not expertise.
    'Single centro baixo 6_4': '+8',
  }))!;
  assert.deepEqual(input.skills, ['arcana', 'history']);
  assert.deepEqual(input.expertise, ['history']);
});

test('written totals become adjustments over the derived values', () => {
  const { input } = sheetFromOfficialPdf(sheet({
    [`${NUMBER} 8 Single_2`]: '4',
    [`${NUMBER} 8 Single_13`]: '14',
    [`${NUMBER} 8 Single_5`]: '18',
    [`${NUMBER} 8 Single_7`]: '12',
    [`${NUMBER} 12 Single_2`]: '+7',
    [`${NUMBER} 12 Single_4`]: '12',
    'Caixa de texto 4': 'Inteligência',
    'Caixa de texto 1_33': '+7',
  }))!;
  assert.equal(input.initiativeBonus, 5);
  assert.equal(input.passivePerceptionBonus, 1);
  assert.equal(input.spellcastingAbility, 'intelligence');
  assert.equal(input.spellBonus, 1);
});

test('an empty ability score defaults to 10 with a warning', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet({ [`${NUMBER} 8 Single_15`]: '' }))!;
  assert.equal(input.abilityScores.strength, 10);
  assert.deepEqual(warnings, ['Alguns valores de atributo estavam vazios e ficaram em 10.']);
});

test('the current hit points stand in for an outdated maximum', () => {
  const { input } = sheetFromOfficialPdf(sheet({ 'Esquerda baixo 12': '18', 'Esquerda baixo 12_5': '7' }))!;
  assert.equal(input.hp, 18);
});

test('speed in feet is converted to meters', () => {
  assert.equal(sheetFromOfficialPdf(sheet({ [`${NUMBER} 12 Single_3`]: '30 ft' }))!.input.speed, 9);
  assert.equal(sheetFromOfficialPdf(sheet({ [`${NUMBER} 12 Single_3`]: '10,5 m' }))!.input.speed, 10.5);
});

test('lists split on semicolons and lines, dropping stray punctuation', () => {
  const { input } = sheetFromOfficialPdf(hazin)!;
  assert.deepEqual(input.features, ['Furia', 'Defesa sem Armadura', 'Sentido de Perigo']);
  assert.deepEqual(input.feats, ['Atacante Selvagem', 'Robusto']);
});

test('an item too long for the platform is cut and reported', () => {
  const long = `Força na Fúria: ${'a'.repeat(250)}`;
  const { input, warnings } = sheetFromOfficialPdf(sheet({ 'Multi esquerda 10_2': long }))!;
  assert.equal(input.features[0]!.length, 200);
  assert.match(warnings[0]!, /"Força na Fúria"/);
});

test('attacks split the damage dice from the damage type', () => {
  const { input } = sheetFromOfficialPdf(sheet({
    'Caixa de texto 1_4': 'Machado Grande',
    'Caixa de texto 1_3': '+7',
    'Caixa de texto 1': '1d12 + 5 Cortante',
    'Caixa de texto 1_8': 'Sopro',
    'Caixa de texto 1_7': 'CD 13',
    'Caixa de texto 1_5': '2d6',
    // The fourth row has three overlapping widgets; the filled one counts.
    'Caixa de texto 1_20': 'Adaga',
    'Caixa de texto 1_17': '1d4',
  }))!;
  assert.deepEqual(input.attacks, [
    { name: 'Machado Grande', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: '' },
    { name: 'Sopro', bonus: 0, damage: '2d6', damageType: '', notes: '' },
    { name: 'Adaga', bonus: 0, damage: '1d4', damageType: '', notes: '' },
  ]);
});

test('spells read the circle, and a "Truque:" prefix as circle 0', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet({
    'Magias Esq': 'Truque: Raio de Fogo',
    'C#C3#ADrculo e Tempo de Conjura#C3#A7#C3#A3o_2': '1',
    'Magias Esq_4': 'Escudo Arcano',
    'Caixa de texto 3_2': 'Reação',
    'Magias Esq_5': 'Pessoal',
    [`${CHECK} 1_7`]: true,
    'Magias Esq_7': 'Sono',
    Text1: '4',
    Text10: '9',
  }))!;
  assert.deepEqual(input.spells.map(({ level, name }) => [level, name]), [
    [0, 'Raio de Fogo'],
    [1, 'Escudo Arcano'],
    [1, 'Sono'],
  ]);
  assert.equal(input.spells[1]!.castingTime, 'Reação');
  assert.equal(input.spells[1]!.range, 'Pessoal');
  assert.equal(input.spells[1]!.material, true);
  assert.deepEqual(input.spellSlotTotals, [4, 3, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(warnings, ['Sem círculo na ficha, ficaram no 1º: Sono.']);
});
