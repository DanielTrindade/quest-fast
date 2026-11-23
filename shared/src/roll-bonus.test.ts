import test from 'node:test';
import assert from 'node:assert/strict';
import { rollAttackHit, rollDamage } from './attack.ts';
import { bonusFits, parseRollBonus, readRollBonus, rollBonus, rollTest } from './roll-bonus.ts';

/** Each call gives the next face of a die of `sides`, as `Math.random` would land. */
function faces(...values: Array<[value: number, sides: number]>) {
  let index = 0;
  return () => {
    const [value, sides] = values[index++]!;
    return (value - 0.5) / sides;
  };
}

test('a modifier is dice and a number with signs, a negative die included', () => {
  assert.deepEqual(parseRollBonus('+1d4'), { groups: [{ count: 1, sides: 4, sign: 1 }], modifier: 0 });
  assert.deepEqual(parseRollBonus('-1d4'), { groups: [{ count: 1, sides: 4, sign: -1 }], modifier: 0 });
  assert.deepEqual(parseRollBonus('+2'), { groups: [], modifier: 2 });
  assert.deepEqual(parseRollBonus('-2'), { groups: [], modifier: -2 });
  assert.deepEqual(parseRollBonus('1d4-1'), { groups: [{ count: 1, sides: 4, sign: 1 }], modifier: -1 });
  assert.deepEqual(parseRollBonus(' + 1d6 + 2d4 - 1 '), { groups: [{ count: 1, sides: 6, sign: 1 }, { count: 2, sides: 4, sign: 1 }], modifier: -1 });
});

test('what is not a modifier is refused', () => {
  for (const text of ['', 'abc', '1d4 2', '+1d1', '+1d101', '+101', '+0d4', '1d4+', '+1d4'.repeat(11), `+${'1'.repeat(41)}`]) {
    assert.equal(parseRollBonus(text), undefined, text);
  }
});

test('a negative die counts against the total, and the expression keeps the signs', () => {
  const blessed = rollBonus(parseRollBonus('-1d4+2')!, {}, faces([3, 4]));
  assert.deepEqual(blessed, { expression: '-1d4+2', dice: [{ value: 3, sides: 4, negative: true }], modifier: 2, total: -1 });
});

test('the modifier goes into the test total, while the natural stays the d20\'s', () => {
  const roll = rollTest(5, 'normal', parseRollBonus('+1d4')!, faces([20, 20], [2, 4]));
  assert.equal(roll.natural, 20);
  assert.equal(roll.total, 27);
  assert.deepEqual(roll.bonus, { expression: '+1d4', dice: [{ value: 2, sides: 4 }], modifier: 0, total: 2 });
  // Perdição can take a test below 0.
  assert.equal(rollTest(-1, 'normal', parseRollBonus('-1d4')!, faces([1, 20], [4, 4])).total, -4);
});

test('advantage keeps the higher d20; the modifier is rolled once', () => {
  const roll = rollAttackHit(4, 'advantage', faces([5, 20], [17, 20], [3, 4]), parseRollBonus('+1d4')!);
  assert.equal(roll.total, 17 + 4 + 3);
  assert.equal(roll.critical, false);
  assert.equal(roll.bonus?.dice.length, 1);
});

test('on a critical the modifier\'s damage dice double too, its number does not', () => {
  const damage = rollDamage('1d8+3', true, faces([8, 8], [8, 8], [6, 6], [6, 6]), parseRollBonus('+1d6+1')!);
  assert.equal(damage?.expression, '2d8+3');
  assert.equal(damage?.bonus?.expression, '+2d6+1');
  assert.equal(damage?.total, 16 + 3 + 12 + 1);
});

test('damage with the modifier never drops below 0', () => {
  assert.equal(rollDamage('1d4', false, faces([1, 4], [6, 6]), parseRollBonus('-1d6')!)?.total, 0);
});

test('the limits hold for the roll and its modifier together', () => {
  assert.equal(bonusFits({ dice: 90, modifier: 0 }, parseRollBonus('+10d6')!), true);
  assert.equal(bonusFits({ dice: 90, modifier: 0 }, parseRollBonus('+11d6')!), false);
  // A critical doubles both.
  assert.equal(bonusFits({ dice: 45, modifier: 0 }, parseRollBonus('+5d6')!, true), true);
  assert.equal(bonusFits({ dice: 45, modifier: 0 }, parseRollBonus('+6d6')!, true), false);
  assert.equal(bonusFits({ dice: 1, modifier: 99 }, parseRollBonus('+2')!), false);
  assert.equal(rollDamage('50d6', true, Math.random, parseRollBonus('+1d6')!), undefined);
});

test('a request reads both modifiers, empty ones add nothing, and anything else refuses it', () => {
  assert.deepEqual(readRollBonus(undefined), {});
  assert.deepEqual(readRollBonus({ roll: '  ', damage: '' }), {});
  const read = readRollBonus({ roll: '+1d4', damage: '+1d6' });
  assert.ok(!('error' in read));
  assert.equal(read.roll?.groups[0]?.sides, 4);
  assert.equal(read.damage?.groups[0]?.sides, 6);
  for (const value of ['+1d4', { roll: 4 }, { damage: 'muito' }]) {
    assert.ok('error' in readRollBonus(value), JSON.stringify(value));
  }
});
