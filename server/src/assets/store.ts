import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** Character avatars are images; the VTT will reuse this list for maps. */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** 5 MB keeps a self-hosted table's disk predictable. */
export const MAX_ASSET_SIZE = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type StoredAsset = {
  /** Relative path under the uploads directory; persisted in the `assets` table. */
  path: string;
  /** URL the client can load directly. */
  url: string;
};

/**
 * Uploads land on local disk behind this abstraction, so the VTT can swap it
 * for object storage later without touching the routes.
 */
export type AssetStore = {
  save(campaignId: string, buffer: Uint8Array, mimeType: string): Promise<StoredAsset>;
};

export function createDiskAssetStore(uploadsDir: string): AssetStore {
  const root = resolve(uploadsDir);
  return {
    async save(campaignId, buffer, mimeType) {
      const extension = EXTENSION_BY_MIME[mimeType];
      const relative = `campaigns/${campaignId}/${randomUUID()}.${extension}`;
      const target = join(root, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
      return { path: relative, url: `/uploads/${relative}` };
    },
  };
}

/** For tests: no disk, just a URL. The upload route is still exercised. */
export function createMemoryAssetStore(): AssetStore {
  return {
    async save(campaignId, _buffer, mimeType) {
      const extension = EXTENSION_BY_MIME[mimeType];
      const relative = `campaigns/${campaignId}/${randomUUID()}.${extension}`;
      return { path: relative, url: `/uploads/${relative}` };
    },
  };
}