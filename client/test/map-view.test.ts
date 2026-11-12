import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SCALE, clampView, fitView, gridCells, gridLines, scaleBounds, visibleRect, zoomAt } from '../src/lib/map-view.ts';

const MAP = { width: 3000, height: 2000 };
const SCREEN = { width: 1000, height: 1000 };
const GRID = { enabled: true, cellSize: 100, offsetX: 0, offsetY: 0, snap: true };

test('framing centres the whole map at the largest scale that fits', () => {
  assert.deepEqual(fitView(MAP, SCREEN), { scale: 1 / 3, x: 0, y: (1000 - 2000 / 3) / 2 });
});

test('zooming keeps the point under the cursor in place', () => {
  const view = { x: 10, y: 20, scale: 0.5 };
  const zoomed = zoomAt(view, 2, 300, 400);
  const before = { x: (300 - view.x) / view.scale, y: (400 - view.y) / view.scale };
  const after = { x: (300 - zoomed.x) / zoomed.scale, y: (400 - zoomed.y) / zoomed.scale };
  assert.deepEqual(after, before);
  assert.equal(zoomed.scale, 1);
});

test('the scale stays between half the framed size and 4×', () => {
  assert.deepEqual(scaleBounds(MAP, SCREEN), { min: 1 / 6, max: MAX_SCALE });
  assert.equal(clampView({ x: 0, y: 0, scale: 100 }, MAP, SCREEN).scale, MAX_SCALE);
  assert.equal(clampView({ x: 0, y: 0, scale: 0.01 }, MAP, SCREEN).scale, 1 / 6);
  // A map smaller than the screen never zooms out below 1:1 by more than half its fit.
  assert.equal(scaleBounds({ width: 100, height: 100 }, SCREEN).min, 1);
});

test('panning keeps a strip of the map on screen', () => {
  const far = clampView({ x: 5000, y: -9000, scale: 1 }, MAP, SCREEN);
  assert.equal(far.x, 1000 - 48);
  assert.equal(far.y, 48 - 2000);
});

test('only the grid lines inside the visible part of the map are drawn', () => {
  const view = { x: -1050, y: -50, scale: 1 };
  assert.deepEqual(visibleRect(view, MAP, SCREEN), { left: 1050, top: 50, right: 2050, bottom: 1050 });
  const { xs, ys } = gridLines(GRID, view, MAP, SCREEN);
  assert.deepEqual(xs, [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]);
  assert.deepEqual(ys, [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
});

test('the offset shifts every line, and an off or too dense grid draws nothing', () => {
  const view = { x: 0, y: 0, scale: 1 };
  assert.deepEqual(gridLines({ ...GRID, offsetX: 30 }, view, MAP, { width: 300, height: 1 }).xs, [30, 130, 230]);
  assert.deepEqual(gridLines({ ...GRID, enabled: false }, view, MAP, SCREEN), { xs: [], ys: [] });
  assert.deepEqual(gridLines(GRID, { ...view, scale: 0.05 }, MAP, SCREEN), { xs: [], ys: [] });
});

test('cells are counted across and down, partial edge cells included', () => {
  assert.deepEqual(gridCells(GRID, MAP), { columns: 30, rows: 20 });
  assert.deepEqual(gridCells({ ...GRID, offsetX: 50 }, MAP), { columns: 31, rows: 20 });
  assert.deepEqual(gridCells({ ...GRID, cellSize: 3000 / 7 }, MAP), { columns: 7, rows: 5 });
});
