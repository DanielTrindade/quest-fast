import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDamage,
  applyHealing,
  emptySpellSlots,
  fitStateToSheet,
  initiative,
  passivePerception,
  saveBonus,
  skillBonus,
  skillProficiency,
  spellAttackBonus,
  spellSaveDc,
  type SheetRules,
} from './sheet.ts';

// Hazin Dan, from the official sheet in rpg_docs: level 4 barbarian.
const hazin: SheetRules = {
  abilityScores: { strength: 20, dexterity: 14, constitution: 19, intelligence: 9, wisdom: 12, charisma: 10 },
  level: 4,
  skills: ['athletics', 'animalHandling', 'acrobatics'],
  expertise: [],
  saves: ['strength', 'constitution'],
  initiativeBonus: 0,
  passivePerceptionBonus: 0,
  spellcastingAbility: null,
  spellBonus: 0,
};

test('skill bonus adds none, one or two times the proficiency bonus', () => {
  assert.equal(skillBonus(hazin, 'athletics'), 7);
  assert.equal(skillBonus(hazin, 'acrobatics'), 4);
  assert.equal(skillBonus(hazin, 'stealth'), 2);
  assert.equal(skillBonus({ ...hazin, expertise: ['acrobatics'] }, 'acrobatics'), 6);
});

test('expertise without proficiency does not count', () => {
  const sheet = { ...hazin, expertise: ['stealth' as const] };
  assert.equal(skillProficiency(sheet, 'stealth'), 'none');
  assert.equal(skillBonus(sheet, 'stealth'), 2);
});

test('saving throws add proficiency only when proficient', () => {
  assert.equal(saveBonus(hazin, 'strength'), 7);
  assert.equal(saveBonus(hazin, 'constitution'), 6);
  assert.equal(saveBonus(hazin, 'dexterity'), 2);
});

test('initiative is the dexterity modifier plus the adjustment', () => {
  assert.equal(initiative(hazin), 2);
  assert.equal(initiative({ ...hazin, initiativeBonus: 4 }), 6);
});

test('passive perception is 10 plus the perception bonus plus the adjustment', () => {
  assert.equal(passivePerception(hazin), 11);
  assert.equal(passivePerception({ ...hazin, skills: [...hazin.skills, 'perception'] }), 13);
  assert.equal(passivePerception({ ...hazin, passivePerceptionBonus: 5 }), 16);
});

test('a character who does not cast has no spell save DC or spell attack', () => {
  assert.equal(spellSaveDc(hazin), null);
  assert.equal(spellAttackBonus(hazin), null);
});

test('spell save DC and spell attack follow the casting ability', () => {
  const cleric = { ...hazin, abilityScores: { ...hazin.abilityScores, wisdom: 16 }, spellcastingAbility: 'wisdom' as const };
  assert.equal(spellSaveDc(cleric), 13);
  assert.equal(spellAttackBonus(cleric), 5);
  assert.equal(spellSaveDc({ ...cleric, spellBonus: 1 }), 14);
  assert.equal(spellAttackBonus({ ...cleric, spellBonus: 1 }), 6);
});

test('temporary hit points soak damage first', () => {
  assert.deepEqual(applyDamage({ hpCurrent: 30, hpTemp: 5 }, 7), { hpCurrent: 28, hpTemp: 0 });
  assert.deepEqual(applyDamage({ hpCurrent: 30, hpTemp: 10 }, 7), { hpCurrent: 30, hpTemp: 3 });
});

test('damage never takes current hit points below zero', () => {
  assert.deepEqual(applyDamage({ hpCurrent: 4, hpTemp: 0 }, 20), { hpCurrent: 0, hpTemp: 0 });
  assert.deepEqual(applyDamage({ hpCurrent: 4, hpTemp: 0 }, -3), { hpCurrent: 4, hpTemp: 0 });
});

test('healing stops at the maximum and leaves temporary hit points alone', () => {
  assert.deepEqual(applyHealing({ hpCurrent: 50, hpTemp: 2 }, 10, 55), { hpCurrent: 55, hpTemp: 2 });
  assert.deepEqual(applyHealing({ hpCurrent: 0, hpTemp: 0 }, 6, 55), { hpCurrent: 6, hpTemp: 0 });
});

test('an edit that lowers the maxima brings the session state within them', () => {
  const slots = emptySpellSlots();
  slots[0] = { total: 4, spent: 3 };
  const fitted = fitStateToSheet(
    { hpCurrent: 55, hitDiceSpent: 4, spellSlots: slots },
    { hp: 40, level: 3, spellSlotTotals: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
  );
  assert.equal(fitted.hpCurrent, 40);
  assert.equal(fitted.hitDiceSpent, 3);
  assert.deepEqual(fitted.spellSlots[0], { total: 2, spent: 2 });
  assert.equal(fitted.spellSlots.length, 9);
});

test('an edit that raises the maxima keeps the session state as it was', () => {
  const fitted = fitStateToSheet(
    { hpCurrent: 20, hitDiceSpent: 1, spellSlots: emptySpellSlots() },
    { hp: 60, level: 5, spellSlotTotals: [4, 3, 2, 0, 0, 0, 0, 0, 0] },
  );
  assert.equal(fitted.hpCurrent, 20);
  assert.equal(fitted.hitDiceSpent, 1);
  assert.deepEqual(fitted.spellSlots.slice(0, 3), [{ total: 4, spent: 0 }, { total: 3, spent: 0 }, { total: 2, spent: 0 }]);
});
