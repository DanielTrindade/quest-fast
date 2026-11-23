import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from './range.ts';

test('a single distance reads in metres, comma or point, with or without the unit', () => {
  assert.deepEqual(parseRange('1,5 m'), { normal: 1.5, long: null });
  assert.deepEqual(parseRange('18 m'), { normal: 18, long: null });
  assert.deepEqual(parseRange(' 9 metros '), { normal: 9, long: null });
  assert.deepEqual(parseRange('4.5m'), { normal: 4.5, long: null });
  assert.deepEqual(parseRange('36'), { normal: 36, long: null });
});

test('a thrown or ranged weapon reads its normal and long range', () => {
  assert.deepEqual(parseRange('6/18 m'), { normal: 6, long: 18 });
  assert.deepEqual(parseRange('24 / 96 m'), { normal: 24, long: 96 });
  // The same distance twice is a single range.
  assert.deepEqual(parseRange('9/9 m'), { normal: 9, long: null });
});

test('feet turn into metres as the rules do', () => {
  assert.deepEqual(parseRange('30 ft'), { normal: 9, long: null });
  assert.deepEqual(parseRange('20/60 pés'), { normal: 6, long: 18 });
});

test('what is not just a distance stays text', () => {
  for (const text of ['', 'Toque', 'Pessoal', 'Pessoal (cone de 4,5 m)', 'Visão', '18 km', '0 m', '18/6 m', 'Alcance 3 m']) {
    assert.equal(parseRange(text), null, text);
  }
});
