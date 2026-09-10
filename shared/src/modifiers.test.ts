import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, SKILLS, abilityModifier, proficiencyBonus, skillAbility } from './modifiers.ts';

test('the modifier is floor((score - 10) / 2)', () => {
  assert.equal(abilityModifier(1), -5);
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(9), -1);
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(11), 0);
  assert.equal(abilityModifier(12), 1);
  assert.equal(abilityModifier(14), 2);
  assert.equal(abilityModifier(20), 5);
  assert.equal(abilityModifier(30), 10);
});

test('every ability of the fixed list is present', () => {
  assert.deepEqual(ABILITIES, [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ]);
});

test('every skill maps to the ability that governs it in 5e', () => {
  const expected: Record<string, string> = {
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
  };

  for (const skill of SKILLS) {
    assert.equal(skillAbility(skill), expected[skill], skill);
  }
  // No extra skill beyond the fixed list leaks in.
  assert.equal(SKILLS.length, Object.keys(expected).length);
});

test('the proficiency bonus follows the standard table by level', () => {
  assert.equal(proficiencyBonus(1), 2);
  assert.equal(proficiencyBonus(4), 2);
  assert.equal(proficiencyBonus(5), 3);
  assert.equal(proficiencyBonus(8), 3);
  assert.equal(proficiencyBonus(9), 4);
  assert.equal(proficiencyBonus(12), 4);
  assert.equal(proficiencyBonus(13), 5);
  assert.equal(proficiencyBonus(16), 5);
  assert.equal(proficiencyBonus(17), 6);
  assert.equal(proficiencyBonus(20), 6);
});

test('invalid scores and levels yield no modifier instead of a nonsense one', () => {
  assert.equal(abilityModifier(0), undefined);
  assert.equal(abilityModifier(31), undefined);
  assert.equal(proficiencyBonus(0), undefined);
  assert.equal(proficiencyBonus(21), undefined);
});