import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
  /**
   * `campaigns/<campaignId>/<uuid>.<ext>`, persisted in the `assets` table. The
   * same path is the file under the uploads directory and the key in the
   * bucket, so moving from disk to R2 is copying the folder as it is.
   */
  path: string;
  /** URL the client can load directly. */
  url: string;
};

/**
 * Where uploads live: local disk by default, Cloudflare R2 when configured.
 * The routes only see this, so the backend is picked once at startup.
 */
export type AssetStore = {
  save(campaignId: string, buffer: Uint8Array, mimeType: string): Promise<StoredAsset>;
  /** The URL for a stored path; avatars are read back by path, not by URL. */
  urlFor(path: string): string;
};

function newPath(campaignId: string, mimeType: string) {
  return `campaigns/${campaignId}/${randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;
}

const diskUrl = (path: string) => `/uploads/${path}`;

export function createDiskAssetStore(uploadsDir: string): AssetStore {
  const root = resolve(uploadsDir);
  return {
    async save(campaignId, buffer, mimeType) {
      const path = newPath(campaignId, mimeType);
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
      return { path, url: diskUrl(path) };
    },
    urlFor: diskUrl,
  };
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base of the bucket, e.g. `https://cdn.example.com`, no trailing slash. */
  publicUrl: string;
};

/** The one call the store makes; tests pass a fake that records it. */
export type R2Client = { send(command: PutObjectCommand): Promise<unknown> };

/** R2 speaks the S3 API: the AWS SDK pointed at the account's endpoint. */
export function createR2Client({ accountId, accessKeyId, secretAccessKey }: R2Config): R2Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Uploads go to an R2 bucket and are read straight from its public URL, served
 * by Cloudflare's network instead of this process. Each path holds a new UUID
 * and never changes, so browsers may cache it for good.
 */
export function createR2AssetStore(config: R2Config, client: R2Client = createR2Client(config)): AssetStore {
  const urlFor = (path: string) => `${config.publicUrl}/${path}`;
  return {
    async save(campaignId, buffer, mimeType) {
      const path = newPath(campaignId, mimeType);
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: path,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { path, url: urlFor(path) };
    },
    urlFor,
  };
}

/** For tests: no disk, just a URL. The upload route is still exercised. */
export function createMemoryAssetStore(): AssetStore {
  return {
    async save(campaignId, _buffer, mimeType) {
      const path = newPath(campaignId, mimeType);
      return { path, url: diskUrl(path) };
    },
    urlFor: diskUrl,
  };
}