import sharp from 'sharp';
import { MAP_LIMITS as M } from '@quest-fast/shared';
import { oneDecodeAtATime } from './image.ts';

const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);
const MAX_INPUT_PIXELS = M.maxInputSide * M.maxInputSide;

export type NormalizedMap = { buffer: Uint8Array; mimeType: 'image/jpeg'; width: number; height: number };

export type MapResult = { ok: true; map: NormalizedMap } | { ok: false; error: string };

const NOT_A_MAP = 'O arquivo não é uma imagem válida. Use JPEG, PNG ou WebP.';

/**
 * Decodes a map upload and stores the server's own copy: EXIF rotation applied
 * to the pixels, at most `maxOutputSide` on a side (never enlarged), JPEG
 * mozjpeg q82 with no metadata. Transparency becomes white, the colour of the
 * paper a map is drawn on. `width`/`height` are the copy's pixels: the space
 * the grid, the tokens and the fog are measured in.
 */
export function normaliseMap(input: Uint8Array): Promise<MapResult> {
  return oneDecodeAtATime(() => normalise(input));
}

async function normalise(input: Uint8Array): Promise<MapResult> {
  // The header is read before decoding, so a huge image is refused cheaply.
  let metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    return { ok: false, error: NOT_A_MAP };
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) return { ok: false, error: NOT_A_MAP };
  const { width, height } = metadata;
  if (!width || !height) return { ok: false, error: NOT_A_MAP };
  if (Math.min(width, height) < M.minSide || Math.max(width, height) > M.maxInputSide) {
    return {
      ok: false,
      error: `O mapa deve ter de ${M.minSide} a ${M.maxInputSide} pixels de lado.`,
    };
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: M.maxOutputSide, height: M.maxOutputSide, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      map: { buffer: new Uint8Array(data), mimeType: 'image/jpeg', width: info.width, height: info.height },
    };
  } catch {
    return { ok: false, error: NOT_A_MAP };
  }
}
