import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCharacterInput } from './validation.ts';
import type { CharacterInput } from './api.ts';

function validInput(overrides: Partial<CharacterInput> = {}): CharacterInput {
  return {
    name: 'Elara Sombravil',
    race: 'Meio-elfa',
    class: 'Ladina',
    level: 3,
    abilityScores: { strength: 10, dexterity: 18, constitution: 13, intelligence: 12, wisdom: 8, charisma: 14 },
    hp: 24,
    ac: 15,
    skills: ['stealth'],
    saves: ['dexterity'],
    attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
    features: ['Ataque Furtivo 2d6'],
    description: '',
    avatarAssetId: null,
    ...overrides,
  };
}

test('a complete sheet is valid', () => {
  assert.deepEqual(validateCharacterInput(validInput()), {});
});

test('each required field is reported next to the field', () => {
  const errors = validateCharacterInput(
    validInput({ name: '  ', race: '', class: '', level: 0, hp: 1000, ac: 41 }),
  );
  assert.equal(errors.name, 'Informe o nome do personagem.');
  assert.equal(errors.race, 'Informe a espécie.');
  assert.equal(errors.class, 'Informe a classe.');
  assert.equal(errors.level, 'Nível deve ser um número entre 1 e 20.');
  assert.equal(errors.hp, 'PV máximo deve ser um número entre 1 e 999.');
  assert.equal(errors.ac, 'CA deve ser um número entre 0 e 40.');
});

test('ability scores outside the 1–30 band are rejected as a group', () => {
  const errors = validateCharacterInput(
    validInput({ abilityScores: { ...validInput().abilityScores, strength: 31 } }),
  );
  assert.equal(errors.abilityScores, 'Atributos devem ser números entre 1 e 30.');
});

test('an attack without a name or with an unparseable damage is rejected', () => {
  const errors = validateCharacterInput(
    validInput({ attacks: [{ name: ' ', bonus: 0, damage: '1d8+3' }, { name: 'Soco', bonus: -1, damage: 'soco' }] }),
  );
  assert.equal(errors.attacks, 'Cada ataque precisa de nome e de dano como expressão (ex.: 1d8+3).');
});

test('an attack bonus outside the server bound is rejected', () => {
  const errors = validateCharacterInput(validInput({ attacks: [{ name: 'Adaga', bonus: 21, damage: '1d4+4' }] }));
  assert.equal(errors.attacks, 'Bônus de ataque deve ser um número entre -20 e 20.');
});

test('the official sheet fields are optional', () => {
  const input = validInput();
  assert.equal(input.subclass, undefined);
  assert.deepEqual(validateCharacterInput(input), {});
});

test('expertise requires proficiency in the same skill', () => {
  const errors = validateCharacterInput(validInput({ skills: ['stealth'], expertise: ['stealth', 'acrobatics'] }));
  assert.equal(errors.expertise, 'Especialização exige proficiência na perícia.');
  assert.deepEqual(validateCharacterInput(validInput({ skills: ['stealth'], expertise: ['stealth'] })), {});
});

test('identity and combat values outside their bounds are reported', () => {
  const errors = validateCharacterInput(
    validInput({ experience: -1, speed: 61, initiativeBonus: 11, passivePerceptionBonus: -11, subclass: 'x'.repeat(61) }),
  );
  assert.ok(errors.experience);
  assert.ok(errors.speed);
  assert.ok(errors.initiativeBonus);
  assert.ok(errors.passivePerceptionBonus);
  assert.ok(errors.subclass);
});

test('spell slots respect each circle cap and spells need a name and a circle', () => {
  assert.ok(validateCharacterInput(validInput({ spellSlotTotals: [5, 0, 0, 0, 0, 0, 0, 0, 0] })).spellSlotTotals);
  assert.ok(validateCharacterInput(validInput({ spellSlotTotals: [4, 3] })).spellSlotTotals);
  const spell = { level: 1, name: 'Mísseis Mágicos', castingTime: '1 ação', range: '36 m', concentration: false, ritual: false, material: false, notes: '' };
  assert.deepEqual(validateCharacterInput(validInput({ spellSlotTotals: [4, 3, 3, 3, 3, 2, 2, 1, 1], spells: [spell] })), {});
  assert.ok(validateCharacterInput(validInput({ spells: [{ ...spell, level: 10 }] })).spells);
  assert.ok(validateCharacterInput(validInput({ spells: [{ ...spell, name: ' ' }] })).spells);
});

test('a fourth attuned item and negative coins are refused', () => {
  const errors = validateCharacterInput(
    validInput({ attunedItems: ['a', 'b', 'c', 'd'], coins: { cp: 0, sp: 0, ep: 0, gp: -1, pp: 0 } }),
  );
  assert.equal(errors.attunedItems, 'Um personagem se sintoniza com até 3 itens.');
  assert.ok(errors.coins);
});

test('the boundaries themselves are valid', () => {
  const input = validInput({ level: 20, hp: 999, ac: 0, abilityScores: { ...validInput().abilityScores, strength: 30 } });
  assert.deepEqual(validateCharacterInput(input), {});
});