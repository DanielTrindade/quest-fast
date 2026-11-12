import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { testImageBytes } from '../testing.ts';
import { normaliseMap } from './maps.ts';

async function normalised(input: Uint8Array) {
  const result = await normaliseMap(input);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return { ...result.map, metadata: await sharp(result.map.buffer).metadata() };
}

async function refused(input: Uint8Array) {
  const result = await normaliseMap(input);
  assert.equal(result.ok, false);
  return result.ok ? '' : result.error;
}

test('JPEG, PNG and WebP maps are stored as JPEG at their own size', async () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const map = await normalised(await testImageBytes(format, 300, 200));
    assert.equal(map.mimeType, 'image/jpeg', format);
    assert.equal(map.metadata.format, 'jpeg', format);
    assert.deepEqual([map.width, map.height], [300, 200], format);
    assert.deepEqual([map.metadata.width, map.metadata.height], [300, 200], format);
  }
});

test('a map larger than 4096 px is reduced to fit, keeping its proportion', async () => {
  const map = await normalised(await testImageBytes('png', 5000, 2500));
  assert.deepEqual([map.width, map.height], [4096, 2048]);
  assert.deepEqual([map.metadata.width, map.metadata.height], [4096, 2048]);
});

test('the EXIF rotation is applied to the pixels and no metadata is kept', async () => {
  const rotated = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#335533' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const map = await normalised(new Uint8Array(rotated));
  assert.deepEqual([map.width, map.height], [100, 300]);
  assert.equal(map.metadata.orientation, undefined);
  assert.equal(map.metadata.exif, undefined);
});

test('a GIF, an SVG or bytes that are not an image are refused', async () => {
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>',
  );
  for (const input of [await testImageBytes('gif', 100, 100), svg, new Uint8Array([1, 2, 3])]) {
    assert.match(await refused(input), /não é uma imagem válida/);
  }
});

test('a side below 64 px or above 8192 px is refused before decoding', async () => {
  assert.match(await refused(await testImageBytes('png', 63, 500)), /de 64 a 8192 pixels/);
  assert.match(await refused(await testImageBytes('png', 8193, 64)), /de 64 a 8192 pixels/);
});
