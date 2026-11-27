import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_LIMITS,
  anchorReach,
  areaCells,
  areaOutline,
  isAreaMeasure,
  isAreaVisible,
  normalizeAngle,
  snapAreaOrigin,
  validateAreaGeometry,
  validateAreaInput,
  validateAreaPatch,
  type AreaCell,
  type AreaGeometry,
  type AreaVisibility,
} from './areas.ts';
import type { GridSettings, MultiPolygon } from './battlefield.ts';
import type { SceneFog } from './fog.ts';

/** 1,5 m = 10 px, so a metre is easy to follow in the tests. */
const grid: GridSettings = { enabled: true, cellSize: 10, offsetX: 0, offsetY: 0, snap: true, opacity: 0.6 };
const map = { width: 1000, height: 1000 };

const area = (overrides: Partial<AreaGeometry>): AreaGeometry => ({
  shape: 'sphere',
  size: 3,
  width: 1.5,
  x: 500,
  y: 500,
  angle: 0,
  ...overrides,
});

const key = ({ column, row }: AreaCell) => `${column},${row}`;
const keys = (cells: AreaCell[]) => new Set(cells.map(key));

test('a measure is whole squares of 1,5 m up to the limit', () => {
  assert.equal(isAreaMeasure(1.5), true);
  assert.equal(isAreaMeasure(6), true);
  assert.equal(isAreaMeasure(AREA_LIMITS.maxMeters), true);
  assert.equal(isAreaMeasure(0), false);
  assert.equal(isAreaMeasure(1e-9), false, 'zero squares, however close');
  assert.equal(isAreaMeasure(0.75), false);
  assert.equal(isAreaMeasure(2), false);
  assert.equal(isAreaMeasure(AREA_LIMITS.maxMeters + 1.5), false);
  assert.equal(isAreaMeasure(Number.NaN), false);
  assert.equal(isAreaMeasure('3'), false);
});

test('the angle wraps, a cube turns by quarters and a circle has none', () => {
  assert.equal(normalizeAngle('cone', 370), 10);
  assert.equal(normalizeAngle('line', -90), 270);
  assert.equal(normalizeAngle('cube', 100), 90);
  assert.equal(normalizeAngle('cube', 359), 0);
  assert.equal(normalizeAngle('sphere', 45), 0);
  assert.equal(normalizeAngle('cylinder', 45), 0);
});

test('the origin snaps to the nearest intersection, with the grid offset', () => {
  assert.deepEqual(snapAreaOrigin(14, 26, grid), { x: 10, y: 30 });
  assert.deepEqual(snapAreaOrigin(14, 26, { ...grid, offsetX: 3, offsetY: 7 }), { x: 13, y: 27 });
  assert.deepEqual(snapAreaOrigin(14, 26, { ...grid, enabled: false }), { x: 14, y: 26 });
});

test('a sphere of 3 m on an intersection takes the four by four squares around it, corners cut', () => {
  const cells = keys(areaCells(area({ size: 3 }), grid, map));
  const expected = new Set<string>();
  for (let column = 48; column < 52; column++) {
    for (let row = 48; row < 52; row++) {
      const corner = (column === 48 || column === 51) && (row === 48 || row === 51);
      if (!corner) expected.add(`${column},${row}`);
    }
  }
  assert.deepEqual(cells, expected);
});

test('a sphere of 6 m covers about the circle area in squares', () => {
  const cells = areaCells(area({ size: 6 }), grid, map);
  // r = 4 squares: π·16 ≈ 50; the half rule lands within a few squares of it.
  assert.ok(cells.length >= 44 && cells.length <= 56, String(cells.length));
});

test('a cube takes exactly its squares, towards the side the angle points', () => {
  const east = keys(areaCells(area({ shape: 'cube', size: 3, angle: 0 }), grid, map));
  assert.deepEqual(east, new Set(['50,50', '51,50', '50,51', '51,51']));
  const west = keys(areaCells(area({ shape: 'cube', size: 3, angle: 90 }), grid, map));
  assert.deepEqual(west, new Set(['48,50', '49,50', '48,51', '49,51']));
});

test('a line of 9 m by 1,5 m along the grid takes six squares in a row', () => {
  const cells = areaCells(area({ shape: 'line', size: 9, width: 1.5, y: 505, angle: 0 }), grid, map);
  assert.deepEqual(keys(cells), new Set(['50,50', '51,50', '52,50', '53,50', '54,50', '55,50']));
});

test('a diagonal line takes the squares along the diagonal', () => {
  const cells = keys(areaCells(area({ shape: 'line', size: 9, width: 1.5, angle: 45 }), grid, map));
  assert.ok(cells.has('50,50'));
  assert.ok(cells.has('53,53'));
  assert.equal(cells.has('50,53'), false);
});

test('a cone of 4,5 m east takes the squares it covers by half, none behind the tip', () => {
  // Next to the tip the cone covers only a quarter of each square; at its end, the middle two.
  const cells = keys(areaCells(area({ shape: 'cone', size: 4.5, angle: 0 }), grid, map));
  assert.deepEqual(cells, new Set(['51,49', '52,49', '51,50', '52,50']));
});

test('the squares follow the grid offset', () => {
  const shifted = { ...grid, offsetX: 3, offsetY: 7 };
  const cells = keys(areaCells(area({ shape: 'cube', size: 3, x: 503, y: 507 }), shifted, map));
  assert.deepEqual(cells, new Set(['50,50', '51,50', '50,51', '51,51']));
});

test('the squares stop at the edge of the map', () => {
  const cells = areaCells(area({ size: 3, x: 0, y: 0 }), grid, map);
  assert.deepEqual(keys(cells), new Set(['0,0', '1,0', '0,1']));
});

test('without a grid the area takes no squares, but still has an outline', () => {
  const off = { ...grid, enabled: false };
  assert.deepEqual(areaCells(area({}), off, map), []);
  assert.ok(areaOutline(area({}), off).length > 3);
});

test('an area following a token reaches from its edge', () => {
  assert.equal(anchorReach(null), 0);
  assert.equal(anchorReach('medium'), 0.75);
  assert.equal(anchorReach('large'), 1.5);
  // Spirit Guardians, 4,5 m from a medium creature on a square's centre.
  const cells = keys(areaCells(area({ size: 4.5, x: 505, y: 505 }), grid, map, anchorReach('medium')));
  for (const reached of ['47,50', '53,50', '50,47', '50,53']) assert.ok(cells.has(reached), reached);
  assert.equal(cells.has('46,50'), false);
});

test('an outline is in map pixels, scaled by the cell size', () => {
  const [tip] = areaOutline(area({ shape: 'cone', size: 3, angle: 90 }), grid);
  assert.deepEqual(tip, [500, 500]);
  const line = areaOutline(area({ shape: 'line', size: 3, width: 1.5, angle: 0 }), { cellSize: 20 });
  assert.deepEqual(line.map(([x, y]) => [Math.round(x), Math.round(y)]), [[500, 490], [540, 490], [540, 510], [500, 510]]);
});

test('the geometry of a client is read and normalised', () => {
  const result = validateAreaGeometry({ shape: 'cube', size: 3, x: 1, y: 2, angle: 95 });
  assert.deepEqual(result, { geometry: { shape: 'cube', size: 3, width: 1.5, x: 1, y: 2, angle: 90 } });
  const line = validateAreaGeometry({ shape: 'line', size: 18, width: 3, x: 0, y: 0, angle: 30 });
  assert.ok('geometry' in line && line.geometry.width === 3);
  const sphereWidth = validateAreaGeometry({ shape: 'sphere', size: 6, width: 9, x: 0, y: 0 });
  assert.ok('geometry' in sphereWidth && sphereWidth.geometry.width === 1.5, 'width only means something on a line');
  for (const bad of [
    null,
    { shape: 'star', size: 3, x: 0, y: 0 },
    { shape: 'sphere', size: 2, x: 0, y: 0 },
    { shape: 'sphere', size: 3, x: '0', y: 0 },
    { shape: 'line', size: 3, width: 1, x: 0, y: 0 },
    { shape: 'sphere', size: 1e-9, x: 0, y: 0 },
    { shape: 'line', size: 3, width: 1e-9, x: 0, y: 0 },
    { shape: 'cone', size: 3, x: 0, y: 0, angle: Infinity },
  ]) {
    assert.ok('error' in validateAreaGeometry(bad), JSON.stringify(bad));
  }
});

test('a new area needs a name and a colour of the palette', () => {
  const base = { shape: 'sphere', size: 6, x: 10, y: 10, tint: 'crimson' };
  const ok = validateAreaInput({ ...base, name: '  Névoa  ' });
  assert.ok('input' in ok);
  assert.equal(ok.input.name, 'Névoa');
  assert.equal(ok.input.hidden, false);
  assert.equal(ok.input.anchorTokenId, null);
  assert.ok('error' in validateAreaInput({ ...base, name: '' }));
  assert.ok('error' in validateAreaInput({ ...base, name: 'x'.repeat(AREA_LIMITS.name + 1) }));
  assert.ok('error' in validateAreaInput({ ...base, name: 'Teia', tint: '#ff0000' }));
  assert.ok('error' in validateAreaInput({ ...base, name: 'Teia', hidden: 'yes' }));
  assert.ok('error' in validateAreaInput({ ...base, name: 'Teia', anchorTokenId: '' }));
  const anchored = validateAreaInput({ ...base, name: 'Espírito Guardião', anchorTokenId: 't1' });
  assert.ok('input' in anchored && anchored.input.anchorTokenId === 't1');
});

test('a change to an area is read field by field', () => {
  assert.deepEqual(validateAreaPatch({ x: 1, y: 2 }, 'sphere'), { patch: { x: 1, y: 2 } });
  assert.deepEqual(validateAreaPatch({ angle: 400 }, 'cone'), { patch: { angle: 40 } });
  assert.deepEqual(validateAreaPatch({ name: ' Teia ', tint: 'emerald', hidden: true }, 'cube'), {
    patch: { name: 'Teia', tint: 'emerald', hidden: true },
  });
  assert.ok('error' in validateAreaPatch({}, 'sphere'));
  assert.ok('error' in validateAreaPatch({ x: 1 }, 'sphere'), 'both coordinates');
  assert.ok('error' in validateAreaPatch({ tint: 'pink' }, 'sphere'));
  assert.ok('error' in validateAreaPatch({ name: '' }, 'sphere'));
});

const halfRevealed: MultiPolygon = [[[[0, 0], [500, 0], [500, 1000], [0, 1000], [0, 0]]]];
const fog: SceneFog = { enabled: true, revealed: halfRevealed };

const visibility = (overrides: Partial<AreaVisibility>): AreaVisibility => ({
  hidden: false,
  byMaster: true,
  anchor: null,
  x: 100,
  y: 100,
  ...overrides,
});

test('the master sees every area', () => {
  assert.equal(isAreaVisible(visibility({ hidden: true, x: 900 }), 'master', fog), true);
});

test('a player never receives a hidden area', () => {
  assert.equal(isAreaVisible(visibility({ hidden: true }), 'player', fog), false);
  assert.equal(isAreaVisible(visibility({ hidden: true, byMaster: false }), 'player', null), false);
});

test('an area of the master under the fog hides like a monster; a player area shows', () => {
  assert.equal(isAreaVisible(visibility({ x: 100 }), 'player', fog), true);
  assert.equal(isAreaVisible(visibility({ x: 900 }), 'player', fog), false);
  assert.equal(isAreaVisible(visibility({ x: 900 }), 'player', { ...fog, enabled: false }), true);
  assert.equal(isAreaVisible(visibility({ x: 900, byMaster: false }), 'player', fog), true);
});

test('an area following a token shows only with the token', () => {
  const token = { kind: 'free' as const, hidden: false, combatantHidden: false, x: 900, y: 100 };
  assert.equal(isAreaVisible(visibility({ anchor: token, x: 100 }), 'player', fog), false, 'token under the fog');
  assert.equal(isAreaVisible(visibility({ anchor: { ...token, x: 100 }, x: 900 }), 'player', fog), true);
  assert.equal(isAreaVisible(visibility({ anchor: { ...token, x: 100, hidden: true } }), 'player', fog), false);
  assert.equal(isAreaVisible(visibility({ anchor: { ...token, kind: 'combatant', combatantHidden: true, x: 100 } }), 'player', fog), false);
  assert.equal(isAreaVisible(visibility({ anchor: { ...token, kind: 'character' }, byMaster: false }), 'player', fog), true);
});
