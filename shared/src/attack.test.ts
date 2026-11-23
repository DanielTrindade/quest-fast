import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criticalExpression,
  damageAfterSave,
  failsSaveOutright,
  halfDamage,
  isHit,
  rollAttackHit,
  rollDamage,
  rollSave,
  saveConditions,
  saveModifiers,
  storedAttack,
} from './attack.ts';
import { DICE_COUNT_LIMIT } from './dice.ts';

// `random` returns a value in [0, 1); `face(n, sides)` makes that die land on n.
const face = (n: number, sides: number) => (n - 1) / sides + 1e-9;
const seq = (...values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
};

test('an attack roll is 1d20 plus the bonus', () => {
  const roll = rollAttackHit(5, 'normal', seq(face(12, 20)));
  assert.equal(roll.expression, '1d20+5');
  assert.equal(roll.total, 17);
  assert.equal(roll.critical, false);
});

test('a negative bonus is written with its sign', () => {
  const roll = rollAttackHit(-1, 'normal', seq(face(10, 20)));
  assert.equal(roll.expression, '1d20-1');
  assert.equal(roll.total, 9);
});

test('a natural 20 is a critical', () => {
  const roll = rollAttackHit(3, 'normal', seq(face(20, 20)));
  assert.equal(roll.natural, 20);
  assert.equal(roll.critical, true);
});

test('a discarded 20 under disadvantage is not a critical', () => {
  const roll = rollAttackHit(3, 'disadvantage', seq(face(20, 20), face(7, 20)));
  assert.equal(roll.total, 10);
  assert.equal(roll.critical, false);
  assert.deepEqual(roll.dice.map((die) => [die.value, die.discarded ?? false]), [[20, true], [7, false]]);
});

test('advantage keeps the 20 and makes it a critical', () => {
  const roll = rollAttackHit(3, 'advantage', seq(face(4, 20), face(20, 20)));
  assert.equal(roll.critical, true);
});

test('a tie with the AC hits, as in the D20 Test', () => {
  assert.equal(isHit({ total: 15 }, 15), true);
  assert.equal(isHit({ total: 14 }, 15), false);
  assert.equal(isHit({ total: 16 }, 15), true);
});

test('a natural 20 hits any AC and a natural 1 misses any AC', () => {
  assert.equal(isHit({ total: 22, natural: 20 }, 30), true);
  assert.equal(isHit({ total: 13, natural: 1 }, 5), false);
});

test('a critical doubles the dice and keeps the modifier', () => {
  assert.equal(criticalExpression('2d6+3'), '4d6+3');
  assert.equal(criticalExpression('1d8 + 3 + 1d6'), '2d8+2d6+3');
  assert.equal(criticalExpression('1d4-1'), '2d4-1');
  assert.equal(criticalExpression('1d12'), '2d12');
});

test('a critical over the dice limit is refused, not cut', () => {
  const half = DICE_COUNT_LIMIT / 2;
  assert.equal(criticalExpression(`${half}d6`), `${DICE_COUNT_LIMIT}d6`);
  assert.equal(criticalExpression(`${half + 1}d6`), undefined);
  assert.equal(rollDamage(`${half + 1}d6`, true), undefined);
});

test('an invalid damage expression rolls nothing', () => {
  assert.equal(criticalExpression('espada'), undefined);
  assert.equal(rollDamage('espada', false), undefined);
});

test('damage rolls the expression as written', () => {
  const damage = rollDamage('1d8+3', false, seq(face(5, 8)));
  assert.deepEqual(damage, { expression: '1d8+3', dice: [{ value: 5, sides: 8 }], modifier: 3, total: 8 });
});

test('critical damage rolls the doubled dice once each', () => {
  const damage = rollDamage('1d8+3', true, seq(face(5, 8), face(2, 8)));
  assert.deepEqual(damage, {
    expression: '2d8+3',
    dice: [{ value: 5, sides: 8 }, { value: 2, sides: 8 }],
    modifier: 3,
    total: 10,
  });
});

test('damage never drops below zero', () => {
  assert.equal(rollDamage('1d4-3', false, seq(face(1, 4)))!.total, 0);
});

test('half damage rounds down', () => {
  assert.equal(halfDamage(7), 3);
  assert.equal(halfDamage(8), 4);
  assert.equal(halfDamage(1), 0);
});

test('a stored attack without the newer fields reads with their defaults', () => {
  assert.deepEqual(storedAttack({ name: 'Adaga', bonus: 4, damage: '1d4+2' } as never), {
    name: 'Adaga', bonus: 4, damage: '1d4+2', kind: 'attack', damageType: '', notes: '', range: '', cost: 'attack',
  });
  assert.equal(storedAttack({ kind: 'attack', name: 'Adaga', bonus: 4, damage: '1d4', range: '6/18 m' }).range, '6/18 m');
  const save = storedAttack({ kind: 'save', name: 'Bola de Fogo', dc: 15, saveAbility: 'dexterity', damage: '8d6', damageType: 'Fogo', notes: '' });
  assert.equal(save.cost, 'action');
  assert.equal(save.kind === 'save' && save.onSave, 'half');
  const cantrip = storedAttack({ kind: 'save', name: 'Chama Sagrada', dc: 13, saveAbility: 'dexterity', damage: '1d8', onSave: 'none' });
  assert.equal(cantrip.kind === 'save' && cantrip.onSave, 'none');
  assert.equal(storedAttack({ kind: 'attack', name: 'Adaga', bonus: 4, damage: '1d4', cost: 'bonusAction' }).cost, 'bonusAction');
});

test('a save passes on a total equal to the DC or above it, and a natural 20 or 1 decides nothing', () => {
  assert.deepEqual(rollSave(2, 15, false, seq(face(13, 20))), { d20: 13, modifier: 2, total: 15, success: true });
  assert.equal(rollSave(2, 15, false, seq(face(12, 20))).success, false);
  // Only an attack roll has the natural 20 and 1 rule.
  assert.equal(rollSave(-5, 16, false, seq(face(20, 20))).success, false);
  assert.equal(rollSave(15, 10, false, seq(face(1, 20))).success, true);
});

test('a save failed outright rolls no die', () => {
  assert.deepEqual(rollSave(10, 5, true, seq(face(20, 20))), { outright: true, success: false });
});

test('Paralyzed, Petrified, Stunned, Unconscious and 0 hit points fail Strength and Dexterity saves', () => {
  assert.equal(failsSaveOutright('dexterity', [{ condition: 'paralyzed' }], false), true);
  assert.equal(failsSaveOutright('strength', [{ condition: 'stunned' }], false), true);
  assert.equal(failsSaveOutright('dexterity', [], true), true);
  assert.equal(failsSaveOutright('wisdom', [{ condition: 'unconscious' }], true), false);
  assert.equal(failsSaveOutright('dexterity', [{ condition: 'prone' }], false), false);
});

test('the damage after a save: all on a failure, half rounded down or none on a success', () => {
  assert.equal(damageAfterSave(27, false, 'half'), 27);
  assert.equal(damageAfterSave(27, true, 'half'), 13);
  assert.equal(damageAfterSave(27, true, 'none'), 0);
  assert.equal(damageAfterSave(9, false, 'none'), 9);
});

test("a creature's save modifiers: the book's bonus where it has one, the ability modifier otherwise", () => {
  const scores = { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 12, charisma: 6 };
  assert.deepEqual(saveModifiers(scores, { dexterity: 6, wisdom: 3 }), {
    strength: -1, dexterity: 6, constitution: 0, intelligence: 0, wisdom: 3, charisma: -2,
  });
});

test('Exhaustion takes 2 per level off a save, and Restrained gives disadvantage on Dexterity only', () => {
  assert.deepEqual(saveConditions('wisdom', [{ condition: 'exhaustion', level: 2 }]), { mode: 'normal', penalty: 4 });
  assert.deepEqual(saveConditions('dexterity', [{ condition: 'restrained' }]), { mode: 'disadvantage', penalty: 0 });
  assert.deepEqual(saveConditions('strength', [{ condition: 'restrained' }]), { mode: 'normal', penalty: 0 });
});

test('a save under Exhaustion can fail where the bare modifier would pass', () => {
  const save = rollSave(2, 13, false, seq(face(11, 20)), { mode: 'normal', penalty: 2 });
  assert.deepEqual(save, { d20: 11, modifier: 0, total: 11, success: false, penalty: 2 });
});

test('a save under disadvantage keeps the lower die and records both', () => {
  const save = rollSave(2, 13, false, seq(face(19, 20), face(1, 20)), { mode: 'disadvantage', penalty: 0 });
  assert.deepEqual(save, { d20: 1, modifier: 2, total: 3, success: false, mode: 'disadvantage', rolls: [19, 1] });
});
