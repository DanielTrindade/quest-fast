import test from 'node:test';
import assert from 'node:assert/strict';
import { AREA_LIMITS, type AreaView, type GridSettings, type SceneFog, type TokenView } from '@quest-fast/shared';
import { createAreaPreviewStore } from '../src/lib/area-preview.ts';
import { areasForLook, describeGeometry, draftGeometry, mayChangeArea } from '../src/lib/area-tool.ts';

const grid: GridSettings = { enabled: true, cellSize: 10, offsetX: 0, offsetY: 0, snap: true, opacity: 0.6 };

test('a circle follows the pointer onto an intersection', () => {
  const area = draftGeometry({ mode: 'reference', shape: 'sphere', size: 6, width: 9 }, { x: 0, y: 0 }, { x: 34, y: 46 }, grid);
  assert.deepEqual(area, { shape: 'sphere', size: 6, width: 1.5, x: 30, y: 50, angle: 0 });
});

test('a cone keeps its origin where the press began and points at the pointer', () => {
  const east = draftGeometry({ mode: 'reference', shape: 'cone', size: 4.5, width: 1.5 }, { x: 21, y: 19 }, { x: 80, y: 20 }, grid);
  assert.deepEqual([east.x, east.y, east.angle], [20, 20, 0]);
  const south = draftGeometry({ mode: 'reference', shape: 'line', size: 9, width: 3 }, { x: 20, y: 20 }, { x: 20, y: 90 }, grid);
  assert.deepEqual([south.angle, south.width], [90, 3]);
});

test('a cube grows towards the quarter the pointer is in', () => {
  const tool = { mode: 'reference' as const, shape: 'cube' as const, size: 3, width: 1.5 };
  assert.equal(draftGeometry(tool, { x: 20, y: 20 }, { x: 40, y: 40 }, grid).angle, 0, 'south-east');
  assert.equal(draftGeometry(tool, { x: 20, y: 20 }, { x: 0, y: 40 }, grid).angle, 90, 'south-west');
  assert.equal(draftGeometry(tool, { x: 20, y: 20 }, { x: 0, y: 0 }, grid).angle, 180, 'north-west');
  assert.equal(draftGeometry(tool, { x: 20, y: 20 }, { x: 40, y: 0 }, grid).angle, 270, 'north-east');
});

test('an area is described in metres, a line with its width', () => {
  assert.equal(describeGeometry({ shape: 'sphere', size: 6, width: 1.5 }), 'Esfera de 6 m');
  assert.equal(describeGeometry({ shape: 'line', size: 18, width: 1.5 }), 'Linha de 18 m × 1,5 m');
});

const area = (fields: Partial<AreaView>): AreaView => ({
  id: 'a', shape: 'sphere', size: 3, width: 1.5, x: 100, y: 100, angle: 0, name: 'Teia', tint: 'slate',
  createdBy: { userId: 'master', name: 'Lia' }, hidden: false, anchorTokenId: null, ...fields,
});

test('whoever made an area and the master may change it', () => {
  assert.equal(mayChangeArea(area({}), { id: 'master', master: true }), true);
  assert.equal(mayChangeArea(area({ createdBy: { userId: 'p1', name: 'Rafael' } }), { id: 'p1', master: false }), true);
  assert.equal(mayChangeArea(area({}), { id: 'p1', master: false }), false);
  assert.equal(mayChangeArea(area({}), { id: null, master: false }), false);
});

test('the master sees faded what the table does not get, and as a player not at all', () => {
  const fog: SceneFog = { enabled: true, revealed: [[[[0, 0], [200, 0], [200, 200], [0, 200], [0, 0]]]] };
  const token = { id: 't', kind: 'free', hidden: true, combatantHidden: false, x: 50, y: 50 } as TokenView;
  const areas = [
    area({ id: 'shown' }),
    area({ id: 'hidden', hidden: true }),
    area({ id: 'fogged', x: 500 }),
    area({ id: 'players', x: 500, createdBy: { userId: 'p1', name: 'Rafael' } }),
    area({ id: 'anchored', anchorTokenId: 't' }),
  ];
  const master = areasForLook(areas, [token], { fog, look: 'master', master: true, viewerId: 'master' });
  assert.equal(master.areas.length, 5);
  assert.deepEqual([...master.faded].sort(), ['anchored', 'fogged', 'hidden']);
  const asPlayer = areasForLook(areas, [token], { fog, look: 'player', master: true, viewerId: 'master' });
  assert.deepEqual(asPlayer.areas.map(({ id }) => id), ['shown', 'players']);
  // A player's screen shows what the server sent, as it came.
  const player = areasForLook(areas.slice(0, 1), [], { fog, look: 'player', master: false, viewerId: 'p1' });
  assert.equal(player.areas.length, 1);
});

const preview = (userId: string, done: boolean, area: AreaView | null = null) => ({
  type: 'area.previewing' as const,
  sceneId: 's1',
  by: { userId, name: userId },
  area: area && { shape: area.shape, size: area.size, width: area.width, x: area.x, y: area.y, angle: area.angle },
  done,
  ts: 0,
});

test('a reference area stands while drawn, lingers once let go, and a clear takes it away', () => {
  const store = createAreaPreviewStore();
  let woken = 0;
  store.subscribe(() => { woken += 1; });
  store.push(preview('bia', false, area({})), 1000);
  assert.equal(store.shown('s1', 1000).length, 1);
  assert.equal(store.shown('other', 1000).length, 0, 'only on its scene');
  // Silent while drawn: its author left, or it went under the fog.
  assert.equal(store.shown('s1', 1000 + AREA_LIMITS.previewStaleMs + 1).length, 0);

  store.push(preview('bia', true, area({})), 5000);
  assert.equal(store.shown('s1', 5000 + AREA_LIMITS.previewStaleMs + 1).length, 1, 'let go: it lingers');
  assert.equal(store.animating(5000 + 100), true);
  assert.equal(store.shown('s1', 5000 + AREA_LIMITS.previewLingerMs + 1).length, 0);

  store.push(preview('rafael', false, area({})), 9000);
  store.push(preview('rafael', false), 9010);
  assert.equal(store.shown('s1', 9010).length, 0);
  assert.equal(woken, 4);
});

test('a lost connection drops every reference area', () => {
  const store = createAreaPreviewStore();
  store.push(preview('bia', true, area({})), 0);
  store.reset();
  assert.equal(store.shown('s1', 1).length, 0);
});
