import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDiceExpression,
  rollDice,
  type DieResult,
} from './dice.ts';

// `random` returns a value in [0, 1). A fixed value makes the roll deterministic.
const at = (v: number) => () => v;
const seq = (...values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

test('parses the canonical NdM form', () => {
  assert.deepEqual(parseDiceExpression('1d20'), { count: 1, sides: 20, modifier: 0 });
  assert.deepEqual(parseDiceExpression('2d6'), { count: 2, sides: 6, modifier: 0 });
  assert.deepEqual(parseDiceExpression('3d8'), { count: 3, sides: 8, modifier: 0 });
});

test('parses an optional signed modifier', () => {
  assert.deepEqual(parseDiceExpression('1d20+5'), { count: 1, sides: 20, modifier: 5 });
  assert.deepEqual(parseDiceExpression('2d6-1'), { count: 2, sides: 6, modifier: -1 });
  assert.deepEqual(parseDiceExpression('1d20 + 4'), { count: 1, sides: 20, modifier: 4 });
  assert.deepEqual(parseDiceExpression('2d6 - 3'), { count: 2, sides: 6, modifier: -3 });
});

test('parses the letter d case-insensitively', () => {
  assert.deepEqual(parseDiceExpression('1D20'), { count: 1, sides: 20, modifier: 0 });
  assert.deepEqual(parseDiceExpression('1D20+2'), { count: 1, sides: 20, modifier: 2 });
});

test('rejects expressions that are not NdM with optional modifier', () => {
  const invalid = [
    '',
    '   ',
    'd20',
    '20',
    '1d',
    '1d0',
    '0d20',
    '1d1',
    '1d20+',
    '1d20-',
    '1d20+5+2',
    '1d20x',
    'abc',
    '1.5d6',
    '2 d6',
    '1d20 + 5 2',
  ];
  for (const input of invalid) {
    assert.equal(parseDiceExpression(input), undefined, `expected ${JSON.stringify(input)} to be rejected`);
  }
});

test('rolls a single die and applies the modifier', () => {
  const result = rollDice('1d20+5', 'normal', at(0.5));
  assert.ok(result);
  assert.equal(result.total, 16); // 11 + 5
  assert.deepEqual(result.dice, [{ value: 11, sides: 20 }]);
  assert.equal(result.modifier, 5);
  assert.equal(result.mode, 'normal');
  assert.equal(result.natural, undefined);
});

test('rolls every die of the group', () => {
  const result = rollDice('2d6+3', 'normal', seq(0.25, 0.75));
  assert.ok(result);
  assert.equal(result.total, 10); // 2 + 5 + 3
  assert.deepEqual(result.dice, [
    { value: 2, sides: 6 },
    { value: 5, sides: 6 },
  ]);
});

test('a modifier-less expression adds zero', () => {
  const result = rollDice('1d20', 'normal', at(0.5));
  assert.ok(result);
  assert.equal(result.total, 11);
});

test('advantage keeps the higher of two d20 and marks the other discarded', () => {
  const result = rollDice('1d20', 'advantage', seq(0.5, 0.9));
  assert.ok(result);
  assert.equal(result.total, 19);
  const [low, high] = result.dice as [DieResult, DieResult];
  assert.deepEqual(high, { value: 19, sides: 20 });
  assert.deepEqual(low, { value: 11, sides: 20, discarded: true });
});

test('disadvantage keeps the lower of two d20', () => {
  const result = rollDice('1d20', 'disadvantage', seq(0.9, 0.5));
  assert.ok(result);
  assert.equal(result.total, 11);
  const [discarded, kept] = result.dice as [DieResult, DieResult];
  assert.deepEqual(discarded, { value: 19, sides: 20, discarded: true });
  assert.deepEqual(kept, { value: 11, sides: 20 });
});

test('a tie under advantage or disadvantage keeps exactly one die', () => {
  for (const mode of ['advantage', 'disadvantage'] as const) {
    const result = rollDice('1d20+2', mode, at(0.5));
    assert.ok(result);
    assert.deepEqual(result.dice, [
      { value: 11, sides: 20 },
      { value: 11, sides: 20, discarded: true },
    ]);
    assert.equal(result.total, 13); // 11 + 2, the tie counted once
  }
});

test('advantage still applies the modifier to the kept die', () => {
  const result = rollDice('1d20+4', 'advantage', seq(0.5, 0.9));
  assert.ok(result);
  assert.equal(result.total, 23); // 19 + 4
});

test('advantage and disadvantage require a single d20', () => {
  assert.equal(rollDice('2d6', 'advantage', at(0.5)), undefined);
  assert.equal(rollDice('2d6', 'disadvantage', at(0.5)), undefined);
  assert.equal(rollDice('1d6', 'advantage', at(0.5)), undefined);
});

test('a natural 20 and a natural 1 are reported on the kept die', () => {
  const naturalTwenty = rollDice('1d20', 'normal', at(0.999));
  assert.ok(naturalTwenty);
  assert.equal(naturalTwenty.natural, 20);
  assert.equal(naturalTwenty.dice[0]?.value, 20);

  const naturalOne = rollDice('1d20', 'normal', at(0));
  assert.ok(naturalOne);
  assert.equal(naturalOne.natural, 1);

  const disadvantage = rollDice('1d20+2', 'disadvantage', seq(0.999, 0));
  assert.ok(disadvantage);
  assert.equal(disadvantage.natural, 1);
  assert.equal(disadvantage.total, 3); // 1 + 2
});

test('an invalid expression yields no result', () => {
  for (const input of ['', 'abc', '1d0', '2d6+']) {
    assert.equal(rollDice(input, 'normal', at(0.5)), undefined, input);
  }
});

test('sides and count are capped so a typo cannot flood the table', () => {
  assert.equal(parseDiceExpression('101d20'), undefined);
  assert.equal(parseDiceExpression('1d101'), undefined);
  assert.equal(parseDiceExpression('1d20+101'), undefined);
});