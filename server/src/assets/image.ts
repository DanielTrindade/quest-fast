import sharp from 'sharp';

export const AVATAR_MAX_SIDE = 512;

export const AVATAR_MAX_INPUT_SIDE = 8192;
const MAX_INPUT_PIXELS = AVATAR_MAX_INPUT_SIDE * AVATAR_MAX_INPUT_SIDE;

const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif']);

export type NormalizedImage = { buffer: Uint8Array; mimeType: 'image/webp' };

export type NormalizeResult =
  | { ok: true; image: NormalizedImage }
  | { ok: false; error: string };

// A full decode of an 8192 × 8192 image can take ~400 MB, and the limits above are
// per image: running uploads one at a time keeps parallel requests from
// multiplying that peak inside the single server process.
let queue: Promise<unknown> = Promise.resolve();

export function normalizeAvatar(input: Uint8Array): Promise<NormalizeResult> {
  const run = queue.then(() => normalize(input));
  queue = run.catch(() => undefined);
  return run;
}

// Re-encoding drops every metadata block (EXIF, GPS). sharp decodes only the
// first frame of an animated GIF, which bounds the work per upload.
async function normalize(input: Uint8Array): Promise<NormalizeResult> {
  const notAnImage = { ok: false, error: 'O arquivo não é uma imagem válida. Use PNG, JPEG, WebP ou GIF.' } as const;

  let metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    return notAnImage;
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) return notAnImage;
  if (!metadata.width || !metadata.height) return notAnImage;
  if (metadata.width > AVATAR_MAX_INPUT_SIDE || metadata.height > AVATAR_MAX_INPUT_SIDE) {
    return {
      ok: false,
      error: `A imagem deve ter até ${AVATAR_MAX_INPUT_SIDE} × ${AVATAR_MAX_INPUT_SIDE} pixels.`,
    };
  }

  try {
    const output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: AVATAR_MAX_SIDE, height: AVATAR_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, image: { buffer: new Uint8Array(output), mimeType: 'image/webp' } };
  } catch {
    return notAnImage;
  }
}
