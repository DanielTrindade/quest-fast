import test from 'node:test';
import assert from 'node:assert/strict';
import { isTokenVisible, TOKEN_KINDS, type MultiPolygon, type TokenKind } from './battlefield.ts';
import {
  FOG_LIMITS,
  applyFog,
  fogVertexCount,
  isRevealed,
  scaleFog,
  validateFogOperation,
  type FogOperation,
} from './fog.ts';

const W = 1000;
const H = 800;

function apply(revealed: MultiPolygon, operation: FogOperation): MultiPolygon {
  const result = applyFog(revealed, operation, W, H);
  assert.ok('revealed' in result, 'error' in result ? result.error : '');
  return result.revealed;
}

const rect = (x: number, y: number, width: number, height: number) => ({ kind: 'rect' as const, x, y, width, height });
const reveal = (shape: FogOperation['shape']): FogOperation => ({ mode: 'reveal', shape });
const hide = (shape: FogOperation['shape']): FogOperation => ({ mode: 'hide', shape });

/** Area of the revealed region: outer rings minus holes. */
function area(revealed: MultiPolygon): number {
  const ring = (points: [number, number][]) => {
    let sum = 0;
    for (let i = 1; i < points.length; i++) sum += points[i - 1]![0] * points[i]![1] - points[i]![0] * points[i - 1]![1];
    return Math.abs(sum) / 2;
  };
  return revealed.reduce((total, [outer, ...holes]) => total + ring(outer!) - holes.reduce((h, hole) => h + ring(hole), 0), 0);
}

test('revealing two rooms apart keeps two areas', () => {
  const revealed = apply(apply([], reveal(rect(0, 0, 100, 100))), reveal(rect(300, 300, 50, 50)));
  assert.equal(revealed.length, 2);
  assert.equal(area(revealed), 100 * 100 + 50 * 50);
});

test('overlapping reveals merge into one area', () => {
  const revealed = apply(apply([], reveal(rect(0, 0, 100, 100))), reveal(rect(50, 0, 100, 100)));
  assert.equal(revealed.length, 1);
  assert.equal(area(revealed), 150 * 100);
});

test('hiding inside a revealed area leaves a hole', () => {
  const revealed = apply(apply([], reveal(rect(0, 0, 100, 100))), hide(rect(40, 40, 20, 20)));
  assert.equal(revealed.length, 1);
  assert.equal(revealed[0]!.length, 2, 'outer ring and one hole');
  assert.equal(area(revealed), 100 * 100 - 20 * 20);
  assert.equal(isRevealed(revealed, 50, 50), false);
  assert.equal(isRevealed(revealed, 10, 10), true);
});

test('hiding what was never revealed changes nothing', () => {
  assert.deepEqual(apply([], hide(rect(0, 0, 100, 100))), []);
});

test('revelar tudo covers the map and ocultar tudo empties it', () => {
  const all = apply([], reveal({ kind: 'all' }));
  assert.equal(area(all), W * H);
  assert.deepEqual(apply(all, hide({ kind: 'all' })), []);
});

test('a shape is clipped to the map', () => {
  const revealed = apply([], reveal(rect(-50, -50, 100, 100)));
  assert.equal(area(revealed), 50 * 50);
  assert.deepEqual(apply([], reveal(rect(W + 10, 0, 100, 100))), [], 'entirely outside reveals nothing');
});

test('a polygon is closed by the rule and its coordinates are stored as integers', () => {
  const revealed = apply([], reveal({ kind: 'polygon', points: [[10.4, 10.6], [200.2, 10.1], [100.7, 150.3]] }));
  assert.equal(revealed.length, 1);
  for (const ring of revealed[0]!) {
    for (const [x, y] of ring) {
      assert.ok(Number.isInteger(x) && Number.isInteger(y), `${x}, ${y}`);
    }
    assert.deepEqual(ring[0], ring.at(-1), 'closed ring');
  }
});

test('a self-crossing polygon still reveals its area', () => {
  const revealed = apply([], reveal({ kind: 'polygon', points: [[0, 0], [100, 100], [100, 0], [0, 100]] }));
  assert.equal(area(revealed), 2 * (100 * 50) / 2);
});

test('an operation that leaves the fog too complex is refused', () => {
  // 1980 small rooms apart, 5 points each: 9900 vertices, just under the cap.
  const rooms: MultiPolygon = Array.from({ length: 1980 }, (_, i) => {
    const x = (i % 60) * 16;
    const y = Math.floor(i / 60) * 16;
    return [[[x, y], [x + 4, y], [x + 4, y + 4], [x, y + 4], [x, y]]];
  });
  assert.equal(fogVertexCount(rooms), 9900);
  // A cave of 200 points apart from them would add 201 more.
  const cave: [number, number][] = Array.from({ length: 200 }, (_, k) => {
    const angle = (2 * Math.PI * k) / 200;
    return [500 + 100 * Math.cos(angle), 700 + 60 * Math.sin(angle)];
  });
  const result = applyFog(rooms, reveal({ kind: 'polygon', points: cave }), W, H);
  assert.ok('error' in result);
  assert.match(result.error, /complexo demais/);
  assert.ok('revealed' in applyFog(rooms, reveal(rect(0, 0, 4, 4)), W, H), 'an operation that adds nothing still goes');
});

test('a hole rounded onto the outer edge is merged, so a later operation elsewhere changes nothing there', () => {
  // On a 100 × 100 map, a hole at x = 0.4 rounds onto the room's edge x = 0.
  const map = (revealed: MultiPolygon, operation: FogOperation) => {
    const result = applyFog(revealed, operation, 100, 100);
    assert.ok('revealed' in result);
    return result.revealed;
  };
  const room = map(map([], reveal(rect(0, 0, 10, 10))), hide(rect(0.4, 2, 2, 4)));
  assert.equal(isRevealed(room, 0, 4), false, 'the edge the hole reached is hidden');
  assert.equal(isRevealed(room, 1, 4), false);
  assert.equal(isRevealed(room, 5, 5), true);
  assert.equal(area(room), 10 * 10 - 2 * 4);
  for (const ring of room.flat()) for (const [x, y] of ring) assert.ok(Number.isInteger(x) && Number.isInteger(y));

  for (const operation of [reveal(rect(0, 0, 1, 1)), reveal(rect(20, 20, 2, 2))]) {
    const after = map(room, operation);
    for (const [x, y] of [[0, 4], [1, 4], [2, 4], [5, 5], [0, 1]] as const) {
      assert.equal(isRevealed(after, x, y), isRevealed(room, x, y), `${x}, ${y} after ${JSON.stringify(operation.shape)}`);
    }
  }
});

test('a shape that never settles on integers is refused, leaving the fog as it was', () => {
  // A tiny self-crossing polygon whose crossing keeps landing off the integers.
  const knot = reveal({ kind: 'polygon', points: [[14.7, 2.1], [16.7, 10.6], [15.9, 3.5], [17.9, 18.6]] });
  const result = applyFog([], knot, 100, 100);
  assert.ok('error' in result, 'refused instead of storing a fractional point');
  assert.match(result.error, /Tente desenhá-la de novo/);

  // On top of a revealed room it is refused too, and the room stays.
  const room = apply([], reveal(rect(0, 0, 50, 50)));
  assert.ok('error' in applyFog(room, { mode: 'hide', shape: knot.shape }, 100, 100));

  // Whatever is stored stays on integers, so a far reveal changes nothing near it.
  const far = apply(room, reveal(rect(90, 90, 2, 2)));
  for (const [x, y] of [[15.5, 3.4], [25, 25], [50, 20], [60, 20]] as const) {
    assert.equal(isRevealed(far, x, y), isRevealed(room, x, y), `${x}, ${y}`);
  }
});

test('validateFogOperation reads every shape and refuses broken ones', () => {
  assert.deepEqual(validateFogOperation({ mode: 'reveal', shape: { kind: 'all' } }), { operation: reveal({ kind: 'all' }) });
  assert.deepEqual(validateFogOperation({ mode: 'hide', shape: rect(1, 2, 3, 4) }), { operation: hide(rect(1, 2, 3, 4)) });
  assert.deepEqual(validateFogOperation({ mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [1, 0], [1, 1]], extra: 1 } }), {
    operation: reveal({ kind: 'polygon', points: [[0, 0], [1, 0], [1, 1]] }),
  });
  const tooMany = Array.from({ length: FOG_LIMITS.maxPoints + 1 }, (_, i) => [i, i % 2]);
  for (const value of [
    null,
    [],
    { mode: 'erase', shape: { kind: 'all' } },
    { mode: 'reveal' },
    { mode: 'reveal', shape: { kind: 'circle' } },
    { mode: 'reveal', shape: rect(0, 0, 0.5, 10) },
    { mode: 'reveal', shape: rect(0, Number.NaN, 10, 10) },
    { mode: 'reveal', shape: { kind: 'rect', x: '0', y: 0, width: 10, height: 10 } },
    { mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [1, 1]] } },
    { mode: 'reveal', shape: { kind: 'polygon', points: tooMany } },
    { mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [1, 1], [2, Infinity]] } },
    { mode: 'reveal', shape: { kind: 'polygon', points: [[0, 0], [1, 1], [2]] } },
  ]) {
    assert.ok('error' in validateFogOperation(value), JSON.stringify(value));
  }
});

test('isRevealed: inside, outside, in a hole, and on the edge', () => {
  const revealed = apply(apply([], reveal(rect(0, 0, 100, 100))), hide(rect(40, 40, 20, 20)));
  assert.equal(isRevealed(revealed, 5, 5), true);
  assert.equal(isRevealed(revealed, 150, 5), false);
  assert.equal(isRevealed(revealed, 50, 50), false, 'inside the hole');
  assert.equal(isRevealed(revealed, 100, 50), true, 'outer edge');
  assert.equal(isRevealed(revealed, 40, 50), true, 'edge of the hole');
  assert.equal(isRevealed([], 5, 5), false);
});

test('scaleFog follows the map and clips to it', () => {
  const revealed = apply([], reveal(rect(100, 100, 200, 100)));
  const doubled = scaleFog(revealed, 2, 2, 2000, 1600);
  assert.equal(area(doubled), 400 * 200);
  assert.equal(isRevealed(doubled, 250, 250), true);
  const narrow = scaleFog(revealed, 2, 2, 500, 1600);
  assert.equal(area(narrow), (500 - 200) * 200, 'clipped to the new, narrower map');
  assert.deepEqual(scaleFog([], 2, 2, 2000, 1600), []);
});

test('scaleFog stretches each axis on its own, as the tokens move', () => {
  // 1000 × 800 → 2000 × 800: twice as wide, as tall as before.
  const revealed = apply([], reveal(rect(0, 0, 100, 100)));
  const wider = scaleFog(revealed, 2, 1, 2000, 800);
  assert.equal(area(wider), 200 * 100);
  // A token at (50, 150) goes to (100, 150): still under the fog.
  assert.equal(isRevealed(revealed, 50, 150), false);
  assert.equal(isRevealed(wider, 100, 150), false);
  assert.equal(isRevealed(wider, 150, 50), true);
});

test('with the fog on a player does not receive a token outside the revealed area', () => {
  const fog = { enabled: true, revealed: apply([], reveal(rect(0, 0, 100, 100))) };
  const token = (kind: TokenKind, x: number) => ({ kind, hidden: false, combatantHidden: false, x, y: 50 });
  for (const kind of ['combatant', 'free'] as const) {
    assert.equal(isTokenVisible(token(kind, 50), 'player', fog), true, `${kind} revealed`);
    assert.equal(isTokenVisible(token(kind, 500), 'player', fog), false, `${kind} under the fog`);
    assert.equal(isTokenVisible(token(kind, 500), 'player', { ...fog, enabled: false }), true, `${kind} with the fog off`);
  }
  assert.equal(isTokenVisible(token('character', 500), 'player', fog), true, 'a character always shows');
  assert.equal(isTokenVisible({ ...token('character', 500), hidden: true }, 'player', fog), false, 'unless the master hid it');
  for (const kind of TOKEN_KINDS) assert.equal(isTokenVisible(token(kind, 500), 'master', fog), true, `master sees ${kind}`);
});
