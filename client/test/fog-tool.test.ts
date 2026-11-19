import test from 'node:test';
import assert from 'node:assert/strict';
import { FOG_LIMITS } from '@quest-fast/shared';
import { CLOSE_RADIUS, closesPolygon, fogRect, polygonOperation, rectOperation, toMap } from '../src/lib/fog-tool.ts';

const MAP = { width: 1000, height: 800 };
const GRID = { enabled: true, cellSize: 50, offsetX: 10, offsetY: 0, snap: true, opacity: 0.6 };

test('a screen point is read in map pixels', () => {
  assert.deepEqual(toMap({ x: 110, y: 70 }, { x: 10, y: 20, scale: 0.5 }), { x: 200, y: 100 });
});

test('a rectangle grows to the grid lines around the cells it touched', () => {
  assert.deepEqual(fogRect({ x: 70, y: 120 }, { x: 15, y: 30 }, GRID, MAP), { x: 10, y: 0, width: 100, height: 150 });
});

test('a drag inside one cell covers that cell', () => {
  assert.deepEqual(fogRect({ x: 20, y: 20 }, { x: 22, y: 21 }, GRID, MAP), { x: 10, y: 0, width: 50, height: 50 });
});

test('without snapping the rectangle is the drag itself, kept inside the map', () => {
  const free = { ...GRID, snap: false };
  assert.deepEqual(fogRect({ x: 20.5, y: 30 }, { x: 70, y: 90.25 }, free, MAP), { x: 20.5, y: 30, width: 49.5, height: 60.25 });
  assert.deepEqual(fogRect({ x: -40, y: 700 }, { x: 30, y: 900 }, free, MAP), { x: 0, y: 700, width: 30, height: 100 });
  assert.deepEqual(fogRect({ x: 980, y: 0 }, { x: 1200, y: 10 }, GRID, MAP), { x: 960, y: 0, width: 40, height: 50 }, 'snapped, cut at the edge');
});

test('a rectangle under a pixel sends nothing', () => {
  assert.equal(rectOperation('reveal', { x: 5, y: 5, width: 0.5, height: 20 }), null);
  assert.deepEqual(rectOperation('hide', { x: 5, y: 5, width: 2, height: 20 }), { mode: 'hide', shape: { kind: 'rect', x: 5, y: 5, width: 2, height: 20 } });
});

test('a press near the first point closes a polygon of three points or more', () => {
  const view = { x: 0, y: 0, scale: 2 };
  const points = [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 60 }];
  assert.equal(closesPolygon(points, { x: 20 + CLOSE_RADIUS - 1, y: 20 }, view), true);
  assert.equal(closesPolygon(points, { x: 20 + CLOSE_RADIUS + 1, y: 20 }, view), false);
  assert.equal(closesPolygon(points.slice(0, 2), { x: 20, y: 20 }, view), false, 'two points are not a polygon');
});

test('a polygon is sent with its points, within the limits', () => {
  const points = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }];
  assert.deepEqual(polygonOperation('reveal', points), { mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [5, 0], [5, 5]] } });
  assert.equal(polygonOperation('reveal', points.slice(0, 2)), null);
  assert.equal(polygonOperation('reveal', Array.from({ length: FOG_LIMITS.maxPoints + 1 }, (_, i) => ({ x: i, y: i % 2 }))), null);
});
