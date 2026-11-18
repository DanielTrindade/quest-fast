/**
 * The square the player framed for an avatar, relative to the image as it is
 * shown (EXIF orientation applied): `x` and `y` are the top-left corner as a
 * fraction of the width and height, `size` the side as a fraction of the
 * shorter side. Fractions keep the crop valid whatever the image's resolution.
 */
export type AvatarCrop = { x: number; y: number; size: number };

export type PixelRect = { left: number; top: number; side: number };

export const AVATAR_CROP_MAX_ZOOM = 5;

const MIN_SIZE = 1 / AVATAR_CROP_MAX_ZOOM;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function parseAvatarCrop(value: unknown): AvatarCrop | null {
  if (typeof value !== 'object' || value === null) return null;
  const { x, y, size } = value as Record<string, unknown>;
  for (const n of [x, y, size]) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  }
  const crop = { x, y, size } as AvatarCrop;
  if (crop.x < 0 || crop.x > 1 || crop.y < 0 || crop.y > 1) return null;
  if (crop.size < MIN_SIZE - 1e-9 || crop.size > 1) return null;
  return crop;
}

/** Keeps the square inside the image and within the zoom limits. */
export function clampAvatarCrop(crop: AvatarCrop, width: number, height: number): AvatarCrop {
  const shorter = Math.min(width, height);
  const size = clamp(crop.size, MIN_SIZE, 1);
  const side = size * shorter;
  return {
    size,
    x: clamp(crop.x, 0, (width - side) / width),
    y: clamp(crop.y, 0, (height - side) / height),
  };
}

/** The largest square, centred across and leaning to the top, where faces usually are. */
export function defaultAvatarCrop(width: number, height: number): AvatarCrop {
  const side = Math.min(width, height);
  return { size: 1, x: (width - side) / 2 / width, y: ((height - side) * 0.2) / height };
}

/** Moves the square's centre to the same point after changing its size. */
export function zoomAvatarCrop(crop: AvatarCrop, size: number, width: number, height: number): AvatarCrop {
  const shorter = Math.min(width, height);
  const centreX = crop.x * width + (crop.size * shorter) / 2;
  const centreY = crop.y * height + (crop.size * shorter) / 2;
  const side = size * shorter;
  return clampAvatarCrop({ size, x: (centreX - side / 2) / width, y: (centreY - side / 2) / height }, width, height);
}

/** The crop in whole pixels, always inside the image and at least 1 px wide. */
export function avatarCropRect(crop: AvatarCrop, width: number, height: number): PixelRect {
  const shorter = Math.min(width, height);
  const side = clamp(Math.round(crop.size * shorter), 1, shorter);
  return {
    side,
    left: clamp(Math.round(crop.x * width), 0, width - side),
    top: clamp(Math.round(crop.y * height), 0, height - side),
  };
}
