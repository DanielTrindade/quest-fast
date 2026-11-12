import test from 'node:test';
import assert from 'node:assert/strict';
import type { RollPayload } from '@quest-fast/shared';
import { attackHeadline, attackOutcome, canRollDamage, damageText, showsAttackRoll } from '../src/lib/attack-feed.ts';

const base: RollPayload = {
  kind: 'roll',
  expression: '1d20+5',
  dice: [{ value: 12, sides: 20 }],
  modifier: 5,
  total: 17,
  mode: 'normal',
  rollKind: 'attack',
  attackName: 'Espada longa',
  characterName: 'Kaelen',
  attackerSource: 'character',
};
const goblin = { combatantId: 'g2', name: 'Goblin 2', source: 'monster' } as const;
const slash = { expression: '1d8+3', dice: [{ value: 6, sides: 8 }], modifier: 3, total: 9, damageType: 'Cortante' };

test('a hit reads with its target, the AC the master sees and the damage', () => {
  const hit: RollPayload = { ...base, target: { ...goblin, hit: true, ac: 15 }, damage: slash };
  assert.equal(attackHeadline(hit), 'Kaelen atacou Goblin 2 com Espada longa');
  assert.equal(attackOutcome(hit), 'Acertou (CA 15)');
  assert.equal(damageText(hit), '9 cortante (1d8+3)');
  assert.equal(showsAttackRoll(hit), true);
});

test('a player reads a hit on a monster without its AC', () => {
  assert.equal(attackOutcome({ ...base, target: { ...goblin, hit: true } }), 'Acertou');
  assert.equal(attackOutcome({ ...base, target: { ...goblin, hit: false } }), 'Errou');
});

test("a monster's attack, as a player reads it, keeps only totals", () => {
  const redacted: RollPayload = {
    ...base,
    expression: '',
    dice: [],
    modifier: 0,
    total: 0,
    characterName: 'Goblin 1',
    attackName: 'Cimitarra',
    attackerSource: 'monster',
    target: { combatantId: 'k1', name: 'Kaelen', source: 'character', hit: true, ac: 15 },
    critical: true,
    damage: { expression: '', dice: [], modifier: 0, total: 14, damageType: 'Cortante' },
    redacted: true,
  };
  assert.equal(showsAttackRoll(redacted), false);
  assert.equal(damageText(redacted), '14 cortante');
});

test('an attack against a save reads with its DC', () => {
  const breath: RollPayload = {
    ...base,
    attackName: 'Sopro de fogo',
    save: { dc: 13, ability: 'dexterity' },
    target: { ...goblin, hit: true },
    damage: { ...slash, expression: '2d6', total: 7, damageType: 'Fogo' },
  };
  assert.equal(attackHeadline(breath), 'Kaelen usou Sopro de fogo em Goblin 2');
  assert.equal(attackOutcome(breath), 'CD 13 de Destreza');
  assert.equal(damageText(breath), '7 fogo (2d6)');
  assert.equal(showsAttackRoll(breath), false);
});

test('without a target the damage waits, once, and reads as its own roll later', () => {
  const pending: RollPayload = { ...base, damageRollable: { expression: '1d8+3', damageType: 'Cortante' } };
  assert.equal(attackHeadline(pending), 'Kaelen atacou com Espada longa');
  assert.equal(attackOutcome(pending), null);
  assert.equal(canRollDamage(pending), true);
  assert.equal(canRollDamage({ ...pending, damageRolled: true }), false);

  const later: RollPayload = { ...base, damageOf: 'a1', damage: { ...slash, damageType: '' } };
  assert.equal(attackHeadline(later), 'Dano de Kaelen com Espada longa');
  assert.equal(damageText(later), '9 de dano (1d8+3)');
  assert.equal(showsAttackRoll(later), false);
});
