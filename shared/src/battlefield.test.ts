import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRID_COLUMNS,
  LOCK_TTL_MS,
  MAP_LIMITS,
  SCENE_LIMITS,
  TOKEN_KINDS,
  TOKEN_LIMITS,
  canGrab,
  cellSizeFromColumns,
  clampToMap,
  defaultGrid,
  isMapType,
  isTokenKind,
  isTokenVisible,
  lockFor,
  maxGridColumns,
  snapToCell,
  tokenCells,
  tokenDiameter,
  validateGrid,
  type GridSettings,
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
});

test('the default grid passes its own validation on every accepted map width', () => {
  assert.ok(MAP_LIMITS.minSide >= SCENE_LIMITS.minCellSize);
  for (let width = MAP_LIMITS.minSide; width <= MAP_LIMITS.maxOutputSide; width += 1) {
    assert.deepEqual(validateGrid(defaultGrid(width), width), {}, String(width));
  }
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

test('maps are JPEG, PNG or WebP, from 64 px, up to 25 MB and 8192 px, stored at 4096 px', () => {
  assert.equal(MAP_LIMITS.minSide, 64);
  assert.equal(MAP_LIMITS.maxBytes, 25 * 1024 * 1024);
  assert.equal(MAP_LIMITS.maxInputSide, 8192);
  assert.equal(MAP_LIMITS.maxOutputSide, 4096);
  assert.ok(isMapType('image/webp'));
  assert.ok(!isMapType('image/gif'));
  assert.ok(!isMapType(undefined));
});

// --- Tokens ----------------------------------------------------------------

const GRID: GridSettings = { enabled: true, cellSize: 100, offsetX: 0, offsetY: 0, snap: true };

test('a token covers the cells of its size, half a cell for a tiny creature', () => {
  assert.deepEqual(
    (['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const).map(tokenCells),
    [0.5, 1, 1, 2, 3, 4],
  );
  assert.equal(tokenDiameter('large', 70), 140);
  assert.equal(tokenDiameter('tiny', 70), 35);
});

test('an odd size snaps to the centre of the cell under the point', () => {
  assert.deepEqual(snapToCell(130, 290, GRID, 'medium'), { x: 150, y: 250 });
  assert.deepEqual(snapToCell(199, 0, GRID, 'huge'), { x: 150, y: 50 });
  assert.deepEqual(snapToCell(10, 10, GRID, 'tiny'), { x: 50, y: 50 });
});

test('an even size snaps to the nearest junction, covering whole cells', () => {
  assert.deepEqual(snapToCell(130, 260, GRID, 'large'), { x: 100, y: 300 });
  assert.deepEqual(snapToCell(149, 151, GRID, 'gargantuan'), { x: 100, y: 200 });
});

test('the snap follows the offset of the grid drawn on the map', () => {
  const grid = { ...GRID, offsetX: 20, offsetY: 40 };
  assert.deepEqual(snapToCell(130, 130, grid, 'medium'), { x: 170, y: 90 });
  assert.deepEqual(snapToCell(130, 130, grid, 'large'), { x: 120, y: 140 });
  // Left of the offset still lands on a cell of the same grid.
  assert.deepEqual(snapToCell(5, 5, grid, 'medium'), { x: -30, y: -10 });
});

test('without the grid or without snapping, the token stays where it was dropped', () => {
  assert.deepEqual(snapToCell(133.5, 21, { ...GRID, enabled: false }, 'medium'), { x: 133.5, y: 21 });
  assert.deepEqual(snapToCell(133.5, 21, { ...GRID, snap: false }, 'large'), { x: 133.5, y: 21 });
});

test('a token centre is kept on the map', () => {
  assert.deepEqual(clampToMap(-30, 2500, 3000, 2000), { x: 0, y: 2000 });
  assert.deepEqual(clampToMap(1500, 800, 3000, 2000), { x: 1500, y: 800 });
});

test("a free token, an expired lock or one's own lock can be grabbed", () => {
  const lock = lockFor('u1', 1000);
  assert.deepEqual(lock, { userId: 'u1', expiresAt: 1000 + LOCK_TTL_MS });
  assert.equal(LOCK_TTL_MS, 3000);
  assert.equal(canGrab(null, 'u2', 1000), true);
  assert.equal(canGrab(undefined, 'u2', 1000), true);
  assert.equal(canGrab(lock, 'u1', 2000), true);
  assert.equal(canGrab(lock, 'u2', 2000), false);
  assert.equal(canGrab(lock, 'u2', 1000 + LOCK_TTL_MS - 1), false);
  assert.equal(canGrab(lock, 'u2', 1000 + LOCK_TTL_MS), true);
});

test('the master sees every token', () => {
  for (const kind of TOKEN_KINDS) {
    assert.equal(isTokenVisible({ kind, hidden: true, combatantHidden: true }, 'master'), true, kind);
  }
});

test('a player never receives a token hidden on the map', () => {
  for (const kind of TOKEN_KINDS) {
    assert.equal(isTokenVisible({ kind, hidden: true, combatantHidden: false }, 'player'), false, kind);
    assert.equal(isTokenVisible({ kind, hidden: false, combatantHidden: false }, 'player'), true, kind);
  }
});

test('a player never receives the token of a combatant hidden in the encounter', () => {
  assert.equal(isTokenVisible({ kind: 'combatant', hidden: false, combatantHidden: true }, 'player'), false);
  // The flag only concerns combatant tokens: a character's token is its own.
  assert.equal(isTokenVisible({ kind: 'character', hidden: false, combatantHidden: true }, 'player'), true);
});

test('token kinds and limits', () => {
  assert.equal(isTokenKind('free'), true);
  assert.equal(isTokenKind('statblock'), false);
  assert.equal(isTokenKind(1), false);
  assert.deepEqual(TOKEN_LIMITS, { perScene: 200, label: 40 });
});
