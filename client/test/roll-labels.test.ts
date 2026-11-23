import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDecomposition, rolledDice } from '../src/lib/roll-labels.ts';

test('a roll reads its dice, its modifier and, apart, the situational modifier', () => {
  const roll = { dice: [{ value: 14, sides: 20 }], modifier: 5 };
  assert.equal(rollDecomposition(roll), '14 + 5');
  const blessed = { ...roll, bonus: { expression: '+1d4', dice: [{ value: 3, sides: 4 }], modifier: 0, total: 3 } };
  assert.equal(rollDecomposition(blessed), '14 + 5 + 3 (+1d4)');
  assert.deepEqual(rolledDice(blessed).map((die) => die.sides), [20, 4]);
  const baned = { ...roll, bonus: { expression: '-1d4', dice: [{ value: 2, sides: 4, negative: true as const }], modifier: 0, total: -2 } };
  assert.equal(rollDecomposition(baned), '14 + 5 − 2 (-1d4)');
});
