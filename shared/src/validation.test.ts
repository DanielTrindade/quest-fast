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
  assert.equal(errors.race, 'Informe a raça.');
  assert.equal(errors.class, 'Informe a classe.');
  assert.equal(errors.level, 'Nível deve ser um número entre 1 e 20.');
  assert.equal(errors.hp, 'HP deve ser um número entre 1 e 999.');
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

test('the boundaries themselves are valid', () => {
  const input = validInput({ level: 20, hp: 999, ac: 0, abilityScores: { ...validInput().abilityScores, strength: 30 } });
  assert.deepEqual(validateCharacterInput(input), {});
});