import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRID_COLUMNS,
  MAP_LIMITS,
  SCENE_LIMITS,
  cellSizeFromColumns,
  defaultGrid,
  isMapType,
  maxGridColumns,
  validateGrid,
} from './battlefield.ts';

test('the cell size divides the map width by the number of columns', () => {
  assert.equal(cellSizeFromColumns(3000, 30), 100);
  assert.equal(cellSizeFromColumns(1000, 3), 1000 / 3);
});

test('a new scene has a snapping grid of the default columns', () => {
  assert.deepEqual(defaultGrid(4096), {
    enabled: true,
    cellSize: 4096 / DEFAULT_GRID_COLUMNS,
    offsetX: 0,
    offsetY: 0,
    snap: true,
  });
});

test('a narrow map gets fewer columns so no cell is below the minimum', () => {
  assert.equal(maxGridColumns(100), 12);
  assert.equal(defaultGrid(100).cellSize, 100 / 12);
  assert.ok(defaultGrid(100).cellSize >= SCENE_LIMITS.minCellSize);
  assert.equal(maxGridColumns(4), 1);
});

test('a grid with a cell inside the map and the offset inside a cell is valid', () => {
  assert.deepEqual(validateGrid({ cellSize: 100, offsetX: 0, offsetY: 99.5 }, 3000), {});
  assert.deepEqual(validateGrid({ cellSize: 8, offsetX: 7, offsetY: 0 }, 3000), {});
  assert.deepEqual(validateGrid({ cellSize: 3000, offsetX: 0, offsetY: 0 }, 3000), {});
});

test('a cell below the minimum, wider than the map or not a number is refused', () => {
  for (const cellSize of [7.9, 3001, Number.NaN, Number.POSITIVE_INFINITY]) {
    const errors = validateGrid({ cellSize, offsetX: 0, offsetY: 0 }, 3000);
    assert.ok(errors.cellSize, String(cellSize));
  }
});

test('an offset outside one cell is refused', () => {
  assert.deepEqual(Object.keys(validateGrid({ cellSize: 100, offsetX: 100, offsetY: -1 }, 3000)), ['offsetX', 'offsetY']);
  assert.ok(validateGrid({ cellSize: 100, offsetX: Number.NaN, offsetY: 0 }, 3000).offsetX);
});

test('maps are JPEG, PNG or WebP, up to 25 MB and 8192 px, stored at 4096 px', () => {
  assert.equal(MAP_LIMITS.maxBytes, 25 * 1024 * 1024);
  assert.equal(MAP_LIMITS.maxInputSide, 8192);
  assert.equal(MAP_LIMITS.maxOutputSide, 4096);
  assert.ok(isMapType('image/webp'));
  assert.ok(!isMapType('image/gif'));
  assert.ok(!isMapType(undefined));
});
