import test from 'node:test';
import assert from 'node:assert/strict';
import type { ImportedSheet, SheetImportResult } from './sheet-import.ts';
import { ABILITIES, SKILLS } from './modifiers.ts';
import { statblockFromSheet, type StatblockImportLabels } from './statblock-import.ts';
import { validateStatblockInput } from './validation.ts';

// The client owns the Portuguese labels; here a readable stand-in is enough.
const LABELS: StatblockImportLabels = {
  abilities: Object.fromEntries(ABILITIES.map((ability) => [ability, ability.slice(0, 3)])) as StatblockImportLabels['abilities'],
  skills: Object.fromEntries(SKILLS.map((skill) => [skill, skill])) as StatblockImportLabels['skills'],
};

/** A level 3 human fighter NPC, as the PDF parser hands it over. */
function sheet(overrides: Partial<ImportedSheet> = {}): ImportedSheet {
  return {
    name: 'Capitã Brisa',
    race: 'Humana',
    class: 'Guerreira',
    subclass: 'Campeã',
    background: 'Soldado',
    alignment: 'Leal e Neutra',
    level: 3,
    experience: 900,
    size: 'medium',
    abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    hp: 28,
    ac: 16,
    shield: true,
    speed: 9,
    hitDie: 10,
    initiativeBonus: 0,
    passivePerceptionBonus: 0,
    skills: ['athletics', 'perception'],
    expertise: [],
    saves: ['strength', 'constitution'],
    armorTraining: ['light', 'medium', 'heavy', 'shields'],
    weaponProficiencies: 'Simples e marciais',
    toolProficiencies: '',
    attacks: [
      { kind: 'attack', name: 'Espada longa', bonus: 5, damage: '1d8+3', damageType: 'Cortante', notes: '' },
      { kind: 'attack', name: 'Besta leve', bonus: null, damage: '1d8+2', damageType: 'Perfurante', notes: '' },
    ],
    features: ['Retomar o fôlego', 'Surto de ação'],
    speciesTraits: ['Engenhosa'],
    feats: ['Alerta'],
    spellcastingAbility: null,
    spellBonus: 0,
    spellSlotTotals: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    spells: [],
    appearance: '',
    description: '',
    languages: 'Comum, Anão',
    equipment: '',
    attunedItems: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    ...overrides,
  };
}

const imported = (input: ImportedSheet, warnings: string[] = []): SheetImportResult => ({ input, warnings });

test('the sheet becomes a statblock with the same numbers', () => {
  const { input } = statblockFromSheet(imported(sheet()), LABELS);
  assert.equal(input.name, 'Capitã Brisa');
  assert.equal(input.size, 'medium');
  assert.equal(input.creatureType, 'Humana');
  assert.equal(input.challengeRating, '');
  assert.equal(input.ac, 16);
  assert.equal(input.hpAverage, 28);
  assert.equal(input.speed, '9 m');
  assert.equal(input.initiativeBonus, 0);
  assert.deepEqual(input.abilityScores, sheet().abilityScores);
  assert.equal(input.reactions, '');
});

test('the hit point formula is level dice plus Constitution per level', () => {
  assert.equal(statblockFromSheet(imported(sheet()), LABELS).input.hpFormula, '3d10+6');
  const frail = sheet({ abilityScores: { ...sheet().abilityScores, constitution: 8 }, level: 2, hitDie: 6 });
  assert.equal(statblockFromSheet(imported(frail), LABELS).input.hpFormula, '2d6-2');
  const even = sheet({ abilityScores: { ...sheet().abilityScores, constitution: 10 } });
  assert.equal(statblockFromSheet(imported(even), LABELS).input.hpFormula, '3d10');
});

test('a fractional speed keeps its decimal comma', () => {
  assert.equal(statblockFromSheet(imported(sheet({ speed: 7.5 })), LABELS).input.speed, '7,5 m');
});

test('class, saves, skills, languages and the sheet lists become the traits', () => {
  const { traits } = statblockFromSheet(imported(sheet()), LABELS).input;
  assert.deepEqual(traits.split('\n'), [
    'Classe: Guerreira 3 (Campeã)',
    'Salvaguardas: str +5, con +4',
    'Perícias: athletics +5, perception +3',
    'Idiomas: Comum, Anão',
    'Retomar o fôlego',
    'Surto de ação',
    'Engenhosa',
    'Alerta',
  ]);
});

test('attacks come over as they are, blanks included for the master to fill', () => {
  const { input } = statblockFromSheet(imported(sheet()), LABELS);
  assert.deepEqual(input.attacks, sheet().attacks);
  // The blank bonus is what the validator flags, as on a player's sheet.
  assert.match(validateStatblockInput(input).attacks ?? '', /Bônus de ataque/);
});

test('spellcasting goes to the actions with its DC, attack bonus and spells by circle', () => {
  const caster = sheet({
    spellcastingAbility: 'wisdom',
    spellSlotTotals: [3, 2, 0, 0, 0, 0, 0, 0, 0],
    spells: [
      { level: 1, name: 'Curar ferimentos', castingTime: '', range: '', concentration: false, ritual: false, material: false, notes: '' },
      { level: 0, name: 'Orientação', castingTime: '', range: '', concentration: false, ritual: false, material: false, notes: '' },
      { level: 2, name: 'Arma espiritual', castingTime: '', range: '', concentration: false, ritual: false, material: false, notes: '' },
      { level: 1, name: 'Bênção', castingTime: '', range: '', concentration: false, ritual: false, material: false, notes: '' },
    ],
  });
  assert.deepEqual(statblockFromSheet(imported(caster), LABELS).input.actions.split('\n'), [
    'Conjuração (wis): CD 11, +3 para acertar com magias.',
    'Truques: Orientação',
    '1º círculo (3 espaços): Curar ferimentos, Bênção',
    '2º círculo (2 espaços): Arma espiritual',
  ]);
  assert.equal(statblockFromSheet(imported(sheet()), LABELS).input.actions, '');
});

test('the sheet warnings come first, then the missing challenge rating', () => {
  const { warnings } = statblockFromSheet(imported(sheet(), ['Besta leve: bônus de ataque vazio.']), LABELS);
  assert.equal(warnings[0], 'Besta leve: bônus de ataque vazio.');
  assert.match(warnings.at(-1)!, /não tem nível de desafio/);
});

test('values past the bestiary limits are clamped or cut, and each one is named', () => {
  const { input, warnings } = statblockFromSheet(imported(sheet({
    name: 'N'.repeat(100),
    ac: 45,
    initiativeBonus: 25,
    attacks: Array.from({ length: 22 }, (_, index) => (
      { kind: 'attack' as const, name: `Golpe ${index + 1}`, bonus: 1, damage: '1d4', damageType: '', notes: '' })),
  })), LABELS);
  assert.equal(input.name.length, 80);
  assert.equal(input.ac, 40);
  assert.equal(input.initiativeBonus, 20);
  assert.equal(input.attacks.length, 20);
  for (const pattern of [/O nome passou de 80/, /CA 45 fora do limite/, /iniciativa \+25 fora do limite/, /22 ataques/]) {
    assert.ok(warnings.some((warning) => pattern.test(warning)), String(pattern));
  }
});

test('a complete import passes the statblock validation once the blanks are filled', () => {
  const { input } = statblockFromSheet(imported(sheet({
    attacks: [{ kind: 'attack', name: 'Espada longa', bonus: 5, damage: '1d8+3', damageType: 'Cortante', notes: '' }],
  })), LABELS);
  assert.deepEqual(Object.values(validateStatblockInput(input)).filter(Boolean), []);
});
