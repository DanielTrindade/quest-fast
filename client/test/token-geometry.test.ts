import test from 'node:test';
import assert from 'node:assert/strict';
import { HIT_SLOP, MIN_TOKEN_RADIUS, restingPoint, screenRadius, stepToken, toMapPoint, toScreenPoint, tokenAt } from '../src/lib/token-geometry.ts';

const GRID = { enabled: true, cellSize: 50, offsetX: 0, offsetY: 0, snap: true };
const MAP = { width: 1000, height: 600 };
const VIEW = { x: 100, y: 20, scale: 0.5 };

test('screen and map points convert both ways', () => {
  assert.deepEqual(toMapPoint(VIEW, { x: 150, y: 70 }), { x: 100, y: 100 });
  assert.deepEqual(toScreenPoint(VIEW, { x: 100, y: 100 }), { x: 150, y: 70 });
});

test('a token is never smaller than a dot on screen', () => {
  assert.equal(screenRadius('large', 50, 0.5), 25);
  assert.equal(screenRadius('tiny', 50, 0.05), MIN_TOKEN_RADIUS);
});

test('the token drawn on top wins the hit, with some slop around small ones', () => {
  const tokens = [
    { id: 'below', x: 100, y: 100, size: 'large' as const },
    { id: 'above', x: 110, y: 100, size: 'medium' as const },
  ];
  assert.equal(tokenAt(tokens, { x: 155, y: 70 }, VIEW, 50)?.id, 'above');
  // On the large one's edge, outside the medium one.
  assert.equal(tokenAt(tokens, { x: 128, y: 70 }, VIEW, 50)?.id, 'below');
  assert.equal(tokenAt(tokens, { x: 150 + 25 + HIT_SLOP + 1, y: 70 }, VIEW, 50), null);
});

test('a token rests on the grid and on the map', () => {
  assert.deepEqual(restingPoint({ x: 61, y: 12 }, GRID, 'medium', MAP), { x: 75, y: 25 });
  assert.deepEqual(restingPoint({ x: 2000, y: -40 }, GRID, 'large', MAP), { x: 1000, y: 0 });
});

test('an arrow moves a token one cell, and not off the map', () => {
  assert.deepEqual(stepToken({ x: 75, y: 25 }, { x: 1, y: 0 }, GRID, 'medium', MAP), { x: 125, y: 25 });
  assert.deepEqual(stepToken({ x: 100, y: 100 }, { x: 0, y: -1 }, GRID, 'large', MAP), { x: 100, y: 50 });
  assert.deepEqual(stepToken({ x: 975, y: 25 }, { x: 1, y: 0 }, GRID, 'medium', MAP), { x: 1000, y: 25 });
});
