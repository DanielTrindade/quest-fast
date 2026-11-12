import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { assets } from '@quest-fast/db';
import type { AssetUploadResponse } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { normalizeAvatar } from './image.ts';
import { MAX_ASSET_SIZE } from './store.ts';

/**
 * Avatar upload. The browser's type and file name are ignored: the server
 * decodes the image and stores its own re-encoded copy.
 */
export function assetRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);

  routes.post('/', requireCampaignRole(), async (c) => {
    const { db, assets: store } = c.var.deps;
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      return c.json({ error: 'Envie um arquivo de imagem.' }, 422);
    }
    if (file.size === 0) {
      return c.json({ error: 'O arquivo de imagem está vazio.' }, 422);
    }
    if (file.size > MAX_ASSET_SIZE) {
      return c.json({ error: 'A imagem deve ter até 5 MB.' }, 413);
    }

    const normalized = await normalizeAvatar(new Uint8Array(await file.arrayBuffer()));
    if (!normalized.ok) {
      return c.json({ error: normalized.error }, 422);
    }
    const { buffer, mimeType } = normalized.image;
    // The store may be a remote bucket: a failure there is reported, and no
    // row is written for a file that was never kept.
    let stored;
    try {
      stored = await store.save(c.var.campaignId, buffer, mimeType);
    } catch (error) {
      console.error('asset upload failed', error);
      return c.json({ error: 'Não foi possível guardar a imagem. Tente novamente.' }, 502);
    }
    const asset = db
      .insert(assets)
      .values({
        id: randomUUID(),
        campaignId: c.var.campaignId,
        uploadedById: c.var.user.id,
        path: stored.path,
        mimeType,
        size: buffer.byteLength,
      })
      .returning()
      .get();

    const response: AssetUploadResponse = { asset: { id: asset.id, url: stored.url } };
    return c.json(response, 201);
  });

  return routes;
}