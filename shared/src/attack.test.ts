import test from 'node:test';
import assert from 'node:assert/strict';
import { criticalExpression, halfDamage, isHit, rollAttackHit, rollDamage } from './attack.ts';
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
