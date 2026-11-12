import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { testImageBytes } from '../testing.ts';
import { AVATAR_MAX_SIDE, normalizeAvatar } from './image.ts';

async function normalized(input: Uint8Array) {
  const result = await normalizeAvatar(input);
  assert.ok(result.ok, result.ok ? '' : result.error);
  return { ...result.image, metadata: await sharp(result.image.buffer).metadata() };
}

async function refused(input: Uint8Array) {
  const result = await normalizeAvatar(input);
  assert.equal(result.ok, false);
  return result.ok ? '' : result.error;
}

test('every accepted format is re-encoded as WebP', async () => {
  for (const format of ['png', 'jpeg', 'webp', 'gif'] as const) {
    const image = await normalized(await testImageBytes(format));
    assert.equal(image.mimeType, 'image/webp', format);
    assert.equal(image.metadata.format, 'webp', format);
  }
});

test('bytes that are not an image are refused', async () => {
  for (const input of [
    new Uint8Array([1, 2, 3]),
    new TextEncoder().encode('<?php echo "oi"; ?>'),
    new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n'),
  ]) {
    assert.match(await refused(input), /não é uma imagem válida/);
  }
});

test('a decodable image in a format outside the list is refused', async () => {
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
  );
  const tiff = new Uint8Array(
    await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).tiff().toBuffer(),
  );
  await refused(svg);
  await refused(tiff);
});

test('a truncated image is refused', async () => {
  const png = await testImageBytes('png', 64, 64);
  await refused(png.subarray(0, Math.floor(png.length / 2)));
});

test('an image above the pixel limit is refused before decoding', async () => {
  // Only the header is read, so a PNG that claims 10000 × 10000 is enough.
  const png = Buffer.from(await testImageBytes('png', 1, 1));
  png.writeUInt32BE(10000, 16);
  png.writeUInt32BE(10000, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  assert.match(await refused(new Uint8Array(png)), /8192 × 8192/);
});

test('EXIF and GPS metadata do not survive', async () => {
  const input = new Uint8Array(
    await sharp({ create: { width: 16, height: 16, channels: 3, background: '#888' } })
      .withExif({
        IFD0: { Copyright: 'Lia Martins', Make: 'Câmera' },
        IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '23/1 32/1 0/1' },
      })
      .jpeg()
      .toBuffer(),
  );
  assert.ok((await sharp(input).metadata()).exif, 'the fixture carries EXIF');

  const image = await normalized(input);
  assert.equal(image.metadata.exif, undefined);
  assert.equal(image.metadata.icc, undefined);
  assert.equal(image.metadata.xmp, undefined);
  assert.doesNotMatch(Buffer.from(image.buffer).toString('latin1'), /Lia Martins|GPS/);
});

test('the EXIF orientation is applied to the pixels', async () => {
  const input = new Uint8Array(
    await sharp({ create: { width: 200, height: 100, channels: 3, background: '#888' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
  );

  const image = await normalized(input);
  assert.equal(image.metadata.width, 100);
  assert.equal(image.metadata.height, 200);
  assert.equal(image.metadata.orientation, undefined);
});

test('a large image is reduced to 512 px on its longest side, keeping proportions', async () => {
  const image = await normalized(await testImageBytes('png', 2000, 1000));
  assert.equal(image.metadata.width, AVATAR_MAX_SIDE);
  assert.equal(image.metadata.height, AVATAR_MAX_SIDE / 2);
});

test('a small image is not enlarged', async () => {
  const image = await normalized(await testImageBytes('png', 40, 30));
  assert.equal(image.metadata.width, 40);
  assert.equal(image.metadata.height, 30);
});

test('transparency is kept', async () => {
  const input = new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer(),
  );
  assert.equal((await normalized(input)).metadata.hasAlpha, true);
});

test('an animated GIF keeps only its first frame', async () => {
  const frame = (background: string) =>
    sharp({ create: { width: 10, height: 10, channels: 3, background } }).png().toBuffer();
  const input = new Uint8Array(
    await sharp([await frame('#f00'), await frame('#00f')], { join: { animated: true } }).gif().toBuffer(),
  );
  assert.equal((await sharp(input).metadata()).pages, 2, 'the fixture is animated');

  const image = await normalized(input);
  assert.equal(image.metadata.pages, undefined);
  assert.equal(image.metadata.height, 10);
});
