import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDrag, routeBetween, stopAtLimit } from '../src/lib/move-path.ts';

const GRID = { cellSize: 50, offsetX: 0, offsetY: 0 };
const at = (column: number, row: number) => ({ x: column * 50 + 25, y: row * 50 + 25 });

test('a route walks one square per step, spreading the diagonals', () => {
  const route = routeBetween(at(0, 0), at(4, 2), GRID);
  assert.equal(route.length, 4);
  assert.deepEqual(route.map(({ x, y }) => ({ x, y })), [at(1, 1), at(2, 1), at(3, 2), at(4, 2)]);
  assert.deepEqual(route.map((step) => step.meters), [1.5, 3, 4.5, 6]);
});

test('a route in place is empty', () => {
  assert.deepEqual(routeBetween(at(2, 2), { x: at(2, 2).x + 10, y: at(2, 2).y }, GRID), []);
});

test('off the grid, a route follows the line', () => {
  const route = routeBetween({ x: 10, y: 10 }, { x: 160, y: 10 }, GRID);
  assert.equal(route.length, 3);
  assert.deepEqual(route.at(-1), { x: 160, y: 10, meters: 4.5 });
});

test('a move past what is left stops on the last square it reaches', () => {
  assert.deepEqual(stopAtLimit(at(0, 0), at(8, 0), GRID, 9), at(6, 0));
  assert.deepEqual(stopAtLimit(at(0, 0), at(5, 5), GRID, 4.5), at(3, 3));
});

test('nothing to cut when the move fits, or when no square does', () => {
  assert.equal(stopAtLimit(at(0, 0), at(6, 0), GRID, 9), null);
  assert.equal(stopAtLimit(at(0, 0), at(3, 0), GRID, 0), null);
});

test('the label says what is left, or how far past and where it stops', () => {
  assert.equal(describeDrag(at(0, 0), at(4, 0), GRID, 9, null), '4 casas, 6 m. Sobram 3 m.');
  assert.equal(describeDrag(at(0, 0), at(1, 0), GRID, 1.5, null), '1 casa, 1,5 m. Sobram 0 m.');
  assert.equal(describeDrag(at(0, 0), at(8, 0), GRID, 9, null), '2 casas além do deslocamento.');
  assert.equal(describeDrag(at(0, 0), at(8, 0), GRID, 9, at(6, 0)), '2 casas além do deslocamento. Para em 6 casas, 9 m.');
  assert.equal(describeDrag(at(0, 0), at(0, 0), GRID, 9, null), 'Fica onde está.');
});
