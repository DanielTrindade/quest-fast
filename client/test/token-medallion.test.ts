import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE, darken, detailLevel, lighten, liftScale, metalOf, parseHex, shapeVertices } from '../src/lib/token-medallion.ts';

test('each origin has its own silhouette', () => {
  assert.deepEqual(new Set(Object.values(SHAPE)).size, 3);
  assert.equal(shapeVertices('round', 20), null);
  assert.equal(shapeVertices('octagon', 20)?.length, 8);
});

test('a small creature has fewer, wider teeth', () => {
  assert.equal(shapeVertices('toothed', 30)?.length, 28);
  assert.equal(shapeVertices('toothed', 12)?.length, 16);
});

test('the silhouette stays within its radius, its first tooth on top', () => {
  for (const shape of ['toothed', 'octagon'] as const) {
    for (const point of shapeVertices(shape, 20)!) assert.ok(Math.hypot(point.x, point.y) <= 20 + 1e-9);
  }
  const [top] = shapeVertices('toothed', 20)!;
  assert.ok(Math.abs(top!.x) < 1e-9 && Math.abs(top!.y + 20) < 1e-9);
});

test('detail drops as the token shrinks on screen', () => {
  assert.equal(detailLevel(30), 2);
  assert.equal(detailLevel(22), 2);
  assert.equal(detailLevel(16), 1);
  assert.equal(detailLevel(10), 0);
});

test('raised grows 4%, landing sinks to no less than 97%', () => {
  assert.equal(liftScale(0), 1);
  assert.equal(liftScale(1), 1.04);
  assert.equal(liftScale(-1), 0.97);
  assert.ok(liftScale(-0.02) < 1 && liftScale(-0.02) > 0.97);
});

test('colours mix toward white and black, and pass through what they cannot read', () => {
  assert.deepEqual(parseHex('#7B8290'), [123, 130, 144]);
  assert.equal(parseHex('rgba(0, 0, 0, 0.5)'), null);
  assert.equal(lighten('#000000', 0.5), '#808080');
  assert.equal(darken('#ffffff', 0.5), '#808080');
  assert.equal(lighten('color-mix(in srgb, red, blue)', 0.5), 'color-mix(in srgb, red, blue)');
});

test('every metal comes from the control grey, lighter for characters and darker for creatures', () => {
  const control = '#7b8290';
  const brightness = (colour: string) => parseHex(colour)!.reduce((sum, channel) => sum + channel, 0);
  assert.equal(metalOf('free', control), control);
  assert.ok(brightness(metalOf('character', control)) > brightness(control));
  assert.ok(brightness(metalOf('combatant', control)) < brightness(control));
});
