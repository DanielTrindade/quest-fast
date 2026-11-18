import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_CROP_MAX_ZOOM,
  avatarCropRect,
  clampAvatarCrop,
  defaultAvatarCrop,
  parseAvatarCrop,
  zoomAvatarCrop,
} from './avatar-crop.ts';

test('a crop with fractions inside the image is accepted', () => {
  assert.deepEqual(parseAvatarCrop({ x: 0.25, y: 0, size: 1 }), { x: 0.25, y: 0, size: 1 });
  assert.deepEqual(parseAvatarCrop({ x: 0, y: 0.5, size: 1 / AVATAR_CROP_MAX_ZOOM, extra: 1 }), {
    x: 0, y: 0.5, size: 1 / AVATAR_CROP_MAX_ZOOM,
  });
});

test('a crop out of range or of the wrong shape is refused', () => {
  for (const value of [
    null, 'x', [], {}, { x: 0, y: 0 },
    { x: '0', y: 0, size: 1 },
    { x: -0.1, y: 0, size: 1 },
    { x: 0, y: 1.1, size: 1 },
    { x: 0, y: 0, size: 0 },
    { x: 0, y: 0, size: 1.5 },
    { x: 0, y: 0, size: 0.01 },
    { x: Number.NaN, y: 0, size: 1 },
    { x: 0, y: Number.POSITIVE_INFINITY, size: 1 },
  ]) {
    assert.equal(parseAvatarCrop(value), null, JSON.stringify(value));
  }
});

test('the default crop is the largest square, centred across and leaning to the top', () => {
  assert.deepEqual(defaultAvatarCrop(200, 100), { size: 1, x: 0.25, y: 0 });
  const portrait = defaultAvatarCrop(100, 300);
  assert.equal(portrait.x, 0);
  assert.deepEqual(avatarCropRect(portrait, 100, 300), { left: 0, top: 40, side: 100 });
});

test('clamping keeps the square inside the image', () => {
  assert.deepEqual(clampAvatarCrop({ x: 0.9, y: 0.9, size: 0.5 }, 200, 100), { x: 0.75, y: 0.5, size: 0.5 });
  assert.deepEqual(clampAvatarCrop({ x: -1, y: -1, size: 9 }, 100, 100), { x: 0, y: 0, size: 1 });
});

test('zooming keeps the centre of the square in place', () => {
  const zoomed = zoomAvatarCrop({ x: 0, y: 0, size: 1 }, 0.5, 100, 100);
  assert.deepEqual(zoomed, { x: 0.25, y: 0.25, size: 0.5 });
  // Zooming out near an edge slides the square back inside.
  assert.deepEqual(zoomAvatarCrop({ x: 0.5, y: 0.5, size: 0.5 }, 1, 100, 100), { x: 0, y: 0, size: 1 });
});

test('the pixel rectangle is whole, inside the image and at least 1 px', () => {
  assert.deepEqual(avatarCropRect({ x: 0.5, y: 0, size: 1 }, 200, 100), { left: 100, top: 0, side: 100 });
  assert.deepEqual(avatarCropRect({ x: 1, y: 1, size: 1 }, 200, 100), { left: 100, top: 0, side: 100 });
  assert.deepEqual(avatarCropRect({ x: 0, y: 0, size: 0.2 }, 3, 3), { left: 0, top: 0, side: 1 });
});
