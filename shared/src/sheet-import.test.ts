import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPdfFields, normalizePdfFieldName, sheetFromOfficialPdf, type PdfFieldValues } from './sheet-import.ts';
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

test('an adjustment beyond the app bounds is kept and flagged, not zeroed', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet({
    [`${NUMBER} 8 Single_13`]: '14',
    [`${NUMBER} 12 Single_2`]: '+14',
  }))!;
  assert.equal(input.initiativeBonus, 12);
  assert.deepEqual(warnings, [
    'Iniciativa +14 na ficha dá um ajuste de +12, fora do limite do aplicativo (-10 a +10). Revise antes de criar.',
  ]);
  assert.ok(validateCharacterInput(input).initiativeBonus);
});

test('spell slots above the sheet boxes are kept and flagged, not reduced', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet({ Text1: '4', Text10: '5' }))!;
  assert.deepEqual(input.spellSlotTotals, [4, 5, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(warnings, [
    'Espaços do 2º círculo: 5 na ficha, fora do limite do aplicativo (0 a 3). Revise antes de criar.',
  ]);
  assert.ok(validateCharacterInput(input).spellSlotTotals);
});

test('fields the reader could not extract are named by editor section', () => {
  const result = sheetFromOfficialPdf(sheet({ 'Magias Esq_4': 'Sono' }), [
    `${NUMBER} 8 Single_15`,
    'Magias Esq',
    // A field the import does not use is not worth a warning.
    `${CHECK} 2`,
  ]);
  assert.ok(result);
  assert.equal(result.input.spells.length, 1);
  assert.equal(
    result.warnings[0],
    'Alguns campos do PDF não puderam ser lidos e ficaram em branco. Revise: Atributos e perícias, Magias.',
  );
});

test('a field that fails to read is listed and the others are kept', () => {
  const { values, unreadable } = collectPdfFields([
    { name: 'Esquerda Centro Single 12', read: () => 'Hazin Dan' },
    { name: `${NUMBER} 8 Single_15`, read: () => { throw new Error('rich text'); } },
    { name: `${CHECK} 4_24`, read: () => true },
    { name: 'Botão', read: () => undefined },
  ]);
  assert.deepEqual(values, { 'Esquerda Centro Single 12': 'Hazin Dan', [`${CHECK} 4_24`]: true });
  assert.deepEqual(unreadable, [`${NUMBER} 8 Single_15`]);
});

test('an unreadable field still counts toward recognizing the sheet', () => {
  const rest = sheet();
  for (const name of ['Esquerda Centro Single 12', 'Text1', 'Text10']) delete rest[name];
  assert.equal(sheetFromOfficialPdf(rest), null);
  assert.ok(sheetFromOfficialPdf(rest, ['Esquerda Centro Single 12', 'Text1', 'Text10']));
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

/** One attack row: name, the "Bônus Atq/CD" column and the damage. */
function attackRow(name: string, bonus: string, damage = '1d6') {
  return { 'Caixa de texto 1_4': name, 'Caixa de texto 1_3': bonus, 'Caixa de texto 1': damage };
}

test('attacks split the damage dice from the damage type', () => {
  const { input } = sheetFromOfficialPdf(sheet({
    ...attackRow('Machado Grande', '+7', '1d12 + 5 Cortante'),
    // The fourth row has three overlapping widgets; the filled one counts.
    'Caixa de texto 1_20': 'Adaga',
    'Caixa de texto 1_19': '+5',
    'Caixa de texto 1_17': '1d4',
  }))!;
  assert.deepEqual(input.attacks, [
    { kind: 'attack', name: 'Machado Grande', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: '' },
    { kind: 'attack', name: 'Adaga', bonus: 5, damage: '1d4', damageType: '', notes: '' },
  ]);
});

test('a composite damage keeps every dice group out of the damage type', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet({
    ...attackRow('Fagulha estelar', '+5', '1d8 + 3 +1d6'),
    'Caixa de texto 1_20': 'Espada flamejante',
    'Caixa de texto 1_19': '+6',
    'Caixa de texto 1_17': '1d8+3 + 1d6 fogo',
  }))!;
  assert.deepEqual(input.attacks.map(({ damage, damageType }) => ({ damage, damageType })), [
    { damage: '1d8+3+1d6', damageType: '' },
    { damage: '1d8+3+1d6', damageType: 'fogo' },
  ]);
  assert.deepEqual(warnings, []);
});

test('a damage the roller cannot read stays whole and is flagged for review', () => {
  for (const damage of [
    '1d8 - 1d6 fogo', 'veja as notas', '200d6',
    // A valid roll up front must not hide a malformed tail.
    '1d8+1d fogo', '1d8+3+', '1d8+3 + fogo', '1d8 fogo + 1d6 frio', '1d8+3 1d6 fogo', '1d8x2',
  ]) {
    const { input, warnings } = sheetFromOfficialPdf(sheet(attackRow('Golpe', '+5', damage)))!;
    assert.equal(input.attacks[0]!.damage, damage, damage);
    assert.equal(input.attacks[0]!.damageType, '', damage);
    assert.equal(warnings.length, 1, damage);
    assert.match(warnings[0]!, /^Golpe: o dano ".+" não é uma rolagem/);
  }
});

test('an attack bonus of +5 or +0 is an attack roll', () => {
  assert.deepEqual(sheetFromOfficialPdf(sheet(attackRow('Adaga', '+5')))!.input.attacks[0], {
    kind: 'attack', name: 'Adaga', bonus: 5, damage: '1d6', damageType: '', notes: '',
  });
  const { input, warnings } = sheetFromOfficialPdf(sheet(attackRow('Soco', '+0')))!;
  assert.equal(input.attacks[0]!.kind === 'attack' && input.attacks[0]!.bonus, 0);
  assert.deepEqual(warnings, []);
});

test('a DC keeps its value as a save, with the ability when the sheet names it', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet(attackRow('Sopro', 'CD 13 Des', '2d6')))!;
  assert.deepEqual(input.attacks[0], {
    kind: 'save', name: 'Sopro', dc: 13, saveAbility: 'dexterity', damage: '2d6', damageType: '', notes: '',
  });
  assert.deepEqual(warnings, []);
  assert.deepEqual(sheetFromOfficialPdf(sheet(attackRow('Sopro', 'Destreza CD 13')))!.input.attacks[0], {
    kind: 'save', name: 'Sopro', dc: 13, saveAbility: 'dexterity', damage: '1d6', damageType: '', notes: '',
  });
});

test('a DC without the ability is kept and flagged for review', () => {
  const { input, warnings } = sheetFromOfficialPdf(sheet(attackRow('Sopro', 'CD 13')))!;
  assert.deepEqual(input.attacks[0], {
    kind: 'save', name: 'Sopro', dc: 13, saveAbility: null, damage: '1d6', damageType: '', notes: '',
  });
  assert.deepEqual(warnings, ['Sopro: CD 13 sem o atributo da resistência. Escolha o atributo antes de criar.']);
});

test('an empty or unclear bonus is left blank and flagged, never +0', () => {
  const empty = sheetFromOfficialPdf(sheet(attackRow('Raio de Fogo', '', '1d10')))!;
  assert.equal(empty.input.attacks[0]!.kind === 'attack' && empty.input.attacks[0]!.bonus, null);
  assert.deepEqual(empty.warnings, ['Raio de Fogo: bônus de ataque vazio. Preencha o bônus ou a CD antes de criar.']);

  const unclear = sheetFromOfficialPdf(sheet(attackRow('Adaga', 'For ou Des')))!;
  assert.equal(unclear.input.attacks[0]!.kind === 'attack' && unclear.input.attacks[0]!.bonus, null);
  assert.deepEqual(unclear.warnings, ['Adaga: "For ou Des" não é um bônus de ataque nem uma CD. Preencha antes de criar.']);
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
    Text10: '3',
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
