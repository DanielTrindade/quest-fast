import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventTime } from '../src/lib/format.ts';

const now = new Date(2026, 10, 10, 22, 47);
const at = (year: number, month: number, day: number) => new Date(year, month, day, 18, 5).toISOString();

test('an event from today shows only the time', () => {
  assert.equal(formatEventTime(at(2026, 10, 10), now), '18:05');
});

test('an older event says which day it was', () => {
  assert.equal(formatEventTime(at(2026, 10, 9), now), 'ontem, 18:05');
  assert.equal(formatEventTime(at(2026, 9, 20), now), '20 out., 18:05');
  assert.equal(formatEventTime(at(2025, 9, 20), now), '20 out. 2025, 18:05');
});

test('an invalid date does not reach the screen', () => {
  assert.equal(formatEventTime('não é data', now), '—');
});
